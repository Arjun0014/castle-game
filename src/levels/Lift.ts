import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Marker } from './Level';
import { Platform } from '../platform/Platform';

/**
 * The King's lift (session 9): the way from Floor 2 into Floor 3 — no more walking through an arch into empty sky.
 *
 * Floor 2 (`lift` marker, role "depart", in the conduit shaft of the bell chamber): an iron cage-platform hung from
 * the winch over the glowing shaft. She steps onto it (a dynamic collider carries her), the card reads "THE KING'S
 * LIFT / Descend to the Crownheart"; Interact starts the descent: she takes the chain, the brake lets go, the cage
 * drops into the red dark (camera held at the lip looking down as she sinks, then riding above her into the glow,
 * embers streaming up past), the stone roars, the screen goes to black — and the real loading screen takes over
 * (Game.leaveFloor → the in-place floor transition).
 *
 * Floor 3 (role "arrive", the lift foot): the cage lands. On arrival (not on a checkpoint respawn or a dev warp) a
 * short shot rides down with her the last metres and settles with a thud and dust, then hands the camera back.
 */
const DESCENT = 7.2;

export class Lift {
  private group = new THREE.Group();
  private box = new THREE.Box3();
  private collider: { box: THREE.Box3; state: 'BOTH'; enabled: boolean; name: string } | null = null;
  private t = -1;
  private y0 = 0;
  private cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private mats: THREE.Material[] = [];
  private near = false;
  private arriving = -1;
  private sounds = 0;
  /** the descent is running (the hero is scripted) */
  get active() { return this.t >= 0 || this.arriving >= 0; }

  constructor(private g: Game, private m: Marker) {
    const role = m.props.role;
    this.y0 = m.pos.y;
    if (role === 'depart') this.buildCage();
  }

