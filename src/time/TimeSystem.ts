import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';
import type { Level } from '../levels/Level';
import type { Player } from '../character/Player';

export const PER_SHIFT = 100;
export const CAPACITY = 200;
export const SHIFT_COOLDOWN = 1.2;

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
    if (this.charge < PER_SHIFT) return { ok: false, reason: 'Not enough resonance. Defeat Echoes to gather more.' };
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
