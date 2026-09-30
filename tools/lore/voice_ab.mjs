// A/B the lore narrator: the same short test lines through the original designed voice ("Cthulu female", free account)
// and through its Instant Voice Clone on the paid account, on the same model and settings.
//   node tools/lore/voice_ab.mjs original <line#> [model] [stability]
//   node tools/lore/voice_ab.mjs clone <line#> [model] [stability]
// Output: build/lore/ab/<who>_<model>_s<stability>_<line#>.mp3 (+ .json alignment); then python tools/lore/voice_stats.py build/lore/ab
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, apiKey, credits, ttsTimed } from './el.mjs';

export const ORIGINAL = { voiceId: 'VhuTJN7jTXadMoTbfY1r', key: 'ELEVENLABS_API_KEY', name: 'Cthulu female' };
export const TEST_LINES = [
  '[low, reverent] Before Veyr had a name... something beneath the mountain remembered.',
  '[whispering] It kept the shape of stone. Of rooms. [pause] Of everything that came near.',
  '[grave, restrained dread] He chose the people inside his walls — and called it mercy.',
];

const [who, n = '0', model = 'eleven_v4', stab = '0.5'] = process.argv.slice(2);
const voiceCfg = path.join(ROOT, 'tools', 'lore', 'voice.json');
const v = who === 'original' ? ORIGINAL : who === 'clone' ? { ...JSON.parse(fs.readFileSync(voiceCfg, 'utf8')), key: 'ELEVENLABS_API_KEY_2' } : null;
if (!v) throw new Error('usage: voice_ab.mjs original|clone <line#> [model] [stability]');
const key = apiKey(v.key);
const text = TEST_LINES[Number(n)];
const before = await credits(key);
const res = await ttsTimed({ voiceId: v.voiceId, text, modelId: model, stability: Number(stab), similarity: 0.75, seed: 7 }, key);
const after = await credits(key);
const out = path.join(ROOT, 'build', 'lore', 'ab');
fs.mkdirSync(out, { recursive: true });
const base = path.join(out, `${who}_${model}_s${stab}_${n}`);
fs.writeFileSync(base + '.mp3', res.audio);
fs.writeFileSync(base + '.json', JSON.stringify({ text, voice: v.voiceId, model, stability: Number(stab), alignment: res.alignment }, null, 0));
console.log(`${path.basename(base)}.mp3  ${res.audio.length} B  credits ${before.left} -> ${after.left} (${before.left - after.left})`);
