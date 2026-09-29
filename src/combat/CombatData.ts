/**
 * Player attack definitions. Clip timings come from the measured peaks in heroAnimations.json
 * (via animationManifest.ts); gameplay tuning (speed, damage, poise, windows) lives here.
 * All times are CLIP seconds (before playback speed is applied).
 */
import { clip } from '../data/animationManifest';

export type AttackKind = 'light' | 'heavy' | 'finisher' | 'kick' | 'bash' | 'air' | 'crouch' | 'sprint' | 'whirl';

export interface HitWindow {
  t0: number; t1: number;
  damage: number; poise: number; knock: number;
  /** 'blade' = swept sword segment; 'radial' = circle around the player (spin/slam); 'front' = short cone (kick/bash). */
  shape: 'blade' | 'radial' | 'front';
  reach?: number; arc?: number; knockdown?: boolean; guardBreak?: boolean;
}

export interface AttackDef {
  id: string; clip: string; kind: AttackKind;
  speed: number; start: number;      // playback speed; clip start offset
  hits: HitWindow[];
  inputFrom: number;                  // clip time from which a buffered follow-up is accepted
  cancelAt: number;                   // clip time at which the follow-up actually starts
  endAt: number;                      // clip time when control returns to locomotion
  recoveryCancel: number;             // clip time after which dodge/guard may cancel
  rootScale: number;
  track: number;                      // clip seconds of steering toward the target at the start
  hyperArmor?: [number, number];
  resonance?: number;                 // bonus resonance when any hit of this attack connects (finishers)
  /**
   * Follow-ups. light/heavy/kick = pressed during the combo window. pause = a light press that comes a beat
   * late (after the combo window closed, up to PAUSE_GRACE after the attack ends): the alternative route.
   */
  next?: { light?: string; heavy?: string; kick?: string; pause?: string };
  /** hold the heavy button: the clip freezes at `at` (sword raised) for up to `max` s; hits scale with the charge */
  charge?: { at: number; max: number };
  /** ground shockwave: radial reach grows by `reach` m at full charge; damage falls off to (1 - falloff) at the rim */
  shock?: { reach: number; falloff: number };
  /** Whirlwind segment (hold light): ends at endAt and chains into the next segment while light is held */
  whirl?: boolean;
  /** two-handed Great Sword technique (trail colour / tooling) */
  twoHanded?: boolean;
  /** max extra forward speed (m/s) used during the wind-up to close the gap to the target (magnetism) */
  lunge?: number;
  /** playback pacing multipliers per phase (default from the kind): see speedAt() */
  pace?: Pace;
}

/**
 * Attack pacing: the clip plays faster through the anticipation, faster still through the strike (acceleration
 * into the contact), hangs for a beat on the follow-through (the hit reads), then recovers quickly.
 * Multipliers apply to AttackDef.speed; all phase boundaries are clip times derived from the hit windows.
 */
export interface Pace { windup: number; strike: number; follow: number; recover: number }
const PACE: Record<AttackKind, Pace> = {
  light: { windup: 1.3, strike: 1.1, follow: 0.8, recover: 1.3 },
  crouch: { windup: 1.25, strike: 1.1, follow: 0.85, recover: 1.25 },
  sprint: { windup: 1.15, strike: 1.15, follow: 0.8, recover: 1.2 },
  heavy: { windup: 0.95, strike: 1.25, follow: 0.72, recover: 1.15 },
  finisher: { windup: 1.05, strike: 1.2, follow: 0.78, recover: 1.15 },
  air: { windup: 1.0, strike: 1.15, follow: 0.85, recover: 1.1 },
  kick: { windup: 1.2, strike: 1.1, follow: 0.85, recover: 1.25 },
  bash: { windup: 1.2, strike: 1.1, follow: 0.85, recover: 1.25 },
  whirl: { windup: 1, strike: 1, follow: 1, recover: 1 },
};

/** Playback speed at clip time t (windup before each hit window, strike inside it, follow until cancelAt). */
export function speedAt(def: AttackDef, t: number): number {
  const p = def.pace ?? PACE[def.kind];
  const hits = def.hits;
  let mult = p.recover;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (t < h.t0 - 0.04) { mult = p.windup; break; }
    if (t <= h.t1) { mult = p.strike; break; }
    if (i === hits.length - 1) mult = t <= def.cancelAt ? p.follow : p.recover;
  }
  return def.speed * mult;
}

/** Real seconds from the attack's start to clip time `clipT` (integrates the pacing). */
export function realTimeTo(def: AttackDef, clipT: number): number {
  let real = 0;
  const step = 1 / 240;
  for (let t = def.start; t < clipT; t += step) real += Math.min(step, clipT - t) / speedAt(def, t);
  return real;
}

