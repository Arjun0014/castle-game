import { LocalStore } from '../platform/Storage';

/**
 * Player settings (main menu / pause menu → Settings), kept in local storage (per Wavedash player — platform/Storage.ts)
 * and, on Wavedash, carried in the cloud save. Everything is a multiplier on the tuned defaults, so 1 always means "as
 * mixed/tuned". Automated runs (tests, autopilot) never read them.
 *
 *   master / music / sfx / voice   audio buses (music = the ambience beds: wind, fire, water, room tone)
 *   score                           the music (audio/Music.ts: the exploration and combat cues)
 *   subtitles                       the heroine's lines on screen (the opening film keeps its own subtitles)
 *   look                            camera sensitivity (mouse and touch swipes)
 *   shake                           camera shake / punch strength
 *
 * The phone's Portrait / Landscape choice lives with the platform (Platform.displayPref) but shows in the same panel.
 */
export interface SettingsData {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  score: number;
  subtitles: boolean;
  look: number;
  shake: number;
}

const KEY = 'caer-veyr-settings';
export const DEFAULT_SETTINGS: SettingsData = { master: 1, music: 1, sfx: 1, voice: 1, score: 1, subtitles: true, look: 1, shake: 1 };

export class Settings {
  data: SettingsData = { ...DEFAULT_SETTINGS };
  /** when the player last changed anything (ms; 0 = never) — the newer copy wins between devices */
  updatedAt = 0;
  private listeners: ((s: SettingsData) => void)[] = [];

  constructor(private persist = true) {
    if (!persist) return;
    const d = LocalStore.getJSON<Partial<SettingsData> & { _t?: number }>(KEY);
    if (d) { this.assign(d); this.updatedAt = Number(d._t) || 0; }
  }

  private assign(d: Partial<SettingsData>) {
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
      const v = d[k];
      if (typeof v === typeof DEFAULT_SETTINGS[k]) (this.data as unknown as Record<string, unknown>)[k] = v;
    }
  }

  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]) {
    this.data[k] = v;
    this.updatedAt = Date.now();
    this.save();
    for (const f of this.listeners) f(this.data);
  }

  onChange(f: (s: SettingsData) => void) { this.listeners.push(f); f(this.data); }

  reset() {
    this.data = { ...DEFAULT_SETTINGS };
    this.updatedAt = Date.now();
    this.save();
    for (const f of this.listeners) f(this.data);
  }

  /** Settings that came from the cloud save (another device changed them more recently). */
  restore(d: Partial<SettingsData>, updatedAt: number) {
    this.data = { ...DEFAULT_SETTINGS };
    this.assign(d);
    this.updatedAt = updatedAt;
    this.save();
    for (const f of this.listeners) f(this.data);
  }

  private save() {
    if (!this.persist) return;
    LocalStore.setJSON(KEY, { ...this.data, _t: this.updatedAt });
  }
}
