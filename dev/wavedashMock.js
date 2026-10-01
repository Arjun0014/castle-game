/**
 * A scripted stand-in for the Wavedash SDK (dev server only: `http://localhost:5173/?wdmock`), so the platform code
 * (src/platform/*) can be exercised without the CLI: identity, the load lifecycle, stats + achievements with the REAL
 * SDK's gating (requestStats resolves before both halves are loaded; until then getStat → 0 and setStat / setAchievement
 * → false), remote storage with a cloud that survives reloads, offline / reconnect, fullscreen.
 *
 * Everything persists in this origin's localStorage under `wdmock:*` (the "cloud" and the "portal"), apart from the
 * game's own keys — so "a new device" = clear the game's keys and reload; "another device saved" = __wdmock.setRemote().
 *
 * URL options: `&wduser=<id>` (default mock-player), `&wdname=<name>`, `&wdslow=<ms>` (stats load delay, default 900),
 * `&wdportal=empty` (no identifiers defined: every write refused), `&wdoffline` (start offline), `&wdfs` (fullscreen
 * requests succeed, as on wavedash.com; default false, as under `wavedash dev`).
 * Console: `__wdmock.offline(true|false)`, `.remote()`, `.setRemote(bundle)`, `.clearRemote()`, `.stats()`, `.reset()`,
 * `.log`, `.calls`.
 */
const P = new URLSearchParams(location.search);
const { WD_ACHIEVEMENTS, WD_STATS } = await import('/src/data/wavedash.ts');
const LS = {
  get(k, d) { try { const v = localStorage.getItem('wdmock:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wdmock:' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem('wdmock:' + k); } catch { /* ignore */ } },
};
const Events = {
  LOBBY_JOINED: 'LobbyJoined', STATS_STORED: 'StatsStored', BACKEND_CONNECTED: 'BackendConnected', BACKEND_DISCONNECTED: 'BackendDisconnected',
  BACKEND_RECONNECTING: 'BackendReconnecting', FULLSCREEN_CHANGED: 'FullscreenChanged',
};
const userId = P.get('wduser') || 'mock-player';
const user = { id: userId, username: P.get('wdname') || 'Wanderer of Veyr', avatarUrl: undefined };
const portalEmpty = P.get('wdportal') === 'empty';
const knownStats = new Set(portalEmpty ? [] : WD_STATS.map((s) => s.id));
const knownAch = new Set(portalEmpty ? [] : Object.values(WD_ACHIEVEMENTS));
const slow = Number(P.get('wdslow') ?? 900);
let offline = P.has('wdoffline');
let initialised = false;
const listeners = new Map();
const queue = [];
const log = [];
const calls = [];
const note = (s) => { log.push(`${(performance.now() / 1000).toFixed(2)} ${s}`); if (log.length > 200) log.shift(); };
const emit = (ev, payload) => {
  if (!initialised) { queue.push([ev, payload]); return; }
  for (const f of listeners.get(ev) ?? []) { try { f(payload); } catch (e) { console.error(e); } }
};
const ok = (data) => ({ success: true, data });
const fail = (message) => ({ success: false, data: null, message });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const net = async (ms = 60) => { await delay(ms); if (offline) throw new Error('network: offline (mock)'); };

// ---- stats (per user, persisted: the "server")
const server = () => LS.get('stats:' + userId, { stats: {}, ach: [] });
const local = { stats: new Map(), ach: new Set(), loaded: { stats: false, ach: false }, dirty: false };
function persist() {
  if (!local.dirty) return true;
  if (offline) { emit(Events.STATS_STORED, { success: false, message: 'Network error while persisting stats (mock)' }); return false; }
  const s = server();
  for (const [k, v] of local.stats) s.stats[k] = v;
  s.ach = [...new Set([...s.ach, ...local.ach])];
  LS.set('stats:' + userId, s);
  local.dirty = false;
  emit(Events.STATS_STORED, { success: true });
  return true;
}
let persistTimer = 0;
const ready = () => local.loaded.stats && local.loaded.ach;

const W = {
  Events,
  AvatarSize: { SMALL: 64, MEDIUM: 128, LARGE: 256 },
  get initialised() { return initialised; },
  init(cfg) {
    calls.push(['init', cfg]);
    if (initialised) return false;
    initialised = true;
    note('init');
    for (const [ev, p] of queue.splice(0)) emit(ev, p);
    // the backend connects shortly after start (unless offline)
    setTimeout(() => { if (!offline) emit(Events.BACKEND_CONNECTED, { isConnected: true, hasEverConnected: true, connectionCount: 1, connectionRetries: 0 }); }, 150);
    return true;
  },
  readyForEvents() {},
  updateLoadProgressZeroToOne(f) { calls.push(['progress', +f.toFixed(3)]); },
  loadComplete() {},
  on(ev, f) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(f); return () => listeners.get(ev).delete(f); },
  off(ev, f) { listeners.get(ev)?.delete(f); },
  getUser() { return { ...user }; },
  getUserId() { return user.id; },
  getUsername(id) { return id && id !== user.id ? null : user.username; },
  getLaunchParams() { return {}; },
  // ---- stats + achievements (the SDK's StatsManager semantics)
  async requestStats() {
    calls.push(['requestStats']);
    try { await net(120); } catch (e) { return fail(String(e.message)); }
    const s = server();
    for (const [k, v] of Object.entries(s.stats)) if (!local.stats.has(k)) local.stats.set(k, v);
    local.loaded.stats = true;
    // the achievements half arrives later (a subscription): the documented gotcha
    setTimeout(() => { for (const a of server().ach) local.ach.add(a); local.loaded.ach = true; note('achievements loaded'); }, slow);
    return ok(true);
  },
  getStat(id) { return ready() && knownStats.has(id) ? (local.stats.get(id) ?? 0) : 0; },
  setStat(id, v, storeNow = false) {
    calls.push(['setStat', id, v]);
    if (!ready() || !knownStats.has(id)) return false;
    if (local.stats.get(id) !== v) { local.stats.set(id, v); local.dirty = true; clearTimeout(persistTimer); persistTimer = setTimeout(persist, 1000); }
    if (storeNow) persist();
    return true;
  },
  getAchievement(id) { return ready() && knownAch.has(id) ? local.ach.has(id) : false; },
  setAchievement(id, storeNow = false) {
    calls.push(['setAchievement', id]);
    if (!ready() || !knownAch.has(id)) return false;
    if (!local.ach.has(id)) { local.ach.add(id); local.dirty = true; clearTimeout(persistTimer); persistTimer = setTimeout(persist, 1000); }
    if (storeNow) persist();
    return true;
  },
  storeStats() { calls.push(['storeStats']); if (!ready()) return false; persist(); return true; },
  // ---- remote storage: the local VFS (IndexedDB in the real SDK) + the cloud (per user)
  async writeLocalFile(path, data) { const v = LS.get('vfs:' + userId, {}); v[path] = Array.from(data); LS.set('vfs:' + userId, v); return true; },
  async readLocalFile(path) { const v = LS.get('vfs:' + userId, {}); return v[path] ? new Uint8Array(v[path]) : null; },
  async uploadRemoteFile(path) {
    calls.push(['uploadRemoteFile', path]);
    try { await net(180); } catch (e) { return fail(String(e.message)); }
    const v = LS.get('vfs:' + userId, {});
    if (!v[path]) return fail('Failed to upload file: ' + path);
    const c = LS.get('cloud:' + userId, {});
    c[path] = { bytes: v[path], lastModified: Math.floor(Date.now() / 1000) };
    LS.set('cloud:' + userId, c);
    note('uploaded ' + path);
    return ok(path);
  },
  async downloadRemoteFile(path) {
    calls.push(['downloadRemoteFile', path]);
    try { await net(120); } catch (e) { return fail(String(e.message)); }
    const c = LS.get('cloud:' + userId, {});
    if (!c[path]) return fail('404 (Not Found)');
    const v = LS.get('vfs:' + userId, {});
    v[path] = c[path].bytes;
    LS.set('vfs:' + userId, v);
    return ok(path);
  },
  async remoteFileExists(path) {
    calls.push(['remoteFileExists', path]);
    try { await net(60); } catch (e) { return fail(String(e.message)); }
    return ok(!!LS.get('cloud:' + userId, {})[path]);
  },
  async listRemoteDirectory(dir) {
    try { await net(60); } catch (e) { return fail(String(e.message)); }
    const c = LS.get('cloud:' + userId, {});
    return ok(Object.keys(c).filter((k) => k.startsWith(dir)).map((k) => ({ exists: true, key: '/' + k, name: k.split('/').pop(), lastModified: c[k].lastModified, size: c[k].bytes.length, etag: '' })));
  },
  async deleteRemoteFile(path) { const c = LS.get('cloud:' + userId, {}); delete c[path]; LS.set('cloud:' + userId, c); return ok(path); },
  // ---- fullscreen (under `wavedash dev` both requests answer false; `&wdfs` behaves like wavedash.com)
  _fs: false,
  isFullscreen() { return W._fs; },
  async requestFullscreen(on) { calls.push(['requestFullscreen', on]); if (!P.has('wdfs')) return false; W._fs = !!on; emit(Events.FULLSCREEN_CHANGED, { isFullscreen: W._fs }); return true; },
  async toggleFullscreen() { return W.requestFullscreen(!W._fs); },
};
window.Wavedash = W;

