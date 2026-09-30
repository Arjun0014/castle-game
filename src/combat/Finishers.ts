import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Enemy } from '../enemies/Enemy';
import type { ArchetypeId } from '../enemies/EnemyTypes';
import { Platform } from '../platform/Platform';

const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _sr = new THREE.Vector3(), _sc = new THREE.Vector3();
/** closest distance between segments p1q1 and p2q2 (the blade against a body's axis) */
function segDist(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): number {
  const d1 = _s1.subVectors(q1, p1), d2 = _s2.subVectors(q2, p2), r = _sr.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2);
  const den = a * e - b * b;
  let s = a > 1e-8 && den > 1e-10 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
  let t = e > 1e-8 ? (b * s + f) / e : 0;
  if (t < 0) { t = 0; s = a > 1e-8 ? THREE.MathUtils.clamp(-c / a, 0, 1) : 0; }
  else if (t > 1) { t = 1; s = a > 1e-8 ? THREE.MathUtils.clamp((b - c) / a, 0, 1) : 0; }
  return _sc.copy(p1).addScaledVector(d1, s).distanceTo(_s2.multiplyScalar(t).add(p2));
}

/**
 * Cinematic finishers (session 8, reworked session 9). A lethal blow of the hero — the last Echo of a fight OR a
 * kill in the middle of one, including a blow deep inside a combo — may become a short staged kill instead of the
 * normal kill presentation. They are a core part of the combat identity, so they are frequent, but paced:
 *
 *   · the last Echo of an encounter: 90 %, 3 s after the previous finisher;
 *   · mid-fight: 34 % + 14 % for every normal kill since the last finisher (max 80 %), 6 s after the previous one
 *     ended — on average about one kill in two or three becomes a finisher, never two back to back.
 *
 * Five variants, dealt from a shuffle bag (each is seen before any repeats, never the same twice running):
 *
 *   stab      CLOSE STAB  — driven to its knees, over-the-shoulder, the Great Sword plunged down through it.
 *   frenzy    FRENZY      — quick cut, chop, cleave from an orbiting side shot; the last blow tears it apart.
 *   kick      SLASH+KICK  — two cuts and a front kick that launches the body; the camera follows its flight.
 *   headsman  HEADSMAN    — a low sweep takes its legs, she turns into a spinning horizontal cut at neck height:
 *                           a fountain of blood from a kneeling body, which topples a beat later. Low front shot.
 *   passing   PASSING CUT — she knee-slides THROUGH it with one sweeping cut and comes to rest behind it, facing
 *                           the camera; the Echo stands a heartbeat longer, then the wound opens and it falls.
 *
 * While one plays, every other Echo holds back (EnemyManager.finisherHold: no new attacks, no approach, archers
 * lower their bows), the hero is invulnerable and gets a short grace after it. Kinds: humanoid rigs take every
 * variant; beasts (the Widow) only the stab (impaled on the floor) and the passing cut; flyers, bosses, the
 * serpent and AoE kills (Whirlwind, Crownbreaker shockwave, executions) never trigger one.
 *
 * Safety first: the hero's spot, the foe's spot and a ring around them must have footing and no void (never over
 * a hole), the hero must be able to step there unobstructed and no other Echo may stand on it, and every camera
 * sample of the shot must see the pair with nothing in between (level geometry OR another Echo's body), must not be
 * inside geometry or under a ceiling (the mirrored side is tried, then the next variant, else a normal kill). The
 * kick needs ground along its launch, the passing cut a clear lane through and 2.6 m beyond the foe.
 *
 * Kill credit (resonance, heal, kill signal, encounter clear) happens exactly once, at the final blow
 * (EnemyManager.finisherKill); until then the foe is alive in state 'finisher' so the encounter cannot clear early.
 */
export type FinisherId = 'stab' | 'frenzy' | 'kick' | 'headsman' | 'passing' | 'stand';
export const FINISHERS: FinisherId[] = ['stab', 'frenzy', 'kick', 'headsman', 'passing'];

const UP = new THREE.Vector3(0, 1, 0);
/** hero → foe distance at which each finisher is staged (m); the passing cut starts farther out */
const STANDOFF: Record<FinisherId, number> = { stab: 1.05, frenzy: 1.35, kick: 1.45, headsman: 1.3, passing: 1.7, stand: 0 };
const DURATION: Record<FinisherId, number> = { stab: 1.85, frenzy: 2.0, kick: 2.15, headsman: 1.95, passing: 1.9, stand: 1.55 };

/**
 * Mini-boss finishers (session 14): every titled mini-boss and elite Warden dies in a finisher — guaranteed on the
 * killing blow (no chance roll, no cooldown, any blow incl. the Whirlwind / Crownbreaker), with the variants that
 * read best on its body, in this order of preference. Staging is tried from the side she struck from, then round the
 * body (±45°, ±90°, ±135°, behind) with a longer step; if nothing is safe (a wall, a hole, no camera) the in-place
 * 'stand' finisher plays — no step, the gameplay camera — so it never fails and never stages over a drop.
 * The Last Crown keeps her own death scene (LastCrown.beginDeath).
 */
export const MINI_FINISH: Partial<Record<ArchetypeId, FinisherId[]>> = {
  gate_warden: ['headsman', 'frenzy', 'stab', 'passing'],
  kingsguard: ['frenzy', 'headsman', 'stab', 'passing'],
  goblin_king: ['stab', 'frenzy', 'headsman', 'passing'],
  widow_mother: ['stab', 'passing'],
  maw: ['frenzy', 'passing'],
  royal_warden: ['headsman', 'stab', 'frenzy', 'passing', 'kick'],
  hollow_warden: ['frenzy', 'headsman', 'stab', 'passing', 'kick'],
  crown_brute: ['frenzy', 'passing'],
};
/** approach angles round the body tried for a guaranteed finisher (rad; 0 = the side she struck from) */
const MINI_ROTS = [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI];
/**
 * the passing cut: lateral offset of her line past the body, and how far beyond it she comes to rest. Session 11:
 * NEGATIVE = the body passes on her sword side — at +0.55 the slide cut's sweep went by 0.55–1.7 m from it (measured);
 * at −0.5 the blade crosses its waist ~0.23 s into the slide
 */
