#!/usr/bin/env node
// QA of the cut lines (build/voice/<id>.wav) with ElevenLabs Scribe: words missing or extra against the script
// (bad cut / misread / neighbour bleeding in), audio tags read aloud as words. Writes build/voice/qa.json.
//   node tools/voice/qa_voice.mjs [id ...]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, transcribe } from './el.mjs';

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/dialogue.json'), 'utf8'));
const QA = path.join(ROOT, 'build/voice/qa.json');
const prev = fs.existsSync(QA) ? JSON.parse(fs.readFileSync(QA, 'utf8')) : {};
const norm = (s) => s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[’']/g, '').replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(Boolean);
const TAGWORDS = new Set(['quietly', 'whispers', 'tense', 'gasps', 'breathless', 'sighs', 'exhales', 'dryly', 'angry', 'shaken', 'uneasy', 'bitterly', 'firmly', 'softly', 'determined', 'pained', 'under', 'breath']);
const pick = process.argv.slice(2);
const out = { ...prev };
for (const l of data.lines) {
  if (pick.length && !pick.includes(l.id)) continue;
  const wav = path.join(ROOT, 'build/voice', l.id + '.wav');
  if (!fs.existsSync(wav)) { out[l.id] = { error: 'no wav' }; continue; }
  let stt;
  try { stt = await transcribe(wav); } catch (e) { out[l.id] = { error: String(e.message || e) }; console.log(l.id, 'ERROR', e.message); continue; }
  const want = norm(l.text.replace(/Caer Veyr/g, 'Kair Vair'));
  const said = norm(stt.text ?? '');
  const bag = new Map();
  for (const w of want) bag.set(w, (bag.get(w) ?? 0) + 1);
  const extra = [];
  for (const w of said) { if (bag.get(w)) bag.set(w, bag.get(w) - 1); else extra.push(w); }
  const missing = [...bag].flatMap(([w, n]) => Array(n).fill(w));
  const tags = extra.filter((w) => TAGWORDS.has(w) && !want.includes(w));
  const events = (stt.words ?? []).filter((w) => w.type === 'audio_event').map((w) => w.text);
  // names are spelled differently by the transcriber (Veyr/Vair, Vaelor/Vaylor): not errors
  const soft = new Set(['veyr', 'vair', 'vaelor', 'vaylor', 'caer', 'kair', 'aldren', 'aldrin', 'alden']);
  const bad = missing.filter((w) => !soft.has(w)).length + extra.filter((w) => !soft.has(w)).length;
  out[l.id] = { text: l.text, heard: stt.text, missing, extra, tags, events, ok: bad <= 1 && !tags.length };
  console.log(`${out[l.id].ok ? 'ok ' : 'BAD'} ${l.id.padEnd(18)} heard: ${stt.text}${missing.length ? '  MISSING ' + missing.join(',') : ''}${extra.length ? '  EXTRA ' + extra.join(',') : ''}`);
}
fs.writeFileSync(QA, JSON.stringify(out, null, 1));
const bad = Object.entries(out).filter(([, v]) => !v.ok).map(([k]) => k);
console.log(`${Object.keys(out).length - bad.length} ok, ${bad.length} flagged: ${bad.join(' ')}`);
