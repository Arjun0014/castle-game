import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { TimeState } from '../levels/Materials';

export interface CapsuleResult {
  grounded: boolean;
  groundNormal: THREE.Vector3;
  hitCeiling: boolean;
  hitWall: boolean;
  push: THREE.Vector3;
}

const _seg = new THREE.Line3();
const _box = new THREE.Box3();
const _tri = new THREE.Vector3();
const _cap = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fn = new THREE.Vector3();
const _v = new THREE.Vector3();
const _ray = new THREE.Ray();
const DIRS6 = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];

/** Void (kill) volume, axis-aligned in three.js space. */
export interface VoidVolume { box: THREE.Box3; state: TimeState | 'BOTH'; }

/**
 * Static collision for both temporal states (SHARED ∪ state geometry, one BVH per state).
 * Capsule is described by its feet position, radius and total height.
 */
export class CollisionWorld {
  bvh: Record<TimeState, MeshBVH>;
  meshes: Record<TimeState, THREE.Mesh>;
  voids: VoidVolume[] = [];

  constructor(geoms: Record<TimeState, THREE.BufferGeometry>) {
    this.bvh = {
      PAST: new MeshBVH(geoms.PAST, { maxLeafSize: 8 }),
      PRESENT: new MeshBVH(geoms.PRESENT, { maxLeafSize: 8 }),
    };
    const mat = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00ff66, transparent: true, opacity: 0.25 });
    this.meshes = {
      PAST: new THREE.Mesh(geoms.PAST, mat),
      PRESENT: new THREE.Mesh(geoms.PRESENT, mat.clone()),
    };
    (this.meshes.PRESENT.material as THREE.MeshBasicMaterial).color.set(0x55aaff);
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) {
      (this.meshes[s].geometry as any).boundsTree = this.bvh[s];
      this.meshes[s].visible = false;
    }
  }

  dispose() {
    for (const s of ['PAST', 'PRESENT'] as TimeState[]) {
      const m = this.meshes[s];
      m.removeFromParent();
      (m.geometry as any).boundsTree = undefined;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.dynamic.length = 0;
    this.voids.length = 0;
  }

  /** Replace a state's static collision (fracture flags change the world). */
  replace(state: TimeState, geom: THREE.BufferGeometry) {
    const old = this.meshes[state].geometry;
    this.bvh[state] = new MeshBVH(geom, { maxLeafSize: 8 });
    this.meshes[state].geometry = geom;
    (geom as any).boundsTree = this.bvh[state];
    old.dispose();
  }

  /**
   * Push a capsule out of geometry. Mutates `feet`. Returns contact info.
   * `vertGround` (the hero): a walkable FACE under her (not an edge) is resolved straight up, by depth / n.y, instead of
   * along its normal. Grounded, she is pulled into the floor every frame; on a ramp or a stair wedge the normal push
   * had a downhill component, so standing still she crept down the stairs (session 11). Walls, ledge edges and
   * slopes too steep to stand on (n.y ≤ 0.55) keep the normal push — they still shove her off.
   */
  resolveCapsule(feet: THREE.Vector3, radius: number, height: number, state: TimeState, out?: CapsuleResult, vertGround = false): CapsuleResult {
    const res = out ?? { grounded: false, groundNormal: new THREE.Vector3(0, 1, 0), hitCeiling: false, hitWall: false, push: new THREE.Vector3() };
    res.grounded = false; res.hitCeiling = false; res.hitWall = false;
    res.groundNormal.set(0, 1, 0);
    _seg.start.set(feet.x, feet.y + radius, feet.z);
    _seg.end.set(feet.x, feet.y + height - radius, feet.z);
    const startX = _seg.start.x, startY = _seg.start.y, startZ = _seg.start.z;
    let bestUp = -1;
    for (let iter = 0; iter < 3; iter++) {
      _box.makeEmpty();
      _box.expandByPoint(_seg.start);
      _box.expandByPoint(_seg.end);
      _box.min.addScalar(-radius);
      _box.max.addScalar(radius);
      let any = false;
      this.bvh[state].shapecast({
        intersectsBounds: (b) => b.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(_seg, _tri, _cap);
          if (d < radius) {
            const depth = radius - d;
            _dir.subVectors(_cap, _tri);
            if (_dir.lengthSq() < 1e-12) tri.getNormal(_dir); else _dir.normalize();
            let vertical = false;
            if (vertGround && _dir.y > 0.55) {
              tri.getNormal(_fn);
              if (_fn.y < 0) _fn.negate();
              vertical = _fn.dot(_dir) > 0.985; // the face itself, not one of its edges
            }
            if (vertical) {
              const lift = depth / _dir.y;
              _seg.start.y += lift;
              _seg.end.y += lift;
            } else {
              _seg.start.addScaledVector(_dir, depth);
              _seg.end.addScaledVector(_dir, depth);
            }
            any = true;
            if (_dir.y > 0.55) {
              res.grounded = true;
              if (_dir.y > bestUp) { bestUp = _dir.y; res.groundNormal.copy(_dir); }
            } else if (_dir.y < -0.55) res.hitCeiling = true;
            else res.hitWall = true;
          }
          return false;
        },
      });
      if (!any) break;
    }
    res.push.set(_seg.start.x - startX, _seg.start.y - startY, _seg.start.z - startZ);
    feet.add(res.push);
    if (this.dynamic.length) {
      const before = feet.clone();
      this.resolveDynamic(feet, radius, height, state, res);
      res.push.add(feet.clone().sub(before));
    }
    return res;
  }

  /** Does the capsule overlap geometry of `state` at feet (no mutation)? Returns penetration push length. */
  overlap(feet: THREE.Vector3, radius: number, height: number, state: TimeState): number {
    _v.copy(feet);
    const r = this.resolveCapsule(_v, radius, height, state);
    return r.push.length();
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, far: number, state: TimeState): THREE.Intersection | null {
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    const hit = this.bvh[state].raycastFirst(_ray, THREE.DoubleSide, 0, far);
    return hit ?? null;
  }

  /**
   * Is `p` buried inside closed collision volumes? Surface depenetration cannot see a capsule that is
   * fully inside a thick wall, so cast rays along the six axes: hitting a back face (normal pointing
   * along the ray) means we are inside. Majority vote tolerates open meshes (rubble mounds).
   */
  insideSolid(p: THREE.Vector3, state: TimeState): boolean {
    let inside = 0, hits = 0;
    for (const d of DIRS6) {
      const hit = this.raycast(p, d, 60, state);
      if (!hit || !hit.face) continue;
      hits++;
      if (hit.face.normal.dot(d) > 0.05) inside++;
    }
    return inside >= 3 && inside >= hits - 2;
  }

  /** Capsule is buried in solid geometry at any of three heights. */
  capsuleBuried(feet: THREE.Vector3, height: number, state: TimeState): boolean {
    for (const h of [0.4, height * 0.5, height - 0.3]) {
      _v.set(feet.x, feet.y + h, feet.z);
      if (this.insideSolid(_v.clone(), state)) return true;
    }
    return false;
  }

  groundBelow(feet: THREE.Vector3, maxDrop: number, state: TimeState): number | null {
    _v.set(feet.x, feet.y + 0.5, feet.z);
    const hit = this.raycast(_v, new THREE.Vector3(0, -1, 0), maxDrop + 0.5, state);
    return hit ? hit.point.y : null;
  }

  /** Dynamic box colliders (arena locks, doors) toggled at runtime, per state. */
  dynamic: { box: THREE.Box3; state: TimeState | 'BOTH'; enabled: boolean; name: string }[] = [];

  private resolveDynamic(feet: THREE.Vector3, radius: number, height: number, state: TimeState, res: CapsuleResult) {
    for (const d of this.dynamic) {
      if (!d.enabled || (d.state !== state && d.state !== 'BOTH')) continue;
      let best = Infinity;
      const bp = new THREE.Vector3(), sp = new THREE.Vector3();
      for (let i = 0; i <= 6; i++) {
        const q = new THREE.Vector3(feet.x, feet.y + radius + (height - 2 * radius) * (i / 6), feet.z);
        const c = d.box.clampPoint(q, new THREE.Vector3());
        const dist = c.distanceTo(q);
        if (dist < best) { best = dist; bp.copy(c); sp.copy(q); }
      }
      if (best < radius) {
        const n = best > 1e-5 ? sp.clone().sub(bp).normalize() : new THREE.Vector3(0, 1, 0);
        feet.addScaledVector(n, radius - best);
        if (n.y > 0.55) { res.grounded = true; res.groundNormal.copy(n); }
        else if (n.y < -0.55) res.hitCeiling = true; else res.hitWall = true;
      }
    }
  }

  inVoid(p: THREE.Vector3, state: TimeState): boolean {
    for (const v of this.voids) {
      if ((v.state === state || v.state === 'BOTH') && v.box.containsPoint(p)) return true;
    }
    return false;
  }

  /** True if a vertical probe from `feet` downward reaches ground (not a void) within maxDrop. */
  hasFooting(feet: THREE.Vector3, maxDrop: number, state: TimeState): boolean {
    const g = this.groundBelow(feet, maxDrop, state);
    if (g === null) return false;
    _v.set(feet.x, g - 0.2, feet.z);
    return !this.inVoid(_v, state);
  }
}
