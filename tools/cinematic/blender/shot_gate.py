"""The gate shots. S12-S15 outside (the Present, her hand, the glimpse of the Past), S16 inside (she enters),
S05 inside on the last night (the same camera: the gate that trapped them is the gate she opens).
"""
import math, random
import bpy
from mathutils import Vector
import cine, gate, figures
from cine import hexc

def _sec(t, fps=24): return 1 + round(t * fps)

HER_AT = Vector((0.1, -0.15, 0.0))          # where she stands before the door
TOUCH = Vector((-0.24, 0.40, 1.96))         # her left palm on the left half of the crest

def _clear_lights():
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o, do_unlink=True)

def _world(state):
    _clear_lights()
    if state == 'PRESENT':
        cine.world_sky(top='#04070d', horizon='#1a2a42', low='#080c14', sun_dir=(-0.5, -1.0, 0.8), sun_color='#eef4ff', sun_size=0.0004,
                       sun_glow=0.3, clouds=0.55, cloud_color='#0c1320', cloud_lit='#5e7494', cloud_scale=1.4, stars=1.2,
                       ambient='#04070c', cloud_squash=3.0, cloud_threshold=(0.5, 0.7), glow_from=0.96)
        cine.set_fog('#101a2c', 0.016, start=4.0, maxf=0.8)
        moon = cine.sun('Moon', (-0.8, -0.75, 0.6), '#b8ccff', energy=1.35)
        cine.sun('Sky', (0.6, 1.0, 0.5), '#18223a', energy=0.18, shadow=False)
        return moon
    cine.world_sky(top='#0a0305', horizon='#6a1a0c', low='#1a0604', sun_dir=(0.0, 1.0, 0.2), sun_color='#ff6a2a', sun_size=0.0, sun_glow=0.0,
                   clouds=0.7, cloud_color='#180606', cloud_lit='#9a3818', cloud_scale=1.3, ambient='#0a0403', cloud_squash=3.0,
                   cloud_threshold=(0.46, 0.66), glow_from=0.9)
    cine.set_fog('#2a0c06', 0.014, start=4.0, maxf=0.75)
    return None

def _her(loc=HER_AT, facing=90.0, pose=('walk_fwd', 25)):
    her = figures.load('hero', 'Her', 'FIGS', actions=('walk_fwd', 'idle_alert'))
    figures.hold_pose(her, *pose)
    her.place(tuple(loc), facing_deg=facing)
    figures.silhouette(her, body='#030305', mid='#0c0e14', lit='#3a4660', rim='#d8e6ff', sheen=0.35)
    return her

def _ink():
    cine.noink('G_PAST_VEG', 'G_PRESENT_VEG', 'G_CREST_GLOW', 'PROPS')
    cine.ink_lines(color='#040304', thickness=1.25, noise=0.7, fade=(3.0, 45.0))

def _glow_node(g):
    return g['crest_edge'].node_tree.nodes['Glow']

# ------------------------------------------------------------------------------------------------ exterior (S12-S15)
EXT = dict(loc=(0.75, -6.4, 1.1), lens=24.0, shift=(0.0, 0.25))

def _ext_camera():
    return cine.camera(loc=EXT['loc'], target=(EXT['loc'][0], 0.0, EXT['loc'][2]), lens=EXT['lens'], clip=(0.05, 4000), shift=EXT['shift'])

def _living_gate(g, heads_turn=True):
    """The Past at the gate on the last night: guards flank the door and turn their heads to her; torches; banners."""
    mats = g['mats']
    rng = random.Random(4)
    mb = cine.MeshBuilder()
    for sx in (-1, 1):
        gate.flame_torch(mb, 'G_PAST', mats, (sx * 3.25, -0.35, 3.3), rng)
        cine.point(f'torch{sx}', (sx * 3.25, -0.9, 3.9), '#ff9040', 420.0, radius=0.2, shadow=True)
        x = sx * 3.25; zt = 11.2
        mb.poly('G_PAST', mats['banner'], [(x - 0.55, -0.06, zt), (x + 0.55, -0.06, zt), (x + 0.55, -0.06, zt - 4.3), (x, -0.06, zt - 3.7), (x - 0.55, -0.06, zt - 4.3)])
    mb.build('living')
    for i, sx in enumerate((-1, 1)):
        k = figures.load('knight', f'guard{i}', 'FIGS', actions=('K_walk_fwd',))
        figures.hold_pose(k, 'K_walk_fwd', 2)
        k.place((sx * 1.6 + 0.35, -0.95, 0.0), facing_deg=-90.0 + sx * 14)
        figures.silhouette(k, body='#050303', mid='#1a0e08', lit='#6a3a1c', rim='#ffb468')
        if heads_turn:
            hb = k.arm.pose.bones[k.bone('head')]; hb.rotation_mode = 'XYZ'
            for f, a in ((1, 0.0), (6, 0.0), (16, sx * 0.6)):
                hb.rotation_euler = (0.0, a, 0.0); hb.keyframe_insert('rotation_euler', frame=f)
    cine.point('gatewash', (0.6, -5.5, 3.0), '#ff7a30', 60.0, radius=2.0)

