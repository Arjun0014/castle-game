"""Deterministic hero build: Maria FBX + 49 Mixamo clips -> hero.blend, hero.glb, heroAnimations.json.

Run (headless):
  blender --background --factory-startup --python tools/blender/build_hero.py

Steps
  1. Import 'Maria WProp J J Ong.fbx' (mesh + sword + 65-bone mixamorig skeleton).
  2. Import each clip FBX, keep its action under a clean id from hero_clip_map.json.
  3. Root motion: loops -> subtract linear horizontal drift (record velocity);
     one-shots -> remove horizontal hips motion (record per-frame curve for code-driven translation);
     jumps -> additionally clamp the hips vertical rise (physics owns jump height).
  4. Derive combat timing from motion: sword-tip speed peaks (hit windows), foot peaks (kick),
     shield-hand peaks (bash). Written to the manifest; gameplay data may override.
  5. Save assets/blender/characters/hero.blend, export public/assets/characters/hero.glb,
     write src/data/heroAnimations.json.
"""
import bpy
import json
import math
import os
from mathutils import Vector
from bpy_extras import anim_utils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACK = os.path.join(ROOT, "assets", "extracted", "characters", "hero", "Sword and Shield Pack")
CLIP_MAP = os.path.join(ROOT, "tools", "blender", "hero_clip_map.json")
OUT_BLEND = os.path.join(ROOT, "assets", "blender", "characters", "hero.blend")
OUT_GLB = os.path.join(ROOT, "public", "assets", "characters", "hero.glb")
OUT_MANIFEST = os.path.join(ROOT, "src", "data", "heroAnimations.json")
HIPS = "mixamorig:Hips"
FPS = 30.0

for p in (OUT_BLEND, OUT_GLB, OUT_MANIFEST):
    os.makedirs(os.path.dirname(p), exist_ok=True)

