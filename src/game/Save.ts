import type { Learned } from './Objectives';
import type { TimeState } from '../levels/Materials';
import { LocalStore, deviceId } from '../platform/Storage';

/**
 * Progress save (main menu → Continue).
 *
 * v1 (the jam build) saved at the threshold of each floor only. v2 (session 16, the Wavedash version) also saves at every
 * Blood Sigil: the floor, the sigil she last knelt at and what that floor remembers of her (the encounters she cleared,
 * the fractures broken, the sigils lit, the memories read, her Resonance), so Continue wakes her at that sigil exactly as
 * a death would — on Floor 1 too, which is now resumable once its first sigil is lit. Bosses and cleared encounters
 * refresh the same checkpoint (a boss stays dead), the floor's arrival writes a floor-start save.
 *
 * The record is versioned (`v`) and stamped (`savedAt` ms + `device`), so platform/CloudSave.ts can tell which of two
 * copies is newer and whether one descends from the other. Old v1 records are migrated on read. Saves live in local
 * storage (platform/Storage.ts: per Wavedash player) and, on Wavedash, in the cloud save `saves/main.json`.
 */
export type Guidance = 'guided' | 'minimal';

/** mid-floor progress: a Blood Sigil and what the floor remembers (all ids as built in floor0N_layout.py) */
export interface CheckpointState {
  /** the sigil she wakes at (marker name, e.g. 'CP3') */
  cid: string;
  /** the memory she knelt in */
  state: TimeState;
  charge: number;
  /** time shifting learned (Floor 1's blood rite) */
  unlocked: boolean;
  shifts: number;
  /** encounters cleared (their Echoes stay released) */
  cleared: string[];
  /** fractures broken / doors forced (Level flags) */
  flags: string[];
  /** sigils lit on this floor */
  sigils: string[];
  /** memory traces read on this floor */
  traces: string[];
  /** her facing at the sigil (radians) */
  yaw?: number;
  /** deaths when she arrived on this floor (the "Unremembered" deed stays honest across a Continue) */
  arriveDeaths?: number;
}

export interface SaveData {
  v: 2;
  /** the floor to continue on (1–3) */
  floor: number;
  guidance: Guidance;
  learned: Partial<Learned>;
  bestiary: string[];
  deaths: number;
  /** seconds of play before this save (the ending card's total) */
  playTime: number;
  /** the game was finished at least once */
  finished?: boolean;
  /** where on the floor (null = the floor's start) */
  checkpoint?: CheckpointState | null;
  /** ms since epoch, and the browser that wrote it (platform/Storage.deviceId) */
  savedAt: number;
  device: string;
}

const KEY = 'caer-veyr-save';
export const SAVE_VERSION = 2;
const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
export const FLOOR_NAME: Record<number, string> = { 1: 'Inheritance', 2: 'Complicity', 3: 'The Crownheart' };

const strings = (a: unknown) => Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];

/** A save record from anywhere (local storage, the cloud, an older build) as a valid v2 record, or null. */
export function validateSave(raw: unknown): SaveData | null {
  const d = raw as Omit<Partial<SaveData>, 'v'> & { v?: number };
  if (!d || typeof d !== 'object') return null;
  if (d.v !== 1 && d.v !== 2) return null;
  const floor = Number(d.floor);
  if (!(floor >= 1 && floor <= 3)) return null;
  let cp: CheckpointState | null = null;
  const c = d.checkpoint as Partial<CheckpointState> | null | undefined;
  if (c && typeof c.cid === 'string') {
    cp = {
      cid: c.cid, state: c.state === 'PAST' ? 'PAST' : 'PRESENT', charge: Math.max(0, Number(c.charge) || 0), unlocked: !!c.unlocked,
      shifts: Math.max(0, Number(c.shifts) || 0), cleared: strings(c.cleared), flags: strings(c.flags), sigils: strings(c.sigils), traces: strings(c.traces),
      yaw: Number.isFinite(Number(c.yaw)) ? Number(c.yaw) : undefined, arriveDeaths: Number.isFinite(Number(c.arriveDeaths)) ? Number(c.arriveDeaths) : undefined,
    };
  }
  // v1 never wrote Floor I and never wrote a checkpoint; a Floor I record without one is not a Continue point
  if (floor === 1 && !cp) return null;
  return {
    v: 2, floor, guidance: d.guidance === 'guided' ? 'guided' : 'minimal', learned: (d.learned && typeof d.learned === 'object') ? d.learned : {},
    bestiary: strings(d.bestiary), deaths: Math.max(0, Number(d.deaths) || 0), playTime: Math.max(0, Number(d.playTime) || 0),
    finished: !!d.finished, checkpoint: cp, savedAt: Number(d.savedAt) || 0, device: typeof d.device === 'string' ? d.device : 'legacy',
  };
}

/** progression order: later floor > later sigil on the same floor > floor start; a finished game above all */
export function saveRank(d: SaveData | null): number {
  if (!d) return -1;
  const cp = d.checkpoint;
  const n = cp ? Number(/(\d+)/.exec(cp.cid)?.[1] ?? 0) + (/\d+[A-Z]$/.test(cp.cid) ? 0.5 : 0) + 0.25 : 0;
  return (d.finished ? 10000 : 0) + d.floor * 100 + n;
}

/** identity of a save (two copies with the same stamp are the same save) */
export function saveStamp(d: SaveData | null) { return d ? `${d.savedAt}:${d.device}` : 'none'; }

/** "Floor II · Complicity" / "Floor I · Inheritance · Blood Sigil 3" */
export function saveLabel(d: SaveData): { floor: string; where: string } {
  const where = d.checkpoint ? `Blood Sigil ${/(\d+)/.exec(d.checkpoint.cid)?.[1] ?? ''}`.trim() : 'the way in';
  return { floor: `Floor ${ROMAN[d.floor]} · ${FLOOR_NAME[d.floor]}`, where: d.finished && d.floor === 3 && !d.checkpoint ? 'the game finished' : where };
}

type Listener = (d: SaveData | null, why: string) => void;
const listeners = new Set<Listener>();

export const Save = {
  load(): SaveData | null {
    const d = validateSave(LocalStore.getJSON(KEY));
    return d;
  },
  /** Write the current progress (stamped now, by this browser). Returns the record. */
  write(d: Omit<SaveData, 'v' | 'savedAt' | 'device'>, why = 'save'): SaveData {
    const rec: SaveData = { ...d, v: 2, savedAt: Date.now(), device: deviceId() };
    LocalStore.setJSON(KEY, rec);
    for (const f of listeners) f(rec, why);
    return rec;
  },
  /** Store a record exactly as it is (a cloud copy keeps its own stamp) — no listeners. */
  put(d: SaveData | null) {
    if (d) LocalStore.setJSON(KEY, d); else LocalStore.remove(KEY);
  },
  clear() { LocalStore.remove(KEY); },
  /** every local write (platform/CloudSave.ts uploads at these moments) */
  onWrite(f: Listener) { listeners.add(f); return () => listeners.delete(f); },
};
