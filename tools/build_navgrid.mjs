#!/usr/bin/env node
// Enemy navigation data, baked at build time from each floor's collision (session 7).
//
//   node tools/build_navgrid.mjs [1 2 3]      → public/assets/levels/floorNN_nav.bin
//
// For every memory of a floor (PAST, PRESENT, and each fracture-flag variant such as "PRESENT|FR1") the walkable
// surfaces are sampled on a 0.5 m grid with MULTIPLE LAYERS per column (galleries over halls, stairs, crypts under
// chapels): a downward ray walks through the geometry; every up-facing surface with a free capsule above it
// (radius 0.3 m, 1.75 m of headroom) that is not inside a void volume becomes a node. The runtime (src/enemies/
// NavGrid.ts) connects neighbouring nodes whose heights differ by at most a step and runs A* on them, so enemies
// path round props, through doors and up stairs in the memory that is actually present — and know when the hero
// cannot be reached at all.
//
// File: "NAV2" · u32 header length · JSON header {cell, x0, z0, nx, nz, variants:[{key, flags, offset, nodes}]} ·
// per variant: Uint8 layer count per column (padded to even), Int16 heights in cm (three.js y, column order), Uint8
// clearance per node in cm (free radius at knee/waist/chest, capped at 2.55 m — big enemies only use wide nodes).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { NodeIO } from '@gltf-transform/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CELL = 0.5, RADIUS = 0.3, HEADROOM = 1.75, MIN_UP = 0.6;
const io = new NodeIO();

function parseGroup(g) {
  const [base, cond] = String(g || 'SHARED').split('|');
  if (!cond) return { base };
  return cond.startsWith('!') ? { base, flag: cond.slice(1), neg: true } : { base, flag: cond };
}

