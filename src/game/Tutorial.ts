import * as THREE from 'three';
import type { Game } from './Game';
import type { Enemy } from '../enemies/Enemy';
import { Platform } from '../platform/Platform';
import type { Action } from './Input';
import { PER_SHIFT } from '../time/TimeSystem';

/**
 * The Guided Tutorial (session 10; extended in session 13): Floor 1 from the barbican gate to the Blood Sigil at the
 * top of the armory's "half stair" — the first crawl AND the first stair that needs both memories.
 *
 * One lesson at a time — the card says what to do, the game waits until the player has DONE it, the card flashes
 * gold and the next lesson begins: moving → the camera → the way in → light attack → heavy → a combo → guard → parry →
 * (dodge, desktop) → finishing the Echoes → Resonance (what refills it) → the Blood Sigil → the two memories → the
 * first shift (the rusted gate) → the Past → the living guard → shifting back (a barricade) → crouching → the half
 * stair: climb the Present's rubble to the old landing → shift there → climb the Past's stair → kneel at its sigil.
 *
 * Action lessons never time out: their card stays while the lesson is relevant, steps aside in a fight, and comes
 * back where it applies. Cards for the time shift say what is missing when it cannot happen yet (Resonance, the right
 * place, the right memory). While the two Hollows of E1 are the teachers they cannot die and wait their turn
 * (Enemy.tutorialPassive / minHp) and the hero cannot fall below a third of her health; brief slow motion gives time
 * to read and react (a near-freeze until the first strike, slow blows while learning to guard and parry).
 *
 * Minimal Guidance never creates this: the objective line, the gold guide marker, the shift rings and the short
 * contextual cards (game/Objectives.ts: fight, sigil, shift, shift back, crouch, the half stair) make sure nobody is
 * ever lost.
 */
type Btn = Action | null;
type Text = string | (() => string);
interface Lesson {
  id: string;
  title: string;
  kbm: Text;
  touch?: Text;
  btn?: Btn | (() => Btn);
  /** show the card only while this holds (default: always) */
  when?: () => boolean;
  /** the lesson is complete */
  done: () => boolean;
  /** skip without teaching (the player is already past this point) */
  skip?: () => boolean;
  enter?: () => void;
  /** per-frame (real dt) — slow motion, enemy behaviour */
  tick?: (dt: number) => void;
  /** a lesson with no action: complete after this many seconds on screen */
  read?: number;
}

/** attacks only reachable by chaining (the second+ blow of a combo, the route-B cuts, heavy endings) */
const CHAINED = new Set(['L3', 'L4', 'L5', 'B2', 'B3', 'B4', 'F1', 'F1c', 'F2', 'F3', 'F4', 'F5', 'H2', 'H3', 'RIPOSTE']);

export class Tutorial {
  active = true;
  /** the tutorial owns the HUD's teaching card (Objectives stays quiet) */
  get ownsCard() { return this.active; }
  private lessons: Lesson[];
  private i = -1;
  private t = 0;
  private shownT = 0;
  private flashT = 0;
  private offs: (() => void)[] = [];
  private hitsBy = { light: 0, heavy: 0, chained: 0 };
  private blocks = 0;
  private parries = 0;
  private guardTries = 0;
  private dodged = false;
  private firstKill = false;
  private e1: Enemy[] = [];
  private scale = 1;
  private wantScale = 1;
  private cue = '';
  /** the hero is protected (cannot fall below 1/3 health) while the E1 lessons run */
  protect = false;

