import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';

/**
 * Enemy navigation on the baked multi-layer walkability grid (tools/build_navgrid.mjs → floorNN_nav.bin).
 *
 * One variant per memory (and per broken fracture): the grid enemies use is always the memory that is present.
 * Nodes are (column, layer); neighbours connect when their heights differ by at most STEP (stairs, ramps, rubble),
 * diagonals never cut corners, and nodes next to walls/edges cost more so paths keep off walls and pit lips.
 */
const STEP = 0.45;
/** walkers may step DOWN this far (off a tomb lid, a rubble mound, a low ledge) — never up */
const DROP = 1.6;
const MAX_EXPAND = 5000;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

interface Variant {
  key: string; state: TimeState; flags: string[];
  counts: Uint8Array; heights: Int16Array; prefix: Uint32Array; nodes: number;
  /** free radius around each node in cm (bodies wider than it do not fit there) */
  clear: Uint8Array;
  /** per node: 0 unknown, 1 open, 2 near an edge/wall */
  edge: Uint8Array;
}

export class NavGrid {
  readonly cell: number; readonly x0: number; readonly z0: number; readonly nx: number; readonly nz: number;
  private variants: Variant[] = [];
  private cur!: Variant;
  // A* scratch (sized to the largest variant)
  private g!: Float32Array;
  private stamp!: Uint32Array;
  private parent!: Int32Array;
  private closed!: Uint32Array;
  private gen = 1;
  private heap: number[] = [];
  private heapF: number[] = [];
  /** statistics (tests / debug overlay) */
  stats = { plans: 0, failed: 0, expanded: 0, ms: 0 };

  constructor(buf: ArrayBuffer) {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'NAV2') throw new Error('Not a nav grid v2 (magic ' + magic + ') — run node tools/build_navgrid.mjs');
    const hlen = dv.getUint32(4, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
    this.cell = header.cell; this.x0 = header.x0; this.z0 = header.z0; this.nx = header.nx; this.nz = header.nz;
    const cols = this.nx * this.nz, padded = cols + (cols & 1);
    let maxNodes = 0;
    for (const v of header.variants) {
      const base = 8 + hlen + v.offset;
      const counts = new Uint8Array(buf, base, cols);
      const prefix = new Uint32Array(cols + 1);
      for (let i = 0; i < cols; i++) prefix[i + 1] = prefix[i] + counts[i];
      const heights = new Int16Array(buf.slice(base + padded, base + padded + prefix[cols] * 2));
      const clear = new Uint8Array(buf, base + padded + prefix[cols] * 2, prefix[cols]);
      this.variants.push({ key: v.key, state: v.state, flags: v.flags, counts, heights, prefix, nodes: prefix[cols], edge: new Uint8Array(prefix[cols]), clear });
      maxNodes = Math.max(maxNodes, prefix[cols]);
    }
    this.g = new Float32Array(maxNodes);
    this.stamp = new Uint32Array(maxNodes);
    this.parent = new Int32Array(maxNodes);
    this.closed = new Uint32Array(maxNodes);
    this.cur = this.variants[0];
  }

  /** Select the memory (and broken fractures) enemies walk in. */
  use(state: TimeState, flags: Set<string>) {
    let best: Variant | null = null;
    for (const v of this.variants) {
      if (v.state !== state) continue;
      if (v.flags.every((f) => flags.has(f)) && (!best || v.flags.length > best.flags.length)) best = v;
    }
    if (best) this.cur = best;
  }
  get variantKey() { return this.cur.key; }

