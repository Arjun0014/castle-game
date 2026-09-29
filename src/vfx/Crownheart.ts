import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import { Platform } from '../platform/Platform';

/**
 * The Crownheart itself (Floor 3's `heart` marker): a faceted crystal hung in an iron cage over the arena, the heart of
 * the whole castle. Session 11 rebuilt it as living light:
 *
 *   - the crystal is a shader of energy flowing through it: domain-warped noise veins climbing through the facets, a
 *     second slower layer drifting across them, a tide that swells and ebbs — coloured on ONE fixed ramp (clotted
 *     blood → crimson → orange-amber → gold → hot yellow-white). Colour changes only because the energy under each
 *     facet runs hotter or cooler, never by cycling hues: the veins run gold while the troughs sit crimson, and every
 *     heartbeat (a double lub-dub) floods the whole crystal up the ramp for a moment;
 *   - an outer shell of counter-flowing veins (additive, fresnel) layers over it; embers peel off and rise;
 *   - it is the chamber's light: every crown light of the arena takes the heart's colour and breathes with its
 *     energy, and near it the ambient, the fill, the hero's own light, the fog and the exposure lean toward it
 *     (Game.applyHeartTone) — the room breathes with the heart; the Last Crown's glow takes its colour too;
 *   - the Last Crown's phases run it hotter and faster; her great casts make it SURGE (it draws in while she gathers,
 *     flares at the release); when she falls it convulses and shatters and the chamber goes dark.
 *
 * It never adds a light (a new light would recompile every lit program): it drives the level's own `crown` light specs.
 * Its materials are warmed with the floor (warmKit).
 */
const RAMP = [0x290102, 0x9e0808, 0xff3a0a, 0xff8c1e, 0xffd35c, 0xfff2c4].map((h) => new THREE.Color(h));
/** a colour on the heart's ramp (0 = clotted blood … 1 = gold … 1.25 = white-hot) */
export function heartRamp(h: number, out = new THREE.Color()) {
  const x = THREE.MathUtils.clamp(h, 0, 1.25) * 4;
  const i = Math.min(4, Math.floor(x));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], Math.min(1, x - i));
}

const NOISE = /* glsl */ `
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCTAVES; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
vec3 ramp(float h) {
  vec3 c0 = vec3(0.16, 0.005, 0.01), c1 = vec3(0.62, 0.03, 0.03), c2 = vec3(1.0, 0.23, 0.04), c3 = vec3(1.0, 0.55, 0.12), c4 = vec3(1.0, 0.83, 0.36), c5 = vec3(1.0, 0.95, 0.77);
  float x = clamp(h, 0.0, 1.25) * 4.0;
  if (x < 1.0) return mix(c0, c1, x);
  if (x < 2.0) return mix(c1, c2, x - 1.0);
  if (x < 3.0) return mix(c2, c3, x - 2.0);
  if (x < 4.0) return mix(c3, c4, x - 3.0);
  return mix(c4, c5, min(1.0, x - 4.0));
}
`;
const VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vWorld;
void main() { vObj = position; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
/** the crystal: flowing veins through flat facets */
const CORE_FRAG = /* glsl */ `
uniform float uTime, uBeat, uHeat, uSurge, uFlicker;
varying vec3 vObj; varying vec3 vWorld;
${NOISE}
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(n, v));
  float t = uTime;
  vec3 p = vObj * 0.55;
  vec3 rise = vec3(0.0, t * (0.24 + 0.2 * uHeat), 0.0);
  float warp = fbm(p * 1.15 - rise * 0.6 + vec3(0.0, 0.0, t * 0.05));
  float veins = 1.0 - abs(2.0 * fbm(p * 2.1 + warp * 1.7 - rise) - 1.0);
  veins = pow(veins, 3.2);
  float drift = fbm(p * 3.6 + vec3(t * 0.31, -t * 0.17, t * 0.23));
  float tide = 0.5 + 0.5 * sin(t * 0.37 + p.y * 1.4) * sin(t * 0.23 + 1.7 + p.x);
  // crimson troughs, amber flow, gold veins; the beats and surges push the whole crystal up the ramp for a moment
  float h = 0.08 + 0.55 * veins + 0.14 * drift + 0.12 * tide + 0.28 * uBeat + uHeat + 0.38 * uSurge;
  h += (1.0 - facing) * 0.1;
  vec3 col = ramp(h) * (0.42 + 1.05 * h);
  col += ramp(h + 0.2) * pow(facing, 6.0) * (0.1 + 0.35 * uBeat + 0.5 * uSurge);
  col *= uFlicker;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
/** the shell: slower veins drifting the other way, strongest at the silhouette */
const SHELL_FRAG = /* glsl */ `
uniform float uTime, uBeat, uHeat, uSurge, uFlicker, uOpacity;
varying vec3 vObj; varying vec3 vWorld;
${NOISE}
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 v = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(n, v)), 1.6);
  vec3 p = vObj * 0.4;
  float veins = 1.0 - abs(2.0 * fbm(p * 2.4 + vec3(uTime * 0.11, -uTime * 0.19, 0.0)) - 1.0);
  veins = pow(veins, 5.0);
  float h = 0.3 + 0.5 * veins + 0.25 * uBeat + uHeat + 0.3 * uSurge;
  vec3 col = ramp(h) * (0.45 + 1.2 * veins + 0.4 * uBeat);
  float a = uOpacity * (0.08 + 0.45 * rim + 0.45 * veins * rim) * uFlicker;
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface CrownLight { intensity: number; color: THREE.Color; pos: THREE.Vector3; kind: string; range: number }

