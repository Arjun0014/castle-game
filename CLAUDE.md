# CLAUDE.md

## Project

This repository is a browser-based third-person 3D action game for an AI game competition with the theme **Castles**.

The entire playable game takes place inside one ancestral castle that exists in two temporal states:

- **Past**: the castle near the end of the kingdom, structurally intact, inhabited, warm, ceremonial, and militarized.
- **Present**: the same castle generations later, ruined, fractured, overgrown, abandoned, and structurally altered.

The player is a forgotten descendant of the royal bloodline. Their blood is linked to the castle's temporal core, allowing them to force the castle between its Past and Present states.

The game must feel like an action game first. Combat, movement, spatial traversal, and the Past/Present mechanic are the core.

Read these files before doing substantive work:

1. `docs/CONTEXT.md`
2. `docs/LORE.md`
3. `docs/MECHANICS.md`
4. `docs/LEVEL_DESIGN_BRIEF.md`
5. `docs/ASSET_PIPELINE.md`

`docs/CONTEXT.md` is the persistent handoff and source of current project state. Update it regularly.

---

## Non-negotiable product direction

- Third-person action game.
- Browser runtime using Three.js.
- Blender is the content creation and level authoring tool.
- Use Blender MCP when connected.
- One castle only. Do not create an outdoor open-world game.
- Three floors total.
- Floor 1 and Floor 2 are substantial gameplay floors.
- Floor 3 is shorter and primarily builds into the final boss encounter.
- Do not model Floor 2 or Floor 3 until Floor 1 is fully designed, implemented, exported, playable, and validated.
- The first major milestone is one polished, complete Floor 1.
- Each floor has two spatial states: Past and Present.
- The states share the same overall castle footprint but differ in geometry, routes, props, hazards, lighting, and enemy setup.
- Neither Past nor Present is the universally correct state.
- The player must use both states to progress.
- Time shifting is not free or spammable.
- Combat recharges the ability to shift time.
- Enemy density must be high enough that combat is a major part of traversal and the player can replenish temporal power.
- The player character has a large Mixamo sword-and-shield animation set. Inspect the actual clips and use them extensively instead of building a minimal two-attack combat system.
- Movement and combat should include jumping, rolling/dodging, crouching, light attacks, strong attacks, combinations, defensive actions when supported, and satisfying hit reactions.
- The castle layout and puzzle design are to be designed by you. Do not ask the user to invent the floor plan.

---

## Mandatory workflow

### Phase 0: Inspect, do not assume

At the start of a fresh session:

1. Read `docs/CONTEXT.md`.
2. Inspect the actual repository tree.
3. Inventory existing characters, animations, materials, vegetation, code, Blender files, and exports.
4. Verify toolchain and Blender MCP connectivity if Blender work is needed.
5. Update the Verified Repository State section in `docs/CONTEXT.md` if it is stale.

Never assume filenames from documentation if the repository says otherwise.

Do not rename, move, overwrite, or delete source assets merely to match the suggested folder structure.

---

### Phase 1: Floor 1 design before Blender production

Before building Floor 1 in Blender, create:

`docs/LEVEL_01_BLUEPRINT.md`

You are responsible for the blueprint.

It must include:

- floor purpose and pacing;
- topological map of rooms, corridors, stairs, side spaces, vertical changes, and connections;
- a Past blueprint;
- a Present blueprint;
- a room-by-room state comparison;
- critical path;
- optional paths if useful;
- combat encounter locations and enemy compositions;
- temporal charge economy through the route;
- checkpoints;
- state-change opportunities;
- puzzle/traversal sequences;
- collision and shift-safety considerations;
- environmental storytelling;
- performance/streaming partition plan;
- reasons each room exists.

Self-review the blueprint before implementation. Fix weak or repetitive puzzle logic yourself. Do not wait for user approval unless a true blocker requires it.

Do not create Floor 2 or Floor 3 blueprints yet beyond preserving the known total three-floor scope.

---

### Phase 2: Build Floor 1 only

Once the blueprint is coherent:

1. Build a modular architectural kit in Blender.
2. Build the shared structural footprint.
3. Build Past and Present variants.
4. Apply the supplied material library.
5. Use supplied vegetation primarily where appropriate in the Present.
6. Add props and destruction geometry.
7. Create collision-friendly geometry.
8. Build the gameplay runtime in Three.js.
9. Integrate the character, animations, camera, movement, combat, enemy AI, temporal charge, time shift, floor-state switching, checkpoints, and UI.
10. Export optimized GLB assets.
11. Test the full floor end to end.

Architecture, rubble, props, simple furniture, gates, stairs, columns, walls, arches, balconies, decorative pieces, and destruction geometry can be created directly in Blender. Prefer coherent custom modular geometry over downloading random medieval asset packs.

---

## Map design autonomy

The user intentionally has not supplied a map.

You must design it.

Do not create a generic rectangular dungeon with interchangeable rooms.

The floor should feel like a real internal castle plan while still serving gameplay. Think architecturally about:

