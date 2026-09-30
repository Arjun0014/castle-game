"""Deterministic title-screen animation pack: the hero's rig + the menu clips -> hero_menu.glb, heroMenuAnimations.json.

Run (headless):
  blender --background --factory-startup --python tools/blender/build_hero_menu.py
  (npm run assets:heromenu)

The title screen's heroine (Game.menuScene + character/MenuIdle.ts) cycles restrained standing actions. Those clips live
in their own animation-only GLB (armature nodes + animations, no mesh, no textures) so gameplay's hero.glb is untouched:
the menu loads it with the title and releases it when play begins. Tracks bind to hero.glb's bones by name (same
65-bone mixamorig rig, same export options as tools/blender/build_hero.py).

Clip choice (session 15, from build/analysis/menu/sheet_*.png + inspect.json; roles in hero_clip_map.json menuClips):
every clip stands in place (root travel <= 1 cm, yaw change <= 0.3 deg). Root policy "loop": the tiny first->last hips
drift is removed linearly, the hips' own sway is kept, so the feet stay planted.
"""
import bpy
import json
import os
from mathutils import Vector
from bpy_extras import anim_utils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = os.path.join(ROOT, "assets", "extracted", "characters", "hero", "Sword and Shield Pack", "Maria WProp J J Ong.fbx")
CLIP_MAP = os.path.join(ROOT, "tools", "blender", "hero_clip_map.json")
OUT_GLB = os.path.join(ROOT, "public", "assets", "characters", "hero_menu.glb")
OUT_MANIFEST = os.path.join(ROOT, "src", "data", "heroMenuAnimations.json")
HIPS = "mixamorig:Hips"
FPS = 30.0

clips = json.load(open(CLIP_MAP))["menuClips"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = int(FPS)


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=False, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


def fcurves_of(action):
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves


if not os.path.exists(BASE):
    raise RuntimeError("Missing " + BASE + " (run python tools/extract_assets.py)")
objs = import_fbx(BASE)
hero = next(o for o in objs if o.type == "ARMATURE")
hero.name = "Hero"
hero.data.name = "HeroSkeleton"
# the pack carries the rig only: drop the meshes (hero.glb has them) and the bind-pose action
for o in objs:
    if o.type == "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
if hero.animation_data and hero.animation_data.action:
    a = hero.animation_data.action
    hero.animation_data.action = None
    bpy.data.actions.remove(a)
if hero.animation_data is None:
    hero.animation_data_create()
bpy.context.view_layer.update()
M = hero.matrix_world.to_3x3() @ hero.data.bones[HIPS].matrix_local.to_3x3()
Minv = M.inverted()
FWD, RIGHT = Vector((0, -1, 0)), Vector((-1, 0, 0))


def world_bone(name):
    return hero.matrix_world @ hero.pose.bones[name].matrix.translation


manifest = {"_generatedBy": "tools/blender/build_hero_menu.py", "fps": FPS, "clips": {}}
for info in clips:
    path = os.path.join(ROOT, info["dir"], info["file"])
    if not os.path.exists(path):
        raise RuntimeError("Missing menu clip: " + path)
    new = import_fbx(path)
    src = next(o for o in new if o.type == "ARMATURE")
    if {b.name for b in src.data.bones} != {b.name for b in hero.data.bones}:
        raise RuntimeError("Skeleton mismatch in " + info["file"])
    act = src.animation_data.action
    src.animation_data.action = None
    for o in new:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data and data.users == 0 and isinstance(data, bpy.types.Armature):
            bpy.data.armatures.remove(data)
        elif data and data.users == 0 and isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
    act.name = info["id"]
    act.use_fake_user = True
    hero.animation_data.action = act
    hero.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(round(x)) for x in act.frame_range]
    frames = list(range(f0, f1 + 1))
    hips, feet = [], []
    for f in frames:
        scene.frame_set(f)
        hips.append(world_bone(HIPS).copy())
        feet.append((world_bone("mixamorig:LeftFoot").copy(), world_bone("mixamorig:RightFoot").copy()))
    n = len(frames)
    h0, h1 = hips[0], hips[-1]
    # root policy "loop": remove the linear first->last horizontal drift only (the hips' own sway stays)
    fcs = sorted([fc for fc in fcurves_of(act) if fc.data_path == 'pose.bones["%s"].location' % HIPS], key=lambda fc: fc.array_index)
    values = [[fc.evaluate(f) for f in frames] for fc in fcs]
    for i in range(n):
        k = i / max(1, n - 1)
        dl = Minv @ Vector(((h1.x - h0.x) * k, (h1.y - h0.y) * k, 0.0))
        for axis in range(3):
            values[axis][i] -= dl[axis]
    for axis, fc in enumerate(fcs):
        fc.keyframe_points.clear()
        fc.keyframe_points.add(n)
        for i, f in enumerate(frames):
            kp = fc.keyframe_points[i]
            kp.co = (f, values[axis][i])
            kp.interpolation = "LINEAR"
        fc.update()
    # how far each foot wanders over the clip (planted feet stay within a few cm)
    foot_wander = [round(max((p[j] - feet[0][j]).length for p in feet), 3) for j in (0, 1)]
    manifest["clips"][info["id"]] = {
        "source": info["file"], "role": info["role"], "duration": round((f1 - f0) / FPS, 4), "frames": n,
        "loop": info.get("loop", False),
        "drift": [round((h1 - h0).dot(FWD), 3), round((h1 - h0).dot(RIGHT), 3)],
        "hipsHeight": [round(min(h.z for h in hips), 3), round(max(h.z for h in hips), 3)],
        "footWander": foot_wander,
    }
    print("menu clip", info["file"], "->", info["id"], manifest["clips"][info["id"]])

hero.animation_data.action = None
for pb in hero.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
scene.frame_set(0)
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
json.dump(manifest, open(OUT_MANIFEST, "w"), indent=1)

bpy.ops.object.select_all(action="DESELECT")
hero.select_set(True)
bpy.context.view_layer.objects.active = hero
# the same animation options as hero.glb (build_hero.py) so node names and rest frames match its bones
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True,
    export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
    export_optimize_animation_size=True, export_anim_single_armature=True,
    export_reset_pose_bones=True, export_rest_position_armature=True,
    export_skins=True, export_morph=False, export_def_bones=False, export_leaf_bone=False,
    export_yup=True, export_apply=False, export_extras=False, export_cameras=False, export_lights=False,
)
print("HERO MENU BUILD OK", OUT_GLB, os.path.getsize(OUT_GLB))
