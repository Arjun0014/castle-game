"""Import each enemy source, report armature/rest pose facts and render front/side rest-pose previews."""
import bpy, os, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
ROOT, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
SRC = [
    ("knight", os.path.join(ROOT, "assets/characters/enemy/armored_guard_knight_rig.glb")),
    ("ghost", os.path.join(ROOT, "assets/characters/enemy/night_monster (1).glb")),
    ("zombie", os.path.join(ROOT, "assets/characters/enemy/zombie_monster_slasher_necromorph.glb")),
    ("archer", os.path.join(ROOT, "assets/extracted/characters/enemy/Longbow Aiming Pack/Erika Archer With Bow Arrow.fbx")),
]
report = {}
for name, path in SRC:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.endswith(".glb"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        bpy.ops.import_scene.fbx(filepath=path, use_anim=True)
    sc = bpy.context.scene
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    r = {"meshes": [(m.name, len(m.data.polygons), [s.name for s in m.data.materials]) for m in meshes],
         "actions": [(a.name, list(a.frame_range)) for a in bpy.data.actions]}
    # world bbox of all meshes (evaluated at rest)
    if arm:
        arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for m in meshes:
        ev = m.evaluated_get(dg)
        me = ev.to_mesh()
        pts += [ev.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    r["bbox_min"] = [round(v, 3) for v in mn]
    r["bbox_max"] = [round(v, 3) for v in mx]
    if arm:
        r["armature"] = arm.name
        r["arm_matrix_world_scale"] = [round(v, 4) for v in arm.matrix_world.to_scale()]
        bones = {}
        for b in arm.data.bones:
            h = arm.matrix_world @ b.head_local
            t = arm.matrix_world @ b.tail_local
            bones[b.name] = {"head": [round(v, 3) for v in h], "tail": [round(v, 3) for v in t],
                             "parent": b.parent.name if b.parent else None}
        r["bones"] = bones
    report[name] = r
    # render rest preview front + side
    bpy.ops.mesh.primitive_plane_add(size=20)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_x = 400
    sc.render.resolution_y = 400
    center = (mn + mx) / 2
    size = max((mx - mn).x, (mx - mn).y, (mx - mn).z)
    for label, off in (("front", Vector((0, -1, 0.15))), ("side", Vector((1, 0, 0.15))), ("back", Vector((0, 1, 0.15)))):
        cam.location = center + off.normalized() * size * 2.2
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, "%s_rest_%s.png" % (name, label))
        bpy.ops.render.render(write_still=True)
    if arm:
        arm.data.pose_position = "POSE"
        if arm.animation_data and arm.animation_data.action:
            a = arm.animation_data.action
            f = int((a.frame_range[0] + a.frame_range[1]) / 2)
            sc.frame_set(f)
            cam.location = center + Vector((0.6, -1, 0.15)).normalized() * size * 2.2
            cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(OUT, "%s_anim.png" % name)
            bpy.ops.render.render(write_still=True)
json.dump(report, open(os.path.join(OUT, "enemies.json"), "w"), indent=1)
