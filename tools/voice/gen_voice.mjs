#!/usr/bin/env node
// The heroine's lines, ElevenLabs Eleven v3 (build time only). See docs/DIALOGUE.md §5/§7.
//
//   node tools/voice/gen_voice.mjs            generate every batch whose lines are not generated yet
//   node tools/voice/gen_voice.mjs --plan     print the batches and their character cost, generate nothing
//   node tools/voice/gen_voice.mjs --redo id1,id2   regenerate those lines alone (one request each)
//
// Lines are grouped by category + floor into requests of <= ~330 characters: v3 is steadier on a few sentences
// than on a two-word bark, and one request keeps a register consistent across neighbouring lines. Each request
// returns character timestamps, which tools/voice/build_voice.py uses to cut the lines apart.
// Output: assets/audio/voice/batches/<batch>.mp3 + .json (text, per-line character ranges, alignment, credits).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, tts, credits } from './el.mjs';

export const VOICE = { name: 'Lily', id: 'pFZP5JQG7iQjIQuC4Bku', model: 'eleven_v3', stability: 0.5, similarity: 0.75, seed: 7 };
const OUT = path.join(ROOT, 'assets/audio/voice/batches');
fs.mkdirSync(OUT, { recursive: true });
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/dialogue.json'), 'utf8'));
const say = (t) => { for (const [k, v] of Object.entries(data.pronounce)) t = t.split(k).join(v); return t; };

/** existing coverage: line id -> batch file */
function covered() {
  const map = new Map();
  for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    for (const r of j.ranges) if (r.tts === say(data.lines.find((l) => l.id === r.id)?.tts ?? '')) map.set(r.id, f);
  }
  return map;
}

/** requests group lines of one emotional register (a request keeps its register consistent) */
const FAMILY = { checkpoint: 'calm', shift: 'calm', flavour: 'calm', idle: 'calm', hint: 'hint', discovery: 'discovery', onboarding: 'story', story: 'story', combat: 'combat', boss: 'boss' };

function batches(lines) {
  const groups = new Map();
  for (const l of [...lines].sort((a, b) => (a.floor || 9) - (b.floor || 9))) {
    const k = FAMILY[l.cat] ?? l.cat;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  }
  const out = [];
  for (const [k, list] of groups) {
    let cur = [], n = 0, part = 0;
    for (const l of list) {
      const c = say(l.tts).length + 2;
      if (cur.length && n + c > 330) { out.push({ name: `${k}_${part++}`, lines: cur }); cur = []; n = 0; }
      cur.push(l); n += c;
    }
    if (cur.length) out.push({ name: `${k}_${part}`, lines: cur });
  }
  return out;
}

async function run(batch) {
  let text = '';
  const ranges = [];
  for (const l of batch.lines) {
    if (text) text += '\n\n';
    const t = say(l.tts);
    ranges.push({ id: l.id, tts: t, from: text.length, to: text.length + t.length });
    text += t;
  }
  const c0 = await credits();
  const r = await tts({ voiceId: VOICE.id, text, modelId: VOICE.model, stability: VOICE.stability, similarity: VOICE.similarity, seed: VOICE.seed });
  const c1 = await credits();
  fs.writeFileSync(path.join(OUT, batch.name + '.mp3'), r.audio);
  fs.writeFileSync(path.join(OUT, batch.name + '.json'), JSON.stringify({ batch: batch.name, voice: VOICE, generated: new Date().toISOString(), chars: text.length, charged: c1.used - c0.used, account: c1, text, ranges, alignment: r.alignment }, null, 1));
  console.log(`${batch.name}: ${batch.lines.length} lines, ${text.length} chars, ${(r.audio.length / 1024).toFixed(0)} KB, account ${c1.used}/${c1.limit}`);
}

const args = process.argv.slice(2);
const have = covered();
if (args[0] === '--redo') {
  const ids = (args[1] ?? '').split(',').filter(Boolean);
  for (const id of ids) {
    const l = data.lines.find((x) => x.id === id);
    if (!l) throw new Error('unknown line ' + id);
    const n = fs.readdirSync(OUT).filter((f) => f.startsWith('redo_' + id + '_') && f.endsWith('.json')).length;
    await run({ name: `redo_${id}_${n}`, lines: [l] });
  }
} else {
  const todo = batches(data.lines.filter((l) => !have.has(l.id)));
  const cost = todo.reduce((n, b) => n + b.lines.reduce((m, l) => m + say(l.tts).length + 2, 0), 0);
  console.log(`${todo.length} batches, ~${cost} characters; ${have.size} lines already generated`);
  if (args[0] === '--plan') { for (const b of todo) console.log(' ', b.name, b.lines.map((l) => l.id).join(' ')); process.exit(0); }
  const acc = await credits();
  if (acc.limit - acc.used < cost + 200) throw new Error(`not enough credits: need ~${cost}, have ${acc.limit - acc.used}`);
  for (const b of todo) await run(b);
}
