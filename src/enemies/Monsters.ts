import * as THREE from 'three';
import { Enemy, type EnemyCtx } from './Enemy';
import { GOBLIN_LEAP, type Archetype, type EnemyAttack } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import { Platform } from '../platform/Platform';

/**
 * Session 9 — the monsters of the ruined castle. Each has its own brain on top of the shared Enemy body (physics,
 * navigation, hit reactions, death / shatter, finishers, slots), chosen by `Archetype.brain`:
 *
 *   Goblin  (goblin.glb, 25 retargeted clips)   skirmisher: zig-zag approach, LEAP from 3.4–7.5 m, quick cuts, hop
 *            back out, sidestep a heavy wind-up. Reinforcements drop in from above. The GUTTER KING (mini-boss):
 *            war cry at 60 % — the pack frenzies (faster blows) — leap slam, spin.
 *   Bat     (bat.glb, wing loop + mouth morph)   swarm: circles overhead, at most two swoop at once (screech, a dive
 *            through her chest, climb away). Hit it in the swoop; a parried bat drops to the floor, stunned.
 *   Widow   (widow.glb, one loop)                 ambusher / ranged: drops from the ceiling on a thread, skitters at
 *            mid range, spits WEB (slowed, no sprint or dodge for 2.2 s unless guarded), pounces, jabs. The brood
 *            (widowlings) swarm; the WEEPING MOTHER (mini-boss) spits volleys and hatches her brood.
 *   Lamia   (lamia.glb, one idle clip)           heavy / defensive: a 360° tail sweep at ankle height (jump or
 *            dodge), a guard-breaking maw lunge, a coiled guard against frontal blows (circle it, or kick / heavy
 *            through it). The MAW OF THE CROWNHEART (mini-boss): bellows and looses gloom bats from its maw.
 *
 * Only the goblin has real clips; the others are animated procedurally round their single loop (root pitch/roll,
 * bobbing, wing/leg/tail bone offsets, morphs). Their projectiles and telegraphs are pooled in MonsterFX (warmed at
 * load). All belong to the Present (EnemyTypes.PAST_COUNTERPART remaps any placed in the Past).
 */

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const smooth = (x: number) => { const k = THREE.MathUtils.clamp(x, 0, 1); return k * k * (3 - 2 * k); };

// ============================================================================================ pooled FX
interface Glob { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; dmg: number; owner: Enemy; state: TimeState }
interface Ring { mesh: THREE.Mesh; t: number; dur: number; r: number }
interface Thread { line: THREE.Line; owner: Enemy | null; top: number }

/** Web globs, ground warning rings, silk threads, the web on the hero — pooled, warmed at load. */
export class MonsterFX {
  private globs: Glob[] = [];
  private globPool: THREE.Mesh[] = [];
  private rings: Ring[] = [];
  private ringPool: THREE.Mesh[] = [];
  private threads: Thread[] = [];
  private globGeo = new THREE.IcosahedronGeometry(0.16, 1);
  private globMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.35, metalness: 0, emissive: 0x6a88a8, emissiveIntensity: 0.6 });
  private ringGeo = new THREE.RingGeometry(0.92, 1, 48, 1).rotateX(-Math.PI / 2);
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a22, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  private discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  private discMat = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  private threadMat = new THREE.LineBasicMaterial({ color: 0xcfd8e0, transparent: true, opacity: 0.55 });
  private webT = 0;

  constructor(private g: Game) {
    for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(this.globGeo, this.globMat); m.castShadow = false; this.globPool.push(m); }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
      const d = new THREE.Mesh(this.discGeo, this.discMat.clone());
      m.add(d); m.renderOrder = 4; m.frustumCulled = false;
      this.ringPool.push(m);
    }
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, this.threadMat); line.frustumCulled = false; line.visible = false;
      g.scene.add(line);
      this.threads.push({ line, owner: null, top: 0 });
    }
  }

  /** a web glob from `from` toward the hero's chest, lobbed (gravity 6) with lead */
  spit(owner: Enemy, from: THREE.Vector3, speed: number, dmg: number, spread = 0) {
    const g = this.g, p = g.player;
    const chest = p.pos.clone().setY(p.pos.y + 1.1);
    const flight = from.distanceTo(chest) / speed;
    const target = chest.addScaledVector(p.vel.clone().setY(0), Math.min(0.8, flight * 0.7));
    if (spread) target.add(new THREE.Vector3(Math.cos(spread) * 1.2, 0, Math.sin(spread) * 1.2));
    const vel = target.sub(from).normalize().multiplyScalar(speed);
    vel.y += 0.5 * 6 * flight;
    const mesh = this.globPool.pop() ?? new THREE.Mesh(this.globGeo, this.globMat);
    mesh.position.copy(from);
    mesh.scale.setScalar(owner.arch.scale > 1.2 ? 1.5 : 1);
    mesh.visible = true;
    g.scene.add(mesh);
    this.globs.push({ mesh, vel, life: 3, dmg, owner, state: g.time.state });
  }

  /** a warning ring on the floor (a sweep's reach), filling toward the moment it strikes */
  ring(at: THREE.Vector3, radius: number, dur: number) {
    const m = this.ringPool.pop();
    if (!m) return;
    m.position.copy(at).setY(at.y + 0.04);
    m.scale.setScalar(radius);
    m.visible = true;
    this.g.scene.add(m);
    this.rings.push({ mesh: m, t: 0, dur, r: radius });
  }

  /** a silk thread from `top` (y) down to the owner while it descends; null releases it */
  thread(owner: Enemy, top: number | null) {
    let t = this.threads.find((x) => x.owner === owner);
    if (top === null) { if (t) { t.owner = null; t.line.visible = false; } return; }
    if (!t) t = this.threads.find((x) => !x.owner);
    if (!t) return;
    t.owner = owner; t.top = top; t.line.visible = true;
  }

  update(dt: number) {
    const g = this.g, p = g.player, st = g.time.state;
    for (const b of this.globs) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.state !== st) { b.life = 0; continue; }
      b.vel.y -= 6 * dt;
      const from = b.mesh.position.clone();
      const step = b.vel.clone().multiplyScalar(dt);
      const to = from.clone().add(step);
      b.mesh.rotation.x += dt * 9; b.mesh.rotation.z += dt * 7;
      // the hero: distance from the glob to her body's axis
      const a = p.pos.clone().setY(p.pos.y + 0.3), c = p.pos.clone().setY(p.pos.y + p.height - 0.2);
      const q = new THREE.Line3(a, c).closestPointToPoint(to, true, new THREE.Vector3());
      if (p.alive && q.distanceTo(to) < p.radius + 0.22) {
        b.life = 0;
        const res = p.receiveHit(b.dmg, b.owner.pos, { knock: 0.6 }, g.input.now);
        this.burst(to, 18);
        g.audio.play('web_hit', { pos: to });
        if (res === 'hit') {
          p.webT = Math.max(p.webT, b.owner.arch.scale > 1.2 ? 2.8 : 2.2);
          g.audio.hurt();
          g.hud.flash('#8aa4c0', 0.18);
          g.hud.deny('Webbed — slowed until it tears.');
          g.rig.addShake(0.15);
          Platform.haptic(22);
        }
        continue;
      }
      const hit = g.level.collision.raycast(from, step.clone().normalize(), step.length(), st);
      if (hit) { b.life = 0; this.burst(hit.point, 10); g.audio.play('web_hit', { pos: hit.point, vol: 0.6 }); g.gore.splat(hit.point.clone().addScaledVector(hit.face?.normal ?? UP, 0.05), (hit.face?.normal ?? UP).clone().negate(), 0.5, 2); continue; }
      b.mesh.position.copy(to);
    }
    this.globs = this.globs.filter((b) => { if (b.life <= 0) { b.mesh.removeFromParent(); this.globPool.push(b.mesh); return false; } return true; });
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.dur;
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + 0.55 * k * (0.75 + 0.25 * Math.sin(r.t * 30));
      const disc = r.mesh.children[0] as THREE.Mesh;
      disc.scale.setScalar(Math.max(0.01, k));
      (disc.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.2 * k;
    }
    this.rings = this.rings.filter((r) => { if (r.t >= r.dur) { r.mesh.removeFromParent(); this.ringPool.push(r.mesh); return false; } return true; });
    for (const t of this.threads) {
      if (!t.owner) continue;
      if (!t.owner.alive || t.owner.removed) { this.thread(t.owner, null); continue; }
      const arr = (t.line.geometry.getAttribute('position') as THREE.BufferAttribute);
      const o = t.owner.pos;
      arr.setXYZ(0, o.x, t.top, o.z); arr.setXYZ(1, o.x, o.y + t.owner.height * t.owner.arch.scale * 0.8, o.z);
      arr.needsUpdate = true;
    }
    // strands clinging to a webbed hero
    if (p.webT > 0) {
      this.webT -= dt;
      if (this.webT <= 0) {
        this.webT = 0.08;
        const a = Math.random() * Math.PI * 2;
        const at = p.pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, 0.2 + Math.random() * 1.1, Math.sin(a) * 0.35));
        g.fx.emit(at, new THREE.Vector3(Math.cos(a) * 0.2, -0.3, Math.sin(a) * 0.2), 0xdfe6ee, 0.5, 0.05 + Math.random() * 0.04, 1, 0, true, 0.8);
      }
    }
  }

  private burst(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(3.2);
      this.g.fx.emit(at, v, 0xe6ecf2, 0.4 + Math.random() * 0.3, 0.04 + Math.random() * 0.05, 7, 0, true, 0.9);
    }
  }

  /** one of each (glob, ring, thread) for the loading-screen warm-up */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const glob = new THREE.Mesh(this.globGeo, this.globMat);
    glob.position.copy(at).add(new THREE.Vector3(0.6, 1.3, -1.6));
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    ring.add(new THREE.Mesh(this.discGeo, this.discMat));
    ring.position.copy(at).add(new THREE.Vector3(0, 0.05, -2));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([at.clone().add(new THREE.Vector3(-0.6, 0, -1.6)), at.clone().add(new THREE.Vector3(-0.6, 2, -1.6))]), this.threadMat);
    return { objects: [glob, ring, line], dispose: () => { glob.removeFromParent(); ring.removeFromParent(); line.removeFromParent(); line.geometry.dispose(); } };
  }

  clear() {
    for (const b of this.globs) { b.mesh.removeFromParent(); this.globPool.push(b.mesh); }
    for (const r of this.rings) { r.mesh.removeFromParent(); this.ringPool.push(r.mesh); }
    this.globs = []; this.rings = [];
    for (const t of this.threads) { t.owner = null; t.line.visible = false; }
  }

  dispose() {
    this.clear();
    for (const t of this.threads) { t.line.removeFromParent(); t.line.geometry.dispose(); }
    for (const m of this.ringPool) { (m.material as THREE.Material).dispose(); ((m.children[0] as THREE.Mesh).material as THREE.Material).dispose(); }
    this.globGeo.dispose(); this.globMat.dispose(); this.ringGeo.dispose(); this.ringMat.dispose(); this.discGeo.dispose(); this.discMat.dispose(); this.threadMat.dispose();
  }
}

