/**
 * KTX2 vs current (JPEG/PNG) benchmark — dev only (http://localhost:<port>/dev/ktx2bench.html).
 * Files: build/ktx2eval (produced by the scratch encoder: ETC1S + UASTC variants and lossless reference PNGs).
 * Per texture: download bytes, decode/transcode ms, GPU upload ms (synchronised with a readback), GPU bytes,
 * sampling cost (timer query, full-screen tiled trilinear+aniso draws), and quality vs the lossless reference
 * (PSNR; mean angular error for normal maps).
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const BASE = '/build/ktx2eval/';
const CASES = [
  { name: 'wall_diff', current: 'stone_wall_diff.jpg', kind: 'color' },
  { name: 'wall_nor', current: 'stone_wall_nor.jpg', kind: 'normal' },
  { name: 'wall_arm', current: 'stone_wall_arm.jpg', kind: 'data' },
  { name: 'grass', current: 'grass_src.png', kind: 'color' },
  { name: 'plants', current: 'plants_src.png', kind: 'color' },
  { name: 'hero_diff', current: 'hero_diff_src.jpg', kind: 'color' },
  { name: 'hero_nor', current: 'hero_nor_src.jpg', kind: 'normal' },
];
const out = document.getElementById('out')!;
const log = (s: string) => { out.textContent += s + '\n'; console.log(s); };
out.textContent = '';

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(1600, 900, false);
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext() as WebGL2RenderingContext;
const timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
const ktx2 = new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);

const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const mat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, tile: { value: 1 }, lod0: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D map; uniform float tile; uniform float lod0; varying vec2 vUv; void main(){ vec2 uv = vUv * tile; gl_FragColor = lod0 > 0.5 ? textureLod(map, uv, 0.0) : texture2D(map, uv); }',
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
scene.add(quad);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

async function fetchBytes(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }

async function loadImageTex(url: string) {
  const bytes = await fetchBytes(url);
  const t0 = performance.now();
  const bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const decodeMs = performance.now() - t0;
  const t = new THREE.Texture(bmp as any);
  t.flipY = false; t.needsUpdate = true;
  return { t, bytes: bytes.byteLength, decodeMs, w: bmp.width, h: bmp.height };
}
async function loadKtx(url: string) {
  const bytes = await fetchBytes(url);
  const t0 = performance.now();
  const t = await new Promise<THREE.CompressedTexture>((res, rej) => ktx2.parse(bytes, res as any, rej));
  const decodeMs = performance.now() - t0;
  return { t, bytes: bytes.byteLength, decodeMs, w: (t.image as any).width, h: (t.image as any).height };
}

function gpuBytes(t: THREE.Texture) {
  const mips = (t as any).mipmaps as { data: ArrayBufferView }[];
  if ((t as THREE.CompressedTexture).isCompressedTexture) return mips.reduce((s, m) => s + m.data.byteLength, 0);
  const img = t.image as any;
  return Math.round(img.width * img.height * 4 * 4 / 3);
}

const syncRT = new THREE.WebGLRenderTarget(1, 1);
function syncGpu() {
  const buf = new Uint8Array(4);
  renderer.setRenderTarget(syncRT); renderer.render(scene, cam);
  renderer.readRenderTargetPixels(syncRT, 0, 0, 1, 1, buf);
  renderer.setRenderTarget(null);
}

/** upload (CPU call + GPU completion via readback of a draw that samples it) */
function upload(t: THREE.Texture) {
  mat.uniforms.map.value = t; mat.uniforms.tile.value = 1; mat.uniforms.lod0.value = 1;
  syncGpu(); // flush anything pending first
  const t0 = performance.now();
  renderer.initTexture(t);
  const cpu = performance.now() - t0;
  syncGpu();
  return { cpuMs: cpu, totalMs: performance.now() - t0 };
}

function readTexels(t: THREE.Texture, w: number, h: number) {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  mat.uniforms.map.value = t; mat.uniforms.tile.value = 1; mat.uniforms.lod0.value = 1;
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null);
  rt.dispose();
  return px;
}

