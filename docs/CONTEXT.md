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
**Game title:** THE CASTLE REMEMBERS (the castle is Caer Veyr).
**Current implementation priority:** session 9 = polish + encounter redesign (§10 Session 9): frequent cinematic
finishers (5 variants), faster touch camera + bigger pocket, the quiet crypt water, the four new monsters with their
own brains + 3 mini-bosses, **Floor 3 rebuilt as the descent to the Crownheart**, the King's lift (F2 -> F3), the
Last Crown's reveal/heart/death. STILL OPEN from the session-9 brief: loading-screen redesign, main menu, the
guided Floor 1 tutorial, the idle-archer audit, playtests of Floor 3 end to end (see §8 Session 9 follow-ups).
Session 8 = enemy robustness (stuck enemies, T-pose leftovers, no monsters in
the Past), a redesigned touch HUD (no Dodge, empty camera pocket), floor-clearing rewards (Crownbreaker = HOLD HEAVY
after Floor 1, Whirlwind = HOLD LIGHT after Floor 2), cinematic last-enemy finishers, dev-only floor/boss warps
(§10 Session 8). Session 7 = mobile combat assist, touch HUD, sigils, onboarding, the heroine's voice, baked
navigation, Floor 2 variety.
Previous: session 5 = new assets integrated: Great Sword techniques + sword guard + real
crouch walk for the hero, the **mage final boss (the Last Crown, Pro Magic Pack "Nightshade")**, Floor 3 built and
playable end to end with an ending (§6, §10). All three floors exist. Next: human playtests (balance, feel, real phone).

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

The hero uses 73 Mixamo clips: the 49 Sword & Shield clips + 23 Great Sword Pack clips + the Crouch Walking clip (see §4 and `src/data/animationManifest.ts`).

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

## 2.1 Locked Jam Requirements (session 4)

- **The shipped jam build is a portrait 9:16 HTML5 game** (Three.js, static build uploaded to itch.io). Target around
  720×1280 / 1080×1920.
- **Portrait resolution and input method are separate axes.** `src/platform/Platform.ts`:
  - view: `portrait` (default) or `wide` (`?view=wide`, internal only — never exposed in the UI; keeps the original
    widescreen camera/HUD for Wavedash or a normal web platform). Same game, same systems; only camera profile + layout.
  - input: `kbm` or `touch`, from real device capability (coarse primary pointer + touch points = handheld → touch),
    then from what the player actually uses (a touch `pointerdown` → touch HUD; a gameplay key or a real mouse press/move
    → keyboard/mouse). Never from the aspect ratio. `?input=touch|kbm` pins it for tests.
- Desktop/laptop jam page: portrait stage centred (pillar-boxed) in the window/iframe, keyboard + mouse, **no touch HUD**.
- Phone: the same portrait game, full-screen stage, touch HUD. A handheld held sideways in portrait view gets the
  "Rotate your device to portrait" overlay (game pauses). Desktops never see it; `?view=wide` never shows it.
- Automated runs stay silent (`?mute`, `?autopilot`, `?bench`, webdriver); normal play has full audio + ambience.
- ElevenLabs stays build-time only (`.env` is git-ignored; nothing VITE_-prefixed).

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
  - Mesh `Maria_J_J_Ong` 14,566 tris. **There is no shield mesh** (verified session 5 with close-up renders): the "shield"
    is her armoured left vambrace/gauntlet and the red panel is a short cape. Guard/bash use the vambrace; two-handed
    Great Sword grips therefore cannot clip a shield.
  - Mesh `Maria_sword` 80 tris, skinned (1 vertex group) — the sword is already attached to the right hand. Blade length 1.145 m.
  - One material `MariaMat`, packed 2048² textures: diffuse, normal, specular.
  - Height ≈ 1.75 m, hips 1.05 m.
- 49 separate animation FBX clips (no mesh), all 30 fps, all with the identical 65-bone skeleton, only `mixamorig:Hips` carries location keys.
  - Locomotion / strafes / several attacks contain root translation (e.g. `run` 2.85 m/0.7 s, `attack` 3.55 m leap). Processed in Blender (see below).
  - No roll clip exists in any pack: dodge stays a directional dash on the run/strafe clips (see manifest).

## Hero additions (session 5) — `Great Sword Pack.zip` + `Crouch Walking.fbx`

- `Great Sword Pack.zip`: the same Maria FBX (identical 65-bone rig; bytes differ only in FBX metadata) + 50 clips
  (`great sword *`, `two handed sword death*`, `draw a great sword 1/2`, `spell cast`). Almost every clip is a true
  two-handed grip (left hand within 0.15 m of the right the whole clip). Inspection: `tools/blender/inspect_pack.py`
  → `build/analysis/greatsword/inspect.json` (duration, loop closure, root travel, yaw, blade/hand/foot peaks with
  swing direction + reach) and `tools/contact_sheet.py` → `build/analysis/greatsword/sheet_0..5.png`, `close_sheet.png`.
- **23 used** (ids in `tools/blender/hero_clip_map.json` `extraClips`, each with its role): attacks `gs_cleave`,
  `gs_quick_cut`, `gs_low_sweep`, `gs_spin_double`, `gs_rampage` (3.5 s, 3 hits, 3.1 m), `gs_high_spin` (2.3 m),
  `gs_leap_spin` (double airborne spin, 3.2 m), `gs_slide_cut` (3.5 m), `gs_crouch_sweep`, `gs_spin_kick`, `gs_plunge`
  (kneeling floor plunge); **sword guard set** `gs_block_enter/idle/exit/impact` + crouched `gs_crouch_block_*`;
  reactions `gs_hit_light/heavy`; deaths `gs_death_forward/collapse`. **27 unused** with reasons (`unusedGreatSword`):
  two-handed idles/locomotion/turns/jumps/crouch transitions (duplicates of the base set), a third kick, power up,
  spell cast, draws.
- `Crouch Walking.fbx` (loose file, 65-bone rig): 36-frame loop, perfect closure, **1.21 m/s** root speed, hips
  0.74–0.80 m, sword upright in the right hand → `crouch_walk`.
- `hero.glb` 5.8 → 7.4 MB (73 clips; KTX2 copy 12.7 MB). Old clip data unchanged (verified: all 49 manifest entries
  identical after the rebuild).
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
| `final_boss_light_monster.glb` (**30.5 MB**) | 22.4k (9 skinned meshes, all with morph targets) | **399 joints** (Reallusion `RL_BoneRoot`) | `Motion` 8.83 s (one idle clip) | 15 PNGs | **Superseded (session 5)** by the Pro Magic Pack boss. Its processed copy (`tools/build_boss.mjs`) is no longer shipped or loaded. |

### Final boss (session 5) — `Pro Magic Pack with final boss.zip`

- `Nightshade J Friedrich.fbx`: Mixamo horned sorceress, **2.35 m**, 12,999 tris, 68 bones (the hero's 65 mixamorig
  bones + Ribbon1-3), one material with diffuse / normal / specular / **glow** 2048² maps. 56 clips on the same skeleton
  (verified): 12 casts (1H throw / sweep / double cast / raise; 2H cast-slam / ground slam / nova / push / lean push /
  **channelled beam** / charged orb / crouch blast), a magical guard set (start/idle/react/end), walk + run ×4
  directions, sprint, turns, crouch set, jumps, 8 hit reactions, 4 deaths, 4 idles.
- Inspection: `build/analysis/magic/inspect.json`, `sheet_0..6.png`, `close_boss.png` (bright close-ups at each cast's
  measured hand-release frame).
- `tools/blender/build_lastcrown.py` → `public/assets/characters/lastcrown.glb` (32 clips, textures 1024², 4.4 MB;
  KTX2 5.7 MB) + `src/data/bossAnimations.json` (durations, hand-release peaks). Unused clips listed with reasons in
  the script (`UNUSED`). Runtime scale 1.15 → 2.7 m.

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

- `DIALOGUE.md` — the heroine: character, arc, knowledge boundaries, trigger rules, casting, ElevenLabs settings,
  QA, streaming (session 7). Lines: `src/data/dialogue.json`.
