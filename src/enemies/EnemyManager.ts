import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemy, type EnemyCtx } from './Enemy';
import { LastCrown } from './LastCrown';
import { makeMonster, MonsterFX } from './Monsters';
import { ARCHETYPES, MONSTER_RIGS, PAST_COUNTERPART, type ArchetypeId, type AssetId, type EnemyAttack } from './EnemyTypes';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import type { Marker } from '../levels/Level';
import type { EnemyTemplate } from '../assets/GameAssets';
import { stabilizeShadowDepth } from '../vfx/ShadowDepth';
import { FEEL } from '../combat/CombatData';
import { Platform } from '../platform/Platform';
import type { NavGrid } from './NavGrid';

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
const TRACER_POOL = 8;
/** arrow gravity (m/s^2) — shots are aimed with the matching ballistic lift */
const ARROW_GRAVITY = 3.5;
const IDENTITY = new THREE.Matrix4();
/** the second line of a titled fight's card */
const BOSS_SUB: Record<string, string> = {
  last_crown: "Aldren's imprint, wearing the Queen's face",
  goblin_king: 'Scavenger lord of the fallen floors',
  widow_mother: 'She nests where the Queen once wept',
  lamia_maw: 'What the Crownheart grew in the dark',
};
/** first sight of a new monster (session 9): how to face it */
const BESTIARY: Record<string, string> = {
  bat: 'GLOOM BATS — they swoop two at a time. Strike as they dive, or parry one out of the air.',
  goblin: 'RUIN GOBLINS — they leap in from range and dart away. Close the gap; they shy from a heavy swing.',
  widow: 'THE WIDOW — its web slows you. Guard the spit, break its line of sight, punish the pounce.',
  widowling: 'THE BROOD — small and quick. Sweeping blows clear them.',
  lamia: 'CROWNHEART LAMIA — jump or dodge the tail sweep. Its coil turns frontal blows: circle it, or kick through.',
};

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
  /** pre-instantiated fissure Echoes (spawning never clones a rig mid-game): Remnants for the Present,
   *  remembered guards for the Past (no Hollow ever rises in the living castle) */
  private remnantPool: Enemy[] = [];
  private pastEchoPool: Enemy[] = [];
  /** pooled arrow meshes */
  private arrowPool: THREE.Mesh[] = [];
  enemies: Enemy[] = [];
  encounters = new Map<string, Encounter>();
  arrows: Arrow[] = [];
  killCount = 0;
  slotsUsed = new Map<number, number>();
  slotCapacity = 2;
  private hitRegistry = new Set<string>();
  private sightT = 0;
  inCombat = false;
  /** blows the hero has landed (tutorials) */
  playerHits = 0;
  activeCount = 0;
  fissureCooldown = new Map<string, number>();
  remnants: Enemy[] = [];
  statues: THREE.Object3D[] = [];
  imprints: { obj: THREE.Object3D; mats: THREE.Material[]; fade: number }[] = [];
  private arrowGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5).rotateX(Math.PI / 2);
  private arrowMat = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.8 });
  private arrowMatEcho = new THREE.MeshBasicMaterial({ color: 0x9ae8ff });
  /** aim tracers: a thin line from a drawing archer's bow to the player, brightening toward release */
  private tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  private tracers: THREE.Mesh[] = [];
  /** the floor's baked navigation grid (Game sets it at load) */
  nav: NavGrid | null = null;
  private navPlans = 0;
  /** pooled web globs / warning rings / threads of the session-9 monsters (null on floors without them) */
  monsterFx: MonsterFX | null = null;
  /** gloom bats diving right now (at most two swoop at once) */
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
    this.checkPerches();
    this.checkFlyers();
    this.spawnStaticFigures();
    if (this.enemies.some((e) => e.arch.brain)) this.monsterFx = new MonsterFX(this.g);
    if (this.g.level.markersOf('fissure').length || this.enemies.some((e) => e instanceof LastCrown)) {
      for (let i = 0; i < REMNANT_POOL; i++) this.remnantPool.push(this.makeRemnant());
      if (this.assets.has(ARCHETYPES.remnant_guard.asset)) for (let i = 0; i < REMNANT_POOL; i++) this.pastEchoPool.push(this.makeRemnant('PAST'));
    }
    for (let i = 0; i < ARROW_POOL; i++) {
      const m = new THREE.Mesh(this.arrowGeo, this.arrowMat);
      m.visible = false;
      this.arrowPool.push(m);
    }
    for (let i = 0; i < TRACER_POOL; i++) {
      // own material per tracer (opacity/colour per archer); clones share the warmed program
      const m = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
      m.visible = false; m.frustumCulled = false; m.renderOrder = 5;
      this.g.scene.add(m);
      this.tracers.push(m);
    }
  }

  private makeRemnant(st: TimeState = 'PRESENT') {
    const arch = st === 'PAST' ? ARCHETYPES.remnant_guard : ARCHETYPES.remnant;
    const { model, clips } = this.instantiate(arch.asset);
    return new Enemy(arch, model, clips, 'REMNANT', st, 1, { rise: true, yaw: 0 });
  }
  /** a pooled fissure/boss Echo for memory `st` (a remembered guard in the Past, a Remnant in the Present) */
  private takeEcho(st: TimeState): Enemy | null {
    const arch = st === 'PAST' ? ARCHETYPES.remnant_guard : ARCHETYPES.remnant;
    if (!this.assets.has(arch.asset)) return null;
    return (st === 'PAST' ? this.pastEchoPool : this.remnantPool).pop() ?? this.makeRemnant(st);
  }
  private poolEcho(e: Enemy) { (e.arch.id === 'remnant_guard' ? this.pastEchoPool : this.remnantPool).push(e); }

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
    for (const t of this.assets.values()) {
      const model = skeletonClone(t.scene);
      if (!t.norm.equals(IDENTITY)) model.applyMatrix4(t.norm);
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
    {
      const m = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      m.position.copy(at).add(new THREE.Vector3(0.4, 1.4, -1.5));
      objects.push(m);
    }
    const spellKits = this.enemies.filter((e): e is LastCrown => e instanceof LastCrown).map((e) => e.spells.warmKit(at));
    if (this.monsterFx) { const k = this.monsterFx.warmKit(at); objects.push(...k.objects); spellKits.push(k); }
    return {
      objects,
      // the materials stay alive until the floor unloads: three frees a program when its last material is
      // disposed, and these are the only users of the fade variants until the first corpse fades
      dispose: () => { for (const o of objects) o.removeFromParent(); for (const sk of skins) sk.dispose(); this.keepAlive.push(...mats); for (const k of spellKits) k.dispose(); },
    };
  }

  /**
   * Warm-up: make every enemy-side object drawable (hidden risers, other-state enemies, pooled remnants, statues,
   * imprints). Returns the restore function (visibility is re-derived by onStateChange / update afterwards).
   */
  forceVisible(): () => void {
    const sc = this.g.scene;
    const pooled = [...this.remnantPool, ...this.pastEchoPool];
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
    for (const e of [...this.enemies, ...this.remnants, ...this.remnantPool, ...this.pastEchoPool]) { sc.remove(e.root); e.dispose(); }
    for (const st of this.statues) { sc.remove(st); disposeClone(st); }
    for (const im of this.imprints) { sc.remove(im.obj); disposeClone(im.obj); }
    for (const ar of this.arrows) sc.remove(ar.mesh);
    for (const m of this.arrowPool) sc.remove(m);
    for (const m of this.tracers) { sc.remove(m); (m.material as THREE.Material).dispose(); }
    this.tracers = [];
    this.tracerGeo.dispose(); this.tracerMat.dispose();
    this.enemies = []; this.remnants = []; this.remnantPool = []; this.pastEchoPool = []; this.statues = []; this.imprints = [];
    this.arrows = []; this.arrowPool = [];
    this.encounters.clear();
    this.slotsUsed.clear();
    this.hitRegistry.clear();
    this.statueMat?.dispose();
    for (const m of this.keepAlive) m.dispose();
    this.keepAlive = [];
    this.arrowGeo.dispose(); this.arrowMat.dispose(); this.arrowMatEcho.dispose();
    this.monsterFx?.dispose(); this.monsterFx = null;
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
    // Sketchfab sources normalised at load (ghost, bat, widow, lamia: GameAssets NORMALISE)
    if (!a.norm.equals(IDENTITY)) model.applyMatrix4(a.norm);
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

  /** Past-placed monsters replaced by their living counterpart (see PAST_COUNTERPART); tests expect none on F1/F2 */
  pastFixes: string[] = [];

  private spawnEnemy(m: Marker) {
    const p = m.props;
    let arch = ARCHETYPES[p.archetype as ArchetypeId];
    if (!arch) throw new Error('Unknown archetype ' + p.archetype);
    const sub = p.state === 'PAST' ? PAST_COUNTERPART[arch.id] : undefined;
    if (sub && MONSTER_RIGS.has(arch.asset)) { this.pastFixes.push(`${m.name} ${arch.id} -> ${sub}`); arch = ARCHETYPES[sub]; }
    const { model, clips } = this.instantiate(arch.asset);
    // Blender yaw (about +Z) → three.js yaw (about +Y): character forward is -Y in Blender = +Z three
    const yaw = (p.yaw ?? 0) + Math.PI;
    const opts = { rise: !!p.rise, kneel: !!p.kneel, perch: !!p.perch, yaw, tint: p.tint, ceiling: !!p.ceiling, brood: !!p.brood, fromHeart: !!p.from_heart };
    const e = arch.id === 'last_crown'
      ? new LastCrown(arch, model, clips, p.encounter, p.state, p.wave ?? 1, { yaw }, this.g)
      : makeMonster(arch, model, clips, p.encounter, p.state, p.wave ?? 1, opts, this.g) ?? new Enemy(arch, model, clips, p.encounter, p.state, p.wave ?? 1, opts);
    e.place(this.walkableSpawn(m.pos, p.state, !!p.perch || arch.id === 'last_crown' || !!arch.flying, m.name, this.encounters.get(p.encounter), e.radius));
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

  /** An engaged (triggered, living, visible) enemy of the current memory within r m — Blood Sigils refuse then. */
  engagedNear(p: THREE.Vector3, r: number) {
    const st = this.g.time.state;
    // melee Echoes on another level (below a gallery, behind a locked stair) are no threat; archers and wraiths
    // are when they can see you
    const chest = p.clone().setY(p.y + 1.3);
    const w = this.g.level.collision;
    const sees = (e: Enemy) => {
      const from = e.center.clone(), dir = chest.clone().sub(from), len = dir.length();
      const hitW = w.raycast(from, dir.normalize(), len, st);
      return !hitW || hitW.distance > len - 0.4;
    };
    const hit = (e: Enemy) => e.alive && !e.removed && e.triggered && (e.owner === st || e.owner === 'BOTH') &&
      e.state !== 'hidden' && e.state !== 'dormant' && e.pos.distanceTo(p) < r &&
      ((e.isRanged || e.isFlying) ? sees(e) : Math.abs(e.pos.y - p.y) < 2.5 && e.navMode !== 'hold');
    return this.enemies.some(hit) || this.remnants.some(hit);
  }

  /**
   * Perched archers must be able to see their own fight (session 10 audit: three Floor 2 archers — two in the middle
   * of a 4 m walled gallery above the Chancery, one in a niche of the Crown Loft — and the undercroft scaffold archer
   * of Floor 1 never loosed an arrow). A perch that sees less than 40 % of its arena (walkable points round its
   * encounter's walkers, at chest height, with the archer's own parapet lean) moves along its level — within 4 m (7 m
   * when it sees nothing),
   * standable, never through a wall — to the spot that sees the most. Logged in spawnFixes.
   */
  private checkPerches() {
    const nav = this.nav, col = this.g.level.collision;
    if (!nav) return;
    for (const e of this.enemies) {
      if (!e.opts.perch || !e.isRanged) continue;
      const enc = this.encounters.get(e.encounter);
      if (!enc) continue;
      const st: TimeState = e.owner === 'BOTH' ? 'PRESENT' : e.owner;
      nav.use(st, this.g.level.flags);
      const walkers = enc.enemies.filter((x) => !x.opts.perch && !x.isFlying && (x.owner === st || x.owner === 'BOTH'));
      const seeds = walkers.length ? walkers.map((x) => x.home) : [enc.box.getCenter(new THREE.Vector3()).setY(enc.box.min.y + 0.5)];
      const pts: THREE.Vector3[] = [];
      for (const s of seeds) for (const [dx, dz] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) {
        const q = nav.nearestWalkable(new THREE.Vector3(s.x + dx, s.y, s.z + dz), 2);
        if (q && Math.abs(q.y - s.y) < 1.5 && !pts.some((o) => o.distanceTo(q) < 1.2)) pts.push(q.clone().setY(q.y + 1.2));
      }
      if (pts.length < 3) continue;
      const home = e.pos.clone();
      const sees = (at: THREE.Vector3) => {
        e.pos.copy(at);
        let n = 0;
        for (const t of pts) {
          const o = e.firingPoint(col, st, t);
          const dir = t.clone().sub(o), len = dir.length();
          const hit = col.raycast(o, dir.normalize(), len, st);
          if (!hit || hit.distance > len - 0.4) n++;
        }
        e.pos.copy(home);
        return n / pts.length;
      };
      const s0 = sees(home);
      if (s0 >= 0.4) continue;
      let best: THREE.Vector3 | null = null, bs = s0 + 0.15;
      // waist height: a low step between two parts of a gallery is not a wall (the Crown Loft archer's bay is 0.5 m
      // below its gallery)
      const waist = home.clone().setY(home.y + 1.0);
      // a blind perch (sees nothing at all) may be in a closed bay of its gallery: look further along it
      const reach = s0 === 0 ? 7 : 4;
      for (let r = 0.5; r <= reach; r += 0.5) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const wall = col.raycast(waist.clone(), dir.clone(), r + e.radius, st);
        if (wall) continue;
        const top = home.clone().addScaledVector(dir, r).setY(home.y + 1.2);
        const floor = col.raycast(top, new THREE.Vector3(0, -1, 0), 2, st);
        if (!floor || Math.abs(floor.point.y - home.y) > 0.7) continue;
        const q = floor.point.clone().setY(floor.point.y + 0.02);
        if (col.overlap(q, e.radius, 1.8, st) > 0.05) continue;
        const sc = sees(q);
        if (sc > bs) { bs = sc; best = q; }
      }
      // still nothing (a closed bay walled off from the fight: F2's Crown Loft archer; a scaffold landing boxed in by
      // its rails: F1's undercroft archer) → the standable spot inside its own encounter's arena, no lower than 1.8 m
      // below the perch (it keeps some height), that sees the fight best; nearest on ties
      if (!best && s0 < 0.2) {
        const b = enc.box;
        let bd = Infinity;
        for (let x = b.min.x + 0.25; x <= b.max.x; x += 0.5) for (let z = b.min.z + 0.25; z <= b.max.z; z += 0.5) {
          const top = new THREE.Vector3(x, home.y + 1.2, z);
          const floor = col.raycast(top, new THREE.Vector3(0, -1, 0), 3.0, st);
          if (!floor || floor.point.y < home.y - 1.8 || (floor.face && floor.face.normal.y < 0.7)) continue;
          const at = floor.point.clone().setY(floor.point.y + 0.02);
          if (!b.containsPoint(at.clone().setY(at.y + 0.5)) || col.inVoid(at, st) || col.overlap(at, e.radius, 1.8, st) > 0.05) continue;
          const sc = sees(at), d = at.distanceTo(home);
          if (sc > bs || (sc === bs && best && d < bd)) { bs = sc; bd = d; best = at; }
        }
      }
      if (best) {
        e.place(best);
        this.spawnFixes.push(`${e.encounter} archer #${e.id} perch blind (${Math.round(s0 * 100)}%) → moved ${best.distanceTo(home).toFixed(2)} m (${Math.round(bs * 100)}%)`);
      } else this.spawnFixes.push(`${e.encounter} archer #${e.id} perch sees ${Math.round(s0 * 100)}% — no better spot`);
    }
    nav.use(this.g.time.state, this.g.level.flags);
  }

  /**
   * Flyers (bats, wraiths) must be able to reach their fight: a bat of Floor 2's E1 was placed in a pocket above the
   * antechamber with no line of sight to it and no ground route under it, and hovered there, blind, for the whole
   * fight. A flyer that sees none of its arena from its spawn is moved above the nearest walker of its encounter
   * (at its flying altitude, where it sees the arena). Flyers that appear elsewhere on waking (out of the Maw or the
   * Crownheart) and all-flyer fights are left alone.
   */
  private checkFlyers() {
    const col = this.g.level.collision;
    for (const e of this.enemies) {
      if (!e.isFlying || e.opts.fromHeart || e.arch.boss) continue;
      const enc = this.encounters.get(e.encounter);
      if (!enc || enc.enemies.some((x) => x.arch.id === 'lamia_maw')) continue;
      const st: TimeState = e.owner === 'BOTH' ? 'PRESENT' : e.owner;
      const walkers = enc.enemies.filter((x) => !x.isFlying && !x.opts.perch && (x.owner === st || x.owner === 'BOTH'));
      if (!walkers.length) continue;
      const pts = walkers.map((w) => w.home.clone().setY(w.home.y + 1.2));
      const visible = (from: THREE.Vector3) => pts.filter((t) => {
        const dir = t.clone().sub(from), len = dir.length();
        const hit = col.raycast(from.clone(), dir.normalize(), len, st);
        return !hit || hit.distance > len - 0.4;
      }).length;
      const from = e.pos.clone().setY(e.pos.y + e.height * 0.5);
      if (visible(from) > 0) continue;
      const alt = e.arch.flying?.altitude ?? 2;
      let best: THREE.Vector3 | null = null, bv = 0, bd = Infinity;
      for (const w of walkers) for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
        const q = w.home.clone().add(new THREE.Vector3(dx, alt, dz));
        if (col.overlap(q, e.radius, e.height, st) > 0.05) continue;
        const v = visible(q.clone().setY(q.y + e.height * 0.5));
        const d = q.distanceTo(e.pos);
        if (v > bv || (v === bv && v > 0 && d < bd)) { bv = v; bd = d; best = q; }
      }
      if (best) {
        this.spawnFixes.push(`${e.encounter} ${e.arch.id} #${e.id} spawned blind → moved ${best.distanceTo(e.pos).toFixed(1)} m above its fight`);
        e.place(best);
      }
    }
  }

  /** spawn points that were left in a slot too narrow to stand in (spawns checked against the nav grid) */
  spawnFixes: string[] = [];
  /**
   * A walker must start on walkable ground of its own memory: a spawn wedged between a tomb and a wall (a body
   * cannot fit) is moved to the nearest walkable spot within 1.5 m. Logged so the layout can be corrected.
   */
  private walkableSpawn(pos: THREE.Vector3, state: TimeState | 'BOTH', exempt: boolean, name: string, arena?: Encounter, radius = 0.34) {
    const nav = this.nav;
    if (!nav || exempt) return pos;
    const st = state === 'BOTH' ? this.g.time.state : state;
    nav.use(st, this.g.level.flags);
    let out = pos;
    if (!nav.walkable(pos, 0.5)) {
      const q = nav.nearestWalkable(pos, 3);
      if (q && q.distanceTo(pos) < 1.6) { out = q.clone(); this.spawnFixes.push(`${name} ${st} moved ${q.distanceTo(pos).toFixed(2)} m`); }
    }
    // an island: the spot is walkable but closed in (the E3 reinforcements stood INSIDE the west tents' collision
    // boxes and could never come out) → the nearest spot within 6 m that opens onto the floor (≥ 300 nodes ≈ 75 m²
    // reachable; stepping down off a tomb or a mound is always possible, so those are never islands)
    if (arena && nav.reachableCount(out, 300, radius) < 300) {
      let best: THREE.Vector3 | null = null, bd = Infinity;
      for (let r = 0.5; r <= 6 && !best; r += 0.5) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const q = nav.nearestWalkable(new THREE.Vector3(out.x + Math.cos(a) * r, out.y, out.z + Math.sin(a) * r), 1);
        if (!q || Math.abs(q.y - out.y) > 0.6 || q.distanceTo(out) >= bd) continue;
        if (nav.reachableCount(q, 300, radius) >= 300) { best = q.clone(); bd = q.distanceTo(out); }
      }
      if (best) { this.spawnFixes.push(`${name} ${st} island → moved ${bd.toFixed(2)} m`); out = best; }
    }
    nav.use(this.g.time.state, this.g.level.flags);
    return out;
  }

  private liveIn(st: TimeState) { return (e: Enemy) => e.alive && !e.removed && (e.owner === st || e.owner === 'BOTH'); }

  pickLockTarget(from: THREE.Vector3, camFwd: THREE.Vector3) {
    const st = this.g.time.state;
    let best: Enemy | null = null, bestScore = Infinity;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (!this.liveIn(st)(e) || e.state === 'hidden' || e.untargetable) continue;
      const to = _a.subVectors(e.pos, from);
      const d = to.length();
      if (d > (e.arch.boss ? 30 : 20)) continue;
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
      const hot = e.isRanged ? e.state === 'shoot' && e.shootPhase === 1 : e.state === 'attack' || e.state === 'windup' || e.state === 'dive' || e.state === 'lunge' || e.state === 'special';
      out.push({ e, score: d - (hot ? 100 : 0) - (e.isRanged ? 20 : 0) });
    }
    out.sort((a, b) => a.score - b.score);
    return out.map((x) => x.e);
  }

  /**
   * Execution: a non-boss enemy reeling from a heavy stagger with ≤ 45 % HP, within 2.6 m and roughly in front
   * (heavy from neutral turns into the two-handed plunge).
   */
  executionTarget(from: THREE.Vector3, facing: THREE.Vector3): THREE.Vector3 | null {
    const st = this.g.time.state;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (!this.liveIn(st)(e) || e.arch.boss || e.isFlying || e.state !== 'hit' || e.stun < 0.25 || e.hp > e.arch.hp * 0.45) continue;
      const to = _a.subVectors(e.pos, from).setY(0);
      const d = to.length();
      if (d < 2.6 && Math.abs(e.pos.y - from.y) < 1 && facing.angleTo(to.normalize()) < 1.1) {
        e.stun = Math.max(e.stun, 1.2); // it stays down for the blow
        return e.pos;
      }
    }
    return null;
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
    this.nav?.use(st, this.g.level.flags);
    for (const e of [...this.enemies, ...this.remnants]) e.navReset();
    for (const e of this.enemies) {
      const vis = (e.owner === st || e.owner === 'BOTH') && !e.removed && e.state !== 'hidden';
      e.root.visible = vis;
      if (e.hasSlot && e.owner !== st && e.owner !== 'BOTH') { this.releaseSlot(e); e.hasSlot = false; }
      if (e.owner === 'BOTH' && e.alive) this.relocateIfInvalid(e, st);
    }
    // fissure / boss Echoes belong to the memory they rose in, like every other Echo (they were drawn frozen in
    // the other memory before)
    for (const r of this.remnants) r.root.visible = (r.owner === st || r.owner === 'BOTH') && !r.removed;
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
  /**
   * Attack slots, first come first served — with a queue: whoever has been asking longest (> 0.8 s) goes next and
   * nobody else takes a freed slot before it. Without it a slot-cost-2 elite (Royal / Hollow Warden) never found
   * the pool empty while guards kept re-taking single slots: the E10 Royal Warden circled for 30 s without a blow.
   */
  private slotWait = new Map<number, { since: number; last: number }>();
  requestSlot = (e: Enemy, cost: number) => {
    if (e.arch.boss) return true; // the boss attacks on its own schedule; it never starves the pool
    const now = this.g.t;
    let w = this.slotWait.get(e.id);
    if (!w || now - w.last > 0.5) { w = { since: now, last: now }; this.slotWait.set(e.id, w); }
    w.last = now;
    let first = e.id, firstSince = w.since;
    for (const [id, x] of this.slotWait) {
      if (now - x.last > 0.5) { this.slotWait.delete(id); continue; }
      if (x.since < firstSince) { first = id; firstSince = x.since; }
    }
    if (first !== e.id && now - firstSince > 0.8) return false;
    let used = 0;
    for (const v of this.slotsUsed.values()) used += v;
    // during the finale only one add may press the player while the Warden lives
    const cap = this.boss && this.boss.triggered && this.boss.alive ? 1 : this.slotCapacity;
    if (used + cost > cap && used > 0) return false;
    this.slotsUsed.set(e.id, cost);
    this.slotWait.delete(e.id);
    e.slotTime = 0;
    return true;
  };
  releaseSlot = (e: Enemy) => { this.slotsUsed.delete(e.id); };

  // ------------------------------------------------------------------ update
  update(dt: number) {
    const g = this.g;
    const st = g.time.state;
    const p = g.player;
    this.navPlans = 0;
    this.nav?.use(st, g.level.flags);
    const ctx: EnemyCtx = {
      playerPos: p.pos, playerAlive: p.alive, world: g.level.collision, state: st, now: g.t,
      requestSlot: this.requestSlot, releaseSlot: this.releaseSlot,
      onAttackHit: (e, atk) => this.enemyHitsPlayer(e, atk),
      shoot: (e) => this.shoot(e),
      nav: this.nav,
      navBudget: () => this.navPlans++ < 3,
      hold: g.finisher.holding,
      playerAttack: p.state === 'attack' && p.attack ? { kind: p.attack.kind, t: p.stateTime } : null,
      playerAirborne: !p.grounded || p.state === 'dodge',
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
    this.sightT -= dt;
    const sightTick = this.sightT <= 0;
    if (sightTick) this.sightT = 0.2;
    for (const e of this.enemies) {
      const enc = this.encounters.get(e.encounter)!;
      // the hero stands inside this Echo's own (running) fight: it never leashes, and one that did wakes again
      e.heroInArena = enc.triggered && !enc.cleared && p.alive && enc.box.containsPoint(head);
      if (e.triggered || !e.alive || e.state === 'hidden' || e.state === 'dormant') continue;
      if (e.owner !== st && e.owner !== 'BOTH') continue;
      if (enc.finale && !enc.triggered) continue; // the finale starts only from its arena volume
      if (e.heroInArena && e.wave <= enc.wave && !e.isRanged) { e.activate(); continue; }
      const d = e.pos.distanceTo(p.pos);
      if (e.isRanged) {
        // archers see far and from any height (galleries, perches): they open fire on sight without waking the
        // rest of their encounter, but never before their wave
        if (!sightTick || d > e.arch.ranged!.sight || Math.abs(e.pos.y - p.pos.y) > 14) continue;
        if (e.wave > Math.max(1, enc.wave)) continue;
        const chest = p.pos.clone().setY(p.pos.y + 1.2);
        if (ctx.lineOfSight(e.firingPoint(ctx.world, st, chest), chest)) { e.activate(); e.cooldown = Math.max(e.cooldown, 0.4 + Math.random() * 0.5); }
        continue;
      }
      if (d < Math.min(9, e.arch.aggroRange) && Math.abs(e.pos.y - p.pos.y) < 3 &&
        ctx.lineOfSight(e.center.clone(), p.pos.clone().setY(p.pos.y + 1.3))) {
        if (!enc.triggered) this.trigger(enc); else e.activate();
      }
    }
    let active = 0;
    let combat = false;
    for (const e of [...this.enemies, ...this.remnants]) {
      if (e.removed) { e.root.visible = false; continue; }
      // an Echo of the other memory is never drawn (and does not act) until the hero shifts there: a riser woken
      // by a BOTH-memory wave used to stand in the bind pose, frozen, in the wrong memory (T-pose bug)
      if (e.owner !== st && e.owner !== 'BOTH') { e.root.visible = false; continue; }
      const d = e.pos.distanceTo(p.pos);
      // render only what can matter: near enemies or those in a live fight
      e.root.visible = e.state !== 'hidden' && (d < 42 || (e.triggered && e.alive));
      // safety net: a drawn body always has an animation on its skeleton (never the bind pose)
      if (e.root.visible && !e.posed) e.repose();
      const hot = e.triggered || d < 38;
      if (!hot && e.alive) continue;
      // bosses are never lost to a void: a kick toward the edge staggers them instead (blueprint E10)
      if (e.arch.boss && e.arch.id !== 'last_crown' && e.alive && e.state !== 'hit' && (Math.abs(e.vel.x) + Math.abs(e.vel.z)) > 1 && e.catchAtEdge(ctx)) {
        g.hud.prompt('The Captain reels at the edge!', 1.5);
        g.fx.dust(e.pos.clone(), 8);
      }
      e.updateReaction(g.realDt);
      e.update(dt, ctx);
      this.presentEnemy(e, dt);
      active++;
      if (e.triggered && e.alive && d < 22) combat = true;
      if (e.alive && (g.level.collision.inVoid(e.pos, st) || e.pos.y < -30)) { e.die(); this.onKill(e, true); }
    }
    this.separate();
    this.updateTracers(st);
    this.activeCount = active;
    this.inCombat = combat;
    this.playerHitsEnemies();
    this.updateArrows(dt, st);
    this.monsterFx?.update(dt);
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
    this.remnants = this.remnants.filter((r) => { if (r.removed) { g.scene.remove(r.root); r.reset(); this.poolEcho(r); return false; } return true; });
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
          if (asset === 'goblin') au.play('goblin_snarl', { pos: at, rate: e.arch.scale > 1.2 ? 0.75 : 1.1 });
          else if (asset === 'bat') au.play('bat_screech', { pos: at, vol: 0.7 });
          else if (asset === 'widow') au.play('widow_hiss', { pos: at, rate: e.arch.scale < 0.8 ? 1.6 : e.arch.scale > 1.2 ? 0.75 : 1 });
          else if (asset === 'lamia') au.play('serpent_hiss', { pos: at, rate: e.arch.scale > 1.2 ? 0.75 : 0.95 });
          else if (asset === 'hollow') au.play('hollow_growl', { pos: at, rate: e.arch.scale < 1 ? 1.15 : 1 });
          else if (asset === 'ghost') au.play('wraith_moan', { pos: at });
          else if (asset === 'knight') au.play('armor_rattle', { pos: at });
          break;
        case 'telegraph':
        case 'windup':
          if (asset === 'goblin' && Math.random() < 0.5) au.play('goblin_snarl', { pos: at, rate: e.arch.scale > 1.2 ? 0.75 : 1.2 });
          else if (asset === 'knight') au.play('armor_rattle', { pos: at, vol: e.arch.scale > 1.1 ? 1.3 : 1 });
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
          if (asset === 'goblin') au.play('goblin_death', { pos: at, rate: e.arch.scale > 1.2 ? 0.7 : 1 });
          else if (asset === 'widow') au.play('widow_death', { pos: at, rate: e.arch.scale < 0.8 ? 1.7 : e.arch.scale > 1.2 ? 0.7 : 1 });
          else if (asset === 'knight') au.play('armor_rattle', { pos: at, vol: 1.4 });
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
          g.fx.shatter(e.root, asset === 'hollow' || asset === 'goblin' || asset === 'widow' || asset === 'lamia' ? 'ash' : asset === 'ghost' || asset === 'bat' ? 'smoke' : 'ember', asset === 'ghost' || asset === 'bat' ? 120 : 280);
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
      if (e.stepAcc > 1) { e.stepAcc -= 1; if (asset !== 'lamia' && asset !== 'widow') au.enemyStep(e.pos, asset === 'knight'); }
    }
    if (e.isFlying && asset === 'ghost' && e.alive && e.triggered && dp < 24 * 24) {
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
    this.bestiary(enc.enemies.filter((e) => e.wave <= 1));
    this.g.signals.emit('encounter:start', { id: enc.id, boss: enc.bossFight || enc.finale, title: enc.title,
      kinds: [...new Set(enc.enemies.map((e) => e.arch.id))], count: enc.enemies.length });
    if (enc.bossFight && !enc.finale) {
      const boss = enc.enemies.find((e) => e.arch.boss);
      if (boss) { this.boss = boss; this.bossName = enc.title ?? this.bossName; }
      // the Last Crown is revealed by her own scene (she descends out of the Crownheart: LastCrown.beginIntro), which
      // gives her name, the sting and the boss:start line at the right beats
      if (!(boss instanceof LastCrown && boss.beginIntro())) {
        if (boss) this.g.signals.emit('boss:start', { id: boss.arch.id });
        this.g.hud.message(enc.title ?? 'A GUARDIAN WAKES', BOSS_SUB[boss?.arch.id ?? ''] ?? 'Echo of the royal guard', 3.5);
        this.g.audio.bossSting();
      }
    }
    if (enc.finale) {
      this.g.hud.message('THE LAST MUSTER', 'The Gate Warden wakes', 3.5);
      this.g.signals.emit('boss:start', { id: 'gate_warden' });
      this.g.audio.bossSting();
      this.g.pendingArenaLock = true;
    }
  }

  private updateWaves(enc: Encounter) {
    if ((enc.finale || enc.bossFight) && this.boss && enc.enemies.includes(this.boss) && !this.boss.alive && !enc.cleared) {
      // the Warden's fall ends the Last Muster: its remaining Echoes collapse with it. Only bodies that are in the
      // fight and in this memory collapse on screen; unwoken risers/kneelers and the other memory's Echoes simply
      // are not there any more (they used to stay behind, T-posed)
      const st = this.g.time.state;
      for (const e of enc.enemies) {
        if (!e.alive) continue;
        const here = (e.owner === st || e.owner === 'BOTH') && e.root.visible && e.state !== 'hidden' && e.state !== 'dormant' && e.state !== 'rise';
        if (here) e.die(); else e.vanish();
        this.killCount++;
        if (e.hasSlot) { this.releaseSlot(e); e.hasSlot = false; }
      }
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
      // perched archers never hold back the reinforcements (E3: the 2 balcony archers kept the tent guards
      // standing idle forever once the yard guards were down); a wave of archers only waits for its ground fight
      const ground = enc.enemies.filter((e) => e.wave <= enc.wave && e.alive && !e.opts.perch);
      const any = enc.enemies.some((e) => e.wave <= enc.wave && !e.opts.perch);
      advance = any ? ground.length <= 1 : enc.enemies.filter((e) => e.wave <= enc.wave && e.alive).length <= 1;
    }
    if (advance) {
      enc.wave++;
      this.g.perf.mark(`wave ${enc.id}.${enc.wave}`);
      for (const e of enc.enemies) if (e.wave === enc.wave) e.activate();
      this.bestiary(enc.enemies.filter((e) => e.wave === enc.wave));
    }
  }

  /** The first time a new kind of monster joins a fight: one short card on how to face it (once per game). */
  private bestiary(list: Enemy[]) {
    const g = this.g;
    for (const e of list) {
      const tip = BESTIARY[e.arch.id];
      if (!tip || g.bestiarySeen.has(e.arch.id) || (e.owner !== g.time.state && e.owner !== 'BOTH')) continue;
      g.bestiarySeen.add(e.arch.id);
      g.hud.prompt(tip, 6.5);
      return;
    }
  }

  private clear(enc: Encounter) {
    enc.cleared = true;
    this.g.signals.emit('encounter:clear', { id: enc.id });
    if (enc.surge) this.g.signals.emit('boss:dead', { id: this.boss?.arch.id ?? enc.id });
    if (enc.surge) {
      if (enc.finale) this.g.setArenaLock(false);
      this.g.time.gain(Math.max(0, 100 - this.g.time.charge) + 100, 'surge');
      this.g.hud.message(enc.finale ? 'THE WARDEN FALLS' : (enc.title ?? 'THE GUARDIAN') + ' FALLS', 'Resonance floods your blood', 4);
      this.g.audio.shiftBoom(this.g.time.state);
      this.onBossDeath?.();
    }
  }

  private separate() {
    const list = [...this.enemies, ...this.remnants].filter((e) => e.alive && e.root.visible && e.state !== 'finisher' && (e.triggered || e.state === 'idle'));
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
      // the parry is the loudest beat in the game: long stop, a slow-motion breath, zoom, strong buzz
      g.fx.hitstop(0.13);
      g.fx.slowmo(0.3, 0.45);
      g.kickFov(3);
      g.rig.punch(e.pos.clone().sub(p.pos).setY(0), 2.4);
      e.recoil(e.pos.clone().sub(p.pos).setY(0).normalize(), 0.35);
      Platform.haptic(34);
    } else if (res === 'block') {
      g.rig.addShake(0.12);
    } else if (res === 'hit') {
      g.audio.hurt();
      const hurtDir = p.pos.clone().sub(e.pos).setY(0).normalize();
      const at = p.pos.clone().setY(p.pos.y + 1.2);
      g.fx.bloodSpray(at, hurtDir, atk.heavy ? 0.8 : 0.45);
      g.gore.aftermath(at, hurtDir, atk.heavy ? 0.6 : 0.3);
      g.rig.addShake(atk.heavy ? 0.45 : 0.22);
      g.rig.punch(hurtDir, atk.heavy ? 3 : 1.6);
      g.hud.flash('#6a0000', 0.22);
      Platform.haptic(atk.heavy ? 40 : 22);
    }
  }

  private playerHitsEnemies() {
    const g = this.g, p = g.player;
    const hits = p.activeHits();
    if (!hits.length) return;
    const st = g.time.state;
    const targets = [...this.enemies, ...this.remnants].filter((e) => this.liveIn(st)(e) && e.state !== 'hidden' && !e.untargetable);
    const f = p.facing.clone();
    for (const { win, index } of hits) {
      for (const e of targets) {
        // keyed per swing, not per attack definition: the same attack twice in a row must hit twice
        const key = `${p.attackSerial}:${index}:${e.id}`;
        if (this.hitRegistry.has(key)) continue;
        let hit = false;
        let falloff = 1;
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
          const shock = p.attack?.shock;
          const reach = (win.reach ?? 2.5) + e.radius + (p.attack?.charge ? p.chargeLevel * (shock?.reach ?? 1.5) : 0);
          const arc = win.shape === 'front' ? (win.arc ?? 90) : (win.arc ?? 360);
          const ang = THREE.MathUtils.radToDeg(f.angleTo(to.normalize()));
          // the Crownbreaker's shockwave reaches a little higher (a gallery step, a tomb lid) and weakens to the rim
          if (d < reach && (arc >= 360 || ang < arc / 2) && dy < (shock ? 2.4 : 1.9)) { hit = true; if (shock) falloff = 1 - shock.falloff * THREE.MathUtils.clamp(d / reach, 0, 1); }
        }
        if (!hit) continue;
        this.hitRegistry.add(key);
        this.playerHits++;
        p.hitsDone.add(index * 1000 + e.id);
        const cm = (p.attack?.charge ? 1 + p.chargeLevel : 1) * falloff; // the Crownbreaker's charge doubles its blow
        const res = e.takeHit(win.damage * cm, win.poise * cm, win.knock * (p.attack?.shock ? 1 + p.chargeLevel * 0.5 : 1), p.pos, { knockdown: win.knockdown, guardBreak: win.guardBreak });
        // the last Echo of a fight may die in a cinematic finisher instead (it then owns the kill presentation and
        // the one kill credit: finisherKill)
        if (res === 'dead' && g.finisher.tryStart(e)) continue;
        const kind = p.attack?.kind ?? 'light';
        const feel = FEEL[kind];
        // how heavy this connection sounds/feels: attack kind, damage, and the last beat of a chain
        const last = !!p.attack && index === p.attack.hits.length - 1;
        const weight = Math.min(1, (kind === 'light' || kind === 'crouch' ? 0.15 : 0.7) + win.damage / 90 + (p.attack?.id === 'L4' ? 0.15 : 0));
        if (win.shape === 'front') { g.audio.kickHit(contact); if (res === 'blocked') g.audio.hitEnemy('blocked', win.damage, contact, weight); }
        else g.audio.hitEnemy(res === 'blocked' ? 'blocked' : e.isFlying ? 'spirit' : e.arch.asset === 'knight' ? 'armor' : 'flesh', win.damage, contact, weight);
        if (e.arch.asset === 'hollow' && (res === 'flinch' || res === 'stagger') && Math.random() < 0.6) g.audio.play('hollow_hurt', { pos: contact });
        const swing = this.swingDir(e);
        this.impact(e, res, win.damage, contact, swing);
        g.time.gain(2, 'hit');
        if (p.attack?.resonance && res !== 'blocked') g.time.gain(p.attack.resonance, 'finisher');
        if (res === 'blocked') {
          // the blade bounces off the guard: short stop, the hero is pushed back, a hard clang in the camera
          g.fx.hitstop(0.05);
          g.rig.addShake(0.14);
          g.rig.punch(swing.clone().negate(), 1.6);
          p.vel.addScaledVector(e.pos.clone().sub(p.pos).setY(0).normalize(), -2.2);
          Platform.haptic(12);
        } else {
          const stagger = res === 'stagger' || res === 'dead';
          g.fx.hitstop(feel.stop * (last && p.attack?.id === 'L4' ? 1.25 : 1) + (res === 'dead' ? 0.03 : stagger ? 0.015 : 0));
          g.rig.addShake(feel.shake + (res === 'dead' ? 0.08 : 0));
          g.rig.punch(swing, feel.punch);
          if (feel.fov > 0.7 || stagger) g.kickFov(feel.fov + (stagger ? 0.6 : 0));
          e.recoil(swing, feel.lean * (res === 'armor' ? 0.5 : 1));
          Platform.haptic(feel.buzz + (res === 'dead' ? 8 : 0));
        }
        if (res === 'dead') this.onKill(e);
      }
    }
    if (this.hitRegistry.size > 4000) this.hitRegistry.clear();
  }

  /**
   * Hit presentation: blood follows the blade's real sweep; killing blows fling the body (harder for heavy
   * attacks and finishers), throw gore, and give the kill a short slow-motion beat.
   */
  /** Direction the hit travels: the blade's real sweep blended with player-to-enemy (horizontal-ish). */
  private swingDir(e: Enemy) {
    const p = this.g.player;
    const sweep = p.blade.tip.clone().sub(p.blade.prevTip);
    sweep.y *= 0.35;
    const away = e.pos.clone().sub(p.pos).setY(0).normalize();
    return (sweep.lengthSq() > 1e-4 ? sweep.normalize() : away.clone()).lerp(away, 0.45).normalize();
  }

  private impact(e: Enemy, res: string, damage: number, contact: THREE.Vector3, dir: THREE.Vector3) {
    const g = this.g, p = g.player;
    const away = e.pos.clone().sub(p.pos).setY(0).normalize();
    if (res === 'blocked') { g.fx.sparks(contact, 18, 0xffd090); return; }
    // the Last Crown is the Crownheart's making: she bleeds light, not blood (her death is her own sequence)
    if (e.arch.asset === 'lastcrown') { g.fx.sparks(contact, 22, g.time.state === 'PAST' ? 0xffc060 : 0xc05aff); g.fx.ashBurst(contact, dir, 8); return; }
    const kind = p.attack?.kind;
    // Whirlwind kills are thrown outward off the spin; heavies and finishers fling hardest
    const power = res === 'dead' ? (kind && HEAVY_KINDS.has(kind) ? 1 : kind === 'whirl' ? 0.7 : damage >= 28 ? 0.75 : 0.35) : 0;
    const amount = Math.min(1.5, damage / 28) + (res === 'dead' ? 0.35 + power * 0.4 : 0);
    const asset = e.arch.asset;
    if (e.isFlying && asset === 'ghost') g.fx.ashBurst(contact, dir, Math.round(10 + amount * 16));
    else {
      g.fx.bloodSpray(contact, dir, amount * (e.isFlying ? 0.5 : 1), e.arch.blood ?? (asset === 'hollow' ? 0x3c0906 : 0x7a0909));
      g.gore.aftermath(contact, dir, amount);
      if (asset === 'knight') g.fx.sparks(contact, 8, 0xffe0b0);
    }
    if (res !== 'dead') return;
    e.fling(away.clone().lerp(dir, 0.3).normalize(), power);
    if (!e.isFlying) g.gore.gibs(e.center.clone(), dir, Math.round(3 + power * 10), asset === 'knight' ? 'armor' : asset === 'archer' ? 'flesh' : 'rotten');
    g.fx.slowmo(power > 0.7 ? 0.34 : 0.16, power > 0.7 ? 0.2 : 0.42);
    g.kickFov(power > 0.7 ? 6 : 3);
    g.audio.play('hit_slice', { pos: contact, rate: 0.75, vol: 1.2 });
    if (power > 0.7) g.audio.play('kick_hit', { pos: contact, rate: 0.7 });
    // ElevenLabs layers (tools/elevenlabs_sfx.mjs): wet kill, body blow, bone on finishers
    if (!e.isFlying) g.audio.play('gore_splat', { pos: contact, jitter: 0.08 });
    if (power > 0.35) g.audio.play('kill_impact', { pos: contact, rate: asset === 'knight' ? 0.92 : 1 });
    if (power > 0.7 && !e.isFlying) g.audio.play('bone_crunch', { pos: contact });
  }

  /** A finisher caught `e` (it had just died): back to a living, untargetable pose the director drives. */
  holdForFinisher(e: Enemy) {
    e.state = 'finisher';
    e.stateTime = 0;
    e.hp = Math.max(1, e.hp);
    e.attack = null;
    e.untargetable = true;
    e.events.length = 0;
    e.vel.set(0, 0, 0);
    e.tumble = 0; e.tumbleRate = 0; e.settled = false; e.shatterAt = -1; e.deadTime = 0;
    if (e.hasSlot) { this.releaseSlot(e); e.hasSlot = false; }
  }

  /**
   * A finisher ended: the Echoes that waited come back in, staggered (a short random delay each), so control is
   * never handed back into a simultaneous volley of blows.
   */
  releaseFinisherHold() {
    for (const e of [...this.enemies, ...this.remnants]) {
      if (!e.alive || !e.triggered) continue;
      e.cooldown = Math.max(e.cooldown, 0.45 + Math.random() * 0.8);
    }
  }

  /**
   * The finisher's final blow: the body dies, is thrown (power 0..1.4 through the fling/tumble physics) and torn
   * (`gibs` chunks), and the kill is credited — exactly once — through onKill (resonance, heal, signals, and so
   * the encounter's clear on the next update).
   */
  finisherKill(e: Enemy, dir: THREE.Vector3, power: number, gibs: number) {
    if (e.state !== 'finisher') return;
    const g = this.g;
    e.untargetable = false;
    e.state = 'hit'; // die() refuses a body already 'dead'; 'finisher' is alive
    e.die();
    e.fling(dir, power);
    const at = e.center.clone();
    const asset = e.arch.asset;
    if (gibs > 0) g.gore.gibs(at, dir, gibs, asset === 'hollow' ? 'rotten' : asset === 'knight' ? 'armor' : 'flesh');
    g.gore.aftermath(at, dir, 0.6 + power * 0.6);
    g.audio.play('gore_splat', { pos: at, jitter: 0.08 });
    if (power > 0.6) { g.audio.play('bone_crunch', { pos: at }); g.audio.play('kill_impact', { pos: at, rate: asset === 'knight' ? 0.9 : 1 }); }
    this.onKill(e, false, true);
  }

  onKill(e: Enemy, voidDeath = false, finisher = false) {
    this.killCount++;
    const pl = this.g.player;
    if (pl.alive) pl.hp = Math.min(pl.maxHp, pl.hp + (e.arch.boss ? 80 : e.arch.reward >= 70 ? 30 : 12));
    if (e.hasSlot) { this.releaseSlot(e); e.hasSlot = false; }
    this.g.time.gain(e.arch.reward, 'kill');
    this.g.fx.resonanceFrom(e.center.clone(), this.g.player, e.arch.reward);
    this.g.audio.release(e.center.clone());
    if (voidDeath) this.g.hud.prompt('Cast into the void.', 2);
    this.g.signals.emit('kill', { arch: e.arch.id, boss: !!e.arch.boss, ranged: e.isRanged, voidDeath, execution: finisher || this.g.player.attack?.id === 'EXECUTE', finisher });
    if (e.arch.boss) { /* surge handled by encounter clear */ }
  }

  /**
   * Loose an arrow: aimed at the chest, leading the player's current velocity over the flight time (a
   * straight-line run gets hit; a change of direction, a stop or a dodge beats it), with the exact ballistic
   * lift for that flight time, so long shots from the galleries arrive where they were aimed.
   */
  private shoot(e: Enemy) {
    const g = this.g;
    const st = g.time.state;
    const r = e.arch.ranged!;
    const chest = g.player.pos.clone().add(new THREE.Vector3(0, 1.15, 0));
    const from = e.firingPoint(g.level.collision, st, chest);
    if (!e.opts.perch) from.addScaledVector(e.facing, 0.5);
    const flight = from.distanceTo(chest) / r.projectileSpeed;
    const target = chest.addScaledVector(g.player.vel.clone().setY(0), Math.min(1.0, flight * 0.95));
    const vel = target.sub(from).normalize().multiplyScalar(r.projectileSpeed);
    vel.y += 0.5 * ARROW_GRAVITY * from.distanceTo(g.player.pos) / r.projectileSpeed;
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
      a.vel.y -= ARROW_GRAVITY * dt;
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
          if (res === 'block' || res === 'parry') { g.fx.sparks(to, 10, 0xffd090); g.audio.hitEnemy('blocked', 8, to, 0.2); Platform.haptic(10); }
          else {
            g.fx.blood(to, 6); g.audio.hurt(); g.rig.addShake(0.18);
            g.rig.punch(a.vel.clone().setY(0), 1.6);
            g.hud.flash('#6a0000', 0.16);
            Platform.haptic(24);
          }
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
      // only a fight that can actually reach her holds the fissure back (idle Echoes on the floor below and a
      // perched archer without a line of sight used to block the softlock refill: Floor 2 G6 at 96 resonance)
      if (this.engagedNear(p.pos, 25)) continue;
      this.fissureCooldown.set(f.name, 15);
      g.perf.mark('fissure remnants');
      for (let i = 0; i < 2; i++) {
        const e = this.takeEcho(g.time.state);
        if (!e) break;
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

  /** Boss adds: pooled remnants rising around `near` (on footing, never in a hole). */
  summonRemnants(n: number, near: THREE.Vector3) {
    const g = this.g, st = g.time.state;
    for (let i = 0; i < n; i++) {
      const e = this.takeEcho(st);
      if (!e) return;
      let at = near.clone();
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 3;
        const q = near.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        if (g.level.collision.hasFooting(q.clone().setY(q.y + 1), 2, st) && !g.level.collision.inVoid(q.clone().setY(q.y - 0.5), st)) { at = q; break; }
      }
      e.owner = st;
      e.yaw = Math.random() * 6.28;
      e.place(at);
      g.scene.add(e.root);
      e.activate();
      this.remnants.push(e);
      g.fx.shiftBurst(at, st);
    }
  }

  /**
   * Dev / tests: spawn `archId` at `at` (world) into the ad-hoc encounter DEV (created round the hero, triggered at
   * once), awake and chasing. The rig must be loaded (the floor's own, or `?monsters`).
   */
  devSpawn(archId: ArchetypeId, at: THREE.Vector3, opts: { ceiling?: boolean; brood?: boolean; wave?: number; enc?: string } = {}) {
    const g = this.g, arch = ARCHETYPES[archId];
    const id = opts.enc ?? 'DEV';
    let enc = this.encounters.get(id);
    if (!enc) {
      enc = { id, state: 'BOTH', box: new THREE.Box3().setFromCenterAndSize(g.player.pos.clone(), new THREE.Vector3(60, 20, 60)), enemies: [], triggered: true, cleared: false,
        wave: 1, optional: false, finale: false, tutorial: false, bossFight: !!arch.boss, surge: false, title: arch.miniBoss };
      this.encounters.set(id, enc);
    }
    const { model, clips } = this.instantiate(arch.asset);
    const o = { rise: !!opts.ceiling || !!opts.brood, yaw: 0, ceiling: opts.ceiling, brood: opts.brood };
    const e = makeMonster(arch, model, clips, id, g.time.state, opts.wave ?? 1, o, g) ?? new Enemy(arch, model, clips, id, g.time.state, opts.wave ?? 1, o);
    e.place(at.clone());
    g.scene.add(e.root);
    this.enemies.push(e);
    enc.enemies.push(e);
    if (arch.boss) { this.boss = e; this.bossName = arch.miniBoss ?? arch.id; }
    if (!this.monsterFx && arch.brain) this.monsterFx = new MonsterFX(g);
    if ((opts.wave ?? 1) <= enc.wave) e.activate();
    return e;
  }

  /** The Last Crown's death sequence finished: the ending follows (Game.endGame). */
  onBossDefeated(e: Enemy) {
    this.killCount++;
    this.g.signals.emit('boss:dead', { id: e.arch.id });
    this.g.time.gain(e.arch.reward, 'kill');
    this.g.schedule(4.5, () => this.g.endGame());
  }

  /** Aim tracers for archers in their aim phase (current state, visible, alive). */
  private updateTracers(st: TimeState) {
    let i = 0;
    const p = this.g.player;
    if (p.alive) {
      for (const e of this.enemies) {
        if (i >= this.tracers.length) break;
        if (!e.isRanged || !e.alive || e.state !== 'shoot' || e.shootPhase !== 1 || !e.root.visible) continue;
        if (e.owner !== st && e.owner !== 'BOTH') continue;
        const k = e.aimProgress;
        const to = p.pos.clone().setY(p.pos.y + 1.15);
        const from = e.firingPoint(this.g.level.collision, st, to);
        if (!e.opts.perch) from.addScaledVector(e.facing, 0.45);
        const len = from.distanceTo(to);
        const m = this.tracers[i++];
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.color.setHex(e.arch.spectralArrows ? 0x9ae8ff : 0xffb070);
        mat.opacity = 0.08 + 0.5 * k * k;
        m.position.copy(from);
        m.lookAt(to);
        m.scale.set(1 + k * 1.5, 1 + k * 1.5, len);
        m.visible = true;
      }
    }
    for (; i < this.tracers.length; i++) this.tracers[i].visible = false;
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
    for (const r of this.remnants) { this.g.scene.remove(r.root); r.reset(); this.poolEcho(r); }
    this.remnants = [];
    this.slotsUsed.clear();
    for (const a of this.arrows) { this.g.scene.remove(a.mesh); this.arrowPool.push(a.mesh); }
    this.arrows = [];
    this.onStateChange(this.g.time.state);
  }

  clearedIds() { return [...this.encounters.values()].filter((e) => e.cleared).map((e) => e.id); }
}
