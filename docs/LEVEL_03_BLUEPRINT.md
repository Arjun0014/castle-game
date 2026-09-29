# LEVEL_03_BLUEPRINT.md — Floor 3: "The Crownheart" (the descent beneath Caer Veyr)

Status: **v3.1 (session 10)** — describes the floor as built and played. v3.0 was built in session 9 (the rebuild
from the old summit design) and only its layout script described it; session 10 play-tested it end to end, fixed what
the play-test found (§L) and rewrote this document. **v1.0/v2.0 (the summit "Crown" above the bell chamber, the Wind
Gallery, the warded stair, the Hall of Crowns) are obsolete** — none of that geometry exists any more.

Authority: `tools/blender/floor03_layout.py` (geometry, markers, encounters — its header lists every space) →
`tools/blender/build_floor03.py` → `public/assets/levels/floor03.glb` + `floor03_collision.glb`, nav
`floor03_nav.bin` (`node tools/build_navgrid.mjs 3`). Runtime: `src/levels/Floors.ts` (entry 3: lighting, epigraph, no
sky), `src/data/objectives.ts` (floor 3), `src/enemies/LastCrown.ts`, `src/vfx/Crownheart.ts`, `src/levels/Lift.ts`.
Coordinates: Blender X east, Y north, Z up (three.js x = X, y = Z, z = −Y), the same frame as Floors 1–2. Floor 3
starts at **z 0** (the lift foot) and ends at **z −16** (the Threshold and the arena).

---

## A. Floor thesis

Floors 1–2 taught reading two memories of one room. Floor 3 goes *down*, out of the castle and into what the castle
was built on: the King's lift drops the Uncrowned down the conduit shaft, and every space after that is closer to the
Crownheart — the Hall of Roots its kings walked, the ossuary where they are buried, the font where each heir was bled,
the spiral round the heart's own shaft, and the heart itself.

| | |
|---|---|
| Gameplay purpose | Final exam: every memory-weave idea of the game at full pace (a gap, a gate, a missing bridge, a fallen bridge, a sealed door, a fused door, a collapsed ramp, a shut gate, warded doors), fights mixing the living guard (Past) with the new monsters (Present), a mini-boss, then the Last Crown. |
| Narrative purpose | *Should this inheritance survive at all?* The heart made the Last Crown from Aldren's imprint and dressed it in the Queen's face. The deeper she goes, the more the castle's own dead line the way. |
| Duration | 15–20 min first play (≈10–13 descent, ≈5–8 boss). Critical path ≈ 250 m of walking, 6 required shifts. |
| Visual identity | **Past**: torchlit royal undercroft — carpet, braziers, candles on the ossuary platforms, the coronation chamber whole with its Sealbearer pillars to the dome. **Present**: red-black ruin — the heart's crystal roots breaking through, every drop a real abyss (black shaft walls, broken rims, glow far below, embers rising — never a flat red floor), no sky. |

## B. Spatial graph (critical path bold; memory needed in brackets)

```
 C1 LIFT FOOT (0,0) z0  spawn on the cage, CP1, F1, T1 ──► passage north
   │
 C2 HALL OF ROOTS  x −9..9, y 10..60, z0 (50 m processional hall, barrel vault)
   │ E1 [PRESENT] y 11..29 ── chasm y 29..40: PRESENT abyss │ PAST floor ──► shift to PAST
   │ E2 [PAST] y 40..60 ── Royal Grille y 51: PAST portcullis │ PRESENT fallen ──► shift to PRESENT
   │ F2 (5.6, 45.5)
 C3 OSSUARY  cavern x −24..24, y 62..98 over a void; platforms P1 (0,74) · P2 (−11,86) · P3 (10,86)
   │ B1 bridge ──► P1: E3 [PRESENT] ── P1→P2 bridge: PAST only ──► shift to PAST on P1
   │ P2: E4 [PAST], F3 ── P2→P3 fallen column: PRESENT only ──► shift to PRESENT on P2
   │ P3: CP2 ── B4 ──►
 C4 CISTERN (10,113) r 12, the blood font (pit r 4.6, waist-high rim), T3
   │ south door: PAST warded │ PRESENT open ──► enter in the PRESENT: E5 THE MAW [PRESENT]
   │ north door: PRESENT crystal-fused │ PAST open ──► shift to PAST to leave
 C5 GREAT DESCENT  spiral ramp round the heart's shaft, centre (10,146), r 6.5..13, 450°: z 0 → −16
   │ −60..30°: E6 [PRESENT] (walked past in the Past)
   │ 40..62°: PRESENT collapse (abyss) │ PAST ramp ──► walk it in the PAST
   │ 110..200°: E7 [PAST], F4 (150°)
   │ 222°: PAST iron gate (the King's last gate) │ PRESENT torn open ──► shift to PRESENT
   │ 250..345°: E8 [PRESENT], F5 (318°)
   │ foot at 360° (z −16), landing turning east
 C6 THE THRESHOLD  x 22..27.5, z −16: CP3, the empty throne, T2
   │ Crown doors: PAST shut + warded │ PRESENT broken ──► enter in the PRESENT
   │ bridge over the abyss (parapets) ──►
   THE CROWNHEART  ring r 17 at (54,148), z −16; lens r 4.2; pillars r 11 (0/90/180/270°);
   PRESENT wedge holes r 6..13.5 at 45/135/225/315° ±20°; the heart hangs above at z −3  ── BOSS: the Last Crown
```

