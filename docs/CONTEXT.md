# CONTEXT.md

## Purpose

This is the persistent project handoff for future Claude Code sessions.

It must answer:

- What is this game?
- What has actually been built?
- Where are the important files?
- What decisions are locked?
- What is currently broken or incomplete?
- What should the next session do?

Claude must update this file periodically as the project changes.

Do not turn this into a diary. Keep it factual, current, and useful.

---

# 1. Project Snapshot

**Working project type:** browser-based third-person 3D action game  
**Competition theme:** Castles  
**Runtime:** Three.js  
**Content authoring:** Blender  
**AI authoring workflow:** Claude Code + Blender MCP where available  
**World scope:** one ancestral castle  
**Total floors:** 3  
**Current implementation priority:** session 3 = performance + asset lifecycle (done, verified) and Floor 2 verification
(see §6, §10). Floor 3 not started by design.

The player is a forgotten descendant of the royal bloodline that once ruled the castle. The bloodline is bound to an ancient temporal mechanism called the Crownheart. The player can force the castle between two spatial memories:

- Past: intact, inhabited, warm, militarized, near the kingdom's final days.
- Present: ruined, overgrown, damaged, empty or haunted by temporal remnants.

The game is action-heavy. The player fights frequently, uses a sword and shield, moves aggressively, and earns temporal charge through combat. A charged ability allows a deliberate 2 to 3 second transition between Past and Present.

The state change is also the primary traversal/puzzle mechanic.

---

# 2. Locked Product Decisions

## Structure

- The entire game is inside the castle.
- Three floors total.
- Floor 1: large, fully featured gameplay floor.
- Floor 2: another substantial gameplay floor, designed only after Floor 1 is proven.
- Floor 3: shorter final progression with limited pre-boss content and the main boss fight.
- One loaded floor/major section at a time is preferred for performance.
- Each gameplay floor has both Past and Present states.

## Time system

- The player cannot freely spam timeline changes.
- Temporal charge is earned primarily through combat.
- Enemy defeats should contribute strongly to recharge.
- Time shift is an intentional hold action, approximately 2 to 3 seconds before completion.
- The environment transforms around the player's current location.
- The player remains in approximately the same world position during a shift.
- The destination state must be safe enough to avoid obvious mesh trapping.
- Level design must account for charge availability and must not allow an unrecoverable softlock after enemies are exhausted.

## Level design

- Claude designs the floor plan.
- The user is intentionally not providing the room/corridor layout.
- Each floor must be designed as two coordinated blueprints, Past and Present.
- The two states share architectural identity but differ meaningfully in traversal geometry.
- Neither state is simply good or bad.
- Some routes are possible only in Past.
- Some routes are possible only in Present.
- Puzzles should escalate from simple state recognition to multi-step spatial weaving.
- Combat rooms and corridors should be common.
- Floor design must remain believable as an internal castle.

## Combat

The supplied hero has a large Mixamo sword-and-shield animation set: verified 49 clips (see §4 and `src/data/animationManifest.ts`).

The implementation should exploit the available animation variety.

Expected action set includes, where supported by actual clips:

- idle and combat idle;
- walk/run/sprint;
- combat strafe;
- jump;
- falling and landing;
- crouch;
- roll/dodge;
- light attacks;
- strong/heavy attacks;
- attack chains and combo routes;
- shield/block/parry behavior;
- kick or shield bash if available;
- hit/stagger reactions;
- knockdown;
- death.

Actual animation files must be inspected before final mapping.

---

# 3. Narrative Snapshot

Canonical narrative is defined in `LORE.md`.

Short version:

House Vaelor once ruled the Kingdom of Veyr from Caer Veyr. Deep beneath the castle lies the Crownheart, an ancient mechanism capable of preserving spatial memory. The royal bloodline bound itself to the Crownheart and gradually became inseparable from it.

During the kingdom's final siege, the last king tried to preserve the castle forever by forcing the Crownheart to hold the entire stronghold at the moment before destruction. The ritual failed and caused the Sundering.

The castle now persists as overlapping temporal memories. The protagonist, an unrecognized descendant of the bloodline, is uniquely able to move the castle between those memories.

The player initially returns to reclaim an inheritance, then discovers that the royal family itself caused the catastrophe.

See `LORE.md` for full details and boss logic.

---

# 4. Verified Asset State (inspected 2026-09-29)

Source assets live under `assets/` exactly as the user supplied them. They are **immutable**.
Zips are extracted (copies, never modified) by `python tools/extract_assets.py` into
`assets/extracted/` (mirrors the source layout; derived/reproducible, ~232 MB).

## Hero — `assets/characters/hero/Sword and Shield Pack.zip`

- `Maria WProp J J Ong.fbx`: Mixamo character "Maria" with props. FBX 7700.
  - Armature `Armature`, 65 bones, standard `mixamorig:*` names incl. full fingers. T-pose rest. Object scale 0.01, rot X 90°.
  - Mesh `Maria_J_J_Ong` 14,566 tris, shield is part of this body mesh (skinned to left arm).
  - Mesh `Maria_sword` 80 tris, skinned (1 vertex group) — the sword is already attached to the right hand. Blade length 1.145 m.
  - One material `MariaMat`, packed 2048² textures: diffuse, normal, specular.
  - Height ≈ 1.75 m, hips 1.05 m.
- 49 separate animation FBX clips (no mesh), all 30 fps, all with the identical 65-bone skeleton, only `mixamorig:Hips` carries location keys.
  - Locomotion / strafes / several attacks contain root translation (e.g. `run` 2.85 m/0.7 s, `attack` 3.55 m leap). Processed in Blender (see below).
  - **No roll clip and no crouch-walk cycle exist in the pack.** Dodge is designed as a directional dash on the run/strafe clips (see manifest).
- Full clip classification: `tools/blender/hero_clip_map.json` (hand-authored from contact sheets `build/reports/sheet_*.png`).
- Generated manifest with durations, root-motion curves, sword/foot/shield timing peaks: `src/data/heroAnimations.json`.

## Enemies — `assets/characters/enemy/`

| File | Format | Rig | Anims | Notes |
|---|---|---|---|---|
| `armored_guard_knight_rig.glb` | Sketchfab glTF | custom 83-joint "Guard Armature" (Pelvis/Spine/Torso/Upperarm.L…, Spear bone) T-pose | `Idle` only | 25.5k tris, 3 mats (Guard, Dark, Spear), holds a spear. Model origin offset (feet at z≈1.95 in Blender). |
| `zombie_monster_slasher_necromorph.glb` | Sketchfab glTF | `mixamorig:*` names with `_NN` suffixes, 34 joints (no fingers), ~A-pose | `anim` (1) | 6.3k tris, 1 mat, blade arms. |
| `night_monster (1).glb` | Sketchfab glTF | custom 23-joint | `Armature|ArmatureAction` (1, floating loop) | 3.2k tris, ghost. Imports into Blender with broken 100× transforms — use directly in three.js. |
| `Longbow Aiming Pack.zip` → `Erika Archer With Bow Arrow.fbx` + 8 clips | Mixamo FBX | `mixamorig:*` 1.8 m T-pose | idle, draw arrow, aim overdraw, aim recoil, aim walk fwd/back/left/right | Bow + arrow meshes included. No death/hit clips (reuse hero Mixamo clips). |

