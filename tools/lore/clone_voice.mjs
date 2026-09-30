// The lore narrator on the paid account (session 15). The narrator the user chose is the designed voice "Cthulu female"
// (VhuTJN7jTXadMoTbfY1r), which exists only on the free account (ELEVENLABS_API_KEY, ~130 credits left); the paid
// Starter account (ELEVENLABS_API_KEY_2) cannot see it (GET /v1/voices/<id> -> 400 voice_not_found). ElevenLabs' v4 docs
// say designed voices "may not be as performative" on v4 while Instant Voice Clones capture the source "more
// faithfully", so the narrator is carried over as an IVC made from that voice's own v3 generations (downloaded free from
// the free account's history into build/lore/clone_src by the session-15 probe; one speaking style: the chronicle
// narration of the trailer takes + two long monologue takes, F0 median 144-150 Hz, centroid 1.18-1.30 kHz).
//   node tools/lore/clone_voice.mjs            -> creates the clone (once) and writes tools/lore/voice.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, api, apiKey } from './el.mjs';

const OUT = path.join(ROOT, 'tools', 'lore', 'voice.json');
const SRC = path.join(ROOT, 'build', 'lore', 'clone_src');
const FILES = [
  '2026-09-29_jSen1RhYcWELqzl924DA.mp3', // the trailer's final v3 take (65 s)
  '2026-09-29_1s3w5DdGloBVOvs42afi.mp3', // an earlier trailer take (61 s)
  '2026-09-29_UE250UNHvhiuCpW7Syxs.mp3', // trailer test (16 s)
  '2026-07-23_wcsF7zC9vkEzi3EcvCRM.mp3', // monologue (74 s)
];
const NAME = 'Cthulu female - v4 narrator (IVC)';

if (fs.existsSync(OUT)) { console.log('already cloned:', fs.readFileSync(OUT, 'utf8')); process.exit(0); }
const key = apiKey('ELEVENLABS_API_KEY_2');
const existing = (await api('GET', '/v2/voices?page_size=100&search=' + encodeURIComponent('Cthulu'), { key })).voices ?? [];
let voiceId = existing.find((v) => v.name === NAME)?.voice_id;
if (!voiceId) {
  const form = new FormData();
  form.append('name', NAME);
  form.append('description', 'Instant clone of the designed voice "Cthulu female" (VhuTJN7jTXadMoTbfY1r) for Eleven v4: very low, ancient female contralto, chronicle narration. Echoes of Caer Veyr lore book.');
  form.append('remove_background_noise', 'false');
  for (const f of FILES) form.append('files', new Blob([fs.readFileSync(path.join(SRC, f))], { type: 'audio/mpeg' }), f);
  const res = await api('POST', '/v1/voices/add', { key, form });
  voiceId = res.voice_id;
}
const info = {
  voiceId, name: NAME, account: 'ELEVENLABS_API_KEY_2 (Starter)', kind: 'instant voice clone',
  source: { voiceId: 'VhuTJN7jTXadMoTbfY1r', name: 'Cthulu female', account: 'ELEVENLABS_API_KEY (free)', kind: 'designed (eleven_ttv_v3)' },
  trainingFiles: FILES, created: new Date().toISOString(),
};
fs.writeFileSync(OUT, JSON.stringify(info, null, 1) + '\n');
console.log('clone ->', voiceId);
