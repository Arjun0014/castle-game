"""Caer Veyr, exterior, for the opening film. One footprint, two memories.

Collections:
  CV_SHARED   - structure that survives in both states (lower walls, tower shafts, keep shaft, hall walls)
  CV_PAST     - roofs, turrets, spires, belfry + bell, parapets, banners, lit windows
  CV_PRESENT  - broken tops, breaches' rubble, fallen roof timbers, trees and ivy in the ward
  TERRAIN     - the rock spire (crag) and the valley
Materials are assigned per memory by role, so the same shared stone reads warm (Past) or moonlit (Present).
The summit plateau is at Z0; the gate faces -Y (toward the valley camera).
Silhouette intent (portrait): bell tower = tallest thin accent (left), the keep "the Crown" = the great mass
(right, four turrets + spire: the crest's crown in stone), chapel spire lower (far left), gatehouse centre-front.
"""
import math, random
import bpy
from cine import MeshBuilder, mat_ink, mat_emit, mat_flat, coll, fbm

Z0 = 200.0

PALETTES = {
    'PAST_DUSK': {
        'stone': dict(dark='#120c0c', body='#3c2c26', lit='#e0a060', rim='#ffd48c', mottle=0.24),
        'roof': dict(dark='#0c0809', body='#2a1c1e', lit='#9a6446', rim='#ffc27a', mottle=0.22),
        'rock': dict(dark='#0e0909', body='#33241f', lit='#c08048', rim='#f4b674', mottle=0.34),
        'veg': dict(dark='#090705', body='#1e1810', lit='#5e4424', rim=None, mottle=0.3),
        'window': ('#ffc873', 6.0), 'banner': '#6a1212', 'banner_gold': '#e0b868', 'void': '#050303',
    },
    'PAST_WAR': {
        'stone': dict(dark='#0a0506', body='#2a1614', lit='#d05a2c', rim='#ff9050', mottle=0.24),
        'roof': dict(dark='#070405', body='#1c1012', lit='#7a301e', rim='#ff7040', mottle=0.22),
        'rock': dict(dark='#080405', body='#221210', lit='#a8421e', rim='#ff6a30', mottle=0.34),
        'veg': dict(dark='#050303', body='#180c08', lit='#5a2410', rim=None, mottle=0.3),
        'window': ('#ffb45a', 8.0), 'banner': '#560a0a', 'banner_gold': '#d0a050', 'void': '#030101',
    },
    'PRESENT_NIGHT': {
        'stone': dict(dark='#06080c', body='#1a212c', lit='#93aac4', rim='#dcebff', mottle=0.26),
        'roof': dict(dark='#050609', body='#141922', lit='#5a6a80', rim='#b4c8e4', mottle=0.2),
        'rock': dict(dark='#05070a', body='#171d26', lit='#667a92', rim='#aac0dc', mottle=0.34),
        'veg': dict(dark='#030504', body='#0e160e', lit='#34503a', rim='#7e9e86', mottle=0.36),
        'window': ('#ffc873', 0.0), 'banner': '#181414', 'banner_gold': '#3a3226', 'void': '#020203',
    },
}

_mats = {}

def material(state, role):
    key = (state, role)
    if key in _mats: return _mats[key]
    p = PALETTES[state]
    if role in ('window', 'window_dim', 'gate_glow'):
        col, strength = p['window']
        k = {'window': 1.0, 'window_dim': 0.45, 'gate_glow': 0.32}[role]
        m = mat_emit(f'{state}_{role}', '#ff9a4a' if role == 'gate_glow' else col, max(strength * k, 0.0001), flicker=0.16 if strength else 0.0, seed=len(_mats))
    elif role == 'torch':
        col, strength = p['window']
        m = mat_emit(f'{state}_torch', '#ff9a3a', max(strength * 2.2, 0.0001), flicker=0.35 if strength else 0.0, seed=len(_mats) + 7)
    elif role == 'banner':
        m = mat_ink(f'{state}_banner', dark='#080303', body=p['banner'], lit=p['banner'], rim=None, mottle=0.12)
    elif role in ('banner_gold', 'void'):
        m = mat_flat(f'{state}_{role}', p[role])
    else:
        d = p[role]
        m = mat_ink(f'{state}_{role}', d['dark'], d['body'], d['lit'], rim=d['rim'], mottle=d['mottle'])
    _mats[key] = m
    return m

