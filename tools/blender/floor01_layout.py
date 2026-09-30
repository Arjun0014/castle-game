"""Floor 1 — The Lower Keep of Caer Veyr. Geometry + markers, mirroring docs/LEVEL_01_BLUEPRINT.md §M.

Every element is placed in a section (S1..S6) and a group:
  SHARED  = stable anchors present in both memories,
  PAST    = only in the Past,
  PRESENT = only in the Present.
Coordinates: Blender X east, Y north, Z up (metres).
"""
import math
import random

WALL_TOP_WARD = 14.0

# Present sinkhole in the Ward: union of rectangles (x0, x1, y0, y1)
SINK = [(-16, -4, -24, -2), (-18, -16, -20, -6), (-4, -2, -18, -4), (-14, -6, -2, 0)]

HATCH = (14.5, 17.0, 32.6, 38.0)
HALL_PIT = (-7.0, 7.0, 27.0, 42.0)
CRYPT_HOLE = (-33.0, -25.0, 26.0, 36.0)


def enemy(B, archetype, pos, encounter, state, yaw=None, **kw):
    B.marker("enemy", pos, archetype=archetype, encounter=encounter, state=state,
             yaw=(yaw if yaw is not None else 0.0), **kw)


def encounter(B, eid, state, box, **kw):
    x0, x1, y0, y1, z0, z1 = box
    B.volume("encounter", x0, x1, y0, y1, z0, z1, name=eid, eid=eid, state=state, **kw)


def fissure(B, fid, pos):
    with B.at(group="SHARED"):
        x, y, z = pos
        B.obox((x, y, z + 0.01), (1.6, 0.35, 0.03), (0, 0, 0.6), "fx_fissure")
        B.obox((x + 0.3, y - 0.2, z + 0.012), (0.8, 0.2, 0.03), (0, 0, -0.4), "fx_fissure")
        B.marker("fissure", pos, name=fid, fid=fid)
        B.marker("light", (x, y, z + 0.6), kind="fissure", color="48d8ff", intensity=4.0, range=6.0, state="BOTH")


def sigil(B, cid, pos, yaw=0.0):
    with B.at(group="SHARED"):
        x, y, z = pos
        B.prism(x, y, z, z + 0.04, 1.05, 16, "stone_block")
        B.prism(x, y, z + 0.04, z + 0.055, 0.85, 16, "fx_sigil", smooth=False)
        B.marker("sigil", pos, name=cid, cid=cid, yaw=yaw)


def trace(B, tid, pos, text):
    B.marker("trace", pos, name=tid, tid=tid, text=text)


def prompt(B, pid, box, text, once=True, state="BOTH", requires=""):
    x0, x1, y0, y1, z0, z1 = box
    B.volume("prompt", x0, x1, y0, y1, z0, z1, name=pid, pid=pid, text=text, once=once, state=state,
             requires=requires)


def void(B, vid, box, state):
    x0, x1, y0, y1, z0, z1 = box
    B.volume("void", x0, x1, y0, y1, z0, z1, name=vid, vid=vid, state=state)


def veg_scatter(B, region, n, kinds=("grass", "grass", "grasspack"), z=0.0, seed=0, state="PRESENT"):
    rng = random.Random(seed)
    x0, x1, y0, y1 = region
    for i in range(n):
        B.marker("veg", (rng.uniform(x0, x1), rng.uniform(y0, y1), z), kind=rng.choice(kinds),
                 yaw=rng.uniform(0, 6.283), scale=rng.uniform(0.7, 1.3), state=state)


def veg_line(B, a, b, n, kinds=("grass", "grasspack"), z=0.0, jitter=0.3, seed=0, state="PRESENT"):
    rng = random.Random(seed)
    for i in range(n):
        t = (i + rng.uniform(0, 1)) / n
        x = a[0] + (b[0] - a[0]) * t + rng.uniform(-jitter, jitter)
        y = a[1] + (b[1] - a[1]) * t + rng.uniform(-jitter, jitter)
        B.marker("veg", (x, y, z), kind=rng.choice(kinds), yaw=rng.uniform(0, 6.283),
                 scale=rng.uniform(0.6, 1.2), state=state)


def timber_stair(B, x0, x1, y0, y1, z0, z1, direction, rails=("x0", "x1"), posts=True):
    """Open timber scaffold stair (treads, stringers, posts, rails). Collision = wedge + rails."""
    along = direction[1]
    sgn = 1 if direction[0] == "+" else -1
    n = int(round((z1 - z0) / 0.25))
    A0, A1 = (y0, y1) if along == "y" else (x0, x1)
    run = (A1 - A0) / n
    rise = (z1 - z0) / n
    for k in range(n):
        a0 = A0 + k * run if sgn > 0 else A1 - (k + 1) * run
        a1 = a0 + run
        zt = z0 + (k + 1) * rise
        if along == "y":
            B.box(x0 + 0.1, x1 - 0.1, a0, a1 + 0.05, zt - 0.06, zt, "wood_planks")
        else:
            B.box(a0, a1 + 0.05, y0 + 0.1, y1 - 0.1, zt - 0.06, zt, "wood_planks")
    L = math.hypot(A1 - A0, z1 - z0)
    ang = math.atan2(z1 - z0, A1 - A0) * sgn
    mid_a = (A0 + A1) / 2
    mid_z = (z0 + z1) / 2 - 0.15
    for side in (x0 + 0.08, x1 - 0.08) if along == "y" else (y0 + 0.08, y1 - 0.08):
        if along == "y":
            B.obox((side, mid_a, mid_z), (0.14, L, 0.3), (ang, 0, 0), "wood_rough")
        else:
            B.obox((mid_a, side, mid_z), (L, 0.14, 0.3), (0, -ang, 0), "wood_rough")
    if posts:
        a = A0 + 0.6
        while a < A1:
            t = (a - A0) / (A1 - A0) if sgn > 0 else (A1 - a) / (A1 - A0)
            zt = z0 + (z1 - z0) * t
            for side in (x0 + 0.08, x1 - 0.08) if along == "y" else (y0 + 0.08, y1 - 0.08):
                if along == "y":
                    B.box(side - 0.08, side + 0.08, a - 0.08, a + 0.08, z0 - 0.02, zt + 1.0, "wood_rough")
                else:
                    B.box(a - 0.08, a + 0.08, side - 0.08, side + 0.08, z0 - 0.02, zt + 1.0, "wood_rough")
            a += 2.0
    # handrails + collision
    for r in rails:
        if along == "y":
            xr = x0 + 0.02 if r == "x0" else x1 - 0.02
            B.obox((xr, mid_a, (z0 + z1) / 2 + 1.0), (0.08, L, 0.08), (ang, 0, 0), "wood_rough")
            B.col_wedge(xr - 0.06, xr + 0.06, y0, y1, z0 + 1.6, z1 + 1.6, "y", sgn, z_base=z0)
        else:
            yr = y0 + 0.02 if r == "x0" else y1 - 0.02
            B.obox((mid_a, yr, (z0 + z1) / 2 + 1.0), (L, 0.08, 0.08), (0, -ang, 0), "wood_rough")
            B.col_wedge(x0, x1, yr - 0.06, yr + 0.06, z0 + 1.6, z1 + 1.6, "x", sgn, z_base=z0)
    B.col_wedge(x0, x1, y0, y1, z0, z1, along, sgn, z_base=z0)


