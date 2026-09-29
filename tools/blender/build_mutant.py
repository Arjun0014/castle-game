"""Deterministic Floor 3 mini-boss build: the Creature Pack Mutant -> mutant.glb + mutantAnimations.json (session 11).

Run (headless):
  blender --background --factory-startup --python tools/blender/build_mutant.py
  then: npm run assets:ktx2 -- --only glb   (KTX2 copy in public/assets/ktx2/characters/)

Source (immutable): assets/characters/enemy/floor 3 Creature Pack.zip, extracted by tools/extract_assets.py:
'Mutant.fbx' (Mixamo character, 37-bone mixamorig skeleton without fingers, 1.86 m hunched — head at 1.3 m in its
idle) + 19 clip FBX on the same skeleton (verified by tools/blender/inspect_pack.py -> build/analysis/mutant/).
The pack has no hit reactions (see BORROW for what the runtime does instead).

Steps
  1. Import the Mutant; textures downscaled to 1024^2.
  2. Import every clip under a clean id. Root motion: loops -> subtract the linear drift (record the velocity);
     one-shots -> remove the horizontal hips motion (record the curve: gameplay moves the boss). Turns: the hips' yaw
     is taken out too (record the yaw curve) so the runtime turns the body on the spot while the feet step.
  3. Contacts from motion: hand / foot speed peaks (relative to the hips) with the limb's position in character space
     at the peak, and the hips / head height range (leaps) -> src/data/mutantAnimations.json.
  4. Contact sheet: 8 frames per clip -> build/analysis/mutant/sheet_*.png (visual review of every move).
  5. Export public/assets/characters/mutant.glb.
"""
import bpy
import json
import math
import os
from mathutils import Vector, Quaternion, Matrix
from bpy_extras import anim_utils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACK = os.path.join(ROOT, "assets", "extracted", "characters", "enemy", "floor 3 Creature Pack")
OUT_GLB = os.path.join(ROOT, "public", "assets", "characters", "mutant.glb")
OUT_MANIFEST = os.path.join(ROOT, "src", "data", "mutantAnimations.json")
FRAMES = os.path.join(ROOT, "build", "analysis", "mutant", "frames")
SHEETS = os.path.join(ROOT, "build", "analysis", "mutant")
HIPS = "mixamorig:Hips"
FPS = 30.0
TEX = 1024