- `../THE_CASTLE_REMEMBERS_LORE.md` — the user's canonical pre-game lore (untracked file from the user; read it).
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
| Floor 3 blueprint | DONE (**v2.0**, session 5) | `docs/LEVEL_03_BLUEPRINT.md` — mage boss, compact floor (BC → WG weave → warded stair / spire ramp → Hall of Crowns → the Crown). The v1.0 stationary-boss design is obsolete |
| Final boss asset | DONE, VERIFIED | `lastcrown.glb` (Pro Magic Pack Nightshade, 32 clips) — §4 |
| Floor 3 geometry | BUILT, TRAVERSAL VERIFIED | `tools/blender/floor03_layout.py` + `build_floor03.py` → `floor03.glb` (7.2k tris) + collision (1.8k); 0 validation issues; scripted walks: G1 gap (Present void / Past floor), portcullis (Past blocks / Present passes), stair (Past stops at the Royal Ward, Present spire ramp reaches the hall), Crown doors (Present fused / Past open) |
| Floor 3 runtime + Last Crown | WORKING (bot-verified) | `src/enemies/LastCrown.ts`, `src/vfx/Spells.ts`; god bot fight: phase 2 at 26 s, phase 3 at 85 s, slips, blinks, wards/bindings broken by the bot's shifts, 0 errors; real-damage bot (never dodges/guards) dies every ~35–40 s and reached phase 2; checkpoint respawn resets the fight. **No human playtest yet** |
| Ending | WORKING | boss death → final slip to the Present → `Game.endGame()` card "THE CROWNHEART IS SILENT" (+ time / Echoes / shifts / deaths) |
| **Hero Great Sword combat (session 5)** | DONE, VERIFIED (numeric) | `dev/combatHarness.js` matrix: every route/branch below chains and connects on a dummy; skeleton hips scale constant 0.0100 in all 29 attack definitions; root speed ≤ 7 m/s in attacks (12.8 dodge) |
| **Crouch walk** | DONE, VERIFIED | planted-foot speed p25 0.04 m/s at 1.55 m/s body speed (was 1.55 = full slide); auto-crouch crawl verified on the F1 crawl line |
| **Asset lifecycle (session 3)** | DONE, VERIFIED | `src/assets/AssetManager.ts` (ref-counted scopes, shared in-flight loads, byte-weighted progress, disposal), `src/assets/GameAssets.ts` (every key + per-floor dependency lists from `src/data/floorManifests.json`). Scopes: `core` (hero, shared sounds), `ambience` (5 beds, skipped when muted), `floorN`. F1→F2→F1→F2 returns identical GL counts |
| **Loading screen** | DONE | `src/ui/LoadingScreen.ts`: initial + floor transitions; "LOADING CAER VEYR / ████░░ 82% / Preparing the Royal Floor — …"; real progress (bytes, then build, then GPU warm-up) |
| **In-place floor transitions** | DONE, VERIFIED | `Game.transitionTo(next)`: stop loop → retain shared keys → `unloadFloor()` → release old scope (disposes textures/geometries/materials/skeletons/bone textures/audio buffers only it used) → load+build+warm next → carry HP/charge. Duplicate calls share one promise. F1→F2 ≈ 2 s (was page reload 3.4 s + 6.4 s first-frame freeze) |
| **GPU warm-up** | DONE, VERIFIED | `src/assets/Warmup.ts` + warm kits in EnemyManager/Effects/Gore/Atmosphere + `src/vfx/ShadowDepth.ts`: 0 shader compiles and 0 texture uploads after the loading screen over a 342 s F1 autopilot run |
| **Pooling** | DONE | fissure remnants (4, pre-instantiated), arrows (16), glints, shift rings, afterimages (no per-dodge buffers), blood decals, gibs, smoke wisps |
| **KTX2 textures** | ADOPTED (default) | `tools/build_ktx2.mjs` → `public/assets/ktx2/**`; runtime prefers them, `?tex=jpg` forces the originals. See §10 benchmarks |
| **Profiler** | DONE | `src/game/Perf.ts` (per-frame step/render/GPU timer query, compile/upload attribution, spikes, long tasks); `Game.bench()` drives real frames in hidden tabs |
| **Portrait jam presentation (session 4)** | DONE, VERIFIED | `Platform.ts` stage 9:21..9:16; desktop 1024×768 → centred 432×768 stage, kbm, no touch HUD; phone emulation 375×812 → full stage, touch HUD, DPR 2 (1.2 MP), 1024 shadows; rotate overlay on a landscape handheld (pauses); `?view=wide` unchanged |
| **Touch controls** | DONE, VERIFIED (emulated multitouch) | `src/ui/TouchControls.ts`; scripted PointerEvent tests: stick walk 3.1 m/s / rim sprint 6.3 m/s, look while moving, attack with a 3rd finger, lifting one finger keeps the others, Guard→slide = BASH, Guard + Heavy = KICK, directional dodge, hold SHIFT → Present→Past (ring fills, charge spent), pause button → card → tap resumes, interact pill at CP1 activates the sigil, no stuck holds; auto-crouch through both F1 crawl spots. **Not yet tried on a real phone.** |
| **Portrait camera** | DONE, VERIFIED | `CameraRig` profiles; screenshots: spawn, E1 fight, crawl tunnel, Great Hall; ceiling/roof clearance fixes |
| **Combat feel + new L1** | DONE, VERIFIED (numeric) | L1 contact 0.13 s after press; chain hit every 0.38–0.47 s; L1→Heavy continues into F1c; per-swing hit registry (fixed repeat-swing whiffs) |
| **Archers** | DONE, VERIFIED | first arrow 1.0 s after sight at 27 m; straight runs hit 4/8, juking 0/8, guard blocks all, cover (gallery slab) 0 shots |
| **Ledge-safe dodge/knockback** | DONE, VERIFIED | F2 real-damage 0 deaths (was 6) |
| **itch.io build** | DONE, VERIFIED | `vite base './'`, `npm run package:itch` → `build/caer-veyr-itch.zip` (83 MB, 338 files); served from `/html/12345/`: 0 failed requests, F1→F2 2.1 s |
| **Mobile quality tier** | DONE, VERIFIED | `Platform.quality`: handheld = 6 point lights + 1024 shadows (−20–25 % GPU at 720×1280) |
| **Git** | DONE | local repo, pushed to github.com/Arjun0014/castle-game `main` as Arjun0014 (see §10) |
| **Soft combat camera (s7)** | DONE, VERIFIED (numeric, emulated touch) | `src/combat/TargetAssist.ts`; touch only (`?camassist=0\|1` pins); an off-screen attacker 126° away is eased into view in ≈ 0.8 s, max 2.4 rad/s, no snap; manual swipe = full control for 1.3 s |
| **Attack magnetism (s7)** | DONE, VERIFIED | Hollow 3.4 m away at 60°: turned in 0.05 s, closed 1.07 m, hit at 0.15 s; LOS-gated, stick-aware, sticky through combos |
| **Touch HUD redesign (s7)** | DONE, VERIFIED (emulated multitouch) | crescent layout with a free camera pocket; lock-on removed from touch; 6 two-finger combos pass (see §10 s7) |
| **Blood Sigils (s7)** | DONE, VERIFIED | card "BLOOD SIGIL / Activate Checkpoint" (E on desktop, tap on touch), beacon column, 30 s per-sigil cooldown (no banner; a 1.2 s note if pressed), refuses while engaged Echoes are near; F2 CP4 removed, F3 CP1 moved |
| **Objectives + tutorials (s7)** | DONE, VERIFIED (scripted) | `src/game/Objectives.ts` + `src/data/objectives.ts` (all 3 floors); persistent move/combat/sigil/resonance/shift tutorials |
| **Heroine voice (s7)** | DONE, VERIFIED (bot + Scribe QA; not heard by a human) | 99 lines, `src/audio/Dialogue.ts`, `docs/DIALOGUE.md` |
| **Enemy navigation (s7)** | DONE, VERIFIED | baked grids + A*; F1 god run 0 stall events, F2 3 blips |
| **Floor 2 variety (s7)** | DONE, VERIFIED (god run) | Remnants from mid-floor + mixed compositions |
| **Enemy stuck fixes (s8)** | DONE, VERIFIED (numeric) | nav grid NAV3 cliff masks, island spawns, wave rule, fair slots, hold idle, flyer LOS/route (§10 s8) |
| **T-pose cleanup (s8)** | DONE, VERIFIED | other-memory Echoes never drawn; encounter-end collapse vanishes unwoken/other-memory bodies; pose safety net |
| **No monsters in the Past (s8)** | DONE, VERIFIED | F1/F2 data clean (audited); fissure / boss adds in the Past = `remnant_guard` (knight rig); F3 E0 remapped |
| **Touch HUD v2 (s8)** | DONE, VERIFIED (emulated 375×812) | heraldic SVG seals, no Dodge, empty lower-right pocket, hold rings; real phone NOT tried |
| **Floor rewards (s8)** | DONE, VERIFIED (numeric + screenshots) | `combat/Abilities.ts`: Crownbreaker (F2+), Whirlwind (F3); reveal + voice + tip; persistence F1→F2→F3 |
| **Cinematic finishers (s8)** | DONE, VERIFIED (numeric + portrait screenshots) | `combat/Finishers.ts`: stab / frenzy / kick, safety checks, exactly-once credit |
| **Dev warps (s8)** | DONE (dev server only) | `game/DevStart.ts`: `?floor=N`, `?at=<warp>`; stripped from production builds (verified) |
| **Finishers everywhere (s9)** | DONE, VERIFIED (probes + F1 god run) | `combat/Finishers.ts`: 5 variants, mid-fight + last-Echo, others hold back; F1 bot run 58 kills -> 19 finishers |
| **Touch camera (s9)** | DONE, VERIFIED (emulated 375x812) | pocket ~40 % larger, gain 5.2 rad/stage-width + flick acceleration; 100 px slow swipe 60°, fast 96° (before 40°) |
| **Crypt water (s9)** | DONE (numeric; NOT heard by a human) | `amb_drips` low-passed, -21 dB (was 11 dB hotter than every bed), depth ramp, combat duck |
| **New monsters (s9)** | DONE, VERIFIED (probes on F1 + F2 real encounters) | `enemies/Monsters.ts`: goblin / bat / widow (+ widowling) / lamia brains; KTX2 GLBs; 12 CC0 sounds |
| **Mini-bosses (s9)** | DONE; Gutter King + Weeping Mother VERIFIED by bot, the Maw NOT fought yet | F2 E4 THE GUTTER KING, F2 E2b THE WEEPING MOTHER (optional lair), F3 E5 THE MAW OF THE CROWNHEART |
| **Floor 3 v3 (s9)** | BUILT, loads, boss reveal VERIFIED; full playthrough NOT done | `tools/blender/floor03_layout.py` v3 -> floor03*.glb (20k tris, 0 issues), NAV3 baked |
| **King's lift F2->F3 (s9)** | BUILT; NOT yet played through in the browser | `levels/Lift.ts`, F2 `lift` marker (bell chamber shaft), F3 arrival shot |

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

- `platform/Platform.ts` — view profile (`portrait`/`wide`), input mode (`kbm`/`touch`, hybrid switching), handheld
  detection, portrait stage layout + rotate overlay, fullscreen/orientation lock, haptics, load-time quality tier.
