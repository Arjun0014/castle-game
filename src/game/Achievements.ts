import { ACHIEVEMENTS, ACH_BY_ID, LORE_PAGES, TRACE_TOTAL, type AchievementDef } from '../data/achievements';
import type { Signals } from './Signals';
import { LocalStore } from '../platform/Storage';

/**
 * Achievement progress (session 15): what is unlocked (and when), the cumulative counters, the memory traces read and
 * the chronicle pages turned — kept in localStorage across sessions (`caer-veyr:achievements:v1`). Automated sessions
 * (`?mute`, autopilot, webdriver) keep it in memory only, unless `?ach` asks a test to persist it.
 *
 * Triggers come from gameplay signals (game/Signals.ts) — `bind(signals, view)` once per Game; the title screen feeds
 * the chronicle (lorePage) and the secret (menuIdle). Every unlock fires `onUnlock` (the toast) exactly once.
 *
 * Session 16 (Wavedash): this stays the game's one achievement system. platform/WavedashStats.ts mirrors it onto
 * Wavedash achievements + stats (`listen`), and deeds or counts earned on another device come back through `adopt` /
 * `adoptCounter` / `merge` — silently: a deed is announced once, where it was done. Four more cumulative counters feed
 * Wavedash stats only (bosses and mini-bosses felled, Crownbreakers, Whirlwinds, endings reached).
 */
const KEY = 'caer-veyr:achievements:v1';

export interface AchStore {
  v: 1;
  unlocked: Record<string, number>;
  counters: Counters;
  traces: string[];
  lore: number[];
}
export interface Counters { kills: number; finishers: number; parries: number; shifts: number; bosses: number; crownbreakers: number; whirlwinds: number; completions: number }
export type CounterKey = keyof Counters;
export const COUNTER_KEYS: CounterKey[] = ['kills', 'finishers', 'parries', 'shifts', 'bosses', 'crownbreakers', 'whirlwinds', 'completions'];
const emptyCounters = (): Counters => ({ kills: 0, finishers: 0, parries: 0, shifts: 0, bosses: 0, crownbreakers: 0, whirlwinds: 0, completions: 0 });
const empty = (): AchStore => ({ v: 1, unlocked: {}, counters: emptyCounters(), traces: [], lore: [] });

/** what changed (platform/WavedashStats.ts mirrors it; platform/CloudSave.ts schedules an upload) */
export type AchEvent = { type: 'unlock'; id: string; quiet: boolean } | { type: 'counter'; key: CounterKey } | { type: 'collection' } | { type: 'reset' };

/** what the tracker reads from the running game (kept narrow: Achievements never imports Game) */
export interface AchView {
  floorId(): number;
  hp(): number;
  /** seconds on a monotonic clock (real time, so slow motion does not stretch windows) */
  now(): number;
}

export class Achievements {
  data: AchStore;
  onUnlock?: (a: AchievementDef) => void;
  private persist: boolean;
  /** each unlock this session (tests) */
  log: { id: string; at: number }[] = [];

  constructor(persist: boolean) {
    this.persist = persist;
    this.data = empty();
    if (persist) {
      const d = sanitize(LocalStore.getJSON<Partial<AchStore>>(KEY));
      if (d) this.data = d;
    }
  }

  private save() {
    if (!this.persist) return;
    LocalStore.setJSON(KEY, this.data);
  }

  private subs = new Set<(e: AchEvent) => void>();
  /** every change (unlocks, counters, traces / pages) */
  listen(f: (e: AchEvent) => void) { this.subs.add(f); return () => this.subs.delete(f); }
  private tell(e: AchEvent) { for (const f of this.subs) { try { f(e); } catch (err) { console.warn('[ach] listener', err); } } }
  /** while set, goals reached by adopted counts unlock without a toast (another device earned them) */
  private quiet = false;

  has(id: string) { return id in this.data.unlocked; }
  get count() { return Object.keys(this.data.unlocked).filter((id) => ACH_BY_ID.has(id)).length; }
  get total() { return ACHIEVEMENTS.length; }

  /** progress of a cumulative achievement: [value, goal] */
  progress(a: AchievementDef): [number, number] | null {
    if (!a.goal || !a.counter) return null;
    const c = this.data.counters as unknown as Record<string, number>;
    const v = a.counter === 'traces' ? this.data.traces.length : a.counter === 'lore' ? this.data.lore.length : c[a.counter] ?? 0;
    return [Math.min(v, a.goal), a.goal];
  }

