// Session 8 focused regression suite (dev server only). Run it from a fresh Floor 1 page, portrait touch:
//   http://localhost:5174/?mute&autostart&input=touch   (browser pane at 375×812), then in the console:
//   const R = await import('/dev/regression.js'); await R.run()
// It walks Floor 1 → 2 → 3 with the real in-place transitions and returns one PASS/FAIL row per check:
// enemy stuck cases, T-pose cleanup, no monsters in the Past, the touch layout, both floor rewards + their
// persistence, the 5 s Whirlwind, the three finishers (+ walls / holes / not-last), and the kbm/wide regressions.
import * as EP from './enemyProbe.js';
import * as AP from './abilityProbe.js';
import * as FP from './finisherProbe.js';

let g, p, V;
const rows = [];
const check = (name, ok, detail) => { rows.push({ test: name, result: ok ? 'PASS' : 'FAIL', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); return ok; };
const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(1 / 60); g.input.endFrame(1 / 60); } };
const B = (x, y, z) => new V(x, z, -y);

async function waitFloor(n) {
  for (let i = 0; i < 200 && (g.loading || g.floorId !== n || window.__floorReady !== n); i++) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 900));
}

// ---------------------------------------------------------------- Floor 1
function floor1Enemies() {
  const em = g.enemies;
  // E3: the tent reinforcements must arrive once the yard guards are down (perched archers never block them)
  EP.setup({ state: 'PAST', at: [2, -24, 0] });
  const E3 = em.encounters.get('E3');
  em.trigger(E3); step(30);
  for (const e of E3.enemies.filter((x) => x.wave === 1 && !x.opts.perch)) { e.takeHit(9999, 999, 1, p.pos); em.onKill(e); }
  step(180);
  const tent = E3.enemies.filter((x) => x.wave === 2);
  check('F1 E3 tent reinforcements arrive', E3.wave === 2 && tent.every((e) => e.triggered && e.alive), tent.map((e) => `${e.state}/${e.navMode}`));
  check('F1 E3 tent spawns are not islands', tent.every((e) => em.nav.reachableCount(e.home, 300, e.radius) >= 300), em.spawnFixes.filter((s) => /island/.test(s)));
  // E10: the Royal Warden on the altar dais steps down and fights (it held on the dais forever before)
  EP.setup({ state: 'PAST', at: [-29, 27, 0] });
  const E10 = em.encounters.get('E10');
  em.trigger(E10);
  const w = E10.enemies.find((e) => e.arch.id === 'royal_warden');
  let attacks = 0, prev = '', holdS = 0;
  for (let i = 0; i < 30 * 60; i++) { step(); p.hp = p.maxHp; if (w.state === 'attack' && prev !== 'attack') attacks++; prev = w.state; if (w.navMode === 'hold') holdS += 1 / 60; }
  check('F1 E10 Royal Warden leaves the dais and attacks', attacks >= 2 && holdS < 3, { attacks, holdS: +holdS.toFixed(1) });
  // holding enemies (hero on the armory gallery above them) stand in their combat idle — never run in place
  EP.setup({ state: 'PAST', at: [18.6, 25.8, 6] });
  const E6b = em.encounters.get('E6b');
  em.trigger(E6b);
  let running = 0, held = 0;
  for (let i = 0; i < 12 * 60; i++) {
    step();
    for (const e of E6b.enemies) if (e.alive && e.navMode === 'hold' && e.state === 'chase') { held++; if (/run|strafe|walk/.test(e.curName)) running++; }
  }
  // (a switch into hold shows the old clip for the one frame in which the route is re-planned)
  check('F1 holding enemies idle (no running in place)', held > 0 && running <= held * 0.01, { heldFrames: held, runningFrames: running });
  // the whole floor's stall watch is the god autopilot (see CONTEXT); here: a moving hero round the Ward fight
  const r = EP.scenario({ enc: 'E3', state: 'PAST', at: [2, -26, 0], path: [[2, -26, 0], [-10, -20, 0], [-14, -8, 0], [-4, -4, 0], [10, -6, 0], [12, -20, 0]], seconds: 24 });
  check('F1 E3 no stalls with a moving hero', r.events.length === 0, r.events.slice(0, 3));
}

function floor1TPose() {
  const em = g.enemies;
  EP.setup({ state: 'PAST', at: [0, 25, 0] });
  const E = em.encounters.get('E13');
  em.trigger(E); step(60);
  em.boss.hp = em.boss.arch.hp * 0.3; step(120);
  const present = E.enemies.filter((e) => e.owner === 'PRESENT');
  const visibleWrongMemory = present.filter((e) => e.root.visible).length;
  em.boss.takeHit(99999, 999, 1, p.pos); step(180);
  const leftovers = [...em.enemies, ...em.remnants].filter((e) => e.root.visible && (!e.posed || (e.owner !== g.time.state && e.owner !== 'BOTH')));
  check('T-pose: other-memory risers never drawn', visibleWrongMemory === 0, { visibleWrongMemory });
  check('T-pose: nothing left standing after the Warden falls', leftovers.length === 0 && present.every((e) => e.removed), { leftovers: leftovers.map((e) => e.arch.id), presentRemoved: present.map((e) => e.removed) });
  g.forceState('PRESENT'); step(30);
  check('T-pose: none appear after shifting back', [...em.enemies].filter((e) => e.root.visible && !e.posed).length === 0 && present.every((e) => !e.root.visible), 'ok');
  g.forceState('PAST');
}

function noPastMonsters(floor) {
  const past = g.enemies.enemies.filter((e) => e.owner === 'PAST');
  const monsters = past.filter((e) => e.arch.asset === 'hollow' || e.arch.asset === 'ghost').map((e) => e.arch.id);
  check(`F${floor} no Hollow/monster rigs in the Past`, monsters.length === 0 && g.enemies.pastFixes.length === 0, { pastEnemies: past.length, monsters, pastFixes: g.enemies.pastFixes });
}

function fissureInPast() {
  const em = g.enemies;
  const f = g.level.markersOf('fissure')[0];
  if (!f) return;
  const at = f.pos;
  EP.setup({ state: 'PAST', at: [at.x, -at.z, at.y] });
  for (const k of em.fissureCooldown.keys()) em.fissureCooldown.set(k, 0);
  g.time.charge = 20;
  step(20);
  const rising = em.remnants.map((r) => `${r.arch.id}:${r.arch.asset}:${r.owner}`);
  check('Fissure Echoes in the Past are remembered guards', rising.length > 0 && em.remnants.every((r) => r.arch.asset === 'knight'), rising);
  for (const r of em.remnants) { r.die(); r.removed = true; }
  step(2);
  g.time.charge = 150;
}

