# LEVEL_03_BLUEPRINT.md — Floor 3: "The Crown" (the summit of Caer Veyr)

Status: **v1.0 (self-reviewed — §L). Design only; nothing built yet.** Written session 4 after Floors 1–2 were
verified end to end (god + real-damage autopilot) and after inspecting the supplied final boss asset
(`assets/characters/enemy/final_boss_light_monster.glb` → runtime `public/assets/ktx2/characters/boss.glb`, see §O).

Coordinate convention: identical to Floors 1–2 (Blender X = east, Y = north, Z = up, metres; three.js x = X, y = Z,
z = −Y). Floor 3 stacks on Floor 2: the player arrives in the **Bell Chamber at the top of Floor 2's Conduit Stair
(x 20..24, y 92..96, z 24)**. Floor base **z 24** (bell level), the Crown's floor **z 32**.

---

## A. Floor thesis

**What makes this floor distinct:** Floors 1–2 were about reading two memories of the same room. On Floor 3 the
Crownheart's hold is so strong that **the memories stop staying apart**: the castle *slips* between Past and Present
on its own near the Crown, Past figures stand in Present rooms as faint imprints, and the final room is a place where
both states are always half-present. Short, dense, rising: three approach spaces, two fights, one checkpoint pair,
then the Last Crown.

