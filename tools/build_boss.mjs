#!/usr/bin/env node
// Old final-boss GLB (seraph, one idle clip) — UNUSED since session 5 (Floor 3 uses lastcrown.glb, tools/blender/build_lastcrown.py); kept to regenerate it: npm run assets:boss
//
// Source (immutable): assets/characters/enemy/final_boss_light_monster.glb (Sketchfab, 30.5 MB, Reallusion rig,
// 399 joints, 9 skinned+morph meshes, one 8.83 s "Motion" clip). Inspected session 4:
//   - the six "Body*" base-colour PNGs are byte-identical (1.5 MB each), the "Material_1" maps duplicate
//     "Material_0"/"Body" ones: 15 images -> 9 unique
//   - every material is alphaMode BLEND + double-sided although < 1 % of any texture's texels are transparent
//     (UV padding): 9 depth-sorted transparent skinned meshes would draw in the wrong order and cost overdraw
//   - all 787 scale tracks of "Motion" are constant
// Output: public/assets/characters/boss.glb — textures deduplicated, materials OPAQUE (feathers alpha-tested),
// constant scale tracks removed. Scale/orientation normalisation happens at load (GameAssets), like the ghost.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'characters', 'enemy', 'final_boss_light_monster.glb');
const DST = path.join(ROOT, 'public', 'assets', 'characters', 'boss.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();

// 1. deduplicate textures by image bytes (re-point every material slot to the first copy)
const byHash = new Map();
let dropped = 0;
for (const tex of root.listTextures()) {
  const h = crypto.createHash('sha1').update(tex.getImage()).digest('hex');
  const keep = byHash.get(h);
  if (!keep) { byHash.set(h, tex); continue; }
  for (const edge of doc.getGraph().listParentEdges(tex)) {
    const parent = edge.getParent();
    if (parent === root) continue;
    // TextureInfo slots are set through the material API; swap by name
    const name = edge.getName();
    const setter = 'set' + name[0].toUpperCase() + name.slice(1);
    if (typeof parent[setter] === 'function') parent[setter](keep);
  }
  tex.dispose();
  dropped++;
}

// 2. materials: opaque (feathers alpha-tested); keep double-sided (open cloth/feather geometry)
for (const mat of root.listMaterials()) {
  if (/wing/i.test(mat.getName())) mat.setAlphaMode('MASK').setAlphaCutoff(0.5);
  else mat.setAlphaMode('OPAQUE');
}

// 3. drop constant scale tracks (all 787 of them)
let removed = 0;
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'scale') continue;
    const s = ch.getSampler();
    const out = s.getOutput().getArray();
    let constant = true;
    for (let i = 3; i < out.length; i++) if (Math.abs(out[i] - out[i % 3]) > 1e-4) { constant = false; break; }
    if (!constant) continue;
    const node = ch.getTargetNode();
    if (node) node.setScale([out[0], out[1], out[2]]);
    ch.dispose();
    if (!s.listParents().some((p) => p !== root && p !== anim)) s.dispose();
    removed++;
  }
}
// unused accessors after the removals
for (const acc of root.listAccessors()) if (acc.listParents().every((p) => p === root)) acc.dispose();

fs.mkdirSync(path.dirname(DST), { recursive: true });
await io.write(DST, doc);
const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(2);
console.log(`boss.glb ${mb(DST)} MB (source ${mb(SRC)} MB): ${dropped} duplicate textures dropped, ${root.listTextures().length} left; ` +
  `${removed} constant scale tracks removed; materials: ${root.listMaterials().map((m) => `${m.getName()}=${m.getAlphaMode()}`).join(' ')}`);
