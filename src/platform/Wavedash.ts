import type { WavedashSDK } from '@wvdsh/sdk-js';

/**
 * Wavedash (https://docs.wavedash.com) — the ONE place the game talks to the platform SDK.
 *
 * On Wavedash (and under `wavedash dev`) the host injects `window.Wavedash` before the game's code runs. The npm package
 * `@wvdsh/sdk-js` is used for its TypeScript types only: its default export throws when the SDK is absent, and the
 * same build must keep running on itch.io / any static host. So the instance is read from `window` once (`attach()`,
 * first thing in main.ts) and every call below is guarded: without the SDK the game is simply a local / guest game.
 *
 * Lifecycle (docs: SDK setup → Load lifecycle): `progress(f)` while the floor loads feeds the Wavedash loading bar;
 * `ready()` calls `Wavedash.init()` exactly once, when the title (or play) can really be shown — that is what reveals
 * the game from behind the host's loader. Connection state comes from BACKEND_CONNECTED / RECONNECTING / DISCONNECTED
 * (there is no public getter) and the browser's own online/offline events; `onConnection` tells CloudSave / the stats
 * sync to try again when it returns.
 *
 * Never logged: the gameplay token / JWT (this module never asks for it) and the user object (only the name is shown).
 */
export type SDK = WavedashSDK;
type SDKUser = ReturnType<WavedashSDK['getUser']>;

export interface Player { id: string; name: string; avatar: string | null }

let sdk: SDK | null = null;
let attached = false;
let initialised = false;
let lastProgress = -1;
let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
const connListeners = new Set<(online: boolean) => void>();
const fsListeners = new Set<(on: boolean) => void>();

/** `force`: a BACKEND_CONNECTED always counts (the game may have believed itself online while the platform was not) */
function setOnline(on: boolean, force = false) {
  if (on === online && !force) return;
  online = on;
  for (const f of connListeners) { try { f(on); } catch (err) { console.warn('[wavedash] connection listener', err); } }
}

export const Wave = {
  /** Read the injected SDK (call once, before anything else asks). Safe without it. */
  attach(): boolean {
    if (attached) return !!sdk;
    attached = true;
    const w = (window as unknown as { Wavedash?: SDK }).Wavedash;
    sdk = w && typeof w.init === 'function' ? w : null;
    if (!sdk) return false;
    try {
      sdk.on(sdk.Events.BACKEND_CONNECTED, () => setOnline(true, true));
      sdk.on(sdk.Events.BACKEND_RECONNECTING, () => setOnline(false));
      sdk.on(sdk.Events.BACKEND_DISCONNECTED, () => setOnline(false));
      sdk.on(sdk.Events.FULLSCREEN_CHANGED, (p) => { for (const f of fsListeners) f(!!p.isFullscreen); });
    } catch (err) { console.warn('[wavedash] could not subscribe to events', err); }
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    return true;
  },

  /** the game is running on Wavedash (or its `wavedash dev` sandbox) */
  get available() { return !!sdk; },
  get sdk() { return sdk; },
  get initialised() { return initialised; },
  /** best knowledge of the backend connection (events + navigator.onLine) */
  get online() { return !!sdk && online; },

  /** Wavedash's loading bar (0..1, never backwards). */
  progress(f: number) {
    if (!sdk || initialised) return;
    const v = Math.max(0, Math.min(1, f));
    if (v < lastProgress + 0.004 && v < 1) return;
    lastProgress = v;
    try { sdk.updateLoadProgressZeroToOne(v); } catch { /* host gone: harmless */ }
  },

  /** `Wavedash.init()` — once, when the game can be shown (reveals it from behind the host's loader). */
  ready() {
    if (!sdk || initialised) return;
    initialised = true;
    try {
      sdk.updateLoadProgressZeroToOne(1);
      sdk.init({ debug: import.meta.env.DEV });
    } catch (err) { console.warn('[wavedash] init failed', err); }
  },

  /** the signed-in player (Wavedash accounts sign in before the game launches; no login screen of our own) */
  player(): Player | null {
    if (!sdk) return null;
    try {
      const u = sdk.getUser() as SDKUser | null;
      if (!u?.id) return null;
      const name = (u.username || sdk.getUsername() || '').trim();
      return { id: String(u.id), name: name || 'Player', avatar: u.avatarUrl || null };
    } catch { return null; }
  },

  onConnection(fn: (online: boolean) => void) { connListeners.add(fn); return () => connListeners.delete(fn); },

  // ------------------------------------------------------------------ fullscreen (the host owns the real target)
  fullscreen: {
    /** Wavedash's own fullscreen API is there (it is, on Wavedash; under `wavedash dev` it always answers false) */
    get supported() { return !!sdk && typeof sdk.requestFullscreen === 'function'; },
    isOn(): boolean {
      try { return sdk ? sdk.isFullscreen() : !!document.fullscreenElement; } catch { return false; }
    },
    /** Must run inside a user gesture to enter. Resolves whether the host accepted. */
    async request(on: boolean): Promise<boolean> {
      if (!sdk) return false;
      try { return await sdk.requestFullscreen(on); } catch { return false; }
    },
    onChange(fn: (on: boolean) => void) { fsListeners.add(fn); return () => fsListeners.delete(fn); },
  },

  // ------------------------------------------------------------------ remote storage (cloud saves)
  storage: {
    async write(path: string, text: string): Promise<boolean> {
      if (!sdk) return false;
      try { return await sdk.writeLocalFile(path, new TextEncoder().encode(text)); } catch { return false; }
    },
    async read(path: string): Promise<string | null> {
      if (!sdk) return null;
      try {
        const bytes = await sdk.readLocalFile(path);
        return bytes ? new TextDecoder().decode(bytes) : null;
      } catch { return null; }
    },
    /** true / false = known; null = could not ask (offline, auth, server) */
    async exists(path: string): Promise<boolean | null> {
      if (!sdk) return null;
      try {
        const r = await sdk.remoteFileExists(path);
        return r.success ? !!r.data : null;
      } catch { return null; }
    },
    async upload(path: string): Promise<boolean> {
      if (!sdk) return false;
      try { return (await sdk.uploadRemoteFile(path)).success; } catch { return false; }
    },
    async download(path: string): Promise<boolean> {
      if (!sdk) return false;
      try { return (await sdk.downloadRemoteFile(path)).success; } catch { return false; }
    },
  },
};
