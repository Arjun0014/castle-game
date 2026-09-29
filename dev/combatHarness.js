// Combat test harness (dev server only). In the console of http://localhost:5173/?mute&autostart :
//   const h = await import('/dev/combatHarness.js'); await h.install();
//   h.route('name', [[0,'tap','light'], [0.3,'tap','light']], 3)        -> attack sequence, hits, skeleton checks
//   h.matrix()                                                          -> every combo route of CombatData.ts
// A passive dummy (the first guard of the floor, frozen, 99999 HP) is re-placed 1.9 m in front of the hero every
// frame; the hero is in god mode on open ground (Floor 1 Great Hall, blueprint (0, 25, 0)).
let g, p, e, A;

export async function install(spot = [0, 25, 0]) {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player;
  A = (await import('/src/combat/CombatData.ts')).ATTACKS;
  p.godMode = true;
  e = g.enemies.enemies.find((x) => x.arch.id === 'guard' || x.arch.id === 'hollow');
  e.update = function (dt) { this.stun = Math.max(0, this.stun - dt); if (this.state === 'hit' && this.stun <= 0) this.state = 'idle'; this.mixer.update(dt); this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; };
  e.triggered = true; e.state = 'idle'; e.root.visible = true; e.owner = 'BOTH';
  install.spot = spot;
  return { dummy: e.arch.id };
}

export function place(dist = 1.9) {
  const f = p.facing.clone();
  e.pos.copy(p.pos).addScaledVector(f, dist);
  e.hp = 99999; e.poise = 999; e.stun = Math.max(0, e.stun); e.vel.set(0, 0, 0);
  e.yaw = Math.atan2(-f.x, -f.z);
}

function reset(yaw = 0) {
  const [x, y, z] = install.spot; g.tp(x, y, z, yaw); g.advance(0.5, 1 / 60, false); p.revive(p.pos.clone(), p.yaw);
  // the dummy may have been killed by a previous run (void, fall): bring it back
  e.state = 'idle'; e.removed = false; e.root.visible = true; e.deadTime = 0; e.shatterAt = -1;
  for (const m of e.materials) { m.opacity = m.userData.baseOpacity ?? 1; m.transparent = !!m.userData.baseTransparent; }
  place();
}

/** script: [[t, 'tap'|'down'|'up', action]]; opts.dist (dummy distance), opts.setup(e, p) before the run */
export function route(name, script, dur, opts = {}) {
  reset(opts.yaw ?? 0);
  if (opts.free) place(opts.dist);
  opts.setup?.(e, p, g);
  const inp = g.input;
  const out = { seq: [], hits: [], hip: [9, 0], head: [9, -9], speed: 0 };
  let last = null, t = 0;
  const q = script.slice().sort((a, b) => a[0] - b[0]);
  const V = p.pos.constructor, v = new V(), prev = p.pos.clone();
  while (t < dur) {
    while (q.length && q[0][0] <= t) { const [, k, a] = q.shift(); if (k === 'tap') inp.tapVirtual(a); else inp.setVirtual(a, k === 'down'); }
    if (!opts.free) place(opts.dist);
    const hp0 = e.hp;
    g.step(1 / 60); inp.endFrame(1 / 60); t += 1 / 60;
    const id = p.attack?.id ?? p.state;
    if (id !== last) { out.seq.push(`${t.toFixed(2)}:${id}`); last = id; }
    if (e.hp < hp0 - 0.01) out.hits.push(`${t.toFixed(2)}:${p.attack?.id}:${(hp0 - e.hp).toFixed(0)}`);
    p.hipsBone.getWorldScale(v); out.hip[0] = Math.min(out.hip[0], v.x); out.hip[1] = Math.max(out.hip[1], v.x);
    p.headBone.getWorldPosition(v); const hh = v.y - p.pos.y; out.head[0] = Math.min(out.head[0], hh); out.head[1] = Math.max(out.head[1], hh);
    out.speed = Math.max(out.speed, p.pos.distanceTo(prev) * 60); prev.copy(p.pos);
  }
  for (const k of ['hip', 'head']) out[k] = out[k].map((x) => +x.toFixed(k === 'hip' ? 4 : 2));
  out.speed = +out.speed.toFixed(1);
  return `${name}\n  ${out.seq.join(' ')}\n  hits ${out.hits.join(' ') || '-'}\n  hipScale ${out.hip} head ${out.head} maxSpeed ${out.speed}`;
}

const taps = (a, ts) => ts.map((t) => [t, 'tap', a]);

