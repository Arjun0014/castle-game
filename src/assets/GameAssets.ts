import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { AssetManager, disposeObject, disposeTexture, fetchBytes, objectMemory, textureGpuBytes } from './AssetManager';
import textureLibrary from '../data/textureLibrary.json';
import floorManifests from '../data/floorManifests.json';
import voiceManifest from '../data/voiceManifest.json';
import assetSizes from '../data/assetSizes.json';
import audioManifest from '../data/audioManifest.json';
import { ARCHETYPES, type ArchetypeId, type AssetId } from '../enemies/EnemyTypes';
import { materialTextureSets } from '../levels/Materials';

/**
 * Every loadable resource of the game, registered with the AssetManager under a stable key:
 *   glb:hero · glb:enemy:<asset> · glb:level:<floor> · glb:col:<floor> · veg:<kind> · tex:<set> · snd:<sound id>
 * and the per-floor dependency lists (derived from src/data/floorManifests.json, generated from the floor GLBs
 * by tools/build_floor_manifest.mjs).
 */
const SIZES = assetSizes as Record<string, number>;
const size = (url: string) => SIZES[url] ?? 256 * 1024;
/**
 * KTX2 (Basis) textures are used whenever tools/build_ktx2.mjs produced them (listed in assetSizes.json);
 * `?tex=jpg` forces the original JPEG/PNG assets (A/B benchmarks, fallback).
 */
