"""Per-clip facing/yaw analysis: facing direction at start/end vs travel direction."""
import bpy, os, sys, math, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
PACK, OUT = argv[0], argv[1]


def facing(arm):
    ls = arm.matrix_world @ arm.pose.bones["mixamorig:LeftShoulder"].matrix.translation
    rs = arm.matrix_world @ arm.pose.bones["mixamorig:RightShoulder"].matrix.translation
    lat = (ls - rs)
    lat.z = 0
    fwd = Vector((0, 0, 1)).cross(lat)  # left x up -> forward
    fwd.normalize()
    return fwd


res = {}
for clip in sorted(os.listdir(PACK)):
    if not clip.endswith(".fbx") or clip.startswith("Maria"):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(PACK, clip), use_anim=True)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    act = arm.animation_data.action
    f0, f1 = [int(x) for x in act.frame_range]
    sc = bpy.context.scene
    sc.frame_set(f0)
    fa = facing(arm)
    h0 = arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].matrix.translation
    sc.frame_set(f1)
    fb = facing(arm)
    h1 = arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].matrix.translation
    yaw = math.degrees(math.atan2(fa.x * fb.y - fa.y * fb.x, fa.dot(fb)))
    d = h1 - h0
    d.z = 0
    fwd_comp = d.dot(fa)
    right = Vector((fa.y * -1, fa.x, 0)) * -1  # right = forward x up
    right = fa.cross(Vector((0, 0, 1)))
    res[clip] = {"facing_start": [round(fa.x, 2), round(fa.y, 2)], "yaw_change_deg": round(yaw, 1),
                 "disp_forward": round(fwd_comp, 3), "disp_right": round(d.dot(right), 3)}
json.dump(res, open(OUT, "w"), indent=1)
