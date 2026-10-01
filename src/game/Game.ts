import { AUTHOR } from '../data/credits';
import { RouteGuide } from './RouteGuide';
import * as THREE from 'three';
import { Input } from './Input';
import { Level, type Marker } from '../levels/Level';
import { MaterialLibrary, type TimeState } from '../levels/Materials';
import { Player } from '../character/Player';
import { CameraRig, type CamProfileId } from '../character/CameraRig';
import { HUD } from '../ui/HUD';
import { TimeSystem, PER_SHIFT } from '../time/TimeSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { Effects } from '../vfx/Effects';
import { AudioFX, type AmbientContext } from '../audio/Audio';
import { realTimeTo, type AttackKind } from '../combat/CombatData';

/** How heavy each attack kind sounds (0 light … 1 heavy). */
const SWING_WEIGHT: Record<AttackKind, number> = { light: 0.15, heavy: 0.75, finisher: 0.85, kick: 0.2, bash: 0.2, air: 0.55, crouch: 0.3, sprint: 0.6, whirl: 0.5 };
import { Checkpoints } from '../levels/Checkpoints';
import { Atmosphere, installAtmosphereFog } from '../vfx/Atmosphere';
import { FLOORS, type FloorDef, saveCarry } from '../levels/Floors';
import { Fractures } from '../levels/Fractures';
import { Gore } from '../vfx/Gore';
import { Perf } from './Perf';
import { GameAssets } from '../assets/GameAssets';
import type { EnemyTemplate } from '../assets/GameAssets';
import { warmup, type WarmupReport } from '../assets/Warmup';
import floorManifests from '../data/floorManifests.json';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';
import { Platform } from '../platform/Platform';
import { TouchControls } from '../ui/TouchControls';
import { promptText } from '../ui/Hints';
import type { Threat } from '../ui/HUD';
import { TargetAssist } from '../combat/TargetAssist';
import { Signals } from './Signals';
import { Objectives, type Learned } from './Objectives';
import { Dialogue } from '../audio/Dialogue';
import { NavGrid } from '../enemies/NavGrid';
import { ABILITY_FLOOR, ABILITY_INFO, HOLD_THRESHOLD, WHIRL_MAX, abilitiesForFloor, type AbilityId } from '../combat/Abilities';
import { Finishers } from '../combat/Finishers';
import { Lift } from '../levels/Lift';
import { Crownheart, AbyssEmbers } from '../vfx/Crownheart';
import { Arena } from './Arena';
import { POOL as ARENA_POOL, ARENA_ENV } from '../data/arena';
import { Tutorial } from './Tutorial';
import type { Guidance, CheckpointState } from './Save';
import { LOOPING } from '../data/animationManifest';
import { MenuIdle, MENU_PACK_IDS } from '../character/MenuIdle';

/** Loading-screen sink: fraction 0..1 of the whole operation + what is happening. */
export type LoadSink = (f: number, label: string) => void;

