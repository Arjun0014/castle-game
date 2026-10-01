import { Wave } from './Wavedash';
import { LocalStore, deviceId } from './Storage';
import { Platform, type DisplayPref } from './Platform';
import { Save, validateSave, saveRank, saveStamp, type SaveData } from '../game/Save';
import type { Achievements } from '../game/Achievements';
import type { Settings, SettingsData } from '../game/Settings';
import { LOOK_KEY } from '../ui/TouchControls';

/**
 * Cloud saves on Wavedash (session 16) — the Remote Storage API (docs: Cloud saves): one file per player,
 * `saves/main.json`, written to the SDK's local store (`writeLocalFile`) and uploaded (`uploadRemoteFile`); read back
 * with `remoteFileExists` → `downloadRemoteFile` → `readLocalFile`. Local storage stays the game's working copy and the
 * whole game runs from it when the cloud cannot be reached (and everywhere outside Wavedash).
 *
 * The file (a "bundle", format below) carries everything a player would miss on another device: the Continue point
 * (game/Save.ts v2: floor, Blood Sigil, what that floor remembers, guidance, lessons learned, bestiary, deaths, play
 * time, finished), the achievement store (deeds, counters, memory traces, chronicle pages — merged, never replaced), the
 * settings, the phone's Portrait / Landscape choice and the touch HUD's learned LOOK hint. Achievements additionally live
 * in Wavedash's own achievement system (platform/WavedashStats.ts).
 *
 * NEVER BLINDLY OVERWRITE. Each copy of the progress carries a stamp (savedAt + device). This browser remembers the
 * stamp it last saw in the cloud (`base`). At start, and before every upload:
 *   - same stamp                     → nothing to decide;
 *   - the cloud still holds `base`   → only this device moved on → upload;
 *   - this device still holds `base` → only the cloud moved on (another device) → adopt the cloud copy;
 *   - both moved on (or this device never met the cloud) → the clearly newer copy wins IF it is not behind the other
 *     (same floor or further); a newer copy that is BEHIND the older one is a genuine conflict: the player chooses
 *     (ui/CloudConflict.ts: CLOUD SAVE / THIS DEVICE with floor, sigil and date). The copy not kept is set aside in local
 *     storage (`caer-veyr-save:set-aside`), never destroyed before the choice.
 * Achievements and counts are merged in every direction (union / max), so no choice ever loses a deed.
 *
 * Offline (no connection at start, an upload that fails): play goes on from the local copy, the bundle is marked
 * pending, and the next connection (BACKEND_CONNECTED / `online`) syncs it. A conflict found mid-play is never resolved
 * under the player: uploads stop and the choice waits for the title. Uploads happen at save points only (a Blood Sigil,
 * a floor, a boss, quitting, the ending — at once; achievements and settings — gathered, at most every 15 s), never
 * per frame. The SDK itself queues one upload per file, last write wins.
 */
export const CLOUD_PATH = 'saves/main.json';
export const CLOUD_FORMAT = 'echoes-of-caer-veyr';
export const CLOUD_VERSION = 1;
const META_KEY = 'caer-veyr:cloud';
const ASIDE_KEY = 'caer-veyr-save:set-aside';

export interface CloudPrefs {
  settings: Partial<SettingsData>;
  settingsAt: number;
  display: DisplayPref | null;
  displayAt: number;
  lookLearned: boolean;
}
export interface CloudBundle {
  format: string;
  version: number;
  savedAt: number;
  device: string;
  progress: SaveData | null;
  achievements: unknown;
  prefs: CloudPrefs;
}
interface Meta { base: string | null; pending: boolean; lastSync: number }

export type CloudStatus = 'local' | 'checking' | 'synced' | 'saving' | 'offline' | 'conflict';

export interface Conflict {
  cloud: SaveData;
  local: SaveData;
  /** keep one copy (the other is set aside locally) */
  resolve(keep: 'cloud' | 'local'): Promise<void>;
}

/** forced uploads: the moments a player expects progress to be safe */
const FORCE = new Set(['floor', 'sigil', 'boss', 'quit', 'ending', 'reconnect', 'hidden', 'resolve', 'start']);
const MIN_GAP = 15_000;