Checkpoints (Blood Sigils): **CP1** lift foot · **CP2** ossuary P3 · **CP3** the Threshold (the boss respawn).
Fissures (softlock refill): F1 lift foot · F2 Hall of Roots · F3 ossuary P2 · F4 ramp 150° · F5 ramp 318°.

## C/D. Past / Present, space by space

| Space | Past (the undercroft in use) | Present (the ruin) |
|---|---|---|
| C1 lift foot | winch on timber trestles, 4 braziers, banners | rubble mounds, two crystal shards, red glow |
| C2 Hall of Roots | carpet, braziers every 7 m, banners, pillars in the chasm span, **the Royal Grille** across y 51 | **chasm y 29–40** (abyss 26 m deep, lit rims), grille lies flat in the dust, crystal roots through the floor and across the vault |
| C3 ossuary | candles on each platform, **bridge P1→P2** with low walls | **P1→P2 bridge gone** (two stubs), **a colossal column fallen P2→P3** |
| C4 cistern | the font brimming, candles on the rim, **south door warded** (the Crown admits the crowned), north door open | south door hangs open, **north door fused by red crystal** |
| C5 descent | the ramp whole, inner parapet, torches, **the King's iron gate at 222°** | **the ramp fallen in at 40–62°**, gate torn open, low broken parapet stubs |
| C6 threshold | **Crown doors shut and warded** | doors lie broken |
| C6 arena | the coronation chamber: floor whole, 4 Sealbearer pillars to the dome, braziers, candles | 4 **wedge-shaped abysses** between the pillar stumps (1.3 m), crystal shards leaning off the stumps |

## E. Every memory weave (session 10: all walked with real movement, both memories — `dev/f3Probe.js gates()`)

| Gate | Passes in | The other memory | Teaching |
|---|---|---|---|
| Hall chasm y 29–40 | PAST (floor) | PRESENT: falls (void) | the Floor 1 lesson in one hall |
| Royal Grille y 51 | PRESENT (fallen) | PAST: blocked at the grille | …and its reverse ten metres later |
| Ossuary P1→P2 | PAST (bridge) | PRESENT: falls | a way that only existed |
| Fallen column P2→P3 | PRESENT (column) | PAST: falls | a way that only the ruin made |
| Cistern south door | PRESENT (open) | PAST: blocked (warded) | come in through the ruin… |
| Cistern north door | PAST (open) | PRESENT: blocked (fused) | …leave through the memory |
| Ramp collapse 40–62° | PAST (ramp) | PRESENT: falls | the gap is on a slope, mid-descent |
| Iron gate 222° | PRESENT (torn open) | PAST: blocked (the gate) | shift back mid-ramp, right after a Past fight |
| Crown doors | PRESENT (broken) | PAST: blocked (warded) | the heart is reached through its ruin |

The whole route (spawn → the arena, six shifts, each accepted by the destination check) passes: `F.route()`.

## F. Objectives and guidance (`src/data/objectives.ts`, floor 3)

`f3_hall` (ring at the chasm, from the PRESENT) → `f3_grille` (ring before the grille, from the PAST) → `f3_oss`
(ring on P1, from the PRESENT) → `f3_col` (ring on P2, from the PAST) → `f3_maw` → `f3_maw2` (defeat the Maw) →
`f3_font` (ring at the north door, from the PRESENT) → `f3_desc` (ring before the collapse, only if she walks the head
of the ramp in the PRESENT) → `f3_gate` (ring before the iron gate, from the PAST) → `f3_foot` → `f3_heart` (ring at
the Crown doors, from the PAST) → `f3_boss`. A shift ring shows only in the memory she must leave (session 10:
`shiftFrom`); stuck hints are voiced (`hint_f3_gap`, `hint_f3_gate`, `hint_f3_doors`), the gold guide marker points the
way after ~30 s without progress. Level prompts name each difference (`C_GAP`, `C_GRILLE`, `C_B2`, `C_B3`, `C_DOORS`,
`C_RGAP`, `C_RDOOR`, `C_WARD`).

