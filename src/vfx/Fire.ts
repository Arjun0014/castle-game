import * as THREE from 'three';
import { ATMO_UNIFORMS } from './Atmosphere';

/**
 * Animated procedural flames for every `fire` marker: one InstancedMesh per time state, camera-facing
 * (cylindrical billboard in the vertex shader), scrolling noise for licking tongues, per-instance phase.
 */
const VS = `attribute float aPhase; attribute float aSize; uniform float uTime;
varying vec2 vUv; varying float vPhase;
void main(){
  vUv = uv; vPhase = aPhase;
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  float sway = sin(uTime * 2.3 + aPhase * 7.0) * 0.06 * position.y;
  vec3 w = center + right * (position.x + sway) * aSize + vec3(0.0, 1.0, 0.0) * position.y * aSize * 1.3;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const FS = `uniform float uTime; varying vec2 vUv; varying float vPhase;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec2 uv = vUv;
  float t = uTime * 1.6 + vPhase * 10.0;
  float y = uv.y;
  // turbulence rising through the flame
  float d = fbm(vec2(uv.x * 3.0, y * 2.4 - t)) - 0.5;
  float x = (uv.x - 0.5) * 2.0 + d * 0.85 * y;
  // teardrop: wide at the base, licking to a point
  float width = mix(0.95, 0.08, pow(y, 0.7));
  float body = 1.0 - smoothstep(width * 0.55, width, abs(x));
  body *= smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.55, 1.0, y + d * 0.35));
  float core = body * (1.0 - smoothstep(0.0, 0.32, y)) * (1.0 - smoothstep(0.0, width * 0.32, abs(x)));
  vec3 col = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.45, 0.08), smoothstep(0.0, 0.8, body));
  col = mix(col, vec3(1.0, 0.82, 0.5), core);
  float a = body * (0.85 + 0.15 * sin(t * 3.0));
  gl_FragColor = vec4(col * a * 1.1, a);
}`;

export interface FireSpec { pos: THREE.Vector3; size: number; state: string }

export class Fires {
  meshes = new Map<string, THREE.InstancedMesh>();
  private mat: THREE.ShaderMaterial;

  constructor(parent: THREE.Object3D, fires: FireSpec[]) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: { uTime: ATMO_UNIFORMS.uAtmoTime },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0);
    const byState = new Map<string, FireSpec[]>();
    for (const f of fires) { if (!byState.has(f.state)) byState.set(f.state, []); byState.get(f.state)!.push(f); }
    const m = new THREE.Matrix4();
    for (const [state, list] of byState) {
      const g = geo.clone();
      g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(list.map(() => Math.random())), 1));
      g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(list.map((f) => f.size * 0.85)), 1));
      const im = new THREE.InstancedMesh(g, this.mat, list.length);
      list.forEach((f, i) => im.setMatrixAt(i, m.makeTranslation(f.pos.x, f.pos.y - f.size * 0.08, f.pos.z)));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      im.renderOrder = 4;
      parent.add(im);
      this.meshes.set(state, im);
    }
  }

  dispose() {
    for (const [, im] of this.meshes) { im.removeFromParent(); im.geometry.dispose(); im.dispose(); }
    this.meshes.clear();
    this.mat.dispose();
  }

  applyState(state: string) {
    for (const [s, im] of this.meshes) im.visible = s === 'BOTH' || s === state;
  }
}
