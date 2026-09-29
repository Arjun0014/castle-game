import { HERO_CLIPS } from '../data/animationManifest';

export type AssetId = 'knight' | 'hollow' | 'archer' | 'ghost' | 'lastcrown' | 'goblin' | 'bat' | 'widow' | 'lamia';
/** echo: pale drifting motes · muster: faint gold dust · elite: rising embers · corrupt: ash · dread: boss embers */
export type AuraKind = 'echo' | 'muster' | 'elite' | 'corrupt' | 'dread';
export type ArchetypeId = 'kingsguard' | 'guard' | 'muster' | 'royal_warden' | 'hollow' | 'hollow_warden' | 'wraith' | 'archer' | 'echo_archer' | 'gate_warden' | 'remnant' | 'remnant_guard' | 'last_crown'
  | 'goblin' | 'goblin_king' | 'bat' | 'widow' | 'widowling' | 'widow_mother' | 'lamia' | 'lamia_maw';

export interface EnemyAttack {
  clip: string; speed: number; start: number;
  window: [number, number];        // clip seconds
  damage: number; range: number; arc: number; knock: number;
  heavy?: boolean; guardBreak?: boolean; unblockable?: boolean; aoe?: boolean;
  weight: number; cooldown: [number, number]; rootScale: number;
  minRange?: number; hyperArmor?: boolean; telegraph?: number;
}

export interface Archetype {
  id: ArchetypeId; asset: AssetId; scale: number;
  /** Subtle identity VFX; models always keep their original materials and colours. */
  aura?: AuraKind;
  /** Arrows glow faintly (Present Echo archers). */
  spectralArrows?: boolean;
  hp: number; poise: number; runSpeed: number; walkSpeed: number; radius: number; height: number;
  reward: number; blockChance: number; aggroRange: number; turnRate: number;
  attacks: EnemyAttack[];
  /**
   * Ranged: `range` = [preferred minimum distance (backs off inside it), max shooting distance];
   * `sight` = detection distance with line of sight (independent of the encounter volume; any height).
   */
  ranged?: { range: [number, number]; sight: number; projectileSpeed: number; damage: number; interval: [number, number] };
  flying?: { altitude: number };
  clips: { idle: string; walk: string; run: string; strafeL?: string; strafeR?: string; back?: string; hitL: string; hitH: string; death: string[]; block?: string; blockHit?: string; rise?: string; kneel?: string };
  slotCost: number;       // how many melee attack slots it occupies
  boss?: boolean;
  /** which cinematic finishers can take it (combat/Finishers.ts): humanoid rigs (default) every variant,
   *  beasts only the stab + passing cut, 'none' never (flyers, the serpent, bosses) */
  finisher?: 'humanoid' | 'beast' | 'none';
  /** blood colour of its wounds (default: dark red; Hollows darker) */
  blood?: number;
  /** titled mini-boss: a boss bar with this name while its fight runs (not a floor boss) */
  miniBoss?: string;
  /** a monster brain of its own (enemies/Monsters.ts) */
  brain?: 'goblin' | 'bat' | 'widow' | 'lamia';
}

/**
 * Monster rigs (the necromorph Hollow, the night ghost) belong to the ruined Present. An enemy placed in the Past
 * with one of them is replaced by its living counterpart at spawn (logged in EnemyManager.pastFixes; Floors 1–2
 * data has none, Floor 3's E0 Remnants are remapped). Fissure/boss adds in the Past use `remnant_guard`.
 */
export const PAST_COUNTERPART: Partial<Record<ArchetypeId, ArchetypeId>> = {
  hollow: 'guard', remnant: 'remnant_guard', hollow_warden: 'royal_warden', wraith: 'remnant_guard', echo_archer: 'archer',
  goblin: 'guard', goblin_king: 'royal_warden', bat: 'remnant_guard', widow: 'archer', widowling: 'remnant_guard', widow_mother: 'royal_warden',
  lamia: 'royal_warden', lamia_maw: 'kingsguard',
};
export const MONSTER_RIGS = new Set<AssetId>(['hollow', 'ghost', 'goblin', 'bat', 'widow', 'lamia']);

