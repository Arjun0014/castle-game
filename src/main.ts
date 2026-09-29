import { Game } from './game/Game';
import { AutoPilot } from './game/AutoPilot';
import { FLOORS, takeCarry } from './levels/Floors';
import { LoadingScreen } from './ui/LoadingScreen';
import { MainMenu, PauseMenu } from './ui/MainMenu';
import { Platform } from './platform/Platform';
import { applyDevStart, devFloor } from './game/DevStart';
import { Settings } from './game/Settings';
import { Save, type Guidance, type SaveData } from './game/Save';
import { Net } from './assets/AssetManager';

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
/** tests and dev probes go straight into play (no title screen, no film): `?autostart`, `?autopilot` */
const quick = params.has('autostart') || params.has('autopilot');
/** `?guide=guided|minimal` pins the guidance for quick starts (default Minimal: no tutorial slow motion in tests) */
const pinnedGuide: Guidance = params.get('guide') === 'guided' ? 'guided' : 'minimal';
const game = new Game(app, hud, { muted: automated, stage });
// automated runs measure fixed quality; adaptive resolution is for players
if (automated) game.dynResEnabled = false;
const loader = new LoadingScreen(overlay);
// dev server only: ?floor=N / ?at=<warp> (game/DevStart.ts); production always starts at Floor 1
const dev = devFloor(params);
const floorId = dev ?? 1;
const floor = FLOORS[floorId];
const carry = takeCarry();
(window as any).__loader = loader;
// a request that failed for want of a connection is retried (AssetManager.fetchBytes): the card says so
Net.onRetry = (_url, attempt, wait) => loader.connection(attempt, wait);
Net.onRecover = () => loader.connection(0);

// ------------------------------------------------------------------ settings, progress
const settings = new Settings(!automated);
settings.onChange((s) => {
  game.audio.setLevels(s);
  game.hud.subtitlesOn = s.subtitles;
  game.input.lookScale = s.look;
  game.rig.shakeScale = s.shake;
});
const save: SaveData | null = automated || dev ? null : Save.load();
/** seconds of play on floors before this session's first (Continue) — the ending card's total */
let playTimeBefore = 0;
game.onFloorArrive = (id) => {
  if (automated || dev || id < 2) return;
  Save.write({
    floor: id, guidance: game.guidance, learned: { ...game.learned }, bestiary: [...game.bestiarySeen], deaths: game.deaths,
    playTime: playTimeBefore + (performance.now() - game.startTime) / 1000,
  });
};
game.playTimeBefore = () => playTimeBefore;

// ------------------------------------------------------------------ the opening film (optional module)
/**
 * The film (ui/Intro.ts, public/cinematic/) plays between New Game and the first step. It is loaded through a glob so
 * a tree without it still builds and simply starts play; its module is fetched while the title screen shows, so the
 * New Game click (a user gesture: sound allowed) can start it at once.
 */
type IntroLike = { preload(): void; play(done: (gesture: boolean) => void): void };
const introModules = import.meta.glob('./ui/Intro.ts');
let intro: IntroLike | null = null;
let introPlayed = false;
async function loadIntro() {
  const load = introModules['./ui/Intro.ts'];
  if (!load || quick) return;
  try {
    const mod = await load() as { Intro: { new(stage: HTMLElement): IntroLike; enabled(p: URLSearchParams, floor: number, automated: boolean): boolean } };
    // dev: `&film` shows it in a muted test session too
    if (!mod.Intro.enabled(params, floorId, automated) && !(import.meta.env.DEV && params.has('film'))) return;
    intro = new mod.Intro(stage);
    intro.preload();
  } catch (err) { console.warn('[intro] not available:', err); }
}

// ------------------------------------------------------------------ boot → title screen
const menu = quick ? null : new MainMenu(stage, {
  settings, save,
  onNewGame: (g) => newGame(g),
  onContinue: () => { if (save) void continueGame(save); },
  sound: (k) => game.audio.ui(k),
  onGesture: () => game.audio.unlock(),
});

loader.showInitial(floor);
game.boot(floorId, (f, label) => loader.progress(f, label)).then(() => {
  // a dev ?floor=N / ?at= start gets the progression state of a real player there (and a legacy carry if stored)
  applyDevStart(game, params);
  if (floorId > 1 && carry) { game.time.charge = Math.max(game.time.charge, carry.charge); game.player.hp = Math.max(game.player.maxHp * 0.5, carry.hp); }
  loader.ready(floor.readyText);
  (window as any).__ready = true;
  if (quick || !menu) { begin(pinnedGuide); return; }
  // the title screen, over the castle itself
  game.menuScene(true);
  document.documentElement.classList.add('menu-on');
  setTimeout(() => { loader.hide(); menu.show(); }, 350);
  void loadIntro();
}).catch((err) => {
  console.error(err);
  // nothing is playable yet: TRY AGAIN reloads the page
  loader.error('Failed to load: ' + (err?.message ?? err), () => location.reload());
  (window as any).__loadError = String(err?.stack ?? err);
});