> **New rule — the Crown's pull ("slips").** Inside the Crown's influence the castle may shift *by itself*. A slip
> is telegraphed (a rising hum, the screen edge warming to the other state's colour, 3 s), costs the player nothing,
> and is never allowed to drop the player into a void or bury them (it waits for safe footing). The player's own
> shift (hold, costs resonance) is still the only way to *choose* the state.

| | |
|---|---|
| Gameplay purpose | Final exam of shifting + combat under pressure; a boss whose defences, attacks and arena differ by state; the slip rule turns state from a tool into a hazard the player must read. |
| Narrative purpose | *Should this inheritance survive at all?* Aldren's surviving imprint; the ritual's machinery at the summit; the Crownheart wants the Uncrowned's unbound blood to finish the Sundering. |
| Duration | 12–18 min first play (≈6–8 approach, ≈6–10 boss). ~220 m critical path. |
| Pacing | arrival (quiet, the bell) → Wind Gallery weave + E1 → the Terrace/Coronation Stair weave + E2 → Hall of Crowns E3 (the Last Guard) + CP2 → the Crown doors (Past) → **the Last Crown** (3 phases) → ending. |
| Difficulty | E1 mixed guards/archer; E2 Present hollows + wraiths on the ramp; E3 royal wardens + 2 archers on the reliquary gallery (hardest non-boss fight); the boss. |
| Visual identity | **Past**: the coronation night — gold leaf, white marble, banners of House Vaelor, hundreds of candles, the Crown chamber's glass lantern roof. **Present**: the summit open to a storm sky, wind, the lantern roof shattered, the Crownheart's red-gold glow welling up through cracks, crystalline resonance growth fusing doors. Past imprints (the archer "kneeling civilians" technique from F1, `imprint` markers) appear in the Present. |

Stable anchors across states: the Bell Chamber's bell frame, the Wind Gallery's arrow loops, the Coronation Stair's
lower flight, the Hall of Crowns' plinth rows, the Crown's four Sealbearer pillar bases and the central lens.

---

## B. Spatial graph

### B.1 Plan (top view, not to scale; N up)

```
                         ┌───────────── THE CROWN (CR) z32 ─────────────┐
                         │   circular, r 13 + balcony ring r 13..15      │
                         │   lens r 3.4 at (0,138) = the Last Crown      │
                         │   Sealbearer pillars r 8.5 at NE/SE/SW/NW     │
                         └──────────────┬──── Crown doors (y 124) ───────┘
                                        │ [PAST: open · PRESENT: fused shut]   (G3)
                ┌───────── HALL OF CROWNS (HOC) z32 ─────────┐
                │ plinth rows, reliquary gallery z36 (W, E)   │  CP2 (S end) + fissure F3a
                └───────┬─────────────────────────────────────┘
                        │ landing (y 108) — warded in the PAST
     CORONATION STAIR   │ lower flight z24→28 (both), upper flight z28→32 (PAST only; PRESENT: collapsed)
     (CS) x −3..3       │
                        │            EAST TERRACE (ET) z28 ─ [PRESENT: bell-spire ramp z28→32 to the landing]  (G2)
                        │               ▲ door from the gallery's west end [PAST: open · PRESENT: collapsed]
  ┌──────────────────── WIND GALLERY (WG) z24, y 96..100 ──────────────────────┐
  │ x −6 ................ portcullis x 2 [PAST only] ... floor gap x 4..10 [PRESENT] .... x 18 │  (G1)
  └──────────────────────────────────────────────────────────────────────────┬─┘
                                                              BELL CHAMBER (BC) z24 (arrival, CP1)
```

### B.2 Connectivity (critical path bold; state required in brackets)

```
**START (Present, charge ≥ 100 carried) → BC** (CP1)
**BC → WG east (x 10..18)**
**WG: floor gap x 4..10 [PRESENT hole] ─[PAST: floor intact]→ WG x 2..4 (between gap and portcullis)**      (G1 part 1: shift to PAST in BC or WG east)
**WG x 3 ─[PRESENT: portcullis collapsed]→ WG west (x −6..2)**                                            (G1 part 2: shift to PRESENT between the gap and the portcullis line)
**WG west ─[PAST: terrace door open; PRESENT: collapsed]→ ET**                                           (needs PAST: shift, E1 refunds)
**ET ─[PRESENT: bell-spire ramp]→ CS landing (z 32)**                                                    (G2: shift to PRESENT on the terrace)
**landing ─[PRESENT: no ward]→ HOC** (E3, CP2, fissure F3a)
**HOC north ─[PAST: Crown doors open]→ CR** (G3) → **the Last Crown** → ending
```

The G1 weave is the floor's opener: the player learns that on this floor *where* you shift matters within a few metres
(the safe strip x 2..4 is 2 m wide, lit by a moonlight shaft in the Present and a candle stand in the Past).

Checkpoints (Blood Sigils): **CP1** Bell Chamber (arrival) · **CP2** Hall of Crowns south (before the Crown doors;
the boss respawn point). Fissures: **F3a** in HOC (softlock guarantee for G3 and the boss), **F3b** on the East
Terrace (for G2).

---

## C. Past blueprint (room by room)

The coronation night: Aldren has summoned the court to watch him "save Veyr". The summit is ablaze with candles; the
royal wardens hold every door; the ritual machinery hums under the Crown's glass lantern roof.

- **BC — Bell Chamber (x 18..26, y 90..98, z 24; ceiling z 34).** The great bell hangs in its oak frame over a
  timber trap floor (x 20..24, y 92..96). Arrow loops, wind. Door west (x 18) to the Wind Gallery.
- **WG — Wind Gallery (x −6..18, y 96..100, z 24; roof z 29).** A roofed walkway along the north curtain: arrow loops
  north, candle stands, House Vaelor banners. **Portcullis at x 2** (closed, iron, Past only — "The wardens' gate").
  Floor intact end to end. **E1** here (after the player crosses east→west): 2 guards + 1 archer at the west end.
- **ET — East Terrace (x −14..−6, y 96..106, z 28).** Up 4 steps from WG's west door (open in the Past): an open-air
  terrace with a parapet, braziers and the bell-rope winch. **The Coronation Stair's upper flight is visible across the
  gap but the terrace has no way onto it in the Past.**
- **CS — Coronation Stair (x −3..3, y 100..108, z 24→32).** Grand marble stair in two flights (lower z 24→28, upper
  z 28→32). At the top landing (y 106..108, z 32) the **Royal Ward** — a curtain of gold light — rejects the Uncrowned
  ("The Crown admits the crowned"). Reachable from WG's middle in the Past (door at x 0, y 100).
- **HOC — Hall of Crowns (x −14..14, y 108..124, z 32; roof z 40).** Twelve crowns of House Vaelor on marble plinths in
  two rows; the reliquary gallery (z 36) along both long walls with archers' niches. **E3 the Last Guard** (Past
  variant). CP2 at the south end. Crown doors at the north end (x −3..3, y 124): **open** (the court is filing in).
