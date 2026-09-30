/**
 * Player settings (main menu / pause menu → Settings), kept in localStorage. Everything is a multiplier on the
 * tuned defaults, so 1 always means "as mixed/tuned". Automated runs (tests, autopilot) never read them.
 *
 *   master / music / sfx / voice   audio buses (music = the ambience beds: wind, fire, water, room tone)
 *   score                           the music (audio/Music.ts: the exploration and combat cues)
 *   subtitles                       the heroine's lines on screen (the opening film keeps its own subtitles)
 *   look                            camera sensitivity (mouse and touch swipes)
 *   shake                           camera shake / punch strength
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
  private listeners: ((s: SettingsData) => void)[] = [];

  constructor(private persist = true) {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SettingsData>;
        for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
          const v = d[k];
          if (typeof v === typeof DEFAULT_SETTINGS[k]) (this.data as unknown as Record<string, unknown>)[k] = v;
        }
      }
    } catch { /* storage unavailable: defaults */ }
  }

  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]) {
    this.data[k] = v;
    this.save();
    for (const f of this.listeners) f(this.data);
  }

  onChange(f: (s: SettingsData) => void) { this.listeners.push(f); f(this.data); }

  reset() {
    this.data = { ...DEFAULT_SETTINGS };
    this.save();
    for (const f of this.listeners) f(this.data);
  }

  private save() {
    if (!this.persist) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }
}
