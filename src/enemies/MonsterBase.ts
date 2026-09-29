import * as THREE from 'three';
import { Enemy, type EnemyCtx } from './Enemy';
import type { Archetype, EnemyAttack } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';

/** The shared body of the monsters with brains of their own (enemies/Monsters.ts, enemies/Maw.ts). */
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export abstract class Monster extends Enemy {
  constructor(arch: Archetype, model: THREE.Object3D, clips: THREE.AnimationClip[], encounter: string, owner: TimeState | 'BOTH', wave: number,
    opts: Enemy['opts'], protected g: Game) {
    super(arch, model, clips, encounter, owner, wave, opts);
  }
  protected get fxm() { return this.g.enemies.monsterFx!; }
  protected sound(id: string, vol = 1, rate = 1) { this.g.audio.play(id as never, { pos: this.center.clone(), vol, rate, jitter: 0.08 }); }
  /** a timed blow of this monster lands on the hero if she is inside reach / arc / height (then parry, block, hit) */
  protected strike(atk: EnemyAttack, ctx: EnemyCtx, reachScale = 1) {
    const to = _v.subVectors(ctx.playerPos, this.pos);
    const dy = to.y; to.y = 0;
    const d = to.length();
    const ang = THREE.MathUtils.radToDeg(this.facing.angleTo(to.normalize()));
    if (d <= atk.range * reachScale + this.radius * 0.5 + 0.3 && (atk.arc >= 360 || ang <= atk.arc / 2) && Math.abs(dy) < 1.9) { ctx.onAttackHit(this, atk); return true; }
    return false;
  }
  protected clearTo(ctx: EnemyCtx, dist: number, dirP: THREE.Vector3) {
    const o = this.pos.clone().setY(this.pos.y + 0.5);
    if (ctx.world.raycast(o, dirP, dist, ctx.state)) return false;
    return ctx.world.hasFooting(ctx.playerPos.clone().setY(ctx.playerPos.y + 1), 2, ctx.state) && !ctx.world.inVoid(ctx.playerPos.clone().setY(ctx.playerPos.y - 0.3), ctx.state);
  }
  protected tangent(dirP: THREE.Vector3, sign = 1) { return new THREE.Vector3().crossVectors(UP, dirP).multiplyScalar(sign); }

  /**
   * Procedural bones: those the clip animates are re-posed by the mixer every frame, the others must be put back to
   * their rest rotation before an offset is layered on (or the offsets would accumulate frame after frame).
   */
  private restQ = new Map<THREE.Object3D, THREE.Quaternion>();
  protected trackBones(bones: THREE.Object3D[], clips: THREE.AnimationClip[]) {
    const animated = new Set<string>();
    for (const c of clips) for (const t of c.tracks) if (t.name.endsWith('.quaternion')) animated.add(t.name.slice(0, t.name.lastIndexOf('.')));
    for (const b of bones) if (!animated.has(b.name)) this.restQ.set(b, b.quaternion.clone());
  }
  /** rotate `bone` by `angle` about the WORLD vertical (the swing of a leg, the wave of a tail) */
  protected swingBone(bone: THREE.Object3D, angle: number) {
    const rest = this.restQ.get(bone);
    if (rest) bone.quaternion.copy(rest);
    _q.setFromAxisAngle(UP, angle);
    bone.parent!.getWorldQuaternion(_q2);
    bone.quaternion.premultiply(_q2.clone().invert().multiply(_q).multiply(_q2));
  }
}
