import * as THREE from 'three';

/**
 * Explicit, reference-counted asset lifecycle.
 *
 * Every runtime resource (GLB template, texture set, sound) is an entry keyed by a string ("glb:knight",
 * "tex:stone_wall", "snd:swing"). Loading is always *scoped*: `acquire(scope, keys)` loads what is missing
 * (in-flight loads are shared, never duplicated) and tags every key with the scope; `release(scope)` drops the
 * tag and genuinely disposes entries no scope references any more (GPU buffers, textures, ImageBitmaps,
 * decoded audio). Floors are scopes ("floor1", "floor2"); resources every floor needs live in "core".
 *
 * Progress is byte-weighted from real transfer progress (fetch streaming / XHR progress events) — never a
 * timer. Nothing falls back silently: a failed load rejects `acquire` with the key and URL in the message.
 */
export interface AssetDef<T = unknown> {
  key: string;
  /** expected bytes (download size) — progress weight */
  bytes: number;
  /** human label for the loading screen */
  label: string;
  load(onProgress: (f: number) => void): Promise<T>;
  dispose(value: T): void;
  /** estimated resident memory of the loaded value */
  memory?(value: T): { gpu: number; cpu: number };
}

interface Entry {
  def: AssetDef<any>;
  scopes: Set<string>;
  state: 'loading' | 'ready' | 'failed';
  promise: Promise<unknown>;
  value?: unknown;
  progress: number;
  loadMs: number;
  error?: unknown;
}

export interface LoadProgress { loaded: number; total: number; fraction: number; label: string; done: number; count: number }

export class AssetManager {
  private entries = new Map<string, Entry>();
  private defs = new Map<string, AssetDef<any>>();
  /** keys disposed over the session (for tests) */
  disposedLog: string[] = [];

  register<T>(def: AssetDef<T>) {
    const prev = this.defs.get(def.key);
    if (prev && prev !== def) {
      // re-registration with identical key is allowed (idempotent definitions from floor setup)
      this.defs.set(def.key, def);
      return;
    }
    this.defs.set(def.key, def);
  }

  has(key: string) { return this.entries.get(key)?.state === 'ready'; }
  isRegistered(key: string) { return this.defs.has(key); }

  get<T>(key: string): T {
    const e = this.entries.get(key);
    if (!e || e.state !== 'ready') throw new Error(`Asset "${key}" is not loaded (state: ${e?.state ?? 'absent'})`);
    return e.value as T;
  }

  /** Keys currently resident (any state), with their scopes. */
  resident() { return [...this.entries.entries()].map(([k, e]) => ({ key: k, state: e.state, scopes: [...e.scopes], ms: e.loadMs })); }

  /** Tag already-resident keys with `scope` (so releasing another scope keeps them). */
  retain(scope: string, keys: string[]) {
    for (const k of keys) this.entries.get(k)?.scopes.add(scope);
  }

  /**
   * Load every key (tagging it with `scope`). Resolves when all are ready; progress reports byte-weighted
   * completion across the whole set, including keys another scope already had in flight.
   */
  acquire(scope: string, keys: string[], onProgress?: (p: LoadProgress) => void): Promise<void> {
    return this.acquireAll([{ scope, keys }], onProgress);
  }

  /** Several scopes under one progress report (initial boot: core + ambience + first floor). */
  async acquireAll(req: { scope: string; keys: string[] }[], onProgress?: (p: LoadProgress) => void): Promise<void> {
    const list: Entry[] = [];
    const seen = new Set<string>();
    for (const { scope, keys } of req) {
      for (const key of keys) {
        let e = this.entries.get(key);
        if (!e || e.state === 'failed') {
          const def = this.defs.get(key);
          if (!def) throw new Error(`Asset "${key}" has no registered definition`);
          e = this.start(def);
        }
        e.scopes.add(scope);
        if (!seen.has(key)) { seen.add(key); list.push(e); }
      }
    }
    const total = list.reduce((s, e) => s + Math.max(1, e.def.bytes), 0);
    let lastLabel = '';
    const report = () => {
      if (!onProgress) return;
      let loaded = 0, done = 0;
      for (const e of list) { loaded += Math.max(1, e.def.bytes) * (e.state === 'ready' ? 1 : e.progress); if (e.state === 'ready') done++; }
      const pending = list.find((e) => e.state === 'loading');
      if (pending) lastLabel = pending.def.label;
      onProgress({ loaded, total, fraction: total ? loaded / total : 1, label: lastLabel, done, count: list.length });
    };
    const timer = onProgress ? setInterval(report, 50) : 0;
    try {
      report();
      await Promise.all(list.map((e) => e.promise));
      report();
    } finally {
      if (timer) clearInterval(timer);
    }
  }

  /** Dispose one entry now regardless of scopes (resources consumed by their user, e.g. a floor's level GLB). */
  evict(key: string) {
    const e = this.entries.get(key);
    if (e?.state === 'ready') this.disposeEntry(key, e);
  }

