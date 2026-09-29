"""S03 (the castle rises above the heart) and S09a (the surge).

S03 is two passes joined by a flash of dusk light in post:
  shaft  — from the Crownheart the camera rises into the conduit shaft (the game's own "red-gold glow rising up
           the conduit shaft") toward a disc of sky;
  castle — out of the well in the ward: Caer Veyr grows around the camera element by element (a time-lapse of
           generations), the camera climbs and flies back to the establishing composition S04 continues from.
"""
import math, random
import bpy
from mathutils import Vector
import cine, heart, castle, shot_establishing as se
from cine import hexc

def _sec(t, fps=24): return 1 + round(t * fps)

SHAFT_R = 5.5

def shaft(z0=40.0, z1=150.0, seed=4):
    """A rough vertical conduit (faceted, inward-facing) with strata ledges; a disc of sky at its mouth."""
    rng = random.Random(seed)
    rock = bpy.data.materials.get('cave_rock') or cine.mat_ink('cave_rock', '#030202', '#120a07', '#5a3018', rim='#a0501e', mottle=0.34, mottle_scale=0.25)
    segs, rings = 18, 44
    verts, faces = [], []
    for j in range(rings + 1):
        z = z0 + (z1 - z0) * j / rings
        band = 0.9 * math.sin(z * 0.9) + 0.6 * math.sin(z * 0.23 + 1.0)
        for i in range(segs):
            a = 2 * math.pi * (i + (0.5 if j % 2 else 0)) / segs
            r = SHAFT_R + band + rng.uniform(-0.45, 0.45)
            verts.append((r * math.cos(a), r * math.sin(a), z + rng.uniform(-0.3, 0.3)))
    for j in range(rings):
        for i in range(segs):
            a = j * segs + i; b = j * segs + (i + 1) % segs
            faces += [(a, a + segs, b)] if j % 2 == 0 else [(a, a + segs, b + segs)]
            faces += [(b, a + segs, b + segs)] if j % 2 == 0 else [(a, b + segs, b)]
    me = bpy.data.meshes.new('shaft'); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new('shaft', me); ob.data.materials.append(rock); cine.coll('CAVE').objects.link(ob)
    sky = cine.mat_emit('shaft_sky', '#ffd9a0', 9.0)
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=SHAFT_R + 1.5, fill_type='NGON', location=(0, 0, z1 + 0.5))
    d = bpy.context.active_object; d.name = 'shaft_sky'; d.data.materials.append(sky)
    return ob

def _cut_cave_ceiling(r=7.5, zmin=30.0):
    ob = bpy.data.objects.get('cave')
    if not ob: return
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if (lambda c: math.hypot(c.x, c.y) < r and c.z > zmin)(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ob.data); bm.free()

def _heart_scene(glow=1.2, rage=0.0):
    heart.dark_world()
    mat = heart.heart_material()
    heart.heart_object(mat)
    heart.cavern()
    _cut_cave_ceiling()
    heart.heart_lights()
    heart.key_value(mat, 'Glow', [(1, glow)])
    heart.key_value(mat, 'Rage', [(1, rage)])
    heart.key_value(mat, 'RippleI', [(1, 0.9)]); heart.key_value(mat, 'RippleR', [(1, 3.3)])
    shaft()
    # warm light climbing the shaft from the heart
    for z, e in ((60.0, 9000.0), (95.0, 5000.0), (130.0, 2600.0)):
        cine.point(f'shaftlight{z}', (0.0, 0.0, z), '#ffa050', e, radius=2.0)
    cine.ink_lines(color='#0a0504', thickness=1.3, noise=0.9, fade=(10.0, 160.0))
    cine.compositor(kuwahara=6, glare=0.9, glare_threshold=0.7, glare_size=8)
    return mat

def _keys(cam, keys):
    for f, loc, tgt, lens in keys:
        cam.location = loc; cine.look_at(cam, tgt)
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        cam.data.lens = lens; cam.data.keyframe_insert('lens', frame=f)
    cine.ease(cam); cine.ease(cam.data)