function touchLayout() {
  const root = document.getElementById('touch');
  if (!root || getComputedStyle(root).display === 'none') { check('Touch layout (skipped: not in touch mode)', true, 'kbm'); return; }
  const btn = (a) => root.querySelector(`.t-btn[data-a="${a}"]`);
  const R = (el) => el.getBoundingClientRect();
  const stage = root.getBoundingClientRect();
  const want = ['light', 'jump', 'heavy', 'block', 'shift'];
  check('Touch: Attack, Jump, Heavy, Guard, Shift present; no Dodge', want.every((a) => btn(a)) && !btn('dodge'), [...root.querySelectorAll('.t-cluster .t-btn')].map((e) => e.dataset.a));
  const size = Object.fromEntries(want.map((a) => [a, Math.round(R(btn(a)).width)]));
  check('Touch: Attack and Jump most prominent, Shift smallest', size.light > size.heavy && size.jump > size.block && size.shift < Math.min(size.heavy, size.block), size);
  const rects = want.map((a) => R(btn(a)));
  let overlap = 0;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) overlap++; }
  check('Touch: buttons do not overlap', overlap === 0, { overlap });
  // the camera's free region is empty: a grid of points there hits no button (portrait: the lower-right pocket;
  // landscape, session 16: the middle band between the stick's zone and the right thumb's cluster)
  const wide = window.__platform?.view === 'wide';
  const area = wide ? { x0: 0.42, x1: 0.62, y0: 0.3, y1: 0.95 } : { x0: 0.76, x1: 0.97, y0: 0.86, y1: 0.975 };
  let hitsBtn = 0, pts = 0;
  for (let fx = area.x0; fx <= area.x1; fx += 0.035) for (let fy = area.y0; fy <= area.y1; fy += 0.02) {
    pts++;
    const el = document.elementFromPoint(stage.left + stage.width * fx, stage.top + stage.height * fy);
    if (el?.closest('.t-btn')) hitsBtn++;
  }
  check(wide ? 'Touch (landscape): the middle camera band is empty' : 'Touch: lower-right camera pocket is empty', hitsBtn === 0, { points: pts, onButtons: hitsBtn });
  const guard = R(btn('block')), attack = R(btn('light')), heavy = R(btn('heavy'));
  const c = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  if (wide) {
    // the playtest sketch: the LOOK pad in the lower-right corner under the resting right thumb, the verbs in an arc round
    // its upper-left — Attack low on the left, Heavy above it, Guard on top, Jump above the pad, Shift above Jump — every
    // seal clear of the pad and of each other (≥ 6 u of air), Guard within a slide of Heavy
    const pad = R(root.querySelector('.t-look-hint')), jump = R(btn('jump')), shift = R(btn('shift'));
    const [px, py] = c(pad), [ax, ay] = c(attack), [hx, hy] = c(heavy), [gx, gy] = c(guard), [jx, jy] = c(jump), [sx, sy] = c(shift);
    const u = Math.min(stage.width, stage.height) / 400;
    check('Touch (landscape): LOOK pad in the lower-right corner', pad.right > stage.right - stage.width * 0.08 && pad.bottom > stage.bottom - stage.height * 0.12 && pad.width > attack.width * 1.5,
      { pad: [Math.round(pad.left), Math.round(pad.top), Math.round(pad.width)] });
    check('Touch (landscape): the arc (Attack left-low, Heavy above it, Guard on top, Jump over the pad, Shift over Jump)',
      ax < px && ay > py - pad.height * 0.2 && hy < ay && hx < px && gy < hy && gx > hx && jy < py && Math.abs(jx - px) < pad.width * 0.5 && sy < jy && Math.abs(sx - jx) < 12 * u && Math.hypot(gx - hx, gy - hy) < 110 * u,
      { pad: [px, py].map(Math.round), attack: [ax, ay].map(Math.round), heavy: [hx, hy].map(Math.round), guard: [gx, gy].map(Math.round), jump: [jx, jy].map(Math.round), shift: [sx, sy].map(Math.round) });
    const seals = want.map((a) => [a, R(btn(a))]);
    const air = (a, b) => Math.hypot(c(a)[0] - c(b)[0], c(a)[1] - c(b)[1]) - a.width / 2 - b.width / 2;
    let tight = [];
    for (const [a, r] of seals) { if (air(r, pad) < 6 * u) tight.push(a + '~pad'); }
    for (let i = 0; i < seals.length; i++) for (let j = i + 1; j < seals.length; j++) if (air(seals[i][1], seals[j][1]) < 6 * u) tight.push(seals[i][0] + '~' + seals[j][0]);
    check('Touch (landscape): every seal clear of the pad and its neighbours', tight.length === 0, { tight });
    // a swipe that starts on the pad turns the camera (the pad is only a mark: the stage's look role takes it)
    const t = g.touch, lb = g.input.virtualLook;
    if (t) {
      const ev = (type, x, y) => root.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: false }));
      const target = document.elementFromPoint(px, py);
      const x0 = lb.dx;
      ev('pointerdown', px, py); ev('pointermove', px + 30 * u, py); ev('pointermove', px + 60 * u, py - 6 * u); ev('pointerup', px + 60 * u, py - 6 * u);
      t.flushLook(0.2); t.flushLook(0.2);
      check('Touch (landscape): a swipe on the LOOK pad turns the camera', !target?.closest('.t-btn') && lb.dx - x0 > 0.01, { target: target?.className || target?.id, dx: +(lb.dx - x0).toFixed(3) });
    }
  } else {
    check('Touch: right thumb cluster (Attack on the right edge, Guard lower-left of it)', attack.right > stage.right - stage.width * 0.1 && guard.bottom > attack.bottom && guard.left < attack.left, { attack: [Math.round(attack.left), Math.round(attack.top)], guard: [Math.round(guard.left), Math.round(guard.top)] });
  }
}

