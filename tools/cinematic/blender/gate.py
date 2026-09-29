"""The outer gate of Caer Veyr, close up (S05 inside, S12-S15 outside, S16 inside). One set, two memories.

Frame of reference: the gate facade is the plane y = 0 facing -Y (outside is y < 0); the passage runs inside to
y = +18. Ground z = 0. The crest of House Vaelor is an iron roundel split across the seam of the two leaves,
centred at z = 1.95 (her raised palm reaches it).
Collections: G_SHARED, G_PAST, G_PRESENT, G_PAST_VEG / G_PRESENT_VEG (no ink), G_DOOR_L / G_DOOR_R (animated),
G_PORT (portcullis), G_CREST_GLOW.
"""
import math, random, json, os
import bpy
from mathutils import Vector, Matrix
import cine
from cine import hexc

HERE = os.path.dirname(os.path.abspath(__file__))
ARCH_W, ARCH_SPRING = 2.5, 5.0        # half width, springing height -> apex 7.5
WALL_T = 3.5
CREST_Z, CREST_R = 2.05, 0.78

PAL = {
    'PAST': dict(stone=('#090605', '#241812', '#9a6438', '#ffc080'), wood=('#070403', '#20120a', '#6a3c1c', '#ffb070'),
                 iron=('#050404', '#1a1616', '#6a5a4c', '#ffc890'), paint_gold='#e2b865', paint_red='#8a1818', veg=None),
    'PRESENT': dict(stone=('#030407', '#0c1119', '#6a809c', '#c8dcf8'), wood=('#030304', '#0e0f12', '#4a525c', '#b8c8e0'),
                    iron=('#040506', '#15171a', '#4e5a66', '#b8c8e0'), paint_gold='#4a4232', paint_red='#3a2220', veg=('#020302', '#0a140a', '#2a4428', '#6a8a6a')),
}

def _mats(state):
    p = PAL[state]
    m = {}
    m['stone'] = cine.mat_ink(f'g_{state}_stone', *p['stone'][:3], rim=p['stone'][3], mottle=0.42 if state == 'PRESENT' else 0.3, mottle_scale=0.9, masonry=(0.95, 0.46), masonry_strength=0.6, sheen=0.1)
    m['stone_plain'] = cine.mat_ink(f'g_{state}_stone_plain', p['stone'][0], p['stone'][0], p['stone'][1], rim=p['stone'][2], mottle=0.35, mottle_scale=1.4)
    m['wood'] = cine.mat_ink(f'g_{state}_wood', *p['wood'][:3], rim=p['wood'][3], mottle=0.34, mottle_scale=3.0, sheen=0.08)
    m['iron'] = cine.mat_ink(f'g_{state}_iron', *p['iron'][:3], rim=p['iron'][3], mottle=0.2, mottle_scale=4.0, sheen=0.45)
    m['gold'] = cine.mat_ink(f'g_{state}_gold', '#2a1a08', p['paint_gold'], '#fff0c0' if state == 'PAST' else p['paint_gold'], rim=p['iron'][3], mottle=0.15, mottle_scale=6.0)
    m['red'] = cine.mat_ink(f'g_{state}_red', '#120404', p['paint_red'], p['paint_red'], rim=None, mottle=0.2, mottle_scale=6.0)
    if p['veg']:
        m['veg'] = cine.mat_ink(f'g_{state}_veg', *p['veg'][:3], rim=p['veg'][3], mottle=0.4, mottle_scale=2.0)
    m['flame'] = cine.mat_emit(f'g_{state}_flame', '#ffae52', 28.0, flicker=0.3, seed=11.0)
    m['banner'] = cine.mat_ink(f'g_{state}_banner', '#100404', '#6a1414', '#b83a2a', rim='#ffb070', mottle=0.2, mottle_scale=2.0)
    m['void'] = cine.mat_flat(f'g_{state}_void', '#000000')
    return m

