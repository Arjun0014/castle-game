// Floor-reward + finisher probes (dev server only). In the console of http://localhost:5174/?mute&floor=3&autostart :
//   const A = await import('/dev/abilityProbe.js'); await A.ready();
//   A.whirl(6)          hold light for 6 s among 3 dummies: segment chain, hits per dummy, hip-yaw continuity, 5 s cap
//   A.whirl(1.2)        release early → WHIRL_END
//   A.crown(1.0)        hold heavy: Crownbreaker charge level, hits and damage fall-off by distance
//   A.tapVsHold()       a tap must stay a plain L1 / H1 (no hold move)
let g, p, THREE_V;

export async function ready() {
  for (let i = 0; i < 120 && !window.__ready; i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player;
  if (!g.started) document.getElementById('start-btn')?.click();
  THREE_V = p.pos.constructor;
  p.godMode = true;
  g.finisher.chance = 0; // no finishers in these probes
  return { floor: g.floorId, abilities: [...p.abilities] };
}

const step = (n = 1) => { for (let i = 0; i < n; i++) { g.step(1 / 60); g.input.endFrame(1 / 60); } };

/** dummies: living enemies of the floor, frozen (no AI), placed round the hero, huge HP */
function dummies(n, radius = 1.8) {
  const pool = g.enemies.enemies.filter((e) => !e.arch.boss && !e.isFlying && !e.isRanged).slice(0, n);
  pool.forEach((e, i) => {
    e.reset();
    e.update = function (dt) { this.stun = Math.max(0, this.stun - dt); if (this.state === 'hit' && this.stun <= 0) this.state = 'idle'; this.mixer.update(dt); this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; };
    e.triggered = true; e.state = 'idle'; e.root.visible = true; e.owner = 'BOTH'; e.removed = false;
    const a = (i / n) * Math.PI * 2;
    e.pos.copy(p.pos).add(new THREE_V(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    e.hp = 99999; e.poise = 9999; e.vel.set(0, 0, 0);
    e.loop(e.arch.clips.idle, 1, 0);
  });
  return pool;
}
function pin(ds, radius) {
  ds.forEach((e, i) => { const a = (i / ds.length) * Math.PI * 2; e.pos.copy(p.pos).add(new THREE_V(Math.cos(a) * radius, 0, Math.sin(a) * radius)); e.hp = Math.max(e.hp, 90000); e.vel.set(0, 0, 0); });
}
function hipsYaw() {
  const m = p.hipsBone.matrixWorld.elements;
  return Math.atan2(m[8], m[10]);
}

export function whirl(hold = 6, radius = 1.8) {
  g.paused = false;
  p.revive(p.pos.clone(), p.yaw);
  const ds = dummies(3, radius);
  const hp0 = ds.map((e) => e.hp);
  const inp = g.input;
  inp.press('light', 'probe');
  const seq = [];
  let last = null, maxJump = 0, prevYaw = null, t = 0, whirlStart = -1, whirlEnd = -1, trail = 0, frames = 0;
  while (t < hold + 2.5) {
    if (t >= hold && inp.isDown('light')) inp.release('light', 'probe');
    pin(ds, radius);
    step(); t += 1 / 60; frames++;
    const id = p.attack?.id ?? p.state;
    if (id !== last) { seq.push(`${t.toFixed(2)}:${id}`); last = id; }
    if (p.attack?.whirl && whirlStart < 0) whirlStart = t;
    if (whirlStart >= 0 && whirlEnd < 0 && p.attack?.id === 'WHIRL_END') whirlEnd = t;
    if (g.fx.trailOn) trail++;
    const y = hipsYaw();
    if (prevYaw !== null && p.attack?.whirl) { let d = y - prevYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); maxJump = Math.max(maxJump, Math.abs(d)); }
    prevYaw = y;
  }
  if (inp.isDown('light')) inp.release('light', 'probe');
  return {
    seq: seq.join(' '),
    whirlSeconds: whirlStart >= 0 ? +((whirlEnd > 0 ? whirlEnd : t) - whirlStart).toFixed(2) : 0,
    hitsPerDummy: ds.map((e, i) => +(hp0[i] - e.hp).toFixed(0)),
    maxHipYawStepDeg: +(maxJump * 180 / Math.PI).toFixed(1),
    trailFrames: trail, frames,
    learned: g.learned.whirlwind,
  };
}

export function crown(holdHeavy = 1.2, radii = [1.6, 3.2, 4.8]) {
  g.paused = false;
  p.revive(p.pos.clone(), p.yaw);
  const ds = dummies(radii.length, 2);
  const place = () => ds.forEach((e, i) => { const a = (i / ds.length) * Math.PI * 2 + 0.3; e.pos.copy(p.pos).add(new THREE_V(Math.cos(a) * radii[i], 0, Math.sin(a) * radii[i])); e.hp = Math.max(e.hp, 90000); e.vel.set(0, 0, 0); });
  place();
  const hp0 = ds.map((e) => e.hp);
  const inp = g.input;
  inp.press('heavy', 'probe');
  const seq = [];
  let last = null, t = 0, maxLevel = 0, knock = ds.map(() => 0);
  while (t < holdHeavy + 3.2) {
    if (t >= holdHeavy && inp.isDown('heavy')) inp.release('heavy', 'probe');
    place();
    step(); t += 1 / 60;
    maxLevel = Math.max(maxLevel, p.chargeLevel);
    const id = p.attack?.id ?? p.state;
    if (id !== last) { seq.push(`${t.toFixed(2)}:${id}`); last = id; }
  }
  if (inp.isDown('heavy')) inp.release('heavy', 'probe');
  return { seq: seq.join(' '), chargeLevel: +maxLevel.toFixed(2), damageByDistance: Object.fromEntries(radii.map((r, i) => [r + 'm', +(hp0[i] - ds[i].hp).toFixed(0)])), learned: g.learned.crownbreaker };
}

export function tapVsHold() {
  g.paused = false;
  const out = {};
  for (const a of ['light', 'heavy']) {
    p.revive(p.pos.clone(), p.yaw);
    step(20);
    const seq = [];
    let last = null;
    g.input.press(a, 'probe'); step(6); g.input.release(a, 'probe'); // 0.1 s tap
    for (let i = 0; i < 150; i++) { step(); const id = p.attack?.id ?? p.state; if (id !== last) { seq.push(id); last = id; } }
    out[a] = seq.join(' ');
  }
  return out;
}
