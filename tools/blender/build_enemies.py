"""Deterministic enemy build: retarget the hero's processed Mixamo clips onto each enemy rig.

Run (headless, after build_hero.py):
  blender --background --factory-startup --python tools/blender/build_enemies.py

Method (world-space delta with rest-direction alignment):
  E_world(t) = H_world(t) * H_rest^-1 * C * E_rest
  where C rotates the enemy bone's rest direction onto the hero bone's rest direction (fixes A- vs T-pose).
  Unmapped bones keep the pose of the enemy's own native idle (fingers grip, drapes hang); attachments
  (the knight's spear) keep their native-idle offset from a driver bone. Hips translation is scaled by
  leg-length ratio. Clips come from assets/blender/characters/hero.blend (root motion already removed).

Outputs public/assets/characters/{knight,hollow,archer}.glb, assets/blender/characters/enemies.blend,
src/data/enemyRigs.json (per-rig clip list, height, scale ratio), build/reports/enemy_*.png previews.
"""
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Quaternion, Vector
from bpy_extras import anim_utils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HERO_BLEND = os.path.join(ROOT, "assets", "blender", "characters", "hero.blend")
OUT_DIR = os.path.join(ROOT, "public", "assets", "characters")
OUT_BLEND = os.path.join(ROOT, "assets", "blender", "characters", "enemies.blend")
OUT_JSON = os.path.join(ROOT, "src", "data", "enemyRigs.json")
REPORT = os.path.join(ROOT, "build", "reports")
FPS = 30
MIX = "mixamorig:"

KNIGHT_CLIPS = ["idle_combat", "idle_alert", "walk_fwd", "run_fwd", "walk_back", "strafe_walk_left", "strafe_walk_right",
                "atk_chop", "atk_rising_cut", "atk_lunge_cut", "atk_advancing_sweep", "atk_spin_slash", "atk_leap_slam",
                "atk_whirlwind", "kick_front", "block_idle", "block_impact", "hit_light", "hit_heavy", "death_back",
                "death_kneel", "crouch_idle", "crouch_exit", "power_up"]
HOLLOW_CLIPS = ["idle_alert", "walk_fwd", "run_fwd", "strafe_walk_left", "strafe_walk_right", "atk_chop",
                "atk_rising_cut", "atk_lunge_cut", "atk_spin_slash", "hit_light", "hit_heavy", "death_back",
                "death_kneel", "crouch_idle", "crouch_exit", "kick_front"]
ARCHER_HERO_CLIPS = ["hit_light", "hit_heavy", "death_back", "death_kneel", "crouch_idle", "crouch_exit"]

KNIGHT_MAP = {
    "Hips": "Pelvis_76", "Spine": "Spine_55", "Spine2": "Torso_54", "Neck": "Neck_1", "Head": "Head_0",
    "LeftShoulder": "Shoulder.L_26", "LeftArm": "Upperarm.L_25", "LeftForeArm": "Forearm.L_23", "LeftHand": "Hand.L_22",
    "RightShoulder": "Shoulder.R_51", "RightArm": "Upperarm.R_50", "RightForeArm": "Forearm.R_48", "RightHand": "Hand.R_47",
    "LeftUpLeg": "Thigh.L_60", "LeftLeg": "LowerLeg.L_58", "LeftFoot": "Foot.L_56",
    "RightUpLeg": "Thigh.R_66", "RightLeg": "LowerLeg.R_64", "RightFoot": "Foot.R_62",
}
# chain children used for rest-direction alignment (hero bone -> hero child bone)
DIR_CHILD = {
    "Hips": "Spine", "Spine": "Spine2", "Spine1": "Spine2", "Spine2": "Neck", "Neck": "Head",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "RightUpLeg": "RightLeg", "RightLeg": "RightFoot",
    "LeftFoot": "LeftToeBase", "RightFoot": "RightToeBase",
}
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
os.makedirs(REPORT, exist_ok=True)


def fcurves_of(action):
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves


def world_rest_rot(arm, bone):
    return (arm.matrix_world @ bone.matrix_local).to_3x3().normalized().to_quaternion()


