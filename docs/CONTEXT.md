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
**Game title:** ECHOES OF CAER VEYR (session 13; displayed on the title screen, boot card, tab title, credits and the final
ending card). "The castle remembers" stays the world's creed and a recurring phrase (dialogue, loading labels, the
respawn card, the opening film and the Remotion trailer) — it is no longer the game's name.
**Current implementation priority:** session 16 = THE WAVEDASH VERSION (§10 Session 16): widescreen is the desktop default
(HUD + menus scale with the frame, ultrawide capped), phones choose PORTRAIT or LANDSCAPE (a new two-thumb landscape touch
layout + camera; Settings → Display; no reload), the Wavedash SDK (load progress, `init()` once, player identity,
achievements + stats mirrored from the game's own system, cloud saves `saves/main.json` with conflict safety, platform
fullscreen) behind one facade — the same `dist/` still runs on itch as a local game. Saves now resume at Blood Sigils.
Next: §8 Session 16 (Wavedash CLI sign-in + game ID → `wavedash dev`, an uploaded build, a real phone).
Session 15 = MAIN MENU LIFE, ACHIEVEMENTS and the LORE EXPERIENCE (§10 Session 15):
the title heroine turned toward the player with a menu-idle director (the new Mixamo clips + unused Great Sword idles,
a procedural glance), 26 achievements (toasts in play, a panel, localStorage), and the narrated 12-page chronicle
(swipe / keys / auto-advance, Eleven v4 narration in the user's "Cthulu female" voice carried to the paid account as an
IVC), the title menu in three tiers, the audited itch ZIP. Next: the real-phone / ears checks in §8 Session 15.
Session 14 = onboarding clarity, combat flow, Floor 3 polish and audio (§10 Session 14):
the Remotion opening film, the score from the loading card, the wordmark, credits (a game by AJ_Insanity), the world-anchored
touch button, faster passive Resonance, health from kills, memory-return reinforcements, the Last Crown's add waves and
red/gold chamber, her hidden reveal, guaranteed mini-boss finishers, route guidance in the world, the idle-enemy fixes.
Next: the real-phone / human checks in §8 Session 14.
Session 13 = first-player experience + music + mobile performance (§10 Session 13):
the outer gate behind the spawn (the barbican), the new title, an adaptive score (exploration ↔ combat, position kept,
voice ducking), the Guided tutorial extended through the crawl AND the armory's half stair (G3) to CP3, Minimal
guidance through the same section, and the mobile frame-time investigation (no single regression found — the
structural costs it found are fixed, see §10). Next: the real-phone checks in §8 Session 13.
Session 11 = bug fixes + Floor 3 polish (§10 Session 11): monsters on their feet,
no sliding on stairs, passive Resonance, floor transitions that survive a lost connection (retry / TRY AGAIN /
prefetch), the right reward message per floor, **the Maw of the Crownheart rebuilt on the Creature Pack Mutant**
(16 clips, full moveset, CP2 before / CP2B after), **the Crownheart as the chamber's living light**, and finishers
whose cuts fire on real blade contact. Next: the untested items in §8 Session 11, then human / real-phone play.
Session 10 = finishing polish (§10 Session 10): a real **title screen** over the
castle itself (Continue / New Game → Guided or Minimal guidance → the opening film / Controls / Settings / Credits), a
cinematic **chapter card** loading screen with real progress, the **Guided Floor 1 tutorial** (move → crouch, one
lesson at a time), a **pause menu**, floor-level **saves**, the **enemy audit** of all floors (every archer shoots, bats
swoop, no blind spawns), **Floor 3 played end to end** (lift → descent → the Maw → the Last Crown → the ending) with its
fixes, and `LEVEL_03_BLUEPRINT.md` rewritten for v3. Next: human playtests on a real phone (§8).
Session 9 = polish + encounter redesign (§10 Session 9): frequent cinematic
finishers (5 variants), faster touch camera + bigger pocket, the quiet crypt water, the four new monsters with their
own brains + 3 mini-bosses, **Floor 3 rebuilt as the descent to the Crownheart**, the King's lift (F2 -> F3), the
Last Crown's reveal/heart/death.
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

## 2.1 Presentation (jam session 4; session 16: the Wavedash version)

- One build (`dist/`) serves Wavedash and itch.io; the game detects Wavedash at runtime (`src/platform/Wavedash.ts`).
- **View and input mode are separate axes.** `src/platform/Platform.ts`:
  - view: `wide` or `portrait`, re-evaluated on every resize, switchable while the game runs (never a reload).
    **Desktop: `wide` by default** (Wavedash, any landscape window, 16:9 / 16:10 / 21:9); a desktop window or embed
    clearly taller than wide (w/h < 0.8; back to wide above 0.9) gets the jam's portrait layout — itch's 720×1280 frame
    is unchanged. **Phone / tablet: the player's choice** — PORTRAIT or LANDSCAPE, asked once (the HOW WOULD YOU LIKE TO
    PLAY? card), kept locally and in the cloud save, Settings → Display changes it; before the choice the layout follows
    how the device is held. `?view=wide|portrait` pins it for tests.
  - input: `kbm` or `touch`, from real device capability (coarse primary pointer + touch points = handheld → touch),
    then from what the player actually uses (a touch `pointerdown` → touch HUD; a gameplay key or a real mouse press/move
    → keyboard/mouse). Never from the aspect ratio. `?input=touch|kbm` pins it for tests.
- Camera profiles (`CameraRig.CAM_PROFILES`): `wide` (desktop), `wideTouch` (a handheld held sideways), `portrait`.
- A handheld held the wrong way for its chosen mode gets the rotate card ("Rotate your device to portrait / landscape",
  a one-tap "Play in … instead"; the game pauses). Desktops never see it; nor does a handheld that has not chosen yet.
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

## Music — `assets/music/` (supplied by the user, session 13; local source, not committed)

- `The_Last_Canopy_Sleeps.mp3` — 120.03 s, 192 kbps MP3, 44.1 kHz stereo, −22.7 LUFS, LRA 16 LU (ambient, dynamic);
  1.1 s of silence at the start, fades to silence from ~108 s (silent from 116.2 s). The **exploration** score.
- `Savage_Ritual.mp3` — 60.03 s, 192 kbps, −13.7 LUFS, LRA 4.9 LU; grid-locked at **180.0 BPM**, first beat 0.0116 s,
  8-beat phrases of 2.667 s; a 13.3 s intro, the full section from 13.345 s, a closing hit + decay after ~56 s. The
  **combat** score (loops 13.345 → 56.012 s).
- Runtime (`tools/build_music.py`): Ogg Opus 160 kbps 48 kHz — `public/assets/music/canopy_00..09.ogg` (12 s segments with
  0.08 s shared overlap, 2.5 MB) and `ritual.ogg` (1.2 MB); `src/data/musicManifest.json`.

## Hero menu clips + the lore pages (session 15)

- `assets/characters/hero/` gained 4 loose Mixamo FBX on the same 65-bone rig (user, 2026-09-30): `Angry.fbx` (19.2 s restless
  wait), `Arm Stretching.fbx` (8.9 s), `Taunt.fbx` (2.8 s two-handed sway), `Martelo 2.fbx` (1.3 s capoeira kick — unused).
  Roles in `tools/blender/hero_clip_map.json` `menuClips` / `unusedMenu`; built into `public/assets/characters/hero_menu.glb`
  with Great Sword idles (2)-(5) (§10 Session 15).
- `assets/Echoes_of_Caer_Veyr_All_12_Pages/Page_01..12.webp` (user, local source, not committed): the illustrated lore book,
  1024×1536 RGB WebP, 371–466 KB, printed folios 01–12 = the story order. Byte copies in `public/assets/lore/`.
- ElevenLabs narrator for the book: `JSIqdqOB9ZIcrBFOti5d` "Cthulu female - v4 narrator (IVC)" on `ELEVENLABS_API_KEY_2`,
  cloned from `VhuTJN7jTXadMoTbfY1r` "Cthulu female" (`ELEVENLABS_API_KEY`); `tools/lore/voice.json`. Take + ledger:
  `assets/audio/lore/`.

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

