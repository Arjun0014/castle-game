"""Shots under the mountain: S01 (the heart wakes), S02 (the founders' blood), S08 (the king's asking),
S09a (the heart flares). All timings are local frames derived from the film clock in timeline.json.
"""
import math, random
import bpy
from mathutils import Vector
import cine, heart
from cine import hexc

def _sec(t, fps=24): return 1 + round(t * fps)

def _setup(glow_keys, rage=0.0, impact=(0.15, -1.0, 0.55)):
    heart.dark_world()
    mat = heart.heart_material(impact=impact)
    heart.heart_object(mat)
    heart.cavern()
    heart.heart_lights()
    heart.key_value(mat, 'Glow', glow_keys)
    heart.key_value(mat, 'Rage', [(1, rage)])
    cine.noink('FOUNDERS')
    cine.ink_lines(color='#0a0504', thickness=1.3, noise=0.9, fade=(20.0, 140.0))
    cine.compositor(kuwahara=6, glare=0.9, glare_threshold=0.7, glare_size=8)
    return mat

def _cam_keys(cam, keys, lens=None):
    """keys: [(frame, loc, target, lens)]"""
    for f, loc, tgt, ln in keys:
        cam.location = loc; cine.look_at(cam, tgt)
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        cam.data.lens = ln; cam.data.keyframe_insert('lens', frame=f)
    cine.ease(cam); cine.ease(cam.data)

def _light_energy(scale_keys):
    for o in bpy.data.objects:
        if o.type == 'LIGHT' and o.name.startswith('heartlight'):
            base = o.data.energy
            for f, k in scale_keys:
                o.data.energy = base * k; o.data.keyframe_insert('energy', frame=f)
            o.data.energy = base

# ------------------------------------------------------------------------------------------------ S01
def build_s01(pass_name, n, fps, **_):
    # black for 0.9 s; the grooves kindle; a heartbeat; a stronger beat on "heart" (film 6.3 s)
    mat = _setup([(1, 0.0), (_sec(0.9), 0.0), (_sec(2.6), 0.45), (_sec(5.6), 0.7), (_sec(6.3), 1.25), (n, 0.9)])
    heart.heartbeat(mat, n, fps, bpm=40, amount=0.4, start=_sec(1.8))
    _light_energy([(1, 0.0), (_sec(0.9), 0.0), (_sec(2.6), 0.35), (_sec(5.6), 0.55), (_sec(6.3), 0.95), (n, 0.8)])
    cam = cine.camera(loc=(3.0, -16.8, 16.5), target=(2.5, -12.5, 16.0), lens=40, clip=(0.05, 2000))
    # start on one burning groove (abstract), pull back to reveal the colossus in its cave
    _cam_keys(cam, [(1, (2.2, -12.4, 9.8), (1.4, -8.5, 8.8), 45.0),
                    (_sec(2.4), (2.4, -15.5, 9.6), (1.2, -8.5, 8.2), 42.0),
                    (n, (0.0, -44.0, 5.0), (0.0, 0.0, 4.5), 35.0)])

# ------------------------------------------------------------------------------------------------ S02
# film 6.90 -> 13.80. Local seconds: wide 0.0-1.5 (they come), kneel 1.5-2.45 (the lord at the colossus, arm out),
# drop 2.45-3.3 (the drop falls into a groove on "blood" at 2.82), wide 3.3-6.9 (the gold runs; they kneel).
S02_IMPACT = 2.82
TOUCH = heart.surface(0.06, 0.95)                      # the point on the dome the blood (and later the king) touches

def _impact_dir(p=TOUCH):
    return tuple((p - heart.HEART_C).normalized())

import figures

def _founder(i, loc, facing, torch=True, hooded=True):
    f = figures.load('hero', f'founder{i}', 'FIGS', actions=('walk_fwd', 'crouch_idle', 'idle_alert'))
    f.hide('Sword')
    f.place(loc, facing_deg=facing, scale=1.02)
    m = figures.silhouette(f, body='#010000', mid='#060302', lit='#261006', rim='#ff9a50', sheen=0.1)
    cl = figures.cloak_mesh(f'cloak{i}', m, height=1.4, r_top=0.26, r_bot=0.55, open_front=0.8)
    figures.attach(cl, f, 'chest', offset=(0, 0.05, 0), rot=(math.radians(-90), 0, 0))
    if hooded:
        hb = cine.MeshBuilder(); hb.cylinder('PROPS', m, 0, 0, -0.04, 0.24, 0.19, n=14, r_top=0.06)
        figures.attach(hb.build(f'hood{i}')[0], f, 'head', offset=(0, -0.13, 0.0), rot=(math.radians(-90), 0, 0))
    if torch:
        fl = bpy.data.materials.get('torchflame') or cine.mat_emit('torchflame', '#ffb050', 18.0, flicker=0.3, seed=3.0)
        for o in figures.torch_mesh(f'torch{i}', m, fl):
            figures.attach(o, f, 'hand_l', offset=(0, 0.02, 0.0), rot=(0, 0, 0))
    return f

