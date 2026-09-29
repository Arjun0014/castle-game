# LEVEL_01_BLUEPRINT.md — Floor 1: "Inheritance" (The Lower Keep of Caer Veyr)

Status: **v2 (self-reviewed, revised — see §L), with implementation notes in §N.** This document is the authority for Floor 1 geometry,
routes, encounters and temporal economy. `tools/blender/floor01_layout.py` mirrors the coordinate
appendix (§M); if the two ever disagree, fix the code to match this document or update both together.

Coordinate convention (Blender): **X = east, Y = north, Z = up, metres.** Ground floor z = 0.
(three.js: x = X, y = Z, z = −Y.)

---

## A. Floor thesis

**What makes this floor distinct:** Floor 1 is the lower keep — the castle's public and military ground
floor, organised around a Great Hall the player can *see* for most of the level but can only *enter* at
the very end, from beneath. The player circles the hall clockwise: in through the gatehouse, across the
Inner Ward, up through the east (military) wing to the hall's galleries, over the hall to the west
(ceremonial) wing, down through the chapel into the crypt and Aldren's excavation, and finally up
through a diggers' hatch into the hall itself for the finale.

| | |
|---|---|
| Gameplay purpose | Teach fighting, blocking/parrying, dodging, crouching, jumping and the Past/Present shift; escalate from "see the other route, shift once" to "combine both states, under fire, in an arena that changes". |
| Narrative purpose | Establish Caer Veyr and the blood link; show that the Past is dangerous and paranoid (doors sealed *against its own people*, guards against guards); first contradictions to the official "an invading army destroyed Veyr". |
| Emotional question | *What happened here?* |
| Duration | 20–30 min first play (≈14 min combat, ≈6 min traversal/puzzle, ≈4 min reading the space). ~500 m critical path. |
| Pacing | Arrival → tutorial fight → first shift → big yard fight → wing traversal with fights between every temporal gate → gallery section (height, narrow combat) → ceremonial wing (elite fight, descent) → deep excavation (fight under fire) → arena finale → exit stair. |
| Difficulty curve | E1–E2 teach; E3 first large mixed fight (archers); E5 first heavy; E9 first elites; E12 fighting under ranged pressure while crossing; E13 boss with state-changing arena. |
| Visual identity | **Past**: warm torchlight, banners (jacquard/satin), clean masonry, dark wood, forged iron, soldiers everywhere, military clutter (barricades, wagons, scaffolds). **Present**: cold moonlight through broken roofs, weathered stone, moss wood, rust, rubble, grass in cracks, Crownheart-glowing flowers near the deep excavation. |

Stable anchors the player learns across both states: the gatehouse vault, the Ward's statue plinth, the
Great Hall's gallery columns and walls, the chapel's altar dais, the undercroft column grid, the
Royal Stair doorway.

---

## B. Spatial graph

### B.1 Architectural hierarchy

- **Military**: Gate Passage, Guardrooms, Barracks, Muster Corridor, Armory (east + south).
- **Public/ceremonial**: Inner Ward (enclosed courtyard), Great Hall + galleries (north-centre).
- **Royal/ceremonial**: Chapel of the Binding + royal loft, Royal Crypt, Royal Stair (west + north).
- **Hidden/service**: Aldren's Excavation (undercroft beneath the Great Hall).

### B.2 Plan (top view, not to scale; N up)

```
                         ┌──────────────┐
                         │ ROYAL STAIR  │  → EXIT (Floor 2 threshold, z=8)
                         │  (RS)        │
          ┌──────────────┴──────┬───────┴──────────────────┐
          │ CHAPEL OF THE       ║   GREAT HALL (HALL)       │┌───────────────┐
          │ BINDING (CHAP)      ║   dais+throne (N)         ││  ARMORY (ARM)  │
          │  altar (N)          ║                           ││  east stair ↑ │
          │  crypt collapse     ║  [W gallery z6] [E gallery z6]  ↔ door z6  │
          │  nave               ║   central floor           ││               │
          │  loft z6 (S) ◄──────╫── [S minstrels' gallery z6] │└──────┬────────┘
          └──────────────┬──────╨────────┬──────────────────┘   COR (crawl)
                         │  main doors   │ (blocked both)          │
       ┌─────────────────┴───────────────┴────────────┐   ┌───────┴────────┐
       │                 INNER WARD (WARD)             ├───┤  BARRACKS (BAR) │
       │   balcony z6 (N face)      statue plinth      │door│                │
       │   Present sinkhole (W-centre)                 │   │                │
       └──────────────┬───────────┬────────────────────┘   └────────────────┘
          ┌───────────┤  GATE     ├───────────┐
          │ GUARDROOM │  PASSAGE  │ GUARDROOM │
          │ W (opt.)  │   (GP)    │ E (GR_E)  │
          └───────────┤           ├───────────┘
                      └─── mouth ─┘  ← START (Present)

  BELOW (z = −6):  CRYPT (under chapel N)  ══ passage ══  EXCAVATION / UNDERCROFT (under hall)
                                                            deep pit, Present fill (S end)
                                                            Past scaffold stair → hatch into HALL
```

### B.3 Connectivity graph (critical path bold, state required in brackets)

```
START(Present) → GP ─[both: breach/door]→ GR_E  (E1, CP1 sigil = shift unlocked)
GP ─[PAST: portcullis raised]→ WARD                                   (G1)
WARD ─[PRESENT: barracks door broken in]→ BAR                          (G2)
BAR ─[PRESENT: crawl gap]→ COR → ARM          (Past: corridor door locked)
ARM floor ─[PRESENT rubble ramp]→ mid-landing pad z3 ─[PAST upper flight]→ top landing z6 (G3, CP3)
top landing ─[both]→ HALL east gallery z6
E gallery ─[PRESENT: crawl tunnel under collapse]→ S gallery → W gallery (G4)   (Past: screen door barred from W)
W gallery ─[PAST: loft door open]→ CHAP loft z6 (G5, CP4)                      (Present: doorway choked)
CHAP loft ─[PAST: loft stair]→ nave z0
nave ─[PRESENT: floor collapse ramp]→ CRYPT z−6 (G6, CP5)                      (Past: sealed floor-door)
CRYPT ─[both]→ UND west ledge
UND west ─[PRESENT: rubble fill across pit]→ UND east ledge (CP6)              (Past: 14 m pit)
UND east ─[PAST: scaffold stair]→ hatch → HALL floor (G7)                      (Present: scaffold rotted)
HALL (E13 finale, both states) → dais → Royal door threshold ─[PRESENT: seal broken]→ RS → EXIT (G8)

Optional: GR_W (Past only, lore + 1 guard); WARD balcony via Past scaffold (archers);
          minstrels' screen door can be un-barred from the W side in Past (loop back to CP3);
          alternate-state encounters in BAR(Past), ARM(Past), CHAP nave (Present), UND west (Past).
```

