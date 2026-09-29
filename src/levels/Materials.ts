import * as THREE from 'three';
import { injectAtmosphere, ATMO_UNIFORMS } from '../vfx/Atmosphere';
import textureLibrary from '../data/textureLibrary.json';

export type TimeState = 'PAST' | 'PRESENT';

interface MatDef {
  tex?: keyof typeof textureLibrary;
  color?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  normalScale?: number;
  aoIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  unlit?: boolean;
}

/** Runtime material library. Keys match Blender material names in floor01.glb.
 *  Every key defines a Past and a Present variant; SHARED meshes swap on shift. */
const DEFS: Record<string, { PAST: MatDef; PRESENT: MatDef }> = {
  stone_wall: { PAST: { tex: 'stone_wall', color: 0xf2e6d2 }, PRESENT: { tex: 'stone_wall', color: 0x9aa097, roughness: 1.0 } },
  stone_block: { PAST: { tex: 'stone_block', color: 0xe9ddc8 }, PRESENT: { tex: 'stone_block', color: 0x8e958c } },
  marble: { PAST: { tex: 'marble', color: 0xf4ead8, roughness: 0.7 }, PRESENT: { tex: 'marble', color: 0x8a8a80, roughness: 1.0 } },
  rock: { PAST: { tex: 'rock', color: 0xb8aa98 }, PRESENT: { tex: 'rock', color: 0x9aa39a } },
  terrain: { PAST: { tex: 'terrain', color: 0xb09a80 }, PRESENT: { tex: 'terrain', color: 0xc4ccbc } },
  ward_ground: { PAST: { tex: 'stone_block', color: 0xd9ccb4 }, PRESENT: { tex: 'terrain', color: 0xb8c2b0 } },
  timber: { PAST: { tex: 'wood_rough', color: 0x9a7a5a }, PRESENT: { tex: 'wood_moss', color: 0xb0b8a0 } },
  wood_fine: { PAST: { tex: 'wood_fine', color: 0x8a5a3a, roughness: 0.6 }, PRESENT: { tex: 'wood_moss', color: 0xa0a890 } },
  wood_rough: { PAST: { tex: 'wood_rough', color: 0xc8b090 }, PRESENT: { tex: 'wood_rough', color: 0x8a8a78 } },
  wood_planks: { PAST: { tex: 'wood_planks', color: 0xe0d0b8 }, PRESENT: { tex: 'wood_planks', color: 0x8a8a7c } },
  wood_moss: { PAST: { tex: 'wood_moss', color: 0xc0c8b0 }, PRESENT: { tex: 'wood_moss', color: 0xc0c8b0 } },
  wood_door: { PAST: { tex: 'wood_door', color: 0xb49070 }, PRESENT: { tex: 'wood_door', color: 0x7a7a6c } },
  iron: { PAST: { tex: 'iron', color: 0xb8b0a8, metalness: 1.0 }, PRESENT: { tex: 'rust', color: 0xa08070 } },
  rust: { PAST: { tex: 'rust', color: 0xc0a090 }, PRESENT: { tex: 'rust', color: 0xa89080 } },
  rust_plate: { PAST: { tex: 'rust_plate' }, PRESENT: { tex: 'rust_plate', color: 0xb0a090 } },
  iron_rust: { PAST: { tex: 'iron', color: 0x9a948c, metalness: 1.0 }, PRESENT: { tex: 'rust', color: 0x9a8070 } },
  fabric_royal: { PAST: { tex: 'fabric_royal', color: 0xffffff, side: THREE.DoubleSide }, PRESENT: { tex: 'fabric_royal', color: 0x4a3a3a, side: THREE.DoubleSide } },
  fabric_banner: { PAST: { tex: 'fabric_royal', color: 0xffffff, side: THREE.DoubleSide }, PRESENT: { tex: 'fabric_royal', color: 0x3a2e2e, side: THREE.DoubleSide } },
  fabric_gold: { PAST: { tex: 'fabric_gold', side: THREE.DoubleSide }, PRESENT: { tex: 'fabric_gold', color: 0x6a6258, side: THREE.DoubleSide } },
  fabric_linen: { PAST: { tex: 'fabric_linen', color: 0xf0d8a8, side: THREE.DoubleSide }, PRESENT: { tex: 'fabric_linen', color: 0x8a8070, side: THREE.DoubleSide } },
  bone: { PAST: { color: 0xc8bea8, roughness: 0.8 }, PRESENT: { color: 0xa8a290, roughness: 0.9 } },
  candle: { PAST: { color: 0xeee2c4, roughness: 0.6 }, PRESENT: { color: 0x9a927c } },
  fx_ember: { PAST: { color: 0x1a0800, emissive: 0xc83a0a, emissiveIntensity: 0.75 }, PRESENT: { color: 0x111111 } },
  fx_flame: { PAST: { color: 0xffaa55, emissive: 0xffa040, emissiveIntensity: 4, unlit: true }, PRESENT: { color: 0x222222 } },
  fx_crown: { PAST: { color: 0x220400, emissive: 0xff4418, emissiveIntensity: 3.0, unlit: true }, PRESENT: { color: 0x220400, emissive: 0xff5a22, emissiveIntensity: 4.0, unlit: true } },
  fx_sigil: { PAST: { color: 0x300000, emissive: 0xc01818, emissiveIntensity: 1.6 }, PRESENT: { color: 0x300000, emissive: 0xd02020, emissiveIntensity: 1.8 } },
  fx_fissure: { PAST: { color: 0x001018, emissive: 0x30c8ff, emissiveIntensity: 1.8 }, PRESENT: { color: 0x001018, emissive: 0x40d8ff, emissiveIntensity: 2.2 } },
  fx_void: { PAST: { color: 0x000000, unlit: true }, PRESENT: { color: 0x000000, unlit: true } },
  /** the Crownheart's crystal roots (Floor 3): a deep red glow, never the near-white of fx_crown */
  fx_root: { PAST: { color: 0x1a0402, emissive: 0xb01a0c, emissiveIntensity: 1.3, roughness: 0.3 }, PRESENT: { color: 0x1a0402, emissive: 0xe0240e, emissiveIntensity: 1.9, roughness: 0.3 } },
  fx_blood: { PAST: { color: 0x3a0202, roughness: 0.15, metalness: 0.0 }, PRESENT: { color: 0x1a0606, roughness: 0.9 } },
};

