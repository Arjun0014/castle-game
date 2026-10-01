import * as THREE from 'three';
import type { Game } from './Game';
import type { Enemy } from '../enemies/Enemy';
import type { Encounter } from '../enemies/EnemyManager';
import { KILL_TIER, type ArchetypeId } from '../enemies/EnemyTypes';
import { abilitiesForFloor } from '../combat/Abilities';
import type { TimeState } from '../levels/Materials';
import { b2t } from '../levels/Level';
import { Platform, lockPointer } from '../platform/Platform';
import { Leaderboards, type ArenaRun, type BoardEntry } from '../platform/Leaderboards';
import {
  ARENA, ESCORT_AT, ESCORT_SHARE, GUARDIANS, GUARDIAN_CYCLE_HP, PACK_AT, ROSTER, SCORE,
  damageScale, hpScale, waveBudget, waveCap, type ArenaGuardian,
} from '../data/arena';

/**
 * THE ENDLESS MEMORY — the Endless Arena (session 17). Floor III's Crownheart chamber without its heart: waves of
 * Echoes for as long as she lasts, the memory turning every wave (the Past's whole coronation ring and its soldiers;
 * the Present's ruin, its wedge-shaped drops into the abyss and its monsters), a guardian every fifth wave with an
 * entrance of its own, a score, a personal best and the Wavedash leaderboard (platform/Leaderboards.ts).
 *
 * The run owns the floor: Game builds the chamber with no Echoes of its own and a pool of bodies (data/arena.ts POOL,
 * EnemyManager.build), no Crownheart, no objectives or route guide, no saves (main.ts) and no story deeds
 * (Achievements.story). Everything here is driven from Game.step (game time: hit-stop and slow motion included).
 *
 * The arena's Echoes belong to BOTH memories: a manual shift mid-wave changes the ground under them, and one standing
 * on a Present wedge when the ruin returns falls into the abyss (EnemyManager.fallOnShift) — worth more to the score.
 */
type Phase = 'ready' | 'intro' | 'fight' | 'cleared' | 'turn' | 'announce' | 'entrance' | 'down' | 'results';