# =====================================================================================
def build_barbican(B):
    """Session 13 — the way she came in. Turning round at the spawn used to show a bridge end and the night sky; now
    the apron is a barbican passage walled to the sky and closed to the south by the OUTER GATE: two great oak leaves,
    iron-bound, in a round-headed arch, still barred from within as they were in the siege. The small wicket cut into
    the east leaf stands ajar in the Present, cold light through the gap — she came through here, and now she is in.
    In the Past the wicket is shut and the passage torch-lit. Collision closes the gate, the wicket and the walls; the
    spawn (0, -52), the camera behind her there (≈ y -57.7) and the route north are untouched."""
    S = "S1_GATE"
    Y_IN, Y_OUT = -62.0, -64.0          # the outer wall's inner / outer faces
    AX = 2.4                            # the arch opening: x -2.4..2.4, a semicircle springing at z 3.8 (crown 6.2)
    SPRING = 3.8
    DY0, DY1 = -62.95, -62.8            # the leaves (recessed 0.8 m into the arch)
    WX0, WX1, WZ = 0.45, 1.65, 2.15     # the wicket in the east leaf
    rng = random.Random(1307)

    def arch_top(x):
        d = min(AX, abs(x))
        return SPRING + math.sqrt(max(0.0, AX * AX - d * d))

    with B.at(S, "SHARED"):
        # floor: the apron continued to the gate; the bridge beyond it (seen through the wicket, out of reach)
        B.slab(-3.3, 3.3, -64.0, -57.5, -0.5, 0, "stone_block")
        B.slab(-3.3, 3.3, -73.0, -64.0, -0.5, 0, "stone_block", col=False)
        B.box(-3.6, -3.3, -73.0, -64.0, 0, 1.1, "stone_wall")
        B.box(3.3, 3.6, -73.0, -64.0, 0, 1.1, "stone_wall")
        # the passage walls (the old parapets raised to a wall-walk, arrow slits looking out over the ravine)
        slits = [(-59.6, -59.2, 2.2, 3.6, "flat"), (-55.2, -54.8, 2.2, 3.6, "flat"), (-51.0, -50.6, 2.2, 3.6, "flat")]
        for x0, x1 in ((-4.6, -3.3), (3.3, 4.6)):
            B.wall(x0, x1, -62.0, -48.0, -0.6, 8.0, openings=slits, axis="y")
            B.crenellations(x0, x1, -62.0, -48.0, 8.0, "y")
        # the outer gate wall and its two squat flanking towers
        B.wall(-9.0, 9.0, Y_OUT, Y_IN, -0.6, 10.5, openings=[(-AX, AX, 0, SPRING + AX)], axis="x")
        B.crenellations(-9.0, 9.0, Y_OUT, Y_OUT + 0.8, 10.5, "x")
        for x0, x1 in ((-8.8, -4.6), (4.6, 8.8)):
            B.box(x0, x1, -66.5, -60.0, -0.6, 13.0, "stone_wall", col=True)
            B.box(x0 - 0.1, x1 + 0.1, -66.6, -59.9, 8.2, 8.5, "stone_block")         # string course
            B.box(x0 - 0.12, x1 + 0.12, -66.62, -59.88, -0.02, 0.35, "stone_block")    # plinth
            B.crenellations(x0, x1, -60.6, -60.0, 13.0, "x")
            B.crenellations(x0, x1, -66.5, -65.9, 13.0, "x")
        # --- the stone surround on the inner face: jamb quoins, imposts, a ring of voussoirs, the keystone
        for side in (-1, 1):
            z = 0.35
            k = 0
            while z < SPRING - 0.2:
                w = 0.55 if k % 2 == 0 else 0.8
                a0, a1 = sorted((side * AX, side * (AX + w)))
                B.box(a0, a1, Y_IN, Y_IN + 0.12, z, min(SPRING - 0.15, z + 0.58), "stone_block")
                z += 0.62
                k += 1
            a0, a1 = sorted((side * (AX - 0.06), side * (AX + 0.75)))
            B.box(a0, a1, Y_IN - 0.02, Y_IN + 0.16, SPRING - 0.15, SPRING + 0.12, "stone_block")   # impost
        n = 13
        for i in range(n):
            th = math.pi * (i + 0.5) / n
            key = i == n // 2
            rr = AX + (0.4 if key else 0.33)
            ext = 0.8 if key else 0.66
            cx, cz = rr * math.cos(th), SPRING + rr * math.sin(th)
            B.obox((cx, Y_IN + (0.1 if key else 0.07), cz), (math.pi * (AX + 0.33) / n - 0.04, 0.2 if key else 0.14, ext),
                   (0, math.pi / 2 - th, 0), "stone_block")
        # the royal crest over the arch (House Vaelor's shield and crown, weathered to a relief)
        B.box(-0.55, 0.55, Y_IN, Y_IN + 0.14, 7.55, 8.55, "stone_block")
        B.obox((0, Y_IN + 0.07, 7.55), (0.78, 0.14, 0.78), (0, math.pi / 4, 0), "stone_block")
        B.box(-0.4, 0.4, Y_IN + 0.14, Y_IN + 0.2, 8.1, 8.3, "stone_block")
        for cx in (-0.32, 0.0, 0.32):
            B.box(cx - 0.07, cx + 0.07, Y_IN + 0.14, Y_IN + 0.2, 8.3, 8.55 if cx == 0 else 8.46, "stone_block")
        B.box(-0.75, 0.75, Y_IN - 0.02, Y_IN + 0.22, 8.62, 8.78, "stone_block")
        # --- the leaves: oak boards following the arch (their stepped tops vanish into the stone), a dark backing
        # board, the meeting stile, iron straps with strap hinges, studs and pointed tips, the drawbar in its sockets
        pw = 0.3
        boards = []                      # the lowest board ends: Past sound, Present rotted (below)
        for i in range(16):
            x0 = -AX + i * pw
            x1 = x0 + pw
            top = max(arch_top(x0), arch_top(x1)) + 0.05
            dj = rng.uniform(-0.008, 0.008)
            in_wicket = WX0 - 0.01 < (x0 + x1) / 2 < WX1 + 0.01
            zm = WZ if in_wicket else rng.uniform(0.35, 0.7)
            B.box(x0 + 0.007, x1 - 0.007, DY0 + dj, DY1 + dj, zm, top, "wood_door")
            if not in_wicket:
                boards.append((x0, x1, dj, zm))
        # backing board (hides the joints) — around the wicket's opening
        B.box(-AX, AX, DY0 - 0.04, DY0 - 0.005, WZ, SPRING + AX, "timber")
        B.box(-AX, WX0, DY0 - 0.04, DY0 - 0.005, 0, WZ, "timber")
        B.box(WX1, AX, DY0 - 0.04, DY0 - 0.005, 0, WZ, "timber")
        B.box(-0.07, 0.07, DY1, DY1 + 0.06, 0, arch_top(0.07) + 0.05, "timber")        # meeting stile
        # wicket frame (stiles + head) on the east leaf
        B.box(WX0 - 0.09, WX0, DY1, DY1 + 0.05, 0, WZ + 0.09, "timber")
        B.box(WX1, WX1 + 0.09, DY1, DY1 + 0.05, 0, WZ + 0.09, "timber")
        B.box(WX0 - 0.09, WX1 + 0.09, DY1, DY1 + 0.05, WZ, WZ + 0.09, "timber")
        for zs in (0.55, 2.6, 4.45):
            for side in (-1, 1):
                reach = AX if zs < SPRING else math.sqrt(max(0.0, AX * AX - (zs - SPRING) ** 2)) - 0.05
                segs = [(0.08, reach)]
                if side > 0 and zs < WZ:
                    segs = [(0.08, WX0 - 0.1), (WX1 + 0.1, reach)]
                for a, b in segs:
                    a0, a1 = sorted((side * a, side * b))
                    B.box(a0, a1, DY1, DY1 + 0.045, zs - 0.08, zs + 0.08, "iron_rust")
                    # studs along the strap
                    s = a + 0.12
                    while s < b - 0.08:
                        B.box(side * s - 0.032, side * s + 0.032, DY1 + 0.045, DY1 + 0.08, zs - 0.032, zs + 0.032, "iron")
                        s += 0.28
                # the strap's pointed tip toward the meeting stile, the hinge knuckle + pintle at the jamb
                B.obox((side * 0.1, DY1 + 0.022, zs), (0.17, 0.045, 0.17), (0, math.pi / 4, 0), "iron_rust")
                if reach > AX - 0.1:
                    B.prism(side * (AX - 0.05), DY1 - 0.02, zs - 0.15, zs + 0.15, 0.07, 8, "iron")
                    B.box(*sorted((side * (AX - 0.02), side * (AX + 0.22))), Y_IN - 0.9, Y_IN - 0.72, zs - 0.05, zs + 0.05, "iron")
        # the drawbar: still across the leaves, in iron-lined sockets cut into the reveals
        B.box(-2.95, 2.95, DY1 + 0.06, DY1 + 0.32, 3.0, 3.3, "timber")
        for side in (-1, 1):
            B.box(*sorted((side * 0.9, side * 1.02)), DY1 + 0.05, DY1 + 0.34, 2.96, 3.34, "iron_rust")
            B.box(*sorted((side * AX, side * (AX + 0.1))), DY1 + 0.02, DY1 + 0.36, 2.9, 3.4, "iron_rust")
        # collision: the gate, closed (the wicket gap too — the way out is not the way on)
        B.col_box(-AX, AX, -63.3, DY1 + 0.36, 0, SPRING + AX)
        # moonlight reflected off the passage walls onto the gate (the recess and the arch shadow it from the sky)
        B.marker("light", (0.0, -59.3, 3.4), kind="moon", color="a4b8dc", intensity=6.0, range=9.0, state="PRESENT")

    with B.at(S, "PAST"):
        # the gate as the siege left it: every board sound, the wicket shut, torches either side
        for x0, x1, dj, zm in boards:
            B.box(x0 + 0.007, x1 - 0.007, DY0 + dj, DY1 + dj, 0.0, zm, "wood_door")
        for i in range(4):
            x0 = WX0 + i * pw
            B.box(x0 + 0.007, min(WX1, x0 + pw) - 0.007, DY0, DY1, 0.0, WZ, "wood_door")
        B.box(WX0 + 0.05, WX1 - 0.05, DY1, DY1 + 0.03, 0.5, 0.62, "iron_rust")
        B.box(WX0 + 0.05, WX1 - 0.05, DY1, DY1 + 0.03, 1.6, 1.72, "iron_rust")
        B.prism(WX0 + 0.2, DY1 + 0.03, 1.02, 1.12, 0.06, 8, "iron")                     # ring handle
        B.box(WX0 + 0.05, WX1 - 0.05, DY0 - 0.04, DY0 - 0.005, 0, WZ, "timber")
        for side in (-1, 1):
            B.torch(side * 3.05, Y_IN, 3.0, "+y")
        B.banner(-1.4, 1.4, Y_IN + 0.05, 10.2, 1.3, "+y", mat="fabric_banner")

    with B.at(S, "PRESENT"):
        # two centuries: the lowest boards rotted green, one split away to the backing, the wicket hanging open
        for n_, (x0, x1, dj, zm) in enumerate(boards):
            broken = n_ == 3
            B.box(x0 + 0.007, x1 - 0.007, DY0 + dj, DY1 + dj, 0.34 if broken else 0.0, zm, "wood_moss")
        hinge = (WX1 + 0.02, DY1 - 0.02)
        ang = math.radians(58)            # swung in toward the passage
        for i in range(4):
            u0 = i * pw + 0.007
            u1 = min(WX1 - WX0, (i + 1) * pw) - 0.007
            um = (u0 + u1) / 2
            cx = hinge[0] - math.cos(ang) * um
            cy = hinge[1] + math.sin(ang) * um
            B.obox((cx, cy, WZ / 2 - 0.02), (u1 - u0, 0.14, WZ - 0.06), (0, 0, -ang), "wood_moss" if i == 0 else "wood_door")
        for zs in (0.56, 1.66):
            um = (WX1 - WX0) / 2
            B.obox((hinge[0] - math.cos(ang) * um, hinge[1] + math.sin(ang) * um + 0.08, zs), (WX1 - WX0 - 0.1, 0.03, 0.12), (0, 0, -ang), "iron_rust")
        # the wicket leaf's collision (it stands out of the recess into the passage)
        um = (WX1 - WX0) / 2
        B.obox((hinge[0] - math.cos(ang) * um, hinge[1] + math.sin(ang) * um, 1.1), (WX1 - WX0, 0.16, 2.2), (0, 0, -ang), "timber",
               col=True, visual=False)
        # rubble and growth along the walls, a fallen merlon by the gate
        B.chunks(-3.2, -2.2, -61.8, -58.5, lambda x, y: 0.0, 6, smin=0.15, smax=0.35, seed=1311)
        B.chunks(2.4, 3.2, -61.0, -56.0, lambda x, y: 0.0, 5, smin=0.12, smax=0.3, seed=1312)
        B.obox((-2.55, -59.9, 0.3), (1.15, 0.8, 0.6), (0.05, 0.1, 0.4), "stone_wall", col=True)
        veg_line(B, (-3.15, -61.7), (-3.15, -49.0), 9, seed=1313)
        veg_line(B, (3.15, -61.7), (3.15, -49.0), 8, seed=1314)
        veg_scatter(B, (-2.2, 2.2, -61.8, -60.8), 4, seed=1315)
        # cold light through the open wicket, onto the boards and the flags inside
        B.marker("light", (1.1, -64.6, 1.3), kind="moon", color="9fb8ff", intensity=2.2, range=7.0, state="PRESENT")