# ------------------------------------------------------------------------------------------------ S03
def build_s03(pass_name, n, fps, **_):
    if pass_name == 'shaft':
        mat = _heart_scene()
        heart.heartbeat(mat, n, fps, bpm=44, amount=0.25, start=1)
        cam = cine.camera(loc=(0, -40, 12), target=(0, 0, 12), lens=30, clip=(0.05, 3000))
        _keys(cam, [(1, (0.0, -60.0, 8.0), (0.0, 0.0, 12.0), 32.0),
                    (_sec(0.8), (0.0, -34.0, 24.0), (0.0, 0.0, 45.0), 28.0),
                    (_sec(1.5), (0.0, -2.0, 44.0), (0.0, 0.4, 200.0), 22.0),
                    (_sec(2.4), (0.0, 0.0, 146.0), (0.0, 0.4, 400.0), 22.0)])
        return
    # the castle grows around the camera; the camera flies back to the establishing composition
    castle.build(tagged=True)
    castle.terrain()
    castle.backdrop()
    cine.noink('CV_PRESENT_VEG', 'TERRAIN_VEG')
    cine.ink_lines(color='#0b0706', thickness=1.4, noise=1.0, fade=(60.0, 900.0))
    se.look('PAST_DUSK')
    # a stone well where the shaft reaches the ward
    mb = cine.MeshBuilder()
    well_mat = castle.material('PAST_DUSK', 'stone')
    mb.cylinder('CV_SHARED', well_mat, 0.0, -30.0, castle.Z0 - 6, castle.Z0 + 1.1, 3.2, n=20, top=False)
    mb.build('well')
    grow = {  # tag: (start s, end s) on the S03 clock; the pass starts 2.0 s into the shot
        'wall': (2.05, 3.3), 'tower': (2.3, 3.6), 'gatehouse': (2.4, 3.5), 'hall': (2.7, 3.9), 'keep': (2.9, 4.3),
        'bell': (3.1, 4.5), 'chapel': (3.3, 4.4), 'ward': (3.4, 4.2), 'banners': (4.3, 4.9), 'life': (4.5, 5.2),
    }
    rng = random.Random(3)
    tags = {}
    for ob in bpy.data.objects:
        t = ob.get('tag')
        if t: tags.setdefault(t, []).append(ob)
    for t, obs in tags.items():
        key = next((k for k in grow if t.startswith(k)), None)
        if key is None: continue
        a, b = grow[key]
        jit = rng.uniform(-0.12, 0.12) if key in ('wall', 'tower') else 0.0
        a, b = a + jit, b + jit
        if key == 'banners':
            ztop = max(max((ob.matrix_world @ Vector(c)).z for c in ob.bound_box) for ob in obs)
            pivot = ztop
        else:
            pivot = min(min((ob.matrix_world @ Vector(c)).z for c in ob.bound_box) for ob in obs)
        for ob in obs:
            me = ob.data
            for v in me.vertices: v.co.z -= pivot
            ob.location.z += pivot
            ob.scale = (1, 1, 0.001); ob.keyframe_insert('scale', frame=_sec(a))
            ob.scale = (1, 1, 1.0); ob.keyframe_insert('scale', frame=_sec(b))
    # the windows kindle as the creed is spoken: the castle remembering its rulers
    for role in ('window', 'window_dim', 'torch', 'gate_glow'):
        m = castle.material('PAST_DUSK', role)
        em = [nd for nd in m.node_tree.nodes if nd.type == 'EMISSION'][0]
        base = em.inputs['Strength'].default_value
        em.inputs['Strength'].driver_remove('default_value')
        for f, v in ((1, 0.0), (_sec(4.4), 0.0), (_sec(5.4), base), (n, base)):
            em.inputs['Strength'].default_value = v; em.inputs['Strength'].keyframe_insert('default_value', frame=f)
    cam = cine.camera(loc=(0, -30, 199), target=(0, -30, 400), lens=22, clip=(0.1, 12000))
    _keys(cam, [(_sec(2.0), (0.0, -30.0, 198.0), (18.0, 12.0, 262.0), 22.0),
                (_sec(2.9), (-2.0, -40.0, 214.0), (16.0, 14.0, 250.0), 22.0),
                (_sec(4.2), (2.0, -90.0, 262.0), (4.0, 20.0, 230.0), 26.0),
                (n, (8.0, -330.0, 150.0), (8.0, 0.0, 150.0), 35.0)])
    cam.data.shift_y = 0.0; cam.data.keyframe_insert('shift_y', frame=_sec(4.2))
    cam.data.shift_y = 0.22; cam.data.keyframe_insert('shift_y', frame=n)

# ------------------------------------------------------------------------------------------------ S09a
def build_s09a(pass_name, n, fps, **_):
    mat = _heart_scene(glow=3.0, rage=0.8)
    heart.key_value(mat, 'Glow', [(1, 3.0), (n, 8.0)])
    heart.key_value(mat, 'Rage', [(1, 0.85), (n, 0.1)])
    # the column of light rushing up the conduit
    col = cine.mat_emit('surge_core', '#fff0c8', 40.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=2.6, depth=1.0, location=(0, 0, 40.0))
    c = bpy.context.active_object; c.name = 'surge_core'; c.data.materials.append(col)
    for v in c.data.vertices: v.co.z += 0.5          # base at the origin
    c.location = (0, 0, 20.0)
    c.scale = (1, 1, 1.0); c.keyframe_insert('scale', frame=1)
    c.scale = (1, 1, 140.0); c.keyframe_insert('scale', frame=n - 4)
    for o in bpy.data.objects:
        if o.type == 'LIGHT' and o.name.startswith('shaftlight'):
            base = o.data.energy
            o.data.energy = base * 0.6; o.data.keyframe_insert('energy', frame=1)
            o.data.energy = base * 6.0; o.data.keyframe_insert('energy', frame=n)
    cam = cine.camera(loc=(0, -3, 30), target=(0, 0, 200), lens=20, clip=(0.05, 3000))
    _keys(cam, [(1, (0.0, -3.0, 26.0), (0.0, 0.4, 200.0), 20.0), (n, (0.0, -1.5, 70.0), (0.0, 0.4, 300.0), 18.0)])

REG = {
    'S03_rise': {'build': build_s03, 'passes': ['shaft', 'castle']},
    'S09a_surge': {'build': build_s09a, 'passes': ['main']},
}
