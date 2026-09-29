/**
 * Floor-clearing rewards (session 8). Clearing a floor permanently strengthens the heroine:
 *
 *   Floor 1 start  — neither
 *   Floor 2        — CROWNBREAKER  (HOLD HEAVY: raised sword, charged ground plunge + shockwave)
 *   Floor 3        — + WHIRLWIND   (HOLD LIGHT: sustained 360° spin, up to 5 s)
 *
 * The set is a function of the floor reached (Game.abilities is rebuilt from it on every floor load and kept on the
 * in-place transition carry), so dev shortcuts (?floor=N) and floor transitions always agree. Whether the player
 * has performed each move yet is in Game.learned (the unlock card stays until she has).
 */
export type AbilityId = 'crownbreaker' | 'whirlwind';

/** the floor on which each ability is first available (= after clearing the floor before it) */
export const ABILITY_FLOOR: Record<AbilityId, number> = { crownbreaker: 2, whirlwind: 3 };

export function abilitiesForFloor(floor: number): Set<AbilityId> {
  return new Set((Object.keys(ABILITY_FLOOR) as AbilityId[]).filter((a) => floor >= ABILITY_FLOOR[a]));
}

export const ABILITY_INFO: Record<AbilityId, { name: string; input: string; kbm: string; touch: string; line: string }> = {
  crownbreaker: {
    name: 'CROWNBREAKER', input: 'HOLD HEAVY',
    kbm: 'Hold right-click to raise the blade — release to break the ground around you.',
    touch: 'Hold HEAVY to raise the blade — let go to break the ground around you.',
    line: 'ab_crownbreaker',
  },
  whirlwind: {
    name: 'WHIRLWIND', input: 'HOLD LIGHT',
    kbm: 'Hold left-click to spin through everything around you — up to five seconds.',
    touch: 'Hold ATTACK to spin through everything around you — up to five seconds.',
    line: 'ab_whirlwind',
  },
};

/** a press held at least this long (real s) is a HOLD; released sooner it was a tap (the normal attack) */
export const HOLD_THRESHOLD = 0.28;
/** the Whirlwind: longest spin, and the rest before it can be started again */
export const WHIRL_MAX = 5;
export const WHIRL_COOLDOWN = 2.5;
/** stick-steered drift while spinning (m/s) */
export const WHIRL_MOVE = 2.4;

/** the spin segments in the order they chain (after WHIRL_IN / WHIRL_A as the entry) */
export const WHIRL_CYCLE = ['WHIRL_A', 'WHIRL_C', 'WHIRL_W'];

/**
 * Hips yaw (degrees, relative to the root) every 0.05 s of the spin clips, measured from hero.glb in the running
 * game (session 8). A switch between two clip times keeps the body's world facing continuous by adding
 * yawAt(from) - yawAt(to) to the root yaw.
 */
const YAW: Record<string, number[]> = {
  gs_spin_double: [0, -2, -10, -24, -40, -53, -71, -101, -135, -168, -196, -213, -230, -251, -272, -285, -298, -314, -331, -347, -362, -374, -382, -385, -386, -385, -383, -380, -377, -374, -372, -370, -368, -366, -365, -363, -361],
  gs_rampage: [0, 0, -1, -4, -7, -12, -17, -23, -29, -35, -41, -43, -41, -37, -27, -13, 0, 14, 25, 38, 52, 70, 88, 104, 118, 128, 135, 137, 137, 136, 135, 132, 122, 104, 81, 59, 42, 34, 27, 13, -9, -32, -57, -81, -104, -122, -138, -152, -167, -185, -204, -222, -239, -255, -272, -290, -309, -327, -341, -350, -356, -358, -360, -361, -361, -362, -363, -363, -363, -362, -361, -360],
  atk_whirlwind: [0, -2, -6, -11, -16, -19, -20, -14, -3, 10, 24, 40, 55, 65, 73, 81, 89, 98, 111, 121, 125, 123, 118, 112, 106, 98, 90, 81, 72, 60, 46, 28, 8, -14, -39, -67, -97, -126, -147, -165, -181, -197, -212, -225, -243, -260, -277, -293, -309, -327, -345, -357, -366, -373, -375, -375, -375, -375, -377, -379, -381, -383, -385, -386, -384, -376, -369, -369, -370, -368, -365, -361],
};

/** hips yaw of `clip` at time t (degrees), or null when the clip was not measured */
export function yawAt(clip: string, t: number): number | null {
  const tab = YAW[clip];
  if (!tab) return null;
  const f = Math.max(0, Math.min(tab.length - 1.001, t / 0.05));
  const i = Math.floor(f), k = f - i;
  return tab[i] + (tab[i + 1] - tab[i]) * k;
}

/** root-yaw correction (radians) that keeps the hips' world facing continuous across a clip switch */
export function yawBridge(fromClip: string, fromT: number, toClip: string, toT: number): number {
  const a = yawAt(fromClip, fromT), b = yawAt(toClip, toT);
  if (a === null || b === null) return 0;
  let d = a - b;
  d = ((d % 360) + 540) % 360 - 180;
  return (d * Math.PI) / 180;
}