def build_gate(B):
    S = "S1_GATE"
    with B.at(S, "SHARED"):
        # floors (apron + passage + inner arch), guardrooms
        B.slab(-3.3, 3.3, -57.5, -29, -0.5, 0, "stone_block")
        B.slab(5, 15, -44, -33, -0.5, 0, "stone_block")
        B.slab(-15, -5, -44, -33, -0.5, 0, "stone_block")
        # the apron is walled in as a barbican passage and closed by the outer gate behind the spawn (session 13:
        # build_barbican); the piers under the old bridge end stay
        for yy in (-56.5, -52.5):
            B.box(-3.3, 3.3, yy - 0.4, yy + 0.4, -4.5, -0.5, "stone_block")
        # outer facade with the gate arch
        B.wall(-17, 17, -48, -46, -0.6, 12, openings=[(-3, 3, 0, 6.5)], axis="x")
        B.crenellations(-17, 17, -48, -46.6, 12, "x")
        # passage walls
        B.wall(-5, -3, -46, -31, -0.6, 9, openings=[(-40.4, -38, 0, 3.2)], axis="y")
        B.wall(3, 5, -46, -31, -0.6, 9, openings=[(-41.2, -36.8, 0, 3.6, "flat")], axis="y")
        # guardroom shells
        B.wall(5, 17, -46, -44, -0.6, 9, axis="x")
        B.wall(15, 17, -44, -31, -0.6, 9, axis="y")
        B.wall(5, 17, -33, -31, -0.6, 9, axis="x")
        B.wall(-17, -5, -46, -44, -0.6, 9, axis="x")
        B.wall(-17, -15, -44, -31, -0.6, 9, axis="y")
        B.wall(-17, -5, -33, -31, -0.6, 9, axis="x")
        # Ward south wall with the inner arch
        B.wall(-24, 24, -31, -29, -0.6, WALL_TOP_WARD, openings=[(-3, 3, 0, 6.5)], axis="x")
        B.crenellations(-24, 24, -30.2, -29, WALL_TOP_WARD, "x")
        # passage vault (Present has a hole y -38..-35.5)
        B.barrel_vault("y", -46, -31, -3, 3, 4.0, skip_ranges=[(-38, -35.5)])
        B.slab(-5, 5, -46, -31, 8.4, 9, "stone_block", holes=[(-3, 3, -38, -35.5)])
        # guardroom ceilings (GR_E Present NE collapse)
        B.slab(5, 15, -44, -33, 6, 6.4, "wood_planks", holes=[(11, 15, -37, -33)])
        B.slab(-15, -5, -44, -33, 6, 6.4, "wood_planks")
        B.beams(-15, -5, -44, -33, 6.0, "y", spacing=2.4)
        # GR_E fireplace (anchor)
        B.box(14.3, 15, -40, -37, 0, 0.3, "stone_block", col=True)
        B.box(14.2, 15, -40, -39.6, 0, 1.6, "stone_block", col=True)
        B.box(14.2, 15, -37.4, -37, 0, 1.6, "stone_block", col=True)
        B.box(13.9, 15, -40.2, -36.8, 1.6, 1.9, "stone_block", col=True)
        B.box(14.4, 15, -39.8, -37.2, 1.9, 3.6, "stone_block")
        sigil(B, "CP1", (12.5, -41.5, 0.0), yaw=math.pi)
        fissure(B, "F1", (6.8, -37.5, 0.0))
        B.marker("spawn", (0, -52.0, 0.0), name="SPAWN", yaw=0.0, state="PRESENT")
        prompt(B, "T_MOVE", (-3.3, 3.3, -57.5, -46, 0, 4), "WASD move · Mouse look · Shift sprint · Space jump")
        prompt(B, "T_BREACH", (-3, 3, -43, -39, 0, 4), "The wall to the east has broken open.", state="PRESENT")
        prompt(B, "T_GATE", (-3, 3, -34, -31, 0, 4), "The inner gate is rusted shut.", state="PRESENT")
        B.marker("light", (0, -40, 6.2), kind="moon", color="9fb8ff", intensity=2.0, range=14.0, state="PRESENT")

    with B.at(S, "PAST"):
        # GP↔GR_E: a proper door in the breach
        B.box(3, 5, -41.2, -40.4, 0, 3.6, "stone_wall", col=True)
        B.box(3, 5, -38, -36.8, 0, 3.6, "stone_wall", col=True)
        B.box(3, 5, -40.4, -38, 3.2, 3.6, "stone_wall", col=True)
        B.arch_spandrel("y", -40.4, -38, 3.2, (3, 5), "stone_wall")
        B.door_leaf((4.9, -40.3, 0), 2.1, 2.8, "y", angle=-1.2, col=True)
        B.door_leaf((-4.9, -40.3, 0), 2.1, 2.8, "y", angle=1.25, col=True)
        # vault section intact
        B.barrel_vault("y", -38, -35.5, -3, 3, 4.0)
        B.slab(-3, 3, -38, -35.5, 8.4, 9, "stone_block")
        B.slab(11, 15, -37, -33, 6, 6.4, "wood_planks")
        B.beams(5, 15, -44, -33, 6.0, "y", spacing=2.4)
        # raised portcullises (bottom edges visible in their slots)
        B.portcullis(-2.95, 2.95, -47, 5.7, 6.5, col=False, mat="iron")
        B.portcullis(-2.95, 2.95, -30, 5.7, 6.5, col=False, mat="iron")
        # passage props: crates narrowing the lane, rack, brazier, torches
        B.crate_stack(-2.6, -33.2, 4, seed=3)
        B.barrel(2.5, -33.4)
        B.barrel(2.55, -32.5)
        B.barrel(1.9, -33.0, lying=True)
        B.weapon_rack(-2.7, -35.5, axis="y", length=2.0)
        B.brazier(2.2, -43.0)
        for y in (-44, -35):
            B.torch(-3, y, 2.8, "+x")
        B.torch(3, -44, 2.8, "-x")
        B.torch(3, -34, 2.8, "-x")
        # GR_E furnishings
        B.table(9.5, -39.2, 2.6, 1.0)
        B.bench(9.5, -40.1, 2.4)
        B.bench(9.5, -38.3, 2.4)
        B.candles(9.8, -39.2, 0.8, 3, seed=2)
        for x in (7.0, 9.6, 12.2):
            B.bunk(x, -34.1, axis="x")
        B.weapon_rack(6.2, -43.5, axis="x", length=1.8)
        B.barrel(14.3, -43.3)
        B.crate(13.2, -43.4)
        B.marker("fire", (14.6, -38.5, 0.45), size=0.8, state="PAST")
        B.marker("light", (14.0, -38.5, 1.2), kind="hearth", color="ff7a30", intensity=14.0, range=10.0, state="PAST")
        B.torch(5, -36, 2.6, "+x")
        # GR_W (optional room, Past only)
        for x in (-7.5, -10.1, -12.7):
            B.bunk(x, -34.1, axis="x")
        B.table(-10, -40.5, 1.8, 0.9)
        B.crate_stack(-14, -43, 2, seed=5)
        B.torch(-15, -38, 2.6, "+x")
        trace(B, "TR_ORDERS", (-10, -40.5, 0.9), "An order under the royal seal: \"The keep is closed. None may leave.\"")
        B.banner(-2, 2, -46, 7.6, 2.4, "+y", mat="fabric_banner")
        # enemies
        encounter(B, "E2", "PAST", (-3, 3, -46, -29, 0, 6), reward_hint=120)
        enemy(B, "guard", (-1.2, -32.2, 0), "E2", "PAST", yaw=math.pi)
        enemy(B, "guard", (1.4, -33.0, 0), "E2", "PAST", yaw=math.pi)
        enemy(B, "guard", (0.2, -35.5, 0), "E2", "PAST", yaw=math.pi)
        encounter(B, "E2b", "PAST", (-15, -5, -44, -33, 0, 6), optional=True)
        enemy(B, "guard", (-10, -37.5, 0), "E2b", "PAST", yaw=0.0)
        prompt(B, "T_PAST_GATE", (-3, 3, -46, -31, 0, 4), "The Past is not safe.", state="PAST")

    with B.at(S, "PRESENT"):
        # breach edges + rubble
        B.broken_edge(3.0, 5.0, -41.4, -40.9, 0.4, 5, seed=11)
        B.broken_edge(3.0, 5.0, -37.1, -36.6, 0.4, 5, seed=12)
        B.chunks(3, 5, -41.2, -36.8, lambda x, y: 3.6, 6, smin=0.3, smax=0.6, seed=13)
        B.mound(6.2, -39, 1.1, 1.8, 0.5, seed=14, clip=(5, 15, -44, -33))
        # GR_W doorway choked + room filled (invalid to shift into)
        B.col_box(-5, -3, -40.4, -38, 0, 3.4)
        B.mound(-2.4, -39.2, 1.1, 1.8, 1.3, seed=15, clip=(-3, 3, -44, -31))
        B.chunks(-5, -3, -40.4, -38, lambda x, y: 1.4, 10, smin=0.4, smax=0.8, seed=16)
        B.col_box(-15, -5, -44, -33, 0, 6)
        # vault hole: broken ribs + debris on the west half of the lane
        B.broken_edge(-3, 3, -38.3, -37.7, 7.0, 4, seed=17)
        B.mound(-1.9, -36.8, 1.3, 1.6, 0.8, seed=18, clip=(-3, 3, -44, -31))
        # outer portcullis fallen across the passage; inner portcullis down and rusted
        B.fallen_grille((-0.4, -44.2, 0.06), (5.4, 5.6), (0, 0, 0.55), mat="rust")
        B.portcullis(-2.95, 2.95, -30, 0, 6.5, mat="rust", col=True)
        B.bones(0.6, -31.1, n=10, r=0.7, seed=19)
        B.bones(-1.5, -30.8, n=6, r=0.5, seed=20)
        # GR_E ruin
        B.mound(13.2, -35.0, 2.3, 2.3, 1.9, seed=21, clip=(5, 15, -44, -33))
        B.table(9.5, -39.2, 2.6, 1.0, mat="wood_moss", broken=True)
        for x in (7.0, 9.6):
            B.bunk(x, -34.1, axis="x", mat="wood_moss", rotten=True)
        B.bones(8.2, -42.3, n=7, seed=22)
        veg_line(B, (5.3, -43.6), (14.6, -43.6), 8, seed=23)
        veg_scatter(B, (11, 15, -37, -33), 7, seed=24)
        veg_scatter(B, (-2.8, 2.8, -38, -35.5), 5, seed=25)
        encounter(B, "E1", "PRESENT", (5, 15, -44, -33, 0, 6), tutorial=True, reward_hint=80)
        enemy(B, "hollow", (10.5, -36.2, 0), "E1", "PRESENT", yaw=math.pi, rise=True)
        enemy(B, "hollow", (12.8, -39.5, 0), "E1", "PRESENT", yaw=math.pi * 0.5, rise=True)
        prompt(B, "T_COMBAT", (5, 9, -41.5, -36, 0, 4),
               "LMB light · RMB heavy · hold Q guard (tap = parry) · Shift tap dodge · F kick", state="PRESENT")
        prompt(B, "T_SHIFT", (-3, 3, -40, -32, 0, 4),
               "The gate stands raised in the castle's memory. Hold R to shift — costs one resonance.",
               state="PRESENT", requires="sigil:CP1")


# =====================================================================================
def build_ward(B):
    S = "S2_WARD"
    with B.at(S, "SHARED"):
        B.slab(-22, 22, -29, 7, -0.5, 0, "ward_ground", holes=SINK)
        B.wall(22, 24, -29, 7, -0.6, WALL_TOP_WARD, openings=[(-14.5, -11.5, 0, 3.8)], axis="y")
        B.wall(-24, -22, -29, 7, -0.6, WALL_TOP_WARD, openings=[(-14.5, -11.5, 0, 3.8)], axis="y")
        B.crenellations(22.9, 24, -29, 7, WALL_TOP_WARD, "y")
        B.crenellations(-24, -22.9, -29, 7, WALL_TOP_WARD, "y")
        # statue plinth (anchor)
        B.box(-1.5, 1.5, -13.5, -10.5, 0, 1.2, "stone_block", col=True)
        B.box(-1.9, 1.9, -13.9, -10.1, 0, 0.3, "stone_block", col=True)
        # balcony corbels (anchor)
        for x in (-9, -6, -3, 0, 3, 6, 9):
            B.box(x - 0.3, x + 0.3, 6.2, 7, 4.6, 5.6, "stone_block")
            B.box(x - 0.25, x + 0.25, 6.6, 7, 4.0, 4.6, "stone_block")
        sigil(B, "CP2", (18.0, -18.0, 0.0), yaw=-math.pi / 2)
        fissure(B, "F2", (16.0, -6.0, 0.0))

    with B.at(S, "PAST"):
        for r in SINK:
            B.slab(r[0], r[1], r[2], r[3], -0.5, 0, "ward_ground")
        # barricaded doors (full collision) — kitchen (west) and barracks (east, from inside)
        B.col_box(-24, -22, -14.5, -11.5, 0, 3.8)
        B.crate_stack(-21.4, -14.2, 3, seed=31)
        B.box(-23.9, -22.1, -14.4, -11.6, 0, 3.4, "wood_door")
        B.col_box(22, 26.5, -15, -11, 0, 3.8)
        # balcony + scaffold stair to it
        B.slab(-10, 10, 5, 7, 5.6, 6, "stone_block")
        B.parapet(-8.5, 10, 5, 5.3, 6, h=1.2)
        B.parapet(9.7, 10, 5.3, 7, 6, h=1.2)
        B.box(-10.5, -8.5, 2, 5.2, 5.9, 6.0, "wood_planks", col=True)
        B.col_box(-10.5, -8.5, 2, 5.2, 5.4, 6.0)
        for (x, y) in ((-10.4, 2.1), (-8.6, 2.1), (-10.4, 5.1), (-8.6, 5.1)):
            B.box(x - 0.08, x + 0.08, y - 0.08, y + 0.08, 0, 5.9, "wood_rough")
        B.box(-8.6, -8.5, 2, 5, 6, 7.1, "wood_rough", col=True)
        B.box(-10.5, -8.5, 2.0, 2.1, 6, 7.1, "wood_rough", col=True)
        timber_stair(B, -20, -10.5, 2, 4, 0, 6, "+x", rails=("x0",))
        B.banner(-12.5, -10.5, 7, 13, 5, "-y")
        B.banner(10.5, 12.5, 7, 13, 5, "-y")
        B.banner(-17, -15, 7, 13, 5, "-y")
        B.banner(15, 17, 7, 13, 5, "-y")
        # yard: carts (refugees stopped at the gate), tents, cover clusters, braziers
        B.cart(-8, -18, rot=0.35)
        B.cart(-12, -6, rot=-0.2)
        B.cart(6.5, -21.5, rot=1.45)
        B.cart(10.5, -3.5, rot=0.1, loaded=False)
        trace(B, "TR_CARTS", (-8, -18, 1.2), "A family's belongings, turned back at the gate.")
        for y in (-22, -16, -10):
            B.tent(-19.8, y, 4.2, 3.2, 2.6, axis="y")
        B.crate_stack(-4.8, -25.2, 4, seed=32)
        B.crate_stack(3.8, -8.8, 3, seed=33)
        B.crate_stack(12.3, -16.4, 4, seed=34)
        B.crate_stack(15.5, -25, 3, seed=35)
        for p in ((13, -10.2), (13.7, -9.6), (-6.5, -2.2)):
            B.barrel(*p)
        B.weapon_rack(21.3, -20, axis="y", length=2.2)
        B.weapon_rack(21.3, -6.5, axis="y", length=2.2)
        for p in ((-14, -27), (14, -27), (-14, 3.4), (14, 3.4)):
            B.brazier(*p)
        for y in (-22, -6):
            B.torch(22, y, 3.0, "-x")
            B.torch(-22, y, 3.0, "+x")
        for x in (-9, 9):
            B.torch(x, -29, 3.0, "+y")
        B.marker("statue", (0, -12, 1.2), name="STATUE_FIRST_CROWN", yaw=math.pi, state="PAST")
        encounter(B, "E3", "PAST", (-22, 22, -29, 7, 0, 10), reward_hint=300)
        for i, p in enumerate(((-3, -22), (4, -18), (-6, -12), (8, -12))):
            enemy(B, "guard", (p[0], p[1], 0), "E3", "PAST", yaw=math.pi)
        enemy(B, "archer", (-5, 6, 6), "E3", "PAST", yaw=math.pi, perch=True)
        enemy(B, "archer", (5, 6, 6), "E3", "PAST", yaw=math.pi, perch=True)
        enemy(B, "guard", (-19.8, -16, 0), "E3", "PAST", yaw=0.0, wave=2)
        enemy(B, "guard", (-19.8, -10, 0), "E3", "PAST", yaw=0.0, wave=2)
        prompt(B, "T_BARRICADE", (17, 22, -16, -10, 0, 4), "Barricaded from the inside.", state="PAST")

    with B.at(S, "PRESENT"):
        # sinkhole: rock walls around the union boundary, void floor, rim debris, kill volumes
        cells = set()
        for r in SINK:
            for x in range(int(r[0]), int(r[1])):
                for y in range(int(r[2]), int(r[3])):
                    cells.add((x, y))
        for (x, y) in cells:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in cells:
                    if dx == 1:
                        B.box(x + 1, x + 1.3, y, y + 1, -9, -0.5, "rock")
                    elif dx == -1:
                        B.box(x - 0.3, x, y, y + 1, -9, -0.5, "rock")
                    elif dy == 1:
                        B.box(x, x + 1, y + 1, y + 1.3, -9, -0.5, "rock")
                    else:
                        B.box(x, x + 1, y - 0.3, y, -9, -0.5, "rock")
        for r in SINK:
            B.box(r[0], r[1], r[2], r[3], -9.2, -9.0, "fx_void")
            void(B, "V_SINK", (r[0], r[1], r[2], r[3], -30, -3.5), "PRESENT")
        rng = random.Random(41)
        for (x, y) in cells:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in cells and rng.random() < 0.5:
                    cx = x + 0.5 + dx * 0.7
                    cy = y + 0.5 + dy * 0.7
                    B.obox((cx, cy, 0.05), (rng.uniform(0.3, 0.7), rng.uniform(0.3, 0.7), 0.25),
                           (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 3)), "stone_block")
        B.chunks(-1.4, 1.4, -13.4, -10.6, lambda x, y: 1.2, 6, smin=0.2, smax=0.5, seed=42)
        # doors: kitchen choked; barracks door broken inward (leaf lies inside, see S3)
        B.col_box(-24, -22, -14.5, -11.5, 0, 3.8)
        B.mound(-21.2, -13, 1.2, 2.0, 1.6, seed=43, clip=(-22, 22, -29, 7))
        # hall doors burst outward — leaves lie in the yard; balcony collapsed
        B.obox((-1.6, 4.2, 0.1), (2.4, 5.6, 0.16), (0.05, 0, 0.18), "wood_moss")
        B.obox((1.9, 3.6, 0.1), (2.4, 5.6, 0.16), (-0.04, 0, -0.35), "wood_moss")
        B.mound(-5.5, 5.4, 3.0, 1.4, 0.9, seed=44, clip=(-22, 22, -29, 7))
        B.mound(6.0, 5.6, 2.6, 1.3, 0.7, seed=45, clip=(-22, 22, -29, 7))
        for x in (-6, 3):
            B.obox((x + 0.6, 6.5, 5.3), (1.4, 1.0, 0.35), (0.2, 0.1, 0.2), "stone_block")
        # yard ruin
        B.cart(6.5, -21.5, rot=1.45, wrecked=True)
        B.cart(10.5, -3.5, rot=0.1, wrecked=True)
        B.mound(16.5, -26.4, 2.2, 1.6, 1.1, seed=46, clip=(-22, 22, -29, 7))
        B.mound(19.0, 3.8, 2.0, 2.2, 1.3, seed=47, clip=(-22, 22, -29, 7))
        B.bones(12, -12, n=8, seed=48)
        B.bones(-0.5, -20, n=6, seed=49)
        veg_scatter(B, (-2, 21, -28.5, 6.5), 60, seed=50)
        veg_line(B, (-21.6, -28.6), (-21.6, 6.6), 18, seed=51)
        veg_line(B, (21.6, -28.6), (21.6, 6.6), 18, seed=52)
        encounter(B, "E4", "PRESENT", (-22, 22, -29, 7, -8, 12), reward_hint=75)
        enemy(B, "wraith", (-10, -12, 3.0), "E4", "PRESENT")
        enemy(B, "wraith", (-7, -18, 2.5), "E4", "PRESENT")
        enemy(B, "wraith", (-12, -4, 3.5), "E4", "PRESENT")
        prompt(B, "T_SINK", (-2, 4, -28, -22, 0, 4), "No footing there in the other memory — mind the pit.", state="PRESENT")