  constructor(private g: Game) {
    const touch = () => Platform.isTouch;
    const e1 = () => g.enemies.encounters.get('E1');
    const inE1Lessons = () => !!e1()?.triggered && !e1()?.cleared;
    const zone = (x0: number, x1: number, y0: number, y1: number, z0 = -1, z1 = 4) => {
      const p = g.player.pos; const bx = p.x, by = -p.z, bz = p.y;
      return bx >= x0 && bx <= x1 && by >= y0 && by <= y1 && bz >= z0 && bz <= z1;
    };
    const past = () => g.time.state === 'PAST';
    const charged = () => g.time.charge >= PER_SHIFT;
    const hold = () => (touch() ? 'hold the blue SHIFT seal' : 'hold R');
    const calm = () => !g.enemies.inCombat;
    // ---- places (blueprint coordinates, docs/LEVEL_01_BLUEPRINT.md)
    const gateLane = () => zone(-3.2, 3.2, -46, -30.5);
    const ward = () => zone(-22, 22, -29, 7, -1, 7);
    const wardEast = () => zone(-1, 24, -26, -4, -1, 5);
    const armory = () => zone(20, 34, 10.5, 27, -1, 9);
    const onPad = () => zone(19.9, 22.7, 16.6, 19.7, 2.3, 4.6);
    const onRamp = () => zone(19.9, 22.7, 12, 16.6, 0.9, 3.4);
    const onPastStair = () => past() && zone(19.9, 22.7, 11.8, 27, 0.6, 7);
    const atTop = () => zone(17, 23, 23.5, 27.5, 5, 8);
    const cp3 = () => g.checkpoints.activated.has('CP3');
    const beyondStair = () => zone(-18, 18, 9, 30, 5, 9) || cp3() && !atTop();
    this.offs.push(g.signals.on('kill', () => { if (!this.firstKill && inE1Lessons()) this.firstKill = true; }));
    const onBlock = g.player.events.onBlock;
    g.player.events.onBlock = (parry) => { onBlock?.(parry); if (parry) this.parries++; else this.blocks++; };
    this.restoreBlock = () => { g.player.events.onBlock = onBlock; };

    this.lessons = [
      {
        id: 'move', title: 'MOVE', kbm: 'W A S D to walk · hold Shift to run.', touch: 'Drag your left thumb to walk — push it to the rim to run.',
        done: () => this.moved > 5, skip: () => !!e1()?.triggered,
        enter: () => { this.moved = 0; },
      },
      {
        id: 'look', title: 'LOOK AROUND', kbm: 'Move the mouse to turn the camera.', touch: 'Drag the right side of the screen to turn the camera.',
        done: () => this.looked > 1.6, skip: () => !!e1()?.triggered,
        enter: () => { this.looked = 0; },
      },
      {
        id: 'breach', title: 'THE WAY IN',
        kbm: 'Go through the gatehouse ahead. Its inner gate is rusted shut — look for another way into the keep. The gold marker shows the way.',
        done: () => !!e1()?.triggered || zone(4, 16, -45, -32), read: 9,
      },
      {
        id: 'light', title: 'LIGHT ATTACK', kbm: 'Left-click to strike. Land three blows.', touch: 'Tap ATTACK to strike — your blade finds the nearest foe. Land three blows.', btn: 'light',
        done: () => this.hitsBy.light >= 3, skip: () => !!e1()?.cleared,
        enter: () => this.teachers(true),
        tick: () => {
          // the first Echo steps into reach: the world all but stops until the first blow is thrown
          if (this.hitsBy.light === 0 && this.g.player.state !== 'attack' && this.nearest(3.4)) { this.wantScale = 0.07; this.cue = 'STRIKE'; }
          else this.wantScale = 1;
        },
      },
      {
        id: 'heavy', title: 'HEAVY ATTACK', kbm: 'Right-click for a heavy blow — slower, but it staggers and breaks a raised guard.', touch: 'Tap HEAVY for a heavy blow — slower, but it staggers and breaks a raised guard.', btn: 'heavy',
        done: () => this.hitsBy.heavy >= 1, skip: () => !!e1()?.cleared,
      },
      {
        id: 'combo', title: 'COMBO', kbm: 'Keep striking as each blow lands — the cuts flow into a chain of up to five. End a chain with a heavy blow for a finisher.',
        touch: 'Keep tapping ATTACK as each blow lands — the cuts flow into a chain of up to five. End a chain with HEAVY for a finisher.', btn: 'light',
        done: () => this.hitsBy.chained >= 1, skip: () => !!e1()?.cleared,
      },
      {
        id: 'guard', title: 'GUARD', kbm: 'The Echo will strike now. Hold Q to raise your guard against blows from the front.', touch: 'The Echo will strike now. Hold GUARD to raise your sword against blows from the front.', btn: 'block',
        done: () => this.blocks + this.parries >= 1, skip: () => !!e1()?.cleared,
        enter: () => { this.teachers(true, 1); this.guardTries = 0; },
        tick: () => this.slowBlows(0.28, false),
      },
      {
        id: 'parry', title: 'PARRY', kbm: 'Tap Q just as the blow lands — not before. A parry staggers the Echo and feeds your Resonance; strike at once for a riposte.',
        touch: 'Tap GUARD just as the blow lands — not before. A parry staggers the Echo and feeds your Resonance; strike at once for a riposte.', btn: 'block',
        done: () => this.parries >= 1 || this.guardTries >= 5 || this.t > 40, skip: () => !!e1()?.cleared,
        enter: () => { this.guardTries = 0; },
        tick: () => this.slowBlows(0.3, true),
      },
      {
        id: 'dodge', title: 'DODGE', kbm: 'Tap Shift to slip out of a blow — toward where you are moving.',
        done: () => this.dodged || this.t > 12, skip: () => touch() || !!e1()?.cleared,
        enter: () => { this.dodged = false; },
      },
      {
        id: 'finish', title: 'DESTROY THE ECHOES', kbm: 'You have the blade now. Finish them.', read: 0,
        done: () => this.firstKill || !!e1()?.cleared, skip: () => !!e1()?.cleared && this.firstKill,
        enter: () => this.teachers(false),
      },
      {
        id: 'resonance', title: 'RESONANCE',
        kbm: 'Every Echo you destroy releases Resonance into your blood — the bar under your health fills. Hits and parries add a little. One full segment lets you shift the castle once.',
        done: () => this.t > 8 && !!e1()?.cleared, read: 8,
        enter: () => { this.g.hud.teachBar(true); this.slowBeat(1.1, 0.22); },
      },
      {
        id: 'sigil', title: 'BLOOD SIGIL', kbm: 'Kneel at the Blood Sigil: press E on it. Sigils are checkpoints — fall, and you wake at the last one you knelt at.',
        touch: 'Kneel at the Blood Sigil: walk onto it and tap the red ACTIVATE button that appears over it. Sigils are checkpoints — fall, and you wake at the last one you knelt at.',
        done: () => this.g.checkpoints.activated.has('CP1'),
        enter: () => this.g.hud.teachBar(false),
      },
      {
        id: 'memories', title: 'TWO MEMORIES', kbm: 'Caer Veyr remembers itself twice: the PRESENT, its ruin — and the PAST, the keep as it stood. Your blood can force it from one to the other, right where you stand.',
        when: () => this.t > 3.2,
        done: () => this.t > 12 || this.g.time.shiftCount > 0, read: 12,
      },
      {
        id: 'shift', title: 'TIME SHIFT',
        kbm: () => this.firstShiftText(gateLane(), charged(), hold()),
        btn: () => (gateLane() && charged() ? 'shift' : null),
        done: () => this.g.time.shiftCount > 0,
      },
      {
        id: 'past', title: 'THE PAST', kbm: 'The keep as it stood: whole, torch-lit, and guarded by the living. What is closed in one memory may lie open in the other. Each shift spends one segment of Resonance — fight to earn it back.',
        done: () => this.t > 10 || !!this.g.enemies.encounters.get('E2')?.triggered && this.t > 5, read: 10,
        skip: () => this.g.time.shiftCount >= 2,
        enter: () => this.slowBeat(1.0, 0.3),
      },
      {
        id: 'guards', title: 'THE LIVING GUARD', kbm: 'Royal guards raise their shields. A heavy blow or a kick (F) breaks a raised guard.', touch: 'Royal guards raise their guard. HEAVY or GUARD + HEAVY (kick) breaks it.',
        when: () => this.blockingGuard(), done: () => this.t > 7 && !this.blockingGuard() || !!this.g.enemies.encounters.get('E3')?.cleared,
        skip: () => !!this.g.enemies.encounters.get('E3')?.cleared || this.g.time.shiftCount >= 2 || zone(24, 38, -27, -1, -1, 6),
      },
      {
        id: 'back', title: 'BLOCKED IN THIS MEMORY',
        kbm: () => this.shiftBackText(wardEast(), charged(), hold()),
        btn: () => (wardEast() && charged() ? 'shift' : null),
        when: () => past() && ward() && calm(),
        done: () => !past() && this.g.time.shiftCount >= 2,
        skip: () => zone(24, 38, -27, -1, -1, 6) || zone(20, 34, -1.5, 27, -1, 3),
      },
      {
        id: 'crouch', title: 'CROUCH', kbm: 'The vault has fallen here. Press C to crouch and walk through the low gap — press C again to stand.',
        touch: 'The vault has fallen here. Walk into the low gap — you stoop through it on your own.',
        when: () => zone(27.5, 34, -1.5, 8.5, -1, 3),
        // through the crawl — or in the armory by any way at all (the half stair must never wait on this card)
        done: () => zone(26, 36, 7.8, 16, -1, 3) || armory(),
        skip: () => zone(20, 34, 10.5, 27, 1.5, 9) || onPastStair() || atTop(),
      },
      // ---- the half stair (G3): the first way on that needs BOTH memories, one after the other
      {
        id: 'halfstair', title: 'A HALF STAIR',
        kbm: 'Look at the stair by the west wall: in this memory its upper flight has fallen — but the rubble still climbs to where its landing stood. Climb the rubble.',
        when: () => armory() && calm() && !past(),
        done: () => onPad(),
        skip: () => onPastStair() || atTop() || cp3() || beyondStair(),
      },
      {
        id: 'stairshift', title: 'THE STAIR REMEMBERS',
        kbm: () => this.stairShiftText(onPad(), onRamp(), past(), charged(), hold()),
        btn: () => (!past() && (onPad() || onRamp()) && charged() ? 'shift' : null),
        when: () => (armory() || onPastStair()) && calm(),
        done: () => onPastStair() && this.g.time.state === 'PAST',
        skip: () => atTop() || cp3() || beyondStair(),
      },
      {
        id: 'climb', title: 'CLIMB',
        kbm: 'The whole stair stands in this memory. Climb it to the landing above.',
        when: () => armory() || onPastStair(),
        done: () => atTop(),
        skip: () => cp3() || beyondStair(),
        enter: () => this.slowBeat(0.8, 0.35),
      },
      {
        id: 'cp3', title: 'BLOOD SIGIL', kbm: 'Kneel at the sigil on the landing (E). The castle will remember you here — above the stair you needed both memories to climb.',
        touch: 'Kneel at the sigil on the landing: tap ACTIVATE over it. The castle will remember you here — above the stair you needed both memories to climb.',
        when: () => atTop(),
        done: () => cp3(),
        skip: () => beyondStair() && !atTop(),
      },
      {
        id: 'end', title: 'YOU CAN READ THE CASTLE',
        kbm: 'When a way is closed, look at what closes it — rust, a barricade, a fallen stair — and ask the other memory. The objective line and the gold marker still point the way.',
        read: 10, done: () => this.t > 10,
      },
    ];
  }

