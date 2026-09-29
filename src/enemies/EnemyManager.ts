import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemy, type EnemyCtx } from './Enemy';
import { ARCHETYPES, type ArchetypeId, type AssetId, type EnemyAttack } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import type { Marker } from '../levels/Level';
import type { EnemyTemplate } from '../assets/GameAssets';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';
import { Hints } from '../ui/Hints';

interface Encounter {
  id: string; state: TimeState | 'BOTH'; box: THREE.Box3; enemies: Enemy[];
  triggered: boolean; cleared: boolean; wave: number; optional: boolean; finale: boolean; tutorial: boolean;
  bossFight: boolean; surge: boolean; title?: string;
}

interface Arrow { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; damage: number; owner: Enemy; state: TimeState; }

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

function segSegDist(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): number {
  // closest distance between segments p1q1 and p2q2
  const d1 = _a.subVectors(q1, p1), d2 = _b.subVectors(q2, p2), r = _c.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a <= 1e-8 && e <= 1e-8) return r.length();
  if (a <= 1e-8) { t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-8) { s = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = _d.copy(p1).addScaledVector(d1, s);
  const c2 = new THREE.Vector3().copy(p2).addScaledVector(d2, t);
  return c1.distanceTo(c2);
}

const HEAVY_KINDS = new Set(['heavy', 'finisher', 'sprint', 'air', 'kick']);
const REMNANT_POOL = 4;
const ARROW_POOL = 16;

/** Free a skeleton clone that owns its materials (statues, imprints): materials + bone textures, not geometry. */
function disposeClone(root: THREE.Object3D) {
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) m.skeleton.dispose();
    if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
  });
  for (const m of mats) m.dispose();
}

