import * as THREE from 'three';
import { Input } from './Input';
import { Level, type Marker } from '../levels/Level';
import { MaterialLibrary, type TimeState } from '../levels/Materials';
import { Player } from '../character/Player';
import { CameraRig } from '../character/CameraRig';
import { HUD } from '../ui/HUD';
import { TimeSystem, PER_SHIFT } from '../time/TimeSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { Effects } from '../vfx/Effects';
import { AudioFX, type AmbientContext } from '../audio/Audio';
import { realTimeTo, type AttackKind } from '../combat/CombatData';

/** How heavy each attack kind sounds (0 light … 1 heavy). */
const SWING_WEIGHT: Record<AttackKind, number> = { light: 0.15, heavy: 0.75, finisher: 0.85, kick: 0.2, bash: 0.2, air: 0.55, crouch: 0.3, sprint: 0.6 };
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
    this.rig = new CameraRig(this.camera);
    this.rig.setProfile(Platform.view);
    this.fogShift = this.rig.profile.distance - 4.4;
    if (opts.stage) {
      this.touch = new TouchControls(opts.stage, this.input);
      this.touch.onPause = () => { if (this.started && !this.finished) this.togglePause(); };
      this.hud.onInteractText = (t) => this.touch?.setInteract(t);
    }
    this.input.autoCrouch = Platform.isTouch;
    this.perf = new Perf(this.renderer);
    this.audio = new AudioFX({ muted: opts.muted });
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
      this.resize();
    });
    this.resize();
    (window as any).__game = this;
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
  boot(id: number, sink: LoadSink): Promise<void> {
    if (this.floorOp) return this.floorOp;
    this.assets.audioCtx = this.audio.createContext();
    const extra = [{ scope: 'core', keys: this.assets.coreKeys() }];
    if (this.audio.ambienceEnabled) extra.push({ scope: 'ambience', keys: this.assets.ambienceKeys() });
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
      const carry = { hp: this.player.hp, charge: this.time.charge, unlocked: this.time.unlocked, shifts: this.time.shiftCount };
      this.stop();
      const m = this.assets.manager;
      const prev = this.floorId;
      sink(0, 'Leaving ' + (FLOORS[prev]?.subtitle ?? 'the floor'));
      m.retain('floor' + next, this.assets.floorKeys(next));
      this.unloadFloor();
      const released = m.release('floor' + prev);
      for (const k of released) if (k.startsWith('snd:')) this.audio.unbind(k.slice(4));
      this.perf.mark(`transition ${prev}→${next}: released ${released.length}`);
      await this.loadFloor(next, sink, [], released);
      this.time.unlocked = true;
      this.time.charge = Math.max(100, carry.charge);
      this.time.shiftCount = carry.shifts;
      this.player.hp = Math.max(this.player.maxHp * 0.5, carry.hp);
      this.finished = false;
    })().finally(() => { this.floorOp = null; });
    this.floorOp = op;
    return op;
  }

  private async loadFloor(id: number, sink: LoadSink, extra: { scope: string; keys: string[] }[] = [], released: string[] = []) {
    const t0 = performance.now();
    const def = FLOORS[id];
    if (!def) throw new Error('No floor ' + id);
    this.floor = def;
    this.floorId = id;
    const m = this.assets.manager;
    const keys = this.assets.floorKeys(id);
    await m.acquireAll([...extra, { scope: 'floor' + id, keys }], (p) => sink(p.fraction * 0.78, `${def.loadingText} — ${p.label} (${p.done}/${p.count})`));
    for (const k of [...this.assets.coreKeys(), ...this.assets.ambienceKeys(), ...keys]) {
      if (k.startsWith('snd:') && m.has(k) && !this.audio.isBound(k.slice(4))) this.audio.bind(k.slice(4), m.get<AudioBuffer[]>(k));
    }
    const t1 = performance.now();
    sink(0.8, `${def.loadingText} — raising the walls`);
    await yieldFrame();
    if (!this.player) {
      this.player = new Player(m.get('glb:hero'));
      this.scene.add(this.player.root);
    }
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
    this.time = new TimeSystem(this.level);
    const rigs = new Map<any, EnemyTemplate>();
    for (const k of keys) if (k.startsWith('glb:enemy:')) rigs.set(k.slice('glb:enemy:'.length), m.get(k));
    this.enemies = new EnemyManager(this);
    this.enemies.build(rigs);
    this.checkpoints = new Checkpoints(this);
    this.fractures = new Fractures(this);
    this.wireEvents();
    const spawn = this.level.marker('spawn', 'SPAWN');
    this.player.revive(spawn.pos, Math.PI); // three.js: Blender north (+Y) = -Z; yaw π faces -Z
    this.rig.snapBehind(this.player.yaw);
    this.setEnvironment('PRESENT', true);
    this.hud.setState('PRESENT');
    const t2 = performance.now();
    sink(0.84, `${def.loadingText} — tempering the memories`);
    await yieldFrame();
    this.lastWarmup = await this.warmGpu((f, label) => sink(0.84 + f * 0.16, `${def.loadingText} — ${label.toLowerCase()}`));
    this.loadLog.push({ floor: id, ms: Math.round(performance.now() - t0), assetsMs: Math.round(t1 - t0), buildMs: Math.round(t2 - t1), warmup: this.lastWarmup, released });
    sink(1, def.readyText);
  }

  /** Force every drawable of the floor visible and render it for both time states (see assets/Warmup.ts). */
  private async warmGpu(onProgress: (f: number, label: string) => void) {
    const at = this.player.pos.clone();
    const kits = [this.enemies.warmKit(at), this.fx.warmKit(at), this.gore.warmKit(at), this.atmo.warmKit(at)];
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
    this.enemies.dispose();
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
    this.player.lockTarget = null;
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
      const c = this.time.canBegin(p);
      if (!c.ok) { this.hud.deny(c.reason!); this.audio.deny(); return false; }
      this.audio.channelStart();
      this.fx.channelStart(p.pos, this.time.other);
      return true;
    };
    p.events.onChannelCancel = () => { this.audio.channelStop(); this.fx.channelStop(); };
    p.events.onChannelComplete = () => {
      this.fx.channelStop();
      const v = this.time.commit(p);
      if (!v.ok) { this.audio.channelStop(); this.hud.deny(v.reason); this.audio.deny(); return; }
    };
    p.events.onInteract = () => this.checkpoints.interact();
    p.events.onDeath = () => this.onPlayerDeath();
    p.events.onFootstep = (_pos, speed) => this.audio.footstep(this.time.state, speed, p.crouching);
    p.events.onDodge = () => this.audio.dodge();
    p.events.onJump = () => this.audio.jump();
    p.events.onLand = (fall) => this.audio.land(fall);
    p.events.onBlock = (parry) => {
      this.audio.block(parry);
      // sparks where the blow meets the blade (its middle), not the hilt
      this.fx.sparks(p.blade.hilt.clone().lerp(p.blade.tip, 0.45), parry ? 30 : 12, parry ? 0xfff0c0 : 0xffc080);
      if (parry) { this.time.gain(12, 'parry'); this.hud.flash('#fff6d8', 0.25); this.rig.addShake(0.2); }
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
      if (p.chargeTime < 0.02) this.audio.play('blade_ring', { rate: 0.8, vol: 0.9 });
      this.fx.chargeGlow(p.blade.tip, p.blade.hilt, level);
    };
    p.events.onHitWindow = (a, i) => {
      if (a.charge) this.audio.swing(1, undefined, 1.1);
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
      this.audio.shiftBoom(to);
      this.hud.flash(to === 'PAST' ? '#ffd9a0' : '#bfe0ff', 0.55);
      this.rig.addShake(0.35);
      this.fx.shiftBurst(this.player.pos, to);
    };
    this.time.onGain = (amt, reason) => { if (reason !== 'hit') this.fx.resonance(this.player, amt); };
  }

  setEnvironment(state: TimeState, instant: boolean) {
    this.envFrom = this.currentEnv();
    this.envTarget = ENV[state];
    this.envBlend = instant ? 1 : 0;
    this.atmo.setState(state, instant);
    if (instant) this.applyEnv(ENV[state], ENV[state], 1);
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
  }
  private heroLight = ENV.PRESENT.heroLight;

  start() {
    if (!this.started) this.startTime = performance.now();
    this.started = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  /** Stop the frame loop (floor transitions). */
  stop() { this.renderer.setAnimationLoop(null); }

  private frame() {
    let dt = this.clock.getDelta();
    this.updateDynRes(dt);
    dt = Math.min(dt, 1 / 20);
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    if (this.input.wasPressed('pause')) this.togglePause();
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

  togglePause(on?: boolean) {
    this.paused = on ?? !this.paused;
    this.hud.pauseEl.classList.toggle('on', this.paused);
    if (this.paused) { document.exitPointerLock?.(); this.touch?.releaseAll(); this.input.releaseAll(); }
  }

  /** Portrait: pull the camera back when a fight crowds the narrow frame (a melee pack, a boss). */
  private fightPull() {
    if (!Platform.isPortrait || !this.enemies.inCombat) return 0;
    let near = 0, boss = false;
    for (const e of this.enemies.threats(this.player.pos, 9, 0)) {
      if (e.arch.boss) boss = true;
      else if (!e.isRanged) near++;
    }
    return Math.max(0, near - 1) * 0.45 + (boss ? 1.1 : 0);
  }

  private threatList: Threat[] = [];
  private _tv = new THREE.Vector3();
  private _tp = new THREE.Vector3();
  /**
   * Off-screen threat markers (portrait): engaged enemies outside the frame, placed on the stage edge in the
   * direction you would turn to face them (radar mapping: screen-up = camera forward). Telegraphing or aiming
   * enemies glow hot; archers are tinted so the long-range threat is always accounted for.
   */
  private updateThreats() {
    const out = this.threatList;
    out.length = 0;
    if (Platform.isPortrait && this.started && this.player.alive) {
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
    }
    this.hud.setThreats(out);
  }

  /** unscaled frame time (hit-stop / slow-mo shakes and springs run on real time) */
  realDt = 1 / 60;
  step(dt: number) {
    this.realDt = dt;
    if (this.fx.hitstopTime > 0) { this.fx.hitstopTime -= dt; dt *= 0.06; }
    else if (this.fx.slowTime > 0) { this.fx.slowTime -= dt; dt *= this.fx.slowScale; }
    this.t += dt;
    this.runTimers();
    const p = this.player;
    this.autopilot?.update(dt);
    // lock-on
    if (this.input.wasPressed('lock')) {
      if (p.lockTarget) p.lockTarget = null;
      else p.lockTarget = this.enemies.pickLockTarget(p.pos, this.rig.forward());
    }
    if (p.lockTarget && !p.lockTarget.alive) p.lockTarget = null;
    this.rig.lockTarget = p.lockTarget?.pos ?? null;
    p.update(dt, this.input, this.rig, this.level.collision, this.time.state, () => this.enemies.autoTarget(p.pos, p.facing));
    this.enemies.update(dt);
    this.time.update(dt);
    this.checkpoints.update(dt);
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
    this.rig.update(dt, p.pos, this.input.consumeLook(), this.level.collision, this.time.state, p.crouching);
    this.updateThreats();
    // hero light: above and slightly toward the camera, so what the player faces is lit
    const toCam = this.camera.position.clone().sub(p.pos).setY(0).normalize();
    this.playerLight.position.copy(p.pos).addScaledVector(toCam, 1.1).setY(p.pos.y + 2.3);
    this.playerLight.intensity = this.heroLight;
    this.atmo.update(dt, this.t, this.camera, p.pos, p.grounded ? p.pos.y : null, (this.scene.fog as THREE.Fog).color);
    this.level.update(dt, this.t, p.pos);
    const swinging = p.state === 'attack' && !!p.attack && p.attack.hits.some((h) => p.attackClipTime >= h.t0 - 0.05 && p.attackClipTime <= h.t1 + 0.03);
    this.fx.setTrail(swinging, p.blade.hilt, p.blade.tip, p.attack ? SWING_WEIGHT[p.attack.kind] : 0);
    this.fx.update(dt, this.t);
    if (this.gore.state !== this.time.state) this.gore.setState(this.time.state);
    this.gore.update(dt);
    const baseFov = this.rig.baseFov;
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
    this.hud.setCharge(this.time.charge, PER_SHIFT, this.time.state);
    if (p.isChanneling) this.hud.setChannel(true, p.channelTime / p.channelDuration, this.time.state === 'PAST' ? 'TOWARD THE PRESENT' : 'TOWARD THE PAST');
    else this.hud.setChannel(false);
    this.hud.update(dt);
    this.updateReticle();
    if (this.touch && Platform.isTouch) {
      this.touch.update({
        channel: p.isChanneling ? p.channelTime / p.channelDuration : 0,
        locked: !!p.lockTarget, canShift: this.time.unlocked && this.time.charge >= PER_SHIFT, guarding: p.state === 'block',
      });
    }
    if (this.debug) this.hud.debugEl.textContent = this.debugText();
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
    c.underground += ((p.y < -2.5 ? 1 : 0) - c.underground) * k;
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
    if (p.alive && !this.respawning && (col.inVoid(p.pos, this.time.state) || p.pos.y < -40)) this.fallRespawn();
    // prompt volumes
    const head = p.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    for (const m of this.level.markersOf('prompt')) {
      if (!m.box || this.promptsShown.has(m.name)) continue;
      const st = m.props.state;
      if (st !== 'BOTH' && st !== this.time.state) continue;
      if (!m.box.containsPoint(head)) continue;
      if (!this.requirementMet(m.props.requires)) continue;
      this.promptsShown.add(m.name);
      this.hud.prompt(promptText(m.props.pid ?? m.name, m.props.text), 6);
    }
    // exit
    const exit = this.level.marker('exit', 'EXIT');
    if (!this.finished && exit.box!.containsPoint(head)) this.finish();
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
      p.teleport(p.lastSafe.clone());
      this.hud.fade(false);
      this.hud.deny('The memory gives way beneath you.');
      this.falls++;
    });
  }
  falls = 0;

  private onPlayerDeath() {
    this.deaths++;
    this.audio.death();
    this.schedule(1.6, () => this.hud.fade(true));
    this.schedule(2.8, () => {
      this.perf.mark('respawn');
      this.checkpoints.respawn();
      this.hud.fade(false);
      this.hud.message('THE CASTLE REMEMBERS YOU', 'Returned to the last Blood Sigil', 3);
    });
  }

  private finish() {
    this.finished = true;
    if (this.floor.next) {
      // hand HP and resonance to the next floor; main.ts shows the chapter card and loads it
      saveCarry({ hp: this.player.hp, charge: this.time.charge, unlocked: this.time.unlocked });
      this.onNextFloor?.(this.floor.next);
      return;
    }
    const secs = (performance.now() - this.startTime) / 1000;
    const sub = this.hud.endEl.querySelector('.end-sub') as HTMLElement;
    sub.textContent = `Time ${Math.floor(secs / 60)}m ${Math.floor(secs % 60)}s · Echoes released ${this.enemies.killCount} · Shifts ${this.time.shiftCount} · Deaths ${this.deaths}`;
    this.hud.endEl.classList.add('on');
    document.exitPointerLock?.();
    this.onEnd?.();
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
      if (onFrame?.(i) === false) break;
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
