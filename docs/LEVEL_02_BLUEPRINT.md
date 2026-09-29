# LEVEL_02_BLUEPRINT.md — Floor 2: "Complicity" (the Royal Floor of Caer Veyr)

Status: **v1.1 (self-reviewed — see §L). Built v1 (2026-09-29); session 3: god autopilot route `ROUTE2` verified spawn → exit
(conduit-stair landing gap fixed; enemies now path round floor holes; the Kingsguard is caught at ledges). FR2 not built.
As-built coordinates differ from §M in places (CP2 (38, 62), crown bridge gallery→loft, G4 at (0, 58, 14)) — the layout
script and `ROUTE2` are authoritative.** Designed after Floor 1 was built, exported, played end to end and
verified (see `CONTEXT.md` §6). Authority for Floor 2 geometry, routes, encounters and temporal economy.
Implementation mirrors the coordinate appendix (§M) in `tools/blender/floor02_layout.py` (to be written).

Coordinate convention: identical to Floor 1 (Blender X = east, Y = north, Z = up, metres; three.js
x = X, y = Z, z = −Y). Floor 2 shares Floor 1's frame so the two floors stack truthfully: the player arrives
at the top of Floor 1's Royal Stair (x −3..3, y 58, z 8). **Floor base z = 8** (royal wing), the east range
floor is z 10 (on top of Floor 1's armory roof, 9.5), the Long Gallery runs at z 16 (above the Great Hall's
roof, 15.6).

---

## A. Floor thesis

**What makes this floor distinct:** Floor 1 circled the Great Hall on the ground; Floor 2 circles it
*from above*. The Royal Floor is the family's own world — the King's antechamber, the Chancery where the
orders were signed, the wardens' quarters, a portrait gallery that bridges the hall's roof, and the King's
apartments. The player makes one big clockwise loop (royal wing → chancery → east range → over the hall →
back into the royal wing from the top) and finally *drops back into the room they started in*, now able to
cross it. Floor 2 introduces one new rule that builds on everything Floor 1 taught:

> **Resonant fractures — what you break in the Past stays broken in the Present.**
> A few load-bearing things in the Past glow with a hairline of resonance. A heavy blow shatters them.
> The collapse happens in front of you in the Past, and when you shift, the Present has *always* been
> that way: the fall happened generations ago.

It is used twice: once taught in isolation with a spectacular, legible result (the Crown Chandelier), once
combined with combat (a gallery beam dropped on an enemy formation, which also reshapes a Present route).

| | |
|---|---|
| Gameplay purpose | Assume mastery of shifting and combat; ask for longer state weaving (two shifts inside one room), height play (mezzanines, roof ridges, a loft), and cause-and-effect across states (fractures). Harder mixed encounters: elite wardens, archers on mezzanines, wraiths over voids. |
| Narrative purpose | *What did my family do?* Evidence of the preservation ritual and of complicity: the Chancery's orders sealing people in, wardens who refused and were executed, the Queen who resisted and **saved an unbound child** (the Uncrowned's ancestor), the King's own plan in his study. |
| Emotional question | *What did my family do?* |
| Duration | 25–35 min first play (≈16 combat, ≈8 traversal/puzzle, ≈5 reading). ~560 m critical path. |
| Pacing | Arrival fight → first shift (opener) → chancery puzzle under archer fire → wardens' range (combat + rooftop route) → tower climb → the Long Gallery weave (two shifts over the hall) → the Crown Loft fracture (spectacle) → drop back into the antechamber → chandelier crossing → the Kingsguard in the King's apartments → the conduit stair to Floor 3. |
| Difficulty curve | E1–E2 re-warm; E3 first mezzanine archers; E4–E5 elites (royal wardens) + hollow wardens; E7 gallery fight on a narrow bridge; E9 wraiths over the antechamber void; E10 the **Kingsguard Captain** (floor boss) with a state-changing arena. |
| Visual identity | **Past**: royal interiors — marble floors, jacquard hangings, gilt (fabric_gold), dark polished wood, candlelight and chandeliers, portraits, *fewer torches than the military Floor 1, more candles*. **Present**: roofs gone to the sky (the upper floor took the weather), moonlight everywhere, wind, burned hangings, bird-streaked marble, ivy/grass on the roof ridges, the red-gold Crownheart glow rising up the conduit shaft. |

Stable anchors across states: the antechamber's four piers and the Royal door, the chancery's column line,
the wardens' range roof ridge, the Minstrels' Tower, the Long Gallery's two end doors, the King's bed alcove,
the conduit shaft's glow.

---

## B. Spatial graph

### B.1 Architectural hierarchy
- **Public royal**: Landing, King's Antechamber (ANT) with the Crown Loft (CL) above.
- **Administrative**: Chancery (CHN) + Archive mezzanine.
- **Military (royal guard)**: Wardens' Walk (WW), Wardens' Range (WR) above Floor 1's armory.
- **Ceremonial / dynastic**: Minstrels' Tower (MT), Long Gallery of Kings (LG) bridging the hall roof.
- **Private royal**: Queen's Solar + Nursery (QS, optional), King's Apartments (KAP) + Study (KS).
- **Hidden / ritual**: the Conduit Shaft and Conduit Stair (CS) up to the Bell Chamber (BC) → Floor 3.