const text = (bytes) => new TextDecoder().decode(new Uint8Array(bytes));
window.__wdmock = {
  log, calls,
  offline(on) {
    offline = !!on;
    note(on ? 'OFFLINE' : 'online');
    emit(on ? Events.BACKEND_RECONNECTING : Events.BACKEND_CONNECTED, { isConnected: !on, hasEverConnected: true, connectionCount: 2, connectionRetries: on ? 1 : 0 });
  },
  remote(path = 'saves/main.json') { const c = LS.get('cloud:' + userId, {})[path]; return c ? JSON.parse(text(c.bytes)) : null; },
  setRemote(bundle, path = 'saves/main.json') {
    const c = LS.get('cloud:' + userId, {});
    c[path] = { bytes: Array.from(new TextEncoder().encode(JSON.stringify(bundle))), lastModified: Math.floor(Date.now() / 1000) };
    LS.set('cloud:' + userId, c);
  },
  clearRemote() { LS.del('cloud:' + userId); },
  stats() { return { server: server(), local: { stats: Object.fromEntries(local.stats), ach: [...local.ach], loaded: { ...local.loaded } } }; },
  reset() { for (const k of ['stats:', 'cloud:', 'vfs:']) LS.del(k + userId); },
};
console.info('[wdmock] a mock Wavedash SDK stands in (user', userId + (offline ? ', offline' : '') + (portalEmpty ? ', empty portal' : '') + ')');