class RoleMat:
    """Stand-in material handle: geometry is batched by role; real materials are assigned per state."""
    def __init__(self, role): self.name = role; self.role = role

ROLE = {r: RoleMat(r) for r in ('stone', 'roof', 'rock', 'veg', 'window', 'window_dim', 'torch', 'gate_glow', 'banner', 'banner_gold', 'void')}

# ------------------------------------------------------------------------------------------------ layout
WALL = [(-70, -34), (-44, -52), (-14, -60), (14, -60), (46, -50), (72, -26), (80, 14), (62, 50), (18, 64), (-30, 60), (-66, 40), (-80, 4), (-70, -34)]
WALL_H = 15.0
# square wall towers (x, y, half-size, height)
TOWERS = [(-70, -34, 5.5, 27), (-44, -52, 5.0, 24), (46, -50, 5.0, 24), (72, -26, 5.5, 29), (80, 14, 5.0, 25),
          (62, 50, 5.5, 27), (-30, 60, 5.0, 24), (-66, 40, 5.5, 28), (-80, 4, 5.0, 25)]
TOWER_BROKEN = {0: 0.55, 3: 0.72, 5: 0.5, 7: 0.66, 8: 0.8}
ROUND_ROOF = {3, 7}                     # the only two conical roofs (on round-topped bartizans)
BREACHES = [(1, 0.35, 0.8), (7, 0.25, 0.6)]

