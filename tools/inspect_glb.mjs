#!/usr/bin/env node
// GLB inspector: node tools/inspect_glb.mjs <file.glb> [--json]
// Prints meshes (tris), materials (+ texture slots), textures (mime, pixel size, bytes), skins (joint count,
// sample joint names), animations (name, duration, channel count), scene bounds from POSITION min/max,
// root node transforms and extensions used. No dependencies.
import fs from 'node:fs';
import path from 'node:path';

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + file);
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin, size: buf.length };
}

function imageSize(bytes) {
  if (!bytes || bytes.length < 24) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), fmt: 'png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      const len = bytes.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: bytes.readUInt16BE(i + 7), h: bytes.readUInt16BE(i + 5), fmt: 'jpeg' };
      i += 2 + len;
    }
  }
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return { w: 0, h: 0, fmt: 'webp' };
  if (bytes[0] === 0xab && bytes[1] === 0x4b && bytes[2] === 0x54 && bytes[3] === 0x58) return { w: bytes.readUInt32LE(20 + 4 + 4 + 4 + 4 + 4 + 4 - 16), h: 0, fmt: 'ktx2' };
  return null;
}

export function inspect(file) {
  const { json: g, bin, size } = readGlb(file);
  const acc = g.accessors ?? [];
  const bv = g.bufferViews ?? [];
  const out = { file: path.basename(file), bytes: size, generator: g.asset?.generator, extensionsUsed: g.extensionsUsed ?? [] };
  let tris = 0; const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  out.meshes = (g.meshes ?? []).map((m, mi) => {
    let t = 0, verts = 0; const mats = [];
    for (const p of m.primitives) {
      const pa = acc[p.attributes.POSITION];
      verts += pa.count;
      const n = p.indices !== undefined ? acc[p.indices].count : pa.count;
      if ((p.mode ?? 4) === 4) t += n / 3;
      if (pa.min && pa.max) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pa.min[k]); max[k] = Math.max(max[k], pa.max[k]); }
      mats.push(p.material);
    }
    tris += t;
    return { i: mi, name: m.name, prims: m.primitives.length, tris: Math.round(t), verts, mats, skinned: !!m.primitives[0].attributes.JOINTS_0, morph: !!m.primitives[0].targets };
  });
  out.totalTris = Math.round(tris);
  out.positionBoundsLocal = { min, max };
  out.images = (g.images ?? []).map((im, i) => {
    let bytes = null;
    if (im.bufferView !== undefined && bin) { const v = bv[im.bufferView]; bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); }
    const s = imageSize(bytes);
    return { i, name: im.name, mime: im.mimeType ?? (im.uri ? 'uri:' + im.uri : '?'), bytes: bytes?.length ?? 0, w: s?.w, h: s?.h };
  });
  out.textures = (g.textures ?? []).map((t, i) => ({ i, source: t.source, ext: t.extensions ? Object.keys(t.extensions) : [] }));
  const texSlot = (ti) => (ti ? `tex${ti.index}` : null);
  out.materials = (g.materials ?? []).map((m, i) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    return {
      i, name: m.name, alpha: m.alphaMode ?? 'OPAQUE', double: !!m.doubleSided,
      baseColor: pbr.baseColorFactor, metal: pbr.metallicFactor, rough: pbr.roughnessFactor,
      maps: {
        base: texSlot(pbr.baseColorTexture), mr: texSlot(pbr.metallicRoughnessTexture), normal: texSlot(m.normalTexture),
        occ: texSlot(m.occlusionTexture), emissive: texSlot(m.emissiveTexture),
      },
      emissive: m.emissiveFactor, ext: m.extensions ? Object.keys(m.extensions) : [],
    };
  });
  out.skins = (g.skins ?? []).map((s, i) => ({ i, name: s.name, joints: s.joints.length, sample: s.joints.slice(0, 6).map((j) => g.nodes[j].name) }));
  out.animations = (g.animations ?? []).map((a, i) => {
    let dur = 0;
    for (const s of a.samplers) { const inp = acc[s.input]; if (inp.max) dur = Math.max(dur, inp.max[0]); }
    const paths = {};
    for (const c of a.channels) paths[c.target.path] = (paths[c.target.path] ?? 0) + 1;
    return { i, name: a.name, dur: +dur.toFixed(3), channels: a.channels.length, paths };
  });
  const scene = g.scenes?.[g.scene ?? 0];
  const node = (ni, d = 0) => {
    const n = g.nodes[ni];
    return { name: n.name, t: n.translation, r: n.rotation, s: n.scale, m: n.matrix ? 'matrix' : undefined, mesh: n.mesh, skin: n.skin, kids: d < 3 ? (n.children ?? []).map((c) => node(c, d + 1)) : (n.children?.length ?? 0) };
  };
  out.roots = (scene?.nodes ?? []).map((n) => node(n));
  out.nodeCount = g.nodes?.length ?? 0;
  return out;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('inspect_glb.mjs')) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  for (const f of args.filter((a) => !a.startsWith('--'))) {
    const r = inspect(f);
    if (asJson) { console.log(JSON.stringify(r, null, 1)); continue; }
    console.log(`\n=== ${r.file}  ${(r.bytes / 1e6).toFixed(2)} MB  gen=${r.generator}  ext=${r.extensionsUsed.join(',') || '-'}`);
    console.log(`tris ${r.totalTris}  meshes ${r.meshes.length}  nodes ${r.nodeCount}  bounds ${r.positionBoundsLocal.min.map((v) => v.toFixed(2))} .. ${r.positionBoundsLocal.max.map((v) => v.toFixed(2))}`);
    for (const m of r.meshes) console.log(`  mesh ${m.i} "${m.name}" tris ${m.tris} verts ${m.verts} mats ${m.mats} ${m.skinned ? 'SKINNED' : ''}${m.morph ? ' MORPH' : ''}`);
    for (const m of r.materials) console.log(`  mat ${m.i} "${m.name}" ${m.alpha}${m.double ? ' 2S' : ''} base=${JSON.stringify(m.baseColor ?? null)} maps=${JSON.stringify(m.maps)} em=${JSON.stringify(m.emissive ?? null)} ${m.ext.join(',')}`);
    for (const im of r.images) console.log(`  img ${im.i} "${im.name}" ${im.mime} ${im.w}x${im.h} ${(im.bytes / 1e3).toFixed(0)} kB`);
    for (const s of r.skins) console.log(`  skin ${s.i} "${s.name}" joints ${s.joints}: ${s.sample.join(', ')}`);
    for (const a of r.animations) console.log(`  anim ${a.i} "${a.name}" ${a.dur}s ch ${a.channels} ${JSON.stringify(a.paths)}`);
    console.log('  roots: ' + JSON.stringify(r.roots).slice(0, 900));
  }
}
