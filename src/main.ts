import { Game } from './game/Game';
import { AutoPilot } from './game/AutoPilot';
import { FLOORS, takeCarry } from './levels/Floors';
import { LoadingScreen } from './ui/LoadingScreen';

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
const game = new Game(app, hud, { muted: automated });
const loader = new LoadingScreen(overlay);
const floorId = FLOORS[Number(params.get('floor'))] ? Number(params.get('floor')) : 1;
const floor = FLOORS[floorId];
const carry = takeCarry();
(window as any).__loader = loader;

loader.showInitial(floor);
game.boot(floorId, (f, label) => loader.progress(f, label)).then(() => {
  if (floorId > 1) {
    // a direct ?floor=N start gets a fair minimum (and a legacy carry if one was stored)
    game.time.unlocked = true;
    game.time.charge = Math.max(100, carry?.charge ?? 100);
    if (carry) game.player.hp = Math.max(game.player.maxHp * 0.5, carry.hp);
  }
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
  game.renderer.domElement.requestPointerLock?.();
});
game.renderer.domElement.addEventListener('click', () => { if (game.paused) game.togglePause(false); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'F9' && game.level) game.level.collision.meshes[game.time.state].visible = !game.level.collision.meshes[game.time.state].visible;
  if (e.code === 'KeyM' && game.started) game.audio.setMuted(!game.audio.muted);
});
