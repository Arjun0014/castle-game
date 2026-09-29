import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Enemy } from '../enemies/Enemy';
import { Platform } from '../platform/Platform';

/**
 * Cinematic last-enemy finishers (session 8). When the hero's blow kills the LAST living enemy of a proper
 * encounter (every wave released, none left — never roaming/leashed stragglers, fissure Remnants, tutorials or
 * a kill between waves) there is a chance the kill becomes a 1.8–2.4 s staged finisher instead of the normal
 * kill presentation:
 *
 *   stab    CLOSE STAB  — the foe is driven to its knees; over-the-shoulder at head height, the Great Sword is
 *                         raised and plunged down through it (gs_plunge), a hard stop, the blade comes out.
 *   frenzy  FRENZY      — quick cut, chop, cut (gs_quick_cut → atk_chop → gs_cleave) from an orbiting side shot,
 *                         the overhead chop tears the body apart (gore gibs, blood, slow motion).
 *   kick    SLASH+KICK  — two cuts (gs_cleave, atk_rising_cut) and a front kick (kick_front) that launches the
 *                         body away with the fling/tumble physics; the camera follows its flight.
 *
 * Safety first: the hero's spot, the foe's spot and a ring around them must have footing and no void (never an
 * execution over a hole), the hero must be able to step there unobstructed, and every camera sample of the shot
 * must see the pair with nothing in between and must not be inside geometry or under a ceiling (a mirrored side
 * is tried, then the next variant, else it stays a normal kill). The kick also needs ground along its launch.
 *
 * Kill credit (resonance, heal, kill signal, encounter clear) happens exactly once, at the final blow
 * (EnemyManager.finisherKill); until then the foe is alive in state 'finisher' so the encounter cannot clear early.
 * The hero is scripted (Player.scripted: no input, no physics) and invulnerable; hit-stop and slow motion scale
 * the director's clock with the animations, so the beats stay in sync. The camera eases onto the director's shot
 * (CameraRig.cine) and back to gameplay afterwards.
 */
export type FinisherId = 'stab' | 'frenzy' | 'kick';

const UP = new THREE.Vector3(0, 1, 0);
/** hero → foe distance at which each finisher is staged (m) */
const STANDOFF: Record<FinisherId, number> = { stab: 1.05, frenzy: 1.35, kick: 1.45 };
const DURATION: Record<FinisherId, number> = { stab: 1.85, frenzy: 2.0, kick: 2.15 };

interface Beat { at: number; fn: () => void; done?: boolean }

export class Finishers {
  active = false;
  id: FinisherId | null = null;
  /** tests / tuning: force one variant (still subject to the safety checks), and the trigger chance */
  force: FinisherId | null = null;
  chance = 0.55;
  /** seconds (game time) after one finisher before another may play */
  cooldown = 20;
  lastAt = -99;
  /** tests: every decision (played / refused and why) */
  log: { t: number; enemy: string; enc: string; result: string }[] = [];
  /** narrower lens while a close shot runs (deg, eased by the camera blend) */
  fovOffset = 0;
  /** the blade trail should be drawn this frame */
  trailOn = false;

  private t = 0;
  private dur = 0;
  private e: Enemy | null = null;
  private beats: Beat[] = [];
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private heroFrom = new THREE.Vector3();
  private heroTo = new THREE.Vector3();
  private mid = new THREE.Vector3();
  private side = 1;
  private cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private shot: (t: number, out: { pos: THREE.Vector3; look: THREE.Vector3 }) => void = () => {};
  private lastId: FinisherId | null = null;
  private followBody = 0;

  constructor(private g: Game) {}