# ------------------------------------------------------------------------------------------------ primitives
def extrude_profile(mb, coll, mat, pts2d, y0, y1, cap=True):
    """Extrude an x/z profile along y (front face at y0, back at y1)."""
    front = [(x, y0, z) for x, z in pts2d]; back = [(x, y1, z) for x, z in pts2d]
    if cap:
        mb.poly(coll, mat, list(reversed(front))); mb.poly(coll, mat, back)
    n = len(pts2d)
    for i in range(n):
        j = (i + 1) % n
        mb.poly(coll, mat, [front[i], front[j], back[j], back[i]])

def arch_curve(w, spring, n=24, r=None):
    r = r or w
    return [(-r * math.cos(math.pi * i / n), spring + r * math.sin(math.pi * i / n)) for i in range(n + 1)]

def gate_wall(mb, coll, mat, x0, x1, top):
    """The wall block around the arch: a profile with the arched opening notched from its base."""
    arc = arch_curve(ARCH_W, ARCH_SPRING)
    prof = [(x0, 0.0), (-ARCH_W, 0.0)] + arc + [(ARCH_W, 0.0), (x1, 0.0), (x1, top), (x0, top)]
    extrude_profile(mb, coll, mat, prof, 0.0, WALL_T)

def voussoirs(mb, coll, mat, n=17, depth=0.75, proud=0.12, rng=None):
    for i in range(n):
        a0 = math.pi * i / n; a1 = math.pi * (i + 1) / n
        r0, r1 = ARCH_W, ARCH_W + depth + (0.08 * rng.random() if rng else 0)
        p = [(-r0 * math.cos(a0), ARCH_SPRING + r0 * math.sin(a0)), (-r0 * math.cos(a1), ARCH_SPRING + r0 * math.sin(a1)),
             (-r1 * math.cos(a1), ARCH_SPRING + r1 * math.sin(a1)), (-r1 * math.cos(a0), ARCH_SPRING + r1 * math.sin(a0))]
        # tiny gap between stones so the ink finds each joint
        c = (sum(q[0] for q in p) / 4, sum(q[1] for q in p) / 4)
        p = [(c[0] + (q[0] - c[0]) * 0.94, c[1] + (q[1] - c[1]) * 0.94) for q in p]
        extrude_profile(mb, coll, mat, p, -proud, 0.02)

def barrel_vault(mb, coll, mat, y0, y1, w=ARCH_W, spring=ARCH_SPRING, n=20, thick=0.6):
    arc = arch_curve(w, spring, n)
    for (xa, za), (xb, zb) in zip(arc[:-1], arc[1:]):
        mb.poly(coll, mat, [(xa, y0, za), (xa, y1, za), (xb, y1, zb), (xb, y0, zb)])
    for sx in (-1, 1):
        x = sx * w
        mb.poly(coll, mat, [(x, y0, 0.0), (x, y1, 0.0), (x, y1, spring), (x, y0, spring)] if sx < 0 else [(x, y1, 0.0), (x, y0, 0.0), (x, y0, spring), (x, y1, spring)])