  private buildCage() {
    const g = this.g, st = g.time.state;
    const iron = g.mats.get('iron', st, 'SHARED'), rust = g.mats.get('iron_rust', st, 'SHARED'), wood = g.mats.get('wood_planks', st, 'SHARED');
    this.mats.push(iron, rust, wood);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh); return mesh;
    };
    // platform 4 x 3.3 m (Blender x 22.5..26.5, y 90.67..94 on Floor 2): plank deck on an iron frame
    const W = 3.9, D = 3.2;
    add(new THREE.BoxGeometry(W, 0.12, D), wood, 0, -0.06, 0);
    add(new THREE.BoxGeometry(W + 0.1, 0.18, 0.16), iron, 0, -0.14, D / 2);
    add(new THREE.BoxGeometry(W + 0.1, 0.18, 0.16), iron, 0, -0.14, -D / 2);
    // corner posts, a waist rail on three sides, chains rising to the winch
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(0.12, 2.6, 0.12), iron, sx * (W / 2 - 0.06), 1.3, sz * (D / 2 - 0.06));
      add(new THREE.BoxGeometry(0.05, 40, 0.05), rust, sx * (W / 2 - 0.3), 22, sz * (D / 2 - 0.3));
    }
    add(new THREE.BoxGeometry(W, 0.08, 0.08), iron, 0, 1.05, -D / 2 + 0.06);
    add(new THREE.BoxGeometry(0.08, 0.08, D), iron, W / 2 - 0.06, 1.05, 0);   // (the west side is open: she steps on from the stair)
    add(new THREE.BoxGeometry(W, 0.14, D), iron, 0, 2.6, 0).scale.set(1, 1, 0.08);
    // the brake lever on its post
    add(new THREE.BoxGeometry(0.1, 1.1, 0.1), iron, W / 2 - 0.4, 0.55, D / 2 - 0.4);
    add(new THREE.BoxGeometry(0.06, 0.06, 0.7), rust, W / 2 - 0.4, 1.1, D / 2 - 0.65).rotation.x = -0.5;
    this.group.position.copy(this.m.pos);
    g.scene.add(this.group);
    const half = new THREE.Vector3(W / 2, 0.15, D / 2);
    this.box.set(this.m.pos.clone().sub(half).setY(this.y0 - 0.3), this.m.pos.clone().add(half).setY(this.y0));
    this.collider = { box: this.box, state: 'BOTH', enabled: true, name: 'lift' };
    g.level.collision.dynamic.push(this.collider);
  }

  /** is she standing on the cage? */
  private onDeck() {
    const p = this.g.player.pos;
    return p.x > this.box.min.x && p.x < this.box.max.x && p.z > this.box.min.z && p.z < this.box.max.z && Math.abs(p.y - this.box.max.y) < 0.5;
  }

  /** Interact (Game.wireEvents): true when the lift took it */
  interact(): boolean {
    if (this.m.props.role !== 'depart' || this.t >= 0 || !this.near) return false;
    const g = this.g;
    if (g.enemies.engagedNear(g.player.pos, 14)) { g.hud.deny('Not with Echoes at your back.'); g.audio.deny(); return true; }
    this.begin();
    return true;
  }

  private begin() {
    const g = this.g, p = g.player;
    this.t = 0;
    g.hud.interact(null);
    p.beginScripted();
    p.pos.set(this.m.pos.x, this.y0 + 0.02, this.m.pos.z + 0.2);
    p.yaw = Math.PI;                        // facing the shaft's far wall (north)
    p.anim.play('idle_alert', { fade: 0.3, loop: true });
    g.rig.cine = this.cam;
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
    g.audio.play('creak', { pos: p.pos.clone(), vol: 1.2, rate: 0.8 });
    g.audio.play('armor_rattle', { pos: p.pos.clone(), rate: 0.7, vol: 1.2 });
    g.signals.emit('lift', { phase: 'descend' });
    Platform.haptic(20);
  }

  /** Floor start on the arrival floor: ride the last metres down with her (skipped on respawns / dev warps). */
  arrive() {
    if (this.m.props.role !== 'arrive') return;
    const g = this.g, p = g.player;
    this.arriving = 0;
    p.beginScripted();
    p.anim.play('idle_alert', { fade: 0.2, loop: true });
    g.rig.cine = this.cam;
    g.hud.cinematic(true);
    g.touch?.cinematic(true);
  }

  update(dt: number) {
    const g = this.g, p = g.player;
    if (this.arriving >= 0) { this.updateArrival(dt); return; }
    if (this.m.props.role !== 'depart') return;
    // the cage follows the memory's materials (SHARED look swaps on a shift)
    if (this.t < 0) {
      const was = this.near;
      this.near = this.onDeck() && p.alive && !p.scripted;
      if (this.near) g.hud.interact('Descend to the Crownheart', "THE KING'S LIFT", g.enemies.engagedNear(p.pos, 14), { at: p.pos.clone().setY(p.pos.y + 1.9), verb: 'DESCEND', kind: 'lift' });
      else if (was) g.hud.interact(null);
      return;
    }
    this.t += dt;
    const t = this.t;
    // the brake lets go: a jolt, then an accelerating drop
    const drop = t < 0.6 ? Math.sin(t / 0.6 * Math.PI) * 0.12 : 0.5 * 2.2 * Math.pow(t - 0.6, 2) + 0.12;
    const y = this.y0 - drop;
    this.group.position.y = y;
    this.box.min.y = y - 0.3; this.box.max.y = y;
    p.pos.set(this.m.pos.x, y + 0.02, this.m.pos.z + 0.2);
    // embers stream up past the cage, faster as it falls
    const speed = t < 0.6 ? 0 : 2.2 * (t - 0.6);
    for (let i = 0; i < 3 + speed; i++) {
      const at = new THREE.Vector3(this.m.pos.x + (Math.random() - 0.5) * 5, y - 4 - Math.random() * 8, this.m.pos.z + (Math.random() - 0.5) * 5);
      g.fx.emit(at, new THREE.Vector3(0, 4 + speed * 1.5, 0), Math.random() < 0.3 ? 0xffb060 : 0xff4a18, 1.2, 0.04 + Math.random() * 0.04, -1, 0.1);
    }
    if (t > 0.55 && this.sounds === 0) { this.sounds = 1; g.audio.play('rubble', { pos: p.pos.clone(), vol: 1.1 }); g.rig.addShake(0.35); g.audio.play('shift_charge', { rate: 0.55, vol: 0.9 }); }
    if (t > 2.6 && this.sounds === 1) { this.sounds = 2; g.audio.play('creak', { pos: p.pos.clone(), rate: 0.6, vol: 1.1 }); g.audio.play('armor_rattle', { pos: p.pos.clone(), rate: 0.55, vol: 1.1 }); }
    if (t > 4.6 && this.sounds === 2) { this.sounds = 3; g.audio.play('shift_boom', { rate: 0.55, vol: 0.9 }); g.hud.message('THE CROWNHEART', 'Beneath Caer Veyr, the royal line kept its heart', 3.5); }
    g.rig.addShake(Math.min(0.02, speed * 0.004));
    // camera: held at the lip looking down as she sinks, then riding above her into the glow
    const top = new THREE.Vector3(this.m.pos.x - 3.2, this.y0 + 2.6, this.m.pos.z + 3.4);
    if (t < 2.4) {
      this.cam.pos.copy(top);
      this.cam.look.set(this.m.pos.x, y + 0.8, this.m.pos.z);
    } else {
      const k = Math.min(1, (t - 2.4) / 1.2);
      const ride = new THREE.Vector3(this.m.pos.x - 0.8, y + 4.2, this.m.pos.z + 1.6);
      this.cam.pos.copy(top).lerp(ride, k * k * (3 - 2 * k));
      this.cam.look.set(this.m.pos.x, y - 6 * k, this.m.pos.z - 0.4);
    }
    if (t > DESCENT - 1.3 && t - dt <= DESCENT - 1.3) g.hud.fade(true);
    if (t >= DESCENT) {
      this.t = -2;                          // done (never re-armed on this floor)
      g.leaveFloor();
    }
  }

  private updateArrival(dt: number) {
    const g = this.g, p = g.player;
    this.arriving += dt;
    const t = this.arriving;
    const land = 1.8;
    // the cage (level geometry) is already down: the camera rides the last metres and the landing is felt
    const k = Math.min(1, t / land);
    const e = 1 - Math.pow(1 - k, 3);
    const at = this.m.pos;
    this.cam.pos.set(at.x + 1.6, at.y + 9 - e * 5.8, at.z - 3.4 + e * 1.2);
    this.cam.look.set(at.x, at.y + 1.0, at.z + 1.5);
    if (t >= land && t - dt < land) {
      g.fx.dust(at.clone().setY(at.y + 0.1), 16);
      g.rig.addShake(0.4);
      g.audio.play('land_heavy', { pos: at.clone(), vol: 1.4, rate: 0.7 });
      g.audio.play('armor_rattle', { pos: at.clone(), rate: 0.6, vol: 1.2 });
      Platform.haptic(30);
    }
    if (t > land + 0.9) {
      this.arriving = -1;
      p.endScripted();
      g.rig.cine = null;
      g.hud.cinematic(false);
      g.touch?.cinematic(false);
      g.rig.snapBehind(p.yaw);
    }
  }

  dispose() {
    const g = this.g;
    if (this.collider) { const i = g.level.collision.dynamic.indexOf(this.collider); if (i >= 0) g.level.collision.dynamic.splice(i, 1); }
    this.group.removeFromParent();
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }
}
