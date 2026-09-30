import * as THREE from 'three';

/**
 * Frame profiler (always on, cheap). Records per frame:
 *  - wall interval between frames, CPU time of the simulation step and of renderer.render,
 *  - GPU time of the render (EXT_disjoint_timer_query_webgl2 when the browser exposes it),
 *  - deltas of renderer.info (programs compiled, textures uploaded, geometries created),
 *  - free-form marks pushed by gameplay code this frame (spawns, shifts, loads).
 * Frames over SPIKE_MS are kept in `spikes` with everything above so a stall can be attributed.
 *
 * Console: __perf.report(), __perf.reset(), __perf.snapshot(), __perf.spikes
 */
const RING = 1200;
const SPIKE_MS = 24;

export interface Spike {
  t: number; frame: number; wallMs: number; stepMs: number; renderMs: number; gpuMs: number | null;
  programs: number; textures: number; geometries: number; marks: string[];
}

export class Perf {
  wall = new Float32Array(RING);
  step = new Float32Array(RING);
  render = new Float32Array(RING);
  gpu = new Float32Array(RING).fill(-1);
  n = 0;
  frame = 0;
  spikes: Spike[] = [];
  private marks: string[] = [];
  private last = 0;
  private stepT0 = 0;
  private stepMs = 0;
  private renderT0 = 0;
  private info0 = { programs: 0, textures: 0, geometries: 0 };
  private gl: WebGL2RenderingContext;
  private ext: any;
  private queries: { q: WebGLQuery; slot: number }[] = [];
  private freeQ: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  longTasks: { t: number; ms: number }[] = [];
  enabled = true;
  /** set by Game: live counters for snapshots */
  counters: () => Record<string, number> = () => ({});