export const USE_KTX2 = typeof location === 'undefined' || new URLSearchParams(location.search).get('tex') !== 'jpg';
/** assets/x/y.glb → assets/ktx2/x/y.glb when that KTX2 variant exists */
const variant = (url: string) => {
  const k = url.replace(/^assets\//, 'assets/ktx2/');
  return USE_KTX2 && SIZES[k] ? k : url;
};

export interface EnemyTemplate { scene: THREE.Object3D; clips: THREE.AnimationClip[]; norm: THREE.Matrix4 }
export interface VegProto { geo: THREE.BufferGeometry; mat: THREE.Material; scale: number }
export interface TexSet { map: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture }

const ENEMY_URL: Record<AssetId, string> = {
  knight: 'assets/characters/knight.glb', hollow: 'assets/characters/hollow.glb',
  archer: 'assets/characters/archer.glb', ghost: 'assets/characters/ghost.glb',
  lastcrown: 'assets/characters/lastcrown.glb',
};
const VEG_URL: Record<string, { url: string; height: number; emissive?: number }> = {
  grass: { url: 'assets/vegetation/low_poly_grass.glb', height: 0.42 },
  grasspack: { url: 'assets/vegetation/low_poly_grass_pack.glb', height: 0.35 },
  flower: { url: 'assets/vegetation/low_poly_glowing_flower.glb', height: 0.45, emissive: 0xff7040 },
};
const HERO_URL = variant('assets/characters/hero.glb');

type SoundId = keyof typeof audioManifest.sounds;
const SOUNDS = audioManifest.sounds as unknown as Record<SoundId, { files: string[]; bus: string; loop: boolean }>;
/** ambience beds (≈87 MB decoded): scope "ambience", skipped entirely in automation mute mode */
export const AMBIENCE_SOUNDS: SoundId[] = ['amb_present', 'amb_wind', 'amb_drips', 'amb_fire', 'amb_past'];
/** sounds only one floor uses */
export const FLOOR_SOUNDS: Record<number, SoundId[]> = {
  1: ['hatch_slam'],
  // the Last Crown's voice and magic (tools/elevenlabs_sfx.json): only Floor 3 loads them
  3: (['mage_charge', 'mage_bolt', 'mage_impact', 'mage_nova', 'mage_teleport', 'mage_beam', 'mage_ward', 'mage_rune', 'crown_resonance', 'boss_scream', 'boss_death', 'final_collapse'] as string[])
    .filter((id) => id in audioManifest.sounds) as SoundId[],
};
const FLOOR_ONLY = new Set<string>(Object.values(FLOOR_SOUNDS).flat());

export class GameAssets {
  readonly manager = new AssetManager();
  private gltf = new GLTFLoader();
  private ktx2: KTX2Loader | null = null;
  audioCtx: AudioContext | null = null;
  /** Voice lines decode here: an offline context at 22.05 kHz resamples them (a third of 44.1 kHz stereo). */
  private voiceCtx: BaseAudioContext | null = null;

  constructor(private renderer: THREE.WebGLRenderer, private anisotropy: number) {
    this.registerAll();
    this.registerVoice();
  }

  /** KTX2 (Basis) transcoder, created only if a KTX2 asset is requested. */
  private ktx2Loader() {
    if (!this.ktx2) {
      this.ktx2 = new KTX2Loader().setTranscoderPath('assets/basis/').detectSupport(this.renderer);
      this.gltf.setKTX2Loader(this.ktx2);
    }
    return this.ktx2;
  }

  private async loadGltf(url: string, onProgress: (f: number) => void): Promise<GLTF> {
    const bytes = await fetchBytes(url, size(url), (f) => onProgress(f * 0.85));
    if (/"KHR_texture_basisu"/.test(new TextDecoder().decode(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 65536))))) this.ktx2Loader();
    const g = await this.gltf.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1));
    onProgress(1);
    return g;
  }

  private registerAll() {
    const m = this.manager;
    m.register<GLTF>({
      key: 'glb:hero', bytes: size(HERO_URL), label: 'The Uncrowned',
      load: (p) => this.loadGltf(HERO_URL, p),
      dispose: (g) => disposeObject(g.scene, { textures: true }),
      memory: (g) => objectMemory(g.scene),
    });
    for (const [id, url0] of Object.entries(ENEMY_URL) as [AssetId, string][]) {
      const url = variant(url0);
      m.register<EnemyTemplate>({
        key: 'glb:enemy:' + id, bytes: size(url), label: 'Echoes of the keep',
        load: async (p) => prepareEnemy(id, await this.loadGltf(url, p)),
        dispose: (t) => disposeObject(t.scene, { textures: true }),
        memory: (t) => objectMemory(t.scene),
      });
    }
    for (const [kind, v] of Object.entries(VEG_URL)) {
      const url = variant(v.url);
      m.register<VegProto[]>({
        key: 'veg:' + kind, bytes: size(url), label: 'Growth',
        load: async (p) => prepareVeg(await this.loadGltf(url, p), v.height, v.emissive),
        dispose: (list) => { for (const x of list) { x.geo.dispose(); disposeMaterialAndMaps(x.mat); } },
        memory: (list) => list.reduce((s, x) => { const mm = objectMemory(new THREE.Mesh(x.geo, x.mat)); return { gpu: s.gpu + mm.gpu, cpu: s.cpu + mm.cpu }; }, { gpu: 0, cpu: 0 }),
      });
    }
    for (const [fid, f] of Object.entries(floorManifests as Record<string, { level: string; collision: string }>)) {
      m.register<GLTF>({
        key: 'glb:level:' + fid, bytes: size(f.level), label: 'The castle remembers',
        load: (p) => this.loadGltf(f.level, p),
        dispose: (g) => disposeObject(g.scene, { textures: true }),
        memory: (g) => objectMemory(g.scene),
      });
      m.register<GLTF>({
        key: 'glb:col:' + fid, bytes: size(f.collision), label: 'The castle remembers',
        load: (p) => this.loadGltf(f.collision, p),
        dispose: (g) => disposeObject(g.scene),
        memory: (g) => objectMemory(g.scene),
      });
    }
    for (const [key, e] of Object.entries(textureLibrary as Record<string, { diff: string; nor: string; arm: string; ktx2?: { diff: string; nor: string; arm: string } }>)) {
      const urls = USE_KTX2 && e.ktx2 && SIZES[e.ktx2.diff] ? e.ktx2 : { diff: e.diff, nor: e.nor, arm: e.arm };
      m.register<TexSet>({
        key: 'tex:' + key, bytes: size(urls.diff) + size(urls.nor) + size(urls.arm), label: 'Stone and timber',
        load: async (p) => {
          const parts = [0, 0, 0];
          const prog = (i: number) => (f: number) => { parts[i] = f; p((parts[0] + parts[1] + parts[2]) / 3); };
          const [map, normal, arm] = await Promise.all([
            this.loadTexture(urls.diff, true, prog(0)), this.loadTexture(urls.nor, false, prog(1)), this.loadTexture(urls.arm, false, prog(2)),
          ]);
          return { map, normal, arm };
        },
        dispose: (t) => { disposeTexture(t.map); disposeTexture(t.normal); disposeTexture(t.arm); },
        memory: (t) => ({ gpu: textureGpuBytes(t.map) + textureGpuBytes(t.normal) + textureGpuBytes(t.arm), cpu: 0 }),
      });
    }
    for (const [id, s] of Object.entries(SOUNDS) as [SoundId, { files: string[] }][]) {
      m.register<AudioBuffer[]>({
        key: 'snd:' + id, bytes: s.files.reduce((n, f) => n + size(f), 0), label: 'Echoing halls',
        load: async (p) => {
          const ctx = this.audioCtx;
          if (!ctx) throw new Error('audio context not created');
          let done = 0;
          return Promise.all(s.files.map(async (url) => {
            const buf = await ctx.decodeAudioData(await fetchBytes(url, size(url), () => {}));
            p(++done / s.files.length);
            return buf;
          }));
        },
        dispose: () => { /* AudioBuffers are GC'd once AudioFX drops them (AudioFX.unbind) */ },
        memory: (list) => ({ gpu: 0, cpu: list.reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0) }),
      });
    }
  }

  private voiceDecoder(): BaseAudioContext {
    if (!this.voiceCtx) {
      try { this.voiceCtx = new OfflineAudioContext(1, 22050, 22050); } catch { this.voiceCtx = this.audioCtx; }
      if (!this.voiceCtx) throw new Error('no audio context for voice decoding');
    }
    return this.voiceCtx;
  }

  /** The heroine's lines (keys vo:<line id>, see audio/Dialogue.ts). */
  private registerVoice() {
    const lines = (voiceManifest as { lines: Record<string, { url: string; bytes: number }> }).lines;
    for (const [id, v] of Object.entries(lines)) {
      this.manager.register<AudioBuffer>({
        key: 'vo:' + id, bytes: v.bytes, label: 'Her voice',
        load: async (p) => this.voiceDecoder().decodeAudioData(await fetchBytes(v.url, v.bytes, p)),
        dispose: () => { /* garbage-collected once Dialogue drops it */ },
        memory: (b) => ({ gpu: 0, cpu: b.length * b.numberOfChannels * 4 }),
      });
    }
  }

  /** Texture from a JPG/PNG (decoded off the main thread via createImageBitmap) or a KTX2 file. */
  private async loadTexture(url: string, srgb: boolean, onProgress: (f: number) => void): Promise<THREE.Texture> {
    let t: THREE.Texture;
    if (url.endsWith('.ktx2')) {
      const loader = this.ktx2Loader();
      const bytes = await fetchBytes(url, size(url), (f) => onProgress(f * 0.9));
      t = await new Promise<THREE.Texture>((res, rej) => loader.parse(bytes, res as any, rej));
    } else {
      const bytes = await fetchBytes(url, size(url), (f) => onProgress(f * 0.9));
      // TextureLoader convention (flipY = true) reproduced for ImageBitmaps, which ignore UNPACK_FLIP_Y
      const bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      t = new THREE.Texture(bmp as any);
      t.flipY = false;
      t.needsUpdate = true;
    }
    t.name = url;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.anisotropy;
    onProgress(1);
    return t;
  }

  // ------------------------------------------------------------------------------------------ dependency lists
  /** Resources every floor needs (scope "core"). */
  coreKeys(): string[] {
    const snd = (Object.keys(SOUNDS) as SoundId[]).filter((id) => !AMBIENCE_SOUNDS.includes(id) && !FLOOR_ONLY.has(id));
    return ['glb:hero', ...snd.map((s) => 'snd:' + s)];
  }
  ambienceKeys() { return AMBIENCE_SOUNDS.map((s) => 'snd:' + s); }

  /** Everything floor `id` needs beyond core: level, collision, textures, enemy rigs, vegetation, floor sounds. */
  floorKeys(id: number): string[] {
    const man = (floorManifests as Record<string, FloorManifest>)[id];
    if (!man) throw new Error('No manifest for floor ' + id + ' (run npm run assets:manifest)');
    const keys = ['glb:level:' + id, 'glb:col:' + id];
    const sets = new Set<string>();
    for (const mat of man.materials) for (const s of materialTextureSets(mat)) sets.add(s);
    keys.push(...[...sets].sort().map((s) => 'tex:' + s));
    const rigs = new Set<AssetId>();
    for (const a of man.archetypes) {
      const arch = ARCHETYPES[a as ArchetypeId];
      if (!arch) throw new Error(`Floor ${id} references unknown archetype "${a}"`);
      rigs.add(arch.asset);
    }
    if (man.markers.fissure) rigs.add(ARCHETYPES.remnant.asset);
    if (man.markers.statue) rigs.add('knight');
    if (man.markers.imprint) rigs.add('archer');
    keys.push(...[...rigs].sort().map((r) => 'glb:enemy:' + r));
    keys.push(...man.veg.map((v) => 'veg:' + v));
    keys.push(...(FLOOR_SOUNDS[id] ?? []).map((s) => 'snd:' + s));
    return keys;
  }
}

