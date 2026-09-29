import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';

/**
 * The Crownheart itself (Floor 3's `heart` marker, session 9): a faceted crystal hung in an iron cage over the arena,
 * beating (a double "lub-dub" pulse of scale, glow and the chamber's light), its colour following the Last Crown's
 * phases (gold-red → crimson → violet-white). In the Present its cage is broken. When she falls it convulses and
 * shatters, and the chamber's red light dies away.
 *
 * It never adds a light (a new light would recompile every lit program): it drives the level's own `crown` light
 * spec at the heart. Materials are its own (three programs, warmed with the floor: warmKit).
 */
const PHASE_COLOR = [0xff6a2a, 0xff6a2a, 0xff2410, 0xd070ff];

export class Crownheart {
  root = new THREE.Group();
  private core: THREE.Mesh;
  private shell: THREE.Mesh;
  private halo: THREE.Mesh;
  private bands: THREE.Mesh[] = [];
  private coreMat: THREE.MeshStandardMaterial;
  private shellMat: THREE.MeshBasicMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private bandMat: THREE.MeshStandardMaterial;
  private t = 0;
  private phase = 1;
  private color = new THREE.Color(PHASE_COLOR[1]);
  private want = new THREE.Color(PHASE_COLOR[1]);
  /** the level light spec it drives (the brightest crown light at the heart) */
  private light: { intensity: number; color: THREE.Color } | null = null;
  private baseI = 8;
  /** dying: seconds since the Last Crown fell (-1 = alive) */
  private dying = -1;
  broken = false;
  private state: TimeState = 'PRESENT';

  constructor(private g: Game, at: THREE.Vector3) {
    this.root.position.copy(at);
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x2a0402, emissive: this.color.clone(), emissiveIntensity: 2.6, roughness: 0.25, metalness: 0.1, flatShading: true });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), this.coreMat);
    this.core.scale.set(1, 1.35, 1);
    this.shellMat = new THREE.MeshBasicMaterial({ color: this.color.clone(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9, 0), this.shellMat);
    this.shell.scale.set(1, 1.3, 1);
    // a soft halo facing the camera (a radial gradient drawn into a small data texture)
    const n = 64, d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const v = Math.max(0, 1 - r);
      d.set([255, 255, 255, Math.round(255 * v * v * v)], (y * n + x) * 4);
    }
    const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
    tex.needsUpdate = true;
    this.haloMat = new THREE.MeshBasicMaterial({ map: tex, color: this.color.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), this.haloMat);
    this.halo.renderOrder = 3;
    this.bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.55, metalness: 0.85 });
    for (const [rx, rz] of [[0, 0], [Math.PI / 2, 0.4], [Math.PI / 2, -0.9]]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.14, 6, 40), this.bandMat);
      b.rotation.set(rx, 0, rz);
      b.castShadow = false;
      this.bands.push(b);
      this.root.add(b);
    }
    this.root.add(this.core, this.shell, this.halo);
    for (const m of [this.core, this.shell, this.halo]) m.frustumCulled = false;
    g.scene.add(this.root);
    // the level's brightest crown light at the heart
    let best: { intensity: number; color: THREE.Color; pos: THREE.Vector3; kind: string } | null = null;
    for (const l of g.level.lights as unknown as { intensity: number; color: THREE.Color; pos: THREE.Vector3; kind: string }[]) {
      if (l.kind !== 'crown' || l.pos.distanceTo(at) > 3) continue;
      if (!best || l.intensity > best.intensity) best = l;
    }
    if (best) { this.light = best; this.baseI = best.intensity; }
  }

  /** the Last Crown's phase (1..3): the heart's colour and pulse follow */
  setPhase(p: number) { this.phase = p; this.want.setHex(PHASE_COLOR[Math.min(3, Math.max(1, p))]); }

  /** she has fallen: it convulses, then breaks */
  shatter() { if (this.dying < 0) this.dying = 0; }

  setState(st: TimeState) {
    this.state = st;
    // the ruin: the cage is broken and tilted, one band gone
    this.bands[1].visible = st === 'PAST';
    this.bands[0].rotation.z = st === 'PAST' ? 0 : 0.35;
    this.bands[2].rotation.z = st === 'PAST' ? -0.9 : -1.4;
  }

  update(dt: number) {
    if (this.broken) return;
    this.t += dt;
    this.color.lerp(this.want, Math.min(1, dt * 1.5));
    const rate = this.phase === 3 ? 1.5 : this.phase === 2 ? 1.2 : 0.9;
    // lub-dub: two quick swells per beat
    const ph = (this.t * rate) % 1;
    let beat = Math.exp(-Math.pow((ph - 0.08) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.3) / 0.07, 2));
    let spin = 0.15;
    if (this.dying >= 0) {
      this.dying += dt;
      beat = 0.5 + 0.5 * Math.sin(this.dying * (8 + this.dying * 10));
      spin = 0.4 + this.dying;
      this.root.position.x += (Math.random() - 0.5) * 0.06 * this.dying;
      if (this.dying > 2.6) this.breakApart();
    }
    const s = 1 + beat * 0.07;
    this.core.scale.set(s, 1.35 * s, s);
    this.shell.scale.set(s * 1.04, 1.3 * s * 1.04, s * 1.04);
    this.core.rotation.y += dt * spin;
    this.shell.rotation.y -= dt * spin * 0.6;
    this.bands.forEach((b, i) => { b.rotation.y += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1); });
    this.coreMat.emissive.copy(this.color);
    this.coreMat.emissiveIntensity = 2.2 + beat * 2.2;
    this.shellMat.color.copy(this.color);
    this.shellMat.opacity = 0.16 + beat * 0.2;
    this.haloMat.color.copy(this.color);
    this.haloMat.opacity = (this.state === 'PAST' ? 0.4 : 0.55) + beat * 0.3;
    this.halo.quaternion.copy(this.g.camera.quaternion);
    if (this.light) { this.light.intensity = this.baseI * (0.75 + beat * 0.45); this.light.color.copy(this.color); }
  }

  private breakApart() {
    const g = this.g, at = this.root.position.clone();
    this.broken = true;
    this.root.visible = false;
    for (let i = 0; i < 260; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 14);
      g.fx.emit(at.clone().add(v.clone().multiplyScalar(0.12)), v, i % 3 ? this.color.getHex() : 0xfff0e0, 1.2 + Math.random() * 1.4, 0.08 + Math.random() * 0.12, 6);
    }
    g.rig.addShake(0.9);
    g.hud.flash('#ffe8d0', 0.8);
    g.audio.play('shift_boom', { rate: 0.6, vol: 1.3 });
    g.audio.play('rubble', { vol: 1.2 });
    // the chamber's red light dies away
    const lights = (g.level.lights as unknown as { intensity: number; kind: string; pos: THREE.Vector3 }[]).filter((l) => l.kind === 'crown' && l.pos.distanceTo(at) < 40);
    const from = lights.map((l) => l.intensity);
    let k = 0;
    const fade = () => { k += 0.02; lights.forEach((l, i) => { l.intensity = from[i] * Math.max(0.08, 1 - k); }); if (k < 1) g.schedule(0.05, fade); };
    fade();
  }

  /** its three programs for the loading-screen warm-up */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const kit = new THREE.Group();
    kit.add(new THREE.Mesh(this.core.geometry, this.coreMat), new THREE.Mesh(this.shell.geometry, this.shellMat), new THREE.Mesh(this.halo.geometry, this.haloMat), new THREE.Mesh(this.bands[0].geometry, this.bandMat));
    kit.position.copy(at).add(new THREE.Vector3(0, 2, -4));
    kit.traverse((o) => { o.frustumCulled = false; });
    return { objects: [kit], dispose: () => kit.removeFromParent() };
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.coreMat.dispose(); this.shellMat.dispose(); this.haloMat.map?.dispose(); this.haloMat.dispose(); this.bandMat.dispose();
  }
}