const PASS_SIDE = -0.5;
const PASS_BEYOND = 2.4;

/** trigger tuning (session 9 combat tests; see CONTEXT §10 s9) */
export const FINISHER_TUNING = {
  lastChance: 0.9, lastCooldown: 3,
  midBase: 0.34, midPerKill: 0.14, midMax: 0.8, midCooldown: 6,
  /** seconds of invulnerability handed back with control */
  grace: 0.45,
};

/**
 * A beat of the director. A CUT beat (`until` set) is armed at `at` and fires on the first frame the blade actually
 * meets the victim's body (bladeContact), or at `until` if it never does — its blood, streak, sound and the victim's
 * reaction then happen where and when the steel goes in (session 11: the old fixed times fired up to 0.9 m early).
 */
interface Beat { at: number; fn: () => void; done?: boolean; until?: number }

export class Finishers {
  active = false;
  id: FinisherId | null = null;
  /** tests / tuning: force one variant (still subject to the safety checks), and a forced trigger */
  force: FinisherId | null = null;
  /** tests: disable the random roll (always trigger when eligible) */
  always = false;
  /** tests (dev/finisherContact.js): stage at this hero → foe distance instead of the computed one */
  standoffOverride: number | null = null;
  /** tests: the passing cut's lateral offset past the body (m; + = her line to the body's right) */
  passSideOverride: number | null = null;
  private get passSide() { return this.passSideOverride ?? PASS_SIDE; }
  /** game time the previous finisher ended */
  lastAt = -99;
  /** normal kills since the last finisher (the pity counter of the mid-fight chance) */
  killsSince = 0;
  /** tests: every decision (played / refused and why) */
  log: { t: number; enemy: string; enc: string; result: string }[] = [];
  /** narrower lens while a close shot runs (deg, eased by the camera blend) */
  fovOffset = 0;
  /** the blade trail should be drawn this frame */
  trailOn = false;
  /** the others hold back while this is true (EnemyManager reads it) */
  get holding() { return this.active; }

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
  /** where the hero is at director time t (default: a 0.16 s step onto heroTo) */
  private heroPath: ((t: number, out: THREE.Vector3) => void) | null = null;
  private lastId: FinisherId | null = null;
  private bag: FinisherId[] = [];
  private followBody = 0;
  private lastFight = false;
  /** the passing cut's chosen run-out beyond the body (m) */
  private passBeyond = PASS_BEYOND;

  constructor(private g: Game) {}

