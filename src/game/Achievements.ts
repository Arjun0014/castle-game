import { ACHIEVEMENTS, ACH_BY_ID, LORE_PAGES, TRACE_TOTAL, type AchievementDef } from '../data/achievements';
import type { Signals } from './Signals';

/**
 * Achievement progress (session 15): what is unlocked (and when), the cumulative counters, the memory traces read and
 * the chronicle pages turned — kept in localStorage across sessions (`caer-veyr:achievements:v1`). Automated sessions
 * (`?mute`, autopilot, webdriver) keep it in memory only, unless `?ach` asks a test to persist it.
 *
 * Triggers come from gameplay signals (game/Signals.ts) — `bind(signals, view)` once per Game; the title screen feeds
 * the chronicle (lorePage) and the secret (menuIdle). Every unlock fires `onUnlock` (the toast) exactly once.
 */
const KEY = 'caer-veyr:achievements:v1';

export interface AchStore {
  v: 1;
  unlocked: Record<string, number>;
  counters: { kills: number; finishers: number; parries: number; shifts: number };
  traces: string[];
  lore: number[];
}
const empty = (): AchStore => ({ v: 1, unlocked: {}, counters: { kills: 0, finishers: 0, parries: 0, shifts: 0 }, traces: [], lore: [] });

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
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw) as Partial<AchStore>;
          if (d && d.v === 1) this.data = { ...empty(), ...d, counters: { ...empty().counters, ...(d.counters ?? {}) } } as AchStore;
        }
      } catch { /* private mode / blocked storage: play on without saving */ }
    }
  }

  private save() {
    if (!this.persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full or blocked */ }
  }

  has(id: string) { return id in this.data.unlocked; }
  get count() { return Object.keys(this.data.unlocked).filter((id) => ACH_BY_ID.has(id)).length; }
  get total() { return ACHIEVEMENTS.length; }

  /** progress of a cumulative achievement: [value, goal] */
  progress(a: AchievementDef): [number, number] | null {
    if (!a.goal || !a.counter) return null;
    const c = this.data.counters as Record<string, number>;
    const v = a.counter === 'traces' ? this.data.traces.length : a.counter === 'lore' ? this.data.lore.length : c[a.counter] ?? 0;
    return [Math.min(v, a.goal), a.goal];
  }

  unlock(id: string) {
    const a = ACH_BY_ID.get(id);
    if (!a || this.has(id)) return false;
    this.data.unlocked[id] = Date.now();
    this.save();
    this.log.push({ id, at: Date.now() });
    this.onUnlock?.(a);
    return true;
  }

  /** a counter moved: unlock whatever it completes */
  private checkGoals() {
    for (const a of ACHIEVEMENTS) {
      const p = this.progress(a);
      if (p && p[0] >= p[1]) this.unlock(a.id);
    }
  }
  private bump(k: keyof AchStore['counters'], n = 1) {
    this.data.counters[k] += n;
    this.save();
    this.checkGoals();
  }

  /** Clear everything (the Achievements panel's reset). */
  reset() {
    this.data = empty();
    this.save();
  }

  // ------------------------------------------------------------------ the title screen
  lorePage(n: number) {
    if (n < 1 || n > LORE_PAGES || this.data.lore.includes(n)) return;
    this.data.lore.push(n);
    this.save();
    this.checkGoals();
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
      if (d.id === 'crownbreaker' && d.phase === 'release') { this.cbUntil = t + 1.8; this.cbKills = 0; }
      if (d.id === 'whirlwind' && d.phase === 'start') { this.whirlOn = true; this.whirlKills = 0; }
      if (d.id === 'whirlwind' && d.phase === 'end') { this.whirlOn = false; this.whirlUntil = t + 0.8; }
    });
    signals.on('boss:start', (d) => { if (d.id === 'gate_warden') this.wardenHp = view.hp(); });
    signals.on('hero:death', () => { this.wardenHp = null; });
    signals.on('boss:dead', (d) => { if (d.id === 'last_crown') this.unlock('ending'); });
    signals.on('trace', (d) => {
      const f = view.floorId();
      const key = `${f}:${d.tid}`;
      if (f === 2 && d.tid === 'T3') this.unlock('queen_letter');
      if (!TRACE_TOTAL[f] || this.data.traces.includes(key)) return;
      this.data.traces.push(key);
      this.save();
      this.checkGoals();
    });
    signals.on('floor:arrive', (d) => {
      this.floorDeaths = d.deaths;
      if (d.id >= 2) this.unlock('floor1');
      if (d.id >= 3) this.unlock('floor2');
    });
    signals.on('floor:leave', (d) => {
      if (d.deaths === this.floorDeaths) this.unlock('unremembered');
      if (d.id === 3 && !d.next) this.unlock('ending');
    });
    this.view = view;
  }
  private view: AchView | null = null;

  /** per frame in play: the Gate Warden fight is "untouched" only while her health never drops */
  update() {
    if (this.wardenHp === null || !this.view) return;
    const hp = this.view.hp();
    if (hp < this.wardenHp - 0.01) this.wardenHp = null;
    else this.wardenHp = Math.max(this.wardenHp, hp);
  }
}
