/**
 * Floor registry. Each floor is its own pair of GLBs built by tools/blender/build_floorNN.py; its runtime
 * dependencies (textures, enemy rigs, vegetation) come from src/data/floorManifests.json (generated from the
 * GLBs). Floors load one at a time behind the loading screen (Game.transitionTo); HP and resonance carry over.
 * `?floor=N` starts directly on floor N.
 */
export interface FloorDef {
  id: number;
  title: string;
  subtitle: string;
  /** loading-screen line while this floor loads */
  loadingText: string;
  /** loading-screen line once it is ready */
  readyText: string;
  next: number | null;
  /** Present roof openings for moon shafts (Blender x0, x1, y0, y1, roof z) — mirrors the layout script. */
  moonHoles: [number, number, number, number, number][];
  /** the scripted autopilot route exists for this floor */
  autopilot: boolean;
}

export const FLOORS: Record<number, FloorDef> = {
  1: {
    id: 1, title: 'CAER VEYR', subtitle: 'Floor I — Inheritance',
    loadingText: 'Preparing the Lower Keep', readyText: 'The gate of Caer Veyr stands before you.', next: 2, autopilot: true,
    moonHoles: [
      [-3, 3, -38, -35.5, 8.4],     // gate passage vault hole
      [11, 15, -37, -33, 6.0],      // east guardroom ceiling (NE corner)
      [27, 35, -18, -10, 8.0],      // barracks middle bay
      [26, 32, 14, 22, 9.0],        // armory roof
      [2, 16, 9, 13, 15.0],         // hall south roof (fallen onto the minstrels' gallery)
      [-5, 5, 30, 38, 15.0],        // hall roof over the great collapse (falls into the excavation)
      [-1.5, 1.5, 50, 53, 13.2],    // royal stair window
      [-33, -27, 18, 24, 13.0],     // chapel nave
      [-31, -27, 38, 42, 13.0],     // chapel altar
    ],
  },
  2: {
    id: 2, title: 'THE ROYAL FLOOR', subtitle: 'Floor II — Complicity',
    loadingText: 'Preparing the Royal Floor', readyText: "The Royal Stair ends at the court's own rooms.", next: null, autopilot: true,
    // the Present royal floor is mostly roofless: open sky instead of shafts, except the chancery's roof hole
    moonHoles: [],
  },
};

export interface FloorCarry { hp: number; charge: number; unlocked: boolean }
const KEY = 'caer-veyr-carry';

export function saveCarry(c: FloorCarry) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage unavailable */ }
}
export function takeCarry(): FloorCarry | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? JSON.parse(raw) as FloorCarry : null;
  } catch { return null; }
}