const NAMES: Partial<Record<ArchetypeId, string>> = {
  gate_warden: 'THE GATE WARDEN', kingsguard: 'THE KINGSGUARD', goblin_king: 'THE GUTTER KING', widow_mother: 'THE WEEPING MOTHER', maw: 'THE MAW OF THE CROWNHEART',
};
const LINES: Record<TimeState, string[]> = {
  PAST: ['The castle’s soldiers remember their posts', 'The muster forms on the ring', 'The coronation guard will not yield the chamber', 'The living keep sends its sworn'],
  PRESENT: ['Things crawl up out of the abyss', 'The ruin’s hunger finds the ring', 'The dark remembers what it bred down here', 'Echoes rise from the broken memory'],
};
const TURN: Record<TimeState, [string, string]> = {
  PAST: ['THE PAST', 'The coronation ring stands whole'],
  PRESENT: ['THE PRESENT', 'The ruin opens beneath the ring'],
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const other = (s: TimeState): TimeState => (s === 'PAST' ? 'PRESENT' : 'PAST');
const sm = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

export class Arena {
  /** the run */
  wave = 0;
  score = 0;
  kills = 0;
  guardians = 0;
  phase: Phase = 'ready';
  /** the ring's centre (three.js) */
  readonly center: THREE.Vector3;
  private phaseT = 0;
  private runStart = 0;
  /** this wave: what is still to rise, what has risen, its packs and guardians */
  private queue: ArchetypeId[] = [];
  private risen: Enemy[] = [];
  private bosses: Enemy[] = [];
  private pack = 0;
  private escortCalled = false;
  private nextPackAt = 0;
  private hurt = false;
  private lastHp = 0;
  private guardian: ArenaGuardian | null = null;
  private cycle = 0;
  /** the entrance in progress */
  private ent: { t: number; spots: THREE.Vector3[]; cam: { pos: THREE.Vector3; look: THREE.Vector3 }; appeared: boolean; titled: boolean; cues: Set<string> } | null = null;
  private offs: (() => void)[] = [];
  private ward: THREE.Mesh;
  private hudEl: HTMLElement;
  private titleEl: HTMLElement;
  private resultsEl: HTMLElement;
  private shown = { wave: '', score: '', left: '' };
  /** tests: every decision */
  log: string[] = [];
  /** the run ended and the card is up: what it showed */
  last: { run: ArenaRun; best: boolean; board: BoardEntry[] | null; rank: number | null } | null = null;

  constructor(private g: Game) {
    const [x, y, z] = ARENA.center;
    this.center = b2t(x, y, z);
    // the bridge out is sealed by a curtain of the chamber's own light (the hero is held inside: update)
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ward = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 4.4), mat);
    const a = THREE.MathUtils.degToRad(ARENA.bridgeDeg);
    this.ward.position.copy(b2t(x + Math.cos(a) * (ARENA.radius + 0.25), y + Math.sin(a) * (ARENA.radius + 0.25), z + 2.2));
    this.ward.lookAt(this.center.clone().setY(this.ward.position.y));
    this.ward.renderOrder = 4;
    g.scene.add(this.ward);
    // the hero starts on the lens facing into the chamber, the sealed bridge behind her
    g.player.revive(this.center.clone(), Math.PI / 2);
    g.rig.snapBehind(g.player.yaw);
    g.forceState(ARENA.firstMemory);
    g.hud.objective(null);
    // one ring, always in view: a smaller, shorter-lived field of blood and chunks than a floor's (frame time stays flat
    // however long the run goes)
    g.gore.maxDecals = 56; g.gore.decalLife = 18; g.gore.maxChunks = 36;
    // the heart is gone, and what it grew with it: the four chains of its cradle and its crystal roots leaning over the
    // pillar stumps (visual only — no collision) would cross every shot of the chamber as bare orange slabs
    for (const m of [...g.level.allMeshes()]) if (m.name === 'C6_HEARTSHAREDiron_rust' || /^C6_HEART(SHARED|PRESENT|PAST)fx_root$/.test(m.name)) m.removeFromParent();
    // the HUD: wave + score under the vitals, the guardian's title card, the end-of-run card
    const root = g.hud.root;
    this.hudEl = el(root, 'arena-hud', `<div class="ah-wave"><small>Wave</small><b>—</b><em></em></div><div class="ah-score"><b>0</b><i></i></div><div class="ah-left"></div>`);
    this.titleEl = el(root, 'arena-title', `<small></small><h2></h2><span class="at-rule"><i></i><b>◆</b><i></i></span><p></p>`);
    this.resultsEl = el(root, 'arena-results', '');
    document.documentElement.classList.add('arena-on');
    this.offs.push(g.signals.on('kill', (d) => this.onKill(d as { arch: ArchetypeId; boss?: boolean; voidDeath?: boolean; finisher?: boolean })));
    (window as unknown as { __arena: Arena }).__arena = this;
  }

  dispose() {
    for (const o of this.offs) o();
    this.offs = [];
    this.ward.removeFromParent();
    this.ward.geometry.dispose();
    (this.ward.material as THREE.Material).dispose();
    this.hudEl.remove(); this.titleEl.remove(); this.resultsEl.remove();
    document.documentElement.classList.remove('arena-on', 'arena-over');
  }

  private note(s: string) { this.log.push(`${this.g.t.toFixed(1)} ${s}`); if (this.log.length > 80) this.log.shift(); }
  private set(p: Phase) { this.phase = p; this.phaseT = 0; }
  /** the run is on (false while she falls and on the results card: losing the pointer then is no reason to pause) */
  get playing() { return this.phase !== 'down' && this.phase !== 'results'; }
  memoryOf(n: number): TimeState { return n % 2 === 1 ? ARENA.firstMemory : other(ARENA.firstMemory); }
  isGuardianWave(n: number) { return n > 0 && n % ARENA.bossEvery === 0; }

  // ------------------------------------------------------------------ the run
  /** Game.start → the run begins (also after FIGHT AGAIN) */
  begin() {
    const g = this.g, p = g.player;
    this.wave = 0; this.score = 0; this.kills = 0; this.guardians = 0; this.cycle = 0;
    this.runStart = g.t;
    p.hp = p.maxHp;
    p.damageMul = 1;
    g.time.unlocked = true;
    g.time.charge = Math.max(g.time.charge, 100);
    // both hold techniques from the first wave (the story grants them on Floors II and III)
    g.player.abilities = abilitiesForFloor(3);
    g.learned.crownbreaker = true; g.learned.whirlwind = true;
    this.paintHud();
    g.hud.message('ENDLESS ARENA', 'Survive as long as you can', 3.6);
    this.set('intro');
    this.note('run begins');
  }

  /** per frame (Game.step, after the Echoes) */
  update(dt: number) {
    const g = this.g, p = g.player;
    this.phaseT += dt;
    this.holdInside();
    (this.ward.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(g.t * 2.1) * 0.05;
    if (p.alive && this.phase === 'fight' && p.hp < this.lastHp - 0.01) this.hurt = true;
    this.lastHp = p.hp;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 3.4) this.announce(1);
        break;
      case 'announce':
        if (this.phaseT > ARENA.beat.announce) this.startWave();
        break;
      case 'fight':
        this.fight();
        break;
      case 'cleared':
        if (this.phaseT > ARENA.beat.cleared) this.turn();
        break;
      case 'turn':
        if (this.phaseT > ARENA.beat.turn) this.announce(this.wave + 1);
        break;
      case 'entrance':
        this.entrance(dt);
        break;
      case 'down':
        // a fall into the abyss ends in the respawn's black (Game.fallRespawn — there is no respawn here): the chamber
        // comes back behind the card
        if (this.phaseT > 0.9) this.g.hud.fade(false);
        if (this.phaseT > 2.2) this.showResults();
        break;
    }
    this.paintHud();
  }

  /** the next wave's name (a guardian's wave goes straight to its entrance) */
  private announce(n: number) {
    this.wave = n;
    const mem = this.memoryOf(n);
    if (this.g.time.state !== mem) this.g.forceState(mem);
    if (this.isGuardianWave(n)) { this.beginEntrance(); return; }
    const lines = LINES[mem];
    this.g.hud.message(`WAVE ${n}`, lines[(n * 7 + Math.floor(Math.random() * lines.length)) % lines.length], 2.6);
    this.g.audio.play('memory' as never, { vol: 0.55, rate: mem === 'PAST' ? 1.05 : 0.85 });
    this.set('announce');
  }

  private startWave() {
    const n = this.wave, g = this.g;
    g.player.damageMul = damageScale(n);
    this.queue = this.compose(waveBudget(n), this.memoryOf(n), n);
    this.risen = []; this.bosses = []; this.pack = 0; this.escortCalled = false; this.hurt = false; this.lastHp = g.player.hp;
    if (n === 1) g.hud.prompt(Platform.isTouch ? 'HOLD ATTACK — the Whirlwind · HOLD HEAVY — the Crownbreaker' : 'HOLD the attack — the Whirlwind · HOLD the heavy — the Crownbreaker', 5);
    this.note(`wave ${n} (${this.memoryOf(n)}): ${this.queue.join(' ')}`);
    this.spawnPack();
    this.set('fight');
  }

  /** a wave's Echoes for `budget` points, from the memory's roster (elites rise last) */
  private compose(budget: number, mem: TimeState, n: number): ArchetypeId[] {
    const out: ArchetypeId[] = [];
    const roster = ROSTER[mem].filter((r) => r.from <= n);
    let left = budget;
    for (let guard = 0; guard < 60 && left > 0; guard++) {
      const fit = roster.filter((r) => r.cost <= left && (r.max === undefined || out.filter((x) => x === r.id).length < r.max) && this.g.enemies.arenaPool.has(r.id));
      if (!fit.length) break;
      let w = Math.random() * fit.reduce((s, r) => s + r.weight, 0);
      const pick = fit.find((r) => (w -= r.weight) <= 0) ?? fit[0];
      out.push(pick.id);
      left -= pick.cost;
    }
    return out.sort((a, b) => (KILL_TIER[a] === 'elite' ? 1 : 0) - (KILL_TIER[b] === 'elite' ? 1 : 0));
  }

  /** the wave's fight: the next pack rises when few are left; done when all have risen and fallen */
  private fight() {
    const standing = this.risen.filter((e) => e.alive).length;
    // a guardian below ESCORT_AT calls its echoes once
    if (!this.escortCalled && this.bosses.some((b) => b.alive && b.hp < b.maxHp * ESCORT_AT)) {
      this.escortCalled = true;
      const mem = this.memoryOf(this.wave);
      this.queue.push(...this.compose(Math.max(3, Math.round(waveBudget(this.wave) * ESCORT_SHARE)), mem, this.wave));
      this.g.hud.prompt(`${this.guardian?.title ?? 'The guardian'} calls its Echoes`, 2.6);
      this.note(`escort: ${this.queue.join(' ')}`);
    }
    // the boss bar follows the guardian still standing (the Two Oaths)
    const em = this.g.enemies;
    if (this.bosses.length && (!em.boss || !em.boss.alive)) {
      const next = this.bosses.find((b) => b.alive);
      if (next) { em.boss = next; em.bossName = NAMES[next.arch.id] ?? this.guardian?.title ?? 'THE GUARDIAN'; }
    }
    if (this.queue.length && standing <= PACK_AT && this.g.t >= this.nextPackAt) { this.nextPackAt = this.g.t + 0.6; this.spawnPack(); }
    if (!this.queue.length && (this.risen.length || this.bosses.length) && this.risen.every((e) => !e.alive) && this.bosses.every((b) => !b.alive)) this.waveCleared();
  }

  private spawnPack() {
    const g = this.g, em = g.enemies, n = this.wave, st = g.time.state;
    const room = Math.max(1, waveCap(n) - this.risen.filter((e) => e.alive).length);
    const spots = em.walkableAround(this.center, st, ARENA.spawnR[0], ARENA.spawnR[1], ARENA.clear).filter((q) => !this.inWedge(q) || st === 'PAST');
    const take = this.queue.splice(0, Math.min(room, this.queue.length));
    if (!take.length) return;
    // a kind whose bodies are all still falling (the death fade) waits for the next pack — never dropped
    const enc = this.encounter(`AW${n}.${++this.pack}`, false);
    for (const id of take) {
      const e = em.takeArena(id);
      if (!e) { this.queue.push(id); this.note(`${id}: no body free yet — waits`); continue; }
      const at = spots.shift() ?? this.ringPoint(Math.random() * 360, 12.5);
      this.raise(e, at, enc, hpScale(n));
    }
    if (!enc.enemies.length) { this.g.enemies.encounters.delete(enc.id); this.pack--; return; }
    if (this.pack > 1) g.hud.prompt('More Echoes rise', 1.6);
    g.signals.emit('encounter:start', { id: enc.id, boss: false, kinds: [...new Set(enc.enemies.map((e) => e.arch.id))], count: enc.enemies.length });
  }

  /** one of the arena's Echoes into the fight: scaled health, both memories, risen where she can see it */
  private raise(e: Enemy, at: THREE.Vector3, enc: Encounter, hpMul: number, guardian = false) {
    const em = this.g.enemies, st = this.g.time.state;
    e.maxHp = Math.round(e.arch.hp * hpMul);
    em.revive(e, st, at, enc.id, { quiet: true });
    e.owner = 'BOTH';
    e.yaw = Math.atan2(this.g.player.pos.x - at.x, this.g.player.pos.z - at.z);
    e.root.rotation.y = e.yaw;
    enc.enemies.push(e);
    if (guardian) this.bosses.push(e); else this.risen.push(e);
    return e;
  }

  private encounter(id: string, boss: boolean, title?: string): Encounter {
    const em = this.g.enemies;
    const enc: Encounter = {
      id, state: 'BOTH', box: new THREE.Box3().setFromCenterAndSize(this.center.clone(), new THREE.Vector3(38, 16, 38)), enemies: [],
      triggered: true, cleared: false, wave: 1, optional: false, finale: false, tutorial: false, bossFight: boss, surge: false, title,
    };
    em.encounters.set(id, enc);
    return enc;
  }

  private waveCleared() {
    const g = this.g, p = g.player, n = this.wave;
    const bonus = SCORE.clear * n * (this.hurt ? 1 : SCORE.flawless);
    this.score += bonus;
    const guardianWave = this.isGuardianWave(n);
    const head = guardianWave ? `${this.guardian?.title ?? 'THE GUARDIAN'} FALLS` : `WAVE ${n} CLEARED`;
    g.hud.message(head, `+${fmt(bonus)}${this.hurt ? '' : ' · untouched'}`, 2.6);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * ARENA.clearHeal);
    g.time.charge = Math.max(g.time.charge, ARENA.clearCharge);
    g.audio.shiftBoom(g.time.state);
    if (guardianWave) { g.fx.slowmo(0.8, 0.35); g.hud.flash('#ffe2a8', 0.4); }
    g.enemies.boss = null;
    this.guardian = null;
    // the wave's finished fights are forgotten (their bodies — still falling — go back to the resting ARENA fight first:
    // every Echo's fight is looked up each frame)
    for (const [id, enc] of g.enemies.encounters) {
      if (!id.startsWith('AW') || !enc.cleared) continue;
      for (const e of enc.enemies) if (e.encounter === id) e.encounter = 'ARENA';
      g.enemies.encounters.delete(id);
    }
    this.bump();
    this.note(`wave ${n} cleared: +${Math.round(bonus)} (score ${Math.round(this.score)})`);
    this.set('cleared');
  }

  /** between waves: the memory turns (the hero is drawn onto safe stone first if the next memory has none under her) */
  private turn() {
    const g = this.g, p = g.player, next = this.memoryOf(this.wave + 1);
    if (g.time.state !== next) {
      const v = g.time.validate(p, next);
      if (!v.ok) {
        const safe = this.safeIn(next, p.pos);
        g.fx.shiftBurst(p.pos.clone(), g.time.state);
        p.teleport(safe, p.yaw);
        g.fx.shiftBurst(safe.clone(), next);
      }
      g.time.setState(next, p.pos.clone(), true);
      const [t, s] = TURN[next];
      g.hud.message(t, s, 2);
    }
    this.set('turn');
  }

  // ------------------------------------------------------------------ the guardians
  private beginEntrance() {
    const g = this.g, p = g.player, n = this.wave;
    const k = n / ARENA.bossEvery - 1;
    this.guardian = GUARDIANS[k % GUARDIANS.length];
    this.cycle = Math.floor(k / GUARDIANS.length);
    g.player.damageMul = damageScale(n);
    this.queue = []; this.risen = []; this.bosses = []; this.pack = 0; this.escortCalled = false; this.hurt = false;
    // where it comes — always in the open, never behind a pillar (they stand at 0/90/180/270°, r 11): through the
    // bridge's mouth beside the west pillar (the gate), over the rim between two pillars (the abyss), two pillars of
    // light either side of one (rise), out of the floor in front of a pillar (eruption) — on the side away from her
    const toHero = new THREE.Vector3().subVectors(p.pos, this.center).setY(0);
    const heroDeg = toHero.lengthSq() > 1 ? THREE.MathUtils.radToDeg(Math.atan2(-toHero.z, toHero.x)) : 0;
    const far = heroDeg + 180;
    const snap = (deg: number, step: number, off: number) => Math.round((deg - off) / step) * step + off;
    const ent = this.guardian.entrance;
    const side = Math.sin(THREE.MathUtils.degToRad(heroDeg - ARENA.bridgeDeg)) >= 0 ? 1 : -1;
    const spots = ent === 'gate' ? [this.ringPoint(ARENA.bridgeDeg - side * 24, 14.6)]
      : ent === 'abyss' ? [this.ringPoint(snap(far, 90, 45), 15.2)]
        : ent === 'rise' ? [this.ringPoint(snap(far, 90, 0) - 24, 14.4), this.ringPoint(snap(far, 90, 0) + 24, 14.4)]
          : [this.ringPoint(snap(far, 90, 0), 7.2)];
    p.beginScripted();
    p.anim.play('idle_alert', { fade: 0.3, loop: true });
    p.yaw = Math.atan2(spots[0].x - p.pos.x, spots[0].z - p.pos.z);
    p.invuln = 7;
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    const cam = { pos: g.camera.position.clone(), look: p.pos.clone().setY(p.pos.y + 1.6) };
    g.rig.cine = cam;
    this.ent = { t: 0, spots, cam, appeared: false, titled: false, cues: new Set() };
    this.note(`guardian wave ${n}: ${this.guardian.title} (${ent}${this.cycle ? ', ascendant ' + this.cycle : ''})`);
    this.set('entrance');
  }

  /**
   * The entrance (≈5 s): the light gathers where it will stand — embers, a rising roar, the ground shaking — while the
   * camera draws back; it arrives in a blast (shockwave, flash, the sting, its voice); a low shot holds on it under its
   * name; then the camera returns behind her and the fight begins.
   */
  private entrance(dt: number) {
    const g = this.g, p = g.player, en = this.ent!, gd = this.guardian!;
    en.t += dt;
    const t = en.t, S = en.spots[0];
    const once = (k: string, at: number, fn: () => void) => { if (t >= at && !en.cues.has(k)) { en.cues.add(k); fn(); } };
    const color = g.time.state === 'PAST' ? 0xffb060 : 0xff4a2a;
    // the gathering
    if (!en.appeared) {
      for (const s of en.spots) {
        const r = 0.6 + t * 0.9;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * r;
          const from = s.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.05, Math.sin(a) * rr));
          g.fx.emit(from, new THREE.Vector3((s.x - from.x) * 0.6, 2.6 + Math.random() * 3.5, (s.z - from.z) * 0.6), color, 0.9, 0.06 + Math.random() * 0.06, -1.5);
        }
      }
      g.rig.addShake(0.004 + t * 0.006);
    }
    once('gather', 0, () => { g.audio.play('crown_resonance' as never, { pos: S, vol: 1.1, rate: 0.85 }); g.hud.flash(g.time.state === 'PAST' ? '#3a2008' : '#2a0606', 0.35); });
    once('charge', 0.5, () => g.audio.play('shift_charge' as never, { pos: S, vol: 0.9, rate: 0.7 }));
    once('pulse1', 0.6, () => { for (const s of en.spots) g.fx.shiftBurst(s.clone(), g.time.state); });
    once('thunder', 1.1, () => { g.audio.play('thunder' as never, { vol: 0.8, rate: 0.8 }); for (const s of en.spots) g.fx.shockwave(s.clone(), 2.5, 0.3); });
    once('arrive', 1.7, () => this.arrive());
    // the chamber's light: a flare at the arrival, then the hero's own light held on the guardian through its name
    g.flare = t < 1.7 ? sm(1.0, 1.7, t) * 0.5 : t < 2.3 ? 1 - sm(1.7, 2.3, t) * 0.55 : 0.45 * (1 - sm(3.9, 4.8, t));
    once('roar', 2.05, () => { for (const b of this.bosses) g.audio.play(gd.roar as never, { pos: b.pos, vol: 1.2, rate: 0.85 }); });
    once('title', 2.0, () => this.showTitle());
    // the camera: back and wide while it gathers, low on it once it stands, then home behind her
    const H = p.pos;
    const focus = this.bosses[0]?.alive ? this.bosses[0].pos : S;
    const dir = new THREE.Vector3().subVectors(focus, H).setY(0);
    const dist = Math.max(4, dir.length());
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const tall = (this.bosses[0]?.height ?? 2) * (this.bosses[0]?.arch.scale ?? 1.3);
    const behind = H.clone().addScaledVector(dir, -4.4).addScaledVector(right, 1.2).setY(H.y + 2.3);
    const wide = H.clone().addScaledVector(dir, -6).addScaledVector(right, 3.4).setY(H.y + 1.5);
    const push = sm(1.8, 4.2, t);
    // the low shot stands back further from the big ones (the Weeping Mother, the Maw) so the whole body reads
    const back = 6.2 + Math.max(0, (this.bosses[0]?.radius ?? 0.6) - 0.6) * 3.2 - push * 1.4;
    const low = focus.clone().addScaledVector(dir, -Math.min(dist * 0.7, back)).addScaledVector(right, 1.8).setY(focus.y + 0.7);
    const a = sm(0, 1.3, t), b = sm(1.75, 2.15, t);
    en.cam.pos.copy(behind).lerp(wide, a).lerp(low, b);
    if (en.appeared) {
      const k = sm(1.7, 2.1, t) * (1 - sm(4.3, 5.0, t));
      const at = focus.clone().addScaledVector(dir, -2.4).addScaledVector(right, 1.2).setY(focus.y + tall * 0.9);
      g.stageLight = { at, k };
    }
    en.cam.look.copy(H.clone().setY(H.y + 1.6)).lerp(S.clone().setY(S.y + 1.4), sm(0.2, 1.2, t)).lerp(focus.clone().setY(focus.y + tall * 0.62), b);
    if (t > 4.6 && g.rig.cine) {
      g.rig.cine = null;
      g.hud.cinematic(false);
      g.touch?.cinematic(false);
    }
    if (t > 5.2) this.endEntrance();
  }

  /** the guardian(s) stand — in a blast of the memory's light */
  private arrive() {
    const g = this.g, gd = this.guardian!, en = this.ent!;
    const enc = this.encounter(`AW${this.wave}.G`, true, gd.title);
    const mul = (1 + this.cycle * GUARDIAN_CYCLE_HP) * (1 + (this.wave - 1) * 0.012);
    gd.ids.forEach((id, i) => {
      const e = g.enemies.takeArena(id);
      if (!e) { this.note(`no body for guardian ${id}`); return; }
      const at = en.spots[i] ?? en.spots[0];
      this.raise(e, at, enc, mul, true);
      e.cooldown = 99;
      e.untargetable = true;
    });
    // a second Two Oaths body would share the first's bar: separate fights, the bar follows whichever stands (fight)
    if (this.bosses.length > 1) {
      const second = this.encounter(`AW${this.wave}.G2`, true, NAMES[this.bosses[1].arch.id]);
      const b = this.bosses[1];
      enc.enemies.splice(enc.enemies.indexOf(b), 1);
      second.enemies.push(b);
      b.encounter = second.id;
    }
    g.enemies.boss = this.bosses[0] ?? null;
    g.enemies.bossName = this.bosses.length > 1 ? NAMES[this.bosses[0].arch.id]! : gd.title;
    for (const s of en.spots) { g.fx.shockwave(s.clone(), 7, 1); g.fx.shiftBurst(s.clone(), g.time.state); g.fx.dust(s.clone(), 24); }
    g.hud.flash(g.time.state === 'PAST' ? '#ffd9a0' : '#ff9a7a', 0.7);
    g.rig.addShake(0.9);
    g.audio.play('final_collapse' as never, { pos: en.spots[0], vol: 0.8, rate: 1.3 });
    g.audio.play('land_heavy' as never, { pos: en.spots[0], vol: 1.4, rate: 0.7 });
    g.audio.bossSting();
    en.appeared = true;
    g.signals.emit('encounter:start', { id: enc.id, boss: true, title: gd.title, kinds: gd.ids, count: gd.ids.length });
  }

  private showTitle() {
    const gd = this.guardian!;
    const el = this.titleEl;
    (el.querySelector('small') as HTMLElement).textContent = `Wave ${this.wave} · ${this.cycle ? 'Ascendant guardian' : 'Guardian'}`;
    const name = gd.title + (this.cycle ? ` ${'I'.repeat(Math.min(3, this.cycle + 1))}` : '');
    (el.querySelector('h2') as HTMLElement).textContent = name;
    el.classList.toggle('long', name.length > 18);
    (el.querySelector('p') as HTMLElement).textContent = gd.epithet;
    el.classList.remove('out');
    el.classList.add('on');
    setTimeout(() => { el.classList.add('out'); el.classList.remove('on'); }, 3000);
  }

  private endEntrance() {
    const g = this.g, p = g.player;
    if (g.rig.cine) { g.rig.cine = null; g.hud.cinematic(false); g.touch?.cinematic(false); }
    p.endScripted();
    p.invuln = 0.6;
    g.stageLight = null;
    g.flare = 0;
    for (const b of this.bosses) { b.untargetable = false; b.cooldown = 1.1; }
    this.ent = null;
    this.hurt = false;
    this.lastHp = p.hp;
    this.set('fight');
  }

  // ------------------------------------------------------------------ scoring
  private onKill(d: { arch: ArchetypeId; boss?: boolean; voidDeath?: boolean; finisher?: boolean }) {
    if (this.phase !== 'fight' && this.phase !== 'cleared' && this.phase !== 'entrance') return;
    const tier = KILL_TIER[d.arch] ?? 'normal';
    let pts = SCORE.tier[tier] * (1 + (Math.max(1, this.wave) - 1) * SCORE.perWave);
    if (d.finisher) pts *= SCORE.finisher;
    if (d.voidDeath) pts *= SCORE.void;
    if (d.boss) { pts *= 1 + this.cycle * 0.5; this.guardians++; }
    this.score += pts;
    this.kills++;
    this.bump(`+${fmt(pts)}`);
  }

  private bump(chip = '') {
    const s = this.hudEl.querySelector('.ah-score') as HTMLElement;
    s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
    if (chip) {
      const i = s.querySelector('i') as HTMLElement;
      i.textContent = chip;
      i.classList.remove('pop'); void i.offsetWidth; i.classList.add('pop');
    }
  }

  private paintHud() {
    const n = this.wave, st = this.g.time.state;
    const wave = n ? String(n) : '—';
    const mem = st === 'PAST' ? 'Past' : 'Present';
    const score = fmt(this.score);
    const standing = this.risen.filter((e) => e.alive).length + this.queue.length + this.bosses.filter((b) => b.alive).length;
    const left = this.phase === 'fight' && standing ? `${standing} Echo${standing === 1 ? '' : 'es'} remain${standing === 1 ? 's' : ''}` : '';
    if (this.shown.wave !== wave + mem) {
      this.shown.wave = wave + mem;
      (this.hudEl.querySelector('.ah-wave b') as HTMLElement).textContent = wave;
      (this.hudEl.querySelector('.ah-wave em') as HTMLElement).textContent = mem;
      this.hudEl.classList.toggle('guardian', this.isGuardianWave(n));
    }
    if (this.shown.score !== score) { this.shown.score = score; (this.hudEl.querySelector('.ah-score b') as HTMLElement).textContent = score; }
    if (this.shown.left !== left) { this.shown.left = left; (this.hudEl.querySelector('.ah-left') as HTMLElement).textContent = left; }
  }

  // ------------------------------------------------------------------ the end of a run
  /** Game.onPlayerDeath */
  onDeath() {
    const g = this.g;
    if (this.phase === 'down' || this.phase === 'results') return;
    if (this.ent) { g.rig.cine = null; g.hud.cinematic(false); g.touch?.cinematic(false); this.ent = null; g.stageLight = null; g.flare = 0; }
    g.fx.slowmo(1.2, 0.3);
    this.note(`fallen on wave ${this.wave}: score ${Math.round(this.score)}`);
    this.set('down');
  }

  private run(): ArenaRun {
    return { score: Math.round(this.score), wave: Math.max(1, this.wave), kills: this.kills, seconds: Math.round(this.g.t - this.runStart) };
  }

  private showResults() {
    const g = this.g;
    this.set('results');
    // the fight fades out of the memory: what still stands goes with it
    for (const e of g.enemies.enemies) if (e.alive && g.enemies.arenaPool.get(e.arch.id)?.includes(e)) { if (e.root.visible) e.die(); else e.vanish(); }
    g.enemies.boss = null;
    const run = this.run();
    const best = Leaderboards.recordLocal(run);
    const prev = Leaderboards.localBest();
    this.last = { run, best, board: null, rank: null };
    const online = Leaderboards.online;
    const secs = run.seconds;
    this.resultsEl.innerHTML = `
      <div class="ar-card">
        <small class="ar-kicker">Endless Arena</small>
        <h2>You have fallen</h2>
        <div class="ar-rule"><i></i><b>◆</b><i></i></div>
        <div class="ar-main"><div><small>Wave</small><b>${run.wave}</b></div><div><small>Score</small><b>${fmt(run.score)}</b></div></div>
        <div class="ar-pb">${online ? '' : best ? '<p class="ar-best">A new personal best</p>' : prev ? `<p class="ar-prev">Your best · ${fmt(prev.score)} · wave ${prev.wave}</p>` : ''}</div>
        <p class="ar-line">Echoes released ${run.kills} · Guardians felled ${this.guardians} · ${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s</p>
        <div class="ar-board">${online ? '<h3>Top runs</h3><p class="ar-wait">Loading the leaderboard…</p>' : this.localBoard(run)}</div>
        <div class="ar-actions"><button class="ar-again" type="button">Fight again</button><button class="ar-title" type="button">Return to title</button></div>
      </div>`;
    this.resultsEl.classList.add('on');
    // (the page's flag has its own name: `arena-results` is the card's class, and the card's styles start at opacity 0 —
    // on <html> they faded the whole page out the moment the card came up)
    document.documentElement.classList.add('arena-over');
    document.exitPointerLock?.();
    const again = this.resultsEl.querySelector('.ar-again') as HTMLButtonElement;
    const title = this.resultsEl.querySelector('.ar-title') as HTMLButtonElement;
    again.addEventListener('click', () => this.restart());
    title.addEventListener('click', () => this.onTitle?.());
    this.cardAt = performance.now();
    window.addEventListener('keydown', this.onKey, true);
    g.audio.ui?.('select' as never);
    if (online) void this.board(run);
  }
  /** main.ts: back to the title */
  onTitle?: () => void;

  private cardAt = 0;
  /** Enter = FIGHT AGAIN, once the card has been up a second (keys still held from the fight never skip it); Esc and the
   *  rest do nothing here — the way back to the title is its own button, never a stray key */
  private onKey = (e: KeyboardEvent) => {
    if (this.phase !== 'results') return;
    e.stopPropagation();
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && performance.now() - this.cardAt > 1000) { e.preventDefault(); this.restart(); }
  };

  /** upload the run, then the top ten (and her own standing when she is not among them) */
  private async board(run: ArenaRun) {
    const sub = await Leaderboards.submit(run);
    const top = await Leaderboards.top(10);
    const mine = sub ? null : await Leaderboards.mine();
    if (this.phase !== 'results' || !this.last || this.last.run !== run) return;
    this.last.board = top; this.last.rank = sub?.rank ?? mine?.rank ?? null;
    const host = this.resultsEl.querySelector('.ar-board') as HTMLElement | null;
    if (!host) return;
    if (!top) { host.innerHTML = this.localBoard(run); return; }
    const meIn = top.some((r) => r.me);
    const rows = top.map((r) => `<li class="${r.me ? 'me' : ''}"><span class="r">${r.rank}</span><span class="n">${esc(r.name)}</span><span class="w">${r.wave ? 'W' + r.wave : ''}</span><span class="s">${fmt(r.score)}</span></li>`).join('');
    const rank = this.last.rank;
    const foot = !meIn && rank ? `<p class="ar-rank">Your rank · #${rank}${sub && !sub.improved ? ` · this run #${sub.runRank}` : ''}</p>` : '';
    // on Wavedash the leaderboard holds her best (this device's record starts over with every release: each build is
    // served from its own origin) — the personal-best line answers from it
    const pb = this.resultsEl.querySelector('.ar-pb') as HTMLElement | null;
    if (pb) pb.innerHTML = sub?.improved ? '<p class="ar-best">A new personal best</p>'
      : sub ? `<p class="ar-prev">Your best · ${fmt(sub.best)}</p>`
        : mine ? `<p class="ar-prev">Your best · ${fmt(mine.score)}${mine.wave ? ` · wave ${mine.wave}` : ''}</p>` : '';
    host.innerHTML = `<h3>Top runs</h3><ol>${rows || '<li class="empty">No runs yet.</li>'}</ol>${foot}`;
  }

  /** this device's ten best runs, this one marked (a local game, or no answer from the leaderboard) */
  private localBoard(run: ArenaRun) {
    const runs = Leaderboards.localRuns();
    let marked = false;
    const rows = runs.map((r, i) => {
      const me = !marked && r.score === run.score && r.wave === run.wave;
      if (me) marked = true;
      const when = me ? 'This run' : r.at ? new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Run';
      return `<li class="${me ? 'me' : ''}"><span class="r">${i + 1}</span><span class="n">${when}</span><span class="w">W${r.wave}</span><span class="s">${fmt(r.score)}</span></li>`;
    }).join('');
    return `<h3>Your top runs</h3><ol>${rows || '<li class="empty">No runs yet.</li>'}</ol>`;
  }

  /** FIGHT AGAIN: the same chamber, a fresh run */
  restart() {
    const g = this.g, p = g.player;
    if (this.phase !== 'results') return;
    window.removeEventListener('keydown', this.onKey, true);
    this.resultsEl.classList.remove('on');
    document.documentElement.classList.remove('arena-over');
    // every body back to its rest (the dormant ARENA fight), the run's fights forgotten
    for (const list of g.enemies.arenaPool.values()) for (const e of list) { if (e.alive) e.vanish(); e.encounter = 'ARENA'; }
    for (const id of [...g.enemies.encounters.keys()]) if (id.startsWith('AW')) g.enemies.encounters.delete(id);
    this.queue = []; this.risen = []; this.bosses = [];
    p.revive(this.center.clone(), Math.PI / 2);
    g.rig.snapBehind(p.yaw);
    if (g.time.state !== ARENA.firstMemory) g.time.setState(ARENA.firstMemory, p.pos.clone(), true);
    g.time.charge = 100;
    if (!Platform.isTouch) lockPointer(g.renderer.domElement);
    this.begin();
  }

  // ------------------------------------------------------------------ the ring
  /** a point on the ring (Blender degrees about the centre, radius in m), on the floor */
  ringPoint(deg: number, r: number) {
    const [x, y, z] = ARENA.center, a = THREE.MathUtils.degToRad(deg);
    return b2t(x + Math.cos(a) * r, y + Math.sin(a) * r, z);
  }
  /** over one of the Present's wedge-shaped drops */
  inWedge(q: THREE.Vector3) {
    const dx = q.x - this.center.x, dy = -q.z + this.center.z, r = Math.hypot(dx, dy);
    if (r < ARENA.wedgeR[0] - 0.4 || r > ARENA.wedgeR[1] + 0.4) return false;
    const deg = THREE.MathUtils.radToDeg(Math.atan2(dy, dx));
    return ARENA.wedges.some((w) => Math.abs(((deg - w + 540) % 360) - 180) <= ARENA.wedgeHalf + 2);
  }
  /** footing for her in memory `st`, nearest `from` (the lens, at worst) */
  private safeIn(st: TimeState, from: THREE.Vector3) {
    const col = this.g.level.collision, p = this.g.player;
    const ok = (q: THREE.Vector3) => col.hasFooting(q.clone().setY(q.y + 0.5), 1.5, st) && !col.inVoid(q.clone().setY(q.y - 0.4), st) && col.overlap(q, p.radius, p.height, st) < 0.05;
    for (let r = 1; r <= 9; r++) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, q = from.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (ok(q)) return q;
    }
    return this.center.clone();
  }
  /** the bridge is sealed: she stays on the ring */
  private holdInside() {
    const p = this.g.player;
    const dx = p.pos.x - this.center.x, dz = p.pos.z - this.center.z, r = Math.hypot(dx, dz);
    const lim = ARENA.radius - 0.55;
    if (r <= lim) return;
    p.pos.x = this.center.x + (dx / r) * lim;
    p.pos.z = this.center.z + (dz / r) * lim;
    const out = (p.vel.x * dx + p.vel.z * dz) / r;
    if (out > 0) { p.vel.x -= (dx / r) * out; p.vel.z -= (dz / r) * out; }
  }

  // ------------------------------------------------------------------ dev / tests
  /** release every Echo of the wave at once (probes) */
  killAll() { for (const e of [...this.risen, ...this.bosses]) if (e.alive) { e.die(); this.g.enemies.onKill(e); } this.queue = []; }
  /** jump to wave `n` (probes): the next announce is `n` */
  skipTo(n: number) { this.killAll(); this.wave = n - 1; this.set('turn'); this.phaseT = 99; }
  get alive() { return [...this.risen, ...this.bosses].filter((e) => e.alive); }
}

function el(parent: HTMLElement, cls: string, html: string) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}
function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }
