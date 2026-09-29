// Session 9 monster probes (dev server only). Open e.g. http://localhost:5174/?mute&at=barracks&autostart&monsters
// (any floor works with &monsters: the four monster rigs are preloaded), then in the console:
//   const M = await import('/dev/monsterProbe.js'); await M.ready();
//   M.spawn('goblin', 4)             spawn a monster 4 m in front of the hero (awake); returns it
//   M.fight('widow', { secs: 20 })   spawn one, let it fight a passive (god-mode) hero: states visited, blows landed,
//                                    distance kept, stalls, web hits, deaths when struck
//   M.duel('lamia', { secs: 30 })    the hero attacks back (scripted light/heavy combo when in reach)
//   M.all()                          every monster archetype: fight + duel summary
//   M.shot('bat', 1.2)               spawn + simulate + pause for a screenshot
let g, p, V;
export async function ready() {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  if (!g.started) document.getElementById('start-btn')?.click();
  p.godMode = true;
  return { floor: g.floorId, state: g.time.state, rigs: [...g.enemies.assets.keys()] };
}
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(1 / 60); g.input.endFrame(1 / 60); } };

export function clear() {
  const em = g.enemies;
  // the probe fights alone: every other Echo of the floor leaves (DEV monsters are removed outright)
  for (const e of em.enemies) if (e.alive) { e.vanish(); }
  em.enemies = em.enemies.filter((e) => e.encounter !== 'DEV' || !e.removed);
  const enc = em.encounters.get('DEV');
  if (enc) { enc.enemies = []; enc.cleared = false; enc.triggered = true; enc.wave = 1; }
  em.batDivers = 0;
  em.slotsUsed.clear();
}

/** spawn `arch` `d` m ahead of the hero (on footing) */
export function spawn(arch, d = 5, opts = {}) {
  // the first clear direction round the hero (no wall between them), d m out
  let f = p.facing.clone();
  const w = g.level.collision, head = p.pos.clone().setY(p.pos.y + 1.2);
  for (let k = 0; k < 16; k++) {
    const a = Math.atan2(p.facing.x, p.facing.z) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.39;
    const dir = new V(Math.sin(a), 0, Math.cos(a));
    if (!w.raycast(head, dir, d + 1, g.time.state)) { f = dir; break; }
  }
  const at = p.pos.clone().addScaledVector(f, d);
  const gy = g.level.collision.groundBelow(at.clone().setY(at.y + 2), 4, g.time.state);
  if (gy !== null) at.y = gy + 0.02;
  return g.enemies.devSpawn(arch, at, opts);
}

/** let `arch` fight a passive hero for `secs`; returns a behaviour report */
export function fight(arch, opts = {}) {
  clear();
  g.paused = false;
  p.godMode = false;   // blows must land (HP is refilled every frame instead)
  const n = opts.n ?? 1;
  const list = [];
  for (let i = 0; i < n; i++) list.push(spawn(arch, (opts.d ?? 6) + i * 0.8, opts));
  const hp0 = p.hp;
  let dmg = 0, hits = 0, webbed = 0, lastHp = p.hp;
  const states = {};
  const secs = opts.secs ?? 15;
  const dist = [];
  let stuck = 0, lastPos = list.map((e) => e.pos.clone());
  let errors = 0;
  for (let i = 0; i < secs * 60; i++) {
    try { step(); } catch (err) { errors++; console.error(err); break; }
    if (p.hp < lastHp) { dmg += lastHp - p.hp; hits++; }
    p.hp = p.maxHp; lastHp = p.hp; if (!p.alive) p.revive(p.pos.clone(), p.yaw);
    if (p.webT > 0 && i % 30 === 0) webbed++;
    for (const e of list) {
      const k = e.state + (e.mode ? ':' + e.mode : '');
      states[k] = (states[k] ?? 0) + 1;
    }
    if (i % 60 === 0) {
      list.forEach((e, j) => { if (e.alive && e.state === 'chase' && e.pos.distanceTo(lastPos[j]) < 0.2) stuck++; lastPos[j] = e.pos.clone(); });
      dist.push(+list[0].pos.distanceTo(p.pos).toFixed(1));
    }
  }
  void hp0;
  return {
    arch, errors, blowsLanded: hits, webbedSamples: webbed,
    states: Object.fromEntries(Object.entries(states).map(([k, v]) => [k, +(v / 60 / n).toFixed(1)])),
    distEverySecond: dist, stuckSeconds: stuck, alive: list.filter((e) => e.alive).length,
    posY: list.map((e) => +e.pos.y.toFixed(2)), heroY: +p.pos.y.toFixed(2),
  };
}

