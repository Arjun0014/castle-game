import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';
import { stabilizeShadowDepth } from './ShadowDepth';

/**
 * Persistent combat aftermath: blood splatter decals on floors/walls (raycast onto real collision) and gore
 * chunks with simple physics (gravity, bounce, settle, fade). Decals belong to the time state they were made
 * in — the Past's blood is not on the Present's floor.
 */
export type RaycastFn = (o: THREE.Vector3, d: THREE.Vector3, far: number) => { point: THREE.Vector3; normal: THREE.Vector3 } | null;

function splatTexture(seed: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  g.fillStyle = 'rgba(255,255,255,1)';
  // main pool
  g.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, r = 26 + rnd() * 16;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.quadraticCurveTo(64 + Math.cos(a - 0.2) * (r + 8), 64 + Math.sin(a - 0.2) * (r + 8), x, y);
  }
  g.fill();
  // droplets and streaks flung outward
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, d = 34 + rnd() * 26, r = 1.5 + rnd() * 5;
    g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2); g.fill();
    if (rnd() < 0.4) {
      g.lineWidth = 1 + rnd() * 2.5; g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); g.lineTo(64 + Math.cos(a) * (d + 8), 64 + Math.sin(a) * (d + 8)); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Decal { mesh: THREE.Mesh; life: number; state: TimeState }
interface Gib { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number; rest: number; state: TimeState; bounced: number; splat: boolean }

