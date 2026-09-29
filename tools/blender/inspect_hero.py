"""Headless inspection of the hero FBX + every animation FBX in the Sword and Shield pack.

Run:
  blender --background --factory-startup --python tools/blender/inspect_hero.py -- <pack_dir> <out_json>

Outputs a JSON report with, per clip: frame range, fps, duration, root (Hips) displacement,
hips height range, right/left hand speed peaks (for attack/impact timing), bone count match.
"""
import bpy
import json
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
PACK = argv[0]
OUT = argv[1]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, automatic_bone_orientation=False,
                             ignore_leaf_bones=False)
    return [o for o in bpy.data.objects if o not in before]


def world_bone_pos(arm, bone_name):
    pb = arm.pose.bones.get(bone_name)
    if pb is None:
        return None
    m = arm.matrix_world @ pb.matrix
    return m.translation.copy()


def inspect_character(path):
    clear_scene()
    objs = import_fbx(path)
    rep = {"objects": []}
    for o in objs:
        e = {"name": o.name, "type": o.type, "parent": o.parent.name if o.parent else None,
             "parent_bone": o.parent_bone or None, "scale": list(o.scale), "rotation": list(o.rotation_euler)}
        if o.type == "MESH":
            e["verts"] = len(o.data.vertices)
            e["tris"] = sum(len(p.vertices) - 2 for p in o.data.polygons)
            e["materials"] = [m.name if m else None for m in o.data.materials]
            e["vertex_groups"] = len(o.vertex_groups)
            e["modifiers"] = [(m.type, getattr(m, "object", None) and m.object.name) for m in o.modifiers]
            e["dims"] = list(o.dimensions)
        if o.type == "ARMATURE":
            e["bones"] = [b.name for b in o.data.bones]
            e["anim"] = o.animation_data.action.name if o.animation_data and o.animation_data.action else None
        rep["objects"].append(e)
    rep["images"] = [(i.name, i.filepath, list(i.size), i.packed_file is not None) for i in bpy.data.images]
    rep["materials"] = []
    for m in bpy.data.materials:
        texs = []
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    links = [l.to_socket.name for l in n.outputs[0].links]
                    texs.append((n.image.name, links))
        rep["materials"].append({"name": m.name, "textures": texs})
    arm = next((o for o in objs if o.type == "ARMATURE"), None)
    if arm:
        bpy.context.view_layer.update()
        rep["rest_hips"] = list(world_bone_pos(arm, "mixamorig:Hips") or [])
        rep["rest_head"] = list(world_bone_pos(arm, "mixamorig:Head") or [])
        rep["rest_lfoot"] = list(world_bone_pos(arm, "mixamorig:LeftFoot") or [])
        rep["rest_rhand"] = list(world_bone_pos(arm, "mixamorig:RightHand") or [])
        rep["rest_lhand"] = list(world_bone_pos(arm, "mixamorig:LeftHand") or [])
    return rep