def _ext(state, reach=None, heads_turn=False):
    _world(state)
    g = gate.build(state)
    her = _her()
    if reach:
        figures.open_hand(her, 'Left')
        ik = figures.reach(her, 'Left', tuple(reach[0][1]), pole=(-1.2, -0.8, 0.5))
        aim = figures.point_fingers(her, 'Left', tuple(reach[0][1] + Vector((0.0, 0.08, 0.4))))
        for f, p in reach:
            ik.location = p; ik.keyframe_insert('location', frame=f)
            aim.location = p + Vector((0.02, 0.08, 0.4)); aim.keyframe_insert('location', frame=f)
    if state == 'PAST': _living_gate(g, heads_turn)
    _ink()
    cine.compositor(kuwahara=5, glare=0.6, glare_threshold=0.8, glare_size=7)
    return g, her

def build_s12(pass_name, n, fps, **_):
    _world('PRESENT')
    g = gate.build('PRESENT')
    # her last two steps: walk_fwd action frames 1..25 at real time, then the passing pose held (upright, back to us)
    her = figures.load('hero', 'Her', 'FIGS', actions=('walk_fwd',))
    her.place(tuple(HER_AT - Vector((0.0, 1.84, 0.0))), facing_deg=90.0)
    st = figures.play(her, 'walk_fwd', start=1, speed=0.8, repeat=1.0)
    st.action_frame_end = 25.0
    her.arm.keyframe_insert('location', frame=1)
    her.arm.location = tuple(HER_AT); her.arm.keyframe_insert('location', frame=31)
    for fc in cine._fcurves(her.arm.animation_data.action):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    figures.silhouette(her, body='#030305', mid='#0c0e14', lit='#3a4660', rim='#d8e6ff', sheen=0.35)
    _ink()
    cine.compositor(kuwahara=5, glare=0.6, glare_threshold=0.8, glare_size=7)
    cam = _ext_camera()
    cam.location = (0.8, -7.2, 1.1); cam.keyframe_insert('location', frame=1)
    cam.location = EXT['loc']; cam.keyframe_insert('location', frame=n)
    cine.ease(cam)

def _touch_keys(n):
    return [(1, Vector((0.35, -0.05, 1.05))), (_sec(0.5), Vector((-0.1, 0.25, 1.7))), (_sec(0.85), TOUCH + Vector((0, -0.02, 0))), (n, TOUCH)]

def build_s13(pass_name, n, fps, **_):
    g, her = _ext('PRESENT', reach=_touch_keys(n))
    gl = _glow_node(g)
    for f, v in ((1, 0.0), (_sec(0.85), 0.0), (_sec(1.0), 6.0), (n, 14.0)):
        gl.inputs['Strength'].default_value = v; gl.inputs['Strength'].keyframe_insert('default_value', frame=f)
    # over her left shoulder: the crest fills the frame, her arm reaches into it
    cam = cine.camera(loc=(-0.95, -1.45, 1.78), target=(-0.05, 0.44, 2.0), lens=34, clip=(0.02, 500), dof=(2.0, 2.8))
    cam.keyframe_insert('location', frame=1); cam.keyframe_insert('rotation_euler', frame=1)
    cam.location = (-0.85, -1.25, 1.8); cine.look_at(cam, (-0.08, 0.44, 2.0))
    cam.keyframe_insert('location', frame=n); cam.keyframe_insert('rotation_euler', frame=n)
    cine.ease(cam)

def build_s14(pass_name, n, fps, **_):
    state = 'PAST' if pass_name == 'past' else 'PRESENT'
    g, her = _ext(state, reach=[(1, TOUCH), (n, TOUCH)], heads_turn=True)
    if state == 'PRESENT': _glow_node(g).inputs['Strength'].default_value = 14.0
    _ext_camera()

