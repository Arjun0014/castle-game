#!/usr/bin/env node
// Opening-cinematic sound design + orchestral texture stems via ElevenLabs sound generation (build-time only).
//
//   node tools/cinematic/gen_sfx.mjs [id ...] [--list]
//
// Specs live in tools/cinematic/sfx.json ({id, prompt, duration, influence, variants}). Existing files are kept
// (delete one to regenerate it). Output: assets/audio/cinematic/sfx/<id>_<n>.mp3 + MANIFEST.json (prompt, credits).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, soundEffect, creditsUsed } from './el_client.mjs';

const SPECS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cinematic/sfx.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets/audio/cinematic/sfx');
fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'MANIFEST.json');
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const s of SPECS) console.log(`${s.id} x${s.variants ?? 1} ${s.duration}s: ${Array.from({ length: s.variants ?? 1 }, (_, i) => fs.existsSync(path.join(OUT, `${s.id}_${i}.mp3`)) ? 'ok' : '--').join(' ')}`);
  process.exit(0);
}
const want = args.filter((a) => !a.startsWith('--'));
let made = 0;
const c0 = await creditsUsed();
for (const s of SPECS) {
  if (want.length && !want.includes(s.id)) continue;
  for (let i = 0; i < (s.variants ?? 1); i++) {
    const f = path.join(OUT, `${s.id}_${i}.mp3`);
    if (fs.existsSync(f)) continue;
    try {
      const buf = await soundEffect({ text: s.prompt, duration: s.duration, influence: s.influence ?? 0.55, loop: !!s.loop });
      fs.writeFileSync(f, buf);
      man[path.basename(f)] = { id: s.id, prompt: s.prompt, duration: s.duration, influence: s.influence ?? 0.55, generated: new Date().toISOString(), bytes: buf.length, source: 'ElevenLabs sound generation (eleven_text_to_sound_v2), free tier' };
      made++;
      console.log(`ok   ${path.basename(f)} ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      console.log(`FAIL ${path.basename(f)}: ${String(e.message).slice(0, 200)}`);
    }
  }
}
fs.writeFileSync(manPath, JSON.stringify(man, null, 1) + '\n');
await new Promise((r) => setTimeout(r, 3000));
const c1 = await creditsUsed();
console.log(`generated ${made}; credits ~${c1.used - c0.used} (account ${c1.used}/${c1.limit})`);
