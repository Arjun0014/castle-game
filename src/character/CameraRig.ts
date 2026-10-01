import * as THREE from 'three';
import type { CollisionWorld } from '../game/Physics';
import type { TimeState } from '../levels/Materials';
import type { ViewProfile } from '../platform/Platform';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _off = new THREE.Vector3();
const _q = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Per-view camera tuning. The portrait profile is not a crop of the widescreen camera: it sits farther back
 * and higher, centred behind the hero (no shoulder offset), with a lens shift that puts the hero in the lower
 * part of the tall frame so the space AHEAD (screen-up) is visible, and a vertical FOV that widens with the
 * aspect so the horizontal view never collapses on very tall phones.
 */
export interface CamProfile {
  fov: number;              // vertical FOV (deg) at the reference aspect
  minHFov: number;          // widen vertical FOV until the horizontal FOV reaches this (deg); 0 = off
  maxFov: number;
  /** narrow the vertical FOV so the horizontal one never exceeds this (deg; ultrawide / a phone held sideways); 0 = off */
  maxHFov: number;
  distance: number;
  combatDistance: number;
  maxPull: number;          // extra pull-back in large fights (m)
  shoulder: number;
  height: number;
  pitch: number;            // default pitch (rad, + = looking down)
  pitchMin: number;
  pitchMax: number;
  lockPitch: number;        // base pitch while locked on
  lensShift: number;        // fraction of the frame height the pivot is pushed down (0 = centred)
  lensShiftTouch: number;   // same with the touch HUD (the hero must stay clear of the thumbs)
  lookDrop: number;
  lowCeilingPitch: number;  // how far the camera may drop its pitch to stay behind the hero under low ceilings
}

/**
 * 'wide' = keyboard + mouse widescreen (desktop, Wavedash); 'wideTouch' = a phone / tablet held sideways (Display:
 * Landscape): a touch screen is small and the thumbs cover its lower corners, so the camera stands a little farther back
 * and higher, nearly centred behind her (the soft combat camera keeps fights framed), with the portrait camera's
 * low-ceiling care; 'portrait' = the jam build's tall frame.
 */
export type CamProfileId = ViewProfile | 'wideTouch';

export const CAM_PROFILES: Record<CamProfileId, CamProfile> = {
  wide: {
    fov: 58, minHFov: 0, maxFov: 58, maxHFov: 100, distance: 4.4, combatDistance: 3.9, maxPull: 0, shoulder: 0.45, height: 1.55,
    pitch: 0.28, pitchMin: -0.55, pitchMax: 1.05, lockPitch: 0.22, lensShift: 0, lensShiftTouch: 0, lookDrop: 0.1, lowCeilingPitch: 0,
  },
  wideTouch: {
    fov: 58, minHFov: 0, maxFov: 58, maxHFov: 98, distance: 4.95, combatDistance: 4.75, maxPull: 1.3, shoulder: 0.26, height: 1.6,
    pitch: 0.33, pitchMin: -0.45, pitchMax: 1.08, lockPitch: 0.27, lensShift: 0.03, lensShiftTouch: 0.03, lookDrop: 0.05, lowCeilingPitch: 0.26,
  },
  portrait: {
    fov: 66, minHFov: 44, maxFov: 78, maxHFov: 0, distance: 5.7, combatDistance: 6.1, maxPull: 2.2, shoulder: 0.0, height: 1.65,
    pitch: 0.38, pitchMin: -0.3, pitchMax: 1.1, lockPitch: 0.34, lensShift: 0.12, lensShiftTouch: 0.035, lookDrop: 0.0, lowCeilingPitch: 0.34,
  },
};

/** Third-person orbit camera with collision (raycasts against the active state's BVH). */
export class CameraRig {
  yaw = 0;          // radians; camera sits behind the player at yaw
  pitch = 0.28;     // radians, positive = looking down
  profile: CamProfile = CAM_PROFILES.wide;
  private curDist = 4.4;
  private target = new THREE.Vector3();
  private shake = 0;
  private shakeT = 0;
  /** spring-damped positional kick in camera space (x right, y up, z back) — hit impulses */
  private kick = new THREE.Vector3();
  private kickVel = new THREE.Vector3();
  private pitchAdj = 0;
  /** extra pull-back requested by the game (large fights), eased */
  pullWant = 0;
  private pull = 0;
  lockTarget: THREE.Vector3 | null = null;
  inCombat = false;
  /** current base vertical FOV (profile + aspect); Game subtracts its FOV punch from this */
  baseFov = 58;
  /** 0 = a wall right ahead, 1 = open space ahead (portrait framing adapts; eased) */
  private ahead = 1;
  private vw = 1;
  private vh = 1;
  private shiftNow = 0;
  private shiftFull = 0;
  /** eased downward nudge keeping the camera clear of ceilings the boom rays did not touch */
  private ceilDrop = 0;
  /**
   * Cinematic override (combat/Finishers.ts): while set, the camera eases onto this world position / look target
   * (fast in); when cleared it eases back to the gameplay camera (slower out). The director updates it per frame.
   */
  cine: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  /** 0 = gameplay camera, 1 = fully on the cinematic shot */
  cineK = 0;
  private cineLast = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private cineLook = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  profileId: CamProfileId | null = null;
  /**
   * Switch camera profile. `keep` (a view change while playing: a phone turned to landscape in Settings, a desktop window
   * dragged tall): her yaw stays and the pitch is only clamped into the new range — the boom then eases to its new length.
   */
  setProfile(id: CamProfileId, keep = false) {
    this.profileId = id;
    this.profile = CAM_PROFILES[id];
    if (keep) { this.pitch = THREE.MathUtils.clamp(this.pitch, this.profile.pitchMin, this.profile.pitchMax); return; }
    this.pitch = this.profile.pitch;
    this.curDist = this.profile.distance;
  }