  /** the first shift (G1): say what is missing, and why this gate */
  private firstShiftText(inLane: boolean, charged: boolean, hold: string) {
    if (!charged) return 'A shift needs one full segment of Resonance. Destroy Echoes to fill it — or wait a few moments: the castle\'s pull returns.';
    if (!inLane) return 'Go back to the rusted gate in the passage. It is shut in this memory — in the castle\'s memory of itself it stood open.';
    return `Stand before the gate, in the blue ring, and ${hold} until the castle turns. Let go — or take a heavy blow — and the shift breaks.`;
  }

  /** G2: the Past's barricade — shift back where the ground is whole */
  private shiftBackText(atEast: boolean, charged: boolean, hold: string) {
    if (!charged) return 'The barracks door (east wall) is barricaded from inside in this memory. Your Resonance is spent: destroy Echoes in the yard to refill it, then shift back.';
    if (!atEast) return 'The barracks door (east wall) is barricaded from inside in this memory — in the Present it lies broken in. Go to the east half of the yard, onto whole ground, and shift back.';
    return `The barracks door is barricaded in this memory — in the Present it lies broken in. ${hold[0].toUpperCase()}${hold.slice(1)} here to return to the Present.`;
  }

  /** G3: climb in the Present, shift on the old landing, climb in the Past */
  private stairShiftText(pad: boolean, ramp: boolean, inPast: boolean, charged: boolean, hold: string) {
    if (inPast) return 'In this memory the stair\'s gate is locked and there is no rubble to climb. Shift back to the Present, climb the rubble to the old landing, and shift there.';
    if (!pad && !ramp) return 'Climb the rubble up to the old landing, then shift there — in the Past the stair above it still stands.';
    if (!charged) return 'You need a full segment of Resonance to shift. Destroy Echoes — or wait a few moments: the castle\'s pull returns.';
    return `You stand where the stair's landing was. In the Past the stair above still stands: ${hold} here, and climb on in that memory.`;
  }