/** Impact feel per attack kind: hit-stop (s), camera shake, camera kick (m/s), FOV punch (deg), haptic (ms), enemy lean (rad). */
export interface Feel { stop: number; shake: number; punch: number; fov: number; buzz: number; lean: number }
export const FEEL: Record<AttackKind, Feel> = {
  light: { stop: 0.055, shake: 0.12, punch: 1.4, fov: 0.6, buzz: 8, lean: 0.13 },
  crouch: { stop: 0.06, shake: 0.14, punch: 1.4, fov: 0.6, buzz: 9, lean: 0.16 },
  sprint: { stop: 0.075, shake: 0.2, punch: 2.4, fov: 1.4, buzz: 16, lean: 0.22 },
  heavy: { stop: 0.095, shake: 0.26, punch: 3.0, fov: 2.0, buzz: 22, lean: 0.3 },
  finisher: { stop: 0.11, shake: 0.3, punch: 3.4, fov: 2.4, buzz: 28, lean: 0.34 },
  air: { stop: 0.09, shake: 0.26, punch: 3.0, fov: 1.8, buzz: 20, lean: 0.3 },
  kick: { stop: 0.07, shake: 0.18, punch: 2.2, fov: 0.8, buzz: 14, lean: 0.3 },
  bash: { stop: 0.07, shake: 0.18, punch: 2.0, fov: 0.8, buzz: 14, lean: 0.26 },
  // many quick radial hits: a short bite each (a long stop per hit would stutter the spin)
  whirl: { stop: 0.03, shake: 0.08, punch: 0.9, fov: 0.3, buzz: 7, lean: 0.24 },
};

function peakWindow(clipId: string, i: number, pad0 = 0.05, pad1 = 0.07): [number, number] {
  const p = clip(clipId).swordPeaks[i];
  if (!p) throw new Error(`No sword peak ${i} in ${clipId}`);
  return [Math.max(0, p.window[0] - pad0), p.window[1] + pad1];
}
function footWindow(clipId: string): [number, number] {
  const p = clip(clipId).footPeaks[0];
  return [p.window[0] - 0.04, p.window[1] + 0.06];
}
function shieldWindow(clipId: string): [number, number] {
  const p = clip(clipId).shieldPeaks[0];
  return [Math.max(0, p.window[0] - 0.03), p.window[1] + 0.12];
}

const w = (clipId: string, i: number) => peakWindow(clipId, i);

/**
 * Combo graph (session 5: one-handed Sword & Shield base + two-handed Great Sword techniques).
 *
 *   ROUTE A (light, tempo):   L1 → L2 → L3 → L4 → L5 (two-handed cleave) → L1
 *   ROUTE B (light, "pause"): L1 ‥ L2 ‥ L3 ‥ — a light press one beat late — → B2 quick cut → B3 low sweep → B4 spin
 *                             double (finisher) → L1.  (L1‥→B2, L2‥→B3, L3‥→B4)
 *   HEAVY ENDPOINTS:          L1+H F1c whirlwind · L2+H F1 whirlwind · L3+H F3 high spin · L4+H F2 leap slam ·
 *                             L5+H F4 rampage (3 cuts) · B2+H F2 · B3+H F5 leaping double spin
 *   HEAVY CHAIN:              H1 spin slash → H2 jump spin → H3 Crownbreaker (HOLD heavy to charge, release = plunge
 *                             shockwave; guard break).  H1+L → L3.
 *   CONTEXTUAL:               sprint+L slide cut · sprint+H leaping double spin · dodge→L lunge cut · dodge→H high spin
 *                             · air attack · crouch L → crouch sweep → two-handed crouch sweep · kick → spinning kick ·
 *                             guard+L shield bash · parry→L riposte (cleave) · parry→H high spin · heavy near a
 *                             staggered enemy under 45 % HP = EXECUTION (plunge).
 */
export const PAUSE_GRACE = 0.5;       // s after an attack ends in which a late light press still branches (route B)
export const COUNTER_WINDOW = 0.75;   // s after a parry in which light/heavy = riposte