- hierarchy of public, military, service, and royal spaces;
- believable corridor connections;
- vertical circulation;
- stairs;
- balconies;
- doors and gates;
- structural thickness;
- sightlines;
- room scale;
- combat arenas;
- choke points;
- shortcuts;
- traversal loops.

Gameplay takes priority over strict historical reconstruction, but spaces must feel deliberately architectural.

Past and Present must be designed together from the start. Do not finish one map and then simply damage it cosmetically to make the second.

---

## Combat implementation rule

Before coding the final animation controller, inspect every supplied animation clip and produce a manifest.

Create something equivalent to:

`src/data/animationManifest.ts` or a generated JSON manifest.

Categorize actual clips into:

- idle;
- locomotion;
- combat locomotion;
- crouch;
- jump/fall/land;
- rolls/dodges;
- blocks/parries;
- light attacks;
- heavy attacks;
- combo candidates;
- shield actions;
- kick/bash;
- reactions;
- knockdown;
- death;
- miscellaneous.

Use the best available clips. Do not assume the pack contains a particular filename.

For locomotion, prefer code-controlled character translation with animations playing in place. If imported Mixamo clips contain unwanted root translation, correct them during the Blender preparation/export stage or at animation preprocessing.

---

## Blender authoring rules

- Source assets are immutable inputs.
- Work in project Blender files, not inside downloaded source files.
- Use collections and clean naming.
- Reuse modular objects.
- Instance repeated geometry where reasonable.
- Use physically sensible scale.
- Keep gameplay collision simpler than visual geometry.
- Generate LOD or simplify meshes where needed for browser performance.
- Avoid needlessly dense subdivision.
- Pack or correctly reference textures.
- Export tested glTF/GLB for Three.js.
- Validate normals, transforms, material slots, animation clips, skeleton, and scale before export.

Maintain a deterministic export path so the runtime does not depend on manual one-off Blender clicks.

---

## Suggested repository organization

The actual repository may differ. Inspect first. If the project has no established structure, prefer:

```text
/
|-- CLAUDE.md
|-- docs/
|   |-- CONTEXT.md
|   |-- LORE.md
|   |-- MECHANICS.md
|   |-- LEVEL_DESIGN_BRIEF.md
|   |-- LEVEL_01_BLUEPRINT.md
|   `-- ASSET_PIPELINE.md
|-- assets/
|   |-- source/
|   |   |-- characters/
|   |   |-- animations/
|   |   |-- materials/
|   |   `-- vegetation/
|   |-- blender/
|   |   |-- characters/
|   |   |-- modular_kit/
|   |   `-- levels/
|   `-- exported/
|       |-- characters/
|       |-- levels/
|       `-- props/
|-- src/
|   |-- game/
|   |-- combat/
|   |-- character/
|   |-- enemies/
|   |-- levels/
|   |-- time/
|   |-- ui/
|   |-- audio/
|   `-- data/
`-- public/
```

Do not reorganize an existing project unnecessarily.

---

## CONTEXT.md discipline

`docs/CONTEXT.md` is the continuity file for future sessions.

Update it:

- after a major design decision;
- after changing architecture;
- after completing a milestone;
- after discovering asset facts;
- after changing controls or mechanics;
- after a meaningful Blender export;
- before ending a long session.

Its status must reflect verified reality, not intent.

When updating it, include:

- what changed;
- exact relevant files;
- what is complete;
- what is partial;
- what is broken;
- tests run and results;
- Blender file/export status;
- next concrete tasks;
- unresolved risks.

Do not mark something complete because code exists. Verify that it works.

---

## Engineering principles

- Build the smallest robust version that supports the intended experience.
- Do not add unrelated systems.
- Avoid loot bloat, crafting, inventory complexity, skill-tree sprawl, or open-world features.
- Prefer readable state machines over over-engineered frameworks.
- Keep systems data-driven where it genuinely helps level iteration.
- Separate visual mesh from collision when useful.
- Instrument performance early.
- Browser performance matters.
- Keep asset loading explicit and debuggable.
- Avoid silent fallback behavior that hides broken assets.

---

## Testing

At minimum verify:

- project builds;
- player loads;
- skeleton and animations play;
- movement and camera work;
- combat hit detection works;
- enemy AI can engage and die;
- temporal gauge charges from combat;
- shift cannot be spammed;
- shift transitions state correctly;
- player cannot shift into invalid solid geometry;
- Past and Present collision match their visuals;
- death/checkpoint/restart works;
- Floor 1 can be completed from start to exit;
- no route can permanently softlock due to depleted temporal charge;
- assets load from a clean browser session;
- performance is acceptable on the target browser.

---

## Autonomous behavior

Do not stop after planning if implementation can proceed.

Do not repeatedly ask the user to choose between reasonable implementation details. Make a strong design choice, document it, implement it, test it, and continue.

Do not use subagents by default. If a genuinely parallel task makes them necessary, use no more than two at once and give each a narrow scope.

If context is becoming constrained, update `docs/CONTEXT.md` before continuing so a fresh session can resume safely.