export class Gore {
  private tex = [splatTexture(1), splatTexture(7), splatTexture(13), splatTexture(29)];
  private decalGeo = new THREE.PlaneGeometry(1, 1);
  private decalMats: THREE.MeshStandardMaterial[];
  private decals: Decal[] = [];
  private chunks: Gib[] = [];
  /** recycled decal meshes (each keeps its own material copy for colour/fade) and gib meshes */
  private decalPool: THREE.Mesh[] = [];
  private gibPool: THREE.Mesh[] = [];
  private gibGeo = [new THREE.IcosahedronGeometry(1, 0), new THREE.DodecahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0)];
  private gibMats = {
    flesh: new THREE.MeshStandardMaterial({ color: 0x4a0606, roughness: 0.35, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e0a08, roughness: 0.5, metalness: 0 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xb8ad94, roughness: 0.7, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.4, metalness: 0.8 }),
  };
  state: TimeState = 'PRESENT';
  maxDecals = 140;
  /** a decal's life (s, + up to 20 s); the Endless Arena keeps a smaller, shorter-lived field (one ring, all in view) */
  decalLife = 45;
  maxChunks = 90;

  constructor(private scene: THREE.Scene, private raycast: RaycastFn) {
    this.decalMats = this.tex.map((map) => new THREE.MeshStandardMaterial({
      map, color: 0x5c0707, roughness: 0.28, metalness: 0, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, alphaTest: 0.05,
    }));
  }

  setState(s: TimeState) {
    this.state = s;
    for (const d of this.decals) d.mesh.visible = d.state === s;
    for (const g of this.chunks) g.mesh.visible = g.state === s;
  }

  /** Stamp a blood decal where a ray from `from` along `dir` meets geometry. */
  splat(from: THREE.Vector3, dir: THREE.Vector3, size: number, far = 3.5, darkness = 1) {
    const hit = this.raycast(from, dir, far);
    if (!hit) return false;
    const m = this.decalPool.pop() ?? new THREE.Mesh(this.decalGeo, new THREE.MeshStandardMaterial());
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.copy(this.decalMats[Math.floor(Math.random() * this.decalMats.length)]);
    mat.color.multiplyScalar(0.7 + 0.5 * darkness * Math.random());
    m.rotation.set(0, 0, 0);
    m.visible = true;
    m.position.copy(hit.point).addScaledVector(hit.normal, 0.012);
    m.lookAt(_t.copy(m.position).add(hit.normal));
    m.rotateZ(Math.random() * Math.PI * 2);
    const s = size * (0.7 + Math.random() * 0.6);
    m.scale.set(s, s * (0.8 + Math.random() * 0.4), 1);
    m.renderOrder = 1;
    m.receiveShadow = true;
    this.scene.add(m);
    this.decals.push({ mesh: m, life: this.decalLife + Math.random() * 20, state: this.state });
    if (this.decals.length > this.maxDecals) this.kill(this.decals.shift()!);
    return true;
  }

  /** Spray aftermath: floor pools below/ahead of the contact and splashes on nearby walls along the cut. */
  aftermath(at: THREE.Vector3, dir: THREE.Vector3, amount: number) {
    const down = new THREE.Vector3(0, -1, 0);
    const n = Math.max(1, Math.round(amount * 3));
    for (let i = 0; i < n; i++) {
      const d = 0.3 + Math.random() * (0.8 + amount * 1.6);
      const p = at.clone().addScaledVector(dir, d).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8));
      this.splat(p, down, 0.35 + amount * 0.5, 4);
    }
    if (amount > 0.5) this.splat(at, _t.copy(dir).setY(dir.y * 0.3).normalize(), 0.5 + amount * 0.4, 2.8, 0.8);
  }

  /** Throw chunks: `palette` picks flesh/bone/metal mixes. */
  gibs(at: THREE.Vector3, dir: THREE.Vector3, n: number, palette: 'flesh' | 'rotten' | 'armor') {
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const mat = palette === 'armor' ? (r < 0.45 ? this.gibMats.metal : r < 0.8 ? this.gibMats.flesh : this.gibMats.bone)
        : palette === 'rotten' ? (r < 0.55 ? this.gibMats.dark : r < 0.85 ? this.gibMats.flesh : this.gibMats.bone)
          : (r < 0.7 ? this.gibMats.flesh : this.gibMats.bone);
      const m = this.gibPool.pop() ?? new THREE.Mesh(this.gibGeo[0], mat);
      m.geometry = this.gibGeo[i % 3];
      m.material = mat;
      m.rotation.set(0, 0, 0);
      m.visible = true;
      const s = 0.04 + Math.random() * (mat === this.gibMats.metal ? 0.1 : 0.07);
      m.scale.set(s, s * (0.6 + Math.random() * 0.8), s * (0.7 + Math.random() * 0.6));
      m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
      m.castShadow = true;
      stabilizeShadowDepth(m);
      const v = dir.clone().multiplyScalar(2.5 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 3.5, 2 + Math.random() * 4, (Math.random() - 0.5) * 3.5));
      this.scene.add(m);
      this.chunks.push({ mesh: m, v, spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6), life: 9 + Math.random() * 5, rest: 0, state: this.state, bounced: 0, splat: mat !== this.gibMats.metal && mat !== this.gibMats.bone });
    }
    if (this.chunks.length > this.maxChunks) for (const g of this.chunks.splice(0, this.chunks.length - this.maxChunks)) this.kill(g);
  }

  private kill(o: { mesh: THREE.Mesh }) {
    this.scene.remove(o.mesh);
    if (o.mesh.geometry === this.decalGeo) this.decalPool.push(o.mesh); else this.gibPool.push(o.mesh);
  }

  /** Floor change: remove every decal and chunk (they belong to the old floor's surfaces). */
  clear() {
    for (const d of this.decals) this.kill(d);
    for (const g of this.chunks) this.kill(g);
    this.decals = []; this.chunks = [];
  }

  /** One decal and one gib per material, for the loading-screen shader warm-up. */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const objects: THREE.Object3D[] = [];
    let i = 0;
    for (const mat of this.decalMats) {
      // every splat texture: each is its own upload
      const d = new THREE.Mesh(this.decalGeo, mat);
      d.position.copy(at).add(new THREE.Vector3(i++ * 0.6 - 1, 0.02, 1)); d.rotation.x = -Math.PI / 2; d.receiveShadow = true;
      objects.push(d);
    }
    i = 0;
    for (const mat of Object.values(this.gibMats)) {
      const g = new THREE.Mesh(this.gibGeo[i % 3], mat);
      g.scale.setScalar(0.08); g.castShadow = true;
      stabilizeShadowDepth(g);
      g.position.copy(at).add(new THREE.Vector3(i++ * 0.3 - 0.5, 0.3, -1));
      objects.push(g);
    }
    return { objects, dispose: () => { for (const o of objects) o.removeFromParent(); } };
  }

  update(dt: number) {
    for (const d of this.decals) {
      d.life -= dt;
      if (d.life < 6) (d.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, d.life / 6);
    }
    this.decals = this.decals.filter((d) => { if (d.life <= 0) { this.kill(d); return false; } return true; });
    const down = _d.set(0, -1, 0);
    for (const g of this.chunks) {
      g.life -= dt;
      if (g.rest < 1) {
        g.v.y -= 20 * dt;
        const step = g.v.length() * dt;
        const hit = step > 1e-4 ? this.raycast(g.mesh.position, _t.copy(g.v).normalize(), step + 0.05) : null;
        if (hit) {
          g.mesh.position.copy(hit.point).addScaledVector(hit.normal, 0.03);
          if (g.splat && g.bounced === 0 && hit.normal.y > 0.6) this.splat(g.mesh.position.clone().setY(g.mesh.position.y + 0.3), down, 0.18 + Math.random() * 0.15, 0.6);
          g.bounced++;
          const vn = hit.normal.clone().multiplyScalar(g.v.dot(hit.normal));
          g.v.sub(vn.multiplyScalar(1.45)).multiplyScalar(0.45);
          g.spin.multiplyScalar(0.5);
          if (g.v.length() < 0.6 && hit.normal.y > 0.6) g.rest = 1;
        } else g.mesh.position.addScaledVector(g.v, dt);
        g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; g.mesh.rotation.z += g.spin.z * dt;
      }
      if (g.life < 1) g.mesh.scale.multiplyScalar(Math.max(0.01, 1 - dt * 3));
    }
    this.chunks = this.chunks.filter((g) => { if (g.life <= 0) { this.kill(g); return false; } return true; });
  }
}

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
