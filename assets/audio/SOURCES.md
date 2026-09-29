# Audio sources (all CC0 / public domain)

Downloaded 2026-09-29 into `assets/audio/_downloads/` (immutable source input; zips kept next to their
extracted folders). Runtime files are **derived** by `python tools/build_audio.py` into `public/assets/audio/`
and listed in `src/data/audioManifest.json` (which also records, per sound, its use and its sources).

CC0 needs no attribution, but credit is recorded here: Kenney, StarNinjas, artisticdude, rubberduck, Ogrebane,
qubodup, JaggedStone, SketchMan3, PagDev.

## Packs

| Pack | Author | License | Page | Downloaded file(s) |
|---|---|---|---|---|
| Impact Sounds | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/impact-sounds | kenney_impact-sounds.zip |
| RPG Audio | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/rpg-audio | kenney_rpg-audio.zip |
| 20 Sword Sound Effects (Attacks and Clashes) | StarNinjas | CC0 | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | sword_-_starninjas_1.zip, sword_clash_-_starninjas_0.zip |
| Swishes Sound Pack | artisticdude | CC0 | https://opengameart.org/content/swishes-sound-pack | swishes.zip |
| 80 CC0 RPG SFX | rubberduck | CC0 | https://opengameart.org/content/80-cc0-rpg-sfx | 80-CC0-RPG-SFX_0.zip |
| 80 CC0 creature SFX | rubberduck | CC0 | https://opengameart.org/content/80-cc0-creature-sfx | 80-CC0-creature-SFX_0.zip |
| 100 CC0 SFX #2 | rubberduck | CC0 | https://opengameart.org/content/100-cc0-sfx-2 | sfx_100_v2.zip |
| Monster Sound Pack, Volume 1 | Ogrebane | CC0 | https://opengameart.org/content/monster-sound-pack-volume-1 | monster-sounds-volume-2.zip |
| Ghost Monster Voice Moaning & Growling | qubodup (Iwan Gabovitch) | CC0 | https://opengameart.org/content/ghost-monster-voice-moaning-growling | qubodup-GhostMoans.zip |
| Loopable Dungeon Ambience | JaggedStone | CC0 | https://opengameart.org/content/loopable-dungeon-ambience | dungeon_ambient_1_0.ogg |
| wind whoosh loop | SketchMan3 | CC0 | https://opengameart.org/content/wind-whoosh-loop | wind_woosh_loop.ogg |
| Fireplace Sound loop | PagDev | CC0 | https://opengameart.org/content/fireplace-sound-loop | fireplace_loop.wav |
| Fire Crackling | AntumDeluge | CC0 | https://opengameart.org/content/fire-crackling | fire-1_0.ogg (downloaded, not used yet) |
| Hit sounds | pauliuw | CC0 | https://opengameart.org/content/hit-sounds | hits.7z (downloaded, REJECTED: 8 kHz mono, -30 dB noise floor) |

Rejected: `Bow & Arrow Shot` (dorkster, CC-BY-SA 3.0) and `Arrow hit twang` (qubodup, CC-BY-SA/GPL) are not
CC0, so the bow release is composed from CC0 parts; `Dark Ambience Loop` (qubodup, CC-BY/GPL) not used.

## Runtime sounds, their sources and where they are used

