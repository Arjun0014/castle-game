"""Film v2 ("the chronicle in ink"): illustrated PANELS for a 2.5D graphic-novel cinematic in the manner of a painted
game intro — real textured characters and PBR stone, lit hard (torch key, moon rim, war glow), rendered as separate
depth layers (bg / mid / fg, RGBA) so the edit (tools/cinematic/remotion) can move them in parallax. The graphic-novel
finish (ink, hatching, grade) is applied afterwards by tools/cinematic/v2/inkfx.py.

    blender --background --factory-startup --python tools/cinematic/blender/panels.py -- --panel sealed [--pct 50]
        [--samples 24] [--layers bg,mid,fg | flat] [--out build/cinematic/v2/panels]
"""
import argparse, math, os, random, sys
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import cine, figures, gate  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
MATS = os.path.join(ROOT, 'assets', 'extracted', 'materials')
TEX = {
    'stone': ('stone', 'stone_wall_04_1k', 'stone_wall_04'),
    'rock': ('stone', 'dark_rock_02_1k', 'dark_rock_02'),
    'terrain': ('stone', 'rocky_terrain_03_1k', 'rocky_terrain_03'),
    'plank': ('wood', 'wood_planks_dirt_1k', 'wood_planks_dirt'),
    'rust': ('metal', 'rusty_metal_04_1k', 'rusty_metal_04'),
    'plate': ('metal', 'metal_plate_02_1k', 'metal_plate_02'),
    'linen': ('fabric', 'rough_linen_1k', 'rough_linen'),
}

# ------------------------------------------------------------------------------------------------ materials
def _img(path, non_color=False):
    im = bpy.data.images.load(path, check_existing=True)
    if non_color: im.colorspace_settings.name = 'Non-Color'
    return im

