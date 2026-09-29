import * as THREE from 'three';
import type { Enemy } from '../enemies/Enemy';
import type { CollisionWorld } from '../game/Physics';
import type { TimeState } from '../levels/Materials';
import type { AttackKind } from './CombatData';

/**
 * Combat assistance shared by the camera and the sword (session 7: the mobile experience).
 *
 * SOFT CAMERA (touch only — a mouse already aims): the camera keeps the enemy that matters in view without
 * locking onto it. One "focus" enemy is chosen with hysteresis (nearby, engaged, in line of sight, in front,
 * strongly preferring whoever is attacking right now; archers only when close). While the focus sits inside a
 * comfortable part of the frame nothing happens; when it drifts out, the yaw eases toward it at a capped,
 * smoothed rate. Any manual swipe takes over completely for a moment and hands back gradually.
 *
 * ATTACK MAGNETISM (all inputs): pressing an attack picks a sensible nearby target — in line of sight, near,
 * roughly where the stick points (or where the hero faces when the stick is idle), sticky through a combo —
 * and the hero turns to it during the wind-up and closes a small, budgeted gap (see Player.updateAttack).
 * Distant enemies, enemies behind walls and enemies far off the stick direction are never chosen.
 */

export interface AssistTarget {
  pos: THREE.Vector3;
  radius: number;
  valid(): boolean;
  enemy?: Enemy;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _chest = new THREE.Vector3();

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function hot(e: Enemy) {
  if (e.isRanged) return e.state === 'shoot' && e.shootPhase === 1;
  return e.state === 'attack' || e.state === 'windup' || e.state === 'dive' || e.state === 'lunge';
}

/** attack magnetism reach by attack kind (m, horizontal) */
const REACH: Record<AttackKind, number> = { light: 5.0, heavy: 5.0, finisher: 5.0, kick: 4.2, bash: 4.2, crouch: 4.2, sprint: 6.8, air: 3.2, whirl: 0 };

export interface CameraAssistInput {
  dt: number;
  now: number;
  yaw: number;
  /** horizontal half field of view (rad) */
  halfHFov: number;
  playerPos: THREE.Vector3;
  /** camera position (last frame): the dead zone is judged by where the target is on SCREEN */
  camPos: THREE.Vector3;
  /** camera-relative stick direction in world space (zero when idle) */
  wish: THREE.Vector3;
  manual: boolean;
}

export class TargetAssist {
  /** the enemy the soft camera keeps in view */
  focus: Enemy | null = null;
  /** the soft camera is on (touch input; `?camassist=0|1` overrides) */
  cameraEnabled = false;
  /** the last enemy an attack was aimed at (combo stickiness, camera preference) */
  lastAttackTarget: Enemy | null = null;
  private lastAttackAt = -10;
  private challenger: Enemy | null = null;
  private challengeT = 0;
  private focusLostT = 0;
  private losCache = new Map<number, { t: number; ok: boolean }>();
  private lastManualAt = -10;
  private yawVel = 0;
  private state: TimeState = 'PRESENT';
  /** debug readout */
  info = { weight: 0, err: 0, rate: 0 };

  constructor(private list: () => Iterable<Enemy>, private world: () => CollisionWorld, private timeState: () => TimeState) {}

  // ------------------------------------------------------------------ shared queries
  private valid(e: Enemy) {
    if (!e.alive || e.removed || e.untargetable) return false;
    if (e.owner !== this.state && e.owner !== 'BOTH') return false;
    return e.state !== 'hidden' && e.state !== 'dormant' && e.state !== 'rise';
  }

  /** Line of sight from the hero's chest to the enemy's centre in the current memory (cached 0.15 s). */
  private sees(e: Enemy, from: THREE.Vector3, now: number) {
    const c = this.losCache.get(e.id);
    if (c && now - c.t < 0.15) return c.ok;
    _chest.copy(from).setY(from.y + 1.3);
    const to = _a.copy(e.center).sub(_chest);
    const len = to.length();
    let ok = true;
    if (len > 0.5) {
      const hit = this.world().raycast(_chest, to.divideScalar(len), len, this.state);
      ok = !hit || hit.distance > len - 0.45;
    }
    this.losCache.set(e.id, { t: now, ok });
    return ok;
  }