def door_leaf(state, side, mats, rng, broken=0.0):
    """One leaf: hinge at x = side*ARCH_W. Built in a local frame with the hinge at the object origin so it can swing.
    Planks + three iron bands + studs; the arched top follows the arch. Returns the object."""
    mb = cine.MeshBuilder()
    col = f'G_DOOR_{"L" if side < 0 else "R"}'
    wood, iron = mats['wood'], mats['iron']
    t = 0.18
    n = 7
    arc = arch_curve(ARCH_W, ARCH_SPRING, 64)
    def top_at(x):  # arch height at |x|
        xx = min(abs(x), ARCH_W - 1e-4)
        return ARCH_SPRING + math.sqrt(ARCH_W ** 2 - xx ** 2) - 0.05
    for k in range(n):
        xa, xb = k * ARCH_W / n, (k + 1) * ARCH_W / n        # distance from the seam (x = 0) toward the hinge
        if broken and rng.random() < broken * (0.3 + 0.7 * (k % 2)):
            # a rotted plank: only a stub remains at the bottom
            zt = rng.uniform(0.6, 2.2)
        else:
            zt = min(top_at(xa), top_at(xb)) - (rng.uniform(0, 0.25) if broken else 0.0)
        g = 0.012
        x0, x1 = (-side) * 0.0 + side * (xa + g), side * (xb - g)
        lo, hi = min(x0, x1), max(x0, x1)
        mb.box(col, wood, lo, hi, -t / 2, t / 2, 0.02, zt)
    for zb in (1.0, 3.4, 5.6):
        x_in, x_out = 0.0, side * ARCH_W * 0.98
        lo, hi = min(x_in, x_out), max(x_in, x_out)
        if not (broken and zb > 5.0 and rng.random() < 0.5):
            mb.box(col, iron, lo, hi, -t / 2 - 0.05, -t / 2, zb, zb + 0.14)
            for s in range(7):
                x = side * (0.25 + s * 0.33)
                mb.box(col, iron, x - 0.03, x + 0.03, -t / 2 - 0.08, -t / 2 - 0.02, zb + 0.04, zb + 0.10)
    objs = mb.build(f'door_{state}_{side}')
    # every part of the leaf hangs on a pivot at its hinge
    hinge = Vector((side * ARCH_W, 0.55, 0.0))
    piv = bpy.data.objects.new(f'hinge_{state}_{side}', None); cine.coll(col).objects.link(piv)
    piv.location = hinge
    for o in objs:
        # vertices were built in world space around y = 0; make them local to the pivot (the hinge)
        for v in o.data.vertices: v.co -= Vector((hinge.x, 0.0, 0.0))
        o.parent = piv
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.location = (0.0, 0.0, 0.0)
    return [piv] + objs

def _clip(pts, side):
    """Sutherland-Hodgman clip of a 2D polygon to the half-plane side*x >= 0 (unit crest space)."""
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        ina, inb = side * a[0] >= 0, side * b[0] >= 0
        if ina: out.append(a)
        if ina != inb:
            t = a[0] / (a[0] - b[0])
            out.append((0.0, a[1] + (b[1] - a[1]) * t))
    return out

