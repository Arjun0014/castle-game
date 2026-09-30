import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { TimeState } from './Materials';
import type { Marker } from './Level';
import { Hints } from '../ui/Hints';
import { ATMO_UNIFORMS } from '../vfx/Atmosphere';
import { Platform } from '../platform/Platform';

interface Save { cid: string; pos: THREE.Vector3; yaw: number; state: TimeState; charge: number; }

/** seconds before the same Blood Sigil can be used again (a NEW sigil is always available) */
export const SIGIL_COOLDOWN = 30;
/** interaction reach (m, horizontal) and the distance at which a sigil first announces itself */
const REACH = 2.3;
const NOTICE = 7;
/** a sigil refuses while an engaged enemy is this close (m) */
const SIGIL_SAFE = 12;

/**
 * Blood Sigils (checkpoints), Memory Traces and the respawn policy.
 *
 * Policy (blueprint §H.1): activation heals and saves position/state/charge; on death the player respawns at
 * the last sigil with charge = max(saved, 100); uncleared encounters reset, cleared stay dead. CP1 of Floor 1
 * performs the blood rite on its first activation: time shifting unlocks and charge tops up to 100.
 *
 * Session 7: a sigil is an explicit, readable object — a column of blood-light over the floor disc that is
 * dim while dormant, bright while it holds your progress, and shows a recovery ring for SIGIL_COOLDOWN s after
 * each use. The interaction card names it ("BLOOD SIGIL / Activate Checkpoint"), says why it cannot be used
 * right now (recovering, enemies near) instead of failing silently, and the first sigil explains itself.
 */
export class Checkpoints {
  activated = new Set<string>();
  save: Save | null = null;
  private sigils: Marker[];
  private traces: Marker[];
  private near: { kind: 'sigil' | 'trace'; m: Marker } | null = null;
  readTraces = new Set<string>();
  /** game time at which each sigil becomes usable again */
  private readyAt = new Map<string, number>();
  private noticed = new Set<string>();
  private beacons = new Map<string, SigilBeacon>();
  /** the sigil the current objective points at (brighter pulse) */
  objectiveSigil: string | null = null;
  /** any sigil activated in this whole run (the first one teaches) — shared across floors via the Game */
  static everActivated = false;

  constructor(private g: Game) {
    this.sigils = g.level.markersOf('sigil');
    this.traces = g.level.markersOf('trace');
    if (!this.sigils.length) throw new Error('This floor has no Blood Sigils (checkpoints)');
    for (const m of this.sigils) {
      const b = new SigilBeacon(m.pos);
      this.beacons.set(m.name, b);
      g.level.root.add(b.root);
    }
  }

  private _at = new THREE.Vector3();
  cooldownLeft(cid: string) { return Math.max(0, (this.readyAt.get(cid) ?? -1) - this.g.t); }

  update(dt: number) {
    const g = this.g;
    const p = g.player.pos;
    this.near = null;
    for (const m of this.sigils) {
      const dx = m.pos.x - p.x, dz = m.pos.z - p.z, dy = Math.abs(m.pos.y - p.y);
      const d = Math.hypot(dx, dz);
      if (d < NOTICE && dy < 2 && !g.enemies.inCombat && !this.activated.has(m.name) && !this.noticed.has(m.name)) {
        this.noticed.add(m.name);
        g.signals.emit('sigil:near', { cid: m.name });
      }
      if (!this.near && d < REACH && dy < 1.2) this.near = { kind: 'sigil', m };
    }
    if (!this.near) {
      for (const m of this.traces) {
        const st = m.group;
        if (st !== 'SHARED' && st !== g.time.state) continue;
        if (m.pos.distanceTo(p.clone().setY(p.y + 1)) < 2.6) { this.near = { kind: 'trace', m }; break; }
      }
    }
    if (this.near?.kind === 'sigil') {
      const cid = this.near.m.name;
      // a sigil that was just used shows no card at all (the recovery ring on the floor carries its state);
      // pressing Interact on it anyway gets a brief note (interact())
      const at = this._at.copy(this.near.m.pos).setY(this.near.m.pos.y + 1.1);
      if (this.cooldownLeft(cid) > 0) g.hud.interact(null);
      else if (g.enemies.engagedNear(p, SIGIL_SAFE)) g.hud.interact('Enemies are near', 'BLOOD SIGIL', true, { at, verb: 'WAIT', kind: 'sigil' });
      else if (this.save?.cid === cid) g.hud.interact('Renew Checkpoint', 'BLOOD SIGIL', false, { at, verb: 'RENEW', kind: 'sigil' });
      else g.hud.interact('Activate Checkpoint', 'BLOOD SIGIL', false, { at, verb: 'ACTIVATE', kind: 'sigil' });
    } else if (this.near?.kind === 'trace') {
      const read = this.readTraces.has(this.near.m.name);
      g.hud.interact(read ? 'Remember' : 'Examine', 'MEMORY', false, { at: this.near.m.pos, verb: read ? 'RECALL' : 'INSPECT', kind: 'trace' });
    } else g.hud.interact(null);
    // beacon states
    for (const m of this.sigils) {
      const b = this.beacons.get(m.name);
      if (!b) continue;
      const current = this.save?.cid === m.name;
      const left = this.cooldownLeft(m.name);
      b.update(dt, {
        level: current ? 1 : this.activated.has(m.name) ? 0.35 : this.objectiveSigil === m.name ? 0.75 : 0.5,
        recover: left > 0 ? 1 - left / SIGIL_COOLDOWN : 1,
        near: this.near?.m === m,
        pastTint: g.time.state === 'PAST',
      });
    }
  }

