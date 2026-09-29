#!/usr/bin/env node
// Opening-cinematic score with Eleven Music (build-time only).
//
//   node tools/cinematic/gen_music.mjs <take> [--seed n] [--model music_v2_5] [--dry]
//
// One continuous cue built from a composition plan whose eight sections are cut to tools/cinematic/timeline.json,
// so the music turns where the picture turns. The mix (tools/cinematic/mix.py) then adds the precise hits (the
// drop, the portcullis, the Sundering's hard silence, the glimpse) on top.
// Output: assets/audio/cinematic/music/<take>.mp3 + <take>.json (plan, seed, credits).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, composeMusic, creditsUsed } from './el_client.mjs';

const args = process.argv.slice(2);
const take = args[0];
if (!take) { console.error('usage: gen_music.mjs <take> [--seed n] [--model id] [--dry]'); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = Number(opt('seed', 7));
const model = opt('model', 'music_v2_5');
const dry = args.includes('--dry');

const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/cinematic/timeline.json'), 'utf8'));

const GLOBAL_POS = [
  'original cinematic orchestral score for a dark medieval tragedy', 'D minor', '60 BPM', 'slow and grave',
  'solo cello carries a simple modal theme', 'low strings', 'wordless low choir', 'deep bronze church bells',
  'glass harmonica shimmer for an ancient buried relic', 'restrained, intimate, tragic', 'sacred and ancient atmosphere',
  'wide cathedral reverb', 'instrumental',
];
const GLOBAL_NEG = [
  'lyrics', 'singing words', 'pop', 'electronic', 'synth lead', 'drum kit', 'hip hop beat', 'epic trailer braams',
  'hurdy-gurdy', 'bagpipes', 'folk fiddle', 'celtic', 'slavic folk vocals', 'guitar', 'upbeat', 'happy major key', 'rock',
];
const LOCAL = {
  crownheart: [['near silence', 'a low sustained drone on D, cello harmonics', 'glass harmonica shimmer', 'a soft sub-bass heartbeat pulse', 'mysterious and sacred'],
               ['melody', 'drums', 'brass', 'choir']],
  binding: [['warm low strings slowly swell', 'the solo cello states the theme, tender and reverent', 'a single soft bell chime', 'glass harmonica'],
            ['percussion', 'fast rhythm']],
  rise: [['noble, reverent processional', 'cello and strings carry the theme', 'soft french horns', 'wordless choir ah', 'building to a warm golden climax', 'bells ringing solemnly'],
         ['drums', 'dissonance']],
  last_night: [['the warmth drains away', 'dark and uneasy', 'distant low war drums, slow ostinato', 'tremolo strings', 'dissonant low brass swells',
                'the theme fragmented in minor', 'dread building steadily', 'heavy bells tolling slowly'], ['major key', 'warm consonance']],
  sundering: [['massive orchestral and choral crescendo', 'shattering climax', 'then sudden silence'], ['gentle', 'soft']],
  two_memories: [['mournful and suspended', 'solo cello plays the theme very slowly', 'high thin string drone', 'a distant bell', 'reversed textures', 'vast and empty'],
                 ['drums', 'brass', 'choir']],
  return: [['intimate and restrained', 'a soft low heartbeat pulse on timpani', 'sparse sustained strings', 'solo cello, the first notes of the theme', 'tension rising gently'],
           ['loud', 'choir', 'bells']],
  threshold: [['one brief swell of the full theme', 'then hush', 'a low sustained drone', 'a single deep bell', 'final deep resolving chord in D minor', 'glass harmonica ringing out into silence'],
              ['drums', 'fast']],
};

// music_v2 / v2.5 plan: an ordered list of chunks, each with its own styles (the global palette is repeated in every
// chunk so the cue stays one piece) and instrumental direction in curly braces.
const CUE = {
  crownheart: 'instrumental: darkness, a low drone and a glass shimmer, a slow heartbeat',
  binding: 'instrumental: the strings bloom, the cello theme enters, one soft bell',
  rise: 'instrumental: noble processional, horns and choir join, a golden peak',
  last_night: 'instrumental: war drums far away, tremolo strings, the theme breaks apart, bells toll',
  sundering: 'instrumental: huge crescendo, shattering climax, then silence',
  two_memories: 'instrumental: lonely cello theme over a thin high drone, a distant bell',
  return: 'instrumental: quiet heartbeat pulse, sparse strings, the theme returns softly',
  threshold: 'instrumental: one swell of the theme, hush, a deep bell, the final chord',
};
const plan = {
  chunks: tl.music.map((m, i) => ({
    text: `[${m.name.replace('_', ' ')}]\n{${CUE[m.name]}}`,
    duration_ms: Math.round((m.end - m.start) * 1000),
    positive_styles: [...GLOBAL_POS, ...LOCAL[m.name][0]].slice(0, 20),
    negative_styles: [...GLOBAL_NEG, ...LOCAL[m.name][1]].slice(0, 20),
    context_adherence: i === 0 ? 'medium' : 'high',
  })),
};
const total = plan.chunks.reduce((a, s) => a + s.duration_ms, 0);
console.log(`plan: ${plan.chunks.length} chunks, ${(total / 1000).toFixed(1)} s, model ${model}, seed ${seed}`);
for (const s of plan.chunks) console.log(`  ${s.text.split('\n')[0].padEnd(16)} ${(s.duration_ms / 1000).toFixed(1)} s  ${s.positive_styles.length}+/${s.negative_styles.length}-`);
if (dry) process.exit(0);

const OUT = path.join(ROOT, 'assets/audio/cinematic/music');
fs.mkdirSync(OUT, { recursive: true });
const c0 = await creditsUsed();
const audio = await composeMusic({ plan, modelId: model, seed });
fs.writeFileSync(path.join(OUT, `${take}.mp3`), audio);
await new Promise((r) => setTimeout(r, 4000));
const c1 = await creditsUsed();
fs.writeFileSync(path.join(OUT, `${take}.json`), JSON.stringify({ take, model, seed, generated: new Date().toISOString(), creditsCharged: c1.used - c0.used, plan }, null, 1));
console.log(`music ${take}: ${(audio.length / 1024).toFixed(0)} KB, credits ~${c1.used - c0.used} (account ${c1.used}/${c1.limit})`);
