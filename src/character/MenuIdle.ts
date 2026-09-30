import * as THREE from 'three';
import type { AnimController } from './AnimController';

/**
 * The title screen's heroine (session 15): she faces the player in front of the castle and is quietly alive.
 *
 * Home is a breathing guard loop — the Sword & Shield `idle_alert`, or the two-handed `menu_stance_2h` (now and then
 * she changes stance, a slow 1.5 s base cross-fade). After a long, randomised stretch at home (7–13 s; the first beat
 * 4–6 s after the menu opens) she performs one restrained action, cross-faded in and out over ~0.8 s, then goes home
 * again. Actions are weighted, never the same twice in a row and never one of the last three unless nothing else is
 * left; the long ones (the 19 s restless wait) are rarer. Between actions a procedural head layer lets her look around:
 * at the player (most often), off to either side, up at the towers — eased, clamped, off while an action plays (the
 * clips carry their own head motion). No locomotion, no attacks: every clip stands in place (tools/blender/
 * build_hero_menu.py measured root drift ≤ 1 cm; hero_clip_map.json menuClips / unusedMenu has why each one is here).
 *
 * Clips: hero.glb (idle_alert, idle_flourish_a / b) + hero_menu.glb (menu_*), which arrives a moment after the title
 * shows — until then the director simply stays at home.
 */
interface Move { id: string; weight: number; fadeIn?: number; fadeOut?: number; speed?: number }

export const MENU_HOME = ['idle_alert', 'menu_stance_2h'] as const;
export const MENU_MOVES: Move[] = [
  { id: 'menu_inspect', weight: 1.25 },           // the blade raised upright before her, looking along it
  { id: 'menu_vigil', weight: 1.0 },              // the blade close before her face: a quiet vigil
  { id: 'menu_ease', weight: 1.1 },               // sword lowered at ease, a look round, back to guard
  { id: 'idle_flourish_a', weight: 0.9 },         // a calm swing of the sword (hero.glb fidget)
  { id: 'idle_flourish_b', weight: 0.75 },        // a slow twirl (hero.glb fidget)
  { id: 'menu_stretch', weight: 0.8, fadeIn: 1 }, // limbering up: the sword arm across her chest, one calm overhead swing
  { id: 'menu_restless', weight: 0.6, fadeIn: 1 },// the long wait: arms crossed, blade on her shoulder, leaning on it
  { id: 'menu_ready', weight: 0.3 },              // a brief two-handed high-guard sway
];
/** every clip that comes from hero_menu.glb (removed again when play begins) */
export const MENU_PACK_IDS = ['menu_inspect', 'menu_vigil', 'menu_ease', 'menu_stretch', 'menu_restless', 'menu_ready', 'menu_stance_2h'];