  interact(): boolean {
    if (!this.near) return false;
    const g = this.g;
    if (this.near.kind === 'trace') {
      const tid = this.near.m.name;
      const first = !this.readTraces.has(tid);
      this.readTraces.add(tid);
      g.audio.memory();
      g.hud.prompt(this.near.m.props.text, 7);
      g.signals.emit('trace', { tid, first });
      return true;
    }
    const m = this.near.m;
    const left = this.cooldownLeft(m.name);
    if (left > 0) {
      g.hud.deny('The sigil is still recovering.', 1.2);
      g.audio.deny();
      g.signals.emit('sigil:blocked', { cid: m.name, why: 'cooldown' });
      return true;
    }
    if (g.enemies.engagedNear(g.player.pos, SIGIL_SAFE)) {
      g.hud.deny('The sigil will not answer while Echoes are near.');
      g.audio.deny();
      g.signals.emit('sigil:blocked', { cid: m.name, why: 'combat' });
      return true;
    }
    this.activate(m);
    return true;
  }

  activate(m: Marker) {
    const g = this.g;
    const first = !this.activated.has(m.name);
    const firstEver = !Checkpoints.everActivated;
    Checkpoints.everActivated = true;
    this.activated.add(m.name);
    this.readyAt.set(m.name, g.t + SIGIL_COOLDOWN);
    g.player.playInteract(1.8);
    g.player.hp = g.player.maxHp;
    g.audio.sigil();
    g.fx.shiftBurst(m.pos, g.time.state);
    this.beacons.get(m.name)?.surge();
    const rite = m.name === 'CP1' && !g.time.unlocked && g.floorId === 1;
    if (rite) {
      g.time.unlocked = true;
      g.time.charge = Math.max(g.time.charge, 100);
      g.hud.message('CHECKPOINT ANCHORED', 'If you fall, the castle returns you here', 3.2);
      // Guided: the tutorial's own lesson follows instead (game/Tutorial.ts)
      if (!g.tutorial?.active) g.schedule(3.4, () => g.hud.message('YOUR BLOOD ANSWERS THE CASTLE', Hints.shiftUnlock(), 5));
    } else if (firstEver) {
      g.hud.message('CHECKPOINT ANCHORED', 'If you fall, the castle returns you here', 3.2);
    } else {
      g.hud.message('CHECKPOINT ANCHORED', first ? 'The castle will remember you here' : 'Health restored', 2.4);
    }
    this.save = { cid: m.name, pos: m.pos.clone().add(new THREE.Vector3(0, 0.05, 1.2)), yaw: g.player.yaw, state: g.time.state, charge: g.time.charge };
    // make sure the respawn spot is standable in the saved state; otherwise use the sigil centre
    const w = g.level.collision;
    if (w.overlap(this.save.pos, 0.35, 1.8, this.save.state) > 0.05 || !w.hasFooting(this.save.pos, 1, this.save.state)) this.save.pos = m.pos.clone().add(new THREE.Vector3(0, 0.05, 0));
    Platform.haptic(24);
    g.signals.emit('sigil:activate', { cid: m.name, first, firstEver, rite });
  }

  respawn() {
    const g = this.g;
    const s = this.save;
    g.enemies.resetUncleared();
    if (!s) {
      const sp = g.level.marker('spawn', 'SPAWN');
      g.player.revive(sp.pos, Math.PI);
      if (g.time.state !== 'PRESENT') g.time.setState('PRESENT', sp.pos, false);
      // the same fair minimum as a sigil respawn once shifting is known
      g.time.charge = Math.max(g.time.charge, g.time.unlocked ? 100 : 0);
      g.time.cooldown = 0;
      g.enemies.onStateChange(g.time.state);
      g.setEnvironment(g.time.state, true);
      g.hud.setState(g.time.state);
      g.rig.snapBehind(Math.PI);
      return;
    }
    g.player.revive(s.pos, s.yaw);
    if (g.time.state !== s.state) {
      g.time.setState(s.state, s.pos, false);
      g.setEnvironment(s.state, true);
      g.hud.setState(s.state);
    }
    g.time.charge = Math.max(s.charge, g.time.unlocked ? 100 : 0);
    g.time.cooldown = 0;
    g.enemies.onStateChange(g.time.state);
    g.rig.snapBehind(s.yaw);
  }

  dispose() { for (const b of this.beacons.values()) b.dispose(); this.beacons.clear(); }