def pbr(name, key, scale=1.0, tint=(1, 1, 1), rough_add=0.0, dark=1.0):
    """Box-projected Poly Haven set (object coordinates = world metres for MeshBuilder geometry)."""
    folder, sub, stem = TEX[key]
    d = os.path.join(MATS, folder, sub, 'textures')
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0 / scale,) * 3
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    def tex(fn, nc):
        t = N.new('ShaderNodeTexImage'); t.image = _img(os.path.join(d, fn), nc)
        t.projection = 'BOX'; t.projection_blend = 0.25
        L.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    diff = tex(f'{stem}_diff_1k.jpg', False)
    mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
    L.new(diff.outputs['Color'], mul.inputs['A']); mul.inputs['B'].default_value = (tint[0] * dark, tint[1] * dark, tint[2] * dark, 1)
    L.new(mul.outputs['Result'], bsdf.inputs['Base Color'])
    arm = tex(f'{stem}_arm_1k.png', True)
    sep = N.new('ShaderNodeSeparateColor'); L.new(arm.outputs['Color'], sep.inputs[0])
    if rough_add:
        ra = N.new('ShaderNodeMath'); ra.operation = 'ADD'; ra.use_clamp = True; ra.inputs[1].default_value = rough_add
        L.new(sep.outputs[1], ra.inputs[0]); L.new(ra.outputs[0], bsdf.inputs['Roughness'])
    else:
        L.new(sep.outputs[1], bsdf.inputs['Roughness'])
    L.new(sep.outputs[2], bsdf.inputs['Metallic'])
    nm = tex(f'{stem}_nor_gl_1k.png', True)
    nmap = N.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = 1.2
    L.new(nm.outputs['Color'], nmap.inputs['Color']); L.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def emit(name, color, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    N = m.node_tree.nodes; N.remove(N['Principled BSDF'])
    e = N.new('ShaderNodeEmission'); e.inputs['Color'].default_value = cine.hexc(color); e.inputs['Strength'].default_value = strength
    m.node_tree.links.new(e.outputs[0], N['Material Output'].inputs['Surface'])
    return m

# ------------------------------------------------------------------------------------------------ world, lights
def world(color='#05070b', strength=1.0, haze=0.0, haze_color='#8a95a8', anisotropy=0.35):
    w = bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    N['Background'].inputs['Color'].default_value = cine.hexc(color); N['Background'].inputs['Strength'].default_value = strength
    if haze > 0:
        v = N.new('ShaderNodeVolumePrincipled'); v.inputs['Density'].default_value = haze
        v.inputs['Color'].default_value = cine.hexc(haze_color); v.inputs['Anisotropy'].default_value = anisotropy
        L.new(v.outputs[0], N['World Output'].inputs['Volume'])
    return w

def light(kind, name, loc, color, energy, size=0.5, target=None, spot=None, shadow=True):
    ld = bpy.data.lights.new(name, kind); ld.color = cine.hexc(color)[:3]; ld.energy = energy
    if kind in ('POINT', 'SPOT'): ld.shadow_soft_size = size
    if kind == 'AREA': ld.size = size
    if kind == 'SPOT' and spot: ld.spot_size = math.radians(spot); ld.spot_blend = 0.6
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    if target is not None: cine.look_at(ob, Vector(target))
    return ob

# ------------------------------------------------------------------------------------------------ characters
def clip_name(kind, clip):
    return ('K_' + clip) if kind == 'knight' else ('a_' + clip if kind == 'archer' and clip in ('aim', 'draw', 'idle', 'recoil') else clip)

def person(kind, name, coll, clip, frame, loc, facing, scale=1.0, hide=()):
    cn = clip_name(kind, clip)
    f = figures.load(kind, name, coll, actions=(cn,))
    figures.hold_pose(f, cn, frame)
    f.place(loc, facing_deg=facing, scale=scale)
    if hide: f.hide(*hide)
    if kind == 'archer':
        # the archer file's mesh NAMES are scrambled (the body is "Arrow_Mesh", the bow is "Body_Mesh"):
        # hide the props by material instead, and show everything else
        for m in f.meshes:
            mats = {sl.material.name for sl in m.material_slots if sl.material}
            m.hide_render = m.hide_viewport = bool(mats & {'Bow_MAT', 'phong1'})
    return f

GLB = os.path.join(ROOT, 'public', 'assets', 'characters')
GLB_YAW = {'knight': 180.0}   # measured with the square-on walk pose: the knight rig faces +Y at yaw 0

class GPerson:
    def __init__(self, arm, meshes, kind='knight'): self.arm, self.meshes, self.kind = arm, meshes, kind
    def bone(self, key): return figures.BONES[self.kind].get(key, key)

def glb_person(kind, name, clip, frame, loc, facing, scale=1.0, coll='MID'):
    """A runtime character (public/assets/characters/<kind>.glb: clean clip names, real textures), posed at `frame`
    (30 fps clip frames) of `clip`, feet on z=loc.z, facing `facing` degrees from +X (the rigs face -Y at yaw 0)."""
    before = set(bpy.data.objects); acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(GLB, kind + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    root = arm
    while root.parent is not None: root = root.parent
    # the importer adds a display shape for bones (an icosphere) that would render: keep only meshes skinned to the rig
    for o in [o for o in new if o.type == 'MESH' and not any(m.type == 'ARMATURE' for m in o.modifiers)]:
        new.remove(o); bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in new if o.type == 'MESH']
    acts = [a for a in bpy.data.actions if a not in acts_before]
    act = next((a for a in acts if a.name == clip), None) or next(a for a in acts if clip in a.name)
    if arm.animation_data: arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks if arm.animation_data else []): arm.animation_data.nla_tracks.remove(tr)
    figures.hold_pose(GPerson(arm, meshes), act.name, frame)
    root.location = loc; root.rotation_mode = 'XYZ'
    root.rotation_euler = (root.rotation_euler.x, root.rotation_euler.y, math.radians(facing + 90.0 + GLB_YAW.get(kind, 0.0)))
    root.scale = tuple(v * scale for v in root.scale)          # keep the file's own unit scale (the knight is in cm)
    for o in new: o.name = f'{name}_{o.name}'
    to_coll(new, coll)
    return GPerson(arm, meshes, kind)

def bone_pos(fig, bone):
    """World position of a posed bone's head and tail (stills: the pose is fixed)."""
    bpy.context.view_layer.update()
    pb = fig.arm.pose.bones[figures.BONES[fig.kind].get(bone, bone) if hasattr(fig, 'kind') else bone]
    mw = fig.arm.matrix_world
    return mw @ pb.head, mw @ pb.tail

