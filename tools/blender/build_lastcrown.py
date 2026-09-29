"""Deterministic final-boss build: Nightshade (Pro Magic Pack) + its magic clips -> lastcrown.glb + bossAnimations.json.

Run (headless):
  blender --background --factory-startup --python tools/blender/build_lastcrown.py
  then: npm run assets:ktx2 -- --only glb   (KTX2 copy in public/assets/ktx2/characters/)

Source (immutable): assets/characters/enemy/Pro Magic Pack with final boss.zip, extracted by tools/extract_assets.py.
'Nightshade J Friedrich.fbx' = Mixamo character, 68 bones (the hero's 65 mixamorig bones + Ribbon1-3), 13.0k tris,
2.35 m tall (horned crown included), one material with diffuse / normal / specular / glow 2048^2 maps.
Every clip in the pack uses the same 68-bone skeleton (verified by tools/blender/inspect_pack.py).

Steps
  1. Import the character; material = base colour + normal + emissive glow (specular dropped), textures 1024^2.
  2. Import each clip in CLIPS under a clean id. Root motion: loops -> subtract linear drift (record velocity);
     one-shots -> remove horizontal hips motion (record the curve; gameplay moves the boss).
  3. Cast timing from motion: left/right hand speed peaks relative to the hips (release moments), written to
     src/data/bossAnimations.json with the hand positions (character space) at each peak.
  4. Export public/assets/characters/lastcrown.glb.
"""
import bpy
import json
import os
from mathutils import Vector
from bpy_extras import anim_utils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACK = os.path.join(ROOT, "assets", "extracted", "characters", "enemy", "Pro Magic Pack with final boss")
OUT_GLB = os.path.join(ROOT, "public", "assets", "characters", "lastcrown.glb")
OUT_MANIFEST = os.path.join(ROOT, "src", "data", "bossAnimations.json")
HIPS = "mixamorig:Hips"
FPS = 30.0
TEX = 1024

# id: (file, loop, note) — every clip here has a role in the Last Crown fight (docs/LEVEL_03_BLUEPRINT.md §I)
CLIPS = {
    "idle":          ("standing idle", True, "breathing idle"),
    "idle_taunt":    ("Standing Idle 04", False, "long idle with a hand flourish (4.8 s): phase-change taunt"),
    "walk_fwd":      ("Standing Walk Forward", True, ""),
    "walk_back":     ("Standing Walk Back", True, ""),
    "walk_left":     ("Standing Walk Left", True, ""),
    "walk_right":    ("Standing Walk Right", True, ""),
    "run_fwd":       ("Standing Run Forward", True, ""),
    "run_back":      ("Standing Run Back", True, ""),
    "throw":         ("Standing 1H Magic Attack 01", False, "wind-up, right hand flings forward (0.80): single bolt"),
    "sweep":         ("Standing 1H Magic Attack 02", False, "right arm sweeps across (0.53): cone / fan"),
    "double_cast":   ("Standing 1H Magic Attack 03", False, "two gestures: down (0.33), up (0.93): twin bolts"),
    "raise":         ("standing 1H cast spell 01", False, "right hand raised overhead (0.60): call down / summon"),
    "slam_call":     ("Standing 2H Cast Spell 01", False, "hands up, crouch-slam (0.63), arms raised (1.33): bombardment"),
    "ground_slam":   ("Standing 2H Magic Area Attack 01", False, "arms up then both hands to the floor (1.27): ground wave"),
    "nova":          ("Standing 2H Magic Area Attack 02", False, "gather, arms flung wide (1.80): radial burst"),
    "push":          ("Standing 2H Magic Attack 01", False, "raise, two-hand thrust (1.13): blast"),
    "lean_push":     ("Standing 2H Magic Attack 02", False, "lean back, push forward (1.30): volley"),
    "beam":          ("Standing 2H Magic Attack 03", False, "two-hand thrust at 1.00 held to ~2.9 s: channelled beam"),
    "charge_orb":    ("Standing 2H Magic Attack 04", False, "hands together (0.90) then release (2.0): charged orb"),
    "crouch_blast":  ("Standing 2H Magic Attack 05", False, "deep crouch gather (0.67), rise and fling (2.03): point-blank burst"),
    "ward_start":    ("Standing Block Start", False, "arms cross into a guard"),
    "ward_idle":     ("Standing Block Idle", True, "crossed-arm ward"),
    "ward_hit":      ("Standing Block React Large", False, "ward takes a blow"),
    "ward_end":      ("Standing Block End", False, ""),
    "hit_small":     ("Standing React Small From Front", False, ""),
    "hit_large":     ("Standing React Large From Front", False, "stagger (pushed back)"),
    "hit_large_back": ("Standing React Large From Back", False, "stagger from behind"),
    "leap":          ("Standing Jump", False, "vertical leap (2.33 s): teleport-out tell"),
    "kneel":         ("Standing Idle To Crouch", False, "sinks to one knee: phase break"),
    "kneel_idle":    ("Crouch Idle", True, "kneeling: phase transition hold"),
    "rise":          ("Crouch To Standing Idle", False, "rises from the kneel"),
    "death":         ("Standing React Death Backward", False, "final fall"),
}
UNUSED = {
    "Standing Walk/Run Left/Right variants beyond walk_*": "run_left/right, sprint: the boss repositions by walking or teleporting",
    "Standing Turn Left/Right 90, Crouch Turn Left/Right 90": "turning is procedural",
    "Crouch Walk Forward/Back/Left/Right": "the boss never crouch-walks",
    "Standing Jump Running (+ Landing), Standing Land To Standing Idle": "no running jumps in a one-room fight",
    "Standing React Small From Back/Left/Right, React Large From Left/Right": "two flinch + two stagger clips cover it",
    "Standing React Death Forward/Left/Right": "one scripted death",
    "standing idle 02, Standing Idle 03": "redundant idles",
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


objs = import_fbx(os.path.join(PACK, "Nightshade J Friedrich.fbx"))
arm = next(o for o in objs if o.type == "ARMATURE")
body = next(o for o in objs if o.type == "MESH")
arm.name = "LastCrown"
arm.data.name = "LastCrownSkeleton"
body.name = "LastCrownBody"
if arm.animation_data and arm.animation_data.action:
    a = arm.animation_data.action
    arm.animation_data.action = None
    bpy.data.actions.remove(a)
bones = {b.name for b in arm.data.bones}

# material: base colour + normal + glow as emission; the specular map has no clean glTF mapping
mat = body.data.materials[0]
mat.name = "LastCrownMat"
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
for link in list(nt.links):
    if link.to_node == bsdf and link.to_socket.name in ("Specular IOR Level", "Specular"):
        nt.links.remove(link)
bsdf.inputs["Roughness"].default_value = 0.5
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Emission Strength"].default_value = 2.0
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)
    if "specular" in img.filepath.lower():
        continue