export interface ShiftUniforms {
  uShiftCenter: { value: THREE.Vector3 };
  uShiftRadius: { value: number };
  uShiftMode: { value: number }; // 0 = off, 1 = show inside radius (incoming), 2 = show outside (outgoing)
}

export function makeShiftUniforms(): ShiftUniforms {
  return { uShiftCenter: { value: new THREE.Vector3() }, uShiftRadius: { value: 0 }, uShiftMode: { value: 0 } };
}

/** Inject a radial dissolve (with a glowing edge) used by the time-shift transition. */
export function applyShiftDissolve(mat: THREE.Material, u: ShiftUniforms, edgeColor: THREE.Color, extra?: { key: string; patch: (shader: THREE.WebGLProgramParametersWithUniforms) => void }) {
  mat.onBeforeCompile = (shader) => {
    injectAtmosphere(shader);
    extra?.patch(shader);
    shader.uniforms.uShiftCenter = u.uShiftCenter;
    shader.uniforms.uShiftRadius = u.uShiftRadius;
    shader.uniforms.uShiftMode = u.uShiftMode;
    shader.uniforms.uShiftEdge = { value: edgeColor };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vShiftWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vShiftWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vShiftWorld;\nuniform vec3 uShiftCenter;\nuniform float uShiftRadius;\nuniform float uShiftMode;\nuniform vec3 uShiftEdge;')
      .replace('void main() {', `void main() {
  float shiftD = distance(vShiftWorld, uShiftCenter);
  if (uShiftMode > 0.5 && uShiftMode < 1.5 && shiftD > uShiftRadius) discard;
  if (uShiftMode > 1.5 && shiftD < uShiftRadius) discard;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  if (uShiftMode > 0.5) {
    float shiftEdge = 1.0 - smoothstep(0.0, 0.9, abs(shiftD - uShiftRadius));
    gl_FragColor.rgb += uShiftEdge * shiftEdge * 2.5;
  }`);
  };
  mat.customProgramCacheKey = () => 'shift-dissolve' + (extra ? '-' + extra.key : '');
}

/**
 * Blood Sigil: instead of a flat glowing disc, dark blood-stained stone where only carved rings and runes
 * smoulder, with a slow heartbeat pulse. Pattern is procedural in the disc's object space (radius 0.85 m).
 */