// ============================================================================================ shared base
abstract class Monster extends Enemy {
  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number,
    opts: Enemy['opts'], protected g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts);
  }
  protected get fxm() { return this.g.enemies.monsterFx!; }
  protected sound(id: string, vol = 1, rate = 1) { this.g.audio.play(id as never, { pos: this.center.clone(), vol, rate, jitter: 0.08 }); }
  /** a timed blow of this monster lands on the hero if she is inside reach / arc / height (then parry, block, hit) */
  protected strike(atk: EnemyAttack, ctx: EnemyCtx, reachScale = 1) {
    const to = _v.subVectors(ctx.playerPos, this.pos);
    const dy = to.y; to.y = 0;
    const d = to.length();
    const ang = THREE.MathUtils.radToDeg(this.facing.angleTo(to.normalize()));
    if (d <= atk.range * reachScale + this.radius * 0.5 + 0.3 && (atk.arc >= 360 || ang <= atk.arc / 2) && Math.abs(dy) < 1.9) { ctx.onAttackHit(this, atk); return true; }
    return false;
  }
  protected clearTo(ctx: EnemyCtx, dist: number, dirP: THREE.Vector3) {
    const o = this.pos.clone().setY(this.pos.y + 0.5);
    if (ctx.world.raycast(o, dirP, dist, ctx.state)) return false;
    return ctx.world.hasFooting(ctx.playerPos.clone().setY(ctx.playerPos.y + 1), 2, ctx.state) && !ctx.world.inVoid(ctx.playerPos.clone().setY(ctx.playerPos.y - 0.3), ctx.state);
  }
  protected tangent(dirP: THREE.Vector3, sign = 1) { return new THREE.Vector3().crossVectors(UP, dirP).multiplyScalar(sign); }

  /**
   * Procedural bones: those the clip animates are re-posed by the mixer every frame, the others must be put back to
   * their rest rotation before an offset is layered on (or the offsets would accumulate frame after frame).
   */
  private restQ = new Map<THREE.Object3D, THREE.Quaternion>();
  protected trackBones(bones: THREE.Object3D[], clips: THREE.AnimationClip[]) {
    const animated = new Set<string>();
    for (const c of clips) for (const t of c.tracks) if (t.name.endsWith('.quaternion')) animated.add(t.name.slice(0, t.name.lastIndexOf('.')));
    for (const b of bones) if (!animated.has(b.name)) this.restQ.set(b, b.quaternion.clone());
  }
  /** rotate `bone` by `angle` about the WORLD vertical (the swing of a leg, the wave of a tail) */
  protected swingBone(bone: THREE.Object3D, angle: number) {
    const rest = this.restQ.get(bone);
    if (rest) bone.quaternion.copy(rest);
    _q.setFromAxisAngle(UP, angle);
    bone.parent!.getWorldQuaternion(_q2);
    bone.quaternion.premultiply(_q2.clone().invert().multiply(_q).multiply(_q2));
  }
}

// ============================================================================================ goblin
export class Goblin extends Monster {
  private leapCd = 1.5 + Math.random() * 2;
  private retreatT = 0;
  private evadeCd = 0;
  private evadeDir = new THREE.Vector3();
  private zig = Math.random() * 6;
  private cried = false;
  /** the Gutter King's war cry: faster blows for the pack */
  frenzyT = 0;
  private mt = 0;
  private mode: 'evade' | 'cry' = 'evade';
  private get king() { return this.arch.id === 'goblin_king'; }