export const ATTACKS: Record<string, AttackDef> = {
  /**
   * L1 = the opening forehand diagonal of 'atk_whirlwind' (session 4; was 'atk_chop', a short upward
   * flourish whose tip never crossed in front of the body, 26 m/s peak). Measured from the clip
   * (build/analysis/swing_paths.json): a small coil, then the torso unwinds ~177 deg while the tip cuts from high
   * right to low left through the front, reaching 1.9 m at 44 m/s. It starts close to the idle stance, so
   * it opens from neutral cleanly, and L1 -> Heavy continues the same whirlwind (F1c) without a seam.
   */
  L1: {
    id: 'L1', clip: 'atk_whirlwind', kind: 'light', speed: 1.45, start: 0.30,
    hits: [{ t0: w('atk_whirlwind', 0)[0], t1: 0.86, damage: 15, poise: 24, knock: 1.7, shape: 'blade', reach: 2.3 }],
    inputFrom: 0.32, cancelAt: 0.84, endAt: 1.02, recoveryCancel: 0.76, rootScale: 1.3, track: 0.45, lunge: 3.5,
    pace: { windup: 1.35, strike: 1.1, follow: 0.8, recover: 1.3 },
    next: { light: 'L2', heavy: 'F1c', pause: 'B2' },
  },
  L2: {
    id: 'L2', clip: 'atk_rising_cut', kind: 'light', speed: 1.55, start: 0.46,
    hits: [{ t0: w('atk_rising_cut', 0)[0], t1: w('atk_rising_cut', 0)[1], damage: 16, poise: 25, knock: 1.5, shape: 'blade', reach: 2.1 }],
    inputFrom: 0.5, cancelAt: 0.96, endAt: 1.26, recoveryCancel: 0.9, rootScale: 1, track: 0.4, lunge: 3,
    next: { light: 'L3', heavy: 'F1', pause: 'B3' },
  },
  L3: {
    id: 'L3', clip: 'atk_lunge_cut', kind: 'light', speed: 1.5, start: 0.36,
    hits: [{ t0: w('atk_lunge_cut', 0)[0], t1: w('atk_lunge_cut', 0)[1], damage: 20, poise: 38, knock: 2.4, shape: 'blade', reach: 2.4 }],
    inputFrom: 0.5, cancelAt: 1.0, endAt: 1.4, recoveryCancel: 0.9, rootScale: 0.75, track: 0.45, lunge: 3,
    next: { light: 'L4', heavy: 'F3', pause: 'B4' },
  },
  L4: {
    id: 'L4', clip: 'atk_advancing_sweep', kind: 'light', speed: 1.35, start: 0.08,
    hits: [{ t0: w('atk_advancing_sweep', 0)[0] - 0.12, t1: w('atk_advancing_sweep', 0)[1], damage: 24, poise: 45, knock: 3.0, shape: 'blade', reach: 2.6 }],
    inputFrom: 0.5, cancelAt: 0.95, endAt: 1.2, recoveryCancel: 0.8, rootScale: 0.65, track: 0.4, lunge: 3,
    next: { light: 'L5', heavy: 'F2' },
  },
  H1: {
    id: 'H1', clip: 'atk_spin_slash', kind: 'heavy', speed: 1.22, start: 0.0,
    hits: [{ t0: w('atk_spin_slash', 0)[0] - 0.08, t1: w('atk_spin_slash', 0)[1] + 0.05, damage: 30, poise: 65, knock: 3.5, shape: 'radial', reach: 2.7 }],
    inputFrom: 0.5, cancelAt: 0.95, endAt: 1.32, recoveryCancel: 0.9, rootScale: 1, track: 0.35,
    hyperArmor: [0.3, 0.75], next: { heavy: 'H2', light: 'L3' },
  },
  H2: {
    id: 'H2', clip: 'atk_jump_spin', kind: 'heavy', speed: 1.4, start: 0.35,
    hits: [{ t0: w('atk_jump_spin', 0)[0] - 0.1, t1: w('atk_jump_spin', 0)[1] + 0.05, damage: 36, poise: 90, knock: 4.0, shape: 'radial', reach: 2.9, knockdown: true }],
    inputFrom: 1.5, cancelAt: 1.85, endAt: 2.1, recoveryCancel: 1.7, rootScale: 1, track: 0.6,
    hyperArmor: [0.6, 1.45], resonance: 6, next: { light: 'L1', heavy: 'H3' },
  },
  F1: {
    id: 'F1', clip: 'atk_whirlwind', kind: 'finisher', speed: 1.55, start: 0.25,
    hits: [
      { t0: w('atk_whirlwind', 0)[0], t1: w('atk_whirlwind', 0)[1], damage: 16, poise: 30, knock: 1.5, shape: 'blade', reach: 2.5 },
      { t0: w('atk_whirlwind', 1)[0], t1: w('atk_whirlwind', 1)[1], damage: 16, poise: 30, knock: 1.5, shape: 'radial', reach: 2.5 },
      { t0: w('atk_whirlwind', 2)[0], t1: w('atk_whirlwind', 2)[1], damage: 32, poise: 100, knock: 4.0, shape: 'radial', reach: 3.0, knockdown: true },
    ],
    inputFrom: 3.0, cancelAt: 3.2, endAt: 3.3, recoveryCancel: 2.75, rootScale: 0.7, track: 0.9,
    hyperArmor: [0.6, 2.6], resonance: 6,
  },
  /** L1 -> Heavy: the whirlwind carries on from exactly where L1's slash ended (hits 2 and 3). */
  F1c: {
    id: 'F1c', clip: 'atk_whirlwind', kind: 'finisher', speed: 1.55, start: 0.84,
    hits: [
      { t0: w('atk_whirlwind', 1)[0], t1: w('atk_whirlwind', 1)[1], damage: 18, poise: 34, knock: 1.8, shape: 'radial', reach: 2.5 },
      { t0: w('atk_whirlwind', 2)[0], t1: w('atk_whirlwind', 2)[1], damage: 34, poise: 100, knock: 4.2, shape: 'radial', reach: 3.0, knockdown: true },
    ],
    inputFrom: 3.0, cancelAt: 3.2, endAt: 3.3, recoveryCancel: 2.75, rootScale: 0.7, track: 0.6,
    hyperArmor: [0.84, 2.6], resonance: 6,
  },
  F2: {
    id: 'F2', clip: 'atk_leap_slam', kind: 'finisher', speed: 1.4, start: 0.25,
    hits: [{ t0: w('atk_leap_slam', 0)[0], t1: w('atk_leap_slam', 0)[1] + 0.05, damage: 44, poise: 120, knock: 5.0, shape: 'radial', reach: 3.2, knockdown: true }],
    inputFrom: 1.8, cancelAt: 2.0, endAt: 2.2, recoveryCancel: 1.6, rootScale: 0.85, track: 0.75,
    hyperArmor: [0.35, 1.3], resonance: 6,
  },
  AIR: {
    id: 'AIR', clip: 'atk_jump_spin', kind: 'air', speed: 1.5, start: 0.95,
    hits: [{ t0: w('atk_jump_spin', 0)[0] - 0.1, t1: w('atk_jump_spin', 0)[1] + 0.08, damage: 30, poise: 80, knock: 3.2, shape: 'radial', reach: 2.6, knockdown: true }],
    inputFrom: 1.7, cancelAt: 1.9, endAt: 2.1, recoveryCancel: 1.6, rootScale: 0.0, track: 0.3,
  },
  CROUCH_L: {
    id: 'CROUCH_L', clip: 'atk_crouch_sweep', kind: 'crouch', speed: 1.45, start: 0.0,
    hits: [{ t0: w('atk_crouch_sweep', 0)[0], t1: w('atk_crouch_sweep', 0)[1], damage: 14, poise: 70, knock: 1.5, shape: 'radial', reach: 2.4, arc: 200, knockdown: true }],
    inputFrom: 0.7, cancelAt: 0.95, endAt: 1.2, recoveryCancel: 0.8, rootScale: 1, track: 0.3,
    next: { light: 'CROUCH_L2' },
  },
  KICK: {
    id: 'KICK', clip: 'kick_front', kind: 'kick', speed: 1.4, start: 0.05,
    hits: [{ t0: footWindow('kick_front')[0], t1: footWindow('kick_front')[1], damage: 8, poise: 70, knock: 7.5, shape: 'front', reach: 1.9, arc: 80, guardBreak: true }],
    inputFrom: 0.6, cancelAt: 0.75, endAt: 0.95, recoveryCancel: 0.6, rootScale: 1, track: 0.2,
    next: { light: 'L3', heavy: 'H1', kick: 'KICK2' },
  },
  BASH: {
    id: 'BASH', clip: 'shield_bash', kind: 'bash', speed: 1.25, start: 0.0,
    hits: [{ t0: shieldWindow('shield_bash')[0], t1: shieldWindow('shield_bash')[1], damage: 6, poise: 90, knock: 4.0, shape: 'front', reach: 1.7, arc: 100, guardBreak: true }],
    inputFrom: 0.35, cancelAt: 0.5, endAt: 0.8, recoveryCancel: 0.4, rootScale: 1, track: 0.15,
    next: { light: 'L2', heavy: 'H1' },
  },

  // ---------------------------------------------------------------- session 5: Great Sword techniques (two-handed)
  /** Route A end: horizontal cut, then an overhead two-handed chop (the chain's heaviest light blow). */
  L5: {
    id: 'L5', clip: 'gs_cleave', kind: 'light', speed: 1.3, start: 0.0, twoHanded: true,
    hits: [
      { t0: w('gs_cleave', 0)[0], t1: w('gs_cleave', 0)[1], damage: 13, poise: 22, knock: 1.4, shape: 'blade', reach: 2.4 },
      { t0: w('gs_cleave', 1)[0], t1: w('gs_cleave', 1)[1], damage: 26, poise: 60, knock: 3.4, shape: 'blade', reach: 2.6 },
    ],
    inputFrom: 0.62, cancelAt: 0.92, endAt: 1.15, recoveryCancel: 0.84, rootScale: 1, track: 0.4, lunge: 3,
    next: { light: 'L1', heavy: 'F4' },
  },
  /** Route B opener (pause combo): quick two-handed double cut from a raised guard. */
  B2: {
    id: 'B2', clip: 'gs_quick_cut', kind: 'light', speed: 1.4, start: 0.0, twoHanded: true,
    hits: [
      { t0: w('gs_quick_cut', 0)[0], t1: w('gs_quick_cut', 0)[1], damage: 12, poise: 20, knock: 1.3, shape: 'blade', reach: 2.4 },
      { t0: w('gs_quick_cut', 1)[0], t1: w('gs_quick_cut', 1)[1], damage: 14, poise: 26, knock: 1.8, shape: 'blade', reach: 2.4 },
    ],
    inputFrom: 0.42, cancelAt: 0.62, endAt: 0.95, recoveryCancel: 0.6, rootScale: 1, track: 0.4, lunge: 3.2,
    next: { light: 'B3', heavy: 'F2' },
  },
  /** Route B: the blade goes up and comes round at knee height — a wide low sweep that trips crowds. */
  B3: {
    id: 'B3', clip: 'gs_low_sweep', kind: 'light', speed: 1.5, start: 0.25, twoHanded: true,
    hits: [{ t0: w('gs_low_sweep', 0)[0], t1: w('gs_low_sweep', 0)[1], damage: 22, poise: 55, knock: 2.8, shape: 'blade', reach: 2.7 }],
    inputFrom: 0.95, cancelAt: 1.16, endAt: 1.45, recoveryCancel: 1.1, rootScale: 1, track: 0.45, lunge: 3,
    next: { light: 'B4', heavy: 'F5' },
  },
  /** Route B finisher: a full spin with a double cut and an overhead finish (~1.1 m advance). */
  B4: {
    id: 'B4', clip: 'gs_spin_double', kind: 'finisher', speed: 1.35, start: 0.1, twoHanded: true,
    hits: [
      { t0: 0.55, t1: 0.8, damage: 16, poise: 34, knock: 2.0, shape: 'radial', reach: 2.7 },
      { t0: 0.82, t1: 1.06, damage: 16, poise: 34, knock: 2.2, shape: 'radial', reach: 2.7 },
      { t0: w('gs_spin_double', 2)[0], t1: w('gs_spin_double', 2)[1], damage: 30, poise: 90, knock: 4.2, shape: 'blade', reach: 2.8, knockdown: true },
    ],
    inputFrom: 1.5, cancelAt: 1.62, endAt: 1.75, recoveryCancel: 1.52, rootScale: 1, track: 0.5,
    hyperArmor: [0.3, 1.4], resonance: 6, next: { light: 'L1' },
  },
  /** L3 + Heavy: advancing two-cut spin (≈2.3 m) — the gap closer inside a chain. */
  F3: {
    id: 'F3', clip: 'gs_high_spin', kind: 'finisher', speed: 1.4, start: 0.0, twoHanded: true,
    hits: [
      { t0: w('gs_high_spin', 0)[0], t1: w('gs_high_spin', 0)[1], damage: 22, poise: 50, knock: 2.6, shape: 'blade', reach: 2.8 },
      { t0: w('gs_high_spin', 1)[0], t1: w('gs_high_spin', 1)[1], damage: 30, poise: 100, knock: 4.4, shape: 'radial', reach: 3.1, knockdown: true },
    ],
    inputFrom: 1.5, cancelAt: 1.62, endAt: 1.8, recoveryCancel: 1.45, rootScale: 1, track: 0.55,
    hyperArmor: [0.2, 1.25], resonance: 6,
  },
  /** L5 + Heavy: the rampage — three heavy two-handed cuts with a full spin, ~3 m forward. */
  F4: {
    id: 'F4', clip: 'gs_rampage', kind: 'finisher', speed: 1.4, start: 0.3, twoHanded: true,
    hits: [
      { t0: w('gs_rampage', 0)[0], t1: w('gs_rampage', 0)[1], damage: 22, poise: 50, knock: 2.4, shape: 'blade', reach: 2.8 },
      { t0: w('gs_rampage', 1)[0], t1: w('gs_rampage', 1)[1], damage: 26, poise: 60, knock: 2.8, shape: 'radial', reach: 3.0 },
      { t0: w('gs_rampage', 2)[0], t1: w('gs_rampage', 2)[1], damage: 42, poise: 130, knock: 5.0, shape: 'radial', reach: 3.2, knockdown: true },
    ],
    inputFrom: 3.2, cancelAt: 3.35, endAt: 3.45, recoveryCancel: 3.0, rootScale: 0.85, track: 0.9,
    hyperArmor: [0.5, 2.9], resonance: 8,
  },
  /** B3 + Heavy: leap with a double airborne spin, landing in a ground cut (~3 m). */
  F5: {
    id: 'F5', clip: 'gs_leap_spin', kind: 'finisher', speed: 1.4, start: 0.2, twoHanded: true,
    hits: [{ t0: w('gs_leap_spin', 0)[0], t1: w('gs_leap_spin', 0)[1] + 0.05, damage: 42, poise: 120, knock: 5.0, shape: 'radial', reach: 3.2, knockdown: true }],
    inputFrom: 1.8, cancelAt: 1.95, endAt: 2.1, recoveryCancel: 1.7, rootScale: 1.0, track: 0.8,
    hyperArmor: [0.3, 1.4], resonance: 6,
  },
  /** Sprint + Heavy: the same leaping double spin out of a run (the gap closer). */
  SPRINT_H: {
    id: 'SPRINT_H', clip: 'gs_leap_spin', kind: 'sprint', speed: 1.45, start: 0.25, twoHanded: true,
    hits: [{ t0: w('gs_leap_spin', 0)[0], t1: w('gs_leap_spin', 0)[1] + 0.05, damage: 40, poise: 110, knock: 5.0, shape: 'radial', reach: 3.2, knockdown: true }],
    inputFrom: 1.8, cancelAt: 1.95, endAt: 2.1, recoveryCancel: 1.7, rootScale: 1.0, track: 0.8,
    hyperArmor: [0.3, 1.4],
  },
  /** Sprint + Light: knee-slide under the guard with a sweeping cut (~3.5 m). */
  SPRINT_L: {
    id: 'SPRINT_L', clip: 'gs_slide_cut', kind: 'sprint', speed: 1.5, start: 0.35, twoHanded: true,
    hits: [{ t0: w('gs_slide_cut', 0)[0], t1: w('gs_slide_cut', 0)[1], damage: 24, poise: 60, knock: 3.0, shape: 'blade', reach: 2.7 }],
    inputFrom: 1.5, cancelAt: 1.72, endAt: 1.98, recoveryCancel: 1.6, rootScale: 0.9, track: 0.6,
    next: { light: 'L2', heavy: 'F2' },
  },
  /** Dodge → Light: the stepping lunge cut out of the dash. */
  DODGE_L: {
    id: 'DODGE_L', clip: 'atk_lunge_cut', kind: 'sprint', speed: 1.6, start: 0.1,
    hits: [{ t0: w('atk_lunge_cut', 0)[0], t1: w('atk_lunge_cut', 0)[1], damage: 22, poise: 45, knock: 2.6, shape: 'blade', reach: 2.4 }],
    inputFrom: 0.5, cancelAt: 1.0, endAt: 1.4, recoveryCancel: 0.9, rootScale: 1.0, track: 0.5, lunge: 3.5,
    next: { light: 'L4', heavy: 'F2' },
  },
  /** Dodge → Heavy: the advancing high spin. */
  DODGE_H: {
    id: 'DODGE_H', clip: 'gs_high_spin', kind: 'sprint', speed: 1.45, start: 0.05, twoHanded: true,
    hits: [
      { t0: w('gs_high_spin', 0)[0], t1: w('gs_high_spin', 0)[1], damage: 22, poise: 50, knock: 2.6, shape: 'blade', reach: 2.8 },
      { t0: w('gs_high_spin', 1)[0], t1: w('gs_high_spin', 1)[1], damage: 28, poise: 90, knock: 4.2, shape: 'radial', reach: 3.1, knockdown: true },
    ],
    inputFrom: 1.5, cancelAt: 1.62, endAt: 1.8, recoveryCancel: 1.45, rootScale: 1, track: 0.55, hyperArmor: [0.2, 1.25],
  },
  /** H2 + Heavy (hold to charge): the Crownbreaker — sword raised, then a kneeling plunge that sends a shockwave. */
  H3: {
    id: 'H3', clip: 'gs_plunge', kind: 'heavy', speed: 1.7, start: 0.3, twoHanded: true, charge: { at: 1.0, max: 1.2 },
    hits: [{ t0: 2.26, t1: 2.62, damage: 40, poise: 140, knock: 6.0, shape: 'radial', reach: 3.4, knockdown: true, guardBreak: true }],
    inputFrom: 3.0, cancelAt: 3.15, endAt: 3.3, recoveryCancel: 2.85, rootScale: 0, track: 0.9,
    hyperArmor: [0.3, 2.7], resonance: 8, pace: { windup: 1.1, strike: 1.3, follow: 0.8, recover: 1.35 },
  },
  /**
   * CROWNBREAKER (Floor 1 reward, "HOLD HEAVY"): the H3 plunge promoted to a neutral move. Holding heavy past
   * the tap threshold turns the opening heavy into this: the Great Sword is raised (hyper armour), the charge
   * builds for up to 1 s while held (released early = a weaker blow), then the kneeling plunge sends a
   * shockwave: everything within 3.6 m (+2.2 m at full charge) is struck, staggered and thrown down; damage
   * falls off toward the rim. Guard break. Presentation in Game (onCharge / onHitWindow).
   */
  CROWNBREAKER: {
    id: 'CROWNBREAKER', clip: 'gs_plunge', kind: 'finisher', speed: 1.8, start: 0.55, twoHanded: true, charge: { at: 1.0, max: 1.0 },
    hits: [{ t0: 2.26, t1: 2.62, damage: 46, poise: 170, knock: 7.0, shape: 'radial', reach: 3.6, knockdown: true, guardBreak: true }],
    shock: { reach: 2.2, falloff: 0.45 },
    inputFrom: 3.0, cancelAt: 3.15, endAt: 3.25, recoveryCancel: 2.8, rootScale: 0, track: 0.8,
    hyperArmor: [0.55, 2.7], resonance: 10, pace: { windup: 1.15, strike: 1.35, follow: 0.75, recover: 1.4 },
  },
  /**
   * WHIRLWIND (Floor 2 reward, "HOLD LIGHT"): a sustained 360° spin built from the real Great Sword spins, chained
   * one turn at a time while light is held (≤ 5 s; see Player.updateWhirl and combat/Abilities.ts): every
   * segment below is one full turn of the hips (measured: they all turn the same way and start/end within
   * ~10° of each other, so the chain reads as one continuous spin; the root yaw absorbs the residue).
   * WHIRL_IN continues L1's own clip (atk_whirlwind) into its spin, so a held light flows out of the first slash.
   */
  WHIRL_IN: {
    id: 'WHIRL_IN', clip: 'atk_whirlwind', kind: 'whirl', speed: 1.55, start: 0.86, whirl: true,
    hits: [
      { t0: 1.12, t1: 1.34, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.8 },
      { t0: 1.75, t1: 2.05, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.8 },
      { t0: 2.2, t1: 2.56, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.8 },
    ],
    inputFrom: 99, cancelAt: 2.6, endAt: 2.6, recoveryCancel: 0.86, rootScale: 0, track: 0, hyperArmor: [0.86, 2.6],
  },
  WHIRL_A: {
    id: 'WHIRL_A', clip: 'gs_spin_double', kind: 'whirl', speed: 1.5, start: 0.1, twoHanded: true, whirl: true,
    hits: [
      { t0: 0.45, t1: 0.72, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.9 },
      { t0: 0.76, t1: 1.0, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.9 },
    ],
    inputFrom: 99, cancelAt: 1.0, endAt: 1.0, recoveryCancel: 0.1, rootScale: 0, track: 0, hyperArmor: [0.1, 1.0],
  },
  WHIRL_C: {
    id: 'WHIRL_C', clip: 'gs_rampage', kind: 'whirl', speed: 1.6, start: 1.95, twoHanded: true, whirl: true,
    hits: [
      { t0: 2.05, t1: 2.36, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.9 },
      { t0: 2.42, t1: 2.8, damage: 10, poise: 18, knock: 2.0, shape: 'radial', reach: 3.0 },
    ],
    inputFrom: 99, cancelAt: 3.1, endAt: 3.1, recoveryCancel: 1.95, rootScale: 0, track: 0, hyperArmor: [1.95, 3.1],
  },
  WHIRL_W: {
    id: 'WHIRL_W', clip: 'atk_whirlwind', kind: 'whirl', speed: 1.55, start: 1.6, whirl: true,
    hits: [
      { t0: 1.75, t1: 2.05, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.8 },
      { t0: 2.2, t1: 2.56, damage: 9, poise: 16, knock: 1.7, shape: 'radial', reach: 2.8 },
    ],
    inputFrom: 99, cancelAt: 2.6, endAt: 2.6, recoveryCancel: 1.6, rootScale: 0, track: 0, hyperArmor: [1.6, 2.6],
  },
  /** the release: the spin's overshoot and an overhead finishing cut (gs_spin_double's own ending) */
  WHIRL_END: {
    id: 'WHIRL_END', clip: 'gs_spin_double', kind: 'finisher', speed: 1.35, start: 1.0, twoHanded: true,
    hits: [{ t0: 1.2, t1: 1.52, damage: 24, poise: 70, knock: 4.2, shape: 'radial', reach: 3.1, knockdown: true }],
    inputFrom: 1.6, cancelAt: 1.62, endAt: 1.75, recoveryCancel: 1.52, rootScale: 0, track: 0.2, resonance: 6,
    next: { light: 'L1', heavy: 'H1' },
  },
  /** Heavy beside a reeling enemy under 45 % HP: a two-handed plunge through it. */
  EXECUTE: {
    id: 'EXECUTE', clip: 'gs_plunge', kind: 'finisher', speed: 2.0, start: 1.25, twoHanded: true,
    hits: [{ t0: 2.2, t1: 2.62, damage: 95, poise: 200, knock: 3.0, shape: 'front', reach: 2.6, arc: 70, knockdown: true, guardBreak: true }],
    inputFrom: 3.0, cancelAt: 3.15, endAt: 3.25, recoveryCancel: 2.8, rootScale: 0, track: 1.2,
    hyperArmor: [1.25, 2.8], resonance: 10, pace: { windup: 1.0, strike: 1.3, follow: 0.7, recover: 1.4 },
  },
  /** Parry → Light: the riposte — a two-handed cleave into the opening. */
  RIPOSTE: {
    id: 'RIPOSTE', clip: 'gs_cleave', kind: 'finisher', speed: 1.55, start: 0.05, twoHanded: true,
    hits: [
      { t0: w('gs_cleave', 0)[0], t1: w('gs_cleave', 0)[1], damage: 24, poise: 60, knock: 2.0, shape: 'blade', reach: 2.6 },
      { t0: w('gs_cleave', 1)[0], t1: w('gs_cleave', 1)[1], damage: 40, poise: 120, knock: 4.0, shape: 'blade', reach: 2.8, knockdown: true },
    ],
    inputFrom: 0.62, cancelAt: 0.92, endAt: 1.1, recoveryCancel: 0.84, rootScale: 1, track: 0.5, lunge: 4,
    resonance: 8, next: { light: 'L2', heavy: 'F4' },
  },
  /** Crouch chain part 2: the two-handed crouched sweep. */
  CROUCH_L2: {
    id: 'CROUCH_L2', clip: 'gs_crouch_sweep', kind: 'crouch', speed: 1.45, start: 0.1, twoHanded: true,
    hits: [{ t0: w('gs_crouch_sweep', 0)[0], t1: w('gs_crouch_sweep', 0)[1], damage: 16, poise: 75, knock: 1.8, shape: 'radial', reach: 2.6, arc: 220, knockdown: true }],
    inputFrom: 0.75, cancelAt: 0.95, endAt: 1.25, recoveryCancel: 0.85, rootScale: 1, track: 0.3,
    next: { light: 'CROUCH_L' },
  },
  /** Kick → Kick: spinning back kick with the sword raised (bigger shove, breaks guards). */
  KICK2: {
    id: 'KICK2', clip: 'gs_spin_kick', kind: 'kick', speed: 1.45, start: 0.15, twoHanded: true,
    hits: [{ t0: footWindow('gs_spin_kick')[0], t1: footWindow('gs_spin_kick')[0] + 0.3, damage: 12, poise: 90, knock: 9, shape: 'front', reach: 2.1, arc: 110, guardBreak: true }],
    inputFrom: 0.9, cancelAt: 1.05, endAt: 1.3, recoveryCancel: 0.95, rootScale: 1, track: 0.3,
    next: { light: 'L3', heavy: 'H1' },
  },
};

export const PARRY_WINDOW = 0.2;      // seconds after pressing guard
export const BLOCK_DAMAGE_SCALE = 0.15;
export const BLOCK_ARC_DEG = 120;
export const DODGE = { duration: 0.36, distance: 3.6, iframes: [0.02, 0.3] as [number, number], cooldown: 0.18, chainMax: 2, chainCooldown: 0.55 };
export const PLAYER_HP = 240;
