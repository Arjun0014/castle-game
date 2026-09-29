import * as THREE from 'three';
import { Enemy, type EnemyCtx } from './Enemy';
import type { Archetype } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import { Spells, GOLD, VIOLET, EMBER } from '../vfx/Spells';

/**
 * THE LAST CROWN — Floor 3's mage boss (docs/LEVEL_03_BLUEPRINT.md §I). Aldren's imprint wearing the Queen's shape.
 * Model/clips: lastcrown.glb (tools/blender/build_lastcrown.py); release times below are the measured hand-speed
 * peaks of each cast clip (src/data/bossAnimations.json).
 *
 * Loop: strafe at a preferred range → pick a spell for the current range + phase → play its clip → spells leave the
 * hand at the measured release frames → short recovery. Blink away when crowded. Phase breaks at 65 % / 30 %.
 * Time-shift hooks: wards and bindings exist in one memory only — the player's own shift (onPlayerShift) breaks them.
 * Forced slips (phase 2+) move the fight between memories with a 3 s telegraph.
 */
type Mode = 'idle' | 'cast' | 'blink' | 'break' | 'stagger' | 'dying' | 'intro';
interface CastDef { clip: string; release: number[]; range: [number, number]; phase: number; weight: number; tail: number; tell?: number }

const CASTS: Record<string, CastDef> = {
  bolt: { clip: 'throw', release: [0.8], range: [5, 40], phase: 1, weight: 3, tail: 0.5 },
  twin: { clip: 'double_cast', release: [0.33, 0.93], range: [5, 40], phase: 1, weight: 2.5, tail: 0.45 },
  fan: { clip: 'sweep', release: [0.53], range: [3.2, 12], phase: 1, weight: 2.5, tail: 0.55 },
  wave: { clip: 'ground_slam', release: [1.27], range: [2.5, 14], phase: 1, weight: 1.8, tail: 0.6 },
  repel: { clip: 'push', release: [1.13], range: [0, 4.6], phase: 1, weight: 4, tail: 0.5, tell: 1 },
  bombard: { clip: 'slam_call', release: [0.63], range: [5, 40], phase: 2, weight: 2.2, tail: 0.7 },
  nova: { clip: 'nova', release: [1.8], range: [0, 7.5], phase: 2, weight: 2.4, tail: 0.6, tell: 1 },
  beam: { clip: 'beam', release: [1.0], range: [5, 30], phase: 2, weight: 1.6, tail: 0.4 },
  orb: { clip: 'charge_orb', release: [2.0], range: [4, 40], phase: 3, weight: 1.4, tail: 0.6 },
  dark: { clip: 'crouch_blast', release: [2.03], range: [0, 5], phase: 3, weight: 3, tail: 0.6, tell: 1 },
};
const PHASE_SPEED = [0, 1.05, 1.25, 1.4];
const PHASE_GAP: [number, number][] = [[0, 0], [1.3, 1.9], [0.85, 1.35], [0.55, 1.0]];
const PHASE_RANGE = [0, 8.5, 7.5, 6.5];
/** default ring radius she keeps to; the arena's lens marker overrides it (prop r; session 9: the Crownheart ring) */
const ARENA_R = 10.5;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class LastCrown extends Enemy {
  spells: Spells;
  phase = 1;
  mode: Mode = 'idle';
  private t = 0;              // time in mode
  private cast: CastDef | null = null;
  private castId = '';
  private released = 0;
  private gap = 2.5;
  private strafe = 1;
  private crowdT = 0;
  private invuln = false;
  private staggerT = 0;
  wardUp = false;
  private wardState: TimeState = 'PAST';
  private wardT = 0;
  private nextWard = 14;
  private slipT = -1;
  private nextSlip = 20;
  private slipTo: TimeState = 'PRESENT';
  private bindT = -1;
  private nextBind = 12;
  private beamYaw = 0;
  private summoned80 = false;
  private deathT = 0;
  private breakTo = 0;
  private lens: THREE.Vector3;
  private points: THREE.Vector3[];
  /** the ring she never leaves (m from the lens) */
  private arenaR = ARENA_R;
  /** where she descends from (the Crownheart), and the reveal / death camera */
  private heartPos: THREE.Vector3 | null = null;
  private cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private introT = 0;
  private wedges: { angle: number; half: number; r0: number; r1: number }[];
  handR: THREE.Object3D | null = null;
  handL: THREE.Object3D | null = null;

  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number,
    opts: { yaw?: number }, private g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts);
    model.traverse((o) => {
      if (o.name === 'mixamorigRightHand') this.handR = o;
      if (o.name === 'mixamorigLeftHand') this.handL = o;
    });
    const lens = g.level.markersOf('boss_lens')[0];
    this.lens = lens ? lens.pos.clone() : new THREE.Vector3();
    if (lens?.props.r) this.arenaR = lens.props.r;
    const heart = g.level.markersOf('heart')[0];
    if (heart) this.heartPos = heart.pos.clone();
    this.points = g.level.markersOf('boss_point').map((m) => m.pos.clone());
    this.wedges = g.level.markersOf('wedge').map((m) => ({ angle: m.props.angle, half: m.props.half, r0: m.props.r0, r1: m.props.r1 }));
    this.spells = new Spells(g.scene, {
      player: g.player,
      world: () => g.level.collision,
      state: () => g.time.state,
      now: () => g.t,
      hurt: (dmg, from, o) => this.hurtPlayer(dmg, from, o),
      burst: (at, color, n, speed = 3) => {
        for (let i = 0; i < n; i++) g.fx.emit(at, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(speed), color, 0.35 + Math.random() * 0.3, 0.07 + Math.random() * 0.06, 0);
      },
      sound: (id, at, vol, rate) => this.sfx(id, at, vol, rate),
    }, this.wedges, this.lens);
  }

  // ---------------------------------------------------------------------------------------------- helpers
  private get color() { return this.g.time.state === 'PAST' ? GOLD : VIOLET; }
  private sfx(id: string, at?: THREE.Vector3, vol = 1, rate = 1) {
    if (this.g.audio.isBound(id)) this.g.audio.play(id as any, { pos: at, vol, rate, jitter: 0.05 });
  }
  private hand(i = 0) {
    const h = (i % 2 === 0 ? this.handR : this.handL) ?? this.handR;
    const out = new THREE.Vector3();
    if (h) h.getWorldPosition(out); else out.copy(this.pos).setY(this.pos.y + 1.6);
    return out;
  }
  private hurtPlayer(dmg: number, from: THREE.Vector3, o: { knock?: number; heavy?: boolean; unblockable?: boolean }) {
    const g = this.g, p = g.player;
    const res = p.receiveHit(dmg, from, o, g.input.now);
    if (res === 'hit') {
      g.audio.hurt();
      g.fx.bloodSpray(p.pos.clone().setY(p.pos.y + 1.2), p.pos.clone().sub(from).setY(0).normalize(), o.heavy ? 0.7 : 0.4);
      g.rig.addShake(o.heavy ? 0.45 : 0.25);
      g.hud.flash('#5a0030', 0.22);
    } else if (res === 'block' || res === 'parry') {
      g.fx.sparks(p.blade.hilt.clone().lerp(p.blade.tip, 0.45), 18, this.color);
      g.rig.addShake(0.15);
    }
    return res;
  }
  /** point inside a Present wedge hole (blueprint §K) */
  inWedge(p: THREE.Vector3) {
    const dx = p.x - this.lens.x, dz = p.z - this.lens.z;
    const r = Math.hypot(dx, dz);
    const deg = THREE.MathUtils.radToDeg(Math.atan2(-dz, dx)); // Blender angle (north = -z)
    return this.wedges.some((w) => r > w.r0 - 0.2 && r < w.r1 + 0.2 && Math.abs(((deg - w.angle + 540) % 360) - 180) < w.half + 2);
  }
  private play(clip: string, speed = 1, fade = 0.15) { this.once(clip, speed * PHASE_SPEED[this.phase], 0, fade); }

  // ---------------------------------------------------------------------------------------------- main update
  update(dt: number, ctx: EnemyCtx) {
    this.stateTime += dt;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    const toP = _v.subVectors(ctx.playerPos, this.pos).setY(0);
    const dist = toP.length();
    const dirP = dist > 1e-3 ? toP.clone().divideScalar(dist) : this.facing;
    if (this.mode === 'dying') { this.updateDeath(dt); this.finishFrame(dt); return; }
    if (this.mode === 'intro') { this.updateIntro(dt); this.mixer.update(dt); this.syncRoot(); return; }
    if (!this.triggered || !ctx.playerAlive) {
      this.loop(this.arch.clips.idle, 1);
      this.spells.update(dt);
      this.finishFrame(dt);
      return;
    }
    this.spells.update(dt);
    this.updateWard(dt, ctx.state);
    this.updateSlip(dt, ctx.state);
    this.updateBinding(dt);
    if (this.phase === 1 && !this.summoned80 && this.hp < this.arch.hp * 0.8) { this.summoned80 = true; this.g.enemies.summonRemnants(2, this.lens); }
    if (this.phase === 3 && Math.random() < dt * 20) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 12;
      this.g.fx.emit(this.lens.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new THREE.Vector3(0, 0.8 + Math.random(), 0), EMBER, 1.4, 0.06, -0.3, 0.3);
    }
    switch (this.mode) {
      case 'idle': this.think(dt, dist, dirP, ctx); break;
      case 'cast': this.updateCast(dt, dist, dirP); break;
      case 'blink': this.updateBlink(dt); break;
      case 'break': this.updateBreak(dt); break;
      case 'stagger':
        this.staggerT -= dt;
        if (this.staggerT <= 0) { this.mode = 'idle'; this.t = 0; this.gap = 0.6; this.loop(this.arch.clips.idle, 1, 0.3); }
        break;
    }
    this.finishFrame(dt);
  }

  private finishFrame(dt: number) {
    // she hovers at the lens height (the Crownheart holds her up: no gravity, holes never take her)
    this.pos.y = this.lens.y;
    this.mixer.update(dt);
    this.syncRoot();
    if (this.mode === 'blink' && this.t > 0.55 && this.t < 1.05) this.root.visible = false;
    if (this.wardUp) this.spells.setWard(true, _w.copy(this.pos).setY(this.pos.y + 1.4), this.wardState === 'PAST' ? GOLD : VIOLET);
  }

  /** Strafe at the preferred range, then choose the next spell for this range. */
  private think(dt: number, dist: number, dirP: THREE.Vector3, ctx: EnemyCtx) {
    this.turnToward(dirP, this.arch.turnRate, dt);
    this.crowdT = dist < 4 ? this.crowdT + dt : Math.max(0, this.crowdT - dt * 2);
    if (this.crowdT > (this.phase === 1 ? 2.2 : 1.5) && this.t > 0.4) { this.beginBlink(); return; }
    // movement: tangential + radial correction toward the preferred range, kept inside the ring
    const want = PHASE_RANGE[this.phase];
    const tangent = _w.crossVectors(UP, dirP).multiplyScalar(this.strafe);
    const move = tangent.clone().multiplyScalar(this.arch.walkSpeed * 0.8).addScaledVector(dirP, THREE.MathUtils.clamp((dist - want) * 0.6, -1.6, 1.4));
    const next = this.pos.clone().addScaledVector(move, dt * 4);
    const fromC = next.clone().sub(this.lens).setY(0);
    if (fromC.length() > this.arenaR) move.addScaledVector(fromC.normalize(), -2.5);
    if (ctx.state === 'PRESENT' && this.inWedge(next)) { this.strafe *= -1; move.multiplyScalar(0.2); }
    if (Math.random() < dt * 0.15) this.strafe *= -1;
    this.pos.addScaledVector(move, dt);
    // she never leaves the ring (hard clamp: the lens is her anchor)
    const off = _w.subVectors(this.pos, this.lens).setY(0);
    if (off.length() > this.arenaR) this.pos.copy(this.lens).addScaledVector(off.setLength(this.arenaR), 1).setY(this.lens.y);
    const f = this.facing, r = _v.crossVectors(f, UP);
    const lf = move.dot(f), lr = move.dot(r);
    const c = this.arch.clips;
    if (move.length() < 0.2) this.loop(c.idle, 1);
    else if (Math.abs(lf) > Math.abs(lr)) this.loop(lf > 0 ? c.walk : c.back!, 1);
    else this.loop(lr > 0 ? c.strafeR! : c.strafeL!, 1);
    if (this.t < this.gap || this.slipT >= 0) return;
    // the ward goes up on its own schedule (phase 2+)
    if (this.phase >= 2 && !this.wardUp && this.g.t > this.nextWard) { this.raiseWard(ctx.state); return; }
    if (this.phase === 3 && this.bindT < 0 && this.g.t > this.nextBind && dist > 3) { this.beginCast('bind', { clip: 'raise', release: [0.6], range: [0, 40], phase: 3, weight: 0, tail: 0.5 }); return; }
    this.chooseCast(dist);
  }

  private chooseCast(dist: number) {
    const opts = Object.entries(CASTS).filter(([, c]) => c.phase <= this.phase && dist >= c.range[0] && dist <= c.range[1]);
    if (!opts.length) { this.beginCast('bolt', CASTS.bolt); return; }
    let total = opts.reduce((s, [, c]) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const [id, c] of opts) { r -= c.weight; if (r <= 0) { this.beginCast(id, c); return; } }
    this.beginCast(opts[0][0], opts[0][1]);
  }

  private beginCast(id: string, c: CastDef) {
    this.mode = 'cast'; this.t = 0; this.castId = id; this.cast = c; this.released = 0;
    this.play(c.clip, 1, 0.12);
    this.events.push('telegraph');
    this.sfx('mage_charge', this.pos, 0.7, 0.9 + Math.random() * 0.2);
    const sp = PHASE_SPEED[this.phase];
    if (id === 'repel') this.spells.tell(this.pos, 4.6, c.release[0] / sp, this.color);
    if (id === 'nova') this.spells.tell(this.pos, 6.0, c.release[0] / sp, EMBER);
    if (id === 'dark') this.spells.tell(this.pos, 4.8, c.release[0] / sp, EMBER);
    if (id === 'beam') this.beamYaw = Math.atan2(this.g.player.pos.x - this.pos.x, this.g.player.pos.z - this.pos.z) - 0.62 * (Math.random() < 0.5 ? 1 : -1);
  }

  private updateCast(dt: number, dist: number, dirP: THREE.Vector3) {
    const c = this.cast!;
    const ct = this.cur ? this.cur.time : 0;
    if (this.castId !== 'beam' || ct < c.release[0]) this.turnToward(dirP, this.arch.turnRate * 0.8, dt);
    while (this.released < c.release.length && ct >= c.release[this.released]) this.release(this.castId, this.released++, dist);
    if (this.castId === 'beam' && ct >= 1.0) {
      // the ray sweeps 70 degrees from where it started, then fades at 2.9 s
      const k = THREE.MathUtils.clamp((ct - 1.0) / 1.9, 0, 1);
      const yaw = this.beamYaw + (this.beamSweep) * k;
      const from = this.pos.clone().setY(this.pos.y + (this.g.time.state === 'PAST' ? 1.25 : 0.45));
      this.yaw = yaw;
      this.spells.setBeam(ct < 2.9, from.addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 0.8), yaw, this.color);
    }
    const end = c.release[c.release.length - 1] + c.tail + (this.castId === 'beam' ? 1.9 : 0);
    if (ct >= end || !this.cur?.isRunning()) {
      this.spells.setBeam(false);
      this.mode = 'idle'; this.t = 0;
      const [a, b] = PHASE_GAP[this.phase];
      this.gap = a + Math.random() * (b - a);
      // phase 3 chains a second spell straight away now and then
      if (this.phase === 3 && Math.random() < 0.35) this.gap = 0.15;
      this.loop(this.arch.clips.idle, 1, 0.25);
    }
  }
  private get beamSweep() { return 1.22 * (this.beamYaw < Math.atan2(this.g.player.pos.x - this.pos.x, this.g.player.pos.z - this.pos.z) ? 1 : -1); }

  /** Spell leaves the hand. */
  private release(id: string, i: number, dist: number) {
    const g = this.g, p = g.player;
    const col = this.color;
    const from = this.hand(i);
    const chest = p.pos.clone().setY(p.pos.y + 1.1);
    const aim = (speed: number, lead = 0.8) => {
      const flight = from.distanceTo(chest) / speed;
      return chest.clone().addScaledVector(p.vel.clone().setY(0), Math.min(0.9, flight * lead)).sub(from);
    };
    switch (id) {
      case 'bolt': case 'twin': {
        this.spells.bolt(from, aim(this.phase >= 2 ? 22 : 19), { speed: this.phase >= 2 ? 22 : 19, dmg: 15, color: col });
        this.sfx('mage_bolt', from);
        break;
      }
      case 'fan': {
        const base = aim(15, 0);
        for (let k = -2; k <= 2; k++) this.spells.bolt(from, base.clone().applyAxisAngle(UP, k * 0.26), { speed: 15, dmg: 10, color: col, life: 2.2 });
        this.sfx('mage_bolt', from, 1.1, 0.85);
        break;
      }
      case 'wave': {
        this.spells.wave(this.pos, 7.5 + this.phase, 15, 18, col);
        this.sfx('mage_nova', this.pos, 0.7, 1.3);
        g.rig.addShake(0.2);
        break;
      }
      case 'repel': case 'nova': case 'dark': {
        const r = id === 'repel' ? 4.6 : id === 'nova' ? 6.0 : 4.8;
        const dmg = id === 'repel' ? 22 : id === 'nova' ? 34 : 38;
        this.spells.wave(this.pos, 30, r, 0, id === 'repel' ? col : EMBER);
        this.sfx('mage_nova', this.pos, id === 'repel' ? 0.8 : 1.2, id === 'repel' ? 1.25 : 1);
        g.rig.addShake(id === 'repel' ? 0.25 : 0.4);
        for (let k = 0; k < 40; k++) g.fx.emit(this.pos.clone().setY(this.pos.y + 1), new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize().multiplyScalar(r * 1.6), id === 'repel' ? col : EMBER, 0.45, 0.12, 0);
        if (dist < r + 0.4) this.hurtPlayer(dmg, this.pos.clone(), { knock: id === 'repel' ? 8 : 6, heavy: id !== 'repel', unblockable: id !== 'repel' });
        break;
      }
      case 'bombard': {
        const n = this.phase >= 3 ? 5 : 4;
        this.spells.rune(p.pos.clone().addScaledVector(p.vel.clone().setY(0), 0.5), 1.7, 1.2, 26);
        for (let k = 1; k < n; k++) {
          const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 2.5;
          this.spells.rune(p.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), 1.6, 1.2 + k * 0.18, 26);
        }
        this.sfx('mage_charge', p.pos, 0.8, 0.7);
        break;
      }
      case 'beam': {
        this.sfx('mage_beam', this.pos, 1);
        this.spells.beamDmg = this.phase >= 3 ? 16 : 13;
        break;
      }
      case 'orb': {
        this.spells.bolt(from, aim(5, 0), { speed: 5, dmg: 40, color: EMBER, home: 1.3, life: 5.5, blast: 3, size: 2.2 });
        this.sfx('mage_bolt', from, 1.2, 0.6);
        break;
      }
      case 'bind': {
        this.bindT = 0;
        this.nextBind = this.g.t + 20;
        this.sfx('mage_ward', this.pos, 1, 0.7);
        g.hud.prompt('THE CROWN BINDS YOUR BLOOD — shift to break it', 3.5);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- blink
  private beginBlink() {
    this.mode = 'blink'; this.t = 0; this.crowdT = 0;
    this.untargetable = false;
    this.spells.setBeam(false);
    this.once('leap', 1.5, 0, 0.1);
    this.sfx('mage_charge', this.pos, 0.8, 1.4);
  }
  private updateBlink(dt: number) {
    void dt;
    if (this.t > 0.55 && !this.invuln) {
      this.invuln = true;
      this.untargetable = true;
      this.spells['host'].burst(this.pos.clone().setY(this.pos.y + 1.3), this.color, 40, 4);
      this.sfx('mage_teleport', this.pos);
      // reappear at the arena point farthest from the hero (one of the three farthest)
      const p = this.g.player.pos;
      const pts = [...this.points].filter((q) => !(this.g.time.state === 'PRESENT' && this.inWedge(q))).sort((a, b) => b.distanceTo(p) - a.distanceTo(p));
      const to = pts[Math.floor(Math.random() * Math.min(3, pts.length))] ?? this.lens;
      this.pos.copy(to);
    }
    if (this.t > 1.05) {
      this.invuln = false;
      this.untargetable = false;
      this.spells['host'].burst(this.pos.clone().setY(this.pos.y + 1.3), this.color, 40, 4);
      this.sfx('mage_teleport', this.pos, 0.8, 1.2);
      this.yaw = Math.atan2(this.g.player.pos.x - this.pos.x, this.g.player.pos.z - this.pos.z);
      this.beginCast('bolt', CASTS.bolt);
    }
  }

  // ---------------------------------------------------------------------------------------------- ward / binding / slips
  private raiseWard(st: TimeState) {
    this.wardUp = true; this.wardState = st; this.wardT = 7;
    this.nextWard = this.g.t + 16;
    this.once('ward_start', 1.4, 0, 0.1);
    this.mode = 'cast'; this.t = 0; this.castId = 'ward';
    this.cast = { clip: 'ward_start', release: [], range: [0, 99], phase: 2, weight: 0, tail: 0.35 };
    this.released = 0;
    this.sfx('mage_ward', this.pos);
    this.g.hud.prompt(`A ward of the ${st === 'PAST' ? 'Past' : 'Present'} — woven in this memory only`, 3);
  }
  private updateWard(dt: number, st: TimeState) {
    if (!this.wardUp) return;
    this.wardT -= dt;
    if (this.wardT <= 0) { this.wardUp = false; this.spells.setWard(false); }
    void st;
  }
  private updateBinding(dt: number) {
    if (this.bindT < 0) { this.spells.setTether(false); return; }
    this.bindT += dt;
    const p = this.g.player;
    const from = this.hand(0);
    this.spells.setTether(true, from, p.pos.clone().setY(p.pos.y + 1.1));
    const pull = this.pos.clone().sub(p.pos).setY(0);
    if (pull.length() > 2) p.vel.addScaledVector(pull.normalize(), 2.4 * dt * 8);
    if (this.bindT > 4) {
      this.bindT = -1;
      this.spells.setTether(false);
      this.hurtPlayer(45, this.pos.clone(), { knock: 5, heavy: true, unblockable: true });
      this.sfx('mage_nova', p.pos, 1, 0.8);
    }
  }
  /** The player's own shift completed (Game → onChannelComplete): wards and bindings live in one memory only. */
  onPlayerShift() {
    if (this.mode === 'dying') return;
    let broke = false;
    if (this.wardUp) { this.wardUp = false; this.spells.setWard(false); broke = true; this.g.hud.message('THE WARD UNRAVELS', 'It was woven in another memory', 2.5); }
    if (this.bindT >= 0) { this.bindT = -1; this.spells.setTether(false); broke = true; this.g.hud.message('THE BLOOD REFUSES', 'The binding breaks', 2.5); }
    if (!broke) return;
    this.sfx('mage_ward', this.pos, 1.2, 1.25);
    this.sfx('boss_scream', this.pos);
    this.spells.setBeam(false);
    this.mode = 'stagger'; this.staggerT = this.bindT === -1 && !this.wardUp ? 4 : 3.5; this.t = 0;
    this.once(this.arch.clips.hitH, 0.7, 0, 0.08);
    this.g.fx.slowmo(0.25, 0.45);
  }
  private updateSlip(dt: number, st: TimeState) {
    if (this.phase < 2 || this.mode === 'break') return;
    if (this.slipT < 0) {
      if (this.g.t < this.nextSlip || this.g.player.isChanneling) return;
      this.slipT = 0;
      this.slipTo = st === 'PAST' ? 'PRESENT' : 'PAST';
      this.sfx('crown_resonance', this.lens, 0.9);
      this.g.hud.prompt(this.slipTo === 'PRESENT' ? 'The Crown drags the castle toward the ruin — the floor will open' : 'The Crown drags the castle back into its memory', 3);
      return;
    }
    this.slipT += dt;
    this.spells.setWedges(this.slipTo === 'PRESENT' ? Math.min(1, this.slipT / 1.2) : 0);
    this.g.rig.addShake(dt * 0.3);
    if (this.slipT >= 3) {
      this.slipT = -1;
      this.nextSlip = this.g.t + (this.phase >= 3 ? 15 : 24);
      this.spells.setWedges(0);
      this.forceSlip(this.slipTo);
    }
  }
  /** Force the castle into `to`. A hero caught over a Present hole is thrown clear to the ring's inner edge. */
  forceSlip(to: TimeState) {
    const g = this.g, p = g.player;
    if (g.time.state === to) return;
    if (p.isChanneling) p.cancelChannel();
    if (to === 'PRESENT' && this.inWedge(p.pos)) {
      const out = p.pos.clone().sub(this.lens).setY(0);
      out.setLength(4.2);
      p.teleport(this.lens.clone().add(out));
      p.hp = Math.max(1, p.hp - 20);
      g.hud.deny('The floor gives way — the Crown\'s pull throws you clear.');
    }
    g.time.setState(to, p.pos, true);
  }

  // ---------------------------------------------------------------------------------------------- damage / phases
  takeHit(damage: number, poiseDmg: number, knock: number, from: THREE.Vector3, opts: { knockdown?: boolean; guardBreak?: boolean } = {}) {
    if (!this.alive || this.mode === 'dying') return 'dead';
    if (!this.triggered) this.activate();
    this.hitFlash = 1;
    void knock;
    if (this.invuln || this.mode === 'break') return 'blocked';
    if (this.wardUp) { this.hp -= damage * 0.1; this.sfx('mage_ward', this.pos, 0.5, 1.5); return 'blocked'; }
    const mult = this.mode === 'stagger' ? 1.5 : 1;
    this.hp -= damage * mult;
    this.poise -= poiseDmg;
    if (this.phase === 1 && this.hp <= this.arch.hp * 0.65) { this.hp = this.arch.hp * 0.65; this.beginBreak(2); return 'stagger'; }
    if (this.phase === 2 && this.hp <= this.arch.hp * 0.3) { this.hp = this.arch.hp * 0.3; this.beginBreak(3); return 'stagger'; }
    if (this.hp <= 0) { this.beginDeath(); return 'dead'; }
    if (Math.random() < 0.3) this.sfx('boss_scream', this.pos, 0.5, 1.2);
    // enough poise damage interrupts a light cast (never a phase break or the beam)
    if (this.poise <= 0 && this.mode !== 'stagger' && this.castId !== 'beam') {
      this.poise = this.arch.poise;
      this.spells.setBeam(false);
      this.mode = 'stagger'; this.staggerT = 1.2; this.t = 0;
      this.once(this.arch.clips.hitH, 1.0, 0, 0.06);
      return 'stagger';
    }
    if (this.mode === 'idle') this.once(this.arch.clips.hitL, 1.4, 0, 0.06);
    return 'armor';
  }

  /** Kneel (invulnerable), resonance, push back, adds, surge; rise into the next phase with a forced slip. */
  private beginBreak(next: number) {
    const g = this.g, p = g.player;
    this.breakTo = next;
    this.mode = 'break'; this.t = 0; this.invuln = true;
    this.wardUp = false; this.bindT = -1;
    this.spells.clearAll();
    this.once('kneel', 1.1, 0, 0.12);
    this.sfx('crown_resonance', this.lens, 1.2);
    this.sfx('boss_scream', this.pos, 1, 0.85);
    g.hud.message(next === 2 ? 'THE CASTLE SLIPS' : 'TEMPORAL COLLAPSE', next === 2 ? 'The Crown lets go of one memory' : 'Past and Present bleed together', 3.5);
    g.hud.flash(next === 2 ? '#ffd9a0' : '#ff4020', 0.5);
    g.rig.addShake(0.5);
    this.spells.wave(this.pos, 16, 12, 0, EMBER);
    if (p.pos.distanceTo(this.pos) < 6) p.vel.addScaledVector(p.pos.clone().sub(this.pos).setY(0).normalize(), 9);
    g.time.gain(Math.max(0, 100 - g.time.charge) + 100, 'surge');
    g.enemies.summonRemnants(2, this.lens);
  }
  private updateBreak(dt: number) {
    void dt;
    if (this.t > 0.9 && this.curName === 'kneel') this.loop('kneel_idle', 1, 0.2);
    if (this.t > 2.8 && this.curName === 'kneel_idle') this.once('rise', 1.2, 0, 0.2);
    if (this.t > 3.7) {
      this.phase = this.breakTo;
      this.g.heart?.setPhase(this.phase);
      this.g.signals.emit('boss:phase', { id: 'last_crown', phase: this.phase });
      this.invuln = false;
      this.mode = 'idle'; this.t = 0; this.gap = 0.8;
      this.nextSlip = this.g.t + 8; this.nextWard = this.g.t + 5; this.nextBind = this.g.t + 10;
      this.forceSlip(this.g.time.state === 'PAST' ? 'PRESENT' : 'PAST');
      this.loop(this.arch.clips.idle, 1, 0.25);
    }
  }

  private beginDeath() {
    const g = this.g;
    this.hp = 0;
    this.mode = 'dying'; this.t = 0; this.deathT = 0;
    this.untargetable = true;
    this.spells.clearAll();
    this.once('death', 0.9, 0, 0.1);
    this.sfx('boss_death', this.pos, 1.3);
    g.fx.slowmo(1.2, 0.3);
    g.hud.flash('#fff0d0', 0.7);
    g.rig.addShake(0.6);
    g.hud.message('THE LAST CROWN FALLS', 'The Crownheart falters', 4);
    // the finale shot: on her as she falls, then up at the heart as it convulses and breaks
    const p = g.player;
    if (p.alive) { p.beginScripted(); p.anim.play('idle_alert', { fade: 0.3, loop: true }); }
    g.rig.cine = this.cam;
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    this.shotDeath(0);
  }

  /** the death camera: her collapse (low, close), then a slow tilt up to the heart breaking above */
  private shotDeath(t: number) {
    const p = this.g.player.pos;
    const side = new THREE.Vector3().subVectors(this.pos, p).setY(0).normalize();
    const right = new THREE.Vector3(-side.z, 0, side.x);
    const k = Math.min(1, Math.max(0, (t - 1.2) / 1.6));
    const e = k * k * (3 - 2 * k);
    this.cam.pos.copy(this.pos).addScaledVector(side, -4.2).addScaledVector(right, 2.2).setY(this.lens.y + 1.6 - e * 0.9);
    const heart = this.heartPos ?? this.lens.clone().setY(this.lens.y + 12);
    this.cam.look.copy(this.pos).setY(this.lens.y + 1.4).lerp(heart, e);
  }
  private updateDeath(dt: number) {
    const g = this.g;
    this.deathT += dt;
    this.shotDeath(this.deathT);
    if (this.deathT > 1.1 && this.deathT - dt <= 1.1) g.heart?.shatter();
    if (this.deathT > 3.2 && this.state !== 'dead') {
      this.state = 'dead';
      g.fx.shatter(this.root, 'ember', 420);
      this.root.visible = false;
      this.removed = true;
      this.sfx('final_collapse', this.lens, 1.2);
      if (g.time.state !== 'PRESENT') g.time.setState('PRESENT', g.player.pos, true);
      g.enemies.onBossDefeated(this);
      g.schedule(2.6, () => g.hud.fade(true));
    }
  }

  /** Enemy.die() is how the manager kills things (void, encounter end): route it into the death sequence. */
  die() {
    if (this.mode === 'dying' || this.state === 'dead') return;
    this.beginDeath();
  }

  /** Checkpoint respawn: the fight starts over (the floor's memory state is restored by Checkpoints). */
  reset() {
    super.reset();
    this.phase = 1; this.mode = 'idle'; this.t = 0; this.gap = 2.5; this.invuln = false; this.untargetable = false;
    this.wardUp = false; this.bindT = -1; this.slipT = -1; this.staggerT = 0; this.summoned80 = false; this.castId = '';
    this.nextWard = 14; this.nextSlip = 20; this.nextBind = 12;
    this.spells.clearAll();
    this.g.heart?.setPhase(1);
  }

  /** Floor time is relative: schedule the phase clocks from the moment the fight starts. */
  activate() {
    const was = this.triggered;
    super.activate();
    if (!was) { const t = this.g.t; this.nextWard = t + 14; this.nextSlip = t + 20; this.nextBind = t + 12; this.gap = 2.2; this.t = 0; }
  }

  /**
   * The reveal (session 9): as the hero steps onto the ring the camera lifts to the Crownheart; she descends out of
   * its light onto the lens, her name is given, and the fight begins. 4.6 s; the hero waits at the ring's edge.
   */
  beginIntro() {
    const g = this.g, p = g.player;
    if (!this.heartPos || !p.alive) return false;
    this.mode = 'intro'; this.introT = 0; this.invuln = true; this.untargetable = true;
    this.pos.copy(this.heartPos).setY(this.heartPos.y - 3.2);
    this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.loop('idle', 1, 0);
    p.beginScripted();
    p.anim.play('idle_alert', { fade: 0.3, loop: true });
    g.rig.cine = this.cam;
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    this.sfx('crown_resonance', this.heartPos, 1.2, 0.8);
    this.updateIntro(0);
    return true;
  }

  private updateIntro(dt: number) {
    const g = this.g, p = g.player;
    this.introT += dt;
    const t = this.introT;
    const heart = this.heartPos!;
    const toBoss = new THREE.Vector3().subVectors(this.lens, p.pos).setY(0).normalize();
    const right = new THREE.Vector3(-toBoss.z, 0, toBoss.x);
    const sm = (a: number, b: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
    // 0-1.4 s: from behind her the camera tilts up to the heart; 1.4-3.4: she sinks out of its light onto the lens;
    // 3.4-4.6: back behind the hero, both in frame
    const behind = p.pos.clone().addScaledVector(toBoss, -3.2).setY(p.pos.y + 1.9);
    const low = this.lens.clone().addScaledVector(toBoss, -7).addScaledVector(right, 3.5).setY(this.lens.y + 1.2);
    const a = sm(0, 1.4), b = sm(1.4, 2.0), c = sm(3.4, 4.4);
    this.cam.pos.copy(behind).lerp(low, b).lerp(behind.clone().setY(p.pos.y + 2.4), c);
    const lookUp = heart.clone();
    const lookHer = this.pos.clone().setY(this.pos.y + 1.6);
    this.cam.look.copy(p.pos.clone().setY(p.pos.y + 1.6)).lerp(lookUp, a).lerp(lookHer, sm(1.6, 2.6)).lerp(this.lens.clone().setY(this.lens.y + 1.5), c);
    // her descent out of the heart's light
    const d = sm(1.4, 3.3);
    this.pos.copy(heart).setY(heart.y - 3.2).lerp(this.lens, d);
    this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (t > 1.4 && Math.random() < dt * 30) g.fx.emit(this.pos.clone().setY(this.pos.y + 1.2), new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2), this.color, 0.8, 0.08, 0);
    if (t >= 2.2 && t - dt < 2.2) {
      g.hud.message('THE LAST CROWN', "Aldren's imprint, wearing the Queen's face", 3.8);
      g.audio.bossSting();
      this.play('raise', 1, 0.2);
    }
    if (t >= 3.3 && t - dt < 3.3) {
      g.fx.shockwave(this.lens.clone(), 6, 0.5);
      g.rig.addShake(0.35);
      this.sfx('mage_nova', this.lens, 0.8, 0.7);
      g.signals.emit('boss:start', { id: 'last_crown' });
    }
    if (t >= 4.6) {
      this.mode = 'idle'; this.t = 0; this.gap = 1.2; this.invuln = false; this.untargetable = false;
      this.pos.copy(this.lens);
      p.endScripted();
      g.rig.cine = null;
      g.hud.cinematic(false);
      g.touch?.cinematic(false);
      this.loop(this.arch.clips.idle, 1, 0.3);
    }
  }

  dispose() {
    this.spells.dispose();
    super.dispose();
  }
}