### B.2 Plan (top view, not to scale; N up)

```
                 ┌──────────────── KING'S APARTMENTS (KAP) ──────────┐
                 │  bed alcove     study (KS) ── CONDUIT SHAFT/STAIR ─┼─► BELL CHAMBER → FLOOR 3
                 └───────────────┬── Royal door ──┬───────────────────┘
  ┌──────────────┐  ┌────────────┴────────────────┴───────────┐  ┌──────────────────────┐
  │ QUEEN'S SOLAR├──┤ KING'S ANTECHAMBER (ANT)  z8            ├──┤  CHANCERY (CHN) z8    │
  │ (QS, opt.)   │  │  Present collapse (centre-north) = void  │  │  archive mezzanine z12│
  │ nursery N    │  │  CROWN LOFT (CL) ring z14 above          │  │  (east side)          │
  └──────────────┘  └──────────────┬──────────────────────────┘  └──────────┬───────────┘
                         LANDING (from Floor 1 Royal Stair)                  │ east door
                                                                    WARDENS' WALK (WW) z8→10
                                                                             │
          ┌──────────── LONG GALLERY OF KINGS (LG) z16 over the hall roof ─┐  WARDENS' RANGE (WR) z10
          │ N door → CL                 (Present: middle fallen)     S end ├─ MINSTRELS' TOWER (MT)
          └──────────────────────────────────────────────────────────────┘      z10 → z16
```

### B.3 Connectivity graph (critical path bold; state required in brackets)

```
**START (Present, charge carried from Floor 1 ≥ 100) → LND → ANT** (E1, CP1)
**ANT ─[PAST: chancery door open; Present choked]→ CHN**                          (G1)
**CHN floor ─[PAST: timber stair]→ mezzanine z12 ─[PRESENT: sagged mezzanine slope]→ east door (open) → WW** (G2, CP2 at WW)
**WW → WR (z10) ─[PRESENT: fallen trusses = ramp to the roof ridge z14]→ ridge → MT upper door z16** (Past: "Wardens only" iron gate at WR south)
**MT (CP3) → LG south end ─[PAST: gallery intact]→ LG north end ─[PRESENT: seal broken]→ CL** (G3, G4)
**CL ─[PAST: the Crown winch]→ break FRACTURE FR1 (chandelier falls in ANT)** (G5)
**CL ─[PRESENT: loft stair's upper half, 3 m drop]→ ANT west strip (CP4) ─[PRESENT: fallen chandelier spans the void]→ Royal door (seal broken) → KAP** (G6)
**KAP** (E10 Kingsguard Captain, both states) **→ KS ─[PAST: conduit stair intact]→ CS → BC → EXIT** (G7, CP5 in KS)

Optional: QS (Present only; Past door barred from within) — lore climax (the Queen's letter), a Fissure,
optional fight E2b; WR Past north half (E5b royal wardens, big charge); CHN Past mezzanine north (lore trace).
```

Checkpoints (Blood Sigils): **CP1** ANT south · **CP2** WW · **CP3** MT base · **CP4** ANT west strip (below the
loft drop) · **CP5** King's Study.

Exit: Bell Chamber, top of the Conduit Stair (x 20..24, y 92..96, z 24) — door "to the Crown" (Floor 3).

---

## C. Past blueprint (room by room)

The Past is the royal floor on the last night: the court is split, the King's wardens hold every door, the
Queen is confined, clerks work through the night on sealing orders. Royal seals reject the Uncrowned.

**LND — Landing (x −3..3, y 58..62, z 8).** Top of the Royal Stair; two halberd racks; candles. Door north
into ANT (open).

**ANT — King's Antechamber (x −12..12, y 62..78, floor z 8, ceiling z 18).** Marble floor, four great piers
at (±6, 66) and (±6, 74), petitioners' benches along the walls, a long table of seals. **The Crown
Chandelier** — an iron ring 5 m across with candle cups — hangs at z 15 over (0, 72) on a chain that runs up
to the Crown Loft's winch. **Crown Loft (CL)**: a 3 m-wide gallery ring at z 14 around the room's upper
volume (N, E, W sides; parapet 1.1 m), reached in the Past by the **loft stair** along the west wall
(x −12..−10, y 64→74, z 8→14; iron gate at its foot, **locked by Royal Order**) and by the Long Gallery door
at the loft's north-east. Doors: S from LND (open); **E to CHN (x 12..13, y 68.8..71.2) open**; **W to QS
barred from within** (the Queen's own bar — lore); **N Royal door to KAP (x −2..2, y 78..79) sealed** ("The
door does not know you"). Enemies: **E1b** (Past arrival fight) 3 Royal Guards + 1 Royal Archer on the loft.

**QS — Queen's Solar (x −30..−14, y 62..78, z 8, ceiling 14) + Nursery (x −30..−20, y 78..86).** Only
enterable in the Present (Past door barred from inside). In the Past it is visible through a grille in the
door: the Queen's Echo writing at her desk, two cradles in the nursery.

**CHN — Chancery (x 14..34, y 60..80, z 8, ceiling z 16).** Clerks' desks in rows, record shelves (2.4 m high,
cover), a sealing press. **Archive mezzanine** along the east wall (x 30..34, y 60..80) and north wall
(x 14..34, y 77..80) at z 12, slab 11.6..12, parapet 1.1 m, carried on timber posts. **Timber stair** from the
floor at the north-west (x 14..16, y 70→77, z 8→12) up to the north mezzanine. **East door (x 34..35,
y 64..67, z 8), sealed by Royal Order** (iron-bound, full collision). Enemies: **E3** 3 Royal Guards on the
floor + 2 Royal Archers on the east mezzanine.