def build_s02(pass_name, n, fps, **_):
    imp = _sec(S02_IMPACT)
    mat = _setup([(1, 0.85), (imp - 2, 0.85), (imp + 10, 1.5), (n, 1.3)], impact=_impact_dir())
    heart.heartbeat(mat, n, fps, bpm=44, amount=0.3, start=1)
    heart.key_value(mat, 'RippleI', [(1, 0.0), (imp, 0.0), (imp + 1, 0.45), (imp + 8, 0.8), (n, 0.8)])
    heart.key_value(mat, 'RippleR', [(1, -1.0), (imp, 0.0), (imp + 48, 2.0), (n, 3.3)])
    _light_energy([(1, 0.8), (imp, 0.8), (imp + 14, 1.5), (n, 1.35)])
    if pass_name == 'wide':
        spots = [(-4.0, -21.0), (-1.6, -23.5), (1.2, -22.0), (3.8, -24.0)]
        for i, (x, y) in enumerate(spots):
            f = _founder(i, (x, y - 5.0, 0.0), 90.0, torch=(i != 1))
            # they walk the last few metres, then (after the cut) kneel
            figures.play(f, 'walk_fwd', start=1, speed=0.7, repeat=2.0, offset=i * 7)
            f.arm.keyframe_insert('location', frame=1)
            f.arm.location = (x, y - 5.0 + 1.472 * 0.875 * 1.45, 0.0); f.arm.keyframe_insert('location', frame=_sec(1.45))
            ad = f.arm.animation_data
            tr = ad.nla_tracks.new(); st = tr.strips.new('kneel', _sec(3.3), figures.action('crouch_idle'))
            st.extrapolation = 'HOLD'; st.repeat = 1.0
            try: st.action_slot = figures.action('crouch_idle').slots[0]
            except Exception: pass
            f.arm.location = (x * 1.1, -16.0 - i * 0.3, 0.0); f.arm.keyframe_insert('location', frame=_sec(3.3))
        cam = cine.camera(loc=(0, 0, 0), target=(0, 0, 0), lens=35, clip=(0.05, 2000))
        _cam_keys(cam, [(1, (7.0, -50.0, 2.2), (0.0, 0.0, 4.0), 35.0), (_sec(1.5), (6.0, -45.0, 2.6), (0.0, 0.0, 4.5), 35.0),
                        (_sec(3.3), (3.0, -52.0, 3.5), (0.0, 0.0, 5.0), 32.0), (n, (0.0, -68.0, 5.0), (0.0, 0.0, 5.5), 32.0)])
    elif pass_name == 'kneel':
        lord = _founder(9, (0.35, TOUCH.y - 1.15, 0.0), 90.0, torch=False)
        figures.hold_pose(lord, 'crouch_idle', 12)
        figures.open_hand(lord, 'Right')
        figures.reach(lord, 'Right', tuple(TOUCH + Vector((0.02, -0.32, 0.42))), pole=(1.4, TOUCH.y - 1.6, 0.3))
        for i, (x, y) in enumerate([(-2.6, -18.5), (2.9, -19.2)]):
            _founder(i, (x, y, 0.0), 90.0, torch=True)
        blood = cine.mat_emit('blood', '#d01010', 4.0)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.028, location=tuple(TOUCH + Vector((0.02, -0.3, 0.33))))
        dr = bpy.context.active_object; dr.data.materials.append(blood)
        cam = cine.camera(loc=(0, 0, 0), target=(0, 0, 0), lens=45, clip=(0.02, 800), dof=(3.6, 2.2))
        _cam_keys(cam, [(_sec(1.5), (-2.5, TOUCH.y - 3.4, 1.0), (0.2, TOUCH.y - 0.4, 1.0), 45.0), (_sec(2.5), (-2.3, TOUCH.y - 3.0, 0.98), (0.2, TOUCH.y - 0.3, 1.0), 48.0)])
    else:  # 'drop': extreme close-up — the drop falls into a burning groove on "blood"
        blood = cine.mat_emit('blood', '#d01010', 4.0)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.03, location=tuple(TOUCH))
        dr = bpy.context.active_object; dr.name = 'drop'; dr.data.materials.append(blood); dr.scale = (1, 1, 1.4)
        top = TOUCH + Vector((0.0, -0.3, 0.33))
        for f, pos, sc in ((1, top, 1.0), (_sec(2.45), top, 1.0), (imp, TOUCH + Vector((0, -0.02, 0.02)), 1.0), (imp + 1, TOUCH, 0.01)):
            dr.location = pos; dr.keyframe_insert('location', frame=f); dr.scale = (sc, sc, sc * 1.4); dr.keyframe_insert('scale', frame=f)
        for fc in cine._fcurves(dr.animation_data.action):
            for kp in fc.keyframe_points: kp.interpolation = 'QUAD'; kp.easing = 'EASE_IN'
        cam = cine.camera(loc=(0, 0, 0), target=(0, 0, 0), lens=38, clip=(0.005, 200), dof=(1.0, 3.2))
        _cam_keys(cam, [(_sec(2.45), TOUCH + Vector((-0.75, -0.85, 0.3)), TOUCH + Vector((0, -0.15, 0.2)), 38.0),
                        (_sec(3.3), TOUCH + Vector((-0.66, -0.75, 0.2)), TOUCH + Vector((0, -0.05, 0.08)), 40.0)])

