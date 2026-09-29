# MECHANICS.md

# 1. Game Feel Target

The game is a fast third-person sword-and-shield action game.

The player should feel capable, mobile, and aggressive.

The core loop is:

```text
Explore castle
-> encounter enemies
-> fight and build temporal charge
-> discover blocked route
-> choose/earn a time shift
-> transform the space
-> traverse a new route
-> fight again
-> repeat with increasing complexity
```

The game must not become a slow environmental-puzzle walking simulator.

Time manipulation supports the action loop rather than replacing it.

---

# 2. Player Movement

Required capabilities:

- third-person camera;
- analog-feeling WASD movement;
- walk/run;
- sprint;
- jump;
- falling;
- landing;
- crouch;
- roll or dodge;
- combat-facing/strafe behavior when appropriate;
- stair traversal;
- robust slope handling;
- ledge-safe movement where practical.

Exact values should be tuned in playtesting.

Movement must be responsive even while high-quality animations are used.

Prefer code-controlled world translation over relying on Mixamo root motion for basic locomotion.

---

# 3. Camera

Target:

- third-person over-the-shoulder or slightly elevated chase camera;
- mouse-controlled yaw/pitch;
- collision handling so the camera does not remain inside walls;
- tighter framing during combat if useful;
- readable view of nearby enemies and castle traversal.

Do not make the camera so close that corridor combat becomes unreadable.

---

# 4. Combat Actions

The exact key bindings may change, but the system must support the following concepts.

## Light attack

- fast;
- low commitment;
- chainable;
- forms the basis of standard combos.

## Heavy / strong attack

- slower;
- higher damage or stagger;
- can function as a finisher;
- should have meaningful commitment.

## Combo system

Use the actual Mixamo clips to build several visually distinct chains.

At minimum, the implementation should support:

- multi-hit light chain;
- light-to-heavy finisher;
- heavy opener or charged attack if a suitable animation exists;
- at least one contextual kick/bash route if supported.

Do not hard-code combo design before inspecting the animation pack.

Use input buffering and explicit combo windows so controls feel responsive.

## Block / shield

If suitable animations exist:

- hold to block;
- reduce or negate frontal damage;
- play impact reaction;
- optionally allow a timed parry window.

Do not build an elaborate stamina simulation unless testing shows it is needed.

## Kick or shield bash

Useful for:

- stagger;
- creating space;
- knocking enemies toward stairs/edges;
- breaking an enemy guard;
- environmental combat.

## Roll / dodge

- fast evasive repositioning;
- animation-driven presentation;
- brief invulnerability may be used if needed;
- must not be infinitely spammable if it trivializes combat.

## Crouch

Crouch exists primarily because the animation set supports broader movement variety and because castle traversal may use low clearances.

Do not turn the game into a stealth game unless a later design explicitly requires it.

---

# 5. Animation System

Claude must inspect the actual supplied animation pack.

Build an animation manifest rather than guessing names.

Use Three.js `AnimationMixer` and blended actions, or an equivalent robust controller.

The controller should support:

- locomotion blend/state;
- combat locomotion;
- attack actions;
- combo transitions;
- reaction interruption rules;
- dodge;
- block;
- jump/fall/land;
- crouch;
- death;
- timeline-channel action.

Important:

- avoid foot sliding where practical;
- crossfade states;
- do not allow impossible state transitions;
- preserve responsive controls;
- normalize or remove unwanted locomotion root translation during asset preprocessing if needed.

---

# 6. Hit Detection

Recommended approach:

- weapon hitbox, swept segment, or capsule during active attack frames;
- attack data specifies active frames/windows;
- one hit per target per attack unless intentionally multi-hit;
- enemy hurt volumes are simpler than visible meshes;
- impact feedback includes animation reaction and optional VFX/audio hooks.

Avoid permanent raycasting from the camera as the sole melee hit system.

---

# 7. Enemy Density

Combat is one of the primary recharge mechanisms for time shifting, so levels need meaningful enemy populations.

Use:

- room encounters;
- corridor patrols;
- mixed groups;
- reinforcement triggers where appropriate;
- elite guards at key transitions.

Do not fill every meter with enemies.

The desired rhythm is:

```text
movement
-> fight
-> short read/decision
-> traversal
-> fight
-> temporal puzzle
-> fight
```

The player should regularly get a chance to use their broader combat move set.

---

# 8. Enemy Archetypes

Final roster depends on available character assets.

The system should support archetypes such as:

## Basic sword guard

- standard melee pressure;
- readable attacks;
- common enemy.

## Shield/heavy guard

- slower;
- resistant to frontal light spam;
- encourages kick, heavy attack, flank, or parry.

## Ranged enemy

- creates movement pressure;
- useful on balconies, corridors, or vertical spaces.

## Elite temporal warden

- higher aggression;
- stronger attacks;
- potentially interacts with the temporal system;
- used sparingly.

Do not create a large roster before the basic combat is satisfying.

---

# 9. Enemy AI

Minimum state structure:

- idle/patrol;
- investigate or acquire target;
- approach/chase;
- maintain combat spacing;
- attack;
- defensive reaction if archetype supports it;
- hit/stagger;
- knockdown if used;
- recover;
- death.

Group behavior should avoid all enemies occupying the exact same point.

Use attack-slot or spacing logic so groups feel like a fight rather than a clipping swarm.

---

# 10. Temporal Charge

The Past/Present shift is powered by a dedicated temporal gauge.