clip_map = json.load(open(CLIP_MAP))["clips"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = int(FPS)


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=False,
                             automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


def fcurves_of(action):
    slot = action.slots[0]
    cb = anim_utils.action_get_channelbag_for_slot(action, slot)
    return cb.fcurves


# ---------------------------------------------------------------- hero base
objs = import_fbx(os.path.join(PACK, "Maria WProp J J Ong.fbx"))
hero = next(o for o in objs if o.type == "ARMATURE")
hero.name = "Hero"
hero.data.name = "HeroSkeleton"
body = next(o for o in objs if o.type == "MESH" and "sword" not in o.name.lower())
sword = next(o for o in objs if o.type == "MESH" and "sword" in o.name.lower())
body.name = "HeroBody"
sword.name = "HeroSword"
# Drop the bind-pose action that ships with the character FBX.
if hero.animation_data and hero.animation_data.action:
    a = hero.animation_data.action
    hero.animation_data.action = None
    bpy.data.actions.remove(a)

# Material cleanup: keep base color + normal; specular map dropped (no clean glTF mapping, saves 2K texture).
mat = body.data.materials[0]
mat.name = "HeroMat"
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
for link in list(nt.links):
    if link.to_node == bsdf and link.to_socket.name in ("Specular IOR Level", "Specular"):
        nt.links.remove(link)
bsdf.inputs["Roughness"].default_value = 0.58
bsdf.inputs["Metallic"].default_value = 0.0

bpy.context.view_layer.update()
hips_bone = hero.data.bones[HIPS]
M = hero.matrix_world.to_3x3() @ hips_bone.matrix_local.to_3x3()
Minv = M.inverted()

# Sword blade line in RightHand bone space (rest), used for tip speed analysis.
rh_bone = hero.data.bones["mixamorig:RightHand"]
rh_rest_inv = rh_bone.matrix_local.inverted()
sword_pts = [sword.matrix_world @ v.co for v in sword.data.vertices]
arm_inv = hero.matrix_world.inverted()
hand_arm = rh_bone.head_local
far = max(sword_pts, key=lambda p: (arm_inv @ p - hand_arm).length)
near = min(sword_pts, key=lambda p: (arm_inv @ p - hand_arm).length)
tip_local = rh_rest_inv @ (arm_inv @ far)
hilt_local = rh_rest_inv @ (arm_inv @ near)

# Character space in Blender world: forward = -Y, right = -X.
FWD = Vector((0, -1, 0))
RIGHT = Vector((-1, 0, 0))


def to_char(d):
    return [round(d.dot(FWD), 4), round(d.dot(RIGHT), 4)]


def world_bone(name):
    return hero.matrix_world @ hero.pose.bones[name].matrix.translation


def world_point_in_bone(name, local):
    return hero.matrix_world @ hero.pose.bones[name].matrix @ local


def peaks(series, dt, min_speed, rel=0.55, min_sep=0.22, win_rel=0.45):
    """Local maxima of a speed series -> [{t, speed, window:[t0,t1]}]."""
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
        out.append({"t": round(p["t"], 3), "speed": round(p["speed"], 2),
                    "window": [round(lo * dt + dt, 3), round(hi * dt + dt, 3)]})
    return out


def speed_series(samples, key, rel_key="hips"):
    out = []
    for i in range(1, len(samples)):
        a = samples[i - 1][key] - samples[i - 1][rel_key]
        b = samples[i][key] - samples[i][rel_key]
        out.append((b - a).length * FPS)
    return out


manifest = {"_generatedBy": "tools/blender/build_hero.py", "_source": "assets/characters/hero/Sword and Shield Pack.zip",
            "fps": FPS, "characterFacing": "+Z (three.js)", "rootCurveSpace": "[forward, right] meters relative to clip start",
            "clips": {}}

if hero.animation_data is None:
    hero.animation_data_create()

for fname in sorted(os.listdir(PACK)):
    if not fname.lower().endswith(".fbx") or fname.startswith("Maria"):
        continue
    key = fname[:-4]
    if key not in clip_map:
        raise RuntimeError("Clip not classified in hero_clip_map.json: " + fname)
    info = clip_map[key]
    new = import_fbx(os.path.join(PACK, fname))
    src = next(o for o in new if o.type == "ARMATURE")
    act = src.animation_data.action
    src.animation_data.action = None
    for o in new:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data and data.users == 0 and isinstance(data, bpy.types.Armature):
            bpy.data.armatures.remove(data)
    act.name = info["id"]
    act.use_fake_user = True
    hero.animation_data.action = act
    hero.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(round(x)) for x in act.frame_range]
    frames = list(range(f0, f1 + 1))

    # ---- sample original motion
    samples = []
    for f in frames:
        scene.frame_set(f)
        samples.append({
            "hips": world_bone(HIPS).copy(),
            "tip": world_point_in_bone("mixamorig:RightHand", tip_local).copy(),
            "hilt": world_point_in_bone("mixamorig:RightHand", hilt_local).copy(),
            "lh": world_bone("mixamorig:LeftHand").copy(),
            "rf": world_bone("mixamorig:RightFoot").copy(),
            "lf": world_bone("mixamorig:LeftFoot").copy(),
        })
    h0 = samples[0]["hips"]
    h1 = samples[-1]["hips"]
    n = len(frames)
    dur = (f1 - f0) / FPS

    # ---- root motion processing
    policy = info["root"]
    deltas = []
    for i, s in enumerate(samples):
        if policy == "loop":
            k = i / max(1, n - 1)
            d = Vector(((h1.x - h0.x) * k, (h1.y - h0.y) * k, 0.0))
        else:
            d = Vector((s["hips"].x - h0.x, s["hips"].y - h0.y, 0.0))
            if policy == "extract_jump" and s["hips"].z > h0.z:
                d.z = s["hips"].z - h0.z
        deltas.append(d)

    fcs = [fc for fc in fcurves_of(act) if fc.data_path == 'pose.bones["%s"].location' % HIPS]
    fcs.sort(key=lambda fc: fc.array_index)
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

    entry = {"source": fname, "cat": info["cat"], "loop": info["loop"], "root": policy,
             "frames": n, "duration": round(dur, 4)}
    if info.get("note"):
        entry["note"] = info["note"]
    total = Vector((h1.x - h0.x, h1.y - h0.y, 0))
    if policy == "loop":
        v = total / dur if dur > 0 else Vector()
        entry["rootVelocity"] = to_char(v)
        entry["speed"] = round(v.length, 3)
    else:
        entry["rootCurve"] = [to_char(d) for d in deltas]
        entry["rootTotal"] = to_char(total)
        if policy == "extract_jump":
            entry["hipsRise"] = [round(d.z, 3) for d in deltas]
    entry["hipsHeight"] = [round(min(s["hips"].z for s in samples), 3), round(max(s["hips"].z for s in samples), 3)]

    dt = 1.0 / FPS
    tip_speed = speed_series(samples, "tip")
    entry["swordPeaks"] = peaks(tip_speed, dt, 6.0)
    foot_speed = [max(a, b) for a, b in zip(speed_series(samples, "rf"), speed_series(samples, "lf"))]
    entry["footPeaks"] = peaks(foot_speed, dt, 5.0, rel=0.7)
    entry["shieldPeaks"] = peaks(speed_series(samples, "lh"), dt, 3.0, rel=0.7)
    manifest["clips"][info["id"]] = entry
    print("processed", fname, "->", info["id"], policy, "peaks", [p["t"] for p in entry["swordPeaks"]])

# rest pose for export
hero.animation_data.action = None
for pb in hero.pose.bones:
    pb.location = (0, 0, 0)
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.scale = (1, 1, 1)
scene.frame_set(0)

manifest["blade"] = {"tipLocalBlender": list(tip_local), "hiltLocalBlender": list(hilt_local),
                     "lengthM": round((far - near).length, 3)}
json.dump(manifest, open(OUT_MANIFEST, "w"), indent=1)

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)

bpy.ops.object.select_all(action="DESELECT")
for o in (hero, body, sword):
    o.select_set(True)
bpy.context.view_layer.objects.active = hero
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True,
    export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
    export_optimize_animation_size=True, export_anim_single_armature=True,
    export_reset_pose_bones=True, export_rest_position_armature=True,
    export_image_format="JPEG", export_jpeg_quality=88, export_image_quality=88,
    export_skins=True, export_morph=False, export_def_bones=False, export_leaf_bone=False,
    export_yup=True, export_apply=False, export_extras=False, export_cameras=False, export_lights=False,
)
print("HERO BUILD OK", OUT_GLB, os.path.getsize(OUT_GLB))