export class Crownheart {
  root = new THREE.Group();
  private core: THREE.Mesh;
  private shell: THREE.Mesh;
  private halo: THREE.Mesh;
  private bands: THREE.Mesh[] = [];
  private coreMat: THREE.ShaderMaterial;
  private shellMat: THREE.ShaderMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private bandMat: THREE.MeshStandardMaterial;
  private uniforms = { uTime: { value: 0 }, uBeat: { value: 0 }, uHeat: { value: 0 }, uSurge: { value: 0 }, uFlicker: { value: 1 }, uOpacity: { value: 1 } };
  private t = 0;
  private phase = 1;
  /** the heart's current light (the colour its chamber is lit with) and energy (0 … ~1.6) */
  color = new THREE.Color(0xff5a22);
  energy = 0.6;
  /** great casts: a charge drawn in toward a release, and the flare after it */
  private surgeT = 0;
  private chargeFor = 0;
  private chargeT = 0;
  private heat = 0;
  private heatWant = 0;
  private rate = 0.85;
  /** its lights: the one at the heart and every crown light of the chamber, with their authored values */
  private lights: { l: CrownLight; i: number; c: THREE.Color; w: number }[] = [];
  /** dying: seconds since the Last Crown fell (-1 = alive) */
  private dying = -1;
  broken = false;
  private state: TimeState = 'PRESENT';
  private emberAcc = 0;
  private _c = new THREE.Color();