## G. Combat plan

Rewards (resonance): goblin 30 · bat 12 · Widow 60 · widowling 12 · lamia 80 · the Maw 200 · Remnant 50 · guard 40 ·
muster 40 · archer 30 · royal warden 100 · the Last Crown 200.

| Id | Where | Memory | Composition (wave 2+ in brackets) | Notes |
|---|---|---|---|---|
| E1 | Hall of Roots south | PRESENT | 3 goblins, 2 bats [Widow from the vault, a goblin] | the floor's welcome: every new monster at once, before the chasm |
| E2 | Hall of Roots north (at the grille) | PAST | 2 royal wardens, a guard, an archer [2 guards] | the King's last guard; fought on the far side of the chasm |
| E3 | ossuary P1 | PRESENT | Widow (drops from the dark), 2 bats [2 widowlings] | a fight on a disc over a void |
| E4 | ossuary P2 | PAST | royal warden, 2 guards | on the other side of the Past-only bridge |
| E5 | the cistern | PRESENT | **THE MAW OF THE CROWNHEART** (lamia ×1.4, 900 HP) [3 bats from its belly at 65 %] [2 goblins from the dome at 35 %] | mini-boss; the rim keeps the fight round the font |
| E6 | ramp head −60..30° | PRESENT | 4 goblins, 2 bats [2 goblins] | met only by a player who walks the ramp head in the Present |
| E7 | ramp 110..200° | PAST | 2 royal wardens, 2 guards, an archer [2 muster] | the Kingsguard's last post on the stair |
| E8 | ramp 250..345° | PRESENT | lamia, Widow, goblin [Widow, 2 Remnants] | the deepest fight, just before the foot |
| BOSS | the Crownheart | BOTH | the Last Crown [3 bats out of the heart at 65 %] [2 goblins + 2 widowlings at 35 %] | §I |

Monster behaviour: `src/enemies/Monsters.ts` (goblin skirmisher, bat swarm, Widow, lamia). Session 10 audit
(`dev/auditProbe.js`): every enemy of every Floor 3 encounter acts; in the big fights every waiting enemy gets a turn.

## H. Temporal economy (worst case, critical path)

Arrive with ≥ 100 (the transition guarantees it) → E1 (+204) → shift (−100) → E2 (+350) → shift (−100) → E3 (+108) →
shift (−100) → E4 (+180) → shift (−100) → CP2 → E5 (+296) → shift (−100) → E7 (+390) → shift (−100) → E8 (+330) → CP3
→ the boss (adds + her 200). The capacity is 200, so every required shift is preceded by a fight that refills at least
one segment; a respawn at any sigil restores ≥ 100; F1–F5 refill a player who spent everything with no Echo left near.
**No route softlocks.**

## I. The Last Crown in the heart's chamber (the fight)

**Who:** Aldren's imprint fused with the Crownheart, wearing the Queen's face. `lastcrown.glb` (Mixamo Nightshade,
32 clips), 3.4 m, 1600 HP. **The reveal:** stepping onto the ring starts a 4.6 s shot — the camera tilts up to the
heart, she sinks out of its light onto the lens, the title "THE LAST CROWN", the sting, a shockwave; control returns
with both in frame. After a death the reveal plays at double speed (session 10).