New enemy/boss GLBs (added by the user 2026-09-29, inspected session 3 with `node tools/inspect_glb.mjs <file>`; all
Sketchfab exports with the usual `Sketchfab_model` root matrices — scale must be normalised at load like `ghost`):

| File | Tris | Rig | Clips | Textures / materials | Notes / planned use |
|---|---|---|---|---|---|
| `bat_dark_bad_cartoon_monster.glb` (0.38 MB) | 2.0k | 10 joints + morph | `Take 001` 1.28 s (wing-flap loop) | 1× 1024 JPEG, opaque | cartoon style. Candidate Present flying swarm (wraith AI + flap loop). Not integrated. |
| `ragno_monster.glb` (4.1 MB) | 3.6k | 57 joints (`Bone_NN`) | `Esqueleto|EsqueletoAction` 3.33 s (one cycle) | 9× 1024 PNG (base/MR/normal ×3) + emissive eyes | spider. Needs procedural attack motion (only one clip). Not integrated. |
| `gobelin_monster.glb` (1.4 MB) | 3.1k | 70-joint 3ds Max Biped (`Bip001*`) | `Standby_0` 6.7 s (idle only) | 2× 1024 PNG, KHR_materials_unlit | would need Mixamo→Biped retarget (tools/blender/build_enemies.py style) to walk/attack. Not integrated. |
| `monster-_module_xb1011.glb` (0.96 MB) | 1.3k | 41-joint metarig | `metarig|Idle` 5.0 s | spec-gloss (KHR_materials_pbrSpecularGlossiness), BLEND, occlusion + emissive maps | small blob creature; low value. Not integrated. |
| `final_boss_light_monster.glb` (**30.5 MB**) | 22.4k (9 skinned meshes, all with morph targets) | **399 joints** (Reallusion `RL_BoneRoot`) | `Motion` 8.83 s (1592 channels: 398 T / 787 S / 398 R + 9 weights) | 15 PNGs (1024², 1024×512), **every material alphaMode BLEND** (needs opaque override except wings/hair) | the Floor 3 final boss ("The Last Crown"). Only ONE motion clip: attacks/phases need more animation (see §9). Convert its textures to KTX2 before use (30 MB of PNG). Not loaded anywhere yet. |

New texture sets (zips under `assets/materials/`, extracted to `assets/extracted/materials/`): `plaster_stone_wall_02_1k`
(Poly Haven; diff JPG + nor_gl/arm/disp PNG — the plaster/limestone the Floor 2 royal wing asked for),
`carved_rocks_02_1k.zip` (files are Poly Haven **`aerial_rocks_02`**), `mossy_rock_1k` (Poly Haven), and
`glass_Facade001_1K-PNG` (ambientCG: Color, NormalGL/NormalDX, Roughness, Metalness, Displacement PNG + .blend/.usdc/.mtlx;
a leaded/facade window material). None are wired into runtime materials yet (textureLibrary.json has only the 16 original sets).

New vegetation: `low_poly_stylized_plants_pack_free.glb` (10 plant/flower meshes 6–108 tris, one 512² PNG, alphaMode MASK,
KHR_materials_unlit — the "flower assets") and `sakura_tree_01_-_low_poly_model.glb` (7k tris, bark 512×1024 PNG + blossom
1024² PNG BLEND, ~41.7 units tall in file units). Neither is used yet; the plants pack suits Present roof/ridge growth,
the sakura tree only fits a roofless courtyard-like room (one castle, no outdoors).

## Materials — `assets/materials/{stone,wood,metal,fabric}/*.zip` (Poly Haven, all 1K)

Every set: `*_diff_1k.jpg` (base color), `*_nor_gl_1k.png` (**OpenGL** normal), `*_arm_1k.png` (packed AO/Rough/Metal = glTF-ready ORM), `*_disp_1k.png` (height). Some also ship `*_metal_1k.exr`.

- stone: `stone_wall_04`, `japanese_stone_wall`, `marble_01`, `dark_rock_02`, `rocky_terrain_03`
- wood: `coated_pine_02`, `rough_wood`, `wood_planks_dirt`, `moss_wood`, `wood_shutter`
- metal: `metal_plate_02`, `rust_coarse_01`, `rusty_metal_04`
- fabric: `crepe_satin`, `quatrefoil_jacquard_fabric`, `rough_linen`

PNG normals/ARM are 4–6 MB each; runtime copies are converted (see pipeline).

## Vegetation — `assets/vegetation/`

- `low_poly_grass.glb` (260 tris, textured), `low_poly_grass_pack.glb` (4 tufts, 130 tris, untextured), `low_poly_glowing_flower.glb` (528 tris, 4 mats — emissive flower).

## Audio — downloaded by Claude (2026-09-29), all CC0

Source packs in `assets/audio/_downloads/` (Kenney Impact Sounds + RPG Audio; OpenGameArt: StarNinjas sword
attacks/clashes, artisticdude swishes, rubberduck 80 RPG / 80 creature / 100 SFX #2, Ogrebane monster pack,
qubodup ghost moans, JaggedStone dungeon ambience, SketchMan3 wind loop, PagDev fireplace loop).
**Full provenance, licences, rejected files and per-sound usage: `assets/audio/SOURCES.md`.**
`tools/build_audio.py` -> 48 runtime sounds / ~200 OGG files (3.9 MB) in `public/assets/audio/` +
`src/data/audioManifest.json`. The "Hit sounds" pack (8 kHz mono) was rejected; CC-BY-SA bow sounds not used.

## Tooling verified

