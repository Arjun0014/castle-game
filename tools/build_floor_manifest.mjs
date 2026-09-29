#!/usr/bin/env node
// Per-floor dependency manifest + asset byte sizes (deterministic, re-run whenever GLBs change;
// `npm run assets:manifest`, also run by predev/prebuild).
//
// Reads every public/assets/levels/floorNN.glb and records what that floor needs at runtime:
//   materials   — material keys used by level meshes (runtime resolves them to texture sets)
//   archetypes  — enemy archetype ids referenced by `enemy` markers
//   veg         — vegetation kinds referenced by `veg` markers
//   markers     — counts of marker kinds that imply extra assets (fissure → remnants, statue, imprint)
// and writes src/data/floorManifests.json. Also writes src/data/assetSizes.json (url → bytes for every file
// under public/assets) so loading progress can be weighted by real file sizes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const LEVELS = path.join(PUB, 'assets', 'levels');

function glbJson(file) {
  const buf = fs.readFileSync(file);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

const floors = {};
for (const f of fs.readdirSync(LEVELS).sort()) {
  const m = /^floor(\d+)\.glb$/.exec(f);
  if (!m) continue;
  const id = Number(m[1]);
  const g = glbJson(path.join(LEVELS, f));
  const materials = new Set(), archetypes = new Set(), veg = new Set();
  const markers = {};
  for (const n of g.nodes ?? []) {
    const ex = n.extras ?? {};
    if (ex.marker) {
      markers[ex.marker] = (markers[ex.marker] ?? 0) + 1;
      if (ex.marker === 'enemy' && ex.archetype) archetypes.add(ex.archetype);
      if (ex.marker === 'veg' && ex.kind) veg.add(ex.kind);
      continue;
    }
    if (n.mesh !== undefined && ex.group && ex.mat) materials.add(ex.mat);
  }
  const col = path.join(LEVELS, `floor${m[1]}_collision.glb`);
  if (!fs.existsSync(col)) throw new Error('missing collision GLB for ' + f);
  floors[id] = {
    level: `assets/levels/${f}`,
    collision: `assets/levels/floor${m[1]}_collision.glb`,
    materials: [...materials].sort(),
    archetypes: [...archetypes].sort(),
    veg: [...veg].sort(),
    markers: Object.fromEntries(Object.entries(markers).sort()),
  };
  console.log(`floor ${id}: ${materials.size} materials, archetypes [${[...archetypes].join(', ')}], veg [${[...veg].join(', ')}]`);
}
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'floorManifests.json'), JSON.stringify(floors, null, 1) + '\n');

const sizes = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else sizes[path.relative(PUB, p).replace(/\\/g, '/')] = fs.statSync(p).size;
  }
})(path.join(PUB, 'assets'));
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'assetSizes.json'), JSON.stringify(sizes, null, 0) + '\n');
console.log(`asset sizes: ${Object.keys(sizes).length} files, ${(Object.values(sizes).reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB`);
