import * as THREE from 'three';
import type { Archetype, EnemyAttack } from './EnemyTypes';
import type { TimeState } from '../levels/Materials';
import type { CollisionWorld } from '../game/Physics';
import { rootAt } from '../data/animationManifest';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';

export type EnemyEvent = 'telegraph' | 'windup' | 'swing' | 'aim' | 'death' | 'alert' | 'shatter' | 'land';

/** Weapon hand per rig (GLTFLoader strips '.' and ':' from node names). knight: Hand.R, hollow: blade arm, archer: bow hand, ghost: Hand.R */
const WEAPON_BONE = /^(HandR_\d+|mixamorigRightHand_\d+|mixamorigLeftHand)$/;
const TORSO_BONE = /^(Torso_\d+|mixamorigSpine2(_\d+)?)$/;
const SASH = { offset: new THREE.Vector3(0, 0.3, 0.01), radius: 0.33, depth: 0.52, tilt: 0.78 };

export type EState = 'dormant' | 'hidden' | 'rise' | 'idle' | 'chase' | 'circle' | 'windup' | 'attack' | 'recover' | 'block' | 'hit' | 'dead' | 'shoot' | 'dive' | 'lunge';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _fw = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export interface EnemyCtx {
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  world: CollisionWorld;
  state: TimeState;
  now: number;
  requestSlot(e: Enemy, cost: number): boolean;
  releaseSlot(e: Enemy): void;
  onAttackHit(e: Enemy, atk: EnemyAttack): void;
  shoot(e: Enemy): void;
  lineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean;
}

export class Enemy {
  root = new THREE.Group();
  mixer: THREE.AnimationMixer;
  actions = new Map<string, THREE.AnimationAction>();
  cur: THREE.AnimationAction | null = null;
  curName = '';
  pos = new THREE.Vector3();
  home = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  hp: number;
  poise: number;
  state: EState = 'idle';
  stateTime = 0;
  attack: EnemyAttack | null = null;
  attackHit = false;
  lastRoot: [number, number] = [0, 0];
  cooldown = 0;
  hasSlot = false;
  stun = 0;
  deadTime = 0;
  removed = false;
  triggered = false;
  circleDir = Math.random() < 0.5 ? 1 : -1;
  thinkT = Math.random();
  losOk = true;
  shootPhase = 0;
  aimTime = 0;
  /** total aim duration of the current shot (aimProgress for the tracer / HUD) */
  aimTotal = 0.6;
  /** point-blank shot (the player closed in and the archer could not back off) */
  private panic = false;
  private repoTarget: THREE.Vector3 | null = null;
  private repoT = 0;
  get aimProgress() { return this.shootPhase === 1 ? THREE.MathUtils.clamp(1 - this.aimTime / this.aimTotal, 0, 1) : 0; }
  /** bow / eye height used for line of sight and arrow release */
  eye(out = new THREE.Vector3()) { return out.copy(this.pos).setY(this.pos.y + 1.45 * this.arch.scale); }

  /**
   * Where a shot leaves from. Perched archers stand at gallery parapets whose COLLISION is 1.9 m tall (a
   * player-only barrier; the stone is 1.2–1.3 m), so from the eye every downward line is "blocked" by
   * something the archer visibly stands above. A perched archer leans over an obstacle close ahead if it is
   * parapet-height — the line 2.05 m above its feet is clear — and never through a real wall.
   */
  firingPoint(world: CollisionWorld, state: TimeState, target: THREE.Vector3, out = new THREE.Vector3()) {
    const eye = this.eye(out);
    if (!this.opts.perch) return eye;
    const dir = _fw.copy(target).sub(eye).setY(0);
    if (dir.lengthSq() < 1e-4) return eye;
    dir.normalize();
    const hit = world.raycast(eye.clone(), dir.clone(), 1.8, state);
    if (!hit) return eye;
    const over = this.pos.clone().setY(this.pos.y + 2.05);
    if (world.raycast(over, dir.clone(), hit.distance + 0.7, state)) return eye;
    return eye.addScaledVector(dir, hit.distance + 0.5).setY(this.pos.y + 1.6 * this.arch.scale);
  }
  hitFlash = 0;
  diveDir = new THREE.Vector3();
  baseAlt = 0;
  materials: THREE.Material[] = [];
  lastHitBy = -1;
  grounded = true;
  id: number;
  static nextId = 1;
  lungeCd = 6;
  slotTime = 0;
  /** Gameplay events for audio/VFX, drained by the manager each frame. */
  events: EnemyEvent[] = [];
  /** Bone the weapon/bow hand follows (telegraph glint). */
  weaponBone: THREE.Object3D | null = null;
  torsoBone: THREE.Object3D | null = null;
  auraAcc = Math.random();
  /** presentation bookkeeping (footsteps, idle voice) */
  stepAcc = Math.random();
  lastSeen = new THREE.Vector3();
  voiceT = 2 + Math.random() * 5;
  castsShadow = true;
  /** death presentation: tumble while flung, shatter after settling */
  tumble = 0;
  tumbleRate = 0;
  settled = false;
  shatterAt = -1;
  /** hit reaction physics: lean spring (x = pitch, y = roll, radians) and a brief shake along the blow */
  private lean = new THREE.Vector2();
  private leanVel = new THREE.Vector2();
  private shakeT = 0;
  private shakeDir = new THREE.Vector3();
  /** stall-detection steering (no navmesh): see steer() */
  private navMoved = 0;
  private navExpected = 0;
  private navDetourT = 0;
  private navDir = new THREE.Vector3();