def build(seed=7, tagged=False):
    rng = random.Random(seed)
    mb = MeshBuilder()
    T = (lambda t: setattr(mb, 'tag', t)) if tagged else (lambda t: None)
    S, PA, PR = 'CV_SHARED', 'CV_PAST', 'CV_PRESENT'
    st, rf, win = ROLE['stone'], ROLE['roof'], ROLE['window']

    # --- curtain wall
    for i, ((ax, ay), (bx, by)) in enumerate(zip(WALL[:-1], WALL[1:])):
        T(f'wall{i}')
        br = [b for b in BREACHES if b[0] == i]
        segs = [(0.0, 1.0)] if not br else [(0.0, br[0][1]), (br[0][1], br[0][2]), (br[0][2], 1.0)]
        for k, (t0, t1) in enumerate(segs):
            p0 = (ax + (bx - ax) * t0, ay + (by - ay) * t0); p1 = (ax + (bx - ax) * t1, ay + (by - ay) * t1)
            breach = bool(br) and k == 1
            _wall(mb, PA if breach else S, st, p0, p1, Z0 - 10, Z0 + WALL_H, 3.4)
            mb.crenels(PA, st, [p0, p1], Z0 + WALL_H, h=2.0, w=1.6, gap=1.3, depth=3.4)
            if breach:
                _rubble(mb, PR, ROLE['rock'], p0, p1, Z0 - 8, Z0 + 3.0, rng)
                _wall(mb, PR, st, p0, _lerp(p0, p1, 0.2), Z0 - 10, Z0 + 7.0, 3.4, jag=3.5, rng=rng)
                _wall(mb, PR, st, _lerp(p0, p1, 0.82), p1, Z0 - 10, Z0 + 9.0, 3.4, jag=4.0, rng=rng)
            else:
                mb.crenels(PR, st, [p0, p1], Z0 + WALL_H, h=1.8, w=1.6, gap=1.3, depth=3.4, rng=rng, missing=0.5)

    # --- wall towers (square; two carry round bartizan roofs)
    for i, (x, y, hs, h) in enumerate(TOWERS):
        T(f'tower{i}')
        frac = TOWER_BROKEN.get(i)
        top = Z0 + h
        if frac:
            hb = Z0 + h * frac
            mb.box(S, st, x - hs, x + hs, y - hs, y + hs, Z0 - 12, hb, top=False)
            mb.box(PA, st, x - hs, x + hs, y - hs, y + hs, hb, top)
            _broken_top(mb, PR, st, x - hs, x + hs, y - hs, y + hs, hb, rng, rise=(1.5, 6.5), t=1.6)
        else:
            mb.box(S, st, x - hs, x + hs, y - hs, y + hs, Z0 - 12, top)
            mb.crenels(PR, st, _square(x, y, hs + 0.4), top, h=1.6, w=1.5, gap=1.2, depth=1.2, rng=rng, missing=0.45)
        mb.box(PA, st, x - hs - 0.8, x + hs + 0.8, y - hs - 0.8, y + hs + 0.8, top, top + 1.2)
        if i in ROUND_ROOF:
            mb.cylinder(PA, st, x, y, top + 1.2, top + 5.0, hs * 0.9, n=18)
            mb.cone(PA, rf, x, y, top + 5.0, hs * 1.15, hs * 3.2, n=18)
        else:
            mb.crenels(PA, st, _square(x, y, hs + 0.8), top + 1.2, h=1.9, w=1.5, gap=1.2, depth=1.2)
        for k in range(2):
            mb.quad_window(PA, win, (x, y - hs, Z0 + 8 + k * 7), -math.pi / 2, 0.55, 1.7)

    # --- gatehouse: two square towers flanking a deep arch (the gate she will open, centuries later)
    gy = -60.0
    T('gatehouse')
    for sx in (-1, 1):
        x0, x1 = (sx * 7.5) - 5.5, (sx * 7.5) + 5.5
        mb.box(S, st, x0, x1, gy - 7, gy + 5, Z0 - 14, Z0 + 31)
        mb.box(PA, st, x0 - 0.8, x1 + 0.8, gy - 7.8, gy + 5.8, Z0 + 31, Z0 + 32.4)
        mb.crenels(PA, st, _rect(x0 - 0.8, x1 + 0.8, gy - 7.8, gy + 5.8), Z0 + 32.4, h=2.0, w=1.5, gap=1.2, depth=1.2)
        mb.crenels(PR, st, _rect(x0, x1, gy - 7, gy + 5), Z0 + 31, h=1.6, w=1.5, gap=1.2, depth=1.2, rng=rng, missing=0.4)
        for k in range(3):
            mb.quad_window(PA, win, ((x0 + x1) / 2, gy - 7, Z0 + 9 + k * 7), -math.pi / 2, 0.6, 1.9)
    mb.box(S, st, -2.0, 2.0, gy - 5, gy + 5, Z0 + 11, Z0 + 24)
    mb.crenels(PA, st, [(-2.0, gy - 5), (2.0, gy - 5)], Z0 + 24, h=2.0, w=1.4, gap=1.1, depth=1.2)
    mb.box(S, ROLE['void'], -2.0, 2.0, gy - 5.05, gy - 5.0, Z0 - 2, Z0 + 11)  # the dark mouth of the gate

    # --- great hall
    T('hall')
    hx0, hx1, hy0, hy1 = -34, 14, -20, 4
    mb.box(S, st, hx0, hx1, hy0, hy1, Z0 - 2, Z0 + 21, top=False)
    mb.gable(PA, rf, hx0, hx1, hy0, hy1, Z0 + 21, 17, along='x', overhang=1.2)
    mb.gable(S, st, hx0 - 0.01, hx0 + 2.0, hy0, hy1, Z0 + 21, 17, along='y', overhang=0.0)
    mb.gable(S, st, hx1 - 2.0, hx1 + 0.01, hy0, hy1, Z0 + 21, 17, along='y', overhang=0.0)
    for k in range(7):
        x = hx0 + 5 + k * 6.3
        mb.quad_window(PA, win, (x, hy0, Z0 + 12), -math.pi / 2, 1.6, 8.0)
        mb.box(S, st, x + 2.2, x + 3.6, hy0 - 2.8, hy0, Z0 - 2, Z0 + 16)  # buttresses between the windows
    for k in range(4):
        x = hx0 + 7 + k * 11 + rng.uniform(-2, 2)
        mb.oriented_box(PR, rf, (x, (hy0 + hy1) / 2 - 4, Z0 + 28), (0.9, 15, 0.9), (math.radians(rng.uniform(-40, -26)), 0, math.radians(rng.uniform(-8, 8))))

    # --- the keep, "the Crown"
    T('keep')
    kx0, kx1, ky0, ky1 = 20, 46, 2, 28
    kh = 66.0
    mb.box(S, st, kx0, kx1, ky0, ky1, Z0 - 4, Z0 + 44, top=False)
    mb.box(PA, st, kx0, kx1, ky0, ky1, Z0 + 44, Z0 + kh)
    mb.box(PA, st, kx0 - 1.4, kx1 + 1.4, ky0 - 1.4, ky1 + 1.4, Z0 + kh, Z0 + kh + 2.4)
    mb.crenels(PA, st, _rect(kx0 - 1.4, kx1 + 1.4, ky0 - 1.4, ky1 + 1.4), Z0 + kh + 2.4, h=2.2, w=1.7, gap=1.4, depth=1.3)
    for (cx, cy) in ((kx0, ky0), (kx1, ky0), (kx1, ky1), (kx0, ky1)):
        mb.box(PA, st, cx - 3.6, cx + 3.6, cy - 3.6, cy + 3.6, Z0 + kh - 8, Z0 + kh + 12)
        mb.pyramid(PA, rf, cx, cy, Z0 + kh + 12, 4.4, 13)
    mb.pyramid(PA, rf, (kx0 + kx1) / 2, (ky0 + ky1) / 2, Z0 + kh + 2.4, 10.5, 34)
    _broken_top(mb, PR, st, kx0, kx1, ky0, ky1, Z0 + 44, rng, rise=(3, 19))
    mb.box(PR, st, kx1 - 3.6, kx1 + 3.6, ky0 - 3.6, ky0 + 3.6, Z0 + 44, Z0 + 55)
    for k in range(4):
        for zz in (22, 36, 52):
            mb.quad_window(PA, win, (kx0 + 5 + k * 5.4, ky0, Z0 + zz), -math.pi / 2, 0.8, 2.4)

    # --- bell tower (the tallest thin accent)
    T('bell')
    bx, by = -46, -4
    mb.box(S, st, bx - 5, bx + 5, by - 5, by + 5, Z0 - 2, Z0 + 62)
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        mb.box(PA, st, bx + sx * 5 - (1.5 if sx > 0 else 0), bx + sx * 5 + (0 if sx > 0 else 1.5),
               by + sy * 5 - (1.5 if sy > 0 else 0), by + sy * 5 + (0 if sy > 0 else 1.5), Z0 + 62, Z0 + 74)
    mb.box(PA, st, bx - 5.6, bx + 5.6, by - 5.6, by + 5.6, Z0 + 74, Z0 + 76.5)
    mb.pyramid(PA, rf, bx, by, Z0 + 76.5, 6.2, 30)
    mb.cone(PA, ROLE['banner_gold'], bx, by, Z0 + 64.5, 2.6, 5.6, n=16)       # the bell
    for sx, sy in ((-1, -1), (1, -1)):  # Present: two broken belfry piers remain
        mb.box(PR, st, bx + sx * 5 - (1.5 if sx > 0 else 0), bx + sx * 5 + (0 if sx > 0 else 1.5),
               by + sy * 5 - (1.5 if sy > 0 else 0), by + sy * 5 + (0 if sy > 0 else 1.5), Z0 + 62, Z0 + 62 + rng.uniform(4, 9))
    for zz in (20, 34, 48):
        mb.quad_window(PA, win, (bx, by - 5, Z0 + zz), -math.pi / 2, 0.6, 2.2)

    # --- chapel with spire (far left, behind)
    T('chapel')
    cx0, cx1, cy0, cy1 = -70, -50, 14, 30
    mb.box(S, st, cx0, cx1, cy0, cy1, Z0 - 2, Z0 + 18, top=False)
    mb.gable(PA, rf, cx0, cx1, cy0, cy1, Z0 + 18, 10, along='x')
    mb.box(S, st, cx0 - 5, cx0 + 2, cy0 + 1, cy1 - 1, Z0 - 2, Z0 + 30)
    mb.pyramid(PA, rf, cx0 - 1.5, (cy0 + cy1) / 2, Z0 + 30, 4.2, 30)
    _broken_top(mb, PR, st, cx0 - 5, cx0 + 2, cy0 + 1, cy1 - 1, Z0 + 30, rng, rise=(0, 5), t=1.5)
    mb.quad_window(PA, win, ((cx0 + cx1) / 2, cy0, Z0 + 10), -math.pi / 2, 3.0, 3.0)

    # --- inner ward buildings (east)
    T('ward')
    for k in range(3):
        x0 = 52 + k * 7.0
        mb.box(S, st, x0, x0 + 6, -30 + k * 10, -20 + k * 10, Z0 - 2, Z0 + 10, top=False)
        mb.gable(PA, rf, x0, x0 + 6, -30 + k * 10, -20 + k * 10, Z0 + 10, 5, along='y')

    # --- Present: trees in the ward and ivy masses on the walls
    T('veg')
    for k in range(30):
        x, y = rng.uniform(-66, 72), rng.uniform(-48, 56)
        if hx0 - 3 < x < hx1 + 3 and hy0 - 4 < y < hy1 + 3: continue
        if kx0 - 2 < x < kx1 + 2 and ky0 - 2 < y < ky1 + 2: continue
        if abs(x - bx) < 7 and abs(y - by) < 7: continue
        _tree(mb, 'CV_PRESENT_VEG', ROLE['veg'], x, y, Z0, rng)
    for k in range(24):
        i = rng.randrange(len(WALL) - 1)
        p = _lerp(WALL[i], WALL[i + 1], rng.random())
        _blob(mb, 'CV_PRESENT_VEG', ROLE['veg'], (p[0], p[1] - 2.0, Z0 + rng.uniform(0, 10)), rng.uniform(2.2, 5), rng)
    # ivy on the keep stump and gatehouse
    for k in range(8):
        _blob(mb, 'CV_PRESENT_VEG', ROLE['veg'], (rng.uniform(kx0, kx1), ky0 - 1.5, Z0 + rng.uniform(8, 40)), rng.uniform(2, 4), rng)

    # --- Past: banners (keep, gatehouse, bell tower) — long, heraldic, readable at a distance
    T('banners')
    for (x, y, z, w, h) in ((kx0 + 6.5, ky0 - 0.35, Z0 + 62, 4.2, 30), (kx1 - 6.5, ky0 - 0.35, Z0 + 62, 4.2, 30),
                            (-7.5, gy - 7.35, Z0 + 30, 3.4, 16), (7.5, gy - 7.35, Z0 + 30, 3.4, 16),
                            (bx, by - 5.35, Z0 + 60, 3.0, 20)):
        _banner(mb, PA, x, y, z, w, h)

    # --- Past: life. Torches along the battlements, more lit windows (some dim), the gate open and warm
    T('life')
    tor = ROLE['torch']
    for i, ((ax, ay), (bx_, by_)) in enumerate(zip(WALL[:-1], WALL[1:])):
        L = math.hypot(bx_ - ax, by_ - ay); ny = -(bx_ - ax) / L  # outward normal y (the wall ring runs counter-clockwise)
        if ny > -0.2: continue                                     # only the valley-facing walls
        for k in range(int(L // 9.0)):
            t = (k + 0.5) / int(L // 9.0)
            px, py = ax + (bx_ - ax) * t, ay + (by_ - ay) * t
            _flame(mb, PA, tor, (px, py - 2.2, Z0 + WALL_H + 2.6), 0.55, rng)
    for (x, y) in ((-7.5, gy - 8.2), (7.5, gy - 8.2), (-2.6, gy - 5.6), (2.6, gy - 5.6)):
        _flame(mb, PA, tor, (x, y, Z0 + 4.5 if abs(x) < 3 else Z0 + 33.5), 0.7, rng)
    dim = ROLE['window_dim']
    for k in range(9):  # clerestory
        mb.quad_window(PA, dim if k % 3 else win, (hx0 + 3.5 + k * 5.2, hy0, Z0 + 18.5), -math.pi / 2, 0.8, 1.6)
    for zz in (10, 16, 28, 44, 58):
        for k in range(5):
            if rng.random() < 0.35: continue
            mb.quad_window(PA, win if rng.random() < 0.6 else dim, (kx0 + 3 + k * 5.0 + rng.uniform(-0.6, 0.6), ky0, Z0 + zz), -math.pi / 2, 0.7, 1.9)
    mb.quad_window(PA, ROLE['gate_glow'], (0.0, gy - 5.1, Z0 + 4.2), -math.pi / 2, 3.9, 8.6, off=0.02)

    return mb.build('CV')

def assign(state):
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or not ob.data.materials: continue
        role = ob.get('role')
        if role and role in ROLE:
            ob.data.materials[0] = material(state, role)

def set_state(state):
    """Visibility + palette for a memory: 'PAST_DUSK' | 'PAST_WAR' | 'PRESENT_NIGHT'."""
    past = state.startswith('PAST')
    for name, on in (('CV_PAST', past), ('CV_PRESENT', not past), ('CV_PRESENT_VEG', not past)):
        c = bpy.data.collections.get(name)
        if c: c.hide_render = not on; c.hide_viewport = not on
    assign(state)

# ------------------------------------------------------------------------------------------------ crag
def crag_radius(theta, z, seed=3):
    """Radius of the rock spire at angle theta and height z (plateau at Z0). Irregular: ledges follow a
    noise-warped height (never a regular grid), a few spurs and clefts, soft vertical fracturing."""
    t = max(0.0, min(1.0, z / Z0))
    base = 128.0 - 44.0 * (t ** 0.8)
    lobes = 1.0 + 0.24 * (fbm(math.cos(theta) * 1.2 + 5, math.sin(theta) * 1.2 + 5, 4, seed) - 0.5) * 2
    zw = z + 26.0 * (fbm(theta * 1.6, z * 0.01, 3, seed + 7) - 0.5)          # warp the strata
    strata = 7.0 * (fbm(theta * 0.9 + 11, zw * 0.045, 4, seed + 4) - 0.5)
    fracture = 6.0 * (fbm(theta * 7.0, z * 0.006, 3, seed + 1) - 0.5)
    spur = 22.0 * max(0.0, fbm(math.cos(theta) * 2.2 + 1, math.sin(theta) * 2.2 + 1, 3, seed + 9) - 0.58) * (1.0 - t * 0.6)
    return base * lobes + strata + fracture + spur

def terrain(seed=3):
    """Rock spire (cylindrical mesh with a flat plateau cap) + valley floor + outcrops."""
    import numpy as np
    rng = random.Random(seed)
    segs, rings = 56, 30
    verts, faces = [], []
    for j in range(rings + 1):
        z = -20 + (Z0 - 3 + 20) * j / rings
        for i in range(segs):
            th = 2 * math.pi * (i + (0.5 if j % 2 else 0.0)) / segs     # staggered rows -> triangular facets
            r = crag_radius(th, z, seed) + rng.uniform(-4.5, 4.5)
            zz = z + (rng.uniform(-3.0, 3.0) if 0 < j < rings else 0.0)
            verts.append((r * math.cos(th), r * math.sin(th) * 0.92, zz))
    for j in range(rings):
        for i in range(segs):
            a = j * segs + i; b = j * segs + (i + 1) % segs
            c, d = a + segs, b + segs
            if j % 2 == 0: faces += [(a, b, c), (b, d, c)]
            else: faces += [(a, b, d), (a, d, c)]
    ci = len(verts); verts.append((0.0, 0.0, Z0 - 3.2))
    top = rings * segs
    for i in range(segs):
        faces.append((top + i, top + (i + 1) % segs, ci))
    me = bpy.data.meshes.new('TR_crag'); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new('TR_crag', me); coll('TERRAIN').objects.link(ob)
    ob.data.materials.append(bpy.data.materials.get('role_rock') or bpy.data.materials.new('role_rock')); ob['role'] = 'rock'
    # valley floor
    fl = bpy.data.meshes.new('TR_floor')
    n = 60; S = 4000.0
    fv = [(-S / 2 + S * i / n, -S / 2 + S * j / n, 6.0 * (fbm(i * 0.3, j * 0.3, 3, seed) - 0.5) + (0.0 if math.hypot(-S/2 + S*i/n, -S/2 + S*j/n) < 1400 else 40.0)) for j in range(n + 1) for i in range(n + 1)]
    ff = [(j * (n + 1) + i, j * (n + 1) + i + 1, (j + 1) * (n + 1) + i + 1, (j + 1) * (n + 1) + i) for j in range(n) for i in range(n)]
    fl.from_pydata(fv, [], ff); fl.update()
    fo = bpy.data.objects.new('TR_floor', fl); coll('TERRAIN').objects.link(fo)
    fo.data.materials.append(bpy.data.materials.get('role_rock')); fo['role'] = 'rock'
    return ob

def backdrop(seed=5):
    """Depth layers: three distant ridges (aerial perspective does the rest), two secondary rock spires that
    frame the valley, and trees clinging to the crag's shelves (more of them in the Present)."""
    rng = random.Random(seed)
    import numpy as np
    for li, (ydist, height, rough) in enumerate(((1500.0, 240.0, 0.004), (2600.0, 420.0, 0.0025), (4200.0, 700.0, 0.0016))):
        n = 240; W = 9000.0
        top = []
        for i in range(n + 1):
            x = -W / 2 + W * i / n
            h = height * (0.35 + 0.9 * fbm(x * rough + li * 7, li * 3.3, 5, seed + li))
            top.append((x, h))
        verts, faces = [], []
        for i, (x, h) in enumerate(top):
            verts.append((x, ydist, -40.0)); verts.append((x, ydist, h))
        for i in range(n):
            a = 2 * i
            faces.append((a, a + 2, a + 3, a + 1))
        me = bpy.data.meshes.new(f'BG_ridge{li}'); me.from_pydata(verts, [], faces); me.update()
        ob = bpy.data.objects.new(f'BG_ridge{li}', me); coll('TERRAIN').objects.link(ob)
        ob.data.materials.append(bpy.data.materials.get('role_rock')); ob['role'] = 'rock'
    # secondary spires (smaller crags) to the left and right of the valley
    mb = MeshBuilder()
    for (cx, cy, r0, h) in ((-330.0, 180.0, 60.0, 150.0), (360.0, 260.0, 70.0, 175.0), (-520.0, 620.0, 90.0, 210.0)):
        segs, rings = 40, 26
        ring = []
        for j in range(rings + 1):
            z = -20 + (h + 20) * j / rings
            row = []
            for i in range(segs):
                th = 2 * math.pi * i / segs
                t = max(0.0, z / h)
                r = r0 * (1.0 - 0.72 * t ** 0.9) * (0.8 + 0.4 * fbm(math.cos(th) * 1.5 + cx, math.sin(th) * 1.5, 3, seed)) + 6 * (fbm(th * 5, z * 0.02, 2, seed) - 0.5)
                row.append((cx + r * math.cos(th), cy + r * math.sin(th), z))
            ring.append(row)
        for j in range(rings):
            for i in range(segs):
                k = (i + 1) % segs
                mb.poly('TERRAIN', ROLE['rock'], [ring[j][i], ring[j][k], ring[j + 1][k], ring[j + 1][i]])
        mb.poly('TERRAIN', ROLE['rock'], list(reversed(ring[-1])))
        for k in range(10):  # a few trees on top
            th = rng.uniform(0, math.tau); rr = rng.uniform(0, r0 * 0.25)
            _tree(mb, 'TERRAIN_VEG', ROLE['veg'], cx + rr * math.cos(th), cy + rr * math.sin(th), h - 2, rng)
    # trees clinging to the crag's shelves
    for k in range(60):
        th = rng.uniform(math.pi * 1.05, math.pi * 1.95)  # the valley-facing half
        z = rng.uniform(40, Z0 - 20)
        r = crag_radius(th, z) - 2.0
        target = 'TERRAIN_VEG' if k < 26 else 'CV_PRESENT_VEG'
        _tree(mb, target, ROLE['veg'], r * math.cos(th), r * math.sin(th) * 0.92, z, rng)
    mb.build('BG')

# ------------------------------------------------------------------------------------------------ helpers
def _lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

def _square(x, y, hs): return [(x - hs, y - hs), (x + hs, y - hs), (x + hs, y + hs), (x - hs, y + hs), (x - hs, y - hs)]

def _rect(x0, x1, y0, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]

def _wall(mb, c, m, p0, p1, z0, z1, thick, jag=0.0, rng=None):
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay) or 1e-6
    nx, ny = -(by - ay) / L * thick / 2, (bx - ax) / L * thick / 2
    if not jag:
        q = [(ax - nx, ay - ny), (bx - nx, by - ny), (bx + nx, by + ny), (ax + nx, ay + ny)]
        pts = [(x, y, z0) for x, y in q]; top = [(x, y, z1) for x, y in q]
        for i in range(4):
            j = (i + 1) % 4
            mb.poly(c, m, [pts[i], pts[j], top[j], top[i]])
        mb.poly(c, m, top)
        return
    n = max(3, int(L / 1.6))
    for s in range(n):
        a, b = _lerp(p0, p1, s / n), _lerp(p0, p1, (s + 1) / n)
        _wall(mb, c, m, a, b, z0, z1 - rng.random() * jag, thick)

def _broken_top(mb, c, m, x0, x1, y0, y1, zb, rng, rise=(0, 10), t=2.4):
    for side in range(4):
        a, b = [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))][side]
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(3, int(L / 2.0))
        base = rng.uniform(*rise)
        for s in range(n):
            p, q = _lerp(a, b, s / n), _lerp(a, b, (s + 1) / n)
            h = max(0.3, base * (0.3 + 0.7 * rng.random()) * (1 - 0.7 * abs(s / n - 0.5)))
            _wall(mb, c, m, p, q, zb - 0.1, zb + h, t)

