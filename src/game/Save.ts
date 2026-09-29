import type { Learned } from './Objectives';

/**
 * Progress save (main menu → Continue). Caer Veyr saves at the threshold of each floor: arriving on Floor II or III
 * records it, and Continue loads that floor's start with the state a player carries there (shifting unlocked,
 * the floor's rewards, the tutorials already learned). Mid-floor Blood Sigils stay per-session: a floor is a
 * 10–20 minute chapter and its encounters are not serialised.
 *
 * Floor I is never offered as "Continue" (that is New Game). Finishing the game keeps the save of Floor III.
 */
export type Guidance = 'guided' | 'minimal';

export interface SaveData {
  v: 1;
  /** the floor to continue from (2 or 3) */
  floor: number;
  guidance: Guidance;
  learned: Partial<Learned>;
  bestiary: string[];
  deaths: number;
  /** seconds of play before this floor (the ending card's total) */
  playTime: number;
  /** the game was finished at least once */
  finished?: boolean;
  savedAt: number;
}

const KEY = 'caer-veyr-save';

export const Save = {
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      if (d?.v !== 1 || !(d.floor >= 2 && d.floor <= 3)) return null;
      return d;
    } catch { return null; }
  },
  write(d: Omit<SaveData, 'v' | 'savedAt'>) {
    try { localStorage.setItem(KEY, JSON.stringify({ ...d, v: 1, savedAt: Date.now() })); } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  },
};
