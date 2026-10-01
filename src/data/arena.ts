import type { ArchetypeId, KillTier } from '../enemies/EnemyTypes';
import type { TimeState } from '../levels/Materials';

/**
 * THE ENDLESS MEMORY — the Endless Arena (session 17). Data only; the run itself is game/Arena.ts.
 *
 * The Crownheart's chamber on Floor III (tools/blender/floor03_layout.py `build_crownheart`): a marble ring 17 m across
 * over the abyss. The heart is gone (the arena never builds it); the chamber still remembers every battle fought for it.
 * Each wave turns the memory: the PAST is the whole coronation ring — four Sealbearer pillars up to the dome, braziers,
 * the castle's soldiers; the PRESENT is the ruin — four wedge-shaped drops into the abyss between the pillar stumps,
 * and its monsters. Every fifth wave a guardian comes, each with its own entrance.
 */
export const ARENA = {
  /** the ring's centre (Blender x, y, z) and radius */
  center: [54, 148, -16] as [number, number, number],
  radius: 17,
  /** the bridge out (west, 180°): sealed while the arena runs */
  bridgeDeg: 180,
  /** Present wedges (degrees about the centre, ± half-angle, radii) — over these the ruin has no floor */
  wedges: [45, 135, 225, 315], wedgeHalf: 20, wedgeR: [6, 13.5] as [number, number],
  /** the first wave's memory; the memory turns every wave */
  firstMemory: 'PAST' as TimeState,
  /** a guardian every N waves */
  bossEvery: 5,
  /** Echoes rise this far round the centre (m), and never nearer to the hero than `clear` */
  spawnR: [9, 15.5] as [number, number], clear: 6.5,
  /** between waves (s): the cleared line, the turn of the memory, the next wave's name */
  beat: { cleared: 2.4, turn: 1.8, announce: 1.6 },
  /** health given back when a wave is cleared (fraction of her full health) and Resonance topped up to */
  clearHeal: 0.22, clearCharge: 100,
};

/** the wave's budget (points), the most Echoes standing at once, and the scaling of their health and blows */
export const waveBudget = (n: number) => Math.round(4 + n * 2.1);
export const waveCap = (n: number) => Math.min(9, 3 + Math.floor((n + 1) / 3));
export const hpScale = (n: number) => Math.min(3.2, 1 + (n - 1) * 0.045);
export const damageScale = (n: number) => Math.min(2.2, 1 + (n - 1) * 0.03);
/** a new pack rises when this many of the wave are left standing */
export const PACK_AT = 2;

/** the rank and file of each memory: cost (budget points), first wave, weight of the draw, most at once in a wave */
export interface RosterEntry { id: ArchetypeId; cost: number; from: number; weight: number; max?: number }
export const ROSTER: Record<TimeState, RosterEntry[]> = {
  PAST: [
    { id: 'guard', cost: 2, from: 1, weight: 5 },
    { id: 'muster', cost: 2, from: 1, weight: 3 },
    { id: 'remnant_guard', cost: 1, from: 1, weight: 3 },
    { id: 'archer', cost: 2, from: 3, weight: 3, max: 3 },
    { id: 'royal_warden', cost: 5, from: 7, weight: 2, max: 2 },
  ],
  PRESENT: [
    { id: 'remnant', cost: 1, from: 1, weight: 4 },
    { id: 'hollow', cost: 2, from: 2, weight: 4 },
    { id: 'goblin', cost: 2, from: 2, weight: 3, max: 4 },
    { id: 'bat', cost: 1, from: 4, weight: 2, max: 4 },
    { id: 'widowling', cost: 1, from: 4, weight: 2, max: 4 },
    { id: 'widow', cost: 5, from: 6, weight: 2, max: 2 },
    { id: 'crown_brute', cost: 6, from: 8, weight: 1, max: 1 },
  ],
};

/** how a guardian makes its entrance (game/Arena.ts BossEntrance) */
export type Entrance = 'gate' | 'abyss' | 'rise' | 'eruption';
export interface ArenaGuardian {
  ids: ArchetypeId[];
  memory: TimeState;
  title: string;
  epithet: string;
  entrance: Entrance;
  /** its voice as it arrives */
  roar: string;
}
/**
 * The guardians, in turn (every `bossEvery` waves; after the last the cycle begins again, stronger: ASCENDANT). Their
 * memories follow the waves' own turning (wave 5 Past, 10 Present, …), so the list alternates.
 */
