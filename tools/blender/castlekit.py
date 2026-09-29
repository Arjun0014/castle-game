"""Caer Veyr modular castle kit — geometry builders used by every floor build script.

Design
- All architecture is generated from a small vocabulary of parametric modules (wall-with-openings,
  slab-with-holes, stair flight, ramp, column, arch spandrel, barrel vault, parapet, door leaf,
  portcullis, rubble mound/ramp/chunks, furniture and props). Dimensions follow one metric grid:
  walls 2 m, doors 2.4 x 3.2 m, stair rise 0.25 / run 0.4167, parapets 1.2 m.
- Geometry is accumulated into batches keyed by (section, group, material) where group is one of
  SHARED / PAST / PRESENT. Each batch becomes one mesh object -> one draw call at runtime.
- Collision is authored separately and simpler (boxes, wedges, coarse mounds) into batches keyed by
  (section, group). Visual detail never goes into collision.
- UVs are world-space box projections in metres / tile size, so textures tile at a consistent
  texel density across every module.
- Markers (spawns, sigils, encounters, lights, triggers, voids ...) are recorded and emitted as empties
  with custom properties (exported as glTF extras).
"""
import math
import random

GROUPS = ("SHARED", "PAST", "PRESENT")

# metres per texture repeat
TILE = {
    "stone_wall": 3.0, "stone_block": 3.0, "marble": 4.0, "rock": 3.0, "terrain": 5.0,
    "ward_ground": 4.0, "floor_flag": 4.0, "timber": 2.0, "wood_fine": 1.6, "wood_rough": 2.0,
    "wood_planks": 2.0, "wood_moss": 2.0, "wood_door": 2.4, "iron": 1.5, "rust": 1.5,
    "rust_plate": 1.5, "iron_rust": 1.5, "fabric_royal": 1.2, "fabric_gold": 1.2, "fabric_linen": 2.0,
    "fabric_banner": 1.2, "rubble": 2.0, "bone": 1.0,
}


def tile_of(mat):
    return TILE.get(mat, 2.0)


class Batch:
    __slots__ = ("verts", "faces", "uvs", "smooth")

    def __init__(self):
        self.verts = []
        self.faces = []
        self.uvs = []  # per face: list of (u, v)
        self.smooth = []

    def add_face(self, pts, uv=None, smooth=False):
        base = len(self.verts)
        self.verts.extend(pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        self.uvs.append(uv if uv is not None else [(0.0, 0.0)] * len(pts))
        self.smooth.append(smooth)

    def tri_count(self):
        return sum(len(f) - 2 for f in self.faces)


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def face_normal(pts):
    n = (0.0, 0.0, 0.0)
    for i in range(len(pts)):
        a = pts[i]
        b = pts[(i + 1) % len(pts)]
        n = (n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]),
             n[2] + (a[0] - b[0]) * (a[1] + b[1]))
    L = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
    return (n[0] / L, n[1] / L, n[2] / L)


def world_uv(pts, tile, rot90=False, offset=(0.0, 0.0)):
    n = face_normal(pts)
    ax = max(range(3), key=lambda i: abs(n[i]))
    out = []
    for p in pts:
        if ax == 0:
            u, v = (p[1] if n[0] > 0 else -p[1]), p[2]
        elif ax == 1:
            u, v = (-p[0] if n[1] > 0 else p[0]), p[2]
        else:
            u, v = p[0], (p[1] if n[2] > 0 else -p[1])
        if rot90:
            u, v = v, -u
        out.append((u / tile + offset[0], v / tile + offset[1]))
    return out


# ------------------------------------------------------------------ rotation helpers
def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    # R = Rz * Ry * Rx
    return (
        (cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx),
        (sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx),
        (-sy, cy * sx, cy * cx),
    )


def apply(R, v, t=(0, 0, 0)):
    return (R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2] + t[0],
            R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2] + t[1],
            R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2] + t[2])


BOX_FACES = {
    # corner indices into the 8 box corners (x,y,z bits), CCW seen from outside (outward normals)
    "-x": (0, 4, 6, 2), "+x": (1, 3, 7, 5),
    "-y": (0, 1, 5, 4), "+y": (2, 6, 7, 3),
    "-z": (0, 2, 3, 1), "+z": (4, 5, 7, 6),
}


def _corners(x0, x1, y0, y1, z0, z1):
    return [(x0 if i & 1 == 0 else x1, y0 if i & 2 == 0 else y1, z0 if i & 4 == 0 else z1) for i in range(8)]


