import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';
import type { Level } from '../levels/Level';
import type { Player } from '../character/Player';

export const PER_SHIFT = 100;
export const CAPACITY = 200;
export const SHIFT_COOLDOWN = 1.2;
/**
 * Passive Resonance (session 11). Outside combat the castle's pull on her blood refills the gauge slowly, so nobody
 * has to hunt Echoes just to try the other memory — but only up to one shift's worth: kills (+25–200), hits (+2) and
 * parries (+12) stay the fast source and the only way to bank a second shift. Paused while any live Echo of her fight
 * is within 22 m (EnemyManager.inCombat) and for PASSIVE_DELAY after combat or a shift, then eases in over 2 s.
 * 1.6/s = an empty gauge holds a shift again after ≈ 66 s of calm; a shift right after another still needs a fight.
 */
export const PASSIVE_RATE = 1.6;
export const PASSIVE_CAP = PER_SHIFT;
export const PASSIVE_DELAY = 4;

export type ShiftVerdict = { ok: true; correction: THREE.Vector3 } | { ok: false; reason: string };

/**
 * Temporal charge + shift validation + the environment transition.
 * Charge is earned by combat (see EnemyManager rewards); a shift costs PER_SHIFT and is only committed
 * after the 2.4 s channel completes AND the destination is valid.
 */
export class TimeSystem {
  state: TimeState = 'PRESENT';
  charge = 0;
  cooldown = 0;
  unlocked = false;
  transition = 0;          // seconds since the last shift (drives the dissolve)
  private transitioning = false;
  private center = new THREE.Vector3();
  shiftCount = 0;
  onShift?: (to: TimeState) => void;
  onGain?: (amount: number, reason: string) => void;

  constructor(private level: Level) {}

  get other(): TimeState { return this.state === 'PAST' ? 'PRESENT' : 'PAST'; }
  get ready() { return this.unlocked && this.charge >= PER_SHIFT && this.cooldown <= 0; }

  gain(amount: number, reason = 'combat') {
    const before = this.charge;
    this.charge = Math.min(CAPACITY, this.charge + amount);
    if (this.charge > before) this.onGain?.(this.charge - before, reason);
  }

  /** seconds of calm (no combat, no shift) — drives the passive refill */
  calm = 0;
  /** refilling passively right now (the HUD's gauge shimmers) */
  trickling = false;
  /** Passive Resonance: see PASSIVE_RATE. `combat` = a live fight is on her (EnemyManager.inCombat). */
  passive(dt: number, combat: boolean) {
    this.trickling = false;
    if (combat || !this.unlocked) { this.calm = 0; return; }
    this.calm += dt;
    if (this.calm < PASSIVE_DELAY || this.charge >= PASSIVE_CAP) return;
    const ease = Math.min(1, (this.calm - PASSIVE_DELAY) / 2);
    this.charge = Math.min(PASSIVE_CAP, this.charge + PASSIVE_RATE * ease * dt);
    this.trickling = true;
  }

  /**
   * Destination validity in the other state:
   * 1) capsule overlap in the target BVH — small depenetration (≤ 0.45 m) is accepted as a correction;
   * 2) footing within 8 m below that is not a void volume.
   */
  validate(player: Player, target: TimeState = this.other): ShiftVerdict {
    const world = this.level.collision;
    if (world.capsuleBuried(player.pos, player.height, target)) return { ok: false, reason: 'Stone stands there in that memory.' };
    const probe = player.pos.clone();
    const before = probe.clone();
    // depenetrate (resolveCapsule mutates probe)
    world.resolveCapsule(probe, player.radius, player.height, target);
    world.resolveCapsule(probe, player.radius, player.height, target);
    const corr = probe.clone().sub(before);
    if (corr.length() > 0.45) return { ok: false, reason: 'Stone stands there in that memory.' };
    if (world.overlap(probe, player.radius * 0.96, player.height, target) > 0.03) return { ok: false, reason: 'Stone stands there in that memory.' };
    if (!world.hasFooting(probe, 8, target)) return { ok: false, reason: 'No footing there in that memory.' };
    return { ok: true, correction: corr };
  }

  canBegin(player: Player): { ok: boolean; reason?: string } {
    if (!this.unlocked) return { ok: false, reason: 'Your blood has not yet woken to the castle.' };
    if (this.cooldown > 0) return { ok: false, reason: 'The castle has not settled.' };
    if (this.charge < PER_SHIFT) return { ok: false, reason: 'Not enough resonance. Defeat Echoes — or give the castle time: its pull returns slowly.' };
    const v = this.validate(player);
    if (!v.ok) return { ok: false, reason: v.reason };
    return { ok: true };
  }

  /** Called when the channel completes. Returns false (no cost) if the destination became invalid. */
  commit(player: Player): ShiftVerdict {
    const v = this.validate(player);
    if (!v.ok) return v;
    this.charge -= PER_SHIFT;
    player.pos.add(v.correction);
    this.setState(this.other, player.pos);
    this.cooldown = SHIFT_COOLDOWN;
    this.shiftCount++;
    this.calm = 0;
    return v;
  }

  /** Immediate state set (checkpoint restore, debug) with the radial transition from `at`. */
  setState(to: TimeState, at: THREE.Vector3, animate = true) {
    const from = this.state;
    this.state = to;
    this.level.applyState(to);
    if (animate && from !== to) {
      this.center.copy(at);
      this.transition = 0;
      this.transitioning = true;
      // incoming geometry grows from the player; outgoing geometry erodes outward
      this.level.showBothForTransition(true);
      const mats = this.level.mats;
      mats.shift[to].uShiftMode.value = 1;
      mats.shift[from].uShiftMode.value = 2;
      mats.shift[to].uShiftCenter.value.copy(at);
      mats.shift[from].uShiftCenter.value.copy(at);
    }
    this.onShift?.(to);
  }

  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.transitioning) return;
    this.transition += dt;
    const mats = this.level.mats;
    const r = this.transition * 55 + this.transition * this.transition * 30;
    mats.shift[this.state].uShiftRadius.value = r;
    mats.shift[this.other].uShiftRadius.value = r;
    if (r > 140) {
      this.transitioning = false;
      mats.shift.PAST.uShiftMode.value = 0;
      mats.shift.PRESENT.uShiftMode.value = 0;
      this.level.showBothForTransition(false);
      this.level.applyState(this.state);
    }
  }
}