def place_prop(ob, at, rot=(0, 0, 0), coll='MID'):
    ob.parent = None; ob.location = at; ob.rotation_euler = rot; ob.scale = (1, 1, 1)
    to_coll([ob], coll)
    return ob

def to_coll(objs, coll):
    c = cine.coll(coll)
    for o in objs:
        for uc in list(o.users_collection): uc.objects.unlink(o)
        c.objects.link(o)

# ------------------------------------------------------------------------------------------------ panels
def p_sealed(a):
    """The last night: inside the gate passage the portcullis is down; the royal guard have turned their spears on
    the people they were sworn to shelter. Red war-light beyond the bars, a torch on the crowd, moon from above."""
    world('#030406', 1.0, haze=0.035, haze_color='#9aa4b5')
    stone, rock = pbr('stone', 'stone', 1.6, tint=(0.62, 0.64, 0.7)), pbr('floor', 'terrain', 2.2, tint=(0.5, 0.5, 0.55))
    rust = pbr('rust', 'rust', 0.6, tint=(0.5, 0.45, 0.42))
    mb = cine.MeshBuilder()
    W, H = 2.6, 4.8
    mb.box('BG', rock, -W, W, -9.0, 9.0, -0.2, 0.0)                      # floor
    mb.box('BG', stone, -W - 0.8, -W, -9.0, 9.0, 0.0, H)                  # walls
    mb.box('BG', stone, W, W + 0.8, -9.0, 9.0, 0.0, H)
    gate.barrel_vault(mb, 'BG', stone, -9.0, 5.0, w=W, spring=H - W)
    # the gate wall with the arch, portcullis down in it
    prof = [(-W, 0.0), (-1.7, 0.0)] + [(-1.7 * math.cos(math.pi * i / 20), 3.0 + 1.7 * math.sin(math.pi * i / 20)) for i in range(21)] + [(1.7, 0.0), (W, 0.0), (W, H + 0.8), (-W, H + 0.8)]
    gate.extrude_profile(mb, 'BG', stone, prof, 5.0, 5.9)
    for i in range(11):
        x = -1.6 + i * 0.32
        mb.box('BG', rust, x - 0.045, x + 0.045, 5.35, 5.45, 0.0, 4.9)
    for z in (0.9, 2.0, 3.1, 4.1):
        mb.box('BG', rust, -1.7, 1.7, 5.3, 5.5, z - 0.05, z + 0.05)
    warm = emit('warglow', '#ff3a12', 5.0)
    mb.box('BG', warm, -3.0, 3.0, 9.0, 9.2, 0.0, 6.0)                     # the burning night beyond the bars
    mb.build('set')
    light('POINT', 'war', (0.0, 7.2, 1.6), '#ff3010', 700.0, size=1.2)
    light('SPOT', 'moon', (-1.4, -1.5, 4.3), '#7fa4ff', 2600.0, size=0.4, target=(1.4, 2.2, 0.6), spot=55)
    light('SPOT', 'rimL', (-2.2, 5.0, 3.8), '#9ab8ff', 900.0, size=0.3, target=(-0.4, 2.8, 1.2), spot=40)
    light('AREA', 'coldfill', (0.0, -6.0, 3.0), '#4a6a9a', 260.0, size=5.0, target=(0.5, 2.0, 1.0))
    light('POINT', 'torch', (2.3, 0.2, 2.1), '#ff8a30', 140.0, size=0.1)
    # the people: pressed against the right wall, cowering
    crowd = [('archer', 'crouch_idle', 20, (1.55, 1.0), -150, 1.0), ('archer', 'hit_heavy', 14, (1.95, 2.2), -170, 1.0),
             ('hero', 'crouch_idle', 10, (0.95, 2.6), -140, 0.62), ('archer', 'death_kneel', 18, (1.7, 3.4), -120, 1.0),
             ('hero', 'idle_alert', 30, (2.1, -0.4), -160, 0.98), ('archer', 'hit_light', 10, (1.2, 4.2), -135, 0.96)]
    for i, (kind, clip, fr, (x, y), face, s) in enumerate(crowd):
        p = person(kind, kind, f'crowd{i}', clip, fr, (x, y, 0.0), face, s, hide=('Sword', 'Bow', 'Arrow'))
        to_coll([p.arm] + p.meshes, 'MID')
    # the guards: spears levelled at them
    guards = [((-0.45, 1.6), -10, 'atk_lunge_cut', 14), ((-0.9, 3.1), -20, 'block_idle', 5), ((-0.2, 4.4), -30, 'atk_lunge_cut', 10)]
    for i, ((x, y), face, clip, fr) in enumerate(guards):
        glb_person('knight', f'guard{i}', clip, fr, (x, y, 0.0), face, 1.0, 'MID')
    # foreground: a guard's shoulder and helmet, very close, left edge
    glb_person('knight', 'fgguard', 'idle_combat', 8, (-1.25, -3.2, 0.0), 30, 1.0, 'FG')
    cam = cine.camera(loc=(-0.2, -4.6, 1.05), target=(0.7, 2.6, 1.25), lens=38, clip=(0.05, 200))
    return {'base': ['BG', 'MID'], 'fg': ['FG']}

