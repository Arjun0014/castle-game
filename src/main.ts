import { Game } from './game/Game';
import { AutoPilot } from './game/AutoPilot';
import { FLOORS, takeCarry } from './levels/Floors';
import { LoadingScreen } from './ui/LoadingScreen';
import { Platform } from './platform/Platform';
import { applyDevStart, devFloor } from './game/DevStart';

const stage = document.getElementById('stage')!;
// portrait stage + input mode first: the renderer sizes itself from the stage
Platform.init(stage, document.getElementById('rotate')!);
const app = document.getElementById('app')!;
const hud = document.getElementById('hud')!;
const overlay = document.getElementById('overlay')!;
const btn = document.getElementById('start-btn') as HTMLButtonElement;

const params = new URLSearchParams(location.search);
/**
 * Automation mute: autopilot runs, Claude/automated tests, benchmarks and `?mute` are silent (and skip decoding
 * the ambience beds). Normal play is never muted: players get the full mix including the ambience.
 */
const automated = params.has('autopilot') || params.has('mute') || params.has('bench') || navigator.webdriver === true;
const game = new Game(app, hud, { muted: automated, stage });
// automated runs measure fixed quality; adaptive resolution is for players
if (automated) game.dynResEnabled = false;
const loader = new LoadingScreen(overlay);
// dev server only: ?floor=N / ?at=<warp> (game/DevStart.ts); production always starts at Floor 1
const floorId = devFloor(params) ?? 1;
const floor = FLOORS[floorId];
const carry = takeCarry();
(window as any).__loader = loader;

loader.showInitial(floor);
game.boot(floorId, (f, label) => loader.progress(f, label)).then(() => {
  // a dev ?floor=N / ?at= start gets the progression state of a real player there (and a legacy carry if stored)
  applyDevStart(game, params);
  if (floorId > 1 && carry) { game.time.charge = Math.max(game.time.charge, carry.charge); game.player.hp = Math.max(game.player.maxHp * 0.5, carry.hp); }
  loader.ready(floor.readyText);
  (window as any).__ready = true;
  if (params.has('autostart') || params.has('autopilot')) begin();
}).catch((err) => {
  console.error(err);
  loader.error('Failed to load: ' + (err?.message ?? err));
  (window as any).__loadError = String(err?.stack ?? err);
});

function startAutopilot() {
  if (params.has('autopilot') && game.floor.autopilot) game.autopilot = new AutoPilot(game, params.get('autopilot') || 'full');
}

function begin() {
  if (game.started) return;
  loader.hide();
  game.audio.init();
  game.start();
  startAutopilot();
  if (!game.autopilot) game.hud.message(game.floor.title, game.floor.subtitle, 3.5);
}

/** Floor exit → loading screen → unload / load / warm the next floor → continue. Duplicate calls are ignored. */
game.onNextFloor = async (next) => {
  if (game.loading) return;
  const def = FLOORS[next];
  loader.showTransition(def);
  try {
    await game.transitionTo(next, (f, label) => loader.progress(f, label));
    loader.ready(def.readyText);
    (window as any).__floorReady = next;
    await new Promise((r) => setTimeout(r, 450));
    loader.hide();
    game.start();
    startAutopilot();
    if (!game.autopilot) game.hud.message(def.title, def.subtitle, 3.5);
  } catch (err: any) {
    console.error(err);
    loader.error('Failed to load: ' + (err?.message ?? err));
    (window as any).__loadError = String(err?.stack ?? err);
  }
};
(window as any).__transition = (n: number) => game.onNextFloor?.(n);

btn.addEventListener('click', () => {
  begin();
  if (Platform.isTouch) Platform.enterImmersive();
  else game.renderer.domElement.requestPointerLock?.();
});
const resume = () => {
  if (!game.paused || Platform.rotateBlocked) return;
  game.togglePause(false);
  if (!Platform.isTouch) game.renderer.domElement.requestPointerLock?.();
};
game.renderer.domElement.addEventListener('click', resume);
game.hud.pauseEl.addEventListener('click', resume);
// a handheld turned sideways pauses behind the rotate overlay (turning back shows the pause card: tap to resume)
Platform.onChange(() => {
  if (Platform.rotateBlocked && game.started && !game.paused && !game.finished) game.togglePause(true);
});
// hidden tab / app switch: pause so nobody dies while away (players only; automation keeps running)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !automated && game.started && !game.paused && !game.finished) game.togglePause(true);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'F9' && game.level) game.level.collision.meshes[game.time.state].visible = !game.level.collision.meshes[game.time.state].visible;
  if (e.code === 'KeyM' && game.started) game.audio.setMuted(!game.audio.muted);
});