/** Hit window from the hero manifest's measured sword peak (same clip, retargeted). */
function win(clipId: string, i = 0, pad0 = 0.06, pad1 = 0.06): [number, number] {
  const p = HERO_CLIPS[clipId]?.swordPeaks[i];
  if (!p) throw new Error('No sword peak for enemy attack clip ' + clipId);
  return [Math.max(0, p.window[0] - pad0), p.window[1] + pad1];
}
function foot(clipId: string): [number, number] {
  const p = HERO_CLIPS[clipId].footPeaks[0];
  return [p.window[0] - 0.05, p.window[1] + 0.05];
}

const KNIGHT_CLIPS = { idle: 'idle_combat', walk: 'walk_fwd', run: 'run_fwd', strafeL: 'strafe_walk_left', strafeR: 'strafe_walk_right', back: 'walk_back', hitL: 'hit_light', hitH: 'hit_heavy', death: ['death_back', 'death_kneel'], block: 'block_idle', blockHit: 'block_impact', rise: 'crouch_exit', kneel: 'crouch_idle' };
const HOLLOW_CLIPS = { idle: 'idle_alert', walk: 'walk_fwd', run: 'run_fwd', strafeL: 'strafe_walk_left', strafeR: 'strafe_walk_right', hitL: 'hit_light', hitH: 'hit_heavy', death: ['death_back', 'death_kneel'], rise: 'crouch_exit', kneel: 'crouch_idle' };
const GOBLIN_CLIPS = { idle: 'idle_combat', walk: 'walk_fwd', run: 'run_fwd', strafeL: 'strafe_run_left', strafeR: 'strafe_run_right', back: 'run_back', hitL: 'hit_light', hitH: 'hit_heavy', death: ['death_back', 'death_kneel'], rise: 'crouch_exit', kneel: 'crouch_idle' };
/** the procedural monsters have one clip each (renamed at load, GameAssets.prepareEnemy); deaths are procedural */
const BAT_CLIPS = { idle: 'flap', walk: 'flap', run: 'flap', hitL: 'flap', hitH: 'flap', death: ['flap'] };
const WIDOW_CLIPS = { idle: 'crawl', walk: 'crawl', run: 'crawl', hitL: 'crawl', hitH: 'crawl', death: ['crawl'], rise: 'crawl' };
const LAMIA_CLIPS = { idle: 'sway', walk: 'sway', run: 'sway', hitL: 'sway', hitH: 'sway', death: ['sway'], rise: 'sway' };
const ARCHER_CLIPS = { idle: 'a_idle', walk: 'a_walk_fwd', run: 'a_walk_fwd', strafeL: 'a_walk_left', strafeR: 'a_walk_right', back: 'a_walk_back', hitL: 'hit_light', hitH: 'hit_heavy', death: ['death_back', 'death_kneel'], rise: 'crouch_exit', kneel: 'crouch_idle' };

/** the goblin's own blows: the hero's one-handed cuts, quicker and lighter (retargeted clips, same timings) */
const goblinAttacks: EnemyAttack[] = [
  { clip: 'atk_chop', speed: 1.4, start: 0.05, window: win('atk_chop'), damage: 9, range: 1.9, arc: 80, knock: 1.5, weight: 3, cooldown: [0.9, 1.6], rootScale: 0.8, telegraph: 0.18 },
  { clip: 'atk_rising_cut', speed: 1.4, start: 0.3, window: win('atk_rising_cut'), damage: 10, range: 2.0, arc: 90, knock: 2, weight: 2, cooldown: [1.0, 1.8], rootScale: 0.8 },
  { clip: 'atk_lunge_cut', speed: 1.35, start: 0.15, window: win('atk_lunge_cut'), damage: 12, range: 3.0, arc: 60, knock: 2.5, weight: 1.5, cooldown: [1.4, 2.2], rootScale: 0.75, minRange: 1.6, telegraph: 0.25 },
];
/** the goblin's leap: the jump-spin (airborne double turn, lands in a cut) thrown from 3.4–7.5 m */
export const GOBLIN_LEAP: EnemyAttack = { clip: 'atk_jump_spin', speed: 1.25, start: 0.35, window: win('atk_jump_spin', 0, 0.12, 0.1), damage: 14, range: 2.3, arc: 120, knock: 3, weight: 0, cooldown: [1.6, 2.4], rootScale: 1.25, minRange: 3.4, telegraph: 0.3 };

