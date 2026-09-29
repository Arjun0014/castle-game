"""S06 (the child at the servants' door) and S07 (the king goes down to the heart)."""
import math, random
import bpy
from mathutils import Vector
import cine, figures, gate
from cine import hexc

def _sec(t, fps=24): return 1 + round(t * fps)

def _stone(name, dark='#070404', body='#2a1a12', lit='#b07040', rim='#ffc080', masonry=(0.8, 0.4)):
    return cine.mat_ink(name, dark, body, lit, rim=rim, mottle=0.35, mottle_scale=1.2, masonry=masonry, masonry_strength=0.55, sheen=0.12)

def _dark_world(amb='#030202'):
    cine.world_sky(top='#000000', horizon='#000000', low='#000000', sun_size=0.0, sun_glow=0.0, clouds=0.0, ambient=amb)
    cine.set_fog('#0c0604', 0.05, start=2.0, maxf=0.7)

# ------------------------------------------------------------------------------------------------ S06
def build_s06(pass_name, n, fps, **_):
    _dark_world()
    st = _stone('s06_stone', dark='#030101', body='#120a06', lit='#6a3a1c', rim='#ff9a50')
    mb = cine.MeshBuilder()
    W, H, D = 1.25, 3.3, 7.0
    # corridor walls and vault (camera looks +Y down the corridor)
    mb.box('SET', st, -W - 0.5, -W, -1.0, D, 0.0, H)
    mb.box('SET', st, W, W + 0.5, -1.0, D, 0.0, H)
    gate.barrel_vault(mb, 'SET', st, -1.0, D, w=W, spring=H - W)
    mb.box('SET', st, -W, W, -1.0, D, -0.3, 0.0)
    # end wall with the low servants' door (arched), a black void beyond it
    dw, dh = 0.55, 1.55
    prof = [(-W, 0.0), (-dw, 0.0)] + [(-dw * math.cos(math.pi * i / 16), dh + dw * math.sin(math.pi * i / 16)) for i in range(17)] + [(dw, 0.0), (W, 0.0), (W, H + 0.5), (-W, H + 0.5)]
    gate.extrude_profile(mb, 'SET', st, prof, D, D + 0.6)
    void = cine.mat_flat('void', '#000000')
    mb.box('SET', void, -dw - 0.1, dw + 0.1, D + 0.6, D + 0.7, 0.0, dh + dw + 0.1)
    mb.build('s06')
    # the door leaf: hinged on the left, standing open toward us, then pushed shut by her hand
    wood = cine.mat_ink('s06_wood', '#060302', '#24140a', '#8a5028', rim='#ffb070', mottle=0.3, mottle_scale=4.0)
    lm = cine.MeshBuilder()
    for k in range(4):
        x0 = k * (2 * dw) / 4
        lm.box('DOOR', wood, x0 + 0.01, x0 + (2 * dw) / 4 - 0.01, -0.03, 0.03, 0.0, dh + dw * math.sin(math.acos(max(-1, min(1, (x0 + dw / 4 - dw) / dw)))) - 0.02)
    leaf = lm.build('leaf')[0]
    for v in leaf.data.vertices: v.co.x -= 0.0
    leaf.location = (-dw, D - 0.02, 0.0)
    close = _sec(1.0)
    for f, deg in ((1, 82.0), (_sec(0.62), 82.0), (close + 8, 4.0), (close + 11, 0.0)):
        leaf.rotation_euler = (0, 0, math.radians(-deg)); leaf.keyframe_insert('rotation_euler', frame=f)
    # the child: a small hooded figure stepping into the dark, looking back once
    child = figures.load('hero', 'Child', 'FIGS', actions=('walk_fwd',))
    child.hide('Sword')
    child.place((0.05, D - 0.55, 0.0), facing_deg=90.0, scale=0.56)
    figures.play(child, 'walk_fwd', start=1, speed=0.62, repeat=2.0, offset=4)
    child.arm.keyframe_insert('location', frame=1)
    child.arm.location = (0.02, D + 0.35, 0.0); child.arm.keyframe_insert('location', frame=_sec(0.9))
    hb = child.arm.pose.bones['mixamorig:Head']; hb.rotation_mode = 'XYZ'
    hb.scale = (1.3, 1.3, 1.3)
    for f, a in ((1, 0.0), (_sec(0.35), 0.0), (_sec(0.6), -0.9), (_sec(0.85), -0.9), (_sec(1.05), -0.3)):
        hb.rotation_euler = (0.0, a, 0.0); hb.keyframe_insert('rotation_euler', frame=f)
    cm = figures.silhouette(child, body='#020101', mid='#0a0504', lit='#3a1c0c', rim='#ffb468', sheen=0.3)
    cloak = figures.cloak_mesh('child_cloak', cm, height=0.95, r_top=0.14, r_bot=0.34, open_front=0.0)
    figures.attach(cloak, child, 'chest', offset=(0, 0.02, 0), rot=(math.radians(-90), 0, 0))
    hood = cine.MeshBuilder(); hood.cylinder('PROPS', cm, 0, 0, -0.02, 0.2, 0.17, n=14, r_top=0.05)
    hd = hood.build('hood')[0]; figures.attach(hd, child, 'head', offset=(0, -0.12, 0.0), rot=(math.radians(-90), 0, 0))
    # she stands inside the doorway's thickness: once the leaf covers the arch, her cloak would poke through it
    for ob in list(child.meshes) + [cloak, hd]:
        ob.hide_render = False; ob.keyframe_insert('hide_render', frame=close + 4)
        ob.hide_render = True; ob.keyframe_insert('hide_render', frame=close + 5)
    # the woman: only her silhouette and a gowned sleeve at the left edge; her hand on the child's back, then the door
    woman = figures.load('hero', 'Woman', 'FIGS', actions=('idle_alert',))
    woman.hide('Sword')
    figures.hold_pose(woman, 'idle_alert', 30)
    woman.place((-0.72, D - 1.35, 0.0), facing_deg=62.0)
    wm = figures.silhouette(woman, body='#020101', mid='#0c0504', lit='#4a2410', rim='#ffb468', sheen=0.3)
    gown = figures.cloak_mesh('gown', wm, height=1.35, r_top=0.24, r_bot=0.55, open_front=0.0)
    figures.attach(gown, woman, 'chest', offset=(0, 0.04, 0), rot=(math.radians(-90), 0, 0))
    sleeve = figures.cloak_mesh('sleeve', wm, height=0.3, r_top=0.06, r_bot=0.14, open_front=0.0)
    figures.attach(sleeve, woman, 'mixamorig:RightForeArm', offset=(0, -0.02, 0), rot=(math.radians(180), 0, 0))
    ik = figures.reach(woman, 'Right', (-0.1, D - 0.5, 0.95), pole=(-1.4, D - 2.5, 0.3))
    for f, p_ in ((1, (-0.14, D - 0.62, 0.9)), (_sec(0.45), (-0.06, D - 0.3, 0.93)), (_sec(0.72), (-0.42, D - 0.25, 1.08)),
                  (close, (-0.36, D - 0.06, 1.1)), (close + 11, (-0.12, D - 0.04, 1.1))):
        ik.location = p_; ik.keyframe_insert('location', frame=f)
    # guards pass a torch in a side passage: their spear-shadows sweep across the right wall
    torch = cine.point('sidetorch', (-0.2, 1.2, 1.9), '#ff9040', 160.0, radius=0.06, shadow=True)
    for i in range(2):
        k = figures.load('knight', f'sguard{i}', 'FIGS', actions=('K_walk_fwd',))
        figures.play(k, 'K_walk_fwd', start=1, speed=0.8, repeat=3.0, offset=i * 9)
        k.place((-1.6, 1.0 - i * 0.9, 0.0), facing_deg=0.0)
        k.arm.keyframe_insert('location', frame=1)
        k.arm.location = (0.6, 1.0 - i * 0.9, 0.0); k.arm.keyframe_insert('location', frame=n)
        figures.silhouette(k)
        for m in k.meshes: m.visible_camera = False       # only their shadows are seen
    cine.point('warm', (-1.05, D - 2.2, 2.2), '#ff9a50', 55.0, radius=0.12, shadow=True)
    cine.noink('PROPS')
    cine.ink_lines(color='#050202', thickness=1.2, noise=0.7, fade=(1.5, 14.0))
    cine.compositor(kuwahara=5, glare=0.6, glare_threshold=0.75, glare_size=6)
    cam = cine.camera(loc=(0.3, D - 3.6, 1.05), target=(0.0, D, 1.1), lens=28, clip=(0.02, 200))
    cam.keyframe_insert('location', frame=1)
    cam.location = (0.28, D - 3.25, 1.05); cam.keyframe_insert('location', frame=n)

