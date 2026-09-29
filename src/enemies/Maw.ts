import * as THREE from 'three';
import type { Enemy, EnemyCtx } from './Enemy';
import type { Archetype, EnemyAttack } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import { Monster } from './MonsterBase';
import anims from '../data/mutantAnimations.json';
import { Platform } from '../platform/Platform';

/**
 * THE MAW OF THE CROWNHEART (session 11) — the Creature Pack Mutant (tools/blender/build_mutant.py, 16 clips measured
 * into src/data/mutantAnimations.json) as Floor 3's mini-boss, and the lesser CROWN BRUTES of the deepest fight.
 *
 * The moveset is built from what the clips actually do (contact times from the hand / foot speed peaks):
 *   HOOK        'punch'      right hook, contact 0.30 s — slowed wind-up so it reads; parry it = the Maw is STUNNED
 *   SWEEP       'swipe'      arms cocked back (a full second of tell), both blades rake 230° at 1.23 s, a step into
 *                            it; breaks a guard — dodge through or back out of it
 *   CHAINS      hook → sweep (from mid wind-up); phase 2: hook → hook → sweep; enraged: + a hop back into a leap
 *   CROWNFALL   'leap_slam'  crouch, a 3 m high leap onto her (ring on the floor where it will land from the moment
 *                            it jumps), two fists into the floor at 1.67 s: direct blow under the fists, a shock ring
 *                            round them (jump it); lands exposed for ~1 s
 *   TURNING FALL 'leap_turn' the same leap when she is at its flank / back: the body swings round in the air (the
 *                            clip's 64° pelvis yaw, taken out in the build and replayed on the root, scaled to her)
 *   QUAKE       'pound'      gathers, jumps in place, pounds the floor at 1.9 s: a wave runs out along the floor to
 *                            9 m (jump it or dodge through); phase 2+ pounds twice
 *   HOP         'hop'        a crouch-hop backwards out of a corner / off a hero hugging its belly
 *   ROAR        'roar'       its entrance, and at 65 %: the bellow blasts her back and calls the gloom bats up out of
 *                            the blood font (the encounter's wave 2)
 *   FLEX        'flex'       at 35 %: beats its chest (exposed: takes ×1.3) and ENRAGES — faster, shorter gaps,
 *                            the crystal flesh smoulders crimson
 *   TURNS       'turn_*'     a heavy body steps round (the clips' yaw on the root) instead of spinning on the spot
 *   REACTIONS   no reaction clips in the pack: light blows are absorbed (lean spring); a broken poise = STAGGER (the
 *               opening stumble of 'death'); a parried hook or a full Crownbreaker = STUN (the stumble held with its
 *               head hanging, then played back to rise) — ×1.35 damage while stunned
 *   DEATH       'death'      staggers and falls back; the body stays until the clip has played
 *
 * Crown brutes (E8) use the hook, the sweep and the hop only. Shifting is denied while the Maw's fight holds her
 * (EnemyManager.memoryHeld): the Past would be a way round it.
 */