- `ui/TouchControls.ts` — touch HUD (joystick, look, action arc, Shift ring, lock, interact pill, pause).
  `ui/Hints.ts` — input-aware control hints (touch wording for key-based level prompts by prompt id).
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
- Session 9: `enemies/Monsters.ts` (Goblin / Bat / Widow / Lamia brains + MonsterFX pools: web globs, warning rings,
  silk threads), Enemy hooks `brainThink` / `brainSpecial` / `afterAnimate` / `onAttackEnd`, `flyWant/flyRate`,
  `floating`, ctx `hold` (finishers) / `playerAttack` / `playerAirborne`; `EnemyManager.devSpawn`, `bestiary`, BOSS_SUB;
  `levels/Lift.ts` (the King's lift); `vfx/Crownheart.ts` (the heart + AbyssEmbers); `FloorDef.env` / `noSky` /
  `epigraph`; `Game.envFor`, `leaveFloor`, `arrivedByLift`, `bestiarySeen`; `Player.webT`; `TouchControls.flushLook`.
  Pipeline: `tools/blender/build_monsters.py` (`npm run assets:monsters`: goblin retarget + bat/widow/lamia copies),
  `build_ktx2.mjs` GLB list + per-GLB cap, `build_audio.py` monster sounds. Dev: `dev/monsterProbe.js`
  (`spawn/fight/duel/brawl/all/shot`, `?monsters` preloads the rigs on any floor), `dev/monsterLab.html?f=<glb>`.
- Session 8: `combat/Abilities.ts` (floor rewards: ids, floor gating, hold threshold, measured spin-yaw tables),
  `combat/Finishers.ts` (cinematic last-enemy finishers), `game/DevStart.ts` (dev-only `?floor` / `?at` warps),
  `CameraRig.cine` (cinematic camera override), `NavGrid` NAV3 (cliff masks, `reachableCount`), `EnemyTypes`
  `remnant_guard` + `PAST_COUNTERPART`; dev modules `dev/{enemyProbe,abilityProbe,finisherProbe,regression}.js`.
  Nav bins MUST be rebaked (`npm run assets:nav`) after any floor GLB rebuild — the runtime now requires NAV3.
- Session 7: `combat/TargetAssist.ts` (soft camera + magnetism), `game/Signals.ts` (gameplay event bus),
  `game/Objectives.ts` + `data/objectives.ts`, `audio/Dialogue.ts` + `data/dialogue.json` + `data/voiceManifest.json`
  (generated), `enemies/NavGrid.ts` + `public/assets/levels/floorNN_nav.bin` (generated by `npm run assets:nav` =
  `tools/build_navgrid.mjs`; RE-RUN AFTER ANY FLOOR GLB REBUILD), `tools/voice/*` (el.mjs client, audition.mjs,
  gen_voice.mjs, build_voice.py, qa_voice.mjs, analyze.py), voice sources `assets/audio/voice/{auditions,batches}`,
  runtime `public/assets/voice/*.ogg`. Asset keys: `nav:N` (floor scope), `vo:<line>` (scopes vo-core / floorN / voN).
- Session 5: `enemies/LastCrown.ts` (Floor 3 mage boss, extends Enemy), `vfx/Spells.ts` (pooled boss spells + warm kit),
  `data/bossAnimations.json` (generated), `tools/blender/{inspect_pack,build_lastcrown,floor03_layout,build_floor03}.py`,
  `tools/contact_sheet.py`, dev modules `dev/combatHarness.js` (hero routes, parry, execution, crouch foot-slide, auto-crouch)
  and `dev/bossBot.js` (Last Crown fight bot): `const h = await import('/dev/combatHarness.js'); await h.install(); h.matrix()`.
  Floor 3 build: `blender --background --factory-startup --python tools/blender/build_floor03.py` (run Blender directly).
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

**Desktop / laptop (keyboard + mouse, portrait or wide):** WASD move · mouse look (pointer lock) · Shift tap dodge (fires
on release < 0.22 s) / hold sprint · Space jump · C crouch (toggle) · LMB light · RMB heavy · hold Q guard (press just
before a hit = parry) · Q+LMB shield bash · Q+RMB or F kick · R hold 2.4 s to shift · E interact (sigils, memory traces) ·
Tab or MMB lock-on · Esc pause (click/Esc resumes) · M mute · backquote debug overlay · F9 collision view.
Session 8: hold RMB = Crownbreaker (from Floor 2), hold LMB = Whirlwind (Floor 3).

**Touch (handhelds; `?input=touch`), session 8 layout** (centre and diameter in u = stage width/400, from the
stage's bottom-right; `style.css` `.t-*`): ATTACK ⌀92 (60, 196) · JUMP ⌀76 (58, 302) · HEAVY ⌀70 (148, 166) ·
GUARD ⌀66 (190, 74) · SHIFT lozenge ⌀54 (150, 276). **No Dodge button on touch** (desktop keeps Shift-tap dodge).
The lower-right corner (≈ 105×140 u under Attack, right of Guard) is EMPTY for camera swipes (faint LOOK hint until
~900 px dragged). Joystick zone = left 46 % × lower 58 % (floating, rim = sprint); drag anywhere else = camera.
Buttons are heraldic SVG seals (aged-gold rim + device: battlements on Attack, rivets on Heavy, bead ring on Guard,
arrow points on Jump; enamel field per role; Shift = azure lozenge). **Hold feedback:** Attack/Heavy show a gold arc
filling over the 0.28 s hold threshold once their hold move is unlocked, solid while the Whirlwind spins (draining
over 5 s) / the Crownbreaker charges; a gold "HOLD" tag + breathing rim while its unlock tip is pending. Guard +
Attack = bash (second finger or slide), Guard + Heavy = kick; auto-crouch; interact card at 372 u; pause top-right.

**Floor rewards (session 8, `combat/Abilities.ts`):** Floor 1 start: none · Floor 2: **CROWNBREAKER** · Floor 3:
+ **WHIRLWIND**. HOLD HEAVY (RMB / touch Heavy held ≥ 0.28 s) turns the opening heavy (H1) into the Crownbreaker:
blade raised (hyper armour), charge up to 1 s while held, release (or full charge) = kneeling plunge + shockwave,
radial 3.6 m + 2.2 m at full charge, damage 46 × (1 + charge) falling to 55 % at the rim, knockdown, guard break,
+10 resonance on hit; H2 → H3's charge is also gated by it. HOLD LIGHT (LMB / touch Attack) turns a light attack into
the Whirlwind: out of L1 it continues L1's own clip into its spin, then chains real Great Sword spins (WHIRL_A
gs_spin_double 0.1–1.0 · WHIRL_C gs_rampage 1.95–3.1 · WHIRL_W atk_whirlwind 1.6–2.6; hip yaw measured, root yaw
bridged, outgoing clip frozen on a 0.05 s seam) while held, max 5 s real time, drifting 2.4 m/s with the stick;
2 radial hits per turn (9 dmg, 16 poise, outward knock), hyper armour vs light hits, dodge/guard cancel; release = the
overhead finish (WHIRL_END, 24 dmg, knockdown); 2.5 s cooldown. Taps stay L1 / H1.

**Cinematic finishers (session 8, `combat/Finishers.ts`):** see §10 s8.

Combo graph (session 5, `src/combat/CombatData.ts` header): **Route A** L1 whirlwind slash → L2 rising cut → L3 lunge
cut → L4 advancing sweep → **L5 two-handed cleave** (2 hits) → L1. **Route B ("pause" combo: a light press ≥ 0.25 s
after the combo window, up to 0.5 s after the attack ends):** L1‥B2 quick cut → B3 low sweep → **B4 spin double
(finisher)**; L2‥B3, L3‥B4. **Heavy endpoints:** L1+H F1c · L2+H F1 · L3+H **F3 high spin** · L4+H F2 leap slam ·
L5+H **F4 rampage** (3 cuts, 3 m) · B2+H F2 · B3+H **F5 leaping double spin**. **Heavy chain:** H1 spin slash → H2 jump
spin → **H3 Crownbreaker** (hold heavy: the sword stays raised up to 1.2 s; release = plunge shockwave, damage/reach ×
up to 2, guard break). **Contextual:** sprint+L **slide cut**, sprint+H **leaping double spin**, dodge→L lunge cut,
dodge→H high spin, air attack, crouch L → **two-handed crouch sweep**, kick → **spinning kick**, guard+L shield bash,
**parry → L riposte** (two-handed cleave, 0.75 s window) / parry → H high spin, heavy beside a staggered non-boss enemy
≤ 45 % HP = **EXECUTION** (plunge, 95). Guard is now the two-handed **sword guard** (squares up to the blow).
A parry staggers the attacker and grants +12 resonance.

## Testing hooks

- **Automation mute:** `?mute` (also implied by `?autopilot`, `?bench`, `navigator.webdriver`) = silent, ambience not
  decoded. Normal URLs play the full mix. `M` toggles mute in game.
- `?tex=jpg` → original JPEG/PNG textures instead of KTX2 (A/B).
- **Dev floor / fight shortcuts (session 8, `src/game/DevStart.ts`; DEV SERVER ONLY — `import.meta.env.DEV`; production
  builds ignore them and always start at Floor 1, verified in the bundle):**
  - `http://localhost:5173/?floor=1` · `?floor=2` · `?floor=3` — floor start with a real player's progression there
    (shift unlocked, ≥ 100 Resonance on F2/F3, floor rewards F2: Crownbreaker, F3: both, Floor 1 basics learned).
  - `?at=ward` (F1 Inner Ward, Past, E3) · `?at=barracks` (F1 barracks, Present, E5 Hollow Warden) · `?at=elites` (F1 W
    gallery, Past, E9 Royal Wardens) · `?at=chapel` (F1 chapel, Past, E10) · `?at=warden` (F1 Great Hall, E13 Gate Warden)
    · `?at=range` (F2 wardens' range, Present, E4) · `?at=kingsguard` (F2 King's apartments, E10 Kingsguard Captain)
    · `?at=lastcrown` (F3 the doors of the Crown). Each clears the encounters before it, sets the needed fracture flags
    (FR1 for the Kingsguard), anchors its checkpoint, picks the right memory, 200 Resonance.
  - Add `&autostart` to skip the title card, `&mute`, `&input=touch`, `&view=wide` as usual.
- **Session 8 regression suite:** `http://localhost:5173/?mute&autostart&input=touch` at 375×812, console:
  `const R = await import('/dev/regression.js'); await R.run()` → 43 PASS/FAIL rows (walks F1 → F2 → F3 in place).
  Probes: `dev/enemyProbe.js` (stall scenarios + global stall watcher), `dev/abilityProbe.js`, `dev/finisherProbe.js`.
- **`?view=wide`** = internal widescreen build (original camera + HUD). **`?input=touch|kbm`** pins the input mode.
  **`?quality=high|mobile`** pins the render tier. `__platform` = the Platform singleton.
- **Phone on the LAN:** `npm run dev:lan` (Vite on 0.0.0.0:5173) → open `http://192.168.1.39:5173/` on the phone (same
  Wi-Fi; allow Node through the Windows firewall on first run). Production check: `npm run build && npm run preview:lan`
  → `http://192.168.1.39:4173/`.
- **itch.io:** `npm run package:itch` → `build/caer-veyr-itch.zip`; upload as HTML5, "This file will be played in the
  browser", viewport e.g. 540×960 (or 720×1280), tick "Mobile friendly" (orientation: portrait) and "Fullscreen button".
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

**Session 9 follow-ups (do these first — the rest of the session-9 brief):**
1. **Loading transitions (brief #6):** `ui/LoadingScreen.ts` still shows the block bar. Redesign it (chapter card with the
   floor's `epigraph` from `levels/Floors.ts`, a real-progress sigil ring / thin gilt line, no fake progress).
2. **Main menu (brief #9):** replace the title card in `index.html` / `LoadingScreen.showInitial` with a real menu
   (New Game -> Guided / Minimal, Continue if meaningful, Controls, Credits — CC-BY credits for every Sketchfab model:
   the four monster GLBs' `asset.extras` + knight/necromorph/night monster; audio packs in SOURCES.md — Settings:
   volume/voice). Integrate the opening film through `import.meta.glob('./ui/Intro.ts')` so the pushed tree builds
   without the other session's uncommitted `Intro.ts` (never commit their files: `src/ui/Intro.ts`,
   `src/data/opening.json`, `public/cinematic/`, `tools/cinematic/`, `docs/CINEMATIC*.md`, `assets/audio/cinematic/`, the
   intro hunks of `main.ts` / `style.css`, `Audio.unlock`, `package.json` fonts, `.gitignore`, CONTEXT film sections).
3. **Guided Floor 1 tutorial (brief #10):** from the start of F1 to the end of the first crouch section; Guided vs
   Minimal (minimal keeps objectives/navigation/shift instructions). Build on `game/Objectives.ts` (persistent teach
   cards) + `data/objectives.ts` F1 + the heroine's lines; brief slow-mo for first introductions allowed.
4. **Idle / stuck enemies audit (brief #8):** run `dev/enemyProbe.js` on all three floors (archers that never shoot,
   slot waiters); F3 is new — run a full F3 bot playthrough (`M.brawl` per encounter or an AutoPilot ROUTES[3]).
5. **Play Floor 2 -> 3 in the browser:** bell chamber -> lift -> loading -> arrival shot -> F3 start (untested end to end;
   the lift's dynamic collider, `Game.leaveFloor`, `arrivedByLift`, scripted state reset in `unloadFloor`).
6. **Floor 3 playthrough:** every weave (Hall chasm/grille, ossuary bridges, cistern doors, ramp gap + Past gate, Threshold
   ward) walked in both memories; the Maw fight; the Last Crown fight in the new arena (wedge holes, blink points r 12.5,
   arena r 14.5, bats out of the heart, adds at 35 %), the death shot + heart shatter + ending card.
7. Floor 3 Present is dark by design — check readability on a phone (env overrides in `levels/Floors.ts`).
8. `docs/LEVEL_03_BLUEPRINT.md` still describes v2.0 in its body; the authoritative v3 layout is
   `tools/blender/floor03_layout.py` (header + section comments). Rewrite the blueprint text.

**Session 8 follow-ups (do these first):**
1. **Real phone** (`npm run dev:lan`): the v2 touch layout (thumb reach, pocket size, hold vs tap), finishers in
   portrait, Whirlwind drift speed; tune positions in `style.css` `.t-*`, `HOLD_THRESHOLD` / `WHIRL_*` in
   `combat/Abilities.ts`, finisher `chance`/`cooldown` in `combat/Finishers.ts`.
2. Listen to `ab_crownbreaker` / `ab_whirlwind` (and Scribe-QA them: `node tools/voice/qa_voice.mjs`).
3. Layout data: move the islands the runtime now relocates (F1 enemy_013/014 inside the west tents, F2 enemy_006,
   enemy_046/047) and the 7 earlier `spawnFixes` into the layout scripts; F3 E0's Past Remnants → `remnant_guard`.
4. Floor 3 has no autopilot route yet (the regression suite covers its rewards; `dev/bossBot.js` the fight).

**Session 7 follow-ups:**
1. **Real phone** (`npm run dev:lan`): soft camera feel (rates in `TargetAssist.cameraYaw`: comfort band 62 % of the
   half-FOV, 1.6 / 2.4 rad/s, manual hold 1.3 s), attack magnetism feel (MAGNET_SPEED / MAGNET_BUDGET in Player.ts),
   thumb reach of the new crescent (positions in `style.css` `.t-*`), whether the lower-right pocket is big enough.
2. **Listen to the heroine** in play: loudness vs SFX (voice bus 1.05, speech −19 dBFS RMS, duck amb 50 % / sfx 78 %),
   delivery of the key lines (f1_arrive, tr2_t3, tr2_t4, boss_lc_*). Retakes: `node tools/voice/gen_voice.mjs --redo id`
   (≈ 1,150 ElevenLabs credits left this month; resets 2026-10-29).
3. Voice is in English only; subtitles always on. A settings toggle (subtitles / voice volume) does not exist yet.
4. Autopilot ROUTES[3] still missing (Floor 3 has `autopilot: false`).
5. Layout scripts: 7 enemy spawn points were moved at runtime off unwalkable slots (see `EnemyManager.spawnFixes`,
   F1: enemy_002/068/069/071/075, F2: enemy_023/029) — move them in `floor0N_layout.py` so the fix is in the data.

1. **Human playtest of the Last Crown** (desktop + phone): damage values (bolt 15, fan 10×5, wave 18, repel 22, rune 26,
   nova 34, dark burst 38, orb 40, binding 45, beam 13–16/0.3 s), cast gaps per phase (`PHASE_GAP`), ward/slip/binding
   timers, whether the ward prompt teaches "shift to break" clearly enough. Consider making the Past upper stair show the
   ward from closer (the player stops 0.4 m below it).
2. **Human playtest of the new hero combos**: pause-route timing (`PAUSE_DELAY` 0.25 s, `PAUSE_GRACE` 0.5 s), riposte
   window, Crownbreaker charge, execution frequency.
3. **AutoPilot ROUTES[3]** (Floor 3 has `autopilot: false`); `dev/bossBot.js` covers the fight only.
4. Real-phone test (`npm run dev:lan`), audio mix by ear (incl. the 12 new ElevenLabs boss sounds).
5. Floor 2 visual pass with the session-3 textures; new monster GLBs still unintegrated (bat/spider/goblin/blob).

(Session 4's Floor 3 build plan, kept for history — superseded by blueprint v2.0 §M and done in session 5:)
1. **Build Floor 3** from `docs/LEVEL_03_BLUEPRINT.md` §N, in order:
   a. `tools/blender/floor03_layout.py` + `build_floor03.py` (copy the floor02 driver; run Blender directly — the npm
      script hit cmd.exe quoting before) → `public/assets/levels/floor03.glb` + `floor03_collision.glb`; QA renders.
   b. `Floors.ts` entry 3 + Floor 2 `next: 3`; `GameAssets.floorKeys(3)` incl. `glb:enemy:boss` (normalise like the
      ghost: 2× scale, feet at origin); `npm run assets:manifest`; KTX2 for any new textures.
   c. `src/enemies/LastCrown.ts` boss controller (phases, ward + 4 Sealbearer fractures, Decree ring, Crown beam, void
      lances via the arrow pool, pooled summons, forced slips with safe-footing wait, binding tether broken by a
      state change) + boss bar "THE LAST CROWN"; warm-up kit for its VFX materials.
   d. Ending sequence + card for the last floor (`Game.finish`).
   e. `AutoPilot` `ROUTES[3]` + boss tick; verify god + real damage; floor 2 → 3 transition + residency.
2. **Real-phone test by a human** (`npm run dev:lan` → http://192.168.1.39:5173/): touch sizes (`--tu`), look
   sensitivity (`2.6 / stage width` rad/px), rim-sprint threshold, haptics, frame rate on a mid-range phone.
3. Listen to the mix (human): impact layers were re-balanced by weight (`Audio.hitEnemy`).
4. Floor 2 visual pass with the new textures (plaster, mossy rock, aerial rocks, facade glass).
5. New enemy GLBs (bat, spider, goblin, blob) not integrated; the bat is the cheapest (flying AI + flap loop).
6. Floor 1 leftovers: wall detailing, baked AO.

---

# 9. Assets / Textures Needed From User

**New in session 7:**
- **ElevenLabs credits:** the free tier had ≈ 7,000 credits when voice work started; ≈ 1,150 remain. Any more lines
  (more idle/combat variety, a voiced Queen's letter, Aldren's voice for the Last Crown) need a paid tier or the
  monthly reset. Library voices and voice design are blocked on the free tier (402/403).
- **Heroine effort sounds** (attack grunts, hurt, death, landing) in the same voice would tie the performance together
  — generate with ElevenLabs sound effects or record.
- **Distinct Floor 2/3 enemy models:** Floor 3's roster is the same four archetypes as Floor 2 (+ the boss); real
  variety needs new rigs with attack/hit/death clips (the unused spider/goblin/blob GLBs ship only one clip each).

These would materially improve the game and are best sourced manually (licensing/quality judgement by ear/eye):

- ~~Final boss animation~~ — **solved in session 5** by the Pro Magic Pack (a full mage set). Nice-to-have for the
  Last Crown: a **teleport / vanish** clip and a **levitating idle** (she hovers over the Present holes), a **kneel-to-death**
  that ends lying on the lens, a crown/diadem prop.
- **Hero:** a roll clip (dodge is still a dash); the Great Sword pack's clips are two-handed — a one-handed *fast
  horizontal* and *backhand* on the Sword & Shield rig would still add variety to route A.
- **Audio (boss):** a real choir/drone bed for the Crown (the ElevenLabs `crown_resonance` is a one-shot).
- **Enemy animation for the new monsters:** the spider/goblin/blob each ship one clip (walk / idle / idle). Attack,
  hit, death clips (or the source rigs so Mixamo clips can be retargeted) are needed before they can fight.
- **Audio:** human combat vocal efforts/grunts/death cries (royal guards + hero); a real bow draw/release/arrow set;
  distant crowd / war drums for Past halls; a choir/drone bed for the finale and the Crownheart; heavier plate-armour
  foley; stone-scrape / masonry-shift layers for the time shift. (Gore/kill/shatter layers now come from ElevenLabs.)
- **Characters/animations:** a spear set for the knight;
  **an archer melee/shove or a quick point-blank shot clip** and **archer hit/death clips on the archer rig** (the archer
  reuses the hero's retargeted hit/death clips); **2–3 more light sword slashes** on the same Mixamo rig (the chain now
  uses whirlwind-opening → rising cut → lunge cut → advancing sweep; a fast horizontal and a fast backhand would let the
  chain vary more).
- **Audio (combat feel):** 3–5 heavier sword-on-flesh "thunk" impacts and sword-on-plate clangs with a short tail,
  a parry "ring" with a long decay, an arrow whizz-by (for near misses), a bow creak for the archers' aim.
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
  Done session 5: `hero.glb` (73 clips) and `lastcrown.glb` (KTX2). **Still to convert (when used):** the 4 new monster GLBs, the new
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

### Session 9 (2026-09-29) — finishers, touch camera, water, monsters + mini-bosses, Floor 3 rebuilt, the lift

Commits (pushed to Arjun0014/castle-game main as Arjun0014): `7181783` finishers + touch camera + crypt water ·
`c12165f` the monster roster + Floor 2 encounters · `700efeb` Floor 3 v3 + the King's lift + the heart + boss reveal ·
this CONTEXT commit. Another session's opening-film work stayed uncommitted every time (hunk/blob staging; each staged
tree was type-checked and production-built on its own: scratchpad `check_staged.ps1`).

**1. Finishers** (`combat/Finishers.ts`): any lethal blow (combos included) can become one. Last Echo 90 % (3 s after
the previous one), mid-fight 34 % + 14 % per normal kill since the last finisher, max 80 %, 6 s cooldown; never AoE
(Whirlwind, Crownbreaker), executions, flyers, bosses, the lamia. While one plays every other Echo holds (EnemyCtx.hold:
no new blows, no approach, archers lower their bows), the hero gets 0.45 s grace after. Variants dealt from a shuffle
bag (a variant refused for safety stays first in the bag): stab, frenzy, kick, **headsman** (low sweep to the knees,
spinning neck cut, blood fountain, low front shot), **passing cut** (knee-slide through the foe along a checked lane,
it falls a beat later; camera ahead of her line). Slash ribbon VFX (warmed). Beasts (widow) get stab + passing only.
Verified: all 5 play, exactly-once credit, camera never inside/behind geometry (probe), mid-fight holds (0 attacks
started during), wall cases refuse correctly; F1 god autopilot to t = 323 s: 58 kills, 19 finishers (14 mid-fight).
**2. Touch camera** (`ui/TouchControls.ts`, `style.css .t-*`): Attack ⌀90 (64, 228) · Jump ⌀74 (60, 334) · Heavy ⌀70
(160, 198) · Guard ⌀66 (210, 112) · Shift ⌀54 (156, 304); the free pocket ≈ 177 × 163 u (was ≈ 150 × 130). Look gain
5.2 rad per stage width + up to 2× for fast flicks, 30 ms ease on real time. Soft camera / manual priority /
magnetism untouched.
**3. Crypt water:** the loud "water" in Floor 1 was `amb_drips` (loop_water_02, broadband, RMS −17.7 dB vs −28 for the
other beds) at full level whenever y < −2.5 (crypt, excavation). Now high/low-passed (110 Hz / 1.7 kHz), −21 dB, a depth
ramp (y −1.5 → −4.5) and ducked in combat. Not heard by a human yet.
**4. Monsters** (`enemies/Monsters.ts`, assets §4): goblin = the Sketchfab goblin retargeted with 25 hero clips
(`build_monsters.py`, 1.32 m, scimitar kept); bat / widow / lamia = source copies normalised at load
(`GameAssets.NORMALISE`: height, facing, first-frame bounds; lamia spec-gloss → base colour, goblin unlit → lit).
Roles: goblin skirmisher (zig-zag, jump-spin leap 3.4–7.5 m, cuts, hop back, sidestep heavies, reinforcements drop from
above); bat swarm (wall-aware orbit, ≤ 2 swoop at once, parried = drops stunned, A* when blind); Widow (ceiling drop on
a thread, skitter, web spit → `Player.webT` slow 2.2 s, pounce, jab; widowlings); lamia (360° ankle sweep with a floor
ring — jump/dodge, guard-breaking maw lunge, coil guard vs frontal hits). Mini-bosses: **THE GUTTER KING** (goblin ×1.6,
600 HP, war cry at 60 % frenzies the pack), **THE WEEPING MOTHER** (widow ×1.6, 650 HP, volleys, brood hatches at 65/35),
**THE MAW OF THE CROWNHEART** (lamia ×1.4, 900 HP, bats from its maw). First sight of each kind shows a bestiary card.
Floor 2: bats in E1 + the ridge E6, goblins in E3p, the Gutter King in E4, a Widow ambush + brood in E9, the Weeping
Mother in the optional Queen's Solar E2b. Verified (monsterProbe + brawl bot on the real F2 fights): goblin duel 2.8 s,
bats 6 bites/12 s, Widow webs + pounce + jab, Gutter King fight 40 s (3 waves, 10 kills, 181 damage taken), Weeping
Mother 24 s → HP raised to 650.
**5. Floor 3 rebuilt** (`floor03_layout.py` v3, header describes every space; blueprint text still v2 — §8): the King's
lift foot (CP1, F1) → Hall of Roots (E1 Present goblins/bats/Widow; Present chasm y 29–40 → Past floor; E2 Past royal
wardens; Past Royal Grille y 51 → Present fallen; F2) → ossuary bridges over a cavern (E3 Present Widow + bats + brood on
P1; Past-only bridge P1→P2 with walls; E4 Past guard on P2; Present fallen column P2→P3; CP2 on P3; F3) → the cistern
(E5 the Maw; south door warded in the Past, north door crystal-fused in the Present) → the Great Descent (spiral r 6.5–13
round the heart's shaft, z 0 → −16 over 450°; E6 Present goblins/bats, Present ramp gap 40–62°, E7 Past wardens/guards,
Past iron gate 222°, E8 Present lamia + Widows + Remnants; F4, F5) → the Threshold (CP3, the empty throne, Past-warded
Crown doors) → a bridge onto the Crownheart ring (r 17, lens r 4.2, pillars at r 11, Present wedge holes r 6–13.5 at
45/135/225/315°). Every drop is an `abyss`: black shaft walls, broken rims, lights under the rims, embers rising
(`AbyssEmbers`); no flat red floor anywhere. Floor lighting overrides (darker red-black Present, warm Past), no sky.
Dev warps: `?at=hall3 | maw | descent | lastcrown`.
**6. The finale:** the Crownheart (`vfx/Crownheart.ts`) beats over the arena (colour per phase, drives the level's own
crown light — no new light); the Last Crown is 3.4 m, keeps to r 14.5 (lens marker), is revealed descending out of the
heart (4.6 s shot, title, sting, then her line), calls bats out of the heart at 65 % and goblins + the brood at 35 %;
her death shot tilts up as the heart convulses and shatters and the chamber goes dark. Verified: reveal plays and hands
control back (`?at=lastcrown`, step onto the ring). The full fight and the ending in the new arena are NOT yet played.
**7. The King's lift** (`levels/Lift.ts`): Floor 2's bell chamber no longer opens onto sky; the exit volume is out of
reach; the cage hangs in the conduit shaft (dynamic collider), "THE KING'S LIFT / Descend to the Crownheart", 7.2 s
descent, fade, `Game.leaveFloor()` → the normal transition; Floor 3 plays the arrival shot. NOT yet played end to end.

**Tests run:** tsc + vite build on every staged tree; finisher probes (5 variants, walls, mid-fight); F1 god autopilot
with finishers (to t = 323 s, 0 errors); touch layout + swipe measurements (375×812); monster probes (fight / duel) for
every monster on F1 and real F2 encounters (E4, E2b) with the brawl bot; F3 load (55 enemies, 0 spawn fixes), portrait
screenshots of F3 Past/Present, boss reveal; Blender builds F2/F3 0 issues; NAV3 rebaked for F2 + F3.
**Needs a human / real phone:** the pocket + swipe speed, finisher frequency in real fights, the water bed by ear, the
monster sounds (generated by varispeed from CC0 packs, unheard), F3 readability in the dark, the lift, the whole finale.

### Session 8 (2026-09-29) — enemy robustness, touch HUD v2, floor rewards, cinematic finishers, dev warps

Commits (pushed to Arjun0014/castle-game main as Arjun0014): `ac09379` gameplay + assets (enemies, NAV3 rebake, touch
HUD v2, rewards, finishers, dev warps, 2 voice lines, dev test modules) · the following docs commit (this file,
DIALOGUE.md). The parallel session's opening-film work (`src/ui/Intro.ts`, `src/data/opening.json`, `tools/cinematic/`,
`public/cinematic/`, `docs/CINEMATIC*.md`, `assets/audio/cinematic/`, the intro hunks of `main.ts` / `style.css`,
`Audio.ts` unlock, `package.json` fonts, `SOURCES.md`) was NOT committed: `main.ts` and `style.css` were staged as
HEAD + this session's hunks only (blob-level), and the staged tree was typechecked + production-built on its own.
Line endings: this session's Python patches briefly rewrote some files as CRLF; all were restored to their committed
endings (the repo mixes CRLF and LF per file). The parallel session's untracked files were caught in one
normalisation pass and restored to CRLF (19 files that were CRLF) — content unchanged, only endings touched.

**1. Enemies — reproduced first, then fixed** (`dev/enemyProbe.js`: stall scenarios with a moving/standing hero +
a global stall watcher over autopilot runs).
- **T-pose Hollows** ("left standing after the mini-boss"): in the BOTH-memory boss fights (F1 E13 Gate Warden, F2 E10
  Kingsguard) the Present risers of waves 2–3 were woken while the hero fought in the Past; `activate()` made them
  visible, other-memory Echoes are never updated → bind pose; the boss's fall then `die()`d them without animation and
  they stood there for good (reproduced: 3 dead Hollows visible in the Past). Fix (`EnemyManager.update`, `Enemy`):
  an Echo of the other memory is never drawn (per-frame invariant; fissure Remnants too — they used to stay visible and
  frozen); a riser is posed on the frame it appears; the encounter-end collapse only collapses bodies on screen and
  `vanish()`es unwoken / other-memory ones; `die()` of a never-shown riser vanishes; safety net `posed`/`repose()`.
- **"Main hall shortly after the start" = the Inner Ward (E3):** the wave rule counted the two perched balcony
  archers, so the tent reinforcements never came (idle forever, E3 never cleared) — and they spawned INSIDE the tents'
  closed collision boxes. Fix: perched archers never hold back a wave; load-time island detection
  (`NavGrid.reachableCount` < 300 nodes → nearest spot ≤ 6 m that opens onto the floor; `spawnFixes`: F1 enemy_013/014
  2.07 m, F2 enemy_006 4.39 m, enemy_046/047 2.26 m).
- **"First mini-boss" = E10's Royal Warden (chapel)**: spawned on the 0.4 m altar dais and never left it (0 attacks
  in 30 s, strafing on the spot). Root cause, floor-wide: the capsule physics has **no step-up** (stairs are ramp
  wedges) yet NAV2 let enemies walk UP 0.45 m steps (straight into plinth skirts, daises, bunks), and the baker's
  0.45 m knee probe dropped the floor cells beside every low step, cutting a seam round the dais. **NAV3**
  (`tools/build_navgrid.mjs`, all floors rebaked): per-node CLIFF mask (a rise > 0.15 m per 0.1 m of travel), A* /
  clearLine never go up a cliff (down is fine), the knee probe ignores low step tops. The Warden now fights (7 attacks/30 s).
- Attack slots: fair queue (the longest waiter > 0.8 s goes next) — cost-2 elites starved behind re-queuing guards.
- Holding enemies (hero out of reach) stand in combat idle instead of running/strafing in place; a hero on a low prop
  within sword reach is still attacked (`inReach`); holders re-plan on a timer.
- Stall watchdog (`Enemy.navigate`): < 0.3 m in 1.5 s while chasing → forced A* route 3.5 s; a second stall nudges to
  the nearest open node (≤ 1.2 m, same level). Leash never while the hero is inside the enemy's own running fight;
  leashed members wake when she enters it. Ring back-off never walks into a wall/tent (circles instead).
- Wraiths: real line of sight; blind → follow the grid route under them through doors, give up after 4 s (drift home);
  they no longer sink into pits and "die" on their own (the whole E4 wave did over the Ward sinkhole) — only a knocked,
  reeling wraith sinks.
- Softlock refill: fissures refuse only when an engaged enemy that can reach/see her is near (`engagedNear`); idle
  Echoes a floor below + a blind perched archer used to block it (F2 G6 bot stuck at 96 Resonance).
- **Audit — no monsters in the Past:** F1 Past = guard / archer / royal_warden / muster / gate_warden (43 enemies),
  F2 Past = guard / archer / royal_warden / kingsguard (21): clean in data. Runtime sources fixed: fissure Echoes and
  the Last Crown's adds used the Hollow rig in either memory → in the Past they are `remnant_guard` (knight rig, echo
  motes, Remnant stats); `PAST_COUNTERPART` remaps any monster placed in the Past at spawn (F3 E0's two Past Remnants →
  remembered guards; logged in `EnemyManager.pastFixes`, expected empty on F1/F2).

**2. Touch HUD v2** (`ui/TouchControls.ts`, `style.css` touch block): §7 Controls. No Dodge on touch (tutorial stage,
T_COMBAT hint and title help updated; desktop dodge unchanged). Camera assist + attack magnetism untouched.

**3. Dev warps** (`game/DevStart.ts`, `main.ts`): §7 Testing hooks. Dev-server only; the production bundle contains
none of it (checked: `vite build`, 0 occurrences of the warp table).

**4–5. Floor rewards** (`combat/Abilities.ts`, `Player.checkHolds/beginWhirl/updateWhirl/endWhirl`, `CombatData`
CROWNBREAKER + WHIRL_*, `EnemyManager` shock fall-off, `Game.announceAbilities/crownbreakerImpact`): §7. The existing
H3 hold-charged plunge was promoted (not duplicated): gated behind the Floor 1 reward and made a neutral hold move.
Presentation: after the floor title (4.2 s) a gilded reveal ("THE CASTLE ANSWERS YOUR BLOOD / CROWNBREAKER / HOLD
HEAVY", 4.4 s, not modal), a shift-ring + resonance motes at her feet, one voice line (`ab_crownbreaker` /
`ab_whirlwind`, DIALOGUE.md), then a compact tip ("HOLD HEAVY — …", input-aware) + the button's HOLD tag until she has
performed it (`learned.crownbreaker/whirlwind`, kept across floors). Abilities = f(floor reached), so in-place
transitions, page reloads and dev starts agree. Whirlwind seam bug found and fixed while testing: overlay crossfades
decay exponentially, the previous spin kept ~20 % weight while still turning and the quaternion blend flipped once
they were > 180° apart (51° single-frame pops) → outgoing segment frozen on its yaw-matched pose, 0.05 s seams (max
step now 18°/frame = the clips' own spin speed). Cap measured in real (input) time: hit-stops no longer stretch it.

**6. Cinematic finishers** (`combat/Finishers.ts`; hooks: `EnemyManager.playerHitsEnemies` → `finisher.tryStart`,
`holdForFinisher`, `finisherKill`; `Player.scripted`; `CameraRig.cine`; `HUD.cinematic` letterbox; touch dims).
Only when the hero's blow kills the LAST living enemy of a proper encounter with every wave released (never tutorial
E1, fissure/boss adds, flyers, the Last Crown, between waves, or with another fight within 18 m); 55 % chance, 20 s
cooldown. Variants: **stab** (foe forced to its knees, over-the-shoulder, gs_plunge through it, 0.12 s stop + slow
breath), **frenzy** (gs_quick_cut → atk_chop → gs_cleave from an orbiting side shot; the overhead chop throws 18 gibs +
blood), **kick** (gs_cleave → atk_rising_cut → kick_front; fling power 1.1, the camera follows the body). Safety:
hero/foe footing, no void within a 1.4/2.4 m ring (walls allowed), unobstructed step-in ≤ 3.2 m, level ground, every
sampled camera position clear of geometry/ceilings with a clear line to the pair (mirrored side tried), kick needs no
wall within 1.6 m behind and ground at 2 / 3.5 / 5 m along the launch; else the next variant, else a normal kill.
Kill credit exactly once at the final blow (the foe stays alive in state 'finisher' so the encounter cannot clear
early). 2.5–2.9 s real time including slow motion; camera eases back (cineK) afterwards.

**Tests (session 8):**
- `dev/regression.js` (portrait touch 375×812, F1 → F2 → F3 in place): **43/43 PASS** after the fixes below it found
  (first run 34/43: harness ordering; one real ring back-off stall → fixed). Covers: E3 reinforcements + islands, E10
  Warden, hold idle, moving-hero stalls, T-pose (3 checks), no Past monsters F1/F2, Past fissure Echoes, touch layout
  (5 checks: buttons, sizes, no overlaps, empty pocket, thumb cluster), 3 finishers × (plays / exactly-once credit /
  camera safety + hand-back), wall + hole cases, not-last, desktop Shift-tap dodge, F2/F3 unlock + reveal + tip +
  persistence, Crownbreaker (charge, fall-off 72/61/51 at 1.6/3.2/4.8 m, tap stays H1), Whirlwind (5.0 s cap, 5 turns,
  max yaw step 18°, 143–158 damage per surrounding dummy, release ends it, tap stays L1).
- Floor 1 **god autopilot with finishers live: exit t = 295 s** (s7: 358 s), 68 kills, **0 stall events**, 2 legit
  holds; finishers played naturally (stab E5, frenzy E12). The same run continued through the real transition: **Floor 2
  god run reached its exit** (→ Floor 3 loaded in place), **0 stall events**, 11 legit holds, 0 deaths, 7 shifts;
  finishers stab (Remnant) + frenzy (guard); 0 visible unposed enemies at the end.
- Widescreen kbm 1024×768 (`?view=wide&input=kbm`): no touch HUD, Shift-tap dodge, tip bottom-centre with keyboard wording.
- Portrait screenshots: new HUD, reveal, Crownbreaker shockwave, Whirlwind trail + hold ring, each finisher mid-shot.
- `tsc --noEmit` PASS; `vite build` PASS (dev warps stripped).

**Needs a human / real phone:** thumb reach of the new layout (Attack at 196 u, Jump at 302 u), whether the camera
pocket is big enough, hold threshold 0.28 s vs taps on glass, Whirlwind/Crownbreaker balance (damage/cooldowns in
Abilities.ts / CombatData.ts), finisher frequency (55 %, 20 s) and camera comfort in portrait, the two new voice lines
by ear, and the finisher/ability sounds in the mix.

### Session 7 (2026-09-29) — mobile combat assist, touch HUD, sigils, onboarding, the heroine's voice, navigation

Commits (all pushed to Arjun0014/castle-game main): `3d1f7ce` combat assist + touch HUD + sigils + objectives ·
`072fe61` voice plan + 99 lines + Dialogue runtime/streaming · `d2e63cd` baked enemy navigation · `725869f` Floor 2
variety · `c69e291` sigil recovery note + calmer barks · final commit: voice eviction, wide tutorial position, CONTEXT.
A parallel session's uncommitted opening-film work (`src/ui/Intro.ts`, `src/data/opening.json`, `tools/cinematic/`,
`docs/CINEMATIC*.md`, `main.ts`/`Audio.ts` unlock/`style.css` intro block/`package.json` fonts) was deliberately NOT
committed — staged partially around it every time and each staged tree was typechecked on its own.

**1. Soft combat camera (touch)** — `combat/TargetAssist.ts`, wired in `Game.step`. One focus enemy chosen with
hysteresis: engaged, ≤ 10 m (archers ≤ 8, wraiths ≤ 9, bosses ≤ 16), |dy| ≤ 3.5, line of sight (cached 0.15 s),
score = distance + 2.2·angle − 4.5 if attacking within 4 m (− 2.5 farther) + 2 for archers − 2 for bosses − 1.4 for the
last attack target; a challenger must beat the focus by 1.5 for 0.45 s (0.12 s if it attacks within 3.5 m); the focus
survives 0.8 s of occlusion. The aim point is the focus pulled toward its pack. Dead zone = the target within 62 % of
the half horizontal FOV **as seen from the camera**; beyond it the yaw eases at ≤ 1.6 rad/s (2.4 for an attacker),
smoothed. Manual swipe = no assistance for 1.3 s, handed back over 0.8 s; running away from the focus cuts it to 15 %.
Desktop keeps Tab/MMB lock-on; the touch lock button is gone. Verified: attacker 2.2 rad off-screen → framed in ≈ 0.8 s.
**2. Attack magnetism (all inputs)** — `TargetAssist.meleeTarget` (reach 5 m, sprint 6.8, air 3.2; LOS; stick
direction when held else facing; ≤ 120° unless within 1.7 m; sticky 2.5 s) + `Player.beginAttack/updateAttack`: the
target is chosen once per swing, turn at 30 rad/s for the first 0.12 s (instant only for a very close enemy behind),
gap-close through the wind-up and the first 40 % of the strike capped per kind (light 5.5 m/s / 1.6 m, heavy 4.5 /
1.5, sprint 7.5 / 2.4), forward root motion damped when already in reach, ledge stop kept. Lock and execution flows
unchanged.
**3. Touch HUD** — §7 Controls. Verified by PointerEvent scripts at 375×812: move+attack (L1 fires, stick unaffected
after lifting), move+dodge, move+guard (walks at 1.61 m/s guarding), move+camera (0.5 rad while moving), camera+attack,
camera+dodge; no stuck holds; the pocket point is empty stage.
**4. Blood Sigils** — `levels/Checkpoints.ts` rewritten: beacon (additive column + halo with a recovery arc; one
program, uniforms only, warmed with the level), card text, first-ever activation explains checkpoints, `SIGIL_COOLDOWN`
30 s per sigil (a NEW sigil is always usable), no banner while recovering (playtest feedback: the countdown looked
stuck) — a 1.2 s note if pressed; refuses while an engaged enemy that can actually reach/see the hero is within 12 m
(`EnemyManager.engagedNear`: melee on the same level and not holding; archers/wraiths with LOS). Respawn without a save
now keeps the ≥ 100 charge floor. Audit: F1 CP1–CP6 kept (each brackets a gate/fight); **F2 CP4 removed** (9 m from CP1
in the same antechamber; CP1 serves the return — ROUTE2 re-activates it); **F3 CP1 moved** from the spawn to the WG
west end (−4.9, 97.6) after the first weave. floor02/03 rebuilt in Blender (only sigil geometry changed).
**5. Onboarding** — `game/Objectives.ts`: one objective line (top-left) per step for all three floors, advanced by
gameplay facts (sigils, encounters, shifts, zones, flags, bosses, exit) with skip-ahead; persistent tutorials that stay
until done: MOVE, FIGHT (strike → guard/parry → dodge → extras, with the button pulsing), BLOOD SIGIL, RESONANCE
(first kill), TIME SHIFT (only at the gate lane with charge: "HOLD SHIFT… the gate stood open in its memory"; elsewhere
"go back to the rusted gate"). Stuck hints (voiced) after 35–90 s outside combat; a gold edge chevron only after the
first hint time when the goal is off-screen; a floor ring at required shift spots. The old timed T_MOVE/T_COMBAT/T_SHIFT
prompts are suppressed. Opening motive voiced: "That gate was whole, for a heartbeat. If my blood came from here, so
will my answers."
**6–9. Voice** — see `docs/DIALOGUE.md`. Lily (premade, British) chosen from 4 auditions by measured range/tag
response; eleven_v3, stability 0.5, similarity 0.75, seed 7; 18 register-grouped requests cut by timestamps; 99/99
Scribe-clean; 2 retakes. 99 lines = onboarding 7, hints 23, discoveries 19 (every Memory Trace), story 3, bosses 8,
combat 13, checkpoints 6, shift 7, flavour 2, idle 11 — 388 s, 2.2 MB OGG. Runtime priorities/queue/pools/idle
rules as documented; tuned after a bot run (22 → 18 lines per Floor 1 run). Streaming: vo-core 23 shared lines (4.7 MB
decoded), each floor's boot lines with its loading screen, the rest prefetched within 40 m of their trigger and
**evicted after they are spoken**; decoded at 22.05 kHz; released on floor change. Floor 1 never loads Floor 2/3 lines.
**10. Navigation** — `tools/build_navgrid.mjs` + `enemies/NavGrid.ts` + `Enemy.navigate`: see the commit text /
file headers. Root causes found with a stall probe: straight-line chase into props/corners, chasing heroes on other
levels, spawns wedged between tombs and walls (5 on F1, 2 on F2 — moved at load and logged), wide enemies routed
through gaps they cannot fit (per-node clearance vs body radius), holding enemies hogging attack slots (starved the
ridge wraiths). F1 god run: exit at 358 s (was 470), 64 kills, 8 shifts, **0 stall events**; F2 to the exit, 3 blips.
**11. Floor 2 variety** — Floor 3's roster was checked: remnant/hollow/hollow warden/echo archer (+ boss); only the
Remnant was new to Floor 2. It now arrives in E4's second wave, E9 (with wraiths), E10's Present reinforcements; E2b
mixes a warden and an echo archer. No new assets (Hollow rig).
**Performance (375×812, this AMD iGPU, 1,200 real frames through E1–E3 + first shift):** 0 shader compiles, 0 texture
uploads after loading; step p50 2.2 / p99 6.8 ms; render p50 17 ms; GPU p50 19 ms (iGPU, same range as session 4).
Floor 1 load 5.0 s (assets 2.8, build 0.5, warm-up 1.7). Nav planning ≈ 50–80 ms per whole floor run.
**Tests run:** tsc on every staged tree; `npm run build` PASS; F1 god autopilot to the exit (twice), F2 god to the exit
(several), F3 load + objective/CP1/arrival line; onboarding scripts; sigil cooldown; multitouch scripts; wide view
1280×720 (objective, card, subtitle); Scribe QA of every line.
**Needs a human / real phone:** everything under §8 "Session 7 follow-ups"; also whether the tutorial cards feel
too wordy on a small phone, and the subtitle position (top of the frame under the HUD in portrait).

### Session 5 (2026-09-29) — Great Sword Pack, crouch walk, mage final boss, Floor 3

**Asset inspection first** (§4): all three new sources inspected in Blender (kinematics + contact sheets + close-ups)
before any mapping. Tools: `tools/blender/inspect_pack.py`, `tools/contact_sheet.py`. Key findings: same hero rig;
Maria has no shield mesh; crouch walk is a clean 1.21 m/s loop; Nightshade is a complete mage set on the hero's rig.

**Hero** (`CombatData.ts`, `Player.ts`, `animationManifest.ts`, `build_hero.py`, `hero_clip_map.json`): combo graph in §7.
Bugs fixed while verifying: (1) `activeHits()` tested `hitsDone.has(windowIndex)` against `index*1000+enemyId` keys —
window N silently never hit enemy N (the second hit of L5/F3/B4 on enemy #1); (2) a follow-up pressed before a long
attack's `inputFrom` expired (0.4 s) before its late cancel point (H2→H3) — accepted inputs now stay queued;
(3) **the crouch was a sliding pose**: `crouch_enter` is a clamped one-shot that was never released in the crouch state,
so no crouch base clip ever showed — now released, and the real crouch-walk loop plays at ground speed (settles into the
crouch idle when stopped; moving crouch enter/exit blends without the one-shots). Crouch speed 1.8 → 1.55 m/s.
Sword guard replaces the vambrace guard (standing + crouched sets), blocks/parries square up to the blow, sparks at
the blade's middle. Hit reactions and deaths alternate one-/two-handed sets.
**Verified** (`dev/combatHarness.js`, passive dummy, Floor 1 hall): routes A/B, all heavy endpoints, H1-H2-H3 (charged
78 vs 40), sprint slide 24 / leap 40, dodge→L 22 / dodge→H 22+28, attack→dodge cancel, air 30, crouch chain 14+16,
kick chain 8+12, bash 6, parry → RIPOSTE / F3, execution (guard at 40 % HP killed); hips world scale 0.0100 in every
run; crouch-walk foot plant p25 0.04 m/s; auto-crouch through the F1 crawl. Portrait screenshots: sword guard, crouch walk.

**The Last Crown** (`LastCrown.ts`, `Spells.ts`, blueprint §I): range-based spell choice (long: bolt, twin bolts,
bombardment runes, beam; mid: fan, ground wave, nova; short: repel, dark burst, blink away when crowded; P3 homing orb),
phases at 65 % / 30 % (kneel break: invulnerable, push-back, adds, +200 surge, forced slip), wards and bindings broken
only by the hero's own shift (3.5–4 s stagger, ×1.5 damage), forced slips every 24 s / 15 s with a 3 s wedge telegraph
(a hero caught over a hole is thrown clear to the lens edge, −20 HP), Past pillars stop bolts and the beam (Present beam
at knee height: jump it). Everything pooled (16 bolts, 8 runes, 6 rings, beam, ward, tether, 4 wedge decals) and
warmed at load. Bolts flying in from off-screen get portrait edge chevrons. Game-wide fix: fall respawn searches for
footing in the current memory (a slip can open a hole under `lastSafe`).
**Performance (boss phase 2 → 3, 1200 rendered frames, pane size):** 0 compiles, 0 uploads, 0 new programs; step p99
2.6 ms, render p99 6.6 ms, GPU p99 8.9 ms; 1 frame > 33 ms (the phase-break slip). Floor 3 load 4.3 s (dev, warm).

**Audio:** 12 ElevenLabs sounds (build-time, `tools/elevenlabs_sfx.json`: mage_charge/bolt/impact/nova/teleport/beam/
ward/rune, crown_resonance, boss_scream, boss_death, final_collapse) → `tools/build_audio.py` → Floor-3-only scope.
Unheard by a human.

**Build / package:** `npm run build` PASS; `npm run package:itch` → `build/caer-veyr-itch.zip` **91.4 MB, 372 files**, no
source packs / FBX / .blend; the unused seraph `boss.glb` removed from `public/` (reproducible with `npm run assets:boss`).
Packaged build served from `/html/12345/`: Floor 3 direct load and Floor 2 → 3 transition (4.3 s, identical GL counts)
with 0 failed requests.

**Commits (pushed to Arjun0014/castle-game main):** hero Great Sword/guard/crouch · Floor 3 + Last Crown · stair
fix + boss.glb removal · CONTEXT.

**Needs a human / real phone:** boss fairness and readability, the pause-combo timing, touch play of the boss (dodge
timing against bolts in portrait), audio mix. Emulated: portrait touch HUD + boss bar + off-screen chevrons verified.

### Session 4 (2026-09-29) — jam portrait build, touch, combat feel, archers, mobile perf, git

**Portrait / input split** (`Platform.ts`, `TouchControls.ts`, `Hints.ts`, `index.html` #stage, `style.css`, `main.ts`):
see §2.1 and the Controls in §7. Title/loading cards and HUD are laid out against the stage with container units and
safe-area insets (vitals top, prompts mid, controls bottom; touch prompts sit above the thumbs). Off-screen threat
chevrons on the stage edge in portrait (radar mapping: screen-up = camera forward; archers tinted; attacking/aiming = hot).

**Portrait camera** (`CameraRig` profiles): portrait = 5.7 m (combat 6.1, +up to 2.2 m pull-back in crowded fights and
boss fights), height 1.65, pitch 0.38, no shoulder offset, vertical FOV widened with the aspect (66→78°, horizontal ≥ 44°),
lens shift 12 % (hero low, space ahead; 3.5 % with the touch HUD so the hero stays clear of the thumbs), relaxed when a
wall is close ahead; 3-ray boom collision; low-ceiling pitch fallback; never hangs above a roof reached through a Present
roof hole; keeps ≥ 0.85 m under ceilings. Spring impulses (`punch`) + smooth layered-sine shake. Fog distances are shifted
by the extra camera distance so the Present looks as smoky as before. Widescreen profile = the original values.

**L1 changed** (`CombatData.ts`): was `atk_chop` (short upward flourish; the tip never crossed in front of the body,
26 m/s). Now the opening forehand diagonal of `atk_whirlwind` (clip 0.30–1.02): chosen from measured sword-tip paths of
every attack clip (`build/analysis/swing_paths.json`, Blender, hero.blend) — the torso unwinds ~177°, the tip reaches
1.9 m at 44 m/s, and it starts near the idle stance. L1 + Heavy → new `F1c` (the whirlwind continues from 0.84: hits 2+3).
L2/L3 start later in their wind-ups (0.46 / 0.36). Contact 0.13 s after the press; the chain lands a hit every 0.38–0.47 s.

**Combat feel:** per-phase pacing (`speedAt`: anticipation ×1.3, strike ×1.1, follow-through ×0.8, recovery ×1.3; heavies
windup ×0.95 / strike ×1.25); swing whooshes on the paced timeline (`realTimeTo`); magnetism during the wind-up (≤ 3–3.5 m/s
toward a target within 5.5 m); `FEEL` table per attack kind (hit-stop 55–110 ms, shake, camera kick along the blade, FOV
punch, haptics, enemy lean spring + hit shake on real time); blocked hits bounce the hero back; parry = 130 ms stop +
slow-mo breath + zoom; impact audio layered by weight with pitch jitter + heavy body-blow; blade trail time-based
(freezes in hit-stop), sub-sampled, pale for light / warm for heavy. **Bug fixed:** hits were registered per attack
DEFINITION, so L1 → pause → L1 could never hit the same enemy twice (now per swing: `Player.attackSerial`).

**Archers:** see the commit in §10 git list / `Enemy.rangedThink`. Root causes: on-sight aggro capped at 9 m with
|dy| < 3 m, and perched archers checked LOS against the parapets' player-only collision (1.9 m; the stone is 1.2 m).
Now sight 34 m from any height (LOS 4×/s), perched archers lean over parapet-height obstacles (never real walls), keep
distance / find a firing spot instead of charging, readable draw → aim tracer → loose, cancel on lost LOS, ballistic
lift + lead over the flight time. Archer stats: range [7, 32], 29 m/s, 14 dmg, interval 1.5–2.4 s.
Placements reviewed: F1 E3 (ward gallery ±5,6,6) now covers the whole Past ward; E13 gallery archers (wave 2) cover the
Great Hall; E7 (non-perched) back off; F2 E1b/E8/E3/E3p perched archers engage by sight. No placement moved.

**Other fixes:** dormant (kneeling) enemies were drawn in bind/T-pose (their fade-in never advanced under
`mixer.update(0)`) — visible in the Great Hall finale; risers no longer fade in from bind pose; the dodge dash and
knockback stop at edges (the F2 Kingsguard deaths were dodges into the apartments' floor holes); Guard + Heavy = kick.

**Performance (portrait):** handheld DPR ≤ 2 and ≤ 1.6 MP render budget (a 1080×1920 phone renders 720×1280); MSAA off on
high-DPR handhelds; adaptive render scale 0.6–1.0 (1.5 s windows, drops only if it helps; off in automation);
`Platform.quality` mobile tier (6 point lights, 1024 shadows). Measured on this machine (AMD iGPU, other sessions'
game servers running = GPU contention; GPU timer query numbers), F1 finale, 30 active enemies, hero attacking:

| View / size | GPU p50 / p95 |
|---|---|
| portrait 720×1280, high | 14.5–17.1 / 17.6–20.0 ms |
| portrait 720×1280, mobile tier | 11.1–13.3 / 12.5–17.2 ms |
| portrait 1080×1920, high | 24.2 / 26.9 ms |
| wide 1920×1080, high | 25.7 / 27.4 ms |

0 shader compiles / 0 texture uploads in all fights, including a mid-fight Past→Present shift.

**Tests run:** desktop portrait kbm (1024×768 → 432×768 stage), phone emulation (375×812 touch; 450×800), rotate overlay
(740×360 handheld), `?view=wide` desktop + handheld, hybrid switching, multitouch PointerEvent scripts, auto-crouch
(both crawl spots), camera screenshots (spawn, E1 fight, tunnel, Great Hall), L1/chain/F1c timing, archer scenarios,
F1 god autopilot (→ F2 transition), **F1 real-damage autopilot exit t = 357 s, 0 deaths; F2 real-damage exit t = 391 s,
0 deaths, 1 fall**; itch sub-path build (0 failed requests, F1→F2 2.1 s); `npm run build` PASS.

**Git:** repo initialised this session; local identity `Arjun0014 <23293383+Arjun0014@users.noreply.github.com>`
(repo-local config only); remote `https://Arjun0014@github.com/Arjun0014/castle-game.git`; the Git Credential Manager
entry for github.com is the Arjun0014 account (verified via the API: login Arjun0014, admin on the repo; the other
account's entry is only used for `ArjunAJ7@github.com` URLs). `credential.https://github.com.username = Arjun0014`
is set locally. Pushes are non-interactive (`GCM_INTERACTIVE=never`). The repo is **public**: raw third-party source
packs (`assets/characters`, `assets/materials`, `assets/vegetation`, `assets/blender`) are git-ignored and stay local;
runtime assets (`public/assets`) are committed. `.env` is ignored.

**Floor 3 (started, not built):** `docs/LEVEL_03_BLUEPRINT.md` v1.0 (self-reviewed; design only) and the processed
boss asset (`tools/build_boss.mjs`: 30.5 → 13.2 MB KTX2, textures deduplicated, opaque materials, constant tracks
removed; verified rendering in engine). Everything else for Floor 3 is in §8.1.

**Commits this session (all pushed to Arjun0014/castle-game main):** baseline · portrait + touch + input split ·
camera framing/clearance + T-pose fix · combat feel + L1 + repeat-swing fix · archers · ledge-safe dodge/knockback ·
itch build · mobile quality tier + LAN scripts · CONTEXT · boss asset · Floor 3 blueprint · final CONTEXT.

**Known issues:** browser-pane screenshots crop at DPR 1.25 in desktop mode (use phone-size emulation for captures);
touch controls never tried on a real device; CPU-side render timings on this machine are polluted by other sessions'
GPU work (compare GPU timer numbers); the itch zip still carries the JPEG/PNG fallback textures and non-KTX2 GLBs
(`?tex=jpg`) — harmless (never downloaded unless requested) but ~25 MB of the 83 MB.

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
