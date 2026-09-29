// Encounter audit (session 10, dev server only): does every enemy of every fight actually fight?
// Console on http://localhost:5173/?mute&autostart[&floor=2|3] :
//   const A = await import('/dev/auditProbe.js'); await A.ready(); const r = await A.floor(); r.problems
// For each encounter (in its own memory) the hero walks a slow loop through the arena in god mode and kills whatever
// reaches her (so waves keep coming). Every enemy's actions are counted (melee blows, arrows loosed, dives, lunges,
// monster specials). Reported problems:
//   never   — woken, alive, in this memory, and never acted in the whole run
//   idle    — acted, but then did nothing for the last `idleS` seconds while alive
//   asleep  — its wave was released but it never woke (triggered stays false)
//   stuck   — a walker that wanted to move and moved < 0.35 m for >= 6 s in 2 s windows
let g;
const DT = 1 / 60;

export async function ready() {
  for (let i = 0; i < 160 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game;
  if (!g.started) window.__begin?.();
  g.stop();
  g.player.godMode = true;
  return true;
}

const bl = (v) => [+v.x.toFixed(1), +(-v.z).toFixed(1), +v.y.toFixed(1)];
const ACT = new Set(['attack', 'shoot', 'dive', 'lunge', 'special']);

/**
 * Walkable loop points where the fight is: near the centroid of the encounter's walkers (their homes) and near a few
 * of them — in this memory's nav grid. Falls back to the trigger box.
 */
function loopPoints(enc) {
  const nav = g.enemies.nav;
  nav.use(g.time.state, g.level.flags);
  const V = g.player.pos.constructor;
  const walkers = enc.enemies.filter((e) => !e.opts.perch && !e.isFlying && (e.owner === g.time.state || e.owner === 'BOTH'));
  const src = walkers.length ? walkers : enc.enemies;
  const c = new V();
  for (const e of src) c.add(e.home);
  c.divideScalar(Math.max(1, src.length));
  const pts = [];
  const add = (q, ring = 8) => { const w = nav.nearestWalkable(q, ring); if (w && Math.abs(w.y - q.y) < 3 && !pts.some((x) => x.distanceTo(w) < 1.5)) pts.push(w.clone()); };
  add(c);
  for (const e of src.slice(0, 4)) add(c.clone().lerp(e.home, 0.6));
  if (!pts.length) { const b = enc.box.getCenter(new V()); b.y = enc.box.min.y + 0.5; add(b, 24); }
  return pts;
}

function resetAll() {
  const em = g.enemies;
  for (const enc of em.encounters.values()) enc.cleared = false;
  for (const e of em.enemies) e.removed = false;
  em.resetUncleared();
}

/** One encounter. opts: seconds, kill (hero kills what reaches her), idleS */
export async function encounter(id, opts = {}) {
  const { seconds = 40, kill = true, idleS = 12 } = opts;
  const em = g.enemies, p = g.player;
  const enc = em.encounters.get(id);
  if (!enc) return { id, error: 'no encounter' };
  resetAll();
  const state = enc.state === 'BOTH' ? 'PRESENT' : enc.state;
  if (g.time.state !== state) g.forceState(state);
  const pts = loopPoints(enc);
  if (!pts.length) return { id, error: 'no walkable point in the arena' };
  p.teleport(pts[0].clone(), p.yaw);
  p.hp = p.maxHp;
  for (let i = 0; i < 6; i++) { g.step(DT); g.input.endFrame(DT); }
  if (!enc.triggered) em.trigger(enc);
  // count arrows per enemy
  const shots = new Map();
  const origShoot = em.shoot;
  em.shoot = function (e) { shots.set(e, (shots.get(e) ?? 0) + 1); return origShoot.call(this, e); };
  const tr = new Map();
  let t = 0, pi = 1, path = null, pathI = 0;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    // the hero walks the loop along the grid (2.2 m/s), pausing a moment at each point
    if (!path || pathI >= path.length) {
      const goal = pts[pi % pts.length]; pi++;
      path = em.nav.path(p.pos, goal);
      if (!path || !path.length) path = [goal];
      pathI = 0;
    }
    const q = path[pathI];
    const d = q.clone().sub(p.pos).setY(0);
    if (d.length() < 0.25) pathI++;
    else p.pos.add(d.setLength(Math.min(d.length(), 2.2 * DT)));
    g.step(DT); g.input.endFrame(DT); t += DT;
    p.hp = p.maxHp;
    for (const e of enc.enemies) {
      let r = tr.get(e);
      if (!r) { r = { acts: 0, last: -1, prev: e.state, woke: -1, from: e.pos.clone(), t0: 0, stuck: 0, minD: 99 }; tr.set(e, r); }
      if (e.triggered && r.woke < 0) r.woke = t;
      if (ACT.has(e.state) && !ACT.has(r.prev)) { r.acts++; r.last = t; }
      r.prev = e.state;
      if (!e.alive) continue;
      const dist = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      r.minD = Math.min(r.minD, dist);
      if (t - r.t0 >= 2) {
        const moved = Math.hypot(e.pos.x - r.from.x, e.pos.z - r.from.z);
        if ((e.state === 'chase' || e.state === 'circle') && e.navMode !== 'hold' && !e.isRanged && !e.isFlying && dist > 3.6 && moved < 0.35) r.stuck += 2;
        r.from.copy(e.pos); r.t0 = t;
      }
      if (kill && dist < 2.2 && r.acts > 0 && !e.arch.boss && e.state !== 'hidden') { e.takeHit(9999, 999, 1, p.pos); em.onKill(e); }
    }
    if (i % 300 === 299) await new Promise((res) => setTimeout(res, 0));
    if (enc.cleared) break;
  }
  em.shoot = origShoot;
  const here = (e) => e.owner === g.time.state || e.owner === 'BOTH';
  const rows = enc.enemies.map((e) => {
    const r = tr.get(e);
    const acts = r.acts + (shots.get(e) ?? 0) * 0; // shots are also 'shoot' state entries
    return { id: e.id, arch: e.arch.id, wave: e.wave, perch: !!e.opts.perch, alive: e.alive, woke: e.triggered, state: e.state, mode: e.navMode,
      acts, shots: shots.get(e) ?? 0, lastAct: r.last < 0 ? null : +r.last.toFixed(1), stuck: r.stuck, minD: +r.minD.toFixed(1), at: bl(e.pos), here: here(e) };
  });
  const problems = [];
  for (const r of rows) {
    if (!r.here) continue;
    const released = r.wave <= enc.wave;
    if (released && !r.woke && r.alive) problems.push({ kind: 'asleep', ...r });
    else if (r.woke && r.alive && r.acts === 0) problems.push({ kind: 'never', ...r });
    else if (r.alive && r.lastAct !== null && t - r.lastAct > idleS) problems.push({ kind: 'idle', idleFor: +(t - r.lastAct).toFixed(1), ...r });
    if (r.stuck >= 6) problems.push({ kind: 'stuck', ...r });
  }
  return { id, state, t: +t.toFixed(1), cleared: enc.cleared, wave: enc.wave, hero: pts.map(bl), rows, problems };
}

/** Every encounter of the loaded floor (bosses included unless skip). */
export async function floor(opts = {}) {
  const out = [];
  const skip = new Set(opts.skip ?? []);
  for (const id of g.enemies.encounters.keys()) {
    if (skip.has(id)) continue;
    const r = await encounter(id, opts);
    out.push(r);
    console.log('[audit]', id, r.error ?? `${r.problems.length} problems, cleared ${r.cleared} at ${r.t}s`);
  }
  return { floor: g.floorId, results: out, problems: out.flatMap((r) => (r.problems ?? []).map((p) => ({ enc: r.id, ...p }))), errors: out.filter((r) => r.error) };
}
