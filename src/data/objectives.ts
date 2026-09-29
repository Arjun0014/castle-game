/**
 * Objectives per floor (session 7 onboarding). One line always answers "what am I trying to do right now?".
 *
 * Conditions (any one completes an objective):
 *   sigil:CP1        that Blood Sigil has been activated     started:E1 / cleared:E1   encounter state
 *   shifts:1         the hero has shifted at least n times    state:PAST                current memory
 *   zone:x0,x1,y0,y1,z0,z1   the hero stands in this box (BLUEPRINT / Blender coordinates, like the layouts)
 *   flag:FR1         a resonant fracture is broken            boss:gate_warden          that boss is dead
 *   exit             the floor exit was reached
 *
 * `at` (Blender x, y, z) = where the objective leads (off-screen guidance only once the player seems stuck),
 * `sigil` = the Blood Sigil it points at (its beacon brightens), `shiftAt` = a shift spot (a floor ring shows
 * it while the objective is active), `teach` = a persistent contextual tutorial, `hints` = stuck hints voiced
 * by the heroine (dialogue line ids) after `after` seconds without progress (never in combat).
 * Objectives are sequential; if the player is already past a later one (a skipped fight, a different order)
 * the chain jumps forward.
 */
export type TeachId = 'move' | 'combat' | 'sigil' | 'shift' | 'resonance' | 'shiftback' | 'crouch';

export interface ObjectiveDef {
  id: string;
  text: string;
  done: string[];
  at?: [number, number, number];
  sigil?: string;
  shiftAt?: [number, number, number];
  /** the shift ring shows only in this memory (default: either) */
  shiftFrom?: 'PAST' | 'PRESENT';
  teach?: TeachId;
  /** heroine line (dialogue id) when this objective begins */
  line?: string;
  hints?: { after: number; line: string }[];
}

