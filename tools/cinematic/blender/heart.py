"""The Crownheart and its cavern (S01, S02, S08, S09a).

A colossal sphere of dark stone, half-buried, carved with concentric whorls around a pole (a fingerprint, tree
rings: identity and memory). Red-gold light lives in the grooves. Animated inputs (keyframable Value nodes on the
material): Glow (overall), Pulse (heartbeat multiplier), RippleR / RippleI (a gold wave racing across the surface
from an impact direction), Rage (shifts the light from gold toward angry red — the king's asking).
"""
import math, random
import bpy
from mathutils import Vector
import cine
from cine import hexc

HEART_C = Vector((0.0, 0.0, -2.0))       # half-buried: only its upper dome rises from the cavern floor
HEART_R = 14.0

def surface(x, z, out=0.0):
    """The point on the heart's front (-Y) surface at (x, z), pushed `out` metres along the normal."""
    import math as _m
    dz = z - HEART_C.z
    y = -_m.sqrt(max(0.0, HEART_R ** 2 - x * x - dz * dz))
    p = Vector((x, y, z)); n = (p - HEART_C).normalized()
    return p + n * out

def _v(N, name, value):
    n = N.new('ShaderNodeValue'); n.name = name; n.label = name; n.outputs[0].default_value = value
    return n