/**
 * Abysses read as abysses (session 9 playtest: "the red centre looks like normal ground but I fall through it"):
 * embers rise out of every drop near the hero (`abyss` markers of the current memory), from well below the rim,
 * drifting up and fading — a hole is announced from across the room before anyone walks into it.
 */
export class AbyssEmbers {
  private list: { x: number; y: number; z: number; sx: number; sz: number; state: string; ring: number; acc: number }[] = [];
  constructor(private g: Game) {
    for (const m of g.level.markersOf('abyss')) {
      this.list.push({ x: m.pos.x, y: m.pos.y, z: m.pos.z, sx: m.props.sx ?? 4, sz: m.props.sy ?? 4, state: m.props.state ?? 'BOTH', ring: m.props.ring ?? 0, acc: 0 });
    }
  }
  update(dt: number) {
    const g = this.g, p = g.player.pos, st = g.time.state;
    let budget = 60 * dt;
    for (const a of this.list) {
      if (a.state !== 'BOTH' && a.state !== st) continue;
      const dx = Math.max(0, Math.abs(p.x - a.x) - a.sx / 2), dz = Math.max(0, Math.abs(p.z - a.z) - a.sz / 2);
      if (Math.hypot(dx, dz) > 26 || Math.abs(p.y - a.y) > 22) continue;
      a.acc += dt * Math.min(24, 3 + a.sx * a.sz * 0.08);
      while (a.acc >= 1 && budget > 0) {
        a.acc -= 1; budget--;
        let x = a.x + (Math.random() - 0.5) * a.sx, z = a.z + (Math.random() - 0.5) * a.sz;
        if (a.ring > 0) {
          // a ring abyss (the arena's surround): only outside the platform
          const ang = Math.random() * Math.PI * 2, r = a.ring + 1.5 + Math.random() * 10;
          x = a.x + Math.cos(ang) * r; z = a.z + Math.sin(ang) * r;
        }
        const from = new THREE.Vector3(x, a.y - 2 - Math.random() * 5, z);
        const hot = Math.random() < 0.3;
        g.fx.emit(from, new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4), hot ? 0xffb060 : 0xff4a18, 2.2 + Math.random() * 1.6, 0.035 + Math.random() * 0.05, -0.35, 0.25);
      }
      if (a.acc > 4) a.acc = 4;
    }
  }
}