  /** Recompute FOV + lens shift for the stage size (call on resize). */
  applyViewport(w: number, h: number, touch = false) {
    const p = this.profile;
    const aspect = w / h;
    let fov = p.fov;
    if (p.minHFov > 0) {
      const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(p.minHFov) / 2) / aspect));
      fov = Math.min(p.maxFov, Math.max(fov, needed));
    }
    if (p.maxHFov > 0) {
      // ultrawide / a phone held sideways: the frame gets wider, not more distorted
      const cap = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(p.maxHFov) / 2) / aspect));
      fov = Math.min(fov, cap);
    }
    this.baseFov = fov;
    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.vw = w; this.vh = h;
    this.shiftFull = touch ? p.lensShiftTouch : p.lensShift;
    this.shiftNow = -1;
    this.applyShift();
  }

  /** Lens shift = shiftFull scaled by the open space ahead (a wall close ahead re-centres the hero). */
  private applyShift() {
    const shift = this.shiftFull * (0.3 + 0.7 * this.ahead);
    if (Math.abs(shift - this.shiftNow) < 0.002) return;
    this.shiftNow = shift;
    if (shift > 0) this.camera.setViewOffset(this.vw, this.vh, 0, -Math.round(this.vh * shift), this.vw, this.vh);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  snapBehind(yaw: number) { this.yaw = yaw + Math.PI; this.pitchAdj = 0; }

  /** Settings → Camera shake (multiplies every shake and punch) */
  shakeScale = 1;
  addShake(amount: number) { this.shake = Math.min(0.6, this.shake + amount * this.shakeScale); }

  /** Directional camera impulse (world direction, metres/s of kick velocity). Springs back within ~0.2 s. */
  punch(worldDir: THREE.Vector3, strength: number) {
    const c = this.camera;
    _q.copy(worldDir).normalize();
    // into camera space
    const inv = c.quaternion.clone().invert();
    _q.applyQuaternion(inv);
    this.kickVel.addScaledVector(_q, strength * this.shakeScale);
  }

  /** Horizontal forward vector of the camera (where W moves). */
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /** Longest free distance (0..want) from the pivot toward the camera spot at `pitch` (3 rays: centre + sides). */
  private probe(pivot: THREE.Vector3, head: THREE.Vector3, pitch: number, want: number, world: CollisionWorld, state: TimeState) {
    _off.set(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let best = want;
    for (const side of [0, 0.22, -0.22]) {
      const desired = _v.copy(pivot).addScaledVector(_off, want).addScaledVector(_right, side);
      _dir.subVectors(desired, head);
      const len = _dir.length();
      _dir.normalize();
      const hit = world.raycast(head, _dir, len + 0.3, state);
      if (hit) {
        const allowed = Math.max(0.4, hit.distance - 0.35);
        best = Math.min(best, want * Math.min(1, allowed / len));
      }
    }
    return best;
  }

  update(dt: number, focus: THREE.Vector3, look: { dx: number; dy: number }, world: CollisionWorld, state: TimeState, crouch: boolean) {
    const P = this.profile;
    this.yaw -= look.dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, P.pitchMin, P.pitchMax);
    if (this.lockTarget) {
      _dir.subVectors(this.lockTarget, focus);
      const want = Math.atan2(-_dir.x, -_dir.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 6);
      const flat = Math.hypot(_dir.x, _dir.z);
      const wantPitch = THREE.MathUtils.clamp(P.lockPitch - Math.atan2(_dir.y, flat) * 0.6, 0.05, 0.75);
      this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 3);
    }
    const h = crouch ? P.height - 0.5 : P.height;
    this.target.lerp(_v.set(focus.x, focus.y + h, focus.z), Math.min(1, dt * 18));
    if (this.shiftFull > 0) {
      // open space ahead of the hero (screen-up in portrait): a wall within ~3 m re-centres the frame
      _dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const hit = world.raycast(this.target, _dir, 11, state);
      const free = hit ? hit.distance : 11;
      const want = THREE.MathUtils.clamp((free - 2.5) / 7, 0, 1);
      this.ahead += (want - this.ahead) * Math.min(1, dt * 2.2);
      this.applyShift();
    }
    this.pull += (this.pullWant - this.pull) * Math.min(1, dt * (this.pullWant > this.pull ? 1.2 : 0.6));
    const wantDist = (this.inCombat ? P.combatDistance : P.distance) + Math.min(P.maxPull, this.pull);
    const right = _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = _pivot.copy(this.target).addScaledVector(right, P.shoulder);
    const head = this.target;
    // low ceilings (portrait's higher camera): if the wanted pitch is badly blocked but a flatter one is not,
    // ease the pitch down so the camera stays behind the hero instead of diving into the back of the head
    const tilt = this.shiftFull > 0 && !this.lockTarget ? (1 - this.ahead) * 0.14 : 0;
    let pitch = THREE.MathUtils.clamp(this.pitch + this.pitchAdj + tilt, P.pitchMin, P.pitchMax);
    if (P.lowCeilingPitch > 0) {
      const dHigh = this.probe(pivot, head, this.pitch, wantDist, world, state);
      let adj = 0;
      if (dHigh < wantDist * 0.62) {
        const low = Math.max(P.pitchMin, this.pitch - P.lowCeilingPitch);
        const dLow = this.probe(pivot, head, low, wantDist, world, state);
        if (dLow > dHigh * 1.25 + 0.3) adj = low - this.pitch;
      }
      this.pitchAdj += (adj - this.pitchAdj) * Math.min(1, dt * (adj < this.pitchAdj ? 5 : 1.5));
      pitch = THREE.MathUtils.clamp(this.pitch + this.pitchAdj + tilt, P.pitchMin, P.pitchMax);
    }
    const dist = this.probe(pivot, head, pitch, wantDist, world, state);
    // pull in fast, ease out slowly
    this.curDist += (dist - this.curDist) * Math.min(1, dt * (dist < this.curDist ? 22 : 4));
    const off = _off.set(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    const pos = _v.copy(pivot).addScaledVector(off, this.curDist);
    if (P.lowCeilingPitch > 0) {
      // the higher portrait camera must never hang above a roof or beam it reached through a hole (Present
      // ruins): if a surface under the camera sits above the hero's head, pull in until it does not
      for (const k of [1, 0.8, 0.62, 0.45]) {
        pos.copy(pivot).addScaledVector(off, this.curDist * k);
        const dn = world.raycast(pos, DOWN, pos.y - head.y + 2, state);
        if (!dn || pos.y - dn.distance < head.y + 0.25) break;
      }
      // and keep it well below ceilings (a camera 15 cm under a vault fills the top of the frame with it)
      const upHit = world.raycast(pos, UP, 0.85, state);
      const drop = upHit ? 0.85 - upHit.distance : 0;
      this.ceilDrop += (drop - this.ceilDrop) * Math.min(1, dt * (drop > this.ceilDrop ? 14 : 4));
      pos.y -= this.ceilDrop;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(pivot.x, pivot.y - P.lookDrop, pivot.z);
    // cinematic blend (smoothstep) between the gameplay shot and the director's shot
    const want = this.cine ? 1 : 0;
    this.cineK += (want - this.cineK) * Math.min(1, dt * (want ? 8 : 3));
    if (this.cine) { this.cineLast.pos.copy(this.cine.pos); this.cineLast.look.copy(this.cine.look); }
    if (this.cineK > 0.002) {
      const k = this.cineK * this.cineK * (3 - 2 * this.cineK);
      this.cineLook.set(pivot.x, pivot.y - P.lookDrop, pivot.z).lerp(this.cineLast.look, k);
      this.camera.position.lerp(this.cineLast.pos, k);
      this.camera.lookAt(this.cineLook);
    } else this.cineK = 0;
    // hit kick: critically-damped spring in camera space
    this.kickVel.addScaledVector(this.kick, -260 * dt);
    this.kickVel.multiplyScalar(Math.max(0, 1 - 22 * dt));
    this.kick.addScaledVector(this.kickVel, dt);
    // smooth shake: layered sines (~9–20 Hz), amplitude falls off quadratically — no per-frame white noise
    _q.copy(this.kick);
    if (this.shake > 0) {
      this.shakeT += dt;
      const t = this.shakeT * 60, a = this.shake * 0.13;
      _q.x += (Math.sin(t * 1.13) + Math.sin(t * 2.71 + 0.7) * 0.45) * a;
      _q.y += (Math.sin(t * 1.61 + 1.3) + Math.sin(t * 3.07) * 0.45) * a * 0.8;
      this.shake = Math.max(0, this.shake - dt * 2.4);
    }
    if (_q.lengthSq() > 1e-8) this.camera.position.add(_q.applyQuaternion(this.camera.quaternion));
  }
}