  /** reinforcements (hidden risers) drop in from the rafters instead of rising from the floor */
  activate() {
    const hidden = this.state === 'hidden';
    super.activate();
    if (hidden) { this.pos.y += 3.2; this.vel.y = -1; this.grounded = false; this.once('jump_stand', 1.2, 0.55, 0); this.sound('goblin_snarl', 1, 1.1); }
  }

  protected brainThink(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx): THREE.Vector3 | null {
    const a = this.arch;
    this.leapCd -= dt; this.evadeCd -= dt; this.zig += dt;
    if (this.frenzyT > 0) { this.frenzyT -= dt; this.cooldown -= dt; if (Math.random() < dt * 6) this.g.fx.emit(this.center.clone(), new THREE.Vector3(0, 1.2, 0), 0xff7a30, 0.5, 0.05, -1); }
    if (this.navMode === 'hold') return null;
    if (this.king && !this.cried && this.hp < a.hp * 0.6) { this.cried = true; this.mode = 'cry'; this.mt = 0; this.setState('special'); this.once('power_up', 1.1, 0.2, 0.15); return new THREE.Vector3(); }
    // a heavy wind-up close by: hop aside (the king stands his ground)
    const pa = ctx.playerAttack;
    if (!this.king && pa && pa.t < 0.2 && (pa.kind === 'heavy' || pa.kind === 'sprint') && dist < 3.4 && this.evadeCd <= 0 && Math.random() < 0.5) {
      this.mode = 'evade'; this.mt = 0; this.evadeCd = 2.8;
      this.evadeDir.copy(this.tangent(dirP, Math.random() < 0.5 ? 1 : -1)).addScaledVector(dirP, -0.35).normalize();
      this.setState('special');
      this.loop(this.evadeDir.dot(this.tangent(dirP)) > 0 ? a.clips.strafeL! : a.clips.strafeR!, 1.6, 0.06);
      return new THREE.Vector3();
    }
    this.turnToward(dirP, a.turnRate, dt);
    if (this.retreatT > 0) {
      this.retreatT -= dt;
      this.loop(a.clips.back ?? a.clips.walk, 1.3, 0.12);
      if (this.backBlocked(dirP, dt, ctx)) return this.tangent(dirP, this.circleDir).multiplyScalar(a.runSpeed * 0.7);
      return dirP.clone().multiplyScalar(-a.runSpeed * 0.7).addScaledVector(this.tangent(dirP, this.circleDir), 1.2);
    }
    if (this.cooldown <= 0 && (this.hasSlot || ctx.requestSlot(this, a.slotCost))) {
      this.hasSlot = true;
      // leap in from range (the king's leap is his slam)
      if (dist > 3.4 && dist < 7.5 && this.leapCd <= 0 && Math.abs(dy) < 0.6 && this.clearTo(ctx, dist, dirP)) {
        this.leapCd = this.king ? 5.5 : 4.5 + Math.random() * 2.5;
        const leap = this.king ? a.attacks.find((x) => x.clip === 'atk_leap_slam')! : GOBLIN_LEAP;
        this.beginAttack(leap);
        if (this.frenzyT > 0 && this.cur) this.cur.timeScale *= 1.2;
        this.sound('goblin_snarl', 1, this.king ? 0.8 : 1.15);
        return new THREE.Vector3();
      }
      const atk = this.pickAttack(dist);
      if (atk && atk.clip !== 'atk_leap_slam' && dist <= atk.range + 0.2 && Math.abs(dy) < 1.8) {
        this.beginAttack(atk);
        if (this.frenzyT > 0 && this.cur) this.cur.timeScale *= 1.3;
        if (Math.random() < 0.4) this.sound('goblin_snarl', 0.8, this.king ? 0.75 : 1.2);
        return new THREE.Vector3();
      }
      // close in, zig-zagging
      const zig = Math.sin(this.zig * 4.5) * (dist > 3 ? 0.55 : 0.15);
      this.loop(a.clips.run, a.runSpeed / 4.06 * (this.king ? 0.85 : 1));
      return dirP.clone().addScaledVector(this.tangent(dirP), zig).normalize().multiplyScalar(a.runSpeed);
    }
    // waiting for a slot: fast circling at 3.5–5 m with feints
    const ring = 3.8 + (this.id % 3) * 0.6;
    const tan = this.tangent(dirP, this.circleDir);
    if (Math.random() < dt * 0.4) this.circleDir *= -1;
    if (dist > ring + 1.2) { this.loop(a.clips.run, a.runSpeed / 4.06); return dirP.clone().multiplyScalar(a.runSpeed * 0.8).addScaledVector(tan, 1.5); }
    if (dist < ring - 1) { this.loop(a.clips.back ?? a.clips.walk, 1.2); return dirP.clone().multiplyScalar(-a.walkSpeed * 1.4).addScaledVector(tan, 1.4); }
    this.loop((this.circleDir > 0 ? a.clips.strafeL : a.clips.strafeR) ?? a.clips.walk, 1.25);
    return tan.multiplyScalar(a.runSpeed * 0.5);
  }

  protected onAttackEnd() { if (!this.king && Math.random() < 0.5) this.retreatT = 0.6 + Math.random() * 0.5; }

  protected brainSpecial(dt: number, _dist: number, dirP: THREE.Vector3): THREE.Vector3 {
    this.mt += dt;
    if (this.mode === 'evade') {
      if (this.mt > 0.36) { this.setState('chase'); return new THREE.Vector3(); }
      this.invulnT = 0.05;
      return this.evadeDir.clone().multiplyScalar(7 * (1 - this.mt / 0.5));
    }
    // the war cry: the pack frenzies (every goblin of the fight within 25 m)
    this.turnToward(dirP, 3, dt);
    if (this.mt > 0.55 && this.mt - dt <= 0.55) {
      this.sound('goblin_cry', 1.3, 0.9);
      this.g.fx.shockwave(this.pos.clone(), 5, 0.4);
      this.g.rig.addShake(0.3);
      this.g.hud.prompt('The Gutter King howls — the pack frenzies!', 2.5);
      for (const e of this.g.enemies.enemies) if (e instanceof Goblin && e.alive && e.triggered && e.pos.distanceTo(this.pos) < 25) e.frenzyT = 9;
    }
    if (this.mt > 1.6) { this.setState('chase'); this.loop(this.arch.clips.idle, 1); }
    return new THREE.Vector3();
  }
  /** i-frames of a sidestep */
  private invulnT = 0;
  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    if (this.invulnT > 0 && this.state === 'special') { this.invulnT = 0; return 'armor'; }
    // the cry is not interrupted by light blows
    if (this.state === 'special' && this.mode === 'cry' && !opts.guardBreak) { this.hp -= damage; this.hitFlash = 1; if (this.hp <= 0) { this.die(); return 'dead'; } return 'armor'; }
    return super.takeHit(damage, poiseDmg, knock, from, opts);
  }
}

