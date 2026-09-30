import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { AssetManager, disposeObject, disposeTexture, fetchBytes, objectMemory, textureGpuBytes } from './AssetManager';
import textureLibrary from '../data/textureLibrary.json';
import floorManifests from '../data/floorManifests.json';
import voiceManifest from '../data/voiceManifest.json';
import assetSizes from '../data/assetSizes.json';
import audioManifest from '../data/audioManifest.json';
import musicManifest from '../data/musicManifest.json';
import { ARCHETYPES, PAST_COUNTERPART, type ArchetypeId, type AssetId } from '../enemies/EnemyTypes';
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

/**
 * `contacts` (rigs levelled on their feet, see LEVEL): the front / back ground contacts in the normalised model's
 * frame (z forward, metres at scale 1) — a brain pitching the body pivots about them instead of sinking a pair of legs.
 */
export interface EnemyTemplate { scene: THREE.Object3D; clips: THREE.AnimationClip[]; norm: THREE.Matrix4; contacts?: { front: number; back: number } }
export interface VegProto { geo: THREE.BufferGeometry; mat: THREE.Material; scale: number }
export interface TexSet { map: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture }

const ENEMY_URL: Record<AssetId, string> = {
  knight: 'assets/characters/knight.glb', hollow: 'assets/characters/hollow.glb',
  archer: 'assets/characters/archer.glb', ghost: 'assets/characters/ghost.glb',
  lastcrown: 'assets/characters/lastcrown.glb',
  // session 9 monsters: the goblin is retargeted in Blender (tools/blender/build_monsters.py); bat and widow are
  // source copies normalised here at load (NORMALISE). Session 11: the Creature Pack Mutant (the Maw, the crown brutes;
  // tools/blender/build_mutant.py) replaced the Sketchfab lamia, whose flat alpha-cut model read as a paper cut-out
  goblin: 'assets/characters/goblin.glb', bat: 'assets/characters/bat.glb',
  widow: 'assets/characters/widow.glb', mutant: 'assets/characters/mutant.glb',
};
/**
 * Sketchfab source copies: scaled to a height (m), turned to face +Z, feet on the origin — measured on the first
 * frame of their one clip (their bind poses are far from the animated shape) — and the clip renamed.
 */
const NORMALISE: Partial<Record<AssetId, { height: number; clip: string; yaw: number }>> = {
  ghost: { height: 1.6, clip: 'float', yaw: 0 },
  bat: { height: 0.72, clip: 'flap', yaw: Math.PI },
  widow: { height: 2.0, clip: 'crawl', yaw: 0 },
};
/**
 * Feet on the ground, measured over the rig's own clips at load (session 11). The goblin's retargeted GLB keys its
 * pelvis translation as small deltas (y ≈ −3.5 units) without the 59.5-unit rest offset, so every clip ran with the
 * hips ~0.5 m low and the goblin (and the ×1.6 Gutter King) stood buried to the thighs (lowest vertex −0.66 m). The
 * error is the same constant in every clip: lift the model by the median of the per-frame lowest point over its
 * standing / walking / running clips.
 */
const GROUND: Partial<Record<AssetId, string[]>> = {
  goblin: ['idle_combat', 'idle_alert', 'walk_fwd', 'run_fwd'],
};
/**
 * Levelled on its feet (session 11): the Widow's crawl keeps its front pair of legs ~0.47 m higher than the back pair,
 * so grounded by its lowest point she stood on two legs with the ghost-head hanging in the air (it read as floating).
 * The body is pitched so the front and back contacts (median of the per-frame lowest front / back point over the clip)
 * both meet the floor, then set down on them.
 */
const LEVEL = new Set<AssetId>(['widow']);
const VEG_URL: Record<string, { url: string; height: number; emissive?: number }> = {
  grass: { url: 'assets/vegetation/low_poly_grass.glb', height: 0.42 },
  grasspack: { url: 'assets/vegetation/low_poly_grass_pack.glb', height: 0.35 },
  flower: { url: 'assets/vegetation/low_poly_glowing_flower.glb', height: 0.45, emissive: 0xff7040 },
};
const HERO_URL = variant('assets/characters/hero.glb');
const HERO_MENU_URL = 'assets/characters/hero_menu.glb';

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
/**
 * Sounds only a rig uses (session 13): they load with the floors whose Echoes need them — Floor 1 has no monsters, so
 * it no longer decodes the bats', goblins', the Widow's and the Maw's voices (they were in "core", resident everywhere).
 */