const guardAttacks: EnemyAttack[] = [
  { clip: 'atk_chop', speed: 1.05, start: 0.0, window: win('atk_chop'), damage: 15, range: 2.2, arc: 70, knock: 2, weight: 3, cooldown: [1.4, 2.4], rootScale: 1, telegraph: 0.25 },
  { clip: 'atk_lunge_cut', speed: 1.1, start: 0.15, window: win('atk_lunge_cut'), damage: 18, range: 3.2, arc: 60, knock: 3, weight: 2, cooldown: [1.8, 2.8], rootScale: 0.7, minRange: 1.8, telegraph: 0.35 },
  { clip: 'atk_rising_cut', speed: 1.15, start: 0.25, window: win('atk_rising_cut'), damage: 16, range: 2.3, arc: 80, knock: 2, weight: 2, cooldown: [1.6, 2.6], rootScale: 1 },
];

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  guard: {
    id: 'guard', asset: 'knight', scale: 1.0, hp: 70, poise: 40, runSpeed: 3.6, walkSpeed: 1.4, radius: 0.4, height: 1.9,
    reward: 40, blockChance: 0.3, aggroRange: 11, turnRate: 5.5, attacks: guardAttacks, clips: KNIGHT_CLIPS, slotCost: 1,
  },
  muster: {
    id: 'muster', asset: 'knight', scale: 1.0, aura: 'muster',
    hp: 55, poise: 32, runSpeed: 3.4, walkSpeed: 1.4, radius: 0.4, height: 1.9,
    reward: 40, blockChance: 0.15, aggroRange: 30, turnRate: 5,
    attacks: guardAttacks.map((a) => ({ ...a, damage: Math.round(a.damage * 0.8), cooldown: [a.cooldown[0] + 0.4, a.cooldown[1] + 0.6] as [number, number] })),
    clips: KNIGHT_CLIPS, slotCost: 1,
  },
  royal_warden: {
    id: 'royal_warden', asset: 'knight', scale: 1.14, aura: 'elite',
    hp: 190, poise: 110, runSpeed: 3.9, walkSpeed: 1.5, radius: 0.46, height: 2.15, reward: 100, blockChance: 0.5, aggroRange: 13, turnRate: 6,
    attacks: [
      ...guardAttacks.map((a) => ({ ...a, damage: a.damage * 1.35, speed: a.speed * 1.08 })),
      { clip: 'atk_spin_slash', speed: 1.05, start: 0.1, window: win('atk_spin_slash', 0, 0.1, 0.06), damage: 28, range: 2.8, arc: 360, knock: 4, heavy: true, weight: 2, cooldown: [2.0, 3.0], rootScale: 1, hyperArmor: true, telegraph: 0.4 },
      { clip: 'kick_front', speed: 1.2, start: 0.05, window: foot('kick_front'), damage: 10, range: 1.9, arc: 70, knock: 6, guardBreak: true, weight: 1.5, cooldown: [1.5, 2.5], rootScale: 1 },
    ],
    clips: KNIGHT_CLIPS, slotCost: 2,
  },
  gate_warden: {
    id: 'gate_warden', asset: 'knight', scale: 1.32, aura: 'dread',
    hp: 460, poise: 170, runSpeed: 4.0, walkSpeed: 1.6, radius: 0.55, height: 2.5, reward: 200, blockChance: 0.35, aggroRange: 40, turnRate: 6.5,
    attacks: [
      { clip: 'atk_chop', speed: 1.1, start: 0.0, window: win('atk_chop'), damage: 20, range: 2.7, arc: 70, knock: 3, weight: 2, cooldown: [1.3, 2.1], rootScale: 1.2 },
      { clip: 'atk_advancing_sweep', speed: 1.05, start: 0.05, window: win('atk_advancing_sweep', 0, 0.2, 0.08), damage: 24, range: 3.6, arc: 120, knock: 4, weight: 2, cooldown: [1.9, 2.8], rootScale: 1.0, telegraph: 0.35, hyperArmor: true },
      { clip: 'atk_spin_slash', speed: 1.0, start: 0.05, window: win('atk_spin_slash', 0, 0.12, 0.06), damage: 30, range: 3.4, arc: 360, knock: 5, heavy: true, weight: 1.6, cooldown: [2.6, 3.6], rootScale: 1, hyperArmor: true, telegraph: 0.5 },
      { clip: 'atk_leap_slam', speed: 1.0, start: 0.1, window: win('atk_leap_slam', 0, 0.05, 0.12), damage: 40, range: 3.6, arc: 360, knock: 7, heavy: true, aoe: true, weight: 1.4, cooldown: [3.6, 5.0], rootScale: 1.15, minRange: 4, hyperArmor: true, telegraph: 0.6 },
      { clip: 'atk_whirlwind', speed: 1.2, start: 0.2, window: [win('atk_whirlwind', 0)[0], win('atk_whirlwind', 2)[1]], damage: 16, range: 3.0, arc: 360, knock: 3, weight: 1.2, cooldown: [3.4, 4.4], rootScale: 0.9, hyperArmor: true, telegraph: 0.4 },
      { clip: 'kick_front', speed: 1.2, start: 0.05, window: foot('kick_front'), damage: 12, range: 2.2, arc: 70, knock: 8, guardBreak: true, weight: 1.5, cooldown: [1.5, 2.5], rootScale: 1 },
    ],
    clips: KNIGHT_CLIPS, slotCost: 3, boss: true,
  },
  kingsguard: {
    // Floor 2 boss: guard-heavy royal captain; kicks and heavy swings break guards, the boss bar names it
    id: 'kingsguard', asset: 'knight', scale: 1.3, aura: 'dread',
    hp: 520, poise: 190, runSpeed: 4.1, walkSpeed: 1.6, radius: 0.55, height: 2.45, reward: 200, blockChance: 0.55, aggroRange: 30, turnRate: 6.5,
    attacks: [
      { clip: 'atk_chop', speed: 1.15, start: 0.0, window: win('atk_chop'), damage: 22, range: 2.7, arc: 70, knock: 3, weight: 2, cooldown: [1.2, 2.0], rootScale: 1.2, telegraph: 0.25 },
      { clip: 'atk_rising_cut', speed: 1.15, start: 0.25, window: win('atk_rising_cut'), damage: 22, range: 2.6, arc: 80, knock: 3, weight: 2, cooldown: [1.3, 2.1], rootScale: 1 },
      { clip: 'atk_spin_slash', speed: 1.05, start: 0.05, window: win('atk_spin_slash', 0, 0.12, 0.06), damage: 30, range: 3.3, arc: 360, knock: 5, heavy: true, weight: 1.5, cooldown: [2.4, 3.4], rootScale: 1, hyperArmor: true, telegraph: 0.45 },
      { clip: 'atk_lunge_cut', speed: 1.2, start: 0.1, window: win('atk_lunge_cut'), damage: 26, range: 3.8, arc: 60, knock: 4, weight: 1.5, cooldown: [2.0, 3.0], rootScale: 1.0, minRange: 2.4, telegraph: 0.4 },
      { clip: 'kick_front', speed: 1.2, start: 0.05, window: foot('kick_front'), damage: 12, range: 2.2, arc: 70, knock: 8, guardBreak: true, weight: 1.4, cooldown: [1.5, 2.5], rootScale: 1 },
    ],
    clips: KNIGHT_CLIPS, slotCost: 3, boss: true,
  },
  hollow: {
    id: 'hollow', asset: 'hollow', scale: 1.0,
    hp: 55, poise: 28, runSpeed: 4.4, walkSpeed: 1.6, radius: 0.4, height: 1.95, reward: 40, blockChance: 0, aggroRange: 12, turnRate: 7,
    attacks: [
      { clip: 'atk_chop', speed: 1.2, start: 0.0, window: win('atk_chop'), damage: 12, range: 2.1, arc: 80, knock: 1.5, weight: 3, cooldown: [1.2, 2.2], rootScale: 1, telegraph: 0.2 },
      { clip: 'atk_rising_cut', speed: 1.25, start: 0.3, window: win('atk_rising_cut'), damage: 14, range: 2.2, arc: 90, knock: 2, weight: 2, cooldown: [1.4, 2.4], rootScale: 1 },
      { clip: 'atk_lunge_cut', speed: 1.2, start: 0.1, window: win('atk_lunge_cut'), damage: 16, range: 3.4, arc: 60, knock: 2.5, weight: 2, cooldown: [1.8, 2.8], rootScale: 0.85, minRange: 2.0, telegraph: 0.3 },
    ],
    clips: HOLLOW_CLIPS, slotCost: 1,
  },
  remnant: {
    id: 'remnant', asset: 'hollow', scale: 0.92, aura: 'echo',
    hp: 36, poise: 20, runSpeed: 3.6, walkSpeed: 1.4, radius: 0.38, height: 1.8, reward: 50, blockChance: 0, aggroRange: 30, turnRate: 6,
    attacks: [{ clip: 'atk_chop', speed: 1.0, start: 0.0, window: win('atk_chop'), damage: 8, range: 2.0, arc: 80, knock: 1.2, weight: 1, cooldown: [1.4, 2.4], rootScale: 1, telegraph: 0.3 }],
    clips: HOLLOW_CLIPS, slotCost: 1,
  },
  /**
   * The Past's fissure Echo: a remembered guard (knight rig, faint echo motes), as weak as the Present Remnant.
   * The Past is the living castle — its Echoes are the people it remembers, never the rotted Hollows.
   */
  remnant_guard: {
    id: 'remnant_guard', asset: 'knight', scale: 0.96, aura: 'echo',
    hp: 36, poise: 20, runSpeed: 3.5, walkSpeed: 1.4, radius: 0.4, height: 1.85, reward: 50, blockChance: 0.1, aggroRange: 30, turnRate: 5.5,
    attacks: [{ clip: 'atk_chop', speed: 1.0, start: 0.0, window: win('atk_chop'), damage: 8, range: 2.1, arc: 70, knock: 1.2, weight: 1, cooldown: [1.4, 2.4], rootScale: 1, telegraph: 0.3 }],
    clips: KNIGHT_CLIPS, slotCost: 1,
  },
  hollow_warden: {
    id: 'hollow_warden', asset: 'knight', scale: 1.12, aura: 'corrupt',
    hp: 160, poise: 90, runSpeed: 3.4, walkSpeed: 1.3, radius: 0.46, height: 2.1, reward: 70, blockChance: 0.25, aggroRange: 12, turnRate: 5,
    attacks: [
      { clip: 'atk_chop', speed: 0.95, start: 0.0, window: win('atk_chop'), damage: 24, range: 2.5, arc: 70, knock: 3, weight: 2, cooldown: [1.4, 2.4], rootScale: 1, telegraph: 0.35 },
      { clip: 'atk_spin_slash', speed: 0.95, start: 0.1, window: win('atk_spin_slash', 0, 0.1, 0.06), damage: 28, range: 2.8, arc: 360, knock: 4, heavy: true, weight: 1.4, cooldown: [2.4, 3.4], rootScale: 1, hyperArmor: true, telegraph: 0.5 },
      { clip: 'atk_leap_slam', speed: 0.95, start: 0.1, window: win('atk_leap_slam', 0, 0.05, 0.1), damage: 34, range: 3.2, arc: 360, knock: 5, heavy: true, aoe: true, weight: 1, cooldown: [3.0, 4.0], rootScale: 1.0, minRange: 3.5, hyperArmor: true, telegraph: 0.6 },
    ],
    clips: KNIGHT_CLIPS, slotCost: 2,
  },
  archer: {
    id: 'archer', asset: 'archer', scale: 1.0, hp: 40, poise: 20, runSpeed: 2.6, walkSpeed: 1.5, radius: 0.36, height: 1.8,
    reward: 30, blockChance: 0, aggroRange: 34, turnRate: 6, attacks: [],
    ranged: { range: [7, 32], sight: 34, projectileSpeed: 29, damage: 14, interval: [1.5, 2.4] }, clips: ARCHER_CLIPS, slotCost: 0,
  },
  echo_archer: {
    id: 'echo_archer', asset: 'archer', scale: 1.0, aura: 'echo', spectralArrows: true,
    hp: 36, poise: 20, runSpeed: 2.6, walkSpeed: 1.5, radius: 0.36, height: 1.8, reward: 30, blockChance: 0, aggroRange: 34, turnRate: 6, attacks: [],
    ranged: { range: [7, 32], sight: 34, projectileSpeed: 27, damage: 13, interval: [1.7, 2.6] }, clips: ARCHER_CLIPS, slotCost: 0,
  },
  /** Floor 3 final boss (docs/LEVEL_03_BLUEPRINT.md §I): the mage fight lives in src/enemies/LastCrown.ts */
  last_crown: {
    id: 'last_crown', asset: 'lastcrown', scale: 1.15, aura: 'dread',
    hp: 1600, poise: 260, runSpeed: 3.6, walkSpeed: 1.9, radius: 0.5, height: 2.6, reward: 200, blockChance: 0, aggroRange: 40, turnRate: 5,
    attacks: [],
    clips: { idle: 'idle', walk: 'walk_fwd', run: 'run_fwd', strafeL: 'walk_left', strafeR: 'walk_right', back: 'walk_back', hitL: 'hit_small', hitH: 'hit_large', death: ['death'] },
    slotCost: 0, boss: true,
  },
  // ---------------------------------------------------------------- session 9 monsters (enemies/Monsters.ts)
  /** Ruin goblins: scavengers nesting in the Present ruin. Small, fast, in packs: zig-zag in, leap from range, two
   *  quick cuts, hop back out; they sidestep a heavy wind-up. */
  goblin: {
    id: 'goblin', asset: 'goblin', scale: 1.0, brain: 'goblin', blood: 0x3b2508,
    hp: 42, poise: 18, runSpeed: 5.4, walkSpeed: 2.0, radius: 0.34, height: 1.35, reward: 30, blockChance: 0, aggroRange: 14, turnRate: 9,
    attacks: goblinAttacks, clips: GOBLIN_CLIPS, slotCost: 1,
  },
  /** Mini-boss (Floor 2): the pack's king. War cry (the pack frenzies, reinforcements leap in), leap slam, spin. */
  goblin_king: {
    id: 'goblin_king', asset: 'goblin', scale: 1.6, brain: 'goblin', blood: 0x3b2508, aura: 'elite', miniBoss: 'THE GUTTER KING',
    hp: 600, poise: 150, runSpeed: 5.0, walkSpeed: 2.0, radius: 0.5, height: 2.1, reward: 150, blockChance: 0, aggroRange: 30, turnRate: 7.5,
    attacks: [
      { clip: 'atk_chop', speed: 1.25, start: 0.05, window: win('atk_chop'), damage: 18, range: 2.6, arc: 80, knock: 3, weight: 3, cooldown: [1.0, 1.7], rootScale: 1.0, telegraph: 0.22 },
      { clip: 'atk_rising_cut', speed: 1.25, start: 0.3, window: win('atk_rising_cut'), damage: 18, range: 2.6, arc: 90, knock: 3, weight: 2, cooldown: [1.1, 1.8], rootScale: 1.0 },
      { clip: 'atk_spin_slash', speed: 1.1, start: 0.1, window: win('atk_spin_slash', 0, 0.1, 0.06), damage: 24, range: 3.1, arc: 360, knock: 5, heavy: true, weight: 1.6, cooldown: [2.2, 3.2], rootScale: 1, hyperArmor: true, telegraph: 0.4 },
      { clip: 'atk_leap_slam', speed: 1.05, start: 0.1, window: win('atk_leap_slam', 0, 0.05, 0.12), damage: 30, range: 3.6, arc: 360, knock: 7, heavy: true, aoe: true, weight: 1.4, cooldown: [3.2, 4.4], rootScale: 1.1, minRange: 4, hyperArmor: true, telegraph: 0.55 },
      { clip: 'kick_front', speed: 1.25, start: 0.05, window: foot('kick_front'), damage: 12, range: 2.3, arc: 70, knock: 7, guardBreak: true, weight: 1.2, cooldown: [1.5, 2.5], rootScale: 1 },
    ],
    clips: GOBLIN_CLIPS, slotCost: 2, boss: true, finisher: 'none',
  },
  /** Gloom bats: roost in the broken roofs; circle overhead in swarms, two at a time swoop to bite (hit them in the
   *  swoop, or parry: a parried bat drops to the floor, stunned). */
  bat: {
    id: 'bat', asset: 'bat', scale: 1.0, brain: 'bat', blood: 0x3a0c0c,
    hp: 14, poise: 4, runSpeed: 7.5, walkSpeed: 3.0, radius: 0.34, height: 0.72, reward: 12, blockChance: 0, aggroRange: 18, turnRate: 7,
    attacks: [{ clip: '', speed: 1, start: 0, window: [0, 1], damage: 7, range: 1.3, arc: 140, knock: 1.5, weight: 1, cooldown: [2.2, 4.0], rootScale: 1, telegraph: 0.4 }],
    flying: { altitude: 2.0 }, clips: BAT_CLIPS, slotCost: 0, finisher: 'none',
  },
  /** The Widow: a long-haired thing on four spider legs (Present ruins). Drops from the ceiling on a thread, keeps its
   *  distance, spits web (slows, no sprint/dodge), pounces from mid range, jabs up close. attacks = [jab, pounce]. */
  widow: {
    id: 'widow', asset: 'widow', scale: 1.0, brain: 'widow', blood: 0x1b3550, aura: 'corrupt',
    hp: 105, poise: 55, runSpeed: 5.4, walkSpeed: 2.2, radius: 0.62, height: 1.9, reward: 60, blockChance: 0, aggroRange: 16, turnRate: 7,
    attacks: [
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 13, range: 2.3, arc: 80, knock: 2, weight: 1, cooldown: [1.0, 1.8], rootScale: 1, telegraph: 0.3 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 20, range: 1.6, arc: 360, knock: 5, heavy: true, weight: 0, cooldown: [4.5, 6.5], rootScale: 1, telegraph: 0.45 },
    ],
    clips: WIDOW_CLIPS, slotCost: 1, finisher: 'beast',
  },
  /** Widowlings: the brood. Small, quick, fragile; they come in numbers and jab. */
  widowling: {
    id: 'widowling', asset: 'widow', scale: 0.5, brain: 'widow', blood: 0x1b3550,
    hp: 20, poise: 8, runSpeed: 6.2, walkSpeed: 2.6, radius: 0.36, height: 0.95, reward: 12, blockChance: 0, aggroRange: 20, turnRate: 9,
    attacks: [
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 7, range: 1.4, arc: 90, knock: 1, weight: 1, cooldown: [1.1, 2.0], rootScale: 1, telegraph: 0.22 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 9, range: 1.1, arc: 360, knock: 2, weight: 0, cooldown: [3.5, 5.0], rootScale: 1, telegraph: 0.35 },
    ],
    clips: WIDOW_CLIPS, slotCost: 0, finisher: 'none',
  },
  /** Mini-boss (Floor 2): the Weeping Mother, a giant Widow. Webs in volleys, pounces; her brood hatches at 65 % /
   *  35 % (the encounter's waves 2 and 3 crawl out of her). */
  widow_mother: {
    id: 'widow_mother', asset: 'widow', scale: 1.6, brain: 'widow', blood: 0x1b3550, aura: 'dread', miniBoss: 'THE WEEPING MOTHER',
    hp: 650, poise: 170, runSpeed: 4.6, walkSpeed: 2.0, radius: 0.7, height: 3.0, reward: 150, blockChance: 0, aggroRange: 30, turnRate: 5,
    attacks: [
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 20, range: 3.2, arc: 90, knock: 4, weight: 1, cooldown: [1.2, 2.0], rootScale: 1, telegraph: 0.35 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 30, range: 2.4, arc: 360, knock: 7, heavy: true, guardBreak: true, weight: 0, cooldown: [4.0, 5.5], rootScale: 1, telegraph: 0.55 },
    ],
    clips: WIDOW_CLIPS, slotCost: 2, boss: true, finisher: 'none',
  },
  /** Crownheart lamia (Floor 3): a woman's body on serpent coils, a toothed maw in its belly. Slow and heavy: a 360°
   *  tail sweep at ankle height (jump or dodge it), a lunging bite that breaks guards, a coiled guard against
   *  frontal blows (circle it, or kick / heavy through the coil). attacks = [sweep, lunge, lash]. */
  lamia: {
    id: 'lamia', asset: 'lamia', scale: 1.0, brain: 'lamia', blood: 0x28300c, aura: 'corrupt',
    hp: 240, poise: 120, runSpeed: 3.0, walkSpeed: 1.8, radius: 0.72, height: 2.35, reward: 80, blockChance: 0, aggroRange: 15, turnRate: 3.2,
    attacks: [
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 22, range: 4.3, arc: 360, knock: 5, heavy: true, weight: 1, cooldown: [3.0, 4.2], rootScale: 1, telegraph: 0.85 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 26, range: 1.9, arc: 70, knock: 6, heavy: true, guardBreak: true, weight: 1, cooldown: [3.5, 5.0], rootScale: 1, telegraph: 0.7 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 14, range: 3.2, arc: 150, knock: 3, weight: 1, cooldown: [1.4, 2.2], rootScale: 1, telegraph: 0.25 },
    ],
    clips: LAMIA_CLIPS, slotCost: 2, finisher: 'none',
  },
  /** Mini-boss (Floor 3): the Maw of the Crownheart, a greater lamia; its belly-maw looses gloom bats. */
  lamia_maw: {
    id: 'lamia_maw', asset: 'lamia', scale: 1.4, brain: 'lamia', blood: 0x28300c, aura: 'dread', miniBoss: 'THE MAW OF THE CROWNHEART',
    hp: 900, poise: 260, runSpeed: 3.2, walkSpeed: 1.9, radius: 0.75, height: 3.3, reward: 200, blockChance: 0, aggroRange: 30, turnRate: 3.0,
    attacks: [
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 28, range: 5.6, arc: 360, knock: 6, heavy: true, weight: 1, cooldown: [2.6, 3.6], rootScale: 1, telegraph: 0.8 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 34, range: 2.5, arc: 70, knock: 7, heavy: true, guardBreak: true, weight: 1, cooldown: [3.0, 4.2], rootScale: 1, telegraph: 0.65 },
      { clip: '', speed: 1, start: 0, window: [0, 1], damage: 18, range: 4.2, arc: 150, knock: 4, weight: 1, cooldown: [1.2, 2.0], rootScale: 1, telegraph: 0.25 },
    ],
    clips: LAMIA_CLIPS, slotCost: 3, boss: true, finisher: 'none',
  },
  wraith: {
    id: 'wraith', asset: 'ghost', scale: 1.0, aura: 'echo',
    hp: 30, poise: 12, runSpeed: 5.2, walkSpeed: 2.0, radius: 0.45, height: 1.6, reward: 25, blockChance: 0, aggroRange: 16, turnRate: 5,
    attacks: [{ clip: '', speed: 1, start: 0, window: [0.35, 0.6], damage: 10, range: 2.2, arc: 90, knock: 2, weight: 1, cooldown: [1.6, 2.8], rootScale: 1, telegraph: 0.35 }],
    flying: { altitude: 1.9 }, clips: { idle: 'float', walk: 'float', run: 'float', hitL: 'float', hitH: 'float', death: ['float'] }, slotCost: 1,
  },
};
