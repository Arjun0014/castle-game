"""Session 9 monsters: the goblin gets the hero's sword-and-shield clips retargeted onto its 3ds Max Biped rig.

Run (headless, after build_hero.py):
  blender --background --factory-startup --python tools/blender/build_monsters.py

The other new monsters (bat, widow) keep their own single clip and are animated procedurally at
runtime (src/enemies/Monsters.ts), so their GLBs ship as byte copies of the sources (COPIES below; GameAssets
normalises scale/orientation/materials at load, like the ghost).

Goblin (assets/characters/enemy/gobelin_monster.glb, Sketchfab, CC-BY-4.0 XialiMu.Bell): 3.1k tris, 70-joint Biped,
one idle clip, a scimitar mesh ("arms_ok") parented to the Dummy001 bone under the right hand. Retarget method and
helpers: tools/blender/build_enemies.py (world-space delta with rest-direction alignment). Height 1.32 m. The
scimitar keeps its native offset from the hand. Outputs public/assets/characters/goblin.glb,
assets/blender/characters/enemies_goblin.blend, src/data/monsterRigs.json, build/reports/_ep_goblin_*.png.
"""
import bpy
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
import build_enemies as BE  # noqa: E402  (helpers only: its main() is guarded)

ROOT = BE.ROOT
OUT_JSON = os.path.join(ROOT, "src", "data", "monsterRigs.json")

GOBLIN_CLIPS = ["idle_combat", "idle_alert", "walk_fwd", "run_fwd", "walk_back", "run_back", "strafe_run_left",
                "strafe_run_right", "strafe_walk_left", "strafe_walk_right", "atk_chop", "atk_rising_cut",
                "atk_lunge_cut", "atk_leap_slam", "atk_jump_spin", "atk_spin_slash", "kick_front", "hit_light",
                "hit_heavy", "death_back", "death_kneel", "crouch_idle", "crouch_exit", "power_up", "jump_stand"]
# mixamo short name -> Biped bone base name (the importer appends _NN node suffixes)
GOBLIN_MAP = {
    "Hips": "Bip001 Pelvis", "Spine": "Bip001 Spine", "Spine2": "Bip001 Spine1", "Neck": "Bip001 Neck", "Head": "Bip001 Head",
    "LeftShoulder": "Bip001 L Clavicle", "LeftArm": "Bip001 L UpperArm", "LeftForeArm": "Bip001 L Forearm", "LeftHand": "Bip001 L Hand",
    "RightShoulder": "Bip001 R Clavicle", "RightArm": "Bip001 R UpperArm", "RightForeArm": "Bip001 R Forearm", "RightHand": "Bip001 R Hand",
    "LeftUpLeg": "Bip001 L Thigh", "LeftLeg": "Bip001 L Calf", "LeftFoot": "Bip001 L Foot",
    "RightUpLeg": "Bip001 R Thigh", "RightLeg": "Bip001 R Calf", "RightFoot": "Bip001 R Foot",
}


# unmodified runtime copies (Sketchfab, all CC-BY-4.0; credits in src/ui/Menu.ts CREDITS)
# (session 11: the lamia copy of monster-_module_xb1011.glb is gone — the Maw is the Creature Pack Mutant, build_mutant.py)
COPIES = {"bat_dark_bad_cartoon_monster.glb": "bat.glb", "ragno_monster.glb": "widow.glb"}


def import_goblin(path):
    """Import keeping the bone-parented scimitar (build_enemies.import_model would delete it as junk)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    skinned = [o for o in new if o.type == "MESH" and o.find_armature() == arm]
    weapon = [o for o in new if o.parent_type == "BONE" and o.parent == arm]
    weapon_meshes = [c for w in weapon for c in w.children_recursive if c.type == "MESH"]
    keep = set([arm] + skinned + weapon + weapon_meshes)
    mw = arm.matrix_world.copy()
    arm.parent = None
    arm.matrix_world = mw
    for m in skinned:
        mmw = m.matrix_world.copy()
        m.parent = arm
        m.matrix_world = mmw
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    return arm, skinned, weapon + weapon_meshes


def main():
    for src, dst in COPIES.items():
        shutil.copyfile(os.path.join(ROOT, "assets/characters/enemy", src), os.path.join(BE.OUT_DIR, dst))
        print("COPIED", src, "->", dst)
    rigs = {}
    bpy.ops.wm.open_mainfile(filepath=BE.HERO_BLEND)
    hero = bpy.data.objects["Hero"]
    hero.animation_data_create()
    arm, meshes, extras = import_goblin(os.path.join(ROOT, "assets/characters/enemy/gobelin_monster.glb"))
    arm.name = "Goblin"
    names = {b.name.rsplit("_", 1)[0]: b.name for b in arm.data.bones}
    bmap = {k: names[v] for k, v in GOBLIN_MAP.items()}
    nat = BE.native_action(arm)
    native = BE.capture_native_pose(arm, nat)
    if nat:
        arm.animation_data.action = None
    h = BE.normalise_facing(arm, meshes, (bmap["LeftArm"], bmap["RightArm"]), target_height=1.32)
    made, ratio = BE.retarget(hero, arm, bmap, GOBLIN_CLIPS, native, {}, "G_")
    if nat:
        bpy.data.actions.remove(nat)
    BE.isolate_actions("G_")
    BE.downscale_images(1024)
    prev = BE.render_preview(arm, meshes + [m for m in extras if m.type == "MESH"],
                             ["G_idle_combat", "G_run_fwd", "G_atk_chop", "G_atk_leap_slam", "G_atk_jump_spin", "G_death_back"], None)
    for a in bpy.data.actions:
        if a.name.startswith("G_"):
            a.name = a.name[2:]
    hero.hide_set(True)
    BE.export(arm, meshes + extras, [], os.path.join(BE.OUT_DIR, "goblin.glb"))
    rigs["goblin"] = {"clips": [c[2:] for c in made], "height": round(h, 3), "ratio": round(ratio, 3), "boneMap": bmap,
                      "source": "gobelin_monster.glb (Sketchfab XialiMu.Bell, CC-BY-4.0)"}
    bpy.ops.wm.save_as_mainfile(filepath=BE.OUT_BLEND.replace(".blend", "_goblin.blend"), compress=True)
    json.dump(rigs, open(OUT_JSON, "w"), indent=1)
    print("MONSTERS OK", json.dumps({k: {"n": len(v["clips"]), "h": v["height"], "r": v["ratio"]} for k, v in rigs.items()}), prev)


main()