| Sound id | Files | Sources | Used for |
|---|---|---|---|
| `swing` | 13 | swishes (artisticdude, CC0) | Every player/enemy sword swing (pitch/rate varied per attack weight). |
| `blade_ring` | 7 | 80 CC0 RPG SFX blade_01-03 (rubberduck, CC0); 20 Sword Sound Effects: sword.N (StarNinjas, CC0) | Quiet metallic "shing" layered on sword swings and finishers. |
| `hit_flesh` | 5 | Kenney Impact Sounds impactPunch_heavy (CC0) | Sword landing on Hollows/unarmoured targets (thump layer). |
| `hit_slice` | 4 | Kenney RPG Audio knifeSlice/chop (CC0); 80 CC0 RPG SFX blade_02 (CC0) | Cut layer on sword hits (flesh). |
| `hit_armor` | 8 | Kenney Impact Sounds impactPlate_medium/heavy (CC0) | Sword landing on armoured knights / guards. |
| `clash` | 10 | 20 Sword Sound Effects: sword_clash.N (StarNinjas, CC0) | Blade on blade: enemy blocks, player parries (bright ring). |
| `shield_block` | 5 | Kenney impactPlate_heavy (CC0); StarNinjas sword_clash (CC0) | Hits absorbed by the player's shield (heavy plate crash + clash tail). |
| `parry` | 4 | StarNinjas sword_clash (CC0); Kenney impactBell_heavy (CC0) | Perfect parry: bright clash + bell shimmer. |
| `kick_hit` | 4 | Kenney impactPunch_heavy + impactSoft_heavy (CC0) | Kick / shield bash connecting. |
| `body_fall` | 5 | Kenney impactSoft_heavy (CC0) | Enemy/player hits the floor (deaths, knockdowns). |
| `armor_crash` | 4 | Kenney impactPlate/impactSoft (CC0); 80 CC0 RPG SFX chain (CC0) | Armoured Echo collapsing. |
| `armor_rattle` | 6 | 80 CC0 RPG SFX chain (CC0); Kenney RPG Audio beltHandle/clothBelt (CC0) | Knights shifting their armour when winding up / running. |
| `step_stone` | 5 | Kenney Impact Sounds footstep_concrete (CC0) | Hero footsteps in the Past (dressed stone). |
| `step_ruin` | 10 | Kenney RPG Audio footstep00-09 (CC0) | Hero footsteps in the Present (grit and rubble). |
| `step_grit` | 5 | 80 CC0 RPG SFX stones (CC0); 100 CC0 SFX #2 stones (CC0) | Loose-stone layer under Present footsteps. |
| `enemy_step` | 5 | Kenney footstep_concrete (CC0) | Enemy footfalls (armoured knights, hollows). |
| `jump` | 4 | Kenney RPG cloth (CC0); Kenney footstep_concrete (CC0) | Take-off (cloth + scuff). |
| `land` | 5 | Kenney impactSoft_medium + footstep_concrete (CC0) | Landing thud. |
| `land_heavy` | 4 | Kenney impactSoft_heavy + footstep_concrete (CC0) | Landing from a long fall. |
| `dodge` | 4 | Kenney RPG cloth (CC0); swishes (CC0) | Dodge dash: cloth + air. |
| `hollow_growl` | 12 | Monster Sound Pack Vol. 1 (Ogrebane, CC0); 80 CC0 creature SFX (rubberduck, CC0) | Hollow aggro / attack wind-up. |
| `hollow_hurt` | 6 | 80 CC0 creature SFX hurt (CC0); 80 CC0 RPG SFX creature_hurt (CC0) | Hollow flinch. |
| `hollow_death` | 4 | 80 CC0 RPG SFX creature_die_01 (CC0); 80 CC0 creature SFX scream/roar/monster (CC0) | Hollow death cry. |
| `wraith_moan` | 5 | Ghost Monster Voice Moaning & Growling (qubodup, CC0) | Echo Wraith presence / dive. |
| `wraith_dive` | 3 | qubodup Ghost Moans (CC0); 100 CC0 SFX #2 air_02 (CC0) | Wraith swoop attack (reversed moan into air rush). |
| `wraith_death` | 3 | qubodup Ghost Moans (CC0); 100 CC0 SFX #2 air_01 (CC0) | Wraith dissolving. |
| `bat_screech` | 4 | 80 CC0 creature SFX scream_01/02, bug_02/04 (rubberduck, CC0), varispeed 1.6-2.3x | Gloom bat swoop shriek (session 9). |
| `bat_flap` | 4 | Kenney RPG Audio cloth1-4 (CC0), 1.5x | Gloom bat wingbeats. |
| `bat_death` | 3 | 80 CC0 creature SFX hurt_02/04/05 (CC0), 1.9x | Gloom bat death squeal. |
| `goblin_snarl` | 6 | 80 CC0 creature SFX grunt_01/02/04, troll_01-03 (CC0), 1.4x | Ruin goblin chatter / attack yell. |
| `goblin_death` | 3 | 80 CC0 creature SFX hurt_01/03, scream_02 (CC0), 1.35x | Ruin goblin death. |
| `goblin_cry` | 2 | 80 CC0 creature SFX roar_01, howl (CC0) | The Gutter King's war cry. |
| `widow_hiss` | 4 | 80 CC0 creature SFX alien_02/04, weird_02, breath (CC0) | Widow hiss / skitter shriek. |
| `widow_spit` | 3 | 80 CC0 creature SFX spit_01-03 (CC0), 0.8x | Widow web spit. |
| `web_hit` | 3 | 80 CC0 RPG SFX creature_slime_01-03 (CC0) | A web glob bursting. |
| `widow_death` | 2 | 80 CC0 creature SFX alien_05, scream_01 (CC0), slowed | Widow death screech. |
| `maw_snarl` | 4 | Monster Sound Pack Vol. 1 Monster-2/5/6, monster-11 (Ogrebane, CC0), 0.68x | The Maw / crown brutes: snarls, wind-ups, stagger (session 11; was `serpent_hiss`). |
| `maw_roar` | 2 | 80 CC0 creature SFX roar_02/03 (CC0), 0.56x | The Maw's roar: entrance, 65 %, flex, death (was `serpent_roar`). |
| `bow_draw` | 3 | Kenney RPG Audio creak/handleSmallLeather (CC0) | Archer drawing (creak + leather). |
| `bow_release` | 4 | Kenney impactWood_light (CC0); swishes (CC0) | Arrow loosed: string snap + whip of air. |
| `arrow_hit` | 5 | Kenney impactWood_light (CC0) | Arrow striking stone/wood. |
| `player_hurt` | 5 | Kenney impactPunch_medium + RPG cloth (CC0) | Hero takes a hit. |
| `player_death` | 1 | Kenney impactSoft/impactPlate (CC0) | Hero falls. |
| `shift_charge` | 1 | 100 CC0 SFX #2 thunder_01, air_01 (CC0); 80 CC0 RPG SFX spell_01 (CC0) | 2.4 s channel: reversed thunder and air rising into the shift. |
| `shift_boom` | 1 | 100 CC0 SFX #2 thunder_01 (CC0); Kenney impactMining/impactSoft/impactBell (CC0) | Shift completes: the castle snaps into the other memory. |
| `shift_deny` | 3 | 80 CC0 RPG SFX lock (CC0); Kenney impactWood_heavy (CC0) | Shift refused / seal does not know you. |
| `resonance` | 4 | 80 CC0 RPG SFX item_gem, spell_02 (CC0) | Resonance released by a defeated Echo flowing into the hero. |
| `sigil` | 1 | Kenney impactBell_heavy (CC0); 80 CC0 RPG SFX spell_02 (CC0); 100 CC0 SFX #2 thunder_01 (CC0) | Blood Sigil (checkpoint) awakened. |
| `memory` | 1 | 80 CC0 RPG SFX item_gem_02 (CC0); Kenney bookFlip2 (CC0) | Memory Trace read. |
| `boss_sting` | 1 | 80 CC0 RPG SFX creature_roar_03 (CC0); 100 CC0 SFX #2 thunder_01 (CC0); Kenney impactBell_heavy (CC0) | The Gate Warden wakes. |
| `hatch_slam` | 1 | Kenney impactWood_heavy/impactSoft_heavy (CC0); 80 CC0 RPG SFX chain_03 (CC0) | The diggers' hatch slams shut. |
| `rubble` | 4 | 80 CC0 RPG SFX stones (CC0); 100 CC0 SFX #2 stones (CC0) | Present: masonry settling somewhere nearby. |
| `creak` | 3 | Kenney RPG Audio creak (CC0) | Present: old timber creaking in the wind. |
| `distant_moan` | 3 | qubodup Ghost Moans (CC0) | Present: an Echo somewhere in the dark. |
| `thunder` | 1 | 100 CC0 SFX #2 thunder_01 (CC0) | Present: far thunder over the broken roofs. |
| `amb_present` | 1 | Loopable Dungeon Ambience (JaggedStone, CC0) | Present bed: low wind through the ruin + drips. |
| `amb_wind` | 1 | wind whoosh loop (SketchMan3, CC0) | Present: wind where the sky is open (Ward, collapsed roofs). |
| `amb_drips` | 1 | 100 CC0 SFX #2 loop_water_02 (CC0), high-pass 110 Hz + low-pass 1.7 kHz, -21 dB (session 9: it was 11 dB louder and swamped the Floor 1 crypt mix) | Present undercroft/crypt water, fades in with depth. |
| `amb_fire` | 1 | Fireplace Sound loop (PagDev, CC0) | Past: torches, braziers and hearths (volume follows the nearest flame). |
| `amb_past` | 1 | Loopable Dungeon Ambience (JaggedStone, CC0), low-passed | Past bed: the inhabited keep's room tone (warm, low). |


