// Session 14 probes (dev server only). Console on http://localhost:5173/?mute&autostart[&at=…|&floor=N]:
//   const S = await import('/dev/s14Probe.js'); await S.ready();
//   S.heals()                  every archetype this floor can build: the health one kill gives back (tier), got once
//   await S.mini('E13')        a mini-boss / elite Warden of an encounter killed by a light blow: its guaranteed finisher
//   S.minis()                  every guaranteed-finisher body on this floor (the first of each kind)
//   S.reinforce('E3')          clear E3, shift away, wait, shift back: a small group rises (the rules logged)
//   S.spam('E3')               rapid shifting: at most one group, cooldowns hold
//   S.crown()                  (?at=lastcrown) the Last Crown's add waves at 80 % / breaks / mid phase 2 / phase 3
//   S.passive()                empty gauge → seconds until a shift is ready again (after a shift, no combat)
let g, p, V;
const DT = 1 / 60;
export async function ready() {
  for (let i = 0; i < 160 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  if (!g.started) window.__begin?.();
  g.stop();
  p.godMode = true;
  return { floor: g.floorId, state: g.time.state };
}
const B = (x, y, z) => new V(x, z, -y);
const bl = (v) => [+v.x.toFixed(1), +(-v.z).toFixed(1), +v.y.toFixed(1)];
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(DT); g.input.endFrame(DT); } };

/** every archetype of the floor: spawn, kill (onKill), health back */
export function heals() {
  const em = g.enemies, out = [];
  const kinds = [...new Set(em.enemies.map((e) => e.arch.id))];
  for (const k of kinds) {
    const e = em.enemies.find((x) => x.arch.id === k);
    p.hp = 40;
    const before = p.hp;
    const n0 = em.healLog.length;
    em.onKill(e);
    out.push({ arch: k, tier: em.healLog[n0]?.heal, got: +(p.hp - before).toFixed(0), logged: em.healLog.length - n0 });
  }
  p.hp = p.maxHp;
  return out.sort((a, b) => a.tier - b.tier);
}

function wake(encId) {
  const em = g.enemies, E = em.encounters.get(encId);
  const st = E.state === 'BOTH' ? g.time.state : E.state;
  if (g.time.state !== st) g.forceState(st);
  E.cleared = false; E.triggered = false; E.wave = 0;
  for (const e of E.enemies) { e.reset(); e.removed = false; }
  em.resetUncleared();
  em.trigger(E);
  E.wave = Math.max(...E.enemies.map((e) => e.wave));
  for (const e of E.enemies) e.activate();
  step(3);
  return E;
}

/** The guaranteed finisher of a mini-boss / elite in `encId` (the first such body, or `arch`). */
export async function mini(encId, arch, opts = {}) {
  g.paused = false;
  const em = g.enemies;
  const E = wake(encId);
  const e = E.enemies.find((x) => (arch ? x.arch.id === arch : true) && ['gate_warden', 'kingsguard', 'goblin_king', 'widow_mother', 'maw', 'royal_warden', 'hollow_warden', 'crown_brute'].includes(x.arch.id));
  if (!e) return { encId, error: 'no mini-boss / elite here' };
  // the others step aside (killed off) so the blow is hers alone; the body stands where it is
  for (const x of E.enemies) if (x !== e && x.alive) { x.die(); em.onKill(x); }
  step(2);
  const dir = e.pos.clone().sub(p.pos).setY(0);
  if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
  dir.normalize();
  p.revive(e.pos.clone().addScaledVector(dir, -(1.6 + e.radius)), Math.atan2(dir.x, dir.z));
  g.rig.snapBehind(p.yaw);
  e.hp = 1; e.stun = 0; e.cooldown = 99; if (e.state !== 'finisher') e.state = 'chase';
  p.hp = 60;
  const hp0 = p.hp, charge0 = g.time.charge, kills0 = em.killCount;
  let kills = 0, clears = 0;
  const off1 = g.signals.on('kill', () => kills++);
  const off2 = g.signals.on('encounter:clear', (d) => { if (d.id === encId) clears++; });
  const n = g.finisher.log.length;
  g.input.tapVirtual('light');
  let played = null, t = 0, dur = 0, camInside = 0;
  const w = g.level.collision, st = g.time.state;
  while (t < 9) {
    step(); t += DT;
    if (g.finisher.active) {
      played = played ?? g.finisher.id; dur = t;
      // a still for the eye: stop mid-finisher and draw it (the finisher resumes on the next S.resume())
      if (opts.stopAt && g.finisher.t >= opts.stopAt) { g.renderer.render(g.scene, g.camera); off1(); off2(); return { still: played, t: +g.finisher.t.toFixed(2) }; }
      const c = g.camera.position;
      if (g.rig.cineK > 0.95 && w.overlap(c.clone().setY(c.y - 0.2), 0.12, 0.3, st) > 0.02) camInside++;
    } else if (played && t > dur + 1.5) break;
    if (!played && t > 1.2 && e.alive && e.state !== 'finisher') { e.hp = 1; g.input.tapVirtual('light'); }
  }
  off1(); off2();
  return {
    enc: encId, arch: e.arch.id, played, seconds: +dur.toFixed(2), log: g.finisher.log.slice(n).map((l) => l.result),
    healed: +(p.hp - hp0).toFixed(0), resonance: +(g.time.charge - charge0).toFixed(0), killSignals: kills, killCountDelta: em.killCount - kills0,
    encounterClears: clears, cleared: E.cleared, foeState: e.state, camInsideFrames: camInside, heroBack: !p.scripted && !g.rig.cine,
  };
}