// ============================================================================================ bat
export class Bat extends Monster {
  private mode: 'tell' | 'swoop' | 'climb' = 'tell';
  private mt = 0;
  private orbitA = Math.random() * Math.PI * 2;
  private orbitDir = Math.random() < 0.5 ? 1 : -1;
  private orbitR = 3.0 + Math.random() * 1.8;
  private bob = Math.random() * 10;
  private swoopDir = new THREE.Vector3();
  private bit = false;
  private diving = false;
  private losT = 0;
  private los = true;
  /** seconds without a line of sight to her (then it closes in instead of circling behind a wall) */
  private blind = 0;
  /** the widest circle that stays inside the room (re-measured 4×/s) */
  private orbitCap = 9;
  private roll = 0;
  private pitch = 0;
  private lastYaw = 0;
  private mouthMesh: THREE.Mesh | null = null;
  private mouth = 0;
  private stunDrop = 0;
  private flapT = Math.random();

  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number, opts: Enemy['opts'], g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts, g);
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.morphTargetInfluences?.length) this.mouthMesh = m; });
  }

  /** bats let loose by the Maw burst out of it */
  activate() {
    const hidden = this.state === 'hidden';
    super.activate();
    if (!hidden) return;
    const maw = this.g.enemies.enemies.find((e) => e.alive && e.arch.id === 'lamia_maw' && e.encounter === this.encounter);
    if (maw) {
      this.pos.copy(maw.center).addScaledVector(maw.facing, 0.8);
      this.g.fx.bloodSpray(this.pos.clone(), maw.facing, 0.4, 0x28300c);
    }
    this.setState('chase');
    this.sound('bat_screech', 0.9, 1);
  }

  private setDiving(on: boolean) {
    if (on === this.diving) return;
    this.diving = on;
    this.g.enemies.batDivers += on ? 1 : -1;
  }

  protected brainThink(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx): THREE.Vector3 | null {
    const a = this.arch;
    this.bob += dt;
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.25;
      this.los = ctx.lineOfSight(this.center.clone(), ctx.playerPos.clone().setY(ctx.playerPos.y + 1.2));
      this.blind = this.los ? 0 : this.blind + 0.25;
      // keep the circle inside the room: a wall between her head and the orbit point turns the bat back and pulls
      // the circle in (corridors: they hover close; halls: they swing wide)
      const head = ctx.playerPos.clone().setY(ctx.playerPos.y + 1.9);
      const ahead = this.orbitA + this.orbitDir * 0.5;
      const d = new THREE.Vector3(Math.cos(ahead), 0, Math.sin(ahead));
      const hit = ctx.world.raycast(head, d, this.orbitR + 0.8, ctx.state);
      if (hit) { this.orbitCap = Math.max(1.5, hit.distance - 0.8); if (hit.distance < 2.2) this.orbitDir *= -1; }
      else this.orbitCap = Math.min(9, this.orbitCap + 0.6);
    }
    // lost behind a wall: follow the ground route under it (A* on the grid, like the wraiths) until she is in sight
    if (this.blind > 0.8) {
      const route = this.flyPath(dt, ctx);
      if (route) { this.flyWant = Math.max(this.flyFloor, ctx.playerPos.y) + a.flying!.altitude; return route; }
    }
    // circle over her head
    this.orbitA += this.orbitDir * dt * (1.05 + 0.35 * Math.sin(this.bob * 0.7));
    const r = Math.min(this.orbitCap, this.orbitR + Math.sin(this.bob * 1.3 + this.id) * 0.6) * (this.blind > 1.2 ? 0.3 : 1);
    const target = _v.set(ctx.playerPos.x + Math.cos(this.orbitA) * r, 0, ctx.playerPos.z + Math.sin(this.orbitA) * r);
    const move = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z).multiplyScalar(2.2);
    if (move.length() > a.runSpeed * 0.8) move.setLength(a.runSpeed * 0.8);
    this.turnToward(move.lengthSq() > 0.5 ? move.clone().normalize().lerp(dirP, 0.5) : dirP, a.turnRate, dt);
    this.flyRate = 3;
    this.flyWant = Math.max(this.flyFloor, ctx.playerPos.y) + a.flying!.altitude + Math.sin(this.bob * 2.1 + this.id) * 0.35;
    if (Math.random() < dt * 0.12) this.orbitDir *= -1;
    // swoop: at most two at a time, only with a line of sight
    if (this.cooldown <= 0 && dist < 9 && Math.abs(dy) < 4 && this.los && this.g.enemies.batDivers < 2) {
      this.setDiving(true);
      this.mode = 'tell'; this.mt = 0; this.bit = false;
      this.setState('special');
      this.hitFlash = 1;
      this.sound('bat_screech', 1, 0.95 + Math.random() * 0.15);
      this.events.push('telegraph');
    }
    return move;
  }

  protected brainSpecial(dt: number, _dist: number, dirP: THREE.Vector3, _dy: number, ctx: EnemyCtx): THREE.Vector3 {
    this.mt += dt;
    const a = this.arch;
    const chest = ctx.playerPos.clone().setY(ctx.playerPos.y + 1.05);
    if (this.mode === 'tell') {
      // rear back and up, mouth open
      this.turnToward(dirP, 10, dt);
      this.flyRate = 4;
      this.flyWant = Math.max(this.flyFloor, ctx.playerPos.y) + a.flying!.altitude + 0.5;
      if (this.mt > a.attacks[0].telegraph!) {
        this.mode = 'swoop'; this.mt = 0;
        this.swoopDir.subVectors(chest, this.center).normalize();
        this.g.audio.play('wraith_dive', { pos: this.center.clone(), rate: 1.7, vol: 0.6 });
      }
      return dirP.clone().multiplyScalar(-1.6);
    }
    if (this.mode === 'swoop') {
      // a dive through her chest (steering a little toward her), biting on the way through
      const want = _v.subVectors(chest, this.center).normalize();
      this.swoopDir.lerp(want, Math.min(1, dt * 3)).normalize();
      this.turnToward(this.swoopDir.clone().setY(0), 12, dt);
      this.flyRate = 9;
      this.flyWant = chest.y - this.height * 0.5 + (this.swoopDir.y < 0 ? 0 : 0.2);
      if (!this.bit && this.center.distanceTo(chest) < 1.05) {
        this.bit = true;
        ctx.onAttackHit(this, a.attacks[0]);
        this.g.audio.play('hit_flesh', { pos: chest, rate: 1.5, vol: 0.6 });
      }
      const past = _v.subVectors(chest, this.center).setY(0).dot(this.swoopDir.clone().setY(0)) < -0.3;
      if (this.mt > 0.85 || past || (this.bit && this.mt > 0.25)) { this.mode = 'climb'; this.mt = 0; }
      return this.swoopDir.clone().setY(0).normalize().multiplyScalar(11.5);
    }
    // climb away, then back to circling
    this.flyRate = 3.5;
    this.flyWant = Math.max(this.flyFloor, ctx.playerPos.y) + a.flying!.altitude + 1.1;
    if (this.mt > 0.8) {
      this.setDiving(false);
      this.cooldown = a.attacks[0].cooldown[0] + Math.random() * (a.attacks[0].cooldown[1] - a.attacks[0].cooldown[0]);
      this.orbitA = Math.atan2(this.pos.z - ctx.playerPos.z, this.pos.x - ctx.playerPos.x);
      this.setState('chase');
    }
    return this.swoopDir.clone().setY(0).normalize().multiplyScalar(6.5);
  }

  parried() {
    super.parried();
    this.setDiving(false);
    this.stunDrop = 1.7;
  }
  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    const r = super.takeHit(damage, poiseDmg, knock, from, opts);
    if (r !== 'armor') this.setDiving(false);
    return r;
  }
  die() { this.setDiving(false); super.die(); if (this.root.visible) this.sound('bat_death', 1, 1); }
  vanish() { this.setDiving(false); super.vanish(); }
  reset() { this.setDiving(false); super.reset(); }

  protected afterAnimate(dt: number, ctx: EnemyCtx) {
    // a parried bat flops on the floor for a moment
    if (this.stunDrop > 0) { this.stunDrop -= dt; this.flyRate = 6; this.flyWant = this.flyFloor + 0.18; }
    else if (this.state === 'hit') this.flyWant = null;
    const swoop = this.state === 'special' && this.mode === 'swoop';
    if (this.cur) this.cur.timeScale = !this.alive ? 0 : this.stunDrop > 0 ? 0.4 : swoop ? 0.6 : this.state === 'special' ? 1.7 : 1.15;
    // wingbeats audible close by
    this.flapT -= dt * (this.cur?.timeScale ?? 1);
    if (this.flapT <= 0 && this.alive) { this.flapT = 1.28 / 2; if (this.pos.distanceToSquared(ctx.playerPos) < 64) this.sound('bat_flap', 0.5, 1.1); }
    // bank into turns, nose down in the dive
    let dy = this.yaw - this.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.lastYaw = this.yaw;
    this.roll += (THREE.MathUtils.clamp(-dy / Math.max(dt, 1e-3) * 0.12, -0.7, 0.7) - this.roll) * Math.min(1, dt * 6);
    this.pitch += ((swoop ? 0.55 : this.state === 'special' ? -0.35 : 0) - this.pitch) * Math.min(1, dt * 8);
    if (this.alive) { this.root.rotation.z += this.roll; this.root.rotation.x += this.pitch; }
    // the mouth opens for the shriek and the bite
    const wantMouth = this.state === 'special' && this.mode !== 'climb' ? 1 : 0;
    this.mouth += (wantMouth - this.mouth) * Math.min(1, dt * 12);
    const inf = this.mouthMesh?.morphTargetInfluences;
    if (inf) inf[0] = Math.max(inf[0], this.mouth);
  }
}

