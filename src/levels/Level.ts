import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld } from '../game/Physics';
import { MaterialLibrary, type TimeState } from './Materials';
import { Fires } from '../vfx/Fire';
import type { VegProto } from '../assets/GameAssets';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';
import { Platform } from '../platform/Platform';

export type Group = 'SHARED' | TimeState;

export interface Marker {
  kind: string;
  name: string;
  section: string;
  group: Group;
  pos: THREE.Vector3;           // three.js space
  size?: THREE.Vector3;         // full extents (three.js space, x/y/z)
  box?: THREE.Box3;
  props: Record<string, any>;
}

interface LightSpec { pos: THREE.Vector3; color: THREE.Color; intensity: number; range: number; state: TimeState | 'BOTH'; kind: string; phase: number; }

/** Blender (x, y, z) → three.js (x, z, -y). Sizes swap y/z without sign. */
export function b2t(x: number, y: number, z: number) { return new THREE.Vector3(x, z, -y); }

/** Group strings: "SHARED" | "PAST" | "PRESENT", optionally "|FLAG" (only once FLAG is broken) or "|!FLAG". */
export function parseGroup(g: string): { base: Group; flag?: string; neg?: boolean } {
  const [base, cond] = (g || 'SHARED').split('|');
  if (!cond) return { base: base as Group };
  return cond.startsWith('!') ? { base: base as Group, flag: cond.slice(1), neg: true } : { base: base as Group, flag: cond };
}

export class Level {
  root = new THREE.Group();
  groups = new Map<string, THREE.Group>(); // `${section}.${group}`
  sharedMeshes: { mesh: THREE.Mesh; key: string }[] = [];
  stateMeshes: Record<TimeState, THREE.Mesh[]> = { PAST: [], PRESENT: [] };
  markers: Marker[] = [];
  collision!: CollisionWorld;
  lights: LightSpec[] = [];
  lightPool: THREE.PointLight[] = [];
  fires!: Fires;
  vegetation: Record<TimeState, THREE.Object3D[]> = { PAST: [], PRESENT: [] };
  state: TimeState = 'PRESENT';
  stats = { meshes: 0, tris: 0, collisionTris: 0 };
  /** Broken resonant fractures (permanent world state). */
  flags = new Set<string>();
  private colParts: { base: Group; flag?: string; neg?: boolean; geo: THREE.BufferGeometry }[] = [];
  private condOk(p: { flag?: string; neg?: boolean }) { return !p.flag || this.flags.has(p.flag) !== !!p.neg; }

  constructor(public mats: MaterialLibrary) {}