  constructor(private renderer: THREE.WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    try {
      const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) this.longTasks.push({ t: e.startTime, ms: e.duration }); if (this.longTasks.length > 200) this.longTasks.splice(0, 100); });
      po.observe({ type: 'longtask', buffered: false } as PerformanceObserverInit);
    } catch { /* longtask not supported */ }
    (window as any).__perf = this;
  }

  get gpuTimer() { return !!this.ext; }

  mark(s: string) { if (this.enabled) this.marks.push(s); }

  beginStep() { this.stepT0 = performance.now(); }
  endStep() { this.stepMs = performance.now() - this.stepT0; }

  beginRender() {
    const i = this.renderer.info;
    this.info0.programs = i.programs?.length ?? 0;
    this.info0.textures = i.memory.textures;
    this.info0.geometries = i.memory.geometries;
    this.renderT0 = performance.now();
    if (this.ext && !this.active) {
      const q = this.freeQ.pop() ?? this.gl.createQuery();
      if (q) { this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.active = q; }
    }
  }

  endRender() {
    const now = performance.now();
    const renderMs = now - this.renderT0;
    const slot = this.n % RING;
    if (this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.queries.push({ q: this.active, slot });
      this.active = null;
    }
    this.pollQueries();
    const wallMs = this.last ? now - this.last : 0;
    this.last = now;
    this.wall[slot] = wallMs;
    this.step[slot] = this.stepMs;
    this.render[slot] = renderMs;
    this.gpu[slot] = -1;
    const i = this.renderer.info;
    const dp = (i.programs?.length ?? 0) - this.info0.programs;
    const dt = i.memory.textures - this.info0.textures;
    const dg = i.memory.geometries - this.info0.geometries;
    if (this.enabled && (wallMs > SPIKE_MS || this.stepMs + renderMs > SPIKE_MS * 0.75 || dp > 0 || dt > 0)) {
      this.spikes.push({ t: now, frame: this.frame, wallMs: +wallMs.toFixed(1), stepMs: +this.stepMs.toFixed(1), renderMs: +renderMs.toFixed(1), gpuMs: null, programs: dp, textures: dt, geometries: dg, marks: this.marks.slice() });
      if (this.spikes.length > 400) this.spikes.splice(0, 200);
    }
    this.marks.length = 0;
    this.stepMs = 0;
    this.n++;
    this.frame++;
  }

  private pollQueries() {
    const gl = this.gl;
    if (!this.ext || !this.queries.length) return;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.queries.length) {
      const { q, slot } = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      this.queries.shift();
      this.freeQ.push(q);
      if (!disjoint) {
        this.gpu[slot] = ns / 1e6;
        const sp = this.spikes.length ? this.spikes[this.spikes.length - 1] : null;
        if (sp && sp.frame === this.frame - (this.n - 1 - slot)) sp.gpuMs = +(ns / 1e6).toFixed(2);
      }
    }
  }

  reset() {
    this.n = 0; this.spikes.length = 0; this.longTasks.length = 0; this.last = 0;
    this.gpu.fill(-1);
  }

  private stats(arr: Float32Array, count: number, skipNeg = false) {
    const v: number[] = [];
    for (let i = 0; i < count; i++) { const x = arr[i]; if (skipNeg && x < 0) continue; v.push(x); }
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    const avg = v.reduce((s, x) => s + x, 0) / v.length;
    return { avg: +avg.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +v[v.length - 1].toFixed(2), n: v.length };
  }

  /** p50 / p95 of the last `k` frames of one series (the on-device `?perf` readout) */
  recent(series: 'wall' | 'step' | 'render' | 'gpu', k = 120) {
    const arr = this[series], v: number[] = [];
    for (let i = 1; i <= Math.min(k, this.n); i++) { const x = arr[(this.n - i) % RING]; if (x >= 0) v.push(x); }
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    return { p50: v[Math.floor(v.length * 0.5)], p95: v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] };
  }

  /** Summary of the frames recorded since the last reset (up to RING). */
  report() {
    const count = Math.min(this.n, RING);
    const wall = this.stats(this.wall.subarray(1), Math.max(0, count - 1));
    let over33 = 0, over50 = 0;
    for (let i = 1; i < count; i++) { if (this.wall[i] > 33.4) over33++; if (this.wall[i] > 50) over50++; }
    return {
      frames: count, wall, step: this.stats(this.step, count), render: this.stats(this.render, count), gpu: this.stats(this.gpu, count, true),
      over33, over50, spikes: this.spikes.filter((s) => s.wallMs > SPIKE_MS || s.stepMs + s.renderMs > SPIKE_MS * 0.75).length,
      compiles: this.spikes.reduce((s, x) => s + x.programs, 0), uploads: this.spikes.reduce((s, x) => s + x.textures, 0),
      longTasks: this.longTasks.length, worstLongTask: this.longTasks.reduce((m, x) => Math.max(m, x.ms), 0),
      snapshot: this.snapshot(),
    };
  }

  snapshot() {
    const i = this.renderer.info;
    const mem = (performance as any).memory;
    return {
      heapMB: mem ? +(mem.usedJSHeapSize / 1e6).toFixed(1) : null,
      programs: i.programs?.length ?? 0, textures: i.memory.textures, geometries: i.memory.geometries,
      calls: i.render.calls, tris: i.render.triangles,
      ...this.counters(),
    };
  }
}

/** Estimated GPU bytes of a texture (mip chain included; compressed formats by block size). */
export function textureBytes(t: THREE.Texture): number {
  const img: any = (t as any).image;
  const mips = (t as any).mipmaps as { data?: ArrayBufferView; width: number; height: number }[] | undefined;
  if ((t as THREE.CompressedTexture).isCompressedTexture && mips?.length) {
    return mips.reduce((s, m) => s + (m.data?.byteLength ?? 0), 0);
  }
  const w = img?.width ?? 0, h = img?.height ?? 0;
  if (!w || !h) return 0;
  return Math.round(w * h * 4 * (t.generateMipmaps ? 1.333 : 1));
}

/** Unique textures reachable from an object graph's materials. */
export function collectTextures(root: THREE.Object3D, into = new Set<THREE.Texture>()) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) into.add(v as THREE.Texture);
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u) for (const x of Object.values(u)) if ((x?.value as THREE.Texture)?.isTexture) into.add(x.value);
    }
  });
  return into;
}
