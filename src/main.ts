import { Game } from './game/Game';
import { AutoPilot } from './game/AutoPilot';
import { FLOORS, takeCarry } from './levels/Floors';
import { LoadingScreen } from './ui/LoadingScreen';
import { MainMenu, PauseMenu } from './ui/MainMenu';
import { Platform, lockPointer } from './platform/Platform';
import { applyDevStart, devFloor } from './game/DevStart';
import { Settings } from './game/Settings';
import { Save, type Guidance, type SaveData } from './game/Save';
import { Net } from './assets/AssetManager';
import { Achievements } from './game/Achievements';
import { AchievementToast } from './ui/AchievementToast';
import { LoreBook } from './ui/LoreBook';

const stage = document.getElementById('stage')!;
// the code has arrived: the plain boot line in index.html gives way to the loading card
(window as any).__booted = true;
document.getElementById('boot-note')?.remove();
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
/** dev only: `?mute&scoretest` loads and runs the title score silently (master 0), so music / ducking can be measured */
const scoreTest = import.meta.env.DEV && params.has('scoretest');
game.audio.scoreInMute = scoreTest;
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

// ------------------------------------------------------------------ achievements (session 15)
/** kept across sessions for players; automated runs keep them in memory only unless `?ach` asks to persist (tests) */
const achievements = new Achievements((!automated && !dev) || params.has('ach'));
achievements.bind(game.signals, { floorId: () => game.floorId, hp: () => game.player.hp, now: () => performance.now() / 1000 });
const toast = new AchievementToast(stage, () => game.audio.achievement());
achievements.onUnlock = (a) => { toast.show(a); menu?.tally(); };
window.setInterval(() => { if (game.started && !game.paused) achievements.update(); }, 100);
(window as any).__ach = achievements;
(window as any).__toast = toast;

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
/**
 * The title score (session 14): "The Last Canopy Sleeps" plays from the loading card on — at once if the browser allows
 * sound without a gesture (autoplay: a site the player has used, an itch.io page they clicked into), otherwise on the very
 * first touch, click or key anywhere. It then never restarts: the film fades it out (its position kept) and play fades
 * it back in from there (Music.start / stop).
 */
let filmOn = false;
const startScore = () => {
  if ((automated && !scoreTest) || filmOn || game.started) return;
  game.audio.unlock();
  game.audio.music?.start(3.5);
};
game.onMusicReady = startScore;
const firstGesture = () => {
  startScore();
  if (game.audio.running && game.audio.music && game.audio.music.mode !== 'off') {
    for (const ev of GESTURES) window.removeEventListener(ev, firstGesture, true);
  }
};
// (Chrome counts keydown / mousedown / pointerup / touchend as activation — not a touch's pointerdown; iOS wants touchend)
const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown', 'click'] as const;
if (!automated) for (const ev of GESTURES) window.addEventListener(ev, firstGesture, { capture: true, passive: true });

const menu = quick ? null : new MainMenu(stage, {
  settings, save,
  onNewGame: (g) => newGame(g),
  onContinue: () => { if (save) void continueGame(save); },
  sound: (k) => game.audio.ui(k),
  // a gesture on the title screen: sound is allowed now (the score was waiting for it, or is already playing)
  onGesture: () => startScore(),
  onLore: () => { startScore(); lore.open(1); },
  achievements,
});

// ------------------------------------------------------------------ the chronicle (session 15)
/** the narrated lore book over the title: the score keeps playing (ducked under each page), the castle stops drawing */
const lore = new LoreBook(stage, {
  audio: game.audio, settings, sound: (k) => game.audio.ui(k),
  onPage: (n) => achievements.lorePage(n),
  onOpen: () => game.menuPause(true),
  onClose: () => game.menuPause(false),
});
(window as any).__lore = lore;
/** the secret: the title left alone for three minutes (the chronicle, the film and a hidden tab do not count) */
let titleWait = 0;
/** three minutes; dev `?patience=N` shortens it for tests */
const PATIENCE = import.meta.env.DEV && params.has('patience') ? Number(params.get('patience')) || 5 : 180;
window.setInterval(() => {
  const html = document.documentElement;
  if (html.classList.contains('menu-on') && !html.classList.contains('lore-on') && !html.classList.contains('intro-on') && !document.hidden && !game.started) {
    if (++titleWait >= PATIENCE) achievements.unlock('patience');
  }
}, 1000);

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
  void game.loadMenuPack();
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
    filmOn = true;
    game.menuScene(false);
    // the film has its own score: the title's music fades out under its first seconds (position kept) and play
    // brings it back in from there — never a restart
    game.audio.music?.stop(1.6);
    intro.play((gesture) => {
      filmOn = false;
      begin(guidance);
      // a skip is a user gesture: take the pointer now; after the film ends by itself the first click takes it
      if (gesture && !Platform.isTouch) lockPointer(game.renderer.domElement);
    });
    return;
  }
  begin(guidance);
  if (!Platform.isTouch) lockPointer(game.renderer.domElement);
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
    if (!Platform.isTouch) lockPointer(game.renderer.domElement);
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
const pause = new PauseMenu(game.hud.pauseEl, settings, (k) => game.audio.ui(k), achievements);
const resume = () => {
  if (!game.paused || Platform.rotateBlocked) return;
  game.togglePause(false);
  if (!Platform.isTouch) lockPointer(game.renderer.domElement);
};
pause.onResume = resume;
pause.onQuit = () => location.reload();
game.pauseBack = () => pause.back();
game.onPause = (on) => { document.documentElement.classList.toggle('paused', on); if (!on) pause.reset(); game.audio.music?.setPaused(on); };
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