  constructor(private g: Game, at: THREE.Vector3) {
    this.root.position.copy(at);
    // phones: one octave less of noise (the crystal is a few hundred pixels across)
    const defines = { OCTAVES: Platform.handheld ? 3 : 4 };
    this.coreMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: CORE_FRAG, defines });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 2), this.coreMat);
    this.core.scale.set(1, 1.35, 1);
    this.shellMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: SHELL_FRAG, defines,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    });
    this.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.75, 1), this.shellMat);
    this.shell.scale.set(1, 1.3, 1);
    // a soft halo facing the camera (a radial gradient drawn into a small data texture)
    const n = 64, d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const v = Math.max(0, 1 - r);
      d.set([255, 255, 255, Math.round(255 * v * v * v)], (y * n + x) * 4);
    }
    const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.haloMat = new THREE.MeshBasicMaterial({ map: tex, color: this.color.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), this.haloMat);
    this.halo.renderOrder = 3;
    this.bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.55, metalness: 0.85 });
    for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0.4], [Math.PI / 2, -0.9]]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.14, 6, 40), this.bandMat);
      b.rotation.set(rx, 0, rz);
      b.castShadow = false;
      this.bands.push(b);
      this.root.add(b);
    }
    this.root.add(this.core, this.shell, this.halo);
    for (const m of [this.core, this.shell, this.halo]) m.frustumCulled = false;
    g.scene.add(this.root);
    // its lights: the crown light at the heart (full) and every crown light of the chamber within 34 m (they take its
    // colour and breathe with it, a little less the farther out they hang)
    for (const l of g.level.lights as unknown as CrownLight[]) {
      if (l.kind !== 'crown') continue;
      const dist = l.pos.distanceTo(at);
      if (dist > 34) continue;
      this.lights.push({ l, i: l.intensity, c: l.color.clone(), w: dist < 3 ? 1 : THREE.MathUtils.clamp(1 - (dist - 3) / 40, 0.45, 0.85) });
    }
  }

  /** the Last Crown's phase (1..3): hotter, faster */
  setPhase(p: number) {
    if (p > this.phase) this.surge(1.2);
    this.phase = p;
    this.heatWant = p >= 3 ? 0.26 : p === 2 ? 0.13 : 0;
  }
  /** a great cast gathers: the heart draws in toward its release (in `seconds`) */
  charge(seconds: number) { this.chargeFor = Math.max(0.2, seconds); this.chargeT = 0; }
  /** a great cast lands / a phase breaks: a flare (0..1.5) that dies away over ~1.2 s */
  surge(k: number) { this.surgeT = Math.max(this.surgeT, k); this.chargeFor = 0; }

  /** she has fallen: it convulses, then breaks */
  shatter() { if (this.dying < 0) this.dying = 0; }

  setState(st: TimeState) {
    this.state = st;
    // the ruin: the cage is broken and tilted, one band gone
    this.bands[1].visible = st === 'PAST';
    this.bands[0].rotation.z = st === 'PAST' ? 0 : 0.35;
    this.bands[2].rotation.z = st === 'PAST' ? -0.9 : -1.4;
  }

  /** how much the heart owns the light where `p` stands (1 in the arena, fading out over the threshold) */
  influence(p: THREE.Vector3) {
    if (this.broken) return 0;
    const d = Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
    return THREE.MathUtils.clamp(1 - (d - 20) / 22, 0, 1) * (Math.abs(p.y - this.root.position.y) < 30 ? 1 : 0);
  }

  update(dt: number) {
    if (this.broken) return;
    this.t += dt;
    this.heat += (this.heatWant - this.heat) * Math.min(1, dt * 0.8);
    const rateWant = this.phase === 3 ? 1.45 : this.phase === 2 ? 1.15 : 0.85;
    this.rate += (rateWant - this.rate) * Math.min(1, dt * 0.5);
    // lub-dub: two quick swells per beat; between beats the light sags, then slowly builds again
    const ph = (this.t * this.rate) % 1;
    let beat = Math.exp(-Math.pow((ph - 0.08) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));
    const build = 0.18 * ph;
    // a gathering cast draws the heart in (dimmer), then it climbs toward the release; the release flares
    let charge = 0;
    if (this.chargeFor > 0) {
      this.chargeT += dt;
      const k = Math.min(1, this.chargeT / this.chargeFor);
      charge = k < 0.35 ? -0.25 * (k / 0.35) : -0.25 + 1.15 * ((k - 0.35) / 0.65);
      if (this.chargeT > this.chargeFor + 0.6) this.chargeFor = 0;
    }
    this.surgeT = Math.max(0, this.surgeT - dt * 0.9);
    const surge = this.surgeT * this.surgeT + Math.max(0, charge);
    let flicker = 1;
    let spin = 0.12 + this.heat * 0.3;
    if (this.dying >= 0) {
      this.dying += dt;
      beat = 0.5 + 0.5 * Math.sin(this.dying * (8 + this.dying * 10));
      flicker = 0.55 + 0.45 * Math.sin(this.dying * 31) * Math.sin(this.dying * 17 + 1);
      spin = 0.4 + this.dying;
      this.root.position.x += (Math.random() - 0.5) * 0.06 * this.dying;
      if (this.dying > 2.6) { this.breakApart(); return; }
    }
    // the slow tides of the whole crystal (two incommensurate swells: it never repeats exactly)
    const tide = 0.5 + 0.28 * Math.sin(this.t * 0.37) + 0.22 * Math.sin(this.t * 0.61 + 1.3);
    const u = this.uniforms;
    u.uTime.value = this.t;
    u.uBeat.value = beat;
    u.uHeat.value = this.heat + (this.state === 'PAST' ? 0.06 : 0) + Math.min(0, charge) * 0.6;
    u.uSurge.value = surge;
    u.uFlicker.value = flicker;
    u.uOpacity.value = this.state === 'PAST' ? 0.8 : 1;
    const s = 1 + beat * 0.07 + surge * 0.05;
    this.core.scale.set(s, 1.35 * s, s);
    this.shell.scale.set(s * 1.03, 1.3 * s * 1.03, s * 1.03);
    this.core.rotation.y += dt * spin;
    this.shell.rotation.y -= dt * spin * 0.6;
    this.bands.forEach((b, i) => { b.rotation.y += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1); });
    // the light it gives: the crystal's mean heat on the same ramp (crimson in the troughs, amber / gold on the beats
    // and the surges), and its strength
    this.energy = Math.max(0.05, (0.42 + 0.3 * tide + 0.55 * beat + build + 0.9 * surge + this.heat * 0.8 + Math.min(0, charge)) * flicker);
    // troughs sit crimson, the tide carries it through orange, a beat on a high tide touches gold; surges go hot yellow
    heartRamp(0.36 + 0.28 * tide + 0.42 * beat + this.heat + 0.35 * surge + Math.min(0, charge) * 0.5, this.color);
    this.haloMat.color.copy(this.color);
    this.haloMat.opacity = ((this.state === 'PAST' ? 0.35 : 0.5) + beat * 0.3 + surge * 0.3) * flicker;
    this.halo.quaternion.copy(this.g.camera.quaternion);
    for (const x of this.lights) {
      x.l.intensity = x.i * THREE.MathUtils.lerp(1, 0.45 + 0.75 * this.energy, x.w);
      x.l.color.copy(x.c).lerp(this.color, 0.75 * x.w);
    }
    // the Last Crown's glow takes the heart's colour (her silhouette is drawn by it)
    const boss = this.g.enemies?.boss;
    if (boss?.alive && boss.arch.id === 'last_crown') {
      for (const m of boss.materials as THREE.MeshStandardMaterial[]) if (m.emissiveMap) m.emissive.copy(this.color).multiplyScalar(0.55 + 0.45 * this.energy);
    }
    // embers peel off the crystal and rise, thicker on the beats and the surges
    this.emberAcc += dt * (4 + beat * 10 + surge * 30);
    const at = this.root.position;
    while (this.emberAcc >= 1) {
      this.emberAcc -= 1;
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.2;
      const from = new THREE.Vector3(at.x + Math.cos(a) * r, at.y + (Math.random() - 0.5) * 4, at.z + Math.sin(a) * r);
      const hot = Math.random() < 0.35 + 0.3 * beat;
      this.g.fx.emit(from, new THREE.Vector3(Math.cos(a) * 0.5, 1.2 + Math.random() * 1.5, Math.sin(a) * 0.5), heartRamp(hot ? 0.9 + Math.random() * 0.3 : 0.4 + Math.random() * 0.3, this._c).getHex(), 1.6 + Math.random() * 1.4, 0.04 + Math.random() * 0.05, -0.25, 0.2);
    }
  }

  private breakApart() {
    const g = this.g, at = this.root.position.clone();
    this.broken = true;
    this.root.visible = false;
    for (let i = 0; i < 260; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 14);
      g.fx.emit(at.clone().add(v.clone().multiplyScalar(0.12)), v, heartRamp(0.4 + Math.random() * 0.85, this._c).getHex(), 1.2 + Math.random() * 1.4, 0.08 + Math.random() * 0.12, 6);
    }
    g.rig.addShake(0.9);
    g.hud.flash('#ffe8d0', 0.8);
    g.audio.play('shift_boom', { rate: 0.6, vol: 1.3 });
    g.audio.play('rubble', { vol: 1.2 });
    // the chamber's red light dies away
    const lights = (g.level.lights as unknown as CrownLight[]).filter((l) => l.kind === 'crown' && l.pos.distanceTo(at) < 40);
    const from = lights.map((l) => l.intensity);
    let k = 0;
    const fade = () => { k += 0.02; lights.forEach((l, i) => { l.intensity = from[i] * Math.max(0.08, 1 - k); }); if (k < 1) g.schedule(0.05, fade); };
    fade();
  }

  /** its programs for the loading-screen warm-up */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const kit = new THREE.Group();
    kit.add(new THREE.Mesh(this.core.geometry, this.coreMat), new THREE.Mesh(this.shell.geometry, this.shellMat), new THREE.Mesh(this.halo.geometry, this.haloMat), new THREE.Mesh(this.bands[0].geometry, this.bandMat));
    kit.position.copy(at).add(new THREE.Vector3(0, 2, -4));
    kit.traverse((o) => { o.frustumCulled = false; });
    return { objects: [kit], dispose: () => kit.removeFromParent() };
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.coreMat.dispose(); this.shellMat.dispose(); this.haloMat.map?.dispose(); this.haloMat.dispose(); this.bandMat.dispose();
  }
}

