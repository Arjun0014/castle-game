import { Wave } from './Wavedash';
import { WD_ACHIEVEMENTS, WD_STATS, type StatSource } from '../data/wavedash';
import { COUNTER_KEYS, type Achievements, type CounterKey } from '../game/Achievements';

/**
 * The game's achievements on Wavedash (session 16). game/Achievements.ts stays the one system the game plays against —
 * its banner, its panel, its local store; this mirrors it onto the Wavedash achievements and stats named in
 * data/wavedash.ts.
 *
 * READ BEFORE WRITE (docs: Achievements & stats). Wavedash loads a player's stats and achievements in two parts and
 * `requestStats()` can resolve before both are in; until then `getStat` answers 0 and `setStat` / `setAchievement` return
 * false and DROP the write. So nothing is written until a probe proves the data is there: `setStat(id, getStat(id))` is
 * a no-op write of the server's own value that only succeeds once the store is ready (and the identifier is defined in
 * the Developer Portal). Until then — offline, the portal not set up yet, a slow connection — every unlock and count
 * simply stays in the local store; the next successful sync (on start, when the connection returns, every 2 minutes
 * while it has not succeeded) carries all of it over.
 *
 * Sync = pull, then push:
 *   pull  — an achievement Wavedash has and the local store does not (earned on another device) is adopted silently;
 *           a stat larger than the local counter (more Echoes released elsewhere) raises it — never a second banner.
 *   push  — every local unlock Wavedash lacks is set; every stat is set to the local value when they differ; one
 *           storeStats(). Live changes after that go straight through (`setStat` is throttled by the SDK to one save a
 *           second); unlocks store at once; leaving the page (hidden / pagehide) flushes with storeStats().
 */
export class WavedashStats {
  /** Wavedash has the player's stats loaded and our identifiers are known */
  ready = false;
  /** what happened (tests / the debug overlay) */
  log: string[] = [];
  private probing = false;
  private retry = 0;

  constructor(private ach: Achievements) {}

  start() {
    const sdk = Wave.sdk;
    if (!sdk) return;
    this.ach.listen((e) => {
      if (!this.ready) return;
      if (e.type === 'unlock') this.pushAchievement(e.id, true);
      else if (e.type === 'counter') this.pushStatsFor(e.key);
      else if (e.type === 'collection') { for (const s of WD_STATS) this.pushStat(s.id, s.source); }
      else if (e.type === 'reset') void this.connect('reset');
    });
    Wave.onConnection((on) => { if (on && !this.ready) void this.connect('reconnect'); });
    const flush = () => { if (this.ready) { try { sdk.storeStats(); } catch { /* host gone */ } } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    sdk.on(sdk.Events.STATS_STORED, (p) => { if (!p.success) this.note('store failed: ' + (p.message ?? '')); });
    void this.connect('start');
    // a session that never got through (portal not configured, a long outage): keep trying, quietly
    this.retry = window.setInterval(() => { if (!this.ready && Wave.online) void this.connect('retry'); }, 120_000);
  }

  private note(s: string) { this.log.push(`${new Date().toISOString().slice(11, 19)} ${s}`); if (this.log.length > 40) this.log.shift(); }

  /** request the stats, wait until they are really there, then sync */
  private async connect(why: string) {
    const sdk = Wave.sdk;
    if (!sdk || this.probing) return;
    this.probing = true;
    try {
      let asked = false;
      try { asked = (await sdk.requestStats()).success; } catch { asked = false; }
      if (!asked) { this.note(`${why}: requestStats failed (offline?)`); return; }
      // both halves loaded? (≤ 20 s; the subscription normally lands well under a second after the query)
      const t0 = performance.now();
      while (!this.probe()) {
        if (performance.now() - t0 > 20_000) { this.note(`${why}: stats never became writable — offline, or the identifiers are not defined in the Developer Portal`); return; }
        await new Promise((r) => setTimeout(r, 350));
      }
      this.ready = true;
      if (this.retry) { clearInterval(this.retry); this.retry = 0; }
      this.sync(why);
    } finally { this.probing = false; }
  }

  /** a write that changes nothing and only succeeds when the store is loaded and the identifier is defined */
  private probe(): boolean {
    const sdk = Wave.sdk!;
    for (const s of WD_STATS) {
      try { if (sdk.setStat(s.id, sdk.getStat(s.id))) return true; } catch { /* keep probing */ }
    }
    return false;
  }

  private local(src: StatSource): number {
    const d = this.ach.data;
    return src === 'traces' ? d.traces.length : src === 'lore' ? d.lore.length : d.counters[src];
  }

  /** pull what Wavedash knows, push what it lacks */
  sync(why = 'sync') {
    const sdk = Wave.sdk;
    if (!sdk || !this.ready) return;
    let adopted = 0, pushed = 0, stats = 0;
    // pull: deeds done elsewhere, larger counts
    for (const [id, wd] of Object.entries(WD_ACHIEVEMENTS)) {
      try { if (sdk.getAchievement(wd) && this.ach.adopt(id)) adopted++; } catch { /* unknown id */ }
    }
    for (const s of WD_STATS) {
      if (!(COUNTER_KEYS as string[]).includes(s.source)) continue;
      try { const r = sdk.getStat(s.id); if (r > 0 && this.ach.adoptCounter(s.source as CounterKey, r)) adopted++; } catch { /* unknown id */ }
    }
    // push: unlocks and counts the platform has not seen
    for (const id of Object.keys(this.ach.data.unlocked)) if (this.pushAchievement(id, false)) pushed++;
    for (const s of WD_STATS) if (this.pushStat(s.id, s.source)) stats++;
    try { sdk.storeStats(); } catch { /* host gone */ }
    this.note(`${why}: ready — adopted ${adopted}, pushed ${pushed} achievements, ${stats} stats`);
  }

  /** returns whether it was newly set */
  private pushAchievement(id: string, storeNow: boolean): boolean {
    const sdk = Wave.sdk, wd = WD_ACHIEVEMENTS[id];
    if (!sdk || !wd) return false;
    try {
      if (sdk.getAchievement(wd)) return false;
      const ok = sdk.setAchievement(wd, storeNow);
      if (!ok) this.note(`setAchievement ${wd} refused (not defined in the portal?)`);
      return ok;
    } catch { return false; }
  }

  private pushStat(id: string, src: StatSource): boolean {
    const sdk = Wave.sdk;
    if (!sdk) return false;
    const v = this.local(src);
    try {
      if (sdk.getStat(id) === v) return false;
      // counts only grow: never write a smaller value over a larger one (a reset local store re-adopts on the next sync)
      if (sdk.getStat(id) > v) return false;
      return sdk.setStat(id, v);
    } catch { return false; }
  }

  private pushStatsFor(src: StatSource) {
    for (const s of WD_STATS) if (s.source === src) this.pushStat(s.id, s.source);
  }

  /** debug overlay / probes */
  debug() {
    const sdk = Wave.sdk;
    return {
      ready: this.ready, log: [...this.log],
      stats: sdk && this.ready ? Object.fromEntries(WD_STATS.map((s) => [s.id, { wavedash: sdk.getStat(s.id), local: this.local(s.source) }])) : null,
      achievements: sdk && this.ready ? Object.fromEntries(Object.entries(WD_ACHIEVEMENTS).map(([id, wd]) => [wd, { wavedash: sdk.getAchievement(wd), local: this.ach.has(id) }])) : null,
    };
  }
}