export interface FloorManifest { level: string; collision: string; materials: string[]; archetypes: string[]; veg: string[]; markers: Record<string, number> }

function disposeMaterialAndMaps(mat: THREE.Material) {
  for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) disposeTexture(v as THREE.Texture);
  mat.dispose();
}

/** Rig-specific preprocessing formerly done in EnemyManager.load (kept identical). */
function prepareEnemy(id: AssetId, gl: GLTF): EnemyTemplate {
  let clips = gl.animations;
  const norm = new THREE.Matrix4();
  if (id === 'ghost') {
    // Sketchfab ghost: normalise its (100x) transform chain to ~1.6 m, feet at origin
    clips = clips.map((c) => { const k = c.clone(); k.name = 'float'; return k; });
    gl.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    gl.scene.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) { m.computeBoundingBox(); box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
    const sz = box.getSize(new THREE.Vector3());
    const s = 1.6 / Math.max(1e-6, sz.y);
    const c = box.getCenter(new THREE.Vector3());
    norm.makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  }
  if (id === 'archer') {
    // eyelash + eye-specular overlays: two extra transparent draw calls (and shadow passes) per archer,
    // invisible at combat distance
    const drop: THREE.Mesh[] = [];
    gl.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && /^(phong1|EyeSpec_MAT1)$/.test((m.material as THREE.Material).name)) drop.push(m); });
    for (const o of drop) { o.removeFromParent(); disposeObject(o, { textures: true }); }
  }
  return { scene: gl.scene, clips, norm };
}

/** Vegetation prototypes: geometry baked to a unit footprint, feet at the origin, scaled to `height`. */
function prepareVeg(g: GLTF, height: number, emissive?: number): VegProto[] {
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene);
  const sz = box.getSize(new THREE.Vector3());
  const scale = height / Math.max(sz.y, 1e-3);
  const list: VegProto[] = [];
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (emissive !== undefined) { mat.emissive = new THREE.Color(emissive); mat.emissiveIntensity = 0.9; }
    mat.side = THREE.DoubleSide;
    list.push({ geo, mat, scale });
  });
  // the source scene's own geometries/materials are no longer referenced (clones above); textures are shared
  g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  return list;
}
