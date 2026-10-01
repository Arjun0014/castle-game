/**
 * Wavedash identifiers (session 16) — the game's achievements and cumulative counts as Wavedash achievements and stats.
 *
 * STABLE FOREVER: these strings are the keys players' unlocks and stats are stored under on Wavedash. Rename an
 * achievement's display name freely (data/achievements.ts), never its identifier here. Adding one = add it here and to
 * data/achievements.ts, then `npm run wavedash:defs` regenerates `wavedash/achievements-import.json` (Developer Portal →
 * your game → Achievements → Add achievement → Import JSON), which carries every achievement, every stat and the stat
 * thresholds of the cumulative ones.
 *
 * The game's own system (game/Achievements.ts) stays the source of play-time truth; platform/WavedashStats.ts mirrors
 * it onto these identifiers once Wavedash says the player's stats are loaded.
 */
import type { CounterKey } from '../game/Achievements';

/** game achievement id → Wavedash achievement identifier */
export const WD_ACHIEVEMENTS: Record<string, string> = {
  floor1: 'INHERITANCE',
  floor2: 'COMPLICITY',
  ending: 'THE_CROWNHEART_IS_SILENT',
  gate_warden: 'THE_WARDEN_FALLS',
  untouched: 'UNTOUCHED',
  goblin_king: 'GUTTER_CROWN',
  widow_mother: 'THE_WEEPING_MOTHER',
  kingsguard: 'OATH_UNSWORN',
  maw: 'THE_MOUTH_BENEATH',
  parry: 'TURNED_ASIDE',
  parries: 'THE_UNBROKEN_GUARD',
  five_cuts: 'FIVE_CUTS',
  finisher: 'THE_LAST_BLOW',
  finishers: 'HEADSMAN_OF_VEYR',
  execution: 'NO_MERCY_IN_MEMORY',
  crownbreaker: 'CROWNBREAKER',
  whirlwind: 'THE_WHIRLWIND',
  released: 'RELEASED',
  first_shift: 'WHICH_MEMORY_WILL_ANSWER',
  shift_kill: 'BETWEEN_TWO_BREATHS',
  shifts: 'TWO_MEMORIES_ONE_STONE',
  unremembered: 'UNREMEMBERED',
  queen_letter: 'THE_QUEENS_LETTER',
  traces: 'WHAT_THE_STONES_CONFESSED',
  chronicle: 'THE_CHRONICLE_OF_CAER_VEYR',
  patience: 'PATIENCE_OF_STONE',
};

/** where a stat's value comes from: a counter of the achievement store, or the size of one of its collections */
export type StatSource = CounterKey | 'traces' | 'lore';

/** Wavedash stats (cumulative across every run and device) */
export const WD_STATS: { id: string; name: string; source: StatSource }[] = [
  { id: 'ECHOES_RELEASED', name: 'Echoes released', source: 'kills' },
  { id: 'FINISHERS', name: 'Cinematic finishers', source: 'finishers' },
  { id: 'PARRIES', name: 'Parries', source: 'parries' },
  { id: 'TIME_SHIFTS', name: 'Time shifts', source: 'shifts' },
  { id: 'BOSSES_FELLED', name: 'Bosses and mini-bosses felled', source: 'bosses' },
  { id: 'CROWNBREAKERS', name: 'Crownbreakers unleashed', source: 'crownbreakers' },
  { id: 'WHIRLWINDS', name: 'Whirlwinds unleashed', source: 'whirlwinds' },
  { id: 'MEMORY_TRACES', name: 'Memory traces read', source: 'traces' },
  { id: 'LORE_PAGES', name: 'Chronicle pages turned', source: 'lore' },
  { id: 'GAME_COMPLETIONS', name: 'Endings reached', source: 'completions' },
];

/** the stat a cumulative achievement's goal is measured on (the portal's stat trigger) */
export const WD_STAT_FOR_COUNTER: Partial<Record<StatSource, string>> = Object.fromEntries(WD_STATS.map((s) => [s.source, s.id]));