# ------------------------------------------------------------------------------------------------ S08
def build_s08(pass_name, n, fps, **_):
    touch = heart.surface(0.18, 1.45, out=0.02)
    mat = _setup([(1, 1.0), (_sec(0.6), 1.3), (n, 2.4)], rage=0.0, impact=_impact_dir(touch))
    heart.key_value(mat, 'Rage', [(1, 0.15), (_sec(1.2), 0.5), (n, 0.9)])
    heart.key_value(mat, 'RippleI', [(1, 0.0), (_sec(0.25), 1.0), (n, 1.4)])
    heart.key_value(mat, 'RippleR', [(1, 0.0), (_sec(0.25), 0.02), (n, 1.7)])
    heart.heartbeat(mat, n, fps, bpm=66, amount=0.45, start=1)
    _light_energy([(1, 1.0), (n, 2.3)])
    k = figures.load('knight', 'King', 'FIGS', actions=('K_walk_fwd',))
    figures.hold_pose(k, 'K_walk_fwd', 2)
    k.place((0.75, touch.y - 1.25, 0.0), facing_deg=100.0)
    km = figures.silhouette(k, body='#010000', mid='#050202', lit='#2a0e06', rim='#ff6a30', sheen=0.12)
    crown = figures.crown_mesh('crown', km, r=0.12, h=0.1)
    figures.attach(crown, k, 'head', offset=(0, 0.06, 0), rot=(math.radians(-90), 0, 0))
    cloak = figures.cloak_mesh('cloak', km, height=1.4, r_top=0.22, r_bot=0.46, open_front=1.8)
    figures.attach(cloak, k, 'chest', offset=(0, 0.04, 0.02), rot=(math.radians(-90), 0, math.radians(180)))
    figures.reach(k, 'Right', tuple(touch + Vector((0.0, -0.05, 0.0))), pole=(1.8, touch.y - 1.7, 0.6))
    figures.point_fingers(k, 'Right', tuple(touch + Vector((0.05, 0.1, 0.45))))
    cine.noink('PROPS')
    # from behind the king, a little low: his silhouette against the burning colossus, his palm on it
    cam = cine.camera(loc=(0, 0, 0), target=(0, 0, 0), lens=30, clip=(0.02, 800), dof=(5.0, 4.0))
    _cam_keys(cam, [(1, (1.9, touch.y - 5.4, 1.2), touch + Vector((-0.2, 0.0, 0.9)), 30.0), (n, (1.6, touch.y - 4.5, 1.25), touch + Vector((-0.15, 0.0, 0.8)), 32.0)])

REG = {
    'S01_heart': {'build': build_s01, 'passes': ['main']},
    'S02_blood': {'build': build_s02, 'passes': ['wide', 'kneel', 'drop']},
    'S08_asking': {'build': build_s08, 'passes': ['main']},
}
