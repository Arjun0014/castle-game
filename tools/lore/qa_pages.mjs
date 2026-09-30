// QA the built lore narration (public/assets/lore/narration_NN.ogg against src/data/loreManifest.json) with Scribe:
// each page's clip holds exactly its own words (nothing clipped at a cut, nothing from the neighbouring page), and each
// heard word falls inside its subtitle cue (±0.35 s). Cached per file in build/lore/qa/.
//   node tools/lore/qa_pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, apiKey, transcribe } from './el.mjs';

const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'loreManifest.json'), 'utf8'));
const key = apiKey('ELEVENLABS_API_KEY_2');
const cacheDir = path.join(ROOT, 'build', 'lore', 'qa');
fs.mkdirSync(cacheDir, { recursive: true });
const norm = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
const ALIAS = { vair: 'veyr', verre: 'veyr', verr: 'veyr', vere: 'veyr', vayr: 'veyr', ver: 'veyr', vera: 'veyr', vaer: 'veyr', vier: 'veyr', vare: 'veyr', valar: 'vaelor', kair: 'caer', care: 'caer', vaylor: 'vaelor', valor: 'vaelor', aldrin: 'aldren', aldrins: 'aldrens' };
const canon = (w) => ALIAS[w] ?? w;
let bad = 0;
for (const p of man.pages) {
  const file = path.join(ROOT, 'public', p.audio);
  const cache = path.join(cacheDir, `${path.basename(file)}.${fs.statSync(file).size}.json`);
  const stt = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : await transcribe(file, key);
  fs.writeFileSync(cache, JSON.stringify(stt));
  const words = (stt.words ?? []).filter((w) => w.type === 'word');
  const ref = p.cues.flatMap((c) => norm(c.text)).map(canon);
  const hyp = words.flatMap((w) => norm(w.text)).map(canon);
  const missing = ref.filter((w, i) => !hyp.includes(w) && ref.indexOf(w) === i);
  const extra = hyp.filter((w, i) => !ref.includes(w) && hyp.indexOf(w) === i);
  // timing: each heard word inside some cue (tolerance 0.35 s)
  const outside = words.filter((w) => !p.cues.some((c) => w.start >= c.t0 - 0.35 && w.end <= c.t1 + 0.35)).map((w) => `${w.text}@${w.start.toFixed(2)}`);
  const firstWord = words[0]?.start ?? 0, lastWord = words.at(-1)?.end ?? 0;
  const ok = !missing.length && !extra.length && !outside.length;
  if (!ok) bad++;
  console.log(`page ${String(p.n).padStart(2, '0')} ${ok ? 'OK ' : 'CHECK'} ${ref.length}/${hyp.length} words  first ${firstWord.toFixed(2)} s  last ${lastWord.toFixed(2)} / ${p.duration} s`
    + (missing.length ? `  missing [${missing.join(' ')}]` : '') + (extra.length ? `  extra [${extra.join(' ')}]` : '') + (outside.length ? `  outside cues [${outside.join(' ')}]` : ''));
}
console.log(bad ? `${bad} page(s) to check` : 'all pages clean');