def principled(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = cine.hexc(color); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

def blood_pool(mb, coll, mat, x, y, z, r, rng, n=10):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n; rr = r * rng.uniform(0.6, 1.25)
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a) * 0.8))
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        mb.tri(coll, mat, (x, y, z), (ax, ay, z), (bx, by, z)) if hasattr(mb, 'tri') else None

def p_king(a):
    """...and the king went down to the heart: from the foot of a stair, the crowned king descends past the guards
    he has had killed; the heart's red-gold light comes up from below, his torch from above."""
    world('#020203', 1.0, haze=0.05, haze_color='#8a7a70')
    stone = pbr('kstone', 'stone', 1.4, tint=(0.55, 0.52, 0.5))
    mb = cine.MeshBuilder()
    W, R, T, N = 1.35, 0.21, 0.34, 18
    for i in range(N):
        mb.box('BG', stone, -W, W, i * T, (i + 1) * T + 0.02, -0.4, (i + 1) * R)
    mb.box('BG', stone, -W - 0.6, -W, -2.0, N * T + 2, -0.5, N * R + 4.0)
    mb.box('BG', stone, W, W + 0.6, -2.0, N * T + 2, -0.5, N * R + 4.0)
    for i in range(N + 4):                                  # a stepped, sloping ceiling following the stair
        y0 = -2.0 + i * T; z = 3.1 + max(0, i - 5) * R
        mb.box('BG', stone, -W - 0.6, W + 0.6, y0, y0 + T + 0.02, z, z + 0.5)
    blood = principled('blood', '#2a0303', 0.12)
    rng = random.Random(4)
    for (x, i, r) in ((0.35, 3, 0.45), (-0.5, 6, 0.35), (0.1, 9, 0.28)):
        mb.box('BG', blood, x - r, x + r, i * T + 0.02, i * T + T - 0.02, (i + 1) * R, (i + 1) * R + 0.004)
    mb.build('stair')
    # the dead: guards cut down on the steps
    glb_person('knight', 'dead0', 'death_back', 68, (0.45, 3 * T + 0.1, 3 * R), 200, 1.0, 'MID')
    glb_person('knight', 'dead1', 'death_kneel', 116, (-0.75, 6 * T + 0.1, 6 * R), -40, 1.0, 'MID')
    # the king: crowned, cloaked, descending toward us
    k = glb_person('knight', 'king', 'walk_fwd', 20, (0.05, 10 * T + 0.15, 10 * R), -90, 1.02, 'MID')
    gold = principled('crowngold', '#c89a3a', 0.25, 1.0)
    crown = figures.crown_mesh('crown', gold, r=0.14, h=0.12)
    hh, _ = bone_pos(k, 'head')                 # glTF bone tails are unreliable (unit scale): anchor on heads
    place_prop(crown, (hh.x, hh.y, hh.z + 0.30))
    cloth = pbr('cloak', 'linen', 0.5, tint=(0.32, 0.04, 0.04))
    cloak = figures.cloak_mesh('kcloak', cloth, height=1.5, r_top=0.24, r_bot=0.7, open_front=1.3)
    ch, _ = bone_pos(k, 'neck')
    place_prop(cloak, (ch.x, ch.y + 0.12, ch.z - 1.42), rot=(0, 0, math.radians(90)))
    light('POINT', 'heartglow', (0.0, -1.2, -0.2), '#ff5a18', 1600.0, size=0.6)
    light('POINT', 'torch', (0.55, 10 * T - 0.2, 10 * R + 1.6), '#ffa050', 180.0, size=0.08)
    light('SPOT', 'rim', (-0.9, 14 * T, 14 * R + 2.6), '#88a8ff', 700.0, size=0.2, target=(0.0, 10 * T, 10 * R + 1.0), spot=40)
    cine.camera(loc=(0.2, -1.6, 0.35), target=(0.0, 9 * T, 9 * R + 1.1), lens=30, clip=(0.05, 200))
    return {'base': ['BG', 'MID']}