type ClipData = { duration: number; rootCurve?: number[][]; yawCurve?: number[]; yawTotal?: number; headPeakT: number };
const CLIPS = (anims as unknown as { clips: Record<string, ClipData> }).clips;
const FPS = 30;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (x: number) => { const k = THREE.MathUtils.clamp(x, 0, 1); return k * k * (3 - 2 * k); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** root displacement [forward, right] (m at scale 1) of a clip at time t */
function rootAt(clip: string, t: number): [number, number] {
  const c = CLIPS[clip]?.rootCurve;
  if (!c || !c.length) return [0, 0];
  const f = THREE.MathUtils.clamp(t * FPS, 0, c.length - 1);
  const i = Math.floor(f), k = f - i, a = c[i], b = c[Math.min(c.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
/** body yaw (degrees, + = to its right) a turning clip has put on by time t */
function yawAt(clip: string, t: number): number {
  const c = CLIPS[clip]?.yawCurve;
  if (!c || !c.length) return 0;
  const f = THREE.MathUtils.clamp(t * FPS, 0, c.length - 1);
  const i = Math.floor(f), k = f - i;
  return c[i] + (c[Math.min(c.length - 1, i + 1)] - c[i]) * k;
}

type Mode = 'roar' | 'punch' | 'swipe' | 'leap' | 'pound' | 'hop' | 'flex' | 'turn' | 'stagger' | 'stun';
interface Wave { at: THREE.Vector3; t: number; hit: boolean }

/** walk / run clip speeds (m/s at scale 1, measured) */
const WALK_SPEED = 1.214, RUN_SPEED = 2.205;
/** quake wave: speed (m/s), reach (m), half thickness (m) */
const WAVE_SPEED = 8, WAVE_REACH = 9, WAVE_BAND = 0.6;
/** a leap is thrown from this far (m) */
const LEAP_MIN = 5.5, LEAP_MAX = 15;

export class Maw extends Monster {
  private mode: Mode = 'roar';
  private mt = 0;
  private clip = '';
  private hit = false;
  private phase = 1;
  private enraged = false;
  private introDone = false;
  private combo: ('punch' | 'swipe' | 'hop' | 'leap')[] = [];
  private leapCd = 4;
  private poundCd = 7;
  private hopCd = 3;
  private turnCd = 0;
  private hugT = 0;
  private lastRootT = 0;
  private yawBase = 0;
  private yawScale = 1;
  private turnClip = '';
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private fist = new THREE.Vector3();
  private waves: Wave[] = [];
  private pounds = 0;
  private stunHold = 0;
  private told = new Set<string>();
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private glow = 0;
  private lastCtx: EnemyCtx | null = null;
  private swung = false;
  /** charging (run) until she is within 7.5 m, walking until she is beyond 9.5 m (no flicker at the boundary) */
  private running = false;
  private get maw() { return this.arch.id === 'maw'; }
  private get s() { return this.arch.scale; }
  /** animation speed factor: phase 2 a touch quicker, enraged a lot */
  private get pace() { return this.enraged ? 1.22 : this.phase >= 2 ? 1.08 : 1; }

  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number, opts: Enemy['opts'], g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts, g);
    // the telegraph glint rides the striking hand (mixamo names lose the ':' in GLTFLoader)
    model.traverse((o) => {
      if (!(o as THREE.Bone).isBone) return;
      if (/RightHand$/.test(o.name)) this.weaponBone = o;
      if (/Spine2$/.test(o.name)) this.torsoBone = o;
    });
    // the flesh smoulders when it enrages (emissiveMap = its own colour map, set on the template at load so the
    // program is the warmed one: GameAssets.prepareEnemy)
    for (const m of this.materials) if ((m as THREE.MeshStandardMaterial).emissiveMap) this.glowMats.push(m as THREE.MeshStandardMaterial);
    this.deathHold = 4.2;
  }

  // ------------------------------------------------------------------ life cycle
  activate() {
    const wasHidden = this.state === 'hidden' || this.state === 'dormant';
    super.activate();
    if (wasHidden) return;
    // its entrance: the roar (the Maw) / a snarl and straight in (a brute)
    if (this.maw && !this.introDone) { this.introDone = true; this.begin('roar'); }
    else this.sound('maw_snarl', 1, 1.1);
  }

  reset() {
    super.reset();
    this.phase = 1; this.enraged = false; this.introDone = false; this.combo = []; this.waves = [];
    this.leapCd = 4; this.poundCd = 7; this.hopCd = 3; this.glow = 0; this.passThrough = false; this.floating = false;
    for (const m of this.glowMats) m.emissive.setRGB(0, 0, 0);
  }

  /** the heavy body falls by its own clip: no fling */
  fling() { /* a kill never throws the Maw or a brute */ }

  die() {
    if (!this.alive) return;
    this.passThrough = false; this.floating = false; this.waves = [];
    super.die();   // plays arch.clips.death = 'death'
    this.lastRootT = 0;
    this.sound('maw_roar', 1.4, this.maw ? 0.55 : 0.75);
    if (this.maw) this.g.audio.play('boss_scream', { pos: this.center.clone(), rate: 0.5, vol: 0.9 });
  }

  // ------------------------------------------------------------------ the chase: choosing what to do
  protected brainThink(dt: number, dist: number, dirP: THREE.Vector3, dy: number, ctx: EnemyCtx): THREE.Vector3 | null {
    const a = this.arch;
    this.lastCtx = ctx;
    // a finisher elsewhere / no way to her: stand, face her, breathe
    if (ctx.hold || this.navMode === 'hold') { this.turnToward(dirP, a.turnRate, dt); this.loop('idle', 1, 0.3); return new THREE.Vector3(); }
    // phases (the encounter's own waves fire at the same thresholds: EnemyManager.updateWaves)
    if (this.maw) {
      const f = this.hp / a.hp;
      if (this.phase === 1 && f < 0.65) { this.phase = 2; this.combo = []; return this.begin('roar'); }
      if (this.phase === 2 && f < 0.35) { this.phase = 3; this.combo = []; return this.begin('flex'); }
    }
    const slot = () => this.hasSlot || ctx.requestSlot(this, a.slotCost);
    const yawTo = Math.atan2(dirP.x, dirP.z);
    const off = wrap(yawTo - this.yaw);
    // queued chain links go first
    if (this.combo.length && this.cooldown <= 0.6) {
      const next = this.combo.shift()!;
      if (next === 'leap') { if (dist > 4 && this.leapTarget(ctx, dirP, dist)) return this.begin('leap'); }
      else if (next === 'hop') return this.begin('hop');
      else if (dist < (next === 'punch' ? 4.2 : 5)) return this.begin(next, true);
    }
    // a hero hugging its belly: hop out (then the chain picks a leap / hook)
    this.hugT = dist < this.radius + 1.0 ? this.hugT + dt : Math.max(0, this.hugT - dt * 2);
    if (this.hugT > (this.enraged ? 0.7 : 1.3) && this.hopCd <= 0) { this.hugT = 0; if (this.maw && this.phase >= 2) this.combo = [Math.random() < 0.5 ? 'leap' : 'punch']; return this.begin('hop'); }
    // she is at its flank or behind it: it steps round (a leap that turns in the air when she is far)
    if (Math.abs(off) > 0.95 && this.turnCd <= 0) {
      if (this.maw && this.phase >= 2 && dist > LEAP_MIN && this.leapCd <= 0 && this.leapTarget(ctx, dirP, dist)) return this.begin('leap');
      if (dist < 11) return this.beginTurn(off);
    }
    // she keeps away (or the font lies between them): Crownfall — a straight leap when it faces her, the turning leap
    // when she is round its flank; the arc crosses the font if it must
    if (this.maw && this.leapCd <= 0 && dist > LEAP_MIN && dist < LEAP_MAX && Math.abs(dy) < 2.5 && this.leapTarget(ctx, dirP, dist)) return this.begin('leap');
    if (this.maw && this.poundCd <= 0 && dist < (this.phase >= 2 ? 7.5 : 5.5) && Math.abs(dy) < 1.5 && Math.random() < dt * (this.phase >= 2 ? 1.6 : 0.7)) return this.begin('pound');
    // blows in reach
    const [hook, sweep] = a.attacks;
    const reach = (atk: EnemyAttack) => atk.range + this.radius * 0.5 + 0.3;
    if (this.cooldown <= 0 && Math.abs(dy) < 1.6 && Math.abs(off) < 0.7 && dist < reach(sweep) && slot()) {
      this.hasSlot = true;
      const r = Math.random();
      if (dist < reach(hook) - 0.2 && r < 0.62) {
        // the hook, often chained
        if (this.maw) this.combo = this.enraged ? ['punch', 'swipe'] : this.phase >= 2 ? (Math.random() < 0.55 ? ['punch', 'swipe'] : ['swipe']) : (Math.random() < 0.55 ? ['swipe'] : []);
        else this.combo = Math.random() < 0.35 ? ['swipe'] : [];
        return this.begin('punch');
      }
      this.combo = this.enraged && this.maw ? ['hop', 'leap'] : [];
      return this.begin('swipe');
    }
    // approach: a stalking walk, a charge from afar; heavy turning
    this.turnToward(dirP, a.turnRate * (dist > 6 ? 1 : 0.8), dt);
    const want = reach(hook) - 0.3;
    this.running = dist > (this.running ? 7.5 : 9.5);
    if (this.running) { this.loop('run', (a.runSpeed / (RUN_SPEED * this.s)) * this.pace, 0.3); return this.facing.multiplyScalar(a.runSpeed * this.pace); }
    if (dist > want) { this.loop('walk', (a.walkSpeed / (WALK_SPEED * this.s)) * this.pace, 0.3); return this.facing.multiplyScalar(a.walkSpeed * this.pace); }
    this.loop('idle', 1, 0.3);
    return new THREE.Vector3();
  }

  /** where a leap onto her would land (fists on her, feet on footing, never the font); false = no leap */
  private leapTarget(ctx: EnemyCtx, dirP: THREE.Vector3, dist: number) {
    const w = ctx.world, st = ctx.state;
    // aimed where she will be (0.6 s of her run): the ring appears ahead of a straight-line kite — the honest tell
    const lead = this.g.player.vel.clone().setY(0).multiplyScalar(0.6);
    const aim = ctx.playerPos.clone().add(lead);
    const d = Math.min(dist, LEAP_MAX);
    for (const back of [1.9, 1.2, 2.6]) {
      const land = this.pos.clone().addScaledVector(dirP, Math.max(0, d - back * (this.s / 1.8)));
      land.x += (aim.x - ctx.playerPos.x); land.z += (aim.z - ctx.playerPos.z);
      const gy = w.groundBelow(land.clone().setY(ctx.playerPos.y + 2), 5, st);
      // real floor at her level (never the font's rim top, never the font)
      if (gy === null || Math.abs(gy - ctx.playerPos.y) > 0.5 || w.inVoid(land.clone().setY(gy - 0.3), st)) continue;
      land.y = gy;
      if (w.overlap(land, this.physRadius, 2.2, st) > 0.2) continue;
      this.to.copy(land);
      return true;
    }
    return false;
  }

  private beginTurn(off: number) {
    // off > 0: she is to its left (+X of its facing); the clips: turn_l45, turn_r45, turn_r90 (yaw + = right)
    const right = off < 0, deg = Math.abs(THREE.MathUtils.radToDeg(off));
    this.turnClip = right ? (deg > 67 ? 'turn_r90' : 'turn_r45') : 'turn_l45';
    const native = CLIPS[this.turnClip].yawTotal ?? 45;
    this.yawScale = THREE.MathUtils.clamp(deg / Math.abs(native), 0.6, 2.2);
    this.yawBase = this.yaw;
    this.turnCd = 0.4;
    return this.begin('turn');
  }

  // ------------------------------------------------------------------ actions
  private begin(mode: Mode, chained = false) {
    this.mode = mode; this.mt = 0; this.hit = false; this.swung = false; this.lastRootT = 0;
    this.setState('special');
    const p = this.pace;
    switch (mode) {
      case 'roar':
        this.clip = 'roar'; this.once('roar', 1.1, 0, 0.2);
        this.sound('maw_snarl', 1, 0.7);
        break;
      case 'punch':
        this.clip = 'punch';
        // a slow cock of the fist (the tell), then the hook at full speed (updateSpecial)
        this.once('punch', 0.55 * p, chained ? 0.08 : 0, 0.12);
        this.hitFlash = 1; this.events.push('telegraph');
        if (Math.random() < 0.5) this.sound('maw_snarl', 0.8, 1.05);
        break;
      case 'swipe':
        this.clip = 'swipe';
        this.once('swipe', 1.05 * p, chained ? 0.55 : 0, 0.15);
        this.hitFlash = 1; this.events.push('telegraph');
        this.sound('maw_snarl', 1, 0.85);
        break;
      case 'leap': {
        const turn = Math.abs(wrap(Math.atan2(this.to.x - this.pos.x, this.to.z - this.pos.z) - this.yaw));
        this.clip = turn > 0.6 ? 'leap_turn' : 'leap_slam';
        this.from.copy(this.pos);
        this.yawBase = this.yaw;
        // leap_turn: it takes off facing where it faced and swings round onto her in the air
        const want = wrap(Math.atan2(this.g.player.pos.x - this.to.x, this.g.player.pos.z - this.to.z) - this.yaw);
        const native = CLIPS.leap_turn.yawTotal ?? 64;
        this.yawScale = this.clip === 'leap_turn' ? THREE.MathUtils.clamp(-THREE.MathUtils.radToDeg(want) / native, -2, 2) : 0;
        if (this.clip === 'leap_slam') this.yaw = Math.atan2(this.to.x - this.pos.x, this.to.z - this.pos.z);
        this.once(this.clip, p, 0, 0.12);
        this.fxm.ring(this.to.clone().addScaledVector(this.landFacing(), 1.1 * (this.s / 1.8)), this.arch.attacks[3].range, 1.55 / p);
        this.hitFlash = 1; this.events.push('telegraph');
        this.sound('maw_snarl', 1.1, 0.75);
        this.leapCd = (this.enraged ? 5 : this.phase >= 2 ? 6.5 : 8) + Math.random() * 2;
        break;
      }
      case 'pound':
        this.clip = 'pound'; this.pounds = this.maw && this.phase >= 2 ? 2 : 1;
        this.once('pound', p, 0, 0.15);
        this.fxm.ring(this.pos, WAVE_REACH, 1.85 / p);
        this.sound('maw_snarl', 1, 0.8);
        this.poundCd = (this.enraged ? 7 : 10) + Math.random() * 3;
        break;
      case 'hop':
        this.clip = 'hop'; this.once('hop', 1.1 * p, 0, 0.08);
        this.from.copy(this.pos);
        this.hopCd = 4;
        break;
      case 'flex':
        this.clip = 'flex'; this.once('flex', 1.05, 0.4, 0.2);
        this.sound('maw_roar', 1.2, 0.7);
        this.g.hud.prompt('The Maw beats its chest — its flesh is open!', 2.6);
        break;
      case 'turn':
        this.clip = this.turnClip; this.once(this.turnClip, 1.45 * p, 0, 0.2);
        break;
      case 'stagger':
        this.clip = 'death'; this.once('death', 1.15, 0.05, 0.08);
        this.sound('maw_snarl', 1.1, 0.65);
        this.combo = [];
        break;
      case 'stun':
        this.clip = 'death'; this.once('death', 1.0, 0.05, 0.08);
        this.stunHold = 2.4;
        this.combo = [];
        this.sound('maw_roar', 1, 0.8);
        if (!this.told.has('stun')) { this.told.add('stun'); this.g.hud.prompt(this.maw ? 'The Maw reels — strike now!' : 'It reels — strike now!', 2); }
        break;
    }
    return new THREE.Vector3();
  }

  /** the facing it will land with (a straight leap faces the landing, a turning leap faces her) */
  private landFacing() {
    const p = this.g.player.pos;
    const d = new THREE.Vector3(p.x - this.to.x, 0, p.z - this.to.z);
    return d.lengthSq() > 1e-3 ? d.normalize() : this.facing;
  }

  private finish(cd: number) {
    this.cooldown = cd / this.pace;
    this.passThrough = false; this.floating = false;
    if (this.hasSlot && this.lastCtx) { this.lastCtx.releaseSlot(this); this.hasSlot = false; }
    this.setState('chase');
    this.loop('idle', 1, 0.3);
  }

  /** root motion of the clip since last frame, as a move (m/s) along its facing */
  private rootMove(t: number, dt: number, scale = 1) {
    const a = rootAt(this.clip, this.lastRootT), b = rootAt(this.clip, t);
    this.lastRootT = t;
    const f = this.facing, r = new THREE.Vector3().crossVectors(f, UP);
    const v = f.multiplyScalar((b[0] - a[0]) * this.s * scale).addScaledVector(r, (b[1] - a[1]) * this.s * scale);
    return v.divideScalar(Math.max(dt, 1e-4));
  }

  protected brainSpecial(dt: number, dist: number, dirP: THREE.Vector3, _dy: number, ctx: EnemyCtx): THREE.Vector3 {
    this.mt += dt;
    this.lastCtx = ctx;
    const a = this.arch, p = this.pace;
    const t = this.cur?.time ?? 0;
    const [hook, sweep, slam, slamRing, , roarBlast] = a.attacks;
    switch (this.mode) {
      case 'roar': {
        if (this.mt < 0.8) this.turnToward(dirP, 2.5, dt);
        if (!this.hit && t >= CLIPS.roar.headPeakT) {
          this.hit = true;
          this.sound('maw_roar', 1.5, this.maw ? 0.6 : 0.8);
          this.g.audio.play('boss_scream', { pos: this.center.clone(), rate: 0.45, vol: 0.7 });
          this.g.rig.addShake(0.5); Platform.haptic(30);
          this.g.fx.shockwave(this.pos.clone(), roarBlast.range, 0.3);
          if (dist < roarBlast.range && ctx.playerAlive) ctx.onAttackHit(this, roarBlast);
          if (this.phase === 2) this.g.hud.prompt('The Maw calls the gloom out of the font!', 2.4);
        }
        if (t > 3.3) { this.cur!.timeScale = 1.6; }
        if (t > 4.2 || !this.cur?.isRunning()) this.finish(0.4);
        return new THREE.Vector3();
      }
      case 'punch': {
        // the tell is the slow start; from the cocked fist on it strikes at speed
        if (t > 0.18 && this.cur && this.cur.timeScale < 0.9 * p) this.cur.timeScale = 1.08 * p;
        if (t < 0.22) this.turnToward(dirP, 3.2, dt);
        if (!this.hit && t >= hook.window[0] && t <= hook.window[1]) {
          if (this.strike(hook, ctx)) { this.hit = true; this.g.audio.play('kick_hit', { pos: ctx.playerPos.clone(), rate: 0.7 }); }
        }
        if (t >= hook.window[1] && !this.hit) this.hit = true;
        const mv = this.rootMove(t, dt);
        if (t >= 0.62 && this.combo.length) { this.cooldown = 0; this.state = 'chase'; return mv; }
        if (t >= 0.95 || !this.cur?.isRunning()) this.finish(hook.cooldown[0] + Math.random() * (hook.cooldown[1] - hook.cooldown[0]));
        return mv;
      }
      case 'swipe': {
        if (t < 0.95) this.turnToward(dirP, 2.2, dt);
        if (!this.hit && t >= sweep.window[0] && t <= sweep.window[1]) {
          if (this.strike(sweep, ctx)) { this.hit = true; this.g.audio.play('bone_crunch', { pos: ctx.playerPos.clone(), rate: 0.75, vol: 0.8 }); }
        }
        if (!this.swung && t >= sweep.window[0] - 0.08) { this.swung = true; this.g.audio.swing(1, this.center.clone(), 0.75); }
        if (t >= sweep.window[1]) this.hit = true;
        const mv = this.rootMove(t, dt);
        if (dist < this.radius + 0.6) mv.multiplyScalar(0);
        if (t >= 1.75 && this.combo.length) { this.cooldown = 0; this.state = 'chase'; return mv; }
        if (t >= 2.1 || !this.cur?.isRunning()) this.finish(sweep.cooldown[0] + Math.random() * (sweep.cooldown[1] - sweep.cooldown[0]));
        return mv;
      }
      case 'leap': return this.updateLeap(t, dt, dist, ctx, slam, slamRing);
      case 'pound': return this.updatePound(t, dt, dirP, ctx);
      case 'hop': {
        // a crouch-hop back out of her reach (the clip hops in place; it travels 3 m away from her in the air)
        const k = smooth(t / (CLIPS.hop.duration * 0.9));
        this.floating = true;
        const away = this.from.clone().addScaledVector(dirP, -3.2 * (this.s / 1.8));
        const want = this.from.clone().lerp(away, k);
        const w = ctx.world, st = ctx.state;
        const ok = w.hasFooting(want.clone().setY(want.y + 1), 2, st) && !w.inVoid(want.clone().setY(want.y - 0.3), st);
        this.turnToward(dirP, 4, dt);
        const v = ok ? want.sub(this.pos).setY(0).divideScalar(Math.max(dt, 1e-4)) : new THREE.Vector3();
        if (t >= CLIPS.hop.duration - 0.05 || !this.cur?.isRunning()) {
          this.floating = false;
          this.g.fx.dust(this.pos.clone().setY(this.pos.y + 0.05), 10);
          this.g.audio.play('land_heavy', { pos: this.pos.clone(), rate: 0.7 });
          this.finish(0.15);
          this.cooldown = 0;
        }
        return v;
      }
      case 'flex': {
        this.turnToward(dirP, 1.5, dt);
        if (!this.hit && t >= 2.1) {
          this.hit = true; this.enraged = true;
          this.sound('maw_roar', 1.4, 0.65);
          this.g.rig.addShake(0.35);
          this.g.fx.shockwave(this.pos.clone(), 4, 0.6);
          this.g.hud.prompt('The Maw is enraged!', 2);
        }
        if (t > 3.5 || !this.cur?.isRunning()) this.finish(0.2);
        return new THREE.Vector3();
      }
      case 'turn': {
        // the root follows the clip's yaw (scaled to the angle wanted); the feet step round
        const deg = yawAt(this.clip, t) * this.yawScale;
        this.yaw = this.yawBase - THREE.MathUtils.degToRad(deg);
        if (t >= CLIPS[this.clip].duration - 0.08 || !this.cur?.isRunning()) this.finish(Math.max(0, this.cooldown));
        return new THREE.Vector3();
      }
      case 'stagger': {
        if (t >= 1.15 || !this.cur?.isRunning()) this.finish(0.35);
        return new THREE.Vector3();
      }
      case 'stun': {
        // the stumble to its head hanging (0.95 s), held, then played back up
        const cur = this.cur!;
        if (cur.timeScale > 0 && t >= 0.95) { cur.timeScale = 0.02; }
        if (cur.timeScale > 0 && cur.timeScale < 0.1) {
          this.stunHold -= dt;
          if (Math.random() < dt * 3) this.g.fx.emit(this.center.clone().add(new THREE.Vector3(0, 0.6 * this.s, 0)), new THREE.Vector3(0, 0.6, 0), 0xffe0a0, 0.6, 0.05, -0.3);
          if (this.stunHold <= 0) cur.timeScale = -1.1;
        }
        if (cur.timeScale < 0 && t <= 0.12) this.finish(0.2);
        return new THREE.Vector3();
      }
    }
    return new THREE.Vector3();
  }

  private updateLeap(t: number, dt: number, dist: number, ctx: EnemyCtx, slam: EnemyAttack, slamRing: EnemyAttack) {
    const TAKEOFF = 0.5, LAND = 1.57;
    // the turning leap swings the root round along the clip's yaw, scaled onto her
    if (this.clip === 'leap_turn') this.yaw = this.yawBase - THREE.MathUtils.degToRad(yawAt(this.clip, t) * this.yawScale);
    if (t < TAKEOFF) { if (this.clip === 'leap_slam') this.turnToward(this.to.clone().sub(this.pos).setY(0).normalize(), 3, dt); return new THREE.Vector3(); }
    if (t < LAND) {
      // in the air: over the rim, over the font — no collision; the clip's own hips carry the height
      this.floating = true; this.passThrough = true;
      const total = rootAt(this.clip, LAND)[0] || 1;
      const k = THREE.MathUtils.clamp(rootAt(this.clip, t)[0] / total, 0, 1);
      const want = this.from.clone().lerp(this.to, k);
      this.pos.y = THREE.MathUtils.lerp(this.from.y, this.to.y, k);
      return want.sub(this.pos).setY(0).divideScalar(Math.max(dt, 1e-4));
    }
    if (this.floating) {
      this.floating = false; this.passThrough = false;
      this.pos.copy(this.to);
      this.g.fx.dust(this.pos.clone().setY(this.pos.y + 0.05), 22);
      this.g.audio.play('land_heavy', { pos: this.pos.clone(), rate: 0.55, vol: 1.3 });
      this.g.rig.addShake(0.3);
    }
    if (!this.hit && t >= slam.window[0]) {
      this.hit = true;
      this.fist.copy(this.pos).addScaledVector(this.facing, 1.1 * (this.s / 1.8));
      this.g.fx.shockwave(this.fist.clone(), slamRing.range, 0.9);
      this.g.audio.play('rubble', { pos: this.fist.clone(), vol: 1.2 });
      this.g.audio.play('shift_boom', { rate: 0.5, vol: 0.7 });
      this.g.rig.addShake(0.6); Platform.haptic(40);
      const d = Math.hypot(ctx.playerPos.x - this.fist.x, ctx.playerPos.z - this.fist.z);
      if (ctx.playerAlive && Math.abs(ctx.playerPos.y - this.fist.y) < 1.8) {
        if (d < slam.range) ctx.onAttackHit(this, slam);
        else if (d < slamRing.range && !ctx.playerAirborne) ctx.onAttackHit(this, slamRing);
      }
    }
    // lands exposed: the stand-up is sped once the fists are out of the floor; it heaves round toward her
    if (t > 1.9) this.turnToward(ctx.playerPos.clone().sub(this.pos).setY(0).normalize(), 1.6, dt);
    if (t > 2.3 && this.cur && this.cur.timeScale < 1.4) this.cur.timeScale = 1.45 * this.pace;
    if (t >= 3.15 || !this.cur?.isRunning()) this.finish(0.3);
    void dist;
    return new THREE.Vector3();
  }

  private updatePound(t: number, dt: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    const SLAM = 1.9;
    if (t < 1.0) this.turnToward(dirP, 2, dt);
    if (!this.hit && t >= SLAM) {
      this.hit = true;
      const at = this.pos.clone().addScaledVector(this.facing, 0.5 * (this.s / 1.8));
      this.waves.push({ at, t: 0, hit: false });
      this.fxm.wave(at, WAVE_SPEED, WAVE_REACH);
      this.g.fx.shockwave(at.clone(), 3, 0.8);
      this.g.audio.play('rubble', { pos: at.clone(), vol: 1.3 });
      this.g.audio.play('shift_boom', { rate: 0.45, vol: 0.8 });
      this.g.rig.addShake(0.5); Platform.haptic(36);
      this.pounds--;
    }
    // a second pound (phase 2+): back up into the jump and down again
    if (this.hit && this.pounds > 0 && t >= SLAM + 0.3 && this.cur) {
      this.cur.time = 1.25; this.hit = false;
      this.fxm.ring(this.pos, WAVE_REACH, (SLAM - 1.25) / this.pace);
    }
    if (t >= 2.75 || !this.cur?.isRunning()) this.finish(0.4);
    return new THREE.Vector3();
  }

  // ------------------------------------------------------------------ taking blows
  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    if (!this.alive) return 'dead';
    if (!this.triggered) this.activate();
    const mult = this.state === 'special' && this.mode === 'stun' ? 1.35 : this.state === 'special' && this.mode === 'flex' ? 1.3 : 1;
    this.hp = Math.max(this.minHp, this.hp - damage * mult);
    this.hitFlash = 1;
    void knock;
    if (this.hp <= 0) { this.die(); return 'dead'; }
    const sp = this.state === 'special';
    // high in a leap: out of reach of anything but the landing
    if (sp && this.mode === 'leap' && this.floating) return 'armor';
    if (sp && (this.mode === 'stun' || this.mode === 'stagger' || this.mode === 'roar' || this.mode === 'flex')) return 'armor';
    this.poise -= poiseDmg * (opts.knockdown || opts.guardBreak ? 1.4 : 1);
    // a full-charge Crownbreaker (knockdown + big damage) or a blow into the landing crouch floors it
    const exposed = sp && this.mode === 'leap' && (this.cur?.time ?? 0) > 1.75;
    if ((opts.knockdown && damage >= 60) || (exposed && (opts.knockdown || opts.guardBreak))) { this.poise = this.arch.poise; this.begin('stun'); return 'stagger'; }
    if (this.poise <= 0) { this.poise = this.arch.poise; this.begin('stagger'); return 'stagger'; }
    void from;
    return 'armor';
  }

  /** her parry: a parried hook stuns it (the fight's biggest reward); a parried sweep only staggers */
  parried() {
    if (this.state === 'special' && this.mode === 'punch') { this.begin('stun'); return; }
    this.poise = this.arch.poise;
    this.begin('stagger');
  }

  // ------------------------------------------------------------------ every frame
  protected afterAnimate(dt: number, ctx: EnemyCtx) {
    // cooldowns run through its moves too (a leap's 3 s count toward the next one)
    this.leapCd -= dt; this.poundCd -= dt; this.hopCd -= dt; this.turnCd -= dt;
    // quake waves: a band of broken floor running outward; she is thrown if it passes under her feet
    for (const w of this.waves) {
      w.t += dt;
      const r = w.t * WAVE_SPEED;
      if (!w.hit && ctx.playerAlive && this.alive) {
        const d = Math.hypot(ctx.playerPos.x - w.at.x, ctx.playerPos.z - w.at.z);
        if (Math.abs(d - r) < WAVE_BAND && Math.abs(ctx.playerPos.y - w.at.y) < 1.2 && !ctx.playerAirborne) {
          w.hit = true;
          ctx.onAttackHit(this, this.arch.attacks[4]);
        }
      }
    }
    this.waves = this.waves.filter((w) => w.t * WAVE_SPEED < WAVE_REACH + 1);
    // death: the fall carries it back along the clip's own root path
    if (!this.alive && this.cur && this.curName === 'death') {
      const t = this.cur.time;
      const a = rootAt('death', this.lastRootT), b = rootAt('death', t);
      this.lastRootT = t;
      const f = this.facing;
      this.pos.addScaledVector(f, (b[0] - a[0]) * this.s);
      this.root.position.copy(this.pos);
    }
    // enraged: the crystal flesh smoulders (a slow crimson pulse)
    const want = this.enraged && this.alive ? 0.55 + 0.25 * Math.sin(this.g.t * 5) : 0;
    this.glow += (want - this.glow) * Math.min(1, dt * 3);
    for (const m of this.glowMats) m.emissive.setRGB(this.glow, this.glow * 0.12, this.glow * 0.05);
    if (this.enraged && this.alive && Math.random() < dt * 10) this.g.fx.emit(this.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * this.radius, (Math.random() - 0.2) * 0.8 * this.s, (Math.random() - 0.5) * this.radius)), new THREE.Vector3(0, 1.1, 0), 0xff4a18, 0.6, 0.05, -0.8);
    // heavy footfalls
    if (this.state === 'chase' && (this.curName === 'walk' || this.curName === 'run') && this.cur) {
      const ph = (this.cur.time / this.cur.getClip().duration) * 2 % 1;
      if (ph < this.stepPh) this.g.audio.play('land_heavy', { pos: this.pos.clone(), rate: this.maw ? 0.6 : 0.8, vol: this.maw ? 0.55 : 0.35 });
      this.stepPh = ph;
    }
  }
  private stepPh = 0;
}
