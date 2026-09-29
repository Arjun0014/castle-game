"""Shots on the establishing composition of Caer Veyr: S04 (war), S09b (the Sundering, two memories), S10
(centuries). The same place three times: the camera base is shared so the eye learns the silhouette.
"""
import math, random
import bpy
import cine, castle
from cine import hexc

BASE_CAM = dict(loc=(8.0, -330.0, 150.0), shift=(0.0, 0.22), lens=35.0)

def _cam(keys, n):
    """keys: [(t 0..1, (x,y,z), shift_y, lens[, pitch_deg])] -> keyframed camera looking toward +Y; pitch < 0 looks down."""
    cam = cine.camera(loc=keys[0][1], target=(keys[0][1][0], 0.0, keys[0][1][2]), lens=keys[0][3], clip=(1, 12000), shift=(0.0, keys[0][2]))
    for k in keys:
        t, loc, sy, lens = k[:4]
        pitch = k[4] if len(k) > 4 else 0.0
        f = 1 + round(t * (n - 1))
        cam.rotation_euler = (math.radians(90 + pitch), 0, 0); cam.keyframe_insert('rotation_euler', frame=f)
        cam.location = loc; cam.keyframe_insert('location', frame=f)
        cam.data.shift_y = sy; cam.data.keyframe_insert('shift_y', frame=f)
        cam.data.lens = lens; cam.data.keyframe_insert('lens', frame=f)
    cine.ease(cam); cine.ease(cam.data)
    return cam

def _lights_clear():
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o, do_unlink=True)

def base_scene():
    castle.build()
    castle.terrain()
    castle.backdrop()
    cine.noink('CV_PRESENT_VEG', 'TERRAIN_VEG', 'WAR', 'GHOSTS')
    cine.ink_lines(color='#0b0706', thickness=1.4, noise=1.0, fade=(250.0, 900.0))

def look(state):
    """Sky, fog and light for a memory on the establishing composition."""
    _lights_clear()
    if state == 'PAST_DUSK':
        castle.set_state('PAST_DUSK')
        sd = (-1.0, 0.55, 0.36)
        cine.world_sky(top='#2a1c34', horizon='#f0a060', low='#6a3a26', sun_dir=sd, sun_color='#fff0c8', sun_size=0.0004,
                       sun_glow=0.9, clouds=0.7, cloud_color='#583244', cloud_lit='#ffc684', cloud_scale=1.6, ambient='#2a1a1e',
                       cloud_squash=3.2, cloud_threshold=(0.5, 0.68), glow_from=0.9)
        cine.set_fog('#e0a070', 0.0011, start=120, maxf=0.94, base=115, falloff=30, floor=0.1)
        cine.sun('Key', sd, '#ffd49a', energy=5.0)
        cine.sun('Fill', (0.35, -1.0, 0.4), '#5a4a78', energy=0.18, shadow=False)
    elif state == 'PAST_WAR':
        castle.set_state('PAST_WAR')
        cine.world_sky(top='#0c0406', horizon='#8a2412', low='#2a0a06', sun_dir=(0.0, 1.0, -0.2), sun_color='#ff5a20', sun_size=0.0,
                       sun_glow=0.0, clouds=0.75, cloud_color='#1a0808', cloud_lit='#b8401c', cloud_scale=1.4, ambient='#1a0808',
                       cloud_squash=3.0, cloud_threshold=(0.46, 0.66), glow_from=0.9)
        cine.set_fog('#6a1c10', 0.0012, start=120, maxf=0.95, base=120, falloff=34, floor=0.12)
        cine.sun('Fires', (0.1, -1.0, -0.42), '#ff6a2a', energy=3.2)          # the valley's fires light it from below
        cine.sun('Rim', (0.3, 1.0, 0.15), '#ff3a1a', energy=1.2, shadow=False)
    elif state == 'PRESENT_NIGHT':
        castle.set_state('PRESENT_NIGHT')
        sd = (0.55, 1.0, 0.55)
        cine.world_sky(top='#05080f', horizon='#1e2e46', low='#0b1019', sun_dir=sd, sun_color='#eef4ff', sun_size=0.00045,
                       sun_glow=0.35, clouds=0.55, cloud_color='#0e1522', cloud_lit='#6a809e', cloud_scale=1.6, stars=1.3,
                       ambient='#0c1220', cloud_squash=3.2, cloud_threshold=(0.52, 0.7), glow_from=0.96)
        cine.set_fog('#34486a', 0.0012, start=120, maxf=0.94, base=115, falloff=30, floor=0.08)
        cine.sun('Moon', sd, '#c8d8ff', energy=2.4)
        cine.sun('Fill', (0.35, -1.0, 0.4), '#2a3a58', energy=0.45, shadow=False)
    cine.compositor(kuwahara=7, glare=0.55)