# ------------------------------------------------------------------------------------------------ S07
def build_s07(pass_name, n, fps, **_):
    _dark_world()
    cine.set_fog('#1a0604', 0.035, start=3.0, maxf=0.6)
    st = _stone('s07_stone', dark='#040202', body='#1e0e0a', lit='#c05a28', rim='#ff9a50', masonry=(0.7, 0.36))
    mb = cine.MeshBuilder()
    R_OUT, R_NEW, RISE, PER_TURN = 3.7, 1.35, 0.22, 16
    z_top, steps = 4.0, 150
    for i in range(steps):
        a0 = -2 * math.pi * i / PER_TURN; a1 = -2 * math.pi * (i + 1.08) / PER_TURN
        z = z_top - i * RISE
        pts_top = [(R_NEW * math.cos(a0), R_NEW * math.sin(a0)), (R_OUT * math.cos(a0), R_OUT * math.sin(a0)),
                   (R_OUT * math.cos(a1), R_OUT * math.sin(a1)), (R_NEW * math.cos(a1), R_NEW * math.sin(a1))]
        top = [(x, y, z) for x, y in pts_top]; bot = [(x, y, z - RISE * 1.6) for x, y in pts_top]
        mb.poly('SET', st, top)
        for k in range(4):
            j = (k + 1) % 4
            mb.poly('SET', st, [top[k], bot[k], bot[j], top[j]])
    # outer wall (faces inward)
    segs = 48
    zb, zt = z_top - steps * RISE - 3, z_top + 6
    for i in range(segs):
        a0 = 2 * math.pi * i / segs; a1 = 2 * math.pi * (i + 1) / segs
        mb.poly('SET', st, [(R_OUT + 0.05) * Vector((math.cos(a1), math.sin(a1), 0)) + Vector((0, 0, zb)),
                            (R_OUT + 0.05) * Vector((math.cos(a0), math.sin(a0), 0)) + Vector((0, 0, zb)),
                            (R_OUT + 0.05) * Vector((math.cos(a0), math.sin(a0), 0)) + Vector((0, 0, zt)),
                            (R_OUT + 0.05) * Vector((math.cos(a1), math.sin(a1), 0)) + Vector((0, 0, zt))])
    mb.build('stair')
    # the glow far below (the heart's light welling up the stair)
    glow = cine.mat_emit('below', '#ff6a20', 30.0)
    bpy.ops.mesh.primitive_circle_add(vertices=32, radius=R_OUT, fill_type='NGON', location=(0, 0, zb + 0.5))
    g = bpy.context.active_object; g.data.materials.append(glow)
    for k, (z, e) in enumerate(((zb + 3.0, 60000.0), (zb + 12.0, 12000.0))):
        cine.point(f'below{k}', (0.0, 0.0, z), '#ff7a2a', e, radius=0.6, shadow=True)
    # the king: armoured, crowned, cloaked — seen from behind and above; his shadow climbs the wall
    k = figures.load('knight', 'King', 'FIGS', actions=('K_walk_fwd',))
    km = figures.silhouette(k, body='#030101', mid='#120606', lit='#6a2a10', rim='#ff9a50')
    crown = figures.crown_mesh('crown', km, r=0.12, h=0.1)
    figures.attach(crown, k, 'head', offset=(0, 0.06, 0), rot=(math.radians(-90), 0, 0))
    cloak = figures.cloak_mesh('cloak', km, height=1.55, r_top=0.24, r_bot=0.66, open_front=1.6)
    figures.attach(cloak, k, 'chest', offset=(0, 0.04, 0.02), rot=(math.radians(-90), 0, math.radians(180)))
    figures.play(k, 'K_walk_fwd', start=1, speed=0.62, repeat=5.0)
    r_path = 2.5
    step_len = 2 * math.pi * r_path / PER_TURN
    speed = 0.95                                       # m/s along the path (slow, deliberate)
    i0 = 6.0
    for f in range(1, n + 1, 3):
        s_ = i0 + (f - 1) / fps * speed / step_len        # steps descended
        a = -2 * math.pi * s_ / PER_TURN
        z = z_top - s_ * RISE - RISE * 0.3
        k.arm.location = (r_path * math.cos(a), r_path * math.sin(a), z)
        k.arm.rotation_euler = (k.arm.rotation_euler.x, 0.0, a)   # heading a - pi/2 (clockwise descent), rigs face -Y at 0
        k.arm.keyframe_insert('location', frame=f); k.arm.keyframe_insert('rotation_euler', frame=f)
    # a torch on the wall behind and above him: his crowned shadow runs ahead of him down the steps, toward the glow
    lt = cine.point('walltorch', (0, 0, 0), '#ff9a50', 900.0, radius=0.05, shadow=True)
    for f in (1, n):
        s_ = i0 + (f - 1) / fps * speed / step_len
        a = -2 * math.pi * (s_ - 2.6) / PER_TURN
        lt.location = (3.3 * math.cos(a), 3.3 * math.sin(a), z_top - (s_ - 2.6) * RISE + 2.4); lt.keyframe_insert('location', frame=f)
    # the vortex: straight down the well from above, turning slowly with the spiral, sinking with him
    cam = cine.camera(loc=(0, 0, 0), target=(0, 0, -1), lens=18, clip=(0.02, 300))
    for f in (1, n):
        s_ = i0 + (f - 1) / fps * speed / step_len
        zk = z_top - s_ * RISE
        a = -2 * math.pi * s_ / PER_TURN
        cam.location = (0.35 * math.cos(a), 0.35 * math.sin(a), zk + 7.5)
        cine.look_at(cam, (0.9 * math.cos(a), 0.9 * math.sin(a), zk - 6.0), roll=0.0)
        cam.rotation_euler.rotate_axis('Z', -a)
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    cine.noink('PROPS')
    cine.ink_lines(color='#060202', thickness=1.2, noise=0.8, fade=(1.5, 20.0))
    cine.compositor(kuwahara=5, glare=0.8, glare_threshold=0.7, glare_size=7)

REG = {
    'S06_child': {'build': build_s06, 'passes': ['main']},
    'S07_descent': {'build': build_s07, 'passes': ['main']},
}
