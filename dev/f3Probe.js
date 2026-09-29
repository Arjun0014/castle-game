// Floor 3 traversal probe (session 10, dev server only). Every Past/Present weave of the descent, walked with real
// movement input (collision, voids, ramps), in the memory that should pass and in the one that should not.
// Console on http://localhost:5173/?mute&autostart&floor=3&input=kbm :
//   const F = await import('/dev/f3Probe.js'); await F.ready(); F.gates()      -> one row per gate
//   await F.route()                                                             -> spawn -> the arena, shifting at the gates
let g;
const DT = 1 / 60;
const SP = [10, 146];
const pol = (r, deg, z) => [SP[0] + r * Math.cos(deg * Math.PI / 180), SP[1] + r * Math.sin(deg * Math.PI / 180), z];
const rz = (deg) => -16 * Math.max(0, Math.min(1, (deg + 90) / 450));
const ramp = (deg) => pol(9.75, deg, rz(deg));

export const GATES = [
  { id: 'hall chasm', a: [0, 27, 0], b: [0, 43, 0], ok: 'PAST' },
  { id: 'royal grille', a: [0, 48, 0], b: [0, 56, 0], ok: 'PRESENT' },
  { id: 'ossuary bridge P1-P2', a: [-2.5, 76.5, 0], b: [-9, 84.5, 0], ok: 'PAST' },
  { id: 'fallen column P2-P3', a: [-8.5, 86.5, 0], b: [7.5, 86, 0], ok: 'PRESENT' },
  { id: 'cistern south door', a: [10, 98.5, 0], b: [10, 105, 0], ok: 'PRESENT' },
  { id: 'cistern north door', a: [10, 121.5, 0], b: [10, 129.5, 0], ok: 'PAST' },
  { id: 'ramp gap 40-62', a: ramp(25), b: ramp(78), ok: 'PAST' },
  { id: 'iron gate 222', a: ramp(205), b: ramp(240), ok: 'PRESENT' },
  { id: 'crown doors', a: [24, 148, -16], b: [32, 148, -16], ok: 'PRESENT' },
];

export async function ready() {
  for (let i = 0; i < 160 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game;
  if (!g.started) window.__begin?.();
  g.stop();
  g.player.godMode = true;
  for (const enc of g.enemies.encounters.values()) { enc.triggered = true; enc.cleared = true; for (const e of enc.enemies) e.vanish(); }
  return true;
}

const V = () => new g.player.pos.constructor();
const B = (q) => { const v = V(); v.set(q[0], q[2], -q[1]); return v; };
const bl = (v) => [+v.x.toFixed(1), +(-v.z).toFixed(1), +v.y.toFixed(1)];

/** walk (virtual stick) from where she stands toward `to` (blueprint), along the grid route of the current memory
 *  when there is one, straight otherwise; true when she gets within 1 m */
export async function walk(to, seconds = 20) {
  const p = g.player, goal = B(to);
  const nav = g.enemies.nav;
  nav.use(g.time.state, g.level.flags);
  let path = nav.path(p.pos, goal, [], 0.35);
  if (!path || !nav.reached) path = [goal];
  let k = 0;
  const falls0 = g.falls;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    while (k < path.length - 1 && Math.hypot(path[k].x - p.pos.x, path[k].z - p.pos.z) < 0.6) k++;
    const q = path[k];
    const dx = q.x - p.pos.x, dz = q.z - p.pos.z;
    g.rig.yaw = Math.atan2(-dx, -dz);
    g.input.setVirtual('forward', true);
    g.step(DT); g.input.endFrame(DT);
    if (p.pos.distanceTo(goal) < 1.0) { g.input.setVirtual('forward', false); return { ok: true, t: +(i * DT).toFixed(1), falls: g.falls - falls0 }; }
    if (g.falls > falls0) { g.input.setVirtual('forward', false); return { ok: false, fell: true, at: bl(p.pos) }; }
    if (i % 300 === 299) await new Promise((r) => setTimeout(r, 0));
  }
  g.input.setVirtual('forward', false);
  return { ok: false, at: bl(p.pos) };
}

function place(q, state) {
  if (g.time.state !== state) g.forceState(state);
  const p = g.player;
  p.teleport(B(q), p.yaw);
  for (let i = 0; i < 20; i++) { g.step(DT); g.input.endFrame(DT); }
}

/** both memories for every gate: ok = passes in its memory, blocked in the other */
export async function gates() {
  const out = [];
  for (const G of GATES) {
    place(G.a, G.ok);
    const pass = await walk(G.b, 25);
    const other = G.ok === 'PAST' ? 'PRESENT' : 'PAST';
    place(G.a, other);
    const block = await walk(G.b, 12);
    out.push({ gate: G.id, [G.ok]: pass.ok ? `passes (${pass.t}s)` : `BLOCKED at ${pass.at}`, [other]: block.ok ? 'PASSES (should not)' : block.fell ? 'falls (void)' : `blocked at ${block.at}`, ok: pass.ok && !block.ok });
  }
  return out;
}

/** can she shift here (the channel's destination validation)? */
function canShift() {
  g.time.charge = 200; g.time.cooldown = 0;
  const c = g.time.canBegin(g.player);
  return c.ok ? true : c.reason;
}

/** The whole descent: spawn → the arena, shifting where the floor asks for it (each shift must be allowed). */
export async function route() {
  const legs = [
    ['PRESENT', [0, 12, 0]], ['PRESENT', [0, 27, 0]], ['shift'], ['PAST', [0, 46, 0]], ['shift'], ['PRESENT', [0, 60, 0]],
    ['PRESENT', [0, 70, 0]], ['PRESENT', [-2.2, 76.8, 0]], ['shift'], ['PAST', [-10, 85, 0]], ['shift'], ['PRESENT', [10, 86.5, 0]],
    ['PRESENT', [10, 99, 0]], ['PRESENT', [10, 104, 0]], ['PRESENT', [3.5, 109, 0]], ['PRESENT', [3.5, 117, 0]], ['PRESENT', [10, 121.5, 0]], ['shift'], ['PAST', [10, 130, 0]],
    ['PAST', ramp(-60)], ['PAST', ramp(10)], ['PAST', ramp(90)], ['PAST', ramp(180)], ['PAST', ramp(210)], ['shift'],
    ['PRESENT', ramp(270)], ['PRESENT', ramp(359)], ['PRESENT', [24, 148, -16]], ['PRESENT', [34, 148, -16]], ['PRESENT', [46, 148, -16]],
  ];
  place([0, -0.4, 0.05], 'PRESENT');
  const log = [];
  for (const L of legs) {
    if (L[0] === 'shift') {
      const c = canShift();
      if (c !== true) { log.push(`shift DENIED at ${bl(g.player.pos)}: ${c}`); return { ok: false, log }; }
      g.forceState(g.time.state === 'PAST' ? 'PRESENT' : 'PAST');
      for (let i = 0; i < 10; i++) { g.step(DT); g.input.endFrame(DT); }
      log.push(`shift -> ${g.time.state} at ${bl(g.player.pos)}`);
      continue;
    }
    if (g.time.state !== L[0]) { log.push(`wrong memory for leg ${L[1]}`); return { ok: false, log }; }
    const r = await walk(L[1], 30);
    log.push(`${L[0]} -> ${L[1].map((v) => +v.toFixed(1))}: ${r.ok ? 'ok ' + r.t + 's' : 'FAILED ' + JSON.stringify(r)}`);
    if (!r.ok) return { ok: false, log };
  }
  return { ok: true, log };
}
