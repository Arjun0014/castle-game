// Dev-only: inspect a monster GLB (bounds, skeleton, clip) and render it from several angles through its clip.
// http://localhost:5174/dev/monsterLab.html?f=bat_dark_bad_cartoon_monster
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const file = params.get('f') ?? 'bat_dark_bad_cartoon_monster';
const info = document.getElementById('info')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3a44);
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(3, 5, 4); scene.add(sun);
const grid = new THREE.GridHelper(4, 8, 0x888888, 0x555555); scene.add(grid);

const gl = await new GLTFLoader().loadAsync(`/assets/characters/enemy/${file}.glb`);
const root = gl.scene;
{ const mx = new THREE.AnimationMixer(root); if (gl.animations[0]) { mx.clipAction(gl.animations[0]).play(); mx.setTime(0); } }
root.updateMatrixWorld(true);
const box = new THREE.Box3();
root.traverse((o) => {
  const m = o as THREE.SkinnedMesh;
  if (!m.isMesh) return;
  m.frustumCulled = false;
  if (m.isSkinnedMesh) { m.skeleton.update(); m.computeBoundingBox(); box.union(m.boundingBox!.clone().applyMatrix4(m.matrixWorld)); }
  else { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); }
});
const sz = box.getSize(new THREE.Vector3());
const target = Number(params.get('h') ?? 1.6);
const s = target / Math.max(sz.x, sz.y, sz.z);
const wrap = new THREE.Group();
wrap.add(root);
root.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)));
scene.add(wrap);
const mixer = new THREE.AnimationMixer(root);
const clip = gl.animations[0];
if (clip) mixer.clipAction(clip).play();

const lines: string[] = [`${file}  raw bounds ${box.min.toArray().map((v) => v.toFixed(2))} .. ${box.max.toArray().map((v) => v.toFixed(2))}  size ${sz.toArray().map((v) => v.toFixed(2))}  scale→${s.toExponential(3)}`];
lines.push(`clip ${clip?.name} ${clip?.duration.toFixed(2)}s tracks ${clip?.tracks.length}`);
for (const t of clip?.tracks ?? []) lines.push('  ' + t.name + ' ' + t.times.length);
const bones: string[] = [];
root.traverse((o) => { if ((o as THREE.Bone).isBone) { let d = 0, p = o.parent; while (p && (p as THREE.Bone).isBone) { d++; p = p.parent; } const w = o.getWorldPosition(new THREE.Vector3()); bones.push(`${'  '.repeat(d)}${o.name} (${w.x.toFixed(2)},${w.y.toFixed(2)},${w.z.toFixed(2)})`); } });
lines.push(...bones);
info.textContent = lines.join('\n');
(window as any).__lab = { root, mixer, clip, gl, bones };

const views = [
  { pos: [0, 0.8, 3.2], label: 'front' }, { pos: [3.2, 0.8, 0], label: 'side' },
  { pos: [0, 0.8, -3.2], label: 'back' }, { pos: [2.2, 2.6, 2.2], label: 'top3/4' },
];
const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
function render(t: number) {
  mixer.setTime(t);
  renderer.setSize(innerWidth, innerHeight);
  const W = innerWidth, H = innerHeight, w = W / 2, h = H / 2;
  views.forEach((v, i) => {
    const x = (i % 2) * w, y = Math.floor(i / 2) * h;
    renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(v.pos[0], v.pos[1], v.pos[2]); cam.lookAt(0, 0.6, 0);
    renderer.render(scene, cam);
  });
}
(window as any).__render = render;
/** one view (index into views, or a custom camera position) at four clip times */
function strip(times: number[], pos: number[]) {
  renderer.setSize(innerWidth, innerHeight);
  const W = innerWidth, H = innerHeight, w = W / 2, h = H / 2;
  times.forEach((t, i) => {
    mixer.setTime(t);
    const x = (i % 2) * w, y = Math.floor(i / 2) * h;
    renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(0, 0.6, 0);
    renderer.render(scene, cam);
  });
}
(window as any).__strip = strip;
render(Number(params.get('t') ?? 0));
