import * as THREE from 'three';

/**
 * Stable shadow-depth programs.
 *
 * three r186 draws every caster into the shadow map with ONE shared MeshDepthMaterial whose `side` and `map`
 * are overwritten per object, and it only re-resolves that material's program when skinning flips between
 * consecutive casters. Which depth variants get compiled therefore depends on draw order — a variant first
 * needed mid-game (a new camera position, a respawn) compiled on the spot (~100–400 ms on ANGLE/D3D11).
 *
 * Giving each caster class its own depth material (same side / map / skinning / morph every time it is used)
 * makes each program resolve exactly once, the first time that class casts — i.e. in the loading-screen
 * warm-up, which renders every caster into a floor-sized shadow map.
 */
const cache = new Map<string, THREE.MeshDepthMaterial>();

function depthFor(mesh: THREE.Mesh, mat: THREE.Material) {
  const skinned = !!(mesh as THREE.SkinnedMesh).isSkinnedMesh;
  const morph = !!mesh.geometry.morphAttributes.position;
  const m = mat as THREE.MeshStandardMaterial;
  const key = `${skinned ? 'S' : '-'}${morph ? 'M' : '-'}${(mesh as THREE.InstancedMesh).isInstancedMesh ? 'I' : '-'}|${mat.side}|${m.map ? 'map' : ''}|${m.alphaTest > 0 ? 'at' : ''}|${m.alphaMap ? 'am' : ''}`;
  let d = cache.get(key);
  if (!d) {
    d = new THREE.MeshDepthMaterial();
    d.name = 'depth:' + key;
    cache.set(key, d);
  }
  return d;
}

/** Assign stable depth materials to every shadow-casting mesh under `root` (single-material meshes). */
export function stabilizeShadowDepth(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow || Array.isArray(mesh.material)) return;
    // alpha-tested / displaced materials already get a unique depth material from three (per source material)
    const m = mesh.material as THREE.MeshStandardMaterial;
    if ((m.map || m.alphaMap) && m.alphaTest > 0) return;
    mesh.customDepthMaterial = depthFor(mesh, mesh.material);
  });
}

export function shadowDepthVariants() { return cache.size; }