def build_s15(pass_name, n, fps, **_):
    keys = [(1, TOUCH), (_sec(0.3), TOUCH + Vector((0.02, -0.06, -0.03))), (n, Vector((0.4, -0.1, 1.15)))]
    g, her = _ext('PRESENT', reach=keys)
    gl = _glow_node(g)
    for f, v in ((1, 14.0), (_sec(0.2), 0.0)):
        gl.inputs['Strength'].default_value = v; gl.inputs['Strength'].keyframe_insert('default_value', frame=f)
    cam = _ext_camera()
    cam.keyframe_insert('location', frame=1)
    cam.location = (0.78, -6.6, 1.08); cam.keyframe_insert('location', frame=n)

# ------------------------------------------------------------------------------------------------ S16 (inside, she enters)
INT = dict(loc=(0.2, 5.6, 1.35), lens=22.0, shift=(0.0, 0.14))

def _int_camera():
    return cine.camera(loc=INT['loc'], target=(INT['loc'][0], 0.0, INT['loc'][2]), lens=INT['lens'], clip=(0.05, 4000), shift=INT['shift'])

def build_s16(pass_name, n, fps, **_):
    _world('PRESENT')
    _clear_lights()
    g = gate.build('PRESENT')
    # the fallen portcullis lies along the left of the passage floor (the game's Present gate passage)
    port = gate.portcullis(g['mats'], 'portcullis_fallen', 'G_PORT')
    for o in port:
        o.location = (-1.6, 3.4, 0.2); o.rotation_euler = (math.radians(-86), 0.0, math.radians(12))
    gate.swing(g['doors']['R'], 1, [(1, 0.0), (_sec(0.3), 0.0), (_sec(0.8), 14.0), (_sec(1.6), 52.0), (n, 58.0)])
    gate.swing(g['doors']['L'], -1, [(1, 0.0), (n, 0.0)])
    her = figures.load('hero', 'Her', 'FIGS', actions=('walk_fwd', 'idle_alert'))
    her.place((0.95, -1.05, 0.0), facing_deg=90.0)
    figures.silhouette(her, body='#020204', mid='#0a0c12', lit='#2a3448', rim='#dce8ff', sheen=0.5)
    figures.hold_pose(her, 'walk_fwd', 25)
    t_walk = _sec(1.45)
    figures.play(her, 'walk_fwd', start=t_walk, speed=0.8, repeat=6.0)
    her.arm.keyframe_insert('location', frame=t_walk)
    dist = 1.472 * (n - t_walk) / fps
    her.arm.location = (0.55, -1.05 + dist, 0.0); her.arm.keyframe_insert('location', frame=n)
    for fc in cine._fcurves(her.arm.animation_data.action):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    # moonlight through the opening: a strong, narrow key from outside; a cloud takes it as she crosses into the dark
    beam = cine.sun('Moonbeam', (0.08, -1.0, 0.5), '#c8d8ff', energy=3.6)
    beam.data.angle = 0.008
    for f, e in ((1, 3.6), (_sec(2.9), 3.6), (n, 0.18)):
        beam.data.energy = e; beam.data.keyframe_insert('energy', frame=f)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 6.0, 3.8))
    vol = bpy.context.active_object; vol.name = 'dust'; vol.scale = (5.2, 14.0, 7.6)
    vm = bpy.data.materials.new('dust'); vm.use_nodes = True
    N, L = vm.node_tree.nodes, vm.node_tree.links
    for x in list(N): N.remove(x)
    out = N.new('ShaderNodeOutputMaterial'); pv = N.new('ShaderNodeVolumePrincipled'); pv.inputs['Density'].default_value = 0.04
    pv.inputs['Anisotropy'].default_value = 0.5; L.new(pv.outputs[0], out.inputs['Volume'])
    vol.data.materials.append(vm)
    _ink()
    cine.compositor(kuwahara=5, glare=0.6, glare_threshold=0.8, glare_size=7)
    cam = _int_camera()
    cam.keyframe_insert('location', frame=1)
    cam.location = (0.2, 5.9, 1.33); cam.keyframe_insert('location', frame=n)

