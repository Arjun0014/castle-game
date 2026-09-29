# ASSET_PIPELINE.md

# 1. Current External Inputs

The user has already added:

- character asset(s);
- a main sword-and-shield character with a large Mixamo animation pack;
- material/texture assets;
- vegetation assets.

Exact paths and formats must be inspected in the real repository before work.

Do not assume the suggested folder structure already exists.

---

# 2. What Claude Should Create

Claude + Blender can create most non-character game content.

Expected Blender-created content includes:

- castle walls;
- floors;
- ceilings;
- arches;
- columns;
- stairs;
- railings;
- balconies;
- gates;
- doors;
- corridors;
- room shells;
- rubble;
- collapsed walls;
- broken floors;
- damaged stairs;
- beams;
- simple furniture;
- tables;
- benches;
- shelves;
- crates;
- barrels;
- weapon racks;
- simple chandeliers/torches;
- structural props;
- Crownheart-supporting architecture;
- collision meshes.

Do not waste time hunting for unrelated medieval packs if custom modular geometry can be built quickly and coherently.

---

# 3. Source Asset Policy

Treat downloaded/imported assets as immutable source files.

Recommended conceptual separation:

```text
assets/source/      # never destructively edited
assets/blender/     # working Blender files and processed assets
assets/exported/    # runtime GLB assets
```

If the existing repository has a different convention, follow it and document the real paths in `CONTEXT.md`.

---

# 4. Materials

The user has supplied PBR materials.

Claude must inventory each material.

For every set identify:

- base color / diffuse;
- normal map;
- packed AO/Roughness/Metallic map if present;
- roughness;
- metallic;
- displacement/height;
- resolution;
- OpenGL vs DirectX normal convention.

For the Blender -> glTF -> Three.js pipeline, OpenGL normal maps are preferred.

Use the material library consistently.

Do not assign a unique 4K material to every object.

Reuse and tile materials.

---

# 5. Past Material Language

Past should favor:

- cleaner castle stone;
- intact masonry;
- dark finished wood;
- forged iron;
- bronze/brass accents;
- richer cloth;
- polished or maintained surfaces;
- warm torch/fire lighting.

Past is intact, not pristine.

It occurs near the kingdom's final days, so controlled wear and military stress are valid.

---

# 6. Present Material Language

Present should favor:

- weathered/cracked stone;
- moss;
- aged wood;
- rust/oxidation;
- dirt;
- dust;
- faded fabric;
- water staining;
- vegetation;
- colder natural light.

Present must differ in geometry as well as surface treatment.

Do not create Present by applying a moss texture to the unchanged Past map.

---

# 7. Vegetation

Use supplied vegetation intentionally.

Most vegetation belongs in the Present.

Useful placements:

- cracks;
- collapsed roofs;
- windows;
- wall seams;
- damp lower areas;
- rubble;
- broken internal courtyards;
- long-abandoned passages.

Avoid excessive foliage that makes the interior read as a forest.

Use instancing and reasonable density for browser performance.

---

# 8. Character Pipeline

The main character and enemy characters should remain externally sourced where available.

Preferred runtime format:

- GLB / glTF.

Blender may be used as the preparation stage for:

- orientation;
- scale;
- skeleton inspection;
- animation cleanup;
- weapon attachment;
- texture relinking;
- material cleanup;
- root motion correction;
- clip naming;
- export.

---

# 9. Mixamo Animation Pipeline

Do not assume the pack automatically arrives in the ideal runtime structure.

Claude should inspect actual files and determine:

- whether one FBX contains character + animation;
- whether clips are separate files;
- whether the same skeleton is used across clips;
- whether sword/shield meshes are embedded;
- whether locomotion is in-place;
- whether clip frame rates are consistent.

Build one clean runtime character asset strategy.

Possible valid strategies include:

## Option A

One GLB with:

- player mesh;
- skeleton;
- materials;
- all useful animation clips.

## Option B

One base player GLB plus processed animation clips merged or loaded through a dedicated asset pipeline.

Prefer simplicity for the competition.

---

# 10. Weapon Attachment

If sword/shield objects are not correctly integrated:

- attach sword to the correct right-hand bone;
- attach shield to the correct left-hand/forearm bone;
- verify orientation across every attack;
- export with transforms cleanly applied.

Do not duplicate weapon meshes inside every animation asset.

---

# 11. Modular Castle Kit

Before building the full floor, create a coherent reusable kit.

Potential categories:

- straight wall;
- wall opening;
- doorway;
- arch;
- corner;
- column;
- floor;
- ceiling;
- straight stairs;
- wider ceremonial stairs;
- railing;
- balcony edge;
- door;
- gate;
- broken variants;
- rubble variants.

Claude chooses the exact kit based on the Floor 1 blueprint.

Do not create modules with arbitrary dimensions.

Use a consistent grid / dimensional logic that still allows variation.

---

# 12. Past / Present Variant Strategy

Prefer shared architectural anchors and variant pieces.

Conceptually:

```text
Shared footprint
|-- stable structural anchors
|-- PAST state pieces
`-- PRESENT state pieces
```

Examples:

```text
STAIR_A
STAIR_A_PAST_INTACT
STAIR_A_PRESENT_COLLAPSED
```

or state-specific collections.

The exact Blender organization is up to Claude, but it should make state visibility/export deterministic.

---

# 13. Blender Collections

A useful pattern is:

```text
FLOOR_01
|-- SHARED
|-- PAST
|-- PRESENT
|-- COLLISION_PAST
|-- COLLISION_PRESENT
|-- PROPS_SHARED
|-- PROPS_PAST
|-- PROPS_PRESENT
|-- VEGETATION_PRESENT
`-- EXPORT_HELPERS
```

Adjust if a better organization emerges.

Document any final convention in `CONTEXT.md`.

---

# 14. Collision

Visual detail and collision detail should not be identical by default.

Use simpler collision for:

- walls;
- stairs;
- floors;
- large rubble;
- gates;
- traversable structures.

Avoid triangle-mesh collision on every decorative prop.

Collision must change with the active temporal state where geometry changes.

---

# 15. GLB Export

The runtime should use optimized glTF/GLB.

Before export verify:

- scale;
- transforms;
- normals;
- materials;
- texture references;
- active animation clips;
- skeleton;
- no unintended hidden high-poly objects;
- no unused cameras/lights unless intentionally exported.

Where practical, create scripted or repeatable exports.

---

# 16. Runtime Asset Partitioning

Do not automatically put the entire game into one giant GLB.

For Floor 1, Claude should choose a partition that balances:

- load time;
- draw calls;
- state switching;
- culling;
- iteration.

Likely categories may include:

- shared environment;
- Past-specific environment;
- Present-specific environment;
- reusable props;
- characters.

The exact split should be based on measured performance.

---

# 17. Texture Performance

Browser constraints matter.

Guidelines:

- hero surfaces: 2K, occasionally 4K if clearly justified;
- ordinary large surfaces: generally 1K to 2K tiled;
- small props: generally 1K;
- avoid many unique 4K maps;
- use packed texture maps where practical;
- consider KTX2/Basis compression in the web build once the pipeline is stable.

---

# 18. Blender MCP Usage

When Blender MCP is available, Claude should use it to:

- inspect the current scene;
- create modular geometry;
- duplicate/instance pieces;
- create collections;
- assign existing materials;
- create damaged variants;
- place props;
- build floor geometry;
- run validation scripts;
- export GLB.

Do not ask the user to manually model routine architecture that Claude can create.

Use Blender files as durable project artifacts, not only ephemeral generated scenes.