Checkpoints (Blood Sigils): **CP1** GR_E · **CP2** Ward east · **CP3** Armory top landing (z6) ·
**CP4** Chapel loft (z6) · **CP5** Crypt east · **CP6** Undercroft east ledge.

Exit: top of the Royal Stair, door at y = 58, z = 8.

---

## C. Past blueprint (room by room)

The Past is the castle "near the end": intact, lit, crowded with guards obeying the King's emergency
orders. Royal seals do **not** recognise the unbound Uncrowned ("The door does not know you").

**GP — Gate Passage (x −3..3, y −46..−31, vault apex z 7).** Barrel-vaulted, torches in sconces, murder
holes over the *inner* end (they face into the castle — lore). Outer portcullis raised. **Inner
portcullis raised** (open to the Ward). East door (wood, open) to GR_E; west door (wood, open) to
GR_W. Props: barricade of crates by the inner arch (leaves a 4 m lane), weapon rack, brazier.
Enemies: **E2** 3 Royal Guards at the inner arch.

**GR_E — East Guardroom (x 5..15, y −44..−33, ceiling z 6).** Intact timber-beamed room, fireplace
on east wall (lit), table with dice, bunks, weapon rack. The GP↔GR_E opening is a normal 2.4 m door.
Blood Sigil CP1 is set into the floor (exists in both states).

**GR_W — West Guardroom (x −15..−5, y −44..−33), optional.** Bunks, a desk with the King's order
(Memory Trace: "The keep is closed. None may leave. — by the King's hand"). 1 Royal Guard (E2b).

**WARD — Inner Ward (x −22..22, y −29..7, open sky).** A militarised staging yard: wagons and crate
barricades form lanes (cover), refugee carts loaded with belongings stopped at the gate (lore: people
tried to leave), tents on the west side, braziers. Statue of the First Crown on the plinth (x 0, y −12).
Great Hall main doors (x −2.5..2.5 in wall y 7..9): **barred from the inside** (ranks heard within).
Balcony on the hall facade (x −10..10, y 5..7, z 6) with 2 Royal Archers; a Past-only timber scaffold
stair from the Ward NW (x −21..−11, y 1..3) up to the balcony's west end (optional route to the
archers). The balcony's door into the minstrels' gallery is **locked**. Barracks door (east wall
x 22..24, y −14.5..−11.5): **barricaded from inside** (mutineers — tables/bunks jammed in the doorway,
full collision). West (kitchen) door: barricaded (floor boundary). Enemies: **E3**.

**BAR — Barracks (x 24..38, y −27..−1, ceiling z 8).** Two rows of bunks, long tables, lockers, hearth,
the inside of the barricade at the ward door. North door open to COR. Enemies: E5b (optional, 4
mutineer Royal Guards, red sashes).

**COR — Muster Corridor (x 29..32, y 1..9, vault z 4).** Intact; iron-bound door at the north end
(armory south wall) **locked by Royal Order**.

**ARM — Armory (x 20..34, y 10.5..27, ceiling z 9).** Weapon racks (half empty — issued to the
wardens), armour stands, workbench. **East Stair** along the west wall (x 20..22.6): iron gate at the
foot (y 11.5) **locked**; lower flight y 12→17 (z 0→3, 12 steps); **mid-landing y 17..19.5 at z 3**;
upper flight y 19.5→24.5 (z 3→6, 12 steps); top landing y 24.5..27 at z 6; door west (x 18..20,
y 24.7..26.9, z 6) into the hall's east gallery. A solid screen wall (x 22.6..23.2, y 11.5..19.5, up to
z 5) with arrow slits encloses the lower flight and landing so the stair cannot be entered except
through the gate. Upper flight has a 1.2 m parapet (unreachable from the floor: z ≥ 4.45). Enemies:
E6b (optional) 2 Royal Guards at the gate.

**HALL — Great Hall (x −18..18, y 9..42, roof z 15).**
- *Galleries (z 6, slab 5.4..6, parapet 1.2 m)*: east (x 14..18, y 9..30), west (x −18..−14,
  y 9..30), south/minstrels' (x −14..14, y 9..13). Carried on an arcade of columns at x = ±14
  (y 13.2, 17.4, 21.6, 25.8, 30) and y = 13 (x = ±4.7, ±9.3). Tapestries and royal banners hang from
  the parapets. At the SE corner a timber **screen with a door** (x 13.8..14.2, y 9..13, z 6..10)
  separates east and south galleries: **barred from the west side** (someone fled toward the chapel and
  barred it behind them). The west gallery's south end has the **door into the chapel loft**
  (x −22..−18, y 10.3..12.7): **open**.
- *Floor (z 0)*: four long tables with benches (cover), braziers, the **Last Muster**: six Royal Guards
  kneeling in two ranks facing the dais (dormant until E13). Dais y 36..42 at z 1.2 (5 steps y 34..36);
  throne under a canopy, set on the west side of the dais (x −5.5) so the path to the Royal door stays clear. **Royal Stair door** in the north wall (x −2..2, wall y 42..44): the
  threshold (y 42..43.6, z 1.2) is a recess inside the 2 m wall; the door leaf at the back (y 43.6..43.9)
  bears the royal seal — **sealed**. **Diggers' hatch** in the floor under the east gallery
  (x 14.5..17, y 33.2..38): open, the scaffold stair arrives here.
- Enemies: E7 on the east gallery (2 Royal Guards + 2 Royal Archers); E9 on the west gallery
  (2 Royal Wardens at the loft door); E13 finale on the floor (+2 archers on the galleries).

**CHAP — Chapel of the Binding (x −36..−22, y 9..42, ceiling z 13).** Royal loft (x −36..−22,
y 9..16, z 6) with the Vaelor pew and crest. **Loft stair** down the west wall (x −36..−33.5,
y 16→26, z 6→0). Nave: pews, candle stands, the Blood Font (x −29, y 23) with kneeling civilian
Echo imprints (non-hostile, dissolve when combat begins — lore). Altar dais (x −32..−26, y 36..42,
z 0.6). In front of the altar a bronze **crypt floor-door with the royal seal** (x −31..−27, y 33..36):
**sealed**. Enemies: **E10**.