  // ------------------------------------------------------------------ eligibility
  /**
   * The hero's blow has just killed `e` (Enemy.takeHit returned 'dead'). Returns true when a finisher took the
   * kill over (the caller then skips its own kill presentation and the kill credit).
   */
  tryStart(e: Enemy): boolean {
    const g = this.g, p = g.player;
    if (this.active || !p.alive || g.finished || p.scripted) return false;
    const refuse = (why: string) => { this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: 'refused: ' + why }); return false; };
    const enc = g.enemies.encounters.get(e.encounter);
    if (!enc || enc.tutorial || !enc.triggered || enc.cleared) return refuse('no proper encounter');
    if (e.isFlying || e.arch.id === 'last_crown') return refuse('kind');
    const maxWave = Math.max(...enc.enemies.map((x) => x.wave));
    if (enc.wave < maxWave) return refuse('waves pending');
    if (enc.enemies.some((x) => x !== e && x.alive)) return refuse('not the last');
    if (g.t - this.lastAt < this.cooldown && !this.force) return refuse('cooldown');
    if (!this.force && Math.random() > this.chance) return refuse('chance');
    // another fight close by (a different encounter's Echoes) would walk through the shot
    const others = [...g.enemies.enemies, ...g.enemies.remnants].some((x) => x !== e && x.alive && !x.removed && x.triggered &&
      (x.owner === g.time.state || x.owner === 'BOTH') && x.state !== 'hidden' && x.state !== 'dormant' && x.pos.distanceTo(e.pos) < 18);
    if (others) return refuse('other Echoes near');
    const order: FinisherId[] = this.force ? [this.force] : this.pick(e);
    for (const id of order) {
      const why = this.plan(id, e);
      if (!why) { this.begin(id, e); return true; }
      this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: `${id} unsafe: ${why}` });
    }
    return refuse('no safe staging');
  }

  /** variant order: random, never the same twice running when there is a choice; no launch kick for giants */
  private pick(e: Enemy): FinisherId[] {
    let ids: FinisherId[] = ['stab', 'frenzy', 'kick'];
    if (e.arch.scale > 1.2 || e.arch.boss) ids = ['stab', 'frenzy'];
    ids.sort(() => Math.random() - 0.5);
    if (ids[0] === this.lastId && ids.length > 1) ids.push(ids.shift()!);
    return ids;
  }

  // ------------------------------------------------------------------ safety / staging
  private footing(q: THREE.Vector3) {
    const w = this.g.level.collision, st = this.g.time.state;
    return w.hasFooting(q.clone().setY(q.y + 0.8), 1.4, st) && !w.inVoid(q.clone().setY(q.y - 0.3), st);
  }
  /** nothing between the pair and the camera, the camera not inside geometry, and not jammed under a ceiling */
  private shotClear(pivot: THREE.Vector3, camPos: THREE.Vector3) {
    const w = this.g.level.collision, st = this.g.time.state;
    const d = camPos.clone().sub(pivot);
    const len = d.length();
    if (w.raycast(pivot, d.normalize(), len + 0.3, st)) return false;
    if (w.raycast(camPos, UP, 0.35, st)) return false;
    return w.overlap(camPos.clone().setY(camPos.y - 0.25), 0.22, 0.5, st) < 0.02;
  }

  /** Stage variant `id` for foe `e`: returns null when safe (the plan is stored), else the reason. */
  private plan(id: FinisherId, e: Enemy): string | null {
    const g = this.g, p = g.player, w = g.level.collision, st = g.time.state;
    const fwd = this.fwd.subVectors(e.pos, p.pos).setY(0);
    if (fwd.lengthSq() < 0.04) fwd.copy(p.facing);
    fwd.normalize();
    this.right.crossVectors(fwd, UP).normalize();
    const hero = e.pos.clone().addScaledVector(fwd, -STANDOFF[id]);
    const gy = w.groundBelow(hero.clone().setY(hero.y + 0.8), 1.6, st);
    if (gy === null) return 'no ground at the hero spot';
    hero.y = gy + 0.01;
    if (Math.abs(hero.y - e.pos.y) > 0.45) return 'uneven ground';
    if (!this.footing(hero) || !this.footing(e.pos)) return 'no footing';
    if (w.overlap(hero, 0.35, 1.8, st) > 0.05) return 'hero spot blocked';
    // the step in must be unobstructed and short
    const step = hero.clone().sub(p.pos).setY(0);
    if (step.length() > 3.2) return 'too far';
    if (step.length() > 0.05 && w.raycast(p.pos.clone().setY(p.pos.y + 0.6), step.clone().normalize(), step.length(), st)) return 'step blocked';
    // never over a hole: a ring round the pair must have floor under it
    const mid = this.mid.copy(hero).lerp(e.pos, 0.5);
    for (const r of [1.4, 2.4]) for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const q = mid.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      // a wall there is fine (no floor inside a wall is not a hole); a drop is not
      if (w.raycast(mid.clone().setY(mid.y + 0.6), q.clone().sub(mid).setY(0).normalize(), r, st)) continue;
      if (w.inVoid(q.clone().setY(mid.y - 0.3), st) || !w.hasFooting(q.clone().setY(mid.y + 0.8), 2.5, st)) return 'hole near';
    }
    if (id === 'kick') {
      // the launch path: floor along it, and not straight into a wall
      const chest = e.pos.clone().setY(e.pos.y + 1.1);
      const wall = w.raycast(chest, fwd, 2.5, st);
      if (wall && wall.distance < 1.6) return 'wall behind';
      for (const d of [2, 3.5, 5]) { const q = e.pos.clone().addScaledVector(fwd, d); if (!this.footing(q)) return 'no ground on the launch path'; }
    }
    // camera: try the side with the most room first, then the mirror
    const pivot = mid.clone().setY(mid.y + 1.15);
    const sides = [1, -1];
    const roomR = w.raycast(pivot, this.right, 3.5, st)?.distance ?? 3.5;
    const roomL = w.raycast(pivot, this.right.clone().negate(), 3.5, st)?.distance ?? 3.5;
    if (roomL > roomR) sides.reverse();
    for (const side of sides) {
      this.side = side;
      this.heroTo.copy(hero);
      this.setShot(id, e);
      let ok = true;
      for (const t of [0, 0.35, 0.7, 1]) {
        this.shot(t * DURATION[id], this.cam);
        if (!this.shotClear(pivot, this.cam.pos)) { ok = false; break; }
      }
      if (ok) return null;
    }
    return 'no clear camera';
  }

  /** the camera path of each variant, in the pair's frame (fwd = hero → foe, right, up) */
  private setShot(id: FinisherId, e: Enemy) {
    const fwd = this.fwd.clone(), right = this.right.clone().multiplyScalar(this.side);
    const hero = this.heroTo.clone(), foe = e.pos.clone(), mid = hero.clone().lerp(foe, 0.5);
    const sc = e.arch.scale;
    const smooth = (x: number) => { const k = THREE.MathUtils.clamp(x, 0, 1); return k * k * (3 - 2 * k); };
    if (id === 'stab') {
      // over the shoulder at head height, the kneeling foe's head and back in front; a push-in on the blow
      this.shot = (t, out) => {
        const k = smooth((t - 0.45) / 0.35), back = smooth((t - 1.2) / 0.6);
        out.pos.copy(hero).addScaledVector(UP, 1.6 - k * 0.12 + back * 0.25).addScaledVector(fwd, -1.3 + k * 0.3 - back * 0.4).addScaledVector(right, 1.0 + back * 0.2);
        out.look.copy(foe).addScaledVector(UP, (0.95 - k * 0.2) * sc).addScaledVector(fwd, -0.1);
      };
    } else if (id === 'frenzy') {
      // an orbit from the side toward her back as the cuts land, then a push-in on the destructive last blow
      this.shot = (t, out) => {
        const a = 0.2 + smooth(t / 1.1) * 0.55;
        const r = 3.1 - smooth((t - 1.0) / 0.25) * 0.75 + smooth((t - 1.6) / 0.6) * 0.5;
        out.pos.copy(mid).addScaledVector(right, Math.cos(a) * r).addScaledVector(fwd, -Math.sin(a) * r).addScaledVector(UP, 1.55);
        out.look.copy(mid).addScaledVector(UP, 1.05 * Math.max(1, sc * 0.95));
      };
    } else {
      // a low three-quarter view behind her shoulder; after the kick the camera turns to follow the body
      const flyTo = foe.clone().addScaledVector(fwd, 5).addScaledVector(UP, 1.2);
      this.shot = (t, out) => {
        const f = smooth((t - 0.95) / 0.7);
        out.pos.copy(hero).addScaledVector(fwd, -1.55 + f * 0.9).addScaledVector(right, 1.85).addScaledVector(UP, 1.3 + f * 0.25);
        const body = this.e && this.followBody > 0 ? this.e.center : flyTo;
        out.look.copy(mid).addScaledVector(UP, 1.0).lerp(body, f * 0.85);
      };
    }
  }

  // ------------------------------------------------------------------ playback
  private begin(id: FinisherId, e: Enemy) {
    const g = this.g, p = g.player;
    this.active = true;
    this.id = id;
    this.lastId = id;
    this.lastAt = g.t;
    this.e = e;
    this.t = 0;
    this.dur = DURATION[id];
    this.followBody = 0;
    this.trailOn = false;
    this.fovOffset = id === 'stab' ? 7 : id === 'frenzy' ? 3 : 2;
    this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: 'played ' + id });
    // the foe is caught: alive (the encounter must not clear yet) but out of the fight
    g.enemies.holdForFinisher(e);
    e.yaw = Math.atan2(-this.fwd.x, -this.fwd.z);
    // the hero is scripted: no input, no physics, invulnerable
    this.heroFrom.copy(p.pos);
    p.beginScripted();
    p.yaw = Math.atan2(this.fwd.x, this.fwd.z);
    g.rig.cine = this.cam;
    this.shot(0, this.cam);
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    g.audio.play('blade_ring', { rate: 0.7, vol: 0.6 });
    Platform.haptic(12);
    this.beats = this.script(id, e);
    g.signals.emit('finisher', { id, enemy: e.arch.id });
  }

  /** the beats of each finisher (director seconds; hit-stop / slow motion stretch them with the animations) */
  private script(id: FinisherId, e: Enemy): Beat[] {
    const g = this.g, p = g.player;
    const fwd = this.fwd.clone();
    const chest = () => e.pos.clone().setY(e.pos.y + e.height * 0.6 * e.arch.scale);
    const flesh = e.arch.asset === 'knight' ? 'armor' : 'flesh';
    const bloodCol = e.arch.asset === 'hollow' ? 0x3c0906 : 0x7a0909;
    const cut = (sideSign: number, amount: number, heavy = false) => {
      const d = fwd.clone().addScaledVector(this.right, sideSign * 0.8).normalize();
      const at = chest();
      g.fx.bloodSpray(at, d, amount, bloodCol);
      g.gore.aftermath(at, d, amount * 0.7);
      g.audio.hitEnemy(flesh, heavy ? 30 : 18, at, heavy ? 0.9 : 0.5);
      e.recoil(d, heavy ? 0.32 : 0.2);
      e.once(heavy ? e.arch.clips.hitH : e.arch.clips.hitL, heavy ? 1.1 : 1.5, 0, 0.05);
      g.fx.hitstop(heavy ? 0.07 : 0.045);
      g.rig.addShake(heavy ? 0.22 : 0.12);
      g.rig.punch(d, heavy ? 2.4 : 1.4);
      Platform.haptic(heavy ? 22 : 12);
    };
    const swing = (w: number) => g.audio.swing(w, p.pos, 1);
    const anim = (clip: string, start: number, speed: number, fade = 0.08) => p.anim.play(clip, { start, speed, fade });
    if (id === 'stab') {
      return [
        { at: 0, fn: () => { anim('gs_plunge', 1.05, 1.7, 0.12); e.once(e.arch.clips.hitH, 1.1, 0, 0.06); } },
        { at: 0.2, fn: () => { e.once('crouch_idle', 1, 0, 0.28); swing(0.3); } },
        { at: 0.55, fn: () => { this.trailOn = true; swing(1); } },
        { at: 0.69, fn: () => {
          // the stab: straight down through the kneeling body
          const at = chest().addScaledVector(UP, -0.15);
          const d = fwd.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, -1, 0)).normalize();
          g.fx.bloodSpray(at, fwd.clone().negate().add(new THREE.Vector3(0, 0.6, 0)).normalize(), 1.2, bloodCol);
          g.fx.bloodSpray(at.clone().addScaledVector(fwd, 0.3), d, 1.0, bloodCol);
          g.gore.splat(at, new THREE.Vector3(0, -1, 0), 1.4, 2.5);
          g.audio.play('hit_slice', { pos: at, rate: 0.68, vol: 1.2 });
          g.audio.play('bone_crunch', { pos: at });
          g.audio.play('gore_splat', { pos: at });
          g.audio.play('kill_impact', { pos: at, rate: 0.82 });
          e.recoil(new THREE.Vector3(0, -1, 0).add(fwd).normalize(), 0.3);
          g.fx.hitstop(0.12);
          g.fx.slowmo(0.55, 0.3);
          g.rig.addShake(0.34);
          g.rig.punch(d, 2.6);
          g.kickFov(4);
          g.hud.flash('#3a0000', 0.2);
          Platform.haptic(40);
        } },
        { at: 0.9, fn: () => { this.trailOn = false; } },
        { at: 1.05, fn: () => { g.fx.bloodSpray(chest(), new THREE.Vector3(0, 1, 0).addScaledVector(fwd, -0.3).normalize(), 0.7, bloodCol); g.audio.play('blood_splash', { pos: chest() }); } },
        { at: 1.15, fn: () => g.enemies.finisherKill(e, fwd, 0.12, 4) },
      ];
    }
    if (id === 'frenzy') {
      return [
        { at: 0, fn: () => { anim('gs_quick_cut', 0, 1.55, 0.1); this.trailOn = true; } },
        { at: 0.13, fn: () => cut(1, 0.6) },
        { at: 0.3, fn: () => cut(-1, 0.7) },
        { at: 0.34, fn: () => anim('atk_chop', 0.08, 1.5, 0.07) },
        { at: 0.49, fn: () => cut(1, 0.8) },
        { at: 0.62, fn: () => anim('gs_cleave', 0.05, 1.3, 0.07) },
        { at: 0.74, fn: () => cut(-1, 0.9, true) },
        { at: 1.1, fn: () => {
          // the destructive last blow: the overhead chop tears the Echo apart
          const at = chest();
          const d = fwd.clone().add(new THREE.Vector3(0, -0.5, 0)).normalize();
          g.fx.hitstop(0.12);
          g.fx.slowmo(0.45, 0.4);
          g.fx.bloodSpray(at, d, 1.5, bloodCol);
          g.fx.bloodSpray(at, fwd.clone().add(new THREE.Vector3(0, 0.8, 0)).normalize(), 1.1, bloodCol);
          g.gore.splat(at, new THREE.Vector3(0, -1, 0), 1.9, 3);
          g.rig.addShake(0.46);
          g.rig.punch(d, 3.4);
          g.kickFov(5);
          g.hud.flash('#4a0000', 0.18);
          Platform.haptic(50);
          g.enemies.finisherKill(e, fwd, 1, 18);
        } },
        { at: 1.3, fn: () => { this.trailOn = false; } },
      ];
    }
    return [
      { at: 0, fn: () => { anim('gs_cleave', 0.05, 1.45, 0.1); this.trailOn = true; } },
      { at: 0.1, fn: () => cut(1, 0.6) },
      { at: 0.3, fn: () => anim('atk_rising_cut', 0.5, 1.55, 0.07) },
      { at: 0.51, fn: () => cut(-1, 0.8, true) },
      { at: 0.66, fn: () => { this.trailOn = false; } },
      { at: 0.72, fn: () => anim('kick_front', 0.15, 1.3, 0.07) },
      { at: 0.91, fn: () => {
        // the kick: the body is launched off the boot
        const at = chest();
        g.audio.play('kick_hit', { pos: at, rate: 0.78, vol: 1.3 });
        g.audio.play('kill_impact', { pos: at, rate: 0.9 });
        if (e.arch.asset === 'knight') g.audio.play('armor_crash', { pos: at, vol: 0.8 });
        g.fx.hitstop(0.1);
        g.fx.slowmo(0.55, 0.4);
        g.fx.dust(e.pos.clone().setY(e.pos.y + 0.1), 8);
        g.rig.addShake(0.4);
        g.rig.punch(fwd, 3);
        g.kickFov(4);
        Platform.haptic(45);
        this.followBody = 1;
        g.enemies.finisherKill(e, fwd.clone().add(new THREE.Vector3(0, 0.1, 0)).normalize(), 1.1, 3);
      } },
    ];
  }

  /** per frame (game dt: hit-stop and slow motion stretch the finisher with everything else) */
  update(dt: number) {
    if (!this.active || !this.e) return;
    const g = this.g, p = g.player;
    this.t += dt;
    // the step in (0.16 s), facing the foe
    const k = Math.min(1, this.t / 0.16);
    const s = k * k * (3 - 2 * k);
    p.pos.lerpVectors(this.heroFrom, this.heroTo, s);
    p.invuln = 1;
    for (const b of this.beats) if (!b.done && this.t >= b.at) { b.done = true; b.fn(); }
    this.shot(this.t, this.cam);
    if (this.t >= this.dur) this.end();
  }

  /** hand everything back (also used if the floor unloads mid-finisher) */
  end() {
    if (!this.active) return;
    const g = this.g;
    this.active = false;
    this.trailOn = false;
    // should a final beat not have run (e.g. an aborted finisher), the kill still happens exactly once
    if (this.e && this.e.state === 'finisher') g.enemies.finisherKill(this.e, this.fwd, 0.3, 4);
    this.e = null;
    this.beats = [];
    g.player.endScripted();
    g.rig.cine = null;
    g.hud.cinematic(false);
    g.touch?.cinematic(false);
    this.id = null;
  }
}
