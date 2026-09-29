// Cinematic finisher probes (dev server only). Open http://localhost:5174/?mute&at=barracks&autostart then:
//   const F = await import('/dev/finisherProbe.js'); await F.ready();
//   F.run('stab')                 last E5 Hollow killed by a light blow in open floor → the stab finisher
//   F.run('kick', { at: [x,y,z] }) stage it somewhere else (blueprint coords of the foe)
//   F.all()                        every variant (5) + wall cases + a mid-fight kill (others hold back)
// Checks: played / refused (and why), kill credited exactly once, resonance gained once, encounter cleared once,
// camera never inside geometry and never behind a wall from the pair, hero back in control, camera handed back.
let g, p, V;
export async function ready() {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  if (!g.started) document.getElementById('start-btn')?.click();
  p.godMode = true;
  return { floor: g.floorId, state: g.time.state };
}
const B = (x, y, z) => new V(x, z, -y);
const bl = (v) => [+v.x.toFixed(2), +(-v.z).toFixed(2), +v.y.toFixed(2)];
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(1 / 60); g.input.endFrame(1 / 60); } };

/** Trigger `encId`, release every wave, kill all but one ground enemy; returns that last one. */
function lastStanding(encId) {
  const em = g.enemies, E = em.encounters.get(encId);
  if (E.state !== 'BOTH' && g.time.state !== E.state) g.forceState(E.state);
  E.cleared = false; E.triggered = false; E.wave = 0;
  for (const e of E.enemies) { e.reset(); e.removed = false; }
  em.resetUncleared();
  em.trigger(E);
  E.wave = Math.max(...E.enemies.map((e) => e.wave));
  for (const e of E.enemies) e.activate();
  step(2);
  const ground = E.enemies.filter((e) => !e.isFlying && !e.isRanged);
  const keep = ground[0];
  for (const e of E.enemies) if (e !== keep && e.alive) { e.die(); em.onKill(e); }
  step(1);
  return { E, keep };
}

/**
 * Stage: foe at `at` (blueprint) or where it stands, hero 1.9 m away facing it, foe at 1 HP, force `id`, tap
 * light, then run until the finisher is over. Returns the report.
 */
export function run(id, opts = {}) {
  g.paused = false;
  const encId = opts.enc ?? 'E5';
  const { E, keep: e } = lastStanding(encId);
  if (opts.at) e.pos.copy(B(...opts.at));
  const dir = opts.dir ?? new V(1, 0, 0);
  e.place(e.pos.clone());
  p.revive(e.pos.clone().addScaledVector(dir, -1.9), Math.atan2(dir.x, dir.z));
  g.rig.snapBehind(p.yaw);
  e.hp = 1; e.state = 'idle'; e.stun = 0; e.cooldown = 99;
  e.yaw = Math.atan2(-dir.x, -dir.z);
  g.finisher.force = id; g.finisher.lastAt = -99;
  const kills0 = g.enemies.killCount;
  g.time.charge = 40;
  const charge0 = g.time.charge;
  let killSignals = 0, clears = 0;
  const off1 = g.signals.on('kill', () => { killSignals++; });
  const off2 = g.signals.on('encounter:clear', (d) => { if (d.id === encId) clears++; });
  const logN = g.finisher.log.length;
  g.input.tapVirtual('light');
  let t = 0, played = false, camInside = 0, camBlocked = 0, frames = 0, maxDur = 0;
  const w = g.level.collision, st = g.time.state;
  while (t < 5) {
    step(); t += 1 / 60;
    if (g.finisher.active) {
      played = true; frames++; maxDur = t;
      const c = g.camera.position;
      if (w.overlap(c.clone().setY(c.y - 0.2), 0.12, 0.3, st) > 0.02) camInside++;
      const mid = p.pos.clone().lerp(e.pos, 0.5).setY(p.pos.y + 1.15);
      const d = c.clone().sub(mid); const len = d.length();
      if (g.rig.cineK > 0.95 && w.raycast(mid, d.normalize(), len, st)) camBlocked++;
    } else if (played && t > maxDur + 1.2) break;
  }
  off1(); off2();
  g.finisher.force = null;
  return {
    variant: id, played, log: g.finisher.log.slice(logN).map((l) => l.result),
    foe: e.arch.id, foeAt: bl(e.pos), foeState: e.state, removed: e.removed,
    killCountDelta: g.enemies.killCount - kills0, killSignals, encounterClears: clears, cleared: E.cleared,
    resonanceGain: +(g.time.charge - charge0).toFixed(0), reward: e.arch.reward,
    seconds: +maxDur.toFixed(2), camInsideFrames: camInside, camBlockedFrames: camBlocked,
    heroState: p.state, scripted: p.scripted, cine: !!g.rig.cine, cineK: +g.rig.cineK.toFixed(3), hudCine: g.hud.root.classList.contains('cine'),
  };
}

/**
 * Session 9: a kill in the MIDDLE of a fight may play a finisher too. Forced variant, others alive around her:
 * it plays, the others hold (no enemy attack starts while it runs), kill credited once, the fight goes on.
 */
export function midFight(id = 'headsman') {
  const em = g.enemies, E = em.encounters.get('E5');
  if (g.time.state !== E.state) g.forceState(E.state);
  E.cleared = false; E.triggered = false; E.wave = 0;
  for (const x of E.enemies) { x.reset(); x.removed = false; }
  em.resetUncleared();
  em.trigger(E); step(90);
  const alive = E.enemies.filter((x) => x.alive && x.state !== 'hidden' && x.state !== 'rise');
  const e = alive[0];
  p.revive(e.pos.clone().add(new V(-1.9, 0, 0)), Math.PI / 2);
  e.hp = 1; e.cooldown = 99;
  g.finisher.force = id; g.finisher.lastAt = -99;
  const n = g.finisher.log.length;
  const kills0 = em.killCount;
  let attacksDuring = 0, played = false, frames = 0;
  const others = E.enemies.filter((x) => x !== e);
  const busy = new Map(others.map((x) => [x, x.state]));
  g.input.tapVirtual('light');
  for (let i = 0; i < 300; i++) {
    step();
    if (g.finisher.active) {
      played = true; frames++;
      for (const x of others) { if ((x.state === 'attack' || x.state === 'windup' || x.state === 'dive') && busy.get(x) !== x.state && frames > 3) attacksDuring++; busy.set(x, x.state); }
    } else if (played) break;
  }
  g.finisher.force = null;
  return { played, log: g.finisher.log.slice(n).map((l) => l.result), attacksStartedDuring: attacksDuring, killDelta: em.killCount - kills0,
    othersAlive: others.filter((x) => x.alive).length, encounterCleared: E.cleared, heroInvulnAfter: +p.invuln.toFixed(2) };
}

export function all() {
  const out = {};
  const open = { at: [31, -8, 0], dir: new V(1, 0, 0) };
  out.stab = run('stab', open);
  out.frenzy = run('frenzy', open);
  out.kick = run('kick', open);
  out.headsman = run('headsman', open);
  out.passing = run('passing', open);
  // against the barracks' south wall (y = -27): the foe 1.1 m from it, the hero coming from the north
  const wall = { at: [28, -25.9, 0], dir: new V(0, 0, 1) };
  out.wallKick = run('kick', wall);
  out.wallStab = run('stab', wall);
  out.wallFrenzy = run('frenzy', wall);
  out.wallPassing = run('passing', wall);
  out.wallHeadsman = run('headsman', wall);
  out.midFight = midFight('headsman');
  return out;
}

/** Start finisher `id` on the last E5 Hollow at `at` (blueprint), hero coming along `dir`; pause `secs` in (screenshots). */
export function stage(id, at, dir, secs) {
  g.paused = false;
  if (g.finisher.active) g.finisher.end();
  if (g.time.state !== 'PRESENT') g.forceState('PRESENT');
  const E = g.enemies.encounters.get('E5');
  E.cleared = false; E.triggered = false; E.wave = 0;
  for (const e of E.enemies) { e.reset(); e.removed = false; }
  g.enemies.resetUncleared(); g.enemies.trigger(E);
  E.wave = 2; for (const e of E.enemies) e.activate();
  step(2);
  const keep = E.enemies.find((e) => !e.isFlying);
  for (const e of E.enemies) if (e !== keep && e.alive) { e.die(); g.enemies.onKill(e); }
  step(90);
  keep.place(B(...at)); keep.hp = 1; keep.state = 'idle'; keep.cooldown = 99; keep.yaw = Math.atan2(-dir.x, -dir.z);
  p.revive(keep.pos.clone().addScaledVector(dir, -1.9), Math.atan2(dir.x, dir.z)); g.rig.snapBehind(p.yaw);
  step(20);
  g.finisher.force = id; g.finisher.lastAt = -99;
  g.input.tapVirtual('light');
  let t = 0;
  while (t < secs) { step(); t += 1 / 60; if (!g.finisher.active && t > 0.5) break; }
  g.renderer.render(g.scene, g.camera);
  g.paused = true;
  g.finisher.force = null;
  return `${g.finisher.log.at(-1)?.result} active=${g.finisher.active} cineK=${g.rig.cineK.toFixed(2)}`;
}
export const dirs = () => ({ west: new V(-1, 0, 0), east: new V(1, 0, 0), north: new V(0, 0, -1), south: new V(0, 0, 1) });
