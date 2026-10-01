/**
 * Wavedash achievement + stat definitions for the Developer Portal (session 16).
 *
 *   npm run wavedash:defs        (= node --experimental-strip-types tools/wavedash/build_defs.mjs)
 *
 * Reads the game's achievements (src/data/achievements.ts) and their stable Wavedash identifiers (src/data/wavedash.ts)
 * and writes wavedash/achievements-import.json in the portal's bulk-import format (docs: Achievements & stats → Bulk
 * import): Developer Portal → the game → Achievements → Add achievement → Import JSON. Re-importing updates in place
 * (matched by identifier; icons are kept). Cumulative achievements get a stat trigger (the portal unlocks them when the
 * stat reaches the goal — the game also unlocks them itself). Hidden / secret achievements are `secret`.
 *
 * Also writes wavedash/cli-commands.txt — the same definitions as `wavedash stat create` / `wavedash achievement create`
 * lines, for anyone who prefers the CLI (stat triggers need the stat's document id from `stat create`, so those lines
 * carry a placeholder).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { ACHIEVEMENTS } = await import(new URL('../../src/data/achievements.ts', import.meta.url).href);
const { WD_ACHIEVEMENTS, WD_STATS, WD_STAT_FOR_COUNTER } = await import(new URL('../../src/data/wavedash.ts', import.meta.url).href);

const problems = [];
const seen = new Set();
for (const a of ACHIEVEMENTS) {
  const id = WD_ACHIEVEMENTS[a.id];
  if (!id) problems.push(`achievement ${a.id} has no Wavedash identifier in src/data/wavedash.ts`);
  else if (seen.has(id)) problems.push(`identifier ${id} is used twice`);
  else if (!/^[A-Z][A-Z0-9_]*$/.test(id)) problems.push(`identifier ${id} is not UPPER_SNAKE_CASE`);
  seen.add(id);
}
for (const k of Object.keys(WD_ACHIEVEMENTS)) if (!ACHIEVEMENTS.some((a) => a.id === k)) problems.push(`src/data/wavedash.ts maps unknown achievement ${k}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const achievements = ACHIEVEMENTS.map((a) => {
  const stat = a.counter && a.goal ? WD_STAT_FOR_COUNTER[a.counter] : null;
  return {
    identifier: WD_ACHIEVEMENTS[a.id],
    display_name: a.name,
    description: a.desc,
    secret: !!a.hidden,
    stat_requirement: stat ? { stat, threshold: a.goal } : null,
  };
});
const stats = WD_STATS.map((s) => ({ identifier: s.id, display_name: s.name }));
const out = join(root, 'wavedash');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'achievements-import.json'), JSON.stringify({ achievements, stats }, null, 2) + '\n');

const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
const lines = [
  '# Wavedash CLI equivalents of achievements-import.json (run from the repo root, signed in: `wavedash auth login`).',
  '# Stats first; a stat-triggered achievement needs the stat DOCUMENT id printed by `wavedash stat create`.',
  ...stats.map((s) => `wavedash stat create --identifier ${s.identifier} --name ${q(s.display_name)}`),
  '',
  ...achievements.map((a) => `wavedash achievement create --identifier ${a.identifier} --title ${q(a.display_name)} --description ${q(a.description)}`
    + (a.secret ? ' --secret' : '') + (a.stat_requirement ? ` --triggered-by-stat-id <${a.stat_requirement.stat}_ID> --threshold ${a.stat_requirement.threshold}` : '')
    + ` --image wavedash/icons/${a.identifier}.png`),
];
writeFileSync(join(out, 'cli-commands.txt'), lines.join('\n') + '\n');
console.log(`wavedash/achievements-import.json: ${achievements.length} achievements (${achievements.filter((a) => a.stat_requirement).length} stat-triggered, ${achievements.filter((a) => a.secret).length} secret), ${stats.length} stats`);
