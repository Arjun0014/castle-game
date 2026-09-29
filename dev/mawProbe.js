// Session 11: the Maw of the Crownheart (enemies/Maw.ts) under test. Dev server only:
//   http://localhost:5173/?at=maw&autostart&mute&input=kbm   then in the console:
//   const P = await import('/dev/mawProbe.js'); await P.ready();
//   P.run({ secs: 30, hero: 'kite' | 'stand' | 'fight', god: true })   → the moves it made (with the clip time of each
//                                         blow), the hits on her by attack, waves, leaps (distance / landing), stuns
//   P.parry()                             → times a guard to the hook's contact: does a parried hook stun it?
//   P.until(ms)                           → continue a detached run in slices (browser-pane calls time out at 45 s)
let g, p, V, maw;
export async function ready() {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player; V = p.pos.constructor;
  if (!g.started) document.getElementById('start-btn')?.click();
  maw = g.enemies.enemies.find((e) => e.arch.id === 'maw');
  return { floor: g.floorId, maw: !!maw, hp: maw?.hp, pos: maw && [+maw.pos.x.toFixed(1), +(-maw.pos.z).toFixed(1)] };
}
const step = () => { g.step(1 / 60); g.input.endFrame(1 / 60); };

/** the ring round the font: centre (10, 113) Blender = (10, -113) three; walkable radius ~6..11 */
const C = () => new V(10, 0, -113);

let log = null;
export function start(opts = {}) {
  p.godMode = opts.god !== false;
  p.hp = p.maxHp;
  g.paused = false;
  log = { t: 0, opts, modes: {}, seq: [], hits: {}, dmg: 0, leaps: [], waves: 0, stuns: 0, staggers: 0, lastMode: '', hpStart: maw.hp, heroDeaths: 0, jumps: 0, attacks: 0 };
  const orig = g.enemies.onAttackHitHook;
  // count every blow that reaches her (the manager resolves it; we wrap the ctx callback through receiveHit)
  if (!p.__probeWrapped) {
    const rh = p.receiveHit.bind(p);
    p.receiveHit = (dmg, from, o, now) => {
      const r = rh(dmg, from, o, now);
      if (log) { const k = maw.mode + (o?.unblockable ? '*' : ''); log.hits[k] = (log.hits[k] ?? 0) + 1; if (r === 'hit') log.dmg += dmg; }
      return r;
    };
    p.__probeWrapped = true;
  }
  void orig;
  return log;
}

function heroAct(dt) {
  const mode = log.opts.hero ?? 'kite';
  const c = C();
  const toM = maw.pos.clone().sub(p.pos).setY(0);
  const d = toM.length();
  const yawToMaw = Math.atan2(toM.x, toM.z);
  g.input.analog.x = 0; g.input.analog.y = 0;
  if (mode === 'stand') return;
  if (mode === 'kite') {
    // circle the font at ~8.5 m from its centre
    const rel = p.pos.clone().sub(c).setY(0);
    const a = Math.atan2(rel.z, rel.x) + 0.6;
    const want = c.clone().add(new V(Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5));
    const dir = want.sub(p.pos).setY(0).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    g.rig.snapBehind(yaw); g.input.analog.y = 1;
    return;
  }
  // fight: close in, strike; jump when a wave is near or the ring is armed; back off in its leap
  g.rig.snapBehind(yawToMaw);
  const waves = maw.waves ?? [];
  const waveNear = waves.some((w) => { const r = w.t * 8; const dd = Math.hypot(p.pos.x - w.at.x, p.pos.z - w.at.z); return dd - r > 0 && dd - r < 1.6; });
  if (waveNear && p.grounded) { g.input.press('jump', 'virtual'); log.jumps++; return; }
  if (d > 3.2) { g.input.analog.y = 1; return; }
  if (p.state === 'move' || p.state === 'land') {
    if (Math.random() < 0.08) { const k = Math.random() < 0.75 ? 'light' : 'heavy'; g.input.press(k, 'virtual'); log.attacks++; }
  }
}

export function tick(n) {
  for (let i = 0; i < n; i++) {
    if (!maw.alive) break;
    heroAct(1 / 60);
    step();
    g.input.release('jump', 'virtual'); g.input.release('light', 'virtual'); g.input.release('heavy', 'virtual');
    log.t += 1 / 60;
    if (!p.alive) { log.heroDeaths++; p.revive?.(p.pos, p.yaw); }
    const m = maw.state === 'special' ? maw.mode : maw.state + (maw.curName ? ':' + maw.curName : '');
    if (m !== log.lastMode) {
      log.lastMode = m;
      log.modes[m] = (log.modes[m] ?? 0) + 1;
      if (log.seq.length < 400) log.seq.push(`${log.t.toFixed(1)} ${m}`);
      if (m === 'leap') log.leaps.push({ t: +log.t.toFixed(1), from: maw.pos.clone(), dist: +maw.pos.distanceTo(maw.to).toFixed(1) });
      if (m === 'stun') log.stuns++;
      if (m === 'stagger') log.staggers++;
    }
    if (maw.waves?.length && maw.waves.some((w) => w.t < 1 / 59)) log.waves++;
  }
}

/** run `secs` of fight (in one call: keep secs ≤ ~25 per call in the browser pane) */
export function run(opts = {}) {
  start(opts);
  tick(Math.round((opts.secs ?? 20) * 60));
  return report();
}
export function more(secs) { tick(Math.round(secs * 60)); return report(); }
export function report() {
  const leaps = log.leaps.map((l) => ({ t: l.t, dist: l.dist }));
  return { t: +log.t.toFixed(1), mawHp: +maw.hp.toFixed(0), hpLost: +(log.hpStart - maw.hp).toFixed(0), alive: maw.alive, phase: maw.phase, enraged: maw.enraged,
    modes: log.modes, hitsOnHero: log.hits, heroDamage: log.dmg, leaps, waves: log.waves, stuns: log.stuns, staggers: log.staggers, jumps: log.jumps, heroAttacks: log.attacks, seq: log.seq.slice(-40) };
}

/** a guard timed to the hook's contact: the parry must stun the Maw */
export function parry() {
  start({ hero: 'stand' });
  // put her in front of it, in hook reach
  const f = maw.facing; const at = maw.pos.clone().addScaledVector(f, 2.2);
  p.teleport(at, Math.atan2(-f.x, -f.z)); g.rig.snapBehind(p.yaw);
  maw.cooldown = 0; maw.combo = [];
  maw.begin('punch');
  let res = null;
  for (let i = 0; i < 120; i++) {
    const t = maw.cur?.time ?? 0;
    // press guard just before the contact (the parry window is the first moments of the guard)
    if (maw.mode === 'punch' && t > 0.16 && !g.input.isDown('block')) g.input.press('block', 'virtual');
    step();
    if (maw.mode === 'stun') { res = 'stun'; break; }
  }
  g.input.release('block', 'virtual');
  return { result: res, mode: maw.mode, hits: log.hits };
}
