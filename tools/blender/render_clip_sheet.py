"""Render a pose contact sheet for every hero clip (visual classification aid).

Run:
  blender --background --factory-startup --python tools/blender/render_clip_sheet.py -- <pack_dir> <out_dir>
Writes <out_dir>/<clip>_<i>.png, 8 frames per clip, camera tracking the hips from a 3/4 front view.
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
PACK, OUT = argv[0], argv[1]
os.makedirs(OUT, exist_ok=True)
FRAMES_PER_CLIP = 8

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(PACK, "Maria WProp J J Ong.fbx"), use_anim=False)
hero = next(o for o in bpy.data.objects if o.type == "ARMATURE")

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 260
scene.render.resolution_y = 300
scene.render.film_transparent = False
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.world = bpy.data.worlds.new("w") if not scene.world else scene.world

bpy.ops.mesh.primitive_plane_add(size=40)
ground = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.diffuse_color = (0.25, 0.3, 0.35, 1)
ground.data.materials.append(gm)

cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

clips = sorted(f for f in os.listdir(PACK) if f.lower().endswith(".fbx") and not f.startswith("Maria"))
for clip in clips:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(PACK, clip), use_anim=True)
    new = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new if o.type == "ARMATURE")
    act = src.animation_data.action
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    if hero.animation_data is None:
        hero.animation_data_create()
    hero.animation_data.action = act
    if hasattr(hero.animation_data, "action_slot") and act.slots:
        hero.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    for i in range(FRAMES_PER_CLIP):
        f = f0 + (f1 - f0) * i / (FRAMES_PER_CLIP - 1)
        scene.frame_set(int(round(f)))
        hips = hero.matrix_world @ hero.pose.bones["mixamorig:Hips"].matrix.translation
        target = Vector((hips.x, hips.y, 0.9))
        cam.location = target + Vector((2.2, -3.0, 0.4))
        d = target - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT, "%s_%d.png" % (clip[:-4].replace(" ", "_"), i))
        bpy.ops.render.render(write_still=True)
    print("rendered", clip)