# =====================================================================================
def build_east(B):
    S = "S3_EAST"
    BAR_HOLE = (27, 35, -18, -10)
    ARM_HOLE = (26, 32, 14, 22)
    with B.at(S, "SHARED"):
        # ---- barracks
        B.slab(24, 38, -27, -1, -0.5, 0, "stone_block")
        B.slab(29, 32, -1, 10.5, -0.5, 0, "stone_block")
        B.wall(38, 40, -29, 1, -0.6, 9.2, axis="y")
        B.wall(24, 40, -29, -27, -0.6, 9.2, axis="x")
        B.wall(24, 40, -1, 1, -0.6, 9.2, openings=[(29, 32, 0, 3.4)], axis="x")
        B.slab(24, 38, -27, -1, 8, 8.5, "wood_planks", holes=[BAR_HOLE])
        for y in (-25.75, -23.25, -20.75, -8.75, -6.25, -3.75):
            B.box(24, 38, y - 0.15, y + 0.15, 7.6, 8.0, "timber", rot90=True)
        for y in (-18.25, -15.75, -13.25, -10.75):
            B.box(24, 27, y - 0.15, y + 0.15, 7.6, 8.0, "timber", rot90=True)
            B.box(35, 38, y - 0.15, y + 0.15, 7.6, 8.0, "timber", rot90=True)
        B.box(37.2, 38, -15, -12, 0, 0.3, "stone_block", col=True)
        B.box(37.1, 38, -15.2, -14.8, 0, 1.6, "stone_block", col=True)
        B.box(37.1, 38, -12.2, -11.8, 0, 1.6, "stone_block", col=True)
        B.box(36.8, 38, -15.4, -11.6, 1.6, 1.9, "stone_block", col=True)
        B.box(37.3, 38, -15, -12, 1.9, 3.5, "stone_block")
        fissure(B, "F3", (31.0, -20.0, 0.0))
        # ---- muster corridor
        B.wall(27, 29, 1, 9, -0.6, 5.6, axis="y")
        B.wall(32, 34, 1, 9, -0.6, 5.6, axis="y")
        B.barrel_vault("y", 1, 9, 29, 32, 3.0, skip_ranges=[(3, 7)])
        B.slab(27, 34, 1, 9, 5.0, 5.6, "stone_block", holes=[(29, 32, 3, 7)])
        # ---- armory
        B.slab(20, 34, 10.5, 27, -0.5, 0, "stone_block")
        B.wall(20, 36, 9, 10.5, -0.6, 10, openings=[(29.3, 31.7, 0, 3.2)], axis="x")
        B.wall(34, 36, 10.5, 29, -0.6, 10, axis="y")
        B.wall(20, 36, 27, 29, -0.6, 10, axis="x")
        B.slab(20, 34, 10.5, 27, 9, 9.5, "wood_planks", holes=[ARM_HOLE])
        for y in (12.25, 24.75):
            B.box(20, 34, y - 0.15, y + 0.15, 8.6, 9.0, "timber", rot90=True)
        for y in (14.75, 17.25, 19.75):
            B.box(20, 26, y - 0.15, y + 0.15, 8.6, 9.0, "timber", rot90=True)
            B.box(32, 34, y - 0.15, y + 0.15, 8.6, 9.0, "timber", rot90=True)
        # east stair top landing (anchor) + its parapet
        B.slab(20, 22.6, 24.5, 27, 5.4, 6, "stone_block")
        B.parapet(22.6, 22.9, 24.5, 27, 6, h=1.2)
        for y in (25.0, 26.4):
            B.box(20, 20.7, y - 0.3, y + 0.3, 4.6, 5.4, "stone_block")
        sigil(B, "CP3", (21.3, 25.9, 6.0), yaw=math.pi / 2)
        fissure(B, "F4", (25.5, 13.0, 0.0))
        prompt(B, "T_ARMORY", (20, 34, 10.5, 16, 0, 4), "The stair's foot is gated. Its upper flight is gone.", state="BOTH")

    with B.at(S, "PAST"):
        B.slab(BAR_HOLE[0], BAR_HOLE[1], BAR_HOLE[2], BAR_HOLE[3], 8, 8.5, "wood_planks")
        for y in (-18.25, -15.75, -13.25, -10.75):
            B.box(27, 35, y - 0.15, y + 0.15, 7.6, 8.0, "timber", rot90=True)
        # barracks: bunks, tables, the barricade inside the ward door
        for y in (-25, -22.6, -20.2, -17.8, -8.2, -5.8, -3.4):
            B.bunk(25.2, y, axis="x")
        for y in (-25, -22.6, -20.2, -17.8, -15.4, -10.6, -8.2, -5.8, -3.4):
            B.bunk(36.8, y, axis="x")
        for y in (-22, -8):
            B.table(31, y, 4.2, 1.0, axis="y")
            B.bench(30.1, y, 4.0, axis="y")
            B.bench(31.9, y, 4.0, axis="y")
        B.obox((25.0, -13.0, 1.1), (0.9, 3.4, 0.1), (0, 1.2, 0.1), "wood_fine")
        B.obox((25.6, -12.2, 0.8), (2.0, 0.9, 1.6), (0.4, 0.2, 1.3), "timber")
        B.crate(25.9, -14.3, 0, 0.9, rot=0.3)
        B.crate(24.9, -11.7, 0, 0.85, rot=-0.2)
        B.crate(25.3, -13.2, 0.9, 0.8, rot=0.5)
        B.door_leaf((24.1, -14.4, 0), 1.45, 3.0, "y", angle=-1.3, col=False)
        B.door_leaf((24.1, -11.6, 0), -1.45, 3.0, "y", angle=1.3, col=False)
        trace(B, "TR_BARRICADE", (25.2, -12.6, 1.2), "They barricaded themselves in. The King's wardens were outside.")
        B.weapon_rack(33, -26.3, axis="x", length=2.4)
        B.marker("fire", (37.5, -13.5, 0.45), size=0.8, state="PAST")
        B.marker("light", (37.0, -13.5, 1.2), kind="hearth", color="ff7a30", intensity=14.0, range=11.0, state="PAST")
        for y in (-22, -6):
            B.torch(38, y, 3.0, "-x")
        B.torch(26, -27, 3.0, "+y")
        encounter(B, "E5b", "PAST", (24, 38, -27, -1, 0, 7), optional=True)
        for p in ((28, -20), (33, -16), (28.5, -6), (34, -4)):
            enemy(B, "guard", (p[0], p[1], 0), "E5b", "PAST", yaw=math.pi / 2, tint="rebel")
        # corridor intact, north door locked by royal order
        B.barrel_vault("y", 3, 7, 29, 32, 3.0)
        B.slab(29, 32, 3, 7, 5.0, 5.6, "stone_block")
        B.box(29.3, 31.7, 9.55, 9.75, 0, 3.2, "wood_door", col=True)
        B.box(29.3, 31.7, 9.5, 9.55, 0.5, 0.65, "iron")
        B.box(29.3, 31.7, 9.5, 9.55, 2.5, 2.65, "iron")
        B.prism(30.5, 9.46, 1.4, 1.7, 0.18, 10, "fx_sigil", caps=True)
        trace(B, "TR_ROYAL_ORDER", (30.5, 9.0, 1.6), "Sealed by Royal Order.")
        B.torch(29, 5, 2.4, "+x")
        # armory: roof intact, gated stair, screen wall, racks
        B.slab(ARM_HOLE[0], ARM_HOLE[1], ARM_HOLE[2], ARM_HOLE[3], 9, 9.5, "wood_planks")
        B.portcullis(20.05, 22.55, 11.5, 0, 3.0, mat="iron", col=True)
        B.box(22.55, 22.75, 11.3, 11.7, 0, 3.4, "iron", col=True)
        B.box(20.0, 22.75, 11.3, 11.7, 3.0, 3.4, "iron")
        trace(B, "TR_ARMORY_GATE", (21.3, 11.0, 1.5), "The gate bears the King's seal. The racks behind it stand empty.")
        B.stairs(20, 22.6, 12, 17, 0, 3, "+y", mat="stone_block", solid_to=0)
        B.box(20, 22.6, 17, 19.5, 0, 3, "stone_block", col=True)
        B.stairs(20, 22.6, 19.5, 24.5, 3, 6, "+y", mat="stone_block", solid_to=0)
        B.box(20, 22.6, 24.5, 27, 0, 5.4, "stone_block", col=True)
        B.box(22.6, 23.2, 11.3, 19.5, 0, 5.0, "stone_wall", col=True)
        for k in range(12):
            y0 = 19.5 + k * (5 / 12)
            zt = 3 + (k + 1) * 0.25
            B.box(22.6, 22.9, y0, y0 + 5 / 12, zt, zt + 1.2, "stone_wall")
            B.col_box(22.6, 22.9, y0, y0 + 5 / 12, zt, zt + 1.9)
        for y in (13, 17, 21):
            B.weapon_rack(33.4, y, axis="y", length=2.2, spears=(y != 17))
        B.table(28.5, 14.2, 2.6, 1.1)
        B.crate_stack(32.2, 25.4, 3, seed=61)
        for x in (26.5, 29.5):
            B.prism(x, 24.3, 0, 0.1, 0.35, 8, "stone_block")
            B.prism(x, 24.3, 0.1, 1.2, 0.08, 6, "wood_rough")
            B.box(x - 0.3, x + 0.3, 24.1, 24.5, 1.1, 1.7, "iron")
            B.col_box(x - 0.35, x + 0.35, 23.95, 24.65, 0, 1.7)
        B.banner(26, 28, 27, 8.2, 4, "-y")
        B.banner(30, 32, 27, 8.2, 4, "-y")
        for y in (15, 22):
            B.torch(34, y, 3.0, "-x")
        B.torch(21.3, 27, 7.8, "-y")
        encounter(B, "E6b", "PAST", (20, 34, 10.5, 27, 0, 8), optional=True)
        enemy(B, "guard", (23.8, 11.4, 0), "E6b", "PAST", yaw=math.pi / 2)
        enemy(B, "guard", (26.5, 12.4, 0), "E6b", "PAST", yaw=math.pi)

    with B.at(S, "PRESENT"):
        # barracks ruin
        B.mound(31, -14, 3.2, 3.6, 1.5, seed=71, clip=(24, 38, -27, -1))
        B.mound(28.3, -17.2, 1.6, 1.4, 0.9, seed=72, clip=(24, 38, -27, -1))
        for i, (c, r) in enumerate((((29.5, -12.5, 0.6), (0.4, 0.3, 0.9)), ((33.0, -16.0, 0.9), (-0.3, 0.2, 0.4)),
                                    ((27.8, -10.8, 0.5), (0.1, 0.5, 2.0)))):
            B.obox(c, (7.5, 0.3, 0.4), r, "wood_moss")
        for y in (-25, -20.2, -8.2, -3.4):
            B.bunk(25.2, y, axis="x", mat="wood_moss", rotten=True)
        for y in (-22.6, -17.8, -5.8):
            B.bunk(36.8, y, axis="x", mat="wood_moss", rotten=True)
        B.table(31, -22, 4.2, 1.0, axis="y", mat="wood_moss", broken=True)
        B.door_leaf((25.4, -14.3, 0.0), 2.8, 0.14, "y", t=3.0, angle=0.0, mat="wood_moss", col=False, bands=True)
        for p in ((27, -8), (34, -21.5), (29, -24), (35, -5)):
            B.bones(p[0], p[1], n=10, r=0.7, seed=int(p[0] * 7 + p[1]))
        trace(B, "TR_BONES", (25.6, -12.4, 0.5), "Bones heaped behind the barricade. The door was broken in from the yard.")
        veg_scatter(B, BAR_HOLE, 26, seed=73)
        veg_line(B, (24.4, -26.6), (37.6, -26.6), 10, seed=74)
        encounter(B, "E5", "PRESENT", (24, 38, -27, -1, 0, 7), reward_hint=230)
        for i, p in enumerate(((27, -8), (34, -21.5), (29, -24), (35, -5))):
            enemy(B, "hollow", (p[0], p[1], 0), "E5", "PRESENT", rise=True, wave=1 + (i // 2))
        enemy(B, "hollow_warden", (31, -6.5, 0), "E5", "PRESENT", yaw=math.pi)
        # corridor crawl: collapse leaves a 1.3 m gap along the east side
        B.col_box(29, 30.4, 3, 7, 0, 4.6)
        B.col_box(30.4, 32, 3, 7, 1.3, 4.6)
        B.mound(29.7, 5, 0.9, 2.3, 3.2, seed=75, clip=(29, 30.4, 2.8, 7.2), chunk_count=10)
        B.obox((31.2, 5, 1.47), (0.35, 4.6, 0.3), (0, 0, 0), "wood_moss")
        B.obox((30.6, 5.2, 1.5), (0.3, 4.2, 0.28), (0.05, 0, 0.05), "wood_moss")
        B.chunks(30.3, 32, 3.1, 6.9, lambda x, y: 2.3, 22, smin=0.35, smax=0.8, seed=76, sink=0.2)
        B.box(30.3, 32, 3, 7, 1.62, 3.0, "rock")
        B.chunks(29.1, 32, 2.2, 3.0, lambda x, y: 0.0, 5, smin=0.2, smax=0.5, seed=77)
        prompt(B, "T_CROUCH", (29, 32, 0.5, 3, 0, 3), "Hold C to crouch through low gaps.", state="PRESENT")
        B.obox((30.5, 11.6, 0.08), (2.3, 1.2, 0.14), (0.02, 0.05, 0.3), "wood_moss")
        B.obox((29.6, 12.9, 0.06), (1.0, 0.8, 0.12), (0.1, 0.0, 1.1), "wood_moss")
        # armory ruin + east stair: rubble ramp and pad on the Past landing's footprint
        B.rubble_ramp(20, 22.5, 12, 17, 0, 3, "y", 1, seed=78)
        B.box(20, 22.5, 17, 19.4, 0, 3.0, "rock", col=True)
        B.chunks(20.1, 22.4, 18.9, 19.4, lambda x, y: 3.0, 4, smin=0.2, smax=0.45, seed=79, sink=0.6)
        B.mound(22.9, 14.8, 0.7, 2.8, 0.9, seed=80, col=False, clip=(22.5, 24.5, 11.5, 19.5))
        B.mound(21.3, 22.0, 1.3, 2.4, 1.2, seed=81, clip=(20, 22.6, 19.6, 24.4))
        B.obox((21.0, 20.3, 0.5), (2.2, 1.0, 0.5), (0.3, 0.2, 0.1), "stone_block")
        B.obox((21.8, 23.2, 0.6), (1.8, 0.9, 0.45), (-0.2, 0.3, 0.5), "stone_block")
        B.mound(29, 18, 2.5, 3.0, 1.2, seed=82, clip=(20, 34, 10.5, 27))
        for y in (13, 21):
            B.weapon_rack(33.4, y, axis="y", length=2.2, mat="wood_moss", metal="rust", spears=False)
        B.obox((28.5, 14.2, 0.3), (2.6, 1.1, 0.1), (0.2, 0.1, 0.2), "wood_moss")
        veg_scatter(B, ARM_HOLE, 20, seed=83)
        prompt(B, "T_HEIGHT", (20, 22.5, 17, 19.4, 2.9, 5),
               "The old landing lies beneath this rubble. Shift here.", state="PRESENT")
        encounter(B, "E6", "PRESENT", (20, 34, 10.5, 27, 0, 8), reward_hint=170)
        enemy(B, "hollow", (27, 21.5, 0), "E6", "PRESENT", yaw=math.pi)
        enemy(B, "hollow", (31, 13.5, 0), "E6", "PRESENT", yaw=math.pi)
        enemy(B, "hollow", (25, 24.5, 0), "E6", "PRESENT", yaw=math.pi)
        enemy(B, "wraith", (28, 18, 3.4), "E6", "PRESENT")
        enemy(B, "wraith", (24.5, 15, 4.0), "E6", "PRESENT")


# =====================================================================================
GAL_E = (14, 18, 9, 30)
GAL_W = (-18, -14, 9, 30)
GAL_S = (-14, 14, 9, 13)
COLS_EW_Y = (13.0, 17.25, 21.5, 25.75, 30.0)
COLS_S_X = (-9.33, -4.67, 0.0, 4.67, 9.33)
HALL_ROOF_HOLES = [(2, 16, 9, 13), (-5, 5, 30, 38)]


def build_hall(B):
    S = "S4_HALL"
    with B.at(S, "SHARED"):
        # hall floor over the undercroft (Present great collapse + hatch are holes)
        B.slab(-18, 18, 9, 42, -0.8, 0, "marble", holes=[HALL_PIT, HATCH])
        # walls
        B.wall(-24, 24, 7, 9, -0.6, 5.8, openings=[(-2.5, 2.5, 0, 5.5)], axis="x")
        B.wall(-24, 24, 7, 9, 5.8, 16, openings=[(-1.2, 1.2, 6, 9.2)], axis="x", trim=False)
        B.crenellations(-24, 24, 7, 8.2, 16, "x")
        B.wall(18, 20, 9, 44, -0.6, 16,
               openings=[(13.5, 14.7, 11, 13.8), (19.5, 20.7, 11, 13.8), (24.7, 26.9, 6, 9.2),
                         (31.5, 32.7, 11, 13.8), (37.5, 38.7, 11, 13.8)], axis="y")
        B.wall(-22, -18, 9, 44, -0.6, 16, openings=[(10.3, 12.7, 6, 9.2)], axis="y")
        B.wall(-22, 22, 42, 44, -0.6, 16, openings=[(-2, 2, 1.2, 5.6)], axis="x")
        B.box(-2, 2, 42, 44, -0.8, 1.2, "marble", col=True)
        # roof
        B.slab(-18, 18, 9, 42, 15, 15.6, "timber", holes=HALL_ROOF_HOLES)
        for x in (-14, -10, -6, 6, 10, 14):
            B.box(x - 0.25, x + 0.25, 9, 42, 14.2, 15, "timber")
        for y in (11, 15, 19, 23, 27, 31, 35, 39):
            if 29 < y < 39 or 9 < y < 13:
                continue
            B.box(-18, 18, y - 0.25, y + 0.25, 14.4, 15, "timber", rot90=True)
        # galleries: slabs, arcades, parapets
        for g in (GAL_E, GAL_W, GAL_S):
            B.slab(g[0], g[1], g[2], g[3], 5.4, 6, "stone_block")
        cols = set()
        for y in COLS_EW_Y:
            cols.add((14.0, y))
            cols.add((-14.0, y))
        for x in COLS_S_X:
            cols.add((x, 13.0))
        for (x, y) in cols:
            B.column(x, y, 0, 5.4, r=0.45)
        for sx in (14.0, -14.0):
            for a, b in zip(COLS_EW_Y, COLS_EW_Y[1:]):
                B.arch_spandrel("y", a + 0.45, b - 0.45, 5.4, (sx - 0.3, sx + 0.3), "stone_block")
        xs = (-14.0,) + COLS_S_X + (14.0,)
        for a, b in zip(xs, xs[1:]):
            B.arch_spandrel("x", a + 0.45, b - 0.45, 5.4, (12.7, 13.3), "stone_block")
        B.parapet(14, 14.35, 13, 30, 6)
        B.parapet(14, 18, 29.65, 30, 6)
        B.parapet(-14.35, -14, 13, 30, 6)
        B.parapet(-18, -14, 29.65, 30, 6)
        B.parapet(-14, 14, 12.65, 13, 6)
        fissure(B, "F5", (16.0, 22.0, 6.0))
        fissure(B, "F6", (-16.0, 20.0, 6.0))
        fissure(B, "F10", (12.6, 36.0, 0.0))
        # Royal Stair
        B.wall(-5, -3, 44, 60, -0.6, 14, axis="y")
        B.wall(3, 5, 44, 60, -0.6, 14, axis="y")
        B.wall(-5, 5, 58, 60, -0.6, 14, openings=[(-1.6, 1.6, 8, 11.6)], axis="x")
        B.stairs(-3, 3, 44.0, 55.4, 1.2, 8.0, "+y", mat="marble", solid_to=0, n=27)
        B.box(-3, 3, 55.4, 58, 0, 8, "marble", col=True)
        B.slab(-3, 3, 44, 58, 13.2, 13.6, "timber", holes=[(-1.5, 1.5, 50, 53)])
        B.box(-1.6, 1.6, 58.6, 58.8, 8, 11.6, "wood_door", col=True)
        B.box(-1.6, 1.6, 58.55, 58.6, 8.6, 8.75, "iron")
        B.box(-1.6, 1.6, 58.55, 58.6, 10.6, 10.75, "iron")
        B.volume("exit", -3, 3, 56, 58.5, 8, 10.5, name="EXIT", state="BOTH")
        prompt(B, "T_EXIT", (-3, 3, 54, 58, 7, 11), "The way to the Upper Keep.")
        # finale
        encounter(B, "E13", "BOTH", (-18, 18, 9, 42, -1, 3.0), finale=True, reward_hint=200)
        enemy(B, "gate_warden", (0, 37.5, 1.2), "E13", "BOTH", yaw=math.pi, boss=True)
        B.marker("warden_anchor", (0, 22, 0), name="WARDEN_PRESENT_ANCHOR", state="PRESENT")
        prompt(B, "T_THRESHOLD", (-4, 4, 38, 42.2, 0.9, 4),
               "Only the doorway remembers solid ground. Stand within it.", state="PAST", requires="cleared:E13")
        B.volume("threshold", -2, 2, 42, 43.6, 1.2, 4, name="THRESHOLD", state="BOTH")

    with B.at(S, "PAST"):
        B.slab(-7, 7, 27, 36, -0.8, 0, "marble")
        B.stairs(-9, 9, 34, 36, 0, 1.2, "+y", mat="marble", n=5)
        B.box(-9, 9, 36, 42, -0.8, 1.2, "marble", col=True)
        B.box(-9.2, 9.2, 35.9, 42, 1.15, 1.22, "fabric_royal")
        B.box(-1.5, 1.5, 9, 34, 0, 0.02, "fabric_royal")
        # throne + canopy, set west of the Royal Door so the doorway stays the clear focal point
        tx = -5.5
        B.box(tx - 0.7, tx + 0.7, 40.1, 41.1, 1.2, 1.75, "stone_block", col=True)
        B.box(tx - 0.7, tx + 0.7, 40.9, 41.3, 1.2, 3.6, "stone_block", col=True)
        B.box(tx - 0.8, tx - 0.6, 40.1, 41.1, 1.75, 2.3, "stone_block")
        B.box(tx + 0.6, tx + 0.8, 40.1, 41.1, 1.75, 2.3, "stone_block")
        B.box(tx - 0.55, tx + 0.55, 40.15, 40.95, 1.75, 1.85, "fabric_royal")
        for (x, y) in ((tx - 1.8, 39.0), (tx + 1.8, 39.0), (tx - 1.8, 41.8), (tx + 1.8, 41.8)):
            B.prism(x, y, 1.2, 5.4, 0.1, 6, "wood_fine")
        B.box(tx - 2.0, tx + 2.0, 38.8, 42.0, 5.4, 5.6, "fabric_royal")
        # sealed Royal door leaf
        B.box(-2, 2, 43.6, 43.9, 1.2, 5.6, "iron", col=True)
        B.prism(0, 43.57, 3.0, 3.4, 0.6, 16, "fx_sigil")
        trace(B, "TR_ROYAL_DOOR", (0, 42.6, 2.2), "The door does not know you.")
        # SE screen, barred from the west (Past)
        B.box(13.8, 14.2, 9, 12.65, 6, 10, "timber")
        B.col_box(13.8, 14.2, 9, 13, 6, 10)
        B.box(13.75, 13.8, 10.3, 12.5, 6, 9, "wood_door")
        B.box(13.55, 13.75, 10.1, 12.7, 7.3, 7.5, "timber")
        trace(B, "TR_SCREEN", (14.4, 11.4, 7.2), "Barred from the other side. Someone fled west and shut it behind them.")
        # balcony door (locked) and main doors (barred from inside)
        B.box(-1.2, 1.2, 8.1, 8.3, 6, 9.2, "wood_door", col=True)
        B.box(-2.5, 2.5, 8.6, 8.85, 0, 5.5, "wood_door", col=True)
        B.box(-2.8, 2.8, 8.85, 9.2, 2.6, 2.9, "timber")
        B.box(-2.5, 2.5, 8.55, 8.6, 1.0, 1.15, "iron")
        B.box(-2.5, 2.5, 8.55, 8.6, 4.2, 4.35, "iron")
        # loft door open
        B.door_leaf((-18.1, 12.55, 6.0), -2.2, 3.0, "y", angle=-math.pi / 2, col=True)
        # hatch frame + open trapdoor
        B.box(14.3, 14.5, 32.6, 38, -0.2, 0.08, "timber")
        B.box(17.0, 17.2, 32.6, 38, -0.2, 0.08, "timber")
        B.box(14.3, 17.2, 32.4, 32.6, -0.2, 0.08, "timber")
        B.obox((14.35, 35.3, 1.35), (0.12, 5.2, 2.6), (0, 0, 0), "wood_planks")
        # furnishings: tables, benches, braziers, banners, carpet
        for x, (y0, y1) in ((-10, (14, 28)), (10, (14, 28)), (-4, (14, 25)), (4, (14, 25))):
            for (a, b) in ((y0, (y0 + y1) / 2 - 0.3), ((y0 + y1) / 2 + 0.3, y1)):
                B.table(x, (a + b) / 2, b - a, 1.1, axis="y")
                B.bench(x - 0.95, (a + b) / 2, b - a - 0.2, axis="y")
                B.bench(x + 0.95, (a + b) / 2, b - a - 0.2, axis="y")
        B.candles(-10, 18, 0.8, 4, seed=91)
        B.candles(10, 23, 0.8, 4, seed=92)
        for p in ((-12.2, 18), (12.2, 18), (-12.2, 33), (12.2, 31)):
            B.brazier(*p)
        for y in (15.2, 19.4, 23.6, 27.8):
            B.banner(14.0, y + 0.8, y - 0.8, 7.15, 3.2, "-x")
            B.banner(-14.0, y + 0.8, y - 0.8, 7.15, 3.2, "+x")
        for x in (-7, 7):
            B.banner(x - 0.9, x + 0.9, 13, 7.15, 3.2, "+y")
        B.banner(-7, -4.5, 42, 13, 7, "-y")
        B.banner(4.5, 7, 42, 13, 7, "-y")
        for y in (34, 40):
            B.torch(18, y, 3.2, "-x")
            B.torch(-18, y, 3.2, "+x")
        for y in (12, 20, 28):
            B.torch(18, y, 8.6, "-x")
            B.torch(-18, y, 8.6, "+x")
        for x in (-8, 8):
            B.torch(x, 9, 8.6, "+y")
        for y in (47, 51, 55):
            zt = 1.2 + (y - 44) / 11.4 * 6.8
            B.torch(-3, y, zt + 2.4, "+x")
            B.torch(3, y, zt + 2.4, "-x")
        for k in range(27):
            y0 = 44.0 + k * (11.4 / 27)
            zt = 1.2 + (k + 1) * (6.8 / 27)
            B.box(-0.8, 0.8, y0, y0 + 11.4 / 27, zt, zt + 0.02, "fabric_royal")
        # roof intact (holes filled)
        for h in HALL_ROOF_HOLES:
            B.slab(h[0], h[1], h[2], h[3], 15, 15.6, "timber")
        B.slab(-1.5, 1.5, 50, 53, 13.2, 13.6, "timber")
        # enemies: east gallery (E7), west gallery wardens (E9), the Last Muster (E13)
        encounter(B, "E7", "PAST", (14, 18, 9, 30, 5.5, 10), reward_hint=140)
        enemy(B, "guard", (16, 20, 6), "E7", "PAST", yaw=math.pi)
        enemy(B, "guard", (16.2, 15, 6), "E7", "PAST", yaw=0)
        enemy(B, "archer", (16.5, 10.5, 6), "E7", "PAST", yaw=0)
        enemy(B, "archer", (15.2, 11.8, 6), "E7", "PAST", yaw=0)
        encounter(B, "E9", "PAST", (-18, -14, 9, 30, 5.5, 10), reward_hint=200)
        enemy(B, "royal_warden", (-16.2, 13.5, 6), "E9", "PAST", yaw=0)
        enemy(B, "royal_warden", (-15.6, 16.5, 6), "E9", "PAST", yaw=0)
        # the Last Muster rises in phases: flanks with the Warden, then the second rank, then the centre
        for i, (x, y) in enumerate(((-4, 30), (4, 30), (-4, 32.5), (4, 32.5), (0, 30), (0, 32.5))):
            enemy(B, "muster", (x, y, 0), "E13", "PAST", yaw=0.0, kneel=True, wave=1 if i < 2 else 2 if i < 4 else 3)
        enemy(B, "archer", (16, 24, 6), "E13", "PAST", yaw=-math.pi / 2, perch=True, wave=2)
        enemy(B, "archer", (-16, 24, 6), "E13", "PAST", yaw=math.pi / 2, perch=True, wave=2)
        prompt(B, "T_SCREEN", (14, 18, 9, 14, 5.5, 9), "The screen door is barred from the far side.", state="PAST")

    with B.at(S, "PRESENT"):
        # hatch covered by a fallen slab
        B.obox((15.75, 35.3, 0.12), (3.0, 5.8, 0.24), (0.02, -0.01, 0.03), "stone_block")
        B.col_box(14.4, 17.1, 32.5, 38.1, -0.1, 0.24)
        # great collapse edges + stubs of the dais wings
        B.broken_edge(-7, 7, 26.6, 27.4, 0.05, 14, seed=101)
        B.broken_edge(-7.4, -6.6, 27, 42, 0.05, 14, seed=102)
        B.broken_edge(6.6, 7.4, 27, 42, 0.05, 14, seed=103)
        B.box(-7.0, 7.0, 26.95, 27.0, -2.5, -0.8, "rock")
        for sx in (-1, 1):
            B.mound(sx * 8.1, 39, 1.0, 2.8, 0.8, seed=104 + sx, clip=(-18, 18, 9, 42))
        # crawl tunnel under the fallen roof on the south gallery
        B.col_box(4, 14.5, 11.1, 12.65, 6, 9.5)
        B.col_box(4, 14.5, 9, 11.1, 7.3, 9.5)
        B.mound(9.2, 12.2, 5.6, 1.1, 3.3, z0=6, seed=105, clip=(4, 14.4, 11.1, 12.65), chunk_count=16)
        for x in (5.2, 7.4, 9.6, 11.8, 13.8):
            B.obox((x, 10.2, 7.45), (0.32, 2.6, 0.28), (0.0, 0.0, 0.08 * (x - 9)), "wood_moss")
        B.chunks(4.2, 14.3, 9.1, 11.0, lambda x, y: 8.2, 26, smin=0.4, smax=0.9, seed=106, sink=0.1)
        B.box(4, 14.5, 9.0, 11.1, 7.6, 8.1, "rock")
        B.obox((10.0, 11.0, 10.4), (11.5, 0.5, 0.5), (0.0, 0.35, 0.0), "wood_moss")
        B.obox((7.0, 10.0, 9.8), (7.5, 0.45, 0.45), (0.1, -0.45, 0.2), "wood_moss")
        B.chunks(-13.5, 3.8, 9.3, 12.5, lambda x, y: 6.0, 14, smin=0.15, smax=0.45, seed=107)
        prompt(B, "T_CRAWL", (13.5, 18, 9, 13, 5.5, 9), "Crouch (C) to crawl beneath the fallen roof.", state="PRESENT")
        # loft doorway choked, balcony door and main doors blocked
        B.col_box(-22, -18, 10.3, 12.7, 6, 9.2)
        B.mound(-17.3, 11.5, 1.0, 1.6, 1.8, z0=6, seed=108, clip=(-18, -14, 9, 30))
        B.chunks(-21.8, -18.2, 10.4, 12.6, lambda x, y: 7.6, 12, smin=0.4, smax=0.9, seed=109)
        B.col_box(-1.2, 1.2, 7, 9, 6, 9.2)
        B.chunks(-1.1, 1.1, 7.2, 8.8, lambda x, y: 7.2, 8, smin=0.4, smax=0.8, seed=110)
        B.col_box(-2.5, 2.5, 7, 9.6, 0, 5.5)
        B.mound(0, 10.6, 3.0, 1.7, 2.6, seed=111, clip=(-18, 18, 9, 42))
        B.chunks(-2.4, 2.4, 7.2, 8.8, lambda x, y: 3.5, 10, smin=0.5, smax=1.0, seed=112)
        # ruin furnishings, rubble islands (cover), burned banners
        for (cx, cy, rx, ry, h, sd) in ((-15, 20, 2.0, 2.5, 1.2, 113), (15, 18, 1.8, 2.0, 1.0, 114),
                                         (-12, 35, 2.0, 2.0, 1.4, 115), (12, 29.5, 1.6, 1.8, 0.9, 116)):
            B.mound(cx, cy, rx, ry, h, seed=sd, clip=(-18, 18, 9, 42))
        B.table(-10, 16, 5.0, 1.1, axis="y", mat="wood_moss", broken=True)
        B.table(10, 23, 5.0, 1.1, axis="y", mat="wood_moss", broken=True)
        B.obox((-5.2, 25.6, 0.35), (4.2, 3.4, 0.12), (0.12, -0.2, 0.3), "fabric_banner")
        for (x, y) in ((-6.4, 24.7), (-3.2, 26.4)):
            B.obox((x, y, 0.12), (0.2, 3.8, 0.2), (0, 1.5, 0.4), "wood_moss")
        for y in (15.2, 23.6):
            B.banner(14.0, y + 0.8, y - 0.8, 7.15, 3.2, "-x", tattered=True)
            B.banner(-14.0, y + 0.8, y - 0.8, 7.15, 3.2, "+x", tattered=True)
        B.chunks(14.3, 17.8, 13, 29.5, lambda x, y: 6.0, 10, smin=0.15, smax=0.45, seed=117)
        B.chunks(-17.8, -14.3, 13, 29.5, lambda x, y: 6.0, 10, smin=0.15, smax=0.45, seed=118)
        # broken Royal door leaf lies on the stair
        B.obox((-0.9, 45.2, 1.6), (2.0, 0.25, 2.6), (1.2, 0.2, 0.3), "rust")
        B.obox((1.1, 46.3, 1.9), (1.8, 0.25, 2.2), (-1.1, 0.1, -0.2), "rust")
        veg_scatter(B, (-17.5, -7.5, 9.5, 41.5), 26, seed=119)
        veg_scatter(B, (7.5, 17.5, 9.5, 41.5), 26, seed=120)
        veg_scatter(B, (-2.5, 2.5, 47, 55), 8, seed=121)
        B.marker("light", (0, 34, 14.0), kind="moon", color="9fb8ff", intensity=5.0, range=24.0, state="PRESENT")
        # enemies: south/west gallery ambush (E8), finale adds (E13 Present)
        encounter(B, "E8", "PRESENT", (-18, 4, 9, 30, 5.5, 10), reward_hint=145)
        enemy(B, "hollow", (-2, 11, 6), "E8", "PRESENT", yaw=0, rise=True)
        enemy(B, "hollow", (-8, 11.5, 6), "E8", "PRESENT", yaw=0, rise=True)
        enemy(B, "hollow", (-16, 17, 6), "E8", "PRESENT", yaw=0, rise=True)
        enemy(B, "wraith", (-10, 16, 8.5), "E8", "PRESENT")
        enemy(B, "hollow", (-13, 24, 0), "E13", "PRESENT", rise=True, wave=2)
        enemy(B, "hollow", (13, 22, 0), "E13", "PRESENT", rise=True, wave=2)
        enemy(B, "hollow", (-12, 14, 0), "E13", "PRESENT", rise=True, wave=3)
        enemy(B, "wraith", (0, 20, 4), "E13", "PRESENT", wave=2)
        enemy(B, "wraith", (-10, 32, 5), "E13", "PRESENT", wave=3)


# =====================================================================================
def build_chapel(B):
    S = "S5_CHAPEL"
    CH_ROOF_HOLES = [(-33, -27, 18, 24), (-31, -27, 38, 42)]
    with B.at(S, "SHARED"):
        B.slab(-36, -22, 9, 26, -1, 0, "marble")
        B.slab(-36, -22, 26, 42, -1, 0, "marble", holes=[CRYPT_HOLE])
        B.wall(-38, -36, 7, 44, -7, 14, axis="y")
        B.wall(-38, -22, 7, 9, -0.6, 14, axis="x")
        B.wall(-38, -22, 42, 44, -7, 14, axis="x")
        B.wall(-36, -22, 24, 26, -7, -1, axis="x", trim=False)
        B.slab(-36, -22, 9, 42, 13, 13.5, "timber", holes=CH_ROOF_HOLES)
        for y in (12, 16, 20, 28, 32, 36):
            if 17 < y < 25 or y > 37:
                continue
            B.box(-36, -22, y - 0.2, y + 0.2, 12.4, 13, "timber", rot90=True)
        # loft (royal pew gallery) + supports + parapet
        B.slab(-36, -22, 9, 16, 5.4, 6, "stone_block")
        B.parapet(-33.5, -22, 15.65, 16, 6)
        for x in (-28.5, -24.0):
            B.column(x, 15.6, 0, 5.4, r=0.4)
        # font + altar dais (anchors)
        B.prism(-28.5, 23.5, 0, 0.85, 0.35, 8, "stone_block")
        B.prism(-28.5, 23.5, 0.85, 1.1, 0.7, 10, "stone_block")
        B.col_box(-29.2, -27.8, 22.8, 24.2, 0, 1.1)
        B.box(-32, -26, 36, 42, -0.1, 0.4, "marble", col=True)
        B.box(-30.5, -27.5, 39, 40.5, 0.4, 1.4, "marble", col=True)
        # crypt below the nave's north half
        B.slab(-36, -22, 26, 42, -6.5, -6, "stone_block")
        for x in (-32, -26):
            B.column(x, 39.2, -6, -1, r=0.45)
        for (x, y) in ((-35, 28), (-35, 31.2), (-35, 34.4), (-23, 28), (-23, 31.2)):
            B.box(x - 0.55, x + 0.55, y - 1.15, y + 1.15, -6, -5.1, "stone_block", col=True)
        B.box(-30.15, -27.85, 40.5, 41.6, -6, -5.1, "stone_block", col=True)
        sigil(B, "CP4", (-26.0, 12.5, 6.0), yaw=math.pi)
        sigil(B, "CP5", (-24.8, 40.0, -6.0), yaw=-math.pi / 2)
        fissure(B, "F7", (-30.0, 12.0, 6.0))
        fissure(B, "F8", (-34.0, 40.0, -6.0))

    with B.at(S, "PAST"):
        B.slab(CRYPT_HOLE[0], CRYPT_HOLE[1], CRYPT_HOLE[2], CRYPT_HOLE[3], -1, 0, "marble")
        B.box(-31, -27, 33, 36, 0.0, 0.05, "iron")
        B.prism(-29, 34.5, 0.05, 0.07, 0.9, 16, "fx_sigil")
        trace(B, "TR_CRYPT_DOOR", (-29, 34.5, 0.4), "A sealed floor-door. It does not know you.")
        for h in CH_ROOF_HOLES:
            B.slab(h[0], h[1], h[2], h[3], 13, 13.5, "timber")
        # loft stair (descends north along the west wall) with sloped parapet
        B.stairs(-36, -33.5, 16, 26, 0, 6, "-y", mat="stone_block", solid_to=0)
        for k in range(24):
            y0 = 26 - (k + 1) * (10 / 24)
            zt = (k + 1) * 0.25
            B.box(-33.5, -33.2, y0, y0 + 10 / 24, zt, zt + 1.1, "stone_wall")
            B.col_box(-33.5, -33.2, y0, y0 + 10 / 24, zt, zt + 1.8)
        # royal pew on the loft
        B.box(-33, -25, 10.2, 11.0, 6.0, 6.5, "wood_fine", col=True)
        B.box(-33, -25, 9.8, 10.2, 6.0, 7.3, "wood_fine")
        B.box(-32.8, -25.2, 10.25, 10.95, 6.5, 6.62, "fabric_royal")
        B.banner(-31, -27, 9, 11.8, 3.4, "+y")
        # nave: pews, blood font, candles, banners, braziers, torches
        for y in (17.5, 18.9, 20.3, 21.7):
            B.pew(-31.6, y, 2.8)
            B.pew(-25.4, y, 2.8)
        B.prism(-28.5, 23.5, 1.1, 1.14, 0.62, 10, "fx_blood")
        B.candles(-30.2, 40.2, 1.4, 4, seed=131)
        B.candles(-27.8, 39.3, 1.4, 4, seed=132)
        B.banner(-31, -27, 42, 11.5, 5.5, "-y")
        for p in ((-34.8, 34), (-23.2, 34)):
            B.brazier(*p)
        for y in (20, 30, 38):
            B.torch(-36, y, 3.0, "+x")
            B.torch(-22, y, 3.0, "-x")
        B.torch(-36, 12, 8.6, "+x")
        for p in ((-29.7, 24.8), (-27.3, 24.8), (-28.5, 22.2)):
            B.marker("imprint", (p[0], p[1], 0), pose="kneel", state="PAST",
                     yaw=math.atan2(23.5 - p[1], -28.5 - p[0]) - math.pi / 2)
        trace(B, "TR_FONT", (-28.5, 23.5, 1.2), "Commoners knelt here under guard. The rite was not theirs to refuse.")
        # crypt (sealed in the Past): candle-lit tombs, Aldren's open and empty
        for (x, y) in ((-35, 28), (-35, 31.2), (-35, 34.4), (-23, 28), (-23, 31.2)):
            B.box(x - 0.6, x + 0.6, y - 1.2, y + 1.2, -5.1, -4.9, "marble")
            B.candles(x, y, -4.9, 2, r=0.2, seed=int(x * y))
        B.obox((-29.0 + 0.5, 41.05, -5.0), (2.4, 1.25, 0.2), (0, 0, 0.3), "marble")
        trace(B, "TR_ALDREN_TOMB", (-29, 41, -4.8), "King Aldren's tomb. No body was ever laid here.")
        B.torch(-36, 38, -3.4, "+x")
        # enemies: nave (E10)
        encounter(B, "E10", "PAST", (-36, -22, 16, 42, -0.5, 8), reward_hint=300)
        enemy(B, "guard", (-28.5, 30, 0), "E10", "PAST", yaw=math.pi)
        enemy(B, "guard", (-31, 27.5, 0), "E10", "PAST", yaw=math.pi)
        enemy(B, "guard", (-26, 27.5, 0), "E10", "PAST", yaw=math.pi)
        enemy(B, "royal_warden", (-29, 37.2, 0.4), "E10", "PAST", yaw=math.pi)
        enemy(B, "guard", (-34.5, 40, 0), "E10", "PAST", yaw=-math.pi / 2, wave=2)
        enemy(B, "guard", (-23.5, 40, 0), "E10", "PAST", yaw=math.pi / 2, wave=2)
        prompt(B, "T_DESCENT", (-34, -24, 24, 36, -0.5, 4),
               "The floor here gave way long ago — in the other memory.", state="PAST", requires="cleared:E10")

    with B.at(S, "PRESENT"):
        # loft stair collapsed; its head is blocked so the loft is not a drop-off
        B.stairs(-36, -33.5, 16, 17.67, 5, 6, "-y", mat="stone_block", solid_to=5.0, n=4, col=False)
        B.col_box(-36, -33.5, 15.3, 16.3, 6, 8.2)
        B.obox((-34.7, 15.8, 6.6), (3.0, 0.4, 0.4), (0.15, 0.05, 0.1), "wood_moss")
        B.mound(-34.8, 15.4, 1.3, 0.8, 1.1, z0=6, seed=141, clip=(-36, -33.5, 14.2, 16.3))
        B.mound(-34.7, 23.8, 1.2, 2.2, 1.8, seed=142, clip=(-36, -33.4, 19.5, 26))
        # the collapse into the crypt: rubble ramp + broken edges
        B.rubble_ramp(CRYPT_HOLE[0], CRYPT_HOLE[1], CRYPT_HOLE[2], CRYPT_HOLE[3], 0, -6, "y", 1, seed=143)
        B.broken_edge(-33, -25, 25.6, 26.4, 0.05, 10, seed=144)
        B.broken_edge(-33.4, -32.6, 26, 36, 0.05, 10, seed=145)
        B.broken_edge(-25.4, -24.6, 26, 36, 0.05, 10, seed=146)
        B.box(-33, -25, 35.95, 36.0, -1, 0, "rock")
        # nave ruin
        for y in (17.5, 20.3):
            B.pew(-31.6, y, 2.8, rotten=True)
        B.pew(-25.4, 18.9, 2.8, rotten=True)
        B.mound(-30, 21, 2.0, 2.2, 0.9, seed=147, clip=(-36, -22, 16, 26))
        B.chunks(-28.9, -28.1, 23.1, 23.9, lambda x, y: 1.1, 2, smin=0.2, smax=0.3, seed=148)
        B.banner(-31, -27, 42, 11.5, 5.5, "-y", tattered=True)
        B.pew(-29, 12.5, 7.0, rotten=True)
        # crypt ruin: tombs broken open
        for (x, y) in ((-35, 28), (-35, 31.2), (-35, 34.4), (-23, 28), (-23, 31.2)):
            B.obox((x + (0.9 if x < -30 else -0.9), y - 0.3, -5.8), (0.9, 1.3, 0.18), (0.35, 0.2, 0.4), "marble")
        B.obox((-27.6, 40.4, -5.8), (2.2, 0.9, 0.18), (0.25, -0.3, 0.3), "marble")
        veg_scatter(B, CH_ROOF_HOLES[0], 16, seed=149)
        veg_scatter(B, (-35.5, -22.5, 16.5, 25.5), 18, seed=150)
        veg_scatter(B, (-35.5, -22.5, 36.5, 41.5), 10, kinds=("flower", "grass"), z=-6.0, seed=151)
        veg_line(B, (-33.2, 26.5), (-33.2, 35.5), 6, kinds=("flower", "grass"), seed=152)
        B.marker("light", (-30, 21, 12.5), kind="moon", color="9fb8ff", intensity=3.0, range=16.0, state="PRESENT")
        encounter(B, "E10b", "PRESENT", (-36, -22, 16, 42, -0.5, 8), optional=True)
        enemy(B, "wraith", (-29, 30, 3), "E10b", "PRESENT")
        enemy(B, "wraith", (-26, 20, 3.5), "E10b", "PRESENT")
        encounter(B, "E11", "PRESENT", (-36, -22, 26, 42, -6.5, -1), reward_hint=230)
        enemy(B, "hollow", (-34.4, 38.4, -6), "E11", "PRESENT", rise=True)
        enemy(B, "hollow", (-23.8, 36.4, -6), "E11", "PRESENT", rise=True)
        enemy(B, "hollow", (-29.0, 40.5, -6), "E11", "PRESENT", rise=True, wave=2)
        enemy(B, "hollow", (-35.0, 32.0, -6), "E11", "PRESENT", rise=True, wave=2)
        enemy(B, "hollow_warden", (-31.0, 39.0, -6), "E11", "PRESENT", yaw=math.pi, wave=2)


# =====================================================================================
def build_under(B):
    S = "S6_UNDER"
    with B.at(S, "SHARED"):
        B.slab(-18, -7, 20, 42, -6.5, -6, "stone_block")
        B.slab(7, 18, 20, 42, -6.5, -6, "stone_block")
        B.box(-7.4, -7, 20, 42, -6.0, -5.8, "stone_block")
        B.box(7, 7.4, 20, 42, -6.0, -5.8, "stone_block")
        B.box(-7.6, -7, 20, 42, -24, -6.5, "rock")
        B.box(7, 7.6, 20, 42, -24, -6.5, "rock")
        B.wall(-20, 20, 18, 20, -24, -0.8, axis="x", trim=False)
        B.wall(-20, 20, 42, 44, -24, -0.8, axis="x", trim=False)
        B.wall(18, 20, 20, 42, -7, -0.8, axis="y")
        B.wall(-22, -18, 20, 42, -7, -0.8, openings=[(34, 38, -6, -2)], axis="y")
        B.slab(-18, 18, 20, 42, -1.0, -0.8, "stone_block", holes=[HALL_PIT, HATCH])
        B.box(-7, 7, 20, 42, -24.2, -24.0, "fx_crown")
        B.marker("light", (0, 31, -16), kind="crown", color="ff5a2a", intensity=40.0, range=30.0, state="BOTH")
        for x in (-12.5, 12.5):
            for y in (23, 29, 35, 41):
                B.column(x, y, -6, -1.0, r=0.6)
            ys = (20.0, 23, 29, 35, 41, 42.0)
            for a, b in zip(ys, ys[1:]):
                if b - a > 2.5:
                    B.arch_spandrel("y", a + 0.6, b - 0.6, -1.0, (x - 0.35, x + 0.35), "stone_block")
        sigil(B, "CP6", (10.4, 32.6, -6.0), yaw=-math.pi / 2)
        fissure(B, "F9", (10.0, 40.0, -6.0))
        prompt(B, "T_UNDER", (-18, -12, 33, 39, -6.5, -2), "Aldren's excavation. Something glows far below.")

    with B.at(S, "PAST"):
        B.slab(HALL_PIT[0], HALL_PIT[1], 27, 42, -1.0, -0.8, "stone_block")
        void(B, "V_PIT_PAST", (-7, 7, 20, 42, -30, -9), "PAST")
        timber_stair(B, 14.5, 17, 28, 38, -6, 0, "+y", rails=("x0", "x1"))
        # dig works: winch, crane, lanterns, shoring, spoil, crates
        B.hprism(8.2, 10.2, 30, -5.0, 0.35, 10, "wood_rough", axis="x")
        for x in (8.1, 10.3):
            B.box(x - 0.1, x + 0.1, 29.5, 30.5, -6, -4.6, "wood_rough", col=True)
        B.box(8.4, 8.5, 30, 30.1, -5.0, -3.0, "wood_rough")
        B.prism(8.0, 36.5, -6, -1.2, 0.15, 6, "wood_rough")
        B.obox((4.5, 36.5, -1.5), (7.2, 0.18, 0.18), (0, -0.08, 0), "wood_rough")
        B.box(1.05, 1.08, 36.49, 36.51, -9.0, -1.6, "fabric_linen")
        B.col_box(7.85, 8.15, 36.35, 36.65, -6, -1.2)
        for (x, y) in ((9.2, 24), (9.2, 40), (-9.2, 24), (-9.2, 40)):
            B.prism(x, y, -6, -4.2, 0.07, 6, "wood_rough")
            B.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, -4.2, -3.9, "iron")
            B.marker("fire", (x, y, -3.85), size=0.3, state="PAST")
            B.marker("light", (x, y, -3.5), kind="lantern", color="ffb070", intensity=10.0, range=10.0, state="PAST")
        for y in (21.5, 25, 28.5, 32, 35.5, 39):
            for x in (-7.25, 7.25):
                B.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, -9, -5.6, "wood_rough")
        for p in ((-15, 24.5, 21), (-13.5, 40, 22), (15.5, 22, 23)):
            B.mound(p[0], p[1], 1.6, 1.4, 1.0, z0=-6, mat="terrain", seed=p[2], clip=(-18, 18, 20, 42))
        B.crate_stack(-16.5, 30, 3, seed=161)
        B.crate_stack(10.5, 21.2, 2, seed=162)
        for p in ((11, 25.5), (11.6, 26.2), (-10, 33)):
            B.prism(p[0], p[1], -6, -5.4, 0.35, 8, "wood_rough")
            B.col_box(p[0] - 0.35, p[0] + 0.35, p[1] - 0.35, p[1] + 0.35, -6, -5.4)
        trace(B, "TR_WINCH", (9.2, 30, -4.6), "The King ordered them to dig. Toward the light.")
        encounter(B, "E12c", "PAST", (7, 18, 20, 42, -6.5, 1), reward_hint=110)
        enemy(B, "guard", (11, 27, -6), "E12c", "PAST", yaw=math.pi)
        enemy(B, "guard", (10.2, 31.5, -6), "E12c", "PAST", yaw=math.pi)
        enemy(B, "archer", (15.75, 34.0, -2.4), "E12c", "PAST", yaw=math.pi, perch=True)
        encounter(B, "E12d", "PAST", (-18, -7, 20, 42, -6.5, -1), optional=True)
        enemy(B, "guard", (-12, 31.5, -6), "E12d", "PAST", yaw=0)
        enemy(B, "guard", (-14.5, 26, -6), "E12d", "PAST", yaw=0)
        prompt(B, "T_CLIMB", (7, 18, 26, 30, -6.5, -2), "The scaffold stands in this memory.", state="PAST")

    with B.at(S, "PRESENT"):
        void(B, "V_PIT_PRESENT", (-7, 7, 27, 42, -30, -9), "PRESENT")
        # south fill across the pit
        B.col_box(-7, 7, 20, 27, -24, -6.0)
        B.rubble_ramp(-7, 7, 20, 27, -6.0, -6.0, "y", 1, seed=171, col=False, rough=0.18, chunk_count=30)
        B.box(-7, 7, 26.8, 27.0, -24, -6.1, "rock")
        B.broken_edge(-7, 7, 26.6, 27.2, -6.0, 12, seed=172)
        # rotted scaffold + debris
        for y in (29, 31, 33, 35, 37):
            for x in (14.6, 16.9):
                B.box(x - 0.08, x + 0.08, y - 0.08, y + 0.08, -6, -6 + (y - 28) * 0.25, "wood_moss")
        B.mound(15.8, 33.0, 1.3, 3.6, 1.0, z0=-6, seed=173, clip=(14, 18, 28, 38))
        B.obox((15.2, 31.5, -5.5), (0.2, 4.0, 0.3), (0.3, 0.1, 0.2), "wood_moss")
        B.mound(-14, 30, 1.8, 2.2, 1.1, z0=-6, seed=174, clip=(-18, 18, 20, 42))
        B.mound(15.3, 24.0, 1.4, 1.6, 0.8, z0=-6, seed=175, clip=(-18, 18, 20, 42))
        veg_line(B, (-7.9, 27.5), (-7.9, 41.5), 10, kinds=("flower", "flower", "grass"), z=-6.0, seed=176)
        veg_line(B, (7.9, 27.5), (7.9, 41.5), 10, kinds=("flower", "flower", "grass"), z=-6.0, seed=177)
        veg_scatter(B, (-6.5, 6.5, 20.5, 26.5), 12, kinds=("flower", "grass", "grasspack"), z=-6.0, seed=178)
        prompt(B, "T_FILL", (-18, -8, 20, 28, -6.5, -2), "The pit's southern end filled in, long ago.", state="PRESENT")
        prompt(B, "T_ROTTED", (9, 18, 28, 38, -6.5, -2), "The scaffold rotted away here. The hatch is out of reach.", state="PRESENT")
        encounter(B, "E12", "PRESENT", (-18, 18, 20, 42, -8, -1), reward_hint=135)
        enemy(B, "wraith", (0, 32, -3), "E12", "PRESENT")
        enemy(B, "wraith", (-3, 38, -2), "E12", "PRESENT")
        enemy(B, "wraith", (3, 35, -4), "E12", "PRESENT")
        enemy(B, "echo_archer", (13.5, 22.5, -6), "E12", "PRESENT", yaw=math.pi / 2, perch=True)
        enemy(B, "echo_archer", (16.4, 26.2, -6), "E12", "PRESENT", yaw=math.pi / 2, perch=True)


def build_all(B):
    build_barbican(B)
    build_gate(B)
    build_ward(B)
    build_east(B)
    build_hall(B)
    build_chapel(B)
    build_under(B)


SECTIONS = {
    "S1_GATE": {"bounds": (-17, 17, -52.5, -29), "neighbors": ["S2_WARD"]},
    "S2_WARD": {"bounds": (-24, 24, -31, 9), "neighbors": ["S1_GATE", "S3_EAST", "S4_HALL"]},
    "S3_EAST": {"bounds": (18, 40, -29, 29), "neighbors": ["S2_WARD", "S4_HALL"]},
    "S4_HALL": {"bounds": (-22, 22, 7, 60), "neighbors": ["S2_WARD", "S3_EAST", "S5_CHAPEL", "S6_UNDER"]},
    "S5_CHAPEL": {"bounds": (-38, -18, 7, 44), "neighbors": ["S4_HALL", "S6_UNDER"]},
    "S6_UNDER": {"bounds": (-22, 20, 18, 44), "neighbors": ["S4_HALL", "S5_CHAPEL"]},
}