**WW — Wardens' Walk (x 30..34, y 44..60, z 8→10).** A vaulted corridor from the Chancery's east door south
to the Wardens' Range, rising by a stair (y 52..56, z 8→10). **CP2** at (32, 58, 8). Lanterns.

**WR — Wardens' Range (x 22..34, y 12..44, floor z 10, roof ridge z 15 along x = 28).** The King's Wardens'
quarters above the armory: bunks, armour stands, a mess table, a shrine to the Crown. Timber roof trusses at
2.5 m spacing, roof intact. An **iron gate "Wardens only"** across the range at y 26..27 (x 22..34, full
collision) — locked. South of the gate, the range continues to the **MT door (x 22..24, y 14..16.4, z 10)**.
Enemies: **E5b (optional, north of the gate)** 2 Royal Wardens + 1 Royal Guard.

**MT — Minstrels' Tower (x 14..22, y 8..16, floor z 10, top z 16).** A square tower at the hall's south-east
corner. Spiral stair (square newel, x 16..20, y 10..14) from z 10 to z 16. Door W at z 16 onto the Long
Gallery's south end. **CP3** at the tower base (18, 15, 10) — reachable in both states.

**LG — Long Gallery of Kings (x −2.5..2.5, y 9..44, floor z 16, roof z 21).** A covered stone-and-timber
gallery built along the Great Hall's roof ridge, windows both sides looking down on the hall's roof and
(through its clerestory) into the hall. Portraits of the Vaelor kings line both walls; the last portrait is
covered with a cloth. **S door (x −2.5..−1, from the MT at y 9..10.5)** open. **N door into the Crown Loft
(x −1.2..1.2, y 44..45, z 16) sealed** (royal seal). A **resonant fracture FR2** glows on a roof tie-beam over
the middle of the gallery (0, 30, 20). Enemies: **E7** 2 Royal Wardens + 2 Royal Guards in the middle third
(y 26..36) — the fracture beam hangs over their position.

**KAP — King's Apartments (x −12..12, y 79..95, z 8, ceiling 16).** Bedchamber with a canopied bed in an
alcove (N), wardrobes, a map table with the siege lines, braziers. Door E to the **King's Study (KS, x 12..20,
y 82..95)**. Enemies: **E10 Kingsguard Captain** + 2 Royal Guards (Past composition).

**KS — King's Study (x 12..20, y 82..95, z 8, ceiling 16).** Aldren's desk and ritual diagrams; the
**Conduit Shaft** (x 20..24, y 84..96) behind the east wall — a shaft of red-gold light rising from far below;
the **Conduit Stair** wraps the shaft (square spiral, 1.5 m wide, z 8 → 24) up to the **Bell Chamber (BC,
x 18..26, y 88..98, z 24)** with three great bronze bells tuned to the Crownheart. Past: stair intact; its
foot is reached through a narrow door in the study's east wall (x 20..21, y 86..88). **CP5** in KS.

---

## D. Present blueprint (same footprint, generations later)

The upper floor took the weather: roofs are gone to the sky in most rooms, rain and birds have had the marble,
the wind moves burned hangings. The Sundering broke the royal seals — sealed Past doors stand open — but
floors have fallen into the dark levels below.

**LND.** Intact, overgrown, moonlight from a high window. Arrival.

**ANT.** Roof fallen (open sky, moon above). **The centre-north floor has collapsed** (x −6..8, y 68..78) into
darkness below (lethal void). What remains: the **south strip** (y 62..68, full width), the **west strip**
(x −12..−6, y 62..78), and the **east strip** (x 8..12, y 62..78). The Royal door (N) stands **open, its seal
split** — but it is on the far side of the void (the threshold x −2..2, y 78..79 is 10 m from the south strip).
The chandelier is gone (**unless FR1 was broken**: then the fallen chandelier's iron ring and its crown of
beams lie wedged across the void from y 67 to y 79 at x −2.5..2.5 — a walkable span; see §F.6). The **E door
to CHN is choked** with rubble. The **W door to QS stands open**. The **loft stair** has lost its lower half
(heap at its foot, y 64..68); its upper half (y 70..74, z 11.5→14) still clings to the wall. The **Crown Loft**
survives on the W and N sides only (the E side fell). **CP1** at (0, 64.5, 8). Enemies: **E1** 3 Hollows rise
from the rubble + 1 Echo Wraith over the void.