  // ------------------------------------------------------------------ eligibility
  /**
   * The hero's blow has just killed `e` (Enemy.takeHit returned 'dead'). Returns true when a finisher took the
   * kill over (the caller then skips its own kill presentation and the kill credit).
   */
  tryStart(e: Enemy): boolean {
    const g = this.g, p = g.player;
    if (this.active || !p.alive || g.finished || p.scripted) return false;
    const refuse = (why: string) => { this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: 'refused: ' + why }); this.killsSince++; return false; };
    const kind = e.arch.finisher ?? 'humanoid';
    // a mini-boss or an elite Warden: always (the Last Crown has her own death scene)
    // (not the Crown's own adds — a brute rising in her fight dies fast: she stays the focus)
    const mini = e.arch.id !== 'last_crown' && !g.enemies.crownFight ? MINI_FINISH[e.arch.id] : undefined;
    if (!mini && (e.isFlying || e.arch.boss || kind === 'none')) return refuse('kind');
    const atk = p.attack;
    if (!mini && atk && (atk.whirl || atk.shock || atk.id === 'EXECUTE')) return refuse('area / execution blow');
    // her adds in the Last Crown's fight die fast: the Crown stays the focus (and she never holds back for one)
    if (!mini && g.enemies.crownFight) return refuse('the Crown fight');
    const enc = g.enemies.encounters.get(e.encounter);
    // a proper fight (fissure / boss adds have no encounter record of their own and die normally)
    if (!mini && (!enc || !enc.triggered || enc.cleared)) return refuse('no proper encounter');
    const maxWave = enc ? Math.max(...enc.enemies.map((x) => x.wave)) : 1;
    const last = !enc || (enc.wave >= maxWave && !enc.enemies.some((x) => x !== e && x.alive));
    const T = FINISHER_TUNING;
    const since = g.t - this.lastAt;
    if (!this.force && !this.always && !mini) {
      if (since < (last ? T.lastCooldown : T.midCooldown)) return refuse('cooldown');
      const chance = last ? T.lastChance : Math.min(T.midMax, T.midBase + T.midPerKill * this.killsSince);
      if (Math.random() > chance) return refuse('chance');
    }
    const order: FinisherId[] = this.force ? [this.force] : mini ? this.miniOrder(e, mini) : this.pick(e, kind as 'humanoid' | 'beast');
    for (const rot of mini ? MINI_ROTS : [0]) {
      for (const id of order) {
        if (id === 'stand') continue;
        const why = this.plan(id, e, rot, !!mini);
        if (!why) { this.lastFight = last; this.mini = !!mini; this.begin(id, e); return true; }
        this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: `${id}${rot ? ` @${rot.toFixed(1)}` : ''} unsafe: ${why}` });
      }
    }
    if (mini || this.force === 'stand') { this.lastFight = last; this.mini = !!mini; this.planStand(e); this.begin('stand', e); return true; }
    return refuse('no safe staging');
  }

  /** this finisher is a mini-boss's (guaranteed; the camera and staging scale with the body) */
  mini = false;
  /** camera distance factor for big bodies (1 = a man; a 2.7 m Maw ≈ 1.4) */
  private camK = 1;

  /** a mini-boss's variants: its preferred order, but not the one just played first (so two fights differ) */
  private miniOrder(e: Enemy, list: FinisherId[]): FinisherId[] {
    let order = [...list];
    if (e.arch.scale > 1.2 && e.arch.asset !== 'knight') order = order.filter((id) => id !== 'kick');
    if (order.length > 1 && order[0] === this.lastId) order.push(order.shift()!);
    return order;
  }

  /**
   * Variant order: the next of a shuffle bag (every variant is dealt before any repeats; the first of a new bag is
   * never the last one played), then the rest as fallbacks. Beasts: stab + passing cut; giants never get the kick.
   */
  private pick(e: Enemy, kind: 'humanoid' | 'beast'): FinisherId[] {
    let allowed: FinisherId[] = kind === 'beast' ? ['stab', 'passing'] : [...FINISHERS];
    if (e.arch.scale > 1.2) allowed = allowed.filter((id) => id !== 'kick');
    // the headsman is a NECK cut: on a small body (a goblin, 1.35 m) the spin meets the head, not a neck — measured,
    // every other variant's blades do meet a goblin (dev/finisherContact.js)
    if (e.height < 1.6) allowed = allowed.filter((id) => id !== 'headsman');
    if (!this.bag.length) {
      this.bag = [...FINISHERS].sort(() => Math.random() - 0.5);
      if (this.bag[0] === this.lastId) this.bag.push(this.bag.shift()!);
    }
    // the bag's next variant first (it stays in the bag until it actually plays: a variant refused for safety here
    // is simply tried first again next time), then the rest of the bag, then everything else
    const order: FinisherId[] = [];
    for (const id of this.bag) if (allowed.includes(id)) order.push(id);
    for (const id of allowed.sort(() => Math.random() - 0.5)) if (!order.includes(id) && id !== this.lastId) order.push(id);
    return order;
  }

  // ------------------------------------------------------------------ safety / staging
  private footing(q: THREE.Vector3) {
    const w = this.g.level.collision, st = this.g.time.state;
    return w.hasFooting(q.clone().setY(q.y + 0.8), 1.4, st) && !w.inVoid(q.clone().setY(q.y - 0.3), st);
  }
  /** the other living Echoes of this memory (bodies that must not block the shot or stand on the hero's spot) */
  private others(e: Enemy) {
    const st = this.g.time.state;
    return [...this.g.enemies.enemies, ...this.g.enemies.remnants].filter((x) => x !== e && x.alive && !x.removed && x.root.visible &&
      (x.owner === st || x.owner === 'BOTH') && x.state !== 'hidden' && x.state !== 'dormant');
  }
  /** nothing between the pair and the camera (stone or another body), the camera not in geometry or under a ceiling */
  private shotClear(pivot: THREE.Vector3, camPos: THREE.Vector3, bodies: Enemy[]) {
    const w = this.g.level.collision, st = this.g.time.state;
    const d = camPos.clone().sub(pivot);
    const len = d.length();
    if (w.raycast(pivot, d.clone().normalize(), len + 0.3, st)) return false;
    if (w.raycast(camPos, UP, 0.35, st)) return false;
    if (w.overlap(camPos.clone().setY(camPos.y - 0.25), 0.22, 0.5, st) >= 0.02) return false;
    const seg = new THREE.Line3(pivot, camPos), q = new THREE.Vector3();
    for (const b of bodies) {
      const c = b.center;
      seg.closestPointToPoint(c, true, q);
      if (q.distanceTo(c) < b.radius + 0.35 && Math.abs(q.y - c.y) < b.height * 0.6) return false;
    }
    return true;
  }
  private clearLane(from: THREE.Vector3, to: THREE.Vector3) {
    const w = this.g.level.collision, st = this.g.time.state;
    const d = to.clone().sub(from).setY(0);
    const len = d.length();
    if (len < 0.05) return true;
    d.normalize();
    for (const h of [0.35, 1.0]) if (w.raycast(from.clone().setY(from.y + h), d, len + 0.3, st)) return false;
    return true;
  }

  /** Stage variant `id` for foe `e`: returns null when safe (the plan is stored), else the reason. */
  private plan(id: FinisherId, e: Enemy, rot = 0, mini = false): string | null {
    const g = this.g, p = g.player, w = g.level.collision, st = g.time.state;
    const fwd = this.fwd.subVectors(e.pos, p.pos).setY(0);
    if (fwd.lengthSq() < 0.04) fwd.copy(p.facing);
    fwd.normalize();
    // a guaranteed finisher may come at the body from another side (walls, holes, no room for the camera)
    if (rot) fwd.applyAxisAngle(UP, rot);
    this.camK = THREE.MathUtils.clamp(e.height / 1.95, 1, 1.45);
    this.right.crossVectors(fwd, UP).normalize();
    const bodies = this.others(e);
    // a bigger body is met farther out (its surface is nearer): the blade's measured reach stays on its flesh
    const hero = e.pos.clone().addScaledVector(fwd, -(this.standoffOverride ?? STANDOFF[id] + (e.radius - 0.4)));
    if (id === 'passing') hero.addScaledVector(this.right, this.passSide);
    const gy = w.groundBelow(hero.clone().setY(hero.y + 0.8), 1.6, st);
    if (gy === null) return 'no ground at the hero spot';
    hero.y = gy + 0.01;
    if (Math.abs(hero.y - e.pos.y) > 0.45) return 'uneven ground';
    if (!this.footing(hero) || !this.footing(e.pos)) return 'no footing';
    if (w.overlap(hero, 0.35, 1.8, st) > 0.05) return 'hero spot blocked';
    if (bodies.some((b) => b.pos.distanceTo(hero) < b.radius + 0.7)) return 'an Echo stands there';
    // the step in must be unobstructed and short
    const step = hero.clone().sub(p.pos).setY(0);
    if (step.length() > (mini ? 4.8 : 3.2)) return 'too far';
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
    this.heroTo.copy(hero);
    this.heroPath = null;
    if (id === 'passing') {
      // a clear lane beside the body and 2.4 m beyond it (1.7 m where the room is tighter), floor all along, nobody
      // standing in it
      let end: THREE.Vector3 | null = null, why = '';
      for (const beyond of [PASS_BEYOND, 1.7]) {
        const q = e.pos.clone().addScaledVector(fwd, beyond).addScaledVector(this.right, this.passSide);
        const ey = w.groundBelow(q.clone().setY(q.y + 0.8), 1.6, st);
        if (ey === null || Math.abs(ey - hero.y) > 0.4) { why = 'no ground beyond'; continue; }
        q.y = ey + 0.01;
        if (!this.clearLane(hero, q)) { why = 'lane blocked'; continue; }
        let holes = false;
        for (let k = 1; k <= 5; k++) if (!this.footing(hero.clone().lerp(q, k / 5))) holes = true;
        if (holes) { why = 'hole in the lane'; continue; }
        if (w.overlap(q, 0.35, 1.8, st) > 0.05) { why = 'end spot blocked'; continue; }
        if (bodies.some((b) => { const s = new THREE.Line3(hero, q), c = new THREE.Vector3(); s.closestPointToPoint(b.pos, true, c); return c.distanceTo(b.pos) < b.radius + 0.6; })) { why = 'an Echo in the lane'; continue; }
        end = q; this.passBeyond = beyond; break;
      }
      if (!end) return why;
      const from = hero.clone();
      this.heroPath = (t, out) => {
        // the step onto the start (0.12 s), then the slide: fast out, easing to rest past the body
        if (t < 0.12) { const k = t / 0.12; out.lerpVectors(this.heroFrom, from, k * k * (3 - 2 * k)); return; }
        const k = THREE.MathUtils.clamp((t - 0.12) / 0.62, 0, 1);
        out.lerpVectors(from, end, 1 - Math.pow(1 - k, 2.6));
      };
    }
    // camera: try the side with the most room first, then the mirror
    const pivot = mid.clone().setY(mid.y + 1.15);
    const sides = [1, -1];
    const roomR = w.raycast(pivot, this.right, 3.5, st)?.distance ?? 3.5;
    const roomL = w.raycast(pivot, this.right.clone().negate(), 3.5, st)?.distance ?? 3.5;
    if (roomL > roomR) sides.reverse();
    for (const side of sides) {
      this.side = side;
      this.setShot(id, e);
      let ok = true;
      for (const t of [0, 0.35, 0.7, 1]) {
        this.shot(t * DURATION[id], this.cam);
        const look = id === 'passing' ? this.cam.look : pivot;
        if (!this.shotClear(look, this.cam.pos, bodies)) { ok = false; break; }
      }
      if (ok) return null;
    }
    return 'no clear camera';
  }

  /** the camera path of each variant, in the pair's frame (fwd = hero → foe, right, up) */
  private setShot(id: FinisherId, e: Enemy) {
    this.setBaseShot(id, e);
    if (this.camK <= 1.001) return;
    // a big body (a mini-boss): the same composition, pulled back from the pair and looking a little higher
    const base = this.shot, k = this.camK;
    const pivot = this.heroTo.clone().lerp(e.pos, 0.5).setY(this.heroTo.y + 1.1);
    this.shot = (t, out) => {
      base(t, out);
      out.pos.sub(pivot).multiplyScalar(k).add(pivot);
      out.pos.y += (k - 1) * 0.9;
      out.look.y += (k - 1) * 0.55;
    };
  }
  private setBaseShot(id: FinisherId, e: Enemy) {
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
    } else if (id === 'kick') {
      // a low three-quarter view behind her shoulder; after the kick the camera turns to follow the body
      const flyTo = foe.clone().addScaledVector(fwd, 5).addScaledVector(UP, 1.2);
      this.shot = (t, out) => {
        const f = smooth((t - 0.95) / 0.7);
        out.pos.copy(hero).addScaledVector(fwd, -1.55 + f * 0.9).addScaledVector(right, 1.85).addScaledVector(UP, 1.3 + f * 0.25);
        const body = this.e && this.followBody > 0 ? this.e.center : flyTo;
        out.look.copy(mid).addScaledVector(UP, 1.0).lerp(body, f * 0.85);
      };
    } else if (id === 'headsman') {
      // low, in front and to the side of the foe, looking up across its shoulder at her: the kneeling body in the
      // foreground, the spin above it; a slow push-in on the neck cut, then it drifts up with the fountain
      this.shot = (t, out) => {
        const k = smooth((t - 0.5) / 0.3), up = smooth((t - 0.75) / 0.8);
        // (session 11: 0.35 m farther out — at 1.9 / 1.35 the kneeling body's own arm filled the corner of the frame)
        out.pos.copy(foe).addScaledVector(fwd, 2.25 - k * 0.3).addScaledVector(right, 1.6 - k * 0.2).addScaledVector(UP, 0.85 + up * 0.35);
        out.look.copy(mid).addScaledVector(fwd, -0.15).addScaledVector(UP, (1.25 - k * 0.1) * Math.max(1, sc * 0.9));
      };
    } else {
      // the passing cut, composed in depth: the camera waits ahead of her line, beyond the Echo; she slides past the
      // body toward the lens and comes to rest in the foreground, the Echo standing behind her until it falls
      const lineEnd = foe.clone().addScaledVector(fwd, this.passBeyond).addScaledVector(this.right, this.passSide);
      this.shot = (t, out) => {
        const k = smooth((t - 0.2) / 0.7);
        out.pos.copy(lineEnd).addScaledVector(fwd, 2.4 - k * 0.25).addScaledVector(right, 1.65).addScaledVector(UP, 1.05 + k * 0.1);
        out.look.copy(foe).lerp(lineEnd, 0.45 + k * 0.2).addScaledVector(UP, 1.0 * Math.max(1, sc * 0.9));
      };
    }
  }

  /**
   * The in-place finisher (a guaranteed one with nowhere safe to stage): she stays where she stands and delivers one
   * great overhead cleave; the body takes it where it is. No step, no camera move — the gameplay camera, a narrower lens,
   * slow motion — so it is safe beside any wall or hole.
   */
  private planStand(e: Enemy) {
    const p = this.g.player;
    this.fwd.subVectors(e.pos, p.pos).setY(0);
    if (this.fwd.lengthSq() < 0.04) this.fwd.copy(p.facing);
    this.fwd.normalize();
    this.right.crossVectors(this.fwd, UP).normalize();
    this.heroTo.copy(p.pos);
    this.heroPath = (_t, out) => out.copy(this.heroTo);
    this.shot = () => undefined;
  }

  // ------------------------------------------------------------------ playback
  private begin(id: FinisherId, e: Enemy) {
    const g = this.g, p = g.player;
    this.active = true;
    this.id = id;
    this.lastId = id;
    this.killsSince = 0;
    const bi = this.bag.indexOf(id);
    if (bi >= 0) this.bag.splice(bi, 1);
    this.e = e;
    this.t = 0;
    this.dur = DURATION[id];
    this.followBody = 0;
    this.trailOn = false;
    this.fovOffset = id === 'stab' ? 7 : id === 'frenzy' ? 3 : id === 'headsman' ? 4 : id === 'stand' ? 6 : 2;
    this.log.push({ t: +g.t.toFixed(2), enemy: e.arch.id, enc: e.encounter, result: `played ${id}${this.lastFight ? ' (last)' : ' (mid-fight)'}` });
    // the foe is caught: alive (the encounter must not clear yet) but out of the fight
    g.enemies.holdForFinisher(e);
    e.yaw = Math.atan2(-this.fwd.x, -this.fwd.z);
    // the hero is scripted: no input, no physics, invulnerable
    this.heroFrom.copy(p.pos);
    p.beginScripted();
    p.yaw = Math.atan2(this.fwd.x, this.fwd.z);
    if (id !== 'stand') { g.rig.cine = this.cam; this.shot(0, this.cam); }
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    g.audio.play('blade_ring', { rate: 0.7, vol: 0.6 });
    Platform.haptic(12);
    this.sampleVictim(e);
    this.lastGap = 9;
    this.beats = this.script(id, e);
    g.signals.emit('finisher', { id, enemy: e.arch.id, last: this.lastFight });
  }

  // ------------------------------------------------------------------ blade contact
  /** where the steel met the body at the last contact (the cut's blood and streak are placed here) */
  private contact = new THREE.Vector3();
  /** the blade's travel at that moment (the blood is thrown along it) */
  private contactDir = new THREE.Vector3();
  private lastGap = 9;
  /** where the stab went in / the neck cut landed (the blood that follows keeps coming from there) */
  private stabAt = new THREE.Vector3();
  private neckAt = new THREE.Vector3();
  /** tests: every armed beat with the time it fired and the blade's gap to the body then (≤ 0.08 = contact) */
  contactLog: { id: FinisherId; at: number; t: number; gap: number }[] = [];
  private verts: { mesh: THREE.SkinnedMesh; idx: number[] }[] = [];
  private sampleVictim(e: Enemy) {
    this.verts = [];
    e.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || !m.visible) return;
      const n = m.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 260));
      const idx: number[] = [];
      for (let k = 0; k < n; k += step) idx.push(k);
      this.verts.push({ mesh: m, idx });
    });
  }
  private _v = new THREE.Vector3(); private _a = new THREE.Vector3(); private _b = new THREE.Vector3(); private _q = new THREE.Vector3(); private _ab = new THREE.Vector3();
  /**
   * Is the blade in the victim's body this frame? The gap from the blade segment (hilt → tip) to the body's skinned
   * surface (~260 sampled vertices), checked on this frame's blade and on two between it and last frame's (a fast
   * swing travels a quarter metre a frame). Keeps the contact point and the blade's direction of travel for the cut.
   */
  private bladeContact(): boolean {
    const e = this.e, bl = this.g.player.blade;
    if (!e || !this.verts.length) return false;
    // (session 13) the skinned test (~780 vertices a frame) only once the blade is within reach of the body: while both
    // this frame's blade and last frame's are farther from the body's axis than its width plus 0.9 m, no blade between
    // them (a frame's sweep moves the tip ≤ ~0.5 m) can be touching the surface
    const axA = this._a.copy(e.pos), axB = this._b.copy(e.pos).setY(e.pos.y + e.height);
    const far = Math.min(segDist(bl.hilt, bl.tip, axA, axB), segDist(bl.prevHilt, bl.prevTip, axA, axB)) - (e.radius + 0.9);
    if (far > 0) { this.lastGap = far; return false; }
    e.root.updateMatrixWorld(true);
    let best = Infinity;
    for (const k of [1, 0.66, 0.33]) {
      const a = this._a.lerpVectors(bl.prevHilt, bl.hilt, k), b = this._b.lerpVectors(bl.prevTip, bl.tip, k);
      const ab = this._ab.subVectors(b, a), L2 = Math.max(1e-6, ab.lengthSq());
      for (const { mesh, idx } of this.verts) {
        for (const i of idx) {
          const v = mesh.getVertexPosition(i, this._v).applyMatrix4(mesh.matrixWorld);
          const t = THREE.MathUtils.clamp((v.x - a.x) * ab.x + (v.y - a.y) * ab.y + (v.z - a.z) * ab.z, 0, L2) / L2;
          const q = this._q.copy(a).addScaledVector(ab, t);
          const d = q.distanceTo(v);
          if (d < best) { best = d; this.contact.copy(v).lerp(q, 0.5); }
        }
      }
    }
    this.lastGap = best;
    this.contactDir.subVectors(bl.tip, bl.prevTip);
    if (this.contactDir.lengthSq() < 1e-6) this.contactDir.copy(this.fwd);
    this.contactDir.normalize();
    return best <= 0.08;
  }

  /** the beats of each finisher (director seconds; hit-stop / slow motion stretch them with the animations) */
  private script(id: FinisherId, e: Enemy): Beat[] {
    const g = this.g, p = g.player;
    const fwd = this.fwd.clone();
    const beast = (e.arch.finisher ?? 'humanoid') === 'beast';
    const chest = () => e.pos.clone().setY(e.pos.y + e.height * (beast ? 0.4 : 0.6) * e.arch.scale);
    const flesh = e.arch.asset === 'knight' ? 'armor' : 'flesh';
    const bloodCol = e.arch.blood ?? (e.arch.asset === 'hollow' ? 0x3c0906 : 0x7a0909);
    const gibKind = e.arch.asset === 'hollow' ? 'rotten' : e.arch.asset === 'knight' ? 'armor' : 'flesh';
    // the Maw / a crown brute has no hit clips: its reaction is the opening stumble of its fall, started once and slowly
    // (Enemy.die carries on with that clip instead of restarting it)
    const mutant = e.arch.asset === 'mutant';
    let reeling = false;
    const react = (heavy: boolean) => {
      if (beast) return;
      if (mutant) { if (!reeling) { reeling = true; e.once('death', 0.42, 0.05, 0.12); } return; }
      e.once(heavy ? e.arch.clips.hitH : e.arch.clips.hitL, heavy ? 1.1 : 1.5, 0, 0.05);
    };
    const kneel = () => { if (!beast && e.actions.has('crouch_idle')) e.once('crouch_idle', 1, 0, 0.22); };
    /** a cut that has just met the body (a contact beat): blood thrown along the blade's travel from where it went in */
    const cut = (sideSign: number, amount: number, heavy = false) => {
      const fresh = this.lastGap <= 0.12;
      const d = fresh ? this.contactDir.clone().addScaledVector(fwd, 0.35).normalize() : fwd.clone().addScaledVector(this.right, sideSign * 0.8).normalize();
      const at = fresh ? this.contact.clone() : chest();
      g.fx.bloodSpray(at, d, amount, bloodCol);
      g.gore.aftermath(at, d, amount * 0.7);
      g.audio.hitEnemy(flesh, heavy ? 30 : 18, at, heavy ? 0.9 : 0.5);
      e.recoil(d, heavy ? 0.32 : 0.2);
      react(heavy);
      g.fx.hitstop(heavy ? 0.07 : 0.045);
      g.rig.addShake(heavy ? 0.22 : 0.12);
      g.rig.punch(d, heavy ? 2.4 : 1.4);
      Platform.haptic(heavy ? 22 : 12);
    };
    const swing = (w: number) => g.audio.swing(w, p.pos, 1);
    const anim = (clip: string, start: number, speed: number, fade = 0.08) => p.anim.play(clip, { start, speed, fade });
    if (id === 'stab') {
      // gs_plunge from 1.05 at ×1.7: the blade enters the kneeling body at ~0.73 s and is deepest at ~0.83 s (measured
      // contact frames, dev/finisherContact.js; the old blow fired at 0.69 s with the steel still 0.3 m off). The kill
      // blow waits for that contact.
      return [
        { at: 0, fn: () => { anim('gs_plunge', 1.05, 1.7, 0.12); react(true); } },
        { at: 0.2, fn: () => { kneel(); swing(0.3); } },
        { at: 0.55, fn: () => { this.trailOn = true; swing(1); } },
        { at: 0.64, until: 0.86, fn: () => {
          // the stab: straight down through the kneeling body (a beast is pinned to the floor), where it went in
          const at = this.lastGap <= 0.12 ? this.contact.clone() : chest().addScaledVector(UP, -0.15);
          const d = fwd.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, -1, 0)).normalize();
          this.stabAt.copy(at);
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
        { at: 0.98, fn: () => { this.trailOn = false; } },
        { at: 1.1, fn: () => { g.fx.bloodSpray(this.stabAt, new THREE.Vector3(0, 1, 0).addScaledVector(fwd, -0.3).normalize(), 0.7, bloodCol); g.audio.play('blood_splash', { pos: this.stabAt }); } },
        { at: 1.22, fn: () => g.enemies.finisherKill(e, fwd, 0.12, 4) },
      ];
    }
    if (id === 'frenzy') {
      // session 11: the flurry is built from swings that REACH a body at the flurry's distance (measured contact
      // frames): L1's forehand diagonal and its backhand return (atk_whirlwind from 0.3 at ×1.6: through the waist at
      // ~0.27 s and ~0.6 s), a rising cut (atk_rising_cut from 0.5: through the chest ~0.19 s in), then the cleave's
      // overhead (gs_cleave from 0.3) tears it apart. The old quick cut / chop ended their swings 0.4–1.1 m short of
      // the body. Every cut fires on contact.
      return [
        { at: 0, fn: () => { anim('atk_whirlwind', 0.3, 1.6, 0.1); this.trailOn = true; swing(0.5); } },
        { at: 0.16, until: 0.4, fn: () => cut(1, 0.6) },
        { at: 0.46, until: 0.7, fn: () => { cut(-1, 0.7); swing(0.55); } },
        { at: 0.64, fn: () => anim('atk_rising_cut', 0.5, 1.6, 0.07) },
        { at: 0.72, until: 0.94, fn: () => { cut(1, 0.85, true); swing(0.7); } },
        { at: 0.95, fn: () => anim('gs_cleave', 0.3, 1.3, 0.07) },
        { at: 1.1, until: 1.4, fn: () => {
          // the destructive last blow: the overhead cleave tears the Echo apart, from where the blade went in
          const fresh = this.lastGap <= 0.12;
          const at = fresh ? this.contact.clone() : chest();
          const d = (fresh ? this.contactDir.clone() : fwd.clone().add(new THREE.Vector3(0, -0.5, 0))).normalize();
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
        { at: 1.5, fn: () => { this.trailOn = false; } },
      ];
    }
    if (id === 'kick') {
      return [
        // the cleave's overhead half (from 0.42): its opening diagonal ended 1.3 m short of a body at the kick's distance
        { at: 0, fn: () => { anim('gs_cleave', 0.42, 1.45, 0.1); this.trailOn = true; } },
        { at: 0.06, until: 0.3, fn: () => cut(1, 0.6) },
        { at: 0.3, fn: () => anim('atk_rising_cut', 0.5, 1.55, 0.07) },
        { at: 0.42, until: 0.6, fn: () => cut(-1, 0.8, true) },
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
    if (id === 'headsman') {
      // measured contact frames (guard, kneeling): the low sweep meets the legs ~0.35 s, the spin's neck cut ~0.73 s —
      // the old fixed beats fired at 0.25 / 0.66 s with the blade 0.85 m away. Both cuts now wait for the steel, and
      // the fountain rises from where the neck cut actually landed.
      return [
        // the low sweep (raised overhead, then round at knee height)
        { at: 0, fn: () => { anim('gs_low_sweep', 0.45, 1.5, 0.1); swing(0.4); } },
        { at: 0.14, fn: () => { this.trailOn = true; } },
        { at: 0.24, until: 0.46, fn: () => {
          const fresh = this.lastGap <= 0.12;
          const at = fresh ? this.contact.clone() : e.pos.clone().setY(e.pos.y + 0.45);
          const d = (fresh ? this.contactDir.clone() : this.right.clone().multiplyScalar(-this.side).add(fwd.clone().multiplyScalar(0.3))).normalize();
          g.fx.bloodSpray(at, d, 0.7, bloodCol);
          g.audio.hitEnemy(flesh, 20, at, 0.6);
          g.audio.play('bone_crunch', { pos: at, rate: 1.15, vol: 0.7 });
          g.fx.hitstop(0.05);
          g.rig.addShake(0.16);
          e.recoil(fwd, 0.25);
          kneel();
          Platform.haptic(18);
        } },
        { at: 0.5, fn: () => { this.trailOn = false; } },
        // she turns into the spin: its wide horizontal cut at neck height
        { at: 0.42, fn: () => { anim('gs_high_spin', 0.74, 1.4, 0.07); swing(0.9); } },
        { at: 0.54, fn: () => { this.trailOn = true; } },
        { at: 0.62, until: 0.86, fn: () => {
          const fresh = this.lastGap <= 0.12;
          const at = fresh ? this.contact.clone() : e.pos.clone().setY(e.pos.y + (beast ? 0.7 : 1.0) * e.arch.scale);
          const d = (fresh ? this.contactDir.clone().setY(0) : this.right.clone().multiplyScalar(this.side).addScaledVector(fwd, 0.2)).normalize();
          this.neckAt.copy(at);
          // the blow: a hard stop, a streak of light along the blade's path through the neck, the head thrown off, a fountain
          g.fx.hitstop(0.14);
          g.fx.slowmo(0.7, 0.3);
          this.streak(at.clone().addScaledVector(d, -0.7), at.clone().addScaledVector(d, 0.8), 0xffe6c0);
          g.fx.bloodSpray(at, d, 1.3, bloodCol);
          g.fx.bloodSpray(at, UP.clone().addScaledVector(d, 0.25).normalize(), 1.4, bloodCol);
          g.gore.gibs(at, d.clone().negate().add(new THREE.Vector3(0, 0.9, 0)).normalize(), 5, gibKind);
          g.gore.splat(at, new THREE.Vector3(0, -1, 0), 1.3, 2.2);
          g.audio.play('hit_slice', { pos: at, rate: 0.62, vol: 1.3 });
          g.audio.play('bone_crunch', { pos: at, rate: 0.85 });
          g.audio.play('gore_splat', { pos: at });
          g.audio.play('kill_impact', { pos: at, rate: 0.75 });
          g.rig.addShake(0.4);
          g.rig.punch(d, 3.0);
          g.kickFov(5);
          g.hud.flash('#4a0000', 0.2);
          e.recoil(d, 0.18);
          Platform.haptic(50);
        } },
        { at: 0.95, fn: () => { this.trailOn = false; g.fx.bloodSpray(this.neckAt, UP, 1.0, bloodCol); g.audio.play('blood_splash', { pos: this.neckAt }); } },
        { at: 1.12, fn: () => g.fx.bloodSpray(this.neckAt, UP.clone().addScaledVector(fwd, -0.2).normalize(), 0.7, bloodCol) },
        { at: 1.3, fn: () => { g.fx.bloodSpray(this.neckAt, UP, 0.45, bloodCol); g.enemies.finisherKill(e, fwd.clone().negate().setY(-0.2).normalize(), 0.12, 0); } },
      ];
    }
    if (id === 'stand') {
      // one great overhead cleave where she stands (gs_cleave from 0.3 at x1.25: through a body ~0.15–0.45 s in)
      return [
        { at: 0, fn: () => { anim('gs_cleave', 0.3, 1.25, 0.1); this.trailOn = true; swing(0.85); react(true); g.fx.slowmo(0.7, 0.45); } },
        { at: 0.12, until: 0.62, fn: () => {
          const fresh = this.lastGap <= 0.12;
          const at = fresh ? this.contact.clone() : chest();
          const d = (fresh ? this.contactDir.clone() : fwd.clone().add(new THREE.Vector3(0, -0.5, 0))).normalize();
          g.fx.hitstop(0.14);
          g.fx.slowmo(0.45, 0.45);
          this.streak(at.clone().addScaledVector(UP, 0.9).addScaledVector(fwd, -0.2), at.clone().addScaledVector(UP, -0.7).addScaledVector(fwd, 0.2), 0xffe6c0);
          g.fx.bloodSpray(at, d, 1.5, bloodCol);
          g.fx.bloodSpray(at, fwd.clone().add(new THREE.Vector3(0, 0.8, 0)).normalize(), 1.1, bloodCol);
          g.gore.splat(at, new THREE.Vector3(0, -1, 0), 1.9, 3);
          g.audio.play('hit_slice', { pos: at, rate: 0.66, vol: 1.2 });
          g.audio.play('bone_crunch', { pos: at, rate: 0.85 });
          g.audio.play('kill_impact', { pos: at, rate: 0.8 });
          g.rig.addShake(0.45);
          g.rig.punch(d, 3.2);
          g.kickFov(5);
          g.hud.flash('#4a0000', 0.18);
          Platform.haptic(50);
          g.enemies.finisherKill(e, fwd, 0.5, gibKind === 'armor' ? 6 : 10);
        } },
        { at: 0.9, fn: () => { this.trailOn = false; } },
      ];
    }
    // the passing cut
    return [
      // skip the run-up: the knee slide itself, its sweeping cut (1.30 s) meeting the body at 0.36 s
      { at: 0, fn: () => { anim('gs_slide_cut', 0.78, 1.45, 0.08); swing(0.95); g.audio.play('dodge', { pos: p.pos, rate: 0.8 }); } },
      { at: 0.2, fn: () => { this.trailOn = true; } },
      { at: 0.16, until: 0.42, fn: () => {
        // contact: everything stops for a breath; one line of light through the body along the blade, and silence
        const fresh = this.lastGap <= 0.12;
        const at = fresh ? this.contact.clone() : chest();
        const d = (fresh ? this.contactDir.clone().setY(0).normalize() : fwd.clone().addScaledVector(this.right, -0.9)).normalize();
        this.streak(at.clone().addScaledVector(d, -0.9).addScaledVector(UP, -0.35), at.clone().addScaledVector(d, 0.9).addScaledVector(UP, 0.35), 0xfff0d8);
        g.fx.hitstop(0.2);
        g.audio.play('blade_ring', { pos: at, rate: 1.35, vol: 1.1 });
        g.audio.play('hit_slice', { pos: at, rate: 1.1, vol: 0.9 });
        g.rig.addShake(0.12);
        g.kickFov(3);
        Platform.haptic(28);
      } },
      { at: 0.62, fn: () => { this.trailOn = false; } },
      // she rises from the slide and flicks the blood from the blade (the twirl of the flourish)
      { at: 0.86, fn: () => anim('idle_flourish_b', 2.12, 1.5, 0.18) },
      { at: 1.02, fn: () => {
        // the wound opens: the Echo jerks, bleeds out along the cut and folds
        const at = chest();
        const d = fwd.clone().negate().addScaledVector(this.right, 0.6).normalize();
        g.fx.bloodSpray(at, d, 1.4, bloodCol);
        g.fx.bloodSpray(at, fwd.clone().addScaledVector(UP, 0.5).normalize(), 1.0, bloodCol);
        g.gore.splat(at, new THREE.Vector3(0, -1, 0), 1.6, 2.6);
        g.gore.aftermath(at, fwd, 1.1);
        g.audio.play('gore_splat', { pos: at });
        g.audio.play('bone_crunch', { pos: at, rate: 0.9 });
        g.audio.play('kill_impact', { pos: at, rate: 0.85 });
        g.fx.slowmo(0.45, 0.35);
        g.rig.addShake(0.3);
        g.hud.flash('#3a0000', 0.16);
        e.recoil(d, 0.35);
        react(true);
        Platform.haptic(40);
      } },
      { at: 1.2, fn: () => g.enemies.finisherKill(e, fwd.clone().negate(), 0.1, 6) },
    ];
  }

  /**
   * A slash of light along a cut (the blade's path through the body): a thin additive ribbon that faces the camera
   * round its own axis, flares and fades on real time (it hangs in the air through the hit-stop). Pooled: two.
   */
  private streaks: { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; t: number }[] = [];
  private streakGeo = new THREE.PlaneGeometry(1, 1);
  private streakTex = (() => {
    // across the ribbon: a bright core with a soft falloff (1 x 32, luminance → alpha)
    const n = 32, d = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) { const x = Math.abs(i / (n - 1) - 0.5) * 2; const v = Math.round(255 * (0.55 * Math.pow(1 - x, 5) + 0.45 * Math.pow(1 - x, 1.4))); d.set([255, 255, 255, v], i * 4); }
    const t = new THREE.DataTexture(d, 1, n, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  })();
  private streakMat(color: number) {
    return new THREE.MeshBasicMaterial({ color, map: this.streakTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  }
  private streak(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    let s = this.streaks.find((x) => x.t <= 0);
    if (!s) {
      if (this.streaks.length >= 2) s = this.streaks[0];
      else { s = { mesh: new THREE.Mesh(this.streakGeo, this.streakMat(color)), a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0 }; s.mesh.frustumCulled = false; s.mesh.renderOrder = 6; this.streaks.push(s); }
    }
    (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    s.a.copy(a); s.b.copy(b); s.t = 0.42;
    this.g.scene.add(s.mesh);
    // a few embers shed along the line
    const q = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= 10; i++) {
      q.lerpVectors(a, b, i / 10);
      v.set((Math.random() - 0.5) * 0.6, Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
      this.g.fx.emit(q, v, color, 0.3 + Math.random() * 0.2, 0.03 + Math.random() * 0.02, 1);
    }
  }
  private _sx = new THREE.Vector3(); private _sy = new THREE.Vector3(); private _sz = new THREE.Vector3(); private _sm = new THREE.Matrix4();
  private updateStreaks(realDt: number) {
    const cam = this.g.camera.position;
    for (const s of this.streaks) {
      if (s.t <= 0) continue;
      s.t -= realDt;
      if (s.t <= 0) { s.mesh.removeFromParent(); continue; }
      const k = s.t / 0.42;                       // 1 → 0
      const len = s.a.distanceTo(s.b) * (1 + (1 - k) * 0.25);
      const x = this._sx.subVectors(s.b, s.a).normalize();
      const mid = this._sz.lerpVectors(s.a, s.b, 0.5);
      const toCam = this._sy.subVectors(cam, mid).normalize();
      const y = new THREE.Vector3().crossVectors(toCam, x).normalize();
      const z = new THREE.Vector3().crossVectors(x, y);
      this._sm.makeBasis(x, y, z);
      s.mesh.quaternion.setFromRotationMatrix(this._sm);
      s.mesh.position.copy(mid);
      s.mesh.scale.set(len, 0.07 + (1 - k) * 0.07 + (k > 0.85 ? (k - 0.85) * 0.9 : 0), 1);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 1.6);
    }
  }
  /** one ribbon for the loading-screen warm-up (its program + texture upload never happen mid-fight) */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const m = new THREE.Mesh(this.streakGeo, this.streakMat(0xffffff));
    m.position.copy(at).add(new THREE.Vector3(0, 1.2, -1.5));
    m.frustumCulled = false;
    return { objects: [m], dispose: () => { m.removeFromParent(); (m.material as THREE.Material).dispose(); } };
  }

  /** per frame (game dt: hit-stop and slow motion stretch the finisher with everything else) */
  update(dt: number) {
    this.updateStreaks(this.g.realDt);
    if (!this.active || !this.e) return;
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.heroPath) this.heroPath(this.t, p.pos);
    else {
      // the step in (0.16 s; a longer approach round a mini-boss takes a little longer), facing the foe
      const k = Math.min(1, this.t / (0.16 + Math.max(0, this.heroFrom.distanceTo(this.heroTo) - 1.6) * 0.06));
      p.pos.lerpVectors(this.heroFrom, this.heroTo, k * k * (3 - 2 * k));
    }
    p.invuln = 1;
    for (const b of this.beats) {
      if (b.done || this.t < b.at) continue;
      if (b.until !== undefined && this.t < b.until && !this.bladeContact()) continue;
      if (b.until !== undefined) this.contactLog.push({ id: this.id!, at: b.at, t: +this.t.toFixed(3), gap: +this.lastGap.toFixed(3) });
      b.done = true; b.fn();
    }
    if (this.id !== 'stand') this.shot(this.t, this.cam);
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
    this.heroPath = null;
    g.player.endScripted();
    g.player.invuln = FINISHER_TUNING.grace;
    g.enemies.releaseFinisherHold();
    g.rig.cine = null;
    g.hud.cinematic(false);
    g.touch?.cinematic(false);
    this.lastAt = g.t;
    this.id = null;
  }
}