const SIGIL_PATCH = {
  key: 'sigil',
  patch(shader: THREE.WebGLProgramParametersWithUniforms) {
    shader.uniforms.uSigilTime = ATMO_UNIFORMS.uAtmoTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec2 vSigil;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vSigil = position.xz / 0.85;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vSigil; uniform float uSigilTime;
float sigilHash(float n) { return fract(sin(n * 91.345) * 47453.21); }
float sigilMask(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  float ring = 1.0 - smoothstep(0.012, 0.03, abs(r - 0.93));
  ring += 1.0 - smoothstep(0.01, 0.025, abs(r - 0.72));
  ring += (1.0 - smoothstep(0.008, 0.02, abs(r - 0.33))) * 0.8;
  // runes between the rings: 24 glyph cells of short strokes
  float cells = 24.0, cell = floor((a + 3.14159) / 6.28318 * cells), fa = fract((a + 3.14159) / 6.28318 * cells);
  float rr = (r - 0.75) / 0.15;
  float g = 0.0;
  if (rr > 0.0 && rr < 1.0) {
    float s1 = step(0.5, sigilHash(cell)), s2 = step(0.5, sigilHash(cell + 7.0)), s3 = sigilHash(cell + 13.0);
    g += (1.0 - smoothstep(0.05, 0.11, abs(fa - 0.5))) * step(0.15, rr) * step(rr, 0.85);
    g += s1 * (1.0 - smoothstep(0.05, 0.1, abs(rr - s3))) * step(0.2, fa) * step(fa, 0.8);
    g += s2 * (1.0 - smoothstep(0.06, 0.12, abs(fa - rr)));
  }
  // three spokes and a drop at the heart (the blood that binds)
  float spokes = (1.0 - smoothstep(0.015, 0.035, abs(sin(a * 1.5) * r))) * step(0.34, r) * step(r, 0.7);
  float heart = 1.0 - smoothstep(0.09, 0.12, length(p * vec2(1.0, 0.8) + vec2(0.0, 0.03)));
  return clamp(ring + g + spokes * 0.7 + heart, 0.0, 1.0);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float sgM = sigilMask(vSigil);
  float sgPulse = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(uSigilTime * 1.7), 3.0);
  totalEmissiveRadiance *= sgM * sgPulse * 1.6 + 0.04;
  diffuseColor.rgb *= mix(1.0, 0.35, smoothstep(0.98, 0.6, length(vSigil)));`);
  },
};

/** Texture sets (keys of textureLibrary.json) a material key needs in either state. */
export function materialTextureSets(key: string): string[] {
  const d = DEFS[key];
  if (!d) throw new Error(`Material "${key}" has no runtime definition (see src/levels/Materials.ts)`);
  return [...new Set([d.PAST.tex, d.PRESENT.tex].filter((t): t is keyof typeof textureLibrary => !!t))];
}

export type TextureSetSource = (set: string) => { map: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture };

/**
 * Per-floor material library: materials are created on demand from the floor's resident texture sets
 * (owned by the AssetManager, never disposed here) and disposed with the floor.
 */
export class MaterialLibrary {
  private mats = new Map<string, THREE.Material>();
  readonly shift: Record<TimeState, ShiftUniforms> = { PAST: makeShiftUniforms(), PRESENT: makeShiftUniforms() };
  readonly sharedShift = makeShiftUniforms();
  missing = new Set<string>();

  constructor(private textures: TextureSetSource) {}

  has(key: string) { return key in DEFS; }

  /** Every material this library created (warm-up compiles them all). */
  all() { return [...this.mats.values()]; }

  /** Create both state variants for every key (so shader warm-up sees every program up front). */
  createAll(keys: Iterable<string>, groups: ('SHARED' | TimeState)[] = ['SHARED', 'PAST', 'PRESENT']) {
    for (const k of keys) for (const g of groups) for (const st of ['PAST', 'PRESENT'] as TimeState[]) {
      if (g !== 'SHARED' && g !== st) continue;
      this.get(k, st, g);
    }
  }

  dispose() {
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }

  /** group: which geometry group the mesh belongs to. SHARED meshes get per-state materials swapped. */
  get(key: string, state: TimeState, group: 'SHARED' | TimeState): THREE.Material {
    const id = `${key}|${state}|${group === 'SHARED' ? 'S' : 'X'}`;
    const hit = this.mats.get(id);
    if (hit) return hit;
    const def = DEFS[key]?.[state];
    if (!def) {
      this.missing.add(key);
      throw new Error(`Material "${key}" has no runtime definition (see src/levels/Materials.ts)`);
    }
    let m: THREE.Material;
    if (def.unlit) {
      const b = new THREE.MeshBasicMaterial({ color: def.emissive ?? def.color ?? 0xffffff });
      if (def.emissive) b.color.multiplyScalar(def.emissiveIntensity ?? 1);
      m = b;
    } else {
      const s = new THREE.MeshStandardMaterial({
        color: def.color ?? 0xffffff,
        roughness: def.roughness ?? 1.0,
        metalness: def.metalness ?? (def.tex ? 1.0 : 0.0),
        side: def.side ?? THREE.FrontSide,
      });
      if (def.tex) {
        const t = this.textures(def.tex);
        s.map = t.map;
        s.normalMap = t.normal;
        s.normalScale.setScalar(def.normalScale ?? 1.0);
        s.roughnessMap = t.arm;
        s.metalnessMap = t.arm;
        s.aoMap = t.arm;
        s.aoMapIntensity = def.aoIntensity ?? 0.8;
        if (def.metalness === undefined) s.metalness = 1.0; // metalness map drives it (stone/wood ≈ 0)
      }
      if (def.emissive) {
        s.emissive = new THREE.Color(def.emissive);
        s.emissiveIntensity = def.emissiveIntensity ?? 1;
      }
      m = s;
    }
    const u = group === 'SHARED' ? this.sharedShift : this.shift[state];
    applyShiftDissolve(m, u, new THREE.Color(state === 'PAST' ? 0xffa64a : 0x7cc8ff), key === 'fx_sigil' ? SIGIL_PATCH : undefined);
    m.name = id;
    this.mats.set(id, m);
    return m;
  }
}
