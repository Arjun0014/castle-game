// Enemy navigation probe (dev server only). In the console of http://localhost:5173/?mute&autostart :
//   const P = await import('/dev/enemyProbe.js'); await P.ready();
//   P.scenario({ enc: 'E3', state: 'PAST', at: [2, -24, 0], seconds: 20 })   -> stuck events per enemy
// The hero is in god mode and never attacks; she stands still (or walks the `path` in blueprint coords).
// An enemy is STUCK when, over a 2 s window, it is chasing (not holding, not attacking, not stunned), it is
// farther than its attack reach, and it has covered < 0.35 m while trying to move.
let g;
const V = () => new g.player.pos.constructor();

export async function ready(god = true) {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game;
  if (!g.started) document.getElementById('start-btn')?.click();
  if (god) g.player.godMode = true;
  return true;
}

const B = (x, y, z) => { const v = V(); v.set(x, z, -y); return v; };
const bl = (v) => [+v.x.toFixed(1), +(-v.z).toFixed(1), +v.y.toFixed(1)];

/** Reset every uncleared encounter and put the hero somewhere (blueprint coords). */
export function setup({ state, at, yaw = 0, clearAll = false }) {
  const em = g.enemies;
  if (clearAll) for (const enc of em.encounters.values()) { enc.cleared = false; }
  em.resetUncleared();
  if (g.time.state !== state) g.forceState(state);
  g.tp(at[0], at[1], at[2], yaw);
  g.player.hp = g.player.maxHp;
  g.advance(0.1, 1 / 60, false);
}

/**
 * Run one encounter scenario. opts: enc, state, at, path (list of blueprint points the hero walks between),
 * seconds, kill (hero auto-kills enemies that reach her: keeps waves coming), trigger (force the encounter).
 */
export function scenario(opts) {
  const { enc, state, at, seconds = 20, path = null, kill = false } = opts;
  setup({ state, at, yaw: opts.yaw ?? 0 });
  const em = g.enemies;
  const E = em.encounters.get(enc);
  if (!E) throw new Error('no encounter ' + enc);
  if (opts.trigger !== false && !E.triggered) em.trigger(E);
  const p = g.player;
  const track = new Map();
  const events = [];
  const dt = 1 / 60;
  let t = 0, pi = 0;
  const walk = path ? path.map((q) => B(...q)) : null;
  while (t < seconds) {
    // scripted hero movement (teleport-walk at 3 m/s: no input involved, collision still resolves)
    if (walk) {
      const goal = walk[pi % walk.length];
      const d = goal.clone().sub(p.pos).setY(0);
      if (d.length() < 0.3) pi++;
      else { d.setLength(Math.min(d.length(), 3 * dt)); p.pos.add(d); }
    }
    g.step(dt); g.input.endFrame(dt); t += dt;
    p.hp = p.maxHp;
    for (const e of E.enemies) {
      if (!e.alive || !e.triggered || e.state === 'hidden' || e.state === 'dormant') continue;
      let tr = track.get(e);
      if (!tr) { tr = { from: e.pos.clone(), t0: t, stuckFor: 0, total: 0, events: 0, lastEv: -9, minD: 99, want: 0, hold: 0, far: 0 }; track.set(e, tr); }
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      tr.minD = Math.min(tr.minD, d);
      if (e.navMode === 'hold') tr.hold += dt;
      if (d > 6 && !e.isRanged) tr.far += dt;
      if (t - tr.t0 >= 2) {
        const moved = Math.hypot(e.pos.x - tr.from.x, e.pos.z - tr.from.z);
        const chasing = (e.state === 'chase' || e.state === 'circle') && e.navMode !== 'hold';
        const reach = e.isRanged ? 99 : e.isFlying ? 4.5 : 3.6;
        if (chasing && d > reach && moved < 0.35 && !e.isRanged) {
          tr.stuckFor += 2; tr.events++;
          events.push({ t: +t.toFixed(1), id: e.id, arch: e.arch.id, at: bl(e.pos), hero: bl(p.pos), dist: +d.toFixed(1), mode: e.navMode, anim: e.curName, dy: +(p.pos.y - e.pos.y).toFixed(2) });
        }
        tr.from.copy(e.pos); tr.t0 = t;
      }
      if (kill && d < 2.2 && e.alive && !e.arch.boss) { e.takeHit(9999, 999, 1, p.pos); em.onKill(e); }
    }
  }
  const summary = [...track.entries()].map(([e, tr]) => ({ id: e.id, arch: e.arch.id, alive: e.alive, state: e.state, mode: e.navMode, at: bl(e.pos), minD: +tr.minD.toFixed(1), stuckS: tr.stuckFor, holdS: +tr.hold.toFixed(1), farS: +tr.far.toFixed(1) }));
  return { enc, events, summary, stuckEnemies: summary.filter((s) => s.stuckS > 0).length };
}

/**
 * Global stall watcher: every triggered, alive walker of the current memory is checked in 2 s windows; returns a
 * log of stalls (wants to move, farther than reach, moved < 0.35 m) and holds. Call stop() to detach.
 */
export function watch() {
  const em = g.enemies, p = g.player;
  const tr = new Map();
  const log = [];
  const orig = em.update.bind(em);
  let t = 0;
  em.update = (dt) => {
    orig(dt);
    t += dt;
    for (const e of [...em.enemies, ...em.remnants]) {
      if (!e.alive || !e.triggered || e.removed || e.isRanged || e.state === 'hidden' || e.state === 'dormant' || e.state === 'rise') { tr.delete(e); continue; }
      if (e.owner !== g.time.state && e.owner !== 'BOTH') { tr.delete(e); continue; }
      let r = tr.get(e);
      if (!r) { r = { from: e.pos.clone(), t0: t, n: 0 }; tr.set(e, r); }
      if (t - r.t0 < 2) continue;
      const moved = Math.hypot(e.pos.x - r.from.x, e.pos.z - r.from.z);
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      const trying = e.state === 'chase' || e.state === 'circle';
      if (trying && d > (e.isFlying ? 4.5 : 3.6) && moved < 0.35) {
        r.n++;
        log.push({ t: +t.toFixed(1), id: e.id, enc: e.encounter, arch: e.arch.id, at: bl(e.pos), hero: bl(p.pos), d: +d.toFixed(1), dy: +(p.pos.y - e.pos.y).toFixed(2), mode: e.navMode, anim: e.curName, n: r.n });
      }
      r.from.copy(e.pos); r.t0 = t;
    }
  };
  return { log, stop: () => { em.update = orig; } };
}

/** A sweep of hero spots around one encounter; returns only the spots where something got stuck. */
export function sweep(enc, state, spots, seconds = 14) {
  const out = [];
  for (const at of spots) {
    const r = scenario({ enc, state, at, seconds });
    if (r.stuckEnemies) out.push({ at, stuck: r.summary.filter((s) => s.stuckS > 0), first: r.events.slice(0, 4) });
  }
  return out;
}