def heart_material(pole=(0.0, -1.0, 0.25), impact=(0.15, -1.0, 0.55), rings=64):
    m = bpy.data.materials.new('Crownheart')
    m.use_nodes = True
    nt = m.node_tree; N, L = nt.nodes, nt.links
    for x in list(N): N.remove(x)
    out = N.new('ShaderNodeOutputMaterial')
    tc = N.new('ShaderNodeTexCoord')
    d = N.new('ShaderNodeVectorMath'); d.operation = 'NORMALIZE'; L.new(tc.outputs['Object'], d.inputs[0])
    def dot(vec):
        n = N.new('ShaderNodeVectorMath'); n.operation = 'DOT_PRODUCT'; L.new(d.outputs[0], n.inputs[0]); n.inputs[1].default_value = Vector(vec).normalized(); return n.outputs['Value']
    def math_(op, a, b=None, clamp=False):
        n = N.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]
    # polar angle from the pole, azimuth around it
    cz = dot(pole)
    theta = math_('ARCCOSINE', cz)
    ax = Vector(pole).normalized().orthogonal().normalized()
    ay = Vector(pole).normalized().cross(ax)
    px = dot(ax); py = dot(ay)
    phi = math_('ARCTAN2', py, px)
    # whorl: a gentle drift of the rings with azimuth (a fingerprint's core, not a target)
    w1 = math_('SINE', math_('ADD', math_('MULTIPLY', phi, 2.0), math_('MULTIPLY', theta, 3.0)))
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.2; nz.inputs['Detail'].default_value = 2.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    th2 = math_('ADD', theta, math_('ADD', math_('MULTIPLY', w1, 0.012), math_('MULTIPLY', math_('SUBTRACT', nz.outputs['Fac'], 0.5), 0.012)))
    rs = math_('MULTIPLY', th2, rings / math.pi)
    ringv = math_('FRACT', rs)
    dist = math_('MINIMUM', ringv, math_('SUBTRACT', 1.0, ringv))
    groove = math_('SUBTRACT', 1.0, math_('DIVIDE', dist, 0.09), clamp=True)          # thin, even carved lines
    groove = math_('POWER', groove, 1.6)
    # worn engraving: some arcs of each ring are dark (hash of ring index + azimuth band)
    ridx = math_('FLOOR', rs)
    seg = N.new('ShaderNodeTexNoise'); seg.inputs['Scale'].default_value = 1.3; seg.inputs['Detail'].default_value = 2.0
    segv = N.new('ShaderNodeCombineXYZ')
    L.new(math_('MULTIPLY', math_('COSINE', phi), 1.4), segv.inputs['X']); L.new(math_('MULTIPLY', math_('SINE', phi), 1.4), segv.inputs['Y'])
    L.new(math_('MULTIPLY', ridx, 0.37), segv.inputs['Z'])
    L.new(segv.outputs[0], seg.inputs['Vector'])
    km = N.new('ShaderNodeMapRange'); km.inputs['From Min'].default_value = 0.40; km.inputs['From Max'].default_value = 0.47
    L.new(seg.outputs['Fac'], km.inputs['Value']); keep = km.outputs['Result']
    groove = math_('MULTIPLY', groove, keep)
    # a few straight meridians, fading out toward the pole
    fr = math_('ABSOLUTE', math_('SINE', math_('MULTIPLY', phi, 3.0)))
    frac = math_('SUBTRACT', 1.0, math_('DIVIDE', fr, 0.012), clamp=True)
    frac = math_('MULTIPLY', frac, math_('SMOOTH_MIN', math_('MULTIPLY', theta, 1.4), 1.0, 0.3) if False else math_('MINIMUM', math_('MULTIPLY', math_('SUBTRACT', theta, 0.35), 2.0), 1.0))
    frac = math_('MAXIMUM', frac, 0.0)
    lines = math_('MAXIMUM', groove, math_('MULTIPLY', frac, 0.6))
    # the core: no whorl at the pole (it pinches); instead a single small ring, the heart's eye (echoed by the crest's ring)
    far = N.new('ShaderNodeMapRange'); far.inputs['From Min'].default_value = 0.075; far.inputs['From Max'].default_value = 0.11
    L.new(theta, far.inputs['Value'])
    lines = math_('MULTIPLY', lines, far.outputs['Result'])
    eye = math_('SUBTRACT', 1.0, math_('DIVIDE', math_('ABSOLUTE', math_('SUBTRACT', theta, 0.052)), 0.008), clamp=True)
    lines = math_('MAXIMUM', lines, math_('MULTIPLY', eye, 1.3))
    # variation along the grooves (some burn brighter)
    nz2 = N.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 3.0; nz2.inputs['Detail'].default_value = 2.0
    L.new(tc.outputs['Object'], nz2.inputs['Vector'])
    var = math_('POWER', math_('ADD', 0.15, math_('MULTIPLY', nz2.outputs['Fac'], 1.2)), 1.8)
    lines = math_('MULTIPLY', lines, var)
    glow = _v(N, 'Glow', 1.0); pulse = _v(N, 'Pulse', 1.0)
    rip_r = _v(N, 'RippleR', -1.0); rip_i = _v(N, 'RippleI', 0.0); rage = _v(N, 'Rage', 0.0)
    # ripple: a gold wave front at angular distance RippleR from the impact direction
    ang = math_('ARCCOSINE', dot(impact))
    band = math_('DIVIDE', math_('SUBTRACT', ang, rip_r.outputs[0]), 0.16)
    wave = math_('EXPONENT', math_('MULTIPLY', math_('MULTIPLY', band, band), -1.0))
    behind = math_('LESS_THAN', ang, rip_r.outputs[0])                     # what the wave has passed stays lit
    litb = math_('MULTIPLY', behind, 0.55)
    ripple = math_('MULTIPLY', math_('ADD', wave, litb), rip_i.outputs[0])
    strength = math_('MULTIPLY', lines, math_('ADD', math_('MULTIPLY', glow.outputs[0], pulse.outputs[0]), math_('MULTIPLY', ripple, 3.0)))
    # the wave front itself runs over the bare stone as a thin ring of gold (so the answer shows wherever it lands)
    front = math_('MULTIPLY', math_('EXPONENT', math_('MULTIPLY', math_('MULTIPLY', band, band), -9.0)), rip_i.outputs[0])
    strength = math_('ADD', math_('MULTIPLY', strength, 9.0), math_('MULTIPLY', front, 2.2))
    # colour: gold, pushed to angry red by Rage
    cm = N.new('ShaderNodeMix'); cm.data_type = 'RGBA'
    L.new(rage.outputs[0], cm.inputs['Factor']); cm.inputs['A'].default_value = hexc('#ffb048'); cm.inputs['B'].default_value = hexc('#ff2a10')
    em = N.new('ShaderNodeEmission'); L.new(cm.outputs['Result'], em.inputs['Color']); L.new(strength, em.inputs['Strength'])
    # the stone itself: a small NPR ramp (dark, warm where the cave light touches it)
    dif = N.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    bw = N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs['Color'], bw.inputs[0])
    ramp = N.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'EASE'
    cr.elements[0].color = hexc('#030101'); cr.elements[1].position = 1.0; cr.elements[1].color = hexc('#2a150c')
    e = cr.elements.new(0.45); e.color = hexc('#0c0604')
    L.new(bw.outputs[0], ramp.inputs['Fac'])
    sem = N.new('ShaderNodeEmission'); L.new(ramp.outputs['Color'], sem.inputs['Color'])
    add = N.new('ShaderNodeAddShader'); L.new(sem.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1])
    L.new(add.outputs[0], out.inputs['Surface'])
    return m