## Session 5 — Floor 3 / the Last Crown (ElevenLabs sound generation, build-time only)

Generated 2026-09-29 with `node tools/elevenlabs_sfx.mjs <ids>` from the prompts in `tools/elevenlabs_sfx.json`
(files + provenance in `assets/audio/elevenlabs/` and its `MANIFEST.json`); built by `tools/build_audio.py` into
runtime OGGs used only on Floor 3: `mage_charge` (3), `mage_bolt` (4), `mage_impact` (4), `mage_nova` (2),
`mage_teleport` (3), `mage_beam` (2), `mage_ward` (2), `mage_rune` (3), `crown_resonance` (2), `boss_scream` (3),
`boss_death` (1), `final_collapse` (1). The API key stays in the git-ignored `.env`; nothing is exposed to client code.
Not yet reviewed by ear.

## Session 6 — the opening film (build-time only; the game ships one mixed soundtrack inside the video)

Everything below is mixed by `python tools/cinematic/mix.py` into `build/cinematic/audio/mix.wav` (−16 LUFS
integrated, −1.5 dBFS peak), which `tools/cinematic/post.py` muxes (AAC 192 kbps) into `public/cinematic/opening_*.mp4`.
No individual file reaches the runtime; the API key stays in the git-ignored `.env`.

