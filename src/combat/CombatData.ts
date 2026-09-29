/**
 * Player attack definitions. Clip timings come from the measured peaks in heroAnimations.json
 * (via animationManifest.ts); gameplay tuning (speed, damage, poise, windows) lives here.
 * All times are CLIP seconds (before playback speed is applied).
 */
import { clip } from '../data/animationManifest';

export type AttackKind = 'light' | 'heavy' | 'finisher' | 'kick' | 'bash' | 'air' | 'crouch' | 'sprint';

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
  next?: { light?: string; heavy?: string };
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
    next: { light: 'L2', heavy: 'F1c' },
  },
  L2: {
    id: 'L2', clip: 'atk_rising_cut', kind: 'light', speed: 1.55, start: 0.46,
    hits: [{ t0: w('atk_rising_cut', 0)[0], t1: w('atk_rising_cut', 0)[1], damage: 16, poise: 25, knock: 1.5, shape: 'blade', reach: 2.1 }],
    inputFrom: 0.5, cancelAt: 0.96, endAt: 1.26, recoveryCancel: 0.9, rootScale: 1, track: 0.4, lunge: 3,
    next: { light: 'L3', heavy: 'F1' },
  },
  L3: {
    id: 'L3', clip: 'atk_lunge_cut', kind: 'light', speed: 1.5, start: 0.36,
    hits: [{ t0: w('atk_lunge_cut', 0)[0], t1: w('atk_lunge_cut', 0)[1], damage: 20, poise: 38, knock: 2.4, shape: 'blade', reach: 2.4 }],
    inputFrom: 0.5, cancelAt: 1.0, endAt: 1.4, recoveryCancel: 0.9, rootScale: 0.75, track: 0.45, lunge: 3,
    next: { light: 'L4', heavy: 'F2' },
  },
  L4: {
    id: 'L4', clip: 'atk_advancing_sweep', kind: 'light', speed: 1.35, start: 0.08,
    hits: [{ t0: w('atk_advancing_sweep', 0)[0] - 0.12, t1: w('atk_advancing_sweep', 0)[1], damage: 24, poise: 45, knock: 3.0, shape: 'blade', reach: 2.6 }],
    inputFrom: 0.5, cancelAt: 0.95, endAt: 1.2, recoveryCancel: 0.8, rootScale: 0.65, track: 0.4, lunge: 3,
    next: { light: 'L1', heavy: 'F2' },
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
    hyperArmor: [0.6, 1.45], resonance: 6, next: { light: 'L1' },
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
  SPRINT_H: {
    id: 'SPRINT_H', clip: 'atk_leap_slam', kind: 'sprint', speed: 1.45, start: 0.2,
    hits: [{ t0: w('atk_leap_slam', 0)[0], t1: w('atk_leap_slam', 0)[1] + 0.05, damage: 40, poise: 110, knock: 5.0, shape: 'radial', reach: 3.2, knockdown: true }],
    inputFrom: 1.8, cancelAt: 2.0, endAt: 2.2, recoveryCancel: 1.6, rootScale: 1.0, track: 0.75,
    hyperArmor: [0.3, 1.3],
  },
  SPRINT_L: {
    id: 'SPRINT_L', clip: 'atk_lunge_cut', kind: 'sprint', speed: 1.6, start: 0.1,
    hits: [{ t0: w('atk_lunge_cut', 0)[0], t1: w('atk_lunge_cut', 0)[1], damage: 22, poise: 45, knock: 2.6, shape: 'blade', reach: 2.4 }],
    inputFrom: 0.5, cancelAt: 1.0, endAt: 1.4, recoveryCancel: 0.9, rootScale: 1.0, track: 0.5,
    next: { light: 'L4', heavy: 'F2' },
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
  },
  KICK: {
    id: 'KICK', clip: 'kick_front', kind: 'kick', speed: 1.4, start: 0.05,
    hits: [{ t0: footWindow('kick_front')[0], t1: footWindow('kick_front')[1], damage: 8, poise: 70, knock: 7.5, shape: 'front', reach: 1.9, arc: 80, guardBreak: true }],
    inputFrom: 0.6, cancelAt: 0.75, endAt: 0.95, recoveryCancel: 0.6, rootScale: 1, track: 0.2,
    next: { light: 'L3', heavy: 'H1' },
  },
  BASH: {
    id: 'BASH', clip: 'shield_bash', kind: 'bash', speed: 1.25, start: 0.0,
    hits: [{ t0: shieldWindow('shield_bash')[0], t1: shieldWindow('shield_bash')[1], damage: 6, poise: 90, knock: 4.0, shape: 'front', reach: 1.7, arc: 100, guardBreak: true }],
    inputFrom: 0.35, cancelAt: 0.5, endAt: 0.8, recoveryCancel: 0.4, rootScale: 1, track: 0.15,
    next: { light: 'L2', heavy: 'H1' },
  },
};

export const PARRY_WINDOW = 0.2;      // seconds after pressing guard
export const BLOCK_DAMAGE_SCALE = 0.15;
export const BLOCK_ARC_DEG = 120;
export const DODGE = { duration: 0.36, distance: 3.6, iframes: [0.02, 0.3] as [number, number], cooldown: 0.18, chainMax: 2, chainCooldown: 0.55 };
export const PLAYER_HP = 240;