- **CR — The Crown (circle r 13 at (0, 138), z 32; balcony ring r 13..15 at z 32; lantern roof z 48).** White marble
  floor inlaid with the royal star; four **Sealbearer pillars** at r 8.5 (NE/SE/SW/NW) carrying golden chains to the
  lens; the **lens** (r 3.4) at the centre where the Last Crown is enthroned. Floor intact.

## D. Present blueprint (same footprint, generations later)

Storm sky, wind; everything above z 29 lost its roof; the Crownheart's growth (red-gold crystal) seals what the
ritual touched.

- **BC.** The bell fell through the trap floor and hangs lodged at z 21 (a crater, **void** x 20..24, y 92..96 — the
  arrival spawn is at x 25, y 94 on the intact east strip). CP1 on the north side.
- **WG.** Roof gone. **Floor gap x 4..10 (void)** — the gallery floor fell onto Floor 2's conduit stair. The portcullis
  is a rusted lattice lying flat (walkable) at x 2. West end: the terrace door has collapsed (rubble, solid).
- **ET.** The bell-spire (the tower's timber spire, fallen) lies as a **ramp from the terrace (x −8, y 104, z 28) up to
  the stair landing (x −3, y 107, z 32)**, 0.9 m wide with a rail of spire lattice. Hollows nest here. Fissure F3b.
- **CS.** Lower flight intact; **upper flight collapsed** (void between z 28 landing and z 32). The Royal Ward is gone
  (the Present is "a temporary error" to the Crown — its protections do not exist here).
- **HOC.** Roof gone; plinths toppled (cover); the reliquary gallery half-collapsed (east side walkable, west side
  gone). Past **imprints** of the kneeling court (`imprint` markers) face the Crown doors. **Crown doors fused shut**
  by crystal growth (solid). E3 Present variant. CP2, fissure F3a.
- **CR.** The lantern roof shattered; the floor ring has **four wedge-shaped holes** over the conduit shaft between
  the pillars (at N/E/S/W, r 5..11, ~50° each) — the red-gold glow wells up through them. Pillars are broken stumps
  (1.2 m). Lens and the Last Crown unchanged (the Crown is the one thing the same in both memories).

## E. State-difference matrix

| Place | Past | Present | Why it matters |
|---|---|---|---|
| BC floor | trap floor intact | crater (void) | arrival safe strip; slips cannot drop you here |
| WG x 4..10 | floor | void | G1 part 1 needs PAST |
| WG x 2 | portcullis (solid) | lattice flat | G1 part 2 needs PRESENT |
| WG → ET door | open | rubble | ET only via PAST |
| ET ramp | — | bell-spire ramp to z 32 | G2 needs PRESENT |
| CS upper flight | stair + Royal Ward | collapsed | the obvious route is warded; the ruin is the way |
| Crown doors | open | fused | G3 needs PAST |
| Crown floor ring | intact | 4 wedge holes | boss arena hazards differ |
| Sealbearers | intact, glowing chains | stumps | the ward's anchors (boss phase 1) |

## F. Puzzle / traversal sequences

- **G1 (Wind Gallery weave):** arrive Present (BC east strip) → walk to WG east (x 10..18) → the gap x 4..10 →
  **shift to PAST** (cost 1) → cross → the portcullis blocks at x 2 → step into the strip x 2..4 → **shift to PRESENT**
  (cost 1; E1 in the Past was fought on the way or not at all — see economy) → walk over the flattened lattice.
  Prompts: "The gallery fell here — in this memory." / "The wardens' gate stands in the other memory."
- **Terrace:** WG west, Present: the door is rubble → **shift to PAST** (E1 is here in the Past: 2 guards + archer,
  refunds 110) → up to ET.
- **G2 (the spire):** on ET in the Past the upper stair is out of reach → **shift to PRESENT** on the terrace (F3b nearby
  guarantees charge) → E2 (3 hollows + 2 wraiths on the terrace/ramp) → climb the spire ramp to the landing (no ward in
  the Present) → HOC.
- **G3 (the Crown doors):** HOC in the Present (E3 Present: 2 hollow wardens + 3 hollows + 1 echo archer on the east
  gallery) → CP2 → the doors are fused → **shift to PAST** (F3a guarantees charge) → the doors stand open → the Crown.
  Prompt: "The court is filing in. The Crown is waiting for you."

## G. Combat plan

| Id | Where | State | Composition | Reward |
|---|---|---|---|---|
| E1 | WG west + ET door | PAST | 2 guards, 1 archer (on the terrace steps, perched) | 110 |
| E2 | ET + ramp | PRESENT | 3 hollows (rise), 2 wraiths (over the ramp void) | 170 |
| E3 | HOC | PRESENT (and a PAST variant if the player shifts there first) | Present: 2 hollow wardens, 3 hollows, 1 echo archer (east gallery, perched) · Past: 2 royal wardens, 2 guards, 2 archers (reliquary gallery) | 280 |
| BOSS | CR | BOTH | the Last Crown + summoned adds (pooled) | surge to 200 on each phase break |

Archers use the session-4 AI (34 m sight, perched lean over parapets): the reliquary archers cover the whole Hall.

## H. Temporal economy (worst case)

Arrive with ≥ 100 (carry). G1 needs two shifts (Past for the gap, Present for the portcullis) before E1, so a charge
source must sit between them: **E0 — 2 Remnant risers in the Past strip x 4..10** (the gallery's last defenders,
+80) and **Fissure F3c in WG east (x 14, y 98)** (the softlock guarantee if the player arrives with exactly 100 and
skips E0). Worst case then: 100 → 0 (G1a) → +80 E0 / fissure → shift G1b → E1 (+110)
→ shift (terrace) → E2 (+170, F3b) → G2 shift → E3 (+280, F3a) → G3 shift → boss (surges). Every shift point has a
fissure within 14 m or a guaranteed encounter before it, so **no route softlocks** after enemies are exhausted.

## I. The Last Crown (boss)

The Crownheart's manifestation of King Aldren, enthroned on the lens: a crowned seraph of feathered wings rising out
of a black pool (the supplied asset, 4.2 m at 2× scale). **It never leaves the lens** (the asset has one 8.8 s idle
"Motion" clip — the fight is built from state, space, telegraphed area attacks, adds and procedural motion:
rise/sink, lean, wing pulse via emissive, crest flare). HP 1500. Arena r 13 + balcony.

**Phase 1 — "The Crown remembers" (100 → 70 %).** On entry the Crown pulls the player into the **Past** (a slip).
The **Royal Ward** (golden dome, damage ×0.1) is fed by the four Sealbearer pillars. Each pillar carries a
**resonant fracture** (Floor 2's rule): a heavy blow / kick in the Past breaks it — and in the Present it has always
been a stump. Each break: the ward flickers, the boss screams (stagger 2 s). Attacks: **Decree** (golden ring expanding
from the lens at ankle height; jump or dodge through it), **Summons** (2 guards every ~20 s from the balcony doors;
resonance source). When all four are broken: ward shatters, surge +100, **phase 2**.

**Phase 2 — "The castle slips" (70 → 35 %).** The boss is vulnerable in both states; **every ~22 s it forces a slip**
(3 s telegraph; waits for safe footing — never over a Present hole). Its attacks differ by state:
- *Past* — **Crown beam**: a slow rotating golden beam at knee height (jump or dodge i-frames), Decree rings, guards.
- *Present* — **Void lances**: 3-lance volleys aimed with the archer lead rule (dodgeable, blockable), the wedge
  holes, wraith adds.
The player's own shift lets them pick the state they fight better in — at the cost of resonance.

**Phase 3 — "The Binding" (35 → 0 %).** The Crown wants the Uncrowned's unbound blood to finish the ritual.
**Binding**: a golden tether to the player (slow pull toward the lens, 6 s channel). **The binding only exists in the
state it began in: shifting breaks it** ("THE BLOOD REFUSES") → the boss is staggered 4 s (big damage window). If the
channel completes: 60 damage + knockdown (never an instant kill). Adds keep resonance available; F3a is outside the
arena doors if everything fails (the arena doors stay open in both states once the fight started).

**Death:** wings fold, the lens cracks, slow-mo, the red-gold glow drains from the holes; a final forced slip to the
**Present** — permanent (the Crownheart is silent). Ending card: *"The Crownheart is silent. Caer Veyr is only stone
now — and stone can fall. The Uncrowned walks down through the one castle that remains."* + time / Echoes released /
shifts / deaths.

## J. Streaming / performance

One floor scope `floor3`: level GLB (target ≤ 12k tris visual, ≤ 3k collision), enemy rigs knight/hollow/archer/ghost
(already core-resident candidates), **boss.glb (KTX2 13.2 MB on disk, ~10 MB VRAM)**. Boss adds come from a pool built at
load (like remnants) — nothing instantiated mid-fight. Warm-up must include the ward dome, beam, lance and ring
materials (EnemyManager.warmKit style).

## K. Collision & shift-safety register

- Slips use `TimeSystem` validation; they *wait* (retry every 0.25 s, up to 6 s, then relocate the player to the
  nearest `warden_anchor`-style safe marker) — never into a void, never buried.
- Crown floor holes are `void` volumes in the Present only; pillars' Present stumps are 1.2 m (jumpable cover).
- BC crater and WG gap are Present `void` volumes; spawn and CP1 sit on the intact strip.
- The spire ramp: 0.9 m wide + lattice rail collision (the player cannot be knocked off by the new ledge-safe
  knockback anyway); wraiths over the ramp void.

## L. Self-review (v1.0)

- *Weak:* G1 as first drafted needed two shifts before any charge source → fixed with E0 remnants in the Past strip
  and fissure F3c (§H).
- *Repetition check:* G1 (precise-position weave), G2 (ruin as the only route — the ward), G3 (Past-only doors) are
  three different ideas; the boss adds two new ones (slips, binding-break).
- *Boss asset reality:* no locomotion or attack clips → the design is stationary by intent (fits the lore: fused
  with the mechanism) and all attacks are area/projectile patterns the existing VFX/audio can express.
- *Portrait:* the arena is circular with the boss at the centre — the portrait camera looking at the lens frames the
  boss above the hero; off-screen markers cover adds on the balcony. Beam/ring hazards are ground-level and read from
  above.

## N. Implementation plan (next session)

1. `tools/blender/floor03_layout.py` + `build_floor03.py` (copy of the floor02 driver) → `public/assets/levels/floor03*.glb`;
   markers: spawn, CPs, fissures, encounters E0–E3 + BOSS, `boss_lens`, `sealbearer` ×4 (as Floor 2 `fracture`
   markers with a `boss` flag), `slip_safe` markers, prompts, voids, imprints, moon holes.
2. `src/levels/Floors.ts` entry 3 (title "Floor III — The Crown"), `floorManifests.json` via `npm run assets:manifest`,
   `GameAssets.floorKeys(3)` + `boss` rig key; Floor 2's `next: 3`.
3. `src/enemies/LastCrown.ts` — boss controller (phases, ward, Decree ring, Crown beam, void lances via the arrow pool
   with a spectral material, summons from a pool, slips via `TimeSystem`, binding tether) + `EnemyManager` hooks
   (player hits → boss damage, boss bar "THE LAST CROWN").
4. `Game.finish()` for the last floor: the ending sequence + card.
5. `AutoPilot` `ROUTES[3]` and a boss fight tick; verify god + real damage.

## O. Boss asset notes (session 4)

`tools/build_boss.mjs`: source 30.5 MB → `public/assets/characters/boss.glb` 14.8 MB → KTX2 13.2 MB. Six body PNGs were
byte-identical (15 → 8 textures), every material was BLEND with < 1 % transparent texels (now opaque; wings
alpha-tested), 787 constant scale tracks removed (805 animated channels left). 22.4k tris, 9 skinned meshes with
morph targets, 399-joint Reallusion rig; bind-pose bounds 3.4 × 2.1 × 2.3 m → spawn at 2× (4.2 m tall). Verified in
engine (loads 0.7 s, renders correctly, idle plays). **More boss animation would improve the fight a lot (see
CONTEXT §9): wing-spread/roar, a strike, a hit flinch, a death — even as blend-shape or bone clips on the same rig.**