/** after a still: run on to the end of the finisher */
export function resume(seconds = 3) { for (let i = 0; i < seconds * 60; i++) step(); g.renderer.render(g.scene, g.camera); return { active: g.finisher.active, log: g.finisher.log.slice(-3).map((l) => l.result) }; }

/** every guaranteed-finisher body on this floor */
export async function minis() {
  const out = [];
  const seen = new Set();
  for (const E of g.enemies.encounters.values()) {
    for (const e of E.enemies) {
      if (seen.has(e.arch.id) || !['gate_warden', 'kingsguard', 'goblin_king', 'widow_mother', 'maw', 'royal_warden', 'hollow_warden', 'crown_brute'].includes(e.arch.id)) continue;
      seen.add(e.arch.id);
      out.push(await mini(E.id, e.arch.id));
    }
  }
  return out;
}

/** clear `encId` in its memory, go away for `away` s, come back: what rose */
export function reinforce(encId, opts = {}) {
  const { away = 12, since = 45, force = false } = opts;
  const em = g.enemies, R = em.reinforcements;
  const E = wake(encId);
  const st = E.state === 'BOTH' ? g.time.state : E.state;
  const other = st === 'PAST' ? 'PRESENT' : 'PAST';
  for (const e of E.enemies) if (e.alive) { e.die(); em.onKill(e); }
  step(10);
  // let the bodies fall and fade (fallen() wants finished bodies)
  for (let i = 0; i < 300 && E.enemies.some((e) => !e.removed); i++) step();
  const area = R.areas.find((a) => a.enc === encId && a.state === st);
  if (!area) return { encId, error: 'no area (tutorial / boss / finale?)', areas: R.areas.map((a) => a.id) };
  // she stands in the area
  const nav = em.nav; nav.use(st, g.level.flags);
  const spot = nav.nearestWalkable(area.center, 8) ?? area.center;
  p.revive(spot.clone(), p.yaw);
  area.cleared = true; area.clearedAt = g.t - since;
  g.time.unlocked = true; g.time.charge = 200;
  // away: shift to the other memory (the real commit path), wait, come back
  shiftTo(other);
  for (let i = 0; i < away * 60; i++) step();
  if (force) R.force = true;
  const before = R.log.length;
  shiftTo(st);
  step(5);
  const group = [...em.encounters.values()].filter((x) => x.reinforce && x.id.startsWith('R') && !x.cleared).pop();
  return { area: area.id, kinds: area.kinds, log: R.log.slice(before), group: group ? group.enemies.map((e) => `${e.arch.id} ${e.state} d${e.pos.distanceTo(p.pos).toFixed(1)} vis${e.root.visible ? 1 : 0}`) : null };
}

/** a completed shift through the game's own commit path (no channel wait) */
function shiftTo(st) {
  if (g.time.state === st) return;
  g.time.charge = Math.max(g.time.charge, 100);
  g.time.cooldown = 0;
  const v = g.time.commit(p);
  if (v.ok) g.signals.emit('shift', { to: g.time.state, count: g.time.shiftCount });
  step(2);
  return v.ok;
}

