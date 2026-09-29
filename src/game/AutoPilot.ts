import * as THREE from 'three';
import type { Game } from './Game';
import type { TimeState } from '../levels/Materials';

/**
 * End-to-end playthrough driver (per-floor routes: ROUTES). Drives the REAL input layer (virtual keys + camera yaw),
 * so movement, collision, combat, crouch, sigils and every temporal shift go through gameplay code.
 * Waypoints are in blueprint (Blender) coordinates. Used by the automated test (`?autopilot`).
 */
type Step =
  | { go: [number, number, number]; tol?: number; crouch?: boolean; sprint?: boolean; note?: string; drop?: boolean }
  | { shift: TimeState; note?: string }
  | { interact: string }
  | { fight: string[]; radius?: number; note?: string }
  | { clear: string; timeout?: number }
  | { wait: number }
  /** face a resonant fracture and use heavy blows until its flag breaks */
  | { strike: string; at: [number, number, number]; note?: string };

const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

export const ROUTE: Step[] = [
  { go: [0, -46, 0], note: 'enter gate passage' },
  { go: [0, -39.2, 0] },
  { go: [6.5, -39.2, 0], note: 'through the breach into GR_E' },
  { fight: ['E1'], note: 'E1 tutorial Hollows' },
  { go: [12.5, -40.6, 0] },
  { interact: 'CP1' },
  { go: [6.5, -39.2, 0] },
  { go: [0.5, -38.8, 0] },
  { shift: 'PAST', note: 'G1 — the gate remembers' },
  { fight: ['E2'], note: 'E2 gate guards' },
  { go: [0, -31, 0] },
  { go: [2, -26, 0], note: 'into the Ward' },
  { fight: ['E3'], radius: 14, note: 'E3 muster yard' },
  { go: [15, -17, 0] },
  { shift: 'PRESENT', note: 'G2 — barred from within' },
  { fight: ['E4'], radius: 14 },
  { go: [17.2, -17.2, 0] },
  { interact: 'CP2' },
  { go: [20.5, -13, 0] },
  { go: [26.5, -13, 0], note: 'into the barracks' },
  { go: [30.5, -12, 0] },
  { fight: ['E5'], radius: 16, note: 'E5 barracks Hollows + Hollow Warden' },
  { go: [30.8, -3, 0] },
  { go: [31.2, 1.8, 0] },
  { go: [31.2, 8.2, 0], crouch: true, note: 'crawl gap (crouch)' },
  { go: [30.6, 11.8, 0] },
  { fight: ['E6'], radius: 16, note: 'E6 armory' },
  { go: [21.3, 11.0, 0] },
  { go: [21.3, 16.4, 2.6] },
  { go: [21.3, 18.2, 3.0], tol: 0.45, note: 'rubble pad on the old landing' },
  { shift: 'PAST', note: 'G3 — half a stair' },
  { go: [21.3, 20.5, 3.3] },
  { go: [21.3, 25.6, 6.0], note: 'top landing' },
  { interact: 'CP3' },
  { go: [18.6, 25.8, 6.0] },
  { go: [16.0, 24.0, 6.0], note: 'east gallery' },
  { fight: ['E7'], radius: 18, note: 'E7 gallery guards + archers' },
  { go: [16.0, 12.0, 6.0] },
  { shift: 'PRESENT', note: 'G4 — under the fall' },
  { go: [15.2, 10.2, 6.0] },
  { go: [3.5, 10.1, 6.0], crouch: true, note: 'crawl tunnel' },
  { go: [0.0, 11.0, 6.0] },
  { fight: ['E8'], radius: 18, note: 'E8 ambush' },
  { go: [-12.0, 11.0, 6.0] },
  { go: [-16.0, 13.5, 6.0] },
  { shift: 'PAST', note: 'G5 — the open door' },
  { fight: ['E9'], radius: 16, note: 'E9 Royal Wardens' },
  { go: [-17.2, 11.5, 6.0] },
  { go: [-23.5, 11.5, 6.0], note: 'chapel loft' },
  { go: [-25.4, 12.2, 6.0] },
  { interact: 'CP4' },
  { go: [-31, 13.2, 6.0] },
  { go: [-34.75, 15.2, 6.0] },
  { go: [-34.75, 26.8, 0.0], note: 'down the loft stair' },
  { go: [-31.0, 26.0, 0.0] },
  { fight: ['E10'], radius: 18, note: 'E10 the binding rite' },
  { go: [-29.0, 25.0, 0.0] },
  { shift: 'PRESENT', note: 'G6 — the floor gives way' },
  { go: [-29.0, 27.2, -0.7] },
  { go: [-29.0, 31.5, -3.3] },
  { go: [-29.0, 37.0, -6.0], note: 'down the collapse into the crypt' },
  { fight: ['E11'], radius: 16, note: 'E11 crypt' },
  { go: [-24.8, 38.8, -6.0] },
  { interact: 'CP5' },
  { go: [-20, 36, -6] },
  { go: [-14, 34, -6], note: 'undercroft west ledge' },
  { fight: ['E12'], radius: 12 },
  { go: [-12, 23.5, -6] },
  { go: [0, 23.5, -6], note: 'across the fill' },
  { go: [11, 23.5, -6] },
  { fight: ['E12'], radius: 16, note: 'E12 archers' },
  { go: [10.4, 31.6, -6] },
  { interact: 'CP6' },
  { go: [12.5, 27.0, -6] },
  { shift: 'PAST', note: 'G7 — across, then up' },
  { fight: ['E12c'], radius: 12, note: 'E12c overseers' },
  { go: [15.75, 27.4, -6], tol: 0.5 },
  { go: [15.75, 38.4, 0], note: 'scaffold stair to the hatch' },
  { go: [15.0, 40.0, 0], note: 'into the Great Hall' },
  { clear: 'E13', timeout: 300 },
  { go: [0, 33, 0] },
  { go: [0, 37.5, 1.2] },
  { go: [0, 42.8, 1.2], tol: 0.4, note: 'stand in the doorway' },
  { shift: 'PRESENT', note: 'G8 — stand in the doorway' },
  { go: [0, 45.5, 1.5] },
  { go: [0, 56.8, 8.0], note: 'Royal Stair to the exit' },
];