export function matrix() {
  const L = (ts) => taps('light', ts);
  return [
    route('A: L1-L5 loop', L([0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4]), 4.2),
    route('B: L1 .. B2 B3 B4', L([0, 0.8, 1.25, 1.85, 2.5]), 5.2),
    route('L1 L2 .. B3 B4', L([0, 0.3, 1.25, 1.8]), 4.5),
    route('L1 L2 L3 .. B4', L([0, 0.3, 0.6, 1.75]), 4.5),
    route('L1+H F1c', [...L([0]), [0.3, 'tap', 'heavy']], 3.6),
    route('L2+H F1', [...L([0, 0.3]), [0.6, 'tap', 'heavy']], 4.0),
    route('L3+H F3', [...L([0, 0.3, 0.6]), [0.9, 'tap', 'heavy']], 3.6),
    route('L4+H F2', [...L([0, 0.3, 0.6, 0.9]), [1.6, 'tap', 'heavy']], 4.4),
    route('L5+H F4', [...L([0, 0.3, 0.6, 0.9, 1.2]), [2.45, 'tap', 'heavy']], 6.5),
    route('B2+H F2', [...L([0, 0.8]), [1.1, 'tap', 'heavy']], 4.4),
    route('B3+H F5', [...L([0, 0.3, 1.25]), [1.7, 'tap', 'heavy']], 4.6),
    route('H1 H2 H3 (tap)', taps('heavy', [0, 0.5, 1.6]), 6.5),
    route('H1 H2 H3 (hold 1.2s)', [...taps('heavy', [0, 0.5]), [1.6, 'down', 'heavy'], [3.6, 'up', 'heavy']], 7.5, { dist: 2.4 }),
    route('H1 + L -> L3', [[0, 'tap', 'heavy'], [0.75, 'tap', 'light']], 3.2),
    route('sprint + L slide', [[0, 'down', 'forward'], [0, 'down', 'sprint'], [1.0, 'tap', 'light'], [1.05, 'up', 'forward'], [1.05, 'up', 'sprint']], 3.4, { dist: 7, yaw: 180, free: true }),
    route('sprint + H leap', [[0, 'down', 'forward'], [0, 'down', 'sprint'], [1.0, 'tap', 'heavy'], [1.05, 'up', 'forward'], [1.05, 'up', 'sprint']], 3.4, { dist: 7, yaw: 180, free: true }),
    route('fwd dodge -> L', [[0, 'down', 'forward'], [0.02, 'tap', 'dodge'], [0.2, 'up', 'forward'], [0.3, 'tap', 'light']], 2.4, { dist: 4.5, yaw: 180, free: true }),
    route('fwd dodge -> H', [[0, 'down', 'forward'], [0.02, 'tap', 'dodge'], [0.2, 'up', 'forward'], [0.3, 'tap', 'heavy']], 2.6, { dist: 4.5, yaw: 180, free: true }),
    route('attack -> dodge', [[0, 'tap', 'light'], [0.3, 'tap', 'light'], [0.62, 'tap', 'dodge']], 1.6),
    route('air attack', [[0, 'tap', 'jump'], [0.25, 'tap', 'light']], 2.6),
    route('crouch L L', [[0, 'tap', 'crouch'], [0.5, 'tap', 'light'], [1.1, 'tap', 'light'], [2.2, 'tap', 'crouch']], 3.2),
    route('kick kick', taps('kick', [0, 0.6]), 2.8),
    route('guard + L bash', [[0, 'down', 'block'], [0.3, 'tap', 'light'], [0.8, 'up', 'block']], 1.6),
    route('repeat L1 (pause 0.9)', L([0, 0.9, 1.8]), 2.6),
  ].join('\n');
}

/** Parry → riposte: the dummy swings at the hero; guard is pressed just before the blow. */
export function parryTest(followUp = 'light') {
  reset();
  const atk = e.arch.attacks[0];
  const res = [];
  const inp = g.input;
  let t = 0;
  e.update = function () { this.mixer.update(1 / 60); };
  p.godMode = false;
  inp.setVirtual('block', true);
  for (let i = 0; i < 6; i++) { g.step(1 / 60); inp.endFrame(1 / 60); }
  // the blow arrives while the guard is fresh (parry window 0.2 s): pressed 0.1 s ago
  inp.setVirtual('block', false); for (let i = 0; i < 2; i++) { g.step(1 / 60); inp.endFrame(1 / 60); }
  inp.setVirtual('block', true); for (let i = 0; i < 5; i++) { g.step(1 / 60); inp.endFrame(1 / 60); }
  res.push('receive: ' + p.receiveHit(atk.damage, e.pos, {}, inp.now));
  inp.setVirtual('block', false);
  inp.tapVirtual(followUp);
  const hp0 = e.hp;
  for (let i = 0; i < 90; i++) { place(); g.step(1 / 60); inp.endFrame(1 / 60); t += 1 / 60; if (p.attack && !res.includes(p.attack.id)) res.push(p.attack.id); }
  res.push('damage ' + (hp0 - e.hp).toFixed(0) + ' heroHp ' + p.hp.toFixed(0));
  p.godMode = true;
  return res.join(' ');
}