/** rapid shifting in an area: groups risen, reasons */
export function spam(encId, shifts = 12) {
  const r0 = reinforce(encId, { away: 8 });
  const em = g.enemies, R = em.reinforcements, st = g.time.state;
  const other = st === 'PAST' ? 'PRESENT' : 'PAST';
  // kill the group, then flip back and forth every 7 s
  const kill = () => { for (const E of em.encounters.values()) if (E.reinforce) for (const e of E.enemies) if (e.alive) { e.die(); em.onKill(e); } };
  kill(); step(200);
  const n0 = R.log.length;
  let groups = 0;
  const off = g.signals.on('reinforce', () => groups++);
  for (let i = 0; i < shifts; i++) { shiftTo(i % 2 ? st : other); for (let k = 0; k < 7 * 60; k++) step(); kill(); }
  off();
  return { first: r0.group, groupsDuringSpam: groups, reasons: R.log.slice(n0).map((l) => `${l.t} ${l.area}: ${l.result}`) };
}

/** Last Crown: drive her HP through the thresholds (she is triggered); the waves that came */
export function crown(opts = {}) {
  const { seconds = 110 } = opts;
  const em = g.enemies;
  const boss = em.enemies.find((e) => e.arch.id === 'last_crown');
  if (!boss) return { error: 'no Last Crown on this floor' };
  const E = em.encounters.get(boss.encounter);
  // the rest of the floor fell on the way down (their bodies are the adds)
  for (const x of em.enemies) if (x !== boss && x.alive && x.encounter !== boss.encounter) { x.die(); em.onKill(x); const X = em.encounters.get(x.encounter); if (X) X.cleared = true; }
  for (const X of em.encounters.values()) if (X !== E && !X.reinforce) X.cleared = true;
  for (let i = 0; i < 400; i++) step();
  if (!E.triggered) {
    p.revive(boss.pos.clone().add(new V(0, 0, 8)), Math.PI);
    step(3);
    if (!E.triggered) em.trigger(E);
  }
  for (let i = 0; i < 60 * 6 && boss.mode === 'intro'; i++) step();
  const hpAt = [[3, 0.78], [20, 0.62], [48, 0.5], [70, 0.28], [100, 0.2]];
  let k = 0, t = 0, heals = 0, healHp = 0;
  const off = g.signals.on('kill', () => heals++);
  p.hp = 120;
  while (t < seconds) {
    if (k < hpAt.length && t >= hpAt[k][0]) { boss.hp = boss.arch.hp * hpAt[k][1]; boss.takeHit?.(1, 0, 0, p.pos, {}); k++; }
    // the hero cuts down whatever reaches her (her blows, simplified): adds within 2.5 m die after 1.5 s alive
    for (const X of em.encounters.values()) if (X.reinforce && X.id.startsWith('A')) for (const e of X.enemies) {
      if (e.alive && e.state !== 'rise' && e.pos.distanceTo(p.pos) < 3 && (e.stateTime > 1.5)) { const h = p.hp; e.die(); em.onKill(e); healHp += p.hp - h; }
    }
    p.hp = Math.min(p.hp, 120);
    step(); t += DT;
  }
  off();
  return { waves: boss.waveLog, phase: boss.phase, bossHp: Math.round(boss.hp), killsDuring: heals, healedHp: Math.round(healHp),
    alive: [...em.encounters.values()].filter((X) => X.reinforce && X.id.startsWith('A')).map((X) => `${X.id}:${X.enemies.filter((e) => e.alive).length}/${X.enemies.length}`) };
}

/** empty gauge after a shift: seconds of calm until a shift is ready (the real TimeSystem.passive) */
export function passive() {
  const t = g.time;
  t.unlocked = true;
  const out = {};
  for (const [label, afterShift] of [['after a shift', true], ['after combat', false]]) {
    t.charge = 0; t.calm = 0;
    if (afterShift) { t.charge = 100; t.cooldown = 0; t.commit(p); t.charge = 0; } else t.passive(DT, true);
    let s = 0;
    while (t.charge < 100 && s < 200) { t.passive(DT, false); s += DT; }
    out[label] = +s.toFixed(1);
  }
  return out;
}
