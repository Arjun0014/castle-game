/**
 * Local persistence (localStorage), scoped to the player.
 *
 * Outside Wavedash the keys are the ones the jam build always used (an itch.io player's saves carry over). On Wavedash
 * every key gets the signed-in player's id as a suffix, so two accounts sharing one browser never read — or push to
 * their own Wavedash achievements — each other's progress. `scope(id)` is called once at boot (main.ts) before anything
 * reads.
 *
 * Every access is wrapped: private windows, blocked site data and full quotas all play on without saving.
 */
let suffix = '';

export const LocalStore = {
  /** namespace every key under this player id (null = the plain jam-build keys) */
  scope(playerId: string | null) { suffix = playerId ? ':u:' + playerId : ''; },
  key(base: string) { return base + suffix; },
  get(base: string): string | null {
    try { return localStorage.getItem(base + suffix); } catch { return null; }
  },
  set(base: string, value: string): boolean {
    try { localStorage.setItem(base + suffix, value); return true; } catch { return false; }
  },
  remove(base: string) {
    try { localStorage.removeItem(base + suffix); } catch { /* storage unavailable */ }
  },
  getJSON<T>(base: string): T | null {
    const raw = LocalStore.get(base);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  setJSON(base: string, value: unknown) { return LocalStore.set(base, JSON.stringify(value)); },
};

/** a stable random id for this browser (which device wrote a save) — per browser, not per player */
let device = '';
export function deviceId(): string {
  if (device) return device;
  try { device = localStorage.getItem('caer-veyr:device') ?? ''; } catch { /* storage unavailable */ }
  if (!device) {
    device = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    try { localStorage.setItem('caer-veyr:device', device); } catch { /* storage unavailable */ }
  }
  return device;
}