const RIG_SOUNDS: Partial<Record<AssetId, SoundId[]>> = {
  bat: ['bat_screech', 'bat_flap', 'bat_death'],
  goblin: ['goblin_snarl', 'goblin_death', 'goblin_cry'],
  widow: ['widow_hiss', 'widow_spit', 'web_hit', 'widow_death'],
  mutant: ['maw_snarl', 'maw_roar'],
};
const FLOOR_ONLY = new Set<string>([...Object.values(FLOOR_SOUNDS).flat(), ...Object.values(RIG_SOUNDS).flat()]);

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
    this.registerMusic();
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
      key: 'glb:hero', bytes: size(HERO_URL), label: 'The Uncrowned', urls: [HERO_URL],
      load: (p) => this.loadGltf(HERO_URL, p),
      dispose: (g) => disposeObject(g.scene, { textures: true }),
      memory: (g) => objectMemory(g.scene),
    });
    // session 15: the title screen heroine's clips (animation only; scope "menu", released when play begins)
    m.register<THREE.AnimationClip[]>({
      key: 'glb:hero-menu', bytes: size(HERO_MENU_URL), label: 'The Uncrowned', urls: [HERO_MENU_URL],
      load: async (p) => (await this.loadGltf(HERO_MENU_URL, p)).animations,
      dispose: () => { /* AnimController.removeClips uncaches them; the tracks are garbage-collected */ },
      memory: (clips) => ({ gpu: 0, cpu: clips.reduce((n, c) => n + c.tracks.reduce((k, t) => k + t.times.byteLength + t.values.byteLength, 0), 0) }),
    });
    for (const [id, url0] of Object.entries(ENEMY_URL) as [AssetId, string][]) {
      const url = variant(url0);
      m.register<EnemyTemplate>({
        key: 'glb:enemy:' + id, bytes: size(url), label: 'Echoes of the keep', urls: [url],
        load: async (p) => await prepareEnemy(id, await this.loadGltf(url, p)),
        dispose: (t) => disposeObject(t.scene, { textures: true }),
        memory: (t) => objectMemory(t.scene),
      });
    }
    for (const [kind, v] of Object.entries(VEG_URL)) {
      const url = variant(v.url);
      m.register<VegProto[]>({
        key: 'veg:' + kind, bytes: size(url), label: 'Growth', urls: [url],
        load: async (p) => prepareVeg(await this.loadGltf(url, p), v.height, v.emissive),
        dispose: (list) => { for (const x of list) { x.geo.dispose(); disposeMaterialAndMaps(x.mat); } },
        memory: (list) => list.reduce((s, x) => { const mm = objectMemory(new THREE.Mesh(x.geo, x.mat)); return { gpu: s.gpu + mm.gpu, cpu: s.cpu + mm.cpu }; }, { gpu: 0, cpu: 0 }),
      });
    }
    for (const [fid, f] of Object.entries(floorManifests as Record<string, { level: string; collision: string }>)) {
      m.register<GLTF>({
        key: 'glb:level:' + fid, bytes: size(f.level), label: 'The castle remembers', urls: [f.level],
        load: (p) => this.loadGltf(f.level, p),
        dispose: (g) => disposeObject(g.scene, { textures: true }),
        memory: (g) => objectMemory(g.scene),
      });
      m.register<GLTF>({
        key: 'glb:col:' + fid, bytes: size(f.collision), label: 'The castle remembers', urls: [f.collision],
        load: (p) => this.loadGltf(f.collision, p),
        dispose: (g) => disposeObject(g.scene),
        memory: (g) => objectMemory(g.scene),
      });
    }
    for (const fid of Object.keys(floorManifests)) {
      const url = `assets/levels/floor${fid.padStart(2, '0')}_nav.bin`;
      m.register<ArrayBuffer>({
        key: 'nav:' + fid, bytes: size(url), label: 'Paths through the keep', urls: [url],
        load: (p) => fetchBytes(url, size(url), p),
        dispose: () => { /* garbage-collected */ },
        memory: (b) => ({ gpu: 0, cpu: b.byteLength }),
      });
    }
    for (const [key, e] of Object.entries(textureLibrary as Record<string, { diff: string; nor: string; arm: string; ktx2?: { diff: string; nor: string; arm: string } }>)) {
      const urls = USE_KTX2 && e.ktx2 && SIZES[e.ktx2.diff] ? e.ktx2 : { diff: e.diff, nor: e.nor, arm: e.arm };
      m.register<TexSet>({
        key: 'tex:' + key, bytes: size(urls.diff) + size(urls.nor) + size(urls.arm), label: 'Stone and timber', urls: [urls.diff, urls.nor, urls.arm],
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
        key: 'snd:' + id, bytes: s.files.reduce((n, f) => n + size(f), 0), label: 'Echoing halls', urls: s.files,
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

  /**
   * The score (session 13, audio/Music.ts; files from tools/build_music.py): the exploration track's segments stay
   * compressed until they play (Music decodes two at a time), the combat cue is decoded whole (it loops sample-exact).
   */
  private registerMusic() {
    const m = this.manager;
    const segs = musicManifest.explore.segments;
    m.register<ArrayBuffer[]>({
      key: 'music:explore', bytes: segs.reduce((n, s) => n + s.bytes, 0), label: 'Old songs of the keep', urls: segs.map((s) => s.url),
      load: async (p) => {
        let done = 0;
        return Promise.all(segs.map(async (s) => { const b = await fetchBytes(s.url, s.bytes, () => {}); p(++done / segs.length); return b; }));
      },
      dispose: () => { /* garbage-collected once Music drops it */ },
      memory: (list) => ({ gpu: 0, cpu: list.reduce((n, b) => n + b.byteLength, 0) }),
    });
    const c = musicManifest.combat;
    m.register<AudioBuffer>({
      key: 'music:combat', bytes: c.bytes, label: 'Old songs of the keep', urls: [c.url],
      load: async (p) => {
        const ctx = this.audioCtx;
        if (!ctx) throw new Error('audio context not created');
        return ctx.decodeAudioData(await fetchBytes(c.url, c.bytes, p));
      },
      dispose: () => { /* garbage-collected once Music drops it */ },
      memory: (b) => ({ gpu: 0, cpu: b.length * b.numberOfChannels * 4 }),
    });
  }
  /** the score: every floor shares it (scope "music", loaded with core unless the audio is automation-muted) */
  musicKeys() { return ['music:explore', 'music:combat']; }

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
        key: 'vo:' + id, bytes: v.bytes, label: 'Her voice', urls: [v.url],
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
    const keys = ['glb:level:' + id, 'glb:col:' + id, 'nav:' + id];
    const sets = new Set<string>();
    for (const mat of man.materials) for (const s of materialTextureSets(mat)) sets.add(s);
    keys.push(...[...sets].sort().map((s) => 'tex:' + s));
    const rigs = new Set<AssetId>();
    for (const a of man.archetypes) {
      const arch = ARCHETYPES[a as ArchetypeId];
      if (!arch) throw new Error(`Floor ${id} references unknown archetype "${a}"`);
      rigs.add(arch.asset);
      // a monster placed in the Past is replaced by its living counterpart at spawn (EnemyManager.spawnEnemy)
      const past = PAST_COUNTERPART[a as ArchetypeId];
      if (past) rigs.add(ARCHETYPES[past].asset);
    }
    // fissure Echoes: Remnants (Present) and remembered guards (Past)
    if (man.markers.fissure) { rigs.add(ARCHETYPES.remnant.asset); rigs.add(ARCHETYPES.remnant_guard.asset); }
    if (man.markers.statue) rigs.add('knight');
    if (man.markers.imprint) rigs.add('archer');
    // dev server only: ?monsters preloads every session-9 monster rig on any floor (dev/monsterProbe.js spawns them)
    if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('monsters')) for (const r of ['goblin', 'bat', 'widow', 'mutant'] as AssetId[]) rigs.add(r);
    keys.push(...[...rigs].sort().map((r) => 'glb:enemy:' + r));
    const snd = new Set<SoundId>(FLOOR_SOUNDS[id] ?? []);
    for (const r of rigs) for (const x of RIG_SOUNDS[r] ?? []) snd.add(x);
    keys.push(...man.veg.map((v) => 'veg:' + v));
    keys.push(...[...snd].sort().map((s) => 'snd:' + s));
    return keys;
  }
}