/** the hero fights back: faces the nearest DEV enemy and chains light attacks (heavy every 4th) when in reach */
export function duel(arch, opts = {}) {
  clear();
  g.paused = false;
  p.godMode = false;
  const e = spawn(arch, opts.d ?? 5, opts);
  const secs = opts.secs ?? 30;
  let t = 0, presses = 0, heroHits = 0, lastHp = p.hp;
  const hp0 = e.hp;
  const res = {};
  const origTake = e.takeHit.bind(e);
  e.takeHit = (...a) => { const r = origTake(...a); res[r] = (res[r] ?? 0) + 1; return r; };
  for (let i = 0; i < secs * 60 && e.alive; i++) {
    const to = e.pos.clone().sub(p.pos).setY(0);
    const d = to.length();
    if (d > 0.1) { p.yaw = Math.atan2(to.x, to.z); g.rig.yaw = Math.atan2(-to.x, -to.z); }
    // close in on the stick, strike in reach (heavy every 4th)
    g.input.analog.x = 0; g.input.analog.y = d > 2.2 + e.radius ? 1 : 0;
    if (i % 22 === 0 && d < 3.2 + e.radius) { g.input.tapVirtual(presses % 4 === 3 ? 'heavy' : 'light'); presses++; }
    step(); t += 1 / 60;
    if (p.hp < lastHp) heroHits++;
    p.hp = p.maxHp; lastHp = p.hp;
  }
  g.input.analog.y = 0;
  return { arch, killed: !e.alive, seconds: +t.toFixed(1), hpLeft: Math.max(0, Math.round(e.hp)), hp0, presses, resultCounts: res, heroTookHits: heroHits };
}

export function all() {
  const out = {};
  for (const a of ['goblin', 'bat', 'widow', 'widowling', 'lamia', 'goblin_king', 'widow_mother', 'lamia_maw']) {
    out[a] = { fight: fight(a, { secs: 14, n: a === 'bat' || a === 'widowling' ? 3 : 1 }), duel: duel(a, { secs: a.includes('_') ? 60 : 30 }) };
  }
  clear();
  return out;
}

/** spawn and simulate, then pause (screenshots) */
export function shot(arch, secs = 1.5, opts = {}) {
  clear();
  g.paused = false;
  const e = spawn(arch, opts.d ?? 4.5, opts);
  step(Math.round(secs * 60));
  g.renderer.render(g.scene, g.camera);
  g.paused = true;
  return { state: e.state, mode: e.mode, pos: e.pos.toArray().map((v) => +v.toFixed(2)), hero: p.pos.toArray().map((v) => +v.toFixed(2)) };
}

/**
 * A plain fight bot against whatever is engaged near the hero (a real encounter of the floor): it chases the nearest
 * living enemy of this memory, strikes in reach (light chain, heavy every 4th), guards when a melee foe telegraphs
 * close by. `god` keeps the hero alive (damage is still counted). Reports kills, time, damage taken, finishers.
 */
export function brawl(secs = 60, opts = {}) {
  g.paused = false;
  p.godMode = false;
  const st = () => g.time.state;
  let taken = 0, lastHp = p.hp, presses = 0, deaths = 0;
  const kills0 = g.enemies.killCount, fin0 = g.finisher.log.filter((l) => /played/.test(l.result)).length;
  const bossSeen = new Set();
  let t = 0;
  for (let i = 0; i < secs * 60; i++) {
    const live = [...g.enemies.enemies, ...g.enemies.remnants].filter((e) => e.alive && !e.removed && e.triggered && (e.owner === st() || e.owner === 'BOTH') && e.state !== 'hidden');
    if (!live.length && i > 120) break;
    let tgt = null, bd = 1e9;
    for (const e of live) { const d = e.pos.distanceTo(p.pos) + (e.isFlying ? 3 : 0); if (d < bd) { bd = d; tgt = e; } }
    g.input.analog.x = 0; g.input.analog.y = 0;
    if (tgt && !p.scripted) {
      const to = tgt.pos.clone().sub(p.pos).setY(0), d = to.length();
      if (d > 0.1) g.rig.yaw = Math.atan2(-to.x, -to.z);
      const threat = live.some((e) => e.pos.distanceTo(p.pos) < 3.2 && (e.state === 'attack' || e.state === 'special') && !e.isFlying);
      if (threat && i % 90 < 20) { g.input.press('block', 'bot'); } else g.input.release('block', 'bot');
      if (!threat) g.input.analog.y = d > 2.1 + tgt.radius ? 1 : 0;
      if (i % 20 === 0 && d < 3.2 + tgt.radius) { g.input.tapVirtual(presses % 4 === 3 ? 'heavy' : 'light'); presses++; }
    }
    if (g.enemies.boss?.triggered && g.enemies.boss.alive) bossSeen.add(g.enemies.boss.arch.id);
    step(); t += 1 / 60;
    if (p.hp < lastHp) taken += lastHp - p.hp;
    if (!p.alive) { deaths++; if (opts.god !== false) { p.revive(p.pos.clone(), p.yaw); } }
    if (opts.god !== false) p.hp = p.maxHp;
    lastHp = p.hp;
  }
  g.input.release('block', 'bot');
  g.input.analog.y = 0;
  return { seconds: +t.toFixed(1), kills: g.enemies.killCount - kills0, damageTaken: Math.round(taken), deaths, presses,
    finishers: g.finisher.log.filter((l) => /played/.test(l.result)).length - fin0, bosses: [...bossSeen],
    left: [...g.enemies.enemies].filter((e) => e.alive && e.triggered).map((e) => e.arch.id + '@' + e.state) };
}