def crest_relief(mats, state, depth=0.045, y_face=None, glow=True, half=0):
    """The House Vaelor crest as iron relief (+ painted in the Past), split across the seam; a glowing disc sits
    behind its gaps (S13: the engraving fills with red-gold light)."""
    d = json.load(open(os.path.join(HERE, '..', 'out', 'crest.json'))) if os.path.exists(os.path.join(HERE, '..', 'out', 'crest.json')) else None
    if d is None:
        import sys; sys.path.insert(0, os.path.join(HERE, '..')); import crest as cr; d = cr.build()
    R = CREST_R
    yf = (0.55 - 0.18 / 2 - 0.02) if y_face is None else y_face
    c0 = Vector((0.0, yf, CREST_Z))
    mb = cine.MeshBuilder()
    iron = mats['iron']
    gold = mats['gold'] if state == 'PAST' else mats['iron']
    red = mats['red']
    def P(p, dy=0.0): return (c0.x + p[0] * R, c0.y + dy, c0.z + p[1] * R)
    def keep(p): return half == 0 or half * p[0] >= -1e-9
    edge = bpy.data.materials.get('crest_edge')
    if edge is None:
        edge = bpy.data.materials.new('crest_edge'); edge.use_nodes = True
        N_, L_ = edge.node_tree.nodes, edge.node_tree.links
        for x in list(N_): N_.remove(x)
        o_ = N_.new('ShaderNodeOutputMaterial'); e_ = N_.new('ShaderNodeEmission'); e_.name = 'Glow'
        e_.inputs['Color'].default_value = hexc('#ff8a30'); e_.inputs['Strength'].default_value = 0.0
        d_ = N_.new('ShaderNodeBsdfDiffuse'); d_.inputs['Color'].default_value = hexc('#141210')
        ad = N_.new('ShaderNodeAddShader'); L_.new(d_.outputs[0], ad.inputs[0]); L_.new(e_.outputs[0], ad.inputs[1]); L_.new(ad.outputs[0], o_.inputs['Surface'])
    def walls(pts, dy0, dy1):
        front = [P(p, dy0) for p in pts]; back = [P(p, dy1) for p in pts]
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            mb.poly('G_CREST', edge, [front[i], front[j], back[j], back[i]])
    def ring(outer, inner, m, dy):
        n = len(outer)
        for i in range(n):
            j = (i + 1) % n
            quad = [outer[i], outer[j], inner[j], inner[i]]
            if half: quad = _clip(quad, half)
            if len(quad) >= 3: mb.poly('G_CREST', m, [P(q, dy) for q in quad])
        # the ring's inner and outer walls are engraved channels: they carry the light
        for loop in (outer, inner):
            lp = [q for q in loop if keep(q)]
            for i in range(len(lp) - 1):
                a_, b_ = lp[i], lp[i + 1]
                mb.poly('G_CREST', edge, [P(a_, dy), P(b_, dy), P(b_, -0.012), P(a_, -0.012)])
    def slab(pts, m, dy0, dy1):
        if half: pts = _clip(pts, half)
        if len(pts) < 3: return
        front = [P(p, dy0) for p in pts]; back = [P(p, dy1) for p in pts]
        mb.poly('G_CREST', m, front)
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            mb.poly('G_CREST', edge if m is not iron or dy0 < -0.02 else m, [front[i], front[j], back[j], back[i]])
    # backing plate (the disc), set a hair behind the relief
    disc = [(math.cos(2 * math.pi * i / 64) * 1.02, math.sin(2 * math.pi * i / 64) * 1.02) for i in range(64)]
    slab(disc, iron, -0.012, 0.0)
    ring(d['rim_outer'], d['rim_inner'], gold, -depth)
    ring(d['annulet_outer'], d['annulet_inner'], gold, -depth)
    slab(d['goutte'], red, -depth * 0.6, -0.012)
    for p in d['crown']: slab(p, gold, -depth, -0.012)
    for (x, y, r) in d['beads'] + d['pearls']:
        pts = [(x + r * math.cos(2 * math.pi * k / 10), y + r * math.sin(2 * math.pi * k / 10)) for k in range(10)]
        slab(pts, gold, -depth * 0.8, -0.012)
    objs = mb.build(f'crest_{state}_{half}')
    glow_obj = None
    if glow:
        # the hairline light: a thin emissive disc just behind the relief shapes (visible only in their gaps)
        g = bpy.data.materials.new('crest_glow'); g.use_nodes = True
        N, L = g.node_tree.nodes, g.node_tree.links
        for x in list(N): N.remove(x)
        out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = hexc('#ff7a2a'); em.inputs['Strength'].default_value = 0.0; em.name = 'DiscGlow'
        L.new(em.outputs[0], out.inputs['Surface'])
        mb2 = cine.MeshBuilder()
        dd = _clip(disc, half) if half else disc
        mb2.poly('G_CREST_GLOW', g, [P(p, -0.016) for p in dd])   # in front of the backing plate, behind the relief
        glow_obj = mb2.build(f'crest_glow_{half}')[0]
    return objs, glow_obj

def portcullis(mats, name, collection):
    mb = cine.MeshBuilder()
    iron = mats['iron']
    w, h = ARCH_W * 2 + 0.3, ARCH_SPRING + ARCH_W + 0.3
    for i in range(12):
        x = -w / 2 + (i + 0.5) * w / 12
        mb.box(collection, iron, x - 0.055, x + 0.055, -0.055, 0.055, 0.35, h)
        mb.cone(collection, iron, x, 0.0, 0.0, 0.06, 0.4, n=4) if False else mb.poly(collection, iron, [(x - 0.055, 0, 0.35), (x + 0.055, 0, 0.35), (x, 0, 0.0)])
    for k in range(9):
        z = 0.7 + k * (h - 0.9) / 8
        mb.box(collection, iron, -w / 2, w / 2, -0.07, 0.07, z - 0.05, z + 0.05)
    objs = mb.build(name)
    return objs