export function validateBundle(raw: unknown): CloudBundle | null {
  const b = raw as Partial<CloudBundle> | null;
  if (!b || typeof b !== 'object' || b.format !== CLOUD_FORMAT || typeof b.version !== 'number') return null;
  // a newer build's file: read what this build understands (the progress record is validated on its own)
  const p = (b.prefs ?? {}) as Partial<CloudPrefs>;
  return {
    format: CLOUD_FORMAT, version: b.version, savedAt: Number(b.savedAt) || 0, device: String(b.device ?? ''),
    progress: validateSave(b.progress), achievements: b.achievements ?? null,
    prefs: {
      settings: (p.settings && typeof p.settings === 'object') ? p.settings : {}, settingsAt: Number(p.settingsAt) || 0,
      display: p.display === 'portrait' || p.display === 'landscape' ? p.display : null, displayAt: Number(p.displayAt) || 0, lookLearned: !!p.lookLearned,
    },
  };
}

export class CloudSave {
  status: CloudStatus = 'local';
  /** when the cloud last confirmed a copy (ms) */
  lastSync = 0;
  conflict: Conflict | null = null;
  private statusSubs = new Set<(s: CloudStatus) => void>();
  /** status changes (the title's chip, the in-play save mark, the settings line) */
  listenStatus(f: (s: CloudStatus) => void) { this.statusSubs.add(f); return () => this.statusSubs.delete(f); }
  /** the Continue point changed under the title (a newer cloud copy was adopted) */
  onProgress?: (d: SaveData | null) => void;
  /** a conflict needs the player (the title shows ui/CloudConflict.ts) */
  onConflict?: (c: Conflict) => void;
  log: string[] = [];
  private meta: Meta;
  private busy: Promise<void> | null = null;
  private again: string | null = null;
  private lastUpload = 0;
  private timer = 0;
  private dirty = false;
  /** a conflict was found while playing: no uploads until the title resolves it */
  private deferred = false;

  constructor(private o: { achievements: Achievements; settings: Settings; enabled: boolean; inPlay: () => boolean }) {
    this.meta = { base: null, pending: false, lastSync: 0, ...(LocalStore.getJSON<Meta>(META_KEY) ?? {}) };
    this.lastSync = this.meta.lastSync;
  }

  get enabled() { return this.o.enabled && Wave.available; }

  private note(s: string) { this.log.push(`${new Date().toISOString().slice(11, 19)} ${s}`); if (this.log.length > 60) this.log.shift(); }
  private setStatus(s: CloudStatus) { if (s === this.status) return; this.status = s; for (const f of this.statusSubs) f(s); }
  private saveMeta() { LocalStore.setJSON(META_KEY, this.meta); }

  // ------------------------------------------------------------------ start
  /** At boot: fetch the cloud copy and reconcile (resolves when decided, or at once offline). Safe outside Wavedash. */
  async start(): Promise<void> {
    if (!this.enabled) { this.setStatus('local'); return; }
    this.hook();
    this.setStatus('checking');
    const r = await this.fetchRemote();
    if (!r.ok) { this.offline('start: the cloud could not be reached'); return; }
    this.adoptShared(r.bundle);
    const local = Save.load(), remote = r.bundle?.progress ?? null;
    const d = this.decide(local, remote);
    this.note(`start: local ${saveStamp(local)} · cloud ${saveStamp(remote)} · base ${this.meta.base} → ${d}`);
    if (d === 'conflict') { this.raise(local!, remote!); return; }
    if (d === 'remote') { Save.put(remote); this.onProgress?.(remote); }
    this.meta.base = saveStamp(remote);
    this.saveMeta();
    // bring the cloud up to date when this device knows more (its progress, merged deeds, newer settings)
    if (d === 'local' || !r.bundle || this.differs(r.bundle)) await this.upload('start');
    else { this.meta.pending = false; this.meta.lastSync = this.lastSync = Date.now(); this.saveMeta(); this.setStatus('synced'); }
  }

