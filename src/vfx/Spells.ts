import * as THREE from 'three';
import type { Player } from '../character/Player';
import type { CollisionWorld } from '../game/Physics';
import type { TimeState } from '../levels/Materials';

/**
 * The Last Crown's magic (docs/LEVEL_03_BLUEPRINT.md §I). Everything is pooled and built once per floor:
 * bolts (fast / homing orb), rune circles (delayed eruptions), ground rings (expanding waves, nova tells), one beam,
 * one ward dome, one binding tether and four wedge decals (slip telegraph). Two colour families: the Crown's royal
 * gold (Past) and the Crownheart's violet-red (Present). Budget: ≤ 16 bolts, ≤ 8 runes, ≤ 6 rings live.
 * Materials are per-mesh clones of two shared shaders (one program each, warmed by warmKit()).
 */
export interface SpellHost {
  player: Player;
  world: () => CollisionWorld;
  state: () => TimeState;
  now: () => number;
  /** apply spell damage to the hero; returns the hit result (guard/parry/ignored…) */
  hurt(dmg: number, from: THREE.Vector3, opts: { knock?: number; heavy?: boolean; unblockable?: boolean }): string;
  burst(at: THREE.Vector3, color: number, n: number, speed?: number): void;
  sound(id: string, at?: THREE.Vector3, vol?: number, rate?: number): void;
}

export const GOLD = 0xffc060;
export const VIOLET = 0xc05aff;
export const EMBER = 0xff5a28;

interface Bolt { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; dmg: number; home: number; speed: number; radius: number; blast: number; color: number; live: boolean }
interface Rune { mesh: THREE.Mesh; t: number; delay: number; r: number; dmg: number; color: number; live: boolean }
interface Ring { mesh: THREE.Mesh; t: number; speed: number; r: number; max: number; dmg: number; hitDone: boolean; kind: 'wave' | 'tell'; color: number; live: boolean; life: number; band: number }

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function glowMat(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
}