export const OBJECTIVES: Record<number, ObjectiveDef[]> = {
  1: [
    { id: 'f1_in', text: 'Find a way into the keep', done: ['zone:4,16,-45,-32,-1,4', 'started:E1'], at: [4.5, -39, 0], teach: 'move', line: 'f1_arrive',
      hints: [{ after: 35, line: 'f1_gate_rusted' }] },
    { id: 'f1_e1', text: 'Destroy the Echoes', done: ['cleared:E1'], teach: 'combat' },
    { id: 'f1_cp1', text: 'Kneel at the Blood Sigil', done: ['sigil:CP1'], sigil: 'CP1', at: [12.5, -41.5, 0], teach: 'sigil' },
    { id: 'f1_shift', text: 'Return to the rusted gate — and make it remember', done: ['shifts:1'], at: [0, -38, 0], shiftAt: [0, -37.5, 0], teach: 'shift',
      hints: [{ after: 40, line: 'f1_shift_stuck' }] },
    { id: 'f1_ward', text: 'Fight through the gate into the inner ward', done: ['zone:-22,22,-28,7,-1,6'], at: [0, -30, 0] },
    { id: 'f1_bar', text: 'Find a way into the barracks', done: ['zone:24,38,-27,-1,-1,6'], at: [23, -13, 0], shiftAt: [15.5, -13, 0], shiftFrom: 'PAST', teach: 'shiftback',
      hints: [{ after: 50, line: 'hint_g2' }] },
    { id: 'f1_arm', text: 'Press on to the armory', done: ['zone:20,34,10.5,27,-1,2.5'], at: [30.5, 5, 0], teach: 'crouch' },
    { id: 'f1_stair', text: "Climb to the landing above the armory", done: ['zone:17,23,23.5,27.5,5,8', 'sigil:CP3'], at: [21.3, 18.3, 3], shiftAt: [21.3, 18.3, 3],
      hints: [{ after: 45, line: 'hint_g3' }] },
    { id: 'f1_gal', text: "Cross the Great Hall's galleries to the west", done: ['zone:-18,-13,9,30,5,9'], at: [15, 11, 6],
      hints: [{ after: 60, line: 'hint_g4' }] },
    { id: 'f1_loft', text: 'Find a way into the chapel', done: ['zone:-36,-22,9,16,5,9', 'sigil:CP4'], at: [-18, 11.5, 6],
      hints: [{ after: 45, line: 'hint_g5' }] },
    { id: 'f1_crypt', text: 'Descend beneath the chapel', done: ['zone:-36,-22,26,42,-7,-3', 'sigil:CP5'], at: [-29, 30, 0],
      hints: [{ after: 50, line: 'hint_g6' }] },
    { id: 'f1_pit', text: "Cross Aldren's excavation", done: ['zone:7,18,20,42,-7,-2', 'sigil:CP6'], at: [10, 24, -6] },
    { id: 'f1_hatch', text: 'Climb to the hatch into the Great Hall', done: ['started:E13', 'zone:-18,18,9,42,-0.5,3'], at: [15.7, 35, -3],
      hints: [{ after: 45, line: 'hint_g7' }] },
    { id: 'f1_warden', text: 'Defeat the Gate Warden', done: ['cleared:E13'] },
    { id: 'f1_door', text: 'Pass the sealed royal door to the stair', done: ['exit', 'zone:-3,3,44,58,1,12'], at: [0, 42.8, 1.2], shiftAt: [0, 42.8, 1.2],
      hints: [{ after: 40, line: 'hint_g8' }] },
    { id: 'f1_up', text: 'Climb the Royal Stair', done: ['exit'], at: [0, 57, 8] },
  ],
  2: [
    { id: 'f2_ant', text: "Cross the King's Antechamber to the Chancery", done: ['zone:14,34,60,80,7,10'], at: [12.5, 70, 8], line: 'f2_arrive',
      hints: [{ after: 50, line: 'hint_f2_g1' }] },
    { id: 'f2_chn', text: 'Find the way out of the Chancery', done: ['sigil:CP2', 'zone:35,42,44,64,7,11'], at: [32, 73, 12], shiftAt: [32, 73, 12],
      hints: [{ after: 55, line: 'hint_f2_g2' }] },
    { id: 'f2_range', text: "Cross the wardens' range to the tower", done: ['sigil:CP3', 'zone:14,22,8,16,9,12'], at: [28, 40, 12],
      hints: [{ after: 50, line: 'hint_f2_gate' }] },
    { id: 'f2_gal', text: 'Cross the Long Gallery above the hall', done: ['zone:-3,3,44,60,13,16'], at: [0, 18, 16], shiftAt: [0, 18, 16],
      hints: [{ after: 50, line: 'hint_f2_lg' }] },
    { id: 'f2_loft', text: 'Enter the Crown Loft above the antechamber', done: ['zone:-12,12,62,78,13.5,17', 'flag:FR1'], at: [0, 58, 14], shiftAt: [0, 58, 14] },
    { id: 'f2_crown', text: 'Bring down the Crown Chandelier', done: ['flag:FR1'], at: [-10.8, 70, 15],
      hints: [{ after: 45, line: 'hint_f2_crown' }] },
    { id: 'f2_door', text: "Reach the King's door across the antechamber", done: ['zone:-12,12,79.5,95,7,11'], at: [0, 72, 8.3],
      hints: [{ after: 50, line: 'hint_f2_bridge' }] },
    { id: 'f2_captain', text: 'Defeat the Kingsguard Captain', done: ['cleared:E10'] },
    { id: 'f2_conduit', text: 'Climb the conduit stair', done: ['zone:18,30,90.67,100,23.5,27', 'exit'], at: [16, 85, 8], shiftAt: [16, 85, 8],
      hints: [{ after: 45, line: 'hint_f2_conduit' }] },
    // session 9: the way on is the King's lift down the conduit shaft (levels/Lift.ts)
    { id: 'f2_lift', text: "Take the King's lift down to the Crownheart", done: ['exit'], at: [24.5, 92.3, 24] },
  ],
  // session 9: Floor 3 rebuilt as the descent beneath the castle (docs/LEVEL_03_BLUEPRINT.md v3.0)
  3: [
    { id: 'f3_hall', text: 'Walk the Hall of Roots toward the heart', done: ['zone:-9,9,40,60,-1,4', 'started:E2'], at: [0, 27, 0], shiftAt: [0, 27.5, 0], line: 'f3_arrive',
      hints: [{ after: 40, line: 'hint_f3_gap' }] },
    { id: 'f3_grille', text: 'Pass the Royal Grille', done: ['zone:-9,9,51.6,60,-1,4', 'zone:-24,24,62,98,-1,4'], at: [0, 49, 0], shiftAt: [0, 48.5, 0],
      hints: [{ after: 45, line: 'hint_f3_gate' }] },
    { id: 'f3_oss', text: 'Cross the ossuary bridges', done: ['sigil:CP2', 'zone:5.8,14.2,81.8,98,-1,4'], at: [-2.2, 76.8, 0], shiftAt: [-2.2, 76.8, 0] },
    { id: 'f3_maw', text: 'Enter the cistern of the blood font', done: ['started:E5', 'zone:-2,22,101,125,-1,4'], at: [10, 100.5, 0] },
    { id: 'f3_maw2', text: 'Defeat the Maw of the Crownheart', done: ['cleared:E5'] },
    { id: 'f3_font', text: 'Leave the cistern by the far door', done: ['zone:7,13,126,134,-1,4'], at: [10, 123.5, 0], shiftAt: [10, 121.5, 0],
      hints: [{ after: 40, line: 'hint_f3_doors' }] },
    { id: 'f3_desc', text: "Descend the Great Descent round the heart's shaft", done: ['sigil:CP3', 'zone:22,28,144,152,-17,-12'], at: [19.8, 146, -16], shiftAt: [18.4, 150.9, -4.3] },
    { id: 'f3_heart', text: 'Enter the heart of Caer Veyr', done: ['started:BOSS'], at: [36, 148, -16], shiftAt: [25.6, 148, -16] },
    { id: 'f3_boss', text: 'Defeat the Last Crown', done: ['boss:last_crown'] },
  ],
};
