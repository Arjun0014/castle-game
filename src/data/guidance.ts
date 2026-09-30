/**
 * Route guidance (session 14, game/RouteGuide.ts): where the way on is, drawn in the world — flowing gold chevrons on the
 * floor, a House Vaelor glyph with a column of light where a way begins, warm light spilling out of a low gap. Blueprint
 * (Blender) coordinates, feet height. A leg shows while its objective is current, its conditions hold and she is in its
 * memory; `announce` is said once, when the leg first opens ("the route is open now").
 *
 * Guided: every leg, full strength, from the moment it opens. Minimal: `essential` legs only (the ways a new player
 * cannot read from the stone alone — the first crawl, the rooftop ways on Floor 2), dimmer; any other leg only once
 * she seems lost (its objective has run `stuckAfter` s without a fight).
 */
export type P3 = [number, number, number];
export interface GuideLeg {
  id: string;
  /** the objective (data/objectives.ts) this leg belongs to */
  objective: string;
  /** Objectives conditions that must ALL hold ('cleared:E5', 'flag:FR1', 'state:PAST', 'zone:…') */
  when?: string[];
  state: 'PAST' | 'PRESENT';
  path: P3[];
  /** a Vaelor glyph + a column of light (where the way begins, or the one place to go) */
  beacon?: P3;
  /** light spilling out of a low opening (the crawl): centre of the opening, facing yaw (deg, Blender: 0 = +Y), size */
  gap?: { at: P3; yaw: number; w: number; h: number };
  /** the last chevrons point DOWN (a drop to take) */
  dropAt?: number;
  /** said once when the leg first opens (after `delay` s: another card may be speaking) */
  announce?: { title: string; sub: string; delay?: number };
  essential?: boolean;
}