/**
 * Floor 2 "Complicity" — as built by tools/blender/floor02_layout.py (Blender coordinates). Critical path:
 * E1 → CP1 → G1 Past → E1b → E3 → timber stair → mezzanine → G2 Present → slope → CP2 → Wardens' Walk → E4 →
 * truss ramp → ridge (E6) → tower (CP3) → tower top → south walk → G3 Past → E7 → crown bridge → G4 Present →
 * loft → G5 Past → E8 → FR1 (winch) → G6 Present → drop → E9 → CP4 → chandelier bridge → E10 Kingsguard →
 * CP5 → G7 Past → conduit stair → bell chamber → exit.
 */
export const ROUTE2: Step[] = [
  { go: [0, 61.5, 8], note: 'landing → antechamber' },
  { fight: ['E1'], radius: 14, note: 'E1 Hollows + wraith (Present)' },
  { go: [0, 63.6, 8] },
  { interact: 'CP1' },
  { shift: 'PAST', note: 'G1 — the antechamber remembers its doors' },
  { fight: ['E1b'], radius: 16, note: 'E1b royal guards' },
  { go: [10.5, 70, 8] },
  { go: [15.2, 69.0, 8], tol: 0.6, note: 'into the Chancery (Past), south of the stair foot' },
  { fight: ['E3'], radius: 16, note: 'E3 chancery guards' },
  { go: [18.5, 66, 8], note: 'between the record shelves' },
  { go: [18.5, 69.3, 8] },
  { go: [15, 69.3, 8], tol: 0.5 },
  { go: [15, 76.6, 11.8], note: 'timber stair' },
  { go: [15.6, 78.5, 12] },
  { go: [31.8, 78.5, 12], note: 'north mezzanine' },
  { go: [32, 73.4, 12], tol: 0.5, note: 'east mezzanine end' },
  { shift: 'PRESENT', note: 'G2 — up in one memory, down in the other' },
  { go: [33, 70.5, 11.3] },
  { go: [33, 66.4, 8.1], note: 'down the sagged slope' },
  { go: [33, 62.6, 8] },
  { go: [37, 62.6, 8], note: 'through the east door' },
  { interact: 'CP2' },
  { go: [38, 56, 8] },
  { go: [38, 52.6, 8] },
  { go: [38, 47.6, 10], note: "wardens' walk stair" },
  { go: [38, 42, 10] },
  { go: [35, 42, 10] },
  { go: [31.5, 42, 10], note: "wardens' range" },
  { fight: ['E4'], radius: 14, note: 'E4 hollow wardens' },
  { go: [33.2, 36, 10], note: 'east aisle, round the fallen trusses' },
  { go: [33.2, 43, 10] },
  { go: [28, 43.8, 10], note: 'foot of the truss ramp' },
  { go: [28, 37.4, 13.8], note: 'truss ramp' },
  { go: [28, 33, 14] },
  { fight: ['E6'], radius: 10, note: 'E6 wraiths on the ridge' },
  { go: [28, 23, 14], tol: 0.5 },
  { go: [28, 16, 10], note: 'down past the gate' },
  { go: [25, 13.4, 10] },
  { go: [21, 13.4, 10], note: "minstrels' tower" },
  { go: [19.5, 9.4, 10] },
  { interact: 'CP3' },
  { go: [15, 6.9, 10] },
  { go: [15, 10.9, 12.9], note: 'tower flight 1' },
  { go: [16.6, 13.1, 13] },
  { go: [21.7, 13.1, 16], tol: 0.5, note: 'tower flight 2' },
  { go: [22.4, 11.3, 16], tol: 0.5 },
  { go: [19, 9.6, 16] },
  { go: [15, 8, 16] },
  { go: [11, 8, 16], note: 'south walk' },
  { go: [4, 8, 16] },
  { go: [1.4, 8.4, 16] },
  { go: [0, 17, 16], note: 'gallery south part' },
  { shift: 'PAST', note: 'G3 — the gallery over the hall' },
  { fight: ['E7'], radius: 16, note: 'E7 gallery wardens' },
  { go: [0, 40, 16] },
  { go: [0, 43.4, 16] },
  { go: [0, 47.6, 14], note: 'crown bridge' },
  { go: [0, 57.4, 14] },
  { shift: 'PRESENT', note: 'G4 — the door that knows only the ruin' },
  { go: [0, 62.6, 14] },
  { go: [-5, 64.3, 14], note: 'crown loft (south)' },
  { shift: 'PAST', note: 'G5 — the loft corner stands in the Past' },
  { fight: ['E8'], radius: 20, note: 'E8 loft guards + archer' },
  { go: [-10.7, 64.4, 14] },
  { go: [-10.7, 67.9, 14], tol: 0.4 },
  { strike: 'FR1', at: [-10.8, 70, 15], note: 'FR1 — bring down the crown' },
  { go: [-10.7, 74.2, 14], tol: 0.5 },
  { shift: 'PRESENT', note: 'G6 — across the crown' },
  { go: [-7.8, 74.2, 9.6], note: 'drop onto the heap', drop: true },
  { fight: ['E9'], radius: 12, note: 'E9 wraiths over the void' },
  { go: [-10.3, 72.5, 8], tol: 0.9, note: 'off the heap, west side' },
  { go: [-9.2, 65.3, 8] },
  { interact: 'CP4' },
  { go: [-9.2, 64.2, 8] },
  { go: [0, 64.4, 8], note: 'south strip, clear of the piers' },
  { go: [0, 67.2, 8], tol: 0.4 },
  { go: [0, 72, 8.3], tol: 0.5, note: 'the fallen chandelier' },
  { go: [0, 77.4, 8], tol: 0.5 },
  { go: [0, 80.6, 8], note: "the King's apartments" },
  { clear: 'E10', timeout: 300 },
  { go: [11, 80.8, 8], note: 'south band, clear of the floor holes' },
  { go: [11, 87.2, 8] },
  { go: [14.2, 87.2, 8], note: "king's study" },
  { go: [15.3, 87.3, 8], tol: 0.45 },
  { interact: 'CP5' },
  { go: [16, 85, 8] },
  { shift: 'PAST', note: 'G7 — the stair only the Past remembers' },
  { go: [19.2, 84.2, 8] },
  { go: [21.5, 84.2, 8.2] },
  { go: [21.5, 92.6, 13.8], note: 'conduit stair lower flight' },
  { go: [21.5, 95, 14] },
  { go: [27.5, 95, 14] },
  { go: [27.5, 84.6, 19.8], note: 'conduit stair middle flight' },
  { go: [27.4, 83.1, 20], tol: 0.5, note: 'upper landing' },
  { go: [21.5, 83.1, 20] },
  { go: [21.5, 90.3, 23.8], note: 'conduit stair top flight' },
  { go: [21.3, 95.2, 24], tol: 0.6, note: 'bell chamber' },
  { go: [24, 100.6, 24], note: 'the door to the Crown' },
];