def p_road(a):
    """Now: she climbs the overgrown road toward the dead castle under a huge moon (her back to us, sword in hand)."""
    import shot_establishing as se
    se.base_scene(); se.look('PRESENT_NIGHT')
    moon = emit('moon', '#dfe8ff', 6.0)
    mb = cine.MeshBuilder()
    mb.build('none') if False else None
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=78.0, fill_type='NGON', location=(10.0, 520.0, 190.0), rotation=(math.radians(90), 0, 0))
    mo = bpy.context.active_object; mo.name = 'Moon'; mo.data.materials.append(moon); to_coll([mo], 'BG')
    for o in list(bpy.data.objects):
        if o.type in ('MESH', 'CURVE') and not o.users_collection[0].name.startswith(('MID', 'FG')) and o.name != 'Moon':
            to_coll([o], 'BG')
    terr = pbr('roadterrain', 'terrain', 1.8, tint=(0.16, 0.18, 0.21))
    gm = cine.MeshBuilder(); gm.box('BG', terr, -60, 60, -440, -360, -0.3, 0.075); gm.build('ground')
    for o in bpy.data.objects:                     # the v1 toon floor/road would glow under the rim light
        if o.type == 'MESH' and (o.name.startswith(('TR_floor', 'road')) or 'ROAD' in o.users_collection[0].name):
            o.data.materials.clear(); o.data.materials.append(terr)
    her = person('hero', 'Her', 'MID', 'walk_fwd', 14, (0.55, -421.4, 0.075), 92, 1.0)
    to_coll([her.arm] + her.meshes, 'MID')
    light('SPOT', 'herrim', (-0.9, -418.2, 2.2), '#b0c6ff', 420.0, size=0.3, target=(0.55, -421.4, 1.35), spot=22)
    light('AREA', 'herkey', (2.6, -422.8, 1.8), '#6a84b8', 90.0, size=2.0, target=(0.55, -421.4, 1.1))
    cine.camera(loc=(0.95, -424.1, 1.55), target=(0.2, 0.0, 34.0), lens=32, clip=(0.05, 12000), shift=(0.0, 0.0))
    return {'base': ['BG', 'MID']}

def p_founders(a):
    """Legend layer: three founders kneel with torches (rendered for ink-on-parchment)."""
    world('#000000', 0.0)
    for i, (x, y, face) in enumerate(((-0.9, 0.3, 80), (0.0, 0.0, 90), (0.95, 0.35, 100))):
        f = person('hero', f'f{i}', 'MID', 'crouch_idle', 12 + i * 7, (x, y, 0.0), face, 1.0, hide=('Sword',))
        to_coll([f.arm] + f.meshes, 'MID')
    light('SUN', 'k', (0, 0, 0), '#ffffff', 3.0)
    cine.camera(loc=(0.0, -5.2, 0.9), target=(0.0, 0.0, 0.6), lens=45, clip=(0.05, 200))
    return {'fig': ['MID']}

def p_queen(a):
    """Legend layer: a woman kneels to push a small hooded child through a low door."""
    world('#000000', 0.0)
    w = person('archer', 'queen', 'MID', 'crouch_idle', 18, (-0.35, 0.0, 0.0), 20, 1.0)
    c = person('hero', 'child', 'MID', 'walk_fwd', 20, (0.45, 0.25, 0.0), 15, 0.6, hide=('Sword',))
    to_coll([w.arm] + w.meshes + [c.arm] + c.meshes, 'MID')
    light('SUN', 'k', (0, 0, 0), '#ffffff', 3.0)
    cine.camera(loc=(0.0, -4.6, 0.8), target=(0.1, 0.0, 0.55), lens=45, clip=(0.05, 200))
    return {'fig': ['MID']}