interface EnvPreset { bg: THREE.Color; fog: THREE.Color; near: number; far: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemi: number; sun: THREE.Color; sunI: number; sunDir: THREE.Vector3; exposure: number; heroLight: number; fill: THREE.Color; fillI: number; }
const ENV: Record<TimeState, EnvPreset> = {
  PAST: {
    bg: new THREE.Color(0x2a1a12), fog: new THREE.Color(0x24170f), near: 14, far: 95,
    hemiSky: new THREE.Color(0xffd6a0), hemiGround: new THREE.Color(0x4a3222), hemi: 1.35,
    sun: new THREE.Color(0xffb878), sunI: 2.6, sunDir: new THREE.Vector3(-0.55, 0.62, 0.35).normalize(), exposure: 1.25, heroLight: 0,
    fill: new THREE.Color(0xffb070), fillI: 0.25,
  },
  PRESENT: {
    // dark, cold and smoky: little ambient, a hard moon key (shadows through the broken roofs), mist does the rest
    bg: new THREE.Color(0x0a0e15), fog: new THREE.Color(0x1a2230), near: 5, far: 58,
    hemiSky: new THREE.Color(0x4a5a78), hemiGround: new THREE.Color(0x0e1012), hemi: 0.42,
    sun: new THREE.Color(0xa9c2ff), sunI: 2.9, sunDir: new THREE.Vector3(0.12, 0.97, -0.2).normalize(), exposure: 1.08, heroLight: 5.5,
    fill: new THREE.Color(0x7890c0), fillI: 0.55,
  },
};

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, 1, 0.08, 400);
  input: Input;
  hud: HUD;
  mats!: MaterialLibrary;
  level!: Level;
  player!: Player;
  rig: CameraRig;
  time!: TimeSystem;
  enemies!: EnemyManager;
  fx!: Effects;
  audio: AudioFX;
  assets: GameAssets;
  checkpoints!: Checkpoints;
  hemi = new THREE.HemisphereLight();
  atmo!: Atmosphere;
  /** Faint cold light near the hero in the Present so enemies and footing read in the dark. */
  playerLight = new THREE.PointLight(0xa8c4e8, 0, 9, 1.7);
  /** Low-angle shadowless bounce light: gives walls form when the key light is near-vertical. */
  fill = new THREE.DirectionalLight(0xffffff, 0);
  sun = new THREE.DirectionalLight();
  clock = new THREE.Clock();
  t = 0;
  paused = false;
  started = false;
  finished = false;
  envBlend = 1;
  private envFrom: EnvPreset = ENV.PRESENT;
  private promptsShown = new Set<string>();
  private debug = false;
  /**
   * `?perf` (session 13): a compact live readout on any device — phones have no backquote key — refreshed twice a second
   * (fps, frame / step / render / GPU ms as p50/p95 of the last 120 frames, draw calls, drawn Echoes, pixels, heap).
   */
  private perfHud = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');
  private perfHudT = 0;
  fps = 60;
  private fpsAcc = 0;
  private fpsN = 0;
  frameStats = { calls: 0, tris: 0 };
  deaths = 0;
  startTime = 0;
  onEnd?: () => void;
  onNextFloor?: (floor: number) => void;
  respawning = false;
  autopilot: any = null;
  perf: Perf;
  /** load phase timings (ms since load start) */
  loadTimes: Record<string, number> = {};
  floorId = 0;
  /** in-flight floor load / transition; concurrent requests share it (no duplicate loads or races) */
  private floorOp: Promise<void> | null = null;
  get loading() { return !!this.floorOp; }
  lastWarmup: WarmupReport | null = null;
  /** per-load record: floor, timings, keys released/kept (tests + CONTEXT benchmarks) */
  loadLog: { floor: number; ms: number; assetsMs: number; buildMs: number; warmup: WarmupReport | null; released: string[] }[] = [];

  touch: TouchControls | null = null;
  /** monster kinds already introduced by a bestiary card (EnemyManager.bestiary; kept across floors) */
  bestiarySeen = new Set<string>();
  /** what the tutorials have seen the player do (kept across floors) */
  learned: Learned = { moved: 0, looked: 0, hits: 0, guarded: false, dodged: false, shifted: false, sigil: false, resonance: false, heavy: false, crownbreaker: false, whirlwind: false };
  objectives!: Objectives;
  /** route guidance in the world (session 14): chevrons, beacons, the gap glow */
  guide: RouteGuide | null = null;
  /** the heroine's voice + subtitles */
  dialogue: Dialogue;
  /** level prompt ids now taught by the persistent tutorials (Objectives) instead of a timed prompt */
  private static TAUGHT_PROMPTS = new Set(['T_MOVE', 'T_COMBAT', 'T_SHIFT', 'T_CROUCH', 'T_ARMORY', 'T_HEIGHT']);
  /** gameplay announcements for objectives / dialogue / tutorials (see Signals.ts) */
  signals = new Signals();
  /** soft combat camera (touch) + attack magnetism (all inputs) */
  assist: TargetAssist;
  /** cinematic last-enemy finishers (combat/Finishers.ts) */
  finisher: Finishers;
  /** the King's lift (Floor 2 departure / Floor 3 arrival), the Crownheart, embers rising out of every abyss */
  lifts: Lift[] = [];
  heart: Crownheart | null = null;
  /**
   * The Endless Arena (session 17, game/Arena.ts): main.ts sets `arenaMode` before loading Floor III for it; the floor
   * is then built without its Echoes, its Crownheart or its story beats, and the run lives in `arena`.
   */
  arenaMode = false;
  arena: Arena | null = null;
  /**
   * A guardian's entrance (game/Arena.ts): the hero's own light swings onto it (`at`, strength `k` 0..1 — no new light,
   * so no shader changes mid-run) and the chamber flares (`flare` 0..1 lifts the ambient and the exposure).
   */
  stageLight: { at: THREE.Vector3; k: number } | null = null;
  flare = 0;
  private flared = false;
  private embers: AbyssEmbers | null = null;
  /** this floor was reached by the lift (Floor 3 opens with the arrival shot) */
  arrivedByLift = false;
  /** New Game → Guided (Floor 1's lessons, game/Tutorial.ts) or Minimal (objectives + navigation only) */
  guidance: Guidance = 'minimal';
  tutorial: Tutorial | null = null;
  /** simulation speed set by the tutorial's slow-motion beats (hit-stop / slow-mo multiply on top) */
  timeScale = 1;
  /** a floor's first start (main.ts saves progress on Floors II and III) */
  onFloorArrive?: (floor: number) => void;
  /** Esc while paused: the pause menu may consume it (closing a panel) instead of resuming */
  pauseBack?: () => boolean;
  onPause?: (on: boolean) => void;
  /** seconds played before this session's first floor (Continue): the ending card's total */
  playTimeBefore?: () => number;
  /** `?camassist=0|1` pins the soft camera; otherwise it follows the input mode (touch only) */
  camAssistPin: boolean | null = null;
  /** Adaptive resolution: multiplier on the device pixel-ratio cap (see updateDynRes). */
  renderScale = 1;
  dynResEnabled = true;
  /** Fog distances are measured from the camera: the portrait camera sits farther back, so shift them by
   *  the difference to keep the hero's surroundings exactly as smoky as in the widescreen tuning. */
  private fogShift = 0;

  constructor(container: HTMLElement, hudRoot: HTMLElement, opts: { muted?: boolean; stage?: HTMLElement } = {}) {
    installAtmosphereFog();
    // MSAA is expensive on phone GPUs and mostly redundant at their pixel densities
    const msaa = !Platform.handheld || window.devicePixelRatio < 1.5;
    this.renderer = new THREE.WebGLRenderer({ antialias: msaa, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap was removed in three r186: the first shadow render silently switched the type to PCF,
    // which invalidated every program compiled at load (a 4 s freeze on the first gameplay frame). Use PCF.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD(hudRoot);
    if (this.perfHud) this.hud.debugEl.classList.add('on', 'perf');
    this.rig = new CameraRig(this.camera);
    this.applyView();
    if (opts.stage) {
      this.touch = new TouchControls(opts.stage, this.input);
      this.touch.onPause = () => { if (this.started && !this.finished) this.togglePause(); };
      this.hud.onInteractText = (t, title, off, verb, read) => this.touch?.setInteract(t, title, off, verb, read);
    }
    this.input.autoCrouch = Platform.isTouch;
    const ca = new URLSearchParams(location.search).get('camassist');
    if (ca === '0' || ca === '1') this.camAssistPin = ca === '1';
    this.assist = new TargetAssist(() => this.enemyList(), () => this.level.collision, () => this.time.state);
    this.finisher = new Finishers(this);
    this.perf = new Perf(this.renderer);
    this.audio = new AudioFX({ muted: opts.muted });
    this.dialogue = new Dialogue(this, !!opts.muted);
    this.assets = new GameAssets(this.renderer, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.perf.counters = () => ({ activeEnemies: this.enemies?.activeCount ?? 0, enemies: this.enemies?.enemies.length ?? 0 });
    this.scene.add(this.hemi, this.sun, this.sun.target, this.playerLight, this.fill, this.fill.target);
    this.fill.position.set(-0.55, 0.45, 0.7);
    this.atmo = new Atmosphere(this.scene, new THREE.Vector3(0.45, 0.42, -0.79));
    this.sun.castShadow = true;
    // phones: half the shadow resolution (same coverage — the dark Present look is unchanged)
    const sm = Platform.quality.shadowMap;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.fog = new THREE.Fog(0x000000, 10, 80);
    // persistent across floors (their per-floor state is cleared on unload)
    this.fx = new Effects(this.scene, this.camera);
    this.gore = new Gore(this.scene, (o, d, far) => {
      const h = this.level.collision.raycast(o, d, far, this.time.state);
      return h ? { point: h.point, normal: h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0) } : null;
    });
    Platform.onChange(() => {
      this.input.autoCrouch = Platform.isTouch;
      if (Platform.isTouch) document.exitPointerLock?.();
      this.applyView();
      this.resize();
    });
    this.resize();
    (window as any).__game = this;
  }

  /**
   * The camera profile follows the layout (Platform.view) and the input: desktop widescreen, a phone held sideways
   * (wideTouch) or the portrait frame. Called at start and whenever the view or input mode changes — mid-game too.
   */
  applyView() {
    const id: CamProfileId = Platform.isPortrait ? 'portrait' : Platform.isTouch ? 'wideTouch' : 'wide';
    if (id === this.rig.profileId) return;
    this.rig.setProfile(id, this.rig.profileId !== null);
    this.setFogShift(this.rig.profile.distance - 4.4);
  }

  /** Move the fog by the camera's distance difference from the widescreen tuning (keeps the hero's surroundings equally smoky). */
  private setFogShift(v: number) {
    const d = v - this.fogShift;
    if (!d) return;
    const f = this.scene.fog as THREE.Fog | null;
    if (f) { f.near += d; f.far += d; }
    this.fogShift = v;
  }

  /**
   * Device pixel ratio policy: desktop <= 1.75; handhelds <= 2 and <= a 1.6 MP render budget (a 1080x1920-class
   * portrait phone renders ~0.9-1.6 MP instead of 2-4 MP), times the adaptive render scale.
   */
  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    let pr = Math.min(dpr, 1.75);
    if (Platform.handheld) {
      const px = Math.max(1, Platform.width * Platform.height);
      pr = Math.min(dpr, 2, Math.sqrt(1.6e6 / px));
    }
    return Math.max(0.5, pr * this.renderScale);
  }

  resize() {
    const w = Platform.width, h = Platform.height;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h);
    this.rig.applyViewport(w, h, Platform.isTouch);
    if (this.menuIdle) this.menuCamera();
  }

  /**
   * Adaptive resolution from real frame intervals (1.5 s windows): drop the render scale 10 % when frames run
   * slower than ~45 fps, raise it 5 % after sustained headroom. A drop that does not speed frames up (a 30 Hz
   * cap or a CPU-bound phase) is reverted and that floor remembered, so quality is never lost for nothing.
   */
  private dyn = { acc: 0, n: 0, good: 0, lastAvg: 0, pendingCheck: false, floor: 0.6 };
  private updateDynRes(realDt: number) {
    if (!this.dynResEnabled || this.paused || !this.started) return;
    const d = this.dyn;
    d.acc += realDt; d.n++;
    if (d.acc < 1.5) return;
    const avg = (d.acc / d.n) * 1000;
    d.acc = 0; d.n = 0;
    if (d.pendingCheck) {
      d.pendingCheck = false;
      if (avg > d.lastAvg * 0.93) { d.floor = Math.min(1, this.renderScale + 0.1); this.setRenderScale(this.renderScale + 0.1); return; }
    }
    if (avg > 22 && this.renderScale > d.floor + 1e-3) {
      d.lastAvg = avg; d.pendingCheck = true; d.good = 0;
      this.setRenderScale(this.renderScale - 0.1);
    } else if (avg < 17.5) {
      if (++d.good >= 3 && this.renderScale < 1) { d.good = 0; this.setRenderScale(this.renderScale + 0.05); }
    } else d.good = 0;
  }
  setRenderScale(s: number) {
    const v = Math.round(THREE.MathUtils.clamp(s, 0.6, 1) * 100) / 100;
    if (v === this.renderScale) return;
    this.renderScale = v;
    this.perf.mark('render scale ' + v);
    this.resize();
  }

  floor: FloorDef = FLOORS[1];
  fractures!: Fractures;
  gore!: Gore;
  private fovPunch = 0;
  /** Brief zoom-in on kills (decays in step). */
  kickFov(deg: number) { this.fovPunch = Math.max(this.fovPunch, deg); }

  // ------------------------------------------------------------------ asset lifecycle
  /**
   * Initial load: core resources (hero, shared sounds), the ambience beds (unless muted) and floor `id`,
   * under one byte-weighted progress bar. Returns once the floor is built and GPU-warmed.
   */
  /** the title score is ready to play (main.ts starts it as soon as the browser allows sound) */
  onMusicReady?: () => void;
  boot(id: number, sink: LoadSink): Promise<void> {
    if (this.floorOp) return this.floorOp;
    this.assets.audioCtx = this.audio.createContext();
    // session 14: the title score first — its exploration track (2.5 MB) loads ahead of the floor so it can play under
    // the loading card and the title screen (Music waits for the browser to allow sound: autoplay or a first gesture)
    if (this.audio.ambienceEnabled || this.audio.scoreInMute) {
      const m = this.assets.manager;
      void m.acquire('music', ['music:explore']).then(() => {
        if (!this.audio.music) this.audio.bindMusic(m.get('music:explore'), m.has('music:combat') ? m.get('music:combat') : null);
        this.onMusicReady?.();
      }).catch((err) => console.warn('[music] the score did not load:', err));
    }
    const extra = [{ scope: 'core', keys: this.assets.coreKeys() }];
    if (this.audio.ambienceEnabled) {
      extra.push({ scope: 'ambience', keys: this.assets.ambienceKeys() });
      // the score is shared by every floor (audio/Music.ts); silent automation runs never load it
      extra.push({ scope: 'music', keys: this.assets.musicKeys() });
    }
    const op = this.loadFloor(id, sink, extra).finally(() => { this.floorOp = null; });
    this.floorOp = op;
    return op;
  }

  /**
   * Floor transition behind the loading screen: stop the loop, keep what the next floor shares with this one,
   * tear the current floor down and dispose every resource only it used, load + build + warm the next floor.
   * HP and resonance carry over. Re-entrant calls return the same promise.
   */
  transitionTo(next: number, sink: LoadSink): Promise<void> {
    if (this.floorOp) return this.floorOp;
    if (!FLOORS[next]) return Promise.reject(new Error('No floor ' + next));
    const op = (async () => {
      // "Try again" after a failed load (the old floor is already gone): resume with the same carry. Everything that
      // did arrive is still resident under the new floor's scope, so only the failed files are asked for again.
      const again = this.failedLoad?.next === next ? this.failedLoad : null;
      this.failedLoad = null;
      let carry: { hp: number; charge: number; unlocked: boolean; shifts: number }, released: string[];
      if (again) {
        ({ carry, released } = again);
        sink(0, 'Seeking the way again');
      } else {
        carry = { hp: this.player.hp, charge: this.time.charge, unlocked: this.time.unlocked, shifts: this.time.shiftCount };
        this.stop();
        const m = this.assets.manager;
        const prev = this.floorId;
        sink(0, 'Leaving ' + (FLOORS[prev]?.subtitle ?? 'the floor'));
        m.retain('floor' + next, this.assets.floorKeys(next));
        this.dialogue.release(prev);
        this.unloadFloor();
        released = m.release('floor' + prev);
        for (const k of released) if (k.startsWith('snd:')) this.audio.unbind(k.slice(4));
        this.perf.mark(`transition ${prev}→${next}: released ${released.length}`);
      }
      try {
        await this.loadFloor(next, sink, [], released);
      } catch (err) {
        // a download that never came (no connection): nothing of the new floor was built yet, so it can be retried
        // in place; a failure while building is a real bug and needs a reload
        if (!this.building) this.failedLoad = { next, carry, released };
        throw err;
      }
      // Floor 2's lift lands at Floor 3's lift foot: the arrival shot plays when the floor starts
      this.arrivedByLift = !this.arenaMode && this.level.markersOf('lift').some((m) => m.props.role === 'arrive');
      this.time.unlocked = true;
      this.time.charge = Math.max(100, carry.charge);
      this.time.shiftCount = carry.shifts;
      this.player.hp = Math.max(this.player.maxHp * 0.5, carry.hp);
      this.finished = false;
    })().finally(() => { this.floorOp = null; });
    this.floorOp = op;
    return op;
  }

  /** a floor transition whose downloads failed (transitionTo resumes it on "Try again") */
  private failedLoad: { next: number; carry: { hp: number; charge: number; unlocked: boolean; shifts: number }; released: string[] } | null = null;
  /** loadFloor is past its downloads and building the floor (a failure from here on is not retryable) */
  private building = false;
  /** the next floor's bytes were requested ahead of the transition (prefetchNext) */
  private prefetched = -1;
  private prefetchT = 0;

  /**
   * Download the next floor's files while this one is still being played (session 11): once she is within 45 m of the
   * way out — Floor 1's exit, Floor 2's King's lift — its GLBs, textures, sounds and voice lines stream into memory,
   * so the chapter card after the lift decodes instead of downloading (and a connection that drops at that moment no
   * longer strands her on the card).
   */
  private prefetchNext() {
    const next = this.floor.next;
    if (!next || this.prefetched === next || this.t < this.prefetchT) return;
    this.prefetchT = this.t + 0.5;
    const ways = [...this.level.markersOf('lift').filter((m) => m.props.role === 'depart').map((m) => m.pos), ...this.level.markersOf('exit').map((m) => m.box ? m.box.getCenter(new THREE.Vector3()) : m.pos)];
    if (!ways.some((w) => w.distanceTo(this.player.pos) < 45)) return;
    this.prefetched = next;
    const vo = this.dialogue.loadKeys(next);
    const keys = [...this.assets.floorKeys(next), ...vo.core, ...vo.floor];
    const t0 = performance.now();
    void this.assets.manager.prefetch(keys).then((b) => this.perf.mark(`prefetch floor ${next}: ${(b / 1e6).toFixed(1)} MB in ${Math.round(performance.now() - t0)} ms`));
  }

  private async loadFloor(id: number, sink: LoadSink, extra: { scope: string; keys: string[] }[] = [], released: string[] = []) {
    const t0 = performance.now();
    const def = FLOORS[id];
    if (!def) throw new Error('No floor ' + id);
    this.floor = def;
    this.floorId = id;
    this.building = false;
    const m = this.assets.manager;
    const keys = this.assets.floorKeys(id);
    const vo = this.dialogue.loadKeys(id);
    const voice = [{ scope: 'vo-core', keys: vo.core }, { scope: 'floor' + id, keys: vo.floor }].filter((x) => x.keys.length);
    await m.acquireAll([...extra, { scope: 'floor' + id, keys }, ...voice], (p) => sink(p.fraction * 0.78, `${def.loadingText} — ${p.label} (${p.done}/${p.count})`));
    this.building = true;
    for (const k of [...this.assets.coreKeys(), ...this.assets.ambienceKeys(), ...keys]) {
      if (k.startsWith('snd:') && m.has(k) && !this.audio.isBound(k.slice(4))) this.audio.bind(k.slice(4), m.get<AudioBuffer[]>(k));
    }
    if (!this.audio.music && m.has('music:explore')) this.audio.bindMusic(m.get('music:explore'), m.has('music:combat') ? m.get('music:combat') : null);
    if (m.has('music:combat')) this.audio.music?.setCombat(m.get('music:combat'));
    const t1 = performance.now();
    sink(0.8, `${def.loadingText} — raising the walls`);
    await yieldFrame();
    if (!this.player) {
      this.player = new Player(m.get('glb:hero'));
      this.scene.add(this.player.root);
    }
    // floor rewards follow the floor reached (Floor 2: Crownbreaker, Floor 3: + Whirlwind) — also for ?floor=N
    this.player.abilities = abilitiesForFloor(id);
    this.abilityRevealAt = -1;
    this.abilityReminderUntil = -1;
    this.hud.clearAbility();
    const man = (floorManifests as Record<string, { materials: string[]; veg: string[] }>)[id];
    this.mats = new MaterialLibrary((set) => m.get('tex:' + set));
    this.mats.createAll(man.materials);
    this.level = new Level(this.mats);
    this.level.build(m.get('glb:level:' + id), m.get('glb:col:' + id));
    // the level took over the visual GLB's meshes and merged the collision: drop both templates now
    m.evict('glb:level:' + id);
    m.evict('glb:col:' + id);
    this.level.buildVegetation(Object.fromEntries(man.veg.map((v) => [v, m.get('veg:' + v)])));
    this.scene.add(this.level.root);
    this.atmo.buildShafts(this.level.collision, ENV.PRESENT.sunDir, def.moonHoles);
    this.atmo.sky.visible = !def.noSky;
    this.time = new TimeSystem(this.level);
    const rigs = new Map<any, EnemyTemplate>();
    for (const k of keys) if (k.startsWith('glb:enemy:')) rigs.set(k.slice('glb:enemy:'.length), m.get(k));
    this.enemies = new EnemyManager(this);
    this.enemies.nav = new NavGrid(m.get<ArrayBuffer>('nav:' + id));
    this.enemies.build(rigs, this.arenaMode ? { pool: ARENA_POOL } : undefined);
    this.checkpoints = new Checkpoints(this);
    this.objectives = new Objectives(this, this.learned);
    this.guide = new RouteGuide(this);
    this.dialogue.attach(id);
    this.fractures = new Fractures(this);
    this.lifts = this.level.markersOf('lift').map((m) => new Lift(this, m));
    const hm = this.level.markersOf('heart')[0];
    this.heart = hm && !this.arenaMode ? new Crownheart(this, hm.pos.clone()) : null;
    this.embers = new AbyssEmbers(this);
    this.collectRoots();
    this.wireEvents();
    const spawn = this.level.marker('spawn', 'SPAWN');
    this.player.revive(spawn.pos, Math.PI); // three.js: Blender north (+Y) = -Z; yaw π faces -Z
    this.rig.snapBehind(this.player.yaw);
    this.setEnvironment('PRESENT', true);
    this.hud.setState('PRESENT');
    // the arena takes the chamber before the warm-up (its ward and its pool are drawn there with everything else)
    if (this.arenaMode) this.arena = new Arena(this);
    const t2 = performance.now();
    sink(0.84, `${def.loadingText} — tempering the memories`);
    await yieldFrame();
    this.lastWarmup = await this.warmGpu((f, label) => sink(0.84 + f * 0.16, `${def.loadingText} — ${label.toLowerCase()}`));
    this.loadLog.push({ floor: id, ms: Math.round(performance.now() - t0), assetsMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), warmup: this.lastWarmup, released });
    sink(1, def.readyText);
    this.building = false;
  }

  /** Force every drawable of the floor visible and render it for both time states (see assets/Warmup.ts). */
  private async warmGpu(onProgress: (f: number, label: string) => void) {
    const at = this.player.pos.clone();
    const kits = [this.enemies.warmKit(at), this.fx.warmKit(at), this.gore.warmKit(at), this.atmo.warmKit(at), this.finisher.warmKit(at)];
    if (this.heart) kits.push(this.heart.warmKit(at));
    for (const k of kits) for (const o of k.objects) this.scene.add(o);
    stabilizeShadowDepth(this.scene); // catch-all for any caster added without it
    const restoreEnemies = this.enemies.forceVisible();
    const bounds = new THREE.Box3();
    for (const mesh of this.level.allMeshes()) if (mesh.visible !== undefined) bounds.expandByObject(mesh);
    const pass = (st: TimeState) => () => { this.level.applyState(st); this.level.forceAllVisible(true); this.setEnvironment(st, true); };
    return warmup({
      renderer: this.renderer, scene: this.scene, camera: this.camera, sun: this.sun, bounds,
      passes: [pass(this.time.other), pass(this.time.state)],
      restore: () => {
        for (const k of kits) k.dispose();
        restoreEnemies();
        this.level.forceAllVisible(false);
        this.level.applyState(this.time.state);
        this.enemies.onStateChange(this.time.state);
        this.setEnvironment(this.time.state, true);
      },
      onProgress,
    });
  }

  /** Tear down everything that belongs to the current floor (assets are released separately by scope). */
  private unloadFloor() {
    this.autopilot = null;
    this.tutorial?.dispose();
    this.tutorial = null;
    this.timeScale = 1;
    this.finisher.end();
    for (const l of this.lifts) l.dispose();
    this.lifts = [];
    this.heart?.dispose(); this.heart = null; this.embers = null;
    this.enemies.dispose();
    this.checkpoints.dispose();
    this.objectives.dispose();
    this.guide?.dispose(); this.guide = null;
    this.level.dispose();
    this.mats.dispose();
    this.atmo.clearShafts();
    this.fx.clear();
    this.gore.clear();
    if (this.hatchLid) { this.scene.remove(this.hatchLid); this.hatchLid.geometry.dispose(); this.hatchLid = null; }
    this.timers = [];
    this.promptsShown.clear();
    this.pendingArenaLock = false;
    this.respawning = false;
    this.audio.stopVoices();
    this.hud.boss(null);
    this.hud.setChannel(false);
    this.hud.clearAbility();
    this.touch?.holdHint(null);
    this.player.lockTarget = null;
    // a scripted exit (the lift's descent) hands everything back before the next floor
    this.player.endScripted();
    this.rig.cine = null;
    this.hud.cinematic(false);
    this.touch?.cinematic(false);
    this.hud.fade(false);
    this.assist.reset();
  }

  /** Memory / residency snapshot (console: __game.memoryReport()). */
  memoryReport() {
    const mem = (performance as any).memory;
    const info = this.renderer.info;
    let meshes = 0, skinned = 0;
    this.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { meshes++; if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++; } });
    return {
      floor: this.floorId,
      heapMB: mem ? +(mem.usedJSHeapSize / 1e6).toFixed(1) : null,
      gl: { programs: info.programs?.length ?? 0, textures: info.memory.textures, geometries: info.memory.geometries },
      scene: { objects: this.scene.children.length, meshes, skinned },
      enemies: this.enemies?.enemies.length ?? 0,
      assets: this.assets.manager.stats(),
      resident: this.assets.manager.resident().map((r) => r.key),
    };
  }

  private wireEvents() {
    const p = this.player;
    p.events.onChannelStart = () => {
      // the Maw's fight pins this memory (EnemyManager.memoryHeld)
      const held = this.time.unlocked && this.enemies.memoryHeld();
      const c = held ? { ok: false, reason: 'The Maw holds this memory fast. Bring it down first.' } : this.time.canBegin(p);
      if (!c.ok) { this.hud.deny(c.reason!); this.audio.deny(); this.signals.emit('shift:deny', { reason: c.reason, at: 'begin' }); return false; }
      this.audio.channelStart();
      this.fx.channelStart(p.pos, this.time.other);
      return true;
    };
    p.events.onChannelCancel = () => { this.audio.channelStop(); this.fx.channelStop(); };
    p.events.onChannelComplete = () => {
      this.fx.channelStop();
      const v = this.time.commit(p);
      if (!v.ok) { this.audio.channelStop(); this.hud.deny(v.reason); this.audio.deny(); this.signals.emit('shift:deny', { reason: v.reason, at: 'commit' }); return; }
      this.signals.emit('shift', { to: this.time.state, count: this.time.shiftCount });
      // the Last Crown's wards and bindings exist in one memory only: the hero's own shift breaks them
      for (const e of this.enemies.enemies) (e as { onPlayerShift?: () => void }).onPlayerShift?.();
    };
    p.events.onInteract = () => {
      const used = this.lifts.some((l) => l.interact()) || this.checkpoints.interact();
      if (used && this.hud.interactAt) this.learned.interactTap = true;
      return used;
    };
    p.events.onDeath = () => this.onPlayerDeath();
    p.events.onFootstep = (_pos, speed) => this.audio.footstep(this.time.state, speed, p.crouching);
    p.events.onDodge = () => this.audio.dodge();
    p.events.onJump = () => this.audio.jump();
    p.events.onLand = (fall) => this.audio.land(fall);
    p.events.onBlock = (parry) => {
      this.audio.block(parry);
      // sparks where the blow meets the blade (its middle), not the hilt
      this.fx.sparks(p.blade.hilt.clone().lerp(p.blade.tip, 0.45), parry ? 30 : 12, parry ? 0xfff0c0 : 0xffc080);
      if (parry) { this.signals.emit('parry', {}); this.time.gain(12, 'parry'); this.hud.flash('#fff6d8', 0.25); this.rig.addShake(0.2); }
    };
    p.events.onAttackStart = (a) => {
      // one swing per hit window, timed to the blade's motion rather than the button press
      const weight = SWING_WEIGHT[a.kind];
      const serial = p.attackSerial;
      if (a.charge) return; // hold attacks: the swing is cued when the window opens (onHitWindow)
      a.hits.forEach((w, i) => {
        // the whoosh leads the contact slightly (paced timeline, not a constant playback speed)
        const delay = Math.max(0, realTimeTo(a, w.t0) - 0.05);
        const kickish = w.shape === 'front';
        this.schedule(delay, () => {
          if (p.attackSerial !== serial || p.state !== 'attack') return;
          this.audio.swing(kickish ? 0.2 : Math.min(1, weight + i * 0.08), undefined, kickish ? 0.55 : 1);
        });
      });
    };
    p.onAfterimage = () => this.fx.afterimage(p);
    p.events.executionTarget = () => this.enemies.executionTarget(p.pos, p.facing);
    p.events.onCharge = (level) => {
      if (p.chargeTime < 0.02) {
        this.audio.play('blade_ring', { rate: 0.8, vol: 0.9 });
        // the castle leans in: a low reversed roar under the raised blade (stopped on release)
        if (p.attack?.shock) this.chargeHum = this.audio.play('shift_charge', { rate: 1.35, vol: 0.45 });
      }
      this.fx.chargeGlow(p.blade.tip, p.blade.hilt, level);
      if (p.attack?.shock) {
        // dust and embers drawn in along the floor toward her feet, a tremble that builds with the charge
        const at = p.pos;
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 2.5 + level * 1.5;
          const from = new THREE.Vector3(at.x + Math.cos(a) * r, at.y + 0.1, at.z + Math.sin(a) * r);
          this.fx.emit(from, new THREE.Vector3(at.x - from.x, 0.4, at.z - from.z).multiplyScalar(2.2), level > 0.95 ? 0xfff0c0 : 0xffa050, 0.45, 0.05 + level * 0.04, 0);
        }
        this.rig.addShake(0.004 + level * 0.01);
        if (level >= 1 && !this.chargeFull) { this.chargeFull = true; this.audio.play('blade_ring', { rate: 1.25, vol: 1 }); this.hud.flash('#ffe2a8', 0.12); Platform.haptic(18); }
      }
    };
    p.events.onAbility = (id, phase) => {
      if (id === 'crownbreaker' && phase === 'release') { this.learned.crownbreaker = true; this.stopChargeHum(); }
      if (id === 'crownbreaker' && phase === 'start') this.chargeFull = false;
      if (id === 'whirlwind' && phase === 'start') {
        this.learned.whirlwind = true;
        this.audio.play('blade_ring', { rate: 1.3, vol: 0.8 });
        this.fx.dust(p.pos.clone().setY(p.pos.y + 0.1), 10);
      }
      this.signals.emit('ability', { id, phase });
    };
    p.events.onHitWindow = (a, i) => {
      if (a.charge) this.audio.swing(1, undefined, 1.1);
      if (a.whirl) this.fx.dust(p.pos.clone().setY(p.pos.y + 0.08), 3);
      if (a.shock) { this.crownbreakerImpact(a.hits[i].reach ?? 3.6, a.shock.reach); return; }
      // the plunge: the sword strikes the floor and a shockwave runs out (the Crownbreaker scales with its charge)
      if (a.clip === 'gs_plunge') {
        const at = p.pos.clone().addScaledVector(p.facing, 1.1);
        const lvl = a.charge ? p.chargeLevel : 0.4;
        this.schedule(0.1, () => {
          this.fx.shockwave(at, (a.hits[i].reach ?? 3) + lvl * 1.5, lvl);
          this.rig.addShake(0.3 + lvl * 0.3);
          this.audio.play('kill_impact', { pos: at, rate: 0.75 });
          this.audio.play('land_heavy', { pos: at, vol: 1.3 });
          Platform.haptic(30 + Math.round(lvl * 20));
        });
      }
    };
    this.time.onShift = (to) => {
      this.perf.mark('shift ' + to);
      if (this.hatchLid) this.hatchLid.visible = to === 'PAST' && !!this.level.collision.dynamic.find((x) => x.name === 'hatch' && x.enabled);
      this.hud.setState(to);
      this.setEnvironment(to, false);
      this.enemies.onStateChange(to);
      this.heart?.setState(to);
      this.audio.shiftBoom(to);
      this.hud.flash(to === 'PAST' ? '#ffd9a0' : '#bfe0ff', 0.55);
      this.rig.addShake(0.35);
      this.fx.shiftBurst(this.player.pos, to);
      this.signals.emit('state', { to });
    };
    this.time.onGain = (amt, reason) => { if (reason !== 'hit') this.fx.resonance(this.player, amt); };
  }

  private chargeHum: AudioBufferSourceNode | null = null;
  private chargeFull = false;
  private stopChargeHum() {
    const h = this.chargeHum;
    this.chargeHum = null;
    if (h && this.audio.ctx) { try { h.stop(this.audio.ctx.currentTime + 0.12); } catch { /* ended */ } }
  }
  /**
   * The Crownbreaker lands: the blade goes into the floor a pace ahead and the ground answers — a bright ring
   * and a slower, wider one, stone dust thrown out in a circle, sparks at the blade, a hard hit-stop and slow
   * breath, a downward camera kick, a warm flash; the stone roars. Scales with the charge.
   */
  private crownbreakerImpact(reach: number, perCharge: number) {
    const p = this.player;
    const lvl = p.chargeLevel;
    const at = p.pos.clone().addScaledVector(p.facing, 1.0);
    const r = reach + lvl * perCharge;
    this.stopChargeHum();
    this.schedule(0.08, () => {
      this.fx.shockwave(at, r, 0.6 + lvl * 0.4);
      this.schedule(0.1, () => this.fx.shockwave(at, r * 1.3, 0.25));
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        this.fx.dust(at.clone().add(new THREE.Vector3(Math.cos(a) * 1.3, 0.12, Math.sin(a) * 1.3)), 2);
      }
      this.fx.sparks(p.blade.tip.clone(), 26 + Math.round(lvl * 20), 0xffd9a0);
      this.fx.hitstop(0.06 + lvl * 0.05);
      this.fx.slowmo(0.32, 0.5);
      this.rig.addShake(0.45 + lvl * 0.25);
      this.rig.punch(new THREE.Vector3(0, -1, 0), 3.2 + lvl * 2);
      this.kickFov(3 + lvl * 4);
      this.hud.flash('#ffd9a0', 0.14 + lvl * 0.12);
      this.audio.play('kill_impact', { pos: at, rate: 0.62, vol: 1.3 });
      this.audio.play('land_heavy', { pos: at, vol: 1.5 });
      this.audio.play('rubble', { pos: at, vol: 1.1 });
      this.audio.play('shift_boom', { pos: at, rate: 1.25, vol: 0.55 + lvl * 0.25 });
      Platform.haptic(45 + Math.round(lvl * 30));
    });
  }

  setEnvironment(state: TimeState, instant: boolean) {
    this.envFrom = this.currentEnv();
    this.envTarget = this.envFor(state);
    this.envBlend = instant ? 1 : 0;
    this.atmo.setState(state, instant);
    if (instant) this.applyEnv(this.envTarget, this.envTarget, 1);
  }
  /** the floor's lighting for a memory: Game's presets with the floor's overrides (FloorDef.env) */
  envFor(state: TimeState): EnvPreset {
    // the arena lights the heart's chamber itself (data/arena.ts ARENA_ENV); else the floor's overrides
    const o = (this.arenaMode ? ARENA_ENV[state] : undefined) ?? this.floor?.env?.[state];
    if (!o) return ENV[state];
    const e: EnvPreset = { ...ENV[state] };
    for (const [k, v] of Object.entries(o)) {
      const cur = (e as unknown as Record<string, unknown>)[k];
      if (cur instanceof THREE.Color) (e as unknown as Record<string, unknown>)[k] = new THREE.Color(v as number);
      else if (cur instanceof THREE.Vector3) (e as unknown as Record<string, unknown>)[k] = new THREE.Vector3(...(v as number[])).normalize();
      else (e as unknown as Record<string, unknown>)[k] = v;
    }
    return e;
  }
  private envTarget: EnvPreset = ENV.PRESENT;
  private currentEnv(): EnvPreset {
    const f = this.scene.fog as THREE.Fog;
    return {
      bg: (this.scene.background as THREE.Color)?.clone() ?? new THREE.Color(), fog: f.color.clone(), near: f.near - this.fogShift, far: f.far - this.fogShift,
      hemiSky: this.hemi.color.clone(), hemiGround: this.hemi.groundColor.clone(), hemi: this.hemi.intensity,
      sun: this.sun.color.clone(), sunI: this.sun.intensity, sunDir: this.sunDir.clone(), exposure: this.renderer.toneMappingExposure, heroLight: this.heroLight,
      fill: this.fill.color.clone(), fillI: this.fill.intensity,
    };
  }
  private sunDir = new THREE.Vector3(0, 1, 0);
  private applyEnv(a: EnvPreset, b: EnvPreset, k: number) {
    if (!(this.scene.background instanceof THREE.Color)) this.scene.background = new THREE.Color();
    (this.scene.background as THREE.Color).copy(a.bg).lerp(b.bg, k);
    const f = this.scene.fog as THREE.Fog;
    f.color.copy(a.fog).lerp(b.fog, k);
    f.near = THREE.MathUtils.lerp(a.near, b.near, k) + this.fogShift;
    f.far = THREE.MathUtils.lerp(a.far, b.far, k) + this.fogShift;
    this.hemi.color.copy(a.hemiSky).lerp(b.hemiSky, k);
    this.hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, k);
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, k);
    this.sun.color.copy(a.sun).lerp(b.sun, k);
    this.sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
    this.sunDir.copy(a.sunDir).lerp(b.sunDir, k).normalize();
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(a.exposure, b.exposure, k);
    this.heroLight = THREE.MathUtils.lerp(a.heroLight, b.heroLight, k);
    this.fill.color.copy(a.fill).lerp(b.fill, k);
    this.fill.intensity = THREE.MathUtils.lerp(a.fillI, b.fillI, k);
    this.envNow = this.currentEnv();
  }
  private heroLight = ENV.PRESENT.heroLight;
  /** the environment as last applied: the Crownheart's tone is layered on this each frame (never accumulated) */
  private envNow: EnvPreset | null = null;
  private heartTinted = false;
  private static HERO_LIGHT = new THREE.Color(0xa8c4e8);
  /**
   * The chamber breathes with the Crownheart (session 11): near it (Crownheart.influence) the ambient, the floor's
   * bounce, the fill, the hero's own light, the fog and the exposure lean toward the heart's colour and swell and sag
   * with its energy — the lub-dub, the slow tides, the surges of the Last Crown's great casts. Crimson troughs, amber
   * and gold on the beats: the architecture, her silhouette and the heroine are all lit by it.
   */
  private applyHeartTone() {
    const h = this.heart, b = this.envNow;
    const w = h && !h.broken ? h.influence(this.player.pos) : 0;
    this.playerLight.color.copy(Game.HERO_LIGHT);
    if (!b || (w <= 0 && !this.heartTinted)) return;
    this.heartTinted = w > 0;
    const c = h!.color, e = h!.energy;
    const f = this.scene.fog as THREE.Fog;
    // Session 14: the heart OWNS the chamber's light — the ambient, the fill, the key light, the fog and the hero's own
    // light all take its colour (crimson ⇄ orange ⇄ gold with its mood) and swell with its energy, so the whole arena —
    // walls, floor, mist, the heroine, the Crown's silhouette — reads RED, then GOLD, then red again
    this.hemi.color.copy(b.hemiSky).lerp(c, 0.55 * w);
    this.hemi.groundColor.copy(b.hemiGround).lerp(c, 0.62 * w);
    this.hemi.intensity = b.hemi * (1 + (0.55 * e - 0.2) * w);
    this.fill.color.copy(b.fill).lerp(c, 0.85 * w);
    this.fill.intensity = b.fillI * (1 + (0.75 * e - 0.25) * w);
    this.sun.color.copy(b.sun).lerp(c, 0.6 * w);
    this.sun.intensity = b.sunI * (1 + (0.4 * e - 0.15) * w);
    this.playerLight.color.lerp(c, 0.8 * w);
    this.playerLight.intensity = this.heroLight * (1 + (0.6 * e - 0.15) * w);
    f.color.copy(b.fog).lerp(this._heartFog.copy(c).multiplyScalar(0.07 + 0.05 * Math.min(1.5, e)), 0.85 * w);
    this.renderer.toneMappingExposure = b.exposure * (1 + (0.09 * e - 0.035) * w);
  }
  private _heartFog = new THREE.Color();

  start() {
    if (!this.started) this.startTime = performance.now();
    this.started = true;
    // the arena: no arrival shot, no floor's reward or arrival (no save, no deed) — the run begins
    if (this.arena && this.announcedFloor !== this.floorId) { this.announcedFloor = this.floorId; this.arena.begin(); }
    else if (this.announcedFloor !== this.floorId) {
      this.announcedFloor = this.floorId;
      // a Continue mid-floor keeps the death count she had when she first came here (resumeAt)
      this.arriveDeaths = this.resumeArriveDeaths ?? this.deaths;
      this.resumeArriveDeaths = null;
      // reached by the King's lift: the arrival shot (the hero stands on the cage at the spawn)
      if (this.arrivedByLift) { this.arrivedByLift = false; this.heart?.setState(this.time.state); for (const l of this.lifts) l.arrive(); }
      else this.heart?.setState(this.time.state);
      // after the floor's title card: the reward this floor's arrival brings (none on Floor 1)
      this.schedule(4.2, () => this.announceAbilities());
      this.onFloorArrive?.(this.floorId);
      this.signals.emit('floor:arrive', { id: this.floorId, deaths: this.arriveDeaths });
    }
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  private announcedFloor = -1;
  /** deaths when she arrived on this floor */
  arriveDeaths = 0;
  private resumeArriveDeaths: number | null = null;

  /** The floor's progress for a save (game/Save.ts): the last Blood Sigil and what the floor remembers; null before one. */
  captureCheckpoint(): CheckpointState | null {
    const c = this.checkpoints?.capture();
    if (!c) return null;
    return {
      ...c, unlocked: this.time.unlocked, shifts: this.time.shiftCount, cleared: this.enemies.clearedIds(), flags: [...this.level.flags],
      arriveDeaths: this.arriveDeaths,
    };
  }

  /**
   * Continue from a Blood Sigil (session 16; the floor freshly built, play not started): what the floor remembers is put
   * back — fractures broken, encounters cleared, sigils lit, memories read, shifting learned — and she wakes at the sigil
   * as after a death. Returns false when the sigil is not on this floor (an older or newer build): she starts at the
   * floor's beginning instead.
   */
  resumeAt(cp: CheckpointState): boolean {
    this.time.unlocked = cp.unlocked || this.time.unlocked;
    this.time.shiftCount = Math.max(this.time.shiftCount, cp.shifts);
    for (const f of cp.flags) this.level.setFlag(f);
    this.enemies.restoreCleared(cp.cleared);
    if (cp.arriveDeaths !== undefined) this.resumeArriveDeaths = cp.arriveDeaths;
    const ok = this.checkpoints.restore(cp);
    this.player.lastSafe.copy(this.player.pos);
    // Guided on Floor I: the lessons resume where she wakes, or are over (CP3 is the tutorial's last sigil)
    if (this.tutorial && !(ok && this.tutorial.resumeFrom(cp.cid))) {
      this.learned.tutorial = true;
      this.tutorial.dispose();
      this.tutorial = null;
    }
    return ok;
  }
  /** game time of this floor's ability reveal (-1 = none yet); the persistent tip follows it */
  private abilityRevealAt = -1;
  /**
   * Clearing a floor strengthened her: a short gilded reveal (name + input), a pulse of the castle's light at her
   * feet, and one line in her own voice. The how-to then stays as a small tip until she has done it once.
   */
  announceAbilities() {
    const fresh = [...this.player.abilities].filter((a) => ABILITY_FLOOR[a] === this.floorId);
    this.abilityRevealAt = this.t;
    if (!fresh.length) return;
    const id = fresh[0], info = ABILITY_INFO[id];
    // already performed (Continue on a floor where she used it): a short reminder, not the whole reveal again
    if (this.learned[id]) { this.abilityReminderUntil = this.t + 5; return; }
    this.hud.abilityReveal(info.name, info.input);
    this.fx.shiftBurst(this.player.pos, this.time.state);
    this.fx.resonanceFrom(this.player.pos.clone().setY(this.player.pos.y + 3), this.player, 60);
    // core sounds only (floor-scoped ones such as the Crown's are not loaded on Floor 2)
    this.audio.play('resonance', { vol: 0.9, rate: 0.62 });
    this.audio.play('shift_charge', { vol: 0.3, rate: 1.5 });
    this.audio.play('sigil', { vol: 0.7 });
    this.rig.addShake(0.12);
    Platform.haptic(20);
    this.signals.emit('ability:unlock', { id });
    this.dialogue.sayId(info.line);
  }
  /** a learned reward's reminder tip runs until this game time (announceAbilities) */
  private abilityReminderUntil = -1;
  /**
   * The persistent tip teaches THIS floor's reward only (Floor 2: Crownbreaker / HOLD HEAVY, Floor 3: Whirlwind /
   * HOLD LIGHT) until she has performed it. Session 11: an older reward never performed used to take the tip over on
   * the next floor (Floor 3 showed HOLD HEAVY once the Whirlwind had been tried) — the Controls panel keeps them all.
   */
  private updateAbilityTip() {
    const p = this.player;
    let pending: AbilityId | null = null;
    for (const a of p.abilities) if (ABILITY_FLOOR[a] === this.floorId && (!this.learned[a] || this.t < this.abilityReminderUntil)) pending = a;
    const show = !!pending && this.abilityRevealAt >= 0 && this.t - this.abilityRevealAt > (this.t < this.abilityReminderUntil ? 0 : 4.5) && p.alive && !this.finisher?.active;
    if (!show) { this.hud.abilityTip(null); this.touch?.holdHint(null); return; }
    const info = ABILITY_INFO[pending!];
    this.hud.abilityTip(info.input, Platform.isTouch ? info.touch : info.kbm);
    this.touch?.holdHint(pending === 'crownbreaker' ? 'heavy' : 'light');
  }

  // ------------------------------------------------------------------ the Crownheart's crystal roots
  /**
   * The crystal roots (Floor 3: arching over the Hall of Roots, leaning off the arena's pillar stumps) are scenery
   * without collision, so the camera — portrait sits high and far behind her — used to end up inside them and the
   * frame filled with glowing orange. Whenever a root stands between her and the camera they all fade out. Their
   * materials are transparent from the start (the program is compiled at load; toggling would recompile).
   */
  private roots: THREE.Mesh[] = [];
  private rootMats: THREE.Material[] = [];
  private rootFade = 1;
  private rootRay = new THREE.Raycaster();
  private collectRoots() {
    this.roots = [];
    this.rootMats = [];
    this.level.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.matKey === 'fx_root') this.roots.push(m); });
    if (!this.roots.length) return;
    for (const st of ['PAST', 'PRESENT'] as TimeState[]) { this.mats.get('fx_root', st, 'SHARED'); this.mats.get('fx_root', st, st); }
    this.rootMats = this.mats.variants('fx_root');
    for (const m of this.rootMats) m.transparent = true;
    this.rootFade = 1;
  }
  private _rh = new THREE.Vector3();
  private _rd = new THREE.Vector3();
  private updateRoots(dt: number) {
    if (!this.roots.length) return;
    const head = this._rh.copy(this.player.pos).setY(this.player.pos.y + 1.4);
    const dir = this._rd.subVectors(this.camera.position, head);
    const len = dir.length();
    let hit = false;
    if (len > 0.05) {
      this.rootRay.set(head, dir.divideScalar(len));
      this.rootRay.far = len + 0.4;
      for (const m of this.roots) {
        if (!m.visible || !m.parent?.visible) continue;
        if (this.rootRay.intersectObject(m, false).length) { hit = true; break; }
      }
    }
    const want = hit ? 0.02 : 1;
    this.rootFade += (want - this.rootFade) * Math.min(1, dt * (hit ? 14 : 4));
    for (const m of this.rootMats) m.opacity = this.rootFade;
  }

  /** Stop the frame loop (floor transitions). */
  stop() { this.renderer.setAnimationLoop(null); }

  /** New Game's choice. Guided on Floor 1 = the lessons (game/Tutorial.ts); later floors never teach again. */
  setGuidance(g: Guidance) {
    this.guidance = g;
    this.tutorial?.dispose();
    this.tutorial = g === 'guided' && this.floorId === 1 && !this.learned.tutorial ? new Tutorial(this) : null;
  }

  // ------------------------------------------------------------------ title screen backdrop
  /**
   * The title screen draws the loaded floor behind the menu: a slow, low shot drifting past the hero toward the
   * rusted gate (Floor 1) — atmosphere, flames, dust and her idle only; nothing is simulated, nothing wakes.
   */
  private menuT = 0;
  /** the title screen's heroine (character/MenuIdle.ts) while the title shows */
  menuIdle: MenuIdle | null = null;
  /** the lore book covers the title: the castle behind it stops drawing (a phone's battery), then carries on */
  menuPause(on: boolean) {
    if (!this.menuIdle) return;
    if (on) { this.renderer.setAnimationLoop(null); return; }
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.menuFrame());
  }
  /** the title's animation pack (hero_menu.glb, 1.4 MB): loaded behind the title, dropped when play begins */
  loadMenuPack() {
    return this.assets.manager.acquire('menu', ['glb:hero-menu']).then(() => {
      if (!this.menuIdle) { this.assets.manager.release('menu'); return; }
      this.player.anim.addClips(this.assets.manager.get<THREE.AnimationClip[]>('glb:hero-menu'));
    }).catch((err) => console.warn('[menu] the title animations did not load:', err));
  }
  menuScene(on: boolean) {
    if (!on) {
      this.renderer.setAnimationLoop(null);
      this.menuIdle?.dispose();
      this.menuIdle = null;
      // back to her gameplay facing (the title turned her toward the camera) and the gameplay clip set
      this.player.root.rotation.y = this.player.yaw;
      this.player.anim.removeClips(MENU_PACK_IDS);
      this.assets.manager.release('menu');
      this.resize();
      return;
    }
    this.menuT = 0;
    this.menuIdle = new MenuIdle(this.player.anim, this.player.model);
    this.enemies.menuVisibility(this.player.pos);
    this.menuCamera();
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.menuFrame());
  }
  /** the title's lens (no gameplay lens shift); re-applied after a resize or a view change while the title shows */
  private menuCamera() {
    this.camera.clearViewOffset();
    this.camera.aspect = Platform.width / Platform.height;
    // widescreen: 44° tall, but never wider than ~92° across (ultrawide, a phone held sideways)
    const cap = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(92) / 2) / this.camera.aspect));
    this.camera.fov = Platform.isPortrait ? 62 : Math.min(44, cap);
    this.camera.updateProjectionMatrix();
  }
  private menuFrame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.menuT += dt;
    const p = this.player;
    // session 15: she faces the player. The camera stands where it always did (on the gate's side of her, looking
    // past her at the rusted gate and the keep) and she has turned round toward it — a three-quarter view (face: her
    // offset from looking straight into the lens), the castle behind her. Portrait: she stands between the name above
    // and the menu below; widescreen: she and the gate sit in the right half.
    const S = Platform.isPortrait
      ? { dist: 3.95, h: 1.25, look: 2.2, ty: 0.45, side: -0.3, span: 0.22, lat: 0, face: -0.38 }
      : { dist: 4.1, h: 1.35, look: 5, ty: 1.15, side: -0.15, span: 0.2, lat: -2.6, face: -0.45 };
    Object.assign(S, (window as unknown as { __menuShot?: object }).__menuShot);
    const k = Math.sin(this.menuT * 0.05) * 0.5 + 0.5;
    const yaw = p.yaw + Math.PI + S.side + (k - 0.5) * S.span;
    p.root.rotation.y = p.yaw + Math.PI + S.side + S.face;
    const cam = this.camera;
    cam.position.set(p.pos.x + Math.sin(yaw) * S.dist, p.pos.y + S.h + k * 0.2, p.pos.z + Math.cos(yaw) * S.dist);
    const ahead = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    // lat > 0 aims right of her line (she and the gate move left in the frame), < 0 left of it
    cam.lookAt(p.pos.x + ahead.x * S.look - ahead.z * S.lat, p.pos.y + S.ty, p.pos.z + ahead.z * S.look + ahead.x * S.lat);
    cam.updateMatrixWorld();
    if (this.menuIdle) this.menuIdle.update(dt, cam);
    else { p.anim.setBase({ [LOOPING.has('idle') ? 'idle' : 'idle_combat']: 1 }); p.anim.update(dt); }
    const t = this.t + this.menuT;
    this.atmo.update(dt, t, cam, p.pos, p.pos.y, (this.scene.fog as THREE.Fog).color);
    this.level.update(dt, t, p.pos);
    this.fx.update(dt, t);
    // her light stands on the camera's side for the title (a soft key on her face; the moon is behind her)
    this.playerLight.position.set(p.pos.x + Math.sin(yaw) * 1.6, p.pos.y + 2.1, p.pos.z + Math.cos(yaw) * 1.6);
    this.playerLight.intensity = this.heroLight * 1.35;
    this.sun.position.copy(p.pos).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(p.pos);
    this.renderer.render(this.scene, cam);
  }

  private frame() {
    if (this.takePendingNext()) return;
    let dt = this.clock.getDelta();
    this.updateDynRes(dt);
    dt = Math.min(dt, 1 / 20);
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    if (this.input.wasPressed('pause') && performance.now() > this.pauseKeyHold && !(this.paused && this.pauseBack?.())) this.togglePause();
    if (this.input.wasPressed('debug')) { this.debug = !this.debug; this.hud.debugEl.classList.toggle('on', this.debug); }
    this.perf.beginStep();
    if (!this.paused) this.step(dt);
    this.perf.endStep();
    this.perf.beginRender();
    this.renderer.render(this.scene, this.camera);
    this.perf.endRender();
    this.frameStats.calls = this.renderer.info.render.calls;
    this.frameStats.tris = this.renderer.info.render.triangles;
    this.input.endFrame(dt);
  }

  /** the Esc that released the pointer (main.ts paused on that) must not also un-pause a moment later */
  pauseKeyHold = 0;
  togglePause(on?: boolean) {
    this.paused = on ?? !this.paused;
    this.hud.pauseEl.classList.toggle('on', this.paused);
    this.onPause?.(this.paused);
    if (this.paused) { document.exitPointerLock?.(); this.touch?.releaseAll(); this.input.releaseAll(); }
  }

  /**
   * Portrait (and a phone held sideways, a little): pull the camera back when a fight crowds the frame (a melee pack, a
   * boss). The desktop widescreen profile has no pull (maxPull 0).
   */
  private fightPull() {
    const k = Platform.isPortrait ? 1 : Platform.isTouchWide ? 0.6 : 0;
    if (!k || !this.enemies.inCombat) return 0;
    let near = 0;
    const b = this.enemies.boss;
    // a boss anywhere in a 16 m fight (the Last Crown fights at range) widens the frame
    let boss = !!b && b.triggered && b.alive && b.pos.distanceTo(this.player.pos) < 16;
    for (const e of this.enemies.threats(this.player.pos, 9, 0)) {
      if (e.arch.boss) boss = true;
      else if (!e.isRanged) near++;
    }
    return (Math.max(0, near - 1) * 0.45 + (boss ? 1.1 : 0)) * k;
  }

  private threatList: Threat[] = [];
  private incoming: THREE.Vector3[] = [];
  private _tv = new THREE.Vector3();
  private _tp = new THREE.Vector3();
  /**
   * Off-screen threat markers: engaged enemies outside the frame, placed on the stage edge in the direction you would
   * turn to face them (radar mapping: screen-up = camera forward). Telegraphing or aiming enemies glow hot; archers are
   * tinted so the long-range threat is always accounted for. Session 16: in every layout (they began as portrait-only;
   * the widescreen frame is wider, but an archer behind you is still behind you).
   */
  private updateThreats() {
    const out = this.threatList;
    out.length = 0;
    if (this.started && this.player.alive) {
      const fwd = this.rig.forward(this._tv);
      const fx = fwd.x, fz = fwd.z;
      const pp = this.player.pos;
      for (const e of this.enemies.threats(pp, 13, 34)) {
        const v = this._tp.copy(e.center).project(this.camera);
        if (v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.9) continue;
        const dx = e.pos.x - pp.x, dz = e.pos.z - pp.z;
        const right = dx * -fz + dz * fx, ahead = dx * fx + dz * fz;
        const hot = e.isRanged ? e.state === 'shoot' && e.shootPhase === 1 : e.state === 'attack' || e.state === 'windup' || e.state === 'dive' || e.state === 'lunge';
        out.push({ x: right, y: -ahead, ranged: e.isRanged, hot });
        if (out.length >= 6) break;
      }
      // spells flying in from outside the frame (the Last Crown's bolts)
      const lc = this.enemies.boss as { spells?: { incoming(from: THREE.Vector3, out: THREE.Vector3[]): THREE.Vector3[] } } | null;
      if (lc?.spells) for (const q of lc.spells.incoming(pp, this.incoming)) {
        if (out.length >= 6) break;
        const v = this._tp.copy(q).project(this.camera);
        if (v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.9) continue;
        const dx = q.x - pp.x, dz = q.z - pp.z;
        out.push({ x: dx * -fz + dz * fx, y: -(dx * fx + dz * fz), ranged: true, hot: true });
      }
    }
    this.hud.setThreats(out);
  }

  /** unscaled frame time (hit-stop / slow-mo shakes and springs run on real time) */
  realDt = 1 / 60;
  step(dt: number) {
    this.realDt = dt;
    if (this.timeScale < 1) dt *= this.timeScale;
    if (this.fx.hitstopTime > 0) { this.fx.hitstopTime -= dt; dt *= 0.06; }
    else if (this.fx.slowTime > 0) { this.fx.slowTime -= dt; dt *= this.fx.slowScale; }
    this.t += dt;
    this.runTimers();
    const p = this.player;
    this.autopilot?.update(dt);
    // lock-on (keyboard/mouse; the touch HUD relies on the soft camera instead)
    if (this.input.wasPressed('lock')) {
      if (p.lockTarget) p.lockTarget = null;
      else p.lockTarget = this.enemies.pickLockTarget(p.pos, this.rig.forward());
    }
    if (p.lockTarget && !p.lockTarget.alive) p.lockTarget = null;
    this.rig.lockTarget = p.lockTarget?.pos ?? null;
    this.finisher.update(dt);
    p.update(dt, this.input, this.rig, this.level.collision, this.time.state, (kind, wish) => this.assist.meleeTarget(kind, p.pos, wish, p.facing, this.t));
    this.enemies.update(dt);
    this.arena?.update(dt);
    this.time.update(dt);
    // passive Resonance (TimeSystem.passive): slow, capped at one shift, paused in combat and during scripted scenes
    this.time.passive(dt, this.enemies.inCombat || this.player.scripted || this.finisher.active);
    this.checkpoints.update(dt);
    for (const l of this.lifts) l.update(dt);
    this.heart?.update(dt);
    this.embers?.update(dt);
    if (!this.arena) { this.objectives.update(dt); this.guide?.update(dt); }
    this.tutorial?.update(this.realDt);
    this.dialogue.update(this.realDt);
    this.fractures.update(dt);
    this.updateVoidAndPrompts();
    // engage the finale lock only once the player stands on the hall floor clear of the hatch
    if (this.pendingArenaLock && p.grounded && p.pos.y > -0.1 && !(p.pos.x > 13.8 && p.pos.x < 17.7 && -p.pos.z > 31.8 && -p.pos.z < 38.8)) {
      this.pendingArenaLock = false;
      if (!this.enemies.isCleared('E13')) this.setArenaLock(true);
    }
    // environment blend
    if (this.envBlend < 1) {
      this.envBlend = Math.min(1, this.envBlend + dt / 1.4);
      const k = this.envBlend * this.envBlend * (3 - 2 * this.envBlend);
      this.applyEnv(this.envFrom, this.envTarget, k);
    }
    this.sun.position.copy(p.pos).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(p.pos);
    this.rig.inCombat = this.enemies.inCombat;
    this.rig.pullWant = this.fightPull();
    // touch swipes reach the camera through a short ease on real time (hit-stop never makes looking sluggish)
    if (this.touch && Platform.isTouch) this.touch.flushLook(this.realDt);
    const look = this.input.consumeLook();
    this.assist.cameraEnabled = (this.camAssistPin ?? Platform.isTouch) && !p.lockTarget && p.alive && !this.autopilot && !this.finisher.active;
    this.rig.yaw += this.assist.cameraYaw({
      dt, now: this.t, yaw: this.rig.yaw, halfHFov: Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect),
      playerPos: p.pos, camPos: this.camera.position, wish: this.wishWorld(), manual: Math.abs(look.dx) + Math.abs(look.dy) > 1e-4,
    });
    this.learned.looked += Math.abs(look.dx) + Math.abs(look.dy);
    this.rig.update(dt, p.pos, look, this.level.collision, this.time.state, p.crouching);
    this.updateRoots(this.realDt);
    this.updateThreats();
    // hero light: above and slightly toward the camera, so what the player faces is lit
    const toCam = this.camera.position.clone().sub(p.pos).setY(0).normalize();
    this.playerLight.position.copy(p.pos).addScaledVector(toCam, 1.1).setY(p.pos.y + 2.3);
    this.playerLight.intensity = this.heroLight;
    if (this.stageLight) {
      this.playerLight.position.lerp(this.stageLight.at, this.stageLight.k);
      this.playerLight.intensity = this.heroLight + 22 * this.stageLight.k;
    }
    this.applyHeartTone();
    if (this.flare > 0.001 && this.envNow) {
      this.flared = true;
      this.hemi.intensity = this.envNow.hemi * (1 + 0.7 * this.flare);
      this.renderer.toneMappingExposure = this.envNow.exposure * (1 + 0.2 * this.flare);
    } else if (this.flared && this.envNow) {
      this.flared = false;
      this.hemi.intensity = this.envNow.hemi;
      this.renderer.toneMappingExposure = this.envNow.exposure;
    }
    this.atmo.update(dt, this.t, this.camera, p.pos, p.grounded ? p.pos.y : null, (this.scene.fog as THREE.Fog).color);
    this.level.update(dt, this.t, p.pos);
    // the Whirlwind keeps its trail for the whole spin (a longer-lived ring of light round her)
    const swinging = this.finisher.trailOn || (p.state === 'attack' && !!p.attack && (!!p.attack.whirl || p.attack.hits.some((h) => p.attackClipTime >= h.t0 - 0.05 && p.attackClipTime <= h.t1 + 0.03)));
    this.fx.setTrail(swinging, p.blade.hilt, p.blade.tip, p.attack ? SWING_WEIGHT[p.attack.kind] : 0, p.attack?.whirl ? 2.4 : 1);
    this.fx.update(dt, this.t);
    if (this.gore.state !== this.time.state) this.gore.setState(this.time.state);
    this.gore.update(dt);
    // a finisher's close shot narrows the lens (eased with the camera blend)
    const baseFov = this.rig.baseFov - this.finisher.fovOffset * this.rig.cineK;
    if (this.fovPunch > 0.01 || this.camera.fov !== baseFov) {
      this.fovPunch *= Math.max(0, 1 - dt * 9);
      if (this.fovPunch <= 0.01) this.fovPunch = 0;
      this.camera.fov = baseFov - this.fovPunch;
      this.camera.updateProjectionMatrix();
    }
    this.audio.setListener(this.camera);
    this.updateAmbientContext(dt);
    this.audio.update(dt, this.ambCtx, this.camera.position);
    // HUD
    this.hud.setHealth(p.hp, p.maxHp);
    this.hud.setCharge(this.time.charge, PER_SHIFT, this.time.state, this.time.trickling);
    if (p.isChanneling) this.hud.setChannel(true, p.channelTime / p.channelDuration, this.time.state === 'PAST' ? 'TOWARD THE PRESENT' : 'TOWARD THE PAST');
    else this.hud.setChannel(false);
    this.hud.update(dt);
    this.updateReticle();
    if (this.touch && Platform.isTouch) {
      const inp = this.input, ab = p.abilities;
      const whirling = !!p.attack?.whirl;
      const charging = p.attack?.shock && p.state === 'attack' && p.chargeTime > 0 && p.chargeLevel < 1.001 && inp.isDown('heavy');
      this.touch.update({
        channel: p.isChanneling ? p.channelTime / p.channelDuration : 0,
        canShift: this.time.unlocked && this.time.charge >= PER_SHIFT, guarding: p.state === 'block',
        canHold: { light: ab.has('whirlwind'), heavy: ab.has('crownbreaker') },
        hold: {
          light: whirling ? 1 - p.whirlT / WHIRL_MAX : ab.has('whirlwind') && inp.isDown('light') ? inp.heldFor('light') / HOLD_THRESHOLD : 0,
          heavy: charging ? p.chargeLevel : ab.has('crownbreaker') && inp.isDown('heavy') && !p.attack?.shock ? inp.heldFor('heavy') / HOLD_THRESHOLD : p.attack?.shock && p.state === 'attack' ? 1 : 0,
          lightOn: whirling, heavyOn: !!p.attack?.shock && p.state === 'attack',
        },
      });
    }
    if (this.touch && Platform.isTouch && this.hud.interactAt) {
      // the first Blood Sigil teaches the button once (session 14): a finger taps it until she does
      this.touch.teach(this.hud.interactKind === 'sigil' && !this.learned.interactTap);
      this.touch.placeInteract(this.hud.interactAt, this.camera, this.realDt);
    }
    this.updateAbilityTip();
    if (this.debug) this.hud.debugEl.textContent = this.debugText();
    else if (this.perfHud && (this.perfHudT -= this.realDt) <= 0) { this.perfHudT = 0.5; this.hud.debugEl.textContent = this.perfText(); }
  }

  /** every enemy of the floor (placed + fissure remnants) */
  *enemyList() { if (!this.enemies) return; yield* this.enemies.enemies; yield* this.enemies.remnants; }
  private _wish = new THREE.Vector3();
  /** the stick / WASD direction in world space (camera-relative), zero when idle */
  private wishWorld() {
    const ax = this.input.moveAxes();
    const f = this.rig.forward(this._tv);
    return this._wish.set(f.x * ax.y - f.z * ax.x, 0, f.z * ax.y + f.x * ax.x);
  }

  private ambCtx: AmbientContext = { state: 'PRESENT', openSky: 0, fire: 0, underground: 0, inCombat: false };
  private ambProbe = 0;
  private ambSky = 0;
  private ambFire = 0;
  /** Cheap context for the ambience mix: open sky above the hero, nearest flame, depth, combat. */
  private updateAmbientContext(dt: number) {
    const c = this.ambCtx, p = this.player.pos;
    c.state = this.time.state;
    c.inCombat = this.enemies.inCombat;
    this.ambProbe -= dt;
    if (this.ambProbe <= 0) {
      this.ambProbe = 0.35;
      const head = p.clone().setY(p.y + 1.6);
      const hit = this.level.collision.raycast(head, new THREE.Vector3(0, 1, 0), 40, this.time.state);
      this.ambSky = hit ? 0 : 1;
      let best = 99;
      for (const l of this.level.lights) {
        if (l.kind !== 'torch' && l.kind !== 'brazier' && l.kind !== 'hearth' && l.kind !== 'candle') continue;
        if (l.state !== 'BOTH' && l.state !== this.time.state) continue;
        best = Math.min(best, l.pos.distanceTo(head) - (l.kind === 'hearth' || l.kind === 'brazier' ? 2 : 0));
      }
      this.ambFire = THREE.MathUtils.clamp(1 - best / 9, 0, 1);
    }
    const k = Math.min(1, dt * 2);
    c.openSky += (this.ambSky - c.openSky) * k;
    c.fire += (this.ambFire - c.fire) * k;
    // depth below the ground floor (crypt, excavation): a ramp, not a switch, so the water bed swells in gently
    c.underground += (THREE.MathUtils.clamp((-1.5 - p.y) / 3, 0, 1) - c.underground) * k;
  }

  private updateReticle() {
    const lt = this.player.lockTarget;
    if (!lt) { this.hud.reticle.style.display = 'none'; return; }
    const v = lt.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).project(this.camera);
    if (v.z > 1) { this.hud.reticle.style.display = 'none'; return; }
    this.hud.reticle.style.display = 'block';
    this.hud.reticle.style.left = ((v.x + 1) / 2) * Platform.width + 'px';
    this.hud.reticle.style.top = ((1 - v.y) / 2) * Platform.height + 'px';
  }

  private updateVoidAndPrompts() {
    const p = this.player;
    const col = this.level.collision;
    // a scripted hero (the King's lift riding down its shaft, a finisher) is placed by its sequence: the lift's
    // descent crosses the shaft's kill volume, and each "fall" cost her a quarter of her health — four of them on
    // the way down, so a real player died on the lift
    if (p.alive && !this.respawning && !p.scripted && (col.inVoid(p.pos, this.time.state) || p.pos.y < -40)) this.fallRespawn();
    // prompt volumes
    const head = p.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    for (const m of this.level.markersOf('prompt')) {
      if (!m.box || this.promptsShown.has(m.name) || Game.TAUGHT_PROMPTS.has(m.props.pid ?? m.name)) continue;
      const st = m.props.state;
      if (st !== 'BOTH' && st !== this.time.state) continue;
      if (!m.box.containsPoint(head)) continue;
      if (!this.requirementMet(m.props.requires)) continue;
      this.promptsShown.add(m.name);
      this.hud.prompt(promptText(m.props.pid ?? m.name, m.props.text), 6);
      this.signals.emit('prompt', { pid: m.props.pid ?? m.name });
    }
    // exit
    const exit = this.level.marker('exit', 'EXIT');
    if (!this.finished && exit.box!.containsPoint(head)) this.finish();
    this.prefetchNext();
  }

  requirementMet(req?: string) {
    if (!req) return true;
    const [k, v] = req.split(':');
    if (k === 'sigil') return this.checkpoints.activated.has(v);
    if (k === 'cleared') return this.enemies.isCleared(v);
    if (k === 'flag') return this.level.flags.has(v);
    if (k === 'noflag') return !this.level.flags.has(v);
    return true;
  }

  private hatchLid: THREE.Mesh | null = null;
  pendingArenaLock = false;
  /** Finale arena lock: the diggers' hatch slams shut (Past) while the Gate Warden lives. */
  setArenaLock(on: boolean) {
    if (!on) this.pendingArenaLock = false;
    const col = this.level.collision;
    let d = col.dynamic.find((x) => x.name === 'hatch');
    // unlocking a lock that never closed: nothing to do (and nothing to build — respawns call this on every floor,
    // and the hatch's wood texture only exists on Floor 1: a death on Floor 3 threw here before the respawn)
    if (!d && !on) return;
    if (!d) {
      // hatch x 14.5..17, y 32.6..38 (Blender) at the hall floor
      const box = new THREE.Box3(new THREE.Vector3(14.4, -0.35, -38.1), new THREE.Vector3(17.1, 0.02, -32.5));
      d = { box, state: 'PAST', enabled: false, name: 'hatch' };
      col.dynamic.push(d);
      const size = box.getSize(new THREE.Vector3());
      this.hatchLid = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.12, size.z), this.mats.get('wood_planks', 'PAST', 'PAST'));
      this.perf.mark('hatch lid created');
      this.hatchLid.position.copy(box.getCenter(new THREE.Vector3())).setY(-0.05);
      this.hatchLid.receiveShadow = true;
      this.scene.add(this.hatchLid);
    }
    d.enabled = on;
    this.hatchLid!.visible = on && this.time.state === 'PAST';
    if (on) { this.audio.hatchSlam(this.hatchLid!.position); this.rig.addShake(0.3); }
  }

  /** Game-clock timers (deterministic under fixed-step simulation, pause-aware). */
  private timers: { at: number; fn: () => void }[] = [];
  schedule(delay: number, fn: () => void) { this.timers.push({ at: this.t + delay, fn }); }
  private runTimers() {
    if (!this.timers.length) return;
    const due = this.timers.filter((x) => x.at <= this.t);
    this.timers = this.timers.filter((x) => x.at > this.t);
    for (const x of due) x.fn();
  }

  private fallRespawn() {
    this.respawning = true;
    this.hud.fade(true);
    this.player.vel.set(0, 0, 0);
    this.schedule(0.65, () => {
      const p = this.player;
      this.respawning = false;
      p.hp -= p.maxHp * (p.godMode ? 0 : 0.25);
      if (p.hp <= 0) { p.die(); return; }
      p.teleport(this.safeSpot(p.lastSafe));
      this.hud.fade(false);
      this.hud.deny('The memory gives way beneath you.');
      this.falls++;
    });
  }
  falls = 0;

  /**
   * lastSafe may have been recorded in the other memory (a forced slip opened a hole under it): search outward
   * for footing in the current state, else fall back to the last Blood Sigil.
   */
  private safeSpot(want: THREE.Vector3) {
    const col = this.level.collision, st = this.time.state;
    const ok = (q: THREE.Vector3) => col.hasFooting(q.clone().setY(q.y + 0.5), 1.5, st) && !col.inVoid(q.clone().setY(q.y - 0.4), st)
      && col.overlap(q, this.player.radius, this.player.height, st) < 0.05;
    if (ok(want)) return want.clone();
    for (let r = 1; r <= 8; r += 1) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const q = want.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (ok(q)) return q;
    }
    return this.checkpoints.save?.pos.clone() ?? this.level.marker('spawn', 'SPAWN').pos.clone();
  }

  private onPlayerDeath() {
    if (this.arena) { this.deaths++; this.audio.death(); this.signals.emit('hero:death', { deaths: this.deaths }); this.arena.onDeath(); return; }
    this.deaths++;
    this.signals.emit('hero:death', { deaths: this.deaths });
    this.audio.death();
    this.schedule(1.6, () => this.hud.fade(true));
    this.schedule(2.8, () => {
      this.perf.mark('respawn');
      this.checkpoints.respawn();
      this.signals.emit('hero:respawn', {});
      this.hud.fade(false);
      this.hud.message('THE CASTLE REMEMBERS YOU', 'Returned to the last Blood Sigil', 3);
    });
  }

  /** The last floor's ending (the Last Crown's death sequence calls it). */
  endGame() { if (!this.finished) this.finish(); }
  /** Leave this floor now (the King's lift reaching the bottom of the shaft): the in-place floor transition. */
  leaveFloor() { if (!this.finished) this.finish(); }

  /** the floor was left: the transition starts at the top of the next frame (see finish) */
  private pendingNext: number | null = null;
  private takePendingNext() {
    const n = this.pendingNext;
    if (n === null) return false;
    this.pendingNext = null;
    this.onNextFloor?.(n);
    return true;
  }

  private finish() {
    this.finished = true;
    this.signals.emit('floor:leave', { id: this.floorId, next: this.floor.next ?? null, deaths: this.deaths });
    if (this.floor.next) {
      // hand HP and resonance to the next floor; main.ts shows the chapter card and loads it — at the top of the
      // NEXT frame: the transition tears this floor down synchronously, and doing that from inside step() (the exit
      // volume, the King's lift) left the rest of the frame running on a disposed level (it threw, and the throw
      // ended that animation loop)
      saveCarry({ hp: this.player.hp, charge: this.time.charge, unlocked: this.time.unlocked });
      this.pendingNext = this.floor.next;
      return;
    }
    const secs = (performance.now() - this.startTime) / 1000 + (this.playTimeBefore?.() ?? 0);
    if (this.floorId === 3) {
      (this.hud.endEl.querySelector('h1') as HTMLElement).textContent = 'THE CROWNHEART IS SILENT';
      // the last card of the game carries its name (session 13)
      this.hud.endEl.classList.add('final');
      const ps = this.hud.endEl.querySelectorAll('p');
      ps[ps.length - 1].textContent = 'Caer Veyr is only stone now — and stone can fall. The Uncrowned walks down through the one castle that remains.';
      if (!this.hud.endEl.querySelector('.end-by')) {
        const by = document.createElement('p');
        by.className = 'end-by';
        by.textContent = `A game by ${AUTHOR} · made with Claude Opus 5.5 and Blender`;
        this.hud.endEl.appendChild(by);
      }
    }
    const sub = this.hud.endEl.querySelector('.end-sub') as HTMLElement;
    sub.textContent = `Time ${Math.floor(secs / 60)}m ${Math.floor(secs % 60)}s · Echoes released ${this.enemies.killCount} · Shifts ${this.time.shiftCount} · Deaths ${this.deaths}`;
    this.hud.endEl.classList.add('on');
    document.exitPointerLock?.();
    this.onEnd?.();
  }

  private perfText() {
    const pf = this.perf;
    const f = (s: 'wall' | 'step' | 'render' | 'gpu') => { const r = pf.recent(s); return r ? `${r.p50.toFixed(1)}/${r.p95.toFixed(1)}` : '–'; };
    const w = pf.recent('wall'), mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return [
      `fps ${w ? (1000 / Math.max(1, w.p50)).toFixed(0) : '–'}   frame ${f('wall')} ms (p50/p95)`,
      `step ${f('step')}  render ${f('render')}  gpu ${f('gpu')}`,
      `calls ${this.frameStats.calls}  tris ${(this.frameStats.tris / 1000).toFixed(0)}k  echoes ${this.enemies?.activeCount ?? 0}`,
      `px ${this.renderer.domElement.width}×${this.renderer.domElement.height} ×${this.renderScale}  heap ${mem ? (mem.usedJSHeapSize / 1e6).toFixed(0) + ' MB' : '–'}`,
    ].join('\n');
  }

  private debugText() {
    const p = this.player;
    const b = new THREE.Vector3(p.pos.x, -p.pos.z, p.pos.y);
    return [
      `fps ${this.fps.toFixed(0)}  calls ${this.frameStats.calls}  tris ${this.frameStats.tris}`,
      `pos three (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)})  blender (${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.z.toFixed(1)})`,
      `state ${p.state} ${p.stateTime.toFixed(2)}  grounded ${p.grounded}  crouch ${p.crouching}  hp ${p.hp.toFixed(0)}`,
      `time ${this.time.state}  charge ${this.time.charge.toFixed(0)}  cooldown ${this.time.cooldown.toFixed(1)}`,
      `anim ${this.player.anim.overlayId ?? '-'}  attack ${p.attack?.id ?? '-'}`,
      `enemies active ${this.enemies.activeCount}  kills ${this.enemies.killCount}`,
    ].join('\n');
  }

  // ------------------------------------------------------------------ test / debug API
  /**
   * Benchmark driver (works in hidden pages where rAF never fires): runs real frames — step + render, each
   * measured by `perf` — back to back, yielding to the event loop between frames via MessageChannel.
   * `onFrame(i)` runs before each frame (scenario scripting).
   */
  async bench(seconds: number, dt = 1 / 60, onFrame?: (i: number) => void | boolean) {
    const ch = new MessageChannel();
    const tick = () => new Promise<void>((r) => { ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    const n = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < n; i++) {
      if (onFrame?.(i) === false || this.takePendingNext()) break;
      this.perf.beginStep();
      if (!this.paused) this.step(dt);
      this.input.endFrame(dt);
      this.perf.endStep();
      this.perf.beginRender();
      this.renderer.render(this.scene, this.camera);
      this.perf.endRender();
      await tick();
    }
    ch.port1.close();
  }
  /** Deterministic fixed-step simulation (tests / autopilot): runs the real game step without rAF. */
  advance(seconds: number, step = 1 / 60, render = true) {
    const n = Math.max(1, Math.round(seconds / step));
    for (let i = 0; i < n; i++) {
      if (this.takePendingNext() || this.loading) break; // a floor transition is tearing the floor down / building the next one
      if (!this.paused) this.step(step);
      this.input.endFrame(step);
    }
    if (render) this.renderer.render(this.scene, this.camera);
  }
  /** Teleport using blueprint (Blender) coordinates; yawDeg 0 = facing north (+Y). */
  tp(bx: number, by: number, bz: number, yawDeg = 0) {
    const yaw = THREE.MathUtils.degToRad(yawDeg) + Math.PI;
    this.player.teleport(new THREE.Vector3(bx, bz, -by), yaw);
    this.rig.snapBehind(yaw);
  }
  /** Screenshot helper: teleport (blueprint coords), set camera pitch, simulate, render once, then pause. */
  view(bx: number, by: number, bz: number, yawDeg: number, pitch = 0.2, seconds = 1, state?: TimeState) {
    if (!this.started) { (document.getElementById('start-btn') as HTMLButtonElement | null)?.click(); }
    this.player.godMode = true;
    if (state && this.time.state !== state) this.forceState(state);
    this.tp(bx, by, bz, yawDeg);
    this.rig.pitch = pitch;
    this.paused = false;
    this.advance(seconds, 1 / 60, true);
    this.paused = true;
    return `${this.renderer.info.render.calls} calls, ${this.renderer.info.render.triangles} tris`;
  }
  forceState(s: TimeState) {
    this.time.unlocked = true;
    this.time.setState(s, this.player.pos, false);
    this.setEnvironment(s, true);
    this.hud.setState(s);
    this.enemies.onStateChange(s);
  }
  blenderPos() { const p = this.player.pos; return [+p.x.toFixed(2), +(-p.z).toFixed(2), +p.y.toFixed(2)]; }
  markerPos(kind: string, name: string): THREE.Vector3 { return this.level.marker(kind, name).pos.clone(); }
  allMarkers(kind: string): Marker[] { return this.level.markersOf(kind); }
}

/** Let the browser paint the loading screen (rAF never fires in hidden tabs, so a message tick backs it up). */
function yieldFrame() {
  return new Promise<void>((r) => {
    const ch = new MessageChannel();
    let done = false;
    const fin = () => { if (!done) { done = true; ch.port1.close(); r(); } };
    ch.port1.onmessage = fin;
    requestAnimationFrame(fin);
    setTimeout(() => ch.port2.postMessage(0), 16);
  });
}