def key_value(mat, name, keys):
    """keys: [(frame, value)] on a named Value node of a material."""
    nd = mat.node_tree.nodes[name]
    for f, v in keys:
        nd.outputs[0].default_value = v; nd.outputs[0].keyframe_insert('default_value', frame=f)
    ad = mat.node_tree.animation_data
    if ad and ad.action:
        for fc in cine._fcurves(ad.action):
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'

def heartbeat(mat, n, fps, bpm=38, amount=0.35, start=1):
    """Double-thump heartbeat on Pulse."""
    keys = []
    period = 60.0 / bpm * fps
    f = start
    while f < n + period:
        keys += [(f, 1.0), (f + 2, 1.0 + amount), (f + 5, 1.0 + amount * 0.2), (f + 7, 1.0 + amount * 0.7), (f + 12, 1.0)]
        f += period
    key_value(mat, 'Pulse', [(round(a), b) for a, b in keys if a <= n + 1])

def cavern(seed=21):
    """An irregular faceted cave around the heart, open toward the camera side; ink on the fractures."""
    rng = random.Random(seed)
    rock = cine.mat_ink('cave_rock', '#030202', '#120a07', '#5a3018', rim='#a0501e', mottle=0.34, mottle_scale=0.25)
    segs, rings = 40, 22
    verts, faces = [], []
    for j in range(rings + 1):
        v = j / rings
        el = -0.35 * math.pi + v * 0.95 * math.pi          # from below the floor up over the vault
        for i in range(segs):
            az = 2 * math.pi * i / segs
            r = 64.0 + 12 * cine.fbm(math.cos(az) * 2 + 3, math.sin(az) * 2 + v * 3, 3, seed) + rng.uniform(-2.5, 2.5)
            x = r * math.cos(el) * math.cos(az)
            y = r * math.cos(el) * math.sin(az) * 1.2
            z = 10 + r * math.sin(el) * 0.75
            verts.append((x, y, z))
    for j in range(rings):
        for i in range(segs):
            a = j * segs + i; b = j * segs + (i + 1) % segs
            faces.append((a, a + segs, b + segs, b))       # inward-facing
    me = bpy.data.meshes.new('cave'); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new('cave', me); ob.data.materials.append(rock); cine.coll('CAVE').objects.link(ob)
    # floor: a rubble-strewn shelf
    fl = bpy.data.meshes.new('cave_floor')
    n = 40; S = 110.0
    fv = [(-S / 2 + S * i / n, -S / 2 + S * j / n, -1.0 + 1.5 * cine.fbm(i * 0.4, j * 0.4, 3, seed) + rng.uniform(-0.3, 0.3)) for j in range(n + 1) for i in range(n + 1)]
    ff = [(j * (n + 1) + i, j * (n + 1) + i + 1, (j + 1) * (n + 1) + i + 1, (j + 1) * (n + 1) + i) for j in range(n) for i in range(n)]
    # apron: the S02 wide pull-back reaches y = -68, past the shelf's edge (-S/2). Continue the same surface 15 rows
    # toward the camera, sharing the edge row (no border edge, so no ink line or seam); the original vertices are unchanged.
    m, rng2, base = 15, random.Random(seed + 1), len(fv)
    for j in range(-m, 0):
        for i in range(n + 1):
            fv.append((-S / 2 + S * i / n, -S / 2 + S * j / n, -1.0 + 1.5 * cine.fbm(i * 0.4, j * 0.4, 3, seed) + rng2.uniform(-0.3, 0.3)))
    av = lambda j, i: base + (j + m) * (n + 1) + i if j < 0 else j * (n + 1) + i
    ff += [(av(j, i), av(j, i + 1), av(j + 1, i + 1), av(j + 1, i)) for j in range(-m, 0) for i in range(n)]
    fl.from_pydata(fv, [], ff); fl.update()
    fo = bpy.data.objects.new('cave_floor', fl); fo.data.materials.append(rock); cine.coll('CAVE').objects.link(fo)
    return ob