def army_fires(n=6500, seed=11, cam=(0.0, -980.0, 440.0)):
    """The besieging army: camps of fires on the valley floor and siege lines ringing the crag. Sizes follow
    the distance to the final camera so every fire is a few pixels (never a bokeh ball)."""
    rng = random.Random(seed)
    col = cine.coll('WAR')
    mats = [cine.mat_emit(f'fire_points{i}', c, e) for i, (c, e) in enumerate((('#ffb050', 18.0), ('#ff7a30', 12.0), ('#ffd080', 26.0)))]
    parts = [([], []) for _ in mats]
    camps = [(rng.uniform(-700, 700), rng.uniform(-820, -220), rng.uniform(40, 120)) for _ in range(40)]
    k = 0
    while k < n:
        if rng.random() < 0.72:
            cx, cy, cr = camps[rng.randrange(len(camps))]
            a = rng.uniform(0, math.tau); d = cr * math.sqrt(rng.random())
            x, y = cx + d * math.cos(a), cy + d * math.sin(a)
        elif rng.random() < 0.6:
            a = rng.uniform(math.pi * 1.05, math.pi * 1.95); r = rng.gauss(300, 18)
            x, y = r * math.cos(a), r * math.sin(a)
        else:
            x, y = rng.uniform(-900, 900), rng.uniform(-900, 600)
        if math.hypot(x, y) < 215: continue
        dist = math.dist((x, y, 4.0), cam)
        s = 0.0016 * dist * rng.uniform(0.7, 1.35)
        mi = 0 if rng.random() < 0.7 else (1 if rng.random() < 0.7 else 2)
        if mi == 2: s *= 1.6
        verts, faces = parts[mi]
        b = len(verts)
        verts.extend([(x - s, y, 4.0 - s * 0.6), (x + s, y, 4.0 - s * 0.6), (x + s * 0.6, y, 4.0 + s * 1.4), (x - s * 0.6, y, 4.0 + s * 1.4)])
        faces.append((b, b + 1, b + 2, b + 3))
        k += 1
    for i, (verts, faces) in enumerate(parts):
        me = bpy.data.meshes.new(f'WAR_fires{i}'); me.from_pydata(verts, [], faces); me.update()
        ob = bpy.data.objects.new(f'WAR_fires{i}', me); ob.data.materials.append(mats[i]); col.objects.link(ob)

def light_column():
    """The surge: a column of gold light rising out of the keep (S09b, Past pass)."""
    col = cine.coll('SURGE')
    m = bpy.data.materials.new('surge'); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    for x in list(N): N.remove(x)
    out = N.new('ShaderNodeOutputMaterial')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = hexc('#ffd890'); em.inputs['Strength'].default_value = 12.0
    tr = N.new('ShaderNodeBsdfTransparent'); mix = N.new('ShaderNodeMixShader')
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.6
    inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L.new(lw.outputs['Facing'], inv.inputs[1])
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sep.inputs[0])
    fade = N.new('ShaderNodeMapRange'); fade.inputs['From Min'].default_value = 1.0; fade.inputs['From Max'].default_value = 0.0
    L.new(sep.outputs['Z'], fade.inputs['Value'])
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; L.new(inv.outputs[0], mul.inputs[0]); L.new(fade.outputs['Result'], mul.inputs[1])
    L.new(mul.outputs[0], mix.inputs['Fac']); L.new(tr.outputs[0], mix.inputs[1]); L.new(em.outputs[0], mix.inputs[2]); L.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=9.0, depth=900.0, location=(33.0, 15.0, castle.Z0 + 60 + 450))
    ob = bpy.context.active_object; ob.name = 'SURGE_column'; ob.data.materials.append(m)
    for c in ob.users_collection: c.objects.unlink(ob)
    col.objects.link(ob)
    return ob, em

