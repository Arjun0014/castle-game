// QA a lore narration take with Scribe (speech-to-text on the paid account): did she say every word of the script,
// and was any audio tag read aloud instead of performed? Results are cached next to the take (<name>.scribe.json).
//   node tools/lore/qa_lore.mjs <take> [name]      (name: book | test | page_NN; default: every .mp3 in the take)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, apiKey, transcribe } from './el.mjs';

const [take, only] = process.argv.slice(2);
const dir = path.join(ROOT, 'assets', 'audio', 'lore', 'takes', take);
const key = apiKey('ELEVENLABS_API_KEY_2');
const norm = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
// respellings are heard as spelled (Vair, Kair, Vaylor): score them as the display names
const ALIAS = { vair: 'veyr', vare: 'veyr', vayr: 'veyr', veyr: 'veyr', kair: 'caer', care: 'caer', caer: 'caer', vaylor: 'vaelor', vailor: 'vaelor', valor: 'vaelor', vaelor: 'vaelor', taylor: 'vaelor' };
const canon = (w) => ALIAS[w] ?? w;

/** word-level edit alignment: counts of substitutions / deletions / insertions */
function diff(ref, hyp) {
  const n = ref.length, m = hyp.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) { if (ref[i - 1] !== hyp[j - 1]) ops.push(`~${ref[i - 1]}→${hyp[j - 1]}`); i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push(`-${ref[i - 1]}`); i--; }
    else { ops.push(`+${hyp[j - 1]}`); j--; }
  }
  return { errors: d[n][m], ops: ops.reverse() };
}

const TAG_WORDS = /\b(whisper(ing|s)?|reverent(ly)?|narration|dread|ominous|sorrowful|measured|thoughtful|intense|building|uneasy|restrained|awe|hushed|urgent|pause|grave|heavy|final|reflective|slowly|with weight)\b/i;
const names = only ? [only] : fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
const report = [];
for (const name of names) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8'));
  const cache = path.join(dir, name + '.scribe.json');
  const stt = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : await transcribe(path.join(dir, name + '.mp3'), key);
  fs.writeFileSync(cache, JSON.stringify(stt));
  const ref = meta.pages.flatMap((p) => p.lines.flatMap((l) => norm(l.display))).map(canon);
  const words = (stt.words ?? []).filter((w) => w.type === 'word');
  const hyp = words.map((w) => norm(w.text)).flat().map(canon);
  const { errors, ops } = diff(ref, hyp);
  const events = (stt.words ?? []).filter((w) => w.type === 'audio_event').map((w) => w.text);
  const spokenTags = ops.filter((o) => o.startsWith('+') && TAG_WORDS.test(o.slice(1)));
  const r = { take, name, refWords: ref.length, heardWords: hyp.length, errors, accuracy: +(1 - errors / ref.length).toFixed(3), ops, spokenTags, events };
  report.push(r);
  console.log(`${name}: ${ref.length} words, ${errors} edits (${(r.accuracy * 100).toFixed(1)} %)${spokenTags.length ? '  TAGS SPOKEN ' + spokenTags.join(' ') : ''}${events.length ? '  events ' + events.join(' ') : ''}`);
  if (ops.length) console.log('   ', ops.join('  '));
}
fs.writeFileSync(path.join(dir, 'qa.json'), JSON.stringify(report, null, 1) + '\n');