function finishers() {
  const open = { at: [31, -8, 0], dir: new V(1, 0, 0) };
  for (const id of ['stab', 'frenzy', 'kick', 'headsman', 'passing']) {
    const r = FP.run(id, open);
    check(`Finisher ${id}: plays on the true last enemy`, r.played && r.seconds > 1 && r.seconds < 3.4, { log: r.log, seconds: r.seconds });
    check(`Finisher ${id}: kill + resonance + clear exactly once`, r.killCountDelta === 1 && r.killSignals === 1 && r.encounterClears === 1 && r.resonanceGain === r.reward, { kills: r.killCountDelta, signals: r.killSignals, clears: r.encounterClears, res: r.resonanceGain });
    check(`Finisher ${id}: camera safe, control and camera handed back`, r.camInsideFrames === 0 && r.camBlockedFrames === 0 && !r.scripted && !r.cine && !r.hudCine && r.heroState !== 'interact', { camIn: r.camInsideFrames, camBlocked: r.camBlockedFrames, hero: r.heroState });
  }
  const wall = { at: [28, -25.9, 0], dir: new V(0, 0, 1) };
  const wk = FP.run('kick', wall), ws = FP.run('stab', wall);
  check('Finisher near a wall: kick refused, stab safe', !wk.played && /wall/.test(wk.log.join()) && ws.played && ws.camBlockedFrames === 0 && ws.camInsideFrames === 0, { kick: wk.log, stab: ws.log });
  if (g.time.state !== 'PRESENT') g.forceState('PRESENT');
  const fin = g.finisher, e = g.enemies.encounters.get('E5').enemies[0];
  const reasons = [];
  for (const d of [0.8, 1.6, 2.6]) { e.pos.set(-4 + d, 0, 20); p.pos.set(-4 + d + 1.9, 0, 20); reasons.push(['stab', 'frenzy', 'kick'].map((id) => fin.plan(id, e) ?? 'OK')); }
  check('Finisher near a hole: refused within 1.6 m of the Ward sinkhole, no kick over it', reasons[0].every((r) => /hole/.test(r)) && reasons[1].every((r) => /hole/.test(r)) && reasons[2][2] !== 'OK', reasons);
  const mf = FP.midFight('headsman');
  check('Finisher mid-fight: plays, the others hold back, one kill, the fight goes on', mf.played && mf.attacksStartedDuring === 0 && mf.killDelta === 1 && mf.othersAlive > 0 && !mf.encounterCleared && mf.heroInvulnAfter > 0.2, mf);
}

// ---------------------------------------------------------------- Floors 2 / 3
function crownbreakerTest() {
  const r = AP.crown(1.3);
  check('Crownbreaker: HOLD HEAVY raises, charges and lands', /CROWNBREAKER/.test(r.seq) && r.chargeLevel > 0.5 && r.learned, r);
  const d = Object.values(r.damageByDistance);
  check('Crownbreaker: area damage falls off with distance', d[0] > d[1] && d[1] > d[2] && d[2] > 0, r.damageByDistance);
  const tv = AP.tapVsHold();
  check('Crownbreaker: a tap stays a normal heavy', !/CROWNBREAKER/.test(tv.heavy), tv);
}