def flame_torch(mb, coll, mats, pos, rng):
    x, y, z = pos
    mb.box(coll, mats['iron'], x - 0.05, x + 0.05, y - 0.05, y + 0.4, z - 0.6, z - 0.5)   # bracket arm
    mb.cylinder(coll, mats['iron'], x, y - 0.05, z - 0.55, z, 0.07, n=8, r_top=0.12)        # cup
    import castle
    castle._flame(mb, coll, mats['flame'], (x, y - 0.05, z + 0.35), 0.28, rng)

# ------------------------------------------------------------------------------------------------ the set
def build(state, seed=5, veg=True, doors=True):
    """Build the whole gate set for one memory ('PAST' | 'PRESENT'). Returns dict of handles."""
    rng = random.Random(seed)
    mats = _mats(state)
    mb = cine.MeshBuilder()
    S = 'G_SHARED'
    st = mats['stone']
    gate_wall(mb, S, st, -3.8, 3.8, 15.0)
    voussoirs(mb, S, st, rng=rng)
    # flanking towers, protruding forward
    for sx in (-1, 1):
        x0, x1 = (-12.0, -3.8) if sx < 0 else (3.8, 12.0)
        top = 27.0 if state == 'PAST' else 27.0 - (6.0 if sx < 0 else 2.0)
        mb.box(S, st, x0, x1, -3.2, 5.0, 0.0, top)
        for z in (6.0, 11.5, 17.0):  # arrow slits
            xc = (x0 + x1) / 2
            mb.box(S, mats['void'], xc - 0.12, xc + 0.12, -3.26, -3.2, z, z + 1.8)
        if state == 'PAST':
            mb.box(S, st, x0 - 0.4, x1 + 0.4, -3.6, 5.4, top, top + 0.9)
            mb.crenels(S, st, [(x0 - 0.4, -3.6), (x1 + 0.4, -3.6)], top + 0.9, h=1.6, w=1.2, gap=0.9, depth=0.9)
        else:
            mb.crenels(S, st, [(x0, -3.2), (x1, -3.2)], top, h=1.4, w=1.2, gap=0.9, depth=0.9, rng=rng, missing=0.55)
    # the passage behind the arch
    barrel_vault(mb, S, mats['stone_plain'], WALL_T, 18.0)
    mb.box(S, st, -ARCH_W - 1.5, ARCH_W + 1.5, 18.0, 18.6, 0.0, ARCH_SPRING + ARCH_W + 2.0) if False else None
    # ground: irregular flat flagstones (outside), grass in the joints of the Present
    mb.box(S, mats['stone_plain'], -14, 14, -16, 19, -0.6, -0.04)
    for j in range(-26, 34):
        y0 = j * 0.62
        x = -12.0 + rng.uniform(0, 0.5)
        while x < 12.0:
            w = rng.uniform(0.45, 0.95)
            if not (state == 'PRESENT' and rng.random() < 0.12):
                lift = rng.uniform(-0.015, 0.02) * (2.5 if state == 'PRESENT' else 1.0)
                tilt = (rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), rng.uniform(-0.04, 0.04)) if state == 'PRESENT' else (0, 0, 0)
                mb.oriented_box(S, mats['stone_plain'], (x + w / 2, y0 + 0.3, -0.03 + lift), (w - 0.05, 0.56, 0.06), tilt)
            x += w
    if state == 'PRESENT' and veg:
        vm = mats['veg']
        for k in range(460):
            x, y = rng.uniform(-11, 11), rng.uniform(-14, 17)
            if abs(x) < 2.3 and y > 0: 
                if rng.random() < 0.6: continue
            cine.grass_tuft(mb, 'G_PRESENT_VEG', vm, x, y, 0.0, rng, h=rng.uniform(0.2, 0.6))
    # Past: torches either side of the arch, banners above it
    if state == 'PAST':
        for sx in (-1, 1):
            flame_torch(mb, 'G_PAST', mats, (sx * 4.6, -3.45, 3.4), rng)
        for sx in (-1, 1):
            x = sx * 1.6; zt = 14.2
            mb.poly('G_PAST', mats['banner'], [(x - 0.9, -0.08, zt), (x + 0.9, -0.08, zt), (x + 0.9, -0.08, zt - 5.2), (x, -0.08, zt - 4.4), (x - 0.9, -0.08, zt - 5.2)])
    # Present: ivy spilling from the battlements and over the tower faces, rubble in the passage
    if state == 'PRESENT' and veg:
        vm = mats['veg']
        for sx in (-1, 1):
            xa = 4.2 if sx > 0 else -11.6
            cine.ivy_patch(mb, 'G_PRESENT_VEG', vm, (xa, -3.24, 7.0 + rng.uniform(0, 5)), (7.4, 0, 0), (0, 0, 14.0), 4200, 0.12, rng, droop=1.8)
        cine.ivy_patch(mb, 'G_PRESENT_VEG', vm, (-3.6, -0.02, 9.2), (7.2, 0, 0), (0, 0, 5.4), 1900, 0.11, rng, droop=1.4)
        cine.ivy_patch(mb, 'G_PRESENT_VEG', vm, (-3.7, -0.03, 7.4), (1.1, 0, 0), (0, 0, 2.2), 420, 0.1, rng)
        for k in range(30):
            x, y = rng.uniform(-2.2, 2.2), rng.uniform(1.0, 16.0)
            s_ = rng.uniform(0.2, 0.7)
            mb.oriented_box('G_PRESENT', mats['stone_plain'], (x, y, s_ * 0.3), (s_, s_ * 0.8, s_ * 0.6), (rng.random(), rng.random(), rng.random() * 6))
    objs = mb.build(f'gate_{state}')
    doors_ = {}
    if doors:
        doors_['L'] = door_leaf(state, -1, mats, rng, broken=0.22 if state == 'PRESENT' else 0.0)
        doors_['R'] = door_leaf(state, 1, mats, rng, broken=0.15 if state == 'PRESENT' else 0.0)
    crest_objs, glows = [], []
    for half, key in ((-1, 'L'), (1, 'R')):
        co, gl = crest_relief(mats, state, half=half)
        if glows: gl.data.materials[0] = glows[0].data.materials[0]
        glows.append(gl)
        crest_objs += co
        if doors_:
            piv = doors_[key][0]
            for o in co + [gl]:   # built in world space: the pivot's rest transform is a pure translation
                o.parent = piv; o.matrix_parent_inverse = Matrix.Translation(-piv.location)
    return {'mats': mats, 'objs': objs, 'doors': doors_, 'crest': crest_objs, 'crest_glow': glows[0], 'crest_glows': glows,
            'crest_edge': bpy.data.materials['crest_edge']}

def cine_blob(mb, coll, mat, center, r, rng, flat=1.0):
    cx, cy, cz = center
    rings, segs = 4, 7
    pts = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        row = []
        for j in range(segs):
            ph = 2 * math.pi * j / segs
            rr = r * (0.7 + 0.45 * rng.random())
            row.append((cx + rr * math.sin(th) * math.cos(ph), cy + rr * math.sin(th) * math.sin(ph) * 0.6, cz + r * 0.8 * flat * math.cos(th)))
        pts.append(row)
    for i in range(rings):
        for j in range(segs):
            k = (j + 1) % segs
            mb.poly(coll, mat, [pts[i][j], pts[i][k], pts[i + 1][k], pts[i + 1][j]])

def swing(door_objs, side, keys):
    """keys: [(frame, degrees open)]; leaves swing inward (toward +Y) about their hinge pivot."""
    piv = door_objs[0]
    for f, deg in keys:
        piv.rotation_euler = (0, 0, math.radians(-side * deg)); piv.keyframe_insert('rotation_euler', frame=f)