# ------------------------------------------------------------------------------------------------ shots
def build_s04(pass_name, n, **_):
    base_scene()
    if pass_name == 'war': army_fires()
    look('PAST_DUSK' if pass_name == 'dusk' else 'PAST_WAR')
    _cam([(0.0, (8.0, -330.0, 150.0), 0.22, 35.0, 0.0), (1.0, (0.0, -980.0, 440.0), 0.0, 32.0, -16.0)], n)

def build_s09b(pass_name, n, **_):
    base_scene()
    if pass_name == 'past':
        army_fires()
        look('PAST_WAR')
        ob, em = light_column()
        # the column shoots up in the first 0.5 s, holds, the windows flare with it
        ob.scale = (0.2, 0.2, 0.001); ob.keyframe_insert('scale', frame=1)
        ob.scale = (1.0, 1.0, 1.0); ob.keyframe_insert('scale', frame=12)
        ob.scale = (1.6, 1.6, 1.0); ob.keyframe_insert('scale', frame=n)
        wm = castle.material('PAST_WAR', 'window')
        emw = [nd for nd in wm.node_tree.nodes if nd.type == 'EMISSION'][0]
        emw.inputs['Strength'].driver_remove('default_value')
        for f, v in ((1, 8.0), (10, 30.0), (n, 30.0)):
            emw.inputs['Strength'].default_value = v; emw.inputs['Strength'].keyframe_insert('default_value', frame=f)
    else:
        look('PRESENT_NIGHT')
    _cam([(0.0, (8.0, -360.0, 150.0), 0.22, 35.0), (1.0, (8.0, -300.0, 155.0), 0.22, 35.0)], n)

def build_s10(pass_name, n, **_):
    base_scene()
    look('PRESENT_NIGHT')
    # time-lapse: the moon crosses the sky, clouds race
    w = bpy.context.scene.world
    dots = [nd for nd in w.node_tree.nodes if nd.type == 'VECT_MATH' and nd.operation == 'DOT_PRODUCT']
    moon = [o for o in bpy.data.objects if o.name.startswith('Moon')][0]
    for f, sd in ((1, (0.85, 1.0, 0.25)), (n, (-0.75, 1.0, 0.35))):
        v = cine.Vector(sd).normalized()
        for d in dots: d.inputs[1].default_value = v; d.inputs[1].keyframe_insert('default_value', frame=f)
    maps = [nd for nd in w.node_tree.nodes if nd.type == 'MAPPING']
    for mp in maps:
        mp.inputs['Location'].driver_remove('default_value', 0)
        mp.inputs['Location'].default_value[0] = 0.0; mp.inputs['Location'].keyframe_insert('default_value', index=0, frame=1)
        mp.inputs['Location'].default_value[0] = 1.6; mp.inputs['Location'].keyframe_insert('default_value', index=0, frame=n)
    _cam([(0.0, (8.0, -330.0, 150.0), 0.22, 35.0), (1.0, (0.0, -420.0, 90.0), 0.30, 35.0)], n)