  /**
   * Build the floor from its loaded GLBs. The visual GLB's meshes are taken over (re-parented into state
   * groups, owned and disposed by this Level); the collision GLB is only read (merged copies).
   */
  build(vis: GLTF, col: GLTF) {
    vis.scene.updateMatrixWorld(true);
    const toAdd: THREE.Object3D[] = [];
    vis.scene.traverse((o) => {
      const ex = o.userData ?? {};
      if (ex.marker) {
        const m: Marker = {
          kind: ex.marker, name: ex.mk_name ?? o.name,
          section: ex.section, group: ex.group, pos: o.getWorldPosition(new THREE.Vector3()), props: ex,
        };
        if (ex.size) {
          m.size = new THREE.Vector3(ex.size[0], ex.size[2], ex.size[1]);
          m.box = new THREE.Box3().setFromCenterAndSize(m.pos, m.size);
        }
        this.markers.push(m);
        return;
      }
      if ((o as THREE.Mesh).isMesh && ex.group) toAdd.push(o);
    });
    for (const o of toAdd) {
      const mesh = o as THREE.Mesh;
      const ex = mesh.userData;
      const key = ex.mat as string;
      const pg = parseGroup(ex.group as string);
      const group = pg.base;
      const gkey = `${ex.section}.${ex.group}`;
      let g = this.groups.get(gkey);
      if (!g) {
        g = new THREE.Group();
        g.name = gkey;
        g.userData = { section: ex.section, group, flag: pg.flag, neg: pg.neg };
        this.groups.set(gkey, g);
        this.root.add(g);
      }
      mesh.removeFromParent();
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      mesh.applyMatrix4(o.matrixWorld);
      if (key === 'fx_sigil') {
        // the sigil shader draws its runes in object space: move the origin to the disc centre
        mesh.geometry.computeBoundingBox();
        const c = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
        mesh.geometry.translate(-c.x, -c.y, -c.z);
        mesh.position.add(c.multiply(mesh.scale).applyQuaternion(mesh.quaternion));
      }
      mesh.material = this.mats.get(key, group === 'SHARED' ? this.state : group, group);
      mesh.castShadow = !key.startsWith('fx_');
      mesh.receiveShadow = true;
      mesh.userData.matKey = key;
      if (group === 'SHARED') this.sharedMeshes.push({ mesh, key });
      else this.stateMeshes[group].push(mesh);
      g.add(mesh);
      this.stats.meshes++;
      this.stats.tris += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3;
    }
    // collision: merge SHARED ∪ state per state (fracture-conditional parts included when their flag allows)
    col.scene.updateMatrixWorld(true);
    col.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pg = parseGroup(m.userData.group as string);
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
      this.colParts.push({ ...pg, geo: geo.index ? geo.toNonIndexed() : geo });
    });
    this.collision = new CollisionWorld({ PAST: this.mergedCollision('PAST'), PRESENT: this.mergedCollision('PRESENT') });
    this.stats.collisionTris = this.collision.meshes.PAST.geometry.attributes.position.count / 3;
    this.root.add(this.collision.meshes.PAST, this.collision.meshes.PRESENT);
    for (const m of this.markers) {
      if (m.kind === 'void' && m.box) this.collision.voids.push({ box: m.box, state: m.props.state });
      if (m.kind === 'light') {
        if (!m.props.intensity) continue;
        this.lights.push({
          pos: m.pos, color: new THREE.Color('#' + m.props.color), intensity: m.props.intensity,
          range: m.props.range, state: m.props.state, kind: m.props.kind, phase: Math.random() * 10,
        });
      }
    }
    this.buildLightPool(Platform.quality.pointLights);
    this.buildFires();
    stabilizeShadowDepth(this.root);
    this.applyState(this.state);
  }

  private mergedCollision(s: TimeState) {
    const list = this.colParts.filter((p) => (p.base === 'SHARED' || p.base === s) && this.condOk(p)).map((p) => p.geo);
    if (!list.length) throw new Error('No collision geometry for ' + s);
    return mergeGeometries(list, false)!;
  }

  /** Break a resonant fracture: conditional geometry and collision switch for good. */
  setFlag(flag: string) {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) this.collision.replace(s, this.mergedCollision(s));
    this.applyState(this.state);
  }

  /** Meshes of the conditional groups `STATE|!flag` (the things that will fall). */
  flagGroups(flag: string, neg: boolean) {
    return [...this.groups.values()].filter((g) => g.userData.flag === flag && !!g.userData.neg === neg);
  }

  markersOf(kind: string) { return this.markers.filter((m) => m.kind === kind); }
  marker(kind: string, name: string) {
    const m = this.markers.find((x) => x.kind === kind && x.name === name);
    if (!m) throw new Error(`Marker ${kind}:${name} missing from the floor GLB`);
    return m;
  }

  private buildLightPool(n: number) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.castShadow = false;
      this.lightPool.push(l);
      this.root.add(l);
    }
  }

  private buildFires() {
    this.fires = new Fires(this.root, this.markersOf('fire').map((m) => ({ pos: m.pos, size: m.props.size ?? 0.5, state: m.props.state ?? 'PAST' })));
  }

  /** Swap shared materials and state-group visibility. */
  applyState(state: TimeState, keepOther = false) {
    this.state = state;
    for (const { mesh, key } of this.sharedMeshes) mesh.material = this.mats.get(key, state, 'SHARED');
    for (const [, g] of this.groups) {
      const grp = g.userData.group as Group;
      g.visible = (grp === 'SHARED' || grp === state || (keepOther && grp !== state)) && this.condOk(g.userData);
    }
    this.fires?.applyState(state);
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) for (const v of this.vegetation[s]) v.visible = s === state || keepOther;
  }

  showBothForTransition(on: boolean) {
    for (const [, g] of this.groups) {
      const grp = g.userData.group as Group;
      if (grp !== 'SHARED') g.visible = (on ? true : grp === this.state) && this.condOk(g.userData);
    }
  }

  update(dt: number, t: number, focus: THREE.Vector3) {
    // assign the pooled point lights to the nearest active light sources
    const active = this.lights
      .filter((l) => l.state === 'BOTH' || l.state === this.state)
      .map((l) => ({ l, d: l.pos.distanceToSquared(focus) - (l.kind === 'crown' ? 900 : 0) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lightPool.length);
    for (let i = 0; i < this.lightPool.length; i++) {
      const pl = this.lightPool[i];
      const a = active[i];
      // never toggle visibility: the number of visible lights is part of every lit shader's program key
      if (!a) { pl.intensity = 0; continue; }
      const l = a.l;
      pl.position.copy(l.pos);
      pl.color.copy(l.color);
      pl.distance = l.range * 1.4;
      const flick = l.kind === 'torch' || l.kind === 'brazier' || l.kind === 'hearth' || l.kind === 'candle' || l.kind === 'lantern'
        ? 0.82 + 0.18 * Math.sin(t * 9 + l.phase) * Math.sin(t * 5.3 + l.phase * 2)
        : 0.9 + 0.1 * Math.sin(t * 1.3 + l.phase);
      pl.intensity = l.intensity * flick;
    }
    void dt;
  }

  /** Instanced vegetation from `veg` markers using the loaded vegetation prototypes (shared, not owned). */
  buildVegetation(protos: Record<string, VegProto[]>) {
    const byKind = new Map<string, Marker[]>();
    for (const m of this.markersOf('veg')) {
      const key = `${m.props.kind}|${m.props.state ?? 'PRESENT'}`;
      if (!byKind.has(key)) byKind.set(key, []);
      byKind.get(key)!.push(m);
    }
    const dummy = new THREE.Object3D();
    for (const [key, list] of byKind) {
      const [kind, state] = key.split('|') as [string, TimeState];
      const proto = protos[kind];
      if (!proto) throw new Error('Unknown vegetation kind ' + kind);
      for (const part of proto) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((m, i) => {
          dummy.position.copy(m.pos);
          dummy.rotation.set(0, m.props.yaw ?? 0, 0);
          dummy.scale.setScalar(part.scale * (m.props.scale ?? 1));
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.receiveShadow = true;
        this.root.add(im);
        this.vegetation[state].push(im);
      }
    }
    this.applyState(this.state);
  }

  /** Warm-up: every group (both states, fracture-conditional too), vegetation and fires visible. */
  forceAllVisible(on: boolean) {
    if (on) {
      for (const [, g] of this.groups) g.visible = true;
      for (const s of ['PAST', 'PRESENT'] as TimeState[]) for (const v of this.vegetation[s]) v.visible = true;
      for (const [, im] of this.fires.meshes) im.visible = true;
    } else this.applyState(this.state);
  }

  /** Every mesh this level draws (warm-up / stats). */
  allMeshes() {
    const out: THREE.Mesh[] = [];
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); });
    return out;
  }

  /** Free everything the level owns: its meshes' geometry, collision + BVHs, fires, instancing buffers. */
  dispose() {
    this.root.removeFromParent();
    for (const { mesh } of this.sharedMeshes) mesh.geometry.dispose();
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) for (const m of this.stateMeshes[s]) m.geometry.dispose();
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) for (const v of this.vegetation[s]) (v as THREE.InstancedMesh).dispose();
    this.fires?.dispose();
    this.collision?.dispose();
    for (const p of this.colParts) p.geo.dispose();
    for (const l of this.lightPool) l.dispose();
    this.colParts = [];
    this.sharedMeshes = [];
    this.stateMeshes = { PAST: [], PRESENT: [] };
    this.vegetation = { PAST: [], PRESENT: [] };
    this.groups.clear();
    this.markers = [];
    this.lights = [];
    this.lightPool = [];
    this.root.clear();
  }
}