function startAutopilot() {
  if (params.has('autopilot') && game.floor.autopilot) game.autopilot = new AutoPilot(game, params.get('autopilot') || 'full');
}

/** Into play on the loaded floor. */
function begin(guidance: Guidance) {
  if (game.started) return;
  game.menuScene(false);
  document.documentElement.classList.remove('menu-on');
  loader.hide();
  game.setGuidance(guidance);
  game.audio.init();
  game.start();
  startAutopilot();
  if (!game.autopilot) game.hud.message(game.floor.title, game.floor.subtitle, 3.5);
}
(window as any).__begin = () => begin(pinnedGuide);
btn.addEventListener('click', () => begin(pinnedGuide));

/** New Game (inside the click: sound and full screen are allowed) → the film if it is there → Floor 1. */
function newGame(guidance: Guidance) {
  if (game.started) return;
  game.audio.unlock();
  if (Platform.isTouch) Platform.enterImmersive();
  menu?.hide();
  if (intro && !introPlayed) {
    introPlayed = true;
    game.menuScene(false);
    intro.play((gesture) => {
      begin(guidance);
      // a skip is a user gesture: take the pointer now; after the film ends by itself the first click takes it
      if (gesture && !Platform.isTouch) game.renderer.domElement.requestPointerLock?.();
    });
    return;
  }
  begin(guidance);
  if (!Platform.isTouch) game.renderer.domElement.requestPointerLock?.();
}

/** Continue: the saved floor's chapter card (real loading), then a key/tap to enter (pointer lock, sound). */
async function continueGame(s: SaveData) {
  if (game.started || game.loading) return;
  game.audio.unlock();
  if (Platform.isTouch) Platform.enterImmersive();
  menu?.hide();
  game.menuScene(false);
  document.documentElement.classList.remove('menu-on');
  loader.showTransition(FLOORS[s.floor]);
  await resumeContinue(s);
}
/** Continue's load (also its TRY AGAIN after a failed download: the transition resumes where it stopped). */
async function resumeContinue(s: SaveData) {
  const def = FLOORS[s.floor];
  try {
    await game.transitionTo(s.floor, (f, label) => loader.progress(f, label));
    Object.assign(game.learned, s.learned);
    for (const b of s.bestiary) game.bestiarySeen.add(b);
    game.deaths = s.deaths;
    game.guidance = s.guidance;
    playTimeBefore = s.playTime;
    loader.ready(def.readyText);
    await loader.waitForGesture();
    if (!Platform.isTouch) game.renderer.domElement.requestPointerLock?.();
    loader.hide();
    game.audio.init();
    game.start();
    game.hud.message(def.title, def.subtitle, 3.5);
  } catch (err: any) {
    console.error(err);
    // the saved floor's files did not arrive: TRY AGAIN resumes the same load (Game.transitionTo)
    loader.error('Failed to load: ' + (err?.message ?? err), () => { loader.showTransition(def); void resumeContinue(s); });
  }
}

/** Floor exit → chapter card → unload / load / warm the next floor → continue. Duplicate calls are ignored. */
game.onNextFloor = async (next) => {
  if (game.loading) return;
  const def = FLOORS[next];
  loader.showTransition(def);
  try {
    await game.transitionTo(next, (f, label) => loader.progress(f, label));
    loader.ready(def.readyText);
    (window as any).__floorReady = next;
    await new Promise((r) => setTimeout(r, 900));
    loader.hide();
    game.start();
    startAutopilot();
    if (!game.autopilot) game.hud.message(def.title, def.subtitle, 3.5);
  } catch (err: any) {
    console.error(err);
    // the next floor's files did not arrive (no connection): TRY AGAIN resumes the transition in place, HP and
    // resonance kept; only the files that failed are requested again
    loader.error('Failed to load: ' + (err?.message ?? err), () => { void game.onNextFloor?.(next); });
    (window as any).__loadError = String(err?.stack ?? err);
  }
};
(window as any).__transition = (n: number) => game.onNextFloor?.(n);

// the ending: the save remembers it, and the card offers the way back to the title
game.onEnd = () => {
  if (!automated && !dev) {
    const s = Save.load();
    if (s) Save.write({ ...s, finished: true });
  }
  const end = game.hud.endEl;
  if (!end.querySelector('.end-title')) {
    const b = document.createElement('button');
    b.className = 'mm-item end-title focus';
    b.innerHTML = '<span>Return to the title</span>';
    b.addEventListener('click', () => location.reload());
    end.appendChild(b);
  }
};

// ------------------------------------------------------------------ pause menu
const pause = new PauseMenu(game.hud.pauseEl, settings, (k) => game.audio.ui(k));
const resume = () => {
  if (!game.paused || Platform.rotateBlocked) return;
  game.togglePause(false);
  if (!Platform.isTouch) game.renderer.domElement.requestPointerLock?.();
};
pause.onResume = resume;
pause.onQuit = () => location.reload();
game.pauseBack = () => pause.back();
game.onPause = (on) => { document.documentElement.classList.toggle('paused', on); if (!on) pause.reset(); };
// a handheld turned sideways pauses behind the rotate overlay (turning back shows the pause menu)
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