# ------------------------------------------------------------------------------------------------ S05 (inside, the last night)
def build_s05(pass_name, n, fps, **_):
    _world('PAST')
    g = gate.build('PAST')
    gate.swing(g['doors']['R'], 1, [(1, 96.0)]); gate.swing(g['doors']['L'], -1, [(1, 96.0)])
    port = gate.portcullis(g['mats'], 'portcullis', 'G_PORT')
    slam = _sec(2.72)                              # on "sealed"
    for o in port:
        for f, z in ((1, 6.8), (slam - 10, 5.2), (slam, 0.0), (slam + 2, 0.14), (slam + 4, 0.0)):
            o.location = (0.0, 2.3, z); o.keyframe_insert('location', frame=f)
        for fc in cine._fcurves(o.animation_data.action):
            kps = fc.keyframe_points
            for i, kp in enumerate(kps): kp.interpolation = 'QUAD' if i == 1 else 'LINEAR'
            kps[1].easing = 'EASE_IN'
    rng = random.Random(9)
    # the people inside, facing the gate (their backs to us): cloaked and hooded, one child among them
    poses = [('idle_alert', 10), ('crouch_idle', 20), ('walk_fwd', 8), ('idle_alert', 40), ('walk_fwd', 25), ('crouch_idle', 5), ('idle_alert', 70)]
    spots = [(-1.6, 4.1), (-0.55, 4.8), (0.6, 4.4), (1.6, 5.1), (-1.15, 5.9), (0.2, 6.2), (1.25, 6.6)]
    for i, ((x, y), (clip, fr)) in enumerate(zip(spots, poses)):
        c = figures.load('hero', f'civ{i}', 'FIGS', actions=(clip,))
        c.hide('Sword')
        figures.hold_pose(c, clip, fr)
        small = (i == 5)
        c.place((x, y, 0.0), facing_deg=90.0 + rng.uniform(-20, 20), scale=0.62 if small else rng.uniform(0.95, 1.06))
        m = figures.silhouette(c, body='#010101', mid='#070302', lit='#2e140a', rim='#ff7a3a', sheen=0.2)
        if i % 2 == 0 or small:
            cl = figures.cloak_mesh(f'civcloak{i}', m, height=1.0 * (0.62 if small else 1.0), r_top=0.2, r_bot=0.36, open_front=1.2)
            figures.attach(cl, c, 'chest', offset=(0, 0.05, 0), rot=(math.radians(-90), 0, 0))
        hb = cine.MeshBuilder(); hb.cylinder('PROPS', m, 0, 0, -0.04, 0.24, 0.19, n=12, r_top=0.06)
        figures.attach(hb.build(f'civhood{i}')[0], c, 'head', offset=(0, -0.13, 0.0), rot=(math.radians(-90), 0, 0))
    # guards between them and the gate, turning to face INWARD (toward us), spears levelled
    for i, x in enumerate((-1.25, 1.3)):
        k = figures.load('knight', f'gguard{i}', 'FIGS', actions=('K_walk_fwd',))
        figures.hold_pose(k, 'K_walk_fwd', 3 + i * 6)
        k.place((x, 2.9, 0.0), facing_deg=90.0)
        figures.silhouette(k, body='#040202', mid='#140a08', lit='#5a2a14', rim='#ff9a50')
        for f, yaw in ((1, 90.0), (_sec(1.4), 90.0), (_sec(2.3), -90.0 + (22 if x < 0 else -22))):
            k.arm.rotation_euler = (k.arm.rotation_euler.x, 0.0, math.radians(yaw + 90.0)); k.arm.keyframe_insert('rotation_euler', frame=f)
    mb = cine.MeshBuilder()
    for (x, y) in ((-2.35, 7.2), (2.35, 7.2)):
        gate.flame_torch(mb, 'G_PAST', g['mats'], (x, y, 3.1), rng)
        cine.point(f'ptorch{x}{y}', (x * 0.8, y, 3.5), '#ff9040', 120.0, radius=0.2, shadow=True)
    mb.build('ptorches')
    cine.point('warsky', (0.0, -7.0, 4.5), '#ff3a10', 900.0, radius=5.0)
    _ink()
    cine.compositor(kuwahara=5, glare=0.7, glare_threshold=0.75, glare_size=7)
    cam = _int_camera()
    cam.location = (0.25, 9.0, 1.5); cam.keyframe_insert('location', frame=1)
    cam.location = (0.25, 8.2, 1.45); cam.keyframe_insert('location', frame=n)
    cine.ease(cam)

REG = {
    'S05_sealed': {'build': build_s05, 'passes': ['main']},
    'S12_gate': {'build': build_s12, 'passes': ['main']},
    'S13_touch': {'build': build_s13, 'passes': ['main']},
    'S14_glimpse': {'build': build_s14, 'passes': ['past', 'present']},
    'S15_ruin': {'build': build_s15, 'passes': ['main']},
    'S16_threshold': {'build': build_s16, 'passes': ['main']},
}