**Arena:** ring r 17 (a player-height parapet round the edge), the lens r 4.2 at the centre, 4 pillars at r 11; she
keeps to r ≈ 14.5 and blinks between 8 points at r 12.5. In the PRESENT four wedge abysses (r 6–13.5, ±20° at 45/135/
225/315°) open between the stumps — the footing changes with the memory. The heart hangs above and beats with the fight
(colour per phase; `vfx/Crownheart.ts` drives the level's crown light).

**Spells and phases** (unchanged from v2; `LastCrown.ts` CASTS): bolt, twin bolts, fan, ground wave, repel (phase 1);
+ bombardment, nova, beam (phase 2, from 65 %); + orb, dark burst, binding (phase 3, from 30 %). Wards (phase 2+) and
bindings (phase 3) exist in one memory only — **her own shift breaks them** (stagger, damage window). Forced slips
move the fight between memories with a 3 s telegraph. Phase breaks: kneel, invulnerable, surge. At 65 % bats pour
out of the heart; at 35 % goblins and the brood climb over the rim.

**Death and ending:** she staggers and sinks; the camera tilts up as the heart convulses and shatters; the chamber goes
dark; "THE CROWNHEART IS SILENT" with time / Echoes / shifts / deaths, the epilogue line, and a way back to the title.

**Session 10 play-test:** a god-mode bot finishes the fight in 100–123 s (phase 2 at ~40–55 s, phase 3 at ~76–93 s, the
death sequence, the end card; 0 errors). A real-damage bot that never dodges or guards dies every ~40–60 s and reached
phase 3 once in 283 s — a lower bound: a player who guards, parries and dodges does much better. Each death respawns
at CP3 (the Threshold), the fight resets cleanly, the Present Crown doors let her back in.

## J. Streaming / performance

Scope `floor3`: `floor03.glb` (93 visual objects, 20.0k tris), `floor03_collision.glb` (4.7k tris), nav 491 KB; rigs
knight / archer / hollow (Remnants) / goblin / bat / widow / lamia / lastcrown (KTX2); the 12 boss sounds and the monster
sounds. The descent has no sky (`noSky`); the fog colour is the dark beyond the walls. Point lights come from the pooled
light rig (crown lights prioritised). Spells and Remnants are pooled and warmed behind the loading screen.

## K. Collision & shift safety

Every drop is an `abyss`: a kill volume below the rim plus black shaft walls, so a hole always reads as a hole. Shift
destinations are validated (capsule overlap + footing within 8 m in the target memory) — the six required shifts of the
route are all accepted at their ring. Scripted sequences (the lift ride, finishers) are exempt from the fall check
(session 10: the lift's descent crossed the conduit shaft's kill volume). The crystal roots and shards have no collision;
when one stands between the camera and the hero, the roots fade out (`Game.updateRoots`, session 10).

## L. Self-review / session 10 play-test fixes

- **The King's iron gate never closed the ramp** (its door box was rotated 90°, lying along the ramp): the Past walked
  past it. Fixed in the layout (rotation = the door's own angle); gate probe now OK in both memories.
- **The lift ride killed the hero:** the descent crossed the shaft's kill volume, and each "fall" cost a quarter of her
  health (4 falls). Scripted sequences are exempt now; the ride arrives at full health.
- **The floor exit tore the floor down inside the frame** (the lift → transition → unload ran synchronously inside
  `Game.step`, the rest of the frame used the disposed level and threw). The transition now starts at the top of the
  next frame.
- **Dying on Floor 3 threw inside the respawn** (`setArenaLock(false)` built Floor 1's hatch with a texture Floor 3 never
  loads). Fixed.
- **The camera sat inside the crystal shards** at the arena's west pillar (where the bridge arrives): the roots now fade.
- **The Present was too dark to read on the approach bridge** in portrait: Floor 3's Present lighting was raised
  (ambient 0.66 → 0.9, exposure 1.3 → 1.42, hero light 7.5 → 9, fog pushed back).
- Shift rings only appear in the memory that must be left; the two unmarked shifts (P2, the iron gate) got objectives.
- Repetition check: nine weaves, no two alike (gap, gate, bridge, fallen bridge, sealed door, fused door, sloped gap,
  shut gate, warded doors); the floor alternates Present and Past fights so the resonance never runs dry.
- Known limits: E6 is skipped by a player who stays in the Past from the cistern (it is not needed for the economy);
  the Past iron gate is dark iron and reads best with its prompt.

## M. Implementation map

`tools/blender/floor03_layout.py` (v3) + `build_floor03.py` (headless: `blender --background --factory-startup
--python tools/blender/build_floor03.py -- --no-render`), then `node tools/build_navgrid.mjs 3` (NAV3 — required after
any rebuild). `Floors.ts` entry 3 (env overrides, epigraph, `noSky`), Floor 2 `next: 3` via the King's lift
(`levels/Lift.ts`, F2 marker `LIFT_DEPART`, F3 `LIFT_ARRIVE`). Dev: `?floor=3`, `?at=hall3 | maw | descent | lastcrown`;
probes `dev/f3Probe.js` (gates, route), `dev/bossBot.js` (the fight), `dev/monsterProbe.js brawl()` (the Maw),
`dev/auditProbe.js` (every encounter).

## O. Asset notes

The boss asset (`Pro Magic Pack with final boss.zip` → `lastcrown.glb`) is described in CONTEXT.md §4 and
`tools/blender/build_lastcrown.py`. Monsters: `gobelin_monster.glb` (retargeted), `bat_dark_bad_cartoon_monster.glb`,
`ragno_monster.glb` (the Widow), `monster-_module_xb1011.glb` (the lamia / the Maw) — CC BY 4.0, credited in the game's
Credits (`src/data/credits.ts`).