/** Execution: the dummy is reeling (heavy stagger) at 40 % HP. */
export function executeTest() {
  reset();
  e.hp = e.arch.hp * 0.4; e.state = 'hit'; e.stun = 1.0;
  const hp0 = e.hp;
  g.input.tapVirtual('heavy');
  const seq = [];
  for (let i = 0; i < 150; i++) { g.step(1 / 60); g.input.endFrame(1 / 60); if (p.attack && !seq.includes(p.attack.id)) seq.push(p.attack.id); }
  return `execute: ${seq.join(' ')} dummy ${hp0.toFixed(0)} -> ${e.hp.toFixed(0)} (${e.state})`;
}

/** Crouch walk: planted-foot (lowest foot) horizontal speed while crouch-walking = foot sliding (≈0 is right). */
export function crouchSlide(analog = 1, spot = [0, 25, 0, 180]) {
  const inp = g.input, V = p.pos.constructor;
  const feet = {}; p.model.traverse((o) => { if (o.isBone && /mixamorig(Left|Right)Foot$/.test(o.name)) feet[o.name.includes('Left') ? 'L' : 'R'] = o; });
  g.tp(...spot); g.advance(0.4, 1 / 60, false);
  inp.tapVirtual('crouch'); g.advance(0.8, 1 / 60, false);
  const prev = {}, speeds = []; let hips = [9, 0];
  inp.analog.y = analog;
  for (let i = 0; i < 150; i++) {
    g.step(1 / 60); inp.endFrame(1 / 60);
    const L = feet.L.getWorldPosition(new V()), R = feet.R.getWorldPosition(new V());
    if (i > 30 && prev.L) { const k = L.y < R.y ? 'L' : 'R'; const c = k === 'L' ? L : R; speeds.push(Math.hypot(c.x - prev[k].x, c.z - prev[k].z) * 60); }
    prev.L = L; prev.R = R;
    const hy = p.hipsBone.getWorldPosition(new V()).y - p.pos.y; hips = [Math.min(hips[0], hy), Math.max(hips[1], hy)];
  }
  const body = Math.hypot(p.vel.x, p.vel.z);
  inp.analog.y = 0;
  for (let i = 0; i < 90; i++) { g.step(1 / 60); inp.endFrame(1 / 60); }
  const settled = p.hipsBone.getWorldPosition(new V()).y - p.pos.y;
  inp.tapVirtual('crouch'); g.advance(0.6, 1 / 60, false);
  speeds.sort((a, b) => a - b);
  return `crouch stick ${analog}: body ${body.toFixed(2)} m/s, planted foot median ${speeds[speeds.length >> 1].toFixed(2)} p25 ${speeds[speeds.length >> 2].toFixed(2)} m/s, hips ${hips.map((x) => x.toFixed(2))}, settled ${settled.toFixed(2)}, overlay ${p.anim.overlayId}`;
}

/** Touch auto-crouch through a crawl gap: walk from `from` toward `to` (blueprint coords) with the stick. */
export function autoCrouch(from, to, seconds = 6) {
  const inp = g.input;
  inp.autoCrouch = true;
  g.tp(from[0], from[1], from[2], Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI);
  g.advance(0.3, 1 / 60, false);
  const log = []; let last = '';
  inp.analog.y = 1;
  for (let i = 0; i < seconds * 60; i++) {
    g.step(1 / 60); inp.endFrame(1 / 60);
    const s = `${p.crouching ? 'C' : 'S'}:${p.anim.overlayId ?? 'base'}`;
    if (s !== last) { log.push(`${(i / 60).toFixed(2)} ${s} @${g.blenderPos().map((x) => x.toFixed(1))}`); last = s; }
  }
  inp.analog.y = 0;
  return log.join(' | ');
}
