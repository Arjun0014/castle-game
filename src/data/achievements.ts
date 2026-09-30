/**
 * Achievements (session 15): what a player of Echoes of Caer Veyr can be proud of — the way through the castle, its
 * crowned and monstrous guardians, the sword's harder arts, the two memories, and what the castle kept. Few counters,
 * no grind: the cumulative ones (Echoes released, finishers, parries, shifts, memories) fill in ordinary play.
 * Triggers live in game/Achievements.ts (gameplay signals); icons in ui/AchievementToast.ts (ICONS).
 */
export type AchIcon = 'gate' | 'crown' | 'heart' | 'mask' | 'fang' | 'shield' | 'sword' | 'blades' | 'plunge' | 'spiral'
  | 'ember' | 'moons' | 'hourglass' | 'scroll' | 'letter' | 'book' | 'eye' | 'skull';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  group: 'way' | 'crowns' | 'sword' | 'memories' | 'kept' | 'secret';
  icon: AchIcon;
  /** cumulative: the counter it reads and the goal */
  goal?: number;
  counter?: 'kills' | 'finishers' | 'parries' | 'shifts' | 'traces' | 'lore';
  /** description withheld until unlocked (a truth of the story, or a secret) */
  hidden?: boolean;
  /** shown while hidden and locked */
  hint?: string;
}

export const ACH_GROUPS: { id: AchievementDef['group']; title: string }[] = [
  { id: 'way', title: 'The Way Through' },
  { id: 'crowns', title: 'Crowns and Monsters' },
  { id: 'sword', title: 'The Sword' },
  { id: 'memories', title: 'Two Memories' },
  { id: 'kept', title: 'What the Castle Kept' },
  { id: 'secret', title: 'Secrets' },
];

/** every memory trace in the castle, by floor (floor0N_layout.py `trace(...)`; Achievements checks the loaded floor) */
export const TRACE_TOTAL: Record<number, number> = { 1: 12, 2: 5, 3: 3 };
export const TRACES_ALL = Object.values(TRACE_TOTAL).reduce((a, b) => a + b, 0);
export const LORE_PAGES = 12;

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- the way through
  { id: 'floor1', name: 'Inheritance', desc: 'Climb out of the lower keep to the Royal Floor.', group: 'way', icon: 'gate' },
  { id: 'floor2', name: 'Complicity', desc: "Ride the King's lift down beneath the castle.", group: 'way', icon: 'gate' },
  { id: 'ending', name: 'The Crownheart Is Silent', desc: 'Break the Last Crown and end the Sundering.', group: 'way', icon: 'heart', hidden: true, hint: 'Reach the heart of Caer Veyr — and end what was begun there.' },
  // ---- crowns and monsters
  { id: 'gate_warden', name: 'The Warden Falls', desc: 'Defeat the Gate Warden in the Great Hall.', group: 'crowns', icon: 'crown' },
  { id: 'untouched', name: 'Untouched', desc: 'Defeat the Gate Warden without losing a drop of blood.', group: 'crowns', icon: 'shield' },
  { id: 'goblin_king', name: 'Gutter Crown', desc: 'Bring down the Gutter King on the armory roof.', group: 'crowns', icon: 'fang' },
  { id: 'widow_mother', name: 'The Weeping Mother', desc: 'Find the Weeping Mother in her hidden lair — and end her grief.', group: 'crowns', icon: 'mask', hidden: true, hint: 'Something weeps behind the walls of the Royal Floor.' },
  { id: 'kingsguard', name: 'Oath Unsworn', desc: "Defeat the Kingsguard Captain at the King's door.", group: 'crowns', icon: 'crown' },
  { id: 'maw', name: 'The Mouth Beneath', desc: 'Destroy the Maw of the Crownheart in the flooded cistern.', group: 'crowns', icon: 'skull' },
  // ---- the sword
  { id: 'parry', name: 'Turned Aside', desc: 'Parry a blow the moment it lands.', group: 'sword', icon: 'shield' },
  { id: 'parries', name: 'The Unbroken Guard', desc: 'Parry thirty blows.', group: 'sword', icon: 'shield', goal: 30, counter: 'parries' },
  { id: 'five_cuts', name: 'Five Cuts', desc: 'Land every strike of the five-cut chain, to its two-handed cleave.', group: 'sword', icon: 'blades' },
  { id: 'finisher', name: 'The Last Blow', desc: 'End an Echo with a cinematic finisher.', group: 'sword', icon: 'sword' },
  { id: 'finishers', name: 'Headsman of Veyr', desc: 'Perform twenty-five finishers.', group: 'sword', icon: 'sword', goal: 25, counter: 'finishers' },
  { id: 'execution', name: 'No Mercy in Memory', desc: 'Execute a staggered, wounded Echo with a heavy blow.', group: 'sword', icon: 'plunge' },
  { id: 'crownbreaker', name: 'Crownbreaker', desc: 'Destroy three Echoes with a single Crownbreaker.', group: 'sword', icon: 'plunge' },
  { id: 'whirlwind', name: 'The Whirlwind', desc: 'Destroy four Echoes in one Whirlwind.', group: 'sword', icon: 'spiral' },
  { id: 'released', name: 'Released', desc: 'Release one hundred and fifty Echoes from the Crownheart.', group: 'sword', icon: 'ember', goal: 150, counter: 'kills' },
  // ---- two memories
  { id: 'first_shift', name: 'Which Memory Will Answer', desc: 'Force the castle into its other memory.', group: 'memories', icon: 'moons' },
  { id: 'shift_kill', name: 'Between Two Breaths', desc: 'Destroy an Echo within three seconds of changing memory.', group: 'memories', icon: 'hourglass' },
  { id: 'shifts', name: 'Two Memories, One Stone', desc: 'Shift the castle forty times.', group: 'memories', icon: 'moons', goal: 40, counter: 'shifts' },
  { id: 'unremembered', name: 'Unremembered', desc: 'Leave a floor without once being returned to a Blood Sigil.', group: 'memories', icon: 'hourglass' },
  // ---- what the castle kept
  { id: 'queen_letter', name: "The Queen's Letter", desc: 'Find the letter she left in her Solar — and learn who was saved.', group: 'kept', icon: 'letter', hidden: true, hint: 'Not every door on the Royal Floor opens in the same memory.' },
  { id: 'traces', name: 'What the Stones Confessed', desc: 'Read every memory trace in Caer Veyr.', group: 'kept', icon: 'scroll', goal: TRACES_ALL, counter: 'traces' },
  { id: 'chronicle', name: 'The Chronicle of Caer Veyr', desc: 'Turn every page of the illustrated chronicle.', group: 'kept', icon: 'book', goal: LORE_PAGES, counter: 'lore' },
  // ---- secrets
  { id: 'patience', name: 'Patience of Stone', desc: 'Leave the Uncrowned waiting before the gate for three minutes.', group: 'secret', icon: 'eye', hidden: true, hint: 'Some things are only seen by those who wait.' },
];

export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
