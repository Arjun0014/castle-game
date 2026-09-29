import * as THREE from 'three';
import type { Player } from '../character/Player';
import type { TimeState } from '../levels/Materials';
import type { AuraKind } from '../enemies/EnemyTypes';

/** Aura motes: colour, size, rise speed, life, spawn rate (/s). Deliberately faint — identity, not decoration. */
const AURA: Record<AuraKind, { color: number; size: number; rise: number; life: number; rate: number }> = {
  echo: { color: 0x6f9fb8, size: 0.05, rise: 0.35, life: 1.6, rate: 7 },
  muster: { color: 0x8a7650, size: 0.045, rise: 0.25, life: 1.8, rate: 5 },
  elite: { color: 0xb86a28, size: 0.04, rise: 0.8, life: 1.1, rate: 8 },
  corrupt: { color: 0x4f6a5e, size: 0.07, rise: -0.25, life: 1.5, rate: 6 },
  dread: { color: 0x7a3a8a, size: 0.06, rise: 0.7, life: 1.4, rate: 14 },
};

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[64, 3], [3, 64]]) {
    const l = g.createLinearGradient(32 - w / 2, 32 - h / 2, 32 + w / 2, 32 + h / 2);
    l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,0.9)'); l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l;
    g.fillRect(32 - w / 2, 32 - h / 2, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Particle { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; color: THREE.Color; size: number; grav: number; target?: THREE.Object3D; fadeIn?: number; solid?: boolean; alpha?: number; }

function makePool(max: number, additive: boolean) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: `attribute float size; attribute vec3 color; attribute float alpha; varying vec3 vC; varying float vA;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 400.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: additive
      ? `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a, a); }`
      : `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.25, length(d)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 3 : 2;
  return {
    max, pos, col, size, alpha, points,
    flush(n: number) {
      geo.setDrawRange(0, n);
      for (const k of ['position', 'color', 'size', 'alpha']) (geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

/** Lightweight VFX: GPU points for particles, CPU-baked afterimages, blade trail, shift rings. */
export class Effects {
  private particles: Particle[] = [];
  private max = 1500;
  /** light: additive glow (sparks, motes, resonance) · solid: alpha-blended matter (gore, dust, ash) */
  private light = makePool(this.max, true);
  private solid = makePool(600, false);
  private ghosts: { mesh: THREE.Mesh; life: number; src: THREE.Object3D }[] = [];
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  /** never disposed: holds the afterimage program between dodges (three frees programs with their last material) */
  private ghostKeeper = this.ghostMat.clone();
  /** afterimage meshes per source skinned mesh, reused (no per-dodge buffer allocation) */
  private ghostPool = new Map<THREE.Object3D, THREE.Mesh[]>();
  private rings: { mesh: THREE.Mesh; life: number; max: number; grow: number }[] = [];
  private ringPool: THREE.Mesh[] = [];
  private ringGeo = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);
  private channel: { center: THREE.Vector3; color: THREE.Color; t: number } | null = null;
  hitstopTime = 0;
  // blade trail
  private trailGeo = new THREE.BufferGeometry();
  private trailN = 48;
  private trailPos = new Float32Array(this.trailN * 2 * 3);
  private trailAlpha = new Float32Array(this.trailN * 2);
  private trailMesh: THREE.Mesh;
  private trailHist: { h: THREE.Vector3; t: THREE.Vector3; age: number }[] = [];
  private trailWeight = 0;
  /** trail lifetime multiplier (the Whirlwind keeps a longer ring of light) */
  private trailLifeMul = 1;
  trailOn = false;
  private glintTex = starTexture();
  private glints: { sprite: THREE.Sprite; bone: THREE.Object3D; life: number; max: number; size: number }[] = [];
  private glintPool: THREE.Sprite[] = [];

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    scene.add(this.light.points, this.solid.points);
    // trail
    const idx: number[] = [];
    for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.trailGeo.setIndex(idx);
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trailGeo.setAttribute('alpha', new THREE.BufferAttribute(this.trailAlpha, 1));
    const tmat = new THREE.ShaderMaterial({
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor * vA, vA); }`,
      uniforms: { uColor: { value: new THREE.Color(0xffe8c0) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.trailMesh = new THREE.Mesh(this.trailGeo, tmat);
    this.trailMesh.frustumCulled = false;
    scene.add(this.trailMesh);
    void this.camera;
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, color: number | THREE.Color, life: number, size: number, grav = 9, fadeIn = 0, solid = false, alpha = 1) {
    if (this.particles.length >= this.max) this.particles.shift();
    this.particles.push({ p: p.clone(), v, life, max: life, color: new THREE.Color(color), size, grav, fadeIn, solid, alpha });
  }

  sparks(at: THREE.Vector3, n: number, color = 0xffc080) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 5);
      this.emit(at, v, color, 0.25 + Math.random() * 0.3, 0.05 + Math.random() * 0.05, 14);
    }
  }

  blood(at: THREE.Vector3, n: number, color = 0xa01818) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).multiplyScalar(4);
      this.emit(at, v, color, 0.45 + Math.random() * 0.3, 0.05 + Math.random() * 0.05, 12, 0, true);
    }
  }

  dust(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).multiplyScalar(2.5);
      this.emit(at, v, 0x6a6258, 0.8 + Math.random() * 0.4, 0.25, -0.5, 0.2, true);
    }
  }

  /** Faint identity motes around an enemy body (see AURA). */
  aura(kind: AuraKind, center: THREE.Vector3, radius: number, height: number, dt: number, acc: { auraAcc: number }) {
    const a = AURA[kind];
    acc.auraAcc += a.rate * dt;
    while (acc.auraAcc >= 1) {
      acc.auraAcc -= 1;
      const ang = Math.random() * Math.PI * 2, r = radius * (0.5 + Math.random() * 0.6);
      const p = new THREE.Vector3(center.x + Math.cos(ang) * r, center.y + 0.2 + Math.random() * height * 0.85, center.z + Math.sin(ang) * r);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.15, a.rise * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.15);
      this.emit(p, v, a.color, a.life * (0.7 + Math.random() * 0.6), a.size * (0.7 + Math.random() * 0.6), 0, 0.4, kind === 'corrupt');
    }
  }

  /** Brief star glint riding a weapon bone: the enemy's attack tell. */
  glint(bone: THREE.Object3D, color = 0xfff0d0, size = 0.55, life = 0.32) {
    const sprite = this.glintPool.pop() ?? this.makeGlint();
    sprite.material.color.set(color);
    this.scene.add(sprite);
    this.glints.push({ sprite, bone, life, max: life, size });
  }

  private makeGlint() {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glintTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
    sprite.renderOrder = 10;
    return sprite;
  }
  private makeRing() {
    const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    return mesh;
  }

  /** Floor change / restart: drop every live particle, glint, ring, afterimage (pools are kept). */
  clear() {
    this.particles.length = 0;
    this.light.flush(0); this.solid.flush(0);
    for (const gl of this.glints) { this.scene.remove(gl.sprite); this.glintPool.push(gl.sprite); }
    for (const r of this.rings) { this.scene.remove(r.mesh); this.ringPool.push(r.mesh); }
    for (const gh of this.ghosts) { this.scene.remove(gh.mesh); this.ghostPool.get(gh.src)?.push(gh.mesh); }
    this.glints = []; this.rings = []; this.ghosts = [];
    this.trailHist.length = 0;
    this.channel = null;
    this.hitstopTime = 0; this.slowTime = 0; this.slowScale = 1;
  }

  /** One instance of every transient VFX material, for the loading-screen shader warm-up. */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const glint = this.makeGlint();
    glint.position.copy(at).setY(at.y + 1.2);
    const ring = this.makeRing();
    ring.position.copy(at).setY(at.y + 0.05);
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), this.ghostKeeper);
    ghost.position.copy(at).setY(at.y + 1);
    this.trailMesh.visible = true;
    return {
      objects: [glint, ring, ghost],
      dispose: () => {
        glint.removeFromParent(); ring.removeFromParent(); ghost.removeFromParent();
        this.glintPool.push(glint); this.ringPool.push(ring);
        ghost.geometry.dispose(); // ghostKeeper stays alive: it keeps the afterimage program resident
        this.trailMesh.visible = false;
      },
    };
  }

  // ------------------------------------------------------------------ combat gore / kill feel
  /** Slow motion (kill beats). Game scales dt while slowTime > 0 (real-time countdown). */
  slowTime = 0;
  slowScale = 1;
  slowmo(duration: number, scale: number) {
    if (this.slowTime <= 0 || scale < this.slowScale) this.slowScale = scale;
    this.slowTime = Math.max(this.slowTime, duration);
  }

  /** Directional blood: droplets thrown along the cut + a short mist puff. amount 0..1.5 */
  bloodSpray(at: THREE.Vector3, dir: THREE.Vector3, amount: number, color = 0x6a0808) {
    const base = new THREE.Color(color);
    const n = Math.round(10 + amount * 38);
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(1.5 + Math.random() * 6 * (0.5 + amount))
        .add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.4 + Math.random() * 2.6, (Math.random() - 0.5) * 3));
      const c = base.clone().multiplyScalar(0.6 + Math.random() * 0.7);
      this.emit(at, v, c, 0.45 + Math.random() * 0.6, 0.022 + Math.random() * 0.06, 14, 0, true);
    }
    for (let i = 0; i < 3 + amount * 4; i++) {
      const v = dir.clone().multiplyScalar(0.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5), 0.3 + Math.random() * 0.4, (Math.random() - 0.5)));
      this.emit(at, v, base.clone().multiplyScalar(1.3), 0.28 + Math.random() * 0.15, 0.28 + Math.random() * 0.3, 0.5, 0.05, true, 0.3);
    }
  }

  /** Grey ash / smoke burst (wraiths bleed memory, not blood). */
  ashBurst(at: THREE.Vector3, dir: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(1 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5));
      this.emit(at, v, new THREE.Color(0x5a5e66).multiplyScalar(0.7 + Math.random() * 0.5), 0.7 + Math.random() * 0.7, 0.08 + Math.random() * 0.14, -0.6, 0.1, true, 0.7);
    }
  }

  /**
   * An Echo breaks apart: particles sampled from its actual skinned surface (so the burst has the body's shape)
   * — embers rising for guards, dark ash + red cinders for Hollows, smoke for wraiths.
   */
  shatter(obj: THREE.Object3D, kind: 'ember' | 'ash' | 'smoke', count = 260) {
    const meshes: THREE.SkinnedMesh[] = [];
    obj.traverse((o) => { const m = o as THREE.SkinnedMesh; if ((m.isSkinnedMesh || (m as THREE.Mesh).isMesh) && m.visible !== false) meshes.push(m); });
    let total = 0;
    for (const m of meshes) total += m.geometry.attributes.position.count;
    if (!total) return;
    const stride = Math.max(1, Math.floor(total / count));
    const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    const v = new THREE.Vector3();
    for (const m of meshes) {
      m.updateMatrixWorld(true);
      const pos = m.geometry.attributes.position;
      for (let i = Math.floor(Math.random() * stride); i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i);
        if (m.isSkinnedMesh) m.applyBoneTransform(i, v);
        v.applyMatrix4(m.matrixWorld);
        const out = v.clone().sub(center).setY(0).normalize();
        if (kind === 'ember') {
          const hot = Math.random();
          const c = new THREE.Color(hot < 0.5 ? 0xffa040 : hot < 0.85 ? 0xff6a18 : 0xfff0c0);
          this.emit(v, out.multiplyScalar(0.3 + Math.random() * 0.8).add(new THREE.Vector3(0, 0.4 + Math.random() * 1.4, 0)), c, 0.7 + Math.random() * 1.1, 0.03 + Math.random() * 0.04, -1.2, 0.05);
        } else if (kind === 'ash') {
          if (Math.random() < 0.3) this.emit(v, out.multiplyScalar(0.4).add(new THREE.Vector3(0, 0.6 + Math.random(), 0)), 0xff3a10, 0.6 + Math.random() * 0.8, 0.025, -0.8, 0.05);
          else this.emit(v, out.multiplyScalar(0.3 + Math.random() * 0.6).add(new THREE.Vector3(0, 0.2 + Math.random() * 0.6, 0)), new THREE.Color(0x2a2220).multiplyScalar(0.8 + Math.random() * 0.6), 1.0 + Math.random() * 1.2, 0.05 + Math.random() * 0.05, 1.2, 0.05, true, 0.9);
        } else {
          this.emit(v, out.multiplyScalar(0.3).add(new THREE.Vector3(0, 0.5 + Math.random() * 0.8, 0)), new THREE.Color(0x707884).multiplyScalar(0.6 + Math.random() * 0.5), 0.9 + Math.random() * 0.9, 0.09 + Math.random() * 0.12, -0.4, 0.15, true, 0.55);
        }
      }
    }
  }

  hitstop(t: number) { this.hitstopTime = Math.max(this.hitstopTime, t); }

  /** Resonance motes flowing from a defeated Echo into the player. */
  resonanceFrom(at: THREE.Vector3, player: Player, amount: number) {
    const n = Math.min(40, 8 + amount / 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() + 0.5, Math.random() - 0.5).multiplyScalar(3);
      this.particles.push({ p: at.clone(), v, life: 1.4, max: 1.4, color: new THREE.Color(0xbfe8ff), size: 0.09, grav: 0, target: player.root });
    }
  }
  resonance(player: Player, amount: number) { void player; void amount; }

  afterimage(player: Player) {
    player.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh || m.name.toLowerCase().includes('sword')) return;
      const src = m.geometry.attributes.position;
      let pool = this.ghostPool.get(m);
      if (!pool) { pool = []; this.ghostPool.set(m, pool); }
      let mesh = pool.pop();
      if (!mesh) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(src.count * 3), 3));
        if (m.geometry.index) g.setIndex(m.geometry.index);
        mesh = new THREE.Mesh(g, this.ghostMat.clone());
        mesh.frustumCulled = false;
      }
      const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const out = attr.array as Float32Array;
      const v = _gv;
      for (let i = 0; i < src.count; i++) {
        v.fromBufferAttribute(src, i);
        m.applyBoneTransform(i, v);
        v.applyMatrix4(m.matrixWorld);
        out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      }
      attr.needsUpdate = true;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.35;
      this.scene.add(mesh);
      this.ghosts.push({ mesh, life: 0.35, src: m });
    });
  }

  shiftBurst(at: THREE.Vector3, to: TimeState) {
    const color = to === 'PAST' ? 0xffb060 : 0x80c8ff;
    const mesh = this.ringPool.pop() ?? this.makeRing();
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    mesh.scale.setScalar(1);
    mesh.position.copy(at).setY(at.y + 0.05);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 1.2, max: 1.2, grow: 40 });
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), Math.random() * 0.6, Math.sin(a)).multiplyScalar(6 + Math.random() * 6);
      this.emit(at.clone().setY(at.y + 1), v, color, 0.9, 0.12, 0);
    }
  }

  /** Ground shockwave (the sword plunge): a fast ring at floor level, dust and embers thrown outward. */
  shockwave(at: THREE.Vector3, radius: number, level: number) {
    const mesh = this.ringPool.pop() ?? this.makeRing();
    (mesh.material as THREE.MeshBasicMaterial).color.set(level > 0.6 ? 0xffc070 : 0xffe2b0);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    mesh.scale.setScalar(0.4);
    mesh.position.copy(at).setY(at.y + 0.06);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 0.45, max: 0.45, grow: radius * 2.2 });
    for (let i = 0; i < 26 + level * 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), 0.15 + Math.random() * 0.5, Math.sin(a)).multiplyScalar(4 + Math.random() * 5 + level * 3);
      if (i % 3 === 0) this.emit(at.clone().setY(at.y + 0.2), v, 0xffb060, 0.5, 0.05, 6);
      else this.emit(at.clone().setY(at.y + 0.15), v.multiplyScalar(0.6), 0x6a6258, 0.8 + Math.random() * 0.4, 0.22, -0.4, 0.15, true);
    }
  }

  /** Charging a hold attack: motes drawn onto the raised blade, brighter with the charge. */
  chargeGlow(tip: THREE.Vector3, hilt: THREE.Vector3, level: number) {
    for (let i = 0; i < 2; i++) {
      const on = hilt.clone().lerp(tip, Math.random());
      const from = on.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.3) * 1.2, (Math.random() - 0.5) * 1.6));
      this.emit(from, on.sub(from).multiplyScalar(3), level > 0.95 ? 0xfff0c0 : 0xffb060, 0.3, 0.05 + level * 0.05, 0);
    }
  }

  channelStart(at: THREE.Vector3, to: TimeState) { this.channel = { center: at.clone(), color: new THREE.Color(to === 'PAST' ? 0xffb060 : 0x80c8ff), t: 0 }; }
  channelStop() { this.channel = null; }

  /**
   * Blade trail. Samples are aged in (scaled) game time — the ribbon freezes during hit-stop and lingers on
   * heavy swings — and fast swings are sub-sampled so the arc stays smooth at 50–60 m/s tip speeds.
   * weight 0 (light, pale steel) .. 1 (heavy/finisher, warm and longer).
   */
  setTrail(on: boolean, hilt?: THREE.Vector3, tip?: THREE.Vector3, weight = 0, lifeMul = 1) {
    this.trailOn = on;
    if (!on || !hilt || !tip) return;
    this.trailWeight = weight;
    this.trailLifeMul = lifeMul;
    const prev = this.trailHist[0];
    if (prev) {
      const gap = prev.t.distanceTo(tip);
      const n = Math.min(3, Math.floor(gap / 0.28));
      for (let i = 1; i <= n; i++) {
        const k = i / (n + 1);
        this.trailHist.unshift({ h: prev.h.clone().lerp(hilt, k), t: prev.t.clone().lerp(tip, k), age: 0 });
      }
    }
    this.trailHist.unshift({ h: hilt.clone(), t: tip.clone(), age: 0 });
    while (this.trailHist.length > this.trailN) this.trailHist.pop();
  }

  update(dt: number, t: number) {
    // channel swirl
    if (this.channel) {
      this.channel.t += dt;
      const k = Math.min(1, this.channel.t / 2.4);
      for (let i = 0; i < 4; i++) {
        const a = t * 3 + i * 1.57 + Math.random();
        const r = 3.2 - k * 2.4;
        const p = this.channel.center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.1 + Math.random() * 2.2 * k, Math.sin(a) * r));
        const v = this.channel.center.clone().setY(p.y + 0.5).sub(p).multiplyScalar(0.8);
        this.emit(p, v, this.channel.color, 0.6, 0.07 + k * 0.05, 0);
      }
    }
    // particles
    let nl = 0, ns = 0;
    const L = this.light, S = this.solid;
    const alive: Particle[] = [];
    for (const q of this.particles) {
      q.life -= dt;
      if (q.life <= 0) continue;
      if (q.target) {
        const tp = q.target.position.clone().setY(q.target.position.y + 1.1);
        const to = tp.sub(q.p);
        q.v.lerp(to.multiplyScalar(4), Math.min(1, dt * 3.5));
        if (to.length() < 0.25) continue;
      } else q.v.y -= q.grav * dt;
      q.p.addScaledVector(q.v, dt);
      alive.push(q);
      let f = q.life / q.max;
      if (q.fadeIn) f = Math.min(f, (1 - f) / q.fadeIn);
      const P = q.solid ? S : L;
      const n = q.solid ? ns : nl;
      if (n >= P.max) continue;
      P.pos[n * 3] = q.p.x; P.pos[n * 3 + 1] = q.p.y; P.pos[n * 3 + 2] = q.p.z;
      const k = q.solid ? 1 : f;
      P.col[n * 3] = q.color.r * k; P.col[n * 3 + 1] = q.color.g * k; P.col[n * 3 + 2] = q.color.b * k;
      P.size[n] = q.size;
      P.alpha[n] = (q.solid ? Math.min(1, f * 1.6) : 1) * (q.alpha ?? 1);
      if (q.solid) ns++; else nl++;
    }
    this.particles = alive;
    L.flush(nl);
    S.flush(ns);
    // glints
    for (const gl of this.glints) {
      gl.life -= dt;
      const k = 1 - gl.life / gl.max;
      gl.bone.getWorldPosition(gl.sprite.position);
      const env = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.3) / 0.7);
      gl.sprite.scale.setScalar(gl.size * (0.4 + env * 0.8));
      gl.sprite.material.rotation = k * 1.2;
      gl.sprite.material.opacity = env;
      if (gl.life <= 0) { this.scene.remove(gl.sprite); this.glintPool.push(gl.sprite); }
    }
    this.glints = this.glints.filter((g) => g.life > 0);
    // afterimages
    for (const gh of this.ghosts) {
      gh.life -= dt;
      (gh.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, gh.life / 0.35) * 0.35;
      if (gh.life <= 0) { this.scene.remove(gh.mesh); this.ghostPool.get(gh.src)?.push(gh.mesh); }
    }
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    // rings
    for (const r of this.rings) {
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.mesh.scale.setScalar(1 + k * r.grow);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k) * 0.9;
      if (r.life <= 0) { this.scene.remove(r.mesh); this.ringPool.push(r.mesh); }
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    // blade trail (time-based fade; see setTrail)
    const life = (0.1 + this.trailWeight * 0.09) * this.trailLifeMul;
    for (const e of this.trailHist) e.age += dt;
    while (this.trailHist.length && this.trailHist[this.trailHist.length - 1].age > life) this.trailHist.pop();
    const hist = this.trailHist;
    const base = 0.5 + this.trailWeight * 0.3;
    (this.trailMesh.material as THREE.ShaderMaterial).uniforms.uColor.value.setRGB(0.88 + this.trailWeight * 0.12, 0.9 - this.trailWeight * 0.14, 1.0 - this.trailWeight * 0.45);
    for (let i = 0; i < this.trailN; i++) {
      const e = hist[Math.min(i, hist.length - 1)];
      const a = hist.length > 1 && e ? Math.max(0, 1 - e.age / life) * base * (i < hist.length ? 1 : 0) : 0;
      if (e) {
        this.trailPos.set([e.h.x, e.h.y, e.h.z], i * 6);
        this.trailPos.set([e.t.x, e.t.y, e.t.z], i * 6 + 3);
      }
      this.trailAlpha[i * 2] = a * 0.2;
      this.trailAlpha[i * 2 + 1] = a;
    }
    (this.trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    this.trailMesh.visible = hist.length > 1;
  }
}

const _gv = new THREE.Vector3();