export class Spells {
  root = new THREE.Group();
  private bolts: Bolt[] = [];
  private runes: Rune[] = [];
  private rings: Ring[] = [];
  private boltGeo = new THREE.SphereGeometry(0.2, 12, 8);
  private haloGeo = new THREE.SphereGeometry(0.42, 12, 8);
  private discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  private ringGeo = new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2);
  private beamGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  beam: THREE.Mesh;
  private beamCore: THREE.Mesh;
  ward: THREE.Mesh;
  tether: THREE.Mesh;
  wedges: THREE.Mesh[] = [];
  private materials: THREE.Material[] = [];
  /** beam state (driven by the boss): origin, yaw, height above the floor, damage per tick */
  beamOn = false;
  private beamTick = 0;
  beamDmg = 12;

  constructor(scene: THREE.Scene, private host: SpellHost, wedges: { angle: number; half: number; r0: number; r1: number }[], center: THREE.Vector3) {
    scene.add(this.root);
    for (let i = 0; i < 16; i++) {
      const mat = this.mat(glowMat(VIOLET));
      const mesh = new THREE.Mesh(this.boltGeo, mat);
      const halo = new THREE.Mesh(this.haloGeo, this.mat(glowMat(VIOLET, 0.35)));
      mesh.add(halo);
      mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 6;
      this.root.add(mesh);
      this.bolts.push({ mesh, vel: new THREE.Vector3(), life: 0, dmg: 0, home: 0, speed: 0, radius: 0.35, blast: 0, color: VIOLET, live: false });
    }
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.discGeo, this.mat(glowMat(EMBER, 0.2)));
      const edge = new THREE.Mesh(this.ringGeo, this.mat(glowMat(EMBER, 0.9)));
      mesh.add(edge);
      mesh.visible = false; mesh.renderOrder = 4;
      this.root.add(mesh);
      this.runes.push({ mesh, t: 0, delay: 1, r: 1.5, dmg: 0, color: EMBER, live: false });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(this.ringGeo, this.mat(glowMat(GOLD, 0.9)));
      mesh.visible = false; mesh.renderOrder = 4;
      this.root.add(mesh);
      this.rings.push({ mesh, t: 0, speed: 0, r: 0, max: 0, dmg: 0, hitDone: false, kind: 'wave', color: GOLD, live: false, life: 0, band: 0.6 });
    }
    this.beam = new THREE.Mesh(this.beamGeo, this.mat(glowMat(GOLD, 0.55)));
    this.beamCore = new THREE.Mesh(this.beamGeo, this.mat(glowMat(0xffffff, 0.9)));
    this.beamCore.scale.set(0.35, 0.35, 1);
    this.beam.add(this.beamCore);
    this.beam.visible = false; this.beam.frustumCulled = false; this.beam.renderOrder = 6;
    this.root.add(this.beam);
    this.ward = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), this.mat(glowMat(GOLD, 0.28)));
    this.ward.visible = false; this.ward.renderOrder = 6;
    this.root.add(this.ward);
    this.tether = new THREE.Mesh(this.beamGeo, this.mat(glowMat(GOLD, 0.7)));
    this.tether.visible = false; this.tether.frustumCulled = false; this.tether.renderOrder = 6;
    this.root.add(this.tether);
    // wedge decals: the Present holes, drawn on the Past floor while a slip is coming
    for (const w of wedges) {
      const a0 = THREE.MathUtils.degToRad(w.angle - w.half), len = THREE.MathUtils.degToRad(w.half * 2);
      // RingGeometry spans +x→+y counter-clockwise; after rotateX(-π/2) its +y maps to -z = Blender north
      const geo = new THREE.RingGeometry(w.r0, w.r1, 24, 1, a0, len).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, this.mat(glowMat(EMBER, 0)));
      m.position.copy(center).setY(center.y + 0.04);
      m.visible = false; m.renderOrder = 4;
      this.root.add(m);
      this.wedges.push(m);
    }
  }

  private mat<T extends THREE.Material>(m: T) { this.materials.push(m); return m; }

  // ------------------------------------------------------------------------------------------------ spawners
  bolt(from: THREE.Vector3, dir: THREE.Vector3, o: { speed: number; dmg: number; color: number; home?: number; life?: number; blast?: number; size?: number }) {
    const b = this.bolts.find((x) => !x.live);
    if (!b) return null;
    b.live = true;
    b.mesh.visible = true;
    b.mesh.position.copy(from);
    b.vel.copy(dir).normalize().multiplyScalar(o.speed);
    b.speed = o.speed; b.dmg = o.dmg; b.home = o.home ?? 0; b.life = o.life ?? 4; b.blast = o.blast ?? 0; b.color = o.color;
    b.mesh.scale.setScalar(o.size ?? 1);
    (b.mesh.material as THREE.MeshBasicMaterial).color.set(o.color);
    ((b.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(o.color);
    return b;
  }

  rune(at: THREE.Vector3, r: number, delay: number, dmg: number, color = EMBER) {
    const u = this.runes.find((x) => !x.live);
    if (!u) return;
    u.live = true; u.t = 0; u.delay = delay; u.r = r; u.dmg = dmg; u.color = color;
    u.mesh.visible = true;
    u.mesh.position.copy(at).setY(at.y + 0.05);
    u.mesh.scale.setScalar(r);
    (u.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    ((u.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** expanding ground wave (jump / dodge through it) */
  wave(at: THREE.Vector3, speed: number, max: number, dmg: number, color = GOLD) {
    const g = this.rings.find((x) => !x.live);
    if (!g) return;
    Object.assign(g, { t: 0, speed, r: 0.6, max, dmg, hitDone: false, kind: 'wave', color, live: true, life: max / speed, band: 0.7 });
    g.mesh.visible = true;
    g.mesh.position.copy(at).setY(at.y + 0.06);
    (g.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** a fixed-radius warning circle (nova, dark burst): pulses for `life` seconds, no damage */
  tell(at: THREE.Vector3, r: number, life: number, color = EMBER) {
    const g = this.rings.find((x) => !x.live);
    if (!g) return;
    Object.assign(g, { t: 0, speed: 0, r, max: r, dmg: 0, hitDone: true, kind: 'tell', color, live: true, life, band: 0.6 });
    g.mesh.visible = true;
    g.mesh.position.copy(at).setY(at.y + 0.07);
    (g.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  setBeam(on: boolean, from?: THREE.Vector3, yaw = 0, color = GOLD) {
    this.beamOn = on;
    this.beam.visible = on;
    if (!on || !from) return;
    const dir = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    const hit = this.host.world().raycast(from, dir, 26, this.host.state());
    const len = hit ? Math.max(0.5, hit.distance) : 26;
    this.beam.position.copy(from);
    this.beam.lookAt(_w.copy(from).add(dir));
    this.beam.scale.set(1, 1, len);
    (this.beam.material as THREE.MeshBasicMaterial).color.set(color);
    this.beamEnd.copy(from).addScaledVector(dir, len);
  }
  beamEnd = new THREE.Vector3();

  setWard(on: boolean, at?: THREE.Vector3, color = GOLD) {
    this.ward.visible = on;
    if (on && at) { this.ward.position.copy(at); (this.ward.material as THREE.MeshBasicMaterial).color.set(color); }
  }

  setTether(on: boolean, from?: THREE.Vector3, to?: THREE.Vector3) {
    this.tether.visible = on;
    if (!on || !from || !to) return;
    this.tether.position.copy(from);
    this.tether.lookAt(to);
    this.tether.scale.set(0.5, 0.5, from.distanceTo(to));
  }

  /** slip telegraph: wedge decals glow (k 0..1) — the Present holes about to open under the Past floor */
  setWedges(k: number) {
    for (const w of this.wedges) {
      w.visible = k > 0;
      (w.material as THREE.MeshBasicMaterial).opacity = k * (0.35 + 0.25 * Math.sin(this.host.now() * 12));
    }
  }

  clearAll() {
    for (const b of this.bolts) { b.live = false; b.mesh.visible = false; }
    for (const u of this.runes) { u.live = false; u.mesh.visible = false; }
    for (const g of this.rings) { g.live = false; g.mesh.visible = false; }
    this.setBeam(false); this.setWard(false); this.setTether(false); this.setWedges(0);
  }

  /** Incoming bolts near the hero (off-screen indicators). */
  incoming(from: THREE.Vector3, out: THREE.Vector3[]) {
    out.length = 0;
    for (const b of this.bolts) {
      if (!b.live) continue;
      const to = _v.subVectors(from, b.mesh.position);
      if (to.lengthSq() < 600 && to.dot(b.vel) > 0) out.push(b.mesh.position);
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ update
  update(dt: number) {
    const p = this.host.player, world = this.host.world(), st = this.host.state();
    const chest = _w.copy(p.pos).setY(p.pos.y + 1.1);
    for (const b of this.bolts) {
      if (!b.live) continue;
      b.life -= dt;
      if (b.home > 0) {
        const want = _v.subVectors(chest, b.mesh.position).normalize().multiplyScalar(b.speed);
        b.vel.lerp(want, Math.min(1, b.home * dt)).setLength(b.speed);
      }
      const step = b.vel.length() * dt;
      const dir = _v.copy(b.vel).normalize();
      const hit = world.raycast(b.mesh.position, dir, step + 0.1, st);
      // capsule test: closest point of the hero's axis to the bolt
      const d = b.mesh.position.distanceTo(chest) - (Math.abs(b.mesh.position.y - chest.y) < 0.9 ? 0 : 0.6);
      if (p.alive && d < b.radius + 0.45) { this.explode(b, true); continue; }
      if (hit || b.life <= 0) { if (hit) b.mesh.position.copy(hit.point); this.explode(b, false); continue; }
      b.mesh.position.addScaledVector(b.vel, dt);
      if (Math.random() < 0.6) this.host.burst(b.mesh.position, b.color, 1, 0.6);
    }
    for (const u of this.runes) {
      if (!u.live) continue;
      u.t += dt;
      const k = Math.min(1, u.t / u.delay);
      (u.mesh.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.3 * k;
      ((u.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * k * (0.7 + 0.3 * Math.sin(u.t * 30));
      if (u.t >= u.delay) {
        u.live = false; u.mesh.visible = false;
        const at = u.mesh.position;
        this.host.burst(at.clone().setY(at.y + 0.3), u.color, 24, 5);
        this.host.sound('mage_rune', at, 0.8);
        const dx = p.pos.x - at.x, dz = p.pos.z - at.z;
        if (p.alive && dx * dx + dz * dz < u.r * u.r && p.pos.y - at.y < 2.2) this.host.hurt(u.dmg, at.clone(), { knock: 3, heavy: true });
      }
    }
    for (const g of this.rings) {
      if (!g.live) continue;
      g.t += dt;
      const mat = g.mesh.material as THREE.MeshBasicMaterial;
      if (g.kind === 'wave') {
        g.r += g.speed * dt;
        g.mesh.scale.set(g.r, 1, g.r);
        mat.opacity = 0.9 * (1 - g.r / g.max * 0.5);
        const dx = p.pos.x - g.mesh.position.x, dz = p.pos.z - g.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        // ankle-high: a jump (feet above 0.55 m) or dodge i-frames clear it
        if (!g.hitDone && p.alive && Math.abs(dist - g.r) < g.band && p.pos.y - g.mesh.position.y < 0.55) {
          g.hitDone = true;
          this.host.hurt(g.dmg, g.mesh.position.clone(), { knock: 4, unblockable: true });
        }
        if (g.r >= g.max) { g.live = false; g.mesh.visible = false; }
      } else {
        g.mesh.scale.set(g.r, 1, g.r);
        mat.opacity = 0.35 + 0.55 * Math.abs(Math.sin(g.t * (6 + 10 * g.t / g.life)));
        if (g.t >= g.life) { g.live = false; g.mesh.visible = false; }
      }
    }
    // beam damage ticks (the beam is aimed/placed by the boss every frame)
    if (this.beamOn) {
      this.beamTick -= dt;
      const a = this.beam.position, b = this.beamEnd;
      const ab = _v.subVectors(b, a);
      const t = THREE.MathUtils.clamp(_w.subVectors(p.pos, a).setY(0).dot(ab.clone().setY(0)) / Math.max(1e-3, ab.clone().setY(0).lengthSq()), 0, 1);
      const q = a.clone().addScaledVector(ab, t);
      const flat = Math.hypot(p.pos.x - q.x, p.pos.z - q.z);
      const beamY = q.y, feet = p.pos.y, head = p.pos.y + p.height;
      if (this.beamTick <= 0 && p.alive && flat < 0.6 && beamY > feet + 0.05 && beamY < head) {
        this.beamTick = 0.3;
        this.host.hurt(this.beamDmg, a.clone(), { knock: 1.5 });
      }
      if (Math.random() < 0.8) this.host.burst(b, (this.beam.material as THREE.MeshBasicMaterial).color.getHex(), 2, 3);
    }
  }

  private explode(b: Bolt, direct: boolean) {
    b.live = false;
    b.mesh.visible = false;
    const at = b.mesh.position;
    this.host.burst(at, b.color, b.blast > 0 ? 40 : 14, b.blast > 0 ? 6 : 3.5);
    this.host.sound('mage_impact', at, b.blast > 0 ? 1.2 : 0.8, b.blast > 0 ? 0.8 : 1);
    const p = this.host.player;
    if (b.blast > 0) {
      if (p.alive && p.pos.distanceTo(at) < b.blast + 0.4) this.host.hurt(b.dmg, at.clone(), { knock: 5, heavy: true, unblockable: false });
    } else if (direct) this.host.hurt(b.dmg, at.clone().sub(b.vel.clone().normalize()), { knock: 1.8 });
  }

  /** One of every spell material drawn once behind the loading screen (no first-cast shader compile). */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const shown: THREE.Object3D[] = [this.bolts[0].mesh, this.runes[0].mesh, this.rings[0].mesh, this.beam, this.ward, this.tether, ...this.wedges];
    for (const o of shown) { o.visible = true; o.position.copy(at).add(new THREE.Vector3(0, 1.2, -2)); }
    this.beam.scale.set(1, 1, 2); this.tether.scale.set(1, 1, 2);
    return { objects: [], dispose: () => { this.clearAll(); } };
  }

  dispose() {
    this.root.removeFromParent();
    for (const g of [this.boltGeo, this.haloGeo, this.discGeo, this.ringGeo, this.beamGeo, this.ward.geometry]) g.dispose();
    for (const w of this.wedges) w.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