  unlock(id: string) {
    const a = ACH_BY_ID.get(id);
    if (!a || this.has(id)) return false;
    this.data.unlocked[id] = Date.now();
    this.save();
    this.log.push({ id, at: Date.now() });
    if (!this.quiet) this.onUnlock?.(a);
    this.tell({ type: 'unlock', id, quiet: this.quiet });
    return true;
  }

  // ------------------------------------------------------------------ another device's progress (session 16)
  /** a deed already earned elsewhere (Wavedash says so): kept, never announced */
  adopt(id: string, at = Date.now()) {
    if (!ACH_BY_ID.has(id) || this.has(id)) return false;
    this.data.unlocked[id] = at;
    this.save();
    this.tell({ type: 'unlock', id, quiet: true });
    return true;
  }
  /** a cumulative count from elsewhere: the larger one wins (counts only grow); goals it completes unlock quietly */
  adoptCounter(k: CounterKey, v: number) {
    if (!(v > this.data.counters[k])) return false;
    this.data.counters[k] = Math.floor(v);
    this.save();
    this.quiet = true;
    try { this.checkGoals(); } finally { this.quiet = false; }
    this.tell({ type: 'counter', key: k });
    return true;
  }
  /** Fold in another copy of the store (a cloud save): deeds and pages / traces united, counts maxed. Quiet. */
  merge(other: unknown) {
    const o = sanitize(other);
    if (!o) return false;
    const d = this.data;
    let changed = false;
    for (const [id, t] of Object.entries(o.unlocked)) {
      if (!ACH_BY_ID.has(id)) continue;
      if (!(id in d.unlocked) || t < d.unlocked[id]) { d.unlocked[id] = t; changed = true; }   // the earliest date it was done
    }
    for (const k of COUNTER_KEYS) if (o.counters[k] > d.counters[k]) { d.counters[k] = o.counters[k]; changed = true; }
    for (const t of o.traces) if (!d.traces.includes(t)) { d.traces.push(t); changed = true; }
    for (const n of o.lore) if (!d.lore.includes(n)) { d.lore.push(n); changed = true; }
    if (!changed) return false;
    this.save();
    this.quiet = true;
    try { this.checkGoals(); } finally { this.quiet = false; }
    this.tell({ type: 'collection' });
    return true;
  }

  /** a counter moved: unlock whatever it completes */
  private checkGoals() {
    for (const a of ACHIEVEMENTS) {
      const p = this.progress(a);
      if (p && p[0] >= p[1]) this.unlock(a.id);
    }
  }
  private bump(k: CounterKey, n = 1) {
    this.data.counters[k] += n;
    this.save();
    this.checkGoals();
    this.tell({ type: 'counter', key: k });
  }

  /**
   * Clear everything (the Achievements panel's reset). On Wavedash the platform keeps its own record — deeds earned
   * there come back on the next sync (a game cannot take a Wavedash achievement away).
   */
  reset() {
    this.data = empty();
    this.save();
    this.tell({ type: 'reset' });
  }

  // ------------------------------------------------------------------ the title screen
  lorePage(n: number) {
    if (n < 1 || n > LORE_PAGES || this.data.lore.includes(n)) return;
    this.data.lore.push(n);
    this.save();
    this.checkGoals();
    this.tell({ type: 'collection' });
  }

  // ------------------------------------------------------------------ gameplay triggers
  private lastShift = -1e9;
  /** the five-cut chain: the last route-A strike that landed, in order */
  private chain = 0;
  private chainAt = -1e9;
  private chainSerial = -1;
  private cbUntil = -1e9; private cbKills = 0;
  private whirlOn = false; private whirlUntil = -1e9; private whirlKills = 0;
  private wardenHp: number | null = null;
  private floorDeaths = 0;