**CRYPT (x −36..−22, y 26..42, z −6..−1).** Candle-lit royal tombs; Aldren's tomb at the north end
stands *open and empty* (Memory Trace: "No body was ever laid here."). Passage east through the thick
wall (x −22..−18, y 34..38, z −6..−2) into the undercroft. Reachable in Past only by shifting there.

**UND — Aldren's Excavation (x −18..18, y 20..42, floor z −6, vault z −0.8).** Column grid on the
ledges (x = ±12, y 22, 28, 34, 40). **The deep pit** (x −7..7, full length y 20..42) drops to z −24
with a red-gold Crownheart glow below — lethal. West ledge x −18..−7, east ledge x 7..18. On the east
ledge a **timber scaffold stair** (x 14.5..17) climbs northward from y 28 (z −6) to y 38 (z 0) and
exits through the hatch (headroom under the hall slab is kept by starting the hatch at y 33.2). Winches, lanterns, spoil baskets, a lever-crane. Enemies: **E12c** 2 Royal Guards +
1 Royal Archer (on the scaffold). West ledge: E12d (optional) 2 Royal Guards.

**RS — Royal Stair (x −3..3, y 44..58).** Carpeted grand stair from z 1.2 (y 44) to z 8 (y 55.4),
27 steps; top landing y 55.4..58, exit door north. Torches. Unreachable in Past (sealed leaf).

---

## D. Present blueprint (same footprint, generations later)

Present Caer Veyr: fractured, overgrown, cold. The Sundering broke the royal seals — sealed Past doors
often stand open — but collapses, pits and missing floors block what the Past allowed.

**GP.** Outer portcullis **fallen** diagonally across y −45..−42 (walk around it on the east side).
Scattered rubble, broken vault ribs, moonlight through a hole in the vault. **Inner portcullis down,
rusted solid** (full-height bars; impassable). Bones at the inner portcullis, scratch marks on the
*inside* face (lore). GP↔GR_E is a wide **breach** (y −41.2..−36.8, jagged, z 0..3.6) — wider than the
Past door. West door **choked with rubble** (impassable). Enemies: none (arrival calm).

**GR_E.** NE corner of the ceiling collapsed (rubble mound, light shaft), grass in cracks, rotted
bunks, fireplace cold. **CP1 sigil**. **F1 fissure** (x 8, y −42). Enemies: **E1** 2 Hollows.

**GR_W.** Filled with collapsed masonry (not enterable).

**WARD.** Open to a cold sky. The **sinkhole**: the west-centre of the yard has collapsed into the
cistern below (polygon ≈ x −18..−2, y −24..0; void). The First Crown statue is gone — toppled into
the sinkhole — only a cracked plinth at the sinkhole's east lip. The east strip (x −2..22) and the
south apron are walkable; overturned cart skeletons, grass, rubble. Hall main doors **burst outward**
(the leaves lie in the yard — lore: something broke *out*), the doorway beyond **choked** by the fallen
minstrels' gallery. Balcony **collapsed** (corbels only). **Barracks door broken inward** (leaf on the
barracks floor) → open. **CP2** (x 18, y −18). **F2** (x 16, y −6). Enemies: **E4** 3 Echo Wraiths
patrolling over the sinkhole.

**BAR.** Middle bay roof collapsed (open sky, rubble mounds up to 1.5 m, grass), bunks rotted,
skeletons heaped behind the remains of the barricade (lore: the mutineers died here). North door gone.
**F3** (x 31, y −20) — also covers the Past barracks, which is enclosed in that state.
Enemies: **E5** 4 Hollows (rise from bone piles) + 1 Hollow Warden.

**COR.** The vault collapsed between y 3 and 7: rubble fills the corridor except a **crawl gap**
along the east side (x 30.4..32, clear height 1.3 m) — crouch required. North (armory) door smashed
open. First crouch lesson.

**ARM.** Roof partly fallen; rusted racks. **East Stair**: gate torn away; the lower flight collapsed
into a **rubble ramp** (y 12→17 rising z 0→3, ≈31°) topped by a **flat rubble pad at z 3**
(x 20.2..22.4, y 17.2..19.3) that sits exactly on the footprint of the Past mid-landing. The screen
wall is down (rubble). The **upper flight is gone** (fallen into a heap at z ≈ 1 below y 19.5..24.5).
The **top landing (z 6) survives** on its corbels, 3 m above the pad — unreachable. **F4** (x 28,
y 20). Enemies: **E6** 3 Hollows + 2 Echo Wraiths.

**HALL (Present).**
- *Galleries*: all three survive as walking surfaces along the wall side; parapets broken on top but
  still ≥ 1.2 m of collision everywhere (no drops into the hall). The SE **screen is gone**; instead the
  hall's south roof has **fallen onto the minstrels' gallery**: a **crawl tunnel** (x 4..14.5,
  y 9.2..11.2, clear height 1.3 m, crouch) under fallen trusses and masonry, then rubble-strewn gallery to
  the west gallery. The **chapel loft doorway is choked** with rubble (impassable).