  private restoreBlock: () => void = () => undefined;
  private moved = 0;
  private looked = 0;
  private lastPos = new THREE.Vector3();
  private lastPlayerHits = 0;
  private lastLooked = 0;
  private e1Held = false;

  dispose() {
    this.active = false;
    for (const o of this.offs) o();
    this.offs = [];
    this.restoreBlock();
    this.teachers(false);
    this.g.timeScale = 1;
    this.g.hud.teachBar(false);
    this.g.hud.tutorial(null);
    this.g.hud.setFreeze(false);
    this.g.touch?.highlight(null);
    this.g.player.parryScale = 1;
    this.protect = false;
  }

  /** E1's Hollows become (or stop being) the teachers: they cannot die; `attackers` of them may strike. */
  private teachers(on: boolean, attackers = 0) {
    const enc = this.g.enemies.encounters.get('E1');
    if (!enc) return;
    this.e1 = enc.enemies;
    let n = 0;
    for (const e of this.e1) {
      if (!e.alive) continue;
      e.minHp = on ? 1 : 0;
      e.tutorialPassive = on && !(n++ < attackers);
    }
    this.protect = on;
  }

  private nearest(range: number) {
    const p = this.g.player.pos;
    let best: Enemy | null = null, bd = range;
    for (const e of this.e1) if (e.alive && e.pos.distanceTo(p) < bd) { best = e; bd = e.pos.distanceTo(p); }
    return best;
  }

