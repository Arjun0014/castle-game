# THE CASTLE REMEMBERS — opening film v2 ("the chronicle in ink")

**The game's film is the FINAL cut: v1 up to 26.125 s, v2 after** (`tools/cinematic/v2/hybrid.py`, then
`CLEAN=build/cinematic/hybrid/final_clean_master.mp4 SHARE=build/cinematic/hybrid/final_share_master.mp4 NAME=final bash tools/cinematic/v2/finish.sh`).

v2 replaces v1 (the ink-and-gold chronicle, `docs/CINEMATIC.md`) as the film the game plays. v1 is kept:
`build/cinematic/v1_backup/` (game copies + share masters) and its whole pipeline still rebuilds it.

## Direction (from the user's references)
The user's references (`reference video/`, studied as frame sheets in `build/cinematic/reference/`) are the Witcher 3
**intro comic cinematic** (painted graphic-novel panels, 2.5D parallax, slow push-ins, rain/fog/embers, steel-blue
palette broken by blood-red, green and moonlight, cuts through black) and the **Bloody Baron flashback** (ink blots on
cracked parchment that bleed into figures and sigils, splatter, resolve, and return to the page). v2 uses both:

| Film time | Mode | Content |
|---|---|---|
| 0–22.6 s | ink on parchment | the heart's rings as ink lines; founders kneel (ink silhouettes); **red ink blooms on "blood"** (9.75 s); the castle rises as an ink silhouette; red floods the page (war) |
| 22.6–26.1 | painted panel | the gates sealed: royal guards turn on the people pressed to the portcullis; shake + flash on "sealed" (25.29) |
| 26.1–28.0 | ink | the queen pushes the child away (ink silhouettes), black ink spills |
| 28.0–31.3 | painted panel | the king descends the stair past the guards he had killed; heart-light from below, torch, embers |
| 31.3–42.4 | v1 (regraded) | the gauntlet on the heart; white-out; the Sundering (craquelure, flakes) |
| 42.4–47.6 | ink | the centuries — "the kingdom became a story": the ruin as an ink woodcut in snow and rain |
| 47.6–52.7 | painted panel | now: she climbs the road under the dead castle (moon, ground mist, rain) |
| 52.7–55.0 | painted panel | she stands before the rotted gate and the faded crest |
| 55.0–62.0 | v1 (regraded) | her hand on the crest; the glimpse; the shatter; the gate opens |
| 62.0–66.0 | HyperFrames | the title: crest, THE CASTLE, REMEMBERS on the three bells; light sweep; fade |

Sound: the v1 soundtrack (`build/cinematic/audio/mix.wav`, narration + score + SFX, all beats already on this clock) is
reused unchanged; subtitles use the same `src/data/opening.json`.

## Pipeline
```
tools/cinematic/blender/panels.py     illustrated panels: real textured characters (hero/archer .blend, knight from
                                      public/assets/characters/knight.glb — its clip names are intact there), PBR stone/
                                      wood/rust (Poly Haven sets), hard light, layers (base / fg / fig)
   blender -b --factory-startup -P tools/cinematic/blender/panels.py -- --panel sealed|king|road|gate|founders|queen
tools/cinematic/v2/inkfx.py           graphic-novel finish: S-curve tone, value planes, split grade (steel|night|sepia|
                                      blood|gold) keeping fire/blood warm, 3-direction hatching by shadow depth, ink
                                      contours, paper tooth; --exposure lifts dark plates
tools/cinematic/v2/inkwash.py         ink-wash silhouettes from transparent figure renders; the parchment texture
tools/cinematic/remotion/             the edit (Remotion 4.0.530): src/Film.tsx (the cut), src/scenes.tsx (Parchment,
                                      InkClip, InkFigure, PaintedPanel, V1Clip, RedInk, InkSpill, Flash), src/fx.tsx
                                      (ink-bleed masks, grain, vignette, rain, embers, motes, mist, shake)
   npx remotion render Opening      out/final/opening_v2_clean_master.mp4   (game copy: no burned subtitles)
   npx remotion render OpeningShare out/final/opening_v2_share_master.mp4   (subtitles burned in)
tools/cinematic/hyperframes/title/    the title card (HyperFrames 0.8.92, GSAP): npx hyperframes render --fps 24
tools/cinematic/v2/finish.sh          backs up v1, encodes public/cinematic/opening_{1080,720}.mp4 + share masters
```
Knight rig facts (measured): the GLB's root carries a 0.01 unit scale (never overwrite it); the rig faces +Y at yaw 0
(`GLB_YAW = 180`); glTF bone tails are unreliable (anchor props on bone heads); the importer adds bone-display
icospheres that render (deleted). The archer `.blend` has scrambled mesh names (the body is "Arrow_Mesh", the bow
"Body_Mesh"): hide props by material.

Skills installed for this work (global, `~/.claude/skills`): Remotion agent skills (`npx skills add remotion-dev/skills`),
HyperFrames skills (`npx skills add heygen-com/hyperframes --full-depth`).

## Rebuild the edit's inputs (tools/cinematic/remotion/public is git-ignored)
```
P=build/cinematic/v2/panels; R=tools/cinematic/remotion/public
for p in sealed king road gate founders queen; do blender -b --factory-startup -P tools/cinematic/blender/panels.py -- --panel $p --samples 32; done
python tools/cinematic/v2/inkfx.py $P/sealed/base.png $R/panels/sealed_base.png --grade steel
python tools/cinematic/v2/inkfx.py $P/sealed/fg.png   $R/panels/sealed_fg.png --grade steel --seed 9
python tools/cinematic/v2/inkfx.py $P/king/base.png   $R/panels/king.png --grade steel
python tools/cinematic/v2/inkfx.py $P/road/base.png   $R/panels/road.png --grade night
python tools/cinematic/v2/inkfx.py $P/gate/base.png   $R/panels/gate.png --grade steel --exposure 2.5
python tools/cinematic/v2/inkwash.py figure $P/founders/fig.png $R/panels/founders_ink.png --seed 4
python tools/cinematic/v2/inkwash.py figure $P/queen/fig.png    $R/panels/queen_ink.png --seed 6
python tools/cinematic/v2/inkwash.py parchment $R/tex/parchment.png        # + tex/mist.png (soft noise, unused now)
cp build/cinematic/audio/mix.wav $R/audio/mix.wav                          # python tools/cinematic/mix.py
cp build/cinematic/v1_backup/opening_1080.mp4 $R/v1/v1_clean.mp4           # the v1 film (clean, no subtitles)
(cd tools/cinematic/hyperframes/title && npx hyperframes render --fps 24 --quality delivery --output renders/title.mp4)
cp tools/cinematic/hyperframes/title/renders/title.mp4 $R/title/title.mp4
cp node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2 $R/fonts/
python tools/cinematic/v2/game_data.py                                     # subtitles on parchment -> ink style
(cd tools/cinematic/remotion && npx remotion render Opening out/final/opening_v2_clean_master.mp4 --crf=16 \
   && npx remotion render OpeningShare out/final/opening_v2_share_master.mp4 --crf=17)
bash tools/cinematic/v2/finish.sh                                          # game copies + share masters
```
