// Voice the lore book (session 15). Build time only; the key never leaves this process.
//   node tools/lore/gen_lore.mjs test  <take> <p:l,p:l,...> [--stability 0.5] [--seed 7]   a few lines in one request
//   node tools/lore/gen_lore.mjs book  <take> [--stability 0.5] [--seed 7]                  all 12 pages in ONE request
//   node tools/lore/gen_lore.mjs pages <take> <n,n,...> [--stability 0.5] [--seed 7]        single pages (retakes)
// Voice: tools/lore/voice.json (the "Cthulu female" narrator on the paid account); model eleven_v4 (Eleven v4).
// Output: assets/audio/lore/takes/<take>/{book|page_NN|test}.mp3 + .json (the spoken text, the character alignment and
// every line's character span, so tools/lore/build_lore.py can cut pages and time the subtitles). Spend is appended
// to assets/audio/lore/ledger.json. The markup of tools/lore/narration.json: [tag] = v4 direction (spoken only),
// {Display|spoken} = subtitle spelling | respelling.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, apiKey, credits, ttsTimed } from './el.mjs';

const MODEL = 'eleven_v4';
const SIMILARITY = 0.75;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [mode, take, list] = args;
if (!mode || !take) throw new Error('usage: gen_lore.mjs test|book|pages <take> [...]');
const stability = Number(opt('stability', 0.5));
const seed = Number(opt('seed', 7));
// pacing experiments: --sep = the break between lines ('n' = newline, 'nn' = paragraph), --lead = a direction before each page
const SEP = (opt('sep', 'n')).replace(/n/g, '\n');
const LEAD = opt('lead', '');
const voice = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'lore', 'voice.json'), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'lore', 'narration.json'), 'utf8'));
const key = apiKey('ELEVENLABS_API_KEY_2');
const OUT = path.join(ROOT, 'assets', 'audio', 'lore', 'takes', take);
fs.mkdirSync(OUT, { recursive: true });

export const spokenOf = (l) => l.replace(/\{([^|}]*)\|([^}]*)\}/g, '$2');
export const displayOf = (l) => l.replace(/\{([^|}]*)\|([^}]*)\}/g, '$1').replace(/\[[^\]]*\]\s*/g, '').trim();

/** join pages → one request text; every line's character span recorded */
function compose(pages) {
  let text = '';
  const out = [];
  pages.forEach(({ page, lines }, pi) => {
    if (pi > 0) text += '\n\n\n';
    if (LEAD) text += LEAD + ' ';
    const spans = [];
    lines.forEach((l, li) => {
      if (li > 0) text += SEP;
      const s = spokenOf(l);
      spans.push({ line: li, display: displayOf(l), spoken: s, start: text.length, end: text.length + s.length });
      text += s;
    });
    out.push({ page, lines: spans });
  });
  return { text, pages: out };
}

async function render(name, pages) {
  const { text, pages: spans } = compose(pages);
  const before = await credits(key);
  const t0 = Date.now();
  const res = await ttsTimed({ voiceId: voice.voiceId, text, modelId: MODEL, stability, similarity: SIMILARITY, seed }, key);
  const after = await credits(key);
  fs.writeFileSync(path.join(OUT, name + '.mp3'), res.audio);
  const meta = { take, name, sep: SEP, lead: LEAD, model: MODEL, voice: voice.voiceId, voiceName: voice.name, stability, similarity: SIMILARITY, seed, text, pages: spans, alignment: res.alignment, created: new Date().toISOString(), seconds: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta));
  const ledgerPath = path.join(ROOT, 'assets', 'audio', 'lore', 'ledger.json');
  const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : [];
  ledger.push({ take, name, chars: text.length, model: MODEL, stability, seed, credits: before.left - after.left, left: after.left, at: meta.created });
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1) + '\n');
  const dur = res.alignment.character_end_times_seconds.at(-1);
  console.log(`${take}/${name}.mp3  ${text.length} chars  ${dur.toFixed(1)} s audio  ${meta.seconds.toFixed(0)} s render  credits ${before.left} -> ${after.left}`);
}

const P = script.pages;
if (mode === 'test') {
  // p:l pairs (1-based page, 0-based line) → one short script
  const byPage = new Map();
  for (const pl of list.split(',')) {
    const [p, l] = pl.split(':').map(Number);
    if (!byPage.has(p)) byPage.set(p, []);
    byPage.get(p).push(P[p - 1].lines[l]);
  }
  await render('test', [...byPage].map(([page, lines]) => ({ page, lines })));
} else if (mode === 'book') {
  await render('book', P.map((pg, i) => ({ page: i + 1, lines: pg.lines })));
} else if (mode === 'pages') {
  for (const n of list.split(',').map(Number)) await render('page_' + String(n).padStart(2, '0'), [{ page: n, lines: P[n - 1].lines }]);
} else throw new Error('unknown mode ' + mode);
