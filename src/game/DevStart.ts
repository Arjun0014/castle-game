import * as THREE from 'three';
import type { Game } from './Game';
import type { TimeState } from '../levels/Materials';
import { b2t } from '../levels/Level';
import { abilitiesForFloor } from '../combat/Abilities';

/**
 * Local development shortcuts (session 8). They exist only in the Vite dev server (`import.meta.env.DEV`):
 * production builds (itch, preview) ignore these parameters and always start at Floor 1.
 *
 *   ?floor=1|2|3   start of that floor with the progression a player has there: shifting unlocked, ≥ 100
 *                  Resonance (Floors 2–3), the floor rewards (Floor 2: Crownbreaker, Floor 3: + Whirlwind),
 *                  the Floor 1 basics counted as learned (their tutorials do not nag on later floors)
 *   ?at=<warp>     straight to an important fight (implies its floor): the encounters before it cleared, the
 *                  fracture flags the route needs, its checkpoint anchored (a death respawns there), the right
 *                  memory, 200 Resonance. Warps are listed in WARPS below (and in docs/CONTEXT.md).
 *
 * Combine with the usual test flags: `&autostart` skips the title card, `&mute`, `&input=touch`, `&view=wide`.
 */
interface Warp {
  floor: number;
  /** blueprint (Blender) coordinates + yaw in degrees (0 = north) */
  at: [number, number, number]; yaw: number;
  state: TimeState;
  sigil?: string;
  /** encounters cleared before this point (every other encounter of the floor stays as built) */
  before: string[];
  flags?: string[];
  note: string;
}

export const WARPS: Record<string, Warp> = {
  // ---- Floor 1
  ward: { floor: 1, at: [1.5, -27.5, 0], yaw: 0, state: 'PAST', sigil: 'CP1', before: ['E1', 'E2'], note: 'Inner Ward, Past — E3 muster yard (guards, balcony archers, tent reinforcements)' },
  barracks: { floor: 1, at: [26.5, -13, 0], yaw: 90, state: 'PRESENT', sigil: 'CP2', before: ['E1', 'E2', 'E3', 'E4'], note: 'Barracks, Present — E5 Hollows + the Hollow Warden (first heavy)' },
  elites: { floor: 1, at: [-15, 12, 6], yaw: 0, state: 'PAST', sigil: 'CP3', before: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'], note: 'West gallery, Past — E9 two Royal Wardens' },
  chapel: { floor: 1, at: [-31, 25, 0], yaw: 0, state: 'PAST', sigil: 'CP4', before: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'], note: 'Chapel nave, Past — E10 guards + a Royal Warden on the altar dais' },
  warden: { floor: 1, at: [9, 30, 0], yaw: -60, state: 'PAST', sigil: 'CP6', before: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E12c'], note: 'Great Hall — E13 the Gate Warden (Last Muster)' },
  // ---- Floor 2
  range: { floor: 2, at: [35, 42, 10], yaw: -90, state: 'PRESENT', sigil: 'CP2', before: ['E1', 'E1b', 'E3', 'E3p'], note: "Wardens' range, Present — E4 Hollow Wardens + Remnants" },
  kingsguard: { floor: 2, at: [0, 76.5, 8], yaw: 0, state: 'PRESENT', sigil: 'CP1', flags: ['FR1'], before: ['E1', 'E1b', 'E3', 'E3p', 'E4', 'E6', 'E7', 'E8', 'E9'], note: "King's apartments — E10 the Kingsguard Captain" },
  // ---- Floor 3
  lastcrown: { floor: 3, at: [0, 123.5, 30], yaw: 0, state: 'PAST', sigil: 'CP2', before: ['E0', 'E1', 'E2'], note: 'The doors of the Crown — the Last Crown' },
};

/** The floor a dev URL asks for (null = none / production). */
export function devFloor(params: URLSearchParams): number | null {
  if (!import.meta.env.DEV) return null;
  const warp = WARPS[params.get('at') ?? ''];
  if (warp) return warp.floor;
  const f = Number(params.get('floor'));
  return f >= 1 && f <= 3 ? f : null;
}

/** After the floor is built (before play starts): give the progression state of a real player at that point. */
export function applyDevStart(g: Game, params: URLSearchParams) {
  if (!import.meta.env.DEV) return;
  const warp = WARPS[params.get('at') ?? ''];
  const floor = g.floorId;
  g.player.abilities = abilitiesForFloor(floor);
  if (floor > 1) {
    g.time.unlocked = true;
    g.time.charge = Math.max(100, g.time.charge);
    Object.assign(g.learned, { moved: 99, looked: 99, hits: 99, guarded: true, dodged: true, shifted: true, sigil: true, resonance: true, heavy: true });
  }
  if (!warp || warp.floor !== floor) return;
  g.time.unlocked = true;
  g.time.charge = 200;
  Object.assign(g.learned, { moved: 99, looked: 99, hits: 99, guarded: true, dodged: true, shifted: true, sigil: true, resonance: true, heavy: true });
  for (const f of warp.flags ?? []) g.level.setFlag(f);
  const em = g.enemies;
  for (const id of warp.before) {
    const enc = em.encounters.get(id);
    if (!enc) { console.warn('[dev] no encounter', id); continue; }
    enc.triggered = true;
    enc.cleared = true;
    for (const e of enc.enemies) e.vanish();
  }
  if (warp.state !== g.time.state) g.forceState(warp.state);
  const pos = b2t(warp.at[0], warp.at[1], warp.at[2]);
  g.tp(warp.at[0], warp.at[1], warp.at[2], warp.yaw);
  if (warp.sigil) {
    const m = g.level.markersOf('sigil').find((s) => s.name === warp.sigil);
    if (m) {
      g.checkpoints.activated.add(m.name);
      g.checkpoints.save = { cid: m.name, pos: m.pos.clone().add(new THREE.Vector3(0, 0.05, 0)), yaw: g.player.yaw, state: warp.state, charge: 200 };
    }
  }
  g.player.lastSafe.copy(pos);
  em.onStateChange(g.time.state);
  console.info(`[dev] warp "${params.get('at')}" → floor ${floor}: ${warp.note}`);
}
