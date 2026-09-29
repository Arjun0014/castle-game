import * as THREE from 'three';
import { AnimController } from './AnimController';
import type { CameraRig } from './CameraRig';
import type { Input } from '../game/Input';
import type { CollisionWorld, CapsuleResult } from '../game/Physics';
import type { TimeState } from '../levels/Materials';
import { ATTACKS, type AttackDef, type HitWindow, DODGE, PARRY_WINDOW, BLOCK_ARC_DEG, BLOCK_DAMAGE_SCALE, PLAYER_HP, speedAt } from '../combat/CombatData';
import { HERO_CLIPS, JUMP_PHASES, LOOPING, rootAt } from '../data/animationManifest';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';

export type PState = 'move' | 'crouch' | 'air' | 'land' | 'dodge' | 'attack' | 'block' | 'hit' | 'channel' | 'interact' | 'dead';

export interface PlayerEvents {
  onAttackStart?(a: AttackDef): void;
  onChannelComplete?(): void;
  onChannelStart?(): boolean;         // return false to deny
  onChannelCancel?(): void;
  onInteract?(): boolean;             // true if something consumed the interaction
  onDeath?(): void;
  onFootstep?(p: THREE.Vector3, speed: number): void;
  onDodge?(): void;
  onLand?(fall: number): void;
  onJump?(): void;
  onBlock?(parry: boolean): void;
}

