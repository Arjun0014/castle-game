#!/usr/bin/env node
// Opening-cinematic narration (ElevenLabs v3, build-time only).
//
//   node tools/cinematic/gen_narration.mjs <take> [--stability 0.5] [--seed 11]
//
// Sends the whole script (tools/cinematic/narration.json) as ONE v3 request so the model hears the emotional arc
// from reverent to intimate, then splits it per line with the returned character alignment. Every take is checked
// with Scribe speech-to-text (missing/extra words, audio tags read aloud).
// Output: assets/audio/cinematic/narration/<take>.mp3 + <take>.json (alignment, per-line times, transcript, QA).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ttsWithTimestamps, transcribe, creditsUsed } from './el_client.mjs';

const args = process.argv.slice(2);
const take = args[0];
if (!take) { console.error('usage: gen_narration.mjs <take> [--stability s] [--seed n]'); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const stability = Number(opt('stability', 0.5));
const seed = Number(opt('seed', 11));

const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cinematic/narration.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets/audio/cinematic/narration');
fs.mkdirSync(OUT, { recursive: true });

// request text + each line's character range inside it
let text = '';
const ranges = [];
for (const l of script.lines) {
  if (text) text += '\n\n';
  ranges.push({ id: l.id, from: text.length, to: text.length + l.tts.length });
  text += l.tts;
}

const c0 = await creditsUsed();
const res = await ttsWithTimestamps({ voiceId: script.voice.id, text, modelId: script.voice.model, stability, seed });
const mp3 = path.join(OUT, `${take}.mp3`);
fs.writeFileSync(mp3, res.audio);

// per-line spoken span: first/last letter outside [tags]
const al = res.alignment;
const chars = al.characters;
// alignment may drop or normalise characters; map request offsets -> alignment indices by walking both strings
const map = new Array(text.length).fill(-1);
{
  let j = 0;
  for (let i = 0; i < text.length && j < chars.length; i++) {
    if (text[i] === chars[j]) { map[i] = j; j++; }
  }
}
const inTag = new Array(text.length).fill(false);
{ let depth = 0; for (let i = 0; i < text.length; i++) { if (text[i] === '[') depth++; inTag[i] = depth > 0; if (text[i] === ']') depth = Math.max(0, depth - 1); } }
const lines = ranges.map((r) => {
  let a = -1, b = -1;
  for (let i = r.from; i < r.to; i++) if (!inTag[i] && /[A-Za-z]/.test(text[i]) && map[i] >= 0) { a = map[i]; break; }
  for (let i = r.to - 1; i >= r.from; i--) if (!inTag[i] && /[A-Za-z]/.test(text[i]) && map[i] >= 0) { b = map[i]; break; }
  return { id: r.id, start: a >= 0 ? al.character_start_times_seconds[a] : null, end: b >= 0 ? al.character_end_times_seconds[b] : null };
});

let stt = null, qa = null;
try {
  stt = await transcribe(mp3);
  const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const said = norm(stt.text);
  const expected = norm(script.lines.map((l) => l.text.replace(/Veyr/g, 'Vair').replace(/Vaelor/g, 'Vaylor').replace(/Caer/g, 'Kair')).join(' '));
  const events = (stt.words || []).filter((w) => w.type === 'audio_event').map((w) => w.text);
  const tagWords = ['slowly', 'softly', 'reverently', 'quietly', 'gravely', 'uneasy', 'hushed', 'whispers', 'sorrowful', 'mournfully', 'tenderly'];
  qa = { saidWords: said.length, expectedWords: expected.length, tagsSpoken: said.filter((w) => tagWords.includes(w)), events };
} catch (e) { qa = { error: String(e.message || e) }; }

const c1 = await creditsUsed();
const rec = { take, voice: script.voice.id, model: script.voice.model, stability, seed, generated: new Date().toISOString(), creditsCharged: c1.used - c0.used, text, lines, alignment: al, transcript: stt?.text ?? null, words: stt?.words ?? null, qa };
fs.writeFileSync(path.join(OUT, `${take}.json`), JSON.stringify(rec, null, 1));
console.log(`take ${take}: ${(res.audio.length / 1024).toFixed(0)} KB, credits charged ~${c1.used - c0.used} (account ${c1.used}/${c1.limit})`);
for (const l of lines) console.log(`  ${l.id}  ${l.start?.toFixed(2)} -> ${l.end?.toFixed(2)}  (${(l.end - l.start).toFixed(2)} s)`);
console.log('  transcript:', stt?.text);
console.log('  qa:', JSON.stringify(qa));
