import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';
import type { CollisionWorld } from '../game/Physics';

/**
 * Atmosphere: height fog with drifting smoke noise (global fog-chunk patch), sky dome, moonlight shafts
 * through the Present's roof holes, dust inside the shafts, and low smoke wisps around the player.
 *
 * The fog patch works for every built-in material: the fog chunks are replaced once, and the shared
 * uniforms below are attached by `injectAtmosphere` (Material.prototype.onBeforeCompile default, and
 * explicitly by materials with their own onBeforeCompile — see Materials.applyShiftDissolve).
 */
export const ATMO_UNIFORMS = {
  uAtmoTime: { value: 0 },
  /** x: mist base height (world y), y: falloff per metre, z: mist density, w: smoke-noise amount (0..1) */
  uAtmoHeight: { value: new THREE.Vector4(0, 0.3, 0, 0) },
};

export function injectAtmosphere(shader: { uniforms: Record<string, THREE.IUniform> }) {
  shader.uniforms.uAtmoTime = ATMO_UNIFORMS.uAtmoTime;
  shader.uniforms.uAtmoHeight = ATMO_UNIFORMS.uAtmoHeight;
}

let installed = false;
/** Patch the fog chunks (call before any material compiles). */
export function installAtmosphereFog() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  // world position from the view-space position (valid for meshes, skinned, instanced, points and sprites)
  C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  uniform float uAtmoTime;
  uniform vec4 uAtmoHeight;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  float atmoHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
  float atmoNoise( vec3 x ) {
    vec3 i = floor( x ); vec3 f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( mix( atmoHash( i ), atmoHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( atmoHash( i + vec3( 0, 1, 0 ) ), atmoHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                mix( mix( atmoHash( i + vec3( 0, 0, 1 ) ), atmoHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( atmoHash( i + vec3( 0, 1, 1 ) ), atmoHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
  }
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  if ( uAtmoHeight.z > 0.0 ) {
    // analytic integral of density a·e^(-b(y-base)) along the camera→fragment ray
    vec3 atmoRay = vFogWorld - cameraPosition;
    float atmoLen = length( atmoRay );
    float atmoB = uAtmoHeight.y;
    float atmoBdy = atmoB * atmoRay.y;
    float atmoH0 = exp( - atmoB * ( cameraPosition.y - uAtmoHeight.x ) );
    float atmoI = abs( atmoBdy ) > 1e-3 ? atmoH0 * ( 1.0 - exp( - atmoBdy ) ) / atmoBdy : atmoH0;
    float atmoN = atmoNoise( vFogWorld * 0.16 + vec3( uAtmoTime * 0.06, uAtmoTime * 0.015, uAtmoTime * 0.04 ) );
    atmoN = mix( 1.0, 0.25 + 1.5 * atmoN, uAtmoHeight.w );
    float atmoF = 1.0 - exp( - uAtmoHeight.z * atmoLen * min( atmoI, 5.0 ) * atmoN );
    fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - atmoF );
  }
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
  const proto = THREE.Material.prototype as unknown as { onBeforeCompile: (s: { uniforms: Record<string, THREE.IUniform> }) => void };
  proto.onBeforeCompile = function (shader) { injectAtmosphere(shader); };
}

// ---------------------------------------------------------------------------------------------------
export interface AtmoPreset {
  mistDensity: number; mistFalloff: number; mistNoise: number;
  skyZenith: THREE.Color; skyHorizon: THREE.Color; skyGlow: THREE.Color; stars: number; moon: number;
  shafts: number; dust: number; smoke: number;
}

export const ATMO: Record<TimeState, AtmoPreset> = {
  PAST: {
    mistDensity: 0.018, mistFalloff: 0.22, mistNoise: 0.45,
    skyZenith: new THREE.Color(0x1c1430), skyHorizon: new THREE.Color(0x8a4a2a), skyGlow: new THREE.Color(0xff9a50),
    stars: 0.15, moon: 0, shafts: 0, dust: 0.35, smoke: 0.25,
  },
  PRESENT: {
    mistDensity: 0.085, mistFalloff: 0.32, mistNoise: 0.85,
    skyZenith: new THREE.Color(0x060910), skyHorizon: new THREE.Color(0x1b2536), skyGlow: new THREE.Color(0x6a84a8),
    stars: 1, moon: 1, shafts: 1, dust: 1, smoke: 1,
  },
};


const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FS = `varying vec3 vDir;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uMoonDir; uniform float uStars; uniform float uMoon; uniform float uTime;
float h1(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(-0.05, 0.55, up));
  float md = max(dot(d, normalize(uMoonDir)), 0.0);
  col += uGlow * pow(md, 12.0) * 0.35 + uGlow * pow(max(1.0 - abs(d.y), 0.0), 6.0) * 0.12;
  // stars
  vec3 sp = floor(d * 380.0);
  float s = h1(sp);
  float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
  col += vec3(0.75, 0.82, 1.0) * step(0.9975, s) * smoothstep(0.05, 0.35, d.y) * uStars * tw * 0.9;
  // moon disc + halo
  float disc = smoothstep(0.99955, 0.99975, md);
  col = mix(col, vec3(0.86, 0.9, 1.0) * 1.6, disc * uMoon);
  col += vec3(0.5, 0.6, 0.8) * pow(md, 400.0) * 0.6 * uMoon;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SHAFT_VS = `varying float vV; varying vec3 vN; varying vec3 vW;
void main(){ vV = uv.y; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHAFT_FS = `varying float vV; varying vec3 vN; varying vec3 vW;
uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
float hh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float nz(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hh(i), hh(i+vec3(1,0,0)), f.x), mix(hh(i+vec3(0,1,0)), hh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hh(i+vec3(0,0,1)), hh(i+vec3(1,0,1)), f.x), mix(hh(i+vec3(0,1,1)), hh(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 v = normalize(cameraPosition - vW);
  float facing = pow(abs(dot(normalize(vN), v)), 1.6);
  float along = pow(1.0 - vV, 0.9) * smoothstep(0.0, 0.08, vV) * (1.0 - smoothstep(0.82, 1.0, vV));
  float n = 0.55 + 0.45 * nz(vW * vec3(0.9, 0.35, 0.9) + vec3(0.0, uTime * 0.25, uTime * 0.08));
  float near = smoothstep(0.6, 3.0, length(cameraPosition - vW));
  float a = uIntensity * facing * along * n * near;
  gl_FragColor = vec4(uColor * a, a);
}`;

const DUST_VS = `attribute vec3 seed; uniform float uTime; uniform float uSize; varying float vA;
void main(){
  vec3 p = position;
  float t = uTime * (0.05 + seed.x * 0.08) + seed.y * 6.283;
  p += vec3(sin(t) * 0.35, sin(t * 0.7 + seed.z * 4.0) * 0.25, cos(t * 0.9) * 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.6 + seed.z) * 300.0 / -mv.z;
  vA = (0.45 + 0.55 * sin(uTime * (0.6 + seed.x) + seed.y * 20.0)) * smoothstep(0.4, 2.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = `uniform vec3 uColor; uniform float uIntensity; varying float vA;
void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)) * vA * uIntensity; gl_FragColor = vec4(uColor * a, a); }`;

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const x = 34 + Math.random() * 60, y = 34 + Math.random() * 60, r = 14 + Math.random() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Wisp { sprite: THREE.Sprite; vel: THREE.Vector3; life: number; max: number; spin: number; size: number; }

export class Atmosphere {
  sky: THREE.Mesh;
  private skyU: Record<string, THREE.IUniform>;
  shafts = new THREE.Group();
  private shaftMat: THREE.ShaderMaterial;
  private dustMat: THREE.ShaderMaterial;
  private wisps: Wisp[] = [];
  private wispPool: THREE.Sprite[] = [];
  private smokeTex = smokeTexture();
  private smokeMat: THREE.SpriteMaterial;
  private cur: AtmoPreset = { ...ATMO.PRESENT };
  private from: AtmoPreset = ATMO.PRESENT;
  private to: AtmoPreset = ATMO.PRESENT;
  private k = 1;
  private mistBase = 0;
  smokeColor = new THREE.Color(0x2a323c);

  /** `skyMoonDir`: where the moon disc is drawn (lower than the near-vertical shadow light, so it can be seen). */
  constructor(private scene: THREE.Scene, skyMoonDir: THREE.Vector3) {
    this.skyU = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uMoonDir: { value: skyMoonDir.clone().normalize() }, uStars: { value: 1 }, uMoon: { value: 1 }, uTime: { value: 0 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.shaftMat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS,
      uniforms: { uColor: { value: new THREE.Color(0x9fb8e8) }, uIntensity: { value: 0.7 }, uTime: ATMO_UNIFORMS.uAtmoTime },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VS, fragmentShader: DUST_FS,
      uniforms: { uColor: { value: new THREE.Color(0xc8d8f0) }, uIntensity: { value: 0.8 }, uTime: ATMO_UNIFORMS.uAtmoTime, uSize: { value: 0.035 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.smokeMat = new THREE.SpriteMaterial({ map: this.smokeTex, color: this.smokeColor, transparent: true, depthWrite: false, opacity: 0, fog: true });
    scene.add(this.shafts);
  }

  /** Build Present moon shafts from the roof holes, each clipped to where the moonlight lands (Present collision). */
  buildShafts(world: CollisionWorld, moonDir: THREE.Vector3, holes: [number, number, number, number, number][]) {
    const down = moonDir.clone().normalize().negate();
    for (const [x0, x1, y0, y1, z] of holes) {
      // three.js: (x, z_blender, -y_blender); inset the rim so the prism starts inside the opening
      const top = [[x0 + 0.3, y0 + 0.3], [x1 - 0.3, y0 + 0.3], [x1 - 0.3, y1 - 0.3], [x0 + 0.3, y1 - 0.3]]
        .map(([x, y]) => new THREE.Vector3(x, z + 0.4, -y));
      const center = top.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
      const lens: number[] = [];
      for (const p of [...top, center]) {
        const hit = world.raycast(p.clone().addScaledVector(down, 0.9), down, 40, 'PRESENT');
        lens.push(hit ? hit.distance + 0.9 : 22);
      }
      lens.sort((a, b) => a - b);
      const len = Math.min(24, lens[2]);
      const bottom = top.map((p) => p.clone().addScaledVector(down, len));
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = top[i], b = top[(i + 1) % 4], c = bottom[(i + 1) % 4], d = bottom[i];
        const o = pos.length / 3;
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const shaft = new THREE.Mesh(g, this.shaftMat);
      shaft.renderOrder = 5;
      this.shafts.add(shaft);
      // dust motes inside the prism
      const n = Math.round(Math.min(160, 18 * len * Math.sqrt((x1 - x0) * (y1 - y0)) / 6));
      const dp = new Float32Array(n * 3), ds = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random(), v = Math.random(), h = Math.pow(Math.random(), 0.8);
        const p = top[0].clone().lerp(top[1], u).lerp(top[3].clone().lerp(top[2], u), v).addScaledVector(down, h * len);
        dp.set([p.x, p.y, p.z], i * 3);
        ds.set([Math.random(), Math.random(), Math.random()], i * 3);
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dg.setAttribute('seed', new THREE.BufferAttribute(ds, 3));
      const dust = new THREE.Points(dg, this.dustMat);
      dust.renderOrder = 6;
      this.shafts.add(dust);
    }
  }

  /** Floor change: free the old floor's shaft/dust geometry and drop live wisps. */
  clearShafts() {
    for (const o of [...this.shafts.children]) { (o as THREE.Mesh).geometry.dispose(); this.shafts.remove(o); }
    for (const w of this.wisps) { this.scene.remove(w.sprite); this.wispPool.push(w.sprite); }
    this.wisps = [];
  }

  /** A smoke sprite for the loading-screen shader warm-up. */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const sp = this.wispPool.pop() ?? new THREE.Sprite(this.smokeMat.clone());
    sp.position.copy(at).setY(at.y + 1);
    sp.material.opacity = 0.3;
    return { objects: [sp], dispose: () => { sp.removeFromParent(); this.wispPool.push(sp); } };
  }

  setState(state: TimeState, instant: boolean) {
    this.from = { ...this.cur, skyZenith: this.cur.skyZenith.clone(), skyHorizon: this.cur.skyHorizon.clone(), skyGlow: this.cur.skyGlow.clone() };
    this.to = ATMO[state];
    this.k = instant ? 1 : 0;
    if (instant) this.blend(1);
  }

  private blend(k: number) {
    const a = this.from, b = this.to, c = this.cur;
    const L = THREE.MathUtils.lerp;
    c.mistDensity = L(a.mistDensity, b.mistDensity, k); c.mistFalloff = L(a.mistFalloff, b.mistFalloff, k); c.mistNoise = L(a.mistNoise, b.mistNoise, k);
    c.skyZenith = a.skyZenith.clone().lerp(b.skyZenith, k); c.skyHorizon = a.skyHorizon.clone().lerp(b.skyHorizon, k); c.skyGlow = a.skyGlow.clone().lerp(b.skyGlow, k);
    c.stars = L(a.stars, b.stars, k); c.moon = L(a.moon, b.moon, k); c.shafts = L(a.shafts, b.shafts, k); c.dust = L(a.dust, b.dust, k); c.smoke = L(a.smoke, b.smoke, k);
  }

  /** `groundY`: the player's feet when grounded (the mist settles to the floor the player stands on). */
  update(dt: number, t: number, camera: THREE.Camera, focus: THREE.Vector3, groundY: number | null, fogColor: THREE.Color) {
    if (this.k < 1) { this.k = Math.min(1, this.k + dt / 1.4); const s = this.k * this.k * (3 - 2 * this.k); this.blend(s); }
    const c = this.cur;
    ATMO_UNIFORMS.uAtmoTime.value = t;
    if (groundY !== null) this.mistBase += (groundY - 0.4 - this.mistBase) * Math.min(1, dt * 0.8);
    ATMO_UNIFORMS.uAtmoHeight.value.set(this.mistBase, c.mistFalloff, c.mistDensity, c.mistNoise);
    this.sky.position.copy(camera.position);
    const su = this.skyU;
    (su.uZenith.value as THREE.Color).copy(c.skyZenith);
    (su.uHorizon.value as THREE.Color).copy(c.skyHorizon);
    (su.uGlow.value as THREE.Color).copy(c.skyGlow);
    su.uStars.value = c.stars; su.uMoon.value = c.moon; su.uTime.value = t;
    this.shaftMat.uniforms.uIntensity.value = 0.7 * c.shafts;
    this.dustMat.uniforms.uIntensity.value = 0.8 * c.dust * c.shafts;
    this.shafts.visible = c.shafts > 0.01;
    this.updateSmoke(dt, focus, fogColor);
  }

  /** Low smoke wisps drifting around the player (Present-weighted). */
  private updateSmoke(dt: number, focus: THREE.Vector3, fogColor: THREE.Color) {
    const want = Math.round(14 * this.cur.smoke);
    if (this.wisps.length < want && Math.random() < dt * 6) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 11;
      const sprite = this.wispPool.pop() ?? new THREE.Sprite(this.smokeMat.clone());
      sprite.material.rotation = 0;
      const size = 3 + Math.random() * 4;
      sprite.position.set(focus.x + Math.cos(a) * r, focus.y + 0.2 + Math.random() * 1.4, focus.z + Math.sin(a) * r);
      sprite.scale.set(size, size * 0.55, 1);
      sprite.renderOrder = 4;
      this.scene.add(sprite);
      const life = 9 + Math.random() * 8;
      this.wisps.push({ sprite, vel: new THREE.Vector3(0.25 + Math.random() * 0.2, 0.02, 0.12 - Math.random() * 0.24), life, max: life, spin: (Math.random() - 0.5) * 0.08, size });
    }
    const tint = this.smokeColor.clone().lerp(fogColor, 0.35);
    for (const w of this.wisps) {
      w.life -= dt;
      w.sprite.position.addScaledVector(w.vel, dt);
      const m = w.sprite.material;
      m.rotation += w.spin * dt;
      const k = w.life / w.max;
      const env = Math.min(1, (1 - k) / 0.25) * Math.min(1, k / 0.3);
      const far = w.sprite.position.distanceTo(focus);
      m.opacity = env * 0.42 * this.cur.smoke * THREE.MathUtils.clamp((far - 1.2) / 2.5, 0, 1);
      m.color.copy(tint);
      if (w.life <= 0 || far > 22) { this.scene.remove(w.sprite); this.wispPool.push(w.sprite); w.life = 0; }
    }
    this.wisps = this.wisps.filter((w) => w.life > 0);
  }
}
