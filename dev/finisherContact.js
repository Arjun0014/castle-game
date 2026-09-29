// Session 11: does the blade actually meet the body? (combat/Finishers.ts audit). Dev server only:
//   http://localhost:5173/?at=barracks&autostart&mute&input=kbm&monsters   then in the console:
//   const C = await import('/dev/finisherContact.js'); await C.ready();
//   C.measure('stab', 'guard')     → per frame: the gap between the hero's blade (hilt→tip segment) and the victim's
//                                    skinned mesh (m; ≤ 0.03 = the steel is in the body), the beats with the gap at
//                                    the moment they fired, and the true contacts (local minima of the gap)
//   C.matrix()                     → every variant × guard / hollow / goblin / royal_warden / widow / crown_brute
let g, p, V, M;
/** the open spot every measurement starts from (blueprint x, y, z, yaw°); set with setHome */
let home = null;
export function setHome(h) { home = h; }
export async function ready() {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  if (!g.started) document.getElementById('start-btn')?.click();
  M = await import('/dev/monsterProbe.js'); await M.ready();
  p.godMode = true;
  return { floor: g.floorId, rigs: [...g.enemies.assets.keys()] };
}
const step = () => { g.step(1 / 60); g.input.endFrame(1 / 60); };

/** gap between segment ab and the victim's skinned surface (sampled vertices), and at what height on the body */
function gap(e, a, b, verts) {
  const ab = b.clone().sub(a), L2 = Math.max(1e-6, ab.lengthSq()), q = new V();
  let best = Infinity, at = null;
  for (const v of verts) {
    const t = Math.min(1, Math.max(0, v.clone().sub(a).dot(ab) / L2));
    q.copy(a).addScaledVector(ab, t);
    const d = q.distanceTo(v);
    if (d < best) { best = d; at = v; }
  }
  return { d: best, h: at ? at.y - e.pos.y : 0 };
}

function skinned(e) {
  const meshes = []; e.root.traverse((o) => { if (o.isSkinnedMesh && o.visible) meshes.push(o); });
  const tmp = new V(), out = [];
  e.root.updateMatrixWorld(true);
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 700));
    for (let k = 0; k < pos.count; k += step) out.push(m.getVertexPosition(k, tmp).applyMatrix4(m.matrixWorld).clone());
  }
  return out;
}

export function measure(id, arch = 'guard', opts = {}) {
  if (opts.dir) { /* stage toward a direction */ }
  // every measurement starts from the same open spot (setHome: [x, y, z, yawDeg] blueprint coords)
  if (home) { g.tp(...home); for (let i = 0; i < 3; i++) step(); }
  M.clear();
  const e = M.spawn(arch, 3.2);
  e.tutorialPassive = true;
  for (let i = 0; i < 20; i++) step();
  // face each other, hero 1.9 m out
  const dir = e.pos.clone().sub(p.pos).setY(0).normalize();
  p.teleport(e.pos.clone().addScaledVector(dir, -1.9), Math.atan2(dir.x, dir.z));
  g.rig.snapBehind(p.yaw);
  for (let i = 0; i < 6; i++) step();
  e.hp = 1;
  const F = g.finisher;
  F.force = id; F.always = true; F.lastAt = -99; F.standoffOverride = opts.standoff ?? null;
  const beats = [];
  const ok = F.tryStart(e);
  F.force = null; F.always = false; F.standoffOverride = null;
  if (!ok) return { id, arch, played: false, log: F.log.slice(-3) };
  // wrap the beats so each records the gap at the moment it fires
  for (const b of F.beats) { const fn = b.fn; b.fn = () => { const vs = skinned(e); const gp = gap(e, p.blade.hilt.clone(), p.blade.tip.clone(), vs); beats.push({ at: b.at, t: +F.t.toFixed(3), gap: +gp.d.toFixed(2), h: +gp.h.toFixed(2) }); fn(); }; }
  const series = [];
  while (F.active) {
    step();
    const vs = skinned(e);
    const gp = gap(e, p.blade.hilt.clone(), p.blade.tip.clone(), vs);
    series.push({ t: +F.t.toFixed(3), gap: +gp.d.toFixed(3), h: +gp.h.toFixed(2), heroD: +p.pos.distanceTo(e.pos).toFixed(2), clip: p.anim.overlayId, eclip: e.curName, eState: e.state });
    if (series.length > 400) break;
  }
  // true contacts: local minima of the gap under 0.35 m
  const contacts = [];
  for (let i = 1; i < series.length - 1; i++) {
    const s = series[i];
    if (s.gap < 0.35 && s.gap <= series[i - 1].gap && s.gap <= series[i + 1].gap) contacts.push({ t: s.t, gap: s.gap, h: s.h, clip: s.clip });
  }
  const e2 = { radius: +e.radius.toFixed(2), height: e.height, scale: e.arch.scale };
  return { id, arch, played: true, body: e2, standoff: series[0]?.heroD, beats, contacts, minGap: +Math.min(...series.map((s) => s.gap)).toFixed(3), frames: opts.frames ? series : undefined };
}