const RADIUS = 0.35;
const H_STAND = 1.8;
const H_CROUCH = 1.12;
const GRAVITY = 24;
const JUMP_V = 7.4;
const RUN = 4.3;
const SPRINT = 6.3;
/** Shift held at least this long = sprint; released sooner = dodge. */
const SPRINT_HOLD = 0.22;
const WALK_GUARD = 1.7;
const CROUCH = 1.8;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  root = new THREE.Group();
  model: THREE.Object3D;
  anim: AnimController;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  state: PState = 'move';
  stateTime = 0;
  grounded = true;
  groundNormal = new THREE.Vector3(0, 1, 0);
  crouching = false;
  hp = PLAYER_HP;
  maxHp = PLAYER_HP;
  lastSafe = new THREE.Vector3();
  lastSafeTimer = 0;
  airTime = 0;
  fallStartY = 0;
  // combat
  attack: AttackDef | null = null;
  /** increments on every swing (hit bookkeeping must tell two consecutive L1s apart) */
  attackSerial = 0;
  attackClipTime = 0;
  hitsDone = new Set<number>();
  buffered: { kind: 'light' | 'heavy' | 'kick' | 'bash'; t: number } | null = null;
  lastRoot: [number, number] = [0, 0];
  blockStart = -10;
  dodgeDir = new THREE.Vector3();
  dodgeChain = 0;
  dodgeCooldown = 0;
  hitStun = 0;
  invuln = 0;
  channelTime = 0;
  readonly channelDuration = 2.4;
  lockTarget: { pos: THREE.Vector3; alive: boolean } | null = null;
  sprinting = false;
  interactTime = 0;
  footPhase = 0;
  blade = { hilt: new THREE.Vector3(), tip: new THREE.Vector3(), prevHilt: new THREE.Vector3(), prevTip: new THREE.Vector3(), bone: null as THREE.Bone | null, localHilt: new THREE.Vector3(), localTip: new THREE.Vector3() };
  events: PlayerEvents = {};
  private contact: CapsuleResult = { grounded: false, groundNormal: new THREE.Vector3(), hitCeiling: false, hitWall: false, push: new THREE.Vector3() };
  godMode = false;
  hipsBone: THREE.Bone | null = null;
  headBone: THREE.Bone | null = null;
  /** afterimage hook for dodge VFX */
  onAfterimage?: () => void;

  constructor(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
    this.model = gltf.scene;
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
      if ((o as THREE.Bone).isBone) {
        if (o.name === 'mixamorigHips') this.hipsBone = o as THREE.Bone;
        if (o.name === 'mixamorigHead') this.headBone = o as THREE.Bone;
      }
    });
    this.root.add(this.model);
    stabilizeShadowDepth(this.root);
    this.anim = new AnimController(this.model, gltf.animations, LOOPING);
    for (const id of Object.keys(HERO_CLIPS)) if (!this.anim.has(id)) throw new Error('hero.glb is missing clip ' + id);
    this.setupBlade();
  }

  /** Recover the blade segment in RightHand bone space from the sword mesh's bind pose. */
  private setupBlade() {
    let sword: THREE.SkinnedMesh | null = null;
    this.model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name.toLowerCase().includes('sword')) sword = o as THREE.SkinnedMesh; });
    if (!sword) throw new Error('hero.glb: sword mesh not found');
    const s = sword as THREE.SkinnedMesh;
    // Skeleton.pose() rebuilds the root bone's local matrix from its inverse bind matrix, which (for this
    // Blender export) already contains the armature node's 0.01 scale + 90° rotation — so the Hips end up
    // transformed twice. The AnimationMixer snapshots that as the bones' "original" state and blends toward
    // it whenever animation weight is < 1, which shrank the hero to 1/100 size. Pose only temporarily.
    const saved = s.skeleton.bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()] as const);
    s.skeleton.pose();
    this.model.updateMatrixWorld(true);
    const hand = s.skeleton.bones.find((b) => b.name === 'mixamorigRightHand');
    if (!hand) throw new Error('hero.glb: RightHand bone not found');
    const posAttr = s.geometry.attributes.position;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < posAttr.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      s.applyBoneTransform(i, p);
      pts.push(s.localToWorld(p));
    }
    const handPos = hand.getWorldPosition(new THREE.Vector3());
    let far = pts[0], near = pts[0];
    for (const p of pts) {
      if (p.distanceTo(handPos) > far.distanceTo(handPos)) far = p;
      if (p.distanceTo(handPos) < near.distanceTo(handPos)) near = p;
    }
    this.blade.bone = hand;
    this.blade.localTip.copy(hand.worldToLocal(far.clone()));
    this.blade.localHilt.copy(hand.worldToLocal(near.clone()));
    s.skeleton.bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); b.scale.copy(saved[i][2]); });
    this.model.updateMatrixWorld(true);
  }

  get height() { return this.crouching ? H_CROUCH : H_STAND; }
  get radius() { return RADIUS; }
  get alive() { return this.state !== 'dead'; }
  get isInvulnerable() { return this.invuln > 0 || this.godMode; }
  get isBlocking() { return this.state === 'block' && this.stateTime > 0.05; }
  get isChanneling() { return this.state === 'channel'; }
  get facing() { return _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  hasHyperArmor() {
    if (this.state !== 'attack' || !this.attack?.hyperArmor) return false;
    const [a, b] = this.attack.hyperArmor;
    return this.attackClipTime >= a && this.attackClipTime <= b;
  }

  teleport(p: THREE.Vector3, yaw?: number) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.lastSafe.copy(p);
    this.root.position.copy(p);
    this.root.rotation.y = this.yaw;
  }

  private setState(s: PState) { this.state = s; this.stateTime = 0; }

  /** Camera-relative desired move direction from input axes. */
  private wishDir(input: Input, cam: CameraRig) {
    const ax = input.moveAxes();
    const f = cam.forward(new THREE.Vector3());
    const r = new THREE.Vector3().crossVectors(f, UP);
    return f.multiplyScalar(ax.y).addScaledVector(r, ax.x);
  }

  private turnToward(dir: THREE.Vector3, rate: number, dt: number) {
    if (dir.lengthSq() < 1e-4) return;
    const want = Math.atan2(dir.x, dir.z);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = rate * dt;
    this.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, input: Input, cam: CameraRig, world: CollisionWorld, tstate: TimeState, autoTarget: () => THREE.Vector3 | null) {
    this.stateTime += dt;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    const wish = this.wishDir(input, cam);
    const moving = wish.lengthSq() > 0.01;
    const lock = this.lockTarget?.alive ? this.lockTarget.pos : null;

    // buffered inputs
    if (input.wasPressed('light')) this.buffered = { kind: input.isDown('block') ? 'bash' : 'light', t: input.now };
    // Guard + Heavy = kick (the touch HUD has no kick button; keyboard keeps F as well)
    if (input.wasPressed('heavy')) this.buffered = { kind: input.isDown('block') ? 'kick' : 'heavy', t: input.now };
    if (input.wasPressed('kick')) this.buffered = { kind: 'kick', t: input.now };
    if (this.buffered && input.now - this.buffered.t > 0.4) this.buffered = null;

    const canAct = this.state === 'move' || this.state === 'crouch' || this.state === 'land' || this.state === 'block';

    // ---- time shift channel (hold R)
    if (input.wasPressed('shift') && canAct && this.grounded && this.state !== 'block') {
      if (this.events.onChannelStart?.() !== false) this.beginChannel();
    }
    // ---- interact
    if (input.wasPressed('interact') && canAct && this.grounded) this.events.onInteract?.();

    // ---- dodge: the Dodge button, or a Shift tap (released before it became a sprint hold). Buffered briefly
    // so a dodge pressed late in an attack or a hit reaction still comes out as soon as it is allowed.
    const tapped = input.releasedAfter('sprint');
    if (input.wasPressed('dodge') || (tapped >= 0 && tapped < SPRINT_HOLD)) this.dodgeBuffered = input.now;
    if (this.dodgeBuffered >= 0 && input.now - this.dodgeBuffered > 0.28) this.dodgeBuffered = -1;
    if (this.dodgeBuffered >= 0 && this.dodgeCooldown <= 0 && this.grounded &&
      (canAct || (this.state === 'attack' && this.attack && this.attackClipTime >= this.attack.recoveryCancel) ||
        (this.state === 'hit' && this.hitStun < 0.12))) {
      this.dodgeBuffered = -1;
      this.buffered = null;
      this.beginDodge(moving ? wish.clone().normalize() : this.facing.clone().multiplyScalar(-1));
    }
    // ---- jump
    if (input.wasPressed('jump') && this.grounded && (this.state === 'move' || this.state === 'land' || this.state === 'crouch')) {
      if (!this.crouching || this.tryStand(world, tstate)) this.beginJump(moving);
    }
    // ---- crouch toggle
    if (input.wasPressed('crouch') && this.grounded && (this.state === 'move' || this.state === 'crouch')) {
      if (this.crouching) { if (this.tryStand(world, tstate)) { this.crouching = false; this.anim.play('crouch_exit', { speed: 1.6, fade: 0.1 }); this.setState('land'); } }
      else { this.crouching = true; this.autoCrouched = false; this.anim.play('crouch_enter', { speed: 1.8, fade: 0.1 }); this.setState('crouch'); }
    }
    // ---- attacks from neutral
    if (this.buffered && (canAct || this.state === 'air') && this.state !== 'channel') {
      const b = this.buffered.kind;
      let def: AttackDef | null = null;
      if (this.state === 'air') def = b === 'light' || b === 'heavy' ? ATTACKS.AIR : null;
      else if (this.crouching) def = b === 'light' ? ATTACKS.CROUCH_L : b === 'heavy' ? ATTACKS.H1 : b === 'kick' ? ATTACKS.KICK : null;
      else if (b === 'bash' || (b === 'light' && this.state === 'block')) def = ATTACKS.BASH;
      else if (b === 'kick') def = ATTACKS.KICK;
      else if (this.sprinting && moving) def = b === 'heavy' ? ATTACKS.SPRINT_H : ATTACKS.SPRINT_L;
      else def = b === 'heavy' ? ATTACKS.H1 : ATTACKS.L1;
      if (def) {
        if (this.crouching && def.kind !== 'crouch') { if (this.tryStand(world, tstate)) this.crouching = false; else def = null; }
        if (def) { this.buffered = null; this.beginAttack(def, lock ?? autoTarget()); }
      }
    }
    // ---- guard
    if (input.isDown('block') && (this.state === 'move' || this.state === 'crouch' || this.state === 'land') && this.grounded) {
      this.setState('block');
      this.blockStart = input.now;
      this.anim.play(this.crouching ? 'crouch_block_enter' : 'block_enter', { speed: 2.0, fade: 0.06 });
    }

    // ------------------------------------------------ per-state behaviour
    let hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    switch (this.state) {
      case 'move':
      case 'crouch':
      case 'land': {
        this.sprinting = (input.analogSprint || (input.isDown('sprint') && input.heldFor('sprint') >= SPRINT_HOLD)) && moving && !this.crouching && !lock;
        if (input.autoCrouch && this.grounded) this.autoCrouch(wish, moving, world, tstate);
        const speed = this.crouching ? CROUCH : this.sprinting ? SPRINT : RUN;
        const target = wish.clone().multiplyScalar(speed);
        const accel = this.grounded ? 38 : 7;
        hv.lerp(target, Math.min(1, accel * dt / Math.max(0.5, hv.distanceTo(target) + 0.5)));
        if (lock && !this.crouching) this.turnToward(_v.subVectors(lock, this.pos).setY(0), 12, dt);
        else this.turnToward(wish, this.sprinting ? 7 : 11, dt);
        if (this.state === 'land' && this.stateTime > (this.anim.overlayId ? 0.28 : 0.12)) {
          this.setState(this.crouching ? 'crouch' : 'move');
          this.anim.release(0.18);
        }
        if (this.state === 'land' && moving && this.stateTime > 0.1) { this.setState(this.crouching ? 'crouch' : 'move'); this.anim.release(0.12); }
        this.driveLocomotion(hv, lock, dt);
        break;
      }
      case 'block': {
        const parryPhase = input.now - this.blockStart < PARRY_WINDOW;
        void parryPhase;
        const target = wish.clone().multiplyScalar(WALK_GUARD);
        hv.lerp(target, Math.min(1, 20 * dt));
        const face = lock ? _v.subVectors(lock, this.pos).setY(0) : (moving ? cam.forward(_v) : null);
        if (face) this.turnToward(face, 9, dt);
        if (this.stateTime > 0.12 && this.anim.overlayId?.includes('enter')) this.anim.release(0.12);
        if (!input.isDown('block')) {
          this.setState(this.crouching ? 'crouch' : 'land');
          this.anim.play(this.crouching ? 'crouch_block_exit' : 'block_exit', { speed: 2.2, fade: 0.08 });
        }
        this.driveGuardLocomotion(hv);
        break;
      }
      case 'air': {
        const target = wish.clone().multiplyScalar(this.sprinting ? SPRINT : RUN);
        hv.lerp(target, Math.min(1, 3.2 * dt));
        this.turnToward(wish, 4, dt);
        this.driveAir();
        break;
      }
      case 'dodge': {
        const t = this.stateTime / DODGE.duration;
        const sp = (DODGE.distance / DODGE.duration) * (t < 0.7 ? 1.25 : 1.25 * (1 - (t - 0.7) / 0.3) + 0.2);
        hv.copy(this.dodgeDir).multiplyScalar(sp);
        this.invuln = this.stateTime > DODGE.iframes[0] && this.stateTime < DODGE.iframes[1] ? 0.05 : this.invuln;
        if (Math.floor(this.stateTime * 30) % 2 === 0) this.onAfterimage?.();
        if (this.stateTime >= DODGE.duration) {
          this.setState('land');
          this.anim.release(0.14);
        }
        break;
      }
      case 'attack': {
        hv = this.updateAttack(dt, input, lock ?? autoTarget(), world, tstate);
        break;
      }
      case 'hit': {
        hv.multiplyScalar(Math.max(0, 1 - dt * 6));
        this.hitStun -= dt;
        if (this.hitStun <= 0) { this.setState('land'); this.anim.release(0.2); }
        break;
      }
      case 'channel': {
        hv.set(0, 0, 0);
        this.channelTime += dt;
        if (!input.isDown('shift')) { this.cancelChannel(); break; }
        if (this.channelTime >= this.channelDuration) {
          this.anim.setOverlaySpeed(1.0);
          this.setState('land');
          this.stateTime = -0.9; // let the plunge/rise finish
          this.events.onChannelComplete?.();
        }
        break;
      }
      case 'interact': {
        hv.set(0, 0, 0);
        this.interactTime -= dt;
        if (this.interactTime <= 0) { this.setState('land'); this.anim.release(0.3); }
        break;
      }
      case 'dead': {
        hv.multiplyScalar(Math.max(0, 1 - dt * 4));
        break;
      }
    }

    // ------------------------------------------------ physics integration
    this.vel.x = hv.x; this.vel.z = hv.z;
    this.vel.y -= GRAVITY * dt;
    if (this.grounded && this.vel.y < 0) this.vel.y = -2;
    const wasGrounded = this.grounded;
    this.integrate(dt, world, tstate);
    if (!this.grounded) {
      this.airTime += dt;
      if (wasGrounded) this.fallStartY = this.pos.y;
      this.fallStartY = Math.max(this.fallStartY, this.pos.y);
      if (this.airTime > 0.22 && (this.state === 'move' || this.state === 'land' || this.state === 'crouch' || this.state === 'block')) {
        if (this.crouching && this.tryStand(world, tstate)) this.crouching = false;
        this.setState('air');
        this.anim.play('jump_stand', { start: JUMP_PHASES.jump_stand.apex / 30, speed: 0.15, fade: 0.25 });
      }
    } else {
      if (this.state === 'air' || (this.airTime > 0.35 && this.state === 'attack' && this.attack?.kind === 'air')) {
        const fall = this.fallStartY - this.pos.y;
        if (this.state === 'air') this.land(fall);
        this.events.onLand?.(fall);
      }
      this.airTime = 0;
      this.lastSafeTimer += dt;
      if (this.lastSafeTimer > 0.4 && this.contact.groundNormal.y > 0.8 && (this.state === 'move' || this.state === 'crouch')) {
        this.lastSafeTimer = 0;
        // only remember spots with solid footing all around (never the brink of a pit)
        let ok = true;
        for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9], [0.65, 0.65], [-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65]]) {
          const q = _v.set(this.pos.x + dx, this.pos.y, this.pos.z + dz);
          const gy = world.groundBelow(q, 0.8, tstate);
          if (gy === null || Math.abs(gy - this.pos.y) > 0.5) { ok = false; break; }
        }
        if (ok) this.lastSafe.copy(this.pos);
      }
    }

    // presentation
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.model.updateMatrixWorld(true);
    this.updateBlade();
    // footsteps
    if (this.grounded && (this.state === 'move' || this.state === 'crouch') && hv.lengthSq() > 1) {
      this.footPhase += dt * hv.length() * 0.55;
      if (this.footPhase > 1) { this.footPhase -= 1; this.events.onFootstep?.(this.pos, hv.length()); }
    }
  }

  private integrate(dt: number, world: CollisionWorld, tstate: TimeState) {
    const delta = _v.copy(this.vel).multiplyScalar(dt);
    const steps = Math.max(1, Math.ceil(delta.length() / (RADIUS * 0.7)));
    delta.divideScalar(steps);
    this.grounded = false;
    for (let i = 0; i < steps; i++) {
      this.pos.add(delta);
      const r = world.resolveCapsule(this.pos, RADIUS, this.height, tstate, this.contact);
      if (r.grounded) {
        this.grounded = true;
        this.groundNormal.copy(r.groundNormal);
        if (this.vel.y < 0) this.vel.y = 0;
      }
      if (r.hitCeiling && this.vel.y > 0) this.vel.y = 0;
    }
    // ground snap (stairs/ramps going down)
    if (!this.grounded && this.vel.y <= 0 && this.airTime < 0.15 && this.state !== 'air') {
      const g = world.groundBelow(this.pos, 0.45, tstate);
      if (g !== null && this.pos.y - g < 0.45) {
        this.pos.y = g + 0.01;
        world.resolveCapsule(this.pos, RADIUS, this.height, tstate, this.contact);
        this.grounded = true;
        this.vel.y = 0;
      }
    }
  }

  /** 'dodge' press time while waiting to be allowed (-1 = none) */
  dodgeBuffered = -1;
  /** crouch entered by autoCrouch (touch): only these are stood up automatically */
  private autoCrouched = false;
  /**
   * Touch has no crouch button: walking into a gap too low to stand in (but open at crouch height) crouches,
   * and an auto-crouch stands back up once there is headroom here and a step ahead.
   */
  private autoCrouch(wish: THREE.Vector3, moving: boolean, world: CollisionWorld, tstate: TimeState) {
    if (this.state !== 'move' && this.state !== 'crouch') return;
    const dir = moving ? _v.copy(wish).setY(0).normalize() : null;
    if (!this.crouching) {
      if (!dir) return;
      const probe = this.pos.clone().addScaledVector(dir, 0.5);
      probe.y += 0.02;
      if (world.overlap(probe, RADIUS - 0.03, H_STAND, tstate) > 0.02 && world.overlap(probe, RADIUS - 0.03, H_CROUCH, tstate) < 0.02) {
        this.crouching = true;
        this.autoCrouched = true;
        this.anim.play('crouch_enter', { speed: 2.2, fade: 0.08 });
        this.setState('crouch');
      }
      return;
    }
    if (!this.autoCrouched || this.stateTime < 0.25 || !this.tryStand(world, tstate)) return;
    if (dir) {
      const probe = this.pos.clone().addScaledVector(dir, 0.55);
      probe.y += 0.02;
      if (world.overlap(probe, RADIUS - 0.03, H_STAND, tstate) > 0.02) return;
    }
    this.crouching = false;
    this.autoCrouched = false;
    this.anim.play('crouch_exit', { speed: 1.8, fade: 0.1 });
    this.setState('move');
  }

  tryStand(world: CollisionWorld, tstate: TimeState) {
    const p = this.pos.clone();
    return world.overlap(p, RADIUS - 0.02, H_STAND, tstate) < 0.02;
  }

  // ------------------------------------------------------------------ locomotion animation
  private driveLocomotion(hv: THREE.Vector3, lock: THREE.Vector3 | null, dt: number) {
    const speed = hv.length();
    if (this.crouching) {
      const m = Math.min(1, speed / CROUCH);
      this.anim.setBase({ crouch_idle: 1 - m, crouch_ready: m }, { crouch_ready: 0.6 + m * 0.9 });
      return;
    }
    if (lock && speed > 0.2) {
      // directional strafe blend in the character's local frame
      const f = this.facing;
      const r = _v.crossVectors(f, UP);
      const lf = hv.dot(f) / speed;
      const lr = hv.dot(r) / speed;
      const run = speed > 2.8;
      const w: Record<string, number> = {};
      const ts: Record<string, number> = {};
      const set = (id: string, weight: number, clipSpeed: number) => { if (weight > 0.01) { w[id] = weight; ts[id] = speed / clipSpeed; } };
      set(run ? 'run_fwd' : 'walk_fwd', Math.max(0, lf), run ? 4.06 : 1.47);
      set(run ? 'run_back' : 'walk_back', Math.max(0, -lf), run ? 4.3 : 1.12);
      set(run ? 'strafe_run_right' : 'strafe_walk_right', Math.max(0, lr), run ? 3.33 : 1.2);
      set(run ? 'strafe_run_left' : 'strafe_walk_left', Math.max(0, -lr), run ? 3.41 : 1.07);
      this.anim.setBase(w, ts);
      return;
    }
    if (speed < 0.25) {
      this.idleTime += dt;
      this.anim.setBase({ idle_combat: 1 });
      return;
    }
    this.idleTime = 0;
    if (speed < 2.2) {
      const k = THREE.MathUtils.clamp((speed - 0.25) / 1.5, 0, 1);
      this.anim.setBase({ idle_combat: 1 - k, walk_fwd: k }, { walk_fwd: Math.max(0.6, speed / 1.47) });
    } else {
      const k = THREE.MathUtils.clamp((speed - 2.2) / 1.6, 0, 1);
      this.anim.setBase({ walk_fwd: 1 - k, run_fwd: k }, { walk_fwd: speed / 1.47 * 0.6, run_fwd: speed / 4.06 });
      this.anim.syncPhase(['walk_fwd', 'run_fwd']);
    }
  }
  idleTime = 0;

  private driveGuardLocomotion(hv: THREE.Vector3) {
    const speed = hv.length();
    const upper = this.crouching ? 'crouch_block_idle.upper' : 'block_idle.upper';
    if (this.crouching) { this.anim.setBase({ crouch_block_idle: 1 }); return; }
    if (speed < 0.2) { this.anim.setBase({ block_idle: 1 }); return; }
    const f = this.facing;
    const r = _v.crossVectors(f, UP);
    const lf = hv.dot(f) / speed, lr = hv.dot(r) / speed;
    const w: Record<string, number> = { [upper]: 1 };
    const ts: Record<string, number> = {};
    const set = (id: string, weight: number, clipSpeed: number) => { if (weight > 0.01) { w[id + '.lower'] = weight; ts[id + '.lower'] = speed / clipSpeed; } };
    set('walk_fwd', Math.max(0, lf), 1.47);
    set('walk_back', Math.max(0, -lf), 1.12);
    set('strafe_walk_right', Math.max(0, lr), 1.2);
    set('strafe_walk_left', Math.max(0, -lr), 1.07);
    this.anim.setBase(w, ts);
  }

  private driveAir() {
    const id = this.anim.overlayId;
    if (id !== 'jump_stand' && id !== 'jump_run') return;
    const ph = id === 'jump_stand' ? JUMP_PHASES.jump_stand : JUMP_PHASES.jump_run;
    const t = this.anim.overlayTime * 30;
    if (this.vel.y > 1.5) this.anim.setOverlaySpeed(t < ph.apex ? 0.9 : 0.05);
    else if (this.vel.y > -3) this.anim.setOverlaySpeed(t < ph.apex + 2 ? 0.5 : 0.05);
    else this.anim.setOverlaySpeed(t < ph.fall[1] - 3 ? 0.6 : 0.0);
  }

  private beginJump(moving: boolean) {
    this.vel.y = JUMP_V;
    this.grounded = false;
    this.fallStartY = this.pos.y;
    this.setState('air');
    const id = moving && this.sprinting ? 'jump_run' : 'jump_stand';
    const ph = JUMP_PHASES[id];
    this.anim.play(id, { start: (ph.takeoff[1] - 1) / 30, speed: 1.2, fade: 0.08 });
    this.events.onJump?.();
  }

  private land(fall: number) {
    this.setState('land');
    if (fall > 2.2) {
      this.anim.play('jump_stand', { start: JUMP_PHASES.jump_stand.land[0] / 30, speed: fall > 4.5 ? 0.9 : 1.4, fade: 0.06 });
    } else {
      this.anim.release(0.15);
      this.stateTime = 0.1;
    }
  }

  private beginDodge(dir: THREE.Vector3) {
    this.dodgeChain = this.stateTime < 0.5 && this.state === 'land' ? this.dodgeChain + 1 : 1;
    this.dodgeCooldown = this.dodgeChain >= DODGE.chainMax ? DODGE.chainCooldown : DODGE.duration + DODGE.cooldown;
    if (this.crouching) this.crouching = false;
    this.dodgeDir.copy(dir).setY(0).normalize();
    // pick the directional clip relative to facing (or face the dash direction when free)
    const lock = this.lockTarget?.alive;
    let id = 'run_fwd';
    if (lock) {
      const f = this.facing, r = _v.crossVectors(f, UP);
      const lf = this.dodgeDir.dot(f), lr = this.dodgeDir.dot(r);
      id = Math.abs(lf) >= Math.abs(lr) ? (lf >= 0 ? 'run_fwd' : 'run_back') : (lr > 0 ? 'strafe_run_right' : 'strafe_run_left');
    } else {
      const back = this.dodgeDir.dot(this.facing) < -0.7 && this.state !== 'move';
      if (back) id = 'run_back';
      else this.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    }
    this.attack = null;
    this.setState('dodge');
    this.anim.play(id, { speed: 2.1, fade: 0.05, loop: true });
    this.events.onDodge?.();
  }

  // ------------------------------------------------------------------ attacks
  beginAttack(def: AttackDef, target: THREE.Vector3 | null) {
    this.attack = def;
    this.attackSerial++;
    this.attackClipTime = def.start;
    this.hitsDone.clear();
    this.lastRoot = rootAt(def.clip, def.start);
    this.setState('attack');
    this.anim.play(def.clip, { start: def.start, speed: speedAt(def, def.start), fade: 0.09 });
    if (target) this.turnToward(_v.subVectors(target, this.pos).setY(0), 100, 1);
    this.events.onAttackStart?.(def);
  }

  private updateAttack(dt: number, input: Input, target: THREE.Vector3 | null, world: CollisionWorld, tstate: TimeState): THREE.Vector3 {
    const def = this.attack!;
    const prevT = this.attackClipTime;
    this.attackClipTime = this.anim.overlayTime;
    const t = this.attackClipTime;
    // pacing: quick anticipation, accelerated strike, a beat of hang on the follow-through, fast recovery
    this.anim.setOverlaySpeed(speedAt(def, t));
    if (target && t < def.start + def.track) this.turnToward(_v.subVectors(target, this.pos).setY(0), 7, dt);
    // root motion: clip-space delta → world velocity
    const r = rootAt(def.clip, t);
    const df = (r[0] - this.lastRoot[0]) * def.rootScale;
    const dr = (r[1] - this.lastRoot[1]) * def.rootScale;
    this.lastRoot = r;
    const f = this.facing.clone();
    const rt = new THREE.Vector3().crossVectors(f, UP);
    const hv = f.multiplyScalar(df).addScaledVector(rt, dr).divideScalar(Math.max(1e-4, dt));
    // magnetism: during the wind-up, close the gap to a target just out of reach so the blade connects
    const first = def.hits[0];
    if (def.lunge && target && first && t < first.t0) {
      const to = _v.subVectors(target, this.pos).setY(0);
      const d = to.length();
      const ideal = Math.max(1.1, (first.reach ?? 1.9) * 0.62);
      if (d > ideal && d < 5.5) {
        const left = Math.max(0.08, (first.t0 - t) / speedAt(def, t));
        hv.addScaledVector(to.divideScalar(d), Math.min(def.lunge, (d - ideal) / left));
      }
    }
    // clamp root motion speed (safety against clip discontinuities)
    if (hv.length() > 14) hv.setLength(14);
    // stop at ledges during lunges: don't carry the player off into voids
    if (hv.lengthSq() > 0.5 && this.grounded) {
      const ahead = this.pos.clone().addScaledVector(hv.clone().normalize(), 0.6);
      if (!world.hasFooting(ahead, 1.2, tstate)) hv.set(0, 0, 0);
    }
    // follow-ups
    const buf = this.buffered;
    if (buf && t >= def.inputFrom && def.next) {
      const nextId = buf.kind === 'heavy' ? def.next.heavy : buf.kind === 'light' ? def.next.light : undefined;
      if (buf.kind === 'kick' && t >= def.recoveryCancel) { this.buffered = null; this.beginAttack(ATTACKS.KICK, target); return hv; }
      if (nextId && t >= def.cancelAt) { this.buffered = null; this.beginAttack(ATTACKS[nextId], target); return hv; }
    }
    if (input.isDown('block') && t >= def.recoveryCancel) {
      this.setState('block');
      this.blockStart = input.now;
      this.anim.play('block_enter', { start: 0.1, speed: 2.2, fade: 0.08 });
      return hv;
    }
    if (t >= def.endAt || (!this.anim.overlayId && prevT > 0)) {
      this.attack = null;
      this.setState(this.crouching ? 'crouch' : 'land');
      this.stateTime = 0.2;
      this.anim.release(0.22);
    }
    return hv;
  }

  /** Active hit windows this frame (for the combat system). */
  activeHits(): { win: HitWindow; index: number }[] {
    if (this.state !== 'attack' || !this.attack) return [];
    const out: { win: HitWindow; index: number }[] = [];
    this.attack.hits.forEach((win, index) => {
      if (!this.hitsDone.has(index) && this.attackClipTime >= win.t0 && this.attackClipTime <= win.t1) out.push({ win, index });
    });
    return out;
  }

  private updateBlade() {
    const b = this.blade;
    if (!b.bone) return;
    b.prevHilt.copy(b.hilt);
    b.prevTip.copy(b.tip);
    b.hilt.copy(b.localHilt).applyMatrix4(b.bone.matrixWorld);
    b.tip.copy(b.localTip).applyMatrix4(b.bone.matrixWorld);
  }

  // ------------------------------------------------------------------ channel
  private beginChannel() {
    if (this.crouching) this.crouching = false;
    this.setState('channel');
    this.channelTime = 0;
    const plunge = HERO_CLIPS.shift_channel.swordPeaks[0]?.t ?? 1.73;
    this.anim.play('shift_channel', { speed: plunge / this.channelDuration, fade: 0.15 });
  }

  cancelChannel() {
    if (this.state !== 'channel') return;
    this.setState('land');
    this.anim.release(0.25);
    this.events.onChannelCancel?.();
  }

  // ------------------------------------------------------------------ damage
  /**
   * Returns what happened: 'parry' | 'block' | 'hit' | 'ignored'.
   * `from` is the attacker position (for guard direction and knockback).
   */
  receiveHit(damage: number, from: THREE.Vector3, opts: { heavy?: boolean; guardBreak?: boolean; knock?: number; unblockable?: boolean } = {}, now = 0): 'parry' | 'block' | 'hit' | 'ignored' {
    if (!this.alive || this.isInvulnerable) return 'ignored';
    const toAttacker = _v.subVectors(from, this.pos).setY(0).normalize();
    const frontal = toAttacker.dot(this.facing) > Math.cos(THREE.MathUtils.degToRad(BLOCK_ARC_DEG / 2));
    if (this.state === 'block' && frontal && !opts.unblockable) {
      if (now - this.blockStart < PARRY_WINDOW) {
        this.anim.play(this.crouching ? 'crouch_block_impact' : 'block_impact', { speed: 1.8, fade: 0.04 });
        this.events.onBlock?.(true);
        return 'parry';
      }
      if (!opts.guardBreak) {
        this.hp -= damage * BLOCK_DAMAGE_SCALE;
        this.vel.addScaledVector(toAttacker, -(opts.knock ?? 1.5) * 0.6);
        this.anim.play(this.crouching ? 'crouch_block_impact' : 'block_impact', { speed: 1.6, fade: 0.04 });
        this.events.onBlock?.(false);
        if (this.hp <= 0) this.die();
        return 'block';
      }
    }
    this.hp -= damage;
    if (this.state === 'channel' && damage >= 10) this.cancelChannel();
    if (this.hp <= 0) { this.die(); return 'hit'; }
    if (this.hasHyperArmor() && !opts.heavy) return 'hit';
    this.attack = null;
    const heavy = opts.heavy || damage >= 22 || opts.guardBreak;
    if (this.crouching && this.tryStandSafe) this.crouching = false;
    this.setState('hit');
    this.hitStun = heavy ? 0.62 : 0.34;
    this.vel.set(0, this.vel.y, 0).addScaledVector(toAttacker, -(opts.knock ?? (heavy ? 4 : 2)));
    this.anim.play(heavy ? 'hit_heavy' : 'hit_light', { speed: heavy ? 1.2 : 1.5, fade: 0.05 });
    this.invuln = 0.22;
    return 'hit';
  }
  private tryStandSafe = false;

  die() {
    if (this.state === 'dead') return;
    this.hp = 0;
    this.setState('dead');
    this.attack = null;
    this.anim.play(Math.random() < 0.5 ? 'death_back' : 'death_kneel', { speed: 1.1, fade: 0.1 });
    this.events.onDeath?.();
  }

  revive(p: THREE.Vector3, yaw: number) {
    this.hp = this.maxHp;
    this.crouching = false;
    this.attack = null;
    this.setState('move');
    this.anim.release(0.01);
    this.anim.overlays.forEach((o) => o.action.stop());
    this.anim.overlays = [];
    this.anim.current = null;
    this.teleport(p, yaw);
  }

  /** Kneel at a sigil (power_up clip). */
  playInteract(duration = 1.8) {
    this.setState('interact');
    this.interactTime = duration;
    this.anim.play('power_up', { speed: 2.37 / duration, fade: 0.2 });
  }
}