## Primary source

Combat.

Enemy defeat should grant a significant amount of temporal charge.

Damage dealt, parry, combo completion, elite defeat, or other combat events may provide smaller amounts if testing benefits from it.

The exact numeric economy is for Claude to tune during Floor 1.

## Design goal

The player should usually need to engage enemies rather than bypass everything and shift repeatedly.

The player should also understand why they are fighting.

The lore calls this released energy **Temporal Resonance**.

---

# 11. Time Shift

## Activation

- requires enough temporal charge;
- hold input for approximately 2 to 3 seconds;
- channel animation plays;
- transition VFX/audio build during the hold;
- if the shift completes, the active castle state changes.

The hold creates risk during combat.

Claude should decide whether taking a heavy hit interrupts the channel after playtesting.

## State change

When a shift succeeds:

- player world position is preserved;
- player orientation is preserved;
- player velocity may be preserved only if it produces stable traversal;
- Past environment is swapped for Present or vice versa;
- state-specific collision changes at the correct point in the transition;
- state-specific enemies/props/hazards activate as designed.

## Destination validity

Never let the player casually shift into the inside of a solid wall.

The implementation should combine:

- careful level design;
- target-state occupancy checks;
- clear denial feedback where a shift is invalid;
- small corrective relocation only when safe and predictable.

Do not use large invisible teleport corrections that break spatial understanding.

---

# 12. Charge Softlock Rule

This is mandatory.

A player must never reach a required time shift with insufficient charge and no legal way to obtain more.

The Floor 1 blueprint must explicitly verify temporal economy.

Claude may solve this through one or more of:

- sufficient mandatory enemies before a required shift;
- persistent unspent charge;
- controlled reinforcement encounters;
- recoverable Echo groups;
- checkpoint restoration policy;
- an emergency temporal source designed into the level.

The solution must still preserve the principle that combat is the primary recharge source.

Do not simply add passive unlimited regeneration because it would undermine the intended loop.

---

# 13. Past / Present Traversal

The two states must both create opportunities and obstacles.

Common design categories include, but are not limited to:

- intact bridge vs collapsed gap;
- intact staircase vs rubble ramp;
- locked Past door vs destroyed Present wall;
- working lift/mechanism vs ruined shaft;
- Past banner/rope/structure usable for traversal vs absent Present equivalent;
- Present roof collapse exposing a vertical route;
- Past furniture or balcony giving height;
- Present destruction producing a shortcut;
- different enemy ownership of the same room;
- different cover geometry during combat.

Claude should create original sequences rather than repeating one pattern.

---

# 14. Puzzle Escalation

## Early Floor 1

Teach:

- identify the alternate-state route;
- shift once;
- continue.

## Mid Floor 1

Require:

- use current-state geometry to reach a position;
- shift;
- use alternate geometry;
- possibly return later.

## Late Floor 1

Combine:

- enemy encounter;
- temporal charge requirement;
- vertical traversal;
- multiple state-dependent route elements;
- combat arena geometry that changes meaningfully.

The game should remain readable.

Avoid obscure logic that requires trial-and-error deaths.

---

# 15. Combat and Time Together

Later encounters should make the state system tactically useful.

Examples of design principles:

- cover differs between states;
- a balcony exists in one state;
- a collapsed edge creates a knock-off opportunity in another;
- an enemy reinforcement route changes;
- the player may shift to escape a poor position;
- a room's geometry changes the value of ranged and melee enemies.

Do not make every fight require a shift.

Combat must still be satisfying without gimmicks.

---

# 16. Health, Death, Checkpoints

Use a clear health system.

Checkpoint behavior should restore a fair combat state and temporal economy.

A checkpoint should save enough state to avoid repeating excessive content after death.

At minimum restore:

- player position;
- health policy;
- current temporal state or a deliberate checkpoint state;
- temporal charge policy;
- encounter state according to the chosen checkpoint model.

The game should restart deterministically.

---

# 17. Progression

Keep progression light.

Do not build a loot RPG.

Potential progression may include:

- additional combo route;
- stronger kick/bash;
- improved dodge;
- slightly faster temporal channel;
- larger temporal capacity;
- special royal-blood technique.

Only add progression if it improves the short competition experience.

---

# 18. UI

Minimum UI:

- health;
- temporal charge;
- clear shift-ready state;
- current Past/Present indication;
- boss health when applicable;
- interaction prompt;
- minimal objective messaging if needed.

Avoid a cluttered RPG HUD.

A minimap is not required.

---

# 19. Audio / VFX Hooks

Even if full audio is added later, architecture should support:

Combat:
- sword swing;
- metal hit;
- shield hit;
- body hit;
- roll;
- footsteps;
- enemy reactions.

Temporal:
- channel rise;
- low resonance;
- reversed debris/stone texture;
- completion impact.

VFX:
- weapon trails;
- impact sparks/dust;
- temporal particles;
- geometry transition;
- controlled ghosting;
- state color/light change.

---

# 20. Success Criteria for Floor 1

Floor 1 is mechanically successful only when:

- movement feels responsive;
- at least several combat actions are genuinely useful;
- combo inputs work;
- enemies pressure the player;
- charge is earned naturally through fights;
- the player understands when a shift is available;
- the shift feels powerful and readable;
- Past and Present routes are meaningfully different;
- puzzles cannot softlock;
- the floor can be completed from beginning to end;
- the player experiences both combat and traversal as core, not as isolated systems.