  constructor(
    public arch: Archetype,
    model: THREE.Object3D,
    clips: THREE.AnimationClip[],
    public encounter: string,
    public owner: TimeState | 'BOTH',
    public wave: number,
    public opts: { rise?: boolean; kneel?: boolean; perch?: boolean; yaw?: number; tint?: string },
  ) {
    this.id = Enemy.nextId++;
    this.root.rotation.order = 'YXZ'; // yaw, then the death tumble about the body's own right axis
    this.hp = arch.hp;
    this.poise = arch.poise;
    this.root.add(model);
    model.scale.multiplyScalar(arch.scale);
    this.mixer = new THREE.AnimationMixer(model);
    for (const c of clips) this.actions.set(c.name, this.mixer.clipAction(c));
    this.yaw = opts.yaw ?? 0;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        // per-enemy material copies (death fade) — original colours and textures untouched
        const src = Array.isArray(m.material) ? m.material : [m.material];
        const mats = src.map((mm) => {
          const c = mm.clone();
          // the death fade makes these transparent: one pass, not three's back+front pair for double-sided
          // transparent materials (that re-resolves the program twice per draw and needs extra variants)
          c.forceSinglePass = true;
          c.userData.baseOpacity = c.opacity;
          c.userData.baseTransparent = c.transparent;
          this.materials.push(c);
          return c;
        });
        m.material = Array.isArray(m.material) ? mats : mats[0];
      }
      const name = o.name;
      if (!this.weaponBone && WEAPON_BONE.test(name) && (o as THREE.Bone).isBone) this.weaponBone = o;
      if (!this.torsoBone && TORSO_BONE.test(name) && (o as THREE.Bone).isBone) this.torsoBone = o;
    });
    if (opts.tint === 'rebel') this.addSash(model);
    stabilizeShadowDepth(this.root);
    if (opts.kneel) { this.state = 'dormant'; this.pose(arch.clips.kneel ?? arch.clips.idle); }
    else if (opts.rise) { this.state = 'hidden'; this.root.visible = false; }
    else this.loop(arch.clips.idle, 1);
  }

  get alive() { return this.state !== 'dead'; }
  get radius() { return this.arch.radius * this.arch.scale; }
  get height() { return this.arch.height; }
  get isFlying() { return !!this.arch.flying; }
  get isRanged() { return !!this.arch.ranged; }
  get isBlocking() { return this.state === 'block'; }
  get center() { return _w.copy(this.pos).setY(this.pos.y + this.height * 0.55); }
  get facing() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get hasHyperArmor() { return (this.state === 'attack' || this.state === 'windup') && !!this.attack?.hyperArmor; }

  place(p: THREE.Vector3) {
    this.pos.copy(p);
    this.home.copy(p);
    this.baseAlt = p.y;
    this.root.position.copy(p);
    this.root.rotation.y = this.yaw;
  }

  // ------------------------------------------------------------------ animation helpers
  private fadeTo(name: string, fade: number) {
    const a = this.actions.get(name);
    if (!a) return null;
    if (this.cur && this.cur !== a) this.cur.fadeOut(fade);
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    this.cur = a;
    this.curName = name;
    return a;
  }
  loop(name: string, speed: number, fade = 0.25) {
    if (this.curName === name && this.cur?.loop === THREE.LoopRepeat) { this.cur.timeScale = speed; return; }
    const a = this.fadeTo(name, fade);
    if (!a) return;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.timeScale = speed;
    a.time = Math.random() * a.getClip().duration;
  }
  once(name: string, speed: number, start = 0, fade = 0.12) {
    const a = this.fadeTo(name, fade);
    if (!a) return null;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.time = start;
    return a;
  }
  private setState(s: EState) { this.state = s; this.stateTime = 0; }
  /**
   * Hold a static pose (dormant kneelers). No fade: dormant enemies only get mixer.update(0), so a fade-in
   * would never advance and they would stand in the bind (T) pose until woken.
   */
  private pose(name: string) {
    this.loop(name, 0, 0);
    this.cur?.stopFading().setEffectiveWeight(1);
    this.mixer.update(0);
  }

  activate() {
    if (this.triggered || !this.alive) return;
    this.triggered = true;
    this.events.push('alert');
    if (this.state === 'hidden') { this.root.visible = true; this.setState('rise'); this.once(this.arch.clips.rise ?? this.arch.clips.idle, 1.3, 0, 0.05)?.stopFading().setEffectiveWeight(1); }
    else if (this.state === 'dormant') { this.setState('rise'); this.once(this.arch.clips.rise ?? this.arch.clips.idle, 1.1, 0, 0.3); }
    else this.setState('chase');
  }

  // ------------------------------------------------------------------ AI
  update(dt: number, ctx: EnemyCtx) {
    this.stateTime += dt;
    this.cooldown -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.lungeCd -= dt;
    const toP = _v.subVectors(ctx.playerPos, this.pos);
    const dy = toP.y;
    toP.y = 0;
    const dist = toP.length();
    const dirP = dist > 1e-3 ? toP.clone().divideScalar(dist) : this.facing;
    let move = new THREE.Vector3();
    const a = this.arch;
    // attack slots expire so one stuck or distant enemy can never starve the rest
    if (this.hasSlot && (this.state === 'chase' || this.state === 'circle')) {
      this.slotTime += dt;
      if (this.slotTime > 4 || dist > 12) { ctx.releaseSlot(this); this.hasSlot = false; }
    }

    switch (this.state) {
      case 'hidden':
      case 'dormant':
        this.mixer.update(0);
        this.syncRoot();
        return;
      case 'rise': {
        const clipLen = this.cur?.getClip().duration ?? 1;
        if (this.stateTime > clipLen / 1.2 - 0.1) { this.setState('chase'); this.loop(a.clips.idle, 1); }
        break;
      }
      case 'idle': {
        this.loop(a.clips.idle, 1);
        if (this.triggered) this.setState('chase');
        break;
      }
      case 'chase':
      case 'circle': {
        if (!ctx.playerAlive) { this.loop(a.clips.idle, 1); break; }
        if (this.isRanged) { move = this.rangedThink(dt, dist, dirP, ctx); break; }
        if (this.isFlying) { move = this.flyThink(dt, dist, dirP, ctx); break; }
        this.turnToward(dirP, a.turnRate, dt);
        // boss: temporal lunge in the Present
        if (a.boss && ctx.state === 'PRESENT' && dist > 6 && this.lungeCd <= 0) {
          this.lungeCd = 7 + Math.random() * 3;
          this.setState('lunge');
          this.loop(a.clips.run, 2.2, 0.08);
          this.diveDir.copy(dirP);
          break;
        }
        const atk = this.pickAttack(dist);
        if (atk && this.cooldown <= 0 && (this.hasSlot || ctx.requestSlot(this, a.slotCost))) {
          this.hasSlot = true;
          if (dist <= atk.range + 0.2 && Math.abs(dy) < 1.8) { this.beginAttack(atk); break; }
          // close in
          move = dirP.clone().multiplyScalar(a.runSpeed);
          this.loop(a.clips.run, a.runSpeed / 4.06);
        } else {
          // hold a ring around the player and strafe
          const ring = 4.2 + (this.id % 3) * 0.7;
          const tangent = new THREE.Vector3().crossVectors(UP, dirP).multiplyScalar(this.circleDir);
          if (dist > ring + 1.5) { move = dirP.clone().multiplyScalar(a.runSpeed * 0.85); this.loop(a.clips.run, a.runSpeed * 0.85 / 4.06); }
          else if (dist < ring - 1.2) { move = dirP.clone().multiplyScalar(-a.walkSpeed).addScaledVector(tangent, a.walkSpeed * 0.4); this.loop(a.clips.back ?? a.clips.walk, 1); }
          else {
            move = tangent.multiplyScalar(a.walkSpeed * 0.9);
            this.loop((this.circleDir > 0 ? a.clips.strafeL : a.clips.strafeR) ?? a.clips.walk, 1);
            if (Math.random() < dt * 0.25) this.circleDir *= -1;
          }
          // blockers raise guard when the player is close
          if (a.blockChance > 0 && dist < 3 && Math.random() < dt * a.blockChance * 2) { this.setState('block'); this.loop(a.clips.block ?? a.clips.idle, 1, 0.1); }
        }
        break;
      }
      case 'lunge': {
        move = this.diveDir.clone().multiplyScalar(13);
        if (!ctx.world.hasFooting(this.pos.clone().addScaledVector(this.diveDir, 1.6).setY(this.pos.y + 1), 3.5, ctx.state)) {
          // never lunge over a floor hole: strike from here instead
          this.beginAttack(a.attacks[0]);
          move.set(0, 0, 0);
          break;
        }
        if (this.stateTime > 0.45 || dist < 2.6) {
          const atk = a.attacks[0];
          this.beginAttack(atk);
        }
        break;
      }
      case 'block': {
        this.turnToward(dirP, a.turnRate, dt);
        if (this.stateTime > 0.9 + Math.random() * 0.4) { this.setState('chase'); }
        break;
      }
      case 'windup':
      case 'attack': {
        move = this.updateAttack(dt, dist, dirP, dy, ctx);
        break;
      }
      case 'recover': {
        if (this.stateTime > 0.25) { this.setState('chase'); if (this.hasSlot) { ctx.releaseSlot(this); this.hasSlot = false; } }
        break;
      }
      case 'shoot': {
        move = this.updateShoot(dt, dist, dirP, ctx);
        break;
      }
      case 'dive': {
        move = this.updateDive(dt, dist, dirP, ctx);
        break;
      }
      case 'hit': {
        this.stun -= dt;
        if (this.stun <= 0) { this.setState('chase'); this.loop(a.clips.idle, 1, 0.2); }
        break;
      }
      case 'dead': {
        this.deadTime += dt;
        // flung bodies tumble in the air and settle when they land
        if (!this.grounded || this.deadTime < 0.1) this.tumble += this.tumbleRate * dt;
        else {
          if (!this.settled && this.deadTime > 0.15) { this.settled = true; this.events.push('land'); }
          const rest = Math.round(this.tumble / (Math.PI * 2)) * Math.PI * 2;
          this.tumble += (rest - this.tumble) * Math.min(1, dt * 10);
        }
        // the Echo breaks apart shortly after it comes to rest (or mid-air if it never lands)
        if (this.shatterAt < 0 && ((this.settled && this.deadTime > 0.95) || this.deadTime > 2.6)) {
          this.shatterAt = this.deadTime;
          this.events.push('shatter');
        }
        if (this.shatterAt >= 0) {
          const k = Math.max(0, 1 - (this.deadTime - this.shatterAt) / 0.35);
          for (const m of this.materials) { m.transparent = true; m.opacity = k * (m.userData.baseOpacity ?? 1); }
          if (k <= 0) { this.removed = true; this.root.visible = false; }
        }
        break;
      }
    }

    // knockback decay + integrate
    const drag = this.state === 'dead' && !this.grounded ? 0.5 : 7;
    this.vel.x *= Math.max(0, 1 - dt * drag);
    this.vel.z *= Math.max(0, 1 - dt * drag);
    if (!this.isFlying && (this.state === 'chase' || this.state === 'circle')) move = this.steer(move, dt, ctx);
    // walkers never step off a ledge on their own (chasing straight across a floor hole was a free kill —
    // the Kingsguard died in the Present apartments' voids 1 s into its fight); knockback still can
    if (!this.isFlying && this.alive && move.lengthSq() > 0.04) move = this.keepFooting(move, ctx);
    const hv = move.add(new THREE.Vector3(this.vel.x, 0, this.vel.z));
    const px = this.pos.x, pz = this.pos.z;
    if (this.isFlying) this.integrateFlying(dt, hv, ctx);
    else this.integrate(dt, hv, ctx.world, ctx.state);
    if (move.lengthSq() > 0.25) { this.navMoved += Math.hypot(this.pos.x - px, this.pos.z - pz); this.navExpected += move.length() * dt; }
    this.mixer.update(dt);
    this.syncRoot();
  }

  /**
   * The body takes the blow: an impulse on a lean spring (pitched back from a frontal hit, rolled from a side
   * hit) and a short high-frequency shake along the blade's direction that plays through the hit-stop.
   * `dir` = the direction the hit travels (world), `amount` = peak lean in radians.
   */
  recoil(dir: THREE.Vector3, amount: number) {
    const f = this.facing;
    const r = _fw.crossVectors(f, UP);
    const fwd = dir.x * f.x + dir.z * f.z;
    const side = dir.x * r.x + dir.z * r.z;
    this.leanVel.x += fwd * amount * 26;
    this.leanVel.y += side * amount * 26;
    this.shakeT = 0.16;
    this.shakeDir.copy(dir).setY(0).normalize();
  }

  /** Spring + shake integration on REAL time (they must animate during hit-stop, when dt is scaled down). */
  updateReaction(realDt: number) {
    const dt = Math.min(realDt, 1 / 30);
    this.leanVel.x += (-this.lean.x * 190 - this.leanVel.x * 17) * dt;
    this.leanVel.y += (-this.lean.y * 190 - this.leanVel.y * 17) * dt;
    this.lean.x += this.leanVel.x * dt;
    this.lean.y += this.leanVel.y * dt;
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
  }

  private syncRoot() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.root.rotation.x = -this.tumble + this.lean.x;
    this.root.rotation.z = this.lean.y;
    if (this.shakeT > 0) {
      const k = this.shakeT / 0.16;
      this.root.position.addScaledVector(this.shakeDir, Math.sin(this.shakeT * 170) * 0.045 * k);
    }
    if (this.isFlying && this.alive) this.root.position.y += Math.sin(performance.now() * 0.002 + this.id) * 0.12;
  }

  private integrate(dt: number, hv: THREE.Vector3, world: CollisionWorld, state: TimeState) {
    this.vel.y -= 24 * dt;
    if (this.grounded && this.vel.y < 0) this.vel.y = -2;
    const d = new THREE.Vector3(hv.x * dt, this.vel.y * dt, hv.z * dt);
    const steps = Math.max(1, Math.ceil(d.length() / 0.25));
    d.divideScalar(steps);
    this.grounded = false;
    for (let i = 0; i < steps; i++) {
      this.pos.add(d);
      if (this.state === 'dead' && this.settled && this.deadTime > 0.8) continue;
      const r = world.resolveCapsule(this.pos, this.radius, this.height, state);
      if (r.grounded) { this.grounded = true; if (this.vel.y < 0) this.vel.y = 0; }
    }
    if (!this.grounded && this.vel.y <= 0) {
      const g = world.groundBelow(this.pos, 0.4, state);
      if (g !== null) { this.pos.y = g + 0.01; this.grounded = true; this.vel.y = 0; }
    }
  }

  private integrateFlying(dt: number, hv: THREE.Vector3, ctx: EnemyCtx) {
    const g = ctx.world.groundBelow(this.pos.clone().setY(this.pos.y + 1), 12, ctx.state);
    const want = this.state === 'dive' ? ctx.playerPos.y + 0.6 : (g !== null ? g + this.arch.flying!.altitude : this.baseAlt);
    const vy = (want - this.pos.y) * 3;
    this.pos.x += hv.x * dt;
    this.pos.z += hv.z * dt;
    this.pos.y += (this.state === 'dead' ? -3 : vy) * dt;
    ctx.world.resolveCapsule(this.pos, this.radius, this.height * 0.8, ctx.state);
  }

  /**
   * Straight-line chasing snags on tombs, rubble and pillars. When an enemy has covered less than a third
   * of the ground it tried to cover, probe headings around the desired one and detour toward the most open.
   */
  private steer(move: THREE.Vector3, dt: number, ctx: EnemyCtx) {
    const speed = move.length();
    if (speed < 0.5) { this.navMoved = this.navExpected = 0; return move; }
    if (this.navDetourT > 0) {
      this.navDetourT -= dt;
      this.turnToward(this.navDir, this.arch.turnRate, dt);
      return this.navDir.clone().multiplyScalar(speed);
    }
    if (this.navExpected < 1.1) return move;
    const stalled = this.navMoved < this.navExpected * 0.33;
    this.navMoved = this.navExpected = 0;
    if (!stalled) return move;
    const base = Math.atan2(move.x, move.z);
    const o = this.pos.clone().setY(this.pos.y + 0.55);
    let best: THREE.Vector3 | null = null, bestFree = 0.9;
    for (const off of [1.0, -1.0, 1.6, -1.6, 0.55, -0.55, 2.3, -2.3]) {
      const a = base + off * this.circleDir;
      const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const hit = ctx.world.raycast(o, d, 3.5, ctx.state);
      const free = hit ? hit.distance : 3.5;
      if (free > bestFree + 0.25 && ctx.world.hasFooting(this.pos.clone().addScaledVector(d, 0.8), 1.5, ctx.state)) { bestFree = free; best = d; }
    }
    if (best) { this.navDir.copy(best); this.navDetourT = 0.5 + bestFree * 0.25; }
    else this.circleDir *= -1;
    return move;
  }

  private footT = 0;
  private footOk = true;
  /**
   * Void-aware steering: movement that would leave solid footing is replaced by the heading closest to the
   * wanted one (±30°…±150°) that has footing 1.2 m and 2.4 m out, held for a moment (navDetourT) so walkers
   * go round floor holes instead of freezing at the edge or walking in.
   */
  private keepFooting(move: THREE.Vector3, ctx: EnemyCtx) {
    const ok = (dir: THREE.Vector3) => {
      for (const k of [this.radius + 0.6, this.radius + 1.8]) {
        const a = this.pos.clone().addScaledVector(dir, k);
        a.y += 1.0;
        if (!ctx.world.hasFooting(a, 3.5, ctx.state) || ctx.world.inVoid(a.clone().setY(this.pos.y - 0.4), ctx.state)) return false;
      }
      return true;
    };
    this.footT -= 1;
    const want = _fw.copy(move).setY(0).normalize();
    if (this.footT <= 0) { this.footT = 3; this.footOk = ok(want); }
    if (this.footOk) return move;
    const speed = move.length();
    const base = Math.atan2(want.x, want.z);
    for (const off of [0.52, -0.52, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1, 2.6, -2.6]) {
      const a = base + off * this.circleDir;
      const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      if (!ok(d)) continue;
      this.navDir.copy(d);
      this.navDetourT = 0.7;
      this.footOk = true;
      this.turnToward(d, this.arch.turnRate, 1 / 60);
      return d.multiplyScalar(speed);
    }
    this.circleDir *= -1;
    return new THREE.Vector3();
  }

  /** Boss knocked to a ledge: it catches itself and reels (stagger) instead of falling. */
  catchAtEdge(ctx: { world: CollisionWorld; state: TimeState }) {
    if (!this.alive || this.isFlying) return false;
    const next = this.pos.clone().addScaledVector(_fw.set(this.vel.x, 0, this.vel.z), 0.12);
    if (ctx.world.hasFooting(next, 1.6, ctx.state) && !ctx.world.inVoid(next, ctx.state)) return false;
    this.vel.set(0, Math.min(0, this.vel.y), 0);
    this.attack = null;
    this.setState('hit');
    this.stun = 1.5;
    this.once(this.arch.clips.hitH, 0.8, 0, 0.05);
    return true;
  }

  turnToward(dir: THREE.Vector3, rate: number, dt: number) {
    if (dir.lengthSq() < 1e-5) return;
    const want = Math.atan2(dir.x, dir.z);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = rate * dt;
    this.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
  }

  // ------------------------------------------------------------------ melee
  private pickAttack(dist: number): EnemyAttack | null {
    const list = this.arch.attacks.filter((a) => a.clip && dist >= (a.minRange ?? 0) - 0.3 && dist <= a.range + 3.5);
    if (!list.length) return this.arch.attacks.find((a) => a.clip) ?? null;
    let total = list.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of list) { r -= a.weight; if (r <= 0) return a; }
    return list[0];
  }

  beginAttack(atk: EnemyAttack) {
    this.attack = atk;
    this.attackHit = false;
    this.lastRoot = rootAt(atk.clip, atk.start);
    this.setState('attack');
    this.once(atk.clip, atk.speed, atk.start, 0.1);
    this.swingCued = false;
    this.events.push(atk.telegraph ? 'telegraph' : 'windup');
    if (atk.telegraph) this.hitFlash = 1;
  }
  private swingCued = false;

  private updateAttack(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx) {
    const atk = this.attack!;
    const t = this.cur ? this.cur.time : 0;
    if (t < atk.window[0] - 0.1) this.turnToward(dirP, this.arch.turnRate * 0.9, dt);
    const r = rootAt(atk.clip, t);
    const scale = this.arch.scale * atk.rootScale;
    const df = (r[0] - this.lastRoot[0]) * scale;
    const dr = (r[1] - this.lastRoot[1]) * scale;
    this.lastRoot = r;
    const f = this.facing;
    const rt = new THREE.Vector3().crossVectors(f, UP);
    const hv = f.multiplyScalar(df).addScaledVector(rt, dr).divideScalar(Math.max(1e-4, dt));
    // don't lunge into the player's capsule
    if (dist < this.radius + 0.55) hv.multiplyScalar(0);
    if (hv.length() > 12) hv.setLength(12);
    if (hv.lengthSq() > 0.3 && !ctx.world.hasFooting(this.pos.clone().addScaledVector(hv.clone().normalize(), 0.7), 1.5, ctx.state)) hv.set(0, 0, 0);
    if (!this.swingCued && t >= atk.window[0] - 0.12) { this.swingCued = true; this.events.push('swing'); }
    if (!this.attackHit && t >= atk.window[0] && t <= atk.window[1]) {
      const toP = _v.subVectors(ctx.playerPos, this.pos).setY(0);
      const d = toP.length();
      const ang = THREE.MathUtils.radToDeg(this.facing.angleTo(toP.normalize()));
      const reach = atk.range * (this.arch.scale > 1.2 ? 1.1 : 1) + 0.35;
      if (d <= reach && (atk.arc >= 360 || ang <= atk.arc / 2) && Math.abs(dy) < 1.9) {
        this.attackHit = true;
        ctx.onAttackHit(this, atk);
      }
    }
    const clipDur = this.cur?.getClip().duration ?? 1;
    if (t >= Math.min(clipDur - 0.05, atk.window[1] + 0.45) || !this.cur?.isRunning()) {
      this.attack = null;
      this.cooldown = atk.cooldown[0] + Math.random() * (atk.cooldown[1] - atk.cooldown[0]);
      this.setState('recover');
      this.loop(this.arch.clips.idle, 1, 0.25);
    }
    return hv;
  }

  /** Called by the manager when the player's parry reflects this attack. */
  parried() {
    this.attack = null;
    this.setState('hit');
    this.stun = 1.25;
    this.once(this.arch.clips.hitH, 0.8, 0, 0.05);
    this.poise = 0;
  }

  // ------------------------------------------------------------------ ranged
  private canSee(ctx: EnemyCtx, from?: THREE.Vector3) {
    const chest = ctx.playerPos.clone().setY(ctx.playerPos.y + 1.2);
    const o = from ?? this.firingPoint(ctx.world, ctx.state, chest);
    return ctx.lineOfSight(o, chest);
  }

  /**
   * Archer brain (session 4): archers are the priority threat. They engage from long range whenever they
   * can see the player (checked 4×/s against the active state's collision — never through walls), keep their
   * distance (back off inside range[0], sidestep if there is no room), and without a clear shot they look for
   * a nearby firing spot instead of charging like a melee enemy. Perched archers never leave their perch.
   */
  private rangedThink(dt: number, dist: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    const r = this.arch.ranged!;
    const a = this.arch;
    this.turnToward(dirP, a.turnRate, dt);
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.25; this.losOk = this.canSee(ctx); }
    this.repoT -= dt;
    let move = new THREE.Vector3();
    if (!this.opts.perch) {
      if (dist < r.range[0]) {
        // too close: back away (keepFooting turns this aside at ledges); strafe if the way back is blocked
        const back = dirP.clone().negate();
        const hit = ctx.world.raycast(this.pos.clone().setY(this.pos.y + 0.6), back, 1.6, ctx.state);
        if (!hit) { move = back.multiplyScalar(a.walkSpeed * 1.3); this.loop(a.clips.back ?? a.clips.walk, 1.25); }
        else { move = new THREE.Vector3().crossVectors(UP, dirP).multiplyScalar(this.circleDir * a.walkSpeed * 1.2); this.loop((this.circleDir > 0 ? a.clips.strafeL : a.clips.strafeR) ?? a.clips.walk, 1.2); }
      } else if (!this.losOk || dist > r.range[1]) {
        if (this.repoT <= 0) { this.repoT = 1.4; this.repoTarget = this.losOk ? null : this.findFiringSpot(ctx, dirP); }
        if (this.repoTarget && this.repoTarget.distanceTo(this.pos) > 0.5) {
          move = new THREE.Vector3().subVectors(this.repoTarget, this.pos).setY(0).normalize().multiplyScalar(a.walkSpeed * 1.2);
          this.loop(a.clips.walk, 1.2);
        } else if (dist > r.range[1] && this.pos.distanceTo(this.home) < 10) {
          move = dirP.clone().multiplyScalar(a.walkSpeed); this.loop(a.clips.walk, 1);
        } else this.loop(a.clips.idle, 1);
      } else this.loop(a.clips.idle, 1);
    } else this.loop(a.clips.idle, 1);
    if (this.cooldown <= 0 && this.losOk && dist <= r.range[1] + 2) {
      this.panic = dist < 3.5;
      this.setState('shoot');
      this.shootPhase = 0;
      this.once('a_draw', this.panic ? 2.4 : 1.6, 0.1, 0.1);
    }
    return move;
  }

  /** A spot within a few metres (and within 9 m of home) with footing and a clear line to the player. */
  private findFiringSpot(ctx: EnemyCtx, dirP: THREE.Vector3): THREE.Vector3 | null {
    const side = new THREE.Vector3().crossVectors(UP, dirP);
    let best: THREE.Vector3 | null = null, bestD = Infinity;
    for (const [s, f] of [[2.5, 0], [-2.5, 0], [4.5, 0], [-4.5, 0], [3, -2], [-3, -2], [2.5, 2], [-2.5, 2]]) {
      const c = this.pos.clone().addScaledVector(side, s).addScaledVector(dirP, f);
      if (c.distanceTo(this.home) > 9) continue;
      if (!ctx.world.hasFooting(c.clone().setY(c.y + 1), 3.5, ctx.state) || ctx.world.inVoid(c, ctx.state)) continue;
      const path = ctx.world.raycast(this.pos.clone().setY(this.pos.y + 0.6), c.clone().sub(this.pos).setY(0).normalize(), Math.hypot(s, f), ctx.state);
      if (path) continue;
      if (!this.canSee(ctx, c.clone().setY(c.y + 1.45 * this.arch.scale))) continue;
      const d = Math.hypot(s, f);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /**
   * Draw → aim (readable: glint, bow-draw sound, a tracer that brightens toward release) → loose. Losing
   * sight of the player while aiming cancels the shot: breaking line of sight is the counterplay.
   */
  private updateShoot(dt: number, dist: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    const r = this.arch.ranged!;
    this.turnToward(dirP, this.arch.turnRate * (this.shootPhase === 1 ? 0.7 : 1), dt);
    const draw = this.panic ? 0.28 : 0.5;
    if (this.shootPhase === 0 && this.stateTime > draw) {
      this.shootPhase = 1;
      this.aimTotal = this.aimTime = this.panic ? 0.32 : 0.55 + Math.random() * 0.3;
      this.loop('a_aim', 1, 0.1);
      this.hitFlash = 0.8;
      this.events.push('aim');
    } else if (this.shootPhase === 1) {
      this.aimTime -= dt;
      this.thinkT -= dt;
      if (this.thinkT <= 0) { this.thinkT = 0.2; this.losOk = this.canSee(ctx); }
      if (!this.losOk) { this.cooldown = 0.5; this.shootPhase = 0; this.setState('chase'); return new THREE.Vector3(); }
      if (this.aimTime <= 0) { this.shootPhase = 2; this.once('a_recoil', 1.3, 0, 0.05); ctx.shoot(this); }
    } else if (this.shootPhase === 2 && this.stateTime > draw + this.aimTotal + 0.55) {
      this.cooldown = r.interval[0] + Math.random() * (r.interval[1] - r.interval[0]);
      this.shootPhase = 0;
      this.setState('chase');
    }
    void dist;
    return new THREE.Vector3();
  }

  // ------------------------------------------------------------------ flying (wraith)
  private flyThink(dt: number, dist: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    this.turnToward(dirP, this.arch.turnRate, dt);
    const tangent = new THREE.Vector3().crossVectors(UP, dirP).multiplyScalar(this.circleDir);
    if (this.cooldown <= 0 && dist < 9 && (this.hasSlot || ctx.requestSlot(this, 1))) {
      this.hasSlot = true;
      this.setState('dive');
      this.diveDir.copy(dirP);
      this.hitFlash = 1;
      this.events.push('telegraph');
      return new THREE.Vector3();
    }
    if (dist > 6) return dirP.clone().multiplyScalar(this.arch.runSpeed * 0.7).addScaledVector(tangent, 1.2);
    if (dist < 3.5) return dirP.clone().multiplyScalar(-2.5).addScaledVector(tangent, 2);
    return tangent.multiplyScalar(2.6);
  }

  private updateDive(dt: number, dist: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    const atk = this.arch.attacks[0];
    let move = new THREE.Vector3();
    if (this.stateTime < atk.telegraph!) { move = dirP.clone().multiplyScalar(-1.5); this.turnToward(dirP, 8, dt); }
    else if (this.stateTime < atk.telegraph! + 0.5) {
      this.diveDir.lerp(dirP, Math.min(1, dt * 3));
      move = this.diveDir.clone().multiplyScalar(12);
      if (!this.attackHit && dist < 1.5) { this.attackHit = true; ctx.onAttackHit(this, atk); }
    } else if (this.stateTime < atk.telegraph! + 1.2) move = dirP.clone().multiplyScalar(-4);
    else {
      this.attackHit = false;
      this.cooldown = atk.cooldown[0] + Math.random() * (atk.cooldown[1] - atk.cooldown[0]);
      if (this.hasSlot) { ctx.releaseSlot(this); this.hasSlot = false; }
      this.setState('chase');
    }
    return move;
  }

  // ------------------------------------------------------------------ damage
  /** Returns 'blocked' | 'stagger' | 'flinch' | 'armor' | 'dead'. */
  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    if (!this.alive) return 'dead';
    if (!this.triggered) this.activate();
    const away = _v.subVectors(this.pos, from).setY(0).normalize();
    const frontal = this.facing.dot(away.clone().negate()) > 0.35;
    this.hitFlash = 1;
    if (this.state === 'block' && frontal && !opts.guardBreak) {
      this.hp -= damage * 0.2;
      this.poise -= poiseDmg * 0.5;
      this.vel.addScaledVector(away, knock * 0.6);
      this.once(this.arch.clips.blockHit ?? this.arch.clips.hitL, 1.4, 0, 0.05);
      if (this.hp <= 0) { this.die(); return 'dead'; }
      if (this.poise > 0) return 'blocked';
    }
    this.hp -= damage;
    this.poise -= poiseDmg;
    if (this.hp <= 0) { this.vel.addScaledVector(away, knock * 1.2); this.die(); return 'dead'; }
    this.vel.addScaledVector(away, knock * (this.isFlying ? 1.6 : 1));
    if (this.hasHyperArmor && this.poise > 0 && !opts.guardBreak) return 'armor';
    const heavy = this.poise <= 0 || opts.knockdown || opts.guardBreak;
    if (heavy) this.poise = this.arch.poise;
    if (this.isFlying) { this.setState('hit'); this.stun = heavy ? 0.8 : 0.3; return heavy ? 'stagger' : 'flinch'; }
    if (this.arch.boss && !heavy) return 'armor';
    this.attack = null;
    this.setState('hit');
    this.stun = opts.knockdown ? 1.4 : heavy ? 0.95 : 0.38;
    if (opts.knockdown) this.vel.addScaledVector(away, knock * 0.8);
    this.once(heavy ? this.arch.clips.hitH : this.arch.clips.hitL, heavy ? 1.0 : 1.5, 0, 0.05);
    return heavy ? 'stagger' : 'flinch';
  }

  /** Launch the body (killing blows). power 0..1: light kills stagger back, finishers throw them. */
  fling(dir: THREE.Vector3, power: number) {
    const sp = (this.isFlying ? 6 : 3.5) + power * 10;
    this.vel.x = dir.x * sp; this.vel.z = dir.z * sp;
    this.vel.y = (this.isFlying ? 1 : 2.2) + power * 5.5;
    this.grounded = false;
    this.settled = false;
    this.tumbleRate = power > 0.55 ? (5 + Math.random() * 4) * (this.arch.scale > 1.2 ? 0.5 : 1) : 0;
  }

  die() {
    if (this.state === 'dead') return;
    this.hp = 0;
    this.attack = null;
    this.setState('dead');
    this.deadTime = 0;
    const clips = this.arch.clips.death;
    this.once(clips[Math.floor(Math.random() * clips.length)], 1.1, 0, 0.1);
    this.events.push('death');
    this.settled = false;
    this.shatterAt = -1;
    this.tumble = 0;
    this.tumbleRate = 0;
  }

  /** Mutineer red sash (blueprint E5b): a cloth band across the chest, carried rigidly by the torso bone. */
  private addSash(model: THREE.Object3D) {
    const bone = this.torsoBone;
    if (!bone) throw new Error('rebel sash: no torso bone on ' + this.arch.asset);
    // the root is still at the origin facing +Z here, so world space == the enemy's own frame
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const chest = bone.getWorldPosition(new THREE.Vector3()).add(SASH.offset);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9c1b12, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const grp = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(SASH.radius, 0.05, 6, 24), mat);
    band.scale.set(1, SASH.depth, 1);               // flatter front-to-back
    band.rotation.order = 'ZYX';
    band.rotation.set(Math.PI / 2, 0, SASH.tilt);   // belt → diagonal shoulder-to-hip band
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.4), mat);
    tail.position.set(-0.2, -0.36, 0.1);
    tail.rotation.set(0.15, 0, 0.25);
    band.castShadow = tail.castShadow = true;
    this.ownedGeo.add(band.geometry); this.ownedGeo.add(tail.geometry);
    grp.add(band, tail);
    grp.position.copy(chest);
    this.root.add(grp);
    grp.updateMatrixWorld(true);
    bone.attach(grp);
    mat.userData.baseOpacity = 1;
    this.materials.push(mat);
  }

  /** Free per-instance GPU resources: material copies, skeleton bone textures, mixer caches (not rig geometry). */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.skeleton.dispose();
      if (m.geometry && this.ownedGeo.has(m.geometry)) m.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.actions.clear();
    this.root.clear();
  }
  /** geometry this instance created itself (sash) */
  private ownedGeo = new Set<THREE.BufferGeometry>();

  /** Reset for checkpoint respawn. */
  reset() {
    this.hp = this.arch.hp;
    this.poise = this.arch.poise;
    this.pos.copy(this.home);
    this.vel.set(0, 0, 0);
    this.removed = false;
    this.triggered = false;
    this.attack = null;
    this.hasSlot = false;
    this.cooldown = 0;
    this.yaw = this.opts.yaw ?? 0;
    for (const m of this.materials) { m.opacity = m.userData.baseOpacity ?? 1; m.transparent = !!m.userData.baseTransparent; }
    if (this.opts.kneel) { this.state = 'dormant'; this.pose(this.arch.clips.kneel ?? this.arch.clips.idle); this.root.visible = true; }
    else if (this.opts.rise) { this.state = 'hidden'; this.root.visible = false; }
    else { this.state = 'idle'; this.loop(this.arch.clips.idle, 1); this.root.visible = true; }
    this.tumble = 0; this.tumbleRate = 0; this.settled = false; this.shatterAt = -1;
    this.syncRoot();
  }
}
