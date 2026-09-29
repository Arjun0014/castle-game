"""Kinematic inspection + contact frames for a Mixamo animation pack (hero or boss).

Run (headless):
  blender --background --factory-startup --python tools/blender/inspect_pack.py -- <character_fbx> <out_json> <frames_dir> <clip.fbx | clip_dir> [...]

Per clip it records what a gameplay mapping needs, measured from the motion (not from file names):
  duration, frames, loop closure (max bone rotation difference first/last frame), root (Hips) travel in character
  space [forward, right], hips height range, body yaw change (pelvis orientation), right-hand weapon tip speed peaks
  with the tip position / swing direction at each peak, left/right hand speed peaks (casts, two-handed grip),
  hand separation (two-handed grip fraction), foot peaks (kicks) — and renders 8 contact frames per clip
  (3/4 front view tracking the hips) for the visual review sheet (tools/contact_sheet.py).

The character faces -Y in Blender (Mixamo import): forward = -Y, right = -X.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
CHAR, OUT_JSON, FRAMES = argv[0], argv[1], argv[2]
CLIPS = []
for p in argv[3:]:
    if os.path.isdir(p):
        CLIPS += [os.path.join(p, f) for f in sorted(os.listdir(p))
                  if f.lower().endswith(".fbx") and os.path.join(p, f) != CHAR and not f.startswith(("Maria", "Nightshade"))]
    else:
        CLIPS.append(p)
os.makedirs(FRAMES, exist_ok=True)
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
N_FRAMES = 8
FPS = 30.0
FWD = Vector((0, -1, 0))
RIGHT = Vector((-1, 0, 0))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = int(FPS)


def import_fbx(path, anim=True):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=anim, ignore_leaf_bones=False, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


objs = import_fbx(CHAR, anim=False)
arm = next(o for o in objs if o.type == "ARMATURE")
meshes = [o for o in objs if o.type == "MESH"]
sword = next((o for o in meshes if "sword" in o.name.lower()), None)
if arm.animation_data and arm.animation_data.action:
    arm.animation_data.action = None
bone_names = {b.name for b in arm.data.bones}
bpy.context.view_layer.update()


def P(name):
    return arm.matrix_world @ arm.pose.bones[name].matrix.translation


# weapon tip: sword blade far end in RightHand space (hero) or the middle finger tip (boss)
tip_local = None
if sword:
    rh = arm.data.bones["mixamorig:RightHand"]
    inv = arm.matrix_world.inverted()
    pts = [sword.matrix_world @ v.co for v in sword.data.vertices]
    hand = rh.head_local
    far = max(pts, key=lambda p: (inv @ p - hand).length)
    tip_local = rh.matrix_local.inverted() @ (inv @ far)


def tip_world():
    if tip_local is not None:
        return arm.matrix_world @ arm.pose.bones["mixamorig:RightHand"].matrix @ tip_local
    nm = "mixamorig:RightHandMiddle4" if "mixamorig:RightHandMiddle4" in bone_names else "mixamorig:RightHand"
    return P(nm)


def to_char(d):
    return [round(d.dot(FWD), 3), round(d.dot(RIGHT), 3), round(d.z, 3)]


def yaw_of_pelvis():
    l, r = P("mixamorig:LeftUpLeg"), P("mixamorig:RightUpLeg")
    lat = Vector((r.x - l.x, r.y - l.y, 0))  # points to the character's right
    # facing = lateral rotated -90 deg about Z (right x up = forward in a right-handed Z-up frame -> forward = up x right)
    f = Vector((0, 0, 1)).cross(lat)
    return math.atan2(-f.x, -f.y)  # 0 = facing -Y


def peaks(series, dt, min_speed, rel=0.55, min_sep=0.2, win_rel=0.45):
    if not series:
        return []
    gmax = max(series)
    thr = max(min_speed, gmax * rel)
    found = []
    for i in range(1, len(series) - 1):
        s = series[i]
        if s >= thr and s >= series[i - 1] and s >= series[i + 1]:
            t = (i + 1) * dt
            if found and t - found[-1]["t"] < min_sep:
                if s > found[-1]["speed"]:
                    found[-1] = {"i": i, "t": t, "speed": s}
                continue
            found.append({"i": i, "t": t, "speed": s})
    out = []
    for p in found:
        lo = p["i"]
        while lo > 0 and series[lo - 1] > p["speed"] * win_rel:
            lo -= 1
        hi = p["i"]
        while hi < len(series) - 1 and series[hi + 1] > p["speed"] * win_rel:
            hi += 1
        out.append({"i": p["i"], "t": round(p["t"], 3), "speed": round(p["speed"], 2),
                    "window": [round(lo * dt + dt, 3), round(hi * dt + dt, 3)], "lo": lo, "hi": hi})
    return out


# ---- render setup (workbench, 3/4 front, hips tracking)
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 200
scene.render.resolution_y = 250
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
bpy.ops.mesh.primitive_plane_add(size=60)
ground = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.diffuse_color = (0.25, 0.3, 0.35, 1)
ground.data.materials.append(gm)
# 1 m grid marks so root travel reads in the frames
for gx in range(-6, 7):
    for gy in range(-6, 7):
        bpy.ops.mesh.primitive_plane_add(size=0.06, location=(gx, gy, 0.002))
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 40
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
height = max(m.dimensions.y for m in meshes) if meshes else 1.8

report = {"character": os.path.basename(CHAR), "bones": len(bone_names), "height": round(height, 3), "clips": {}}
if arm.animation_data is None:
    arm.animation_data_create()

for path in CLIPS:
    name = os.path.splitext(os.path.basename(path))[0]
    new = import_fbx(path)
    src = next(o for o in new if o.type == "ARMATURE")
    clip_bones = {b.name for b in src.data.bones}
    act = src.animation_data.action
    src.animation_data.action = None
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(round(x)) for x in act.frame_range]
    frames = list(range(f0, f1 + 1))
    S = []
    for f in frames:
        scene.frame_set(f)
        s = {"hips": P("mixamorig:Hips").copy(), "tip": tip_world().copy(), "rh": P("mixamorig:RightHand").copy(),
             "lh": P("mixamorig:LeftHand").copy(), "rf": P("mixamorig:RightFoot").copy(), "lf": P("mixamorig:LeftFoot").copy(),
             "head": P("mixamorig:Head").copy(), "yaw": yaw_of_pelvis(),
             "rot": {pb.name: pb.matrix_basis.to_quaternion().copy() for pb in arm.pose.bones if pb.name != "mixamorig:Hips"}}
        S.append(s)
    n = len(S)
    dur = (f1 - f0) / FPS
    dt = 1.0 / FPS
    h0 = S[0]["hips"]
    yaw0 = S[0]["yaw"]

    def char_space(v, yaw=yaw0):
        # express a world delta in the clip-start character frame
        f = Vector((-math.sin(yaw), -math.cos(yaw), 0))  # yaw 0 = facing -Y
        r = Vector((f.y, -f.x, 0))                        # forward x up
        return [round(v.dot(f), 3), round(v.dot(r), 3), round(v.z, 3)]

    # loop closure: largest local rotation difference between first and last frame (deg)
    closure = 0.0
    for bn, q in S[0]["rot"].items():
        q2 = S[-1]["rot"][bn]
        closure = max(closure, math.degrees(q.rotation_difference(q2).angle))
    yaw_series = [s["yaw"] for s in S]
    unwrapped = [yaw_series[0]]
    for y in yaw_series[1:]:
        d = y - unwrapped[-1]
        d = (d + math.pi) % (2 * math.pi) - math.pi
        unwrapped.append(unwrapped[-1] + d)

    def spd(key):
        out = []
        for i in range(1, n):
            a = S[i - 1][key] - S[i - 1]["hips"]
            b = S[i][key] - S[i]["hips"]
            out.append((b - a).length * FPS)
        return out

    tip = spd("tip")
    rh_s = spd("rh")
    lh_s = spd("lh")
    foot = [max(a, b) for a, b in zip(spd("rf"), spd("lf"))]
    sep = [(s["lh"] - s["rh"]).length for s in S]
    two_hand = sum(1 for d in sep if d < 0.22) / n
    tip_peaks = peaks(tip, dt, 6.0)
    for p in tip_peaks:
        i = p["i"] + 1
        s = S[i]
        rel = s["tip"] - h0
        vel = (S[min(n - 1, i + 1)]["tip"] - S[i - 1]["tip"]) * (FPS / 2)
        horiz = math.hypot(vel.x, vel.y)
        p["tipAtPeak"] = char_space(rel)
        p["dir"] = "horizontal" if horiz > abs(vel.z) * 1.4 else ("down" if vel.z < 0 else "up") if abs(vel.z) > horiz * 1.4 else ("diag-down" if vel.z < 0 else "diag-up")
        # angular sweep of the tip around the hips over the window
        a0 = S[p["lo"] + 1]["tip"] - S[p["lo"] + 1]["hips"]
        a1 = S[min(n - 1, p["hi"] + 1)]["tip"] - S[min(n - 1, p["hi"] + 1)]["hips"]
        ang0, ang1 = math.atan2(a0.x, a0.y), math.atan2(a1.x, a1.y)
        p["sweepDeg"] = round(abs(math.degrees((ang1 - ang0 + math.pi) % (2 * math.pi) - math.pi)), 1)
        # forward reach of the tip during the window, from the clip-start hips (includes root motion)
        p["reachFwd"] = max(char_space(S[j + 1]["tip"] - h0)[0] for j in range(p["lo"], min(n - 1, p["hi"] + 1)))
        p["tipHeight"] = [round(min(S[j + 1]["tip"].z for j in range(p["lo"], min(n - 1, p["hi"] + 1))), 2),
                          round(max(S[j + 1]["tip"].z for j in range(p["lo"], min(n - 1, p["hi"] + 1))), 2)]
        for k in ("i", "lo", "hi"):
            p.pop(k)

    def clean(pk):
        for p in pk:
            for k in ("i", "lo", "hi"):
                p.pop(k, None)
        return pk

    travel = S[-1]["hips"] - h0
    xs = [char_space(s["hips"] - h0) for s in S]
    entry = {
        "frames": n, "duration": round(dur, 3),
        "boneMatch": clip_bones == bone_names or clip_bones <= bone_names,
        "missingBones": sorted(bone_names - clip_bones)[:6], "extraBones": sorted(clip_bones - bone_names)[:6],
        "loopClosureDeg": round(closure, 1),
        "rootTravel": char_space(travel), "rootMaxFwd": round(max(x[0] for x in xs), 2), "rootMinFwd": round(min(x[0] for x in xs), 2),
        "rootMaxSide": round(max(abs(x[1]) for x in xs), 2),
        "hipsHeight": [round(min(s["hips"].z for s in S), 3), round(max(s["hips"].z for s in S), 3)],
        "yawChangeDeg": round(math.degrees(unwrapped[-1] - unwrapped[0]), 1),
        "yawRangeDeg": [round(math.degrees(min(unwrapped) - unwrapped[0]), 1), round(math.degrees(max(unwrapped) - unwrapped[0]), 1)],
        "tipPeaks": tip_peaks,
        "tipMaxSpeed": round(max(tip) if tip else 0, 1),
        "rightHandPeaks": clean(peaks(rh_s, dt, 2.5, rel=0.6)),
        "leftHandPeaks": clean(peaks(lh_s, dt, 2.5, rel=0.6)),
        "footPeaks": clean(peaks(foot, dt, 4.0, rel=0.7)),
        "handSep": [round(min(sep), 2), round(sum(sep) / n, 2), round(max(sep), 2)],
        "twoHandedFrac": round(two_hand, 2),
        "headHeight": [round(min(s["head"].z for s in S), 2), round(max(s["head"].z for s in S), 2)],
    }
    report["clips"][name] = entry
    # contact frames
    for k in range(N_FRAMES):
        f = int(round(f0 + (f1 - f0) * k / (N_FRAMES - 1)))
        scene.frame_set(f)
        hips = P("mixamorig:Hips")
        target = Vector((hips.x, hips.y, height * 0.5))
        cam.location = target + Vector((2.6, -3.6, 0.5)) * (height / 1.75)
        d = target - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(FRAMES, "%s__%d.png" % (name.replace(" ", "_"), k))
        bpy.ops.render.render(write_still=True)
    print("CLIP", name, entry["duration"], "travel", entry["rootTravel"], "yaw", entry["yawChangeDeg"],
          "peaks", [(p["t"], p["speed"]) for p in tip_peaks], "2H", entry["twoHandedFrac"], "loop", entry["loopClosureDeg"])
    arm.animation_data.action = None
    bpy.data.actions.remove(act)

json.dump(report, open(OUT_JSON, "w"), indent=1)
print("INSPECT OK", OUT_JSON)