  /** which copy of the progress stands (see the header) */
  decide(L: SaveData | null, R: SaveData | null): 'same' | 'local' | 'remote' | 'conflict' {
    const ls = saveStamp(L), rs = saveStamp(R), base = this.meta.base;
    if (ls === rs) return 'same';
    if (!R) return 'local';
    if (!L) return 'remote';
    if (rs === base) return 'local';
    if (ls === base) return 'remote';
    const localNewer = L.savedAt >= R.savedAt;
    const [n, o] = localNewer ? [L, R] : [R, L];
    if (saveRank(n) >= saveRank(o)) return localNewer ? 'local' : 'remote';
    return 'conflict';
  }

  private raise(local: SaveData, cloud: SaveData) {
    this.setStatus('conflict');
    this.conflict = {
      local, cloud,
      resolve: async (keep) => {
        const aside = keep === 'cloud' ? local : cloud;
        LocalStore.setJSON(ASIDE_KEY, { at: Date.now(), from: keep === 'cloud' ? 'this device' : 'the cloud', save: aside });
        if (keep === 'cloud') { Save.put(cloud); this.onProgress?.(cloud); } else this.onProgress?.(local);
        // either way the cloud copy has now been seen: the next upload may replace it
        this.meta.base = saveStamp(cloud);
        this.saveMeta();
        this.conflict = null;
        this.deferred = false;
        this.note(`conflict resolved: kept ${keep}`);
        await this.upload('resolve');
      },
    };
    this.note(`conflict: this device ${saveStamp(local)} rank ${saveRank(local)} · cloud ${saveStamp(cloud)} rank ${saveRank(cloud)}`);
    this.onConflict?.(this.conflict);
  }