def build_s11(pass_name, n, fps, **_):
    """Night, now: she climbs the overgrown road; the dead castle looms; one window burns for a moment."""
    import figures
    base_scene()
    look('PRESENT_NIGHT')
    rng = random.Random(21)
    # the road: a worn strip of earth and broken setts winding toward the crag, grass reclaiming it
    road = cine.mat_ink('road', '#020304', '#07090d', '#26303e', rim=None, mottle=0.5, mottle_scale=0.6, sheen=0.0)
    veg = castle.material('PRESENT_NIGHT', 'veg')
    mb = cine.MeshBuilder()
    pts = [(0.0, -430.0), (0.6, -410.0), (-1.5, -385.0), (1.5, -350.0), (-3.0, -300.0), (4.0, -240.0), (0.0, -180.0)]
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        L = math.hypot(bx - ax, by - ay); k = int(L / 1.2)
        for i in range(k):
            t = i / k; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            for j in range(3):
                if rng.random() < 0.35: continue
                ox = (j - 1) * 0.95 + rng.uniform(-0.15, 0.15)
                mb.oriented_box('ROAD', road, (x + ox, y, 0.02), (0.8, 0.9, 0.08), (rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), rng.uniform(-0.2, 0.2)))
    for i in range(1400):
        y = rng.uniform(-432.0, -330.0); x = rng.uniform(-14.0, 14.0)
        if abs(x) < 1.4 and rng.random() < 0.7: continue
        cine.grass_tuft(mb, 'ROAD_VEG', veg, x, y, 0.0, rng, h=rng.uniform(0.25, 0.9) * (1.0 + abs(x) / 10.0), blades=10)
    mb.box('ROAD', road, -40, 40, -440, -300, -0.4, 0.06)
    mb.build('road')
    fl = bpy.data.objects.get('TR_floor')
    if fl: fl.data.materials[0] = road
    cine.noink('ROAD_VEG')
    # her: walking away from us up the road (sword in hand, shield on her arm)
    her = figures.load('hero', 'Her', 'FIGS', actions=('walk_fwd',))
    her.place((0.3, -421.0, 0.0), facing_deg=90.0)
    figures.silhouette(her, body='#030305', mid='#0c0e14', lit='#3a4660', rim='#d8e6ff', sheen=0.35)
    figures.play(her, 'walk_fwd', start=1, speed=0.8, repeat=8.0)
    her.arm.keyframe_insert('location', frame=1)
    her.arm.location = (0.1, -421.0 + 1.472 * (n - 1) / fps, 0.0); her.arm.keyframe_insert('location', frame=n)
    for fc in cine._fcurves(her.arm.animation_data.action):
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    # an impossible light: a window of the broken keep burns for a moment, then is dark again
    ghost = cine.mat_emit('ghost_window', '#ffc46b', 0.0)
    gm = cine.MeshBuilder(); gm.quad_window('GHOSTS', ghost, (30.5, 1.9, castle.Z0 + 36.0), -math.pi / 2, 1.2, 2.8, off=0.3)
    gm.build('ghostwin')
    em = [nd for nd in ghost.node_tree.nodes if nd.type == 'EMISSION'][0]
    for f, v in ((1, 0.0), (_sec_(2.3), 0.0), (_sec_(2.45), 38.0), (_sec_(2.95), 30.0), (_sec_(3.1), 0.0)):
        em.inputs['Strength'].default_value = v; em.inputs['Strength'].keyframe_insert('default_value', frame=f)
    cam = cine.camera(loc=(0.95, -424.4, 1.2), target=(0.95, 0.0, 1.2), lens=24, clip=(0.05, 12000), shift=(-0.03, 0.27))
    cam.keyframe_insert('location', frame=1)
    cam.location = (0.85, -424.4 + 1.472 * (n - 1) / fps * 0.92, 1.22); cam.keyframe_insert('location', frame=n)

def _sec_(t, fps=24): return 1 + round(t * fps)

REG = {
    'S11_road': {'build': build_s11, 'passes': ['main']},
    'S04_war': {'build': build_s04, 'passes': ['dusk', 'war']},
    'S09b_sundering': {'build': build_s09b, 'passes': ['past', 'present']},
    'S10_centuries': {'build': build_s10, 'passes': ['main']},
}