export const GUIDANCE: Record<number, GuideLeg[]> = {
  1: [
    // the way in: through the passage, then the breach into the east ward (the rusted gate is shut in this memory)
    { id: 'f1_in', objective: 'f1_in', state: 'PRESENT', path: [[0, -53, 0], [0, -48, 0], [0, -43, 0], [0.6, -40.2, 0], [3.4, -39.3, 0], [6.5, -39.2, 0], [9.2, -39.8, 0]],
      beacon: [6.5, -39.2, 0] },
    { id: 'f1_cp1', objective: 'f1_cp1', state: 'PRESENT', path: [[7, -39.3, 0], [9.5, -40.1, 0], [11.9, -40.9, 0]] },
    { id: 'f1_gate', objective: 'f1_shift', state: 'PRESENT', path: [[11, -40.6, 0], [8.5, -39.6, 0], [6.5, -39.2, 0], [3.5, -39.0, 0], [1.2, -38.4, 0]] },
    { id: 'f1_ward', objective: 'f1_ward', state: 'PAST', path: [[0, -37, 0], [0, -34, 0], [0, -31, 0], [0.8, -28, 0], [2, -25, 0]] },
    // G2: the barricaded barracks door — back to the whole ground by the east wall, where the ring waits
    { id: 'f1_bar_past', objective: 'f1_bar', when: ['cleared:E3'], state: 'PAST', path: [[2, -23, 0], [6, -20.5, 0], [10, -17.5, 0], [13.2, -15, 0], [15, -13.4, 0]] },
    { id: 'f1_bar', objective: 'f1_bar', state: 'PRESENT', path: [[15.5, -13.5, 0], [16.6, -16, 0], [18.8, -14.6, 0], [21, -13, 0], [24, -13, 0], [26.5, -13, 0], [29, -12.4, 0]],
      beacon: [24.2, -13, 0] },
    // the first crawl: the fallen vault north of the barracks — the gap glows, the chevrons run into it
    { id: 'f1_crawl', objective: 'f1_arm', when: ['cleared:E5'], state: 'PRESENT', essential: true,
      path: [[29.6, -11.5, 0], [30.6, -8, 0], [30.8, -4.5, 0], [31.1, -1.2, 0], [31.2, 1.4, 0], [31.2, 3.6, 0], [31.2, 6, 0], [31.2, 8.4, 0], [30.7, 11, 0]],
      beacon: [31.2, -0.4, 0], gap: { at: [31.2, 2.2, 0.55], yaw: 180, w: 2.0, h: 1.05 },
      announce: { title: 'THE WAY ON', sub: 'The vault has fallen — crawl through the low gap to the north' } },
    // G3: up the rubble to where the stair's landing stood (the ring there teaches the shift)
    { id: 'f1_stair', objective: 'f1_stair', when: ['cleared:E6'], state: 'PRESENT', essential: true,
      path: [[29.5, 11.8, 0], [26, 11.3, 0], [22.5, 11, 0], [21.3, 12.6, 0.2], [21.3, 14.6, 1.6], [21.3, 16.4, 2.6], [21.3, 17.8, 3.0]],
      beacon: [21.3, 13, 0.3],
      announce: { title: 'A HALF STAIR', sub: 'Climb the rubble to where its landing stood' } },
  ],
  2: [
    // A — the Gutter King has fallen: round the fallen trusses and up the truss ramp to the ridge
    { id: 'f2_ridge', objective: 'f2_range', when: ['cleared:E4'], state: 'PRESENT', essential: true,
      path: [[31.5, 40.5, 10], [33.1, 42.2, 10], [31, 43.8, 10], [28.2, 43.8, 10], [28, 41.4, 11.2], [28, 39.4, 12.6], [28, 37.4, 13.8], [28, 35, 14], [28, 32.6, 14]],
      beacon: [28.4, 43.8, 10],
      announce: { title: 'THE WAY IS OPEN', sub: 'The fallen roof climbs to the ridge — up the timber ramp' } },
    // B — along the ridge and DOWN past the rusted gate to the minstrels' tower
    { id: 'f2_down', objective: 'f2_range', when: ['cleared:E6'], state: 'PRESENT', essential: true,
      path: [[28, 31, 14], [28, 27, 14], [28, 23.4, 14], [28, 21, 12.6], [28, 18.6, 11.2], [28, 16.2, 10], [26.4, 14, 10], [23.5, 13.4, 10], [21, 13.4, 10], [19.8, 10.4, 10]],
      beacon: [28, 23.4, 14], dropAt: 3,
      announce: { title: 'DOWN FROM THE RIDGE', sub: "The ridge runs down past the gate — to the minstrels' tower" } },
    // C — the Crown has fallen: it bridges the antechamber in the ruin. Shift at the loft's edge, drop onto it
    { id: 'f2_crown_past', objective: 'f2_door', when: ['flag:FR1'], state: 'PAST', essential: true,
      path: [[-10.7, 66.5, 14], [-10.7, 69.5, 14], [-10.7, 72, 14], [-10.7, 73.9, 14]],
      announce: { title: 'THE WAY IS OPEN', sub: 'In the ruin the Crown\'s wreck bridges the hall — shift at the loft edge and drop down to it', delay: 3.9 } },
    { id: 'f2_crown_drop', objective: 'f2_door', when: ['flag:FR1'], state: 'PRESENT', essential: true,
      path: [[-10.7, 73, 14], [-10.2, 74.2, 14], [-9.1, 74.2, 13.9], [-7.8, 74.2, 9.6], [-8.6, 73, 8.4], [-10.3, 72.4, 8], [-9.2, 66.5, 8], [-6, 64.4, 8], [-2, 64.4, 8], [0, 67.2, 8], [0, 72, 8.3], [0, 77.4, 8], [0, 80.4, 8]],
      beacon: [-9.4, 74.2, 14], dropAt: 3 },
  ],
};

/** how long an objective runs (no fight) before Minimal shows a non-essential leg */
export const GUIDE_STUCK_AFTER = 28;