  // ------------------------------------------------------------------ uploads
  private hooked = false;
  private hook() {
    if (this.hooked) return;
    this.hooked = true;
    Save.onWrite((_d, why) => { this.dirty = true; void this.upload(why); });
    this.o.achievements.listen(() => { this.dirty = true; this.later(); });
    this.o.settings.onChange(() => { if (this.o.settings.updatedAt > this.lastSync) { this.dirty = true; this.later(); } });
    Platform.onDisplayPref(() => { this.dirty = true; this.later(); });
    Wave.onConnection((on) => { if (on && (this.meta.pending || this.status === 'offline')) void this.upload('reconnect'); });
    window.addEventListener('online', () => { if (this.meta.pending) void this.upload('reconnect'); });
    // no event came (the backend never dropped, only storage failed): try again now and then while something waits
    window.setInterval(() => { if (this.meta.pending && !this.busy && !document.hidden) void this.upload('reconnect'); }, 60_000);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.dirty) void this.upload('hidden'); });
  }

  /** gather small changes (achievements, settings): one upload a little later */
  private later(ms = 4000) {
    if (!this.enabled || this.timer) return;
    this.timer = window.setTimeout(() => { this.timer = 0; void this.upload('changes'); }, ms);
  }

  /**
   * Upload the current bundle — after checking the cloud has not moved on without us (another device): then the copies
   * are reconciled first, and a conflict found during play stops uploads until the title.
   */
  upload(why: string): Promise<void> {
    if (!this.enabled || this.conflict || this.deferred) return Promise.resolve();
    const force = FORCE.has(why);
    if (!force && Date.now() - this.lastUpload < MIN_GAP) { this.later(MIN_GAP - (Date.now() - this.lastUpload) + 50); return Promise.resolve(); }
    if (this.busy) { this.again = force ? why : (this.again ?? why); return this.busy; }
    this.busy = this.doUpload(why).finally(() => {
      this.busy = null;
      const next = this.again;
      this.again = null;
      if (next) void this.upload(FORCE.has(next) ? next : 'again');
    });
    return this.busy;
  }

  private async doUpload(why: string) {
    this.setStatus('saving');
    const r = await this.fetchRemote();
    if (!r.ok) { this.offline(`${why}: the cloud could not be reached`); return; }
    this.adoptShared(r.bundle);
    const remote = r.bundle?.progress ?? null;
    let local = Save.load();
    const rs = saveStamp(remote);
    if (remote && rs !== this.meta.base && rs !== saveStamp(local)) {
      // another device saved since this one last looked
      const d = this.decide(local, remote);
      this.note(`${why}: the cloud moved on (${rs}) → ${d}`);
      if (d === 'conflict' || (d === 'remote' && this.o.inPlay())) {
        if (this.o.inPlay()) { this.deferred = true; this.setStatus('conflict'); this.note('conflict deferred to the title'); return; }
        this.raise(local!, remote);
        return;
      }
      if (d === 'remote') { Save.put(remote); local = remote; this.onProgress?.(remote); }
      this.meta.base = rs;
    }
    const bundle = this.compose(local);
    const ok = await Wave.storage.write(CLOUD_PATH, JSON.stringify(bundle)) && await Wave.storage.upload(CLOUD_PATH);
    if (!ok) { this.offline(`${why}: upload failed`); return; }
    this.lastUpload = Date.now();
    this.dirty = false;
    this.meta = { base: saveStamp(bundle.progress), pending: false, lastSync: Date.now() };
    this.lastSync = this.meta.lastSync;
    this.saveMeta();
    this.note(`${why}: uploaded ${saveStamp(bundle.progress)}`);
    this.setStatus('synced');
  }

  private offline(why: string) {
    this.meta.pending = true;
    this.saveMeta();
    this.note(why + ' — kept locally, will sync when the connection returns');
    this.setStatus('offline');
  }

  /** Before leaving (quit to title, the ending): upload now and wait a moment for it. */
  async flush(timeoutMs = 2500) {
    if (!this.enabled) return;
    await Promise.race([this.upload('quit'), new Promise((r) => setTimeout(r, timeoutMs))]);
  }

  // ------------------------------------------------------------------ the bundle
  compose(progress = Save.load()): CloudBundle {
    const s = this.o.settings;
    return {
      format: CLOUD_FORMAT, version: CLOUD_VERSION, savedAt: Date.now(), device: deviceId(),
      progress, achievements: this.o.achievements.data,
      prefs: { settings: { ...s.data }, settingsAt: s.updatedAt, display: Platform.displayPref, displayAt: Platform.displayAt, lookLearned: LocalStore.get(LOOK_KEY) === '1' },
    };
  }

  /** the cloud copy has something this device lacks or vice versa (beyond the progress, which decide() handles) */
  private differs(b: CloudBundle) {
    const me = this.compose(b.progress);
    return JSON.stringify(me.achievements) !== JSON.stringify(b.achievements) || me.prefs.settingsAt !== b.prefs.settingsAt
      || me.prefs.display !== b.prefs.display || me.prefs.lookLearned !== b.prefs.lookLearned;
  }

  /** what every copy shares: deeds and counts merged; the newer settings and display choice taken */
  private adoptShared(b: CloudBundle | null) {
    if (!b) return;
    if (b.achievements) this.o.achievements.merge(b.achievements);
    const p = b.prefs, s = this.o.settings;
    if (p.settingsAt > s.updatedAt) { s.restore(p.settings, p.settingsAt); this.note('settings from the cloud'); }
    if (p.display && p.displayAt > Platform.displayAt && Platform.handheld) Platform.setDisplayPref(p.display, true, p.displayAt);
    if (p.lookLearned) LocalStore.set(LOOK_KEY, '1');
  }

  private async fetchRemote(): Promise<{ ok: true; bundle: CloudBundle | null } | { ok: false }> {
    const ex = await Wave.storage.exists(CLOUD_PATH);
    if (ex === null) return { ok: false };
    if (!ex) return { ok: true, bundle: null };
    if (!await Wave.storage.download(CLOUD_PATH)) return { ok: false };
    const text = await Wave.storage.read(CLOUD_PATH);
    let raw: unknown = null;
    try { raw = text ? JSON.parse(text) : null; } catch { raw = null; }
    const b = validateBundle(raw);
    if (!b && text) {
      // unreadable: keep a copy aside, then treat the cloud as empty (this device's copy will replace it)
      LocalStore.set('caer-veyr:cloud:unreadable', text.slice(0, 200_000));
      this.note('the cloud copy was unreadable — kept aside locally');
    }
    return { ok: true, bundle: b };
  }

  /** tests / debug overlay */
  debug() { return { status: this.status, meta: { ...this.meta }, conflict: !!this.conflict, deferred: this.deferred, dirty: this.dirty, log: [...this.log] }; }
}
