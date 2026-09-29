// Guided-tutorial probe (dev server only). Plays Floor 1's Guided Tutorial end to end with virtual input and reports
// every lesson transition. In the console of http://localhost:5173/?mute&autostart&guide=guided :
//   const T = await import('/dev/tutorialProbe.js'); await T.ready(); await T.run()
// Returns { ok, lessons: [{ id, at }], fail? }. The hero is protected by the tutorial during E1 and in god mode after.
let g;
const DT = 1 / 60;
const tick = () => { g.step(DT); g.input.endFrame(DT); };
const lesson = () => g.tutorial?.lesson ?? null;
const bl = () => { const p = g.player.pos; return [+p.x.toFixed(1), +(-p.z).toFixed(1), +p.y.toFixed(1)]; };

export async function ready() {
  for (let i = 0; i < 160 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game;
  if (!g.started) window.__begin?.();
  if (!g.tutorial) g.setGuidance('guided');
  return true;
}

/** step until cond() (seconds of game-real time); `each` runs before every frame */
async function until(cond, seconds, each) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    each?.(i);
    tick();
    if (cond()) return true;
    if (i % 240 === 239) await new Promise((r) => setTimeout(r, 0));
  }
  return false;
}

function e1() { return g.enemies.encounters.get('E1'); }
function nearestE1() {
  let best = null, bd = 1e9;
  for (const e of e1().enemies) if (e.alive && e.state !== 'hidden') { const d = e.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; best = e; } }
  return best;
}
/** turn the hero (and camera) toward an enemy */
function face(e) {
  if (!e) return;
  const p = g.player;
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
  p.yaw = Math.atan2(dx, dz);
  g.rig.snapBehind(p.yaw);
}

export async function run() {
  const log = [];
  let last = null;
  const note = () => { const l = lesson(); if (l !== last) { log.push({ id: l, t: +g.t.toFixed(1), at: bl() }); last = l; } };
  const expect = async (id, seconds, each, what) => {
    const ok = await until(() => { note(); return lesson() !== id; }, seconds, each);
    if (!ok) throw new Error(`stuck in lesson "${id}" (${what ?? ''}) at ${JSON.stringify(bl())}`);
  };
  const inp = g.input;
  g.stop(); // drive frames only from here (the rAF loop would add unscripted real-time frames)
  try {
    await until(() => { note(); return !!lesson(); }, 2);
    // move
    inp.setVirtual('forward', true);
    await expect('move', 12, null, 'walk 5 m');
    inp.setVirtual('forward', false);
    // look
    await expect('look', 8, () => { inp.virtualLook.dx += 0.03; }, 'turn the camera');
    // the breach → the guardroom: E1 wakes
    g.tp(10, -38.5, 0, 90);
    await expect('breach', 12, null, 'E1 should trigger in the guardroom');
    // light: three blows
    let k = 0;
    await expect('light', 25, () => { if (k++ % 30 === 0) { face(nearestE1()); inp.tapVirtual('light'); } }, 'three light hits');
    const scaleAtLight = g.timeScale;
    // heavy
    k = 0;
    await expect('heavy', 20, () => { if (k++ % 60 === 0) { face(nearestE1()); inp.tapVirtual('heavy'); } }, 'one heavy hit');
    // combo: quick lights
    k = 0;
    await expect('combo', 25, () => { if (k++ % 14 === 0) { face(nearestE1()); inp.tapVirtual('light'); } }, 'a chained blow');
    // guard: hold block facing the attacker
    await expect('guard', 30, () => { face(nearestE1()); inp.setVirtual('block', true); }, 'block one blow');
    inp.setVirtual('block', false);
    // parry: tap block just before the blow
    let tappedAt = -1;
    await expect('parry', 50, (i) => {
      const e = nearestE1(); face(e);
      const s = Math.min(...e1().enemies.filter((x) => x.alive).map((x) => x.strikeIn()));
      if (s < 0.12 && i - tappedAt > 30) { inp.setVirtual('block', true); tappedAt = i; }
      if (tappedAt >= 0 && i - tappedAt === 20) inp.setVirtual('block', false);
    }, 'parry (or 5 tries / 40 s)');
    inp.setVirtual('block', false);
    // dodge (desktop only)
    if (lesson() === 'dodge') {
      inp.setVirtual('forward', true);
      await expect('dodge', 15, (i) => { if (i % 40 === 0) inp.tapVirtual('dodge'); }, 'dodge');
      inp.setVirtual('forward', false);
    }
    // finish them
    k = 0;
    await expect('finish', 40, () => { if (k++ % 16 === 0) { face(nearestE1()); inp.tapVirtual('light'); } }, 'first kill');
    k = 0;
    await until(() => { note(); return e1().cleared; }, 40, () => { if (k++ % 16 === 0) { face(nearestE1()); inp.tapVirtual('light'); } });
    await expect('resonance', 15, null, 'resonance card');
    // the sigil
    const cp1 = g.checkpoints.sigilPos('CP1');
    g.player.teleport(cp1.clone(), g.player.yaw);
    await expect('sigil', 10, (i) => { if (i % 30 === 0) inp.tapVirtual('interact'); }, 'kneel at CP1');
    await expect('memories', 15, null, 'two memories card');
    // the shift at the gate
    g.tp(0, -37.5, 0, 0);
    await expect('shift', 12, () => inp.setVirtual('shift', true), 'hold shift at the gate');
    inp.setVirtual('shift', false);
    g.player.godMode = true;
    await expect('past', 15, null, 'the Past card');
    // the Ward fights are not the tutorial's business: clear them
    for (const id of ['E2', 'E3']) { const enc = g.enemies.encounters.get(id); if (enc) { enc.triggered = true; enc.cleared = true; for (const e of enc.enemies) e.vanish(); } }
    await until(() => { note(); return lesson() !== 'guards'; }, 3);
    // shift back in the east yard
    g.time.charge = 200;
    g.tp(15.5, -13, 0, 90);
    await until(() => { note(); return false; }, 1.5);
    await expect('back', 12, () => inp.setVirtual('shift', true), 'shift back to the Present');
    inp.setVirtual('shift', false);
    // the crawl
    for (const id of ['E4', 'E5']) { const enc = g.enemies.encounters.get(id); if (enc) { enc.triggered = true; enc.cleared = true; for (const e of enc.enemies) e.vanish(); } }
    g.tp(31.2, 0.8, 0, 0);
    await until(() => { note(); return lesson() === 'crouch' && g.player.grounded && g.t > 0; }, 3);
    await until(() => false, 0.4);
    await until(() => g.player.crouching, 3, (i) => { if (i % 20 === 0 && !g.player.crouching) inp.tapVirtual('crouch'); });
    if (!g.player.crouching) throw new Error('could not crouch: state ' + g.player.state);
    inp.setVirtual('forward', true);
    await expect('crouch', 20, null, 'crawl through the gap');
    inp.setVirtual('forward', false);
    await until(() => { note(); return !g.tutorial?.active; }, 12);
    note();
    return { ok: !g.tutorial?.active, scaleAtLight, lessons: log };
  } catch (err) {
    for (const a of ['forward', 'block', 'shift']) inp.setVirtual(a, false);
    return { ok: false, fail: String(err.message ?? err), lessons: log, lesson: lesson(), timeScale: g.timeScale };
  }
}
