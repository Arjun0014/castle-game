// Last Crown fight bot (dev server). Console on http://localhost:5173/?mute&autostart&floor=3 :
//   const bb = await import('/dev/bossBot.js'); bb.setup(); bb.fight(180, false)
// The bot locks on, walks in (never into a Present hole), chains light attacks and holds Shift whenever a ward or a
// binding is up and it has the charge. It never dodges or guards: a lower bound on a human player.
export function setup() {
  const g = window.__game;
  g.checkpoints.activate(g.level.marker('sigil', 'CP2'));
  g.forceState('PAST');
  g.time.unlocked = true; g.time.charge = Math.max(g.time.charge, 100);
  g.tp(0, 127.5, 32, 0); g.advance(0.3, 1 / 60, false);
}

export function fight(seconds, god = true) {
  const g = window.__game, p = g.player, inp = g.input;
  let b = g.enemies.boss;
  p.godMode = god;
  const ev = [], casts = {};
  let dmgTaken = 0, lastHp = p.hp, t0 = g.t, shiftHold = 0, tap = 0, deaths0 = g.deaths;
  const errs = [];
  const hook = () => { if (b.__hooked) return; const o = b.beginCast.bind(b); b.beginCast = (id, c) => { casts[id] = (casts[id] || 0) + 1; return o(id, c); }; b.__hooked = true; };
  hook();
  let lastPhase = b.phase, lastState = g.time.state, lastMode = b.mode;
  for (let i = 0; i < seconds * 60 && !g.finished; i++) {
    // after a death the hero respawns at CP2: walk back into the Crown (Past doors)
    if (p.alive && p.pos.z > -124.5 && g.time.state === 'PRESENT' && !g.respawning && !p.isChanneling && shiftHold <= 0 && g.time.charge >= 100) { shiftHold = 2.6; inp.setVirtual('shift', true); }
    const d = b.pos.distanceTo(p.pos);
    if (b.alive && !b.untargetable) p.lockTarget = { get pos() { return b.pos; }, get alive() { return b.alive; } };
    const needShift = (b.wardUp || b.bindT >= 0) && g.time.charge >= 100 && !p.isChanneling;
    if (needShift && shiftHold <= 0 && p.state !== 'attack') { shiftHold = 2.6; inp.setVirtual('shift', true); }
    if (shiftHold > 0) { shiftHold -= 1 / 60; inp.analog.x = inp.analog.y = 0; if (shiftHold <= 0) inp.setVirtual('shift', false); }
    else {
      const to = b.pos.clone().sub(p.pos).setY(0).normalize();
      const ahead = p.pos.clone().addScaledVector(to, 1.3);
      const blocked = g.time.state === 'PRESENT' && b.inWedge(ahead);
      inp.analog.y = d > 2.4 && !blocked ? 1 : 0;
      inp.analog.x = blocked ? 1 : 0;
      tap -= 1 / 60;
      if (d < 3.4 && tap <= 0) { inp.tapVirtual('light'); tap = 0.32; }
    }
    try { g.step(1 / 60); inp.endFrame(1 / 60); } catch (e) { errs.push(String(e.stack).slice(0, 400)); break; }
    if (p.hp < lastHp) dmgTaken += lastHp - p.hp;
    lastHp = p.hp;
    if (b.phase !== lastPhase) { ev.push(`${(g.t - t0).toFixed(0)}s phase ${b.phase}`); lastPhase = b.phase; }
    if (g.time.state !== lastState) { ev.push(`${(g.t - t0).toFixed(0)}s ${g.time.state[1]}`); lastState = g.time.state; }
    if (b.mode !== lastMode && (b.mode === 'stagger' && b.staggerT > 2 || b.mode === 'dying')) ev.push(`${(g.t - t0).toFixed(0)}s ${b.mode}`);
    lastMode = b.mode;
  }
  inp.analog.x = inp.analog.y = 0; inp.setVirtual('shift', false);
  return { t: +(g.t - t0).toFixed(0), bossHp: +b.hp.toFixed(0), phase: b.phase, finished: g.finished, dmgTaken: +dmgTaken.toFixed(0), heroHp: +p.hp.toFixed(0), deaths: g.deaths - deaths0, falls: g.falls, shifts: g.time.shiftCount, charge: +g.time.charge.toFixed(0), kills: g.enemies.killCount, casts, ev: ev.join(' '), errs };
}
