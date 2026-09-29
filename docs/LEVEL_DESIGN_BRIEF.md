# LEVEL_DESIGN_BRIEF.md

# Purpose

This document defines constraints for level design.

It deliberately does **not** contain the actual castle map.

Claude is responsible for designing the map from first principles.

The user does not want to provide room-by-room layout instructions.

---

# 1. Total Game Structure

The complete game contains exactly three major castle floors.

## Floor 1

- substantial;
- first full vertical slice;
- must prove every major system;
- implemented before any other floor is modeled.

## Floor 2

- substantial;
- designed only after Floor 1 is fully proven;
- can assume player mastery and create more complex state weaving.

## Floor 3

- shorter;
- only a limited amount of approach content;
- primarily exists to build tension and host the final boss;
- can become more temporally unstable.

Do not create Floor 2 or Floor 3 geometry during the first milestone.

---

# 2. All Gameplay Is Inside the Castle

The game is not an outdoor open-world game.

Playable spaces should be internal castle architecture and tightly connected castle structures.

Possible architectural categories may include:

- rooms;
- halls;
- corridors;
- stairwells;
- galleries;
- balconies;
- internal courtyards only if enclosed within the castle complex;
- gate interiors;
- tower interiors;
- service passages;
- ceremonial spaces;
- military spaces;
- storage;
- archives;
- royal spaces;
- underground/vault spaces.

These are categories, not a prescribed map.

Claude chooses what Floor 1 actually contains.

---

# 3. Floor 1 Must Be Designed Before Modeling

Create:

`docs/LEVEL_01_BLUEPRINT.md`

before meaningful Blender production.

The blueprint must be specific enough that someone else could build the floor without inventing missing route logic.

---

# 4. Required Blueprint Sections

## A. Floor thesis

Explain what makes this floor distinct.

Include:

- gameplay purpose;
- narrative purpose;
- expected duration;
- pacing;
- difficulty curve;
- visual identity.

## B. Spatial graph

Create a room/corridor connectivity graph.

Show:

- entry;
- critical path;
- optional spaces if any;
- vertical connections;
- locked/gated transitions;
- checkpoint positions;
- exit.

## C. Past blueprint

Describe the Past version room by room.

Include:

- geometry;
- doors;
- stairs;
- bridges/balconies;
- props;
- mechanisms;
- hazards;
- enemy placements;
- traversal opportunities.

## D. Present blueprint

Describe the same footprint in the Present.

Include:

- destruction;
- missing structures;
- rubble;
- collapsed surfaces;
- new openings;
- vegetation;
- hazards;
- enemy placements;
- traversal opportunities.

## E. State-difference matrix

For every meaningful area, explicitly answer:

1. What exists only in Past?
2. What exists only in Present?
3. What makes Past harder here?
4. What makes Present harder here?
5. Why might the player intentionally choose either state?

If one state is always superior, redesign the area.

## F. Puzzle/traversal sequence

For every temporal gate, write the actual path sequence.

Example format only:

```text
Present
-> reach elevated position using state-specific geometry
-> shift
-> cross structure available in Past
-> enter next section
-> later return to Present for a route unavailable in Past
```

Do not copy the example mechanically.

## G. Combat plan

For each encounter:

- encounter trigger;
- arena shape;
- enemy archetypes;
- approximate group size;
- reinforcement logic;
- useful environmental features;
- state-specific differences;
- intended temporal charge reward.

## H. Temporal economy

Track expected charge gain and required shifts through the entire floor.

The player must not be able to hardlock progression by spending charge at the wrong time.

## I. Narrative/environmental clues

Identify what the floor communicates about:

- House Vaelor;
- the Sundering;
- conflict within the castle;
- the protagonist's relationship to the bloodline.

Prefer visual evidence over text dumps.

## J. Streaming/performance boundaries

Plan how the floor can be divided into practical sections for:

- GLB exports;
- culling;
- collision;
- activation;
- enemy spawns;
- state switching.

---

# 5. Design Quality Requirements

## Castle realism

The floor should feel intentionally constructed.

Avoid:

- disconnected arena boxes;
- nonsense corridors that exist only to hide loading;
- repetitive square rooms;
- identical corridor widths everywhere;
- random medieval props without architectural purpose.

Use architectural hierarchy.

Major spaces should feel major.

Service connections should feel narrower.

Stairs should connect believable elevations.

Doors and walls should have physical thickness.

---

# 6. Combat Density

This is an action game.

The floor should contain enough enemy encounters that the player regularly:

- attacks;
- rolls;
- jumps;
- uses strong attacks;
- uses combos;
- uses defensive actions;
- earns temporal charge.

Do not create a level with three fights separated by long empty walking sequences.

At the same time, leave short breathing/readability moments so the player can notice temporal traversal opportunities.

---

# 7. Time Mechanic Design

The temporal mechanic is not a decorative filter.

State changes must alter gameplay geometry.

Use a broad vocabulary of differences.

Avoid repeating:

> broken bridge -> shift -> intact bridge

for every puzzle.

Possible categories:

- topology;
- height;
- openings;
- obstruction;
- mechanisms;
- cover;
- climb routes;
- hazards;
- enemy access;
- shortcuts;
- route loops;
- vertical circulation.

Invent floor-specific combinations.

---

# 8. Two Blueprints, One Place

Past and Present should remain recognizable as the same architecture.

Use stable anchors such as:

- main columns;
- room proportions;
- window positions;
- core wall lines;
- large fireplaces;
- major stair footprints;
- monuments.

Then alter secondary and damaged geometry.

The player should develop spatial memory across both states.

---

# 9. Shift Safety

Every designed shift location must be evaluated in the target state.

Mark:

- safe;
- invalid;
- risky but intentional.

Do not depend on invisible corrective teleporting to make a badly designed overlap work.

---

# 10. Enemy and Puzzle Interaction

Because combat recharges shifting, the blueprint should think about enemies and traversal together.

Questions Claude must ask:

- Does the player have enough charge before a required shift?
- Can the player accidentally spend charge and get stranded?
- Are there encounters placed naturally before major temporal gates?
- Can a shifted arena create interesting tactical changes?
- Do enemies visually belong in each state?
- Is respawn/reinforcement logic needed to prevent charge starvation?

---

# 11. Floor 1 Implementation Gate

Do not begin detailed environment production until `LEVEL_01_BLUEPRINT.md` passes a self-review.

The self-review should explicitly evaluate:

- fun;
- readability;
- route coherence;
- architectural plausibility;
- combat density;
- puzzle variety;
- temporal economy;
- softlock risk;
- performance;
- narrative coherence.

Revise weak sections before opening the level production phase.

---

# 12. After Floor 1

Only after Floor 1 is:

- modeled;
- exported;
- playable;
- mechanically complete;
- tested end to end;
- and documented in `CONTEXT.md`

should Claude design Floor 2.

The same rule then applies before Floor 3.
