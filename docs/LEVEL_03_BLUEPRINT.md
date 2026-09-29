# LEVEL_03_BLUEPRINT.md — Floor 3: "The Crown" (the summit of Caer Veyr)

Status: **v2.0 (session 5, self-reviewed §L)** — supersedes v1.0. v1.0 assumed the old final-boss asset
(`final_boss_light_monster.glb`, one 8.8 s idle clip) and designed a **stationary** boss. That assumption is
**obsolete**: the user supplied `Pro Magic Pack with final boss.zip` (Mixamo "Nightshade", a 2.35 m horned sorceress with
a full mage animation set, inspected in §O). The Last Crown is now a **mobile mage boss** fought at three ranges.

Coordinates: Blender X east, Y north, Z up (three.js x = X, y = Z, z = −Y), identical to Floors 1–2. Floor base
**z 24** (the Bell Chamber at the top of Floor 2's Conduit Stair), the Crown's floor **z 32**.
Mirrored in code by `tools/blender/floor03_layout.py` (§M).

---

## A. Floor thesis

Floors 1–2 taught reading two memories of one room. On Floor 3 the Crownheart's hold is so strong the memories stop
staying apart: near the Crown the castle **slips** on its own, and the final fight is decided by *when* the player
chooses a memory, not only where. Short and rising: arrival → one weave + one fight → the warded stair → the Hall of
Crowns (hardest non-boss fight) → the Last Crown.

| | |
|---|---|
| Gameplay purpose | Final exam: sword combat under ranged pressure + shifting as a combat tool (break wards, beat bindings, pick cover). |
| Narrative purpose | *Should this inheritance survive at all?* The Crownheart made the Last Crown from Aldren's imprint — and dressed it in the shape of **the Queen** who saved the Uncrowned's line (Floor 2, T3). It wants the unbound blood to finish the ritual. |
| Duration | 10–15 min first play (≈4–6 approach, ≈6–9 boss). ~130 m critical path — clearly shorter than Floors 1–2. |
| Visual identity | **Past**: coronation night — candles, gold, white marble, intact Sealbearer pillars. **Present**: summit open to a storm sky, the Crownheart's red-gold glow welling through floor wounds, pillars broken to stumps. |

**New rule — slips.** In the Crown the castle may shift by itself: a 3 s telegraph (hum, the future holes glow on the
floor), costs the player nothing. The player's own shift (hold, 100 resonance) is still the only way to *choose*.

## B. Spatial graph (critical path bold)

```
                      ┌──────── THE CROWN (CR) z32, circle r13 at (0,138) ────────┐
                      │ lens r3 · 4 Sealbearer pillars r8.5 · Present: 4 wedge holes│
                      └───────────────┬─ Crown doors y124 [PAST open · PRESENT fused]┘
            ┌──────── HALL OF CROWNS (HOC) z32  x −12..12, y 108..124 ────────┐  CP2 + fissure F3a (S end)
            └───────────────┬────────────────────────────────────────────────┘
                            │ top landing y106..108 z32 — PAST: Royal Ward (gold light, solid)
   CORONATION STAIR (CS)    │ upper flight z28→32 PAST only · PRESENT: fallen bell-spire ramp (x 3..5)
   x −3..3, y 100..106      │ lower flight z24→28 BOTH (mid landing y 102..104 z28)
  ┌──────────── WIND GALLERY (WG) z24, x −6..18, y 96..100 ────────────────────┐
  │ W end: stair door x −3..3 · portcullis x 2 [PAST] · floor gap x 4..10 [PRESENT void] │
  └────────────────────────────────────────────────────────────────┬──────────┘
                                                       BELL CHAMBER (BC) z24, x 18..26, y 90..98 — SPAWN, CP1
```

1. **BC** (Present spawn, CP1) → WG east.
2. **G1 weave:** gap x 4..10 is a void in the Present → **shift to PAST** (floor intact) → cross → the Past portcullis
   (x 2) blocks → from the strip x 2..4 **shift to PRESENT** (the grille lies flat) → WG west. Charge between the two
   shifts: **E0** (2 remnants, Past, in the gap strip, +100) and **fissure F3c** (x 14).
3. **E1** (Present, WG west + stair foot): 2 hollows + 1 echo archer on the mid landing.
4. **G2 the warded stair:** Past = the stair's upper flight exists but the Royal Ward (solid gold light) seals the top
   landing ("The Crown admits the crowned"); Present = upper flight collapsed, the **fallen bell-spire** leans from the
   mid landing (x 3..5, y 101..106, z 28→32) to the top landing → climb it **in the Present**.
5. **HOC:** **E2** (Present): 2 hollow wardens + 2 hollows + 1 echo archer (east gallery ledge). CP2 + F3a at the south
   end. **G3:** Crown doors fused in the Present → **shift to PAST** (F3a guarantees charge) → the doors stand open.
6. **CR:** the Last Crown. Ending.

## C/D. Past / Present per space

| Space | Past | Present |
|---|---|---|
| BC | trap floor, bell in its frame | bell fell through: crater void x 20..24 y 92..96; spawn on the E strip |
| WG | roofed walkway, candles, **portcullis x 2** | roof gone, **floor gap x 4..10** (void), portcullis lies flat |
| CS | full marble stair, **Royal Ward** at the top | lower flight only; **bell-spire ramp** to the top landing |
| HOC | 12 crown plinths, banners, **Crown doors open** | plinths toppled (cover), **doors fused** by red crystal |
| CR | white marble star floor, **4 intact Sealbearer pillars** (full cover) | 4 **wedge holes** (voids, r 5..11 between the pillars), pillars = 1.3 m stumps (low cover) |

## E. State-difference matrix (why each difference exists)

| Place | Past | Present | Purpose |
|---|---|---|---|
| WG x 4..10 | floor | void | G1 part 1 needs PAST |
| WG x 2 | portcullis | flat grille | G1 part 2 needs PRESENT |
| CS top | stair + ward (solid) | spire ramp | G2: the ruin is the way |
| Crown doors | open | fused | G3 needs PAST |
| CR pillars | full cover (blocks bolts + beam) | stumps (bolts pass; low waves blocked) | cover choice in the fight |
| CR floor | intact | 4 wedge voids | slips change the footing |

## G. Combat plan (approach)

| Id | Where | State | Composition | Reward |
|---|---|---|---|---|
| E0 | WG gap strip | PAST | 2 remnants (rise) | 100 |
| E1 | WG west + stair foot | PRESENT | 2 hollows + 1 echo archer (mid landing, perched) | 110 |
| E2 | HOC | PRESENT | 2 hollow wardens, 2 hollows, 1 echo archer (east ledge, perched) | 250 |
| BOSS | CR | BOTH | the Last Crown + pooled remnant adds | surge on each phase break |

## H. Temporal economy (worst case)

Arrive ≥ 100 → G1a (−100) → E0 (+100) / F3c → G1b (−100) → E1 (+110) → G2 (−100, F3c/E1 cover it) → E2 (+250) →
G3 (−100, F3a) → boss: phase breaks surge +100, adds +50 each. Every forced shift has a fissure within 14 m or a
guaranteed encounter before it: **no route softlocks**. Checkpoints: CP1 (BC), CP2 (HOC south; the boss respawn).

## I. The Last Crown — mage boss (the fight)

**Who:** Aldren's imprint fused with the Crownheart, wearing the Queen's shape ("Come home, child. Finish what I
began."). Model: `lastcrown.glb` (Nightshade, 13k tris, 32 clips), scale 1.15 → 2.7 m. HP 1600. Arena r 13.

**Ranges and vocabulary** (every spell is telegraphed: a hand glow + cast sound, then a ground/ray marker for AoE):

| Range | Spell (clip) | Behaviour | Counter |
|---|---|---|---|
| Long (> 9 m) | **Bolt** (`throw`) | 1 fast bolt, aimed with lead | sidestep / dodge / guard (blockable) |
| Long | **Twin bolts** (`double_cast`) | 2 bolts, 0.35 s apart | dodge the second |
| Long | **Bombardment** (`slam_call`) | 3–5 rune circles under/around the player, erupt after 1.2 s | move out |
| Long (P2+) | **Beam** (`beam`) | channelled ray that sweeps 70° | Past: hide behind a pillar · Present: jump it (knee height) / dodge i-frames |
| Mid (4–9 m) | **Fan** (`sweep`) | 5 bolts in a 60° fan | dodge through a gap / guard |
| Mid | **Ground wave** (`ground_slam`) | expanding ring at ankle height | jump or dodge through |
| Mid (P2+) | **Nova** (`nova`) | 1.1 s tell, radial burst r 6 | get out or dodge at the right time |
| Short (< 4 m) | **Repel** (`push`) | point-blank blast, knockback | guard (chip) / dodge |
| Short (P3) | **Dark burst** (`crouch_blast`) | deep crouch tell 0.9 s, burst r 4.5 | back off / dodge |
| Short | **Blink** (`leap`) | after ~3 s pressed in melee: leap tell → vanishes → reappears at the arena edge, bolt on arrival | chase; she stays hittable during the tell |
| P3 | **Orb** (`charge_orb`) | slow homing orb (turn-rate limited), explodes r 3 after 5 s or on contact | outrun / strike it? (no) — dodge at contact |

**Phase 1 — "The Crown remembers" (100→65 %).** The fight opens with a forced slip to the **Past**. Readable pace
(1.6–2.2 s between casts): bolt, twin bolts, fan, ground wave, repel, blink. At 80 % she summons 2 remnants.
**Phase break (65 %):** kneel → invulnerable 3 s, crown resonance, shockwave pushes the player back, surge +100.

**Phase 2 — "The castle slips" (65→30 %).** Faster casts (1.2–1.7 s). Adds bombardment, nova, **beam**. **Ward:** every
~16 s she crosses her arms and raises a ward **bound to the current memory** (damage ×0.1). **Shifting breaks it**
("THE WARD WAS WOVEN IN ANOTHER MEMORY") → 3.5 s stagger, damage ×1.5. **Forced slips** every ~24 s (3 s telegraph:
the Present wedges glow red on the Past floor; stand clear or fall = the usual fall penalty).
**Phase break (30 %):** kneel, invulnerable, surge +100, the storm turns red.

**Phase 3 — "Temporal collapse" (30→0 %).** She combines spells (bolt → nova, fan → bombardment), adds dark burst and
the orb, slips every ~15 s, and every ~20 s casts **Binding**: a golden tether pulls the player toward the lens for
4 s — **shifting breaks it** ("THE BLOOD REFUSES") → 4 s stagger. If it completes: 45 damage + knockdown (never a kill).
**Death:** she staggers, sinks, the lens cracks, slow-mo, a final slip to the **Present** (permanent), ending card.

**Why time-shifting matters in the fight (and never replaces the sword):** wards and bindings are broken *only* by
shifting (each costs 100, refilled by adds and phase surges) — the shift opens the biggest damage windows, the sword
does the damage. Cover differs by state (Past pillars stop bolts and the beam; Present stumps don't, but Present
holes change the footing). Forced slips move the fight between memories on the boss's schedule.

**Fairness:** ≤ 6 live bolts, ≤ 5 rune circles, 1 beam; every AoE has a ground marker ≥ 0.9 s before damage; no spell
lands from off-screen without an edge indicator (portrait threat chevrons include incoming bolts and the boss).

## J. Streaming / performance

Scope `floor3`: level + collision GLBs, knight/hollow/archer/ghost rigs as needed, `lastcrown.glb` (KTX2 5.7 MB, 3
textures 1024²), 12 boss sounds (floor-only). Spells are pooled at floor build (`src/vfx/Spells.ts`): bolt meshes,
rune circles, rings, beam, ward, tether — shared geometry, two shared additive materials; the warm-up kit renders one
of each behind the loading screen (no first-cast compile/upload). Adds come from the pre-built remnant pool.

## K. Collision & shift-safety

Wedge holes and the BC crater / WG gap are Present `void` volumes. The Royal Ward is a PAST-only collider. Slips use
`TimeSystem.setState` (no validation — the telegraph makes them fair); a player caught over a hole takes the fall
penalty. Boss arena is sealed by nothing: the fight stays in the ring because she keeps it there (blink returns to r 10).

## L. Self-review (v2.0)

- v1.0's stationary design is replaced; kept: slips, the ward-anchor idea (now a ward bound to one memory), binding.
- Repetition: G1 (precise weave), G2 (warded stair / ruin route), G3 (Past-only doors) — three different ideas.
- Portrait: the boss is framed ahead of the hero at 5–12 m (portrait camera + boss pull-back); ground markers read
  from the high portrait camera; bolts from off-screen get edge chevrons.
- Scope honesty: Floor 3 is ~40 % of Floor 2's length by design.

## M. Implementation (session 5)

`tools/blender/floor03_layout.py` + `build_floor03.py` → `public/assets/levels/floor03*.glb`; `src/levels/Floors.ts`
entry 3 (Floor 2 `next: 3`); `src/enemies/LastCrown.ts` (boss AI, phases, wards, slips, binding) + `src/vfx/Spells.ts`
(pooled spells) + archetype `last_crown`; boss SFX via ElevenLabs (`tools/elevenlabs_sfx.json`); ending in
`Game.finish`. See CONTEXT.md §6/§10 for what is verified.

## O. Asset notes (session 5)

`Pro Magic Pack with final boss.zip`: `Nightshade J Friedrich.fbx` (68 bones = the hero's 65 mixamorig bones + Ribbon1-3,
12,999 tris, 2.35 m, diffuse/normal/specular/glow 2048²) + 56 clips on the same skeleton (verified). Inspection:
`tools/blender/inspect_pack.py` → `build/analysis/magic/inspect.json`, sheets `build/analysis/magic/sheet_*.png`,
close-ups `close_boss.png`. 32 clips used (`tools/blender/build_lastcrown.py` lists each with its role and the unused
ones with the reason) → `public/assets/characters/lastcrown.glb` (4.4 MB; KTX2 5.7 MB) + `src/data/bossAnimations.json`
(hand-release peaks per cast). The old `boss.glb` (seraph, one clip) is **no longer used** by Floor 3.