def inspect_clip(path, ref_bones):
    clear_scene()
    objs = import_fbx(path)
    arm = next((o for o in objs if o.type == "ARMATURE"), None)
    scene = bpy.context.scene
    r = {"file": os.path.basename(path), "objects": [(o.name, o.type) for o in objs]}
    if arm is None or not arm.animation_data or not arm.animation_data.action:
        r["error"] = "no armature action"
        return r
    act = arm.animation_data.action
    f0, f1 = act.frame_range
    fps = scene.render.fps / scene.render.fps_base
    r.update({"action": act.name, "frame_start": f0, "frame_end": f1, "fps": fps,
              "duration_s": (f1 - f0) / fps, "bones": len(arm.data.bones),
              "bones_match_hero": sorted(b.name for b in arm.data.bones) == ref_bones,
              "has_mesh": any(o.type == "MESH" for o in objs)})
    # fcurve summary: which bones carry location keys
    loc_bones = set()
    try:
        fcurves = act.fcurves
    except AttributeError:
        # Blender 5.x layered actions
        fcurves = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    fcurves.extend(cb.fcurves)
    for fc in fcurves:
        if fc.data_path.endswith(".location"):
            name = fc.data_path.split('"')[1]
            rng = [kp.co[1] for kp in fc.keyframe_points]
            if rng and (max(rng) - min(rng)) > 1e-4:
                loc_bones.add(name)
    r["bones_with_location_motion"] = sorted(loc_bones)
    samples = []
    step = 1
    f = int(f0)
    prev = None
    while f <= int(f1):
        scene.frame_set(f)
        hips = world_bone_pos(arm, "mixamorig:Hips")
        rh = world_bone_pos(arm, "mixamorig:RightHand")
        lh = world_bone_pos(arm, "mixamorig:LeftHand")
        head = world_bone_pos(arm, "mixamorig:Head")
        lf = world_bone_pos(arm, "mixamorig:LeftFoot")
        rf = world_bone_pos(arm, "mixamorig:RightFoot")
        s = {"f": f, "hips": list(hips), "rh": list(rh), "lh": list(lh), "head": list(head),
             "lf": list(lf), "rf": list(rf)}
        samples.append(s)
        f += step
    h0 = samples[0]["hips"]
    h1 = samples[-1]["hips"]
    r["hips_start"] = [round(v, 3) for v in h0]
    r["hips_end"] = [round(v, 3) for v in h1]
    r["root_disp_xy"] = [round(h1[0] - h0[0], 3), round(h1[1] - h0[1], 3)]
    r["root_disp_len"] = round(math.hypot(h1[0] - h0[0], h1[1] - h0[1]), 3)
    zs = [s["hips"][2] for s in samples]
    r["hips_z_min"] = round(min(zs), 3)
    r["hips_z_max"] = round(max(zs), 3)
    xs = [s["hips"][0] for s in samples]
    ys = [s["hips"][1] for s in samples]
    r["hips_xy_extent"] = [round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3)]
    heads = [s["head"][2] for s in samples]
    r["head_z_min"] = round(min(heads), 3)
    r["head_z_max"] = round(max(heads), 3)
    feet_z = [min(s["lf"][2], s["rf"][2]) for s in samples]
    r["feet_z_max_of_min"] = round(max(feet_z), 3)

    def speed_profile(key):
        sp = []
        for i in range(1, len(samples)):
            a = samples[i - 1][key]
            b = samples[i][key]
            # hand speed relative to hips (removes locomotion)
            ha = samples[i - 1]["hips"]
            hb = samples[i]["hips"]
            d = [(b[k] - hb[k]) - (a[k] - ha[k]) for k in range(3)]
            sp.append(math.sqrt(sum(x * x for x in d)) * fps)
        return sp

    for key in ("rh", "lh", "rf", "lf"):
        sp = speed_profile(key)
        if not sp:
            continue
        mx = max(sp)
        i = sp.index(mx)
        r[key + "_peak_speed"] = round(mx, 2)
        r[key + "_peak_t"] = round((i + 1) / fps, 3)
        r[key + "_peak_frac"] = round((i + 1) / max(1, len(sp)), 3)
    # right hand extension relative to hips over time (reach)
    reach = [math.dist(s["rh"], s["hips"]) for s in samples]
    r["rh_reach_max"] = round(max(reach), 3)
    # coarse trajectories (every ~4 frames) for later classification
    r["traj"] = [{"t": round((s["f"] - f0) / fps, 3),
                  "hips": [round(v, 2) for v in s["hips"]],
                  "rh": [round(v, 2) for v in s["rh"]],
                  "lh": [round(v, 2) for v in s["lh"]]} for s in samples[::4]]
    return r


def main():
    char_file = None
    clips = []
    for f in sorted(os.listdir(PACK)):
        if not f.lower().endswith(".fbx"):
            continue
        if f.startswith("Maria"):
            char_file = f
        else:
            clips.append(f)
    report = {"pack": PACK, "character_file": char_file}
    report["character"] = inspect_character(os.path.join(PACK, char_file))
    ref_bones = sorted(next(o for o in report["character"]["objects"] if o["type"] == "ARMATURE")["bones"])
    report["clips"] = []
    for c in clips:
        try:
            report["clips"].append(inspect_clip(os.path.join(PACK, c), ref_bones))
        except Exception as ex:  # keep going, record failure
            report["clips"].append({"file": c, "error": repr(ex)})
        print("inspected", c)
    with open(OUT, "w") as fh:
        json.dump(report, fh, indent=1)
    print("WROTE", OUT)


main()
