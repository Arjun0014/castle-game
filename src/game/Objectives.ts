import * as THREE from 'three';
import type { Game } from './Game';
import { OBJECTIVES, type ObjectiveDef, type TeachId } from '../data/objectives';
import { b2t } from '../levels/Level';
import { Platform } from '../platform/Platform';
import { ATMO_UNIFORMS } from '../vfx/Atmosphere';

/**
 * The objective line + contextual tutorials (session 7 onboarding).
 *
 * - One short objective is always on screen (top-left) and advances from gameplay facts (data/objectives.ts).
 * - Tutorials are PERSISTENT until the action is actually performed (never a 4-second prompt that can be
 *   missed): the card stays while it is relevant and comes back when it becomes relevant again.
 * - When the player seems stuck (objective active for a while, not fighting), the heroine voices a hint and a
 *   gold chevron on the frame edge points toward the objective if it is off-screen. Required shift spots get
 *   a faint ring on the floor while their objective is active.
 */

/** skills the tutorials wait for (kept for the whole run: floors transition in place) */
export interface Learned { moved: number; looked: number; hits: number; guarded: boolean; dodged: boolean; shifted: boolean; sigil: boolean; resonance: boolean; heavy: boolean;
  /** floor rewards performed at least once (their unlock tip stays until then) */
  crownbreaker: boolean; whirlwind: boolean }

export class Objectives {
  private list: ObjectiveDef[];
  private i = -1;
  private activeT = 0;
  private hintIdx = 0;
  private bossDead = new Set<string>();
  private ring: THREE.Mesh;
  private ringMat: THREE.ShaderMaterial;
  private ringAt = new THREE.Vector3();
  private lastPos = new THREE.Vector3();
  private teachStageT = 0;
  private offs: (() => void)[] = [];
  /** the current objective's target in world space (null = none) */
  private target: THREE.Vector3 | null = null;
  current: ObjectiveDef | null = null;

  constructor(private g: Game, public learned: Learned) {
    this.list = OBJECTIVES[g.floorId] ?? [];
    this.offs.push(g.signals.on('boss:dead', (d) => this.bossDead.add(d.id)));
    this.offs.push(g.signals.on('shift', () => { this.learned.shifted = true; }));
    this.offs.push(g.signals.on('sigil:activate', () => { this.learned.sigil = true; }));
    this.offs.push(g.signals.on('kill', () => {
      if (!this.learned.resonance && g.time.unlocked === false && g.floorId === 1 && !g.tutorial?.active) {
        // the first Echo released: explain where its resonance went (the bar top-left)
        this.learned.resonance = true;
        g.hud.noticeCard('RESONANCE', 'Destroyed Echoes release Resonance into your blood — the bar under your health. One full segment lets you shift the castle.', 9);
      }
    }));
    this.ringMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: ATMO_UNIFORMS.uAtmoTime, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x7cc8ff) } },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz / 1.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec2 vP;