def heart_object(mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=HEART_R, location=HEART_C)
    ob = bpy.context.active_object; ob.name = 'Crownheart'
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.append(mat)
    for c in ob.users_collection: c.objects.unlink(ob)
    cine.coll('HEART').objects.link(ob)
    return ob

def heart_lights(color='#ff9a40', energy=22000.0):
    """The heart lights its cave (EEVEE does not light the scene from emission alone)."""
    ls = []
    for (dx, dy, dz, e) in ((0, -17, 5, 1.0), (-13, -9, 13, 0.45), (13, -9, 13, 0.45), (0, -10, 18, 0.35)):
        ls.append(cine.point(f'heartlight{len(ls)}', (HEART_C.x + dx, HEART_C.y + dy, HEART_C.z + dz), color, energy * e, radius=6.0, shadow=True))
    return ls

def dark_world():
    cine.world_sky(top='#000000', horizon='#000000', low='#000000', sun_size=0.0, sun_glow=0.0, clouds=0.0, ambient='#040202', ambient_strength=1.0)
    cine.set_fog('#1a0a06', 0.012, start=10.0, maxf=0.85)

def founder(name, loc, height=1.8, torch=True, kneel=0.0, face=-90.0):
    """A cloaked, hooded torch-bearer (silhouette figure). kneel 0..1 lowers the body."""
    mat = bpy.data.materials.get('founder_ink') or cine.mat_ink('founder_ink', '#030202', '#0e0806', '#3a2014', rim='#ffb060', mottle=0.1)
    mb = cine.MeshBuilder()
    h = height * (1.0 - 0.35 * kneel)
    x, y, z = loc
    mb.cylinder('FOUNDERS', mat, x, y, z, z + h * 0.82, 0.42, n=12, r_top=0.16)      # cloak
    mb.cylinder('FOUNDERS', mat, x, y, z + h * 0.8, z + h, 0.17, n=10, r_top=0.08)     # hooded head
    objs = mb.build(name)
    if torch:
        a = math.radians(face)
        tx, ty = x + 0.35 * math.cos(a + 1.2), y + 0.35 * math.sin(a + 1.2)
        mb.oriented_box('FOUNDERS', mat, (tx, ty, z + h * 0.72), (0.06, 0.06, 0.9), (0.25, 0, 0))
        fl = bpy.data.materials.get('torchflame') or cine.mat_emit('torchflame', '#ffb050', 18.0, flicker=0.3, seed=3.0)
        import castle
        castle._flame(mb, 'FOUNDERS', fl, (tx, ty - 0.1, z + h * 0.72 + 0.6), 0.16, random.Random(1))
        objs += mb.build(name + '_torch')
        cine.point(name + '_light', (tx, ty - 0.4, z + h * 0.72 + 0.7), '#ff9040', 90.0, radius=0.3)
    return objs
