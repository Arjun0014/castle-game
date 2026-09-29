# STARTER_PROMPT.md

Copy the prompt below into Claude Code from the root of the game project.

---

You are taking full ownership of the first implementation milestone of this castle game.

First read `CLAUDE.md` and every required document it points to, especially `docs/CONTEXT.md`, `docs/LORE.md`, `docs/MECHANICS.md`, `docs/LEVEL_DESIGN_BRIEF.md`, and `docs/ASSET_PIPELINE.md`.

Do not immediately start modeling.

Start by inspecting the repository and all existing assets. Determine the actual project structure, character files, enemy files, Mixamo animation clips, material library, vegetation assets, Blender files, exports, and current Three.js code. Do not assume filenames. Update `docs/CONTEXT.md` with the verified repository state.

If Blender MCP is available, verify the live Blender connection and inspect the current scene before modifying it.

Then inspect the hero's full animation set and create a proper animation inventory/manifest. The hero has a large sword-and-shield pack and the combat system must actually use its breadth. We want a fast third-person action game with responsive movement, jumping, crouching, rolling/dodging, light attacks, strong attacks, useful combo chains, shield/block/parry behavior where supported, kick/bash behavior where supported, reactions, and good animation blending. Do not reduce this to one basic attack.

Next, independently design Floor 1 from scratch and create `docs/LEVEL_01_BLUEPRINT.md`. I am intentionally not giving you a map. You must think like both a level designer and castle architect. The entire floor is inside the castle and must contain believable rooms, corridors, vertical changes, connections, combat spaces, and traversal. Create two coordinated blueprints for the same floor: Past and Present.

The time mechanic is central. Past is mostly intact and Present is ruined, but neither state may be universally better. Design the floor so both states are required. Use architecture, destruction, doors, stairs, balconies, rubble, openings, mechanisms, height, cover, and route changes to create clever multi-step traversal. Do not repeat the same broken-bridge puzzle. Explicitly validate every required shift, route, collision state, and temporal-charge requirement.

Combat must be frequent. The player primarily recharges the Past/Present shift by fighting and defeating enemies, so place substantial enemy encounters throughout the floor and design the temporal economy so the player cannot softlock themselves with no charge before a required shift. The time shift must remain a deliberate roughly 2 to 3 second hold action and should not be freely spammable.

Self-review and revise the Floor 1 blueprint before production. Do not ask me to design the level for you.

After the blueprint is strong, proceed autonomously with Floor 1 only. Use Blender to create the modular architecture, props, destruction variants, Past and Present geometry, collision-friendly structures, and the floor itself. Use the character, material, and vegetation assets already in the repository rather than replacing them with random downloads. Create routine castle architecture yourself in Blender. Save durable `.blend` files and export optimized GLB assets for Three.js.

Implement the complete playable Floor 1 vertical slice in Three.js: player controller, camera, animation state machine, combat, hit detection, combos, enemy AI, enemy spawning/encounters, temporal charge, 2 to 3 second time-shift channel, Past/Present environment switching, collision, checkpoints, death/restart, minimal UI, state VFX hooks, and level progression.

Keep Floor 2 and Floor 3 out of Blender for now. The complete game will eventually have three floors, with Floor 3 being a much shorter approach into the boss fight, but we only design and implement Floor 1 in this milestone. Do not dilute the session by beginning future floors early.

Work autonomously. Make reasonable design and engineering choices without repeatedly asking me. Test what you build. Do not claim completion without a full end-to-end Floor 1 playthrough and relevant build/runtime checks.

Update `docs/CONTEXT.md` throughout the work and again before ending the session. It must contain verified current status, exact files changed, Blender/export state, tests run, known problems, and the next concrete tasks so a future session can resume without relying on chat history.

Avoid unnecessary subagents. If a truly parallel task benefits from them, use no more than two concurrently and keep their scopes narrow.

Begin with repository inspection and documentation verification now.
