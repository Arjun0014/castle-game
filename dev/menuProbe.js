// Session 15: the title screen heroine (character/MenuIdle.ts). Dev server, on the title (no autostart):
//   http://localhost:5173/?mute   then   const M = await import('/dev/menuProbe.js'); await M.ready();
//   M.run(120)            simulate 120 s of the title at 30 fps (the pane may be hidden: frames are driven here);
//                         → the director's log (actions, stance changes), skeleton health per second
//   M.pose('menu_inspect', 1.8)   hold one clip at a time (s) for a still (the shot and the facing as on the title)
//   M.face()              her facing vs the camera (deg): 0 = straight into the lens
//   M.all()               every menu clip sampled every 0.25 s: hips scale, NaN, feet on the floor, blade in hand
let g, p;
export async function ready() {
  for (let i = 0; i < 160 && !(window.__ready && window.__game?.menuIdle); i++) await new Promise((r) => setTimeout(r, 500));
  g = window.__game; p = g.player;
  for (let i = 0; i < 60 && !p.anim.has('menu_inspect'); i++) await new Promise((r) => setTimeout(r, 250));
  g.renderer.setAnimationLoop(null); // frames are driven by the probe
  return { idle: !!g.menuIdle, pack: p.anim.has('menu_inspect') };
}
const bone = (re) => { let b = null; p.model.traverse((o) => { if (!b && re.test(o.name)) b = o; }); return b; };
function frame(dt = 1 / 30) { g.clock.getDelta = () => dt; g.menuFrame(); }

/** skeleton health right now */
export function health() {
  p.model.updateMatrixWorld(true);
  const hips = bone(/Hips$/), lf = bone(/LeftFoot$/), rf = bone(/RightFoot$/), rh = bone(/RightHand$/), head = bone(/Head$/);
  const w = (o) => o.getWorldPosition(new p.pos.constructor());
  const s = hips.getWorldScale(new p.pos.constructor());
  let nan = false;
  p.model.traverse((o) => { if (o.isBone && ![...o.quaternion.toArray(), ...o.position.toArray()].every(Number.isFinite)) nan = true; });
  const floor = p.pos.y;
  return {
    hipsScale: +s.x.toFixed(4), nan,
    feet: [+(w(lf).y - floor).toFixed(3), +(w(rf).y - floor).toFixed(3)],
    hips: +(w(hips).y - floor).toFixed(3), head: +(w(head).y - floor).toFixed(3),
    hand: +(w(rh).y - floor).toFixed(3),
    drift: +Math.hypot(w(hips).x - p.pos.x, w(hips).z - p.pos.z).toFixed(3),
  };
}

export function run(seconds = 120) {
  const rows = [];
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    frame();
    if (i % 30 === 0) rows.push({ t: i / 30, state: g.menuIdle.state, move: g.menuIdle.move, home: g.menuIdle.home, look: g.menuIdle['look'].kind, ...health() });
  }
  const bad = rows.filter((r) => r.nan || Math.abs(r.hipsScale - 0.01) > 1e-4 || Math.min(...r.feet) < -0.05 || r.drift > 0.45);
  return { log: g.menuIdle.log, bad: bad.length, badRows: bad.slice(0, 5), minFoot: Math.min(...rows.flatMap((r) => r.feet)), maxDrift: Math.max(...rows.map((r) => r.drift)), headRange: [Math.min(...rows.map((r) => r.head)), Math.max(...rows.map((r) => r.head))] };
}

/** her body facing relative to the camera direction (deg) */
export function face() {
  const f = new p.pos.constructor(Math.sin(p.root.rotation.y), 0, Math.cos(p.root.rotation.y));
  const toCam = g.camera.position.clone().sub(p.pos).setY(0).normalize();
  return +(Math.acos(Math.max(-1, Math.min(1, f.dot(toCam)))) * 180 / Math.PI).toFixed(1);
}

/** hold one clip at time t (overlay at full weight) and render the title shot */
export function pose(id, t = 0, look = 'free') {
  const a = p.anim;
  frame();
  a.play(id, { fade: 0.02, loop: false, clamp: true, start: t });
  g.menuIdle.state = 'pose'; g.menuIdle['until'] = 1e9;
  g.menuIdle['look'].kind = look; g.menuIdle['look'].until = 1e9;
  for (let i = 0; i < 8; i++) { a.setOverlaySpeed(0); frame(); }
  return { id, t, ...health() };
}

/** every menu clip sampled every 0.25 s */
export function all() {
  const ids = ['idle_alert', 'menu_stance_2h', 'menu_inspect', 'menu_vigil', 'menu_ease', 'idle_flourish_a', 'idle_flourish_b', 'menu_stretch', 'menu_restless', 'menu_ready'];
  const out = {};
  for (const id of ids) {
    const d = p.anim.duration(id);
    const rows = [];
    for (let t = 0; t < d; t += 0.25) rows.push(pose(id, t));
    out[id] = {
      dur: +d.toFixed(2), nan: rows.some((r) => r.nan), scale: [Math.min(...rows.map((r) => r.hipsScale)), Math.max(...rows.map((r) => r.hipsScale))],
      footMin: Math.min(...rows.flatMap((r) => r.feet)), footMax: Math.max(...rows.flatMap((r) => r.feet)), drift: Math.max(...rows.map((r) => r.drift)),
      hips: [Math.min(...rows.map((r) => r.hips)), Math.max(...rows.map((r) => r.hips))],
    };
  }
  g.menuIdle.state = 'home'; g.menuIdle['until'] = g.menuIdle['t'] + 3; p.anim.release(0.2);
  return out;
}
