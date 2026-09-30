import * as THREE from 'three';
import type { Game } from './Game';
import { b2t } from '../levels/Level';
import { GUIDANCE, GUIDE_STUCK_AFTER, type GuideLeg } from '../data/guidance';
import { ATMO_UNIFORMS } from '../vfx/Atmosphere';

/**
 * Route guidance in the world (session 14, data/guidance.ts). Text alone did not tell a new player where to go — the
 * first crawl looked like a wall, and on Floor 2's roofs the way on after a fight was invisible. Now the castle shows it:
 *
 *   · CHEVRONS — gold marks on the floor along the way, a slow pulse running through them toward the goal; only the
 *     stretch ahead of her is lit (1.5 m behind … ~20 m ahead), so the floor is never painted end to end;
 *   · a BEACON where a way begins — House Vaelor's lozenge in a ring on the floor under a soft column of light, seen
 *     from across a room;
 *   · a GAP glow — warm light spilling out of a low opening (the crawl): the eye reads it as "through there";
 *   · when a way first opens after a fight, a line on screen (THE WAY IS OPEN …) and one bright sweep running out
 *     along the chevrons from her feet to where they lead.
 *
 * Gold is the way; blue is the shift (the ring, Objectives). Guided shows every leg at full strength; Minimal only the
 * essential ones (dimmer), others once she has been at an objective a while without a fight. Nothing here adds a light
 * (a new light would recompile every lit program); the materials are compiled in the floor's GPU warm-up.
 */
const STEP = 1.45;
const GOLD = new THREE.Color(0xffc870);

const CHEV_VERT = /* glsl */ `
attribute float aSeq; varying vec2 vUv; varying float vSeq;
void main() { vUv = uv; vSeq = aSeq; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`;
const CHEV_FRAG = /* glsl */ `
uniform float uTime, uOpacity, uHead, uLen, uSweep; uniform vec3 uColor;
varying vec2 vUv; varying float vSeq;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec2 q = vec2(abs(p.x), p.y);
  // a chevron pointing along +y: a band round the line y = 0.5 - 0.9|x|, clipped at the sides
  float d = abs(q.y - (0.42 - 0.9 * q.x));
  float c = (1.0 - smoothstep(0.1, 0.19, d)) * (1.0 - smoothstep(0.72, 0.9, q.x)) * step(-0.62, p.y);
  float halo = exp(-4.0 * dot(p, p)) * 0.3;
  // the stretch ahead of her, and the soft end of the route
  float ahead = smoothstep(uHead - 1.5, uHead + 0.4, vSeq) * (1.0 - smoothstep(uHead + 15.0, uHead + 21.0, vSeq));
  float tail = 1.0 - smoothstep(uLen - 0.6, uLen + 0.9, vSeq);
  // a slow pulse running toward the goal
  float flow = 0.62 + 0.75 * pow(0.5 + 0.5 * sin(vSeq * 0.85 - uTime * 3.0), 3.0);
  // the opening sweep: one bright band running out along the route
  float sweep = uSweep >= 0.0 ? exp(-pow((vSeq - uSweep) / 1.7, 2.0)) : 0.0;
  float a = ((c * flow + halo) * ahead + sweep * (c * 1.4 + halo * 2.0)) * tail * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const GLYPH_FRAG = /* glsl */ `
uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv;
mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ring = 1.0 - smoothstep(0.02, 0.05, abs(r - 0.86));
  float ring2 = (1.0 - smoothstep(0.01, 0.03, abs(r - 0.72))) * 0.6;
  // House Vaelor's lozenge, slowly turning, with four ticks on the ring
  vec2 d = rot(uTime * 0.25) * p;
  float loz = 1.0 - smoothstep(0.02, 0.05, abs(abs(d.x) + abs(d.y) * 1.35 - 0.42));
  float core = (1.0 - smoothstep(0.0, 0.2, abs(d.x) + abs(d.y) * 1.35)) * 0.8;
  vec2 t = rot(-uTime * 0.12) * p;
  float ticks = step(0.74, r) * step(r, 0.98) * (1.0 - smoothstep(0.0, 0.035, min(abs(t.x), abs(t.y))));
  float pulse = 0.72 + 0.28 * sin(uTime * 2.2);
  float glow = exp(-3.2 * r * r) * 0.35;
  float a = (ring + ring2 + loz + core + ticks * 0.9 + glow) * pulse * uOpacity * (1.0 - smoothstep(0.95, 1.0, r));
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const COLUMN_FRAG = /* glsl */ `
uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float up = vUv.y;
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.4);
  float fall = pow(1.0 - up, 1.8);
  float shimmer = 0.75 + 0.25 * sin(up * 9.0 - uTime * 2.4);
  float a = (0.18 + 0.82 * fres) * fall * shimmer * uOpacity * 0.55;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const COLUMN_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = mat3(modelMatrix) * normal; vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GAP_FRAG = /* glsl */ `
uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // light from beyond the opening: brightest low in its middle, soft to the edges
  float g = exp(-2.2 * (p.x * p.x) - 1.6 * pow(p.y + 0.25, 2.0));
  float flick = 0.86 + 0.14 * sin(uTime * 1.7) * sin(uTime * 2.9 + 1.0);
  gl_FragColor = vec4(uColor * g * flick * uOpacity * 0.9, 1.0);
}`;
const PLAIN_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Leg {
  def: GuideLeg;
  mesh: THREE.InstancedMesh;
  mat: THREE.ShaderMaterial;
  pts: THREE.Vector3[];
  seq: number[];
  len: number;
  opacity: number;
  sweep: number;
  opened: boolean;
  /** game time its line is due (announce.delay after it opened), -1 = none pending */
  announceAt: number;
}

const additive = (u: Record<string, THREE.IUniform>, frag: string, vert = PLAIN_VERT, side: THREE.Side = THREE.FrontSide) => new THREE.ShaderMaterial({
  uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

export class RouteGuide {
  private legs: Leg[] = [];
  private glyph: THREE.Mesh; private glyphMat: THREE.ShaderMaterial;
  private column: THREE.Mesh; private columnMat: THREE.ShaderMaterial;
  private gap: THREE.Mesh; private gapMat: THREE.ShaderMaterial;
  private chevGeo = new THREE.PlaneGeometry(0.86, 0.86).rotateX(-Math.PI / 2);
  private beaconOpacity = 0;
  private gapOpacity = 0;
  /** tests: the legs showing now, and every leg that opened */
  active: string[] = [];
  opened: string[] = [];
  /** tests / build report: chevrons that found no floor under them (should be none) */
  misses: string[] = [];

  constructor(private g: Game) {
    const T = ATMO_UNIFORMS.uAtmoTime;
    for (const def of GUIDANCE[g.floorId] ?? []) this.legs.push(this.buildLeg(def, T));
    this.glyphMat = additive({ uTime: T, uOpacity: { value: 0 }, uColor: { value: GOLD.clone() } }, GLYPH_FRAG);
    this.glyph = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), this.glyphMat);
    this.columnMat = additive({ uTime: T, uOpacity: { value: 0 }, uColor: { value: GOLD.clone() } }, COLUMN_FRAG, COLUMN_VERT, THREE.DoubleSide);
    this.columnMat.polygonOffset = false;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 7.5, 20, 1, true).translate(0, 3.75, 0), this.columnMat);
    this.gapMat = additive({ uTime: T, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffd08a) } }, GAP_FRAG, PLAIN_VERT, THREE.DoubleSide);
    this.gap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.gapMat);
    for (const m of [this.glyph, this.column, this.gap]) { m.renderOrder = 4; m.frustumCulled = false; g.level.root.add(m); }
    // (drawn at zero opacity in the floor's GPU warm-up — their programs never compile mid-game — then hidden)
  }

  private buildLeg(def: GuideLeg, T: THREE.IUniform): Leg {
    // capacity: the whole path's length in marks (+ a few for the vertical legs of stairs and drops)
    let L = 0;
    for (let i = 0; i < def.path.length - 1; i++) { const a = def.path[i], b = def.path[i + 1]; L += Math.hypot(b[0] - a[0], b[1] - a[1]) || Math.abs(b[2] - a[2]); }
    const cap = Math.ceil(L / STEP) + 4;
    const mat = additive({ uTime: T, uOpacity: { value: 0 }, uHead: { value: 0 }, uLen: { value: L }, uSweep: { value: -1 }, uColor: { value: GOLD.clone() } }, CHEV_FRAG, CHEV_VERT, THREE.DoubleSide);
    const geo = this.chevGeo.clone();
    geo.setAttribute('aSeq', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.g.level.root.add(mesh);
    const leg: Leg = { def, mesh, mat, pts: [], seq: [], len: L, opacity: 0, sweep: -1, opened: false, announceAt: -1 };
    // placed now (a leg whose floor exists from the start), and again when it opens (one whose floor a fracture makes:
    // the Crown's wreck in the antechamber exists only once FR1 has fallen)
    this.place(leg, !def.when);
    return leg;
  }

  /** put the leg's marks on the floor of its memory (report the ones with no floor under them when `report`) */
  private place(l: Leg, report: boolean) {
    const def = l.def, w = this.g.level.collision;
    const path = def.path.map((p) => b2t(p[0], p[1], p[2]));
    const pts: THREE.Vector3[] = [], dirs: THREE.Vector3[] = [], seq: number[] = [], drops: boolean[] = [];
    let acc = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const seg = b.clone().sub(a);
      const L = Math.hypot(seg.x, seg.z) || seg.length();
      const drop = def.dropAt !== undefined && i === def.dropAt - 1;
      for (let s = i === 0 ? 0 : (STEP - (acc % STEP)) % STEP; s < L; s += STEP) {
        const q = a.clone().lerp(b, s / L);
        // on the real floor of that memory (stairs, ramps, rubble): the path's height is only a hint; over a drop the
        // marks hang in the air where the path says, tipped over the edge
        const gy = drop ? null : w.groundBelow(q.clone().setY(q.y + 1.3), 2.8, def.state);
        if (gy === null && !drop) { if (report) this.misses.push(`${def.id} @${q.x.toFixed(1)},${(-q.z).toFixed(1)},${q.y.toFixed(1)}`); continue; }
        if (gy !== null) q.y = gy + 0.05;
        pts.push(q); dirs.push(seg.clone().setY(0).normalize()); seq.push(acc + s); drops.push(drop);
      }
      acc += L;
    }
    const n = Math.min(pts.length, l.mesh.instanceMatrix.count);
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const attr = l.mesh.geometry.getAttribute('aSeq') as THREE.InstancedBufferAttribute;
    for (let i = 0; i < n; i++) {
      // the chevron's point along the way; a drop's marks tip over the edge
      const d = dirs[i];
      qt.setFromEuler(new THREE.Euler(drops[i] ? -0.9 : 0, Math.atan2(d.x, d.z) + Math.PI, 0, 'YXZ'));
      m.compose(pts[i], qt, one);
      l.mesh.setMatrixAt(i, m);
      attr.setX(i, seq[i]);
    }
    l.mesh.count = n;
    l.mesh.instanceMatrix.needsUpdate = true;
    attr.needsUpdate = true;
    l.pts = pts.slice(0, n); l.seq = seq.slice(0, n); l.len = acc;
    l.mat.uniforms.uLen.value = acc;
  }

  /** where along the leg she is (the nearest mark's distance along it) */
  private head(l: Leg) {
    const p = this.g.player.pos;
    let best = 0, bd = Infinity;
    for (let i = 0; i < l.pts.length; i++) {
      const d = l.pts[i].distanceToSquared(p);
      if (d < bd) { bd = d; best = l.seq[i]; }
    }
    return best;
  }

  private wants(l: Leg, objective: string | undefined, activeT: number): number {
    const g = this.g, d = l.def;
    if (d.objective !== objective || g.time.state !== d.state) return 0;
    if (d.when && !d.when.every((c) => g.objectives.met(c))) return 0;
    if (g.enemies.inCombat || !g.player.alive || g.paused || g.finisher.active || g.player.scripted) return 0;
    if (g.guidance === 'guided') return 1;
    if (d.essential) return 0.6;
    return activeT > GUIDE_STUCK_AFTER ? 0.5 : 0;
  }

  update(dt: number) {
    const g = this.g;
    const obj = g.objectives.current?.id, activeT = g.objectives.activeTime;
    this.active = [];
    let beacon: THREE.Vector3 | null = null, beaconW = 0, gapDef: GuideLeg['gap'] | null = null, gapW = 0;
    for (const l of this.legs) {
      const want = this.wants(l, obj, activeT);
      l.opacity += (want - l.opacity) * Math.min(1, dt * (want > l.opacity ? 2.2 : 3.5));
      if (want > 0) {
        this.active.push(l.def.id);
        if (!l.opened) {
          // the way opens: placed on the floor as it is now, said once, and one bright sweep runs out from her feet
          l.opened = true;
          this.opened.push(l.def.id);
          if (l.def.when) this.place(l, true);
          l.sweep = this.head(l);
          if (l.def.announce && (g.guidance === 'guided' || l.def.essential)) l.announceAt = g.t + (l.def.announce.delay ?? 0);
        }
        if (l.announceAt >= 0 && g.t >= l.announceAt) { l.announceAt = -1; g.hud.message(l.def.announce!.title, l.def.announce!.sub, 4.2); }
        if (l.def.beacon && want > beaconW) { beacon = b2t(...l.def.beacon); beaconW = want; }
        if (l.def.gap && want > gapW) { gapDef = l.def.gap; gapW = want; }
      }
      l.mesh.visible = l.opacity > 0.01;
      if (!l.mesh.visible) continue;
      const u = l.mat.uniforms;
      u.uOpacity.value = l.opacity;
      u.uHead.value += (this.head(l) - u.uHead.value) * Math.min(1, dt * 5);
      if (l.sweep >= 0) { l.sweep += dt * 14; if (l.sweep > l.len + 4) l.sweep = -1; }
      u.uSweep.value = l.sweep;
    }
    // the beacon: one at a time (the leg that wants it most)
    this.beaconOpacity += ((beacon ? beaconW : 0) - this.beaconOpacity) * Math.min(1, dt * 2.5);
    if (beacon) {
      const gy = g.level.collision.groundBelow(beacon.clone().setY(beacon.y + 1.3), 2.8, g.time.state);
      this.glyph.position.copy(beacon).setY((gy ?? beacon.y) + 0.06);
      this.column.position.copy(this.glyph.position);
    }
    const bo = this.beaconOpacity;
    this.glyph.visible = this.column.visible = bo > 0.01;
    this.glyphMat.uniforms.uOpacity.value = bo;
    // the column steps back when she stands in it (it is a sign from afar, not a wall of light in her face)
    const near = this.glyph.position.distanceTo(g.player.pos);
    this.columnMat.uniforms.uOpacity.value = bo * THREE.MathUtils.smoothstep(near, 2.5, 7);
    this.gapOpacity += ((gapDef ? gapW : 0) - this.gapOpacity) * Math.min(1, dt * 2);
    if (gapDef) {
      this.gap.position.copy(b2t(...gapDef.at));
      this.gap.rotation.set(0, THREE.MathUtils.degToRad(gapDef.yaw), 0);
      this.gap.scale.set(gapDef.w, gapDef.h, 1);
    }
    this.gap.visible = this.gapOpacity > 0.01;
    this.gapMat.uniforms.uOpacity.value = this.gapOpacity;
  }

  dispose() {
    for (const l of this.legs) { l.mesh.removeFromParent(); l.mesh.geometry.dispose(); l.mat.dispose(); }
    this.legs = [];
    for (const m of [this.glyph, this.column, this.gap]) { m.removeFromParent(); m.geometry.dispose(); }
    this.glyphMat.dispose(); this.columnMat.dispose(); this.gapMat.dispose();
    this.chevGeo.dispose();
  }
}
