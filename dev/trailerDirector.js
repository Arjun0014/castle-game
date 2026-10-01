// Store-preview director (session 16): a deterministic, scripted fight in the Great Hall (E13) — light-cut chain with
// cinematic finishers, a Whirlwind, then the Gate Warden's finisher in the torchlight. It made the 10 s Wavedash preview.
//
// Recipe (a dev server or `npm run preview`, a real GPU: Chrome with --use-angle=d3d11):
//   1. open /?mute&at=warden&autostart&quality=high at 1920×1080, wait for window.__ready
//   2. hide the HUD words: #hud > *, #touch, .ach-host, .save-mark { visibility: hidden } (the finisher letterbox stays)
//   3. evaluate this file, then window.__dir.init({ warm: 10, comboEnd: 3.6, whirlEnd: 6.3, wardenAt: 6.5 })
//   4. 300× { window.__dir.frame(); page.screenshot(fNNNN.jpg) }   — each frame is two 1/60 s game steps: 30 fps
//   5. ffmpeg -framerate 30 -i f%04d.jpg -frames:v 300 -vf "fade=t=out:st=9.65:d=0.35"
//        -c:v libx264 -crf 16 -preset slow -movflags +faststart -an preview.mp4
// Wavedash shows the first 10 s of a preview video, without sound.
(() => {
  const g = window.__game, p = g.player, V = p.pos.constructor, inp = g.input, em = g.enemies;
  const DT = 1 / 60;
  const B = (x, y, z) => new V(x, z, -y);
  let t = 0, phase = '', lastTap = -9, plan = [], warden = null, E = null, log = [];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const alive = () => E.enemies.filter((e) => e.alive && !e.isFlying && e.root.visible && e !== warden);
  const nearest = (list) => list.slice().sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0] ?? null;
  function steer(target, stop = 2.2) {
    if (!target) { inp.analog.x = inp.analog.y = 0; return 99; }
    const d = target.pos.clone().sub(p.pos).setY(0);
    const dist = d.length();
    if (dist < stop) { inp.analog.x = inp.analog.y = 0; return dist; }
    d.normalize();
    const y = g.rig.yaw, fwd = new V(-Math.sin(y), 0, -Math.cos(y)), right = new V(Math.cos(y), 0, -Math.sin(y));
    inp.analog.x = d.dot(right); inp.analog.y = d.dot(fwd);
    return dist;
  }
  function follow(k = 0.035, side = 0) {
    // a follow camera: behind her facing (or the fight), eased; the finisher camera overrides by itself
    if (g.finisher.active) return;
    const want = p.yaw + Math.PI + side;
    g.rig.yaw += wrap(want - g.rig.yaw) * k;
  }
  function step() {
    const at = (s) => t >= s;
    if (phase === 'combo') {
      const tg = nearest(alive());
      const dist = steer(tg, 2.0);
      if (dist < 3.2 && t - lastTap > 0.27) { inp.tapVirtual('light'); lastTap = t; }
      if (at(plan.comboEnd)) { phase = 'whirl'; g.finisher.always = false; inp.analog.x = inp.analog.y = 0; }
      follow(0.03, 0.35);
    } else if (phase === 'whirl') {
      if (g.finisher.active) { follow(); }
      else {
        if (!inp.isDown?.('light')) inp.setVirtual('light', true);
        const tg = nearest(alive());
        steer(tg, 0.6);
        follow(0.025, -0.4);
      }
      if (at(plan.whirlEnd)) { inp.setVirtual('light', false); inp.analog.x = inp.analog.y = 0; phase = 'gap'; }
    } else if (phase === 'gap') {
      follow(0.03);
      if (at(plan.wardenAt)) {
        // the Gate Warden steps into the torchlight in front of her: one light blow from her guaranteed finisher
        phase = 'warden';
        const fwd = new V(Math.sin(p.yaw), 0, Math.cos(p.yaw));
        const spot = (plan.wardenSpot ? B(...plan.wardenSpot) : p.pos.clone().addScaledVector(fwd, 1.6 + warden.radius));
        for (const e of alive()) if (e.pos.distanceTo(spot) < 3) { e.die(); em.onKill(e); }
        warden.place(spot); warden.pos.copy(spot);
        const dir = warden.pos.clone().sub(p.pos).setY(0).normalize();
        p.revive(warden.pos.clone().addScaledVector(dir, -(1.6 + warden.radius)), Math.atan2(dir.x, dir.z));
        g.rig.snapBehind(p.yaw);
        g.rig.yaw += plan.wardenCam ?? 0.45;
        warden.hp = 1; warden.stun = 0; warden.cooldown = 99; if (warden.state !== 'finisher') warden.state = 'chase';
        lastTap = -9;
      }
    } else if (phase === 'warden') {
      if (!g.finisher.active && warden.alive && t - lastTap > 0.4) { warden.hp = 1; inp.tapVirtual('light'); lastTap = t; }
      follow(0.02, 0.45);
    }
    g.step(DT); inp.endFrame(DT); t += DT;
  }
  window.__dir = {
    init(o = {}) {
      g.stop();
      p.godMode = true;
      p.abilities = new Set(['crownbreaker', 'whirlwind']);
      g.learned.whirlwind = true; g.learned.crownbreaker = true;
      g.time.charge = 200;
      g.camAssistPin = false;
      E = em.encounters.get(o.enc ?? 'E13');
      const st = E.state === 'BOTH' ? g.time.state : E.state;
      if (g.time.state !== st) g.forceState(st);
      E.cleared = false; E.triggered = false; E.wave = 0;
      for (const e of E.enemies) { e.reset(); e.removed = false; }
      em.resetUncleared();
      em.trigger(E);
      E.wave = Math.max(...E.enemies.map((e) => e.wave));
      for (const e of E.enemies) e.activate();
      warden = E.enemies.find((e) => e.arch.id === 'gate_warden');
      // the guards fall to a few cuts (the trailer is ten seconds); the Warden waits her turn
      for (const e of E.enemies) if (e !== warden) e.hp = Math.min(e.hp, o.guardHp ?? 45);
      warden.cooldown = 99;
      if (o.at) p.revive(B(...o.at), (o.yaw ?? 0) * Math.PI / 180 + Math.PI);
      // straight into the fight: 3 m from the nearest guard, facing it
      for (let i = 0; i < 20; i++) { g.step(DT); inp.endFrame(DT); }
      const first = o.start ? null : nearest(alive());
      if (first) { const d = first.pos.clone().sub(p.pos).setY(0).normalize(); p.revive(first.pos.clone().addScaledVector(d, -(o.startGap ?? 3)), Math.atan2(d.x, d.z)); }
      // a closer, lower follow camera for the trailer
      g.rig.profile = Object.assign({}, g.rig.profile, { distance: o.camDist ?? 3.6, combatDistance: o.camDist ?? 3.6, height: o.camH ?? 1.45 });
      g.rig.snapBehind(p.yaw);
      g.rig.pitch = o.pitch ?? 0.22;
      g.finisher.always = true;
      plan = { comboEnd: o.comboEnd ?? 3.8, whirlEnd: o.whirlEnd ?? 6.6, wardenAt: o.wardenAt ?? 6.9, wardenSpot: o.wardenSpot, wardenCam: o.wardenCam };
      phase = 'combo'; t = 0;
      for (let i = 0; i < (o.warm ?? 30); i++) { g.step(DT); inp.endFrame(DT); }
      return { warden: !!warden, guards: alive().length, pos: g.blenderPos(), state: g.time.state };
    },
    frame() { step(); step(); g.renderer.render(g.scene, g.camera); return { t: +t.toFixed(2), phase, fin: g.finisher.active ? g.finisher.id : null, kills: em.killCount }; },
    get log() { return log; },
  };
})();
