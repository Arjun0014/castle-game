// Endless Arena probe (session 17; dev server only). Open http://localhost:5173/?arena&autostart&mute&wdmock&ach, then:
//   const A = await import('/dev/arenaProbe.js'); await A.run()
// Returns { passed, failed, rows }: waves turn the memory, Echoes rise and clear, an Echo over a Present wedge falls
// when the memory turns (and scores the void), a guardian calls its escort below 55 %, every guardian of the cycle
// arrives with its entrance and its name, the run ends on the results card with the (mock) leaderboard, FIGHT AGAIN
// restarts clean. The hero is in god mode until the last check; real time (≈ 2 minutes).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const check = (test, ok, detail) => { rows.push({ test, result: ok ? 'PASS' : 'FAIL', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); return ok; };
async function until(cond, ms = 15000) { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (cond()) return true; await sleep(150); } return false; }

export async function run() {
  rows.length = 0;
  await until(() => window.__arena && window.__ready, 120000);
  const a = window.__arena, g = window.__game;
  g.player.godMode = true;
  const kills = [];
  const off = g.signals.on('kill', (d) => kills.push(d));
  await until(() => a.phase === 'fight' && a.wave === 1);
  check('wave 1 in the Past, Echoes risen', g.time.state === 'PAST' && a.alive.length > 0, { mem: g.time.state, alive: a.alive.length });
  a.killAll();
  await until(() => a.phase === 'fight' && a.wave === 2, 12000);
  check('wave 2 turns to the Present', g.time.state === 'PRESENT' && a.score > 0, { mem: g.time.state, score: Math.round(a.score) });
  // the void: back to the Past, an Echo on the 45° wedge, the memory turns
  a.killAll();
  await until(() => a.phase === 'fight' && a.wave === 3, 12000);
  const e = a.alive[0];
  const spot = a.ringPoint(45, 9.5);
  e.pos.copy(spot); e.place(spot);
  const before = kills.length;
  g.time.setState('PRESENT', g.player.pos.clone(), true);
  await until(() => !e.alive, 4000);
  const fell = kills.slice(before).find((k) => k.voidDeath);
  check('an Echo over a Present wedge falls when the memory turns', !!fell && a.inWedge(spot), { fell: fell?.arch ?? null });
  g.time.setState('PAST', g.player.pos.clone(), true);
  // the guardians: entrance, name, escort
  const seen = [];
  for (const n of [5, 10, 15, 20, 25, 30]) {
    a.skipTo(n);
    await until(() => a.phase === 'entrance', 4000);
    const titled = await until(() => document.querySelector('.arena-title.on'), 4000);
    const name = document.querySelector('.arena-title h2')?.textContent;
    const fighting = await until(() => a.phase === 'fight' && !g.rig.cine, 9000);
    const boss = g.enemies.boss;
    seen.push(`${n}:${name}`);
    check(`wave ${n}: a guardian's entrance, name and fight`, titled && fighting && !!boss && boss.alive && boss.maxHp > 0, { name, boss: boss?.arch.id, hp: boss?.maxHp });
    if (n === 5) {
      const was = a.alive.length;
      boss.hp = boss.maxHp * 0.5;
      const called = await until(() => a.alive.length > was, 3000);
      check('a guardian below 55 % calls its escort', called, { before: was, after: a.alive.length });
    }
  }
  // the end of a run
  g.player.godMode = false;
  g.player.hp = 1;
  g.player.receiveHit(50, g.player.pos.clone().add({ x: 1, y: 0, z: 0 }), {}, g.t);
  const ended = await until(() => a.phase === 'results' && a.last?.board, 15000);
  check('the run ends on the results card with the leaderboard', ended && !!document.querySelector('.arena-results.on .ar-board li'), { run: a.last?.run, rank: a.last?.rank });
  document.querySelector('.ar-again')?.click();
  const again = await until(() => a.phase === 'fight' && a.wave === 1, 15000);
  check('FIGHT AGAIN starts a clean run', again && a.score === 0 && g.player.hp === g.player.maxHp, { phase: a.phase, wave: a.wave, score: a.score });
  check('no story save written by the arena', !localStorage.getItem('caer-veyr-save:u:mock-player'), localStorage.getItem('caer-veyr-save:u:mock-player') ?? 'none');
  off();
  const failed = rows.filter((r) => r.result === 'FAIL').length;
  return { passed: rows.length - failed, failed, rows, guardians: seen };
}