/**
 * Abysses read as abysses (session 9 playtest: "the red centre looks like normal ground but I fall through it"):
 * embers rise out of every drop near the hero (`abyss` markers of the current memory), from well below the rim,
 * drifting up and fading — a hole is announced from across the room before anyone walks into it.
 */
export class AbyssEmbers {
  private list: { x: number; y: number; z: number; sx: number; sz: number; state: string; ring: number; acc: number }[] = [];
  constructor(private g: Game) {
    for (const m of g.level.markersOf('abyss')) {
      this.list.push({ x: m.pos.x, y: m.pos.y, z: m.pos.z, sx: m.props.sx ?? 4, sz: m.props.sy ?? 4, state: m.props.state ?? 'BOTH', ring: m.props.ring ?? 0, acc: 0 });
    }
  }
  update(dt: number) {
    const g = this.g, p = g.player.pos, st = g.time.state;
    let budget = 60 * dt;
    for (const a of this.list) {
      if (a.state !== 'BOTH' && a.state !== st) continue;
      const dx = Math.max(0, Math.abs(p.x - a.x) - a.sx / 2), dz = Math.max(0, Math.abs(p.z - a.z) - a.sz / 2);
      if (Math.hypot(dx, dz) > 26 || Math.abs(p.y - a.y) > 22) continue;
      a.acc += dt * Math.min(24, 3 + a.sx * a.sz * 0.08);
      while (a.acc >= 1 && budget > 0) {
        a.acc -= 1; budget--;
        let x = a.x + (Math.random() - 0.5) * a.sx, z = a.z + (Math.random() - 0.5) * a.sz;
        if (a.ring > 0) {
          // a ring abyss (the arena's surround): only outside the platform
          const ang = Math.random() * Math.PI * 2, r = a.ring + 1.5 + Math.random() * 10;
          x = a.x + Math.cos(ang) * r; z = a.z + Math.sin(ang) * r;
        }
        const from = new THREE.Vector3(x, a.y - 2 - Math.random() * 5, z);
        const hot = Math.random() < 0.3;
        g.fx.emit(from, new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4), hot ? 0xffb060 : 0xff4a18, 2.2 + Math.random() * 1.6, 0.035 + Math.random() * 0.05, -0.35, 0.25);
      }
      if (a.acc > 4) a.acc = 4;
    }
  }
}