| Part | Source | Files |
|---|---|---|
| Narration | ElevenLabs `eleven_v3` TTS with timestamps (free tier), account-owned designed voice "Cthulu female" (`VhuTJN7jTXadMoTbfY1r`), script + audio tags in `tools/cinematic/narration.json`, one request for the whole script (take A: stability 0.5, seed 11); QA transcription with Scribe v2 (85/85 words) | `assets/audio/cinematic/narration/A.mp3`, `A.json` (alignment) |
| Score stems (`t_*`) | ElevenLabs sound generation `eleven_text_to_sound_v2` (free tier; the Music API is paid-only): cello, strings, choir, minor strings, tremolo, brass, war drums, swell, hit, second cello — pitched/stretched/cut in `mix.py` | `assets/audio/cinematic/sfx/t_*_0.mp3` |
| Sound effects (`sfx_*`) | ElevenLabs sound generation `eleven_text_to_sound_v2` (free tier): heart hum, blood drop, stone rising, bells, war, portcullis, frightened crowd, door, stair steps, crack, collapse, gauntlet on iron, the glimpse, gate opening, night ruin wind | `assets/audio/cinematic/sfx/sfx_*_0.mp3` |
| Synthesised score | Code (`tools/cinematic/synth.py`, numpy/scipy): modal bells (the Veyr theme D–F–E–D–A), glass-harmonica tones, heartbeats, drones, risers, the Sundering's ring, a synthetic hall reverb | generated at mix time |
| CC0 beds / foley | Already listed above: Fireplace loop (PagDev), Kenney RPG Audio footsteps, Kenney Impact Sounds concrete footsteps, wind whoosh loop (SketchMan3), Loopable Dungeon Ambience (JaggedStone), 100 CC0 SFX #2 thunder (rubberduck) | `assets/audio/_downloads/` |

Prompts, durations and generation times for every ElevenLabs file: `assets/audio/cinematic/sfx/MANIFEST.json` and
`tools/cinematic/sfx.json`. Free-tier limits met on the way (verified 2026-09-29): Music API 402, voice design 403,
library voices 402 via the API, MP3 above 128 kbps 403.
