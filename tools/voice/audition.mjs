#!/usr/bin/env node
// Heroine voice auditions (ElevenLabs v3, build time). The same short script — quiet awe, dry humour, tension,
// anger — read by each candidate voice with identical settings, then transcribed by Scribe for QA.
//   node tools/voice/audition.mjs [voiceName ...]
// Output: assets/audio/voice/auditions/<name>.mp3 + .json (alignment, transcript, credits). Analysis:
// python tools/voice/analyze.py.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, tts, transcribe, credits } from './el.mjs';

export const AUDITION_TEXT = '[quietly] That gate was whole... for a heartbeat. [sighs] Sealed again. Of course. [tense] Here they come. [angry] He did this. My own blood did this.';
// premade voices usable on this account's tier (library voices answer 402 through the API on the free tier)
export const CANDIDATES = {
  lily: 'pFZP5JQG7iQjIQuC4Bku',     // British, velvety, "actress"
  alice: 'Xb7hH8MSUJpSbSDYk0k2',    // British, clear
  sarah: 'EXAVITQu4vr4xnSDxMaL',    // young adult, warm, confident (American)
  matilda: 'XrExE9yKIg1WjnnlVkGX',  // alto (American)
};
const OUT = path.join(ROOT, 'assets/audio/voice/auditions');
fs.mkdirSync(OUT, { recursive: true });
const pick = process.argv.slice(2);
for (const [name, voiceId] of Object.entries(CANDIDATES)) {
  if (pick.length && !pick.includes(name)) continue;
  const mp3 = path.join(OUT, name + '.mp3');
  if (fs.existsSync(mp3)) { console.log(name, 'exists — skipped'); continue; }
  const c0 = await credits();
  const r = await tts({ voiceId, text: AUDITION_TEXT, stability: 0.5, seed: 7 });
  fs.writeFileSync(mp3, r.audio);
  const c1 = await credits();
  let stt = null;
  try { stt = await transcribe(mp3); } catch (e) { stt = { error: String(e.message || e) }; }
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ name, voiceId, model: 'eleven_v3', stability: 0.5, seed: 7, text: AUDITION_TEXT, charged: c1.used - c0.used, account: c1, alignment: r.alignment, transcript: stt?.text ?? null, words: stt?.words ?? null, sttError: stt?.error }, null, 1));
  console.log(`${name}: ${(r.audio.length / 1024).toFixed(0)} KB, charged ${c1.used - c0.used}, account ${c1.used}/${c1.limit}`);
  console.log('  heard:', stt?.text);
}