def _rubble(mb, c, m, p0, p1, z0, z1, rng):
    (ax, ay), (bx, by) = p0, p1
    L = math.hypot(bx - ax, by - ay) or 1
    nx, ny = -(by - ay) / L, (bx - ax) / L
    for k in range(46):
        t = rng.random(); d = rng.uniform(-7, 2)
        x, y = ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d
        s = rng.uniform(0.9, 2.8)
        mb.oriented_box(c, m, (x, y, z0 + (z1 - z0) * rng.random() * (1 - abs(d) / 8)), (s, s * rng.uniform(0.6, 1.3), s * rng.uniform(0.5, 1.0)),
                        (rng.uniform(0, 1), rng.uniform(0, 1), rng.uniform(0, 6)))

def _tree(mb, c, m, x, y, z, rng):
    h = rng.uniform(7, 15)
    mb.cylinder(c, m, x, y, z - 1, z + h * 0.55, 0.5, n=6)
    for k in range(3):
        _blob(mb, c, m, (x + rng.uniform(-1.6, 1.6), y + rng.uniform(-1.6, 1.6), z + h * rng.uniform(0.55, 0.95)), rng.uniform(2.4, 4.2), rng)

def _blob(mb, c, m, center, r, rng):
    cx, cy, cz = center
    rings, segs = 5, 9
    pts = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        row = []
        for j in range(segs):
            ph = 2 * math.pi * j / segs
            rr = r * (0.72 + 0.4 * rng.random())
            row.append((cx + rr * math.sin(th) * math.cos(ph), cy + rr * math.sin(th) * math.sin(ph), cz + r * 0.8 * math.cos(th)))
        pts.append(row)
    for i in range(rings):
        for j in range(segs):
            k = (j + 1) % segs
            mb.poly(c, m, [pts[i][j], pts[i][k], pts[i + 1][k], pts[i + 1][j]])

def _flame(mb, c, m, pos, s, rng):
    """A small torch flame: two crossed teardrop quads (reads as a flame + bloom at any distance)."""
    x, y, z = pos
    for ang in (0.0, math.pi / 2):
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for i in range(10):
            t = 2 * math.pi * i / 10
            px = math.sin(t) * (math.sin(t / 2) ** 1.4) * s * 0.9
            pz = math.cos(t) * s * 1.6
            pts.append((x + px * ca, y + px * sa, z + pz))
        mb.poly(c, m, pts)

def _banner(mb, c, x, y, z, w, h):
    red = ROLE['banner']; gold = ROLE['banner_gold']
    mb.poly(c, red, [(x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y, z - h), (x, y, z - h + w * 0.5), (x - w / 2, y, z - h)])
    r = w * 0.27; cz = z - h * 0.3
    mb.poly(c, gold, [(x + r * math.cos(2 * math.pi * i / 16), y - 0.05, cz + r * math.sin(2 * math.pi * i / 16)) for i in range(16)])