  /** guard / parry lessons: an Echo's blow about to land plays in slow motion; the parry window widens with it */
  private slowBlows(scale: number, parry: boolean) {
    let soon = Infinity;
    for (const e of this.e1) if (e.alive && e.state === 'attack') soon = Math.min(soon, e.strikeIn());
    const p = this.g.player;
    if (soon < 0.55) {
      this.wantScale = scale;
      if (parry) this.cue = soon < 0.17 ? 'NOW' : 'WAIT…';
      else this.cue = p.state === 'block' ? 'HOLD IT' : 'GUARD';
      if (!this.striking) { this.striking = true; this.guardTries++; }
    } else { this.wantScale = 1; this.striking = false; }
    p.parryScale = parry ? 2.4 : 1;
  }
  private striking = false;

  /** a slow breath to read a moment (the first Echo released, arriving in the Past) */
  private slowBeat(seconds: number, scale: number) { this.beatT = seconds; this.beatScale = scale; }
  private beatT = 0;
  private beatScale = 1;

  private blockingGuard() {
    const p = this.g.player.pos;
    for (const e of this.g.enemies.enemies) if (e.alive && e.state === 'block' && e.pos.distanceTo(p) < 4) { this.sawBlock = this.t; return true; }
    return this.t - this.sawBlock < 5 && this.sawBlock > 0;
  }
  private sawBlock = 0;

