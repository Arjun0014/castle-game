# THE CASTLE REMEMBERS — Opening Cinematic (director's treatment + pipeline)

Status: **v1 rendered and encoded** (sessions 6 + 8; see `docs/CINEMATIC_HANDOFF.md` for what is verified). This file
is the authority for the opening film's story logic, visual grammar and pipeline. `tools/cinematic/timeline.py` is the
authority for timing.

---

## 1. What the film must do

Sixty-odd seconds that leave the viewer with three feelings, in order:

1. *Something terrible happened here.*
2. *This castle remembers it.*
3. *Now this woman is walking into it.*

…so that the title — **THE CASTLE REMEMBERS** — lands as the only possible name.

### Told (lore §21, the nine beats)
Something ancient beneath the mountain · House Vaelor bound its blood to it · the castle learned its rulers ·
war came · on the last night the gates were sealed and the king went down to the heart · Caer Veyr was torn
between two memories of itself · centuries · a daughter of the forgotten line comes home · the gate, the
glimpse, the threshold.

### Withheld (discoveries for play) and how each is only foreshadowed
| Truth (not stated) | What the film shows instead |
|---|---|
| Aldren meant to sacrifice everyone inside | Guards turn their spears **inward** as the portcullis falls; people with bundles are on the wrong side of the gate. Never commented on. |
| The Queen saved the protagonist's ancestor on purpose | Two seconds: a woman's hand (rich sleeve, no face) pushes a hooded child through a servants' door; the child looks back; the door shuts; spear-shadows search the wall. Nobody is named. |
| Why the bloodline was never bound; why she can move between memories | Nothing is said. The crest on the gate answers her touch with a hairline of red-gold, and for one instant the castle remembers itself around her. |
| Aldren's full responsibility | *"Whatever he asked of it…"* — the sentence is left unfinished; the Sundering answers it. |
| The Last Crown | Not shown. The king is only ever a crowned **shadow** and a gauntlet. |