def world_head(arm, bone):
    return arm.matrix_world @ bone.head_local


def import_model(path):
    before = set(bpy.data.objects)
    if path.lower().endswith(".glb"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=False, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    meshes = [o for o in new if o.type == "MESH" and o.find_armature() == arm]
    junk = [o for o in new if o not in meshes and o is not arm]
    # detach from importer wrapper empties, keep world transform
    mw = arm.matrix_world.copy()
    arm.parent = None
    arm.matrix_world = mw
    for m in meshes:
        mmw = m.matrix_world.copy()
        m.parent = arm
        m.matrix_world = mmw
    for o in junk:
        if o.type in ("EMPTY", "MESH") and o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    return arm, meshes


def native_action(arm):
    if arm.animation_data and arm.animation_data.action:
        return arm.animation_data.action
    return None


def capture_native_pose(arm, action, frame=None):
    """Local basis rotations of every pose bone at the native idle's first frame."""
    pose = {}
    if action:
        arm.animation_data.action = action
        if action.slots:
            arm.animation_data.action_slot = action.slots[0]
        bpy.context.scene.frame_set(int(action.frame_range[0] if frame is None else frame))
    bpy.context.view_layer.update()
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pose[pb.name] = (pb.matrix_basis.copy())
    return pose


def normalise_facing(arm, meshes, left_right, target_height=None):
    """Rotate about Z so the character faces -Y (hero convention), put feet on z=0 at the origin.
    Forward = (left - right) x up, from the upper-arm bones in rest pose."""
    bpy.context.view_layer.update()
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    L = world_head(arm, arm.data.bones[left_right[0]])
    R = world_head(arm, arm.data.bones[left_right[1]])
    fwd = (L - R).cross(Vector((0, 0, 1)))
    fwd.z = 0
    fwd.normalize()
    cur = math.atan2(fwd.y, fwd.x)
    Rm = Matrix.Rotation(-math.pi / 2 - cur, 4, "Z")
    arm.matrix_world = Rm @ arm.matrix_world
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
    height = mx.z - mn.z
    s = target_height / height if target_height else 1.0
    center = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    arm.matrix_world = Matrix.Translation(-center * s) @ Matrix.Scale(s, 4) @ arm.matrix_world
    bpy.context.view_layer.update()
    arm.data.pose_position = "POSE"
    print("  facing corrected by %.1f deg, height %.2f -> %.2f" % (math.degrees(-math.pi / 2 - cur), height, height * s))
    return height * s


def retarget(hero, enemy, bone_map, clips, native_pose, attachments, prefix_name):
    """Bake hero actions onto `enemy`. bone_map: hero short name -> enemy bone name."""
    scene = bpy.context.scene
    H = hero.data.bones
    E = enemy.data.bones
    # rest data
    hero.data.pose_position = "REST"
    enemy.data.pose_position = "REST"
    bpy.context.view_layer.update()
    H_rest = {h: world_rest_rot(hero, H[MIX + h]) for h in bone_map}
    E_rest = {h: world_rest_rot(enemy, E[e]) for h, e in bone_map.items()}
    C = {}
    for h, e in bone_map.items():
        ch = DIR_CHILD.get(h)
        while ch and ch not in bone_map:
            ch = DIR_CHILD.get(ch)
        if ch:
            dh = world_head(hero, H[MIX + ch]) - world_head(hero, H[MIX + h])
            de = world_head(enemy, E[bone_map[ch]]) - world_head(enemy, E[e])
            C[h] = de.normalized().rotation_difference(dh.normalized()) if de.length > 1e-5 and dh.length > 1e-5 else Quaternion()
        else:
            C[h] = C.get(next((p for p, c in DIR_CHILD.items() if c == h), ""), Quaternion())
    for h in bone_map:
        if h in ("Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"):
            C[h] = Quaternion()
    # leg length ratio for hips translation
    hl = (world_head(hero, H[MIX + "LeftUpLeg"]) - world_head(hero, H[MIX + "LeftFoot"])).length
    el = (world_head(enemy, E[bone_map["LeftUpLeg"]]) - world_head(enemy, E[bone_map["LeftFoot"]])).length
    ratio = el / hl
    H_hips_rest = world_head(hero, H[MIX + "Hips"])
    E_hips_rest = world_head(enemy, E[bone_map["Hips"]])
    # attachment offsets from the native pose (spear relative to hand)
    enemy.data.pose_position = "POSE"
    for pb in enemy.pose.bones:
        pb.matrix_basis = native_pose[pb.name]
    bpy.context.view_layer.update()
    att_off = {}
    for bone, driver in attachments.items():
        att_off[bone] = enemy.pose.bones[driver].matrix.inverted() @ enemy.pose.bones[bone].matrix
    hero.data.pose_position = "POSE"
    Qarm_inv = enemy.matrix_world.to_3x3().normalized().to_quaternion().inverted()
    Marm_inv = enemy.matrix_world.inverted()
    order = [b for b in E]  # bones are ordered parents-first in Blender
    rev_map = {e: h for h, e in bone_map.items()}
    made = []
    for cid in clips:
        act = bpy.data.actions.get(cid)
        if act is None:
            raise RuntimeError("hero.blend lacks action " + cid)
        hero.animation_data.action = act
        hero.animation_data.action_slot = act.slots[0]
        f0, f1 = [int(round(x)) for x in act.frame_range]
        frames = list(range(f0, f1 + 1))
        keys = {b.name: {"rot": [], "loc": []} for b in E}
        for f in frames:
            scene.frame_set(f)
            M = {}  # armature-space matrices of enemy bones
            for b in order:
                pname = b.parent.name if b.parent else None
                rest_rel = (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local.copy()
                parentM = M[pname] if pname else Matrix.Identity(4)
                base = parentM @ rest_rel
                if b.name in rev_map:
                    h = rev_map[b.name]
                    Hw = (hero.matrix_world @ hero.pose.bones[MIX + h].matrix).to_3x3().normalized().to_quaternion()
                    Ew = Hw @ H_rest[h].inverted() @ C[h] @ E_rest[h]
                    A = Qarm_inv @ Ew
                    if h == "Hips":
                        hw = hero.matrix_world @ hero.pose.bones[MIX + "Hips"].matrix.translation
                        pw = E_hips_rest + (hw - H_hips_rest) * ratio
                        t = Marm_inv @ pw
                    else:
                        t = base.translation
                    Mb = Matrix.Translation(t) @ A.to_matrix().to_4x4()
                elif b.name in att_off:
                    Mb = M[attachments[b.name]] @ att_off[b.name]
                else:
                    Mb = base @ native_pose[b.name]
                M[b.name] = Mb
                basis = base.inverted() @ Mb
                loc, rot, _sc = basis.decompose()
                keys[b.name]["rot"].append(rot)
                keys[b.name]["loc"].append(loc)
        # write a new action on the enemy
        name = "%s" % cid
        old = bpy.data.actions.get(prefix_name + name)
        if old:
            bpy.data.actions.remove(old)
        na = bpy.data.actions.new(prefix_name + name)
        na.use_fake_user = True
        enemy.animation_data_create()
        enemy.animation_data.action = na
        slot = na.slots.new(id_type="OBJECT", name=enemy.name)
        enemy.animation_data.action_slot = slot
        for b in E:
            pb = enemy.pose.bones[b.name]
            pb.rotation_mode = "QUATERNION"
            rots = keys[b.name]["rot"]
            # quaternion continuity
            for i in range(1, len(rots)):
                if rots[i].dot(rots[i - 1]) < 0:
                    rots[i] = -rots[i]
            for k in range(4):
                fc = na.fcurve_ensure_for_datablock(enemy, 'pose.bones["%s"].rotation_quaternion' % b.name, index=k)
                fc.keyframe_points.add(len(frames))
                co = []
                for i, f in enumerate(frames):
                    co += [f, rots[i][k]]
                fc.keyframe_points.foreach_set("co", co)
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
                fc.update()
            if b.name == bone_map["Hips"] or (not b.parent):
                locs = keys[b.name]["loc"]
                for k in range(3):
                    fc = na.fcurve_ensure_for_datablock(enemy, 'pose.bones["%s"].location' % b.name, index=k)
                    fc.keyframe_points.add(len(frames))
                    co = []
                    for i, f in enumerate(frames):
                        co += [f, locs[i][k]]
                    fc.keyframe_points.foreach_set("co", co)
                    fc.update()
        made.append(na.name)
        print("  retargeted", cid, "->", enemy.name, len(frames), "frames")
    hero.animation_data.action = None
    return made, ratio


def render_preview(arm, meshes, actions, path):
    tag = arm.name.lower()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 220
    scene.render.resolution_y = 260
    cam = bpy.data.objects.get("PrevCam") or bpy.data.objects.new("PrevCam", bpy.data.cameras.new("PrevCam"))
    if cam.name not in scene.collection.objects:
        scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 40
    others = [o for o in bpy.data.objects if o.type in ("MESH", "ARMATURE") and o not in meshes and o is not arm]
    for o in others:
        o.hide_render = True
    frames = []
    from mathutils import Vector as V
    for i, an in enumerate(actions):
        a = bpy.data.actions[an]
        arm.animation_data.action = a
        arm.animation_data.action_slot = a.slots[0]
        f0, f1 = a.frame_range
        for j, fr in enumerate((f0 + (f1 - f0) * 0.3, f0 + (f1 - f0) * 0.6)):
            scene.frame_set(int(fr))
            target = V((0, 0, 1.0))
            cam.location = target + V((2.6, -3.6, 0.4))
            cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
            fp = os.path.join(REPORT, "_ep_%s_%02d_%d.png" % (tag, i, j))
            scene.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            frames.append(fp)
    for o in others:
        o.hide_render = False
    return frames


def export(arm, meshes, actions, path):
    # bind every remaining action's slot to this armature once so the exporter associates them
    arm.animation_data_create()
    for a in bpy.data.actions:
        if a.slots:
            arm.animation_data.action = a
            try:
                arm.animation_data.action_slot = a.slots[0]
            except Exception as ex:
                print("slot bind failed", a.name, ex)
    arm.animation_data.action = None
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm] + meshes:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    # make only the wanted actions exportable: exporter takes all actions whose slot targets this object
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_animations=True,
                              export_animation_mode="ACTIONS", export_force_sampling=True,
                              export_optimize_animation_size=True, export_anim_single_armature=True,
                              export_reset_pose_bones=True, export_image_format="JPEG", export_jpeg_quality=85,
                              export_image_quality=85, export_skins=True, export_morph=False,
                              export_def_bones=False, export_yup=True, export_extras=False, export_cameras=False,
                              export_lights=False)
    print("EXPORTED", path, os.path.getsize(path))


