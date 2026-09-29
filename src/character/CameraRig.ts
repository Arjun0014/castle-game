import * as THREE from 'three';
import type { CollisionWorld } from '../game/Physics';
import type { TimeState } from '../levels/Materials';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** Third-person orbit camera with collision (raycast against the active state's BVH). */
export class CameraRig {
  yaw = 0;          // radians; camera sits behind the player at yaw
  pitch = 0.28;     // radians, positive = looking down
  distance = 4.4;
  combatDistance = 3.9;
  shoulder = 0.45;
  height = 1.55;
  private curDist = 4.4;
  private target = new THREE.Vector3();
  private shake = 0;
  lockTarget: THREE.Vector3 | null = null;
  inCombat = false;

  constructor(public camera: THREE.PerspectiveCamera) {}

  snapBehind(yaw: number) { this.yaw = yaw + Math.PI; }

  addShake(amount: number) { this.shake = Math.min(0.6, this.shake + amount); }

  /** Horizontal forward vector of the camera (where W moves). */
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt: number, focus: THREE.Vector3, look: { dx: number; dy: number }, world: CollisionWorld, state: TimeState, crouch: boolean) {
    this.yaw -= look.dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy, -0.55, 1.05);
    if (this.lockTarget) {
      _dir.subVectors(this.lockTarget, focus);
      const want = Math.atan2(-_dir.x, -_dir.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 6);
      const flat = Math.hypot(_dir.x, _dir.z);
      const wantPitch = THREE.MathUtils.clamp(0.22 - Math.atan2(_dir.y, flat) * 0.6, 0.05, 0.6);
      this.pitch += (wantPitch - this.pitch) * Math.min(1, dt * 3);
    }
    const h = crouch ? this.height - 0.5 : this.height;
    this.target.lerp(_v.set(focus.x, focus.y + h, focus.z), Math.min(1, dt * 18));
    const wantDist = this.inCombat ? this.combatDistance : this.distance;
    // shoulder offset (to the right of the view)
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.target.clone().addScaledVector(right, this.shoulder);
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    // collision: ray from the head toward the desired camera spot
    const head = this.target;
    const desired = pivot.clone().addScaledVector(off, wantDist);
    _dir.subVectors(desired, head);
    const len = _dir.length();
    _dir.normalize();
    const hit = world.raycast(head, _dir, len + 0.3, state);
    let dist = wantDist;
    if (hit) {
      const allowed = Math.max(0.4, hit.distance - 0.35);
      const ratio = allowed / len;
      dist = Math.min(wantDist, wantDist * ratio);
    }
    // pull in fast, ease out slowly
    this.curDist += (dist - this.curDist) * Math.min(1, dt * (dist < this.curDist ? 22 : 4));
    const pos = pivot.clone().addScaledVector(off, this.curDist);
    if (this.shake > 0) {
      pos.x += (Math.random() - 0.5) * this.shake * 0.25;
      pos.y += (Math.random() - 0.5) * this.shake * 0.25;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(pivot.x, pivot.y - 0.1, pivot.z);
  }
}