- *Floor*: a **great collapse** (x −7..7, y 27..42, directly above the excavation's deep pit): the dais
  and the floor in front of the Royal door fell into the deep excavation (void). Remaining floor: side
  strips x −18..−7 and x 7..18 (full length) and the south floor y 9..27. The dais wings beyond ±7 are
  rubble stubs; the threshold is ≥ 5 m from any Present floor (not jumpable). Rubble islands on the side strips (cover), the throne canopy fallen,
  royal banners burned to rags. The **Royal door threshold** (recess y 42..43.6, z 1.2) survives inside
  the wall; the **seal broke** — the leaf lies shattered in the stair beyond. The hatch is covered by
  a fallen slab.
- Enemies: E8 on the south/west gallery after the crawl (3 Hollows + 1 Wraith); E13 Present adds.

**CHAP.** Roof holes, grass and glowing flowers, rotted pews. Loft stair **collapsed** (top 4 steps and
a heap at the bottom); loft parapet intact (no drop). **F7** on the loft (x −30, y 12, z 6). The nave floor in front of the
altar has **collapsed into the crypt**: a **rubble ramp** (x −33..−25) from y 26 (z 0) down to y 36
(z −6), ≈31°. The Blood Font cracked, stained. Enemies: E10b (optional) 2 Wraiths.

**CRYPT.** Sarcophagi broken open (someone searched them), roots, glowing flowers. **CP5** (x −24,
y 40, z −6), **F8** (x −34, y 40). Enemies: **E11** 4 Hollows + 1 Hollow Warden (rise from tombs).

**UND.** Vault partly collapsed at the south: the pit's **south end is filled** with rubble
(x −7..7, y 20..27, walkable, z −6..−5.2); the north part (y 27..42) is still the deep void, glowing
stronger (Crownheart flowers ring its lip). The **scaffold stair has rotted** (a few posts and a debris
heap). **CP6** (x 12, y 36, z −6), **F9** (x 10, y 40, z −6). Enemies: **E12a** 3 Wraiths over the
deep pit, **E12b** 2 Echo Archers on the east ledge shooting across the fill.

**RS.** Same stair, intact, overgrown, moonlight from high windows. Exit door at the top.

---

## E. State-difference matrix

| Area | Only in Past | Only in Present | Past harder because | Present harder because | Why choose Past | Why choose Present |
|---|---|---|---|---|---|---|
| GP | raised inner portcullis, doors, barricade | fallen outer portcullis, wide breach, choked W door | 3 guards at the arch | inner portcullis rusted shut | only way into the Ward | calm, no enemies; wide breach to GR_E |
| GR_E / GR_W | intact rooms, GR_W reachable | rubble mound, GR_W filled | GR_W guard | — | lore + optional charge in GR_W | sigil, tutorial fight |
| WARD | statue, wagons/cover, balcony + scaffold, barricaded barracks door | sinkhole (void), open barracks door, burst hall doors | 6 guards + 2 archers with elevation | void hazard, flying wraiths | cover vs archers; full yard | barracks entry; fewer enemies |
| BAR / COR | bunks, barricade, locked corridor door | roof collapse, crawl gap, open doors | mutineers; locked exit | heavy Hollow Warden; must crouch | optional charge | only route to the armory |
| ARM | gated intact stair, screen wall | rubble ramp + pad, missing upper flight | gate locked | top landing 3 m out of reach | upper flight exists | ramp + pad give height |
| HALL galleries | SE screen door (barred from W), open loft door, archers | crawl tunnel, choked loft door | archers on narrow gallery, elites at loft door | crouch under collapse, ambush | loft door open | only way E→W |
| HALL floor | intact floor, tables, dais, sealed Royal door, Last Muster | great collapse, rubble islands, broken seal | more adds + archers | void ring, knockback danger | reach the threshold on foot | walk through the unsealed doorway |
| CHAP | loft stair, sealed crypt floor-door, rite | collapsed stair, crypt collapse ramp | 4 guards incl. warden | loft is a dead end | descend loft → nave | descend nave → crypt |
| CRYPT | sealed candle-lit tombs | broken tombs | — (lore only) | Hollow Warden fight | lore (empty tomb) | only way from the nave |
| UND | deep pit full length, scaffold stair | south fill, rotted scaffold | overseers + archer; no crossing | wraiths + archers while crossing | climb to the hatch | cross the pit |
| RS | sealed leaf, carpet | broken seal | unreachable | — | — | only way up |

No area has one state that is simply better: every Past advantage (intact structure) comes with a
Past cost (sealed royal doors, more soldiers, archers) and every Present opening comes with a Present
cost (voids, missing floors, heavier Hollows, dead ends).

---

## F. Puzzle / traversal sequences (every temporal gate)

Shift rules used below (see `MECHANICS.md`, `src/time/`): hold **R** for **2.4 s**; costs **1 charge
(100 resonance)**; capacity **2 charges**; a hit that deals ≥ 10 damage cancels the channel (no cost);
1.2 s cooldown after a shift; destination validated (capsule overlap + footing within 8 m below).

**G1 — "The gate remembers" (teach: see the other route, shift once).** GP, Present → Past.
```
Present: arrive at the mouth → portcullis rusted shut; breach east
→ GR_E: E1 (2 Hollows) → kneel at CP1: blood rite, shift unlocked, charge topped to 1
→ back in GP, prompt: the portcullis stands raised in the castle's memory
→ hold R anywhere in the GP lane → PAST
→ E2 (3 Royal Guards) at the raised portcullis → walk into the Ward
```
Teaching beat: if the player channels while standing in the breach (y −41.2..−36.8 outside the Past
door y −40.4..−38) the shift is **denied** ("Stone stands there in that memory") — first exposure to
destination validity, at zero risk.

**G2 — "Barred from within" (reverse of G1).** Ward, Past → Present.
```
Past: E3 in the yard (use wagons as cover from the balcony archers; optional scaffold to kill them)
→ barracks door: barricaded from inside (mutineers' shouting)
→ stand anywhere on the east half of the yard (x > −1) → hold R → PRESENT
→ E4 wraiths lift out of the sinkhole → CP2 → through the broken door into BAR
```
Validity: over the Present sinkhole (x −18..−2, y −24..0) → **denied** (no footing within 8 m).
The Past lanes funnel the player east; the sinkhole reads clearly after the first Present visit.

**G3 — "Half a stair" (height carry, multi-step).** Armory, Present → Past.
```
Present: BAR (E5) → COR crawl (crouch) → ARM (E6)
→ climb the rubble ramp to the pad at z 3 (the Past mid-landing's footprint)
→ hold R on the pad → PAST: standing on the mid-landing, beyond the locked gate
→ climb the Past upper flight to z 6 → CP3 → door to the east gallery
```
The player sees both halves at once: the Past gate + intact stair, the Present ramp + surviving top
landing. Alternative valid solution: shifting from the upper part of the ramp puts the player on the
Past lower flight (still beyond the gate); ≤ 0.3 m capsule overlap with a step is resolved upward.

**G4 — "Under the fall" (obstruction + crouch + ambush).** East gallery, Past → Present.
```
Past: E7 on the east gallery (narrow combat, archers at the far end)
→ SE screen door barred from the other side
→ hold R anywhere on the east gallery → PRESENT (screen gone, roof fallen onto the south gallery)
→ crouch through the 10 m crawl tunnel → E8 ambush on the far side (3 Hollows + 1 Wraith)
→ west gallery → loft doorway choked
```

**G5 — "The open door" (obstruction + enemy ownership).** West gallery, Present → Past.
```
Present: west gallery, loft doorway choked with rubble
→ hold R on the west gallery → PAST: loft door open, but E9 (2 Royal Wardens) guard it
→ (optional) lift the bar on the screen door → loop back to CP3
→ loft: CP4
```
Tactical option: shift back to Present to break off from the Wardens (they wait; the encounter is
not cleared) — costs a charge; F6 (west gallery) and F7 (loft) cover starvation.

**G6 — "The floor gives way" (descent).** Chapel nave, Past → Present.
```
Past: loft → loft stair → nave: E10 (3 Guards + 1 Warden, +2 Guards reinforce at 50%)
→ crypt floor-door sealed ("The door does not know you")
→ hold R on the nave floor → PRESENT: the floor before the altar has collapsed into a ramp
→ walk down into the crypt (z −6) → E11 → CP5
```
Shifting while standing over the collapse footprint drops the player ≤ 6 m onto the ramp —
**risky but intentional**, allowed (no fall damage below 7 m).

**G7 — "Across, then up" (two-state weave under fire).** Undercroft, Present → Past.
```
Present: crypt passage → west ledge: E12a wraiths over the deep pit, E12b archers on the far ledge
→ cross the pit on the rubble fill (y 20..27) under arrow fire → east ledge → CP6
→ the scaffold here is rotted; the hatch 6 m above is out of reach
→ hold R on the east ledge → PAST: scaffold stair stands — and E12c overseers are right here
→ fight → climb the scaffold → through the hatch into the Great Hall (Past)
```
Validity: shifting on the fill (x −7..7, y 20..27) → Past has the deep pit there → **denied**
(no footing). The east ledge is valid everywhere in both states except the scaffold footprint
(x 14.5..17, y 28..38) where the Past stair's stringers occupy space above z −6: the capsule check
resolves ≤ 0.3 m upward onto a step or denies — both safe. (Scaffold footprint x 14.5..17, y 28..38.)

**G8 — "Stand in the doorway" (finale, precision anchor).** Great Hall, Past → Present.
```
Past: E13 — the Gate Warden (persists across shifts) + the Last Muster rises
→ Warden defeated: resonance surge (≥ 1 full charge guaranteed)
→ walk up the dais to the Royal door: sealed leaf ("The door does not know you")
→ step into the recessed threshold (y 42..43.6) → hold R → PRESENT: the seal is broken, leaf gone
→ the threshold is the only floor left on this side of the collapse → climb the Royal Stair → EXIT
```
Validity: channeling on the dais outside the recess → Present void → **denied** with the hint
"Only the doorway remembers solid ground." The recess floor exists in both states → safe.

### F.9 Puzzle escalation check
G1/G2 recognition (single shift, clear obstruction) → G3 two-part structure + height → G4/G5 paired
states with crouch and elites → G6 vertical descent → G7 two different state elements in sequence
under ranged pressure → G8 arena + precise anchor. No gate repeats the same logic; no bridge-vs-gap
puzzle is used on this floor.

---

## G. Combat plan

Archetypes (Floor 1 roster): **Past** — Royal Guard (knight model, sword clips), Royal Archer (Erika),
Royal Warden (knight, elite scale/tint). **Present** — Hollow (necromorph), Echo Wraith (night ghost,
flying), Echo Archer (Erika, spectral), Hollow Warden (knight, corroded spectral tint). **Boss** — Gate
Warden (knight ×1.3, exists in both states).

Rewards (resonance): Hollow 40 · Royal Guard 40 · Archer 30 · Wraith 25 · Hollow Warden 70 ·
Royal Warden 100 · Remnant (fissure) 50 · Gate Warden 200. Small bonuses: +2 per landed hit, +12 per
parry, +6 per completed combo finisher. 1 charge = 100, capacity 200.

| ID | Where / state | Trigger | Arena | Enemies | Reinforcement | Features | Reward |
|---|---|---|---|---|---|---|---|
| E1 | GR_E · Present | enter room | 10×11 room, rubble mound | 2 Hollow | — | tutorial prompts | 80 |
| E2 | GP · Past | shift into Past in GP | 6 m-wide vaulted lane | 3 Royal Guard | — | crates narrow the lane | 120 |
| E2b | GR_W · Past (opt) | enter | room | 1 Royal Guard | — | lore trace | 40 |
| E3 | WARD · Past | enter the yard | 44×36 yard, wagon lanes | 4 Royal Guard, 2 Archer (balcony) | +2 Guards from the west tents when 2 die | cover vs archers, scaffold | 300 |
| E4 | WARD · Present | within 16 m of sinkhole | east strip + void | 3 Wraith | — | void lip, kick knock-off | 75 |
| E5 | BAR · Present | reach mid-barracks | 14×26 hall, rubble mounds | 4 Hollow, 1 Hollow Warden | Hollows rise in 2 pairs | first heavy enemy | 230 |
| E5b | BAR · Past (opt) | enter in Past | bunk rows | 4 Royal Guard | — | — | 160 |
| E6 | ARM · Present | enter | 14×16, ramp | 3 Hollow, 2 Wraith | — | height on the ramp | 170 |
| E6b | ARM · Past (opt) | enter in Past | at the gate | 2 Royal Guard | — | — | 80 |
| E7 | HALL E gallery · Past | step onto the gallery | 4 m-wide, 21 m-long gallery | 2 Royal Guard, 2 Archer | — | narrow; parapet | 140 |
| E8 | S/W gallery · Present | exit crawl tunnel | gallery + rubble | 3 Hollow, 1 Wraith | — | ambush | 145 |
| E9 | W gallery · Past | shift into Past there | gallery end | 2 Royal Warden | — | first elites | 200 |
| E10 | CHAP nave · Past | reach the nave floor | 14×26 nave, pews | 3 Royal Guard, 1 Royal Warden | +2 Guards at Warden 50% | pews = cover/obstacles | 300 |
| E10b | CHAP · Present (opt) | enter nave in Present | nave | 2 Wraith | — | — | 50 |
| E11 | CRYPT · Present | reach crypt floor | 14×16 crypt, tombs | 4 Hollow, 1 Hollow Warden | rise from tombs | tombs as cover | 230 |
| E12a/b | UND · Present | enter west ledge | pit + fill | 3 Wraith, 2 Echo Archer | — | cross under fire | 135 |
| E12c | UND east · Past | shift into Past on the east ledge | ledge + scaffold | 2 Royal Guard, 1 Archer | — | archer on the stair | 110 |
| E12d | UND west · Past (opt) | shift into Past on west ledge | ledge | 2 Royal Guard | — | — | 80 |
| E13 | HALL · both | step onto the hall floor | 36×33 hall | Gate Warden (460 HP); Past: Last Muster (weaker Echo guards) 2+2+2, 2 archers on galleries; Present: 3 Hollow + 2 Wraith | wave 2 at Warden 65 %, wave 3 at 35 %; the Warden’s death ends the muster | tables (Past) vs void ring (Present) | 200 + adds |

Mandatory kills on the critical path ≈ 60 enemies; optional ≈ 13. Every section has a fight before
its temporal gate. Short breathing beats follow each gate (the new state's space is read before the
next fight).

Gate Warden behaviour: moves leap slam, whirlwind, spin slash, advancing sweep, guards frontally,
guard-breaks with a kick. When the player shifts, the Warden **follows** (brief flicker, relocates to
nearest valid ground if its spot is invalid in the new state). In the Present it gains a
"temporal lunge" (fast closing dash); in the Past it calls archers. Kicking it at the void lip in the
Present staggers it heavily (no insta-kill).

---

## H. Temporal economy (worst-case walk)

Assumptions: player takes **only mandatory** fights, collects **only kill rewards** (no hit/parry
bonuses), wastes nothing, and fights before shifting. Cap 200.

| Step | Event | Δ | Charge after |
|---|---|---|---|
| 1 | Start | — | 0 |
| 2 | E1 | +80 | 80 |
| 3 | CP1 blood rite (one-time top-up to 100) | +20 | 100 |
| 4 | **G1** | −100 | 0 |
| 5 | E2 | +120 | 120 |
| 6 | E3 (6 guards; archers optional) | +240 | 200 (cap) |
| 7 | **G2** | −100 | 100 |
| 8 | E5 | +230 | 200 |
| 9 | E6 | +170 | 200 |
| 10 | **G3** | −100 | 100 |
| 11 | E7 | +140 | 200 |
| 12 | **G4** | −100 | 100 |
| 13 | E8 | +145 | 200 |
| 14 | **G5** | −100 | 100 |
| 15 | E9 | +200 | 200 |
| 16 | E10 | +300 | 200 |
| 17 | **G6** | −100 | 100 |
| 18 | E11 | +230 | 200 |
| 19 | E12a/b | +135 | 200 |
| 20 | **G7** | −100 | 100 |
| 21 | E12c | +110 | 200 |
| 22 | E13 Gate Warden death surge (guaranteed top-up to ≥100) + adds | ≥ +200 | 200 |
| 23 | **G8** | −100 | 100 |

The critical path never needs more than it has, even if the player only just meets each gate.

### H.1 Softlock guarantees (all three hold independently)

1. **Resonant Fissures** (F1–F10) cover every required-shift location and every walkable component
   that is enclosed in one state. A fissure spawns 2 Remnants (weak Echoes, 50 each) when: player
   charge < 100, no hostile alive within 25 m, player within 14 m of the fissure; 15 s cooldown.
   Visible glowing crack; combat still supplies the charge (not passive regeneration).
2. **Checkpoint policy**: on death the player respawns at the last sigil with
   `charge = max(charge saved at activation, 100)`, full health, in the sigil's saved state.
3. **Warden surge**: the finale always ends with ≥ 100 charge before the final gate.

Fissure placement: F1 GR_E (8, −42, 0) · F2 Ward east (16, −6, 0) · F3 Barracks (31, −20, 0) ·
F4 Armory floor (28, 20, 0) · F5 East gallery (16, 22, 6) · F6 West gallery (−16, 20, 6) ·
F7 Chapel loft (−30, 12, 6) · F8 Crypt (−34, 40, −6) · F9 Undercroft east (10, 40, −6) ·
F10 Great Hall east floor (13, 36, 0).

Component audit — every region the player can walk in one state without shifting:

| State | Component | Walk exits | Source if charge is 0 |
|---|---|---|---|
| Past | Apron+GP+GR_E+GR_W+Ward+balcony | none beyond | F1, F2 |
| Past | Barracks+Corridor (barricade + locked door) | none | F3 |
| Past | Armory floor (gate + locked door) | none | F4 |
| Past | Stair beyond gate + top landing + east gallery | none (screen barred) | F5 |
| Past | S+W galleries, loft, loft stair, nave | none (floor-door sealed) | F6, F7 |
| Past | Crypt + passage + UND west ledge | none (pit) | F8 |
| Past | UND east + scaffold + Hall + dais | none (Royal seal) | F9, F10, Warden surge |
| Past | Royal Stair (behind the leaf) | exit (exit works in both states) | — |
| Present | Apron+GP+GR_E | none (portcullis rusted) | F1 |
| Present | Ward east + Barracks + crawl + Armory + ramp/pad | none (top landing out of reach) | F2, F3, F4 |
| Present | Top landing + east gallery + crawl + S/W galleries | none (loft doorway choked) | F5, F6 |
| Present | Chapel loft | none | F7 |
| Present | Nave + collapse + Crypt + UND west/fill/east | none (scaffold rotted) | F8, F9 |
| Present | Hall side strips + south floor | none (collapse) | F10, Warden surge |
| Present | Royal Stair | exit | — |

No component is a trap: each has a fissure or an exit. ✔

### H.2 Spam control
Cost 100 + 2.4 s channel (rooted, interruptible) + 1.2 s cooldown + capacity 2 → at most two shifts
without fighting.

---

## I. Narrative / environmental clues

| Where | Past shows | Present shows | The player infers |
|---|---|---|---|
| Gate Passage | murder holes and portcullis controls face *inward* | bones at the inner portcullis, scratches on the inside | the gate was closed to keep people **in** |
| Ward | refugee carts stopped by guards; statue of the First Crown | statue toppled into the pit | people tried to leave; the dynasty's image fell |
| Hall doors | barred from inside, ranks heard within | leaves burst **outward** into the yard | something broke *out* of the hall |
| Barracks | barricaded from inside by mutineers | door smashed inward, skeletons behind the barricade | royal wardens broke in on their own soldiers |
| Armory | gate "sealed by Royal Order", racks emptied to the wardens | rust | the king armed his wardens, locked the rest out |
| Galleries | screen door barred from the west | — | someone fled toward the chapel |
| Chapel | civilians kneeling at the Blood Font under guard | cracked font, blood stains | the rite was forced on commoners |
| Crypt | Aldren's tomb open and empty | tombs broken open | the last king was never buried |
| Excavation | the king dug beneath his own hall toward a red-gold glow | Crownheart flowers ring the pit | the catastrophe came from below, not from the siege |
| Sealed doors | "The door does not know you." | seals broken | the Uncrowned's blood is unbound — the old rites reject it |

Memory Traces (short interactive lines, ≤ 2 sentences) at: GR_W desk, Ward carts, barracks barricade,
armory gate, screen door bar, Blood Font, Aldren's tomb, excavation winch. No exposition dumps.

---

## J. Streaming / performance partition

Floor 1 is small enough to keep fully loaded (target ≤ 12 MB GLB + textures) with per-section
activation:

| Section | Contents | Visual groups | Collision groups |
|---|---|---|---|
| S1_GATE | GP, GR_E, GR_W, apron | SHARED / PAST / PRESENT | COL_SHARED / COL_PAST / COL_PRESENT |
| S2_WARD | Ward, balcony, scaffold | same | same |
| S3_EAST | BAR, COR, ARM + east stair | same | same |
| S4_HALL | Great Hall, galleries, RS | same | same |
| S5_CHAPEL | Chapel, loft, crypt | same | same |
| S6_UNDER | Excavation | same | same |

- Export: `public/assets/levels/floor01.glb` (visual: node `S#_NAME/SHARED|PAST|PRESENT`), 
  `public/assets/levels/floor01_collision.glb` (collision nodes only, no materials), markers as empties
  with custom properties (`marker_type`, ids) inside the visual GLB (`MARKERS`).
- Materials are exported by **name only**; the runtime binds them to a shared texture library
  (textures load once for all sections and both states). SHARED meshes swap between a Past and Present
  material variant on shift.
- Culling: section visibility = current section + portal neighbours (table in `src/levels/floor01.ts`).
- Collision: one BVH per state (SHARED ∪ state) built at load; the shift validator queries the
  *target* state's BVH.
- Enemies are spawned per encounter on trigger and disposed when killed; inactive-state enemies are
  frozen and hidden.
- Dynamic lights: ≤ 8 point lights active (nearest torches/braziers in Past, fissure/flower glows in
  Present) + one shadow-casting directional light (moon/sun) that lights the Ward and roof breaches.

---

## K. Collision and shift-safety register

Player: capsule r 0.35, h 1.8 (crouch 1.15); step-up 0.4; max slope 45°; jump apex ≈ 1.1 m, running
jump ≈ 3.5 m; free fall ≤ 7 m, lethal depth = voids (kill volume → fall-respawn at last safe ground,
−25 % HP).

| Shift site | From → To | Player positions | Target-state content there | Verdict |
|---|---|---|---|---|
| G1 GP lane x −3..3, y −44..−32 | Pr → Pa | lane floor | floor, clear lane (crates kept off x −2..2) | SAFE |
| G1 breach sliver y −41.2..−40.4 / −38..−36.8, x 3..5 | Pr → Pa | in breach | Past wall | INVALID (denial tutorial) |
| G2 Ward east x −1..22 | Pa → Pr | yard | floor, rubble ≤ 0.4 m (step-up) | SAFE |
| G2 over sinkhole | Pa → Pr | yard west | void | INVALID (no footing) |
| G3 pad x 20.2..22.4, y 17.2..19.3, z 3 | Pr → Pa | pad | mid-landing z 3, same footprint | SAFE |
| G3 ramp y 12..17 | Pr → Pa | ramp | lower flight steps (≤0.25 m overlap) | SAFE (resolved up) |
| G3 armory floor | Pr → Pa | floor | Past floor, racks | SAFE / prop overlap → resolved or denied |
| G4 east gallery x 14..18, y 9..30, z 6 | Pa → Pr | gallery | gallery floor, rubble ≤ 0.4 | SAFE |
| G5 west gallery x −18..−14, y 9..30, z 6 | Pr → Pa | gallery | gallery floor | SAFE |
| G5 inside choked doorway | Pr → Pa | n/a (rubble fills it) | — | unreachable |
| G6 nave floor | Pa → Pr | nave | floor or collapse ramp ≤ 6 m below | SAFE / RISKY-INTENTIONAL |
| G6 on loft stair | Pa → Pr | stair | collapsed stair: air ≤ 6 m above heap | RISKY-INTENTIONAL |
| G7 east ledge x 7..18, y 20..42 | Pr → Pa | ledge | ledge floor; scaffold footprint resolved | SAFE |
| G7 on fill x −7..7, y 20..27 | Pr → Pa | fill | deep pit | INVALID (no footing) |
| G8 threshold x −2..2, y 42..43.6, z 1.2 | Pa → Pr | recess | threshold floor, no leaf | SAFE |
| G8 dais / central floor | Pa → Pr | hall centre | void | INVALID (hint) |
| finale side floors x ±7..±18 | both | floor | floor / rubble islands | SAFE or resolved |

Rules implemented in code: (1) capsule overlap test against the target BVH; if overlapping, try
upward resolution in 0.05 m steps up to 0.35 m; (2) downward ray within 8 m must hit target-state
ground that is not a void volume; (3) otherwise deny with feedback, no charge spent. Enemies follow
the same rules but may relocate to the nearest valid point (≤ 4 m).

---

## L. Self-review (v1 → v2)

| Criterion | v1 finding | Revision in v2 |
|---|---|---|
| Fun | Undercroft v1 had a Past bridge across the pit (third "structure vs gap" beat). | Removed. G7 is now *cross in Present, climb in Past*, with archers firing across the fill and the overseers appearing on shift. |
| Readability | Armory v1 stair could be vaulted over its parapet near the foot, bypassing G3. | Added the full-height screen wall (Past) along the lower flight and landing. |
| Route coherence | Hall v1 let players drop from a broken Present gallery parapet into the hall and sequence-break to the finale. | All gallery and loft parapets keep ≥ 1.2 m collision in both states; hall floor reachable only via the hatch. |
| Architectural plausibility | v1 undercroft extended under the hall's south end with ledges on four sides (no load logic). | Undercroft = y 20..42 only; south of it is foundation. Chapel/hall share a 4 m wall that carries the loft doorway and the crypt passage. |
| Combat density | v1 had 9 encounters, one long walk (Ward→Armory) without a fight. | 14 mandatory encounters; E4 and E6 added; every gate preceded by a fight. |
| Puzzle variety | v1 G4 and G5 were both "doorway blocked in one state". | G4 became crouch-under-collapse with an ambush; G5 keeps the doorway but adds enemy ownership (elites) and the optional un-barring loop. |
| Temporal economy | v1 E8 (2 Hollows, 80) could not refill a single charge for G5. | E8 raised to 3 Hollows + 1 Wraith (145); fissures at every gate; checkpoint floor of 100. |
| Softlock risk | v1 chapel loft was a Present dead end with no source; v2 audit found the Past barracks, Past east gallery and post-finale hall also enclosed. | F1–F10 placed from a per-state component audit (§H.1): every enclosed component has a fissure or an exit. |
| Performance | v1 put the Last Muster as 12 skinned soldiers. | 6 kneeling guards (reuse the knight rig), knight decimated to ~12k tris; ≤ 10 active enemies at once. |
| Narrative coherence | v1 had no reason Past royal doors reject the player. | Unbound-blood rule: royal seals "do not know" the Uncrowned; the Sundering broke seals in the Present. |

Remaining accepted risks: the finale is the only place with more than 8 simultaneous enemies (paced in
waves); crawl tunnels rely on the crouch capsule being ≤ 1.2 m (validated by collision test).

---

## M. Coordinate appendix (authoritative dimensions)

Walls default 2 m thick unless stated; doors 2.4 × 3.2 m; stairs rise 0.25 / run 0.4167.

| Id | Interior footprint (x; y) | Floor z | Ceiling / top | Notes |
|---|---|---|---|---|
| APRON | −3..3; −51..−46 | 0 | open | spawn (0, −49) facing north; blocker at y −51 |
| GP | −3..3; −46..−31 | 0 | vault 7 | inner arch in wall y −31..−29 |
| GR_E | 5..15; −44..−33 | 0 | 6 | door/breach in wall x 3..5 |
| GR_W | −15..−5; −44..−33 | 0 | 6 | door x −5..−3, y −40.4..−38 |
| WARD | −22..22; −29..7 | 0 | open (walls 14) | sinkhole (Present) x −18..−2, y −24..0; plinth 0, −12 (3×3, h 1.2) |
| BALCONY | −10..10; 5..7 | 6 | open | Past; scaffold x −21..−11, y 1..3 + platform x −11..−10, y 1..5 |
| BAR | 24..38; −27..−1 | 0 | 8 | ward door x 22..24, y −14.5..−11.5; N door x 29..32 |
| COR | 29..32; 1..9 | 0 | vault 4 | Present crawl y 3..7, gap x 30.4..32, h 1.3 |
| ARM | 20..34; 10.5..27 | 0 | 9 | S door x 29..32 (wall y 9..10.5); stair x 20..22.6 |
| ARM stair | lower y 12..17 (z 0→3); landing 17..19.5 (z 3); upper 19.5..24.5 (z 3→6); top 24.5..27 (z 6) | | | gallery door x 18..20, y 24.7..26.9, z 6 |
| HALL | −18..18; 9..42 | 0 | 15 | walls: S y 7..9, E x 18..20, W x −22..−18 (4 m), N y 42..44 |
| GALLERIES | E 14..18; 9..30 · W −18..−14; 9..30 · S −14..14; 9..13 | 6 | — | slab 5.4..6; parapet 1.2 |
| SCREEN | x 13.8..14.2; y 9..13 | 6 | 10 | Past only, door y 10.3..12.7 |
| CRAWL (hall) | x 4..14.5; y 9.2..11.2 | 6 | clear 7.3 | Present only |
| DAIS | −9..9; 36..42 (steps 34..36) | 1.2 | | throne (0, 40.5) |
| ROYAL DOOR | −2..2; recess 42..43.6; leaf 43.6..43.9 | 1.2 | 5 | |
| HATCH | 14.5..17; 33.2..38 | 0 | | scaffold stair y 28→38, z −6→0 |
| HALL PIT (Present) | −7..7; 27..42 | void | | directly above the excavation's deep pit |
| CHAP | −36..−22; 9..42 | 0 | 13 | loft y 9..16 z 6; loft door x −22..−18, y 10.3..12.7 |
| LOFT STAIR | x −36..−33.5; y 16→26 | 6→0 | | Past; Present top 4 steps only |
| CRYPT COLLAPSE | x −33..−25; y 26→36 | 0→−6 | | Present ramp; Past sealed floor-door x −31..−27, y 33..36 |
| ALTAR DAIS | −32..−26; 36..42 | 0.6 | | font (−29, 23) |
| CRYPT | −36..−22; 26..42 | −6 | −1 | passage x −22..−18, y 34..38, z −6..−2 |
| UND | −18..18; 20..42 | −6 | −0.8 | pit x −7..7 (Past full length, z −24); Present fill y 20..27 |
| RS | −3..3; 44..58 | 1.2→8 | 13 | 27 steps y 44.06..55.4; landing 55.4..58; exit door y 58 |

Markers (empties exported with custom properties): `spawn`, `sigil` (CP1–CP6), `fissure` (F1–F10),
`encounter` volumes (E#), enemy spawn points (`enemy`, archetype, state, encounter), `trace` (memory
traces), `trigger` (tutorial prompts, finale), `void` volumes, `exit`, `light` (torch/brazier with
state), `veg` (vegetation scatter, Present).


---

## N. Implementation notes (built v2.1, 2026-09-29)

Deviations found while building and playtesting with the autopilot; the code is authoritative for these:

- Gatehouse apron extended to y −57.5 (camera room at spawn); spawn at (0, −52).
- Hatch is x 14.5..17, y 32.6..38 (headroom for the northward scaffold stair y 28→38, z −6→0).
- Great Hall Present collapse is x −7..7 (exactly above the excavation's deep pit).
- Throne moved to the west side of the dais (x −5.5) so the Royal door stays the clear goal.
- E13 trigger volume is the hall floor only (z −1..3); the finale starts only from that volume; the diggers'
  hatch locks (Past) once the player stands on the hall floor; the Warden's death ends the Last Muster and
  grants the resonance surge.
- E11 runs in two waves; the Last Muster uses a weaker `muster` Echo-guard archetype; Warden 460 HP.
- The optional screen-door un-barring loop (G5) is **not implemented** yet.
- Enemy aggro-on-sight requires line of sight.
