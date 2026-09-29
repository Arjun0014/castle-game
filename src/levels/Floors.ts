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
  /** per-memory lighting overrides of Game's ENV presets (Floor 3: the deep, red-black Crownheart) */
  env?: Partial<Record<'PAST' | 'PRESENT', Record<string, number | number[]>>>;
  /** loading-screen line under the floor's name while it loads (the chapter's epigraph) */
  epigraph?: string;
  /** underground: no sky dome (the fog colour is the dark beyond the walls) */
  noSky?: boolean;
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
    loadingText: 'Preparing the Royal Floor', readyText: "The Royal Stair ends at the court's own rooms.", next: 3, autopilot: true,
    // the Present royal floor is mostly roofless: open sky instead of shafts, except the chancery's roof hole
    moonHoles: [],
  },
  3: {
    id: 3, title: 'THE CROWNHEART', subtitle: 'Floor III — The Crownheart',
    loadingText: 'Descending beneath Caer Veyr', readyText: 'The lift has reached the bottom of the shaft.', next: null, autopilot: false,
    // session 9: the deep beneath the castle — no sky; the heart's red light, darker than the floors above
    moonHoles: [],
    env: {
      PRESENT: { bg: 0x0a0406, fog: 0x1c080a, near: 6, far: 62, hemiSky: 0x7a3848, hemiGround: 0x120408, hemi: 0.66, sun: 0xc06050, sunI: 1.3, fill: 0x9a4a5a, fillI: 0.62, exposure: 1.3, heroLight: 7.5 },
      PAST: { bg: 0x120806, fog: 0x1a0c08, near: 10, far: 66, hemiSky: 0xffc890, hemiGround: 0x2a160c, hemi: 0.8, sun: 0xff9a5a, sunI: 1.4, fill: 0xff9050, fillI: 0.3, exposure: 1.18, heroLight: 1.5 },
    },
    epigraph: 'Beneath the keep the royal line kept its heart. It is still beating.',
    noSky: true,
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