def pbrize(state):
    """Swap a v1 set's toon (ink) materials for PBR by role (the ink finish is applied afterwards)."""
    roles = {'stone': pbr(f'pb_{state}_stone', 'stone', 1.5, tint=(0.52, 0.54, 0.58)),
             'wood': pbr(f'pb_{state}_wood', 'plank', 1.1, tint=(0.42, 0.36, 0.3)),
             'iron': pbr(f'pb_{state}_iron', 'rust', 0.5, tint=(0.5, 0.44, 0.4)),
             'gold': principled(f'pb_{state}_gold', '#8a6a30', 0.45, 0.9),
             'red': principled(f'pb_{state}_red', '#3a0c0a', 0.7)}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        for sl in o.material_slots:
            n = sl.material.name if sl.material else ''
            for role, m in roles.items():
                if f'_{role}' in n and 'plain' not in n or (role == 'stone' and 'stone_plain' in n):
                    sl.material = m; break

def p_gate(a):
    """Now: she stands before the rotted gate of Caer Veyr; the faded crest above her; moonlight."""
    import shot_gate as sg
    sg._world('PRESENT')
    gate.build('PRESENT')
    pbrize('PRESENT')
    her = person('hero', 'Her', 'MID', 'walk_fwd', 25, (0.1, -1.0, 0.0), 90, 1.0)
    to_coll([her.arm] + her.meshes, 'MID')
    light('SPOT', 'herrim', (-1.6, 0.6, 3.2), '#b4c8ff', 520.0, size=0.25, target=(0.1, -1.0, 1.3), spot=30)
    light('SPOT', 'crestmoon', (2.5, -6.0, 7.0), '#8aa4dc', 1800.0, size=0.6, target=(0.0, 0.0, 3.2), spot=38)
    cine.camera(loc=(0.85, -3.9, 0.75), target=(0.0, 0.3, 3.3), lens=22, clip=(0.05, 4000))
    return {'base': [c.name for c in bpy.data.collections]}

PANELS = {'sealed': p_sealed, 'king': p_king, 'road': p_road, 'founders': p_founders, 'queen': p_queen, 'gate': p_gate}

# ------------------------------------------------------------------------------------------------ render
def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--panel', required=True)
    ap.add_argument('--pct', type=int, default=100)
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--layers', default='all')
    ap.add_argument('--res', default='1440x2560')
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'cinematic', 'v2', 'panels'))
    a = ap.parse_args(argv)
    cine.reset()
    rx, ry = (int(v) for v in a.res.split('x'))
    sc = cine.render_settings(res=(rx, ry), pct=a.pct, samples=a.samples, transparent=True)
    try:
        sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    groups = PANELS[a.panel](a)
    out = os.path.join(a.out, a.panel); os.makedirs(out, exist_ok=True)
    vl = sc.view_layers[0]
    all_colls = {c for g in groups.values() for c in g}
    def lc_of(name):
        def walk(lc):
            if lc.name == name: return lc
            for ch in lc.children:
                r = walk(ch)
                if r: return r
        return walk(vl.layer_collection)
    layers = ['flat'] if a.layers == 'flat' else (list(groups) if a.layers == 'all' else a.layers.split(','))
    wn = sc.world.node_tree
    vol_links = [l for l in wn.links if l.to_socket.name == 'Volume']
    vol_pair = (vol_links[0].from_socket, vol_links[0].to_socket) if vol_links else None
    for layer in layers:
        on = all_colls if layer == 'flat' else set(groups[layer])
        for c in all_colls:
            lc = lc_of(c)
            if lc: lc.exclude = c not in on
        # the base plate carries the atmosphere; lifted layers are clean alpha (haze is re-applied in the edit)
        base = layer in ('base', 'bg', 'flat')
        for l in [l for l in wn.links if l.to_socket.name == 'Volume']: wn.links.remove(l)
        if base and vol_pair: wn.links.new(*vol_pair)
        sc.render.film_transparent = not base
        sc.render.image_settings.color_mode = 'RGBA'
        sc.render.filepath = os.path.join(out, f'{layer}.png')
        bpy.ops.render.render(write_still=True)
        print('PANEL', a.panel, layer, sc.render.filepath, flush=True)

if __name__ == '__main__':
    main()