function whirlTest() {
  const r = AP.whirl(7);
  check('Whirlwind: HOLD LIGHT spins, capped at ~5 s', /WHIRL_IN/.test(r.seq) && /WHIRL_END/.test(r.seq) && r.whirlSeconds > 4.6 && r.whirlSeconds < 5.4, { seq: r.seq, s: r.whirlSeconds });
  check('Whirlwind: several turns chained without pops', (r.seq.match(/WHIRL_[ACW]/g) ?? []).length >= 4 && r.maxHipYawStepDeg < 25, { turns: (r.seq.match(/WHIRL_[ACW]/g) ?? []).length, maxYawStep: r.maxHipYawStepDeg });
  check('Whirlwind: multiple timed hits on every side, trail on', r.hitsPerDummy.every((h) => h >= 100) && r.trailFrames > 200, { hits: r.hitsPerDummy, trail: r.trailFrames });
  const e = AP.whirl(1.2);
  check('Whirlwind: release ends it early', /WHIRL_END/.test(e.seq) && e.whirlSeconds < 1.6, { seq: e.seq, s: e.whirlSeconds });
  const tv = AP.tapVsHold();
  check('Whirlwind: a tap stays a normal light attack', !/WHIRL/.test(tv.light), tv);
}

function kbmChecks() {
  // desktop keeps its dodge (Shift tap) whatever the touch HUD does
  p.revive(p.pos.clone(), p.yaw);
  step(10);
  g.input.press('forward', 'rk'); step(10);
  g.input.press('sprint', 'rk:s'); step(5); g.input.release('sprint', 'rk:s');
  let dodged = false; for (let i = 0; i < 20; i++) { step(); if (p.state === 'dodge') dodged = true; }
  g.input.release('forward', 'rk');
  check('Desktop: Shift-tap dodge still works', dodged, p.state);
}

export async function run() {
  for (let i = 0; i < 160 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  rows.length = 0;
  await EP.ready();
  g.finisher.chance = 0;
  check('F1 start: no floor rewards yet', p.abilities.size === 0, [...p.abilities]);
  noPastMonsters(1);
  touchLayout();
  floor1Enemies();
  floor1TPose();
  fissureInPast();
  await FP.ready();
  finishers();
  kbmChecks();
  g.learned.crownbreaker = false; g.learned.whirlwind = false;
  // ---- Floor 2 through the real in-place transition
  g.finisher.end();
  window.__transition(2);
  await waitFloor(2);
  await EP.ready();
  g.finisher.chance = 0;
  check('F2: Crownbreaker unlocked, Whirlwind not yet (carried in place)', p.abilities.has('crownbreaker') && !p.abilities.has('whirlwind'), [...p.abilities]);
  step(9.5 * 60);
  check('F2: unlock revealed (HOLD HEAVY) and tip shown until tried', /CROWNBREAKER/.test(document.querySelector('.gift')?.textContent ?? '') && document.querySelector('.gift-tip')?.classList.contains('on') && /HOLD HEAVY/.test(document.querySelector('.gift-tip')?.textContent ?? ''), document.querySelector('.gift-tip')?.textContent);
  noPastMonsters(2);
  g.tp(0, 61.5, 8, 0); step(20);
  await AP.ready();
  g.finisher.chance = 0;
  crownbreakerTest();
  step(10);
  check('F2: tip gone once the move is performed', !document.querySelector('.gift-tip')?.classList.contains('on'), g.learned.crownbreaker);
  // ---- Floor 3
  g.finisher.end();
  window.__transition(3);
  await waitFloor(3);
  await EP.ready();
  g.finisher.chance = 0;
  check('F3: both rewards (persisted + new)', p.abilities.has('crownbreaker') && p.abilities.has('whirlwind') && g.learned.crownbreaker, { abilities: [...p.abilities], learned: g.learned.crownbreaker });
  step(9.5 * 60);
  check('F3: Whirlwind revealed (HOLD LIGHT)', /WHIRLWIND/.test(document.querySelector('.gift')?.textContent ?? '') && /HOLD LIGHT/.test(document.querySelector('.gift-tip')?.textContent ?? ''), document.querySelector('.gift-tip')?.textContent);
  g.tp(-3, 99, g.player.pos.y, 0); step(20);
  await AP.ready();
  g.finisher.chance = 0;
  whirlTest();
  const fails = rows.filter((r) => r.result === 'FAIL').length;
  return { passed: rows.length - fails, failed: fails, rows };
}