The creed **"The castle remembers its rightful ruler"** is planted at 14 s as royal doctrine (*"So their people
were taught"* undercuts it). The title returns it truncated: the castle remembers — and after what we have seen,
that is no longer a comfort.

---

## 2. Visual concept: memory is gilded

The film is a chronicle remembered in **ink, ember and gold**.

- **The Past is gilded.** Warm umber ink, lit windows, the bell, banners, torchlight — memory painted in gold.
- **The Present is bare ink and moonlight.** Indigo-black silhouettes, silver rims, moss, stars.
- **The Crownheart** is the source of the gold: a colossal whorled sphere under the mountain whose engravings
  carry red-gold light. Blood makes the gold run.
- **The Sundering is craquelure.** The castle's gilded image crazes like old varnish, then flakes away — and the
  ruin beneath is the *same* castle, in perfect register. Some flakes fall; some drift back up and re-attach; a few
  hang in the air where windows used to be. The castle is not destroyed: it *remembers incorrectly*. (No digital
  glitch anywhere: the language is material — varnish, gold leaf, paper, ink.)
- **The glimpse at the gate** uses the same grammar in reverse: gilding sweeps out from her palm (the same radial
  wave the game uses for a time shift), the living gate stands for one second, then it crazes and falls away.
- **Faces are withheld.** History remembers roles, not faces: the king is a shadow, the child a hood, the Queen a
  hand, the protagonist a silhouette with a shield. Her face is never given.

### Style rules
- Silhouette first; rim light second; texture third. Every shot is readable as a silhouette.
- Hand-wobbled ink contours (Freestyle, tapered strokes) over a painterly Kuwahara pass; faceted rock planes.
- Aerial perspective and height mist separate depth planes; skies are painted gradients with cloud banks.
- Portrait-native composition: vertical moves (the heart below, the castle above, the king descending, the light
  rising), tall arches and doorways, figures small against height.

### The crest of House Vaelor
Designed for the film (the game had none): **a crown of five points upon a ring, a drop of blood within the ring**,
inside a beaded seal. Crown = the dynasty, ring = the Crownheart/the binding, drop = the blood. Canonical vector:
`tools/cinematic/crest.py` (→ `crest.json`, `crest.svg`). The keep of Caer Veyr ("the Crown") repeats the crest's
crown in stone (four turrets and a spire).

---

## 3. Shot list (portrait master, 24 fps, 66 s)

| # | Time | Shot | Words |
|---|---|---|---|
| S01 | 0.0–6.9 | Black; a curve of red-gold light; pull back: the Crownheart in its cavern | *Before Veyr had a king, the mountain had a heart.* |
| S02 | 6.9–13.8 | Torch-bearers tiny at its base; a cut palm; the drop lands on "blood"; gold runs through the whorls | *It answered only to blood. And House Vaelor gave it theirs.* |
| S03 | 13.8–20.3 | Cutaway: the camera rises through the rock as Caer Veyr grows above the heart, gilded at dusk; every window lights | *"The castle remembers its rightful ruler." So their people were taught.* |
| S04 | 20.3–22.6 | Same composition: the sky bleeds red, the valley fills with the fires of an army | — (horns) |
| S05 | 22.6–26.1 | Inside the gate passage: the portcullis slams on "sealed"; guards turn inward | *On the last night, the gates were sealed…* |
| S06 | 26.1–28.0 | Servants' door: a woman's hand, a hooded child, a look back, the door shuts | — |
| S07 | 28.0–31.3 | Down the spiral stair: the crowned shadow descends toward red-gold light | *…and the king went down to the heart.* |
| S08 | 31.3–33.8 | His gauntlet on the heart; the whorls blaze; bells toll above | *Whatever he asked of it…* |
| S09 | 33.8–42.4 | The light rises through the mountain; the gilded castle crazes; silence; the Past flakes away to the ruin in register; gold hangs where windows were | *Caer Veyr was torn between two memories of itself.* |
| S10 | 42.4–47.6 | Time-lapse on the ruin: moon, snow, rain, growth; one gold window lingers, then goes out | *The kingdom became a story. Then a warning.* |
| S11 | 47.6–52.7 | Night, now: a woman climbs the overgrown road under the dead silhouette | *Now, a daughter of the forgotten line has come home.* |
| S12 | 52.7–55.0 | Behind her, low: the rotted gate, the faded crest, her shield | — |
| S13 | 55.0–56.2 | Her hand on the crest; the engraving fills with red-gold | — |
| S14 | 56.2–57.3 | The glimpse: gilding sweeps from her palm; torches, banners, guards turning their heads | — (the living castle, one breath) |
| S15 | 57.3–58.2 | It cracks away. Ruin. Silence | — |
| S16 | 58.2–62.0 | From inside the dark: the gate groans open; moonlight; she crosses into darkness | — |
| S17 | 62.0–66.0 | Gold flakes rise in the dark and assemble the title | **THE CASTLE REMEMBERS** |

Images hand over to each other instead of cutting like slides: the heart's rings become the rising cutaway; the
cutaway lands on the establishing composition that S04, S09 and S10 reuse (same place, three times, three
memories); the gate appears three times — sealed from inside on the last night (S05), touched from outside (S13),
opened from inside (S16, the same camera position as S05).

---

## 4. Narration

**Voice:** ElevenLabs **v3** (`eleven_v3`), the account's designed voice "Cthulu female" (id `VhuTJN7jTXadMoTbfY1r`):
an old woman's low contralto, timeless accent. Chosen by measurement because the free API tier cannot use library
voices or design new ones (see §7): median F0 151 Hz, 8.4-semitone range, warm spectrum, deliberate pauses — she
sounds like someone who has carried this story all her life, not a trailer voice. Who she is stays ambiguous.

**Performance:** one v3 request for the whole script (the model hears the arc), directed with audio tags:
`[slowly]` → `[softly]` → `[reverently]`/`[quietly]` → `[uneasy]`/`[hushed]` → `[whispers]` → `[sorrowful]` →
`[mournfully]` → `[tenderly]`. Measured afterwards: the whisper is a real whisper (−7 dB, 22 % voiced), the
creed sits lowest, the final line is warm and close. Scribe transcription: 85/85 words, no tags read aloud.
Names were spelled phonetically for the model (Vair, Vaylor, Kair Vair) and verified by formant analysis
("VAY-lor", /vɛər/, /kaɪr/). Script and tags: `tools/cinematic/narration.json`.

**Edit:** phrases are cut inside measured silences, sped up 7 % with rubberband (pitch kept), and placed on the
timeline so the picture answers the words (the drop lands on "blood", the portcullis on "sealed", the Sundering
finishes "Whatever he asked of it…"). *"Then war came to Veyr"* was recorded and cut: the burning valley says it.

## 5. Subtitles
Restrained, centred in the lower third of the portrait frame, serif, sentence case, fading in and out, never two at
once. Driven in-game by `timeline.json` against the video clock; burned into the shareable MP4 with the same
typography.

## 6. Music and sound
Score: an original cue in D minor, 60 BPM (see `timeline.json` → `music` for the eight sections), built around a
solo cello "Veyr theme", low strings, bells and a glass-harmonica tone for the Crownheart; no folk instruments, no
trailer braams (and nothing Witcher-like). The mix makes the key moments physical: the heart's sub pulse, the
drop, stone rising, war horns, the portcullis, the door, the bells, the craquelure, **a hard silence** in the
Sundering, wind through the ruin, a bell from a tower with no bell, her footsteps, leather on iron, one breath of
the living castle, the gate's groan, the interior's dark.

## 7. Pipeline (all build-time; nothing generative ships in the game)

```
tools/cinematic/crest.py                  crest vector (JSON/SVG/PNG)
tools/cinematic/narration.json            script + v3 tags + voice
tools/cinematic/gen_narration.mjs         ElevenLabs v3 with timestamps + Scribe QA -> assets/audio/cinematic/narration/
tools/cinematic/timeline.py               master timeline -> timeline.json
tools/cinematic/blender/*.py              every image is built by code in Blender 5.2 (EEVEE, Freestyle ink,
                                          Kuwahara painterly pass): cine.py (toolkit), castle.py (Caer Veyr), shots
tools/cinematic/audio_analyze.py          objective voice/music checks (pitch, pace, loudness) — judging without ears
tools/cinematic/el_client.mjs             ElevenLabs client (TTS, STT, SFX, music); key from .env, never shipped
```

ElevenLabs account facts (verified 2026-09-29): free tier, 10k credits/month; `eleven_v3` works with premade and
account-owned designed voices; **library voices and voice design are paid-only via the API**; free output formats
are ≤ 128 kbps MP3.

Also: `tools/cinematic/gen_sfx.mjs` + `sfx.json` (score stems and effects, `eleven_text_to_sound_v2`), `synth.py`
(bells, glass, heartbeat, drones, risers, reverb), `mix.py` (the whole soundtrack → `build/cinematic/audio/mix.wav`,
−16 LUFS / −1.5 dBFS), `blender/render_shot.py` (one pass), `render_all.py` (every pass the edit uses, two workers,
resumable: `python tools/cinematic/render_all.py`), `blender/camdump.py` (the evaluated camera per frame, so 2-D
effects stay pinned to world points), `post.py` + `post_fx.py` + `post_title.py` (post-production and encodes).

## 8. Post-production (`tools/cinematic/post.py`)

Everything is numpy/scipy/PIL, a pure function of the frame (renders in parallel, streams to ffmpeg in order).
The grammar is material, never digital:

- **Surface:** static paper tooth and fibres (multiplied, and lifting the blacks a hair), a soft vignette, fine grain
  that lives in the mid-tones (amplitude chosen so H.264 holds it at CRF 24 — see §10).
- **Gold leaf:** squares laid in offset rows, each a slightly different tone, overlapping seams, burnish noise.
  `icon_gild()` turns a Past image into a gilded icon: the sky and the lights become gold leaf, the ink stays ink.
- **Craquelure** (`Cracks`): two Voronoi networks (coarse = the flakes, fine = crazing) on a noise-displaced lattice
  (straight runs, broad bends, a little jaggedness); cracks arrive as a front from an origin; the cells cup, their
  lifted rims catch light, and through each crack the other memory already shows.
- **Flakes** (`Flakes`): each coarse cell becomes a sprite (with a gesso rim and a red bole back) that detaches in a
  wave and falls like thin leaf: rocking on a pendulum, glinting as it passes the light; some tumble; ink-dark cells
  simply fade (both memories agree on ink); some crumble mid-fall; a few *float back up and cling on* for a while.
- **Shards** (`Hangers`): small pieces of the gilded image where the windows were; they hang in the air, anchored in
  world space through the camera dump, outlive the Sundering and go out one by one across the centuries.

The edit (film seconds; every event is on the same clock as `mix.py`):

| Where | What post does |
|---|---|
| S01 | fade up from black |
| S02 | wide → (4-frame dissolve) lord kneeling → *hard cut* drop in extreme close-up (lands on "blood", 9.75 s) → (dissolve) wide as the gold runs |
| S03 | up the conduit into a flash of dusk light (peak at 15.9 s, 0.88 white) → Caer Veyr growing |
| S04 | the war's red bleeds up out of the valley through the dusk, like ink into wet paper (20.5–21.4 s) |
| S05 | the portcullis lands on "sealed" (25.29 s): an 11-px shake decaying over 0.4 s |
| S09a | white-out into the Sundering |
| S09b | the castle blazes as a gilded icon (34.9) → craquelure spreads from the keep with the cracks' sound (34.95–35.5), the hit makes the cracks glow (35.02) → **the picture freezes in the silence** (35.52–35.95) → the gilding flakes away from the keep outward, the ruin beneath in register (the varnish layer is warped with the camera push so it stays in register) → a few flakes float back up on the reversed swell (≈37.2) and cling on until ≈40 → shards hang where the windows were |
| S09b→S10 | 10-frame dissolve |
| S10 | the centuries: snow, then rain with lightning (43.92; thunder at 44.0), then clear night; the shards go out one by one, the last gutters out on the bell from the tower with no bell (46.42) |
| S10→S11 | 8-frame dissolve |
| S11, S12 | low mist drifting through the still night |
| S14 | her palm flares; gilding sweeps out from it as a ragged gold wavefront (0.42 s; the game's time-shift wave); the living gate, gilded; at 56.92 it crazes from her palm (a crack on the soundtrack) |
| S15 | on the cut to silence (57.3) the gilded memory shatters outward from her palm and crumbles away in ~0.5 s: the ruin |
| S16 | dust stirs in the moonbeam as the gate opens; fade to black on her crossing (61.35–62.0) |
| S17 | gold dust condenses out of the dark and assembles the crest, then THE CASTLE, then REMEMBERS — each on a bell of the score (62.9 / 63.5 / 64.05); a light runs across the gold; dark at 66.0 |

Subtitles: EB Garamond 500, #efe4cc, soft shadow that strengthens over bright pictures, one at a time, fades
0.22 s in / 0.3 s out, centred at 87.6 % of the frame height (below the figures; S11/S12 put her in the lower third).

## 9. In the game

`src/ui/Intro.ts` (+ `src/data/opening.json`, written by `post.py` from `timeline.json`; styles at the end of
`src/ui/style.css`; wiring in `src/main.ts`; `Audio.unlock()` in `src/audio/Audio.ts`):

- The floor loads behind the title card as before; the film starts fetching when the floor is ready.
- **Enter the Keep** (a click — the user gesture) unlocks Web Audio without starting any sound, enters immersive
  fullscreen on handhelds, hides the title card and plays the film *inside the stage* (so it scales with the game's
  own portrait frame), with sound. Its own light glows blurred around it when the window leaves space (desktop).
- Subtitles are DOM text driven by the video clock with the same timings/fades as the burned-in version.
- **Skip:** the Skip button (shown for a moment after any mouse movement, key or tap, and after 1.2 s), or Esc /
  Enter / Space. While it plays the film owns the keyboard (nothing leaks into the game's input).
- When it ends (or is skipped) it fades out over 0.38 s while the game starts underneath — no reload. A skip is a
  user gesture, so the pointer is locked at once; after a natural end the first click takes the pointer (Input.ts
  already does this without attacking).
- Never plays in automation (`?autopilot`, `?mute`, `?bench`, webdriver), on `?floor=2+`, or with `?nointro`.
- A film that cannot load or play never blocks the game: the error is logged (`[intro] …`) and play begins.
- Source choice: `opening_1080.mp4` when the stage is > 1500 device pixels tall, else `opening_720.mp4`.

## 10. Outputs

| File | Use |
|---|---|
| `public/cinematic/opening_1080.mp4` | game, large screens (H.264 High, CRF 24, AAC 192k, faststart) |
| `public/cinematic/opening_720.mp4` | game, phones (CRF 23) |
| `build/cinematic/out/the_castle_remembers_portrait.mp4` | share master 1080×1920, subtitles burned in (CRF 20) |
| `build/cinematic/out/the_castle_remembers_wide.mp4` | share master 1920×1080: the portrait film standing in a dim wash of its own light, subtitles across the width |

Rebuild everything: `python tools/cinematic/render_all.py` (Blender, ~2 h on this machine, resumable) →
`python tools/cinematic/mix.py` → `python tools/cinematic/post.py --encode`.
