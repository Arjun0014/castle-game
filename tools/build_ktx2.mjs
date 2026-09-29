#!/usr/bin/env node
// KTX2 (Basis Universal) texture pipeline — `npm run assets:ktx2` (≈10 min on 12 threads; deterministic, idempotent).
//
// Outputs (the originals stay; the runtime prefers these and `?tex=jpg` forces the originals for A/B tests):
//   public/assets/ktx2/textures/<set>_{diff,nor,arm}.ktx2   from the Poly Haven sources in assets/extracted/materials
//   public/assets/ktx2/characters/*.glb, vegetation/*.glb      same GLBs with KHR_texture_basisu textures
// and adds a `ktx2` entry per set to src/data/textureLibrary.json.
//
// Settings (benchmark: build/reports/ktx2_*.json):
//   colour (diffuse / baseColor / emissive)  UASTC + RDO + Zstd, sRGB        (≈ +11 dB PSNR vs the old JPEGs)
//   normal maps                              UASTC + RDO + Zstd, linear, normal-map mode
//   ORM / metallicRoughness / occlusion      ETC1S, linear (low-frequency data)
//   level textures are Y-flipped at encode time (the runtime's TextureLoader convention was flipY = true);
//   glTF textures are not (glTF UV convention).
// On desktop GPUs both UASTC and ETC1S transcode to BC7 (1 byte/texel incl. alpha): 4x less VRAM than RGBA8,
// with precomputed mips (no runtime generateMipmap).
//
// Usage: node tools/build_ktx2.mjs [--jobs 10] [--only textures|glb] [--force]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const OUT = path.join(PUB, 'assets', 'ktx2');
const LIB = path.join(ROOT, 'src', 'data', 'textureLibrary.json');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FORCE = args.includes('--force');

// source sets: runtime key -> (category, folder, stem) — mirrors tools/build_textures.py
const SETS = {
  stone_wall: ['stone', 'stone_wall_04_1k', 'stone_wall_04'], stone_block: ['stone', 'japanese_stone_wall_1k', 'japanese_stone_wall'],
  marble: ['stone', 'marble_01_1k', 'marble_01'], rock: ['stone', 'dark_rock_02_1k', 'dark_rock_02'], terrain: ['stone', 'rocky_terrain_03_1k', 'rocky_terrain_03'],
  wood_fine: ['wood', 'coated_pine_02_1k', 'coated_pine_02'], wood_rough: ['wood', 'rough_wood_1k', 'rough_wood'], wood_planks: ['wood', 'wood_planks_dirt_1k', 'wood_planks_dirt'],
  wood_moss: ['wood', 'moss_wood_1k', 'moss_wood'], wood_door: ['wood', 'wood_shutter_1k', 'wood_shutter'],
  iron: ['metal', 'metal_plate_02_1k', 'metal_plate_02'], rust: ['metal', 'rust_coarse_01_1k', 'rust_coarse_01'], rust_plate: ['metal', 'rusty_metal_04_1k', 'rusty_metal_04'],
  fabric_royal: ['fabric', 'quatrefoil_jacquard_fabric_1k', 'quatrefoil_jacquard_fabric'], fabric_gold: ['fabric', 'crepe_satin_1k', 'crepe_satin'], fabric_linen: ['fabric', 'rough_linen_1k', 'rough_linen'],
};
const GLBS = ['characters/hero.glb', 'characters/knight.glb', 'characters/hollow.glb', 'characters/archer.glb', 'characters/ghost.glb', 'characters/boss.glb',
  'vegetation/low_poly_grass.glb', 'vegetation/low_poly_grass_pack.glb', 'vegetation/low_poly_glowing_flower.glb'];

const COLOR = { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true, generateMipmap: true };
const NORMAL = { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false, generateMipmap: true };
const DATA = { isUASTC: false, qualityLevel: 200, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false, generateMipmap: true };

// ------------------------------------------------------------------------------------------ worker side
async function decodeWithPillow(input, size) {
  const py = "import sys,io\nfrom PIL import Image\ndata=sys.stdin.buffer.read()\nim=Image.open(io.BytesIO(data)).convert('RGBA')\ns=int(sys.argv[1])\nif s and im.size!=(s,s): im=im.resize((s,s),Image.LANCZOS)\nsys.stdout.buffer.write(im.size[0].to_bytes(4,'little')+im.size[1].to_bytes(4,'little')+im.tobytes())";
  const out = execFileSync('python', ['-c', py, String(size ?? 0)], { input: Buffer.from(input), maxBuffer: 1 << 28 });
  return { width: out.readUInt32LE(0), height: out.readUInt32LE(4), data: new Uint8Array(out.buffer, out.byteOffset + 8, out.length - 8) };
}

async function encode(bytes, opts, size) {
  const { encodeToKTX2 } = await import('ktx2-encoder');
  return encodeToKTX2(new Uint8Array(bytes), { ...opts, imageDecoder: (b) => decodeWithPillow(b, size) });
}

