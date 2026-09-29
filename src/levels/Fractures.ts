import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { AttackKind } from '../combat/CombatData';
import type { Marker } from './Level';

/**
 * Resonant fractures (Floor 2 rule): a glowing flaw on a Past structure. A heavy blow (or a kick, per marker)
 * breaks it: the structure falls in front of the player in the Past, and the Present "has always" been that
 * way (conditional geometry `STATE|FLAG` / `STATE|!FLAG`, see Level.setFlag). Flags are permanent.
 */
const HEAVY: AttackKind[] = ['heavy', 'finisher', 'sprint', 'air'];
const KICK: AttackKind[] = ['kick', 'bash'];

interface Falling { groups: THREE.Group[]; t: number; dur: number; drop: number; fr: FractureSpec }
interface FractureSpec { m: Marker; box: THREE.Box3; flag: string; attack: 'heavy' | 'kick'; fall: number; impact: THREE.Box3 | null; hinted: boolean; weakHinted: boolean }

export class Fractures {
  list: FractureSpec[];
  private falling: Falling | null = null;

  constructor(private g: Game) {
    this.list = g.level.markersOf('fracture').map((m) => {
      const imp = m.props.impact as number[] | undefined;
      let impact: THREE.Box3 | null = null;
      if (imp && imp.length === 6) {
        // Blender (x0, x1, y0, y1, z0, z1) → three.js box
        impact = new THREE.Box3(new THREE.Vector3(imp[0], imp[4], -imp[3]), new THREE.Vector3(imp[1], imp[5], -imp[2]));
      }
      return {
        m, box: m.box!.clone().expandByScalar(0.45), flag: m.props.flag, attack: m.props.attack === 'kick' ? 'kick' : 'heavy',
        fall: m.props.fall ?? 0, impact, hinted: false, weakHinted: false,
      } as FractureSpec;
    });
  }

  update(dt: number) {
    const g = this.g, p = g.player;
    if (this.falling) this.animate(dt);
    if (g.time.state !== 'PAST' || !p.alive) return;
    for (const fr of this.list) {
      if (g.level.flags.has(fr.flag)) continue;
      const near = fr.box.distanceToPoint(p.pos) < 4.5;
      if (near && !fr.hinted && fr.m.props.text) { fr.hinted = true; g.hud.prompt(fr.m.props.text, 6); }
      if (!near || p.state !== 'attack' || !p.attack || !p.activeHits().length) continue;
      const front = p.pos.clone().addScaledVector(p.facing, 1.1).setY(p.pos.y + 1.1);
      const struck = fr.box.containsPoint(p.blade.tip) || fr.box.containsPoint(p.blade.hilt) || fr.box.containsPoint(front);
      if (!struck) continue;
      const ok = fr.attack === 'kick' ? KICK.includes(p.attack.kind) : HEAVY.includes(p.attack.kind);
      if (!ok) {
        if (!fr.weakHinted) { fr.weakHinted = true; g.hud.prompt(fr.attack === 'kick' ? 'It needs a kick.' : 'The fracture shivers. It needs a heavier blow.', 3); g.audio.hitEnemy('blocked', 10, front); }
        continue;
      }
      this.breakFracture(fr, front);
    }
  }

  private breakFracture(fr: FractureSpec, at: THREE.Vector3) {
    const g = this.g;
    g.audio.hitEnemy('blocked', 40, at);
    g.audio.play('armor_crash', { pos: at, rate: 0.7 });
    g.fx.sparks(at, 30, 0xffd8a0);
    g.fx.hitstop(0.1);
    g.rig.addShake(0.25);
    const groups = g.level.flagGroups(fr.flag, true).filter((grp) => grp.userData.group === 'PAST');
    if (fr.fall > 0 && groups.length) {
      // the brake gives: everything that hung on it falls, then the world settles into its new shape
      const falling = groups.filter((grp) => /chandel|R1_ROYAL/.test(grp.name));
      this.falling = { groups: falling, t: 0, dur: Math.sqrt((2 * fr.fall) / 24), drop: fr.fall, fr };
    } else this.settle(fr);
  }

  private animate(dt: number) {
    const f = this.falling!;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    for (const grp of f.groups) grp.position.y = -f.drop * k * k;
    if (k >= 1) {
      for (const grp of f.groups) grp.position.y = 0;
      this.falling = null;
      this.settle(f.fr);
    }
  }

  /** Apply the flag, crush what stood beneath, and throw up the dust. */
  private settle(fr: FractureSpec) {
    const g = this.g;
    g.level.setFlag(fr.flag);
    if (fr.impact) {
      const c = fr.impact.getCenter(new THREE.Vector3());
      for (let i = 0; i < 6; i++) g.fx.dust(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5, 0.2, (Math.random() - 0.5) * 5)), 10);
      g.audio.play('rubble', { pos: c, rate: 0.7, vol: 1.6 });
      g.audio.play('body_fall', { pos: c, rate: 0.55, vol: 1.5 });
      g.rig.addShake(0.5);
      for (const e of g.enemies.enemies) {
        if (!e.alive || (e.owner !== 'PAST' && e.owner !== 'BOTH') || !fr.impact.containsPoint(e.center)) continue;
        const res = e.takeHit(90, 300, 6, c, { knockdown: true });
        if (res === 'dead') g.enemies.onKill(e);
      }
    }
    g.hud.message('THE CASTLE REMEMBERS', 'What falls in the Past stays fallen', 3.5);
  }
}