- Node v22.14.0, npm 10.9.2, Python 3.13.1 (+ Pillow 11.1, numpy 2.2), ffmpeg.
- Blender **5.2.0 LTS** at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`; glTF + FBX add-ons present. Headless `--background` runs work.
- Blender MCP (official Lab MCP, tools `mcp__Blender__*`) connected to the live GUI session (default unsaved scene at inspection time: Camera/Cube/Light).
- Repository was **not** a git repo and had **no** Three.js code, Blender files or exports before this session.

---

# 5. Documentation Map

- `../CLAUDE.md`
  - operating rules for Claude Code;
  - workflow;
  - repository conventions;
  - update discipline.

- `LORE.md`
  - world history;
  - protagonist;
  - Crownheart;
  - Sundering;
  - enemies;
  - final boss narrative.

- `MECHANICS.md`
  - player movement;
  - combat;
  - combos;
  - temporal charge;
  - time shift;
  - enemy AI;
  - checkpoints;
  - gameplay loop.

- `LEVEL_DESIGN_BRIEF.md`
  - design constraints only;
  - tells Claude how to independently produce the actual floor blueprint;
  - deliberately does not provide a finished map.

- `ASSET_PIPELINE.md`
  - source asset handling;
  - Blender workflow;
  - Mixamo handling;
  - material use;
  - GLB export;
  - runtime asset organization.

- `LEVEL_01_BLUEPRINT.md`
  - the authoritative Floor 1 design (v2, self-reviewed) + §N implementation notes;
  - mirrored in code by `tools/blender/floor01_layout.py`.

- `LEVEL_02_BLUEPRINT.md`
  - Floor 2 "Complicity" (v1.1, self-reviewed): the Royal Floor, resonant fractures, economy, coordinates;
  - mirrored in code by `tools/blender/floor02_layout.py`.

- `../assets/audio/SOURCES.md` — every downloaded sound pack, licence, rejected files, runtime usage.

---

# 6. Implementation Status (verified 2026-09-29, session 2)

| Area | Status | Evidence |
|---|---|---|
| Asset inventory | VERIFIED | §4 |
| Hero animation manifest | DONE | `src/data/heroAnimations.json` (generated from motion), `src/data/animationManifest.ts` (all 49 clips categorised; throws if a clip is missing/duplicated) |
| Floor 1 blueprint | DONE (v2 + implementation notes §N) | `docs/LEVEL_01_BLUEPRINT.md` |
| Modular castle kit | DONE | `tools/blender/castlekit.py`; reference file `assets/blender/modular_kit/castle_kit.blend` |
| Floor 1 Past + Present geometry, collision, markers | DONE | `tools/blender/floor01_layout.py` -> `assets/blender/levels/floor01.blend` -> `public/assets/levels/floor01.glb` (44.5k tris, 140 meshes) + `floor01_collision.glb` (7.6k tris) |
| Hero GLB | DONE | `public/assets/characters/hero.glb` (5.8 MB, 49 clips, root motion stripped, curves in manifest) |
| Enemy GLBs | DONE | `knight.glb` (10.9k tris, 24 clips), `hollow.glb` (17), `archer.glb` (14; eyelash/eye-spec meshes dropped at runtime), `ghost.glb` (source copy) |
| Movement, camera, anim blending, combos, guard/parry, dodge, crouch, jump | WORKING | autopilot + per-frame skeleton probe (session 2): no scale/pose corruption in any state |
| Enemy AI (melee slots, blockers, archers, flying wraiths, boss), encounters/waves | WORKING | autopilot; stall-detection steering added (session 2) |
| Enemy identity without tints | DONE | materials verified identical to source GLBs; aura motes, telegraph glints, mutineer sash |
| Temporal charge, 2.4 s channel, destination validation, radial transition | WORKING | all 8 gates in both autopilot runs |
| Checkpoints / death / respawn / softlock fissures | WORKING | no-god run respawn (session 2) |
| Atmosphere (Present mist/smoke, sky dome, moon shafts, dust, wisps; Past dusk sky) | DONE | `src/vfx/Atmosphere.ts`; screenshots session 2; render 5.9 ms @1280x720 in the barracks |
| Audio (real CC0 samples, 3D positional, ambience beds) | DONE (untested by ear) | `src/audio/Audio.ts`; every event path fired in a scripted fight with 0 errors/culls |
| **End-to-end Floor 1** | **VERIFIED (session 2)** | god run 470 s sim (8 shifts, 65 kills); **no-god run 513 s sim (9 shifts, 64 kills, 1 death -> respawn, exit reached)** |
| Production build | PASSES | `npm run build`: game 208 kB + three 683 kB chunk |
| Visual polish | MOSTLY DONE | Present lighting/atmosphere, fire shader, sigil runes done; wall detailing (pilasters/windows/string courses) and baked AO not done |
| Human playtest | NOT DONE | balance tuned against the bot only; audio mix never heard by a human |
| Combat feel (gore, kills) | DONE (session 2b) | directional blood spray along the blade sweep, floor/wall splatter decals, gore chunks with physics, kill slow-mo + FOV punch, heavy/finisher kills fling + tumble bodies, Echoes shatter into embers/ash/smoke sampled from their mesh; verified numerically (screens partially) |
| Background ambience | **ON in normal play** (corrected session 3) | The user only wanted silence *during automated/Claude testing*. `AudioFX.muted` (automation mute) is set for `?mute`, `?autopilot`, `?bench` and `navigator.webdriver`; in that mode the master is 0 and the 5 ambience beds are not even decoded. Normal players hear everything. `M` toggles mute in-game. Verified: normal load → ctx running, 5 beds playing; `?mute` → 0 beds loaded, master 0 |
| Floor 2 blueprint | DONE (v1.1, self-reviewed) | `docs/LEVEL_02_BLUEPRINT.md` |
| Floor 2 geometry | BUILT (v1) | `tools/blender/floor02_layout.py` → `build_floor02.py` → `public/assets/levels/floor02.glb` (14.8k tris) + collision (3.4k tris); 0 validation issues |
| Floor 2 runtime | WORKING | `?floor=2` loads (44 enemies, 12 encounters, 5 sigils, 6 fissures); Floor 1 exit → chapter reload into Floor 2 with HP/charge carry; FR1 fracture breaks + Present chandelier bridge verified; every route segment walked with 0 falls (see §10) |
| Floor 2 full playthrough | **VERIFIED (session 3)** | god: spawn → G7 in one run + CP5 → exit segment; **real damage (`?autopilot=full&floor=2`): exit reached at 495 s, 6 deaths → checkpoint respawns (4 in the Kingsguard fight: kicked into floor holes), 35 kills, 7 shifts, 0 compiles / 0 uploads** |
| Floor 3 | NOT STARTED BY DESIGN | |
| **Asset lifecycle (session 3)** | DONE, VERIFIED | `src/assets/AssetManager.ts` (ref-counted scopes, shared in-flight loads, byte-weighted progress, disposal), `src/assets/GameAssets.ts` (every key + per-floor dependency lists from `src/data/floorManifests.json`). Scopes: `core` (hero, shared sounds), `ambience` (5 beds, skipped when muted), `floorN`. F1→F2→F1→F2 returns identical GL counts |
| **Loading screen** | DONE | `src/ui/LoadingScreen.ts`: initial + floor transitions; "LOADING CAER VEYR / ████░░ 82% / Preparing the Royal Floor — …"; real progress (bytes, then build, then GPU warm-up) |
| **In-place floor transitions** | DONE, VERIFIED | `Game.transitionTo(next)`: stop loop → retain shared keys → `unloadFloor()` → release old scope (disposes textures/geometries/materials/skeletons/bone textures/audio buffers only it used) → load+build+warm next → carry HP/charge. Duplicate calls share one promise. F1→F2 ≈ 2 s (was page reload 3.4 s + 6.4 s first-frame freeze) |
| **GPU warm-up** | DONE, VERIFIED | `src/assets/Warmup.ts` + warm kits in EnemyManager/Effects/Gore/Atmosphere + `src/vfx/ShadowDepth.ts`: 0 shader compiles and 0 texture uploads after the loading screen over a 342 s F1 autopilot run |
| **Pooling** | DONE | fissure remnants (4, pre-instantiated), arrows (16), glints, shift rings, afterimages (no per-dodge buffers), blood decals, gibs, smoke wisps |
| **KTX2 textures** | ADOPTED (default) | `tools/build_ktx2.mjs` → `public/assets/ktx2/**`; runtime prefers them, `?tex=jpg` forces the originals. See §10 benchmarks |
| **Profiler** | DONE | `src/game/Perf.ts` (per-frame step/render/GPU timer query, compile/upload attribution, spikes, long tasks); `Game.bench()` drives real frames in hidden tabs |

---

# 7. Runtime / Pipeline File Map

Build pipeline (deterministic, re-runnable; Blender runs headless via CLI):

```text
python tools/extract_assets.py   # zips -> assets/extracted/ (never touches sources)
python tools/build_textures.py   # PBR -> public/assets/textures/*.jpg + src/data/textureLibrary.json
npm run assets:hero              # hero.blend + hero.glb + src/data/heroAnimations.json
npm run assets:enemies           # retarget -> knight/hollow/archer.glb + src/data/enemyRigs.json (needs hero.blend)
npm run assets:floor01           # floor01.blend + castle_kit.blend + floor01*.glb + build/reports/* renders
npm run dev                      # Vite dev server http://localhost:5173
npm run build                    # tsc --noEmit + vite build -> dist/
```

Blender helpers: `tools/blender/inspect_hero.py`, `inspect_facing.py`, `render_clip_sheet.py`,
`inspect_enemies.py`, `hero_clip_map.json` (hand classification of every clip).
Vegetation GLBs are copied as-is to `public/assets/vegetation/`; `ghost.glb` is a copy of `night_monster (1).glb`.
Audio: `npm run assets:audio` (= `python tools/build_audio.py`, needs ffmpeg + numpy); pass sound ids to rebuild only those.

Runtime (`src/`):

- `game/Game.ts` — renderer, per-state environment presets (fog/hemi/sun/exposure blend), loop, game-clock
  timers (`schedule`), voids + fall-respawn, prompts, finale arena lock, debug/test API.
- `game/Physics.ts` — one MeshBVH per state (SHARED ∪ state), capsule resolve, `capsuleBuried` inside-solid
  test, dynamic box colliders, void volumes, footing probes.
- `game/Input.ts` (real + virtual input), `game/AutoPilot.ts` (end-to-end playthrough driver + ROUTE).
- `character/Player.ts`, `AnimController.ts` (base loops + upper/lower masks + overlays), `CameraRig.ts`.
- `combat/CombatData.ts` — attack graph and timings.
- `enemies/EnemyTypes.ts`, `Enemy.ts`, `EnemyManager.ts`.
- `time/TimeSystem.ts`, `levels/Level.ts`, `levels/Materials.ts`, `levels/Checkpoints.ts`.
- `ui/HUD.ts` + `ui/style.css`; `ui/LoadingScreen.ts` (initial + transition loading screen, real progress).
- `assets/AssetManager.ts` (scoped ref-counted residency, disposal helpers, streamed fetch), `assets/GameAssets.ts`
  (asset keys, loaders incl. KTX2 + createImageBitmap, floor dependency lists), `assets/Warmup.ts` (GPU warm-up).
- `game/Perf.ts` (profiler), `vfx/ShadowDepth.ts` (stable per-class shadow depth materials).
- Build tools added session 3: `tools/build_floor_manifest.mjs` (floor deps + asset sizes; run by predev/prebuild,
  `npm run assets:manifest`), `tools/build_ktx2.mjs` (`npm run assets:ktx2`), `tools/inspect_glb.mjs`,
  `tools/elevenlabs_sfx.mjs` + `tools/elevenlabs_sfx.json` (`npm run assets:sfx`), dev page `dev/ktx2bench.html`.
- `vfx/Effects.ts` — particles in two pools (additive glow / alpha-blended gore+dust+ash), afterimages, blade trail,
  shift rings, enemy **aura** motes (`AURA` table), telegraph **glints** (star sprite riding the weapon bone).
- `vfx/Atmosphere.ts` — patches three's fog chunks once (`installAtmosphereFog`, called first in `Game`) for
  height mist + drifting noise smoke; shared uniforms `ATMO_UNIFORMS` are attached by `injectAtmosphere` (default
  `Material.prototype.onBeforeCompile`, and explicitly inside `Materials.applyShiftDissolve`). Also sky dome,
  Present moon shafts (built from `MOON_HOLES` = the roof holes of `floor01_layout.py`, clipped by raycast),
  shaft dust, smoke wisps. Per-state presets `ATMO`; lighting presets `ENV` in `Game.ts` (Present: low hemi,
  near-vertical shadowing moon so light falls through roof holes, low-angle shadowless `fill`, hero light).
- `vfx/Fire.ts` — all `fire` markers as one instanced procedural flame shader per state.
- `audio/Audio.ts` — sample engine: `play(id, {pos, vol, rate, jitter, delay})`, buses + compressor, voice caps,
  equal-power panners, listener = camera; gameplay vocabulary (`swing`, `hitEnemy`, `block`, `footstep`, ...);
  ambience beds driven by `AmbientContext` (open-sky raycast, nearest flame, depth, combat) from `Game`.
- Enemy gameplay -> presentation: `Enemy.events` (`alert/telegraph/windup/swing/aim/death`) drained in
  `EnemyManager.presentEnemy` (glints, voices, swings, deaths, footsteps, shadow-caster culling at 20 m).

Conventions:
- Blender (x, y, z) = three.js (x, z, -y). Blueprint coordinates are Blender coordinates.
- Marker data lives in glTF extras (`mk_name`, `marker`, `section`, `group`, props). GLTFLoader strips dots
  from node names, so never parse names.
- Materials export by name only; `Materials.ts` binds textures and a Past + Present variant per key.
  SHARED meshes swap variant on shift; PAST/PRESENT meshes dissolve radially from the player.
- Kit primitives must keep outward winding (see §9 bug list).

## Controls (implemented)

WASD move · mouse look · Shift tap dodge (fires on release < 0.22 s) / hold sprint · Space jump · C crouch (toggle) · LMB light · RMB heavy ·
hold Q guard (press just before a hit = parry) · Q+LMB shield bash · F kick · R hold 2.4 s to shift ·
E interact (sigils, memory traces) · Tab or MMB lock-on · Esc pause · backquote debug overlay · F9 collision view.

Combos: L1 chop → L2 rising cut → L3 lunge → L4 advancing sweep (loops); L1/L2 + heavy = whirlwind finisher;
L3/L4 + heavy = leap slam; heavy = spin slash → heavy = jump spin; sprint + light/heavy = dash lunge / leap slam;
air attack; crouch sweep; kick and bash break guards. A parry staggers the attacker and grants +12 resonance.

## Testing hooks

- **Automation mute:** `?mute` (also implied by `?autopilot`, `?bench`, `navigator.webdriver`) = silent, ambience not
  decoded. Normal URLs play the full mix. `M` toggles mute in game.
- `?tex=jpg` → original JPEG/PNG textures instead of KTX2 (A/B). `?floor=2` starts on Floor 2.
- `__perf.report()` / `__perf.spikes` / `__perf.reset()`; `__game.bench(seconds)` runs real frames (step+render, measured)
  without rAF (the Claude browser pane is hidden → rAF never fires); `__game.memoryReport()` (GL counts, heap, resident
  asset keys by scope); `__transition(n)` = the in-game floor transition (loading screen included); `__game.loadLog`.

- `http://localhost:5173/?autopilot=god` or `?autopilot=full` — scripted playthrough. In the Claude browser pane
  rAF does not tick while the pane is hidden, so drive it from the console with `__game.advance(seconds)`.
- Console: `__game.view(x, y, z, yawDeg, pitch, seconds, state?)` (teleport + simulate + render + pause; screenshots),
  `__game.tp(x, y, z, yawDeg)` (blueprint coords), `__game.forceState('PAST'|'PRESENT')`,
  `__game.time.unlocked = true`, `__game.time.charge = 200`, `__game.player.godMode = true`.

---

# 8. Next Concrete Tasks

1. **Floor 2 balance:** the real-damage bot exits but dies 4× in E10 — the Captain's kick (knock 8, guard-break)
   throws the player into the Present apartments' floor holes (fall = −25 % HP, lethal at low HP). Consider a smaller
   kick knockback in E10, rim debris/low rails on the holes, or a CP nearer the arena; human playtest first. Also
   watch the antechamber void fights (E1/E9) and the ridge wraiths (E6).
2. **Listen to the mix** (a human): ambience is back on in normal play; the ElevenLabs layers (`gore_splat`,
   `kill_impact`, `bone_crunch`, `echo_shatter`, `blood_splash`) were generated and wired at conservative gains but
   were never heard — adjust gains in `tools/build_audio.py` (then `npm run assets:audio -- <ids>`) or drop a layer.
3. **Floor 2 visual pass** with the new textures: add runtime material keys for `plaster_stone_wall_02` (Past royal
   walls), `mossy_rock` (Present rubble), `aerial_rocks_02` and the ambientCG facade glass (Long Gallery windows);
   they need `tools/build_textures.py` + `tools/build_ktx2.mjs` SETS entries, a `Materials.ts` DEF and the layout script
   (`floor02_layout.py`) using them, then `build_floor02.py`.
4. **Floor 3 prep (only after Floor 2 is verified):** convert `final_boss_light_monster.glb` to KTX2 and opaque
   materials, and source more boss animation (it has one 8.8 s clip).
5. New enemy GLBs (bat, spider, goblin, blob) are inspected but not integrated; the bat is the cheapest win (flying AI
   + flap loop). Each needs a normalisation step like `ghost` in `GameAssets.prepareEnemy` and an archetype.
6. Floor 1 leftovers: wall detailing, baked AO, roll/crouch-walk clips, archer decimation.

---

# 9. Assets / Textures Needed From User

These would materially improve the game and are best sourced manually (licensing/quality judgement by ear/eye):

- **Final boss animation (highest value for Floor 3):** `final_boss_light_monster.glb` has a single 8.8 s `Motion`
  clip on a 399-joint Reallusion rig. A boss fight needs at least idle, walk/float, 3–4 attacks (sweep, slam, lunge,
  ranged), hit reaction, phase transition and death — ideally exported from the same source (Reallusion / Mixamo-style
  retarget) as separate clips or one timeline with markers.
- **Enemy animation for the new monsters:** the spider/goblin/blob each ship one clip (walk / idle / idle). Attack,
  hit, death clips (or the source rigs so Mixamo clips can be retargeted) are needed before they can fight.
- **Audio:** human combat vocal efforts/grunts/death cries (royal guards + hero); a real bow draw/release/arrow set;
  distant crowd / war drums for Past halls; a choir/drone bed for the finale and the Crownheart; heavier plate-armour
  foley; stone-scrape / masonry-shift layers for the time shift. (Gore/kill/shatter layers now come from ElevenLabs.)
- **Characters/animations:** a roll clip and a crouch-walk cycle for the Mixamo hero; a spear set for the knight.
- **Textures still missing:** tapestry / painted heraldry (House Vaelor), ivy / hanging moss alpha cards and a cobweb
  alpha for the Present, water / puddle normals. (Plaster, mossy rock, aerial rocks and facade glass arrived this
  session — not wired yet, §8.3.)
- **Vegetation:** ivy/creeper cards and small ferns/roots for Present interiors.
- **KTX2 — nothing required from you.** The conversion ran in this session with `npm run assets:ktx2`
  (tools/build_ktx2.mjs, Basis Universal via the `ktx2-encoder` npm package, 56 jobs in ~7 min on 12 threads).
  If you prefer your own GLB converter, the equivalent settings are: colour/baseColor/emissive → **UASTC**, RDO ≈ 2,
  Zstd supercompression, sRGB, mipmaps; normal maps → **UASTC** normal-map mode, RDO ≈ 1, Zstd, linear, mipmaps;
  ORM / metallicRoughness / occlusion → **ETC1S** quality ≈ 200, linear, mipmaps; loose level textures must be
  **Y-flipped** (TextureLoader convention), GLB-embedded ones must not. e.g. `toktx --t2 --encode uastc --uastc_quality 2
  --uastc_rdo_l 2 --zcmp 19 --genmipmap --assign_oetf srgb out.ktx2 in.png` (KTX-Software) or
  `gltf-transform uastc in.glb out.glb --level 2 --rdo 2 --zstd 19` / `gltf-transform etc1s …` for GLBs.
  **Still to convert (when used):** `final_boss_light_monster.glb` (30 MB PNG), the 4 new monster GLBs, the new
  vegetation GLBs and the 4 new texture sets — add them to `GLBS` / `SETS` in tools/build_ktx2.mjs.

## 9.1 ElevenLabs sound plan

Generation is scripted: `npm run assets:sfx` (tools/elevenlabs_sfx.mjs reads ELEVENLABS_API_KEY from the root `.env`
at build time only — never a VITE_ variable, never shipped). Specs: `tools/elevenlabs_sfx.json`; outputs + provenance:
`assets/audio/elevenlabs/` + `MANIFEST.json`. **Done session 3:** gore_splat ×4, kill_impact ×3, bone_crunch ×3,
echo_shatter ×3, blood_splash ×3 (built into runtime OGGs, wired as layers in EnemyManager.impact / presentEnemy).
Remaining candidates from the list below: sword swings, sword-on-armour, shield block, bow set, hollow/wraith voices,
time-shift charge/boom, fracture break, footsteps.

Priority SFX (combat first — the user wants kills to feel rewarding): wet **gore splat** / flesh tear (3–5 var.),
**bone crunch** for finisher kills, heavy **kill impact** (body blow + armour), **blood splash on stone** for
decals, **Echo shatter** (a spectral, glassy exhale that turns into ember crackle — used on `shatter`),
**sword swing** set with real blade whistle (light/heavy), **sword on armour** clangs, **shield block** (wood +
iron), **bow draw / release / arrow whizz / arrow impact**, hollow **growls/shrieks/death**, knight **effort grunts
/ death cries** (human, male/female), wraith **wail/dive**, **time-shift charge** (rising, reversing stone roar)
and **shift boom**, **fracture break** (winch brake snapping, chain run-out, chandelier crash), footsteps on
marble/wood/rubble, body falls. (Ambience is ON in normal play; only automation mode is silent.)

## 9.2 Dialogue plan (identify now, generate later with ElevenLabs v3 audio tags for emotion)

Short, sparse lines — the game tells its story through places, not exposition.
- **Memory Traces** (both floors) — currently on-screen text: optional whispered read-outs in the voice of the
  person who wrote them (Floor 1: the King's order, cart owners, mutineers, Aldren's tomb note; Floor 2: T1
  Chancery order (clerk, flat, tired), T2 roster (warden, bitter), **T3 the Queen's letter (urgent, frightened,
  hushed — the key reveal)**, T4 Aldren's margin note (calm certainty, obsessive), T5 the winch (old servant)).
- **Sealed doors** — "The door does not know you." (a chorus of whispers, cold).
- **Boss barks** — Gate Warden (Floor 1) and Kingsguard Captain (Floor 2): 3–4 lines each at intro / 60 % / 30 %
  / death (formal, loyal to the King, grief on death).
- **Royal guards (Past)** — 6–8 alert barks ("Blood claimant!", "Hold the door!"), shouted, militaristic.
- **The Uncrowned** — near-silent protagonist; optional 4–5 exertion sounds and one line when reading T3.
- **Floor 3 / the Last Crown** — Aldren's voice (regal, warm, persuasive, wrong): later.
Deliverable when asked: a script file (`docs/DIALOGUE.md`) with line ids, speaker, emotion tags, trigger marker,
then generation + `Audio.voice(id)` hook.

---

# 10. Latest Verified Session

### Session 3 (2026-09-29) — performance, asset lifecycle, KTX2, audio correction, Floor 2 verification

**Measured first, then fixed.** Machine: Windows 11, AMD Radeon integrated GPU (0x1636) via ANGLE/D3D11, Chrome 152
(Claude browser pane, hidden → frames driven by `Game.bench()`). Another chat's game server (:5173) was running on the
same machine: some runs show 40–280 ms *render-CPU* frames with idle GPU timer queries = external GPU contention;
every number below was re-measured when that noise disappeared.

**Root causes of the stalls (all first-use GPU work, not GLB parsing at spawn):**
1. three r186 removed `PCFSoftShadowMap`; the first shadow render silently switched to `PCFShadowMap` and invalidated
   every program compiled at load → recompiled on frame 1.
2. Every texture uploaded lazily on its first draw (plus lazy JPEG decode of `TextureLoader` images).
3. Programs of objects not visible at load (other time state, hidden/rising enemies, VFX, gore, sprites) compiled
   mid-game (~350–400 ms each on this GPU).
4. The death-fade made double-sided enemy materials transparent → three's back+front two-pass path (2 program
   re-resolves per draw per frame + 2 new variants); warm-up materials were disposed right after warm-up, which freed
   their programs again (three ref-counts programs by material).
5. The shared shadow `MeshDepthMaterial` only re-resolves its program when skinning flips between casters, so depth
   variants depended on draw order (a respawn could compile one).
6. Pool point lights toggled `visible` (would recompile every lit program when a state had < 10 lights).

| Scenario (Floor 1 unless noted) | Before | After |
|---|---|---|
| First gameplay frame after "Enter" | **4120 ms** (19 programs, 47 uploads) | **8.5 ms**, 0/0 |
| Floor 2 first frame | **6388 ms** | covered by warm-up (0 compiles in F2 runs) |
| First Past shift | **1434 ms** (7 programs, 46 uploads) | **12.8 ms** |
| First encounter (E1 risers) | 359 ms | 10 ms |
| E4 trigger (entering combat after quiet traversal) | 809 + 824 ms | ≤ 10 ms render (the 167 ms outlier was traced to #4, fixed) |
| First kill (gore, fling) + corpse fade | 574 + 751 ms | ≤ 16 ms, 0 compiles |
| Death + respawn ×1 | 16 ms, 5 compiles | 0 compiles |
| E13 finale, 14 enemies (28 active) | render 17–22 ms (contended) | render p50 6.4 / p99 8.7 ms, GPU p99 4.1 ms, step p99 3.6 ms, 0 frames > 33 ms |
| Full F1 god autopilot to t = 342 s | — | **0 shader compiles, 0 texture uploads after loading**; render p99 ≤ 16.5 ms |
| Floor 1 → 2 | page reload 3.4 s + 6.4 s frozen first frame | **≈ 2.0 s** in place behind the loading screen, first frame 15.5 ms |
| F1→F2→F1→F2 | — | identical GL counts per floor (F2: 128 geometries / 159 textures / 39 programs both times); no scene-object leak |

Load (localhost, warm cache, KTX2): F1 ≈ 4.2–5.3 s total (assets 1.2–2.8 s, build 0.2–0.5 s, GPU warm-up 1.9–2.3 s:
uploads 0.2–0.5 s, parallel compile 0.6–0.8 s, forced-visible renders 0.5–1.2 s). Heap after load ≈ 100–146 MB.
Resident by scope (JPEG mode): core 45 MB GPU / 24 MB CPU, floor1 271 MB GPU, floor2 261 MB GPU; ambience beds
+87 MB decoded CPU in normal (unmuted) play.

**KTX2 investigation (real comparison, `dev/ktx2bench.ts` + in-game A/B; reports in `build/reports/ktx2_*.json`):**
BC7 is the transcode target here (BPTC + S3TC available). Micro-benchmark per texture: GPU memory 4× smaller
(1024² 5.6 → 1.4 MB, hero 2048² 22.4 → 5.6 MB); quality UASTC ≫ current JPEGs (diffuse 44.9 vs 33.3 dB PSNR, normals
3.5° vs 7.8° mean error), ETC1S slightly worse than the JPEGs (30.9 dB); size ETC1S 0.3–1.0×, UASTC 2.8–5.9× the
current files; transcode (worker) UASTC 45 ms/1024², 200 ms/2048², ETC1S 13–40 ms; isolated sampling cost neutral.
In-game A/B (same 12 views, both states): resident GPU memory **91.8 MB vs 316.2 MB**, warm-up uploads **185 vs
472 ms**, per-frame GPU time equal within noise, asset phase 2.8 vs 1.8 s on localhost, download +≈35 MB.
**Adopted as default** (memory + upload + quality); `?tex=jpg` keeps the originals. Orientation verified (identical
brick/tile layout in screenshots of both modes).

**Floor 2 (as built) — god autopilot `ROUTE2` (src/game/AutoPilot.ts) verified end to end:** full run from spawn
through E1, CP1, G1, E1b, E3, timber stair, mezzanine, G2, slope, CP2, Wardens' Walk, E4, truss ramp, ridge/E6,
tower + CP3, south walk, G3, E7, crown bridge, G4, G5, E8, **FR1 broken (chandelier falls)**, G6, loft drop, E9,
CP4, chandelier bridge, **E10 Kingsguard Captain (≈60–105 s fight, boss bar, adds, surge to 200)**, CP5, G7
(t ≈ 300 s, 0 deaths, 35 kills, 7 shifts); the conduit stair → bell chamber → **exit (end card)** segment verified
after the landing fix. Real-damage run (`?autopilot=full&floor=2`, fresh load): **exit reached at t = 495 s**, 6 deaths → CP respawns
(4 in E10), 21 void falls, 35 kills, 7 shifts, 0 compiles / 0 uploads, per-20 s-chunk render p99 ≤ 25 ms,
61 of ≈ 30k frames > 33 ms (fights / host contention).
Fixes made while verifying Floor 2:
- **Kingsguard died in 1 s**: ground enemies chased straight into floor holes. `Enemy.keepFooting` = void-aware
  steering (walkers pick the nearest heading with footing and go round holes), the Present boss lunge never launches
  over a hole, and a knocked-back boss at a ledge is caught and staggered 1.5 s (`Enemy.catchAtEdge`, blueprint E10).
  Side effect: E3p Hollows no longer suicide into the chancery void (E3p is pressure, as designed).
- **Conduit stair (Past) had a 1 m gap** between the lower flight top (y 93) and the landing (y 94) over a 6 m drop:
  `floor02_layout.py` adds the landing piece; floor02.glb rebuilt (0 issues, 14.8k / 3.4k tris).
- AutoPilot: per-floor `ROUTES`, `strike` steps (fractures), ledge guard (never walks forward into a hole unless a
  step is `drop`), fall recovery (re-walk from the last nearby waypoint at the current height), fissure-seeking when a
  required shift lacks charge.

**Audio:** ambience ON for players (correction of the session-2b misunderstanding); automation mute mode; ElevenLabs
layers generated (16 files) and wired — unheard by a human (§8.2).

**Files added:** `src/assets/{AssetManager,GameAssets,Warmup}.ts`, `src/game/Perf.ts`, `src/ui/LoadingScreen.ts`,
`src/vfx/ShadowDepth.ts`, `src/data/{floorManifests,assetSizes}.json` (generated), `tools/{build_floor_manifest,
build_ktx2,inspect_glb,elevenlabs_sfx}.mjs`, `tools/elevenlabs_sfx.json`, `dev/ktx2bench.{html,ts}`,
`public/assets/ktx2/**`, `public/assets/basis/*`, `assets/audio/elevenlabs/*`.
**Files changed:** `src/main.ts` (boot/transition flow), `src/game/{Game,AutoPilot,Input,Physics}.ts`,
`src/levels/{Level,Materials,Floors}.ts`, `src/enemies/{Enemy,EnemyManager}.ts`, `src/vfx/{Effects,Gore,Atmosphere,Fire}.ts`,
`src/audio/Audio.ts`, `src/character/Player.ts`, `index.html`, `src/ui/style.css`, `tools/build_audio.py`,
`tools/blender/floor02_layout.py`, `package.json` (predev/prebuild manifest, assets:manifest/ktx2/sfx; devDeps
ktx2-encoder, @gltf-transform/core, @gltf-transform/extensions), `.claude/launch.json` (extra :5174 config).

**Known issues / risks:**
- Measurements on this machine are noisy when other GPU clients run; compare medians.
- KTX2 costs ~1 s extra asset time on localhost and ~35 MB extra download; the JPEG set still ships (fallback).
- The autopilot is a bot: E1/E9 fights beside the antechamber void and the ridge wraith fight are its weak spots.
- New monsters/boss/textures/plants are inspected but not integrated.
- `readPixels` from the hidden pane returns only the clear colour (use pane screenshots for visual checks).

### Session 2b (2026-09-29, later) — Floor 2, combat feel, ambience muted
- **Floor 2** (see `docs/LEVEL_02_BLUEPRINT.md`): new files `tools/blender/floor02_layout.py`,
  `tools/blender/build_floor02.py` (copy of the Floor 1 driver; own QA views `f02_*`; run Blender directly —
  `npm run assets:floor02` hit a cmd.exe quoting problem in this shell), `src/levels/Floors.ts` (floor registry +
  sessionStorage carry), `src/levels/Fractures.ts` (Past break → Present consequence). Level groups can be
  `STATE|FLAG` / `STATE|!FLAG`; `Level.setFlag` rebuilds that state's collision BVH (`CollisionWorld.replace`).
  `EnemyManager` encounters support `boss` (HP-threshold waves, boss bar, title) and `surge` beyond the Floor 1
  finale. New archetype `kingsguard`. `Checkpoints` accepts any sigil count. `?floor=2` loads Floor 2 directly
  (charge ≥ 100, unlocked).
- Floor 2 verification (scripted walks, 0 falls): spawn → antechamber; without FR1 the Present void kills (falls
  counted, respawn OK); Past loft heavy blow breaks FR1; Present chandelier bridge crosses to the King's
  Apartments; chancery Past stair → mezzanine; Present slope → ledge → east door → Wardens' Walk → range door;
  Present truss ramp → ridge → down past the gate; tower flights + top; Past Long Gallery full length onto the
  crown bridge; Past conduit stair. Bugs fixed while testing: overlapping wall openings (kit limitation — use one
  opening range per wall call), shelves on the chancery stair, chancery slope burying the east door (break line
  moved to y 72, door y 61–64), tower-top hole swallowing the walk, winch stump narrowing the loft.
- **Combat feel**: `src/vfx/Gore.ts` (splatter decals raycast onto collision, per-state visibility, 140 cap;
  gore chunks with bounce/settle), `Effects.bloodSpray/ashBurst/shatter/slowmo`, `EnemyManager.impact`
  (blade-sweep direction, power by attack kind), `Enemy.fling` + tumble + `land`/`shatter` events,
  `Game.kickFov`. Knights bleed + shed armour bits and burst into embers; Hollows ooze dark gore and crumble to
  ash; wraiths shed smoke. Player hits spray blood too.
- **Ambience muted** (user: "constantly hearing the background sound — mute that fully").
- Autopilot: strafe-on-stall now checks footing (it had walked off the undercroft fill).
- Tests: `npm run build` PASS (game 225 kB + three 687 kB); Floor 1 god autopilot PASS 485 s (8 shifts, 64 kills,
  0 errors, floor transition → 2 with carry {hp 240, charge 100}); kill test: flung body (14 m/s, 6.9 m/s up),
  93 blood droplets, 13 gibs, 16 decals, slow-mo, shatter of 280 embers at 1.08 s after landing.

### Session 2 (2026-09-29) — fixes, atmosphere, audio, polish (all verified in browser)
Files changed: `character/Player.ts`, `character/AnimController.ts`, `enemies/{Enemy,EnemyManager,EnemyTypes}.ts`,
`vfx/{Effects,Atmosphere,Fire}.ts` (Atmosphere, Fire new), `audio/Audio.ts` (rewritten), `game/{Game,AutoPilot}.ts`,
`levels/{Level,Materials,Checkpoints}.ts`, `vite.config.ts`, `package.json`, `tools/build_audio.py` (new),
`src/data/audioManifest.json` (generated), `assets/audio/SOURCES.md` (new), `public/assets/audio/*` (generated).
- **Hero shrinking to ~1/100 size during run/sprint** — two compounding causes:
  1. `Player.setupBlade()` called `skeleton.pose()`, which rebuilds the root bone from its inverse bind matrix;
     for this Blender export that applies the armature node's 0.01 scale + 90° rotation to Hips a second time.
     The AnimationMixer snapshots bones' "original" state on first play and blends toward it whenever the
     total animation weight is < 1, so that snapshot was a 1/100-scale Hips. Now `pose()` is temporary (bone
     TRS saved and restored).
  2. `AnimController.play()` used `mixer.clipAction(clip)`, which returns the *same* action the base layer
     uses for that clip. The dodge overlay plays `run_fwd`, so it fought the base weight and then `stop()`ped
     the base run loop when it faded out → locomotion had zero weight → blended to the corrupt original.
     Overlays now use an aliased clip (`id#ov`, shared tracks, own uuid). First `setBase` snaps weights.
  - Also: Shift now dodges on *tap release* (< 0.22 s) and sprints on hold; before, every sprint began with a dodge.
  - Probe: hips world scale stays 0.0100 and head height 1.28–1.45 m (crouch ≥ 0.88) across idle, walk,
    sprint, diagonals, strafes, lock-on strafes, dodges, jumps, sprint-jump, crouch/crouch-walk, guard-walk,
    attacks while moving and a 60 s mixed run.
- **Enemy colour tints removed.** `Archetype.tint` is gone; all enemy materials are verified identical to the
  source GLBs (colour/emissive/opacity/map, 164 material instances). Identity now comes from:
  `aura` motes (faint particles: echo/muster/elite/corrupt/dread — `vfx/Effects.ts` `AURA`), a telegraph
  **star glint** on the weapon-hand bone (`Enemy.events` → `EnemyManager.presentEnemy` → `fx.glint`), scale,
  behaviour, the boss bar, spectral arrows for Echo archers, and a real **red sash prop** for the E5b
  mutineers (blueprint-specified; `Enemy.addSash`, attached to the Torso bone).

- **Atmosphere / Present mood**: see §7 `Atmosphere.ts`. The Present is darker than before (hemi 0.42) but reads
  through mist contrast, moonlit floor patches under roof holes, the cold fill light and the hero light.
- **Audio**: real CC0 samples replace all synthesis (§4 Audio, `assets/audio/SOURCES.md`). Swings are timed to
  each hit window's blade motion; hits differ for flesh/armour/spirit/blocked; enemies have growls, armour
  rattle, footsteps, deaths; wraiths moan; time shift = reversed-thunder charge + boom; ambience beds.
- **Polish**: procedural blood-rune sigils (object-space shader; sigil meshes are re-centred at load because
  the GLB bakes world-space vertices), instanced animated flames, darker brazier embers, alpha-blended gore.
- **Perf**: enemies > 20 m cast no shadows; archer overlay meshes dropped; three.js split into its own chunk.
- **Enemy navigation**: stall-detection steering fixed a crypt deadlock (hollow and hero stuck either side of
  a tomb). Autopilot: sprint hysteresis (its toggling read as dodge taps) + strafe when an approach stalls.

### Bugs found and fixed in session 1 (worth remembering)
- Kit face winding was inward for boxes/vaults/spandrels/skirts (invisible in Blender, broken in three.js).
- A capsule fully inside a thick wall was not detected → ray-parity `capsuleBuried` in shift validation.
- `setTimeout` respawns stalled under fixed-step simulation → game-clock `schedule()`.
- `lastSafe` could be recorded on a pit brink → now requires footing all around.
- Finale trigger volume spanned the galleries; attack slots could leak; aggro went through walls → fixed.
- GLTFLoader strips dots from node names → markers carry `mk_name` in extras.

### Tests run
- Session 3: baseline + after profiling suite (first frames, shifts, E1/E4 spawns, kills + fades, death/respawn,
  E13 large fight, fissure spawns) via `Game.bench` + `Perf`; F1 god autopilot to t = 342 s (0 compiles/uploads);
  F1→F2→F1→F2 residency test; KTX2 micro-benchmark + in-game A/B + screenshot orientation check; ambience on
  (normal) / off (`?mute`) check; Floor 2 god route (full + segment) and Floor 2 real-damage run to the exit;
  `npm run build` (tsc + vite) PASS; Blender headless rebuild of floor02 (0 issues).
- Session 2: skeleton probe (hips world scale constant 0.0100 through every locomotion state and a 60 s mixed
  run), enemy material equality check (164 instances), atmosphere screenshots (GP, barracks, Ward, Hall, Past
  Ward/GP), audio event coverage in a scripted fight, render timing, `npm run build`, god + no-god autopilot.
- Numeric normal/winding checks of kit primitives; GLB structure checks (hero, enemies, floor).
- Blender QA renders: `build/reports/floor01_plan_{past,present}.png`, `f01_*_{past,present}.png`,
  `enemy_retarget_sheet.png`, clip sheets `sheet_*.png`.
- Browser: clean-session load, movement/jump/sprint probe, combat probe (E1), sigil + shift probe, breach
  denial probe, render cost probe (step 1.5 ms, render ≈10 ms at 818×698, 234k tris without shadows).
- Autopilot god-mode full run: PASS (8 shifts, 65 kills, 0 falls, 336 s).
- Autopilot no-god full run: PASS (8 required shifts, 68 kills, 2 deaths → CP1 respawns, 0 falls, 535 s).
- `npm run build`: PASS.

### Balance values now in code
Player 240 HP; heal on kill (+12, elites +30, boss +80); melee attack slots 2 (1 while the Warden lives);
Hollows 12–16 damage; guards 15–18; Gate Warden 460 HP; the Last Muster uses the `muster` archetype (55 HP);
E11 runs in two waves.

---

# 11. Rules for Future Updates

- Preserve important historical decisions if they still explain current architecture.
- Remove obsolete implementation instructions rather than letting contradictory instructions accumulate.
- Never claim done without verification.
- Refer to exact files and paths.
- State test results.
- State known bugs.
- Keep the next-session section actionable.