**QS (optional).** Roof holes, ivy, the Queen's desk overturned, the nursery's cradles. **Memory Trace T3
(the Queen's letter)**. **Fissure FX2**. Enemies: **E2b (opt.)** 1 Hollow Warden + 2 Hollows.

**CHN.** Roof mostly intact (a hole over the north-west). Shelves toppled into ridges (cover). The floor
in front of the east door has **collapsed** (x 26..34, y 60..70 → void). The **east mezzanine's south part
has sagged**: its slab broke at y 68 and the section y 60..68 hangs as a **slope** from z 12 at y 68 down to
z 8.2 at y 63 — landing on the **threshold ledge** (x 32..34, y 62..68, z 8, a strip of floor that survived
along the wall) in front of the **east door, which stands open** (rotted). The **timber stair has rotted
away** (posts only). The north mezzanine is intact but unreachable from the floor. Enemies: **E3p** 2 Hollows
+ 1 Echo Archer on the north mezzanine (reachable only by arrows — they harass while the player plans).

**WW.** Vault cracked, water on the stair, **CP2**. **Fissure FX3**.

**WR.** **Roof fallen**: trusses lie in a long heap along the range; at the north end (y 38..44) the fallen
trusses form a **ramp from the floor (z 10) up to the surviving roof ridge (z 14)**, x 26..30. The **ridge**
(a 1.2 m-wide stone ridge wall-top with the remains of the leads, x 27.4..28.6) runs south from y 40 to y 14,
passing over the iron gate (y 26..27, still locked, rusted solid). At the south end the ridge reaches the
Minstrels' Tower, where a rubble stair on the tower's buttress climbs to its **upper door (z 16, east face)**. Grass and
ivy along the ridge; wind. Enemies: **E4** 2 Hollow Wardens + 2 Hollows on the floor north of the gate;
**E6** 3 Echo Wraiths along the ridge (fight on a narrow walkway; falling = void respawn).

**MT.** Intact stone tower, stair intact, **CP3**. **Fissure FX4**.

**LG.** The gallery's **middle has fallen** (y 26..36) — through the hall roof hole below into the Great Hall
(this *is* the hole Floor 1's player saw in the hall roof: x −5..5, y 30..38; Floor 1 §D). Only the two
outer wall tops remain across the gap (0.5 m wide, not walkable). The S part (y 9..26) and N part (y 36..44)
stand, roofless, portraits burned to frames except the **Queen's portrait, slashed** (lore). The **N door into
the Crown Loft stands open** (seal broken). **If FR2 was broken in the Past**, the tie-beam and a length of
roof fell *into the gallery* (not through it) at y 28..33 and in the Present lies as a **low beam-and-rubble
causeway** across the southern half of the gap — see §F.5 (it shortens the Past crossing; not required).
Enemies: none in the gallery itself (a quiet crossing, wind and the hall's red glow below).

**CL (Crown Loft).** W and N sides remain; the E side fell into ANT. **Memory Trace T5** at the winch's rusted
stump. From the NW corner the loft stair's upper half descends to z 11.5 and ends in air 3 m above the
**rubble heap** on the west strip — a safe one-way drop (landing ≈ 3.0 m, below the 4.5 m heavy-landing
threshold, never a void).

**KAP.** Roof fallen; the bed alcove intact; the floor has **three holes** (x −10..−4, y 82..88; x 4..10,
y 82..88; x −3..3, y 90..94) — voids (the boss arena changes with state, §G E10). **KS** door open.

**KS / CS / BC.** The study's floor stands; the **Conduit Stair has collapsed in its lower half** (z 8 → 16
gone; the shaft glows red-gold); the upper half clings to the shaft. **The stair is Past-only** (G7). The
Bell Chamber in the Present has one bell fallen through its floor.

---

## E. State-difference matrix

| Area | Only in Past | Only in Present | Past harder because | Present harder because | Why choose Past | Why choose Present |
|---|---|---|---|---|---|---|
| ANT | full floor, chandelier, sealed Royal door, loft gate locked | centre-north void, open Royal door, QS door open, (FR1: chandelier bridge) | guards + loft archer, door sealed | void, wraith over it, hollows | route to CHN; FR1 exists only here | QS, the Royal door, the drop from the loft |
| QS | (unenterable) | whole room | — | hollow warden | — | lore + optional charge |
| CHN | timber stair, whole mezzanine, sealed east door | sagged mezzanine slope, open east door, floor void | 3 guards + 2 mezzanine archers | echo archer you cannot reach, void | height (stair to mezzanine) | the slope down to the open door |
| WR | roof, trusses, "Wardens only" gate | truss ramp, ridge route | royal wardens (elites) | wraiths on a narrow ridge, falls | optional big charge (E5b) | only way past the gate |
| LG | intact floor across the hall roof, sealed N door, FR2 | open N door; middle fallen; (FR2 causeway) | E7 on a narrow bridge | nothing to cross the gap | cross the gap | pass the N door |
| CL | Crown winch (FR1), full loft ring | loft stair upper half (drop), E side fallen | loft archer / wardens | — | break FR1 | drop into ANT |
| KAP | furniture cover, 2 guards | three floor voids | more enemies | voids (knock-offs work both ways) | cover from the Captain's charges | kick the Captain toward a void (bonus stagger) |
| KS/CS | conduit stair intact | lower stair gone | — | — | the only way up | — |

No area is universally better: every state carries a route and a price.

---

## F. Puzzle / traversal sequences (every temporal gate)

**F.1 — G1 "The antechamber remembers its doors" (opener, ANT).**
Present ANT (arrive, E1) → the E door is choked, the Royal door is across a void, QS open (optional) →
shift to **Past** anywhere on the south strip (always solid in both states) → the Past antechamber fills with
guards (**E1b**, fought in the Past) → E door to CHN is open.
*Shift safety:* the south strip y 62..68 is solid floor in both states; pier footprints are the same in both.

**F.2 — G2 "Up in one memory, down in the other" (CHN).**
Past CHN (E3; archers on the east mezzanine) → climb the **timber stair** (NW) to the north mezzanine →
walk the mezzanine east then south along the east mezzanine to its **south end (x 30..34, y 68..70)** →
shift to **Present** there → the mezzanine south of y 68 is now a **slope** down to the **threshold ledge**
and the **open east door** (the floor between is void) → WW (**CP2**).
*Why not Present first?* The Present has no stair to the mezzanine. *Why not Past to the door?* It is
sealed and the floor route is blocked by the sealed door itself.
*Shift safety:* the mezzanine slab at y 68..70 exists in both states (the break line is y 68); the channel
spot marker `shift_G2` sits at (32, 69.2, 12). Present-side fall risk: the slope has parapet stubs on the
west edge (col 1.2 m).

**F.3 — "The ridge" (WR, no shift required, combat traversal).**
WW → WR north (Present): **E4** on the floor → climb the **truss ramp** (x 26..30, y 38..44, z 10→14) → walk
the **ridge** south over the locked gate → **E6** wraiths attack on the ridge (dodge, don't fall) → the ridge
ends at the MT's east face; its upper door (z 16) is reached by a short **stone stair** built into the
tower's buttress (x 22..24, y 16..20, z 14→16, Present-only rubble treads).
*Past alternative:* none (the gate). The Past north half is optional (E5b) for charge.

**F.4 — G3 "The gallery over the hall" (LG south end).**
MT top (z 16, CP3 below) → LG south end (Present: gallery fallen from y 26) → shift to **Past** at the south
part (y 12..24) → the gallery is whole; **E7** fight in the middle third → walk north.
*Shift safety:* the gallery south part (y 9..26) exists in both states; marker `shift_G3` (0, 22, 16).

**F.5 — FR2 "Drop the beam on them" (optional combat fracture, LG).**
During E7, the **tie-beam fracture FR2** (0, 30, 20) glows above the wardens. A heavy blow *on the beam* is
impossible from the floor — instead FR2 is struck with the **kick** against its support post (a glowing
post at (−2.2, 29, 16)). The beam drops a 4 m length of roof onto y 28..33: enemies under it take 60 damage
and are knocked down. Present consequence: the fallen beam and roof now lie *inside* the gallery as a low
causeway from y 26 to y 31 — a Present-side shortcut back south later (backtracking only; never required).
Teaches that fractures are also weapons.

**F.6 — G4 "The door that knows only the ruin" (LG north end).**
Past LG north end: the Crown Loft door is sealed → shift to **Present** at y 38..43 (the N part exists in both
states) → the door stands open → **CL** (Present, W and N sides).
*Shift safety:* `shift_G4` (0, 40.5, 16).

**F.7 — G5 + FR1 "Bring down the crown" (CL).**
Present CL: the rusted stump of the Crown winch (Trace T5) sits on the N side at (8, 77, 14); the chandelier
is gone from the room below — but the chain's anchor ring still glows faintly (resonance tell). Shift to
**Past** on the N loft (solid in both states) → the Crown winch stands, its brake **fractured** (glowing) →
heavy attack on it → the brake shatters, the chain runs, **the Crown Chandelier falls 7 m into the Past
antechamber** (dust, crash, camera shake; Past guards below are crushed if present). The Past loft's W side
continues to the loft stair (gated at its foot — **still locked** from the floor side; the loft side opens
down to z 8 only by the gate, which is locked from outside).
*Result:* the Past ANT is reachable only down a locked stair — the player must use the Present (§F.8).

**F.8 — G6 "Across the crown" (CL → ANT → Royal door).** (Present loft → Present antechamber)
Shift to **Present** on the W loft (solid) → the loft stair's upper half → **drop 3 m** onto the heap (west
strip, **CP4**) → **E9**: 3 Echo Wraiths rise from the void → the **fallen chandelier** now lies wedged across
the void (FR1's Present consequence) → walk the ring (1.6 m wide rim + beams) from the south strip (y 67) to
the Royal door threshold (y 79) → the seal is broken → **KAP**.
*If the player never broke FR1:* the loft drop still lands them on the west strip; the void is uncrossable;
**CP4's sigil prompt reminds**: "The crown still hangs in memory." The Past loft is reachable again from the
Present loft by shifting there (the loft is solid in both states) — no softlock (see §H.1).

**F.9 — G7 "The stair only the Past remembers" (KS).**
After **E10**, the King's Study (CP5) → the Conduit Stair's lower half is gone in the Present → shift to
**Past** in the study (solid in both states) → the narrow east door and the intact stair → climb 16 m
around the glowing shaft → Bell Chamber → EXIT ("To the Crown").

**F.10 Puzzle escalation check.** G1 opener (state recognition) → G2 two-state vertical weave in one room →
F.3 traversal under combat pressure without a shift → G3/G4 two shifts inside one structure → FR1 cause and
effect (new rule, taught with a visible result) → G6 consequence used for traversal + a loop back into the
first room → G7 finale. No repeated pattern: the only "shift to open a door" gates are G1 (opener) and G4
(combined with G3 in one crossing).

---

## G. Combat plan

| Id | Where · state | Trigger | Arena | Enemies | Reinforcement | Environment | Charge |
|---|---|---|---|---|---|---|---|
| E1 | ANT · Present | enter ANT | strips around the void | 3 Hollow (rise), 1 Wraith | — | void: kick knock-offs | 145 |
| E1b | ANT · Past | shift to Past in ANT | full hall + loft | 3 Royal Guard, 1 Royal Archer (loft) | — | piers as cover vs archer | 150 |
| E2b | QS · Present (opt.) | enter QS | solar + nursery | 1 Hollow Warden, 2 Hollow | — | — | 150 |
| E3 | CHN · Past | enter CHN | desk rows, shelves | 3 Royal Guard, 2 Royal Archer (E mezz.) | archers only after 1 guard falls | shelves block arrows | 180 |
| E3p | CHN · Present | enter CHN in Present | floor edge | 2 Hollow + 1 Echo Archer (N mezz., unreachable from the floor) | — | the archer is pressure, not a kill target | 80 |
| E4 | WR · Present | enter WR | range floor N of gate | 2 Hollow Warden, 2 Hollow | 2nd Hollow Warden when 2 Hollows fall | trusses as cover | 220 |
| E5b | WR · Past (opt.) | shift in WR N | bunks | 2 Royal Warden, 1 Royal Guard | — | narrow aisles | 240 |
| E6 | WR ridge · Present | step onto the ridge | 1.2 m ridge | 3 Echo Wraith | — | falls → void respawn (−25 % HP) | 75 |
| E7 | LG · Past | reach y 24 in Past | 5 m-wide gallery | 2 Royal Warden, 2 Royal Guard | — | FR2 beam drop | 280 |
| E8 | CL · Past | shift to Past on CL | loft ring | 2 Royal Guard + 1 Royal Archer (loft) | — | parapet; FR1 winch | 110 |
| E9 | ANT · Present | land from the drop | west strip + void | 3 Echo Wraith | — | chandelier bridge | 75 |
| E10 | KAP · both | enter KAP | bedchamber | **Kingsguard Captain** (royal_warden scale 1.3, 520 HP, boss bar) + Past: 2 Royal Guard / Present: 2 Hollow | adds at 60 % / 30 % | Past furniture cover; Present three voids (a kicked Captain near a void is staggered 1.5 s) | 200 surge + adds |

Mandatory kill total before each gate is listed in §H. Wraiths and archers stay a minority; every fight has at
least one "readable" melee group for combos and parries.

**Kingsguard Captain** (new archetype `kingsguard`, knight rig, scale 1.3): guard-heavy (blockChance 0.55),
kicks and spin slashes (existing clips), a **resonance lunge** in the Present like the Gate Warden, and a
new tell: before a heavy it **raises its guard for 0.5 s** (block clip) — kick breaks it (reward: 1.2 s
stagger). Uses the dread aura and the boss bar; *not* tinted.

---

## H. Temporal economy (worst-case walk)

Assumptions as Floor 1: only mandatory fights, only kill rewards, cap 200, **carry-over from Floor 1 = 100**
(Floor 1's worst case after G8).

| Step | Event | Δ | Charge |
|---|---|---|---|
| 1 | Arrive (carried) | — | 100 |
| 2 | E1 | +145 | 200 |
| 3 | **G1** (→Past, ANT) | −100 | 100 |
| 4 | E1b | +150 | 200 |
| 5 | E3 | +180 | 200 |
| 6 | **G2** (→Present, CHN mezzanine) | −100 | 100 |
| 7 | E4 | +220 | 200 |
| 8 | E6 | +75 | 200 |
| 9 | **G3** (→Past, LG south) | −100 | 100 |
| 10 | E7 | +280 | 200 |
| 11 | **G4** (→Present, LG north) | −100 | 100 |
| 12 | **G5** (→Past, CL) | −100 | 0 |
| 13 | E8 | +80 | 80 |
| 14 | FR1 (no cost) | 0 | 80 |
| 15 | **G6** (→Present, CL) — **needs 100** | — | **short by 20** ✗ |

**v1 failed here** (see §L). **v1.1 fix:** E8 grows to 2 Royal Guards + 1 Royal Archer (+110), and the loft
gets **Fissure FX5** as the independent guarantee (fissures work in either state). Revised tail:

| Step | Event | Δ | Charge |
|---|---|---|---|
| 12 | **G5** | −100 | 0 |
| 13 | E8 (v1.1: 2 guards + 1 archer) | +110 | 110 |
| 15 | **G6** | −100 | 10 |
| 16 | E9 | +75 | 85 |
| 17 | E10 (adds 2×40 + Captain surge: guaranteed top-up to ≥ 100, like the Gate Warden) | ≥ +115 | ≥ 200 |
| 18 | **G7** (→Past, KS) | −100 | ≥ 100 |

### H.1 Softlock guarantees
1. **Fissures** FX1 (ANT south strip), FX2 (QS), FX3 (WW), FX4 (MT), FX5 (CL N side), FX6 (KAP south) cover
   every required-shift location; same rule as Floor 1 (spawn 2 Remnants when charge < 100 and no hostile
   within 25 m; 15 s cooldown).
2. **Checkpoint restore** keeps charge ≥ 100 on respawn (Floor 1 rule).
3. **FR1 persistence**: fracture flags are permanent world state (never reset by death/checkpoint). If the
   player drops into ANT without breaking FR1, the Present heap on the west strip is a climbable rubble ramp
   back up to the loft stair's upper half (z 11.5) — the drop is two-way in the Present and one-way only in
   the Past (locked gate). The player can always return to the loft, shift, and break FR1.

### H.2 Spam control
Unchanged: cost 100, 2.4 s rooted channel, cooldown 1.2 s, capacity 2.

---

## I. Narrative / environmental clues

| Where | Past shows | Present shows | The player infers |
|---|---|---|---|
| ANT | petitioners waiting before a sealed door; the Crown Chandelier | the crown fallen (if broken), seal split | the court waited on a king who had stopped answering |
| QS | the Queen's door barred **from within**, her Echo writing | her letter (T3): *"He means to bind every soul in Caer Veyr to that stone. The girl is not of his line — take her by the servants' stair, and let no priest mark her."* | the Uncrowned's line was **saved from the binding by the Queen** — unbound on purpose |
| CHN | clerks copying sealing orders; the sealing press | Trace T1 on the press: *"By the King's hand: the east wards to be moved below and the doors made fast behind them."* | the ritual was paperwork before it was magic — the Chancery was complicit |
| WR | a roster with names struck through | chained remains in the bunks | wardens who refused were executed by their own |
| LG | the last portrait covered | every portrait burned but the Queen's — slashed | the dynasty erased its dissenters |
| CL | the Crown winch, the chandelier as the court's crown | the stump; the crown in the void | the symbol of the court fell into its own abyss |
| KAP / KS | siege maps, ritual diagrams (T4: *"To lose Veyr is the only crime. I will keep it — every stone, every soul — at this hour, forever."*) | the diagrams scorched | Aldren planned the Sundering; it was not an accident of war |
| CS / BC | bells tuned to the stone's hum | one bell fallen, the glow rising | the whole keep was an instrument for the Crownheart |

Memory Traces: T1 CHN press · T2 WR roster · T3 QS letter (the reveal) · T4 KS diagrams · T5 CL winch stump.

---

## J. Streaming / performance partition

Floor 2 is its own pair of GLBs (`floor02.glb`, `floor02_collision.glb`) loaded when the player passes Floor 1's
exit; Floor 1 is unloaded (dispose geometries, keep shared materials/textures). Sections: R1 royal wing
(LND/ANT/CL/QS), R2 chancery (CHN/WW), R3 east range (WR/MT), R4 gallery (LG), R5 apartments (KAP/KS/CS/BC).
Budget ≤ 50k visual tris, ≤ 10k collision tris, ≤ 12 fires (Past), ≤ 9 moon holes (Present) — Floor 2 is mostly
roofless in the Present, so moon shafts are replaced by open sky + the directional moon.

---

## K. Collision and shift-safety register

| Spot | Past | Present | Rating |
|---|---|---|---|
| ANT south strip y 62..68 | floor | floor | safe (G1, CP1) |
| ANT west strip | floor | floor + heap | safe (CP4) |
| ANT centre-north | floor | **void** | **invalid** — shift denied (destination has no footing: TimeSystem already rejects) |
| CHN mezzanine y 68..70 (x 30..34) | slab | slab (break line y 68) | safe (G2) |
| CHN floor x 26..34, y 60..70 | floor | void | invalid |
| WR ridge | inside the roof (buried) | ridge top | **invalid in Present→Past** (capsule buried in the Past roof) — denial + prompt "The roof of memory closes over you." |
| LG y 9..26 / 36..44 | floor | floor | safe (G3, G4) |
| LG y 26..36 | floor | void | invalid Past→Present (denied) |
| CL W + N | floor | floor | safe (G5, G6) |
| CL E | floor | void | invalid |
| KAP holes | floor | void | invalid Past→Present |
| KS | floor | floor | safe (G7) |
| Conduit stair | stair | void (lower) / stair (upper) | invalid on the lower flight |

Chandelier bridge (Present, FR1): collision = a 1.8 m-wide box walkway y 67..79 at z 8.3 + two ring arcs as
0.5 m rails (col 1.0 m) so the player cannot slip into the void at walking speed.

---

## L. Self-review (v1 → v1.1)

- **Temporal economy failed at G6** (charge 80 after E8, G6 needs 100). Fixed by strengthening E8 and adding
  Fissure FX5 on the loft; the CL shifts G5/G6 are back-to-back by design (the fracture is the reward).
- **Softlock risk: dropping into ANT without breaking FR1.** v1 made the drop one-way. Fixed: the Present heap
  is a climbable rubble ramp back up to the stair's upper half, and CP4's sigil gives a one-line hint.
- **Repetition check:** G1 and G4 are both "sealed door ↔ open door". Kept G1 as an opener; G4 is paired with
  G3 inside one structure and happens over a spectacular void, so it reads as part of a crossing, not a
  repeat.
- **Fracture readability:** a new rule must be taught with one clear, observable result. FR1 is taught where
  the player *sees* the room below from the loft and has already crossed it — the "aha" is immediate. FR2 is
  optional and combat-first.
- **Architectural plausibility:** the east range sits on the armory's roof (Floor 1: roof z 9..9.5, range floor
  z 10); the Long Gallery rides the hall's ridge; the Minstrels' Tower is the hall's SE corner tower; the royal
  wing is north of the hall where Floor 1's Royal Stair already pointed. Walls 1 m inside the royal wing
  (upper floor), 2 m on outer faces.
- **Combat density:** 8 mandatory fights over ~560 m + boss; two quiet stretches (WW, LG crossing) for
  reading the space.
- **Performance:** the Present is mostly roofless → cheaper (no moon-shaft volumes); Past has chandeliers and
  candles (instanced flames) instead of dozens of torches.

---

## M. Coordinate appendix (authoritative dimensions)

Outer walls 2 m, inner walls 1 m; doors 2.4 × 3.2 m (royal doors 4 × 5 m); stairs rise 0.25 / run 0.4167.

| Id | Interior footprint (x; y) | Floor z | Ceiling / top | Notes |
|---|---|---|---|---|
| LND | −3..3; 58..62 | 8 | 13 | spawn (0, 59, 8) facing N; door N x −2..2 in wall y 62..63 |
| ANT | −12..12; 63..78 | 8 | 18 | piers 1.6 m² at (±6, 67), (±6, 74); Present void x −6..8, y 68..78 |
| CL | W −12..−9; N 75..78 (x −12..12); E 9..12 | 14 | — | slab 13.6..14, parapet 1.1; Present E side void |
| LOFT STAIR | x −12..−10.4; y 64→74 | 8→14 | | Past gate at y 63.6; Present: lower half gone (heap y 64..68 climbable to z 11.5) |
| CROWN | ring r 2.5 at (0, 72), z 15 (Past hanging) | | | FR1 winch (8, 77, 14); Present fallen: walkway x −1..1, y 67..79, z 8.3 |
| ROYAL DOOR | −2..2; wall 78..79 | 8 | 13 | sealed Past / open Present |
| QS | −30..−14; 63..78 · nursery −30..−20; 78..86 | 8 | 14 | door x −14..−13, y 68.8..71.2 |
| CHN | 14..34; 60..80 | 8 | 16 | door from ANT x 12..14, y 68.8..71.2 |
| MEZZ | E 30..34; 60..80 · N 14..34; 77..80 | 12 | — | slab 11.6..12; Present break at y 68, slope y 63..68 z 8.2→12 |
| CHN STAIR | 14..16; 70→77 | 8→12 | | Past only |
| CHN VOID | 26..34; 60..70 minus ledge 32..34; 62..68 | void | | Present |
| E DOOR | wall x 34..35; y 64..67 | 8 | 11.2 | sealed Past / open Present |
| WW | 30..34; 44..60 (door from CHN via x 34..35 then S) | 8→10 | vault 13 | stair y 52..56; CP2 (32, 58, 8) |
| WR | 22..34; 12..44 | 10 | ridge 15 | gate y 26..27; Present truss ramp x 26..30, y 38..44, z 10→14; ridge x 27.4..28.6, y 14..40, z 14 |
| MT | 14..22; 8..16 | 10 | 16 top | spiral x 16..20, y 10..14; Present buttress stair x 22..24, y 16..20, z 14→16; CP3 (18, 15, 10) |
| LG | −2.5..2.5; 9..44 | 16 | 21 | S door from MT top; N door y 44..45 into CL; Present void y 26..36; FR2 post (−2.2, 29, 16) |
| KAP | −12..12; 79..95 | 8 | 16 | Present voids (−10..−4, 82..88), (4..10, 82..88), (−3..3, 90..94) |
| KS | 12..20; 82..95 | 8 | 16 | CP5 (15, 88, 8); east door x 20..21, y 86..88 |
| CS | shaft 20..24; 84..96 (void to z −40, glow) · stair 1.5 m wide around it | 8→24 | | Past only below z 16 |
| BC | 18..26; 88..98 | 24 | 30 | EXIT door N y 98 |

Markers: as Floor 1 plus **`fracture`** (id, flag, strike volume, required attack kind `heavy|kick`) and mesh /
collision extras **`show_if` / `hide_if`** (flag names) for fracture-dependent geometry.

---

## N. Implementation plan

1. **Runtime (before geometry):** floor registry (`floor01`, `floor02` → GLB urls, autopilot route, spawn,
   exit, next floor); `Game.finish()` → load next floor, carry HP/charge; dispose the old level.
2. **Fracture system:** `fracture` markers + persistent flag set; meshes/collision with `show_if`/`hide_if`
   extras → visibility and **per-flag collision** (small extra BVHs merged into the active state's query set);
   a Past break event (falling-object animation, damage + knockdown in a radius, dust, shake, audio `rubble` +
   `armor_crash`); fracture glow (reuse the sigil's rune shader idea: glowing crack lines).
3. **New archetype** `kingsguard` (knight): guard-raise tell, kick-breakable, Present resonance lunge; boss bar
   name "THE KINGSGUARD CAPTAIN".
4. **Blender:** `tools/blender/floor02_layout.py` (sections R1–R5 with the kit), `build_floor02.py` (copy of the
   Floor 1 driver) → `public/assets/levels/floor02*.glb`.
5. **Autopilot ROUTE for Floor 2** mirroring §F, then god + no-god runs.