export const GUARDIANS: ArenaGuardian[] = [
  { ids: ['gate_warden'], memory: 'PAST', title: 'THE GATE WARDEN', epithet: 'He never let the gate fall — and he does not mean to now', entrance: 'gate', roar: 'armor_crash' },
  { ids: ['goblin_king'], memory: 'PRESENT', title: 'THE GUTTER KING', epithet: 'Scavenger lord of the fallen floors', entrance: 'abyss', roar: 'goblin_cry' },
  { ids: ['kingsguard'], memory: 'PAST', title: 'THE KINGSGUARD', epithet: "Sworn to Aldren's crown, sworn past death", entrance: 'gate', roar: 'armor_crash' },
  { ids: ['widow_mother'], memory: 'PRESENT', title: 'THE WEEPING MOTHER', epithet: 'She nests where the Queen once wept', entrance: 'abyss', roar: 'widow_hiss' },
  { ids: ['gate_warden', 'kingsguard'], memory: 'PAST', title: 'THE TWO OATHS', epithet: 'The gate and the crown, keeping watch together', entrance: 'rise', roar: 'boss_scream' },
  { ids: ['maw'], memory: 'PRESENT', title: 'THE MAW OF THE CROWNHEART', epithet: 'What the heart grew in the blood font', entrance: 'eruption', roar: 'maw_roar' },
];
/** a guardian's health × this per completed cycle of the guardians (ASCENDANT) */
export const GUARDIAN_CYCLE_HP = 0.55;
/** a guardian's fight calls an escort when its health falls under this (the escort budget is a share of the wave's) */
export const ESCORT_AT = 0.55;
export const ESCORT_SHARE = 0.45;

/** score: per kill by tier, × the wave's weight; a finisher and a fall into the void are worth more */
export const SCORE = {
  tier: { weak: 10, normal: 25, elite: 80, mini: 650, boss: 1500 } as Record<KillTier, number>,
  perWave: 0.08,
  finisher: 1.5,
  void: 1.4,
  /** a cleared wave: this × its number; without a wound taken in it, × flawless */
  clear: 100,
  flawless: 1.5,
};

/** the bodies built for the run: enough of each for the largest wave and a guardian's escort */
export const POOL: [ArchetypeId, number][] = [
  ['guard', 6], ['muster', 4], ['remnant_guard', 5], ['archer', 3], ['royal_warden', 2],
  ['remnant', 6], ['hollow', 5], ['goblin', 4], ['bat', 4], ['widowling', 4], ['widow', 2], ['crown_brute', 1],
  ['gate_warden', 1], ['kingsguard', 1], ['goblin_king', 1], ['widow_mother', 1], ['maw', 1],
];

/**
 * The chamber's light in the arena (Game.envFor): on Floor III the Crownheart OWNS the Present's light (Game
 * applyHeartTone); with the heart gone the ruin would be near black — so the arena lights its Present itself: the same
 * crimson dark, but a wide warm-red ambient, the embers' key from the abyss and a stronger hero light, so every Echo
 * reads. The Past keeps Floor III's own (its braziers do the rest).
 */
export const ARENA_ENV: Partial<Record<TimeState, Record<string, number | number[]>>> = {
  PRESENT: { bg: 0x0c0507, fog: 0x2a0d10, near: 14, far: 84, hemiSky: 0xc87078, hemiGround: 0x30121a, hemi: 1.7, sun: 0xe0806a, sunI: 1.7, sunDir: [0.45, 0.8, -0.35], fill: 0xd07078, fillI: 1.15, exposure: 1.55, heroLight: 12 },
};

/** the chapter card while the chamber loads, and the menu's words for the mode */
export const ARENA_CARD = {
  title: 'THE ENDLESS MEMORY',
  subtitle: 'Endless Arena',
  loadingText: 'Descending to the heart’s chamber',
  readyText: 'The heart is gone. The chamber still remembers every battle fought for it.',
  epigraph: 'Hold the ring. Every wave, the castle turns its memory.',
};