- `LEVEL_03_BLUEPRINT.md`
  - Floor 3 "The Crownheart" **v3.1 (session 10)**: the descent beneath the castle as built and play-tested (every weave,
    encounters, economy, the Last Crown's arena, the session-10 fixes). v1/v2 (the summit) are obsolete;
  - mirrored in code by `tools/blender/floor03_layout.py`.

- `CINEMATIC.md`, `CINEMATIC_V2.md`, `CINEMATIC_HANDOFF.md` — the opening film (v1 pipeline, v2 + the FINAL hybrid cut,
  handoff state). Committed in session 10 (`796a604`).

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
| Floor 3 blueprint | DONE (**v3.1**, session 10) | `docs/LEVEL_03_BLUEPRINT.md` rewritten for the v3 descent (lift foot → Hall of Roots → ossuary → cistern / the Maw → Great Descent → Threshold → the Crownheart) incl. the session-10 play-test fixes. v1/v2 (summit) obsolete |
| Final boss asset | DONE, VERIFIED | `lastcrown.glb` (Pro Magic Pack Nightshade, 32 clips) — §4 |
| Floor 3 geometry | BUILT, TRAVERSAL VERIFIED | `tools/blender/floor03_layout.py` + `build_floor03.py` → `floor03.glb` (7.2k tris) + collision (1.8k); 0 validation issues; scripted walks: G1 gap (Present void / Past floor), portcullis (Past blocks / Present passes), stair (Past stops at the Royal Ward, Present spire ramp reaches the hall), Crown doors (Present fused / Past open) |
| Floor 3 runtime + Last Crown | WORKING (bot-verified) | `src/enemies/LastCrown.ts`, `src/vfx/Spells.ts`; god bot fight: phase 2 at 26 s, phase 3 at 85 s, slips, blinks, wards/bindings broken by the bot's shifts, 0 errors; real-damage bot (never dodges/guards) dies every ~35–40 s and reached phase 2; checkpoint respawn resets the fight. **No human playtest yet** |
| Ending | WORKING | boss death → final slip to the Present → `Game.endGame()` card "THE CROWNHEART IS SILENT" (+ time / Echoes / shifts / deaths) |
| **Hero Great Sword combat (session 5)** | DONE, VERIFIED (numeric) | `dev/combatHarness.js` matrix: every route/branch below chains and connects on a dummy; skeleton hips scale constant 0.0100 in all 29 attack definitions; root speed ≤ 7 m/s in attacks (12.8 dodge) |
| **Crouch walk** | DONE, VERIFIED | planted-foot speed p25 0.04 m/s at 1.55 m/s body speed (was 1.55 = full slide); auto-crouch crawl verified on the F1 crawl line |
| **Asset lifecycle (session 3)** | DONE, VERIFIED | `src/assets/AssetManager.ts` (ref-counted scopes, shared in-flight loads, byte-weighted progress, disposal), `src/assets/GameAssets.ts` (every key + per-floor dependency lists from `src/data/floorManifests.json`). Scopes: `core` (hero, shared sounds), `ambience` (5 beds, skipped when muted), `floorN`. F1→F2→F1→F2 returns identical GL counts |
| **Loading screen** | REDESIGNED (s10), VERIFIED | `src/ui/LoadingScreen.ts` + `ui/menu.css`: chapter card (FLOOR II / THE ROYAL FLOOR / Complicity / epigraph) round the Crownheart sigil whose gilt ring = the real byte/build/warm-up progress (never ahead of it), step + detail in words, embers; the heart flares when ready; boot, transitions, Continue ("press any key / tap to enter") |
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
| **itch.io build** | DONE, VERIFIED | `vite base './'`, `npm run package:itch` → `build/caer-veyr-itch.zip` — session 10: **162 MB, 535 files, 189 MB unpacked** (the film adds 58 MB; itch limits: ≤ 1,000 files, ≤ 1 GB); production preview verified (title, Continue, pause, New Game → tutorial) |
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
| **Mini-bosses (s9)** | DONE; all three VERIFIED by bot (the Maw in s10: 33–35 s, all 3 waves, real-damage bot survives) | F2 E4 THE GUTTER KING, F2 E2b THE WEEPING MOTHER (optional lair), F3 E5 THE MAW OF THE CROWNHEART |
| **Floor 3 v3 (s9)** | PLAYED END TO END (s10, bots) | `dev/f3Probe.js`: 9 weaves pass in the right memory, blocked/void in the other; spawn → arena route with 6 accepted shifts; iron gate fixed (layout rebuilt, NAV3 rebaked); audit: every encounter acts; the Maw; the Last Crown fight → death shot → heart shatters → ending card (god bot 100–123 s; real-damage bot dies, respawns at CP3, fight resets). Present lighting raised; roots fade from the camera |
| **King's lift F2->F3 (s9)** | VERIFIED (s10, browser) | step on → "THE KING'S LIFT" → 7.2 s descent → chapter card → Floor 3 arrival shot; s10 fixed: the ride cost 4 × 25 % health (shaft kill volume) and the exit tore the floor down mid-frame |
| **Title screen (s10)** | DONE, VERIFIED (dev + production, portrait / wide / phone touch) | `ui/MainMenu.ts`, `ui/menu.css`, `Game.menuScene` (a slow shot of the heroine before the rusted gate): Continue · New Game → Guided / Minimal → the film → Floor 1 · Controls (kbm / touch tabs + combos) · Settings · Credits (all CC BY authors); keyboard / mouse / touch |
| **Opening film (s10 integration)** | COMMITTED, VERIFIED in browser (muted) | New Game (a gesture) → `ui/Intro.ts` via `import.meta.glob` → subtitles + Skip → play; `?nointro` skips; dev `&film` shows it in a muted test session |
| **Guided tutorial (s10)** | DONE, VERIFIED (`dev/tutorialProbe.js`: all 19 lessons in order) | `game/Tutorial.ts`: move, look, the way in, light (world near-freeze until the first blow), heavy, combo, guard + parry (slow blows, wider parry window), dodge (desktop), finish, Resonance, sigil, two memories, shift, the Past, the living guard, shift back, crouch, end; E1's Hollows teach (passive, cannot die), the hero is protected (≥ 1/3 HP). Minimal = compact cards + objectives/rings/guide. **Not played by a human** |
| **Settings / saves / pause (s10)** | DONE, VERIFIED (production) | `game/Settings.ts` (master/ambience/effects/voice, subtitles, camera sensitivity, shake; localStorage), `game/Save.ts` (Floors II/III; Continue restores learned/bestiary/deaths/play time), `PauseMenu` (Resume / Controls / Settings / Quit to title), ending → Return to the title |
| **Monster grounding (s11)** | DONE, VERIFIED (numeric) | `GameAssets` GROUND (goblin: measured lift) + LEVEL (Widow levelled on 4 legs), Widow pitch pivots on its legs |
| **Stairs (s11)** | DONE, VERIFIED | `Physics.resolveCapsule(vertGround)`: 0 drift standing on 9 stair spots; jump / dodge / knock / walk unchanged |
| **Passive Resonance (s11)** | DONE, VERIFIED (curve) | `TimeSystem.passive`: 1.6/s after 4 s calm, cap 100, paused in combat |
| **Transition robustness (s11)** | DONE, VERIFIED (simulated outage) | `Net` retry/backoff, TRY AGAIN resumes in place, next-floor prefetch |
| **The Maw = Creature Pack Mutant (s11)** | DONE, VERIFIED (god bot) | `enemies/Maw.ts`, `mutant.glb`, CP2 at the cistern door + CP2B after; real-damage bot NOT run |
| **Crownheart light (s11)** | DONE, VERIFIED (numeric + screenshots) | `vfx/Crownheart.ts` shader + chamber tone; boss bot NOT re-run |
| **Finisher contact (s11)** | DONE, VERIFIED (contact matrix, regression) | cut beats fire on blade contact; 5 variants × 7 bodies |
| **Title "Echoes of Caer Veyr" (s13)** | DONE, VERIFIED (browser) | `index.html`, `ui/MainMenu.ts`, `ui/LoadingScreen.ts` (boot card + tab title), `data/credits.ts`, `Game.finish` (final ending card); the creed "the castle remembers" kept in the world |
| **Outer gate / barbican (s13)** | DONE, VERIFIED (screenshots Past + Present, camera + collision probes) | `floor01_layout.build_barbican`; floor01 rebuilt (0 issues, 47.6k tris) + NAV3 rebaked; `LEVEL_01_BLUEPRINT.md` §N.1 |
| **Adaptive score (s13)** | DONE, VERIFIED (headless Chrome, real AudioContext; NOT heard by a human) | `audio/Music.ts`, `tools/build_music.py` → `public/assets/music/*.ogg` + `data/musicManifest.json`; segment joins sample-clean (recorded vs source), 3 fight cycles, loops, ducking, title → film → game |
| **Guided tutorial through G3 (s13)** | DONE, VERIFIED (`dev/tutorialProbe.js` desktop + touch: all 23 lessons incl. the wrong-memory detour; Minimal probe) | `game/Tutorial.ts`, `game/Objectives.ts` teach `halfstair`, `data/objectives.ts`. **Not played by a new human yet** |
| **Mobile CPU fixes (s13)** | DONE, VERIFIED (numeric) | invisible Echoes skip the matrix pass, skinned Echoes frustum-culled, HUD writes only on change (compositor-only Resonance bar), audio automation only on change, title backdrop culls Echoes, monster sounds floor-scoped — §10 Session 13 |
| **Opening film = Remotion cut (s14)** | DONE, VERIFIED (dev + production, desktop + phone) | `public/cinematic/intro_720.mp4` (byte copy of `remotion-intro/out/the-castle-remembers-intro-9x16-720p.mp4` by `tools/cinematic/ship_intro.py`), captions burned in; the Blender film (`opening_1080/720.mp4`, 58 MB) removed |
| **Title score from the loading card (s14)** | DONE, VERIFIED (unmuted browser: autoplay path; film fade + resume) | `Game.boot` loads `music:explore` first, `Music` own 250 ms scheduler, `main.ts` first-gesture start; never restarts |
| **Wordmark (s14)** | DONE, VERIFIED (portrait, desktop, wide) | `ui/MainMenu.ts` markup, `ui/menu.css` `.mm-t-*` |
| **Credits (s14)** | DONE, VERIFIED (production) | `data/credits.ts` (`AUTHOR = 'AJ_Insanity'`, statement), final ending card line |
| **Touch contextual button (s14)** | DONE, VERIFIED (emulated touch tap activates CP1; lesson once) | `ui/TouchControls.ts` `setInteract/placeInteract/teach`, `HUD.interact(…, {at, verb, kind})`, `style.css .t-cta*` |
| **Passive Resonance 7/s (s14)** | DONE, VERIFIED (curve: empty → shift 17.3 s after a shift, 16.8 s after combat) | `time/TimeSystem.ts` `PASSIVE` |
| **Health from kills (s14)** | DONE, VERIFIED (every F1 tier; reinforced ×0.6; Crown adds ×1.6) | `EnemyTypes` `KILL_TIER/KILL_HEAL`, `EnemyManager.killHeal/onKill`, `HUD.heal`, `Effects.healFrom` |
| **Memory-return reinforcements (s14)** | DONE, VERIFIED (F1 E3 group of 4; spam test 0 extra groups; F2 Present group; reduced rewards) | `enemies/Reinforcements.ts`, `EnemyManager.revive/fallen/openGroup/walkableAround/endGroups` |
| **Last Crown add waves + hidden until reveal (s14)** | DONE, VERIFIED (waves first/break2/mid2 with monsters; 10 kills healed 192 HP; never drawn before the reveal) | `enemies/LastCrown.ts` `ADD_WAVES/callWave/paceWaves/conceal` |
| **Crownheart mood (s14)** | DONE, VERIFIED (screenshots: red phase / gold phase) | `vfx/Crownheart.ts` `mood/bleed/wound`, `Game.applyHeartTone`, `LastCrown` `WOUND_MARKS` |
| **Mini-boss finishers (s14)** | DONE, VERIFIED (all 8 bodies on F1–F3: one kill, one clear, tier heal, camera never inside geometry) | `combat/Finishers.ts` `MINI_FINISH`, rotated staging, `stand` fallback, `sees()` |
| **Route guidance (s14)** | DONE, VERIFIED (F1 85 marks, 0 without floor; F2 legs incl. after FR1; Guided + Minimal) | `game/RouteGuide.ts`, `data/guidance.ts`, `Objectives.met/activeTime` |
| **Idle enemies (s14)** | DONE, VERIFIED (E13 from the hatch, E9 archer after the G5 shift, E7 blind archers) | `EnemyManager.adoptStrandedArchers`, `KNEEL_RELEASE`, `Enemy.perchThink/findPerchSpot`, blind ground archers advance |
| **Title heroine (s15)** | DONE, VERIFIED (probe + screenshots portrait / wide / 720×1280; not seen on a phone) | `character/MenuIdle.ts`, `hero_menu.glb` (7 clips), faces the player (3/4), actions + stance changes + glance; `dev/menuProbe.js` |
| **Achievements (s15)** | DONE, VERIFIED (27/27 unit, a real finisher unlock + toast in a fight, reload) | `data/achievements.ts` (26), `game/Achievements.ts`, `ui/AchievementToast.ts`, panel on the title + pause menu; `dev/achProbe.js` |
| **Lore book (s15)** | DONE, VERIFIED (flows + memory window, silent-score duck; NOT heard by a human) | `ui/LoreBook.ts`, 12 pages + 12 narrations (Eleven v4, 391 s), `data/loreManifest.json`, `tools/lore/*` |
| **itch ZIP audit (s15)** | DONE, VERIFIED | `tools/audit_itch.py` runs in `npm run package:itch`; extracted ZIP played at 720×1280 under an itch-style sub-path |
| **Enemy audit (s10)** | DONE, VERIFIED (`dev/auditProbe.js`, all floors) | 4 blind perched archers relocated at load (`checkPerches`), perched archers no longer slide down ramps, bats' swoop counter leak fixed, blind flyer spawns moved (`checkFlyers`), F3 respawn crash fixed; slot rotation fair in every big fight |
| **Widescreen desktop default (s16)** | DONE, VERIFIED (Chromium 153 + Firefox 155, 1366×768 / 1920×1080 / 2560×1440 / 3440×1440) | `Platform.ts` view logic + `--uiz`, `ui/platform.css` (zoomed HUD widgets / panels / toasts / chapter card, height-based title), `CameraRig` `maxHFov` (21:9 → 100° across, no stretch), threat chevrons in every layout |
| **Phone Portrait / Landscape (s16)** | DONE, VERIFIED (emulated phones 393×852 ↔ 852×393, tablet 1180×820) | `ui/DisplayChoice.ts`, Settings → Display, rotate card both ways, `wideTouch` camera, landscape two-thumb layout; multitouch (stick + camera, camera + attack); switching without a reload. **No real phone yet** |
| **Wavedash SDK (s16)** | DONE, VERIFIED against `dev/wavedashMock.js` only | `platform/Wavedash.ts` (facade), `WavedashStats.ts`, `CloudSave.ts`, `data/wavedash.ts`; `wavedash.toml`. **`wavedash dev` NOT run (the CLI is not signed in; no game ID)** |
| **Sigil saves (s16)** | DONE, VERIFIED (mock + local) | `game/Save.ts` v2 (checkpoint), `Game.captureCheckpoint / resumeAt`, `Checkpoints.capture / restore`, `EnemyManager.restoreCleared`, `Tutorial.resumeFrom` |

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

- `platform/Platform.ts` — view (`wide`/`portrait`, runtime-switchable, the phone's display choice), input mode
  (`kbm`/`touch`, hybrid switching), handheld detection, stage layout + `--uiz`, rotate card, fullscreen (Wavedash or the
  browser) + orientation lock, haptics, load-time quality tier.
- Session 16: `platform/Wavedash.ts` (the only module touching `window.Wavedash`), `platform/WavedashStats.ts`,
  `platform/CloudSave.ts`, `platform/Storage.ts` (`LocalStore` per Wavedash player, `deviceId`), `data/wavedash.ts`
  (identifiers), `ui/DisplayChoice.ts`, `ui/CloudConflict.ts`, `ui/SaveIndicator.ts`, `ui/platform.css`; `Game.applyView /
  setFogShift / menuCamera / captureCheckpoint / resumeAt / pauseKeyHold / arriveDeaths`, `CameraRig.setProfile(id, keep)`
  + `CamProfileId` + `maxHFov`, `Checkpoints.anchor / capture / restore`, `EnemyManager.restoreCleared`,
  `Tutorial.resumeFrom`, `Learned.tutorial`, `Achievements.listen / adopt / adoptCounter / merge` + counters `bosses /
  crownbreakers / whirlwinds / completions`, `Settings.updatedAt / restore`, `Save` v2 (`validateSave / saveRank /
  saveStamp / saveLabel / Save.onWrite / Save.put`), `MainMenu.setSave` + the "Playing as" chip + Settings Display /
  Fullscreen / cloud line, `TouchControls` landscape (`LANDSCAPE`, short-side units). Tools: `tools/wavedash/build_defs.mjs`
  (`npm run wavedash:defs`), `tools/audit_dist.py` (`npm run build:wavedash`), `wavedash/achievements-import.json`,
  `wavedash/cli-commands.txt`, `wavedash/icons/*.png`. Dev: `dev/wavedashMock.js` (`?wdmock`).
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
- Session 15: `character/MenuIdle.ts` (the title heroine's director + glance), `AnimController.addClips / removeClips`,
  `Game.menuIdle / loadMenuPack / menuPause`, asset `glb:hero-menu` (scope `menu`), `tools/blender/build_hero_menu.py` →
  `hero_menu.glb` + `data/heroMenuAnimations.json`; `data/achievements.ts`, `game/Achievements.ts`, `ui/AchievementToast.ts`
  (+ `ICONS`), `ui/achievements.css`, `MainMenu achievementsHTML / wireAchievements / tally`, `PauseMenu` Achievements,
  `AudioFX.achievement / scoreInMute`, `Music.duck(on, level, release) / duckLevel`, signals `hit / parry / floor:arrive /
  floor:leave`; `ui/LoreBook.ts` + `ui/lore.css`, `data/loreManifest.json`; tools `tools/lore/{el,clone_voice,voice_ab,
  gen_lore,qa_lore,qa_pages}.mjs`, `tools/lore/{build_lore,voice_stats,line_stats}.py`, `tools/lore/{narration,voice,
  selection}.json`, `tools/audit_itch.py`, `tools/eol_check.py` (keep each file's CRLF/LF), `tools/edit_eol.py`. Scripts:
  `npm run assets:lore`, `assets:heromenu` (run Blender directly), `audit:itch`. Dev: `dev/menuProbe.js`, `dev/achProbe.js`.
- Session 14: `game/RouteGuide.ts` + `data/guidance.ts` (route guidance legs per floor), `enemies/Reinforcements.ts`
  (`REINFORCE` rules), `EnemyManager.revive / fallen / openGroup / walkableAround / endGroups / killHeal / crownFight /
  adoptStrandedArchers`, `Encounter.reinforce / waveAt / rankDownAt`, `KNEEL_RELEASE`, `Enemy.appear / updateAppear /
  reinforced / origEncounter / perchThink / findPerchSpot`, `EnemyTypes KILL_TIER / KILL_HEAL*`, `LastCrown ADD_WAVES /
  callWave / paceWaves / conceal / WOUND_MARKS`, `Crownheart mood / wound`, `Finishers MINI_FINISH / miniOrder / planStand /
  sees`, `TimeSystem PASSIVE`, `TouchControls setInteract(verb) / placeInteract / teach`, `HUD.heal / interactAt /
  interactKind`, `Effects.healFrom`, `Music` own scheduler + `setCombat`, `Game.onMusicReady`, `Platform.lockPointer`,
  `data/credits.ts AUTHOR`, `tools/cinematic/ship_intro.py`. Dev: `dev/s14Probe.js` (heals, mini, minis, reinforce, spam,
  crown, passive).
- Session 13: `audio/Music.ts` (the adaptive score: `SegmentStream` for the exploration track, a looping buffer for the
  combat cue, the mode machine explore → combat → leaving → explore, `duck` / `setPaused` / `setLevel`, `__music.debug()`),
  `AudioFX.music` / `bindMusic`, Settings `score` (the Music slider), `GameAssets.registerMusic` / `musicKeys` (scope
  `music`) + `RIG_SOUNDS` (monster voices load with the floors whose rigs need them), `tools/build_music.py`
  (`python tools/build_music.py`: `assets/music/*.mp3` → `public/assets/music/canopy_NN.ogg` + `ritual.ogg` +
  `data/musicManifest.json`; the source MP3s stay local, untracked), `floor01_layout.build_barbican` (the outer gate),
  `Tutorial` lessons `halfstair` / `stairshift` / `climb` / `cp3` + dynamic card text, `Objectives` teach `halfstair`,
  `Enemy.updateBounds` / `setCulling` + the invisible-root matrix skip, `EnemyManager.menuVisibility`, `HUD` change-only
  writes. Dev: `dev/tutorialProbe.js` now walks G3 (incl. the wrong-memory detour).
- Session 11: `enemies/Maw.ts` (the Maw / crown brutes), `enemies/MonsterBase.ts` (the shared `Monster` body, split out
  of Monsters.ts), `data/mutantAnimations.json` + `tools/blender/build_mutant.py` (Blender headless: `blender --background
  --factory-startup --python tools/blender/build_mutant.py`, then `node tools/build_ktx2.mjs --only glb`), `AssetManager.Net`
  (retry / prefetch cache), `Game.transitionTo` failedLoad + `prefetchNext` + `applyHeartTone`, `TimeSystem.passive`,
  `Physics.resolveCapsule(vertGround)`, `Enemy.physRadius / passThrough / deathHold`, `EnemyManager.memoryHeld`,
  `HUD.clearAbility`, `Finishers.bladeContact` + armed beats, dev `dev/mawProbe.js`, `dev/finisherContact.js`
  (`C.setHome([x,y,z,yaw]); C.measure(id, arch)`; `C.reach(clip, {standoff})` = contact frames of any hero clip).
- Session 10: `ui/MainMenu.ts` (title screen + `PauseMenu`; shared Controls / Settings / Credits panels), `ui/menu.css`
  (loading card, title, panels, pause menu, tutorial card, end card), `ui/LoadingScreen.ts` (chapter card + `sigilSVG`),
  `data/credits.ts`, `game/Settings.ts`, `game/Save.ts`, `game/Tutorial.ts` (Guided Floor 1), `main.ts` (boot card →
  title → New Game / Continue; the film through `import.meta.glob('./ui/Intro.ts')`), `Game.menuScene` (title backdrop),
  `Game.timeScale` (tutorial slow motion), `Game.setGuidance`, `Game.onFloorArrive` (saves), `Game.pendingNext` (floor
  transitions start at the top of the next frame), `Game.updateRoots` (crystal roots fade from the camera),
  `Enemy.tutorialPassive/minHp/strikeIn()`, `Player.parryScale`, `EnemyManager.checkPerches/checkFlyers` (load-time
  sightline fixes, logged in `spawnFixes`), `Materials.variants()`, `AudioFX.setLevels/ui/unlock`, `Input.lookScale`,
  `CameraRig.shakeScale`, `HUD.subtitlesOn/lessonDone/teachBar/setFreeze`, objectives `shiftFrom` + teaches
  `shiftback`/`crouch`. Dev: `dev/tutorialProbe.js`, `dev/auditProbe.js`, `dev/f3Probe.js`, `dev/bossBot.js` (v3 arena).
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
Session 10: Esc opens the pause menu (Esc again resumes or closes an open panel); the title screen takes ↑/↓ or W/S,
Enter/Space, Esc (back), mouse and touch.

**Touch (handhelds; `?input=touch`), session 8 layout** (centre and diameter in u = stage width/400, from the
stage's bottom-right; `style.css` `.t-*`): ATTACK ⌀92 (60, 196) · JUMP ⌀76 (58, 302) · HEAVY ⌀70 (148, 166) ·
GUARD ⌀66 (190, 74) · SHIFT lozenge ⌀54 (150, 276). **No Dodge button on touch** (desktop keeps Shift-tap dodge).
The lower-right corner (≈ 105×140 u under Attack, right of Guard) is EMPTY for camera swipes — session 14: a permanent
dashed LOOK ring (⌀108 u, like the stick's ring on the left; solid and brighter while a finger turns the camera; its mark
quietens after ~900 px of looking, the ring stays). Joystick zone = left 46 % × lower 58 % (floating, rim = sprint); drag anywhere else = camera.
Buttons are heraldic SVG seals (aged-gold rim + device: battlements on Attack, rivets on Heavy, bead ring on Guard,
arrow points on Jump; enamel field per role; Shift = azure lozenge). **Hold feedback:** Attack/Heavy show a gold arc
filling over the 0.28 s hold threshold once their hold move is unlocked, solid while the Whirlwind spins (draining
over 5 s) / the Crownbreaker charges; a gold "HOLD" tag + breathing rim while its unlock tip is pending. Guard +
Attack = bash (second finger or slide), Guard + Heavy = kick; auto-crouch; interact card at 372 u; pause top-right.

**Touch, LANDSCAPE (session 16; `html.view-wide.input-touch`, `ui/platform.css` + `TouchControls.LANDSCAPE`)** — u = the
stage's SHORT side / 400 (≈ 0.98 on an 852×393 phone, capped 1.45 on tablets), positions (r, b) from the bottom-right:
ATTACK ⌀98 (84, 90) under the resting right thumb · HEAVY ⌀74 (196, 58) to its left · GUARD ⌀70 (204, 158) up-left
between them (slide onto Attack = bash, onto Heavy = kick, as in portrait) · JUMP ⌀74 (72, 206) above Attack · SHIFT
lozenge ⌀56 (162, 248) up-left of Jump. Stick zone = left 40 % below the top 28 % (floating, rim = sprint), its home ring
at (62, 52) u from the bottom-left; everything else turns the camera (the middle band is verified button-free), the LOOK
ring at (292, 40) u from the bottom-right. No Dodge, no lock-on (soft combat camera). The contextual button stays between
the thumbs (30–66 % across, 18–58 % down). Swipe gain is per short side, so one thumb turns the camera the same in both
modes. HUD: vitals top-left, PRESENT/PAST badge top-right beside the pause seal, boss bar top-centre, subtitles and the
ability tip in the band between the thumbs, floor title 22 %, prompts 40 %, deed banner top-right under the pause seal.

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
  - Add `&autostart` to skip the title screen (and the film), `&mute`, `&input=touch`, `&view=wide` as usual.
- **Session 10:** the title screen shows for every normal load (also `?mute`); `?autostart` / `?autopilot` go straight
  into play with **Minimal** guidance unless `&guide=guided`. `window.__begin()` starts play from the menu (probes).
  Saves/settings are off in automation (`?mute`, webdriver) and on dev floor starts. Dev `&film` shows the opening film
  even in a muted session (mute the video from the console). Probes: `dev/tutorialProbe.js` (`?mute&autostart&guide=guided`:
  `T.ready(); await T.run()` → every lesson), `dev/auditProbe.js` (`A.ready(); await A.floor()` → problems per
  encounter), `dev/f3Probe.js` (`?floor=3&input=kbm`: `F.gates()`, `await F.route()`), `dev/bossBot.js` (`?at=lastcrown`:
  `bb.setup(); bb.fight(240, false)`). Browser-pane JS calls time out after 45 s: run long loops detached and poll.
- **Session 15:** `?ach` persists achievements in an automated / dev-warp session (else memory only); dev `?patience=N`
  shortens the title secret to N s; dev **`?mute&scoretest`** loads and runs the title score silently (master 0) so music
  continuity / ducking can be measured without sound. Title: `const M = await import('/dev/menuProbe.js'); await M.ready();
  M.run(120); M.all(); M.pose('menu_inspect', 1.9, 'player'); M.face()` (frames driven by the probe; `window.__menuShot`
  overrides the shot). Achievements: `const A = await import('/dev/achProbe.js'); await A.unit(); A.state()`; `__ach`,
  `__toast.shown`. Lore: `__lore.debug()` (page, narration time, line, image / audio / PCM windows, duck, log), `__lore.go(n,
  how)`, `__lore.togglePause()`. The hidden pane freezes CSS transitions: take a second screenshot to see a settled frame.
- **Session 14 — ALWAYS `?mute` when Claude tests the game (the user's request).** The Claude browser pane is not
  webdriver and allows autoplay, so an unmuted URL plays the full mix out loud. Every probe URL takes `?mute`; the score
  itself can only be checked unmuted — do that only if the user asks, and close the tab afterwards.
  `const S = await import('/dev/s14Probe.js'); await S.ready()` → `S.heals()`, `await S.mini('E13')`, `await S.minis()`,
  `S.reinforce('E3')`, `S.spam('E3')`, `S.crown()` (`?at=lastcrown`), `S.passive()`; `mini(enc, arch, { stopAt, at })` stops
  mid-finisher for a still. `__game.guide.active / opened / misses`, `__game.enemies.reinforcements.log`,
  `boss.waveLog`, `__game.heart.mood`.
- **Session 13:** `__music.debug()` (mode, exploration position + the kept position, combat position, gains, duck, decoded
  MB) and `__music.log` (every transition on the audio clock). Music is not loaded in automation mute (`?mute`,
  `?autopilot`, webdriver) — test it unmuted. The profiling harness used for the mobile investigation (headless Chrome
  154 via playwright-core, phone viewport + touch, CDP CPU throttling ×4, V8 CPU profiles, invalidation traces, the
  deterministic Great Hall fight bench) lived in the session scratchpad; its method is in §10 Session 13.
- **Session 8 regression suite:** `http://localhost:5173/?mute&autostart&input=touch` at 375×812, console:
  `const R = await import('/dev/regression.js'); await R.run()` → 43 PASS/FAIL rows (walks F1 → F2 → F3 in place).
  Probes: `dev/enemyProbe.js` (stall scenarios + global stall watcher), `dev/abilityProbe.js`, `dev/finisherProbe.js`.
- **`?view=wide|portrait`** pins the layout (desktop default is wide; a handheld follows its display choice).
  **`?input=touch|kbm`** pins the input mode. **`?quality=high|mobile`** pins the render tier. `__platform` = the
  Platform singleton (`setDisplayPref('portrait'|'landscape')`, `uiScale`, `rotateBlocked`).
- **Session 16 (Wavedash):** dev **`?wdmock`** = a scripted Wavedash SDK (`dev/wavedashMock.js`; options `&wduser= &wdname=
  &wdslow=ms &wdportal=empty &wdoffline &wdfs`; console `__wdmock.offline(true|false) / remote() / setRemote(b) /
  clearRemote() / stats() / reset() / calls / log`). **`?saves`** keeps saves + settings in an automated session (with
  `?ach` for achievements). `__wave` = `{ Wave, cloud, stats, player }` (`cloud.debug()`, `stats.debug()`). A phone test
  needs `mobile + touch` emulation (else `handheld` is false). Real sandbox: `npm run wavedash:dev` (signed-in CLI +
  `game_id`).
- **Phone on the LAN:** `npm run dev:lan` (Vite on 0.0.0.0:5173) → open `http://192.168.1.39:5173/` on the phone (same
  Wi-Fi; allow Node through the Windows firewall on first run). Production check: `npm run build && npm run preview:lan`
  → `http://192.168.1.39:4173/`.
- **itch.io:** `npm run package:itch` (build → `tools/zip_itch.py` → `tools/audit_itch.py`) → `build/caer-veyr-itch.zip`. **Never
  zip with Windows PowerShell's Compress-Archive** (it stores `app\index.js` — itch showed a blank page, session 15). Upload as HTML5, "This file will be played in the
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

**Session 16 follow-ups — need the user (do these first):**
1. **Wavedash CLI**: `! wavedash auth login` (browser), `wavedash update` (0.1.95 installed, 0.1.98 out), put the game's ID in
   `wavedash.toml` (`game_id`, or `WAVEDASH_GAME_ID`), import `wavedash/achievements-import.json` in the Developer Portal
   (Achievements → Add achievement → Import JSON; icons: `wavedash/icons/<ID>.png`, or the `--image` lines in
   `wavedash/cli-commands.txt`).
2. **`npm run wavedash:dev`** (the sandbox): the loading bar → reveal, "Playing as" + avatar (does the CDN avatar load under
   COEP?), `__wave.stats.debug()` ready + a deed reaching the portal, `__wave.cloud.debug()` synced, `saves/main.json` in the
   sandbox; `wavedash clear-playtest-data --saves` + a private window = a new device restoring.
3. **An uploaded build** (`npm run wavedash:push`, then publish or playtest): fullscreen through the host (the sandbox always
   answers false), Esc / leaving fullscreen pausing the game once, the overlay on top, 1920×1080 and 2560×1440 on real
   monitors, Safari (Ogg Opus audio — the docs warn Safari lacks OGG; WebKit was not tested here).
4. **A real phone**: the HOW WOULD YOU LIKE TO PLAY? card, landscape thumbs (reach of GUARD / SHIFT, the LOOK ring's place),
   camera feel (`wideTouch` in `CameraRig`), orientation lock / the rotate card inside Wavedash's frame, notch safe areas.

**Session 15 follow-ups — need the user's real phone / ears:**
1. **The narration by ear** (the first thing to hear): the clone vs the original "Cthulu female" timbre, the whispers under
   the score, the pacing (0.75 s between lines, 1.7 s between pages), the duck (0.5) — `DUCK / AUTO_BEAT / START_DELAY`
   in `ui/LoreBook.ts`, `LINE_PAUSE / LAST_PAUSE` in `tools/lore/build_lore.py`. A retake of one page:
   `node tools/lore/gen_lore.mjs pages <take> <n>` (then wire it in build_lore — only whole-book takes are cut today).
2. **Swipe feel on a phone**: turn threshold (16 % / 0.42 px/ms), the edge resistance, a tap for the clean view, the dots'
   size (13–18 px wide), memory on an older phone (4 decoded pages).
3. **The title heroine on a phone**: framing between the name and the three-tier menu (portrait shot in `Game.menuFrame`),
   the face light, the action cadence (7–13 s home), whether the glance reads.
4. **The achievement toast in real fights**: placement (13 / 20.5 / 29 % of the height), the chime's level (0.11), whether
   25 finishers / 30 parries / 40 shifts / 150 Echoes are reached in one or two playthroughs.
5. On itch: re-upload `build/caer-veyr-itch.zip` (the first upload was the broken PowerShell ZIP — see §10 Session 15 item 6) (HTML, "This file will be played in the browser", viewport 720×1280,
   Mobile friendly · portrait, Fullscreen button on); check the first tap starts the score and the chronicle speaks.

**Session 14 follow-ups — need the user's real phone / ears / eyes (do these first):**
1. **The menu score** on a real phone and on itch.io: does it start under the loading card (autoplay) or on the first
   tap without a hiccup; the film fade-out (1.6 s) and the return after the film (3 s rise from the kept position).
2. **The touch button** (`.t-cta`): does a new player see and tap ACTIVATE on the first Blood Sigil without reading?
   Size (88 u), its band on screen (20–50 % of the height), the lesson line, INSPECT on memories, DESCEND on the lift.
3. **Route guidance** by a new player (Guided) to the half stair and on Floor 2's roofs: are the chevrons readable but
   not gaudy on a phone, is the crawl's glow enough, is Minimal's essential set right? Tune in `data/guidance.ts`
   (paths, beacons, `essential`) and `game/RouteGuide.ts` (chevron size 0.86 m, colour, flow, 1.5 m behind / ~20 m ahead).
4. **Balance by hand:** passive Resonance 7/s (`TimeSystem.PASSIVE`), the kill heals (`EnemyTypes KILL_HEAL`: 8/18/40/110,
   Crown ×1.6, reinforced ×0.6), the reinforcement rules (`Reinforcements.REINFORCE`), the Crown's waves (`LastCrown
   ADD_WAVES`, cap 5, mid-phase-2 at 20 s, late every 24 s ×2) — is the Last Crown still the focus?
5. **The Crownheart's mood** on a phone screen (red ⇄ gold swing ~19 s → ~11 s by phase; wound pulses) — too strong or
   right? Weights in `Game.applyHeartTone`, the ramp in `Crownheart.update`.
6. **Mini-boss finishers** in real fights (portrait framing per body; the in-place `stand` fallback's frequency). The
   Maw's reeling stumble and the Weeping Mother's stab were checked in stills only.
7. The Remotion film on a phone with sound (it was checked on the desktop pane; played muted here after the user asked).

**Session 13 follow-ups — need the user's real phone / ears (do these first):**
1. **Frame rate on the phone that used to run smoothly:** play Floor 1 from New Game (Guided) to the armory and one big
   fight (the Inner Ward E3, or the Great Hall E13) on `npm run dev:lan` or the itch build, and compare with before. No
   per-frame regression was found on this machine (§10 Session 13), so if drops remain, note WHERE and WHEN (a finisher?
   a shift? walking only? after how many minutes — thermal?) and, if possible, the backquote debug overlay is desktop
   only: tell Claude the phone model + Chrome version so the next session can target it.
2. **The score by ear:** levels (`MUSIC_LEVEL` in `audio/Music.ts`: exploration 0.82, combat 0.42), the voice duck (0.45),
   the pause dip (0.4), how fast combat music arrives (0.35 s) and leaves (3 s calm + to the next 2.67 s phrase + a
   2.67 s fade, exploration rising over 4.5 s), whether exploration + the ambience beds are too much together. The
   Settings menu has a new **Music** slider (the old "Ambience" one still drives the beds).
3. **A new player through the Guided tutorial** to CP3 (portrait touch): is each card read before it is needed; is the
   half stair clear (climb the rubble → shift on the old landing → climb the Past stair)? The cards and their order are
   in `game/Tutorial.ts`; Minimal's in `game/Objectives.ts` (`halfstair`).
4. **The outer gate** on a phone screen: readable in the Present from the spawn (fill light `light` marker at
   (0, −59.3, 3.4) in `floor01_layout.build_barbican`), the wicket's cold light, the Past torches.

**Session 11 follow-ups (do these first):**
1. Run what this session could not: `dev/bossBot.js` on `?at=lastcrown` with real damage (god passed: 67 s, 0 errors),
   a real-damage Maw fight (`dev/mawProbe.js` with `god: false`; its numbers: `EnemyTypes` maw attacks, `Maw.ts`
   LEAP_* / WAVE_* / cooldowns), a desktop-kbm play pass, a walked F1 → F2 → King's lift → F3 run (lift ridden only from the `?floor=2` warp this session).
2. Human / phone: is the Maw fair in portrait (leap ring, quake jump timing, the hook's tell, 1150 HP)? Does the
   Crownheart's breathing read (weights in `Game.applyHeartTone`, ramp in `vfx/Crownheart.ts`)? Passive regen feel
   (1.6/s, cap 100, `TimeSystem` PASSIVE_*). The finishers in portrait (contact now true; framing per variant in
   `Finishers.setShot`).
3. Goblin retarget leftovers: walk feet ~5 cm high, the lunge dips ~11 cm (a proper fix is re-keying the pelvis with
   its rest offset in `build_monsters.py` / `build_enemies.retarget`, then re-measuring GROUND).
4. Play-testing: run your own `npm run dev` (a server started by a Claude session stops with it — that was the
   Floor 2 → 3 'stuck loading' report).

**Session 10 follow-ups (the session-9 brief is DONE — see §10 Session 10):**
1. **Real phone + human playtest** (`npm run dev:lan` → `http://192.168.1.39:5173/`, or the itch zip): the title screen on a
   phone (tap targets, Continue flow), the Guided tutorial end to end by a new player (is each lesson clear? the first
   strike freeze 0.07×, the guard/parry slow blows 0.28–0.3× and the 2.4× parry window in `game/Tutorial.ts`; lesson
   texts in the same file), Minimal guidance by someone who knows action games, the film's sound + subtitles on a phone
   (the film was only checked muted in the browser pane), settings sliders on touch.
2. **Floor 3 by a human**: the Last Crown's difficulty (the real-damage bot never guards/dodges and dies every 40–60 s),
   the Maw (33–35 s for the bot), whether the Present arena and the descent read well on a real phone screen (lighting
   in `levels/Floors.ts` env PRESENT), the E6 skip (a Past player walks past it), the Past iron gate's legibility (dark
   iron; prompt `C_RDOOR`).
3. **Floor 2 autopilot** (test harness only): with session 10's bot fixes it passes the range and the Crown Loft on some
   runs but can still stall after the Gutter King fight at the wardens' range (`src/game/AutoPilot.ts` ROUTES[2] predates
   session 9's F2 rework; the game itself is fine — the stall spot is walkable in 7 of 8 directions). Floor 3 still has
   no autopilot route (`dev/f3Probe.js` route() + `dev/bossBot.js` cover it).
4. Economy note: the lower-bound bot reached Floor 2's G6 (after FR1) with 88 resonance — fissure F5 on the loft level
   covers it (softlock guarantee holds); a human's hits/parries/combos give far more. Watch it in playtests.
5. Layout data: the load-time fixes (`EnemyManager.spawnFixes`: 4 perched archers, 2 blind flyers, the older island
   moves) could be moved into `floor0N_layout.py` so they are in the data (then rebuild + `npm run assets:nav`).

**Session 9 follow-ups — DONE in session 10** (loading screen, main menu + film integration, Guided tutorial,
enemy audit, F2 → F3 lift, Floor 3 playthrough + fixes, Present readability, `LEVEL_03_BLUEPRINT.md` v3.1).

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

### Session 16 (2026-10-01) — the Wavedash version: widescreen PC game, phone Portrait / Landscape, the Wavedash SDK

Commits (Arjun0014/castle-game main, as Arjun0014): `9275e21` code + tools + Wavedash definitions · this CONTEXT commit (only
this session's hunks; session 12's uncommitted hunk of this file stays in the working tree as before). Untouched and
uncommitted as before: `remotion-intro/`, `THE_CASTLE_REMEMBERS_LORE.md`, `docs/ELEVENLABS_NOTES.md`, `assets/music/*.mp3`,
`assets/Echoes_of_Caer_Veyr_All_12_Pages/`.

**0. What was read first.** The current Wavedash docs (fetched 2026-10-01 as Markdown: SDK overview, setup + load
lifecycle, player identity, achievements & stats, cloud saves, fullscreen, functions / events / types references, the
Three.js engine guide, CLI configuration / commands / auth, cross-origin isolation, best practices, upload) and the SDK
package itself (`@wvdsh/sdk-js` 1.3.54: its `StatsManager` and `FileSystemManager` sources). Facts that shaped the code:
- `import Wavedash from '@wvdsh/sdk-js'` **throws at import time when the host has not injected the SDK** — so the package is
  a devDependency used for TYPES ONLY; the runtime reads `window.Wavedash` once (`Wave.attach()`), and the itch build never
  sees the SDK. `tools/audit_dist.py` fails if the package's runtime is ever bundled.
- Stats load in two halves; `requestStats()` can resolve first. Until both are in, `getStat` → 0 and `setStat` /
  `setAchievement` return false and DROP the write (also for identifiers not defined in the portal). The SDK persists
  changes on a 1 s throttle and nothing is flushed when the session ends.
- `downloadRemoteFile(p)` writes the cloud copy into the SDK's IndexedDB store at `p`; `readLocalFile(p)` reads it;
  `uploadRemoteFile(p)` uploads what `writeLocalFile(p)` wrote (one queued upload per file, last write wins).
- `getUser()` = `{ id, username, avatarUrl }` (sync, before `init()`); never asked: `getUserJwt()` (no token is ever
  touched or logged).
- Fullscreen belongs to the host (`requestFullscreen(bool)` from a gesture, `isFullscreen()`, `FULLSCREEN_CHANGED`); under
  `wavedash dev` both requests answer false — fullscreen can only be proven on an uploaded build. Esc leaves fullscreen and
  releases the pointer before the game sees the key (docs: best practices).
- Wavedash runs games cross-origin isolated (COEP require-corp): everything the game loads is same-origin (fonts bundled,
  assets in `dist/`); the only cross-origin request is the player's avatar from Wavedash's own CDN (falls back to an
  initial if it is blocked).

**1. Widescreen, the desktop default** (`platform/Platform.ts`, `ui/platform.css`, `character/CameraRig.ts`, `game/Game.ts`).
- The old internal `?view=wide` is now the PC game. The view is re-evaluated on every resize and switches live: desktop =
  `wide` unless the window is clearly taller than wide (< 0.8 w/h → the jam's portrait stage; back above 0.9), so itch's
  720×1280 embed still gets the portrait layout. `Game.applyView()` swaps the camera profile (`setProfile(id, keep)`: yaw kept,
  pitch clamped), moves the fog with the camera distance (`setFogShift`) and re-frames the title (`menuCamera`).
- Scale: `Platform.uiScale` → CSS `--uiz` = (height / 720)^0.85 on desktop (1366×768 1.06, 1080p 1.41, 1440p 1.80; 0.8–2.2);
  HUD widgets, panels, pause card, toasts, the chapter card and the lore book's header / bar are `zoom`ed. Measured first in
  Chromium 153 and Firefox 155: CSS zoom scales px but not %, and the two engines DISAGREE on container units inside a zoomed
  element — so zoomed widgets use px / % only, and the title's wordmark and list are sized in `cqh` instead (height-based:
  21:9 reads like 16:9). Threat chevrons (placed by code) scale by `max(1, uiScale)`.
- Ultrawide: `CamProfile.maxHFov` (wide 100°, wideTouch 98°) narrows the vertical FOV so a 21:9 frame gets wider, not
  fisheye (3440×1440 → vFOV 53°, hFOV 100°); the title lens is capped at 92° across.
- Off-screen threat chevrons now in every layout (they were portrait-only); verified 3 markers with a fight behind her.
- The widescreen title (redone after the user's review — "the left side looks really bad"): ONE column in the left third
  (`.mm-col`, `ui/menu.css`; `display: contents` in portrait, whose layout is unchanged), everything on its centre line —
  the crest centred over the name, ECHOES OF between two hairlines, CAER VEYR, the rule (two hairlines + lozenge), the
  line, then the menu (Continue / New Game, Lore · Achievements, Controls · Settings · Credits) with even tiers; the group
  is centred in the height (7 cqh between the name and the menu), the keys hint centred under the column. Column width
  min(80 cqh, 46 cqw), the name min(11.2 cqh, 6.1 cqw): checked at 1366×768, 1920×1080, 2560×1440, 3440×1440, 1280×1024
  and a phone held sideways (crest and line step out under 540 px of height). Continue (when there is one) has the
  first focus again.
- Audited in widescreen: title, gameplay HUD, combat, a mini-boss cinematic finisher (Gate Warden, letterbox + shot), the
  Last Crown (boss bar, arena), achievements toast + panel, lore book, pause + settings, chapter card, the film (9:16,
  centred in its glow), subtitles, threat markers. Paused: the floor title / prompts / subtitles / tutorial card step back
  behind the pause card (`html.paused`).

**2. Phones: PORTRAIT or LANDSCAPE** (`ui/DisplayChoice.ts`, `Platform.displayPref`, `TouchControls.ts`, `ui/platform.css`).
- First start on a handheld (after loading, before the title): HOW WOULD YOU LIKE TO PLAY? — two cards drawn like the
  chapter card, each showing the device with its layout (stick under the left thumb, seals under the right). The choice is
  kept (`caer-veyr:display` + its time, and in the cloud save) and Settings → Display (handhelds only) changes it any time.
  Before a choice the layout follows how the device is held (no rotate card before the question).
- LANDSCAPE: the tap itself asks for fullscreen (Wavedash's `requestFullscreen` on Wavedash, the browser's elsewhere) and a
  landscape orientation lock; refused (iframe, iOS) → the rotate card: "Rotate your device to landscape" + "Play in portrait
  instead". The same card works the other way for a Portrait player held sideways. Turning or switching never reloads.
- Landscape touch layout: see §7 Controls (Touch, LANDSCAPE). Camera profile `wideTouch`: distance 4.95 (combat 4.75, fight
  pull ×0.6 up to 1.3 m), shoulder 0.26, height 1.6, pitch 0.33, slight lens shift, the portrait camera's low-ceiling care;
  the soft combat camera (touch) frames fights.
- PORTRAIT is the session-15 layout untouched (regression 49/49 below).

**3. The Wavedash SDK** (`platform/Wavedash.ts` — the only file that touches `window.Wavedash`).
- Lifecycle: `Wave.progress(f)` → `updateLoadProgressZeroToOne` (monotonic) from the first byte to the floor's GPU warm-up;
  `Wave.ready()` → `init({ debug: DEV })` exactly once, when the title can show (after the cloud save is decided — at most
  7 s), or at once on a quick start, or on a load error (so TRY AGAIN is visible). Verified with the mock: 1 init, 36
  progress calls ending at 1.
- Connection: BACKEND_CONNECTED / RECONNECTING / DISCONNECTED + `online` / `offline` → `Wave.online`, `onConnection`
  (a CONNECTED always notifies: the game may have believed itself online while storage failed).
- Outside Wavedash every call is a guarded no-op: a local / guest game. No Wavedash checks anywhere else in the game
  (CloudSave / WavedashStats / Platform's fullscreen ask the facade).

**4. Player identity.** `Wave.player()` from `getUser()` (id, username, avatarUrl). The title shows a quiet "Playing as" chip
(top-right in widescreen, top-left in portrait): the avatar (or the name's initial in a crimson seal), the name, and the
cloud save's state ("Cloud save · 21:14", "Saving…", "Offline · saved on this device", "Two saves disagree"). No login UI.
Local storage keys get `:u:<player id>` on Wavedash (`platform/Storage.ts`), so two accounts in one browser never share or
push each other's progress; outside Wavedash the jam-build keys are unchanged (itch saves carry over).

**5. Achievements + stats** (`platform/WavedashStats.ts`, `data/wavedash.ts`, `game/Achievements.ts`).
- The game's own 26 achievements stay THE system (banner, panel, local store). WavedashStats mirrors them once a probe
  proves the stats are loaded — `setStat(id, getStat(id))`, a write that changes nothing and only succeeds when both halves
  are in and the identifier exists (≤ 20 s; then quietly every 2 min and on reconnect). Sync = pull (an achievement Wavedash
  has that the store lacks → `adopt`, silent; a larger stat → `adoptCounter`, goals it completes unlock silently) then push
  (`setAchievement` for every local unlock it lacks, `setStat` where counts differ — never lower — and one `storeStats()`).
  Live: unlocks `setAchievement(id, true)`, counts `setStat` (SDK-throttled), `storeStats()` on hide / pagehide.
  No repeated banners: only a deed earned here toasts; the store never unlocks twice.
- New cumulative counters (stats only): `bosses` (kills with `boss: true` + the Last Crown), `crownbreakers` (each release),
  `whirlwinds` (each spin), `completions` (once per ending).
- Identifiers (STABLE — `src/data/wavedash.ts`): floor1 INHERITANCE · floor2 COMPLICITY · ending THE_CROWNHEART_IS_SILENT ·
  gate_warden THE_WARDEN_FALLS · untouched UNTOUCHED · goblin_king GUTTER_CROWN · widow_mother THE_WEEPING_MOTHER · kingsguard
  OATH_UNSWORN · maw THE_MOUTH_BENEATH · parry TURNED_ASIDE · parries THE_UNBROKEN_GUARD · five_cuts FIVE_CUTS · finisher
  THE_LAST_BLOW · finishers HEADSMAN_OF_VEYR · execution NO_MERCY_IN_MEMORY · crownbreaker CROWNBREAKER · whirlwind
  THE_WHIRLWIND · released RELEASED · first_shift WHICH_MEMORY_WILL_ANSWER · shift_kill BETWEEN_TWO_BREATHS · shifts
  TWO_MEMORIES_ONE_STONE · unremembered UNREMEMBERED · queen_letter THE_QUEENS_LETTER · traces WHAT_THE_STONES_CONFESSED ·
  chronicle THE_CHRONICLE_OF_CAER_VEYR · patience PATIENCE_OF_STONE. Stats: ECHOES_RELEASED (kills) · FINISHERS · PARRIES ·
  TIME_SHIFTS · BOSSES_FELLED · CROWNBREAKERS · WHIRLWINDS · MEMORY_TRACES · LORE_PAGES · GAME_COMPLETIONS.
- Portal: `npm run wavedash:defs` → `wavedash/achievements-import.json` (26 achievements, 4 secret, 6 stat-triggered:
  RELEASED ≥150 ECHOES_RELEASED, HEADSMAN ≥25 FINISHERS, UNBROKEN_GUARD ≥30 PARRIES, TWO_MEMORIES ≥40 TIME_SHIFTS,
  STONES_CONFESSED ≥20 MEMORY_TRACES, CHRONICLE ≥12 LORE_PAGES; 10 stats) + `wavedash/cli-commands.txt`; 26 medal icons
  (256², the game's own devices on the crimson seal) in `wavedash/icons/<ID>.png`.

**6. Cloud saves** (`platform/CloudSave.ts`, `game/Save.ts` v2).
- File `saves/main.json` = `{ format: 'echoes-of-caer-veyr', version: 1, savedAt, device, progress, achievements, prefs }`:
  `progress` = Save v2 `{ v: 2, floor, guidance, learned, bestiary, deaths, playTime, finished, checkpoint, savedAt, device }`
  with `checkpoint = { cid, state, charge, unlocked, shifts, cleared[], flags[], sigils[], traces[], yaw, arriveDeaths }`;
  `achievements` = the store (merged by union / max in every direction); `prefs` = settings + their time, the display
  choice + its time, the LOOK hint learned. v1 saves migrate on read (`validateSave`); unknown future fields are ignored.
- **Sigil saves** (new): Continue now wakes her at the last Blood Sigil with that floor's memory restored (fractures,
  cleared encounters, lit sigils, read traces, Resonance), exactly like a respawn — Floor I too, once CP1 is lit. Autosave:
  floor arrival, every sigil, a boss, a cleared encounter (local; the cloud gathers it), quitting to the title (the
  upload is awaited ≤ 2.5 s before the reload), the ending. A Guided Floor I resumes its lessons where she wakes (CP1 →
  TWO MEMORIES, CP2 → CROUCH, CP3+ → done; `Learned.tutorial`). New Game warns on its panel that the saved journey is
  replaced at its first sigil and sets the old save aside (`caer-veyr-save:set-aside`).
- **Conflict safety**: each progress copy carries a stamp (savedAt + device); the browser remembers the stamp it last saw in
  the cloud (`caer-veyr:cloud.base`). Same stamp → nothing; cloud still at base → upload; this device still at base →
  adopt the cloud (Continue updates under the title); both moved on → the newer wins IF it is not behind the other (floor,
  then sigil), else a GENUINE conflict → "TWO MEMORIES OF YOUR JOURNEY" (`ui/CloudConflict.ts`): CLOUD SAVE / THIS
  DEVICE with floor, sigil, deaths and date; the further one is preselected; the other is set aside locally, never
  destroyed before the choice. Every upload first re-downloads and re-checks (another device may have saved); a conflict
  found DURING play stops uploads and waits for the title. An unreadable cloud file is kept aside locally.
- Offline: play from the local copy, `pending` marked, retried on reconnect / `online` / every 60 s. Uploads only at save
  points (forced: floor, sigil, boss, quit, ending, reconnect, hide; gathered: achievements / settings, ≥ 15 s apart).
- In play a small mark says so for a moment ("Saving" → the cloud "Saved", or "Saved on this device") — never a banner.

**7. Fullscreen.** Settings → Fullscreen (where the page can ask): on Wavedash `requestFullscreen(!isFullscreen())`
through the SDK (its overlay stays on top), elsewhere the browser's own; the label follows `FULLSCREEN_CHANGED`.
Landscape's choice tap and New Game / Continue on a handheld ask for it inside their gesture. Losing the pointer lock in play
(Esc, leaving fullscreen) now opens the pause menu once (`Game.pauseKeyHold` stops the same Esc un-pausing it).

**8. Build / tools.** `wavedash.toml` (upload_dir `./dist`, entrypoint `index.html`, `game_id = "YOUR_GAME_ID_HERE"` — the
real ID is needed), `npm run build:wavedash` (build + `tools/audit_dist.py`: no dev / mock / SDK runtime / secrets, relative
URLs, size: 571 files, 163.5 MB), `npm run wavedash:dev` (build + `wavedash dev`), `npm run wavedash:push` (build + `wavedash
build push`), `npm run wavedash:defs`. The itch path is unchanged (`npm run package:itch` → 134.4 MB ZIP, audit OK).

**Tests (session 16)** — all in this machine's Chromium 153 (playwright-core 1.63, real GPU via ANGLE/D3D11; the gstack
browse daemon was stuck on a stale lock) unless noted, always `?mute`:
- tsc; `npm run build`; `npm run build:wavedash` (dist OK); `npm run package:itch` (ZIP OK).
- `dev/regression.js`: **portrait touch 375×812 49/49**, **desktop wide 1920×1080 + `?wdmock&saves&ach` 45/45** (the 4 touch
  checks skip on kbm; ended on Floor 3 with the save synced), **landscape touch 852×393 49/49** (its layout checks now
  per-layout: the middle camera band empty; Attack lower-right, Heavy left, Guard up-left within a slide).
- `dev/tutorialProbe.js`: **portrait touch 23/23 lessons, desktop wide 24/24**. It had stalled at CP3 since before this
  session (verified on an untouched HEAD worktree: Echoes the probe walked past made the sigil refuse); the probe now releases
  them before kneeling.
- Desktop: titles + play at 1366×768, 1920×1080, 2560×1440, 3440×1440 (vFOV 53 / hFOV 100); Firefox 155 at 1920×1080 (same
  HUD rects); the widescreen audit list in §1 above.
- Phone emulation (393×852 ↔ 852×393, DPR 2, touch): the choice card; Landscape while upright → fullscreen asked + the rotate
  card → turned → wide title, `wideTouch` play; multitouch: stick + camera together (analog 0.43/0.57, camera turned 2.5 rad),
  a third finger's ATTACK, the camera keeps turning after the stick lifts; pause → Settings → Portrait → rotate card →
  turned → portrait play, 1 page load in all; first boot held sideways (no rotate card, compact boot card), Portrait chosen →
  "Rotate your device to portrait" + "Play in landscape instead"; tablet 1180×820 landscape (UI 1.3, seals 1.45).
- Mock Wavedash (`?wdmock`): warp autosave at CP1 → uploaded; stats probe: 31 refused probes before ready, then a parry + a
  kill → PARRIES 1, ECHOES_RELEASED 1, TURNED_ASIDE on the "server", 1 banner; reload → title "Continue · Floor I ·
  Inheritance · Blood Sigil 1", chip "Playing as Wanderer of Veyr · Cloud save · 17:23"; Continue → woke at CP1 (PAST, E1/E2
  cleared, shifting on); genuine conflict (cloud Floor III older vs this device Floor I newer) → the panel, cloud
  preselected, kept → Continue Floor III, the device copy set aside, cloud re-uploaded; another device further ahead and this
  one unchanged → adopted silently; offline start → play → autosave kept locally → `offline(false)` → uploaded; a new
  device (game storage wiped, cloud kept) → Continue from the cloud, the deed and its count restored silently (0 banners);
  Settings → Fullscreen through the SDK (on / off). Guided resume: CP1 → TWO MEMORIES, CP2 → CROUCH, CP3 → no lessons.
- Production preview (no Wavedash): local guest game, no chip, `?wdmock` ignored, widescreen title; 720×1280 frame → portrait.
- **NOT tested**: `wavedash dev` and an uploaded Wavedash build (the CLI is not signed in and there is no game ID), the real
  avatar CDN under COEP, host fullscreen, a real phone (landscape ergonomics, orientation lock inside Wavedash's frame, notch
  safe areas), Safari / WebKit, pointer-lock Esc pause (headless has no pointer lock).
**Needs the user:** §8 Session 16.

### Session 15 (2026-09-30) — the living title screen, achievements, the narrated lore book

Commits (Arjun0014/castle-game main, as Arjun0014): `6e661a9` code + assets · this CONTEXT commit (only this session's hunks; session
12's uncommitted hunk of this file stays in the working tree as before). Untouched and uncommitted as before:
`remotion-intro/`, `THE_CASTLE_REMEMBERS_LORE.md`, `docs/ELEVENLABS_NOTES.md`, `assets/music/*.mp3`, and the user's source
pages `assets/Echoes_of_Caer_Veyr_All_12_Pages/` (their byte copies ship in `public/assets/lore/`).

**1. The title heroine faces the player and is alive** (`character/MenuIdle.ts`, `Game.menuScene / menuFrame /
loadMenuPack / menuPause`, `AnimController.addClips / removeClips`).
- *Facing and shot.* The camera stands where it always did (on the gate's side of her, looking past her at the rusted
  gate); she is turned round toward it: `root.rotation.y = yaw + π + side + face` (portrait `face` −0.38 rad, wide
  −0.45 → measured 26–28° off the lens: a three-quarter view). Portrait shot `dist 3.95, h 1.25, look 2.2, ty 0.45`
  (her head clears the tagline, the raised blade crosses the gap in CAER VEYR, feet above the menu); wide `dist 4.1,
  h 1.35, look 5, ty 1.15, lat −2.6` (she stands in the gate arch, right half). Her hero light moves to the camera's
  side ×1.35 for the title (a soft key on her face; the moon is behind her). Play restores `root.rotation.y = yaw`.
- *Clips inspected first* (`tools/blender/inspect_pack.py` → `build/analysis/menu/inspect.json` + `sheet_0..2.png`, and
  16-frame front close-ups): the 4 new FBX in `assets/characters/hero/` — **Angry** (19.2 s: sword low → arms crossed with
  the blade on her shoulder → leaning on the planted blade, hand on hip, weight shifts; a real step, one ankle lifts
  0.33 m), **Arm Stretching** (8.9 s: sword arm across the chest, one calm overhead swing, shoulder roll), **Taunt**
  (2.8 s: two-handed high guard swaying), **Martelo 2** (1.3 s capoeira high roundhouse kick — **not used**: a big
  flashy attack; `hero_clip_map.json unusedMenu`) — plus every hero idle and the unused Great Sword idles (2)–(5), which
  turned out to be exactly the sword inspection / blade-raise / at-ease-and-look-round moves. All stand in place (root
  travel ≤ 1 cm, yaw ≤ 0.3°).
- *The menu pack*: `tools/blender/build_hero_menu.py` (run Blender directly: `blender --background --factory-startup
  --python tools/blender/build_hero_menu.py`; `npm run assets:heromenu` hits cmd.exe quoting like the other Blender
  scripts) → `public/assets/characters/hero_menu.glb` (1.44 MB, armature + 7 clips, no mesh; the same export options as
  hero.glb so tracks bind to its 65 bones by name) + `src/data/heroMenuAnimations.json`. Root policy "loop" (the tiny
  first→last hips drift removed linearly; the hips' own sway kept, so feet stay planted). Asset key `glb:hero-menu`,
  scope `menu`: acquired when the title shows (`main.ts` → `game.loadMenuPack()`), released + clips uncached when play
  begins (`menuScene(false)`). Gameplay's hero.glb is unchanged.
- *Selected* (`MenuIdle.ts` `MENU_HOME / MENU_MOVES`, weights): home loops `idle_alert` (hero.glb, breathing guard) and
  `menu_stance_2h` (GS idle (2), two-handed breathing guard); actions `menu_inspect` 1.25 (GS idle (3), the blade raised
  upright, looked along), `menu_vigil` 1.0 (GS idle (4), blade close before her face), `menu_ease` 1.1 (GS idle (5),
  sword lowered at ease, a look round), `idle_flourish_a` 0.9 (calm swing), `idle_flourish_b` 0.75 (slow twirl),
  `menu_stretch` 0.8 (Arm Stretching), `menu_restless` 0.6 (Angry), `menu_ready` 0.3 (Taunt).
- *Director*: first beat 4–6 s after the title opens, then 7–13 s at home between actions; 22 % of beats are a stance
  change instead (base cross-fade over ~1.5 s: `baseResponse` 1.6 during the title, 12 restored after); an action fades
  in over 0.8 s (1.0 for the long ones) and hands back 0.9 s before its end; never one of the last three. Between actions
  a procedural glance (neck 40 % / head 60 %, applied after the mixer from the head's real facing): at the player
  (weight 3), free (2), left/right 38° (1 each), up at the towers (0.6); holds 1.4–5 s; clamps yaw 42°, up 16°, down
  10°; eased; off while an action plays (the clips carry their own head motion). No locomotion, no attacks.
- *While the chronicle is open* the castle behind it stops drawing (`menuPause`), then carries on.
- *Verified* (`dev/menuProbe.js`, frames driven by the probe — the hidden pane has no rAF): `run(150)` → 11 events (8
  actions, 3 stance changes, 13–17 s apart), 0 bad frames; `all()` every clip every 0.25 s → hips scale 0.0100 always,
  no NaN, ankles 0.157–0.161 m (planted; `menu_restless` 0.331 is its real step), hips drift ≤ 0.24 m; screenshots
  portrait 375×812 and wide 1280×720 (inspect / vigil / guard, facing the viewer); production: New Game → facing 0 offset,
  `baseResponse` 12, no overlay left, `menu_*` clips removed, `glb:hero-menu` released, 0 console errors.

**2. Achievements** (`data/achievements.ts`, `game/Achievements.ts`, `ui/AchievementToast.ts`, `ui/achievements.css`,
`MainMenu achievementsHTML / wireAchievements`, pause menu entry, `AudioFX.achievement()`). 26 deeds in six groups, five
cumulative. New gameplay signals (`game/Signals.ts`): `hit {attack, serial, index}` (EnemyManager, each blow that
connects), `parry` (Game onBlock), `floor:arrive {id, deaths}` (Game.start), `floor:leave {id, next, deaths}` (Game.finish).
| id | Name | Trigger |
|---|---|---|
| floor1 | Inheritance | `floor:arrive` id ≥ 2 |
| floor2 | Complicity | `floor:arrive` id 3 (the King's lift) |
| ending | The Crownheart Is Silent (hidden) | `boss:dead last_crown` or `floor:leave` id 3 with no next |
| gate_warden | The Warden Falls | `kill` arch gate_warden |
| untouched | Untouched | the Warden killed with no HP drop since `boss:start gate_warden` (polled 10×/s; a death resets) |
| goblin_king · widow_mother (hidden) · kingsguard · maw | Gutter Crown · The Weeping Mother · Oath Unsworn · The Mouth Beneath | `kill` of that arch |
| parry · parries | Turned Aside · The Unbroken Guard | `parry` (1 · 30) |
| five_cuts | Five Cuts | `hit` L1→L2→L3→L4→L5 in order, each within 2.5 s, one chain |
| finisher · finishers | The Last Blow · Headsman of Veyr | `finisher` (1 · 25) |
| execution | No Mercy in Memory | `kill` with execution and not a finisher |
| crownbreaker | Crownbreaker | 3 kills within 1.8 s of `ability crownbreaker release` |
| whirlwind | The Whirlwind | 4 kills between `ability whirlwind start` and 0.8 s after its end |
| released | Released | 150 kills (cumulative, all runs) |
| first_shift · shifts | Which Memory Will Answer · Two Memories, One Stone | `shift` (1 · 40) |
| shift_kill | Between Two Breaths | a kill ≤ 3 s after a shift |
| unremembered | Unremembered | `floor:leave` with the same death count as `floor:arrive` |
| queen_letter | The Queen's Letter (hidden) | `trace` T3 on Floor 2 |
| traces | What the Stones Confessed | 20 distinct traces (`TRACE_TOTAL` F1 12 · F2 5 · F3 3, keyed `floor:tid`) |
| chronicle | The Chronicle of Caer Veyr | all 12 lore pages shown |
| patience | Patience of Stone (secret) | the title left alone and visible for 180 s (not while the book / film / a hidden tab) |
- *Persistence*: localStorage `caer-veyr:achievements:v1` = `{v:1, unlocked{id: time}, counters{kills, finishers, parries,
  shifts}, traces[], lore[]}`, try/catch (blocked storage plays on). Memory only in automation (`?mute`, autopilot,
  webdriver) and on dev floor starts, unless `?ach` (tests). The panel's "Forget every deed" asks twice.
- *Toast*: a gilt lozenge seal with the deed's device, "Achievement", the name, the line; slides in, a sheen crosses it,
  holds 4.9 s, queued, `pointer-events: none` (never takes a tap, never pauses). Portrait: under the bars / boss bar
  (13 % of the height), 20.5 % while a subtitle shows, 29 % while a Guided card shows; wide: top-right; on the title
  3 %; over the chronicle below its header. Chime: a soft synthesized bell (A5/E6/A6 + A4, 1–2.6 s decays, 0.11 × effects
  level) + a breath of the Resonance sample.
- *Panel*: a ring with the count, each group with its tally, unlocked rows (crimson seal, "Remembered <date>"), locked
  (lock badge), hidden ones show only a hint (the secret shows "A Secret" + an eye), progress bars for the counters. The
  Achievements entry on the title shows a small tally (e.g. 2 / 26).
- *Verified*: `dev/achProbe.js unit()` **27/27** through the real signal bus incl. the negatives (a kill 3.2 s after a
  shift, a broken chain, 2 Crownbreaker kills, a wounded Warden fight, a death on the floor, a finisher that is not an
  execution, duplicate trace / page); a real Gate Warden finisher on `?at=warden` (`S.mini`) unlocked The Last Blow +
  The Warden Falls with the toast shown mid-fight (game not paused), not Untouched (the probe set HP 60); persisted across
  a reload (`?ach`); the patience secret after 6 visible seconds with `?patience=6`; panel screenshots (groups, locks,
  hints, progress 7/30, 1/25, 12/150).

**3. The chronicle — the Lore book** (`ui/LoreBook.ts`, `ui/lore.css`, `tools/lore/*`, `public/assets/lore/*`,
`data/loreManifest.json`).
- *Page order*: the 12 WebP pages (`Page_01..12.webp`, 1024×1536) carry printed folios 01–12 matching their names, and
  read as one story in that order: 01 Before the First Crown · 02 The Blood That Opened Stone · 03 A Kingdom Built on
  Memory · 04 The Last Days of Veyr · 05 The Price of Forever · 06 A House Divided · 07 The Sundering · 08 Those Who Could
  Not Leave · 09 The Uncrowned · 10 Which Memory Will Answer? · 11 What the Stones Confessed · 12 The Last Crown.
- *The book*: full-screen over the title; the page in a thin gilt frame at the largest 2:3 that fits (JS fit), the ground
  its own colours blurred far out + a warm vignette; header: close · "The Chronicle of Caer Veyr" + the page title ·
  folio `04 / 12`; the spoken line under the page (fades per cue); bar: pause/resume · 12 lozenge dots (seen / current,
  tap to jump) with the page's narration hairline · CC (= the game's Subtitles setting). Swipe (finger follows, 0.28
  resistance at the ends, turn at 16 % of the width or a 0.42 px/ms flick; a vertical drag is ignored), mouse drag,
  arrows beside the page (desktop), ←/→ A/D PgUp/PgDn Home/End, Space/K/P pause, C subtitles, Esc/Backspace close,
  wheel/trackpad flick; a tap on the page = the clean view (artwork alone). A fast second swipe lands the sliding page at
  once. After page 12: "Here the chronicle of Caer Veyr ends." + From the beginning / Return.
- *Auto / manual*: a page's narration starts 0.35 s after it has turned in (0.9 s after opening); when it ends, a 1.7 s
  beat, then the next page turns in by itself. Any manual change stops the narration at once (0.22 s fade; a token
  cancels any pending start — never two narrations), plays the new page from its beginning (backwards too) and restarts
  the auto timing; a manual change also lifts a pause. Pause keeps the position, resume continues from it.
- *Music*: the title score is never restarted; each narration ducks it to 0.5 (`Music.duck(on, level, release)` gained a
  level and release; 1.2 s release between pages); narration plays on the voice bus (the Voice slider).
- *Memory*: images decoded for pages p−1 … p+2 only (`Image.decode`, ~6.3 MB each decoded), narration bytes for the same
  window, PCM only for the current and next page; leaving pages are released (src cleared, buffers dropped); closing the
  book drops everything. 24×36 blurred JPEG placeholders (~1 KB each) are inline in the manifest (instant first paint +
  the ambient ground). No resizing was needed (the WebPs are 371–466 KB). No audio (locked context, failed decode) → a
  silent clock keeps subtitles and auto-advance going.
- *Verified* (dev `?mute&scoretest` = the score loaded and running silently — master 0): opened from the menu with the
  score at 28.5 s (explore), duck 1 → 0.5 within 1 s of the first word; page 1 end → "ended p1", the score rose 0.5 →
  0.82 in the beat → "p1->p2 auto" → page 2 narration from 0.0, duck 0.5 again; window at p2 = images 1–4, PCM 2–3; dot
  jump p2→p5 stopped p2 and started p5 from 0 (images 4–7, PCM 5–6); swipe back p5→p4 replayed p4 from 0; pause held
  the time (0.44 s), resume continued from 0.4; synthetic touch swipes (left → next, right → previous, slow small drag →
  snap back, short fast flick → next), keys (→ ← End, → at 12 stays), the prev arrow, Space, C; all 12 pages → The
  Chronicle of Caer Veyr (toast); closed with Esc: the score still exploring, never restarted, duck recovering. JS heap
  229 → 233 MB across all 12 pages; at page 12 only 2 images + 1 PCM held, 3 `<img>` in the DOM. Screenshots: phone
  375×812, 720×1280, wide 1280×720.

**4. The narration** (`tools/lore/narration.json` = the source: one subtitle cue per line, `[tag]` = a v4 direction
spoken only, `{Display|spoken}` = the subtitle spelling | the respelling).
- *Narrator.* The user's voice "Cthulu female" (`VhuTJN7jTXadMoTbfY1r`, designed with `eleven_ttv_v3`: "very low
  contralto … immeasurably old") lives only on `ELEVENLABS_API_KEY` (free tier, 129 credits left); the paid key
  `ELEVENLABS_API_KEY_2` (Starter) cannot see it (400 voice_not_found). ElevenLabs' v4 page says designed voices "may not
  be as performative" on v4 while Instant Voice Clones are captured "more faithfully", so the voice was carried to the
  paid account as an **IVC: "Cthulu female - v4 narrator (IVC)", voice_id `JSIqdqOB9ZIcrBFOti5d`** (`tools/lore/
  clone_voice.mjs`, `tools/lore/voice.json`), trained on four of the original voice's own v3 generations downloaded free
  from the free account's history (65 + 61 + 16 + 74 s = 216 s, one style; `build/lore/clone_src`, not committed).
  A/B on v4, same line, same settings (`tools/lore/voice_ab.mjs`): original F0 140.4 Hz / centroid 1384 Hz, clone 136.8 Hz
  / 1391 Hz (0.45 semitone, 0.5 %); 24-band spectral shape 3.0 dB apart (both 4–6 dB from the v3 history: v4 itself
  shifts the timbre a little).
- *Guidance applied* (elevenlabs.io docs, fetched this session): `eleven_v4`, Stability + Similarity only (no style /
  speed / SSML), tags placed right before the words they colour and written as voice qualities (`[low, reverent
  narration]`, `[whispering]`, `[hushed, urgent]`, `[slowly, with restrained awe]`, `[quiet dread]`, `[rising dread]`,
  `[heavy, final]`, `[sorrowful]`, `[measured]`, `[grave, restrained]`, `[low, ominous]`, `[slowly, with weight]`), 0–3
  per page, pauses from ellipses and dashes, names respelled (Vair, Kair Vair, Vaylor).
- *Settings*: `eleven_v4`, stability 0.5 (0.3 sounded the same on the test lines), similarity 0.75, seed 7,
  `mp3_44100_128` (192 kbps needs Creator), `/with-timestamps`. Test takes first (`gen_lore.mjs test`): 6 lines ×
  stability 0.5 / 0.3; page-1 pacing tests (paragraph breaks, a lead "[slow, measured, ancient narration]": 131 → 125 wpm —
  v4 barely slows for tags, so the cadence is made in the build instead).
- *The take*: **`b1` = all 12 pages in ONE request** (one performance arc; 5,098 characters, 363.4 s, rendered in 130 s).
  Scribe: 805 words, 97.9 %, the 17 edits all name spellings ("Verre" for the respelled Vair, "Aldrin"), no tag read
  aloud; per-line F0 136–192 Hz with a steady ~120 Hz floor on every page (no drift over six minutes); whispers verified
  as whispers (periodicity 0.24–0.27, ~12 dB under the voice). Credits: ~6,850 characters in all on key 2 (tests + book;
  v4 = 1 credit/char; the subscription counter lags), ~25.3k left, resets 2026-10-30. Ledger: `assets/audio/lore/ledger.json`.
- *Build* (`python tools/lore/build_lore.py` = `npm run assets:lore`): pages and lines cut on Scribe's word timings of the
  take aligned word by word to the script (the TTS character alignment drifted 2–3 s around pages 5/6 — page 6's first
  sentence would have ended page 5 — so it is only a fallback), refined on the envelope; the pause after each line opened
  to ≥ 0.75 s (≥ 1.1 s before a page's last line), 0.2 s lead-in, 0.6 s tail — the voice is never time-stretched; a gentle
  compressor (−26 dB, 2.2:1) so whispers survive the score, two-pass loudnorm −18 LUFS; Opus 64 kbps mono 48 kHz. 391 s,
  28–37 s a page, 3.4 MB. `node tools/lore/qa_pages.mjs`: every page holds exactly its own words; the remaining flags
  are the names' spellings and Scribe folding a pause into "Should".
- *The twelve narrations* (as subtitled; the spoken text with tags is `tools/lore/narration.json`):
  - **01 · Before the First Crown** — Before Veyr had a name… before any crown was forged, or any king was laid in stone… something slept beneath the mountain. And it remembered. It kept the shape of stone. The hollow of every chamber. The weight of everything that came near it — and it let nothing go. Centuries later, the founders of House Vaelor broke through into the dark… and found it waiting. They called it the Crownheart.
  - **02 · The Blood That Opened Stone** — The first rulers did not understand what they had found. They learned only this… it answered to blood. So they gave it theirs. Before the ancient ring, the first king opened his palm… and the stone drank. Doors that were never built for human hands swung open. Hidden chambers breathed again. Preserved memories obeyed. And a promise became a belief… and the belief became law. The castle remembers its rightful king.
  - **03 · A Kingdom Built on Memory** — Caer Veyr rose above the Crownheart. Walls became towers. Towers became halls. And generations passed beneath its banners. Every coronation deepened the binding. Every royal rite drew the castle closer to the blood. House Vaelor believed it owned the Crownheart's memory… It never understood… that the Crownheart was learning House Vaelor.
  - **04 · The Last Days of Veyr** — Under King Aldren Vaelor, a long war came home at last. The fires of the siege burned from one horizon to the other. Behind the gates, the people of Veyr crowded into the halls… and waited for the end. But the king did not wait. By candlelight, deep in the royal archives, he searched the records of his fathers… and he found a possibility. The whole of Caer Veyr… held forever, at one chosen moment.
  - **05 · The Price of Forever** — But the Crownheart could not hold so much without living resonance. It needed lives, bound into its memory… thousands of them. Aldren looked upon the people sheltering inside his walls… and he chose them. To him, losing the kingdom was a greater crime than sacrificing those who lived in it. The deepest chambers were sealed. Guards turned to face inward. Servants vanished in the night… and the work began.
  - **06 · A House Divided** — Some at court learned what the king intended… and tried to stop him. And Caer Veyr turned against itself — soldiers of Veyr cutting down soldiers of Veyr, beneath the same banners. In the chaos, a child was taken from the castle. Royal blood, never acknowledged… never marked… never bound by the rites. A servants' door. A hand in the dark. The moon over the walls. That forgotten branch of House Vaelor would endure… long after the ruin.
  - **07 · The Sundering** — At the height of the siege, Aldren descended to the Crownheart and began the ritual. The bells of Caer Veyr rang out… and the ritual was interrupted. The Crownheart failed to hold one moment. The ancient ring broke apart, and its memory tore in two — the castle as it stood before the catastrophe… and the ruin it would become, generations later. Two remembered states, locked in the same stone. This was the Sundering.
  - **08 · Those Who Could Not Leave** — Generations passed. The road to Caer Veyr vanished beneath the forest, and ordinary life abandoned it. But not everything left. Thousands of human imprints remained within the Crownheart… the Echoes. Some still remember who they were. Others keep watch at doors that no longer matter… repeating an order, long after its meaning died. And sometimes, in windows that fell centuries ago… a torch is burning.
  - **09 · The Uncrowned** — The child who escaped did not die. Her line went on, far from Veyr — a worn crest, a half-forgotten name, a warning about a castle no one should enter. And from that unbound line came a woman… with a claim to the ruin. Vaelor blood, without the completed binding. Connected to the castle… yet not imprisoned by it. She came to reclaim a stolen inheritance. She was the Uncrowned.
  - **10 · Which Memory Will Answer?** — Inside, the Echoes rose against her. And when they fell, they released the resonance trapped within them… and her blood could gather it. With that power, she could force the castle to choose… and another memory would answer. Rubble gathered itself back into walls. Torches burned where only moonlight had been. She did not travel through history. The castle changed… around her.
  - **11 · What the Stones Confessed** — But the castle's two memories did not agree. A door that stood sealed in the Past… lay broken outward in the Present. The wounds were in the wrong places. The stones told a different history. The people of Caer Veyr had not been defending their king. They had been trying to escape him. The siege was real. But the catastrophe… was Aldren's.
  - **12 · The Last Crown** — Aldren did not die in the Sundering. He remained… fused with the Crownheart, until king, castle and memory could no longer be told apart. The Last Crown. He still believes Veyr can be saved. And her unbound blood… might finish his ritual. She had come to claim her inheritance. Now she had to ask… should this inheritance survive at all?
- *Canon note*: the book (the user's pages) states Aldren's guilt and the Last Crown outright; the narration follows it and
  keeps the Queen unnamed ("a hand in the dark") — her rescue stays Floor 2's T3 revelation.

**6. The itch upload showed "Rotate your device to portrait" on a grey page (fixed).** The first itch upload loaded no
script and no styles: `npm run package:itch` zipped with Windows PowerShell 5.1's `Compress-Archive` (module 1.0.1.0),
which stores 571 of the 572 entries with backslashes (`app\index-….js`, `assets\characters\hero.glb`); itch unpacks on
Linux, where those are flat file names, so every `./app/…` and `./assets/…` request 404s and only the bare HTML was left —
including the rotate prompt, which the stylesheet normally hides. The audit had passed it because Python's zipfile turns
"\" into "/" when it reads a ZIP on Windows. Fixes: `tools/zip_itch.py` writes the ZIP with forward-slash names (media
stored, the rest deflated, no directory entries; 571 files, 134.4 MB); `tools/audit_itch.py` reads the central directory
bytes itself and fails on any backslash (it fails the old ZIP); `index.html` keeps `#rotate` `hidden` (Platform sets
`hidden` with its `on` class) and shows a plain "ECHOES OF CAER VEYR" line until the code runs, which becomes "The game
files did not load. Please reload the page." after 25 s if it never does (`window.__booted`, removed by `main.ts`).
Verified: the new ZIP extracted under `/html/123456/` inside a 720×1280 iframe (`build/itch-sim/embed.html`, like itch's
embed) → the title screen, 0 failed requests; a copy without `app/` → the load message, never the rotate prompt; a
handheld held sideways (740×360) → the styled rotate prompt; turned upright → hidden, stage 375×812.

**5. The title menu, three tiers** (`ui/MainMenu.ts`, `ui/menu.css`): Continue / New Game (the way in, as before) · Lore
and Achievements (a pair with their devices, the tally) · Controls · Settings · Credits (a quiet row). ↑/↓ move by row,
←/→ along a row. Keys are ignored under the chronicle (`lore-on`). The pause menu gained Achievements.

**Tests (session 15):** tsc; `npm run build`; **`dev/regression.js` 49/49 PASS** (portrait touch, F1 → F2 → F3; a first
run had one miss in "F1 E3 no stalls with a moving hero" — a guard strafing at 6.4 m — which passed on the re-run: the
stochastic stall check, nothing this session touched); `dev/menuProbe.js` run / all; `dev/achProbe.js` unit 27/27 +
the real Warden finisher + reload; the lore flows above; production preview (:4174) title → chronicle → New Game (0
errors); **`npm run package:itch`** → `build/caer-veyr-itch.zip` **134.1 MB, 572 files, 163.5 MB unpacked**, audited by
`tools/audit_itch.py` (index.html at the root, forward-slash names, relative URLs, no .env / keys / source packs / dev
files / maps, itch limits) — then the ZIP itself extracted under `/html/123456/` (itch's layout, `itch-sim`) at
720×1280: title, the chronicle narrating, a Guided New Game with the touch HUD, 0 failed requests, 0 console errors.
Always `?mute` (the user's rule); the score was only ever measured silently (`?scoretest`).
**Needs the user:** §8 Session 15.

### Session 14 (2026-09-30) — onboarding clarity, combat flow, Floor 3 polish, audio

Commits (Arjun0014/castle-game main, as Arjun0014): `a3d883f` (1/3) · `212328b` (2/3) · the 3/3 commit with this file
(finisher camera + this CONTEXT). Untouched and uncommitted as before: `remotion-intro/` (session 12's project; its
`out/` film is the source of the shipped intro), `THE_CASTLE_REMEMBERS_LORE.md`, `docs/ELEVENLABS_NOTES.md`, the source
MP3s in `assets/music/`, and session 12's hunk of this file.

**1. The opening film is the Remotion cut.** `python tools/cinematic/ship_intro.py` copies
`remotion-intro/out/the-castle-remembers-intro-9x16-720p.mp4` byte for byte (sha256 checked; 720×1280, 30 fps, H.264
High 3.1 + AAC, 60.05 s, moov first so it streams, 13.19 MB) to `public/cinematic/intro_720.mp4` and writes
`src/data/opening.json` (`burnedInCaptions: true`, no DOM subtitles — the film carries its own). `ui/Intro.ts` picks the
smallest encode covering the stage. The session-10 Blender film (`opening_1080/720.mp4`, 58 MB) is removed from
`public/`; `tools/cinematic/post.py` would re-create it and overwrite `opening.json` — re-run `ship_intro.py` after it.
itch zip: **124.5 MB / 547 files / 153 MB unpacked** (was 170 MB).

**2. The menu score.** "The Last Canopy Sleeps" plays from the loading card: `Game.boot` acquires `music:explore`
(2.5 MB) before the floor and binds `Music` with the combat cue null (`setCombat` when it arrives); `main.ts` starts it at
once where the browser allows sound (autoplay: a used site, an itch page clicked into), else on the first `pointerdown /
pointerup / mousedown / touchend / keydown / click` anywhere (capture listeners, removed once running). Bug fixed on the
way: the exploration stream was only ticked by the game frame, so under the loading card / title it fell silent after its
first 12 s segment — `Music` now schedules on its own 250 ms timer. New Game: the film fades it out over 1.6 s (position
kept), play fades it back in over 3 s from there. Verified (unmuted pane, autoplay allowed): started 0.19 s into the
loading card; segments kept playing on an idle title (14.7 → 34.7 s, segment 3 scheduled at 41 s); film at 52.9 s → kept
53.5 → resumed "explore from 53.5" after Skip; production phone: kept 15.3 → resumed 15.3. Never restarted.

**3. The touch button.** `HUD.interact(text, title, disabled, { at, verb, kind })` anchors it: a red seal ⌀88 u over the
thing (ACTIVATE / RENEW / WAIT for a sigil, INSPECT / RECALL for a memory, DESCEND for the lift), its name under it, a
dashed gold tether and a pulsing ring on the object, breathing + ripple; placed just above the object's screen point,
clamped to 20–80 % width and 20–50 % height (clear of the bars and thumbs), eased (transforms only). Hidden when out of
range / in a finisher. The first Blood Sigil teaches it once (a finger taps it + "Tap here to use it — anything you can
use shows this button."), `learned.interactTap` ends it on the first use. Texts updated (Guided sigil lessons, Minimal
card, Controls panel). Verified: a synthetic touch tap on the seal activated CP1 (HP 240), lesson off, button hidden.
**Read memories** (follow-up): once a memory trace has been read its prompt turns muted and smaller — touch: a 60 u
parchment-and-iron RECALL seal, no glow / pulse, smaller name, tether and ring (`.t-cta.read`); desktop: the card at 11 px,
62 % opacity, muted (`.interact.read`). `HUD.interact(…, { read })` from `Checkpoints`. Verified muted: 83 → 56 px, 13 → 11 px.
**The LOOK ring** (follow-up): the lower-right camera pocket shows a permanent dashed ring like the stick's (`.t-look-hint`,
⌀108 u, 48–55 px clear of Attack / Heavy / Guard at 375×812; `#touch.looking` while a look finger is down). Verified muted:
a drag inside it turns the camera; the ring goes solid during the drag and back after.
**Guided combat lessons: highlight + move on** (follow-up, `game/Tutorial.ts` `PRACTICE`, lesson `practice / key / press`):
light, heavy, combo, guard, parry and dodge show what to press — touch: the button pulses with a gold ring, a TAP / HOLD tag
and a tapping finger (`TouchControls.highlight(action, tag)`, `.t-btn.teach::after / .teach-tag`); desktop: a glowing key chip
on the card (`HUD.tutorial(…, key)`, `#hud .tutorial kbd`: LEFT CLICK, RIGHT CLICK, HOLD Q, TAP Q AS IT LANDS, TAP SHIFT).
After 2 misses (a swing that hit nothing; a blow taken while learning to guard / parry / dodge; a plain block in the parry
lesson; a chain that stopped at its first cut; 6.5 s without trying — counted only once the card has been up 2.5 s) the card
says MOVING ON for 1.1 s and the next lesson begins (no gold ✓). The parry's old 5-try fallback is gone (40 s kept as a
safety). Verified muted: tutorial probe touch 23/23 and desktop 24/24 lessons; a player who never presses anything moves
from light to finish (light/heavy/combo by 'did not try', guard/parry by 'took the blow'); screenshots of both highlights.

**4. Passive Resonance** (`TimeSystem.PASSIVE`): 7/s (was 1.6), resumes 2.5 s after a shift / 2 s after combat, eases
in over 1 s, cap one shift (100) — kills stay the fast source and the only way to bank a second shift. Measured
(`S.passive()`): empty → shift ready **17.3 s** after a shift, 16.8 s after a fight (was ≈ 66 s). Traversal reasoning:
Floor 1's required shifts are ≥ ~15 m of walking apart and almost all have a fight between them (AutoPilot ROUTE), so a
player walking to the next shift spot arrives charged; one guard kill (+40) is ≈ 6 s of passive. Texts now say "wait a
few moments".

**5. Health from kills** (`EnemyTypes KILL_TIER / KILL_HEAL`, PLAYER_HP 240): weak 8 (bat, widowling, remnant,
remnant guard, goblin, wraith) · normal 18 (guard, muster, hollow, archer, echo archer) · elite 40 (royal / hollow warden,
widow, crown brute) · mini-boss 110 (Gate Warden, Kingsguard, Gutter King, Weeping Mother, the Maw). In the Last Crown's
fight her adds heal ×1.6 (min 16); reinforcements ×0.6 (and 60 % Resonance). Feedback: the HP bar glows, a "+N" rises
beside it (summed within 0.9 s), blood-gold motes fly into her. Credited once in `onKill` (finishers included).

**The Last Crown's add waves** (`LastCrown ADD_WAVES`, cap 5 standing in her memory): `first` at 80 % (Present: goblin,
goblin, bat · Past: guard, remnant guard, muster), `break2` at the phase-2 break (crown brute, widowling ×2 · royal
warden, muster ×2), `mid2` 20 s into phase 2 when ≤ 1 add stands (bat, goblin ×2, widowling · guard ×2, archer),
`break3` (widow, goblin, remnant ×2 · royal warden, guard, muster), `late` every 24 s of phase 3 when ≤ 1 stands (×2).
Bodies are the floor's own fallen (`EnemyManager.revive`, nothing loaded mid-fight; fallback = the pooled Remnants),
risen at the ring's edge away from her and the hero; while 3+ stand her cast gap ×1.3; the heart charges, a line
("The Crown calls up what the castle became."), a low shake. Her death ends every group (`endGroups('A')`); a respawn
removes them. No finishers on her adds. Verified (`S.crown()`): first 14.3 s (goblin, goblin, bat), break2 31.3 s (crown
brute, widowling, widowling), mid2 55 s (bat, goblin, goblin); 10 add kills healed 192 HP.

**6. Route guidance in the world** (`game/RouteGuide.ts`, `data/guidance.ts`). Gold = the way, blue = shift here.
Chevrons (0.86 m, every 1.45 m, snapped to the real floor of the leg's memory, a pulse flowing to the goal, lit only from
1.5 m behind her to ~20 m ahead), a beacon (House Vaelor lozenge in a ring on the floor + a soft light column that steps
back when she is near), a gap glow (warm light spilling out of a low opening), and — once, when a way opens after a
fight — a card and a bright sweep running out along it. Guided: every leg at full strength; Minimal: `essential` legs at
60 %, others after 28 s at the objective without a fight. Floor 1 legs to the half stair: the way in (passage → breach,
beacon at the breach), CP1, back to the rusted gate, into the ward, back to the barracks ring (Past, after E3), into the
barracks (Present, beacon at the door), **the first crawl** (after E5: chevrons into the gap, glyph before it, the gap
glowing, "THE WAY ON — The vault has fallen — crawl through the low gap to the north"), the half stair (after E6).
Floor 2 (the "goblin rooftop" is the Gutter King's range on the armory roof): **A** after E4 — round the fallen trusses
and up the truss ramp to the ridge ("THE WAY IS OPEN"); **B** after the ridge wraiths (E6) — down past the rusted gate
to the minstrels' tower ("DOWN FROM THE RIDGE"); **C** after FR1 (the Crown chandelier) — the loft edge in the Past with a
new blue shift ring (G6, `f2_door shiftAt`), then the drop onto the wreck and across to the King's door ("THE WAY IS OPEN",
said 3.9 s after FR1's own card). Legs whose floor only exists later (the wreck) are re-placed when they open. Verified:
F1 85 marks / 0 without floor; F2 legs open in order incl. the FR1 drop (26 marks once the wreck exists); Minimal crawl at
0.6; screenshots (passage, barracks beacon, crawl mouth, range).

**7. The Crownheart owns the chamber's light** (`Crownheart.mood`, `Game.applyHeartTone`). A slow organic swing
between deep crimson and saturated gold (two drifting swells through a smoothstep, dwelling at the ends; ~19 s phase 1,
~14 s phase 2, ~11 s phase 3); heartbeats push it up the ramp, a great cast draws it DOWN into crimson and flares it at
the release, a phase break floods it gold, and her HP crossing 90/75/55/42/20/10 % makes it BLEED (a hard red pulse that
lets go over ~2.5 s). Gold is capped at the ramp's gold (white-gold only on surges — the first try washed the room out).
The room follows hard: hemi 0.55/0.62 of its colour, fill 0.85, the key light 0.6, the hero's light 0.8, fog 0.85 toward a
brighter tint, exposure ±9 %, crown lights 0.95, her glow 0.5–1.15. Verified by screenshots: red (#d52909, fog #430702)
and gold (#ffbd4c, fog #593f15) phases.

**8. The Last Crown is not there before her reveal**: she stays in the 'hidden' state (never drawn, no shadow, no aura,
not a target) from load until `beginIntro`, and again after a checkpoint reset. Verified: at 31 m before the fight not
drawn; never visible before the trigger; appears only descending from the heart.

**9. The wordmark**: "ECHOES OF" small (EB Garamond 500, tracking 0.62 em) between hairlines over CAER VEYR in Cormorant
Garamond Bold (now bundled) with the C and V raised 1.17×: struck gold (bright crown, a dark horizon at the waist,
warm underside), fine SVG grain, a 0.03 em dark engraved edge, a close shadow + faint ember warmth, a soft shade behind
the block, a light sweep every 11 s (off with reduced motion). Wide view left-aligned.

**10. The ring**: the shift ring is always the SHIFT seal's azure (`SHIFT_RING_BLUE`, it was amber in the Present, where
the first shift happens under "stand in the blue ring"); Minimal's card says "Stand in the blue ring". Blue = shift,
gold = the way.

**11. Enemies standing around.** Reproduced with scripted fights: E13 (the Gate Warden — Floor 1's first boss bar)
arriving by the hatch: the wave-2 gallery archers woke, shot once, then stood 20 s+ blind; the kneeling ranks waited on
the Warden's 65 / 35 % HP (a minute or more in a slow fight). E5 and E9 fights were already healthy. Fixes: a boss
fight's next rank kneeling in plain sight rises after 20 s of its wave or 7 s after the rank before it has fallen
(`KNEEL_RELEASE`; verified 19.5 s / 39 s with the Warden untouched, no soldier idle far); perched archers without a shot
walk their perch (same floor height, ≤ 12 m from their post, never across a gap) to a spot that sees her, else pace it
watching (`perchThink`); blind ground archers come to her along the grid (≤ 16 m from post) instead of idling; perched
archers never take an A* route off their gallery.

**12. The idle balcony archer** (after the second crawl, the west gallery before the loft stair, shifting to the Past at
G5): it was **E13's wave-2 archer standing in E9's arena** — archers never wake before their own wave, so it waited for
the Last Muster. `adoptStrandedArchers` (load time, logged in `spawnFixes`): a later-wave perched archer standing in
another same-memory fight's box (outside its own) joins that fight at wave 1 — Floor 1's two gallery archers → E7 / E9
(the only matches on all floors; F2/F3 audited). Verified: after the G5 shift it fires every ~3 s (4 arrows in 15 s).

**13. Reinforcements on returning to a memory** (`enemies/Reinforcements.ts`, `REINFORCE`): an area = an encounter in
one memory (never the tutorial, a boss / mini-boss arena or the finale). On a shift into memory M near (≤ 8 m) an area
whose fight in M is over: needs ≥ 40 s since the clear, ≥ 6 s spent in the other memory, ≥ 100 s since this area's last
group, ≥ 45 s since any group, < 2 groups in this area, no fight on her, then a 70 % roll (a quiet return retries after
half the cooldown). A group is 2–4 (3 if the area had two kinds, +1 at 35 %), at most one elite, bosses as their rank and
file; in the Past a monster kind becomes its human counterpart (F1/F2 Past never get one). Bodies = that area's own
fallen, rising where they fell ≥ 6.5 m from her (risers rise, kneelers stand, others fade in over 0.75 s with a shift
burst); short, the same kinds from elsewhere at walkable ring points. They fight as their own encounter (finishers, the
score, dialogue); a respawn makes them vanish. Rewards ×0.6. Verified: F1 E3 → 3 guards + an archer rose and engaged in
1.5 s; 10 shifts in 70 s → 0 extra groups ("area cooldown"); F2 Present group (hollow + echo archer); kills +11 HP /
24 & 18 Resonance.

**15. Mini-boss finishers** (`Finishers MINI_FINISH`): the Gate Warden, Kingsguard, Gutter King, Weeping Mother, the Maw
and the elite Wardens (royal, hollow) and crown brutes (not the Crown's adds) always die in a finisher — no chance, no
cooldown, any killing blow (Whirlwind / Crownbreaker included). Variant order per body (e.g. Warden headsman → frenzy →
stab → passing; the Maw frenzy → passing; the Mother stab → passing), never the one just played first; staging tried from
her side then ±45 / ±90 / ±135 / 180° round the body with a 4.8 m step (longer approach timed); camera pulled back by
the body's height (×1–1.45); every sampled camera must now see BOTH bodies' chests (a truss hid the Gutter King); last
resort the in-place `stand` cleave — its own over-the-shoulder shot if one is clear, else the gameplay camera. The Maw
reels on its own death clip's stumble (Enemy.die now carries a running death clip on instead of restarting it). Verified
(`S.minis()` F1–F3): hollow warden frenzy, royal warden headsman, Gate Warden frenzy/headsman, Weeping Mother stab,
Gutter King frenzy/stand (corner), Kingsguard frenzy, the Maw frenzy, crown brute frenzy — each 1 kill signal, 1
encounter clear, the tier heal, camera never inside geometry, control handed back. Stills: the Warden's headsman, the
Maw's frenzy (portrait).

**16. Credits**: "A game by AJ_Insanity"; the statement — everything made with Claude Opus 5.5 and Blender (code,
systems, the castle and floors, props, level/puzzle design, combat, AI, lighting, shaders, menus, the film, the tools);
the only outside assets are Sketchfab models, Adobe Mixamo characters/animation and Poly Haven textures (+ free CC0 sound
libraries, still credited — they are in the game); music from ElevenLabs; voice, dialogue and narration AI generated.
The final ending card reads "A game by AJ_Insanity · made with Claude Opus 5.5 and Blender".

**Also:** `lockPointer()` swallows `requestPointerLock()` rejections; no vibrate before the first tap (both logged
errors before).

**Tests (session 14):** tsc; `npm run build`; `npm run package:itch` (124.5 MB, 547 files); **`dev/regression.js` 49/49
PASS** (portrait touch, F1 → F2 → F3); **`dev/tutorialProbe.js` touch: all 23 lessons**; `dev/s14Probe.js` heals /
minis (F1, F2, F3) / reinforce / spam / crown / passive; scripted repros of E13, E9, E5, E7 (above); guidance build
reports (0 marks without floor on F1); production preview: desktop 1280×800 (title, credits), `?view=wide` (title),
phone 375×812 touch (New Game → Guided → film → tap → Skip → MOVE, score resumed, route leg live) — **0 console errors**.
Unmuted only for the score checks (the pane allows autoplay); the user then asked that Claude always test muted —
§7 Testing hooks. **Needs the user:** §8 Session 14.

### Session 13 (2026-09-30) — first-player experience, the score, mobile performance

Commits (Arjun0014/castle-game main, as Arjun0014): `63bcdb2` code + assets · this CONTEXT commit. The Remotion
trailer (`remotion-intro/`, session 12, a parallel session), `docs/ELEVENLABS_NOTES.md`, `THE_CASTLE_REMEMBERS_LORE.md`
and the source MP3s in `assets/music/` stay untracked; only this session's hunks of this file were committed.

**1. The outer gate behind the spawn** (`floor01_layout.build_barbican`, `LEVEL_01_BLUEPRINT.md` §N.1). Turning round at
the start showed a bridge end and the night sky. The apron is now a barbican passage walled to the sky (arrow slits,
crenellations) closed by the outer gate wall with two flanking towers; in its round-headed arch the great oak leaves —
16 boards following the arch, iron straps with strap hinges, pintles, studs and tips, the meeting stile — still barred
by the drawbar in its sockets; voussoirs, keystone, quoins, imposts and House Vaelor's crest on the inner face. Past:
sound boards, the wicket shut, torches, a banner. Present: rotted green board ends, one split to the backing, rust, the
**wicket in the east leaf hanging open onto cold light** — she came through here. Collision closes the gate, the wicket
gap and the ajar leaf; camera probes at 9 positions round the spawn and the gate: never inside geometry; pushing south
from the wicket for 3 s stops at the gate. A low moon fill in front of the gate makes it read from the spawn (the arch and
the near-vertical moon left it black). Floor 1 rebuilt (0 validation issues, 47,578 visual / 7,936 collision tris, +3k),
NAV3 rebaked, floor manifest regenerated.

**2. The title: ECHOES OF CAER VEYR** — title screen (two lines, "ECHOES OF / CAER VEYR", the tag "The castle remembers ·
a keep torn between two memories"), the boot card, the tab title (and each chapter card's `Echoes of Caer Veyr — Floor …`),
credits, the pause menu (a small line over "Paused") and the final ending card (`end-card.final`). Unchanged on purpose:
the creed "the castle remembers" in dialogue, loading labels ("The castle remembers"), the respawn card ("THE CASTLE
REMEMBERS YOU"), the fracture card, the opening film and the Remotion trailer. A sigil favicon (the tab's 404 is gone).

**3. The adaptive score** (`audio/Music.ts`, `tools/build_music.py`, §4 Music). Opus 160 kbps; exploration streamed from
12 s segments with 0.08 s shared overlaps (only the playing + next segment decoded: ~4.6–9 MB instead of ~46 MB), combat
decoded whole (23 MB at 48 kHz) and looped sample-exactly over its main section. Modes: explore → (0.35 s of fighting)
combat: exploration fades out in 1.1 s and its position is kept; combat enters at the intro — or, within 30 s of the last
fight, at the next 8-beat phrase after where it stopped → (3 s of calm) leaving: the combat cue fades over one phrase
(2.67 s) from its next phrase boundary while exploration rises over 4.5 s from the kept position (−1.5 s pre-roll); a fight
flaring up during the hand-over takes the cue straight back. The title screen starts it on the first touch; New Game's
film stops it (position kept); play resumes it. The heroine's lines duck it to 0.45; the pause menu dips it to 0.4.
Settings has a **Music** slider (`score`). Everything on the AudioContext clock; nothing decoded on first use (the
combat cue decodes during loading; exploration segments ~8 s ahead, off the main thread). Loaded with core (scope
`music`) unless automation-muted. Verified in headless Chrome with a real AudioContext: every segment decodes to exactly
its manifest length (579,840 samples); a 26 s recording of the music bus across two joins matched the source to 1 sample
at the set gain (0.8194 of 0.82), the residual at the joins at the codec floor (−56…−72 dB, same as elsewhere): no
clicks; three fight cycles (explore kept 41.0 / 46.1 / 86.1 s and resumed there; the second fight within 30 s resumed the
cue at its next phrase 16.0 s; the third began at the intro); the exploration loop 116.1 → 1.05 s and the combat loop
56.0 → 13.3 s; duck 0.45 → 0.99 after the line; title (silent until touched) → film (stopped at 6.9 s) → Floor 1 (resumed
at 6.9 s, Guided on "move", ducked under the arrival line). **Never heard by a human.**

**4. Guided tutorial to CP3** (`game/Tutorial.ts`, 23 lessons; Minimal: `game/Objectives.ts` teach `halfstair`).
Kept (texts sharpened): move · look · the way in · light (near-freeze until the first blow) · heavy · combo · guard ·
parry · dodge (desktop) · finish · Resonance ("every Echo you destroy… hits and parries add a little") · Blood Sigil ·
two memories. Rewritten to say what is missing and why: **TIME SHIFT** (not enough Resonance / not at the rusted gate /
"stand in the blue ring and hold…; let go — or take a heavy blow — and it breaks"), **BLOCKED IN THIS MEMORY** (the
barracks barricade: spent Resonance / whole ground on the east half of the yard / hold here). New, after the crawl: **A HALF
STAIR** (the Present's stair has lost its upper flight — climb the rubble to the old landing) → **THE STAIR REMEMBERS**
(shift on the old landing; shifted on the armory floor instead she lands before the Past's locked gate and the card says
so and what to do; not enough Resonance → how to get it) → **CLIMB** (the Past's upper flight, a slow beat) → **BLOOD
SIGIL** CP3 → **YOU CAN READ THE CASTLE** (when a way is closed, look at what closes it and ask the other memory). Action
cards never time out; they step aside in fights and come back where they apply; the SHIFT seal pulses only when a shift
there would work. Level prompts `T_ARMORY` / `T_HEIGHT` retired (taught by the cards). Verified: `dev/tutorialProbe.js`
passes every lesson on desktop (kbm) and portrait touch, incl. the wrong-memory detour; the Minimal probe shows the
armory card, the ring on the old landing (0.9), the Past card after shifting there and the objective moving on from the
top. **Not played by a new human yet.**

**5. Mobile frame drops — investigated, measured, fixed.**
*Method.* Headless Chrome 154 (this machine's RX 5600M via ANGLE/D3D11) at a phone viewport (390×844 @3, touch, the
mobile quality tier: 6 point lights, 1024 shadows), **CDP CPU throttling ×4** (phone-class CPU), the game's own Perf
(step / render / GPU timer query per frame), V8 CPU profiles, Chrome invalidation traces; production builds of **s7**
(a7fbddb), **s8** (3444855), **s9** (5c1bce6), **s10** (a814901) and **HEAD** (a619a28) built from git worktrees; a
deterministic Great Hall E13 fight (seeded `Math.random`, fixed 1/60 steps, the hero attacking) and the autopilot
traversal (E1–E3). Runs interleaved: the laptop's speed drifts ±35 % between identical runs.
*Findings.*
- **No per-frame regression in the core loop** between s8 and HEAD: spawn idle 27.5 vs 27.5 ms (×4), the E13 fight
  58.3 vs 59.9 ms, s9 / s10 / HEAD equal in the traversal; the scene is the same since s8 (6,015 objects, 5,170 bones,
  162 skinned meshes). GPU is not the limit here (3–7 ms); at ×4 a frame is CPU-bound (render-CPU ~60 %, sim step ~20 %).
- **Floor 1 residency is correct**: GLBs = hero + archer / ghost / hollow / knight; 14 texture sets; no Floor 2 monsters,
  no Creature Pack, no Last Crown, no Floor 3 spells or geometry, no later-floor voice. One leak by design: the 12 bat /
  goblin / Widow / Maw sounds lived in `core` (decoded on every floor) → now loaded with the rigs that use them.
- **What a frame costs** (V8 profile, traversal ×4): three.js's scene-graph matrix update **24 %** — every Echo's skeleton,
  drawn or not (5,381 of 6,005 nodes belong to the floor's 80 Echoes, ≤ ~20 ever drawn); shadow pass 10 %; the draw loop.
- **New in session 11, per frame:** while passive Resonance trickles (most of exploration) the Resonance bar's width
  changed every frame and its shimmer + width transition ran on the main thread → a style recalc + layout + paint every
  frame (UpdateLayoutTree 0.05 → 0.33 ms/frame here; phones ≈ ×4–6); the finisher contact test skinned ~780 vertices on
  every frame of each contact window.
- **Older per-frame waste:** the hidden HUD channel line replaced its text node every frame (a style / layout /
  whole-document paint every frame of play); 14 WebAudio automation events per frame (listener + 5 beds); off-screen
  Echoes drawn and skinned in both passes (`frustumCulled = false`); the title backdrop drew and shadow-cast every Echo on
  the floor (~60), heating a phone before play began.
- **Conclusion:** no single code change reproduces as "the regression" on this machine. The likeliest contributors to
  what the phone showed after session 11 are the Resonance-bar work (new, whenever the gauge refills) on top of the
  structural costs; thermal throttling over a long session cannot be measured here → real-phone check in §8.
*Fixes (the picture is unchanged):* Echoes not drawn skip the matrix pass (`Enemy` root override); skinned Echo bodies
are frustum-culled per pass against a sphere that follows the body (`Enemy.updateBounds`, off during the GPU warm-up);
HUD writes only on change, the Resonance fill is a compositor-only `scaleX` with its shimmer on its own element and no
transition while trickling; audio automation only on change; the title backdrop shows only the Echoes play would draw
(`EnemyManager.menuVisibility`); monster sounds floor-scoped; the finisher contact test starts only once the blade is
within reach of the body (all 30 variant × body finishers still play; 60 armed beats fired at gaps ≤ 0.074 m, none late).
No adaptive degradation was added (the existing dynamic resolution is unchanged).
*Before → after* (×4 CPU, interleaved pairs, pre-session build vs this one):
| Measure | Before | After |
|---|---|---|
| E13 fight — render-CPU p50 (3 pairs) | 27.3 ms | **19.0 ms** (−30 %) |
| E13 fight — frame p50 / frames > 33 ms of 1,199 | 37.6 ms / 819 | **29.4 ms / 504** (−38 %) |
| Traversal E1–E3 — render-CPU p50 (2 pairs) | 23.1 ms | **13.8 ms** (−40 %) |
| Traversal — frame p50 / share of frames > 50 ms | 36.2 ms / 31 % | **26.0 ms / 10 %** |
| Scene matrix pass, spawn / Great Hall (same page, A/B) | 12.1 / 11.5 ms | **1.3 / 6.2 ms** |
| Draw calls, Great Hall fight (same views) | 194 | **172** |
| DOM per frame while exploring (desktop ×1): style / layout / paint | 0.05 / 0.19 / 0.10 ms | **0.006 / 0 / 0.004 ms** |
| … while the gauge trickles | 0.33 / 0.21 / 0.12 ms | **~0.08 / 0 / 0.004 ms** |
*Floor 1 residency after load (unmuted, as a player):* GPU 91.8 MB (unchanged; 46 programs, 249 textures). CPU (asset
estimates): core sounds 32.0 → **28.3 MB**, ambience beds 86.7 MB, voice 6.4 MB, **music 25.6 MB** (the combat cue
decoded, 23 MB + the compressed exploration segments; plus ≤ 9 MB of decoded segments held by Music — whole-track decoding
would have been ~69 MB). JS heap 191 → 209 MB (the score). 116 resident keys (was 126).
*On a phone:* `?perf` shows fps, frame / step / render / GPU ms (p50/p95 of 120 frames), draw calls, drawn Echoes, pixels
and heap, refreshed twice a second — e.g. `http://192.168.1.39:5173/?perf` with `npm run dev:lan`.

**Tests (session 13):** tsc + `npm run build`; `dev/tutorialProbe.js` desktop + portrait touch (every lesson, the
wrong-memory detour); the Minimal probe (desktop + touch); music: decode lengths, the join recording, 3 fight cycles,
loops, duck, title → film → game; the gate: screenshots Past + Present, 9 camera probes, the wicket push; the finisher
contact matrix (30/30 played); the performance runs above; **`dev/regression.js` 49/49 PASS** (portrait touch 375×812,
F1 → F2 → F3 in place; no console errors, no 404 — a sigil favicon now answers the tab's request); `npm run build` +
**`npm run package:itch`** → `build/caer-veyr-itch.zip` 170 MB, 546 files, 198.5 MB unpacked (the score included);
production preview (:4174): desktop portrait (432×768 stage, the new title), `?view=wide` (title left, the heroine and the
gatehouse right, framed by the barbican), phone touch 375×812 (New Game → Guided → the film → Skip → "MOVE" with touch
wording, music exploring, `?perf` readout). Last fix after those runs: the Guided crouch lesson also completes anywhere in
the armory (it could otherwise have held the half-stair lessons for a player who reached the armory without crossing the
zone behind the crawl); the touch tutorial probe re-ran clean after it.
**Needs the user:** everything in §8 Session 13 (real phone, ears, a new player).

### Session 11 (2026-09-30) — bug fixes + Floor 3 polish: grounding, stairs, passive Resonance, transition robustness, the Mutant Maw, the living Crownheart, contact-true finishers

Commits (Arjun0014/castle-game main, as Arjun0014): `4cc0d89` all code/assets · this CONTEXT commit.
`THE_CASTLE_REMEMBERS_LORE.md` (the user's file) stays untracked.

**1. Monster grounding** (`assets/GameAssets.ts` `GROUND` / `LEVEL` / `sampleClips`, `enemies/Monsters.ts` Widow):
- Goblin (and the ×1.6 Gutter King) stood buried to the thighs: lowest vertex −0.66 m (−1.06 m king). Root cause in the
  asset: `goblin.glb`'s pelvis translation keys are small deltas (y ≈ −3.5 units) without the 59.5-unit rest offset, so
  every clip ran with the hips ~0.5 m low. Fix at load: the model is lifted by the 20th percentile of the per-frame
  lowest point over idle_combat / idle_alert / walk / run (same constant for every clip). Now idle +1.6 cm, run +2 cm,
  king the same ratio. Residual retarget artefacts: walk feet ~5 cm high, the lunge dips ~11 cm.
- Widow / Weeping Mother "floated": grounded by its lowest point, its front pair of legs sat 0.47 m (0.6–0.8 m on the
  Mother) above the floor — it stood on two legs, the ghost-head hanging in the air. Fix: `LEVEL` pitches the model so
  the front and back contacts (median per-frame lowest front/back point over the crawl) both meet the floor, contacts
  stored on the template; the Widow's rear-up / jab pitch now pivots about the planted pair (the spit used to drive the
  back legs 0.45 m into the floor). Measured after: front 0.04 / back 0.04 m while running, nothing below the floor.

**2. Stairs** (`game/Physics.ts` `resolveCapsule(…, vertGround)`, `Player.integrate`, `Enemy.integrate`): standing still
on stairs she slid up to 8.8 m in 10 s (grounded, she is pulled into the floor at 2 m/s and the capsule was pushed out
along the tilted normal). Walkable FACES (n.y > 0.55, the face itself, not an edge) now resolve straight up by
depth/n.y; walls, ledge edges and steep slopes keep the normal push. Verified: 0.000 m drift on 9 stair/ramp spots,
walking up/down unchanged (2.7 m in 0.7 s, no air frames), jump peak 1.08 m + clean landing, knockback both ways
0.59 m, dodge 4.6 m down a stair, 0 drift after stopping, the lift ride, F3 route. Also `Enemy.physRadius` (≤ 0.62 m):
a 0.94 m capsule climbed the blood font's 0.9 m rim like a ramp (the Maw walked into the font).
`Player` now updates its ROOT matrix before tracking the blade (the blade trailed a frame behind her body).

**3. Passive Resonance** (`time/TimeSystem.ts` `passive`, `PASSIVE_RATE 1.6/s`, `PASSIVE_CAP 100`, `PASSIVE_DELAY 4 s`):
out of combat (no live Echo of her fight within 22 m, no scripted scene, no finisher) the gauge refills after 4 s of
calm, easing in over 2 s, at 1.6/s up to ONE shift's worth (0 → 100 in ~67 s, measured). Kills (+12…200), hits (+2)
and parries (+12) stay the fast source and the only way to bank the second 100; a shift resets the calm. The filling
segment breathes (`.charge-seg.trickle`). Deny text: "…or give the castle time: its pull returns slowly."
Not yet tuned against a full human traversal (§8).

**4. Floor 2 → 3 "stuck on the chapter card" — root cause.** Reproduced exactly (ERR_CONNECTION_REFUSED on :5173 for
the boss sounds / voice / level GLB, card stuck on "THE CASTLE RESISTS … Reload the page"): Floor 3's files are only
fetched at the transition, and the dev server that served the page was no longer running (no process listened on :5173
when this session started — it was a Claude preview server, which stops with the session that started it). The game
then failed the whole floor on the first refused request with no way on (a reload also fails without a server). Fixes
(`assets/AssetManager.ts` `Net`, `fetchBytes`, `prefetch`; `game/Game.ts` `transitionTo` / `failedLoad` /
`prefetchNext`; `ui/LoadingScreen.ts` `error(msg, retry)` / `connection`; `main.ts`):
- transient failures (no response, 408/429/5xx, a body cut off mid-download) retry with backoff (0.6 → 8 s, ~26 s in
  all); the card says "The way is lost — seeking it again (attempt n)…"; a 404 still fails loudly;
- a transition whose downloads failed offers TRY AGAIN (click / tap / Enter) and resumes in place: HP / Resonance /
  shifts kept, what already arrived stays resident, only failed files are asked for again (Continue has it too; the
  boot card's TRY AGAIN reloads);
- within 45 m of the way out (Floor 1's exit, Floor 2's King's lift) the next floor's files download into memory
  (`Net.cache`, ≤ 96 MB, consumed once): 9.2 MB for Floor 3 in 210 ms locally, so the card after the lift decodes.
Verified: dev warp `?floor=2` → lift → F3 (1.4 s); simulated dead network during the transition → retries → network
back → loads by itself; dead network for 26 s → TRY AGAIN → F3 with HP 123 / charge 150 carried, controls back, boss
sounds resident; regression F1 → F2 → F3 in place. Play-test tip: run your own `npm run dev` in a terminal (a server
started by a Claude session dies with that session).

**5. Floor 3 ability message.** The HUD outlives the in-place transition: a reveal still on screen and the Crownbreaker's
HOLD HEAVY tip were carried onto Floor 3, and once the Whirlwind had been tried an un-tried Crownbreaker took the tip
over again. Now `HUD.clearAbility()` on unload and on load, the persistent tip teaches only THIS floor's reward (F2
Crownbreaker / HOLD HEAVY, F3 Whirlwind / HOLD LIGHT), and a reward already performed gets a 5 s reminder instead of
the full reveal (Continue). Verified: F3 arrival 0–4 s no stale reveal, 4.5 s WHIRLWIND / HOLD LIGHT, tip after; no
HOLD HEAVY after the Whirlwind is learned; regression rows for both floors pass.

**6. THE MAW OF THE CROWNHEART = the Creature Pack Mutant** (`enemies/Maw.ts`, `enemies/MonsterBase.ts`,
`tools/blender/build_mutant.py`, `src/data/mutantAnimations.json`, `public/assets/characters/mutant.glb` 2.6 MB +
KTX2 4.1 MB, `dev/mawProbe.js`). Pack inspected whole (`build/analysis/mutant/inspect.json`, contact sheets
`clips_0/1.png`): Mixamo "Mutant", 37 mixamorig bones (no fingers), 11.3k tris, one material (2048² diffuse + normal →
1024²), 1.86 m T-pose / head 1.3 m hunched; 19 clips. Used 16: idle (breathing), idle_look, walk 1.21 m/s, run
2.2 m/s, turn_l45 / turn_r45 / turn_r90 (pelvis yaw taken out in the build and replayed on the root), punch (contact
0.30 s), swipe (both blades rake at 1.23 s), leap_slam (1.6 m, fists land 1.67 s), leap_turn (lands 64° round; yaw
taken out too), pound (slam 1.90 s), hop, roar (head peak 1.40 s), flex (chest beat 2.1 s), death. Unused: 'mutant
idle' (14 s duplicate), 'mutant left turn 45' / 'right turn 45 (2)' (no body yaw). No reaction clips in the pack —
borrowing the Pro Magic Pack's by bone name was tried and rejected (other rest orientations: it turned side-on).
Moveset (Maw ×1.8, 1150 HP, poise 300): HOOK (slow wind-up then the hook; a parried hook STUNS it 4.4 s: stumble,
head hanging 2.4 s, played back up, ×1.35 damage) · SWEEP (1 s tell, 230°, guard break, a step in) · chains hook→sweep,
phase 2 hook→hook→sweep, enraged + hop→leap · CROWNFALL (5.5–15 m, aimed 0.6 s ahead of her run, crimson ring where
it will land from take-off, crosses the font in the air, direct blow under the fists 34 + shock ring 18 — jump it,
~1 s exposed landing; a heavy into the landing stuns) · TURNING FALL when she is round its flank · QUAKE (wave runs out
at 8 m/s to 9 m: jump or dodge through; twice from phase 2) · HOP out when she hugs its belly · ROAR entrance + 65 %
(knock-back blast, 3 gloom bats rise out of the font) · FLEX at 35 % (×1.3 damage while it beats its chest, then
ENRAGED: ×1.22 speed, crimson smoulder) · heavy turns on the spot · poise STAGGER (death stumble 0–1.15 s) · death
(falls back along its clip, body stays 4.2 s). Shifting is denied while its fight holds her ("The Maw holds this
memory fast") — the Past's open north door was a way round it. Crown brute (E8, ×1.3, 360 HP): hook / sweep / hop.
Layout (`floor03_layout.py`, rebuilt, 0 issues, NAV3 rebaked): E5 = maw + 3 bats (wave 2), the 35 % goblin wave
removed; E8 lamia → crown_brute; **CP2 moved to the bridge at the cistern door (10, 96.6)**; **new CP2B on the landing
past the north door (10, 130.2)** — a boss fight and a required shift apart; objectives `f3_cp2`, `f3_cp2b`. The lamia
(`monster-_module_xb1011.glb`) is gone from runtime, KTX2 list, build_monsters, credits; sounds renamed `maw_snarl` /
`maw_roar` (same CC0 sources). Verified with the probe (god): roar, sweeps, quake jumped, staggers, hop, turns, 65 %
roar + bats, flex → enraged, hook→hook→sweep chains, death at 56.7 s of a random-attack bot, E5 clears, surge to 200,
lock lifts; kiting: 4 leaps in 40 s, every landing on the ring (5.7–6.7 m from the font centre), none in the font.

**7. The Crownheart** (`vfx/Crownheart.ts`, `Game.applyHeartTone`, `LastCrown` GREAT_CASTS): the crystal is a shader
of domain-warped noise veins climbing through flat facets + a slower drifting layer + a tide, coloured on one ramp
(clotted blood → crimson → orange-amber → gold → hot yellow-white: colour moves only with the energy, never an RGB
cycle); an additive counter-flowing shell; embers peel off on the beats. Its colour/energy drive every crown light
within 34 m (the heart's own light 6.1–9.7 per beat, 12.6 on a surge) and, near it, the hemisphere / ground bounce /
fill / hero light / fog / exposure (±8–15 %, linear-light weights — the first tuning washed the room orange). Phases run
it hotter and faster; the Last Crown's great casts (wave, bombard, nova, beam, orb, dark) draw it in as she gathers
and flare it at the release; her glow takes its colour. Phones: 3 noise octaves. Warmed (54 programs, 0 failures).

**8. Finishers** (`combat/Finishers.ts`, `dev/finisherContact.js`): measured the gap between the real blade (hilt→tip)
and the victim's skinned surface every frame. Before: frenzy's first four cuts fired with the blade 0.74–1.13 m from the
body (only the last blow connected), the headsman's sweep / neck cut 0.85 m early, the stab 0.3 m early, the kick's
first cut 1.28 m short, the passing cut never touched the body (0.55 m; 1.66 m at its "line of light"). Now: CUT beats
are armed and fire on the first frame the blade meets the body (≤ 0.08 m, three sub-steps per frame), blood / streak /
reaction at the contact point along the blade's travel; frenzy rebuilt from swings that reach (atk_whirlwind ×2,
atk_rising_cut, the cleave's overhead); stab/headsman retimed (contacts ~0.73 / 0.35 + 0.73 s); kick opens with the
cleave's overhead half; the passing cut passes with the body on her sword side (PASS_SIDE −0.5, the blade crosses its
waist ~0.23 s) — same clip, camera and feel; standoff + (radius − 0.4); the headsman is not offered to bodies < 1.6 m;
the headsman camera 0.35 m farther out (the kneeling body's arm filled the frame). Verified contacts (gaps, every
armed beat): guard, hollow, royal warden, goblin — all 5 variants 0.001–0.077 m; Widow and crown brute stab / passing
0.012–0.071 m; kingsguard/bosses and widowlings refused as designed.

**Tests run:** tsc + `npm run build` PASS; `dev/regression.js` 49/49 PASS (portrait touch 375×812, F1 → F2 → F3 in place,
all 5 finishers kill/credit/camera, both rewards + reveals, touch layout, wall/hole refusals); `dev/f3Probe.js` gates
9/9 + route spawn → arena with 6 shifts (a route waypoint added on the fallen column's axis — the bot's straight line
clipped its edge); `dev/mawProbe.js` kite / fight / parry→stun; `dev/finisherContact.js` matrix; grounding probes;
stair drift probes; passive curve; transition failure / retry / prefetch; portrait screenshots (the Maw, its leap,
the Crownheart, the headsman contact).
After the handoff commit: `dev/bossBot.js` god fight with the new Crownheart → phases 2 + 3, death, ending, 67 s,
0 errors; `npm run package:itch` → 166 MB zip, 535 files, 194 MB unpacked (mutant.glb + maw_* in, no lamia);
production preview (:4174) boot → in-place transition to Floor 3 in 4.7 s with the Maw, its and the boss's sounds and
CP1/CP2/CP2B/CP3; `?view=wide` production: wide profile, no touch HUD, passive regen running.
**Not run this session (next session / human):** a real-damage Maw bot and real-damage Last Crown bot, a desktop-kbm
portrait play pass, a full F1 → F2 → lift → F3 playthrough by walking (the lift was ridden from the `?floor=2` warp; F1 → F2 → F3 by the in-place
transition), passive-regen tuning against a human's traversal, everything by ear and on a real phone.

### Session 10 (2026-09-30) — title screen, chapter cards, Guided tutorial, enemy audit, Floor 3 played end to end

Commits (pushed to Arjun0014/castle-game main as Arjun0014): `796a604` the opening film (final cut) + its pipeline
(committed as its own change: the film session had finished — FINAL at 00:05 — and it was verified in the browser here) ·
`2a0ff37` title screen, chapter cards, Guided tutorial, settings, saves, pause menu · `d3121f1` enemy audit fixes ·
`54daa18` Floor 3 play-test fixes (lift, transitions, iron gate, roots, lighting, objectives) + LEVEL_03_BLUEPRINT
v3.1 · this CONTEXT commit. Every staged tree was type-checked and production-built on its own (blob-level staging).
`THE_CASTLE_REMEMBERS_LORE.md` (the user's file) stays untracked.

**1. Title screen** (`ui/MainMenu.ts`, `ui/menu.css`): after the boot card, the game's name (Cormorant Garamond, gilt)
over the loaded castle — `Game.menuScene` renders a slow shot past the heroine toward the rusted gate (portrait: she
stands between the name and the menu; `?view=wide`: name + menu on the left third, she and the gate on the right).
Items: Continue (only with a Floor II/III save: "Floor II · Complicity"), New Game (→ Guided / Minimal choice → Enter
the keep), Controls (keyboard & mouse / touch tabs, the sword's combos, rewards earned later), Settings (master,
ambience, effects, voice, subtitles, camera sensitivity, camera shake — localStorage), Credits (every CC BY model with
author + source URL, Mixamo, Poly Haven, all CC0 sound authors, ElevenLabs, fonts, software). Arrow keys / WASD /
Enter / Esc, mouse hover, touch; quiet UI sounds (blade ring). The pause menu (Resume / Controls / Settings / Quit to
title) replaces the old "PAUSED" card; the ending card got "Return to the title".
**2. The film**: New Game is the user gesture: `Intro` (loaded through `import.meta.glob`, fetched while the menu shows)
plays with subtitles and Skip, then Floor 1 begins with the chosen guidance. Verified in the pane (muted): 720p source,
subtitles, Esc skips, the guided tutorial starts.
**3. Loading / chapter cards** (`ui/LoadingScreen.ts`): the block bar is gone. Floor numeral, name, subtitle, epigraph
(Floors I and II got theirs), the Crownheart sigil whose gilt ring is the real progress (only ever eases toward the last
reported fraction), the step and its detail in words, embers; the heart flares on ready; fades into the game. Boot uses
the game's own card; Continue waits for a key / tap (pointer lock + sound need a gesture).
**4. Guided tutorial** (`game/Tutorial.ts`, Floor 1 start → through the first crawl): 19 lessons, each waiting for the
action (card flashes gold on success): move · look · the way in · light (the world at 0.07× until the first blow) ·
heavy · combo (a chained blow) · guard (blows at 0.28× as they land, GUARD cue) · parry (0.3×, parry window ×2.4, NOW
cue; moves on after a parry, 5 tries or 40 s) · dodge (desktop) · finish them · Resonance (the bar pulses) · the Blood
Sigil · two memories · the shift · the Past · the living guard (when a guard blocks) · shift back (in the Ward) ·
crouch · end. E1's Hollows are the teachers (walk up, wait, one strikes during guard/parry, cannot die until "finish
them"); the hero cannot drop below a third of her health meanwhile. Overtaken lessons are skipped silently. Minimal
guidance: a compact FIGHT card at E1, the sigil / shift / shift-back / crouch cards, objectives, shift rings (now only in
the memory to leave: `shiftFrom`), the guide marker after ≤ 30 s. Touch wording everywhere.
**5. Enemy audit** (`dev/auditProbe.js`: all 39 encounters of the 3 floors, the Last Crown separately; hero walking each arena): fixed — F1 E12c
scaffold archer slid down its stair ramp and never shot again (perched archers now hold their spot) and its perch was
blind; F2 E3 ×2 perched mid-gallery 2 m behind the parapet (the lean-over reached 1.8 m) and F2 E8 in a walled bay of the
Crown Loft: `EnemyManager.checkPerches()` measures each perch's view at load and moves blind ones (0 → 8–13 arrows per
fight); bats: the "two swooping at once" counter leaked on every bat killed/stunned mid-swoop (after two, no bat ever
swooped again) — counted live now; F2 E1 bat and F1 E8 wraith spawned in pockets with no sight of their fight:
`checkFlyers()`; `setArenaLock(false)` (every respawn) threw on Floor 3. Slot rotation checked with no kills: every waiter
acts 5–11× in 35 s.
**6. Floor 3 played end to end** (`dev/f3Probe.js`, `dev/bossBot.js`, `monsterProbe.brawl`, screenshots): the lift ride
cost 4 × 25 % health (the cage crosses the shaft's kill volume — scripted sequences are now exempt); the exit tore the
floor down inside the frame and threw (transitions now start at the top of the next frame: `Game.pendingNext`); the Past
iron gate lay along the ramp instead of across it (layout fix, Floor 3 rebuilt, NAV3 rebaked); the camera sat inside the
crystal shards at the arena entrance (roots fade out when they block the camera); the Present was unreadable on the
approach bridge in portrait (F3 Present ambient/exposure/hero light raised); retries replay the reveal at 2×; the boss bar
hides during cinematics; objectives for the two unmarked shifts. All 9 weaves correct in both memories; the whole route
with 6 shifts passes; the Maw (33–35 s, 3 waves); the Last Crown fight → death shot → heart → ending card.
**7. Autopilot** (test harness): perched archers on other levels are not chased, flyers are targeted at hover height, a
nav-grid route when stuck, the fissure fallback no longer blocked by the shift cooldown, fights on the way do not time the
walk out. Floor 1 god run reaches the exit (t ≈ 350–363 s); Floor 2 still stalls after the Gutter King (§8).

**Tests run:** tsc + vite build on every staged tree; `npm run build` + `npm run package:itch` (162 MB zip, 535 files,
189 MB unpacked); production preview (port 4175): title portrait (desktop) + wide + phone touch 375×812, Continue →
Floor II card → play with the save, pause → settings, New Game → Guided → first lesson; dev: `dev/regression.js`
49/49 (twice), `dev/tutorialProbe.js` all 19 lessons, `dev/auditProbe.js` F1/F2/F3, `dev/f3Probe.js` gates 9/9 +
route, boss bot god + real damage, the Maw brawl god + real damage, F1 god autopilot → Floor 2, the lift F2 → F3.
**Needs a human / real phone:** see §8 Session 10 follow-ups.

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

### Opening film FINAL (2026-09-30 00:05) — v1 to 26.125 s, then v2: NOW THE GAME'S FILM
The user preferred v1's opening (the legend) and v2's rest: `python tools/cinematic/v2/hybrid.py` regenerates v1 frames
0-626 from the lossless renders (post.py) and joins v2 from frame 627 (a shot boundary: v1's portcullis on "sealed" ends,
v2's queen-and-child begins) -> `build/cinematic/hybrid/final_{clean,share}_master.mp4`; then
`CLEAN=... SHARE=... NAME=final bash tools/cinematic/v2/finish.sh`. Verified: 66.000 s / 1,584 frames for all four
outputs; game `public/cinematic/opening_1080.mp4` (37 MB) + `opening_720.mp4` (20 MB); share
`build/cinematic/out/the_castle_remembers_final_{portrait,wide}.mp4` (95 / 38 MB); audio from mix.wav (silence
−102.5 dBFS, portcullis −12.9); cut checked on frames (`build/cinematic/review/final_sheet.png`). Subtitle ink style
(`paper`) now only on "The kingdom became a story…" (`tools/cinematic/v2/game_data.py`). Pure v1 and pure v2 outputs
remain (`build/cinematic/v1_backup/`, `build/cinematic/out/the_castle_remembers_v2_*`).

### Opening film v2 (cinematic session, 2026-09-29 night) — "the chronicle in ink" (its second half is in the FINAL)

The user did not like v1 and supplied references (`reference video/`: Witcher 3 intro comic cinematic + Bloody Baron
flashback — git-ignored, copyrighted). v2 = painted graphic-novel panels (Blender, textured characters, PBR sets, ink +
hatching finish) + ink-on-parchment passages + regraded v1 shots, edited in **Remotion**, title in **HyperFrames**, on
the unchanged v1 soundtrack. Full description and rebuild commands: `docs/CINEMATIC_V2.md`.
- **Outputs (verified: 66.000 s, 1,584 frames, H.264 High yuv420p 24 fps, AAC 48 kHz, faststart):** game
  `public/cinematic/opening_1080.mp4` (43.5 MB) + `opening_720.mp4` (22.7 MB); share `build/cinematic/out/
  the_castle_remembers_v2_portrait.mp4` (94 MB, subtitles burned in) + `..._v2_wide.mp4` (39 MB). **v1 kept** in
  `build/cinematic/v1_backup/` (all four files).
- **Sync (verified on the encode):** audio muxed from `build/cinematic/audio/mix.wav` (Remotion's own AAC was 42.6 ms
  late — measured by cross-correlation); Sundering silence −102.5 dBFS, crack −11.4; picture beats checked at 9.72…64.05
  (`build/cinematic/review/v2_sync.png`).
- **Game:** `src/ui/Intro.ts` + `style.css`: subtitles flagged `paper` in `src/data/opening.json` (written by
  `tools/cinematic/v2/game_data.py`) are drawn as dark ink on a paper halo (the parchment passages). `tsc` passes;
  `npx vite build --outDir build/intro_dist` OK (189 MB unpacked incl. 66 MB of film); served by `vite preview` with
  HTTP 206. **Not verified by Claude in a browser** (gstack browse is broken on this machine — see below).
- Tools installed (global skills): Remotion (`remotion-dev/skills`), HyperFrames (`heygen-com/hyperframes`).
  Projects: `tools/cinematic/remotion` (npm), `tools/cinematic/hyperframes/title`.
- ElevenLabs: both `.env` keys return 401 "Invalid API key" from this session (checked 20:08 and 21:40); v2 needed no
  new audio.

### Opening film v1 (parallel cinematic sessions, 2026-09-29) — "THE CASTLE REMEMBERS", 66 s portrait (superseded by v2, kept as backup)

Authority: `docs/CINEMATIC.md` (treatment + pipeline), `docs/CINEMATIC_HANDOFF.md` (state), `tools/cinematic/timeline.json`
(timing). Every image is built by code (Blender 5.2 EEVEE + Freestyle ink + Kuwahara; numpy/PIL post); narration is
ElevenLabs v3 (build-time only). No generated images or video.

- **Outputs (verified with ffprobe: 66.000 s, 1,584 frames, H.264 High yuv420p 24 fps, AAC 48 kHz stereo, faststart):**
  game `public/cinematic/opening_1080.mp4` (31.6 MB) + `opening_720.mp4` (16.8 MB); share masters with burned-in
  subtitles `build/cinematic/out/the_castle_remembers_portrait.mp4` (80 MB, 1080×1920) and `..._wide.mp4` (27 MB, 1920×1080).
  Encode: `python tools/cinematic/post.py --encode --workers 4` (674 s; also rewrites `src/data/opening.json`).
- **Renders:** all pass frames at 1080×1920 in `build/cinematic/frames/` (git-ignored); all verified loadable and 1080×1920.
  The killed queue was resumed (646 frames, 26 min). Fixes this session: S06 the child's cloak poked through the shut
  door (`shot_interiors.py`: child hidden from local frame close+5; f656–671 re-rendered); S02 the wide pull-back saw past
  the cavern floor's edge, a black band growing from f293 (`heart.py` `cavern()`: a 15-row apron continuing the same
  surface toward the camera, original vertices unchanged; f292–330 re-rendered, band gone).
- **Post:** subtitles now have a brightness-adaptive feathered scrim (`post_fx.Subtitles`, only raised over bright
  pictures: S01 rings, S03 dome, the 15.9 s dusk flash); in-game DOM subtitles got a soft radial backdrop
  (`style.css` `#intro .intro-subs p`). All 17 shots reviewed on real frames through post (`build/cinematic/review/s8_*.png`).
- **A/V sync (verified on the encode):** picture events at 9.72/9.80, 15.9, 25.32, 34.95–36.5, 43.92, 46.42, 56.2–57.6,
  62.9/63.5/64.05 (`build/cinematic/review/s8_sync.png`); audio RMS: crack −11.4 dBFS at 34.95, the Sundering silence
  35.55–35.9 = −102 dBFS (true digital silence under the frozen picture), thunder −13.2 at 44.0, bell −16.7 at 46.42.
- **Build:** `npx vite build --outDir build/intro_dist` OK (EB Garamond bundled, both films in `cinematic/`, 159 MB
  unpacked); `vite preview` serves the films with HTTP 206 ranges. **`npm run build` / `package:itch` currently fail
  only on `tsc`: `Game.ts(646) 'finisher' does not exist on type 'Game'`** — gameplay work in progress in the parallel
  session, not the film.
- **Not verified by Claude:** the in-game intro in a real browser (gstack browse cannot start on this machine: its
  state-dir ACL lock-down resolves user "AJ" to the computer "AJ\" and locks the tool out of its own `.gstack/`, then
  reports "Another instance is starting the server"; `BROWSE_STATE_FILE` elsewhere hits the same lock-down). Needs a
  human check: Enter the Keep → film with sound + subtitles → Skip/Esc → game starts; `?nointro` skips.
- ElevenLabs: both keys in `.env` returned 401 "Invalid API key" (20:08); the film needed no new audio.
- The user's goal for the film: Witcher-cinematic feel, dark and brutal. v1 is the ink-and-gold chronicle (no combat);
  a darker rebuild ("the last night" told through violence: knight 24 combat clips, hero 73) was estimated at
  ~22–34 h of work + ~14–33 h of rendering and deferred past the jam.

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