def decimate(meshes, ratio):
    for m in meshes:
        if len(m.data.polygons) < 4000:
            continue
        bpy.context.view_layer.objects.active = m
        mod = m.modifiers.new("dec", "DECIMATE")
        mod.ratio = ratio
        # keep armature modifier after decimate in the stack
        while m.modifiers[0] != mod:
            bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)


def downscale_images(max_size):
    for img in bpy.data.images:
        if img.size[0] > max_size:
            img.scale(max_size, max_size)


def isolate_actions(keep_prefix):
    """Delete every action that does not belong to the rig being exported (hero clips included)."""
    for a in list(bpy.data.actions):
        if not a.name.startswith(keep_prefix):
            bpy.data.actions.remove(a)
        else:
            a.use_fake_user = True


def main():
    rigs = {}
    # ---------------------------------------------------------------- KNIGHT
    bpy.ops.wm.open_mainfile(filepath=HERO_BLEND)
    hero = bpy.data.objects["Hero"]
    hero.animation_data_create()
    arm, meshes = import_model(os.path.join(ROOT, "assets/characters/enemy/armored_guard_knight_rig.glb"))
    arm.name = "Knight"
    nat = native_action(arm)
    native = capture_native_pose(arm, nat)
    if nat:
        arm.animation_data.action = None
    h = normalise_facing(arm, meshes, ("Upperarm.L_25", "Upperarm.R_50"), target_height=1.9)
    decimate(meshes, 0.5)
    spear_parent = arm.data.bones["Spear_78"].parent.name if arm.data.bones["Spear_78"].parent else None
    atts = {} if spear_parent == "Hand.R_47" else {"Spear_78": "Hand.R_47"}
    made, ratio = retarget(hero, arm, KNIGHT_MAP, KNIGHT_CLIPS, native, atts, "K_")
    for a in list(bpy.data.actions):
        if a == nat:
            bpy.data.actions.remove(a)
    isolate_actions("K_")
    for a in bpy.data.actions:
        if a.name.startswith("K_"):
            a.name = a.name  # keep
    downscale_images(1024)
    prev = render_preview(arm, meshes, ["K_idle_combat", "K_walk_fwd", "K_atk_chop", "K_atk_spin_slash", "K_hit_heavy", "K_death_back"], None)
    rigs["knight"] = {"clips": [m for m in made], "height": round(h, 3), "ratio": round(ratio, 3), "spearParent": spear_parent, "preview": prev}
    # strip prefix for export names
    for a in bpy.data.actions:
        if a.name.startswith("K_"):
            a.name = a.name[2:]
    hero.hide_set(True)
    export(arm, meshes, [a.name for a in bpy.data.actions if a.use_fake_user], os.path.join(OUT_DIR, "knight.glb"))
    for a in bpy.data.actions:
        if a.use_fake_user:
            a.name = "K_" + a.name
    rigs["knight"]["clips"] = [c[2:] for c in made]
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND.replace(".blend", "_knight.blend"), compress=True)

    # ---------------------------------------------------------------- HOLLOW (necromorph, mixamo names + suffixes)
    bpy.ops.wm.open_mainfile(filepath=HERO_BLEND)
    hero = bpy.data.objects["Hero"]
    hero.animation_data_create()
    arm, meshes = import_model(os.path.join(ROOT, "assets/characters/enemy/zombie_monster_slasher_necromorph.glb"))
    arm.name = "Hollow"
    nat = native_action(arm)
    native = capture_native_pose(arm, nat)
    if nat:
        arm.animation_data.action = None
    bmap = {}
    for b in arm.data.bones:
        if b.name.startswith(MIX):
            short = b.name[len(MIX):].rsplit("_", 1)[0]
            if short in DIR_CHILD or short in ("Head", "LeftHand", "RightHand", "Spine1"):
                bmap[short] = b.name
    h = normalise_facing(arm, meshes, (bmap["LeftArm"], bmap["RightArm"]), target_height=1.95)
    for k in ("LeftToeBase", "RightToeBase"):
        bmap.pop(k, None)
    made, ratio = retarget(hero, arm, bmap, HOLLOW_CLIPS, native, {}, "Z_")
    native_name = None
    if nat:
        nat.name = "Z_native_roar"
        nat.use_fake_user = True
        native_name = "native_roar"
    isolate_actions("Z_")
    downscale_images(1024)
    prev = render_preview(arm, meshes, ["Z_idle_alert", "Z_run_fwd", "Z_atk_chop", "Z_atk_rising_cut", "Z_hit_heavy", "Z_death_back"], None)
    for a in bpy.data.actions:
        if a.name.startswith("Z_"):
            a.name = a.name[2:]
    hero.hide_set(True)
    export(arm, meshes, [], os.path.join(OUT_DIR, "hollow.glb"))
    rigs["hollow"] = {"clips": [c[2:] for c in made] + ([native_name] if native_name else []), "height": round(h, 3),
                      "ratio": round(ratio, 3), "preview": prev, "boneMap": bmap}
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND.replace(".blend", "_hollow.blend"), compress=True)

    # ---------------------------------------------------------------- ARCHER (Erika, Mixamo)
    bpy.ops.wm.open_mainfile(filepath=HERO_BLEND)
    hero = bpy.data.objects["Hero"]
    hero.animation_data_create()
    pack = os.path.join(ROOT, "assets", "extracted", "characters", "enemy", "Longbow Aiming Pack")
    arm, meshes = import_model(os.path.join(pack, "Erika Archer With Bow Arrow.fbx"))
    arm.name = "Archer"
    nat = native_action(arm)
    native = capture_native_pose(arm, None)
    if nat:
        arm.animation_data.action = None
        bpy.data.actions.remove(nat)
    # native archer clips: import each FBX, keep its action (same skeleton), strip horizontal root motion
    native_ids = {"standing idle 01": "a_idle", "standing draw arrow": "a_draw", "standing aim overdraw": "a_aim",
                  "standing aim recoil": "a_recoil", "standing aim walk forward": "a_walk_fwd",
                  "standing aim walk back": "a_walk_back", "standing aim walk left": "a_walk_left",
                  "standing aim walk right": "a_walk_right"}
    imported = []
    for fn, cid in native_ids.items():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=os.path.join(pack, fn + ".fbx"), use_anim=True)
        new = [o for o in bpy.data.objects if o not in before]
        src = next(o for o in new if o.type == "ARMATURE")
        act = src.animation_data.action
        src.animation_data.action = None
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        act.name = "A_" + cid
        act.use_fake_user = True
        # strip horizontal hips translation (code-driven movement)
        hips = arm.data.bones[MIX + "Hips"]
        Mx = (arm.matrix_world.to_3x3() @ hips.matrix_local.to_3x3()).inverted()
        fcs = sorted([fc for fc in fcurves_of(act) if fc.data_path == 'pose.bones["mixamorig:Hips"].location'], key=lambda f: f.array_index)
        if len(fcs) == 3:
            f0, f1 = [int(round(x)) for x in act.frame_range]
            vals = [[fc.evaluate(f) for f in range(f0, f1 + 1)] for fc in fcs]
            # world displacement per frame relative to frame 0, horizontal part only
            Mw = arm.matrix_world.to_3x3() @ hips.matrix_local.to_3x3()
            for i in range(len(vals[0])):
                d = Mw @ Vector((vals[0][i] - vals[0][0], vals[1][i] - vals[1][0], vals[2][i] - vals[2][0]))
                d.z = 0
                dl = Mx @ d
                for k in range(3):
                    vals[k][i] -= dl[k]
            for k, fc in enumerate(fcs):
                fc.keyframe_points.clear()
                fc.keyframe_points.add(len(vals[k]))
                fc.keyframe_points.foreach_set("co", [c for i, v in enumerate(vals[k]) for c in (f0 + i, v)])
                fc.update()
        imported.append(cid)
    h = normalise_facing(arm, meshes, (MIX + "LeftArm", MIX + "RightArm"))
    bmap = {}
    for b in arm.data.bones:
        if b.name.startswith(MIX):
            short = b.name[len(MIX):]
            if short in DIR_CHILD or short in ("Head", "LeftHand", "RightHand"):
                bmap[short] = b.name
    for k in ("LeftToeBase", "RightToeBase"):
        bmap.pop(k, None)
    made, ratio = retarget(hero, arm, bmap, ARCHER_HERO_CLIPS, native, {}, "A_")
    isolate_actions("A_")
    downscale_images(1024)
    prev = render_preview(arm, meshes, ["A_a_idle", "A_a_aim", "A_a_recoil", "A_a_walk_left", "A_hit_heavy", "A_death_back"], None)
    for a in bpy.data.actions:
        if a.name.startswith("A_"):
            a.name = a.name[2:]
    hero.hide_set(True)
    export(arm, meshes, [], os.path.join(OUT_DIR, "archer.glb"))
    rigs["archer"] = {"clips": [c[2:] for c in made] + imported, "height": round(h, 3), "ratio": round(ratio, 3), "preview": prev}
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND.replace(".blend", "_archer.blend"), compress=True)

    for k in rigs:
        rigs[k].pop("preview", None)
    json.dump(rigs, open(OUT_JSON, "w"), indent=1)
    print("ENEMIES OK", json.dumps({k: {"n": len(v["clips"]), "h": v["height"], "r": v["ratio"]} for k, v in rigs.items()}))


main()