export const ROUTES: Record<number, Step[]> = { 1: ROUTE, 2: ROUTE2 };

export class AutoPilot {
  i = 0;
  t = 0;
  stepT = 0;
  log: string[] = [];
  done = false;
  failed: string | null = null;
  private lastPos = new THREE.Vector3();
  private stuckT = 0;
  private attackT = 0;
  private combo = 0;
  private shiftTries = 0;
  private deathsSeen = 0;
  private lastReached: THREE.Vector3 | null = null;
  private detour: THREE.Vector3[] = [];
  private stuckCount = 0;
  skipped = new Set<number>();
  private dodgeCd = 0;
  private detourT = 0;
  private backT = 0;
  events: { t: number; msg: string }[] = [];
  route: Step[];

  constructor(public game: Game, public mode: string) {
    this.route = ROUTES[game.floorId] ?? ROUTE;
    this.note(`autopilot start (${mode})`);
    if (mode === 'god') game.player.godMode = true;
  }

  private note(msg: string) {
    const g = this.game;
    const s = `[${this.t.toFixed(1)}s] ${msg} | pos ${g.blenderPos().join(',')} ${g.time.state} charge ${g.time.charge.toFixed(0)} hp ${g.player.hp.toFixed(0)}`;
    this.log.push(s);
    this.events.push({ t: this.t, msg });
  }

