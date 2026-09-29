import * as THREE from 'three';
import { materialTextures } from './AssetManager';

/**
 * GPU warm-up, run behind the loading screen so gameplay never pays first-use costs:
 *  1. upload every texture the floor can draw (renderer.initTexture), time-sliced so the loading screen animates;
 *  2. compile every program (renderer.compileAsync → KHR_parallel_shader_compile where available) with every
 *     object visible — both time states, hidden/rising enemies, fracture-conditional geometry, VFX kits;
 *  3. render real frames of that forced-visible scene for each time state with the shadow camera widened over
 *     the whole floor, which creates the shadow-depth program variants and uploads every geometry buffer.
 * `before()` / `after()` let the caller force and restore visibility; `states` switch materials per pass.
 */
export interface WarmupOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  /** world-space bounds the shadow camera must cover during the warm-up renders */
  bounds: THREE.Box3;
  /** force-visible setup per pass (e.g. apply a time state with both states shown) */
  passes: (() => void)[];
  restore: () => void;
  onProgress?: (f: number, label: string) => void;
}

const nextFrame = () => new Promise<void>((r) => {
  // rAF is paused in hidden tabs; a message tick keeps loading moving there too
  const ch = new MessageChannel();
  let done = false;
  const fin = () => { if (!done) { done = true; ch.port1.close(); r(); } };
  ch.port1.onmessage = fin;
  requestAnimationFrame(fin);
  setTimeout(() => ch.port2.postMessage(0), 16);
});

export interface WarmupReport { textures: number; programsBefore: number; programsAfter: number; uploadMs: number; compileMs: number; renderMs: number; totalMs: number }

export async function warmup(o: WarmupOptions): Promise<WarmupReport> {
  const { renderer, scene, camera } = o;
  const t0 = performance.now();
  const programsBefore = renderer.info.programs?.length ?? 0;
  const report = (f: number, label: string) => o.onProgress?.(Math.min(1, f), label);

  // ---- 1. textures (all passes' visible materials)
  const texs = new Set<THREE.Texture>();
  for (const pass of o.passes) {
    pass();
    scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (m) for (const mat of Array.isArray(m) ? m : [m]) materialTextures(mat, texs);
    });
  }
  const list = [...texs];
  let slice = performance.now();
  for (let i = 0; i < list.length; i++) {
    renderer.initTexture(list[i]);
    if (performance.now() - slice > 14) { report(0.5 * (i + 1) / list.length, `Settling stone and timber (${i + 1}/${list.length})`); await nextFrame(); slice = performance.now(); }
  }
  const t1 = performance.now();
  report(0.5, 'Tempering the memories');

  // ---- 2 + 3. programs, then real renders per pass (shadow camera over the whole floor)
  const sc = o.sun.shadow.camera as THREE.OrthographicCamera;
  const saved = { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, far: sc.far, pos: o.sun.position.clone(), tgt: o.sun.target.position.clone() };
  const c = o.bounds.getCenter(new THREE.Vector3());
  const r = o.bounds.getSize(new THREE.Vector3()).length() * 0.55;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = r * 4;
  sc.updateProjectionMatrix();
  let compileMs = 0, renderMs = 0;
  for (let i = 0; i < o.passes.length; i++) {
    o.passes[i]();
    const tc = performance.now();
    await renderer.compileAsync(scene, camera);
    compileMs += performance.now() - tc;
    report(0.5 + 0.5 * (i + 0.6) / o.passes.length, 'Tempering the memories');
    const dir = o.sun.position.clone().sub(o.sun.target.position).normalize();
    o.sun.target.position.copy(c);
    o.sun.position.copy(c).addScaledVector(dir.lengthSq() > 0 ? dir : new THREE.Vector3(0, 1, 0), r * 2);
    o.sun.target.updateMatrixWorld();
    o.sun.updateMatrixWorld();
    const tr = performance.now();
    renderer.render(scene, camera);
    renderMs += performance.now() - tr;
    await nextFrame();
    report(0.5 + 0.5 * (i + 1) / o.passes.length, 'Tempering the memories');
  }
  sc.left = saved.l; sc.right = saved.r; sc.top = saved.t; sc.bottom = saved.b; sc.far = saved.far;
  sc.updateProjectionMatrix();
  o.sun.position.copy(saved.pos); o.sun.target.position.copy(saved.tgt);
  o.restore();
  // one ordinary frame in the restored state (anything the forced passes missed shows up in programsAfter)
  renderer.render(scene, camera);
  return {
    textures: list.length, programsBefore, programsAfter: renderer.info.programs?.length ?? 0,
    uploadMs: Math.round(t1 - t0), compileMs: Math.round(compileMs), renderMs: Math.round(renderMs), totalMs: Math.round(performance.now() - t0),
  };
}