export function matrix(ids = ['stab', 'frenzy', 'headsman', 'kick', 'passing'], archs = ['guard', 'hollow', 'goblin', 'royal_warden', 'widow', 'crown_brute']) {
  const out = [];
  for (const a of archs) for (const id of ids) {
    try { const r = measure(id, a); out.push(r.played ? `${a.padEnd(12)} ${id.padEnd(8)} minGap ${r.minGap}  beats ${r.beats.map((b) => `${b.at}:${b.gap}`).join(' ')}  contacts ${r.contacts.map((c) => `${c.t}:${c.gap}@${c.h}`).join(' ')}` : `${a} ${id} NOT PLAYED ${JSON.stringify(r.log)}`); }
    catch (err) { out.push(`${a} ${id} ERROR ${err}`); }
  }
  return out;
}

/**
 * Contact frames of a hero clip: she plays `clip` (from `start`, at `speed`) facing an idle `arch` at `standoff` m;
 * returns the gap profile (director time, gap, height on the body) and its minima — which swing meets the body, when,
 * and how deep. `kneel`: the victim kneels first (crouch_idle), as in the stab / headsman.
 */
export function reach(clip, { arch = 'guard', standoff = 1.1, start = 0, speed = 1, secs = 1.2, kneel = false, side = 0 } = {}) {
  if (home) { g.tp(...home); for (let i = 0; i < 3; i++) step(); }
  M.clear();
  const e = M.spawn(arch, 3.2);
  e.tutorialPassive = true;
  for (let i = 0; i < 20; i++) step();
  const dir = e.pos.clone().sub(p.pos).setY(0).normalize();
  const right = new V(-dir.z, 0, dir.x);
  p.teleport(e.pos.clone().addScaledVector(dir, -standoff).addScaledVector(right, side), Math.atan2(dir.x, dir.z));
  g.rig.snapBehind(p.yaw);
  for (let i = 0; i < 4; i++) step();
  e.state = 'finisher'; e.yaw = Math.atan2(-dir.x, -dir.z);
  if (kneel && e.actions.has('crouch_idle')) e.once('crouch_idle', 1, 0, 0);
  p.beginScripted();
  p.anim.play(clip, { start, speed, fade: 0.05 });
  const out = [];
  for (let t = 0; t < secs; t += 1 / 60) {
    step();
    const gp = gap(e, p.blade.hilt.clone(), p.blade.tip.clone(), skinned(e));
    out.push({ t: +t.toFixed(3), gap: +gp.d.toFixed(3), h: +gp.h.toFixed(2) });
  }
  p.endScripted();
  const minima = out.filter((s, i) => i > 0 && i < out.length - 1 && s.gap < 0.6 && s.gap <= out[i - 1].gap && s.gap <= out[i + 1].gap);
  e.vanish();
  return { clip, standoff, minima: minima.map((m) => `${m.t}:${m.gap}@${m.h}`), min: Math.min(...out.map((s) => s.gap)) };
}