  private release() {
    const inp = this.game.input;
    for (const a of ['forward', 'back', 'left', 'right', 'sprint', 'block', 'shift'] as const) inp.setVirtual(a, false);
    this.backT = 0;
  }

  private faceCamera(target: THREE.Vector3) {
    const p = this.game.player.pos;
    const d = target.clone().sub(p);
    this.game.rig.yaw = Math.atan2(-d.x, -d.z);
  }

  /** Nearest live hostile relevant to the listed encounters (or any within radius). */
  private nearestEnemy(ids: string[], radius: number) {
    const g = this.game;
    const st = g.time.state;
    let best: any = null, bd = radius;
    const pool = [...g.enemies.enemies, ...g.enemies.remnants];
    for (const e of pool) {
      if (!e.alive || e.removed || e.state === 'hidden') continue;
      if (e.owner !== st && e.owner !== 'BOTH') continue;
      const d = e.pos.distanceTo(g.player.pos);
      const dy = Math.abs(e.pos.y - g.player.pos.y);
      if (dy > 2.4) continue;
      const from = g.player.pos.clone().setY(g.player.pos.y + 1.3);
      const to = e.pos.clone().setY(e.pos.y + 1.1);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const hit = g.level.collision.raycast(from, dir.normalize(), len, st);
      if (hit && hit.distance < len - 0.5) continue; // no line of sight
      const relevant = ids.includes(e.encounter) || e.encounter === 'REMNANT' || (e.triggered && d < 7);
      if (!relevant) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt: number) {
    if (this.done || this.failed) return;
    this.decide(dt);
    if (!this.done && !this.failed) this.guardLedges();
  }

  private decide(dt: number) {
    this.t += dt;
    this.stepT += dt;
    const g = this.game;
    const inp = g.input;
    const p = g.player;
    if (g.deaths > this.deathsSeen) {
      this.deathsSeen = g.deaths;
      this.note('PLAYER DIED — respawn at checkpoint ' + (g.checkpoints.save?.cid ?? 'none'));
      this.release();
      // rewind to the step right after the last sigil interaction
      const cid = g.checkpoints.save?.cid;
      const idx = cid ? this.route.findIndex((s) => 'interact' in s && s.interact === cid) : -1;
      this.i = idx >= 0 ? idx + 1 : 0;
      this.stepT = -3.5;
      return;
    }
    if (!p.alive || this.stepT < 0) return;
    if (g.finished) { this.done = true; this.release(); this.note('EXIT REACHED — floor complete'); return; }
    const step = this.route[this.i];
    if (!step) { this.failed = 'route exhausted without reaching the exit'; this.note(this.failed); return; }

    // opportunistic defence: guard against an enemy mid-attack right next to us (not while channelling)
    const threat = this.nearestEnemy([], 3.2);

    if ('go' in step) {
      let target = B(...step.go);
      if (this.detour.length) {
        target = this.detour[0];
        this.detourT += dt;
        if (target.clone().sub(p.pos).setY(0).length() < 0.8 || this.detourT > 6) { this.detour.shift(); this.detourT = 0; this.stuckT = 0; return; }
      }
      const flat = target.clone().sub(p.pos).setY(0);
      const dist = flat.length();
      const tol = step.tol ?? 0.7;
      // interrupt travel to fight anything that engages us
      const engaged = this.nearestEnemy([], 6);
      if (engaged && engaged.triggered && !step.crouch) { this.fightTick(engaged, dt); return; }
      if (step.crouch && !p.crouching && p.state === 'move') inp.tapVirtual('crouch');
      if (!step.crouch && p.crouching && (p.state === 'crouch')) inp.tapVirtual('crouch');
      if (!this.detour.length && dist < tol && Math.abs(target.y - p.pos.y) < 1.2) {
        this.release();
        if (step.note) this.note('reached: ' + step.note);
        this.lastReached = target.clone();
        this.next();
        return;
      }
      p.lockTarget = null;
      this.faceCamera(target);
      inp.setVirtual('forward', true);
      this.holdSprint(!!step.sprint && dist > 4);
      // stuck detection
      if (this.lastPos.distanceTo(p.pos) < 0.02 * 60 * dt) this.stuckT += dt; else this.stuckT = 0;
      this.lastPos.copy(p.pos);
      if (this.stuckT > 1.2 && p.grounded && !step.crouch) {
        this.stuckCount++;
        if (this.stuckCount % 3 === 0 && this.lastReached && !this.detour.length) {
          // displaced by a fight: walk back to the last waypoint we reached, then retry
          this.detour.push(this.lastReached.clone());
          this.note('stuck — backtracking to last waypoint');
        } else inp.tapVirtual('jump');
        this.stuckT = 0.4;
      }
      const prevGo = this.route[this.i - 1];
      const fellOff = !!this.lastReached && this.lastReached.y - p.pos.y > 2 && !(prevGo && 'go' in prevGo && prevGo.drop);
      if (this.stepT > 6 && this.stuckCount >= 2 && fellOff && p.grounded && this.rewinds < 8) {
        // knocked off a walkway (the range ridge, the loft): we are now well below the last waypoint we reached,
        // so re-walk from the most recent nearby waypoint at our current height
        for (let j = this.i - 1; j >= Math.max(0, this.i - 14); j--) {
          const s = this.route[j];
          if (!('go' in s)) continue;
          const w = B(...s.go);
          if (Math.abs(w.y - p.pos.y) < 1.0 && w.distanceTo(p.pos) < 16) {
            this.rewinds++;
            this.note(`fell below the route — re-walking from step ${j}`);
            this.i = j; this.stepT = 0; this.detour = []; this.stuckCount = 0;
            return;
          }
        }
      }
      if (this.stepT > 14 && !this.detour.length) {
        const nxt = this.route[this.i + 1];
        if (nxt && 'go' in nxt && !this.skipped.has(this.i)) {
          this.skipped.add(this.i);
          this.note(`SKIP unreachable waypoint ${step.go.join(',')} -> trying next`);
          this.next();
          return;
        }
      }
      if (this.stepT > 45) { this.fail(`stuck travelling to ${step.go.join(',')} (${step.note ?? ''})`); }
      return;
    }
    if ('interact' in step) {
      this.release();
      if (this.stepT > 0.2 && this.stepT < 0.3) inp.tapVirtual('interact');
      if (this.stepT > 2.4) {
        if (g.checkpoints.activated.has(step.interact)) { this.note('sigil ' + step.interact + ' activated'); this.next(); }
        else this.fail('could not activate sigil ' + step.interact);
      }
      return;
    }
    if ('shift' in step) {
      if (g.time.state === step.shift) {
        this.release();
        this.note(`shifted to ${step.shift} (${step.note ?? ''})`);
        this.next();
        return;
      }
      if (threat && threat.triggered) { inp.setVirtual('shift', false); this.fightTick(threat, dt); return; }
      if (g.time.charge < 100 && g.time.cooldown <= 0 && this.stepT > 1) {
        // rely on fissures / remaining Echoes: fight whatever is around, otherwise go and wait by the nearest
        // fissure on this level (the blueprint's softlock guarantee), then come back to shift here
        const any = this.nearestEnemy([], 20);
        if (any) { this.fightTick(any, dt); return; }
        const pp = p.pos;
        const fis = g.level.markersOf('fissure').filter((f) => Math.abs(f.pos.y - pp.y) < 3).sort((a, b) => a.pos.distanceTo(pp) - b.pos.distanceTo(pp))[0];
        if (fis && fis.pos.distanceTo(pp) > 3) {
          if (!this.detour.length) { this.detour.push(fis.pos.clone()); this.shiftReturn = pp.clone(); this.note('low charge — walking to fissure ' + fis.name); }
          this.faceCamera(fis.pos);
          inp.setVirtual('forward', true);
          if (fis.pos.distanceTo(pp) < 3.5) this.detour = [];
          return;
        }
        inp.setVirtual('forward', false);
        if (this.stepT > 60) this.fail('no charge for required shift ' + step.shift);
        return;
      }
      if (this.shiftReturn && this.shiftReturn.distanceTo(p.pos) > 1.2) {
        // charged at a fissure: walk back to where the route wanted the shift
        this.faceCamera(this.shiftReturn);
        inp.setVirtual('forward', true);
        return;
      }
      if (this.shiftReturn) { this.shiftReturn = null; this.release(); }
      if (p.state !== 'channel') {
        inp.setVirtual('shift', false);
        if (p.state === 'move' || p.state === 'land') {
          inp.setVirtual('shift', true);
          this.shiftTries++;
          if (this.shiftTries > 8) this.fail('shift keeps failing: ' + (document.querySelector('.deny')?.textContent ?? ''));
        }
      }
      return;
    }
    if ('fight' in step || 'clear' in step) {
      const ids = 'fight' in step ? step.fight : [step.clear];
      const radius = 'fight' in step ? (step.radius ?? 12) : 60;
      const e = this.nearestEnemy(ids, radius);
      const clearedAll = ids.every((id) => g.enemies.isCleared(id));
      if ('clear' in step) {
        if (clearedAll) { this.release(); this.note('cleared ' + step.clear); this.next(); return; }
        if (this.stepT > (step.timeout ?? 180)) { this.fail('timeout clearing ' + step.clear); return; }
        if (e) this.fightTick(e, dt); else { this.release(); }
        return;
      }
      if (!e) {
        if (this.stepT > 1.0) { this.release(); this.note(`fight done ${ids.join(',')} (cleared: ${clearedAll})`); this.next(); }
        return;
      }
      this.fightTick(e, dt);
      if (this.stepT > 150) this.fail('fight stalled ' + ids.join(','));
      return;
    }
    if ('strike' in step) {
      if (g.level.flags.has(step.strike)) { this.release(); this.note('fracture ' + step.strike + ' broken'); this.next(); return; }
      if (threat && threat.triggered) { this.fightTick(threat, dt); return; }
      this.release();
      p.lockTarget = null;
      const target = B(...step.at);
      this.faceCamera(target);
      if (p.state === 'move' && (this.attackT -= dt) <= 0) { inp.tapVirtual('heavy'); this.attackT = 1.1; }
      if (this.stepT > 25) this.fail('could not break fracture ' + step.strike);
      return;
    }
    if ('wait' in step) {
      this.release();
      if (this.stepT > step.wait) this.next();
    }
  }

  /** True when walking ~1 m along `dir` would leave footing (a floor hole, a void, a ledge > 2.5 m). */
  private voidAhead(dir: THREE.Vector3) {
    const g = this.game, p = g.player.pos, col = g.level.collision, st = g.time.state;
    const d = dir.clone().setY(0).normalize();
    // three samples: a narrow seam (the loft's 0.4 m slab joint) must not read as a drop
    let missing = 0;
    for (const k of [0.6, 1.2, 1.8]) {
      // probe from 1.3 m above the feet so a rising ramp or stair ahead still reads as footing
      const a = p.clone().addScaledVector(d, k);
      a.y += 1.3;
      if (!col.hasFooting(a, 1.3 + 2.5, st) || col.inVoid(a.clone().setY(p.y - 0.5), st)) missing++;
    }
    return missing >= 2;
  }

  /**
   * Ledge guard, run after every step decision: a player would not walk into the Royal Floor's holes while
   * fighting, so the bot never presses forward toward a drop (unless the current step is an intentional drop).
   */
  private guardLedges() {
    const g = this.game, inp = g.input;
    const step = this.route[this.i];
    if (step && 'go' in step && step.drop) return;
    if (!inp.isVirtual('forward') || !g.player.grounded) return;
    const yaw = g.rig.yaw;
    if (!this.voidAhead(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)))) return;
    inp.setVirtual('forward', false);
    inp.setVirtual('sprint', false);
    this.ledgeStops++;
    // travelling: head back to the last safe waypoint and try again from there
    if (step && 'go' in step && this.lastReached && !this.detour.length) this.detour.push(this.lastReached.clone());
  }
  ledgeStops = 0;
  private rewinds = 0;
  private shiftReturn: THREE.Vector3 | null = null;

  private fightTick(e: any, dt: number) {
    const g = this.game;
    const inp = g.input;
    const p = g.player;
    inp.setVirtual('shift', false);
    if (p.crouching && p.state === 'crouch') inp.tapVirtual('crouch');
    const d = e.pos.distanceTo(p.pos);
    this.faceCamera(e.pos);
    if (!p.lockTarget) p.lockTarget = { get pos() { return e.pos; }, get alive() { return e.alive; } };
    if (e.arch.boss) { this.bossTick(e, d, dt); return; }
    // defend like a moderately skilled player: dodge out of windups, guard otherwise, back off when hurt
    const attacking = (e.state === 'attack' || e.state === 'dive') && d < 3.6;
    const inWindup = attacking && e.attack && e.cur && e.cur.time < e.attack.window[0] && e.cur.time > e.attack.window[0] - 0.45;
    const low = p.hp < p.maxHp * 0.35;
    if (inWindup && p.state !== 'attack' && this.dodgeCd <= 0 && Math.random() < (low ? 0.9 : 0.55)) {
      this.dodgeCd = 1.0;
      inp.setVirtual('block', false);
      inp.setVirtual('forward', false);
      inp.setVirtual('back', true);
      inp.setVirtual('sprint', false);
      inp.tapVirtual('sprint');
      this.backT = 0.2;
      return;
    }
    this.dodgeCd -= dt;
    if (this.backT > 0) { this.backT -= dt; if (this.backT <= 0) inp.setVirtual('back', false); return; }
    if (attacking && p.state !== 'attack' && Math.random() < 0.8) {
      inp.setVirtual('forward', false);
      inp.setVirtual('block', true);
      return;
    }
    if (low && d < 3 && this.nearestEnemy([], 4.5) && Math.random() < 0.02) { inp.setVirtual('block', true); return; }
    inp.setVirtual('block', false);
    const reach = e.isFlying ? 2.6 : 2.2;
    // never chase off a ledge (wraiths hover over pits)
    const ahead = p.pos.clone().add(e.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(0.9));
    if (d > reach && !g.level.collision.hasFooting(ahead, 1.5, g.time.state)) {
      inp.setVirtual('forward', false);
      this.holdSprint(false);
      return;
    }
    if (d > reach) {
      // approach stalled against a tomb/rubble: strafe around it for a moment
      if (d > this.approachBest - 0.25) this.approachStall += dt; else { this.approachBest = d; this.approachStall = 0; }
      if (this.approachStall > 1.4) {
        this.approachStall = 0; this.approachBest = d;
        // strafe only toward solid footing (never off a ledge into a pit)
        const fwd = g.rig.forward(new THREE.Vector3());
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const opts = (['left', 'right'] as const).filter((sd) => g.level.collision.hasFooting(p.pos.clone().addScaledVector(right, sd === 'right' ? 1.4 : -1.4), 1.2, g.time.state));
        if (opts.length) { this.strafeT = 1.0; this.strafeDir = opts[Math.floor(Math.random() * opts.length)]; }
      }
      if (this.strafeT > 0) { this.strafeT -= dt; inp.setVirtual(this.strafeDir, this.strafeT > 0); }
      inp.setVirtual('forward', true);
      this.holdSprint(d > 7);
      return;
    }
    this.approachBest = 99;
    inp.setVirtual('forward', false);
    this.holdSprint(false);
    this.attackT -= dt;
    if (this.attackT <= 0) {
      this.attackT = 0.28;
      this.combo = (this.combo + 1) % 6;
      if (this.combo === 5) inp.tapVirtual('heavy');
      else if (this.combo === 3 && e.isBlocking) inp.tapVirtual('kick');
      else inp.tapVirtual('light');
    }
  }

  /**
   * Shift is tap-to-dodge / hold-to-sprint: a sprint hold released in under SPRINT_HOLD reads as a dodge.
   * Keep any sprint hold for at least 0.35 s so the bot's run toggling never becomes accidental dodges.
   */
  private sprintSince = -1;
  private approachBest = 99;
  private approachStall = 0;
  private strafeT = 0;
  private strafeDir: 'left' | 'right' = 'left';
  private holdSprint(on: boolean) {
    const inp = this.game.input;
    if (on) { if (!inp.isDown('sprint')) this.sprintSince = inp.now; inp.setVirtual('sprint', true); return; }
    if (inp.isDown('sprint') && inp.now - this.sprintSince < 0.35) return;
    inp.setVirtual('sprint', false);
  }

  /** Boss pattern: respect committed swings (dodge/guard), punish recoveries, heavy attacks as punishes. */
  private bossTick(e: any, d: number, dt: number) {
    const g = this.game, inp = g.input, p = g.player;
    this.dodgeCd -= dt;
    this.holdSprint(false);
    const swinging = (e.state === 'attack' || e.state === 'lunge') && e.attack && e.cur && e.cur.time < e.attack.window[1] + 0.05;
    const reach = (e.attack?.range ?? 3) + 1.2;
    if (this.backT > 0) { this.backT -= dt; if (this.backT <= 0) inp.setVirtual('back', false); return; }
    if (swinging && d < reach) {
      inp.setVirtual('forward', false);
      const t = e.cur.time, w0 = e.attack.window[0];
      if (t > w0 - 0.4 && t < w0 && this.dodgeCd <= 0 && p.state !== 'attack') {
        this.dodgeCd = 0.9;
        inp.setVirtual('block', false);
        inp.setVirtual('back', true);
        inp.setVirtual('sprint', false);
        inp.tapVirtual('sprint');
        this.backT = 0.25;
      } else if (p.state !== 'attack') inp.setVirtual('block', true);
      return;
    }
    inp.setVirtual('block', false);
    const opening = e.state === 'recover' || e.state === 'hit' || (e.state === 'attack' && e.cur && e.attack && e.cur.time > e.attack.window[1] + 0.1);
    if (opening || d > 5) {
      if (d > 2.4) { inp.setVirtual('forward', true); this.holdSprint(d > 7); return; }
      inp.setVirtual('forward', false);
      this.attackT -= dt;
      if (this.attackT <= 0) { this.attackT = 0.3; this.combo = (this.combo + 1) % 4; inp.tapVirtual(this.combo === 3 ? 'heavy' : 'light'); }
      return;
    }
    // hold a respectful distance while it winds up
    inp.setVirtual('forward', d > 4.2);
    inp.setVirtual('back', d < 2.8);
  }

  private next() {
    const cur = this.route[this.i];
    if (cur && 'go' in cur) this.lastReached = B(...cur.go);
    this.detour = [];
    this.stuckCount = 0;
    this.i++;
    this.stepT = 0;
    this.stuckT = 0;
    this.shiftTries = 0;
  }

  private fail(msg: string) {
    this.failed = msg;
    this.release();
    this.note('FAIL: ' + msg);
  }
}