class Builder:
    def __init__(self, seed=1):
        self.vis = {}
        self.col = {}
        self.markers = []
        self.section = "S0"
        self.group = "SHARED"
        self.rng = random.Random(seed)
        self.stats = {"boxes": 0}

    # ---------------------------------------------------------- context
    def at(self, section=None, group=None):
        b = self

        class _Ctx:
            def __enter__(s):
                s.prev = (b.section, b.group)
                if section:
                    b.section = section
                if group:
                    b.group = group
                return b

            def __exit__(s, *a):
                b.section, b.group = s.prev

        return _Ctx()

    def batch(self, mat, group=None):
        key = (self.section, group or self.group, mat)
        if key not in self.vis:
            self.vis[key] = Batch()
        return self.vis[key]

    def cbatch(self, group=None):
        key = (self.section, group or self.group)
        if key not in self.col:
            self.col[key] = Batch()
        return self.col[key]

    # ---------------------------------------------------------- raw primitives
    def box(self, x0, x1, y0, y1, z0, z1, mat, col=False, skip=(), tile=None, rot90=False, group=None,
            visual=True):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        if z1 < z0: z0, z1 = z1, z0
        if min(x1 - x0, y1 - y0, z1 - z0) <= 1e-5:
            return
        c = _corners(x0, x1, y0, y1, z0, z1)
        if visual:
            bt = self.batch(mat, group)
            t = tile or tile_of(mat)
            for k, idx in BOX_FACES.items():
                if k in skip:
                    continue
                pts = [c[i] for i in idx]
                bt.add_face(pts, world_uv(pts, t, rot90))
        if col:
            self.col_box(x0, x1, y0, y1, z0, z1, group=group)
        self.stats["boxes"] += 1

    def obox(self, center, size, rot, mat, col=False, tile=None, rot90=False, group=None, visual=True):
        """Oriented box. size = full extents (sx, sy, sz); rot = (rx, ry, rz) radians."""
        R = rot_matrix(*rot)
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        c = [apply(R, p, center) for p in _corners(-hx, hx, -hy, hy, -hz, hz)]
        if visual:
            bt = self.batch(mat, group)
            t = tile or tile_of(mat)
            for k, idx in BOX_FACES.items():
                pts = [c[i] for i in idx]
                bt.add_face(pts, world_uv(pts, t, rot90))
        if col:
            cb = self.cbatch(group)
            for idx in BOX_FACES.values():
                cb.add_face([c[i] for i in idx])

    def poly(self, pts, mat, col=False, tile=None, rot90=False, group=None, double=False):
        bt = self.batch(mat, group)
        t = tile or tile_of(mat)
        bt.add_face(list(pts), world_uv(pts, t, rot90))
        if double:
            rp = list(reversed(pts))
            bt.add_face(rp, world_uv(rp, t, rot90))
        if col:
            self.cbatch(group).add_face(list(pts))

    def col_box(self, x0, x1, y0, y1, z0, z1, group=None):
        c = _corners(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1))
        cb = self.cbatch(group)
        for idx in BOX_FACES.values():
            cb.add_face([c[i] for i in idx])

    def col_wedge(self, x0, x1, y0, y1, z_lo, z_hi, rise_axis, rise_dir, z_base=None, group=None):
        """Solid ramp whose top rises from z_lo to z_hi along rise_axis ('x'|'y') in rise_dir (+1/-1)."""
        zb = z_lo if z_base is None else z_base
        cb = self.cbatch(group)
        # parametrise top height by position
        def top(x, y):
            if rise_axis == "x":
                t = (x - x0) / (x1 - x0) if rise_dir > 0 else (x1 - x) / (x1 - x0)
            else:
                t = (y - y0) / (y1 - y0) if rise_dir > 0 else (y1 - y) / (y1 - y0)
            return z_lo + (z_hi - z_lo) * t
        P = {}
        for xi, x in enumerate((x0, x1)):
            for yi, y in enumerate((y0, y1)):
                P[(xi, yi, 0)] = (x, y, zb)
                P[(xi, yi, 1)] = (x, y, max(zb + 0.001, top(x, y)))
        q = lambda a, b, c, d: cb.add_face([P[a], P[b], P[c], P[d]])
        q((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))  # top
        q((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))  # bottom
        q((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))
        q((1, 1, 0), (0, 1, 0), (0, 1, 1), (1, 1, 1))
        q((0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1))
        q((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))

    def col_tris(self, tris, group=None):
        cb = self.cbatch(group)
        for t in tris:
            cb.add_face(list(t))

    # ---------------------------------------------------------- markers
    def marker(self, mtype, pos, name=None, **props):
        self.markers.append({"kind": mtype, "pos": tuple(pos), "name": name, "section": self.section,
                             "group": self.group, "props": props})

    def volume(self, mtype, x0, x1, y0, y1, z0, z1, name=None, **props):
        self.markers.append({"kind": mtype, "pos": ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                             "size": (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), "name": name,
                             "section": self.section, "group": self.group, "props": props})

    # ================================================================== ARCHITECTURE MODULES
    def wall(self, x0, x1, y0, y1, z0, z1, openings=(), mat="stone_wall", col=True, axis=None,
             arch=True, trim=True):
        """Axis-aligned wall box with rectangular openings through its thickness.
        openings: iterable of (a0, a1, oz0, oz1[, 'arch'|'flat']) along the wall's long axis."""
        if axis is None:
            axis = "x" if (x1 - x0) >= (y1 - y0) else "y"
        if axis == "x":
            A0, A1 = x0, x1
        else:
            A0, A1 = y0, y1
        ops = sorted([tuple(o) for o in openings], key=lambda o: o[0])

        def emit(a0, a1, b0, b1):
            if a1 - a0 < 1e-4 or b1 - b0 < 1e-4:
                return
            if axis == "x":
                self.box(a0, a1, y0, y1, b0, b1, mat, col=col)
            else:
                self.box(x0, x1, a0, a1, b0, b1, mat, col=col)

        cur = A0
        for o in ops:
            a0, a1, oz0, oz1 = o[0], o[1], o[2], o[3]
            emit(cur, a0, z0, z1)
            emit(a0, a1, z0, oz0)  # sill
            emit(a0, a1, oz1, z1)  # lintel
            style = o[4] if len(o) > 4 else ("arch" if arch else "flat")
            if style == "arch" and (a1 - a0) <= (oz1 - oz0) * 1.6:
                self.arch_spandrel(axis, a0, a1, oz1, (y0, y1) if axis == "x" else (x0, x1), mat)
            cur = a1
        emit(cur, A1, z0, z1)
        if trim:
            self._wall_trim(axis, x0, x1, y0, y1, z0, ops, mat)

    def _wall_trim(self, axis, x0, x1, y0, y1, z0, ops, mat):
        # plinth course 0.35 m high projecting 0.08 m on both faces, broken at openings
        h = 0.35
        zt0 = max(z0, 0.0) if z0 < 0 < z0 + 50 else z0
        zb, ztop = zt0 - 0.02, zt0 + h
        spans = []
        A0, A1 = (x0, x1) if axis == "x" else (y0, y1)
        cur = A0
        for o in ops:
            if o[2] <= zt0 + 0.05:
                spans.append((cur, o[0]))
                cur = o[1]
        spans.append((cur, A1))
        for a0, a1 in spans:
            if a1 - a0 < 0.05:
                continue
            if axis == "x":
                self.box(a0, a1, y0 - 0.08, y1 + 0.08, zb, ztop, "stone_block", skip=("-z",))
            else:
                self.box(x0 - 0.08, x1 + 0.08, a0, a1, zb, ztop, "stone_block", skip=("-z",))

    def arch_spandrel(self, axis, a0, a1, z_top, thick, mat, segs=10):
        """Fill between a semicircular arch and the rectangular opening top (visual only)."""
        r = (a1 - a0) / 2
        mid = (a0 + a1) / 2
        zs = z_top - r
        t0, t1 = thick
        bt = self.batch(mat)
        tl = tile_of(mat)

        def P(a, z, t):
            return (a, t, z) if axis == "x" else (t, a, z)

        arc = [(mid + r * math.cos(math.pi - math.pi * i / segs), zs + r * math.sin(math.pi - math.pi * i / segs))
               for i in range(segs + 1)]
        for t, flip in ((t0, False), (t1, True)):
            half = segs // 2
            for corner, rng in (((a0, z_top), range(0, half)), ((a1, z_top), range(half, segs))):
                for i in rng:
                    p = [P(corner[0], corner[1], t), P(arc[i][0], arc[i][1], t), P(arc[i + 1][0], arc[i + 1][1], t)]
                    if (axis == "x") == flip:
                        p = [p[0], p[2], p[1]]
                    bt.add_face(p, world_uv(p, tl))
        # intrados (curved soffit)
        for i in range(segs):
            p = [P(arc[i][0], arc[i][1], t0), P(arc[i + 1][0], arc[i + 1][1], t0),
                 P(arc[i + 1][0], arc[i + 1][1], t1), P(arc[i][0], arc[i][1], t1)]
            if axis == "x":
                p = [p[0], p[3], p[2], p[1]]
            bt.add_face(p, world_uv(p, tl), smooth=False)

    def slab(self, x0, x1, y0, y1, z0, z1, mat, holes=(), col=True, skip=()):
        """Rectangular slab minus rectangular holes (x0,x1,y0,y1). Decomposed into strips."""
        xs = sorted(set([x0, x1] + [h[0] for h in holes if x0 < h[0] < x1] + [h[1] for h in holes if x0 < h[1] < x1]))
        for i in range(len(xs) - 1):
            sx0, sx1 = xs[i], xs[i + 1]
            cx = (sx0 + sx1) / 2
            cuts = sorted([(max(h[2], y0), min(h[3], y1)) for h in holes if h[0] <= cx <= h[1] and h[3] > y0 and h[2] < y1])
            cur = y0
            for c0, c1 in cuts:
                if c0 > cur:
                    self.box(sx0, sx1, cur, c0, z0, z1, mat, col=col, skip=skip)
                cur = max(cur, c1)
            if cur < y1:
                self.box(sx0, sx1, cur, y1, z0, z1, mat, col=col, skip=skip)

    def stairs(self, x0, x1, y0, y1, z_bottom, z_top, direction, mat="stone_block", col=True, solid_to=None,
               n=None, nosing=True):
        """Straight flight. direction: '+y','-y','+x','-x' (the way the stair rises).
        Collision is a smooth wedge along the nosing line."""
        rise_total = z_top - z_bottom
        n = n or max(1, int(round(rise_total / 0.25)))
        rise = rise_total / n
        base = z_bottom if solid_to is None else solid_to
        along = direction[1]
        sgn = 1 if direction[0] == "+" else -1
        A0, A1 = (y0, y1) if along == "y" else (x0, x1)
        run = (A1 - A0) / n
        for k in range(n):
            if sgn > 0:
                a0, a1 = A0 + k * run, A0 + (k + 1) * run
            else:
                a0, a1 = A1 - (k + 1) * run, A1 - k * run
            zt = z_bottom + (k + 1) * rise
            if along == "y":
                self.box(x0, x1, a0, a1, base, zt, mat)
                if nosing:
                    ny = a0 - 0.03 if sgn > 0 else a1 + 0.03
                    self.box(x0, x1, min(ny, a0 if sgn > 0 else a1), max(ny, a0 if sgn > 0 else a1), zt - 0.05, zt, mat)
            else:
                self.box(a0, a1, y0, y1, base, zt, mat)
        if col:
            self.col_wedge(x0, x1, y0, y1, z_bottom, z_top, along, sgn, z_base=min(base, z_bottom))

    def parapet(self, x0, x1, y0, y1, z0, h=1.2, mat="stone_wall", col_h=1.9, cap=True):
        self.box(x0, x1, y0, y1, z0, z0 + h, mat)
        if cap:
            self.box(x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, z0 + h, z0 + h + 0.1, "stone_block")
        self.col_box(x0, x1, y0, y1, z0, z0 + col_h)

    def column(self, cx, cy, z0, z1, r=0.45, mat="stone_block", sides=8, col=True, base=True, capital=True):
        self.prism(cx, cy, z0 + (0.35 if base else 0), z1 - (0.35 if capital else 0), r, sides, mat)
        if base:
            self.box(cx - r * 1.35, cx + r * 1.35, cy - r * 1.35, cy + r * 1.35, z0, z0 + 0.35, mat)
        if capital:
            self.box(cx - r * 1.4, cx + r * 1.4, cy - r * 1.4, cy + r * 1.4, z1 - 0.35, z1, mat)
        if col:
            self.col_box(cx - r, cx + r, cy - r, cy + r, z0, z1)

    def prism(self, cx, cy, z0, z1, r, sides, mat, rot=0.0, caps=True, group=None, smooth=True, rx=None, ry=None):
        rx = rx or r
        ry = ry or r
        bt = self.batch(mat, group)
        tl = tile_of(mat)
        ring = [(cx + rx * math.cos(rot + 2 * math.pi * i / sides), cy + ry * math.sin(rot + 2 * math.pi * i / sides)) for i in range(sides)]
        circ = 2 * math.pi * r
        for i in range(sides):
            a, b = ring[i], ring[(i + 1) % sides]
            u0 = (i / sides) * circ / tl
            u1 = ((i + 1) / sides) * circ / tl
            pts = [(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)]
            bt.add_face(pts, [(u0, z0 / tl), (u1, z0 / tl), (u1, z1 / tl), (u0, z1 / tl)], smooth=smooth)
        if caps:
            top = [(p[0], p[1], z1) for p in ring]
            bot = [(p[0], p[1], z0) for p in reversed(ring)]
            bt.add_face(top, world_uv(top, tl))
            bt.add_face(bot, world_uv(bot, tl))

    def hprism(self, a0, a1, c, z, r, sides, mat, axis="x", group=None):
        """Horizontal cylinder (beams, barrels on side, wheels when short)."""
        bt = self.batch(mat, group)
        tl = tile_of(mat)
        ring = [(r * math.cos(2 * math.pi * i / sides), r * math.sin(2 * math.pi * i / sides)) for i in range(sides)]

        def P(a, dc, dz):
            return (a, c + dc, z + dz) if axis == "x" else (c + dc, a, z + dz)
        for i in range(sides):
            p, q = ring[i], ring[(i + 1) % sides]
            pts = [P(a0, p[0], p[1]), P(a0, q[0], q[1]), P(a1, q[0], q[1]), P(a1, p[0], p[1])]
            if axis != "x":
                pts = [pts[0], pts[3], pts[2], pts[1]]
            bt.add_face(pts, world_uv(pts, tl), smooth=True)
        c0 = [P(a0, p[0], p[1]) for p in reversed(ring)]
        c1 = [P(a1, p[0], p[1]) for p in ring]
        if axis != "x":
            c0, c1 = list(reversed(c0)), list(reversed(c1))
        bt.add_face(c0, world_uv(c0, tl))
        bt.add_face(c1, world_uv(c1, tl))

    def barrel_vault(self, axis, a0, a1, c0, c1, z_spring, mat="stone_block", segs=12, skip_ranges=()):
        """Inner surface of a semicircular barrel vault spanning c0..c1, running a0..a1 along axis."""
        r = (c1 - c0) / 2
        mid = (c0 + c1) / 2
        bt = self.batch(mat)
        tl = tile_of(mat)
        pieces = [(a0, a1)]
        for s0, s1 in skip_ranges:
            nxt = []
            for p0, p1 in pieces:
                if s1 <= p0 or s0 >= p1:
                    nxt.append((p0, p1))
                    continue
                if s0 > p0:
                    nxt.append((p0, s0))
                if s1 < p1:
                    nxt.append((s1, p1))
            pieces = nxt
        for p0, p1 in pieces:
            for i in range(segs):
                t0 = math.pi * i / segs
                t1 = math.pi * (i + 1) / segs
                ca, za = mid + r * math.cos(t0), z_spring + r * math.sin(t0)
                cb_, zb = mid + r * math.cos(t1), z_spring + r * math.sin(t1)
                if axis == "y":
                    pts = [(ca, p0, za), (ca, p1, za), (cb_, p1, zb), (cb_, p0, zb)]
                else:
                    pts = [(p0, ca, za), (p0, cb_, zb), (p1, cb_, zb), (p1, ca, za)]
                # arc-length u so the stone texture wraps the vault evenly
                u0 = r * t0 / tl
                u1 = r * t1 / tl
                if axis == "y":
                    uv = [(u0, p0 / tl), (u0, p1 / tl), (u1, p1 / tl), (u1, p0 / tl)]
                else:
                    uv = [(p0 / tl, u0), (p0 / tl, u1), (p1 / tl, u1), (p1 / tl, u0)]
                bt.add_face(list(reversed(pts)), list(reversed(uv)), smooth=True)

    def beams(self, x0, x1, y0, y1, z, axis, spacing=2.5, w=0.3, h=0.4, mat="timber"):
        """Ceiling beams under a slab at height z, running along axis."""
        if axis == "x":
            y = y0 + spacing / 2
            while y < y1:
                self.box(x0, x1, y - w / 2, y + w / 2, z - h, z, mat, rot90=True)
                y += spacing
        else:
            x = x0 + spacing / 2
            while x < x1:
                self.box(x - w / 2, x + w / 2, y0, y1, z - h, z, mat)
                x += spacing

    def crenellations(self, x0, x1, y0, y1, z, axis, h=1.0, merlon=1.2, gap=0.8):
        if axis == "x":
            x = x0
            while x < x1 - 0.1:
                self.box(x, min(x + merlon, x1), y0, y1, z, z + h, "stone_wall")
                x += merlon + gap
        else:
            y = y0
            while y < y1 - 0.1:
                self.box(x0, x1, y, min(y + merlon, y1), z, z + h, "stone_wall")
                y += merlon + gap

    # ================================================================== DOORS / GATES
    def door_leaf(self, hinge, width, height, axis, t=0.12, angle=0.0, mat="wood_door", col=True, bands=True, group=None):
        """Door leaf. hinge = (x, y, z) of the hinge's bottom; axis = wall axis ('x'|'y');
        angle 0 = closed in the wall plane, positive swings toward +normal."""
        hx, hy, hz = hinge
        if axis == "x":
            ang = angle
        else:
            ang = angle + math.pi / 2
        w = abs(width)
        sgn = 1 if width > 0 else -1
        cx = hx + math.cos(ang) * w / 2 * sgn
        cy = hy + math.sin(ang) * w / 2 * sgn
        self.obox((cx, cy, hz + height / 2), (w, t, height), (0, 0, ang), mat, col=col, group=group)
        if bands:
            for bz in (0.5, height - 0.6):
                self.obox((cx, cy, hz + bz), (w * 0.98, t + 0.04, 0.12), (0, 0, ang), "iron_rust", group=group)

    def portcullis(self, x0, x1, y, z0, z1, mat="iron_rust", col=True, axis="x", bar=0.09, pitch=0.32, group=None):
        n = int((x1 - x0) / pitch)
        for i in range(n + 1):
            a = x0 + i * (x1 - x0) / max(1, n)
            if axis == "x":
                self.box(a - bar / 2, a + bar / 2, y - bar / 2, y + bar / 2, z0, z1, mat, group=group)
            else:
                self.box(y - bar / 2, y + bar / 2, a - bar / 2, a + bar / 2, z0, z1, mat, group=group)
        z = z0 + 0.4
        while z < z1:
            if axis == "x":
                self.box(x0, x1, y - bar / 2, y + bar / 2, z, z + bar, mat, group=group)
            else:
                self.box(y - bar / 2, y + bar / 2, x0, x1, z, z + bar, mat, group=group)
            z += 0.55
        # spikes
        if col:
            if axis == "x":
                self.col_box(x0, x1, y - 0.12, y + 0.12, z0, z1, group=group)
            else:
                self.col_box(y - 0.12, y + 0.12, x0, x1, z0, z1, group=group)

    def fallen_grille(self, center, size, rot, mat="rust", group=None):
        """A portcullis/grille lying on the ground (rotated grid of bars)."""
        R = rot_matrix(*rot)
        sx, sy = size
        n = int(sx / 0.32)
        for i in range(n + 1):
            a = -sx / 2 + i * sx / max(1, n)
            c = apply(R, (a, 0, 0), center)
            self.obox(c, (0.09, sy, 0.09), rot, mat, group=group)
        k = -sy / 2 + 0.3
        while k < sy / 2:
            c = apply(R, (0, k, 0.02), center)
            self.obox(c, (sx, 0.09, 0.09), rot, mat, group=group)
            k += 0.55

    # ================================================================== RUBBLE
    def chunks(self, x0, x1, y0, y1, zfun, n, smin=0.2, smax=0.7, mats=("rock", "stone_block"), seed=None,
               col=False, sink=0.35):
        rng = random.Random(seed) if seed is not None else self.rng
        for _ in range(n):
            x = rng.uniform(x0, x1)
            y = rng.uniform(y0, y1)
            s = rng.uniform(smin, smax)
            size = (s * rng.uniform(0.7, 1.5), s * rng.uniform(0.7, 1.4), s * rng.uniform(0.5, 1.0))
            z = zfun(x, y) + size[2] * (0.5 - sink)
            rot = (rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(0, math.pi))
            self.obox((x, y, z), size, rot, rng.choice(mats), col=col)

    def mound(self, cx, cy, rx, ry, h, z0=0.0, mat="rock", n=10, seed=None, col=True, chunk_count=None,
              chunk_mats=("stone_block", "rock"), clip=None):
        """Rubble mound: displaced elliptical dome + scattered blocks. Collision = coarse dome.
        clip = (x0,x1,y0,y1) keeps the mound inside a room."""
        rng = random.Random(seed) if seed is not None else self.rng
        noise = {}

        def H(i, j):
            u = -1 + 2 * i / n
            v = -1 + 2 * j / n
            d = u * u + v * v
            if d >= 1:
                return 0.0
            if (i, j) not in noise:
                noise[(i, j)] = rng.uniform(-0.12, 0.12)
            return max(0.0, h * (1 - d) ** 0.75 + (noise[(i, j)] * h if d < 0.85 else 0))

        def P(i, j):
            x = cx + rx * (-1 + 2 * i / n)
            y = cy + ry * (-1 + 2 * j / n)
            if clip:
                x = min(max(x, clip[0]), clip[1])
                y = min(max(y, clip[2]), clip[3])
            return (x, y, z0 + H(i, j) - (0.05 if H(i, j) == 0 else 0))

        bt = self.batch(mat)
        tl = tile_of(mat)
        for i in range(n):
            for j in range(n):
                q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
                if all(p[2] <= z0 - 0.01 for p in q):
                    continue
                bt.add_face(q, world_uv(q, tl), smooth=True)
        if col:
            m = 5
            tris = []
            for i in range(m):
                for j in range(m):
                    ii, jj = i * n // m, j * n // m
                    ii2, jj2 = (i + 1) * n // m, (j + 1) * n // m
                    a, b, c, d = P(ii, jj), P(ii2, jj), P(ii2, jj2), P(ii, jj2)
                    if max(a[2], b[2], c[2], d[2]) <= z0 + 0.02:
                        continue
                    tris.append((a, b, c))
                    tris.append((a, c, d))
            self.col_tris(tris)
        cc = chunk_count if chunk_count is not None else int(rx * ry * 2.2)

        def zf(x, y):
            u = (x - cx) / rx
            v = (y - cy) / ry
            d = u * u + v * v
            return z0 + (h * (1 - d) ** 0.75 if d < 1 else 0)
        x0, x1, y0, y1 = cx - rx * 0.9, cx + rx * 0.9, cy - ry * 0.9, cy + ry * 0.9
        if clip:
            x0, x1, y0, y1 = max(x0, clip[0] + 0.3), min(x1, clip[1] - 0.3), max(y0, clip[2] + 0.3), min(y1, clip[3] - 0.3)
        if x1 > x0 and y1 > y0:
            self.chunks(x0, x1, y0, y1, zf, cc, mats=chunk_mats, seed=rng.randint(0, 1 << 30))

    def rubble_ramp(self, x0, x1, y0, y1, z_lo, z_hi, axis, direction, mat="rock", seed=None, col=True, n=8,
                    chunk_count=None, rough=0.12):
        """Walkable rubble slope: noisy sloped surface + blocks. Collision is a clean wedge."""
        rng = random.Random(seed) if seed is not None else self.rng
        bt = self.batch(mat)
        tl = tile_of(mat)

        def ztop(x, y):
            if axis == "y":
                t = (y - y0) / (y1 - y0) if direction > 0 else (y1 - y) / (y1 - y0)
            else:
                t = (x - x0) / (x1 - x0) if direction > 0 else (x1 - x) / (x1 - x0)
            return z_lo + (z_hi - z_lo) * t
        grid = {}
        for i in range(n + 1):
            for j in range(n + 1):
                x = x0 + (x1 - x0) * i / n
                y = y0 + (y1 - y0) * j / n
                edge = i in (0, n) or j in (0, n)
                grid[(i, j)] = (x, y, ztop(x, y) + (0 if edge else rng.uniform(-rough, rough)))
        for i in range(n):
            for j in range(n):
                q = [grid[(i, j)], grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)]]
                bt.add_face(q, world_uv(q, tl), smooth=True)
        # side skirts down to z_base so the ramp reads solid
        zb = min(z_lo, z_hi)
        for side in ("x0", "x1", "y0", "y1"):
            pts = []
            if side in ("x0", "x1"):
                i = 0 if side == "x0" else n
                for j in range(n):
                    a, b = grid[(i, j)], grid[(i, j + 1)]
                    q = [(a[0], a[1], zb), (b[0], b[1], zb), b, a]
                    if side == "x0":
                        q = list(reversed(q))
                    bt.add_face(q, world_uv(q, tl))
            else:
                j = 0 if side == "y0" else n
                for i in range(n):
                    a, b = grid[(i, j)], grid[(i + 1, j)]
                    q = [(a[0], a[1], zb), a, b, (b[0], b[1], zb)]
                    if side == "y0":
                        q = list(reversed(q))
                    bt.add_face(q, world_uv(q, tl))
        if col:
            self.col_wedge(x0, x1, y0, y1, z_lo, z_hi, axis, direction, z_base=zb)
        cc = chunk_count if chunk_count is not None else int(abs(x1 - x0) * abs(y1 - y0) * 0.9)
        self.chunks(x0 + 0.2, x1 - 0.2, y0 + 0.2, y1 - 0.2, ztop, cc, smin=0.15, smax=0.55,
                    seed=rng.randint(0, 1 << 30), sink=0.55)

    def broken_edge(self, x0, x1, y0, y1, z, n, seed=None):
        """Jagged stones along a broken floor/wall edge (visual only)."""
        self.chunks(x0, x1, y0, y1, lambda x, y: z, n, smin=0.25, smax=0.8, seed=seed, sink=0.45)

    # ================================================================== FURNITURE / PROPS
    def table(self, cx, cy, length, width=1.0, h=0.8, axis="x", mat="wood_fine", col=True, rot=0.0, broken=False):
        L, W = (length, width) if axis == "x" else (width, length)
        if broken:
            self.obox((cx, cy, 0.25), (L * 0.95, W, 0.08), (0.0, 0.25 if axis == "x" else 0, rot), mat)
            for sx, sy in ((-1, -1), (1, 1)):
                self.box(cx + sx * (L / 2 - 0.15) - 0.06, cx + sx * (L / 2 - 0.15) + 0.06,
                         cy + sy * (W / 2 - 0.12) - 0.06, cy + sy * (W / 2 - 0.12) + 0.06, 0, 0.35, mat)
            if col:
                self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 0.35)
            return
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, h - 0.08, h, mat)
        for sx in (-1, 1):
            for sy in (-1, 1):
                x = cx + sx * (L / 2 - 0.15)
                y = cy + sy * (W / 2 - 0.12)
                self.box(x - 0.06, x + 0.06, y - 0.06, y + 0.06, 0, h - 0.08, mat)
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, h)

    def bench(self, cx, cy, length, axis="x", mat="wood_fine", col=True, z=0.0):
        L, W = (length, 0.4) if axis == "x" else (0.4, length)
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, z + 0.4, z + 0.47, mat)
        for s in (-1, 1):
            if axis == "x":
                x = cx + s * (L / 2 - 0.2)
                self.box(x - 0.05, x + 0.05, cy - W / 2 + 0.05, cy + W / 2 - 0.05, z, z + 0.4, mat)
            else:
                y = cy + s * (L / 2 - 0.2)
                self.box(cx - W / 2 + 0.05, cx + W / 2 - 0.05, y - 0.05, y + 0.05, z, z + 0.4, mat)
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, z, z + 0.47)

    def bunk(self, cx, cy, axis="x", mat="timber", cloth="fabric_linen", col=True, rotten=False):
        L, W = (2.0, 0.9) if axis == "x" else (0.9, 2.0)
        top = 0.45 if not rotten else 0.25
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, top - 0.1, top, mat)
        if not rotten:
            self.box(cx - L / 2 + 0.05, cx + L / 2 - 0.05, cy - W / 2 + 0.05, cy + W / 2 - 0.05, top, top + 0.15, cloth)
        for sx in (-1, 1):
            for sy in (-1, 1):
                x = cx + sx * (L / 2 - 0.05)
                y = cy + sy * (W / 2 - 0.05)
                hh = 1.6 if not rotten else 0.6
                self.box(x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, hh, mat)
        if not rotten:
            self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 1.35, 1.45, mat)
            self.box(cx - L / 2 + 0.05, cx + L / 2 - 0.05, cy - W / 2 + 0.05, cy + W / 2 - 0.05, 1.45, 1.55, cloth)
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 1.6 if not rotten else 0.6)

    def barrel(self, cx, cy, z=0.0, r=0.38, h=0.95, mat="wood_rough", band="iron_rust", col=True, lying=False, rot=0.0):
        if lying:
            ax = "x" if abs(math.cos(rot)) > 0.7 else "y"
            if ax == "x":
                self.hprism(cx - h / 2, cx + h / 2, cy, z + r, r, 10, mat, axis="x")
            else:
                self.hprism(cy - h / 2, cy + h / 2, cx, z + r, r, 10, mat, axis="y")
            if col:
                if ax == "x":
                    self.col_box(cx - h / 2, cx + h / 2, cy - r, cy + r, z, z + 2 * r)
                else:
                    self.col_box(cx - r, cx + r, cy - h / 2, cy + h / 2, z, z + 2 * r)
            return
        self.prism(cx, cy, z, z + h, r, 10, mat)
        for bz in (0.15, h - 0.2):
            self.prism(cx, cy, z + bz, z + bz + 0.06, r + 0.015, 10, band, caps=False)
        if col:
            self.col_box(cx - r, cx + r, cy - r, cy + r, z, z + h)

    def crate(self, cx, cy, z=0.0, s=0.8, mat="wood_planks", col=True, rot=0.0):
        if abs(rot) < 1e-3:
            self.box(cx - s / 2, cx + s / 2, cy - s / 2, cy + s / 2, z, z + s, mat, col=col)
        else:
            self.obox((cx, cy, z + s / 2), (s, s, s), (0, 0, rot), mat, col=col)

    def crate_stack(self, cx, cy, n=3, seed=0, mat="wood_planks"):
        rng = random.Random(seed)
        spots = [(0, 0, 0), (0.85, 0, 0), (0, 0.85, 0), (0.4, 0.4, 0.8), (0.85, 0.85, 0)]
        for i in range(min(n, len(spots))):
            dx, dy, dz = spots[i]
            self.crate(cx + dx, cy + dy, dz, rng.uniform(0.7, 0.85), mat, rot=rng.uniform(-0.2, 0.2))

    def weapon_rack(self, cx, cy, axis="x", length=2.0, mat="timber", metal="iron", col=True, spears=True):
        L, W = (length, 0.35) if axis == "x" else (0.35, length)
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 0.12, mat)
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 1.3, 1.4, mat)
        for s in (-1, 1):
            if axis == "x":
                x = cx + s * (L / 2 - 0.05)
                self.box(x - 0.05, x + 0.05, cy - 0.05, cy + 0.05, 0, 1.5, mat)
            else:
                y = cy + s * (L / 2 - 0.05)
                self.box(cx - 0.05, cx + 0.05, y - 0.05, y + 0.05, 0, 1.5, mat)
        if spears:
            k = 0.25
            while k < length - 0.2:
                if axis == "x":
                    self.box(cx - L / 2 + k - 0.02, cx - L / 2 + k + 0.02, cy - 0.02, cy + 0.02, 0.1, 1.9, mat)
                    self.box(cx - L / 2 + k - 0.03, cx - L / 2 + k + 0.03, cy - 0.01, cy + 0.01, 1.9, 2.15, metal)
                else:
                    self.box(cx - 0.02, cx + 0.02, cy - L / 2 + k - 0.02, cy - L / 2 + k + 0.02, 0.1, 1.9, mat)
                    self.box(cx - 0.01, cx + 0.01, cy - L / 2 + k - 0.03, cy - L / 2 + k + 0.03, 1.9, 2.15, metal)
                k += 0.3
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 1.5)

    def brazier(self, cx, cy, z=0.0, lit=True, col=True, state="PAST"):
        self.prism(cx, cy, z, z + 0.7, 0.12, 6, "iron_rust")
        self.prism(cx, cy, z + 0.7, z + 1.0, 0.45, 8, "iron_rust")
        if lit:
            self.prism(cx, cy, z + 0.95, z + 1.05, 0.38, 8, "fx_ember")
            self.marker("fire", (cx, cy, z + 1.1), size=0.9, state=state)
            self.marker("light", (cx, cy, z + 1.6), kind="brazier", color="ff8a3a", intensity=18.0, range=11.0, state=state)
        if col:
            self.col_box(cx - 0.45, cx + 0.45, cy - 0.45, cy + 0.45, z, z + 1.0)

    def torch(self, x, y, z, facing, lit=True, state="PAST"):
        """Wall sconce; facing = direction the torch sticks out: '+x','-x','+y','-y'."""
        d = {"+x": (1, 0), "-x": (-1, 0), "+y": (0, 1), "-y": (0, -1)}[facing]
        bx, by = x + d[0] * 0.15, y + d[1] * 0.15
        self.box(bx - 0.06, bx + 0.06, by - 0.06, by + 0.06, z - 0.25, z + 0.05, "iron_rust")
        tx, ty = x + d[0] * 0.32, y + d[1] * 0.32
        self.obox((tx, ty, z + 0.2), (0.07, 0.07, 0.55), (-d[1] * 0.35, d[0] * 0.35, 0), "timber")
        if lit:
            self.marker("fire", (tx + d[0] * 0.08, ty + d[1] * 0.08, z + 0.55), size=0.35, state=state)
            self.marker("light", (tx + d[0] * 0.5, ty + d[1] * 0.5, z + 0.6), kind="torch", color="ffa04a", intensity=9.0, range=8.0, state=state)

    def banner(self, x0, x1, y, z_top, length, facing, mat="fabric_banner", rod=True, tattered=False):
        """Hanging banner on a wall/parapet. facing '+y'/'-y' for walls along x; '+x'/'-x' walls along y."""
        off = 0.05
        if facing in ("+y", "-y"):
            yy = y + (off if facing == "+y" else -off)
            zb = z_top - length
            if tattered:
                zb = z_top - length * 0.55
            pts = [(x0, yy, zb), (x1, yy, zb), (x1, yy, z_top), (x0, yy, z_top)]
            if facing == "-y":
                pts = [pts[1], pts[0], pts[3], pts[2]]
            self.poly(pts, mat, double=True)
            if not tattered:
                mid = (x0 + x1) / 2
                tip = [(x0, yy, zb), (mid, yy, zb - 0.45), (x1, yy, zb)]
                self.poly(tip if facing == "+y" else list(reversed(tip)), mat, double=True)
            if rod:
                self.hprism(x0 - 0.1, x1 + 0.1, yy, z_top + 0.04, 0.04, 6, "wood_fine", axis="x")
        else:
            xx = x0 + (off if facing == "+x" else -off)
            y0, y1 = y, x1  # reuse: y=start, x1=end along y
            zb = z_top - (length * (0.55 if tattered else 1))
            pts = [(xx, y0, zb), (xx, y1, zb), (xx, y1, z_top), (xx, y0, z_top)]
            if facing == "+x":
                pts = [pts[1], pts[0], pts[3], pts[2]]
            self.poly(pts, mat, double=True)
            if not tattered:
                mid = (y0 + y1) / 2
                tip = [(xx, y0, zb), (xx, mid, zb - 0.45), (xx, y1, zb)]
                self.poly(tip if facing == "-x" else list(reversed(tip)), mat, double=True)
            if rod:
                self.hprism(y0 - 0.1, y1 + 0.1, xx, z_top + 0.04, 0.04, 6, "wood_fine", axis="y")

    def tent(self, cx, cy, L, W, H, axis="y", mat="fabric_linen", col=True):
        if axis == "y":
            a = [(cx - W / 2, cy - L / 2, 0), (cx + W / 2, cy - L / 2, 0), (cx, cy - L / 2, H)]
            b = [(cx - W / 2, cy + L / 2, 0), (cx + W / 2, cy + L / 2, 0), (cx, cy + L / 2, H)]
        else:
            a = [(cx - L / 2, cy - W / 2, 0), (cx - L / 2, cy + W / 2, 0), (cx - L / 2, cy, H)]
            b = [(cx + L / 2, cy - W / 2, 0), (cx + L / 2, cy + W / 2, 0), (cx + L / 2, cy, H)]
        self.poly([a[0], a[2], b[2], b[0]], mat, double=True)
        self.poly([a[1], b[1], b[2], a[2]], mat, double=True)
        self.poly([a[0], a[1], a[2]], mat, double=True)
        self.prism(a[2][0], a[2][1], 0, H + 0.2, 0.05, 5, "timber")
        self.prism(b[2][0], b[2][1], 0, H + 0.2, 0.05, 5, "timber")
        if col:
            if axis == "y":
                self.col_box(cx - W / 2, cx + W / 2, cy - L / 2, cy + L / 2, 0, H * 0.8)
            else:
                self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, H * 0.8)

    def cart(self, cx, cy, rot=0.0, mat="wood_rough", col=True, loaded=True, wrecked=False):
        c, s = math.cos(rot), math.sin(rot)

        def T(dx, dy):
            return (cx + dx * c - dy * s, cy + dx * s + dy * c)
        if wrecked:
            p = T(0, 0)
            self.obox((p[0], p[1], 0.3), (2.6, 1.3, 0.1), (0.2, 0.1, rot), "wood_moss")
            w = T(-0.9, 0.9)
            self.obox((w[0], w[1], 0.06), (0.9, 0.9, 0.08), (0, 0, rot), "wood_moss")
            if col:
                self.obox((p[0], p[1], 0.3), (2.6, 1.3, 0.6), (0, 0, rot), mat, col=True, visual=False)
            return
        p = T(0, 0)
        self.obox((p[0], p[1], 0.75), (2.8, 1.4, 0.12), (0, 0, rot), mat)
        for sy in (-1, 1):
            q = T(0, sy * 0.66)
            self.obox((q[0], q[1], 1.0), (2.8, 0.08, 0.5), (0, 0, rot), mat)
        for sx in (-1, 1):
            q = T(sx * 1.36, 0)
            self.obox((q[0], q[1], 1.0), (0.08, 1.4, 0.5), (0, 0, rot), mat)
        for sx in (-0.8, 0.8):
            for sy in (-0.78, 0.78):
                q = T(sx, sy)
                self.obox((q[0], q[1], 0.45), (0.9, 0.08, 0.9), (0, 0, rot), "wood_rough")
        h = T(2.1, 0)
        self.obox((h[0], h[1], 0.6), (1.6, 0.1, 0.1), (0, -0.15, rot), mat)
        if loaded:
            for i, (dx, dy) in enumerate(((-0.8, -0.3), (0.2, 0.25), (0.9, -0.2))):
                q = T(dx, dy)
                self.obox((q[0], q[1], 1.1), (0.7, 0.6, 0.55), (0, 0, rot + i * 0.3), "fabric_linen")
        if col:
            self.obox((p[0], p[1], 0.65), (2.8, 1.5, 1.3), (0, 0, rot), mat, col=True, visual=False)

    def pew(self, cx, cy, length, axis="x", mat="wood_fine", rotten=False, col=True):
        L, W = (length, 0.55) if axis == "x" else (0.55, length)
        if rotten:
            self.obox((cx, cy, 0.2), (L * 0.8, W, 0.08), (0.05, 0.1, 0.1), "wood_moss")
            if col:
                self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 0.3)
            return
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0.42, 0.48, mat)
        if axis == "x":
            self.box(cx - L / 2, cx + L / 2, cy + W / 2 - 0.06, cy + W / 2, 0.42, 1.0, mat)
            for s in (-1, 1):
                x = cx + s * (L / 2 - 0.04)
                self.box(x - 0.04, x + 0.04, cy - W / 2, cy + W / 2, 0, 0.9, mat)
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 1.0)

    def sarcophagus(self, cx, cy, axis="y", mat="stone_block", lid="marble", state="closed", col=True):
        L, W = (1.1, 2.3) if axis == "y" else (2.3, 1.1)
        self.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 0.9, mat)
        if state == "closed":
            self.box(cx - L / 2 - 0.05, cx + L / 2 + 0.05, cy - W / 2 - 0.05, cy + W / 2 + 0.05, 0.9, 1.1, lid)
        elif state == "open":
            self.obox((cx + L * 0.35, cy, 1.0), (L + 0.1, W + 0.1, 0.2), (0, 0, 0.25), lid)
        elif state == "broken":
            self.obox((cx + L * 0.8, cy - W * 0.2, 0.2), (L * 0.9, W * 0.55, 0.18), (0.4, 0.1, 0.3), lid)
            self.obox((cx - L * 0.9, cy + W * 0.3, 0.15), (L * 0.8, W * 0.4, 0.18), (-0.3, 0.2, -0.2), lid)
        if col:
            self.col_box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0, 1.1)

    def bones(self, cx, cy, z=0.0, n=8, r=0.6, seed=0):
        rng = random.Random(seed)
        for _ in range(n):
            x = cx + rng.uniform(-r, r)
            y = cy + rng.uniform(-r, r)
            L = rng.uniform(0.25, 0.5)
            self.obox((x, y, z + 0.04), (L, 0.06, 0.06), (0, rng.uniform(-0.2, 0.2), rng.uniform(0, math.pi)), "bone")
        self.prism(cx + rng.uniform(-0.2, 0.2), cy + rng.uniform(-0.2, 0.2), z, z + 0.2, 0.11, 6, "bone")

    def candles(self, cx, cy, z, n=5, r=0.3, seed=0, lit=True, state="PAST"):
        rng = random.Random(seed)
        for i in range(n):
            x = cx + rng.uniform(-r, r)
            y = cy + rng.uniform(-r, r)
            h = rng.uniform(0.1, 0.3)
            self.prism(x, y, z, z + h, 0.03, 5, "candle")
            if lit:
                self.box(x - 0.012, x + 0.012, y - 0.012, y + 0.012, z + h, z + h + 0.05, "fx_flame")
        if lit:
            self.marker("light", (cx, cy, z + 0.5), kind="candle", color="ffb060", intensity=3.0, range=5.0, state=state)
