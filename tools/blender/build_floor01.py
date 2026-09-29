"""Deterministic Floor 1 build: layout -> Blender scene -> .blend + GLB exports + report + plan renders.

Run (headless):
  blender --background --factory-startup --python tools/blender/build_floor01.py [-- --no-render]

Outputs
  assets/blender/levels/floor01.blend           durable authoring file (collections per section/state)
  assets/blender/modular_kit/castle_kit.blend   the modular kit laid out for reuse
  public/assets/levels/floor01.glb              visual meshes (materials by name, no images) + markers
  public/assets/levels/floor01_collision.glb    collision meshes only
  build/reports/floor01_report.json             tri counts, marker inventory, validation results
  build/reports/floor01_plan_{past,present}.png top-down plan renders
"""
import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib
import castlekit
import floor01_layout
importlib.reload(castlekit)
importlib.reload(floor01_layout)

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MATDIR = os.path.join(ROOT, "assets", "extracted", "materials")
OUT_BLEND = os.path.join(ROOT, "assets", "blender", "levels", "floor01.blend")
OUT_KIT = os.path.join(ROOT, "assets", "blender", "modular_kit", "castle_kit.blend")
OUT_GLB = os.path.join(ROOT, "public", "assets", "levels", "floor01.glb")
OUT_COL = os.path.join(ROOT, "public", "assets", "levels", "floor01_collision.glb")
OUT_REPORT = os.path.join(ROOT, "build", "reports", "floor01_report.json")
REPORT_DIR = os.path.dirname(OUT_REPORT)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_RENDER = "--no-render" not in argv

for p in (OUT_BLEND, OUT_KIT, OUT_GLB, OUT_REPORT):
    os.makedirs(os.path.dirname(p), exist_ok=True)

# --------------------------------------------------------------------------- materials
TEX = {
    "stone_wall": ("stone", "stone_wall_04_1k", "stone_wall_04", (1, 1, 1)),
    "stone_block": ("stone", "japanese_stone_wall_1k", "japanese_stone_wall", (1, 1, 1)),
    "marble": ("stone", "marble_01_1k", "marble_01", (1, 1, 1)),
    "rock": ("stone", "dark_rock_02_1k", "dark_rock_02", (1, 1, 1)),
    "terrain": ("stone", "rocky_terrain_03_1k", "rocky_terrain_03", (1, 1, 1)),
    "wood_fine": ("wood", "coated_pine_02_1k", "coated_pine_02", (0.55, 0.4, 0.3)),
    "wood_rough": ("wood", "rough_wood_1k", "rough_wood", (0.9, 0.82, 0.7)),
    "wood_planks": ("wood", "wood_planks_dirt_1k", "wood_planks_dirt", (1, 1, 1)),
    "wood_moss": ("wood", "moss_wood_1k", "moss_wood", (1, 1, 1)),
    "wood_door": ("wood", "wood_shutter_1k", "wood_shutter", (0.8, 0.7, 0.6)),
    "iron": ("metal", "metal_plate_02_1k", "metal_plate_02", (1, 1, 1)),
    "rust": ("metal", "rust_coarse_01_1k", "rust_coarse_01", (1, 1, 1)),
    "rust_plate": ("metal", "rusty_metal_04_1k", "rusty_metal_04", (1, 1, 1)),
    "fabric_royal": ("fabric", "quatrefoil_jacquard_fabric_1k", "quatrefoil_jacquard_fabric", (1, 1, 1)),
    "fabric_gold": ("fabric", "crepe_satin_1k", "crepe_satin", (1, 1, 1)),
    "fabric_linen": ("fabric", "rough_linen_1k", "rough_linen", (1.0, 0.85, 0.62)),
}
# state-variant materials: Blender preview uses the Past look; runtime swaps per state
VARIANT_PREVIEW = {"ward_ground": "stone_block", "timber": "wood_rough", "iron_rust": "iron", "fabric_banner": "fabric_royal"}
FLAT = {
    "bone": ((0.78, 0.74, 0.66), 0.0), "candle": ((0.92, 0.88, 0.75), 0.0),
    "fx_ember": ((1.0, 0.35, 0.08), 6.0), "fx_flame": ((1.0, 0.6, 0.2), 8.0),
    "fx_crown": ((1.0, 0.25, 0.08), 12.0), "fx_sigil": ((0.75, 0.05, 0.05), 4.0),
    "fx_fissure": ((0.2, 0.8, 1.0), 5.0), "fx_void": ((0.0, 0.0, 0.0), 0.0),
    "fx_blood": ((0.35, 0.0, 0.0), 0.5),
}
_mat_cache = {}