  // ------------------------------------------------------------------ node helpers
  private colOf(x: number, z: number) {
    const ix = Math.floor((x - this.x0) / this.cell), iz = Math.floor((z - this.z0) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return -1;
    return iz * this.nx + ix;
  }
  private h(node: number) { return this.cur.heights[node] / 100; }
  /**
   * The layer of column `col` near height y (closest), or -1: up to `tol` below, but never more than a step
   * ABOVE (a surface 0.9 m over the feet — a tomb lid — is not where a creature stands).
   */
  private layerNear(col: number, y: number, tol: number) {
    const v = this.cur;
    let best = -1, bd = Infinity;
    const up = Math.min(tol, STEP);
    for (let n = v.prefix[col], e = v.prefix[col + 1]; n < e; n++) {
      const d = v.heights[n] / 100 - y;
      if (d > up || d < -tol) continue;
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = n; }
    }
    return best;
  }
  private colOfNode(node: number) {
    // binary search in prefix
    const p = this.cur.prefix;
    let lo = 0, hi = p.length - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (p[mid] <= node) lo = mid; else hi = mid - 1; }
    return lo;
  }
  /** Nearest node to a world point (same column first, then a small ring). */
  nodeAt(p: THREE.Vector3, tol = 0.9, ring = 2): number {
    const c = this.colOf(p.x, p.z);
    if (c >= 0) { const n = this.layerNear(c, p.y, tol); if (n >= 0) return n; }
    const ix0 = Math.floor((p.x - this.x0) / this.cell), iz0 = Math.floor((p.z - this.z0) / this.cell);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= ring; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const ix = ix0 + dx, iz = iz0 + dz;
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
      const n = this.layerNear(iz * this.nx + ix, p.y, tol);
      if (n < 0) continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  /** Centre of the nearest walkable node to p (same level, within `ring` cells), or null. */
  nearestWalkable(p: THREE.Vector3, ring = 3, out = new THREE.Vector3()): THREE.Vector3 | null {
    const n = this.nodeAt(p, 0.6, ring);
    return n < 0 ? null : this.center(n, out);
  }

  /** Is there walkable ground under p in the current memory? */
  walkable(p: THREE.Vector3, tol = 0.6) { return this.nodeAt(p, tol, 0) >= 0; }
  private center(node: number, out: THREE.Vector3) {
    const col = this.colOfNode(node);
    const ix = col % this.nx, iz = (col / this.nx) | 0;
    return out.set(this.x0 + (ix + 0.5) * this.cell, this.h(node), this.z0 + (iz + 0.5) * this.cell);
  }

  /** body radius of the current query (cm, with a little tolerance); nodes narrower than it are not used */
  private body = 0;
  private fits(n: number) { return n >= 0 && this.cur.clear[n] >= this.body ? n : -1; }

  private neighbour(col: number, y: number, dx: number, dz: number) {
    const ix = col % this.nx + dx, iz = ((col / this.nx) | 0) + dz;
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return -1;
    const c = iz * this.nx + ix;
    const n = this.fits(this.layerNear(c, y, STEP));
    if (n >= 0) return n;
    // one-way drop: the highest layer below within DROP
    const v = this.cur;
    let best = -1, bh = -Infinity;
    for (let m = v.prefix[c], e = v.prefix[c + 1]; m < e; m++) {
      const hh = v.heights[m] / 100;
      if (hh < y - STEP && hh >= y - DROP && hh > bh && v.clear[m] >= this.body) { bh = hh; best = m; }
    }
    return best;
  }
  /** 2 when the node touches a wall, a drop or a ledge (paths keep off them), 1 otherwise; cached */
  private edgeOf(node: number, col: number) {
    const v = this.cur;
    if (v.edge[node]) return v.edge[node];
    const y = this.h(node);
    let e = 1;
    for (let k = 0; k < 4; k++) if (this.neighbour(col, y, DIRS[k][0], DIRS[k][1]) < 0) { e = 2; break; }
    v.edge[node] = e;
    return e;
  }

  // ------------------------------------------------------------------ queries
  /**
   * Walkable straight line from a to b in this memory: the ground is continuous (no wall, no step over STEP, no
   * gap) along every column the segment crosses. Used to decide when enemies may chase directly.
   */
  clearLine(a: THREE.Vector3, b: THREE.Vector3, radius = 0.3): boolean {
    this.body = Math.max(0, Math.round(radius * 100) - 6);
    let n = this.nodeAt(a, 0.9, 1);
    if (n < 0) return false;
    let y = this.h(n);
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.cell * 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const c = this.colOf(a.x + dx * t, a.z + dz * t);
      if (c < 0) return false;
      let m = this.fits(this.layerNear(c, y, STEP));
      if (m < 0) {
        // a short drop is still a straight walk (off a tomb, down a rubble lip)
        const v = this.cur;
        let bh = -Infinity;
        for (let k = v.prefix[c], e = v.prefix[c + 1]; k < e; k++) { const hh = v.heights[k] / 100; if (hh < y - STEP && hh >= y - DROP && hh > bh && v.clear[k] >= this.body) { bh = hh; m = k; } }
        if (m < 0) return false;
      }
      y = this.h(m);
    }
    return Math.abs(y - b.y) < 1.2;
  }

  /** true when the last path() reached its goal; false = it leads to the closest reachable point instead */
  reached = false;

  /**
   * A* from a to b; returns smoothed world waypoints (excluding the start). When b cannot be reached the path
   * leads to the closest reachable node (`reached` = false); null when a is not on the grid at all.
   */
  path(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3[] = [], radius = 0.3): THREE.Vector3[] | null {
    const t0 = performance.now();
    const body = Math.max(0, Math.round(radius * 100) - 6);
    this.stats.plans++;
    const s = this.nodeAt(a, 1.0, 2), goal = this.nodeAt(b, 1.6, 3);
    if (s < 0 || goal < 0) { this.stats.failed++; return null; }
    this.body = body;
    const gen = ++this.gen;
    const heap = this.heap, heapF = this.heapF;
    heap.length = 0; heapF.length = 0;
    const gc = this.colOfNode(goal);
    const gx = gc % this.nx, gz = (gc / this.nx) | 0, gy = this.h(goal);
    const hf = (col: number, y: number) => {
      const ddx = Math.abs(col % this.nx - gx), ddz = Math.abs(((col / this.nx) | 0) - gz);
      return (Math.max(ddx, ddz) + 0.414 * Math.min(ddx, ddz)) + Math.abs(y - gy) * 2;
    };
    this.g[s] = 0; this.stamp[s] = gen; this.parent[s] = -1;
    this.push(s, hf(this.colOfNode(s), this.h(s)));
    let found = false, expanded = 0, closest = s, closestH = Infinity;
    while (heap.length) {
      const n = this.pop();
      if (this.closed[n] === gen) continue;
      this.closed[n] = gen;
      if (n === goal) { found = true; break; }
      const hn = hf(this.colOfNode(n), this.h(n));
      if (hn < closestH) { closestH = hn; closest = n; }
      if (++expanded > MAX_EXPAND) break;
      const col = this.colOfNode(n), y = this.h(n);
      for (let k = 0; k < 8; k++) {
        const [dx, dz] = DIRS[k];
        const m = this.neighbour(col, y, dx, dz);
        if (m < 0) continue;
        if (k >= 4 && (this.neighbour(col, y, dx, 0) < 0 || this.neighbour(col, y, 0, dz) < 0)) continue; // no corner cutting
        const mc = col + dz * this.nx + dx;
        const cost = (k >= 4 ? 1.414 : 1) * (this.edgeOf(m, mc) === 2 ? 1.8 : 1) + Math.abs(this.h(m) - y) * 1.5;
        const ng = this.g[n] + cost;
        if (this.stamp[m] === gen && ng >= this.g[m]) continue;
        this.stamp[m] = gen; this.g[m] = ng; this.parent[m] = n;
        this.push(m, ng + hf(mc, this.h(m)));
      }
    }
    this.stats.expanded += expanded;
    this.stats.ms += performance.now() - t0;
    this.reached = found;
    if (!found) this.stats.failed++;
    const end = found ? goal : closest;
    // back-track, then pull the string: keep only the corners a straight walk cannot skip
    const nodes: number[] = [];
    for (let n = end; n >= 0; n = this.parent[n]) nodes.push(n);
    nodes.reverse();
    const pts = nodes.map((n) => this.center(n, new THREE.Vector3()));
    out.length = 0;
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.clearLine(pts[i], pts[j], radius)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  private push(n: number, f: number) {
    const h = this.heap, hf = this.heapF;
    h.push(n); hf.push(f);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      h[i] = h[p]; hf[i] = hf[p]; i = p;
    }
    h[i] = n; hf[i] = f;
  }
  private pop() {
    const h = this.heap, hf = this.heapF;
    const top = h[0];
    const n = h.pop()!, f = hf.pop()!;
    if (h.length) {
      let i = 0;
      const len = h.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= len) break;
        if (c + 1 < len && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= f) break;
        h[i] = h[c]; hf[i] = hf[c]; i = c;
      }
      h[i] = n; hf[i] = f;
    }
    return top;
  }
}
