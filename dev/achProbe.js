// Session 15: achievements (game/Achievements.ts). Dev server:
//   http://localhost:5173/?mute&autostart&ach[&at=warden]   then   const A = await import('/dev/achProbe.js');
//   A.unit()        every trigger through the real signal bus (game.signals), starting from a clean slate; restores
//                   the saved progress afterwards. → [{ case, want, got, pass }]
//   A.state()       unlocked ids + counters + what the toast has shown
// A real kill in play (the toast over a fight): `const S = await import('/dev/s14Probe.js'); await S.ready();
// await S.mini('E13')` on ?at=warden, then A.state().
const g = () => window.__game, ach = () => window.__ach;

export function state() {
  const a = ach();
  return { unlocked: Object.keys(a.data.unlocked), counters: a.data.counters, traces: a.data.traces.length, lore: a.data.lore.length, shown: window.__toast.shown.slice() };
}

export async function unit() {
  const a = ach(), sig = g().signals;
  const saved = JSON.parse(JSON.stringify(a.data));
  const muteToast = a.onUnlock;
  a.onUnlock = () => {};
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = (name, want, extra = true) => out.push({ case: name, want, got: want.map((id) => a.has(id)), pass: want.every((id) => a.has(id)) && extra });
  const fresh = () => a.reset();
  try {
    fresh(); sig.emit('parry', {}); check('first parry', ['parry']);
    for (let i = 0; i < 29; i++) sig.emit('parry', {}); check('30 parries', ['parries'], a.data.counters.parries === 30);
    fresh(); sig.emit('shift', { to: g().time.state, count: 1 }); sig.emit('kill', { arch: 'guard' }); check('shift, kill within 3 s', ['first_shift', 'shift_kill']);
    fresh(); sig.emit('shift', { to: g().time.state, count: 1 }); await wait(3200); sig.emit('kill', { arch: 'guard' }); out.push({ case: 'kill 3.2 s after a shift: no Between Two Breaths', pass: !a.has('shift_kill') });
    fresh(); ['L1', 'L2', 'L3', 'L4', 'L5'].forEach((id, i) => sig.emit('hit', { attack: id, serial: i + 1, index: 0 })); check('L1..L5 landed', ['five_cuts']);
    fresh(); ['L1', 'L2', 'L4', 'L5'].forEach((id, i) => sig.emit('hit', { attack: id, serial: i + 1, index: 0 })); out.push({ case: 'broken chain (no L3): no Five Cuts', pass: !a.has('five_cuts') });
    fresh(); sig.emit('ability', { id: 'crownbreaker', phase: 'release' }); for (let i = 0; i < 3; i++) sig.emit('kill', { arch: 'hollow' }); check('Crownbreaker: 3 kills', ['crownbreaker']);
    fresh(); sig.emit('ability', { id: 'crownbreaker', phase: 'release' }); for (let i = 0; i < 2; i++) sig.emit('kill', { arch: 'hollow' }); out.push({ case: 'Crownbreaker: 2 kills: not yet', pass: !a.has('crownbreaker') });
    fresh(); sig.emit('ability', { id: 'whirlwind', phase: 'start' }); for (let i = 0; i < 4; i++) sig.emit('kill', { arch: 'goblin' }); sig.emit('ability', { id: 'whirlwind', phase: 'end' }); check('Whirlwind: 4 kills', ['whirlwind']);
    fresh(); sig.emit('kill', { arch: 'guard', execution: true, finisher: false }); check('execution', ['execution']);
    fresh(); sig.emit('kill', { arch: 'guard', execution: true, finisher: true }); out.push({ case: 'a finisher is not an execution', pass: !a.has('execution') });
    fresh(); sig.emit('finisher', { id: 'stab' }); check('finisher', ['finisher']);
    for (let i = 0; i < 24; i++) sig.emit('finisher', { id: 'stab' }); check('25 finishers', ['finishers']);
    fresh(); const hp = g().player.hp; sig.emit('boss:start', { id: 'gate_warden' }); a.update(); sig.emit('kill', { arch: 'gate_warden', boss: true }); check('Warden, no wound', ['gate_warden', 'untouched']);
    fresh(); sig.emit('boss:start', { id: 'gate_warden' }); g().player.hp = hp - 10; a.update(); g().player.hp = hp; sig.emit('kill', { arch: 'gate_warden', boss: true });
    out.push({ case: 'Warden after a wound: no Untouched', pass: a.has('gate_warden') && !a.has('untouched') });
    fresh(); for (const k of ['goblin_king', 'widow_mother', 'kingsguard', 'maw']) sig.emit('kill', { arch: k, boss: true }); check('mini-bosses', ['goblin_king', 'widow_mother', 'kingsguard', 'maw']);
    fresh(); sig.emit('boss:dead', { id: 'last_crown' }); check('the Last Crown', ['ending']);
    fresh(); sig.emit('floor:arrive', { id: 2, deaths: 1 }); check('Floor II reached', ['floor1']);
    sig.emit('floor:leave', { id: 2, next: 3, deaths: 1 }); check('Floor II left without dying', ['unremembered']);
    fresh(); sig.emit('floor:arrive', { id: 3, deaths: 2 }); sig.emit('hero:death', { deaths: 3 }); sig.emit('floor:leave', { id: 3, next: null, deaths: 3 });
    check('Floor III reached + the ending by floor:leave', ['floor1', 'floor2', 'ending']); out.push({ case: 'died on the floor: no Unremembered', pass: !a.has('unremembered') });
    fresh(); const f = g().floorId; sig.emit('trace', { tid: 'T3', first: true }); out.push({ case: `trace on floor ${f}`, pass: a.data.traces.length === 1 && (f !== 2 || a.has('queen_letter')) });
    sig.emit('trace', { tid: 'T3', first: false }); out.push({ case: 'the same trace twice counts once', pass: a.data.traces.length === 1 });
    fresh(); for (let i = 0; i < 150; i++) sig.emit('kill', { arch: 'guard' }); check('150 kills', ['released']);
    fresh(); for (let i = 0; i < 40; i++) sig.emit('shift', { to: g().time.state, count: i + 1 }); check('40 shifts', ['shifts']);
    fresh(); for (let n = 1; n <= 12; n++) a.lorePage(n); check('12 chronicle pages', ['chronicle']);
    fresh(); for (let n = 1; n <= 11; n++) a.lorePage(n); a.lorePage(3); out.push({ case: '11 distinct pages: not yet', pass: !a.has('chronicle') && a.data.lore.length === 11 });
  } finally {
    a.data = saved;
    a['save']();
    a.onUnlock = muteToast;
  }
  return { pass: out.filter((r) => r.pass).length, of: out.length, fails: out.filter((r) => !r.pass), rows: out };
}