def get_material(key):
    if key in _mat_cache:
        return _mat_cache[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    src_key = VARIANT_PREVIEW.get(key, key)
    if src_key in TEX:
        cat, folder, stem, tint = TEX[src_key]
        base = os.path.join(MATDIR, cat, folder, "textures", stem)
        diff = nt.nodes.new("ShaderNodeTexImage")
        diff.image = bpy.data.images.load(base + "_diff_1k.jpg", check_existing=True)
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        nt.links.new(diff.outputs["Color"], mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1.0)
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        nor = nt.nodes.new("ShaderNodeTexImage")
        nor.image = bpy.data.images.load(base + "_nor_gl_1k.png", check_existing=True)
        nor.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        arm = nt.nodes.new("ShaderNodeTexImage")
        arm.image = bpy.data.images.load(base + "_arm_1k.png", check_existing=True)
        arm.image.colorspace_settings.name = "Non-Color"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(arm.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        m.diffuse_color = (*[0.5 * t for t in tint], 1.0)
    elif key in FLAT:
        col, em = FLAT[key]
        bsdf.inputs["Base Color"].default_value = (*col, 1.0)
        if em > 0:
            bsdf.inputs["Emission Color"].default_value = (*col, 1.0)
            bsdf.inputs["Emission Strength"].default_value = em
        m.diffuse_color = (*col, 1.0)
    else:
        raise KeyError("Material key has no definition: " + key)
    m["runtime_key"] = key
    _mat_cache[key] = m
    return m


# --------------------------------------------------------------------------- scene helpers
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mat_cache.clear()
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    return sc


def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def mesh_from_batch(name, batch, mat=None, uv=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(batch.verts, [], batch.faces)
    if uv and batch.uvs:
        layer = me.uv_layers.new(name="UVMap")
        data = layer.data
        for poly, fuv, sm in zip(me.polygons, batch.uvs, batch.smooth):
            for k, li in enumerate(range(poly.loop_start, poly.loop_start + poly.loop_total)):
                data[li].uv = fuv[k]
            poly.use_smooth = sm
    me.validate(clean_customdata=False)
    me.update()
    if mat is not None:
        me.materials.append(mat)
    return me


def json_safe(v):
    if isinstance(v, (tuple, list)):
        return [json_safe(x) for x in v]
    if isinstance(v, float):
        return round(v, 4)
    return v


def emit(B, root_name="FLOOR_01", col_root_name="COLLISION", mk_root_name="MARKERS"):
    root = collection(root_name)
    colroot = collection(col_root_name)
    mkroot = collection(mk_root_name)
    vis_objs, col_objs, mk_objs = [], [], []
    for (section, group, mat), batch in sorted(B.vis.items()):
        if not batch.faces:
            continue
        sec = collection(section, root)
        grp = collection("%s_%s" % (section, group), sec)
        name = "%s.%s.%s" % (section, group, mat)
        me = mesh_from_batch(name, batch, get_material(mat))
        ob = bpy.data.objects.new(name, me)
        ob["section"] = section
        ob["group"] = group
        ob["mat"] = mat
        grp.objects.link(ob)
        vis_objs.append(ob)
    for (section, group), batch in sorted(B.col.items()):
        if not batch.faces:
            continue
        grp = collection("COL_%s" % group, colroot)
        name = "COL.%s.%s" % (section, group)
        me = mesh_from_batch(name, batch, None, uv=False)
        ob = bpy.data.objects.new(name, me)
        ob["section"] = section
        ob["group"] = group
        ob["collision"] = True
        ob.display_type = "WIRE"
        grp.objects.link(ob)
        col_objs.append(ob)
    counts = {}
    for m in B.markers:
        kind = m["kind"]
        counts[kind] = counts.get(kind, 0) + 1
        nm = m["name"] or "%s_%03d" % (kind, counts[kind])
        ob = bpy.data.objects.new("MK.%s.%s" % (kind, nm), None)
        ob.location = m["pos"]
        if "size" in m:
            ob.empty_display_type = "CUBE"
            ob.scale = (m["size"][0] / 2, m["size"][1] / 2, m["size"][2] / 2)
            ob["size"] = json_safe(m["size"])
        else:
            ob.empty_display_type = "PLAIN_AXES"
            ob.empty_display_size = 0.5
        ob["marker"] = kind
        ob["mk_name"] = nm
        ob["section"] = m["section"]
        ob["group"] = m["group"]
        for k, v in m["props"].items():
            ob[k] = json_safe(v)
        collection("MK_%s" % kind, mkroot).objects.link(ob)
        mk_objs.append(ob)
    return vis_objs, col_objs, mk_objs


def export_glb(path, objs, **kw):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    args = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
                export_animations=False, export_cameras=False, export_lights=False, export_extras=True,
                export_skins=False, export_morph=False)
    args.update(kw)
    bpy.ops.export_scene.gltf(**args)


# --------------------------------------------------------------------------- validation
def validate(B):
    issues = []
    enc = {}
    enemies = {}
    for m in B.markers:
        if m["kind"] == "encounter":
            enc[m["props"]["eid"]] = m
        if m["kind"] == "enemy":
            enemies.setdefault(m["props"]["encounter"], []).append(m)
    for eid, m in enc.items():
        if eid not in enemies:
            issues.append("encounter %s has no enemies" % eid)
    for eid in enemies:
        if eid not in enc:
            issues.append("enemies reference unknown encounter %s" % eid)
    sig = sorted(m["props"]["cid"] for m in B.markers if m["kind"] == "sigil")
    fis = sorted(m["props"]["fid"] for m in B.markers if m["kind"] == "fissure")
    if sig != ["CP1", "CP2", "CP3", "CP4", "CP5", "CP6"]:
        issues.append("sigils mismatch: %s" % sig)
    if sorted(fis, key=lambda s: int(s[1:])) != ["F%d" % i for i in range(1, 11)]:
        issues.append("fissures mismatch: %s" % fis)
    if not any(m["kind"] == "spawn" for m in B.markers):
        issues.append("no spawn")
    if not any(m["kind"] == "exit" for m in B.markers):
        issues.append("no exit")
    for key in list(B.vis.keys()):
        get_material(key[2])  # raises on undefined
    return issues


def tri_report(B):
    rep = {}
    for (section, group, mat), b in B.vis.items():
        rep.setdefault(section, {}).setdefault(group, 0)
        rep[section][group] += b.tri_count()
    col = {}
    for (section, group), b in B.col.items():
        col.setdefault(section, {})[group] = b.tri_count()
    return rep, col


# --------------------------------------------------------------------------- plan renders
def render_plans(vis_objs, col_objs):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.display.shading.show_cavity = True
    sc.display.shading.show_shadows = False
    for o in col_objs:
        o.hide_render = True
    cam = bpy.data.objects.new("PlanCam", bpy.data.cameras.new("PlanCam"))
    sc.collection.objects.link(cam)
    sc.camera = cam

    def show_state(state):
        for o in vis_objs:
            o.hide_render = o["group"] not in ("SHARED", state)

    # top-down plans, cut at 7.8 m to remove roofs
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 118
    cam.data.clip_end = 400
    cam.location = (0, 3.5, 120)
    cam.rotation_euler = (0, 0, 0)
    cam.data.clip_start = 120 - 7.8
    sc.render.resolution_x = 1400
    sc.render.resolution_y = 1700
    for state in ("PAST", "PRESENT"):
        show_state(state)
        sc.render.filepath = os.path.join(REPORT_DIR, "floor01_plan_%s.png" % state.lower())
        bpy.ops.render.render(write_still=True)
    # perspective QA views: (name, camera location, look-at)
    views = [
        ("gate", (2.5, -49.5, 2.2), (0, -32, 2.0)),
        ("ward", (18, -27, 7), (-6, -6, 1)),
        ("armory", (31, 12, 4.5), (21, 21, 3)),
        ("hall", (15, 11, 9), (-4, 34, 1)),
        ("gallery", (16, 28.5, 7.8), (8, 10.5, 6.5)),
        ("chapel", (-24, 14, 8.5), (-30, 36, -1)),
        ("under", (-15, 23, -3.5), (10, 36, -4)),
        ("royal", (0, 30, 3.5), (0, 50, 5)),
    ]
    cam.data.type = "PERSP"
    cam.data.lens = 24
    cam.data.clip_start = 0.1
    sc.render.resolution_x = 960
    sc.render.resolution_y = 600
    from mathutils import Vector
    for name, loc, look in views:
        cam.location = loc
        cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        for state in ("PAST", "PRESENT"):
            show_state(state)
            sc.render.filepath = os.path.join(REPORT_DIR, "f01_%s_%s.png" % (name, state.lower()))
            bpy.ops.render.render(write_still=True)
    for o in vis_objs:
        o.hide_render = False


# --------------------------------------------------------------------------- modular kit file
def build_kit_file():
    reset_scene()
    K = castlekit.Builder(seed=7)
    with K.at("KIT", "SHARED"):
        x = 0.0
        K.wall(x, x + 6, 0, 2, 0, 6, openings=[(x + 1.8, x + 4.2, 0, 3.2)], axis="x"); x += 8
        K.wall(x, x + 6, 0, 2, 0, 6, openings=[(x + 1.5, x + 4.5, 0, 3.6, "flat")], axis="x"); x += 8
        K.column(x + 1, 1, 0, 5.4); x += 3
        K.stairs(x, x + 2.6, 0, 5, 0, 3, "+y"); x += 4
        K.parapet(x, x + 4, 0, 0.3, 0); x += 6
        K.portcullis(x, x + 4, 1, 0, 4); x += 6
        K.door_leaf((x, 1, 0), 2.4, 3.2, "x"); x += 4
        K.barrel(x + 0.5, 1); K.crate(x + 1.8, 1); K.table(x + 4, 1, 2.4); x += 7
        K.bench(x + 1, 1, 2.0); K.bunk(x + 4, 1); K.weapon_rack(x + 7, 1); x += 10
        K.brazier(x + 1, 1); K.torch(x + 3, 0, 2.5, "+y"); x += 5
        K.banner(x, x + 2, 0, 5, 4, "+y"); K.tent(x + 5, 1, 4, 3, 2.6); x += 9
        K.cart(x + 2, 1); K.pew(x + 6, 1, 2.8); K.sarcophagus(x + 9, 1); x += 12
        K.mound(x + 3, 2, 2.5, 2.5, 1.6); x += 7
        K.rubble_ramp(x, x + 3, 0, 5, 0, 3, "y", 1); x += 5
        K.barrel_vault("y", 0, 4, x, x + 6, 3.0); x += 8
        K.arch_spandrel("x", x, x + 2.4, 3.2, (0, 0.6), "stone_wall")
    vis, col, mk = emit(K, "KIT", "KIT_COLLISION", "KIT_MARKERS")
    bpy.ops.wm.save_as_mainfile(filepath=OUT_KIT, compress=True)
    return len(vis)


# --------------------------------------------------------------------------- main
def main():
    kit_objects = build_kit_file()
    reset_scene()
    B = castlekit.Builder(seed=2026)
    floor01_layout.build_all(B)
    issues = validate(B)
    vis, col, mk = emit(B)
    tris, coltris = tri_report(B)
    mcount = {}
    for m in B.markers:
        mcount[m["kind"]] = mcount.get(m["kind"], 0) + 1
    enemy_count = {}
    for m in B.markers:
        if m["kind"] == "enemy":
            k = (m["props"]["state"], m["props"]["archetype"])
            enemy_count["%s:%s" % k] = enemy_count.get("%s:%s" % k, 0) + 1
    bpy.context.scene["floor"] = "FLOOR_01"
    bpy.context.scene["sections"] = json.dumps(floor01_layout.SECTIONS)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, compress=True)
    export_glb(OUT_GLB, vis + mk, export_materials="EXPORT", export_image_format="NONE", export_normals=True,
               export_texcoords=True)
    export_glb(OUT_COL, col, export_materials="NONE", export_normals=False, export_texcoords=False)
    report = {
        "issues": issues, "visual_objects": len(vis), "collision_objects": len(col), "markers": mcount,
        "enemies": enemy_count, "tris_visual": tris, "tris_collision": coltris,
        "tris_visual_total": sum(v for s in tris.values() for v in s.values()),
        "tris_collision_total": sum(v for s in coltris.values() for v in s.values()),
        "glb_bytes": os.path.getsize(OUT_GLB), "collision_glb_bytes": os.path.getsize(OUT_COL),
        "kit_objects": kit_objects, "sections": floor01_layout.SECTIONS,
    }
    json.dump(report, open(OUT_REPORT, "w"), indent=1)
    print("FLOOR01 BUILD", json.dumps({k: report[k] for k in ("issues", "visual_objects", "collision_objects",
                                                               "tris_visual_total", "tris_collision_total",
                                                               "glb_bytes", "collision_glb_bytes")}))
    if DO_RENDER:
        render_plans(vis, col)


main()