async function runJob(job) {
  const t0 = Date.now();
  if (job.type === 'tex') {
    const opts = { ...(job.kind === 'nor' ? NORMAL : job.kind === 'arm' ? DATA : COLOR), isYFlip: true };
    const out = await encode(fs.readFileSync(job.src), opts, job.size);
    fs.mkdirSync(path.dirname(job.dst), { recursive: true });
    fs.writeFileSync(job.dst, out);
    return `${path.relative(PUB, job.dst)} ${(out.byteLength / 1024).toFixed(0)} KB ${((Date.now() - t0) / 1000).toFixed(1)} s`;
  }
  // glb: re-encode every texture per slot
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, KHRTextureBasisu } = await import('@gltf-transform/extensions');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(job.src);
  let n = 0;
  for (const tex of doc.getRoot().listTextures()) {
    if (tex.getMimeType() === 'image/ktx2') continue;
    const slots = doc.getGraph().listParentEdges(tex).map((e) => e.getName());
    const normal = slots.some((s) => /normal/i.test(s));
    const color = slots.some((s) => /baseColor|emissive|diffuse/i.test(s));
    const opts = normal ? NORMAL : color ? COLOR : DATA;
    tex.setImage(await encode(tex.getImage(), { ...opts, isYFlip: false }, 0));
    tex.setMimeType('image/ktx2');
    if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g|webp)$/i, '.ktx2'));
    n++;
  }
  if (n) doc.createExtension(KHRTextureBasisu).setRequired(true);
  fs.mkdirSync(path.dirname(job.dst), { recursive: true });
  await io.write(job.dst, doc);
  return `${path.relative(PUB, job.dst)} ${n} textures ${(fs.statSync(job.dst).size / 1e6).toFixed(2)} MB (was ${(fs.statSync(job.src).size / 1e6).toFixed(2)} MB) ${((Date.now() - t0) / 1000).toFixed(1)} s`;
}

if (process.env.KTX2_WORKER) {
  process.on('message', async (job) => {
    try { process.send({ ok: true, msg: await runJob(job) }); } catch (e) { process.send({ ok: false, msg: `${job.dst}: ${e.stack ?? e}` }); }
  });
} else {
  // ------------------------------------------------------------------------------------------ driver
  const only = arg('--only', 'all');
  const jobs = [];
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  if (only !== 'glb') {
    for (const [key, [cat, folder, stem]] of Object.entries(SETS)) {
      const src = path.join(ROOT, 'assets', 'extracted', 'materials', cat, folder, 'textures');
      const files = { diff: [`${stem}_diff_1k.jpg`, 1024], nor: [`${stem}_nor_gl_1k.png`, 1024], arm: [`${stem}_arm_1k.png`, 512] };
      const ktx = {};
      for (const [kind, [file, size]] of Object.entries(files)) {
        const dst = path.join(OUT, 'textures', `${key}_${kind}.ktx2`);
        ktx[kind] = `assets/ktx2/textures/${key}_${kind}.ktx2`;
        if (!FORCE && fs.existsSync(dst)) continue;
        if (!fs.existsSync(path.join(src, file))) throw new Error('missing source ' + path.join(src, file) + ' (run python tools/extract_assets.py)');
        jobs.push({ type: 'tex', kind, src: path.join(src, file), size, dst });
      }
      if (lib[key]) lib[key].ktx2 = ktx;
    }
  }
  if (only !== 'textures') {
    for (const rel of GLBS) {
      const dst = path.join(OUT, rel);
      if (!FORCE && fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(path.join(PUB, 'assets', rel)).mtimeMs) continue;
      jobs.push({ type: 'glb', src: path.join(PUB, 'assets', rel), dst });
    }
  }
  // biggest first (the 2048² hero textures dominate)
  jobs.sort((a, b) => fs.statSync(b.src).size - fs.statSync(a.src).size);
  const nJobs = Math.min(Number(arg('--jobs', Math.max(1, os.cpus().length - 2))), jobs.length);
  console.log(`${jobs.length} jobs on ${nJobs} processes`);
  let next = 0, failed = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: nJobs }, () => new Promise((resolve) => {
    const w = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, KTX2_WORKER: '1' }, stdio: ['inherit', 'ignore', 'inherit', 'ipc'] });
    const feed = () => { if (next < jobs.length) w.send(jobs[next++]); else { w.kill(); resolve(); } };
    w.on('message', (m) => { console.log((m.ok ? 'ok   ' : 'FAIL ') + m.msg); if (!m.ok) failed++; feed(); });
    feed();
  })));
  if (only !== 'glb') fs.writeFileSync(LIB, JSON.stringify(lib, null, 1) + '\n');
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${failed} failed`);
  if (failed) process.exit(1);
}
