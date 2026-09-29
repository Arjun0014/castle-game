#!/usr/bin/env node
// ElevenLabs sound-effect generation (build-time tool only).
//
//   node tools/elevenlabs_sfx.mjs [id ...]          generate missing variants (all specs, or only the listed ids)
//   node tools/elevenlabs_sfx.mjs --list             show specs and which files exist
//
// The API key is read from ELEVENLABS_API_KEY in the repository-root .env (or the environment). It is used
// only for the HTTPS request below — never printed, never written anywhere, never exposed to client code
// (no VITE_ prefix; the browser build does not read .env). Output: assets/audio/elevenlabs/<id>_<n>.mp3 plus
// assets/audio/elevenlabs/MANIFEST.json (prompt, duration, date per file — provenance for SOURCES.md).
// tools/build_audio.py turns these into runtime OGGs like every other source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'audio', 'elevenlabs');
const SPECS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'elevenlabs_sfx.json'), 'utf8'));

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = path.join(ROOT, '.env');
  if (!fs.existsSync(env)) throw new Error('ELEVENLABS_API_KEY not set and no .env at the repository root');
  for (const line of fs.readFileSync(env, 'utf8').split(/\r?\n/)) {
    const m = /^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (m) return m[1].replace(/^['"]|['"]$/g, '');
  }
  throw new Error('ELEVENLABS_API_KEY missing from .env');
}

async function generate(key, spec) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: spec.prompt, duration_seconds: spec.duration, prompt_influence: spec.influence ?? 0.5 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

const args = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'MANIFEST.json');
const manifest = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
if (args.includes('--list')) {
  for (const s of SPECS) console.log(`${s.id} ×${s.variants}: ${Array.from({ length: s.variants }, (_, i) => fs.existsSync(path.join(OUT, `${s.id}_${i}.mp3`)) ? 'ok' : '--').join(' ')}  "${s.prompt}"`);
  process.exit(0);
}
const key = apiKey();
const want = args.filter((a) => !a.startsWith('--'));
let made = 0, failed = 0;
for (const s of SPECS) {
  if (want.length && !want.includes(s.id)) continue;
  for (let i = 0; i < s.variants; i++) {
    const file = path.join(OUT, `${s.id}_${i}.mp3`);
    if (fs.existsSync(file)) continue;
    try {
      const buf = await generate(key, s);
      fs.writeFileSync(file, buf);
      manifest[path.basename(file)] = { id: s.id, prompt: s.prompt, duration: s.duration, influence: s.influence ?? 0.5, generated: new Date().toISOString(), bytes: buf.length, source: 'ElevenLabs sound-generation API' };
      made++;
      console.log(`ok   ${path.basename(file)} ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${path.basename(file)}: ${e.message}`);
    }
  }
}
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 1) + '\n');
console.log(`generated ${made}, failed ${failed}`);
if (failed) process.exit(1);
