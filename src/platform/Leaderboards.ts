import { Wave } from './Wavedash';
import { LocalStore } from './Storage';

/**
 * The Endless Arena's leaderboard (session 17) — Wavedash leaderboards (docs: SDK → Leaderboards), with the player's own
 * best kept locally as well so the arena has a record to beat anywhere (itch, offline, before the board answers).
 *
 * One board, "Endless Arena" (key `endless_arena`): higher scores rank higher (DESC), shown as a number; `keepBest` uploads, so a weaker run
 * never lowers a standing. Each entry carries a little metadata — the wave reached, the Echoes released, the run's
 * seconds — which the arena's lists show next to the name. `getOrCreateLeaderboard` makes it on first use: created by a
 * member of the game's team it is Visible on the game page (a player's call can only find it, or make a Hidden one) —
 * it was made in the Developer Portal before release (CONTEXT §10 session 17), so players only ever find it.
 *
 * Every call is guarded and timed out: no SDK, no connection or a slow answer → null, and the arena carries on with
 * the local best. Nothing here ever throws into the game.
 */
/** the board's key (Developer Portal → Leaderboards: "endless_arena", shown as "Endless Arena", higher is better, number) */
export const BOARD_NAME = 'endless_arena';
const BEST_KEY = 'caer-veyr:arena-best';
const RUNS_KEY = 'caer-veyr:arena-runs';
const TIMEOUT_MS = 9000;

export interface ArenaRun { score: number; wave: number; kills: number; seconds: number; at?: number }
export interface BoardEntry { rank: number; name: string; score: number; wave: number | null; me: boolean }
export interface Submitted { rank: number; best: number; improved: boolean; runRank: number }

function timeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

type Raw = { userId?: string; username?: string; score?: number; globalRank?: number; metadata?: Record<string, string | number | boolean> };

class LeaderboardsImpl {
  private idP: Promise<string | null> | null = null;
  /** tests / the debug overlay */
  log: string[] = [];
  private note(s: string) { this.log.push(`${new Date().toISOString().slice(11, 19)} ${s}`); if (this.log.length > 30) this.log.shift(); }

  /** Wavedash is here and initialised (the board can be asked at all) */
  get online() { return Wave.available && Wave.initialised && Wave.online; }

  /** the board's id (made on first use); a failure is forgotten so the next call asks again */
  private boardId(): Promise<string | null> {
    const sdk = Wave.sdk;
    if (!sdk || !this.online) return Promise.resolve(null);
    if (!this.idP) {
      this.idP = timeout((async () => {
        const r = await sdk.getOrCreateLeaderboard(BOARD_NAME, sdk.LeaderboardSortOrder.DESC, sdk.LeaderboardDisplayType.NUMERIC);
        if (!r.success) { this.note('board: ' + r.message); return null; }
        this.note(`board ${r.data.name}: ${r.data.totalEntries} entries`);
        return r.data.id as unknown as string;
      })()).then((id) => { if (!id) this.idP = null; return id; });
    }
    return this.idP;
  }

  // ------------------------------------------------------------------ the local record
  localBest(): ArenaRun | null {
    const b = LocalStore.getJSON<ArenaRun>(BEST_KEY);
    return b && Number.isFinite(b.score) ? b : null;
  }
  /** this device's ten best runs, best first (the arena panel's list where there is no leaderboard) */
  localRuns(): ArenaRun[] {
    const list = LocalStore.getJSON<ArenaRun[]>(RUNS_KEY);
    const runs = Array.isArray(list) ? list.filter((r) => r && Number.isFinite(r.score)) : [];
    const best = this.localBest();
    if (best && !runs.some((r) => r.score === best.score && r.wave === best.wave)) runs.push(best);
    return runs.sort((x, y) => y.score - x.score).slice(0, 10);
  }
  /** keep `run` (the ten best, and the record); true = a new personal best */
  recordLocal(run: ArenaRun): boolean {
    const at = Date.now();
    LocalStore.setJSON(RUNS_KEY, [...this.localRuns(), { ...run, at }].sort((x, y) => y.score - x.score).slice(0, 10));
    const b = this.localBest();
    if (b && b.score >= run.score) return false;
    LocalStore.setJSON(BEST_KEY, { ...run, at });
    return true;
  }

  // ------------------------------------------------------------------ Wavedash
  /** upload a finished run (keepBest); null when the board cannot be reached */
  async submit(run: ArenaRun): Promise<Submitted | null> {
    const sdk = Wave.sdk, id = await this.boardId();
    if (!sdk || !id) return null;
    const meta = { wave: Math.round(run.wave), kills: Math.round(run.kills), secs: Math.round(run.seconds) };
    const r = await timeout(sdk.uploadLeaderboardScore(id as never, Math.round(run.score), true, undefined, meta));
    if (!r) { this.note('upload: no answer'); return null; }
    if (!r.success) { this.note('upload: ' + r.message); return null; }
    const d = r.data;
    this.note(`upload ${run.score}: rank ${d.globalRank}, run rank ${d.submittedRank}, changed ${d.scoreChanged}`);
    return { rank: d.globalRank, best: d.score, improved: !!d.scoreChanged, runRank: d.submittedRank };
  }

  /** the top `n` (null: the board cannot be reached) */
  async top(n = 10): Promise<BoardEntry[] | null> {
    const sdk = Wave.sdk, id = await this.boardId();
    if (!sdk || !id) return null;
    const r = await timeout(sdk.listLeaderboardEntries(id as never, 0, n, false));
    if (!r || !r.success) { this.note('top: ' + (r && !r.success ? r.message : 'no answer')); return null; }
    return (r.data as unknown as Raw[]).map((e) => this.entry(e));
  }

  /** the player's own standing (null: none yet, or the board cannot be reached) */
  async mine(): Promise<BoardEntry | null> {
    const sdk = Wave.sdk, id = await this.boardId();
    if (!sdk || !id) return null;
    const r = await timeout(sdk.getMyLeaderboardEntries(id as never));
    if (!r || !r.success) return null;
    const list = r.data as unknown as Raw[];
    return list.length ? this.entry(list[0]) : null;
  }

  private entry(e: Raw): BoardEntry {
    const me = Wave.player()?.id;
    const w = e.metadata?.wave;
    return {
      rank: Number(e.globalRank) || 0, name: String(e.username ?? '—').slice(0, 24), score: Number(e.score) || 0,
      wave: typeof w === 'number' ? w : null, me: !!me && e.userId === me,
    };
  }
}

export const Leaderboards = new LeaderboardsImpl();
(window as unknown as { __boards: LeaderboardsImpl }).__boards = Leaderboards;