  private syncState() {
    const st = this.timeState();
    if (st !== this.state) { this.state = st; this.losCache.clear(); this.focus = null; this.challenger = null; }
  }

  // ------------------------------------------------------------------ attack magnetism
  /**
   * The enemy an attack should go to. `wish` = the stick direction (world, may be zero), `facing` = the hero's
   * facing. Returns null when nothing sensible is near (the swing goes where the hero faces).
   */
  meleeTarget(kind: AttackKind, from: THREE.Vector3, wish: THREE.Vector3, facing: THREE.Vector3, now: number): AssistTarget | null {
    this.syncState();
    const maxD = REACH[kind];
    const steering = wish.lengthSq() > 0.04;
    const ref = _b.copy(steering ? wish : facing).setY(0).normalize();
    let best: Enemy | null = null, bestScore = Infinity;
    const sticky = now - this.lastAttackAt < 2.5 ? this.lastAttackTarget : null;
    for (const e of this.list()) {
      if (!this.valid(e)) continue;
      const to = _c.subVectors(e.pos, from);
      const dy = Math.abs(e.isFlying ? e.center.y - (from.y + 1) : to.y);
      if (dy > (e.isFlying ? 2.6 : 1.8)) continue;
      to.y = 0;
      const d = to.length();
      if (d > maxD + e.radius) continue;
      const ang = d > 1e-3 ? ref.angleTo(to.divideScalar(d)) : 0;
      // only very close enemies may be taken from behind; with the stick held, stay near where it points
      if (ang > (d < 1.7 ? Math.PI : 2.1)) continue;
      if (steering && ang > 1.25 && d > 2.2) continue;
      if (!this.sees(e, from, now)) continue;
      let score = d + ang * 2.4;
      if (hot(e)) score -= 0.6;
      if (e === sticky) score -= 1.0;
      if (e === this.focus) score -= 0.4;
      if (e.isFlying) score += 0.8;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (!best) return null;
    this.lastAttackTarget = best;
    this.lastAttackAt = now;
    return TargetAssist.wrapEnemy(best, this.state);
  }

  static wrapEnemy(e: Enemy, st: TimeState): AssistTarget {
    return {
      pos: e.pos, radius: e.radius, enemy: e,
      valid: () => e.alive && !e.removed && !e.untargetable && (e.owner === st || e.owner === 'BOTH'),
    };
  }

  // ------------------------------------------------------------------ soft camera
  private focusScore(e: Enemy, from: THREE.Vector3, camFwd: THREE.Vector3, now: number): number {
    if (!this.valid(e) || !e.triggered) return Infinity;
    const to = _c.subVectors(e.pos, from);
    if (Math.abs(to.y) > 3.5) return Infinity;
    to.y = 0;
    const d = to.length();
    const reach = e.arch.boss ? 16 : e.isRanged ? 8 : e.isFlying ? 9 : 10;
    if (d > reach) return Infinity;
    if (!this.sees(e, from, now)) return Infinity;
    const ang = d > 1e-3 ? camFwd.angleTo(to.divideScalar(d)) : 0;
    let s = d + ang * 2.2;
    if (hot(e)) s -= d < 4 ? 4.5 : 2.5;
    if (e.isRanged) s += 2;
    if (e.arch.boss) s -= 2;
    if (e === this.lastAttackTarget && now - this.lastAttackAt < 3) s -= 1.4;
    return s;
  }

  /** Choose / keep the camera focus (hysteresis: a challenger must be clearly better for a moment). */
  private updateFocus(dt: number, from: THREE.Vector3, camFwd: THREE.Vector3, now: number) {
    let best: Enemy | null = null, bestS = Infinity;
    for (const e of this.list()) {
      const s = this.focusScore(e, from, camFwd, now);
      if (s < bestS) { bestS = s; best = e; }
    }
    const cur = this.focus;
    if (cur) {
      // keep the current focus through short occlusions (a pillar between you for a moment)
      const curS = this.focusScore(cur, from, camFwd, now) - 2.0;
      if (curS === Infinity) {
        const stillThere = this.valid(cur) && cur.pos.distanceTo(from) < 11;
        this.focusLostT += dt;
        if (!stillThere || this.focusLostT > 0.8) { this.focus = best; this.focusLostT = 0; this.challenger = null; }
        return;
      }
      this.focusLostT = 0;
      if (!best || best === cur) { this.challenger = null; this.challengeT = 0; return; }
      const urgent = hot(best) && !hot(cur) && best.pos.distanceTo(from) < 3.5;
      if (bestS < curS - 1.5 || urgent) {
        if (this.challenger !== best) { this.challenger = best; this.challengeT = 0; }
        this.challengeT += dt;
        if (this.challengeT > (urgent ? 0.12 : 0.45)) { this.focus = best; this.challenger = null; this.challengeT = 0; }
      } else { this.challenger = null; this.challengeT = 0; }
      return;
    }
    this.focus = best;
  }

  /** Where the camera should look: the focus, pulled a little toward its pack so the fight stays framed. */
  private aimPoint(from: THREE.Vector3, out: THREE.Vector3) {
    const f = this.focus!;
    out.copy(f.pos).multiplyScalar(2);
    let w = 2;
    for (const e of this.list()) {
      if (e === f || !this.valid(e) || !e.triggered || e.isRanged) continue;
      if (e.pos.distanceTo(f.pos) > 4 || e.pos.distanceTo(from) > 8) continue;
      out.add(e.pos); w++;
    }
    return out.divideScalar(w);
  }

  /**
   * Per-frame camera yaw correction (radians to ADD to the camera yaw). Only while the soft camera is enabled,
   * there is a focus, and the player has not swiped the camera recently.
   */
  cameraYaw(inp: CameraAssistInput): number {
    this.syncState();
    const { dt, now } = inp;
    if (inp.manual) this.lastManualAt = now;
    const camFwd = _b.set(-Math.sin(inp.yaw), 0, -Math.cos(inp.yaw));
    this.updateFocus(dt, inp.playerPos, camFwd, now);
    let want = 0;
    // manual control has priority: nothing for 1.3 s after a swipe, then hand back over 0.8 s
    const since = now - this.lastManualAt;
    let weight = this.cameraEnabled ? THREE.MathUtils.clamp((since - 1.3) / 0.8, 0, 1) : 0;
    if (this.focus && weight > 0) {
      const aim = this.aimPoint(inp.playerPos, _a);
      const dx = aim.x - inp.playerPos.x, dz = aim.z - inp.playerPos.z;
      const dist = Math.hypot(dx, dz);
      // running away from the fight: do not drag the view back toward what is behind
      if (inp.wish.lengthSq() > 0.25 && dist > 0.5 && (inp.wish.x * dx + inp.wish.z * dz) / (dist * inp.wish.length()) < -0.4) weight *= 0.15;
      if (dist > 1.1) {
        // direction of the correction: around the hero toward the target
        const err = wrap(Math.atan2(-dx, -dz) - inp.yaw);
        // how far off-centre it is on SCREEN (seen from the camera, which sits metres behind the hero)
        const sx = aim.x - inp.camPos.x, sz = aim.z - inp.camPos.z;
        const onScreen = Math.abs(wrap(Math.atan2(-sx, -sz) - inp.yaw));
        // comfortable band: the inner ~62 % of the horizontal view; beyond it the view eases over
        const excess = Math.max(onScreen, Math.abs(err) > Math.PI * 0.6 ? Math.PI : 0) - inp.halfHFov * 0.62;
        const hotNow = hot(this.focus);
        if (excess > 0) want = Math.sign(err) * Math.min(hotNow ? 2.4 : 1.6, excess * 3.4 + 0.2);
        this.info.err = onScreen;
      }
    }
    // smoothed rate: eases in and out, never snaps
    this.yawVel += (want * weight - this.yawVel) * Math.min(1, dt * 7);
    if (Math.abs(this.yawVel) < 1e-4) this.yawVel = 0;
    this.info.weight = weight;
    this.info.rate = this.yawVel;
    return this.yawVel * dt;
  }

  reset() {
    this.focus = null; this.challenger = null; this.lastAttackTarget = null; this.losCache.clear(); this.yawVel = 0;
  }
}