void main() {
  float r = length(vP);
  float ring = 1.0 - smoothstep(0.02, 0.06, abs(r - 0.82));
  float inner = (1.0 - smoothstep(0.0, 0.8, r)) * 0.18;
  float wave = 1.0 - smoothstep(0.0, 0.08, abs(r - fract(uTime * 0.45)));
  float a = (ring * (0.7 + 0.3 * sin(uTime * 2.4)) + inner + wave * 0.35 * step(r, 0.82)) * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`,
    });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.renderOrder = 3;
    this.ring.position.set(0, -500, 0);
    // added under the level root: rendered (at zero opacity) during the GPU warm-up, so it never compiles late
    g.level.root.add(this.ring);
    this.lastPos.copy(g.player.pos);
  }

  dispose() {
    for (const o of this.offs) o();
    this.offs = [];
    this.ring.removeFromParent();
    this.ring.geometry.dispose();
    this.ringMat.dispose();
    this.g.hud.objective(null);
    this.g.hud.tutorial(null);
    this.g.hud.guide(null);
    this.g.touch?.highlight(null);
  }

  /** seconds until the current objective's next stuck hint (Infinity when none is due) */
  nextHintIn() {
    const h = this.current?.hints?.[this.hintIdx];
    return h ? Math.max(0, h.after - this.activeT) : Infinity;
  }

  // ------------------------------------------------------------------ conditions
  private zone(spec: string, p: THREE.Vector3) {
    const [x0, x1, y0, y1, z0, z1] = spec.split(',').map(Number);
    const bx = p.x, by = -p.z, bz = p.y;
    return bx >= x0 && bx <= x1 && by >= y0 && by <= y1 && bz >= z0 && bz <= z1;
  }

  private met(c: string): boolean {
    const g = this.g;
    const k = c.indexOf(':');
    const kind = k < 0 ? c : c.slice(0, k), v = k < 0 ? '' : c.slice(k + 1);
    switch (kind) {
      case 'sigil': return g.checkpoints.activated.has(v);
      case 'cleared': return g.enemies.isCleared(v);
      case 'started': return !!g.enemies.encounters.get(v)?.triggered;
      case 'shifts': return g.time.shiftCount >= Number(v);
      case 'state': return g.time.state === v;
      case 'zone': return g.player.alive && this.zone(v, g.player.pos);
      case 'flag': return g.level.flags.has(v);
      case 'boss': return this.bossDead.has(v);
      case 'exit': return g.finished;
    }
    return false;
  }
  private done(o: ObjectiveDef) { return o.done.some((c) => this.met(c)); }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const g = this.g;
    if (!this.list.length || !g.started) return;
    // advance (jumping over anything the player has already achieved, e.g. a different order)
    let idx = Math.max(0, this.i);
    if (this.i < 0) this.setCurrent(0);
    for (let k = idx; k < this.list.length; k++) {
      if (!this.done(this.list[k])) continue;
      // only jump ahead to k if everything up to k is plausibly behind the player (k is done)
      idx = k + 1;
    }
    if (idx !== this.i && idx > this.i) this.setCurrent(idx);
    const cur = this.current;
    // learning
    this.learned.hits += Math.max(0, g.enemies.playerHits - this.lastHits);
    this.lastHits = g.enemies.playerHits;
    const moved = g.player.pos.distanceTo(this.lastPos);
    if (moved < 2) this.learned.moved += moved;
    this.lastPos.copy(g.player.pos);
    if (g.player.state === 'block') this.learned.guarded = true;
    if (g.player.state === 'dodge') this.learned.dodged = true;
    if (g.player.attack?.kind === 'heavy') this.learned.heavy = true;
    // stuck timer: only while exploring (not fighting, not dead)
    if (cur && !g.enemies.inCombat && g.player.alive) this.activeT += dt;
    if (cur?.hints && this.hintIdx < cur.hints.length && this.activeT >= cur.hints[this.hintIdx].after) {
      g.signals.emit('hint', { line: cur.hints[this.hintIdx].line, objective: cur.id });
      this.hintIdx++;
    }
    this.updateGuide(cur);
    this.updateRing(cur, dt);
    this.updateTeach(cur, dt);
  }

  private setCurrent(i: number) {
    const g = this.g;
    this.i = i;
    this.current = this.list[i] ?? null;
    this.activeT = 0;
    this.hintIdx = 0;
    this.teachStageT = 0;
    const cur = this.current;
    this.target = cur?.at ? b2t(cur.at[0], cur.at[1], cur.at[2]) : null;
    g.checkpoints.objectiveSigil = cur?.sigil ?? null;
    g.hud.objective(cur?.text ?? null, i > 0);
    if (cur) g.signals.emit('objective', { id: cur.id, line: cur.line });
    g.touch?.highlight(null);
    g.hud.tutorial(null);
  }

  /** Gold edge chevron toward the objective — only once the player has been at it a while (after the first hint time). */
  private _v = new THREE.Vector3();
  private updateGuide(cur: ObjectiveDef | null) {
    const g = this.g;
    // Guided players see the marker soon after an objective begins; Minimal players once they seem stuck
    const first = this.g.tutorial?.active ? 12 : Math.min(30, cur?.hints?.[0]?.after ?? 30);
    if (!cur || !this.target || this.activeT < first || g.enemies.inCombat || !g.player.alive || g.paused) { g.hud.guide(null); return; }
    const v = this._v.copy(this.target).setY(this.target.y + 1).project(g.camera);
    if (v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85) { g.hud.guide(null); return; }
    const fwd = g.rig.forward(new THREE.Vector3());
    const dx = this.target.x - g.player.pos.x, dz = this.target.z - g.player.pos.z;
    g.hud.guide({ x: dx * -fwd.z + dz * fwd.x, y: -(dx * fwd.x + dz * fwd.z) });
  }

  private updateRing(cur: ObjectiveDef | null, dt: number) {
    const g = this.g;
    let want = 0;
    if (cur?.shiftAt && g.time.unlocked && (!cur.shiftFrom || cur.shiftFrom === g.time.state)) {
      this.ringAt.copy(b2t(cur.shiftAt[0], cur.shiftAt[1], cur.shiftAt[2]));
      const d = this.ringAt.distanceTo(g.player.pos);
      if (d < 30 && !g.enemies.inCombat) want = d < 1.2 ? 0.45 : 0.9;
      this.ring.position.copy(this.ringAt).setY(this.ringAt.y + 0.06);
      (this.ringMat.uniforms.uColor.value as THREE.Color).setHex(g.time.state === 'PAST' ? 0x7cc8ff : 0xffb060);
    }
    const u = this.ringMat.uniforms.uOpacity;
    u.value += (want - u.value) * Math.min(1, dt * 3);
    if (u.value < 0.01 && want === 0) this.ring.position.y = -500;
  }

  // ------------------------------------------------------------------ tutorials
  private updateTeach(cur: ObjectiveDef | null, dt: number) {
    const g = this.g, L = this.learned, touch = Platform.isTouch;
    // Guided: the tutorial owns the card (game/Tutorial.ts) until its last lesson
    if (g.tutorial?.ownsCard) return;
    const teach: TeachId | undefined = cur?.teach;
    this.teachStageT += dt;
    let title: string | null = null, text = '', btn: Parameters<NonNullable<typeof g.touch>['highlight']>[0] = null;
    if (teach === 'move' && (L.moved < 6 || L.looked < 1) && this.activeT > 4) {
      title = 'MOVE';
      text = touch ? 'Drag your left thumb to move — push to the edge to sprint. Drag the empty right side to look around.'
        : 'WASD to move · mouse to look · hold Shift to sprint · Space to jump';
    } else if (teach === 'combat' && g.enemies.encounters.get('E1')?.triggered) {
      // Minimal guidance: one compact card with the essentials (Guided teaches each in turn: game/Tutorial.ts)
      if (this.teachStageT < 9 && !(L.hits - (this.hitsAtStart ?? 0) >= 3 && L.guarded)) {
        title = 'FIGHT';
        text = touch ? 'ATTACK strikes · HEAVY staggers · hold GUARD to block, tap it as a blow lands to parry.'
          : 'Left-click strike · right-click heavy · hold Q to guard, tap it as a blow lands to parry · tap Shift to dodge';
        btn = 'light';
      }
    } else if (teach === 'sigil') {
      const at = g.checkpoints.sigilPos(cur!.sigil!);
      if (at && at.distanceTo(g.player.pos) < 9) {
        title = 'BLOOD SIGIL';
        text = touch ? 'Blood Sigils are checkpoints. Step onto it and tap ACTIVATE CHECKPOINT.' : 'Blood Sigils are checkpoints. Step onto it and press E to activate it.';
      }
    } else if (teach === 'shift' && !L.shifted) {
      const inLane = this.zone('-3.2,3.2,-46,-30.5,-1,4', g.player.pos);
      title = 'TIME SHIFT';
      if (!g.time.unlocked) { title = null; }
      else if (g.time.charge < 100) text = 'You need a full segment of Resonance. Destroy Echoes to gather it — your blood absorbs what they release.';
      else if (inLane) {
        text = touch ? 'Stand still and HOLD SHIFT until the castle turns. The gate stood open in its memory.' : 'Stand still and HOLD R until the castle turns. The gate stood open in its memory.';
        btn = 'shift';
      } else text = 'Your blood can force the castle into another memory of itself. Go back to the rusted gate.';
    } else if (teach === 'shiftback' && g.time.state === 'PAST' && g.time.unlocked && this.zone('-1,24,-26,-4,-1,5', g.player.pos) && g.enemies.isCleared('E3')) {
      title = 'SHIFT BACK';
      text = g.time.charge < 100 ? 'The barracks are barricaded in this memory. Gather a full segment of Resonance, then shift back to the Present.'
        : touch ? 'The barracks are barricaded in this memory. Hold SHIFT here to return to the Present, where the door lies broken.'
          : 'The barracks are barricaded in this memory. Hold R here to return to the Present, where the door lies broken.';
      btn = 'shift';
    } else if (teach === 'crouch' && this.zone('27.5,34,-1.5,7.5,-1,3', g.player.pos)) {
      title = 'CROUCH';
      text = touch ? 'The vault has fallen. Walk into the low gap — you stoop through it on your own.' : 'The vault has fallen. Press C to crouch through the low gap — C again to stand.';
    } else if (teach === 'halfstair' && this.zone('20,34,10.5,27,-1,9', g.player.pos) && !g.enemies.inCombat) {
      // G3 (session 13): climb in the Present, shift on the old landing, climb in the Past — said for where she is
      const p = g.player.pos, past = g.time.state === 'PAST';
      const pad = this.zone('19.9,22.7,16.6,19.7,2.3,4.6', p) || this.zone('19.9,22.7,12,16.6,0.9,3.4', p);
      title = 'A HALF STAIR';
      if (past && this.zone('19.9,22.7,11.8,27,0.6,7', p)) text = 'The whole stair stands in this memory. Climb it to the landing above.';
      else if (past) text = "The stair's gate is locked in this memory. Shift back, climb the rubble to the old landing, and shift there.";
      else if (!pad) text = 'The stair has fallen in this memory — the rubble still climbs to where its landing stood. Climb it.';
      else if (g.time.charge < 100) text = "A shift needs a full segment of Resonance: destroy Echoes, or wait — the castle's pull slowly returns.";
      else { text = touch ? 'Hold SHIFT here: in the Past the stair above still stands.' : 'Hold R here: in the Past the stair above still stands.'; btn = 'shift'; }
    }
    if (this.hitsAtStart === null && teach === 'combat') this.hitsAtStart = L.hits;
    if (teach !== 'combat') this.hitsAtStart = null;
    g.hud.tutorial(title, text);
    g.touch?.highlight(btn);
  }
  private hitsAtStart: number | null = null;
  private lastHits = 0;
}