  bind(signals: Signals, view: AchView) {
    const now = () => view.now();
    signals.on('kill', (d) => {
      this.bump('kills');
      const t = now();
      if (t - this.lastShift <= 3) this.unlock('shift_kill');
      if (d.execution && !d.finisher) this.unlock('execution');
      if (t <= this.cbUntil && ++this.cbKills >= 3) this.unlock('crownbreaker');
      if ((this.whirlOn || t <= this.whirlUntil) && ++this.whirlKills >= 4) this.unlock('whirlwind');
      const arch = d.arch as string;
      if (arch === 'gate_warden') {
        this.unlock('gate_warden');
        if (this.wardenHp !== null) this.unlock('untouched');
        this.wardenHp = null;
      }
      if (arch === 'kingsguard' || arch === 'goblin_king' || arch === 'widow_mother' || arch === 'maw') this.unlock(arch);
      // bosses and mini-bosses felled (the Last Crown ends through boss:dead, below)
      if (d.boss) this.bump('bosses');
    });
    signals.on('finisher', () => { this.bump('finishers'); this.unlock('finisher'); });
    signals.on('parry', () => { this.bump('parries'); this.unlock('parry'); });
    signals.on('shift', () => { this.lastShift = now(); this.bump('shifts'); this.unlock('first_shift'); });
    signals.on('hit', (d) => {
      const m = /^L([1-5])$/.exec(d.attack ?? '');
      const t = now();
      if (!m) { if (d.attack) this.chain = 0; return; }
      const k = Number(m[1]);
      if (t - this.chainAt > 2.5) this.chain = 0;
      if (k === 1 && d.serial !== this.chainSerial) this.chain = 1;
      else if (k === this.chain + 1) this.chain = k;
      else if (k !== this.chain) this.chain = 0;
      this.chainAt = t;
      this.chainSerial = d.serial;
      if (this.chain === 5) this.unlock('five_cuts');
    });
    signals.on('ability', (d) => {
      const t = now();
      if (d.id === 'crownbreaker' && d.phase === 'release') { this.cbUntil = t + 1.8; this.cbKills = 0; this.bump('crownbreakers'); }
      if (d.id === 'whirlwind' && d.phase === 'start') { this.whirlOn = true; this.whirlKills = 0; this.bump('whirlwinds'); }
      if (d.id === 'whirlwind' && d.phase === 'end') { this.whirlOn = false; this.whirlUntil = t + 0.8; }
    });
    signals.on('boss:start', (d) => { if (d.id === 'gate_warden') this.wardenHp = view.hp(); });
    signals.on('hero:death', () => { this.wardenHp = null; });
    signals.on('boss:dead', (d) => {
      if (d.id !== 'last_crown') return;
      this.bump('bosses');
      this.completed();
    });
    signals.on('trace', (d) => {
      const f = view.floorId();
      const key = `${f}:${d.tid}`;
      if (f === 2 && d.tid === 'T3') this.unlock('queen_letter');
      if (!TRACE_TOTAL[f] || this.data.traces.includes(key)) return;
      this.data.traces.push(key);
      this.save();
      this.checkGoals();
      this.tell({ type: 'collection' });
    });
    signals.on('floor:arrive', (d) => {
      this.floorDeaths = d.deaths;
      if (d.id >= 2) this.unlock('floor1');
      if (d.id >= 3) this.unlock('floor2');
    });
    signals.on('floor:leave', (d) => {
      if (d.deaths === this.floorDeaths) this.unlock('unremembered');
      if (d.id === 3 && !d.next) this.completed();
    });
    this.view = view;
  }
  private view: AchView | null = null;
  /** the game was ended in this session (the Last Crown's death and the floor's end both say so: count it once) */
  private ended = false;
  private completed() {
    this.unlock('ending');
    if (this.ended) return;
    this.ended = true;
    this.bump('completions');
  }

  /** per frame in play: the Gate Warden fight is "untouched" only while her health never drops */
  update() {
    if (this.wardenHp === null || !this.view) return;
    const hp = this.view.hp();
    if (hp < this.wardenHp - 0.01) this.wardenHp = null;
    else this.wardenHp = Math.max(this.wardenHp, hp);
  }
}

/** a stored / downloaded achievement store, checked field by field (unknown or broken data never gets in) */
function sanitize(raw: unknown): AchStore | null {
  const d = raw as Partial<AchStore> | null;
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  const out = empty();
  if (d.unlocked && typeof d.unlocked === 'object') {
    for (const [id, t] of Object.entries(d.unlocked)) if (typeof t === 'number' && t > 0) out.unlocked[id] = t;
  }
  const c = (d.counters ?? {}) as Partial<Counters>;
  for (const k of COUNTER_KEYS) { const v = Number(c[k]); if (v > 0 && Number.isFinite(v)) out.counters[k] = Math.floor(v); }
  if (Array.isArray(d.traces)) out.traces = [...new Set(d.traces.filter((x): x is string => typeof x === 'string'))];
  if (Array.isArray(d.lore)) out.lore = [...new Set(d.lore.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= LORE_PAGES))];
  return out;
}