bpy.context.view_layer.update()
hips_bone = arm.data.bones[HIPS]
Minv = (arm.matrix_world.to_3x3() @ hips_bone.matrix_local.to_3x3()).inverted()
FWD = Vector((0, -1, 0))
RIGHT = Vector((-1, 0, 0))


def to_char(d):
    return [round(d.dot(FWD), 3), round(d.dot(RIGHT), 3), round(d.z, 3)]


def P(name):
    return arm.matrix_world @ arm.pose.bones[name].matrix.translation


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


manifest = {"_generatedBy": "tools/blender/build_lastcrown.py", "_source": "assets/characters/enemy/Pro Magic Pack with final boss.zip",
            "fps": FPS, "characterFacing": "+Z (three.js)", "height": round(body.dimensions.y, 3),
            "rootCurveSpace": "[forward, right] metres relative to clip start", "unused": UNUSED, "clips": {}}
arm.animation_data_create()
for cid, (fname, loop, note) in CLIPS.items():
    new = import_fbx(os.path.join(PACK, fname + ".fbx"))
    src = next(o for o in new if o.type == "ARMATURE")
    if {b.name for b in src.data.bones} != bones:
        raise RuntimeError("Skeleton mismatch in " + fname)
    act = src.animation_data.action
    src.animation_data.action = None
    for o in new:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data and data.users == 0 and isinstance(data, bpy.types.Armature):
            bpy.data.armatures.remove(data)
    act.name = cid
    act.use_fake_user = True
    arm.animation_data.action = act
    arm.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(round(x)) for x in act.frame_range]
    frames = list(range(f0, f1 + 1))
    S = []
    for f in frames:
        scene.frame_set(f)
        S.append({"hips": P(HIPS).copy(), "lh": P("mixamorig:LeftHand").copy(), "rh": P("mixamorig:RightHand").copy()})
    n, dur = len(S), (f1 - f0) / FPS
    h0, h1 = S[0]["hips"], S[-1]["hips"]
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
    total = Vector((h1.x - h0.x, h1.y - h0.y, 0))
    e = {"source": fname + ".fbx", "loop": loop, "frames": n, "duration": round(dur, 4), "note": note,
         "hipsHeight": [round(min(s["hips"].z for s in S), 3), round(max(s["hips"].z for s in S), 3)]}
    if loop:
        v = total / dur if dur > 0 else Vector()
        e["rootVelocity"] = to_char(v)[:2]
        e["speed"] = round(v.length, 3)
    else:
        e["rootCurve"] = [to_char(d)[:2] for d in deltas]
        e["rootTotal"] = to_char(total)[:2]
    dt = 1.0 / FPS
    rel = []
    for key in ("lh", "rh"):
        sp = []
        for i in range(1, n):
            a = S[i - 1][key] - S[i - 1]["hips"]
            b = S[i][key] - S[i]["hips"]
            sp.append((b - a).length * FPS)
        pk = peaks(sp, dt, 2.8)
        e[key + "Peaks"] = [{"t": round(p["t"], 3), "speed": round(p["speed"], 2),
                             "hand": to_char(S[p["i"] + 1][key] - S[p["i"] + 1]["hips"] + Vector((0, 0, S[p["i"] + 1]["hips"].z)))} for p in pk]
    manifest["clips"][cid] = e
    print("clip", cid, e["duration"], [p["t"] for p in e["lhPeaks"]], [p["t"] for p in e["rhPeaks"]])

arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
scene.frame_set(0)
json.dump(manifest, open(OUT_MANIFEST, "w"), indent=1)
bpy.ops.object.select_all(action="DESELECT")
for o in (arm, body):
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
print("LASTCROWN BUILD OK", OUT_GLB, os.path.getsize(OUT_GLB))