export interface FloorManifest { level: string; collision: string; materials: string[]; archetypes: string[]; veg: string[]; markers: Record<string, number> }

function disposeMaterialAndMaps(mat: THREE.Material) {
  for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) disposeTexture(v as THREE.Texture);
  mat.dispose();
}

/** Rig-specific preprocessing (the ghost's normalisation is the original session-3 path, generalised). */
async function prepareEnemy(id: AssetId, gl: GLTF): Promise<EnemyTemplate> {
  let clips = gl.animations;
  const norm = new THREE.Matrix4();
  const nz = NORMALISE[id];
  if (nz) {
    // Sketchfab chains (100x transforms): measure the posed first frame, then scale / face / ground it
    clips = clips.map((c) => { const k = c.clone(); k.name = nz.clip; return k; });
    const mixer = new THREE.AnimationMixer(gl.scene);
    if (clips[0]) { mixer.clipAction(clips[0]).play(); mixer.setTime(0); }
    gl.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    gl.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) { m.skeleton.update(); m.computeBoundingBox(); box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld)); }
    });
    mixer.stopAllAction(); mixer.uncacheRoot(gl.scene);
    const sz = box.getSize(new THREE.Vector3());
    const s = nz.height / Math.max(1e-6, sz.y);
    const c = box.getCenter(new THREE.Vector3());
    norm.makeRotationY(nz.yaw).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  }
  let contacts: EnemyTemplate['contacts'];
  const ground = GROUND[id];
  if (ground) {
    // 20th percentile of the per-frame lowest point: the planted foot of the stance / stride (a median sat the
    // standing goblin ~5 cm above the floor, because a stride keeps one foot lifted half the time)
    const lows = sampleClips(gl.scene, clips.filter((c) => ground.includes(c.name)), norm, 12).map((pts) => Math.min(...pts.map((p) => p.y))).sort((a, b) => a - b);
    if (lows.length) norm.premultiply(new THREE.Matrix4().makeTranslation(0, -lows[Math.floor(lows.length * 0.2)], 0));
  }
  if (LEVEL.has(id) && clips[0]) {
    // per frame: the lowest point of the front half and of the back half (z about the body's centre)
    const frames = sampleClips(gl.scene, [clips[0]], norm, 16);
    const fh: number[] = [], bh: number[] = [], fz: number[] = [], bz: number[] = [];
    for (const pts of frames) {
      let f: THREE.Vector3 | null = null, b: THREE.Vector3 | null = null;
      for (const p of pts) {
        if (p.z > 0) { if (!f || p.y < f.y) f = p; } else if (!b || p.y < b.y) b = p;
      }
      if (f && b) { fh.push(f.y); fz.push(f.z); bh.push(b.y); bz.push(b.z); }
    }
    if (fh.length) {
      const hf = median(fh), hb = median(bh), zf = median(fz), zb = median(bz);
      // pitch about +X (positive = nose down) so both contacts lie on one level, then set them on the floor
      const th = Math.atan2(hf - hb, zf - zb);
      const y = hf * Math.cos(th) - zf * Math.sin(th);
      norm.premultiply(new THREE.Matrix4().makeRotationX(th)).premultiply(new THREE.Matrix4().makeTranslation(0, -y, 0));
      contacts = { front: zf * Math.cos(th) + hf * Math.sin(th), back: zb * Math.cos(th) + hb * Math.sin(th) };
    }
  }
  if (id === 'mutant') {
    // the Maw smoulders crimson when it enrages (enemies/Maw.ts drives the emissive colour): its colour map doubles as
    // the emissive map from the start, black, so the warmed program is the one it needs
    gl.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!m.isMesh || !mat?.map) return;
      mat.emissiveMap = mat.map; mat.emissive.setRGB(0, 0, 0); mat.emissiveIntensity = 1; mat.needsUpdate = true;
    });
  }
  if (id === 'goblin') {
    // KHR_materials_unlit: lit instead, so the goblins sit in the castle's light like everything else (same maps)
    gl.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !(m.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) return;
      const b = m.material as THREE.MeshBasicMaterial;
      m.material = new THREE.MeshStandardMaterial({ name: b.name, map: b.map, color: b.color, side: b.side, roughness: 0.8, metalness: 0 });
      b.dispose();
    });
  }
  if (id === 'archer') {
    // eyelash + eye-specular overlays: two extra transparent draw calls (and shadow passes) per archer,
    // invisible at combat distance
    const drop: THREE.Mesh[] = [];
    gl.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && /^(phong1|EyeSpec_MAT1)$/.test((m.material as THREE.Material).name)) drop.push(m); });
    for (const o of drop) { o.removeFromParent(); disposeObject(o, { textures: true }); }
  }
  return { scene: gl.scene, clips, norm, contacts };
}

function median(v: number[]) { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

/**
 * Skinned vertex positions (every few vertices, in the normalised frame `norm`) at `n` evenly spaced times of each
 * clip: one point list per sampled frame. Load-time only (a few thousand vertices per frame).
 */
function sampleClips(scene: THREE.Object3D, clips: THREE.AnimationClip[], norm: THREE.Matrix4, n: number): THREE.Vector3[][] {
  const mixer = new THREE.AnimationMixer(scene);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  const out: THREE.Vector3[][] = [];
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const clip of clips) {
    const act = mixer.clipAction(clip);
    act.play();
    for (let i = 0; i < n; i++) {
      mixer.setTime((clip.duration * i) / n);
      scene.updateMatrixWorld(true);
      const pts: THREE.Vector3[] = [];
      for (const mesh of meshes) {
        mesh.skeleton.update();
        m.multiplyMatrices(norm, mesh.matrixWorld);
        const pos = mesh.geometry.attributes.position;
        const step = Math.max(1, Math.floor(pos.count / 1200));
        for (let k = 0; k < pos.count; k += step) pts.push(mesh.getVertexPosition(k, v).applyMatrix4(m).clone());
      }
      out.push(pts);
    }
    act.stop();
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
  return out;
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