// ============================================================================================ widow
export class Widow extends Monster {
  private mode: 'drop' | 'spit' | 'pounce' | 'jab' | 'hatch' = 'drop';
  private mt = 0;
  private webCd = 1.5 + Math.random() * 2;
  private pounceCd = 2.5 + Math.random() * 2;
  private skitT = 0;
  private skitMove = true;
  private skitDir = Math.random() < 0.5 ? 1 : -1;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private hit = false;
  private shots = 0;
  private dropTop = 0;
  private dropFloor = 0;
  // procedural pose (radians / metres), eased
  private pitch = 0;
  private roll = 0;
  private lift = 0;
  private step = Math.random() * 10;
  private eyes: THREE.MeshStandardMaterial[] = [];
  private eyeGlow = 0;
  private legs: { bone: THREE.Object3D; phase: number }[] = [];
  private lastPos = new THREE.Vector3();
  private speedNow = 0;
  private get small() { return this.arch.id === 'widowling'; }
  private get mother() { return this.arch.id === 'widow_mother'; }

  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number, opts: Enemy['opts'], g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts, g);
    for (const m of this.materials) if ((m as THREE.MeshStandardMaterial).emissive && ((m as THREE.MeshStandardMaterial).emissive.b > 0.5)) this.eyes.push(m as THREE.MeshStandardMaterial);
    // the four leg chains (Bone005 / 011 / 017 / 023): their roots swing for the skitter gait
    let i = 0;
    model.traverse((o) => { if ((o as THREE.Bone).isBone && /^Bone0(05|11|17|23)_/.test(o.name)) this.legs.push({ bone: o, phase: (i++ % 2) * Math.PI }); });
    this.trackBones(this.legs.map((l) => l.bone), clips);
  }

  activate() {
    const hidden = this.state === 'hidden';
    super.activate();
    if (!hidden) return;
    const w = this.g.level.collision, st = this.g.time.state;
    if (this.opts.brood) {
      // the brood crawls out of its mother
      const m = this.g.enemies.enemies.find((e) => e.alive && e.arch.id === 'widow_mother' && e.encounter === this.encounter);
      if (m) {
        const a = Math.random() * Math.PI * 2;
        const q = m.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4));
        if (w.hasFooting(q.clone().setY(q.y + 1), 2, st)) this.pos.copy(q); else this.pos.copy(m.pos);
        this.g.fx.bloodSpray(m.center.clone(), UP, 0.5, this.arch.blood);
      }
      this.setState('chase');
      this.sound('widow_hiss', 0.7, 1.6);
      return;
    }
    if (!this.opts.ceiling) { this.setState('chase'); return; }
    // a ceiling ambush: hanging from the vault (or the broken timbers), it lowers itself on a thread
    const top = w.raycast(this.pos.clone().setY(this.pos.y + 1), UP, 14, st);
    this.dropFloor = this.pos.y;
    this.dropTop = top ? top.point.y : this.pos.y + 6;
    this.pos.y = this.dropTop - this.height * this.arch.scale - 0.2;
    this.mode = 'drop'; this.mt = 0;
    this.setState('special');
    this.floating = true;
    this.fxm.thread(this, this.dropTop);
    this.sound('widow_hiss', 1, 0.8);
  }

  protected brainThink(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx): THREE.Vector3 | null {
    const a = this.arch;
    this.webCd -= dt; this.pounceCd -= dt;
    if (this.navMode === 'hold') return null;
    this.turnToward(dirP, a.turnRate, dt);
    const slot = () => this.hasSlot || ctx.requestSlot(this, a.slotCost);
    // web (not the brood)
    if (!this.small && this.webCd <= 0 && dist > 3.4 && dist < (this.mother ? 16 : 13) && Math.abs(dy) < 4 && ctx.lineOfSight(this.center.clone(), ctx.playerPos.clone().setY(ctx.playerPos.y + 1.1))) {
      this.mode = 'spit'; this.mt = 0; this.shots = 0; this.setState('special');
      this.sound('widow_hiss', 1, this.mother ? 0.75 : 1);
      this.hitFlash = 1; this.events.push('telegraph');
      return new THREE.Vector3();
    }
    // pounce from mid range
    const pr: [number, number] = this.small ? [1.8, 4.2] : this.mother ? [3, 7] : [2.6, 6.5];
    if (this.pounceCd <= 0 && dist > pr[0] && dist < pr[1] && Math.abs(dy) < 0.8 && this.clearTo(ctx, dist, dirP) && slot()) {
      this.hasSlot = true;
      this.mode = 'pounce'; this.mt = 0; this.hit = false;
      this.from.copy(this.pos);
      this.to.copy(ctx.playerPos).addScaledVector(dirP, -Math.min(0.8, this.radius));
      this.setState('special');
      this.hitFlash = 1; this.events.push('telegraph');
      this.sound('widow_hiss', 0.9, this.small ? 1.6 : 1.1);
      return new THREE.Vector3();
    }
    // jab up close
    const jab = a.attacks[0];
    if (this.cooldown <= 0 && dist < jab.range + 0.3 && Math.abs(dy) < 1.5 && slot()) {
      this.hasSlot = true;
      this.mode = 'jab'; this.mt = 0; this.hit = false;
      this.setState('special');
      return new THREE.Vector3();
    }
    // skitter at its range: bursts sideways, pauses, never a straight line
    const pref = this.small ? 1.4 : this.mother ? 4.8 : 5.4;
    this.skitT -= dt;
    if (this.skitT <= 0) {
      this.skitMove = !this.skitMove;
      this.skitT = this.skitMove ? 0.45 + Math.random() * 0.5 : 0.2 + Math.random() * 0.35;
      if (this.skitMove && Math.random() < 0.5) this.skitDir *= -1;
    }
    const radial = THREE.MathUtils.clamp((dist - pref) * 0.8, -1, 1.2);
    const tan = this.tangent(dirP, this.skitDir);
    if (!this.skitMove && Math.abs(radial) < 0.4) return dirP.clone().multiplyScalar(radial * a.walkSpeed);
    return dirP.clone().multiplyScalar(radial).addScaledVector(tan, this.skitMove ? 1 : 0.2).normalize().multiplyScalar(a.runSpeed * (this.skitMove ? 1 : 0.5));
  }

  protected brainSpecial(dt: number, dist: number, dirP: THREE.Vector3, _dy: number, ctx: EnemyCtx): THREE.Vector3 {
    this.mt += dt;
    const a = this.arch, s = a.scale;
    if (this.mode === 'drop') {
      // lowered on the thread over ~1.1 s, legs gathered, then it lands and shrieks
      const k = smooth(this.mt / 1.1);
      this.pos.y = THREE.MathUtils.lerp(this.dropTop - this.height * s - 0.2, this.dropFloor, k);
      this.turnToward(dirP, 4, dt);
      if (this.mt >= 1.1) {
        this.floating = false;
        this.fxm.thread(this, null);
        this.g.fx.dust(this.pos.clone().setY(this.pos.y + 0.05), 8);
        this.sound('widow_hiss', 1.1, 0.85);
        this.setState('chase');
      }
      return new THREE.Vector3();
    }
    if (this.mode === 'spit') {
      // rear up (eyes flare), then the glob — the Mother spits a volley of three
      this.turnToward(dirP, 6, dt);
      const tell = this.mother ? 0.6 : 0.75;
      const n = this.mother ? 3 : 1;
      const next = tell + this.shots * 0.2;
      if (this.shots < n && this.mt >= next) {
        const from = this.center.clone().setY(this.pos.y + this.height * s * 0.75).addScaledVector(this.facing, 0.5 * s);
        this.fxm.spit(this, from, this.mother ? 17 : 15, this.mother ? 12 : 9, n > 1 ? (this.shots - 1) * 0.9 + this.yaw : 0);
        this.sound('widow_spit', 1, this.mother ? 0.8 : 1);
        this.shots++;
      }
      if (this.mt > tell + n * 0.2 + 0.35) { this.webCd = this.mother ? 3.5 + Math.random() * 1.5 : 4 + Math.random() * 2; this.setState('chase'); }
      return new THREE.Vector3();
    }
    if (this.mode === 'pounce') {
      const crouch = this.small ? 0.3 : 0.45, air = this.small ? 0.4 : 0.55;
      if (this.mt < crouch) { this.turnToward(dirP, 10, dt); return new THREE.Vector3(); }
      if (this.mt < crouch + air) {
        // a ballistic arc onto where she stood (floating: the arc is scripted, walls still stop it)
        const k = (this.mt - crouch) / air;
        this.floating = true;
        const flat = this.from.clone().lerp(this.to, smooth(k));
        const vx = (flat.x - this.pos.x) / Math.max(dt, 1e-3), vz = (flat.z - this.pos.z) / Math.max(dt, 1e-3);
        this.pos.y = THREE.MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(Math.PI * k) * (this.small ? 0.8 : 1.3);
        return new THREE.Vector3(vx, 0, vz);
      }
      if (this.floating) {
        this.floating = false;
        this.g.fx.dust(this.pos.clone().setY(this.pos.y + 0.05), 10);
        this.g.rig.addShake(this.small ? 0.05 : 0.18);
        if (!this.hit) { this.hit = true; this.strike(a.attacks[1], ctx, 1.1); }
      }
      // it lands exposed for a moment
      if (this.mt > crouch + air + (this.small ? 0.4 : 0.75)) {
        this.pounceCd = a.attacks[1].cooldown[0] + Math.random() * (a.attacks[1].cooldown[1] - a.attacks[1].cooldown[0]);
        if (this.hasSlot) { ctx.releaseSlot(this); this.hasSlot = false; }
        this.setState('chase');
      }
      return new THREE.Vector3();
    }
    // the jab: a foreleg driven forward
    this.turnToward(dirP, 7, dt);
    const at = this.small ? 0.22 : 0.3;
    if (!this.hit && this.mt >= at) { this.hit = true; this.strike(this.arch.attacks[0], ctx); this.g.audio.swing(0.3, this.center.clone(), 0.8); }
    if (this.mt > at + 0.3) {
      const c = a.attacks[0].cooldown;
      this.cooldown = c[0] + Math.random() * (c[1] - c[0]);
      if (this.hasSlot) { ctx.releaseSlot(this); this.hasSlot = false; }
      this.setState('chase');
    }
    void dist;
    return new THREE.Vector3();
  }

  die() { this.floating = false; this.fxm.thread(this, null); super.die(); }
  vanish() { this.floating = false; this.g.enemies.monsterFx?.thread(this, null); super.vanish(); }
  reset() { this.floating = false; this.g.enemies.monsterFx?.thread(this, null); super.reset(); }

  protected afterAnimate(dt: number, ctx: EnemyCtx) {
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / Math.max(dt, 1e-3);
    this.lastPos.copy(this.pos);
    this.speedNow += (Math.min(moved, 8) - this.speedNow) * Math.min(1, dt * 8);
    const sp = this.state === 'special';
    let pitch = 0, roll = 0, lift = 0;
    if (!this.alive) { pitch = 0.25; roll = 0.5; lift = -0.3 * this.arch.scale; }
    else if (sp && this.mode === 'spit') pitch = -0.45 * smooth(this.mt / 0.4);
    else if (sp && this.mode === 'pounce') { const c = this.small ? 0.3 : 0.45; pitch = this.mt < c ? 0.22 : -0.25; lift = this.mt < c ? -0.18 * this.arch.scale : 0; }
    else if (sp && this.mode === 'jab') { const k = Math.sin(Math.PI * THREE.MathUtils.clamp((this.mt - 0.1) / 0.45, 0, 1)); pitch = 0.4 * k; }
    else if (sp && this.mode === 'drop') pitch = 0.15;
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 10);
    this.roll += (roll - this.roll) * Math.min(1, dt * 6);
    this.lift += (lift - this.lift) * Math.min(1, dt * 8);
    // gait: a quick bob, a sway, the legs swinging in pairs; the loop runs faster with speed
    this.step += dt * (2 + this.speedNow * 2.4) / Math.max(0.6, this.arch.scale);
    const moving = this.alive && this.speedNow > 0.4;
    const bob = moving ? Math.abs(Math.sin(this.step)) * 0.05 * this.arch.scale : 0;
    this.root.rotation.x += this.pitch;
    this.root.rotation.z += this.roll + (moving ? Math.sin(this.step) * 0.05 : 0);
    this.root.position.y += this.lift + bob;
    if (this.cur) this.cur.timeScale = !this.alive ? 0 : 0.8 + this.speedNow * 0.35;
    if (this.alive && this.legs.length) {
      const amp = moving ? Math.min(0.35, 0.08 + this.speedNow * 0.05) : 0.03;
      for (const l of this.legs) this.swingBone(l.bone, Math.sin(this.step + l.phase) * amp);
    }
    // eyes flare while it winds up
    const glow = this.alive && sp && (this.mode === 'spit' || this.mode === 'pounce') ? 1 : 0;
    this.eyeGlow += (glow - this.eyeGlow) * Math.min(1, dt * 10);
    for (const m of this.eyes) m.emissiveIntensity = 1 + this.eyeGlow * 5;
    // skittering feet
    if (moving && this.pos.distanceToSquared(ctx.playerPos) < 225 && Math.random() < dt * this.speedNow * 1.2) this.g.audio.enemyStep(this.pos, false);
  }
}

