import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { TimeState } from './Materials';
import type { Marker } from './Level';

interface Save { cid: string; pos: THREE.Vector3; yaw: number; state: TimeState; charge: number; }

/**
 * Blood Sigils (checkpoints), Memory Traces and the respawn policy.
 * Policy (blueprint §H.1): activation heals and saves position/state/charge; on death the player
 * respawns at the last sigil with charge = max(saved, 100); uncleared encounters reset, cleared stay dead.
 * CP1's first activation performs the blood rite: time shifting unlocks and charge tops up to 100.
 */
export class Checkpoints {
  activated = new Set<string>();
  save: Save | null = null;
  private sigils: Marker[];
  private traces: Marker[];
  private near: { kind: 'sigil' | 'trace'; m: Marker } | null = null;
  private readTraces = new Set<string>();

  constructor(private g: Game) {
    this.sigils = g.level.markersOf('sigil');
    this.traces = g.level.markersOf('trace');
    if (!this.sigils.length) throw new Error('This floor has no Blood Sigils (checkpoints)');
  }

  update(dt: number) {
    void dt;
    const p = this.g.player.pos;
    this.near = null;
    for (const m of this.sigils) {
      if (m.pos.distanceTo(p) < 2.1 && Math.abs(m.pos.y - p.y) < 1.2) { this.near = { kind: 'sigil', m }; break; }
    }
    if (!this.near) {
      for (const m of this.traces) {
        const st = m.group;
        if (st !== 'SHARED' && st !== this.g.time.state) continue;
        if (m.pos.distanceTo(p.clone().setY(p.y + 1)) < 2.6) { this.near = { kind: 'trace', m }; break; }
      }
    }
    if (this.near?.kind === 'sigil') this.g.hud.interact(this.activated.has(this.near.m.name) && this.save?.cid === this.near.m.name ? 'Rest at the Blood Sigil' : 'Kneel at the Blood Sigil');
    else if (this.near?.kind === 'trace') this.g.hud.interact(this.readTraces.has(this.near.m.name) ? 'Remember' : 'Examine');
    else this.g.hud.interact(null);
  }

  interact(): boolean {
    if (!this.near) return false;
    if (this.near.kind === 'trace') {
      this.readTraces.add(this.near.m.name);
      this.g.audio.memory();
      this.g.hud.prompt(this.near.m.props.text, 7);
      return true;
    }
    this.activate(this.near.m);
    return true;
  }

  activate(m: Marker) {
    const g = this.g;
    const first = !this.activated.has(m.name);
    this.activated.add(m.name);
    g.player.playInteract(1.8);
    g.player.hp = g.player.maxHp;
    g.audio.sigil();
    g.fx.shiftBurst(m.pos, g.time.state);
    if (m.name === 'CP1' && !g.time.unlocked) {
      g.time.unlocked = true;
      g.time.charge = Math.max(g.time.charge, 100);
      g.hud.message('YOUR BLOOD ANSWERS THE CASTLE', 'Hold R to force the castle between its memories', 5);
    } else if (first) {
      g.hud.message('BLOOD SIGIL', 'The castle will remember you here', 2.5);
    }
    this.save = { cid: m.name, pos: m.pos.clone().add(new THREE.Vector3(0, 0.05, 1.2)), yaw: g.player.yaw, state: g.time.state, charge: g.time.charge };
    // make sure the respawn spot is standable in the saved state; otherwise use the sigil centre
    const w = g.level.collision;
    if (w.overlap(this.save.pos, 0.35, 1.8, this.save.state) > 0.05 || !w.hasFooting(this.save.pos, 1, this.save.state)) this.save.pos = m.pos.clone().add(new THREE.Vector3(0, 0.05, 0));
  }

  respawn() {
    const g = this.g;
    const s = this.save;
    g.enemies.resetUncleared();
    if (!s) {
      const sp = g.level.marker('spawn', 'SPAWN');
      g.player.revive(sp.pos, Math.PI);
      if (g.time.state !== 'PRESENT') g.time.setState('PRESENT', sp.pos, false);
      g.enemies.onStateChange(g.time.state);
      g.setEnvironment(g.time.state, true);
      g.hud.setState(g.time.state);
      return;
    }
    g.player.revive(s.pos, s.yaw);
    if (g.time.state !== s.state) {
      g.time.setState(s.state, s.pos, false);
      g.setEnvironment(s.state, true);
      g.hud.setState(s.state);
    }
    g.time.charge = Math.max(s.charge, g.time.unlocked ? 100 : 0);
    g.time.cooldown = 0;
    g.enemies.onStateChange(g.time.state);
    g.rig.snapBehind(s.yaw);
  }
}