# id: (file, loop, kind, note). kind: 'move' (root curve), 'turn' (yaw curve), 'loop' (velocity), 'still'.
CLIPS = {
    "idle":         ("mutant breathing idle", True, "loop", "heavy breathing, shoulders rolling: the combat idle"),
    "idle_look":    ("mutant idle (2)", True, "loop", "idle, looks about: between waves / out of reach"),
    "walk":         ("mutant walking", True, "loop", "knuckle-heavy stalk, 1.2 m/s"),
    "run":          ("mutant run", True, "loop", "charging run, 2.2 m/s"),
    "turn_l45":     ("left turn 45", False, "turn", "steps round 45 deg to its left"),
    "turn_r45":     ("mutant right turn 45", False, "turn", "steps round 45 deg to its right"),
    "turn_r90":     ("mutant right turn 90", False, "turn", "steps round 90 deg to its right"),
    "punch":        ("mutant punch", False, "move", "short right hook (contact 0.30 s): the quick blow / combo opener"),
    "swipe":        ("mutant swiping", False, "move", "wind-up, both arms rake across (1.23 s): the heavy sweep"),
    "leap_slam":    ("mutant jump attack", False, "move", "crouch, leap 1.6 m forward, two-fist slam on landing (1.67 s)"),
    "leap_turn":    ("jump attack", False, "move", "the same leap landing turned 64 deg: a slam that swings round onto her"),
    "pound":        ("mutant jumping", False, "move", "gathers, jumps in place and pounds the floor (1.90 s): the quake"),
    "hop":          ("mutant jumping (2)", False, "move", "a short crouch-hop (0.6 s): hops back out of a corner"),
    "roar":         ("mutant roaring", False, "still", "the roar (5.2 s): its entrance, phase changes"),
    "flex":         ("mutant flexing muscles", False, "still", "beats its chest / flexes (4.5 s): enrage at low health"),
    "death":        ("mutant dying", False, "move", "staggers back and falls (3.43 s)"),
}
# No hit reactions in the pack. Borrowing the Pro Magic Pack's unarmed reactions by bone name was tried and rejected
# (session 11): its bones rest in other orientations, so the Mutant turned side-on into a mage's pose. Reactions are
# the Mutant's own motion instead (runtime, enemies/Maw.ts): the flinch is procedural (lean spring), a stagger is the
# opening stumble of 'death' (0-1.2 s), the stun holds that stumble on a knee and plays it back to rise.
BORROW = {}
# one-shots that also turn the body (the leap that lands 64 deg round): their yaw becomes a curve like the turns
UNYAW = {"leap_turn"}
UNUSED = {
    "mutant idle": "14.1 s idle: 'mutant idle (2)' is the same motion family at 5.2 s",
    "mutant left turn 45 / mutant right turn 45 (2)": "turns with the rotation left in the root (0 deg of body yaw measured): duplicates of the used turns",
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = int(FPS)


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=False, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


def fcurves_of(action):
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves


objs = import_fbx(os.path.join(PACK, "Mutant.fbx"))
arm = next(o for o in objs if o.type == "ARMATURE")
meshes = [o for o in objs if o.type == "MESH"]
arm.name = "Mutant"
arm.data.name = "MutantSkeleton"
for i, m in enumerate(meshes):
    m.name = "MutantBody" if i == 0 else "MutantBody%d" % i
if arm.animation_data and arm.animation_data.action:
    a = arm.animation_data.action
    arm.animation_data.action = None
    bpy.data.actions.remove(a)
bones = {b.name for b in arm.data.bones}
tris = sum(sum(len(p.vertices) - 2 for p in m.data.polygons) for m in meshes)
print("MUTANT", "bones", len(bones), "meshes", [m.name for m in meshes], "tris", tris)
for mat in {s.material for m in meshes for s in m.material_slots if s.material}:
    print("  material", mat.name, [(n.image.name, tuple(n.image.size)) for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image])
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        # the specular map has no clean glTF mapping; roughness / metalness as a skin
        for link in list(mat.node_tree.links):
            if link.to_node == bsdf and link.to_socket.name in ("Specular IOR Level", "Specular", "Specular Tint"):
                mat.node_tree.links.remove(link)
        bsdf.inputs["Metallic"].default_value = 0.0
        if not bsdf.inputs["Roughness"].is_linked:
            bsdf.inputs["Roughness"].default_value = 0.62
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

bpy.context.view_layer.update()
hips_bone = arm.data.bones[HIPS]
Minv = (arm.matrix_world.to_3x3() @ hips_bone.matrix_local.to_3x3()).inverted()
FWD = Vector((0, -1, 0))
RIGHT = Vector((-1, 0, 0))
height = max(m.dimensions.y for m in meshes)
hips_rest_z = (arm.matrix_world @ hips_bone.head_local).z


def to_char(d):
    return [round(d.dot(FWD), 3), round(d.dot(RIGHT), 3), round(d.z, 3)]


def P(name):
    return arm.matrix_world @ arm.pose.bones[name].matrix.translation


def yaw_of_pelvis():
    l, r = P("mixamorig:LeftUpLeg"), P("mixamorig:RightUpLeg")
    lat = Vector((r.x - l.x, r.y - l.y, 0))
    f = Vector((0, 0, 1)).cross(lat)
    return math.atan2(-f.x, -f.y)


def peaks(series, dt, min_speed, rel=0.6, min_sep=0.2):
    if not series:
        return []
    thr = max(min_speed, max(series) * rel)
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
    return found


# ---- contact sheet renders (workbench, textured, 3/4 front tracking the hips)
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 220
scene.render.resolution_y = 260
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
bpy.ops.mesh.primitive_plane_add(size=60)
ground = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.diffuse_color = (0.25, 0.3, 0.35, 1)
ground.data.materials.append(gm)
marks = []
for gx in range(-5, 6):
    for gy in range(-5, 6):
        bpy.ops.mesh.primitive_plane_add(size=0.06, location=(gx, gy, 0.002))
        marks.append(bpy.context.active_object)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 40
scene.collection.objects.link(cam)
scene.camera = cam
os.makedirs(FRAMES, exist_ok=True)


def render_frames(cid, f0, f1):
    for k in range(8):
        f = int(round(f0 + (f1 - f0) * k / 7))
        scene.frame_set(f)
        hips = P(HIPS)
        target = Vector((hips.x, hips.y, 0.9))
        cam.location = target + Vector((2.9, -4.0, 0.6)) * (height / 1.75)
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(FRAMES, "%s__%d.png" % (cid, k))
        bpy.ops.render.render(write_still=True)


manifest = {"_generatedBy": "tools/blender/build_mutant.py", "_source": "assets/characters/enemy/floor 3 Creature Pack.zip",
            "fps": FPS, "characterFacing": "+Z (three.js)", "height": round(height, 3), "hipsRest": round(hips_rest_z, 3), "tris": tris,
            "rootCurveSpace": "[forward, right] metres relative to clip start; yawCurve degrees (+ = to its right)",
            "unused": UNUSED, "clips": {}}
arm.animation_data_create()
jobs = [(cid, os.path.join(PACK, f + ".fbx"), loop, kind, note, 1.0) for cid, (f, loop, kind, note) in CLIPS.items()]

for cid, path, loop, kind, note, hip_scale in jobs:
    new = import_fbx(path)
    src = next(o for o in new if o.type == "ARMATURE")
    src_bones = {b.name for b in src.data.bones}
    if hip_scale is None:
        # a borrowed clip: its hips height ratio scales the hips' own motion onto the Mutant
        hb = src.data.bones[HIPS]
        src_hips_z = (src.matrix_world @ hb.head_local).z
        hip_scale = hips_rest_z / src_hips_z
    elif not bones <= src_bones:
        raise RuntimeError("Skeleton mismatch in " + path)
    act = src.animation_data.action
    src.animation_data.action = None
    for o in new:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data and data.users == 0 and isinstance(data, bpy.types.Armature):
            bpy.data.armatures.remove(data)
        elif data and data.users == 0 and isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
    # only the Mutant's bones (a borrowed clip also drives fingers / ribbons the Mutant does not have)
    fcs_all = fcurves_of(act)
    for fc in list(fcs_all):
        bn = fc.data_path.split('"')[1] if '"' in fc.data_path else None
        if bn and bn not in bones:
            fcs_all.remove(fc)
    if hip_scale != 1.0:
        for fc in fcs_all:
            if fc.data_path == 'pose.bones["%s"].location' % HIPS:
                for kp in fc.keyframe_points:
                    kp.co.y *= hip_scale
                    kp.handle_left.y *= hip_scale
                    kp.handle_right.y *= hip_scale
                fc.update()
    act.name = cid
    act.use_fake_user = True
    arm.animation_data.action = act
    arm.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(round(x)) for x in act.frame_range]
    frames = list(range(f0, f1 + 1))
    S = []
    for f in frames:
        scene.frame_set(f)
        S.append({k: P(b).copy() for k, b in (("hips", HIPS), ("lh", "mixamorig:LeftHand"), ("rh", "mixamorig:RightHand"),
                                              ("lf", "mixamorig:LeftFoot"), ("rf", "mixamorig:RightFoot"), ("head", "mixamorig:Head"))})
        S[-1]["yaw"] = yaw_of_pelvis()
    n, dur = len(S), (f1 - f0) / FPS
    h0, h1 = S[0]["hips"], S[-1]["hips"]
    yaw0 = S[0]["yaw"]
    uw = [0.0]
    for s in S[1:]:
        d = (s["yaw"] - yaw0) - uw[-1]
        d = (d + math.pi) % (2 * math.pi) - math.pi
        uw.append(uw[-1] + d)
    deltas = []
    for i, s in enumerate(S):
        if loop:
            k = i / max(1, n - 1)
            deltas.append(Vector(((h1.x - h0.x) * k, (h1.y - h0.y) * k, 0.0)))
        else:
            deltas.append(Vector((s["hips"].x - h0.x, s["hips"].y - h0.y, 0.0)))
    fcs = sorted([fc for fc in fcurves_of(act) if fc.data_path == 'pose.bones["%s"].location' % HIPS], key=lambda fc: fc.array_index)
    values = [[fc.evaluate(f) for f in frames] for fc in fcs]
    for i in range(n):
        dl = Minv @ deltas[i]
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
    if kind == "turn" or cid in UNYAW:
        # take the body's yaw out of the hips rotation (world Z) so the clip turns on the spot in place: the runtime
        # rotates the whole Mutant along the recorded curve while the feet step
        qfc = sorted([fc for fc in fcurves_of(act) if fc.data_path == 'pose.bones["%s"].rotation_quaternion' % HIPS], key=lambda fc: fc.array_index)
        rest = (arm.matrix_world.to_3x3() @ hips_bone.matrix_local.to_3x3())
        qs = []
        for i, f in enumerate(frames):
            q = Quaternion([fc.evaluate(f) for fc in qfc])
            # pose rotation in armature space -> world, remove the world yaw, back to bone space
            world = rest @ q.to_matrix()
            # yaw_of_pelvis is + for a turn to its right = a NEGATIVE rotation about world Z: undo it with +uw
            unyaw = Matrix.Rotation(uw[i], 3, "Z")
            qs.append((rest.inverted() @ unyaw @ world).to_quaternion())
        for axis, fc in enumerate(qfc):
            fc.keyframe_points.clear()
            fc.keyframe_points.add(n)
            for i, f in enumerate(frames):
                kp = fc.keyframe_points[i]
                kp.co = (f, qs[i][axis])
                kp.interpolation = "LINEAR"
            fc.update()
    total = Vector((h1.x - h0.x, h1.y - h0.y, 0))
    e = {"source": os.path.basename(path), "loop": loop, "kind": kind, "frames": n, "duration": round(dur, 4), "note": note,
         "hipsHeight": [round(min(s["hips"].z for s in S), 3), round(max(s["hips"].z for s in S), 3)],
         "headHeight": [round(min(s["head"].z for s in S), 3), round(max(s["head"].z for s in S), 3)],
         # when the head is highest / lowest (the roar's rear-up, a slam's low point): gameplay beats sync to these
         "headPeakT": round(max(range(n), key=lambda i: S[i]["head"].z) / FPS, 3),
         "headLowT": round(min(range(n), key=lambda i: S[i]["head"].z) / FPS, 3),
         "hipsPeakT": round(max(range(n), key=lambda i: S[i]["hips"].z) / FPS, 3)}
    if loop:
        v = total / dur if dur > 0 else Vector()
        e["rootVelocity"] = to_char(v)[:2]
        e["speed"] = round(v.length, 3)
    else:
        e["rootCurve"] = [to_char(d)[:2] for d in deltas]
        e["rootTotal"] = to_char(total)[:2]
    if kind == "turn" or cid in UNYAW:
        e["yawCurve"] = [round(math.degrees(y), 2) for y in uw]
        e["yawTotal"] = round(math.degrees(uw[-1]), 1)
    dt = 1.0 / FPS
    for key in ("lh", "rh", "lf", "rf"):
        sp = []
        for i in range(1, n):
            a = S[i - 1][key] - S[i - 1]["hips"]
            b = S[i][key] - S[i]["hips"]
            sp.append((b - a).length * FPS)
        pk = peaks(sp, dt, 3.0 if key in ("lh", "rh") else 4.0)
        # limb position at the peak in the clip-start character frame (root motion included: where the blow lands)
        e[key + "Peaks"] = [{"t": round(p["t"], 3), "speed": round(p["speed"], 2), "at": to_char(S[p["i"] + 1][key] - Vector((h0.x, h0.y, 0)))} for p in pk]
    manifest["clips"][cid] = e
    render_frames(cid, f0, f1)
    print("clip", cid, e["duration"], "rh", [p["t"] for p in e["rhPeaks"]], "lh", [p["t"] for p in e["lhPeaks"]], "yaw", e.get("yawTotal"), "root", e.get("rootTotal") or e.get("rootVelocity"))

arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
scene.frame_set(0)
json.dump(manifest, open(OUT_MANIFEST, "w"), indent=1)

# contact sheets (PIL is not in Blender's Python: written by tools/contact_sheet_simple below via numpy-free stitching)
try:
    import numpy as np
    W, H, N = scene.render.resolution_x, scene.render.resolution_y, 8
    ids = list(manifest["clips"].keys())
    per = 8
    for s in range(0, len(ids), per):
        chunk = ids[s:s + per]
        sheet = np.zeros((H * len(chunk), W * N, 4), dtype=np.float32)
        for r, cid in enumerate(chunk):
            for k in range(N):
                p = os.path.join(FRAMES, "%s__%d.png" % (cid, k))
                img = bpy.data.images.load(p)
                px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
                y0 = H * (len(chunk) - 1 - r)
                sheet[y0:y0 + H, k * W:(k + 1) * W] = px[:H, :W]
                bpy.data.images.remove(img)
        out = bpy.data.images.new("sheet", W * N, H * len(chunk), alpha=True)
        out.pixels = sheet.ravel()
        out.filepath_raw = os.path.join(SHEETS, "clips_%d.png" % (s // per))
        out.file_format = "PNG"
        out.save()
        print("SHEET", out.filepath_raw, chunk)
except Exception as err:  # the sheet is a review aid only
    print("SHEET FAILED", err)

for o in [ground] + marks + [cam]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for o in [arm] + meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True,
    export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
    export_optimize_animation_size=True, export_anim_single_armature=True,
    export_reset_pose_bones=True, export_rest_position_armature=True,
    export_image_format="JPEG", export_jpeg_quality=90, export_image_quality=90,
    export_skins=True, export_morph=False, export_def_bones=False, export_leaf_bone=False,
    export_yup=True, export_apply=False, export_extras=False, export_cameras=False, export_lights=False,
)
print("MUTANT BUILD OK", OUT_GLB, os.path.getsize(OUT_GLB))