async function bake(id) {
  const tag = String(id).padStart(2, '0');
  const col = await io.read(path.join(ROOT, `public/assets/levels/floor${tag}_collision.glb`));
  const vis = await io.read(path.join(ROOT, `public/assets/levels/floor${tag}.glb`));
  const parts = [];
  const flagSet = new Set();
  for (const n of col.getRoot().listNodes()) {
    const m = n.getMesh();
    if (!m) continue;
    const g = parseGroup(n.getExtras().group ?? m.getExtras().group);
    if (g.flag) flagSet.add(g.flag);
    const wm = new THREE.Matrix4().fromArray(n.getWorldMatrix());
    for (const prim of m.listPrimitives()) {
      const pos = prim.getAttribute('POSITION').getArray();
      const idx = prim.getIndices()?.getArray();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      if (idx) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
      geo.applyMatrix4(wm);
      parts.push({ ...g, geo: geo.index ? geo.toNonIndexed() : geo });
    }
  }
  const voids = [];
  for (const n of vis.getRoot().listNodes()) {
    const ex = n.getExtras();
    if (ex.marker !== 'void' || !ex.size) continue;
    const c = new THREE.Vector3().fromArray(n.getWorldTranslation());
    const s = new THREE.Vector3(ex.size[0], ex.size[2], ex.size[1]);
    voids.push({ box: new THREE.Box3().setFromCenterAndSize(c, s), state: ex.state });
  }
  const flags = [...flagSet].sort();
  // variants: each state with no flag broken, and with each flag broken (floors have at most one or two)
  const variants = [];
  for (const st of ['PAST', 'PRESENT']) {
    variants.push({ key: st, state: st, flags: [] });
    for (const f of flags) variants.push({ key: `${st}|${f}`, state: st, flags: [f] });
  }
  const bounds = new THREE.Box3();
  for (const p of parts) { p.geo.computeBoundingBox(); bounds.union(p.geo.boundingBox); }
  const x0 = Math.floor(bounds.min.x) - 1, z0 = Math.floor(bounds.min.z) - 1;
  const nx = Math.ceil((bounds.max.x + 1 - x0) / CELL), nz = Math.ceil((bounds.max.z + 1 - z0) / CELL);
  const top = bounds.max.y + 2, bottom = bounds.min.y - 1;
  const chunks = [], header = { cell: CELL, x0, z0, nx, nz, variants: [] };
  let offset = 0, t0 = Date.now();
  for (const v of variants) {
    const list = parts.filter((p) => (p.base === 'SHARED' || p.base === v.state) && (!p.flag || v.flags.includes(p.flag) !== !!p.neg));
    const merged = mergeGeos(list.map((p) => p.geo));
    const bvh = new MeshBVH(merged);
    const vv = voids.filter((q) => q.state === v.state || q.state === 'BOTH');
    const counts = new Uint8Array(nx * nz + ((nx * nz) & 1));
    const heights = [], clearCm = [];
    const ray = new THREE.Ray(), down = new THREE.Vector3(0, -1, 0), up = new THREE.Vector3(0, 1, 0);
    const probe = new THREE.Vector3(), target = {};
    let nodes = 0;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + (ix + 0.5) * CELL, z = z0 + (iz + 0.5) * CELL;
      let y = top, layers = 0;
      const col = [];
      for (let k = 0; k < 14 && y > bottom; k++) {
        ray.origin.set(x, y, z); ray.direction.copy(down);
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, y - bottom);
        if (!hit) break;
        const hy = hit.point.y;
        y = hy - 0.03;
        if (!hit.face || hit.face.normal.y < MIN_UP) continue;
        // headroom
        ray.origin.set(x, hy + 0.05, z); ray.direction.copy(up);
        if (bvh.raycastFirst(ray, THREE.DoubleSide, 0, HEADROOM)) continue;
        // capsule clearance (walls, props) at knee, waist, chest
        // standable: nothing within the minimum body radius at knee, waist and chest (the floor is 0.45 m below
        // the knee probe, so this cannot see it)
        let ok = true;
        for (const h of [0.45, 0.95, 1.45]) {
          probe.set(x, hy + h, z);
          const near = bvh.closestPointToPoint(probe, target, 0, RADIUS);
          if (near && near.distance < RADIUS) { ok = false; break; }
        }
        if (!ok) continue;
        // clearance = horizontal distance to the nearest wall / prop (8 directions at shin and chest height):
        // wider bodies (wardens, the bosses) only path where they fit
        let free = 2.55;
        for (const h of [0.6, 1.3]) for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ray.origin.set(x, hy + h, z); ray.direction.set(Math.cos(a), 0, Math.sin(a));
          const w = bvh.raycastFirst(ray, THREE.DoubleSide, 0, free);
          if (w) free = Math.min(free, w.distance);
        }
        probe.set(x, hy + 0.05, z);
        if (vv.some((q) => q.box.containsPoint(probe))) continue;
        col.push(Math.round(hy * 100));
        clearCm.push(Math.min(255, Math.round(free * 100)));
        if (++layers >= 6) break;
      }
      counts[iz * nx + ix] = col.length;
      for (const h of col) heights.push(h);
      nodes += col.length;
    }
    const hArr = new Int16Array(heights);
    const cArr = new Uint8Array(clearCm.length + (clearCm.length & 1));
    cArr.set(clearCm);
    header.variants.push({ key: v.key, state: v.state, flags: v.flags, offset, nodes });
    chunks.push(Buffer.from(counts.buffer), Buffer.from(hArr.buffer), Buffer.from(cArr.buffer));
    offset += counts.byteLength + hArr.byteLength + cArr.byteLength;
    merged.dispose();
    console.log(`floor ${id} ${v.key}: ${nodes} walkable nodes (${(Date.now() - t0) / 1000}s)`);
  }
  const hj = Buffer.from(JSON.stringify(header), 'utf8');
  const pad = (4 - ((8 + hj.length) % 4)) % 4;
  const head = Buffer.alloc(8);
  head.write('NAV2', 0, 'ascii');
  head.writeUInt32LE(hj.length + pad, 4);
  const out = Buffer.concat([head, hj, Buffer.alloc(pad, 0x20), ...chunks]);
  const file = path.join(ROOT, `public/assets/levels/floor${tag}_nav.bin`);
  fs.writeFileSync(file, out);
  console.log(`→ ${path.relative(ROOT, file)} ${(out.length / 1024).toFixed(0)} KB (${nx}×${nz} columns)`);
}

function mergeGeos(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo;
}

const floors = process.argv.slice(2).map(Number);
for (const id of floors.length ? floors : [1, 2, 3]) await bake(id);