function psnr(a: Uint8Array, b: Uint8Array, channels = 3) {
  let se = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) for (let c = 0; c < channels; c++) { const d = a[i + c] - b[i + c]; se += d * d; n++; }
  const mse = se / n;
  return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse);
}
function normalErrDeg(a: Uint8Array, b: Uint8Array) {
  let sum = 0, n = 0, max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ax = a[i] / 127.5 - 1, ay = a[i + 1] / 127.5 - 1, az = a[i + 2] / 127.5 - 1;
    const bx = b[i] / 127.5 - 1, by = b[i + 1] / 127.5 - 1, bz = b[i + 2] / 127.5 - 1;
    const la = Math.hypot(ax, ay, az) || 1, lb = Math.hypot(bx, by, bz) || 1;
    const d = Math.min(1, Math.max(-1, (ax * bx + ay * by + az * bz) / (la * lb)));
    const ang = Math.acos(d) * 180 / Math.PI;
    sum += ang; n++; max = Math.max(max, ang);
  }
  return { mean: sum / n, max };
}

/** GPU ms for N full-screen tiled trilinear/anisotropic draws sampling t (bandwidth-bound) */
async function samplingCost(t: THREE.Texture, draws = 40) {
  if (!timerExt) return null;
  t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  mat.uniforms.map.value = t; mat.uniforms.tile.value = 6; mat.uniforms.lod0.value = 0;
  renderer.render(scene, cam);
  syncGpu();
  const q = gl.createQuery()!;
  gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q);
  for (let i = 0; i < draws; i++) renderer.render(scene, cam);
  gl.endQuery(timerExt.TIME_ELAPSED_EXT);
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / draws;
  }
  return null;
}

const results: any[] = [];
(async () => {
  log(`renderer: ${gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')!.UNMASKED_RENDERER_WEBGL)}`);
  log('ktx2 support: ' + JSON.stringify((ktx2 as any).workerConfig));
  for (const c of CASES) {
    const ref = await loadImageTex(BASE + c.name + '_ref.png');
    upload(ref.t);
    const refPx = readTexels(ref.t, ref.w, ref.h);
    const variants: [string, () => Promise<{ t: THREE.Texture; bytes: number; decodeMs: number; w: number; h: number }>][] = [
      ['current', () => loadImageTex(BASE + c.current)],
      ['etc1s', () => loadKtx(BASE + c.name + '_etc1s.ktx2')],
      ['uastc', () => loadKtx(BASE + c.name + '_uastc.ktx2')],
    ];
    for (const [label, load] of variants) {
      const runs: { decode: number; upCpu: number; upTotal: number }[] = [];
      let last: any = null;
      for (let k = 0; k < 3; k++) {
        const v = await load();
        v.t.colorSpace = THREE.NoColorSpace; // raw texel values for comparison
        const up = upload(v.t);
        runs.push({ decode: v.decodeMs, upCpu: up.cpuMs, upTotal: up.totalMs });
        if (last) last.t.dispose();
        last = v;
      }
      const med = (f: (r: typeof runs[0]) => number) => runs.map(f).sort((a, b) => a - b)[1];
      const px = readTexels(last.t, ref.w, ref.h);
      const q = c.kind === 'normal' ? normalErrDeg(refPx, px) : null;
      const sample = await samplingCost(last.t);
      const fmt = (last.t as any).format;
      const row = {
        tex: c.name, variant: label, size: `${last.w}x${last.h}`, fileKB: +(last.bytes / 1024).toFixed(0),
        decodeMs: +med((r) => r.decode).toFixed(1), uploadCpuMs: +med((r) => r.upCpu).toFixed(1), uploadTotalMs: +med((r) => r.upTotal).toFixed(1),
        gpuMB: +(gpuBytes(last.t) / 1e6).toFixed(2), psnr: +psnr(refPx, px, c.name === 'plants' || c.name === 'grass' ? 4 : 3).toFixed(2),
        normalErrMean: q ? +q.mean.toFixed(2) : undefined, normalErrMax: q ? +q.max.toFixed(1) : undefined,
        sampleMsPerDraw: sample !== null ? +sample.toFixed(3) : null, glFormat: fmt,
      };
      results.push(row);
      log(JSON.stringify(row));
      last.t.dispose();
    }
    ref.t.dispose();
  }
  (window as any).__ktxResults = results;
  log('DONE');
})().catch((e) => { log('ERROR ' + e.stack); (window as any).__ktxError = String(e); });