// ============================================================================================ lamia
export class Lamia extends Monster {
  private mode: 'sweep' | 'lunge' | 'lash' | 'coil' | 'bellow' = 'sweep';
  private mt = 0;
  private biteCd = 2 + Math.random() * 2;
  private coilCd = 0;
  private frontHits: number[] = [];
  private hit = false;
  private yawOff = 0;
  private pitch = 0;
  private lift = 0;
  private undulate = Math.random() * 10;
  private tail: THREE.Object3D[] = [];
  private spine: THREE.Object3D[] = [];
  private maw: THREE.MeshStandardMaterial[] = [];
  private mawGlow = 0;
  private lastPos = new THREE.Vector3();
  private speedNow = 0;
  private bellowAt = [0.66, 0.36];
  private get big() { return this.arch.id === 'lamia_maw'; }

  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number, opts: Enemy['opts'], g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts, g);
    const byName = new Map<string, THREE.Object3D>();
    model.traverse((o) => { if ((o as THREE.Bone).isBone) byName.set(o.name.replace(/_\d+$/, ''), o); });
    for (let i = 8; i <= 23; i++) { const b = byName.get('spine0' + String(i).padStart(2, '0')); if (b) this.tail.push(b); }
    for (const n of ['spine001', 'spine002', 'spine003']) { const b = byName.get(n); if (b) this.spine.push(b); }
    for (const m of this.materials) if ((m as THREE.MeshStandardMaterial).emissiveMap) this.maw.push(m as THREE.MeshStandardMaterial);
    this.trackBones(this.tail, clips);
  }

  protected brainThink(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx): THREE.Vector3 | null {
    const a = this.arch;
    this.biteCd -= dt; this.coilCd -= dt;
    if (this.navMode === 'hold') return null;
    // the Maw bellows as its brood of bats is loosed (the encounter's waves at 65 % / 35 %)
    if (this.big && this.bellowAt.length && this.hp < a.hp * this.bellowAt[0]) { this.bellowAt.shift(); return this.begin('bellow'); }
    this.turnToward(dirP, a.turnRate, dt);
    const [sweep, , lash] = a.attacks;
    const slot = () => this.hasSlot || ctx.requestSlot(this, a.slotCost);
    if (this.cooldown <= 0 && dist < sweep.range - 0.4 && Math.abs(dy) < 1.2 && slot()) { this.hasSlot = true; return this.begin('sweep'); }
    if (this.biteCd <= 0 && dist > 2.6 && dist < (this.big ? 8 : 6.8) && Math.abs(dy) < 0.8 && this.clearTo(ctx, dist, dirP) && slot()) { this.hasSlot = true; return this.begin('lunge'); }
    if (this.cooldown <= 0 && dist < lash.range && Math.abs(dy) < 1.4 && slot()) { this.hasSlot = true; return this.begin('lash'); }
    // slither in to striking range, weaving
    const want = this.big ? 3.6 : 3.0;
    if (dist > want) return dirP.clone().addScaledVector(this.tangent(dirP), Math.sin(this.undulate * 0.8) * 0.3).normalize().multiplyScalar(a.runSpeed);
    return this.tangent(dirP, this.circleDir).multiplyScalar(a.walkSpeed * 0.5);
  }

  private begin(mode: Lamia['mode']) {
    this.mode = mode; this.mt = 0; this.hit = false;
    this.setState('special');
    const s = this.arch.scale;
    if (mode === 'sweep') { this.fxm.ring(this.pos, this.arch.attacks[0].range, this.arch.attacks[0].telegraph!); this.sound('serpent_hiss', 1, this.big ? 0.8 : 1); this.hitFlash = 1; }
    if (mode === 'lunge') { this.sound('serpent_hiss', 1.1, this.big ? 0.7 : 0.9); this.hitFlash = 1; this.events.push('telegraph'); }
    if (mode === 'bellow') { this.sound('serpent_roar', 1.4, this.big ? 0.8 : 1); this.g.rig.addShake(0.35); this.g.fx.shockwave(this.pos.clone(), 5 * s, 0.35); }
    if (mode === 'coil') this.sound('serpent_hiss', 0.8, 1.2);
    return new THREE.Vector3();
  }

  private finish(cd: number) {
    this.cooldown = cd;
    if (this.hasSlot && this.lastCtx) { this.lastCtx.releaseSlot(this); this.hasSlot = false; }
    this.setState('chase');
  }
  private lastCtx: EnemyCtx | null = null;

  protected brainSpecial(dt: number, dist: number, dirP: THREE.Vector3, _dy: number, ctx: EnemyCtx): THREE.Vector3 {
    this.mt += dt;
    this.lastCtx = ctx;
    const [sweep, lunge, lash] = this.arch.attacks;
    const cd = (x: EnemyAttack) => x.cooldown[0] + Math.random() * (x.cooldown[1] - x.cooldown[0]);
    if (this.mode === 'sweep') {
      const tell = sweep.telegraph!, spin = 0.45;
      if (this.mt < tell) { this.turnToward(dirP, 2, dt); this.yawOff = -0.9 * smooth(this.mt / tell); return new THREE.Vector3(); }
      const k = Math.min(1, (this.mt - tell) / spin);
      this.yawOff = -0.9 + (Math.PI * 2 + 0.9) * smooth(k);
      if (!this.hit && k > 0.35) {
        this.hit = true;
        this.g.audio.swing(1, this.center.clone(), 1.2);
        this.g.audio.play('rubble', { pos: this.pos.clone(), vol: 0.8 });
        this.g.fx.dust(this.pos.clone().setY(this.pos.y + 0.1), 14);
        // ankle height: a hero in the air (a jump) or dodging (i-frames) is clear of it
        if (!ctx.playerAirborne) this.strike(sweep, ctx);
      }
      if (k >= 1) { this.yawOff = 0; this.finish(cd(sweep)); }
      return new THREE.Vector3();
    }
    if (this.mode === 'lunge') {
      const rear = lunge.telegraph!, strike = 0.3, rec = 0.95;
      if (this.mt < rear) { this.turnToward(dirP, 4, dt); return new THREE.Vector3(); }
      if (this.mt < rear + strike) {
        if (!this.hit && dist < lunge.range * this.arch.scale + 0.4) { this.hit = true; this.strike(lunge, ctx, this.arch.scale * 1.1); this.g.audio.play('bone_crunch', { pos: ctx.playerPos.clone(), rate: 0.8, vol: 0.6 }); }
        return this.facing.multiplyScalar(dist > 1.2 ? 13 : 0);
      }
      if (this.mt > rear + strike + rec) { this.biteCd = 4 + Math.random() * 2.5; this.finish(0.6); }
      return new THREE.Vector3();
    }
    if (this.mode === 'lash' || this.mode === 'coil') {
      if (this.mode === 'coil') {
        // coiled: frontal blows glance off; then it lashes out
        this.turnToward(dirP, 5, dt);
        if (this.mt < 1.7) return new THREE.Vector3();
        this.mode = 'lash'; this.mt = 0; this.hit = false;
      }
      const at = lash.telegraph!;
      this.yawOff = Math.sin(THREE.MathUtils.clamp(this.mt / 0.55, 0, 1) * Math.PI) * 0.8 * this.circleDir;
      if (!this.hit && this.mt >= at) { this.hit = true; this.strike(lash, ctx, this.arch.scale); this.g.audio.swing(0.7, this.center.clone(), 1); }
      if (this.mt > 0.6) { this.yawOff = 0; this.finish(cd(lash)); }
      return new THREE.Vector3();
    }
    // bellow
    if (this.mt > 1.6) this.finish(0.5);
    return new THREE.Vector3();
  }

  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    if (!this.alive) return 'dead';
    const toHero = _v.subVectors(from, this.pos).setY(0).normalize();
    const frontal = this.facing.dot(toHero) > 0.3;
    if (this.state === 'special' && this.mode === 'coil' && frontal && !opts.guardBreak && !opts.knockdown) {
      // the coil takes the blow: a little damage, sparks off the scales
      this.hp -= damage * 0.15;
      this.hitFlash = 1;
      if (this.hp <= 0) { this.die(); return 'dead'; }
      return 'blocked';
    }
    if (this.state === 'special' && this.mode === 'coil' && (opts.guardBreak || opts.knockdown)) {
      // a kick / heavy breaks the coil open: it reels
      this.mode = 'lash'; this.mt = -0.6; this.hit = true;
      this.g.hud.prompt('The coil breaks open!', 1.2);
    }
    // repeated frontal blows make it coil up
    if (frontal && this.state !== 'special' && this.coilCd <= 0) {
      const now = this.g.t;
      this.frontHits = this.frontHits.filter((t) => now - t < 1.5);
      this.frontHits.push(now);
      if (this.frontHits.length >= (this.big ? 3 : 2)) {
        this.frontHits = []; this.coilCd = 6;
        const r = super.takeHit(damage, poiseDmg, knock, from, opts);
        if (r !== 'dead') { this.begin('coil'); return 'armor'; }
        return r;
      }
    }
    // bosses aside, a heavy blow can still stagger it; mid-attack it has hyper armour (heavy body)
    if (this.state === 'special' && this.mode !== 'coil') {
      this.hp -= damage; this.poise -= poiseDmg; this.hitFlash = 1;
      if (this.hp <= 0) { this.die(); return 'dead'; }
      return 'armor';
    }
    return super.takeHit(damage, poiseDmg, knock, from, opts);
  }

  die() { super.die(); this.sound('serpent_roar', 1.2, this.big ? 0.6 : 0.8); }

  protected afterAnimate(dt: number, ctx: EnemyCtx) {
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / Math.max(dt, 1e-3);
    this.lastPos.copy(this.pos);
    this.speedNow += (Math.min(moved, 8) - this.speedNow) * Math.min(1, dt * 6);
    const sp = this.state === 'special';
    let pitch = 0, lift = 0;
    if (!this.alive) { pitch = Math.min(1.1, this.deadTime * 1.6); lift = -0.4 * this.arch.scale * Math.min(1, this.deadTime); }
    else if (sp && this.mode === 'lunge') { const r = this.arch.attacks[1].telegraph!; pitch = this.mt < r ? -0.4 * smooth(this.mt / r) : this.mt < r + 0.3 ? 0.35 : 0.2; }
    else if (sp && this.mode === 'coil') { pitch = -0.25; lift = -0.25 * this.arch.scale; }
    else if (sp && this.mode === 'bellow') pitch = -0.5 * Math.sin(Math.min(1, this.mt / 1.6) * Math.PI);
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 7);
    this.lift += (lift - this.lift) * Math.min(1, dt * 6);
    if (!sp) this.yawOff *= Math.max(0, 1 - dt * 6);
    this.root.rotation.y += this.yawOff;
    this.root.rotation.x += this.pitch;
    this.root.position.y += this.lift;
    if (this.cur) this.cur.timeScale = !this.alive ? 0.3 : 1 + this.speedNow * 0.3;
    // the coils: a travelling wave down the tail, wider as it moves; the sweep throws it round
    this.undulate += dt * (2.2 + this.speedNow * 1.8);
    const amp = (!this.alive ? 0.12 : sp && this.mode === 'sweep' ? 0.45 : 0.12 + Math.min(0.3, this.speedNow * 0.1));
    for (let i = 0; i < this.tail.length; i++) this.swingBone(this.tail[i], Math.sin(this.undulate - i * 0.55) * amp * (0.4 + i / this.tail.length) / this.tail.length * 4);
    // the maw in its belly glows as it rears to bite / bellows
    const glow = this.alive && sp && (this.mode === 'lunge' || this.mode === 'bellow') ? 1 : 0;
    this.mawGlow += (glow - this.mawGlow) * Math.min(1, dt * 8);
    for (const m of this.maw) m.emissiveIntensity = 0.9 + this.mawGlow * 3.5;
    if (sp && this.mode === 'lunge' && this.mawGlow > 0.5 && Math.random() < dt * 8) this.g.fx.emit(this.center.clone(), new THREE.Vector3(0, 0.6, 0), 0xa0ff60, 0.4, 0.05, -0.5);
    void ctx;
  }
}

/** Build the right class for an archetype (EnemyManager.spawnEnemy). */
export function makeMonster(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number, opts: Enemy['opts'], g: Game): Enemy | null {
  switch (arch.brain) {
    case 'goblin': return new Goblin(arch, model, clips, encounter, owner, wave, opts, g);
    case 'bat': return new Bat(arch, model, clips, encounter, owner, wave, opts, g);
    case 'widow': return new Widow(arch, model, clips, encounter, owner, wave, opts, g);
    case 'lamia': return new Lamia(arch, model, clips, encounter, owner, wave, opts, g);
    default: return null;
  }
}