export class EnemyManager {
  assets = new Map<AssetId, EnemyTemplate>();
  /** pre-instantiated fissure Remnants (spawning never clones a rig mid-game) */
  private remnantPool: Enemy[] = [];
  /** pooled arrow meshes */
  private arrowPool: THREE.Mesh[] = [];
  enemies: Enemy[] = [];
  encounters = new Map<string, Encounter>();
  arrows: Arrow[] = [];
  killCount = 0;
  slotsUsed = new Map<number, number>();
  slotCapacity = 2;
  private hitRegistry = new Set<string>();
  private attackSerial = 0;
  private lastAttack: unknown = null;
  inCombat = false;
  activeCount = 0;
  fissureCooldown = new Map<string, number>();
  remnants: Enemy[] = [];
  statues: THREE.Object3D[] = [];
  imprints: { obj: THREE.Object3D; mats: THREE.Material[]; fade: number }[] = [];
  private arrowGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5).rotateX(Math.PI / 2);
  private arrowMat = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.8 });
  private arrowMatEcho = new THREE.MeshBasicMaterial({ color: 0x9ae8ff });
  bossName = 'THE GATE WARDEN';
  boss: Enemy | null = null;
  onBossDeath?: () => void;

  constructor(private g: Game) {}

  /**
   * Instantiate the floor's enemies from preloaded rig templates (loaded during the floor's loading screen;
   * nothing is fetched or parsed here or later in the floor). Remnants and arrows are pooled up front.
   */
  build(templates: Map<AssetId, EnemyTemplate>) {
    this.assets = templates;
    this.spawnFromMarkers();
    this.spawnStaticFigures();
    if (this.g.level.markersOf('fissure').length) {
      for (let i = 0; i < REMNANT_POOL; i++) this.remnantPool.push(this.makeRemnant());
    }
    for (let i = 0; i < ARROW_POOL; i++) {
      const m = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      m.visible = false;
      this.arrowPool.push(m);
    }
  }

  private makeRemnant() {
    const { model, clips } = this.instantiate(ARCHETYPES.remnant.asset);
    return new Enemy(ARCHETYPES.remnant, model, clips, 'REMNANT', this.g.time.state, 1, { rise: true, yaw: 0 });
  }

  /**
   * Objects that exercise every shader variant enemies can need mid-fight but that are not visible at load:
   * one clone per rig with its materials in the death-fade (transparent) state, and both arrow materials.
   * The caller adds them to the scene for the warm-up render, then calls the returned dispose.
   */
  warmKit(at: THREE.Vector3): { objects: THREE.Object3D[]; dispose: () => void } {
    const objects: THREE.Object3D[] = [];
    const mats: THREE.Material[] = [];
    const skins: THREE.Skeleton[] = [];
    let i = 0;
    for (const [id, t] of this.assets) {
      const model = skeletonClone(t.scene);
      if (id === 'ghost') model.applyMatrix4(t.norm);
      model.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isMesh) return;
        const src = Array.isArray(m.material) ? m.material : [m.material];
        const cl = src.map((mm) => { const c = mm.clone(); c.transparent = true; c.opacity = 0.5; c.forceSinglePass = true; mats.push(c); return c; });
        m.material = Array.isArray(m.material) ? cl : cl[0];
        m.castShadow = true; m.frustumCulled = false;
        if (m.isSkinnedMesh) skins.push(m.skeleton);
      });
      model.position.copy(at).add(new THREE.Vector3((i++ - 2) * 1.2, 0, -2));
      stabilizeShadowDepth(model);
      objects.push(model);
    }
    for (const mat of [this.arrowMat, this.arrowMatEcho]) {
      const m = new THREE.Mesh(this.arrowGeo, mat);
      m.position.copy(at).add(new THREE.Vector3(0, 1.4, -1.5));
      objects.push(m);
    }
    return {
      objects,
      // the materials stay alive until the floor unloads: three frees a program when its last material is
      // disposed, and these are the only users of the fade variants until the first corpse fades
      dispose: () => { for (const o of objects) o.removeFromParent(); for (const sk of skins) sk.dispose(); this.keepAlive.push(...mats); },
    };
  }

  /**
   * Warm-up: make every enemy-side object drawable (hidden risers, other-state enemies, pooled remnants, statues,
   * imprints). Returns the restore function (visibility is re-derived by onStateChange / update afterwards).
   */
  forceVisible(): () => void {
    const sc = this.g.scene;
    const pooled = [...this.remnantPool];
    for (const e of pooled) sc.add(e.root);
    for (const e of [...this.enemies, ...pooled]) e.root.visible = true;
    for (const s of this.statues) s.visible = true;
    for (const im of this.imprints) im.obj.visible = true;
    return () => {
      for (const e of pooled) { sc.remove(e.root); e.root.visible = false; }
      for (const e of this.enemies) if (e.state === 'hidden') e.root.visible = false;
      this.onStateChange(this.g.time.state);
    };
  }

  /** Remove and free every enemy-side object of the floor (rig templates stay with the AssetManager). */
  dispose() {
    const sc = this.g.scene;
    for (const e of [...this.enemies, ...this.remnants, ...this.remnantPool]) { sc.remove(e.root); e.dispose(); }
    for (const st of this.statues) { sc.remove(st); disposeClone(st); }
    for (const im of this.imprints) { sc.remove(im.obj); disposeClone(im.obj); }
    for (const ar of this.arrows) sc.remove(ar.mesh);
    for (const m of this.arrowPool) sc.remove(m);
    this.enemies = []; this.remnants = []; this.remnantPool = []; this.statues = []; this.imprints = [];
    this.arrows = []; this.arrowPool = [];
    this.encounters.clear();
    this.slotsUsed.clear();
    this.hitRegistry.clear();
    this.statueMat?.dispose();
    for (const m of this.keepAlive) m.dispose();
    this.keepAlive = [];
    this.arrowGeo.dispose(); this.arrowMat.dispose(); this.arrowMatEcho.dispose();
    this.assets = new Map();
    this.boss = null;
  }
  private statueMat: THREE.Material | null = null;
  /** warm-up materials kept so their shader programs stay resident for the floor */
  private keepAlive: THREE.Material[] = [];

  private instantiate(asset: AssetId) {
    const a = this.assets.get(asset);
    if (!a) throw new Error(`Enemy rig "${asset}" was not preloaded for this floor (see GameAssets.floorKeys)`);
    const model = skeletonClone(a.scene);
    const wrap = new THREE.Group();
    wrap.add(model);
    if (asset === 'ghost') model.applyMatrix4(a.norm);
    return { model: wrap, clips: a.clips };
  }

  private spawnFromMarkers() {
    const lvl = this.g.level;
    for (const m of lvl.markersOf('encounter')) {
      const p = m.props;
      this.encounters.set(p.eid, {
        id: p.eid, state: p.state, box: m.box!.clone().expandByScalar(0.2), enemies: [], triggered: false, cleared: false,
        wave: 0, optional: !!p.optional, finale: !!p.finale, tutorial: !!p.tutorial, bossFight: !!p.boss, surge: !!p.surge || !!p.finale, title: p.title as string | undefined,
      });
    }
    for (const m of lvl.markersOf('enemy')) this.spawnEnemy(m);
  }

  private spawnEnemy(m: Marker) {
    const p = m.props;
    const arch = ARCHETYPES[p.archetype as ArchetypeId];
    if (!arch) throw new Error('Unknown archetype ' + p.archetype);
    const { model, clips } = this.instantiate(arch.asset);
    // Blender yaw (about +Z) → three.js yaw (about +Y): character forward is -Y in Blender = +Z three
    const yaw = (p.yaw ?? 0) + Math.PI;
    const e = new Enemy(arch, model, clips, p.encounter, p.state, p.wave ?? 1, { rise: !!p.rise, kneel: !!p.kneel, perch: !!p.perch, yaw, tint: p.tint });
    e.place(m.pos);
    this.g.scene.add(e.root);
    this.enemies.push(e);
    const enc = this.encounters.get(p.encounter);
    if (!enc) throw new Error(`Enemy references unknown encounter ${p.encounter}`);
    enc.enemies.push(e);
    if (arch.boss) this.boss = e;
    return e;
  }

  /** Statue of the First Crown (Past) and kneeling civilian Echo imprints (Past chapel). */
  private spawnStaticFigures() {
    const statues = this.g.level.markersOf('statue');
    const knight = this.assets.get('knight');
    if (statues.length && !knight) throw new Error('statue markers need the knight rig (floor manifest)');
    const stone = this.statueMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.9, metalness: 0 });
    for (const m of statues) {
      if (!knight) break;
      const model = skeletonClone(knight.scene);
      model.scale.setScalar(1.35);
      const mix = new THREE.AnimationMixer(model);
      const idle = knight.clips.find((c) => c.name === 'idle_combat')!;
      mix.clipAction(idle).play();
      mix.update(0.3);
      model.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.material = stone; mm.castShadow = true; mm.frustumCulled = false; } });
      stabilizeShadowDepth(model);
      model.position.copy(m.pos);
      model.rotation.y = (m.props.yaw ?? 0) + Math.PI;
      model.userData.state = m.props.state ?? 'PAST';
      this.g.scene.add(model);
      this.statues.push(model);
    }
    const imprints = this.g.level.markersOf('imprint');
    const archer = this.assets.get('archer');
    if (imprints.length && !archer) throw new Error('imprint markers need the archer rig (floor manifest)');
    for (const m of imprints) {
      if (!archer) break;
      const model = skeletonClone(archer.scene);
      const mix = new THREE.AnimationMixer(model);
      const k = archer.clips.find((c) => c.name === 'crouch_idle');
      if (k) { mix.clipAction(k).play(); mix.update(0.5); }
      const mats: THREE.Material[] = [];
      model.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.isMesh) {
          const mat = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
          mm.material = mat; mats.push(mat); mm.frustumCulled = false;
        }
      });
      model.position.copy(m.pos);
      model.rotation.y = (m.props.yaw ?? 0) + Math.PI;
      model.userData.state = 'PAST';
      this.g.scene.add(model);
      this.imprints.push({ obj: model, mats, fade: 1 });
    }
    this.onStateChange(this.g.time.state);
  }

  // ------------------------------------------------------------------ queries
  isCleared(id: string) { return this.encounters.get(id)?.cleared ?? false; }

  private hostileNear(p: THREE.Vector3, r: number) {
    const st = this.g.time.state;
    return this.enemies.some((e) => e.alive && !e.removed && (e.owner === st || e.owner === 'BOTH') && e.state !== 'hidden' && e.state !== 'dormant' && e.pos.distanceTo(p) < r)
      || this.remnants.some((e) => e.alive && e.pos.distanceTo(p) < r);
  }

  private liveIn(st: TimeState) { return (e: Enemy) => e.alive && !e.removed && (e.owner === st || e.owner === 'BOTH'); }

  pickLockTarget(from: THREE.Vector3, camFwd: THREE.Vector3) {
    const st = this.g.time.state;
    let best: Enemy | null = null, bestScore = Infinity;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (!this.liveIn(st)(e) || e.state === 'hidden') continue;
      const to = _a.subVectors(e.pos, from);
      const d = to.length();
      if (d > 20) continue;
      const ang = camFwd.angleTo(to.setY(0).normalize());
      const score = d + ang * 8;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (!best) return null;
    const e = best;
    return { get pos() { return e.pos; }, get alive() { return e.alive && !e.removed && (e.owner === st || e.owner === 'BOTH'); } };
  }

  /** Engaged enemies of the current state near `from` (camera framing, off-screen markers), most urgent first. */
  threats(from: THREE.Vector3, melee: number, ranged: number): Enemy[] {
    const st = this.g.time.state;
    const out: { e: Enemy; score: number }[] = [];
    for (const list of [this.enemies, this.remnants]) for (const e of list) {
      if (!e.alive || e.removed || !e.triggered || e.state === 'hidden' || e.state === 'dormant' || e.state === 'rise') continue;
      if (e.owner !== st && e.owner !== 'BOTH') continue;
      const d = e.pos.distanceTo(from);
      if (d > (e.isRanged ? ranged : melee)) continue;
      const hot = e.isRanged ? e.state === 'shoot' && e.shootPhase === 1 : e.state === 'attack' || e.state === 'windup' || e.state === 'dive' || e.state === 'lunge';
      out.push({ e, score: d - (hot ? 100 : 0) - (e.isRanged ? 20 : 0) });
    }
    out.sort((a, b) => a.score - b.score);
    return out.map((x) => x.e);
  }

  autoTarget(from: THREE.Vector3, facing: THREE.Vector3): THREE.Vector3 | null {
    const st = this.g.time.state;
    let best: Enemy | null = null, bestD = 4.2;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (!this.liveIn(st)(e) || e.state === 'hidden' || e.state === 'dormant') continue;
      const to = _a.subVectors(e.pos, from).setY(0);
      const d = to.length();
      if (d < bestD && facing.angleTo(to.normalize()) < 1.2) { bestD = d; best = e; }
    }
    return best ? best.pos : null;
  }

  // ------------------------------------------------------------------ state
  onStateChange(st: TimeState) {
    for (const e of this.enemies) {
      const vis = (e.owner === st || e.owner === 'BOTH') && !e.removed && e.state !== 'hidden';
      e.root.visible = vis;
      if (e.hasSlot && e.owner !== st && e.owner !== 'BOTH') { this.releaseSlot(e); e.hasSlot = false; }
      if (e.owner === 'BOTH' && e.alive) this.relocateIfInvalid(e, st);
    }
    for (const r of this.remnants) r.root.visible = true;
    for (const s of this.statues) s.visible = s.userData.state === st;
    for (const im of this.imprints) im.obj.visible = st === 'PAST' && im.fade > 0;
    for (const a of this.arrows) a.mesh.visible = a.state === st;
  }

  private relocateIfInvalid(e: Enemy, st: TimeState) {
    const w = this.g.level.collision;
    const p = e.pos.clone();
    if (w.hasFooting(p, 3, st) && w.overlap(p, e.radius, e.height, st) < 0.3) return;
    const anchor = this.g.level.markersOf('warden_anchor').find((m) => m.props.state === st || !m.props.state);
    const target = anchor ? anchor.pos.clone() : this.g.player.pos.clone().add(new THREE.Vector3(3, 0, 3));
    e.pos.copy(target);
    this.g.fx.shiftBurst(target, st);
  }

  // ------------------------------------------------------------------ slots
  requestSlot = (e: Enemy, cost: number) => {
    if (e.arch.boss) return true; // the boss attacks on its own schedule; it never starves the pool
    let used = 0;
    for (const v of this.slotsUsed.values()) used += v;
    // during the finale only one add may press the player while the Warden lives
    const cap = this.boss && this.boss.triggered && this.boss.alive ? 1 : this.slotCapacity;
    if (used + cost > cap && used > 0) return false;
    this.slotsUsed.set(e.id, cost);
    e.slotTime = 0;
    return true;
  };
  releaseSlot = (e: Enemy) => { this.slotsUsed.delete(e.id); };

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const g = this.g;
    const st = g.time.state;
    const p = g.player;
    const ctx: EnemyCtx = {
      playerPos: p.pos, playerAlive: p.alive, world: g.level.collision, state: st, now: g.t,
      requestSlot: this.requestSlot, releaseSlot: this.releaseSlot,
      onAttackHit: (e, atk) => this.enemyHitsPlayer(e, atk),
      shoot: (e) => this.shoot(e),
      lineOfSight: (a, b) => {
        const dir = b.clone().sub(a);
        const len = dir.length();
        const hit = g.level.collision.raycast(a, dir.normalize(), len, st);
        return !hit || hit.distance > len - 0.4;
      },
    };
    // encounter triggers
    const head = p.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    for (const enc of this.encounters.values()) {
      if (enc.cleared) continue;
      if (enc.state !== st && enc.state !== 'BOTH') continue;
      if (!enc.triggered && p.alive && enc.box.containsPoint(head)) this.trigger(enc);
      if (enc.triggered) this.updateWaves(enc);
    }
    // aggro-on-sight for untriggered enemies
    for (const e of this.enemies) {
      if (e.triggered || !e.alive || e.state === 'hidden' || e.state === 'dormant') continue;
      if (e.owner !== st && e.owner !== 'BOTH') continue;
      if (this.encounters.get(e.encounter)?.finale) continue; // the finale starts only from its arena volume
      if (e.pos.distanceTo(p.pos) < Math.min(9, e.arch.aggroRange) && Math.abs(e.pos.y - p.pos.y) < 3 &&
        ctx.lineOfSight(e.center.clone(), p.pos.clone().setY(p.pos.y + 1.3))) {
        const enc = this.encounters.get(e.encounter)!;
        if (!enc.triggered) this.trigger(enc); else e.activate();
      }
    }
    let active = 0;
    let combat = false;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (e.removed) continue;
      if (e.owner !== st && e.owner !== 'BOTH') continue;
      const d = e.pos.distanceTo(p.pos);
      // render only what can matter: near enemies or those in a live fight
      e.root.visible = e.state !== 'hidden' && (d < 42 || (e.triggered && e.alive));
      const hot = e.triggered || d < 38;
      if (!hot && e.alive) continue;
      // bosses are never lost to a void: a kick toward the edge staggers them instead (blueprint E10)
      if (e.arch.boss && e.alive && e.state !== 'hit' && (Math.abs(e.vel.x) + Math.abs(e.vel.z)) > 1 && e.catchAtEdge(ctx)) {
        g.hud.prompt('The Captain reels at the edge!', 1.5);
        g.fx.dust(e.pos.clone(), 8);
      }
      e.update(dt, ctx);
      this.presentEnemy(e, dt);
      active++;
      if (e.triggered && e.alive && d < 22) combat = true;
      if (e.alive && (g.level.collision.inVoid(e.pos, st) || e.pos.y < -30)) { e.die(); this.onKill(e, true); }
    }
    this.separate();
    this.activeCount = active;
    this.inCombat = combat;
    this.playerHitsEnemies();
    this.updateArrows(dt, st);
    this.updateFissures(dt);
    // imprints dissolve once the chapel fight starts
    const e10 = this.encounters.get('E10');
    for (const im of this.imprints) {
      if (e10?.triggered && im.fade > 0) { im.fade = Math.max(0, im.fade - dt * 0.8); for (const m of im.mats) (m as any).opacity = 0.32 * im.fade; if (im.fade <= 0) im.obj.visible = false; }
    }
    // boss bar
    if (this.boss && this.boss.triggered && this.boss.alive) g.hud.boss(this.bossName, this.boss.hp / this.boss.arch.hp);
    else g.hud.boss(null);
    // dead remnants go back to the pool
    this.remnants = this.remnants.filter((r) => { if (r.removed) { g.scene.remove(r.root); r.reset(); this.remnantPool.push(r); return false; } return true; });
  }

  /** Per-enemy presentation: drain gameplay events into VFX/audio cues and emit identity auras. */
  private presentEnemy(e: Enemy, dt: number) {
    const g = this.g;
    const au = g.audio;
    const at = e.center.clone();
    const asset = e.arch.asset;
    for (const ev of e.events) {
      if ((ev === 'telegraph' || ev === 'aim') && e.weaponBone && e.root.visible) {
        const col = ev === 'aim' ? 0xffe2a8 : e.isFlying ? 0xd8ecff : 0xfff0d0;
        g.fx.glint(e.weaponBone, col, (ev === 'aim' ? 0.4 : 0.6) * e.arch.scale, ev === 'aim' ? 0.4 : 0.34);
      }
      if (!e.root.visible) continue;
      switch (ev) {
        case 'alert':
          if (asset === 'hollow') au.play('hollow_growl', { pos: at, rate: e.arch.scale < 1 ? 1.15 : 1 });
          else if (asset === 'ghost') au.play('wraith_moan', { pos: at });
          else if (asset === 'knight') au.play('armor_rattle', { pos: at });
          break;
        case 'telegraph':
        case 'windup':
          if (asset === 'knight') au.play('armor_rattle', { pos: at, vol: e.arch.scale > 1.1 ? 1.3 : 1 });
          else if (asset === 'hollow' && Math.random() < (ev === 'telegraph' ? 0.75 : 0.35)) au.play('hollow_growl', { pos: at });
          else if (asset === 'ghost') au.play('wraith_dive', { pos: at });
          break;
        case 'swing': {
          const w = e.arch.boss ? 0.95 : e.arch.scale > 1.1 ? 0.75 : asset === 'hollow' ? 0.3 : 0.5;
          au.swing(w, at, 0.95);
          break;
        }
        case 'aim': au.play('bow_draw', { pos: at }); break;
        case 'death':
          if (asset === 'knight') au.play('armor_rattle', { pos: at, vol: 1.4 });
          else if (asset === 'hollow') au.play('hollow_death', { pos: at, rate: e.arch.scale < 1 ? 1.12 : 1 });
          else if (asset === 'ghost') au.play('wraith_death', { pos: at });
          break;
        case 'land':
          // the body hits the floor: thud, dust, and a pool spreading under it
          au.play(asset === 'knight' ? 'armor_crash' : 'body_fall', { pos: e.pos.clone(), rate: e.arch.scale > 1.2 ? 0.8 : 1 });
          g.fx.dust(e.pos.clone().setY(e.pos.y + 0.1), 6);
          if (!e.isFlying) { g.gore.splat(e.pos.clone().setY(e.pos.y + 0.6), new THREE.Vector3(0, -1, 0), 1.1 + e.arch.scale * 0.4, 1.5); au.play('blood_splash', { pos: e.pos.clone() }); }
          break;
        case 'shatter':
          // the Echo breaks: the body comes apart into what it was made of
          g.fx.shatter(e.root, asset === 'hollow' ? 'ash' : asset === 'ghost' ? 'smoke' : 'ember', asset === 'ghost' ? 160 : 280);
          au.play('resonance', { pos: at, rate: 0.8, vol: 0.8 });
          au.play('echo_shatter', { pos: at, rate: asset === 'ghost' ? 1.15 : asset === 'knight' ? 0.9 : 1 });
          break;
      }
    }
    e.events.length = 0;
    // footfalls of nearby walkers, and the wraiths' idle moaning
    const dp = g.player.pos.distanceToSquared(e.pos);
    if (e.alive && !e.isFlying && e.root.visible && dp < 16 * 16 && e.grounded) {
      const moved = Math.hypot(e.pos.x - e.lastSeen.x, e.pos.z - e.lastSeen.z);
      if (moved < 1) e.stepAcc += moved * 0.62;
      if (e.stepAcc > 1) { e.stepAcc -= 1; au.enemyStep(e.pos, asset === 'knight'); }
    }
    if (e.isFlying && e.alive && e.triggered && dp < 24 * 24) {
      e.voiceT -= dt;
      if (e.voiceT <= 0) { e.voiceT = 5 + Math.random() * 6; au.play('wraith_moan', { pos: at, vol: 0.7 }); }
    }
    e.lastSeen.copy(e.pos);
    // only nearby enemies cast shadows (shadow passes were the biggest per-enemy cost)
    const cast = dp < 20 * 20;
    if (cast !== e.castsShadow) { e.castsShadow = cast; e.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = cast; }); }
    if (e.arch.aura && e.alive && e.root.visible && e.state !== 'hidden' && e.pos.distanceToSquared(g.player.pos) < 30 * 30) {
      g.fx.aura(e.arch.aura, e.pos, e.radius, e.height * e.arch.scale, dt, e);
    }
  }

  private trigger(enc: Encounter) {
    this.g.perf.mark(`encounter ${enc.id} (${enc.enemies.filter((e) => e.wave <= 1).length})`);
    enc.triggered = true;
    enc.wave = 1;
    for (const e of enc.enemies) if (e.wave <= 1) e.activate();
    if (enc.bossFight && !enc.finale) {
      const boss = enc.enemies.find((e) => e.arch.boss);
      if (boss) { this.boss = boss; this.bossName = enc.title ?? this.bossName; }
      this.g.hud.message(enc.title ?? 'A GUARDIAN WAKES', 'Echo of the royal guard', 3.5);
      this.g.audio.bossSting();
    }
    if (enc.finale) {
      this.g.hud.message('THE LAST MUSTER', 'The Gate Warden wakes', 3.5);
      this.g.audio.bossSting();
      this.g.pendingArenaLock = true;
    }
    if (enc.tutorial) this.g.hud.prompt(Hints.combatTutorial(), 8);
  }

  private updateWaves(enc: Encounter) {
    if ((enc.finale || enc.bossFight) && this.boss && enc.enemies.includes(this.boss) && !this.boss.alive && !enc.cleared) {
      // the Warden's fall ends the Last Muster: its remaining Echoes collapse with it
      for (const e of enc.enemies) if (e.alive) { e.die(); this.killCount++; }
      this.clear(enc);
      return;
    }
    const alive = enc.enemies.filter((e) => e.alive);
    if (!alive.length) {
      if (!enc.cleared) this.clear(enc);
      return;
    }
    const maxWave = Math.max(...enc.enemies.map((e) => e.wave));
    if (enc.wave >= maxWave) return;
    let advance = false;
    if ((enc.finale || enc.bossFight) && this.boss && enc.enemies.includes(this.boss)) {
      const f = this.boss.hp / this.boss.arch.hp;
      advance = (enc.wave === 1 && f < 0.65) || (enc.wave === 2 && f < 0.35);
    } else {
      const inWave = enc.enemies.filter((e) => e.wave <= enc.wave && e.alive).length;
      advance = inWave <= 1;
    }
    if (advance) {
      enc.wave++;
      this.g.perf.mark(`wave ${enc.id}.${enc.wave}`);
      for (const e of enc.enemies) if (e.wave === enc.wave) e.activate();
    }
  }

  private clear(enc: Encounter) {
    enc.cleared = true;
    if (enc.surge) {
      if (enc.finale) this.g.setArenaLock(false);
      this.g.time.gain(Math.max(0, 100 - this.g.time.charge) + 100, 'surge');
      this.g.hud.message(enc.finale ? 'THE WARDEN FALLS' : (enc.title ?? 'THE GUARDIAN') + ' FALLS', 'Resonance floods your blood', 4);
      this.g.audio.shiftBoom(this.g.time.state);
      this.onBossDeath?.();
    }
  }

  private separate() {
    const list = [...this.enemies, ...this.remnants].filter((e) => e.alive && e.root.visible && (e.triggered || e.state === 'idle'));
    const p = this.g.player;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius + 0.25;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6 && Math.abs(a.pos.y - b.pos.y) < 1.5) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
          b.pos.x += dx / d * push; b.pos.z += dz / d * push;
        }
      }
      // player vs enemy: enemies yield more than the player
      const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z;
      const min = a.radius + p.radius + 0.05;
      const d2 = dx * dx + dz * dz;
      if (!a.isFlying && d2 < min * min && d2 > 1e-6 && Math.abs(a.pos.y - p.pos.y) < 1.6) {
        const d = Math.sqrt(d2), push = min - d;
        a.pos.x -= dx / d * push * 0.7; a.pos.z -= dz / d * push * 0.7;
        p.pos.x += dx / d * push * 0.3; p.pos.z += dz / d * push * 0.3;
      }
    }
  }

  // ------------------------------------------------------------------ combat resolution
  private enemyHitsPlayer(e: Enemy, atk: EnemyAttack) {
    const g = this.g, p = g.player;
    const res = p.receiveHit(atk.damage, e.pos, { heavy: atk.heavy, guardBreak: atk.guardBreak, knock: atk.knock, unblockable: atk.unblockable }, g.input.now);
    if (res === 'parry') {
      e.parried();
      g.fx.sparks(p.blade.tip, 26, 0xfff2c0);
      g.fx.hitstop(0.09);
    } else if (res === 'block') {
      g.rig.addShake(0.12);
    } else if (res === 'hit') {
      g.audio.hurt();
      const hurtDir = p.pos.clone().sub(e.pos).setY(0).normalize();
      const at = p.pos.clone().setY(p.pos.y + 1.2);
      g.fx.bloodSpray(at, hurtDir, atk.heavy ? 0.8 : 0.45);
      g.gore.aftermath(at, hurtDir, atk.heavy ? 0.6 : 0.3);
      g.rig.addShake(atk.heavy ? 0.45 : 0.22);
      g.hud.flash('#6a0000', 0.22);
    }
  }

  private playerHitsEnemies() {
    const g = this.g, p = g.player;
    const hits = p.activeHits();
    if (!hits.length) return;
    if (p.attack !== this.lastAttack || p.stateTime < 0.02) {
      if (p.attack !== this.lastAttack) { this.attackSerial++; this.lastAttack = p.attack; }
    }
    const st = g.time.state;
    const targets = [...this.enemies, ...this.remnants].filter((e) => this.liveIn(st)(e) && e.state !== 'hidden');
    const f = p.facing.clone();
    for (const { win, index } of hits) {
      for (const e of targets) {
        const key = `${this.attackSerial}:${index}:${e.id}`;
        if (this.hitRegistry.has(key)) continue;
        let hit = false;
        let contact = e.center.clone();
        const dy = Math.abs(e.pos.y - p.pos.y);
        if (win.shape === 'blade') {
          const bottom = e.pos.clone().setY(e.pos.y + e.radius * 0.6);
          const top = e.pos.clone().setY(e.pos.y + e.height - e.radius * 0.3);
          const b = p.blade;
          for (let k = 0; k <= 4 && !hit; k++) {
            const t = k / 4;
            const h = b.prevHilt.clone().lerp(b.hilt, t);
            const tip = b.prevTip.clone().lerp(b.tip, t);
            // extend the blade slightly (generous hitbox reads better)
            tip.addScaledVector(tip.clone().sub(h).normalize(), 0.15);
            const d = segSegDist(h, tip, bottom, top);
            if (d < e.radius + 0.18) { hit = true; contact = tip.clone().lerp(h, 0.3); }
          }
          // reach fallback for fast lunges: target squarely in front within reach
          if (!hit && win.reach) {
            const to = e.pos.clone().sub(p.pos).setY(0);
            if (to.length() < win.reach + e.radius && f.angleTo(to.normalize()) < 0.6 && dy < 1.6) hit = true;
          }
        } else {
          const to = e.pos.clone().sub(p.pos).setY(0);
          const d = to.length();
          const reach = (win.reach ?? 2.5) + e.radius;
          const arc = win.shape === 'front' ? (win.arc ?? 90) : (win.arc ?? 360);
          const ang = THREE.MathUtils.radToDeg(f.angleTo(to.normalize()));
          if (d < reach && (arc >= 360 || ang < arc / 2) && dy < 1.9) hit = true;
        }
        if (!hit) continue;
        this.hitRegistry.add(key);
        p.hitsDone.add(index * 1000 + e.id);
        const res = e.takeHit(win.damage, win.poise, win.knock, p.pos, { knockdown: win.knockdown, guardBreak: win.guardBreak });
        if (win.shape === 'front') { g.audio.kickHit(contact); if (res === 'blocked') g.audio.hitEnemy('blocked', win.damage, contact); }
        else g.audio.hitEnemy(res === 'blocked' ? 'blocked' : e.isFlying ? 'spirit' : e.arch.asset === 'knight' ? 'armor' : 'flesh', win.damage, contact);
        if (e.arch.asset === 'hollow' && (res === 'flinch' || res === 'stagger') && Math.random() < 0.6) g.audio.play('hollow_hurt', { pos: contact });
        this.impact(e, res, win.damage, contact);
        g.time.gain(2, 'hit');
        if (p.attack?.resonance && res !== 'blocked') g.time.gain(p.attack.resonance, 'finisher');
        const heavy = win.damage >= 28 || res === 'stagger';
        g.fx.hitstop(res === 'dead' ? 0.1 : heavy ? 0.07 : 0.04);
        g.rig.addShake(res === 'dead' ? 0.34 : heavy ? 0.28 : 0.12);
        if (res === 'dead') this.onKill(e);
      }
    }
    if (this.hitRegistry.size > 4000) this.hitRegistry.clear();
  }

  /**
   * Hit presentation: blood follows the blade's real sweep; killing blows fling the body (harder for heavy
   * attacks and finishers), throw gore, and give the kill a short slow-motion beat.
   */
  private impact(e: Enemy, res: string, damage: number, contact: THREE.Vector3) {
    const g = this.g, p = g.player;
    const sweep = p.blade.tip.clone().sub(p.blade.prevTip);
    sweep.y *= 0.35;
    const away = e.pos.clone().sub(p.pos).setY(0).normalize();
    const dir = (sweep.lengthSq() > 1e-4 ? sweep.normalize() : away.clone()).lerp(away, 0.45).normalize();
    if (res === 'blocked') { g.fx.sparks(contact, 18, 0xffd090); return; }
    const kind = p.attack?.kind;
    const power = res === 'dead' ? (kind && HEAVY_KINDS.has(kind) ? 1 : damage >= 28 ? 0.75 : 0.35) : 0;
    const amount = Math.min(1.5, damage / 28) + (res === 'dead' ? 0.35 + power * 0.4 : 0);
    const asset = e.arch.asset;
    if (e.isFlying) g.fx.ashBurst(contact, dir, Math.round(10 + amount * 16));
    else {
      g.fx.bloodSpray(contact, dir, amount, asset === 'hollow' ? 0x3c0906 : 0x7a0909);
      g.gore.aftermath(contact, dir, amount);
      if (asset === 'knight') g.fx.sparks(contact, 8, 0xffe0b0);
    }
    if (res !== 'dead') return;
    e.fling(away.clone().lerp(dir, 0.3).normalize(), power);
    if (!e.isFlying) g.gore.gibs(e.center.clone(), dir, Math.round(3 + power * 10), asset === 'hollow' ? 'rotten' : asset === 'knight' ? 'armor' : 'flesh');
    g.fx.slowmo(power > 0.7 ? 0.34 : 0.16, power > 0.7 ? 0.2 : 0.42);
    g.kickFov(power > 0.7 ? 6 : 3);
    g.audio.play('hit_slice', { pos: contact, rate: 0.75, vol: 1.2 });
    if (power > 0.7) g.audio.play('kick_hit', { pos: contact, rate: 0.7 });
    // ElevenLabs layers (tools/elevenlabs_sfx.mjs): wet kill, body blow, bone on finishers
    if (!e.isFlying) g.audio.play('gore_splat', { pos: contact, jitter: 0.08 });
    if (power > 0.35) g.audio.play('kill_impact', { pos: contact, rate: asset === 'knight' ? 0.92 : 1 });
    if (power > 0.7 && !e.isFlying) g.audio.play('bone_crunch', { pos: contact });
  }

  onKill(e: Enemy, voidDeath = false) {
    this.killCount++;
    const pl = this.g.player;
    if (pl.alive) pl.hp = Math.min(pl.maxHp, pl.hp + (e.arch.boss ? 80 : e.arch.reward >= 70 ? 30 : 12));
    if (e.hasSlot) { this.releaseSlot(e); e.hasSlot = false; }
    this.g.time.gain(e.arch.reward, 'kill');
    this.g.fx.resonanceFrom(e.center.clone(), this.g.player, e.arch.reward);
    this.g.audio.release(e.center.clone());
    if (voidDeath) this.g.hud.prompt('Cast into the void.', 2);
    if (e.arch.boss) { /* surge handled by encounter clear */ }
  }

  private shoot(e: Enemy) {
    const g = this.g;
    const st = g.time.state;
    const from = e.pos.clone().add(new THREE.Vector3(0, 1.45 * e.arch.scale, 0)).addScaledVector(e.facing, 0.5);
    const target = g.player.pos.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(g.player.vel.clone().setY(0), 0.25);
    const r = e.arch.ranged!;
    const vel = target.sub(from).normalize().multiplyScalar(r.projectileSpeed);
    vel.y += 0.6;
    const mesh = this.arrowPool.pop() ?? new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.material = e.arch.spectralArrows ? this.arrowMatEcho : this.arrowMat;
    mesh.visible = true;
    mesh.position.copy(from);
    mesh.lookAt(from.clone().add(vel));
    g.scene.add(mesh);
    this.arrows.push({ mesh, vel, life: 3, damage: r.damage, owner: e, state: st });
    g.audio.arrowLoose(from);
  }

  private updateArrows(dt: number, st: TimeState) {
    const g = this.g, p = g.player;
    for (const a of this.arrows) {
      if (a.life <= 0) continue;
      a.life -= dt;
      if (a.state !== st) { a.life = 0; continue; }
      a.vel.y -= 3.5 * dt;
      const from = a.mesh.position.clone();
      const step = a.vel.clone().multiplyScalar(dt);
      const len = step.length();
      const hit = g.level.collision.raycast(from, step.clone().normalize(), len, st);
      const to = from.clone().add(step);
      // player capsule
      const bottom = p.pos.clone().setY(p.pos.y + 0.35), top = p.pos.clone().setY(p.pos.y + p.height - 0.3);
      if (p.alive && segSegDist(from, to, bottom, top) < p.radius + 0.1) {
        const res = p.receiveHit(a.damage, a.owner.pos, { knock: 1 }, g.input.now);
        if (res !== 'ignored') {
          a.life = 0;
          if (res === 'block' || res === 'parry') g.fx.sparks(to, 10, 0xffd090);
          else { g.fx.blood(to, 6); g.audio.hurt(); g.rig.addShake(0.15); }
          continue;
        }
      }
      if (hit) { a.mesh.position.copy(hit.point); a.life = Math.min(a.life, 1.5); a.vel.set(0, 0, 0); g.audio.arrowHit(hit.point); continue; }
      a.mesh.position.copy(to);
      a.mesh.lookAt(to.clone().add(a.vel));
    }
    this.arrows = this.arrows.filter((a) => { if (a.life <= 0) { g.scene.remove(a.mesh); this.arrowPool.push(a.mesh); return false; } return true; });
  }

  // ------------------------------------------------------------------ fissures (softlock guarantee)
  private updateFissures(dt: number) {
    const g = this.g, p = g.player;
    if (!g.time.unlocked || !p.alive) return;
    for (const [k, v] of this.fissureCooldown) this.fissureCooldown.set(k, v - dt);
    if (g.time.charge >= 100) return;
    for (const f of g.level.markersOf('fissure')) {
      if (f.pos.distanceTo(p.pos) > 14 || Math.abs(f.pos.y - p.pos.y) > 4) continue;
      if ((this.fissureCooldown.get(f.name) ?? 0) > 0) continue;
      if (this.hostileNear(p.pos, 25)) continue;
      this.fissureCooldown.set(f.name, 15);
      g.perf.mark('fissure remnants');
      for (let i = 0; i < 2; i++) {
        const e = this.remnantPool.pop() ?? this.makeRemnant();
        g.perf.mark(this.remnantPool.length ? 'remnant from pool' : 'remnant pool empty');
        e.owner = g.time.state;
        e.yaw = Math.random() * 6.28;
        const off = new THREE.Vector3(Math.cos(i * Math.PI) * 1.2, 0, Math.sin(i * Math.PI) * 1.2);
        e.place(f.pos.clone().add(off));
        g.scene.add(e.root);
        e.activate();
        this.remnants.push(e);
      }
      g.hud.prompt('Echoes stir from the fissure — resonance to be reclaimed.', 4);
      g.fx.shiftBurst(f.pos, g.time.state);
      break;
    }
  }

  // ------------------------------------------------------------------ checkpoint reset
  resetUncleared() {
    this.g.setArenaLock(false);
    for (const enc of this.encounters.values()) {
      if (enc.cleared) continue;
      enc.triggered = false;
      enc.wave = 0;
      for (const e of enc.enemies) { e.reset(); }
    }
    for (const r of this.remnants) { this.g.scene.remove(r.root); r.reset(); this.remnantPool.push(r); }
    this.remnants = [];
    this.slotsUsed.clear();
    for (const a of this.arrows) { this.g.scene.remove(a.mesh); this.arrowPool.push(a.mesh); }
    this.arrows = [];
    this.onStateChange(this.g.time.state);
  }

  clearedIds() { return [...this.encounters.values()].filter((e) => e.cleared).map((e) => e.id); }
}