  update(dt: number) {
    if (!this.active) return;
    const g = this.g, p = g.player;
    // what the player did this frame
    const hits = g.enemies.playerHits - this.lastPlayerHits;
    this.lastPlayerHits = g.enemies.playerHits;
    if (hits > 0 && p.attack) {
      if (p.attack.kind === 'light') this.hitsBy.light += hits;
      if (p.attack.kind === 'heavy' || p.attack.kind === 'finisher') this.hitsBy.heavy += hits;
      if (CHAINED.has(p.attack.id)) this.hitsBy.chained += hits;
    }
    if (p.state === 'dodge') this.dodged = true;
    const step = p.pos.distanceTo(this.lastPos);
    if (step < 2) this.moved += step;
    this.lastPos.copy(p.pos);
    this.looked += Math.max(0, g.learned.looked - this.lastLooked);
    this.lastLooked = g.learned.looked;
    // the two Hollows of E1 are the teachers from the moment they wake (until the 'finish' lesson releases them)
    if (!this.e1Held && g.enemies.encounters.get('E1')?.triggered) { this.e1Held = true; this.teachers(true); }
    if (this.protect && p.alive) p.hp = Math.max(p.hp, p.maxHp / 3);

    // advance
    if (this.i < 0) this.next();
    let L = this.lessons[this.i];
    this.t += dt;
    this.wantScale = 1;
    this.cue = '';
    // overtaken by the player (a different order, a skipped fight): move on without ceremony
    while (L && this.flashT <= 0 && this.t > 0.2 && L.skip?.()) { this.next(); L = this.lessons[this.i]; }
    if (L && this.flashT <= 0) {
      L.tick?.(dt);
      if (L.done() && this.t >= (L.read ?? 0) * 0.5) { this.flashT = 0.7; g.hud.lessonDone(); g.audio.ui('select'); }
    }
    if (this.flashT > 0 && (this.flashT -= dt) <= 0) { this.next(); L = this.lessons[this.i]; }
    if (!L) { this.dispose(); return; }

    // slow motion (eased; a beat overrides)
    if (this.beatT > 0) { this.beatT -= dt; this.wantScale = Math.min(this.wantScale, this.beatScale); }
    const k = this.wantScale < this.scale ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 5);
    this.scale += (this.wantScale - this.scale) * k;
    if (Math.abs(this.scale - 1) < 0.01 && this.wantScale === 1) this.scale = 1;
    g.timeScale = !p.alive || g.finisher.active ? 1 : this.scale;
    g.hud.setFreeze(this.scale < 0.6);

    // the card (only while relevant; hidden during a finisher or death)
    const show = p.alive && !g.finisher.active && (!L.when || L.when() || this.flashT > 0);
    if (show) this.shownT += dt;
    const pick = (v?: Text) => (typeof v === 'function' ? v() : v);
    const text = (Platform.isTouch && pick(L.touch)) || pick(L.kbm) || '';
    g.hud.tutorial(show ? L.title : null, text, this.cue);
    const btn = typeof L.btn === 'function' ? L.btn() : L.btn;
    g.touch?.highlight(show && this.flashT <= 0 ? (btn ?? null) : null);
  }

  private next() {
    this.i++;
    while (this.i < this.lessons.length && this.lessons[this.i].skip?.()) this.i++;
    this.t = 0;
    this.shownT = 0;
    this.flashT = 0;
    this.g.player.parryScale = 1;
    const L = this.lessons[this.i];
    if (L) { L.enter?.(); this.g.signals.emit('lesson', { id: L.id }); }
  }

  /** current lesson id (tests) */
  get lesson() { return this.lessons[this.i]?.id ?? null; }
}