  /** Position of a sigil (objective guidance). */
  sigilPos(cid: string) { return this.sigils.find((m) => m.name === cid)?.pos ?? null; }
}

/**
 * The visible Blood Sigil: a soft column of blood-light over the floor disc and a halo on the floor with a
 * recovery arc. Additive, unlit, no lights added (light count never changes → no shader recompiles). All
 * beacons share one program; state is uniforms only.
 */
const BEAM_VS = `
varying float vH; varying float vRim;
void main() {
  vH = position.y / 5.5;
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FS = `
uniform float uTime; uniform float uLevel; uniform float uSurge; uniform vec3 uColor;
varying float vH; varying float vRim;
void main() {
  float fall = pow(1.0 - clamp(vH, 0.0, 1.0), 2.2);
  float edge = pow(clamp(1.0 - vRim, 0.0, 1.0), 1.6);
  float wave = 0.75 + 0.25 * sin(uTime * 2.2 - vH * 9.0);
  float a = fall * edge * wave * (0.12 + 0.5 * uLevel + uSurge);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const HALO_VS = `
varying vec2 vP;
void main() { vP = position.xz / 1.6; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FS = `
uniform float uTime; uniform float uLevel; uniform float uRecover; uniform float uSurge; uniform float uNear; uniform vec3 uColor;
varying vec2 vP;
void main() {
  float r = length(vP);
  float glow = (1.0 - smoothstep(0.35, 1.0, r)) * (0.12 + 0.4 * uLevel + uSurge * 0.8);
  // recovery arc: fills clockwise while the sigil recovers; a full thin ring when ready
  float ang = fract(atan(vP.x, vP.y) / 6.28318 + 0.5);
  float ring = (1.0 - smoothstep(0.012, 0.035, abs(r - 0.9)));
  float arc = ring * (ang < uRecover ? 1.0 : 0.12) * (uRecover < 0.999 ? 1.0 : 0.35 + 0.65 * uNear);
  float pulse = 0.8 + 0.2 * sin(uTime * 1.7);
  vec3 col = uColor * (glow * pulse) + mix(uColor, vec3(1.0, 0.85, 0.6), 0.45) * arc * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

class SigilBeacon {
  root = new THREE.Group();
  private beam: THREE.ShaderMaterial;
  private halo: THREE.ShaderMaterial;
  private surgeT = 0;
  private level = 0.5;
  private static beamGeo: THREE.BufferGeometry | null = null;
  private static haloGeo: THREE.BufferGeometry | null = null;

  constructor(at: THREE.Vector3) {
    SigilBeacon.beamGeo ??= new THREE.CylinderGeometry(0.42, 0.78, 5.5, 20, 1, true).translate(0, 2.75, 0);
    SigilBeacon.haloGeo ??= new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2);
    const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false };
    this.beam = new THREE.ShaderMaterial({
      ...common, side: THREE.DoubleSide, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
      uniforms: { uTime: ATMO_UNIFORMS.uAtmoTime, uLevel: { value: 0.5 }, uSurge: { value: 0 }, uColor: { value: new THREE.Color(0xff3a26) } },
    });
    this.halo = new THREE.ShaderMaterial({
      ...common, vertexShader: HALO_VS, fragmentShader: HALO_FS,
      uniforms: { uTime: ATMO_UNIFORMS.uAtmoTime, uLevel: { value: 0.5 }, uRecover: { value: 1 }, uSurge: { value: 0 }, uNear: { value: 0 }, uColor: { value: new THREE.Color(0xff3a26) } },
    });
    const beam = new THREE.Mesh(SigilBeacon.beamGeo, this.beam);
    const halo = new THREE.Mesh(SigilBeacon.haloGeo, this.halo);
    halo.position.y = 0.075;
    beam.renderOrder = 4; halo.renderOrder = 3;
    beam.frustumCulled = halo.frustumCulled = true;
    this.root.add(beam, halo);
    this.root.position.copy(at);
  }

  surge() { this.surgeT = 1.6; }
  dispose() { this.beam.dispose(); this.halo.dispose(); this.root.removeFromParent(); }

  update(dt: number, s: { level: number; recover: number; near: boolean; pastTint: boolean }) {
    this.level += (s.level - this.level) * Math.min(1, dt * 3);
    this.surgeT = Math.max(0, this.surgeT - dt);
    const surge = this.surgeT > 0 ? Math.sin((this.surgeT / 1.6) * Math.PI) * 1.2 : 0;
    const u = this.beam.uniforms, h = this.halo.uniforms;
    u.uLevel.value = this.level; u.uSurge.value = surge;
    h.uLevel.value = this.level; h.uSurge.value = surge;
    h.uRecover.value = s.recover;
    h.uNear.value += ((s.near ? 1 : 0) - h.uNear.value) * Math.min(1, dt * 6);
    const c = s.pastTint ? 0xff6a2a : 0xff3326;
    (u.uColor.value as THREE.Color).setHex(c);
    (h.uColor.value as THREE.Color).setHex(c);
  }
}