  private start(def: AssetDef<any>): Entry {
    const e: Entry = { def, scopes: new Set(), state: 'loading', promise: Promise.resolve(), progress: 0, loadMs: 0 };
    const t0 = performance.now();
    e.promise = def.load((f) => { e.progress = Math.min(0.999, Math.max(e.progress, f)); }).then((v) => {
      e.value = v;
      e.state = 'ready';
      e.progress = 1;
      e.loadMs = Math.round(performance.now() - t0);
      // a scope may have been released while this was in flight
      if (!e.scopes.size) this.disposeEntry(def.key, e);
    }, (err) => {
      e.state = 'failed';
      e.error = err;
      this.entries.delete(def.key);
      throw new Error(`Failed to load asset "${def.key}": ${err?.message ?? err}`);
    });
    this.entries.set(def.key, e);
    return e;
  }

  /** Drop `scope` from every entry; dispose entries nobody references. Returns the disposed keys. */
  release(scope: string): string[] {
    const out: string[] = [];
    for (const [key, e] of [...this.entries]) {
      if (!e.scopes.delete(scope) || e.scopes.size) continue;
      if (e.state === 'ready') { this.disposeEntry(key, e); out.push(key); }
      // still loading: disposed when it lands (see start)
    }
    return out;
  }

  private disposeEntry(key: string, e: Entry) {
    try { e.def.dispose(e.value); } finally {
      this.entries.delete(key);
      e.value = undefined;
      this.disposedLog.push(key);
    }
  }

  /** Resident memory estimate by scope and in total. */
  stats() {
    let gpu = 0, cpu = 0;
    const byScope: Record<string, { keys: number; gpuMB: number; cpuMB: number }> = {};
    for (const e of this.entries.values()) {
      if (e.state !== 'ready') continue;
      const m = e.def.memory?.(e.value) ?? { gpu: 0, cpu: 0 };
      gpu += m.gpu; cpu += m.cpu;
      const sc = [...e.scopes].sort().join('+') || '(none)';
      const s = byScope[sc] ?? (byScope[sc] = { keys: 0, gpuMB: 0, cpuMB: 0 });
      s.keys++; s.gpuMB += m.gpu / 1e6; s.cpuMB += m.cpu / 1e6;
    }
    for (const s of Object.values(byScope)) { s.gpuMB = +s.gpuMB.toFixed(1); s.cpuMB = +s.cpuMB.toFixed(1); }
    return { entries: this.entries.size, gpuMB: +(gpu / 1e6).toFixed(1), cpuMB: +(cpu / 1e6).toFixed(1), byScope };
  }
}

// ------------------------------------------------------------------------------------------------ disposal
/** Dispose a texture and free its decoded image (ImageBitmaps hold their own memory until closed). */
export function disposeTexture(t: THREE.Texture) {
  t.dispose();
  const img = (t as any).image;
  if (img && typeof img.close === 'function') { try { img.close(); } catch { /* already closed */ } }
}

/**
 * Dispose everything an object graph owns: geometries, materials and (optionally) their textures, skeleton
 * bone textures. Shared resources must be excluded by the caller (pass `keep`).
 */
export function disposeObject(root: THREE.Object3D, opts: { textures?: boolean; keep?: Set<unknown> } = {}) {
  const keep = opts.keep;
  const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), texs = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !keep?.has(m.geometry)) geos.add(m.geometry);
    if (m.material) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (!keep?.has(mat)) mats.add(mat);
    const sk = (o as THREE.SkinnedMesh).skeleton;
    if (sk && !keep?.has(sk)) sk.dispose();
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
  });
  if (opts.textures) for (const mat of mats) materialTextures(mat, texs);
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) if (!keep?.has(t)) disposeTexture(t);
}

export function materialTextures(mat: THREE.Material, into = new Set<THREE.Texture>()) {
  for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) into.add(v as THREE.Texture);
  const u = (mat as THREE.ShaderMaterial).uniforms;
  if (u) for (const x of Object.values(u)) if ((x?.value as THREE.Texture)?.isTexture) into.add(x.value as THREE.Texture);
  return into;
}

/** GPU bytes estimate for a texture (compressed mip chain, or RGBA8 + mips). */
export function textureGpuBytes(t: THREE.Texture): number {
  const mips = (t as any).mipmaps as { data?: ArrayBufferView }[] | undefined;
  if ((t as THREE.CompressedTexture).isCompressedTexture && mips?.length) return mips.reduce((s, m) => s + (m.data?.byteLength ?? 0), 0);
  const img: any = (t as any).image;
  const w = img?.width ?? 0, h = img?.height ?? 0;
  return Math.round(w * h * 4 * (t.generateMipmaps !== false ? 4 / 3 : 1));
}

/** Geometry + texture memory of an object graph (unique resources). */
export function objectMemory(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>(), texs = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    if (m.material) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) materialTextures(mat, texs);
  });
  let geo = 0;
  for (const g of geos) {
    for (const a of Object.values(g.attributes)) geo += (a as THREE.BufferAttribute).array.byteLength;
    if (g.index) geo += g.index.array.byteLength;
    for (const list of Object.values(g.morphAttributes)) for (const a of list) geo += (a as THREE.BufferAttribute).array.byteLength;
  }
  let tex = 0;
  for (const t of texs) tex += textureGpuBytes(t);
  return { gpu: geo + tex, cpu: geo };
}

// ------------------------------------------------------------------------------------------------ loaders
/** fetch with streamed progress (Content-Length or the expected size). */
export async function fetchBytes(url: string, expected: number, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || expected || 0;
  if (!res.body || !total) { const b = await res.arrayBuffer(); onProgress(1); return b; }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out.buffer;
}