type LookKind = 'player' | 'left' | 'right' | 'up' | 'free';
const LOOKS: { kind: LookKind; weight: number; hold: [number, number] }[] = [
  { kind: 'player', weight: 3, hold: [2.6, 5] },
  { kind: 'free', weight: 2, hold: [2, 4] },
  { kind: 'left', weight: 1, hold: [1.6, 3] },
  { kind: 'right', weight: 1, hold: [1.6, 3] },
  { kind: 'up', weight: 0.6, hold: [1.4, 2.4] },
];
const MAX_YAW = THREE.MathUtils.degToRad(42);
const MAX_UP = THREE.MathUtils.degToRad(16);
const MAX_DOWN = THREE.MathUtils.degToRad(10);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
function pick<T extends { weight: number }>(list: T[]): T {
  let s = list.reduce((n, x) => n + x.weight, 0) * Math.random();
  for (const x of list) { s -= x.weight; if (s <= 0) return x; }
  return list[list.length - 1];
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qr = new THREE.Quaternion();
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _h = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3();

export class MenuIdle {
  /** what she is doing now (tests / the debug read-out) */
  state: 'home' | 'move' = 'home';
  move: string | null = null;
  home: string = MENU_HOME[0];
  log: { t: number; what: string }[] = [];
  private t = 0;
  private until = rnd(4, 6);
  private moveEnd = 0;
  private recent: string[] = [];
  private savedResponse: number;
  private neck: THREE.Object3D | null = null;
  private head: THREE.Object3D | null = null;
  private faceAxis = new THREE.Vector3(0, 0, 1);
  private look = { kind: 'free' as LookKind, until: 2, w: 0, yaw: 0, pitch: 0 };

  constructor(private anim: AnimController, private model: THREE.Object3D) {
    this.savedResponse = anim.baseResponse;
    anim.release(0.3);
    // a stance change is a slow cross-fade of the base layer (gameplay uses 12/s)
    anim.baseResponse = 1.6;
    anim.setBase({ [this.home]: 1 });
    model.traverse((o) => {
      if (/Neck$/.test(o.name) && !this.neck) this.neck = o;
      if (/Head$/.test(o.name) && !this.head) this.head = o;
    });
    this.findFaceAxis();
  }

  /** the head bone's local axis that points where her face points (measured once in the current pose) */
  private findFaceAxis() {
    if (!this.head) return;
    this.model.updateMatrixWorld(true);
    const fwd = _f.set(0, 0, 1).applyQuaternion(this.model.getWorldQuaternion(_qr)).setY(0).normalize();
    const hq = this.head.getWorldQuaternion(_q);
    let best = -2;
    for (const a of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const d = _v.set(a[0], a[1], a[2]).applyQuaternion(hq).dot(fwd);
      if (d > best) { best = d; this.faceAxis.set(a[0], a[1], a[2]); }
    }
  }

  private note(what: string) {
    this.log.push({ t: +this.t.toFixed(2), what });
    if (this.log.length > 60) this.log.shift();
  }

  private available() {
    return MENU_MOVES.filter((m) => this.anim.has(m.id));
  }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    const a = this.anim;
    if (this.state === 'move') {
      // hand back to home a fade before the clip ends (the overlay holds its last frame while it fades)
      if (a.overlayId !== this.move || a.overlayTime >= this.moveEnd) {
        a.release(0.9);
        this.state = 'home';
        this.move = null;
        this.until = this.t + rnd(7, 13);
        this.look.until = this.t + rnd(0.8, 1.6);
      }
    } else if (this.t >= this.until) {
      const homeOk = a.has('menu_stance_2h');
      if (homeOk && Math.random() < 0.22) {
        // a subtle stance change instead of an action
        this.home = this.home === MENU_HOME[0] ? MENU_HOME[1] : MENU_HOME[0];
        a.setBase({ [this.home]: 1 });
        this.note('stance ' + this.home);
        this.until = this.t + rnd(6, 10);
      } else {
        const all = this.available();
        let pool = all.filter((m) => !this.recent.includes(m.id));
        if (!pool.length) pool = all.filter((m) => m.id !== this.recent[this.recent.length - 1]);
        if (pool.length) {
          const m = pick(pool);
          const fadeIn = m.fadeIn ?? 0.8;
          a.play(m.id, { fade: fadeIn, speed: m.speed ?? 1, loop: false, clamp: true });
          this.moveEnd = a.duration(m.id) / (m.speed ?? 1) - (m.fadeOut ?? 0.9);
          this.state = 'move';
          this.move = m.id;
          this.recent.push(m.id);
          if (this.recent.length > 3) this.recent.shift();
          this.note(m.id);
        } else {
          this.until = this.t + rnd(5, 8);
        }
      }
    }
    a.update(dt);
    this.applyLook(dt, camera);
  }

  /** the procedural glance, layered on the animated neck + head after the mixer (home only) */
  private applyLook(dt: number, camera: THREE.Camera) {
    const L = this.look;
    if (!this.neck || !this.head) return;
    const home = this.state === 'home';
    if (home && this.t >= L.until) {
      const next = pick(LOOKS.filter((x) => x.kind !== L.kind));
      L.kind = next.kind;
      L.until = this.t + rnd(next.hold[0], next.hold[1]);
    }
    const on = home && L.kind !== 'free';
    L.w += ((on ? 1 : 0) - L.w) * Math.min(1, dt * (on ? 1.8 : 3));
    if (L.w < 0.002) { L.w = 0; return; }
    this.model.updateMatrixWorld(true);
    const bodyQ = this.model.getWorldQuaternion(_qr);
    const fwd = _f.set(0, 0, 1).applyQuaternion(bodyQ).setY(0).normalize();
    _right.crossVectors(_up, fwd).normalize();
    const headPos = this.head.getWorldPosition(_h);
    // where she wants to look, as yaw / pitch relative to her body
    let yaw = 0, pitch = 0;
    if (L.kind === 'player' || L.kind === 'up') {
      _v.copy(camera.position).sub(headPos);
      yaw = Math.atan2(_v.dot(_right), _v.dot(fwd));
      pitch = Math.atan2(_v.y, Math.hypot(_v.dot(_right), _v.dot(fwd)));
      if (L.kind === 'up') { yaw *= 0.4; pitch = MAX_UP; }
    } else if (L.kind === 'left') { yaw = THREE.MathUtils.degToRad(38); pitch = THREE.MathUtils.degToRad(3); }
    else if (L.kind === 'right') { yaw = -THREE.MathUtils.degToRad(38); pitch = THREE.MathUtils.degToRad(3); }
    yaw = THREE.MathUtils.clamp(yaw, -MAX_YAW, MAX_YAW);
    pitch = THREE.MathUtils.clamp(pitch, -MAX_DOWN, MAX_UP);
    // where the animated face already points
    const face = _v.copy(this.faceAxis).applyQuaternion(this.head.getWorldQuaternion(_q));
    const curYaw = Math.atan2(face.dot(_right), face.dot(fwd));
    const curPitch = Math.asin(THREE.MathUtils.clamp(face.y, -1, 1));
    // eased toward the wanted offset (a turn of the head takes ~0.6 s)
    const k = Math.min(1, dt * 3.2);
    L.yaw += (THREE.MathUtils.clamp(yaw - curYaw, -MAX_YAW, MAX_YAW) - L.yaw) * k;
    L.pitch += (THREE.MathUtils.clamp(pitch - curPitch, -MAX_DOWN, MAX_UP) - L.pitch) * k;
    // world rotation R = yaw about up, then pitch about her right; 40 % in the neck, 60 % in the head
    for (const [bone, share] of [[this.neck, 0.4], [this.head, 0.6]] as const) {
      const R = _qi.setFromAxisAngle(_up, L.yaw * share * L.w);
      R.multiply(_q.setFromAxisAngle(_right, -L.pitch * share * L.w));
      const parentQ = bone.parent!.getWorldQuaternion(_qp);
      // local' = parent⁻¹ · R · parent · local
      const inv = parentQ.clone().invert();
      bone.quaternion.premultiply(parentQ).premultiply(R).premultiply(inv);
      bone.updateMatrixWorld(true);
    }
  }

  dispose() {
    this.anim.release(0.2);
    this.anim.baseResponse = this.savedResponse;
  }
}
