"""Floor 3 — "The Crown", the summit of Caer Veyr. Mirrors docs/LEVEL_03_BLUEPRINT.md v2.0 (§B-§K).

Same frame as Floors 1-2 (Blender X east, Y north, Z up). Groups: SHARED / PAST / PRESENT.
Spaces: BC Bell Chamber (arrival, CP1) -> WG Wind Gallery (G1 weave, E0/E1) -> CS Coronation Stair (G2: Past ward,
Present bell-spire ramp) -> HOC Hall of Crowns (E2, CP2, G3 Crown doors) -> CR the Crown (the Last Crown).
"""
import math

from floor01_layout import enemy, encounter, fissure, sigil, trace, prompt, void

Z = 24.0           # bell / gallery level
ZM = 27.0          # stair mid landing
ZC = 30.0          # hall + crown level (6 m above the gallery: the stair stays under 45 deg)
CR_C = (0.0, 138.0)
CR_R = 13.0
PILLAR_R = 8.5
PILLARS = [45.0, 135.0, 225.0, 315.0]            # degrees (0 = east, CCW)
WEDGES = [0.0, 90.0, 180.0, 270.0]               # Present holes between the pillars, r 5..11, 45 deg wide
WEDGE_HALF = 22.5
WEDGE_R = (5.0, 11.0)


def pit(B, x0, x1, y0, y1, z, vid, state):
    B.box(x0, x1, y0, y1, z - 0.3, z, "fx_void")
    void(B, vid, (x0, x1, y0, y1, z - 2, z + 4), state)


def room(B, x0, x1, y0, y1, z0, z1, t=1.0, openings=None, skip=()):
    o = openings or {}
    if "S" not in skip:
        B.wall(x0 - t, x1 + t, y0 - t, y0, z0 - 0.6, z1, openings=o.get("S", []), axis="x")
    if "N" not in skip:
        B.wall(x0 - t, x1 + t, y1, y1 + t, z0 - 0.6, z1, openings=o.get("N", []), axis="x")
    if "W" not in skip:
        B.wall(x0 - t, x0, y0, y1, z0 - 0.6, z1, openings=o.get("W", []), axis="y")
    if "E" not in skip:
        B.wall(x1, x1 + t, y0, y1, z0 - 0.6, z1, openings=o.get("E", []), axis="y")


def light(B, pos, kind, color, intensity, rng, state):
    B.marker("light", pos, kind=kind, color=color, intensity=intensity, range=rng, state=state)


# =====================================================================================
def build_bell(B):
    S = "C1_BELL"
    with B.at(S, "SHARED"):
        room(B, 18, 26, 90, 100, Z, 34, openings={"W": [(96.2, 99.8, Z, Z + 3.4)]})
        B.slab(24, 26, 90, 100, Z - 0.5, Z, "wood_planks")
        B.slab(18, 24, 96, 100, Z - 0.5, Z, "wood_planks")
        B.slab(18, 24, 90, 92, Z - 0.5, Z, "wood_planks")
        B.slab(18, 20, 92, 96, Z - 0.5, Z, "wood_planks")
        B.slab(17, 27, 89, 101, 34, 34.6, "stone_block")
        B.beams(18, 26, 90, 100, 33.4, "x", spacing=2.4)
        B.marker("spawn", (25.0, 93.0, Z), name="SPAWN", yaw=math.pi / 2, state="PRESENT")
        trace(B, "T1", (19.2, 91.2, Z + 1.0), "The bell rang once for the coronation. It was meant to ring again when the King came down. It never did.")
        prompt(B, "C_ARRIVE", (18, 26, 90, 100, Z - 1, Z + 4), "The Crown is above you. The castle's memories no longer hold still here.", state="BOTH")
    with B.at(S, "PAST"):
        B.slab(20, 24, 92, 96, Z - 0.3, Z, "wood_planks")        # the trap floor
        for x in (20.3, 23.7):
            B.box(x - 0.2, x + 0.2, 93.8, 94.2, Z, Z + 7.5, "timber", col=True)
        B.box(20.1, 23.9, 93.8, 94.2, Z + 7.3, Z + 7.8, "timber")
        B.prism(22, 94, Z + 4.2, Z + 7.2, 1.3, 16, "iron")        # the bell
        light(B, (22, 97, Z + 2.5), "candle", "ffb070", 2.2, 7.0, "PAST")
    with B.at(S, "PRESENT"):
        pit(B, 20, 24, 92, 96, Z - 6, "V_BELL", "PRESENT")
        B.prism(22, 94, Z - 5.5, Z - 3.0, 1.3, 16, "rust")       # bell lodged in the crater
        B.broken_edge(20, 24, 92, 96, Z, 8, seed=31)
        light(B, (22, 94, Z - 2), "crown", "ff5a22", 2.0, 6.0, "PRESENT")
        light(B, (25, 94, Z + 5), "moon", "9fb8ff", 1.6, 9.0, "PRESENT")


def build_gallery(B):
    S = "C2_GALLERY"
    with B.at(S, "SHARED"):
        # S wall, N wall with the stair door (x -4.5..-0.5), W end wall
        B.wall(-7, 18, 95, 96, Z - 0.6, 29.5, axis="x")
        B.wall(-7, 18, 100, 101, Z - 0.6, 29.5, openings=[(-4.5, -0.5, Z, Z + 3.6)], axis="x")
        B.wall(-7, -6, 96, 100, Z - 0.6, 29.5, axis="y")
        B.slab(-6, 4, 96, 100, Z - 0.5, Z, "stone_block")
        B.slab(10, 18, 96, 100, Z - 0.5, Z, "stone_block")
        fissure(B, "F1", (14.0, 98.0, Z))
        # CP1 anchors the far side of the first weave (session 7 checkpoint audit: it used to sit on the spawn)
        sigil(B, "CP1", (-4.9, 97.6, Z), yaw=math.pi / 2)
        prompt(B, "C_GAP", (10, 14, 96, 100, Z - 1, Z + 4), "The gallery fell here — in this memory. It stood in the other.", state="PRESENT")
        prompt(B, "C_GATE", (2, 4.2, 96, 100, Z - 1, Z + 4), "The wardens' gate stands in this memory. In the other it lies in the dust.", state="PAST")
        encounter(B, "E0", "PAST", (4, 10, 96, 100, Z - 1, Z + 4))
        enemy(B, "remnant", (6.0, 97.5, Z), "E0", "PAST", yaw=-math.pi / 2, rise=True)
        enemy(B, "remnant", (8.0, 98.8, Z), "E0", "PAST", yaw=-math.pi / 2, rise=True)
        encounter(B, "E1", "PRESENT", (-6, 2, 96, 106, Z - 1, Z + 6))
        enemy(B, "hollow", (-3.0, 97.2, Z), "E1", "PRESENT", yaw=-math.pi / 2, rise=True)
        enemy(B, "hollow", (-0.5, 98.8, Z), "E1", "PRESENT", yaw=-math.pi / 2, rise=True)
        enemy(B, "echo_archer", (-2.5, 104.3, ZM), "E1", "PRESENT", yaw=math.pi, perch=True)
    with B.at(S, "PAST"):
        B.slab(4, 10, 96, 100, Z - 0.5, Z, "stone_block")
        B.slab(-7, 18, 95, 101, 29.5, 30.1, "timber")
        # the wardens' gate (portcullis across the gallery at x 2)
        B.col_box(1.85, 2.15, 96, 100, Z, 29.5)
        for i in range(13):
            y = 96.15 + i * 0.31
            B.box(1.93, 2.07, y - 0.045, y + 0.045, Z, 29.4, "iron_rust")
        for zz in (Z + 0.5, Z + 1.8, Z + 3.1, Z + 4.4):
            B.box(1.9, 2.1, 96, 100, zz, zz + 0.1, "iron_rust")
        for x in (-4, 7, 15):
            B.candles(x, 99.5, Z, n=5, lit=True, state="PAST")
            light(B, (x, 99, Z + 1.5), "candle", "ffb070", 1.8, 6.0, "PAST")
        B.banner(-5.5, -4.5, 95.95, 28.5, 3.4, "+y")
        B.banner(11.5, 12.5, 95.95, 28.5, 3.4, "+y")
    with B.at(S, "PRESENT"):
        pit(B, 4, 10, 96, 100, Z - 7, "V_GAP", "PRESENT")
        B.broken_edge(4, 4.4, 96, 100, Z, 6, seed=41)
        B.broken_edge(9.6, 10, 96, 100, Z, 6, seed=42)
        B.fallen_grille((1.2, 98, Z + 0.06), (4.6, 3.8), (0, 0, 0.08))
        B.mound(-5, 99, 0.9, 0.9, 0.6, z0=Z, seed=43, col=False)
        light(B, (7, 98, Z - 3), "crown", "ff5a22", 1.6, 6.0, "PRESENT")
        light(B, (0, 98, Z + 5), "moon", "9fb8ff", 1.8, 12.0, "PRESENT")


def build_stair(B):
    S = "C3_STAIR"
    with B.at(S, "SHARED"):
        B.wall(-6, -5, 101, 108, Z - 0.6, 37, axis="y")
        B.wall(0, 1, 101, 108, Z - 0.6, 37, axis="y")
        B.stairs(-5, 0, 101, 104, Z, ZM, "+y")
        B.col_wedge(-5, 0, 101, 104, Z, ZM, "y", 1)
        B.slab(-5, 0, 104, 104.6, ZM - 0.5, ZM, "marble")
        prompt(B, "C_WARD", (-5, 0, 103.2, 104.6, ZM - 1.5, ZM + 4), "The Crown admits the crowned. In the ruin, the fallen spire leans against the landing.", state="BOTH")
    with B.at(S, "PAST"):
        B.stairs(-5, 0, 104.6, 108.3, ZM, ZC, "+y")
        B.col_wedge(-5, 0, 104.6, 108.0, ZM, ZC, "y", 1)          # smooth collision line over the steps (47 deg)
        # the Royal Ward: a curtain of gold light across the top of the stair (solid in the Past)
        B.box(-5, 0, 107.9, 108.05, ZC, ZC + 3.4, "fx_crown")
        B.col_box(-5, 0, 107.7, 108.2, ZC - 0.2, ZC + 4)
        light(B, (-2.5, 107.5, ZC + 1.5), "crown", "ffb050", 3.0, 7.0, "PAST")
    with B.at(S, "PRESENT"):
        # the upper flight is gone; the bell-spire fell into the stairwell and leans onto the top landing
        B.rubble_ramp(-3.8, -1.4, 104.6, 108.4, ZM, ZC, "y", 1, mat="timber", seed=51, col=False)
        B.col_wedge(-3.8, -1.4, 104.5, 108.05, ZM, ZC + 0.05, "y", 1)   # walkable line up the spire onto the hall floor (46 deg)
        B.mound(-4.4, 104.3, 0.5, 0.3, 0.4, z0=ZM, seed=52, col=False)
        pit(B, -5, -3.8, 104.6, 108, ZM - 6, "V_STAIRW", "PRESENT")
        pit(B, -1.4, 0, 104.6, 108, ZM - 6, "V_STAIRE", "PRESENT")


def build_hall(B):
    S = "C4_HALL"
    with B.at(S, "SHARED"):
        B.wall(-13, 13, 107, 108, ZC - 0.6, 40, openings=[(-5, 0, ZC - 0.6, ZC + 3.6, "flat")], axis="x")
        B.wall(-13, -12, 108, 124, ZC - 0.6, 40, axis="y")
        B.wall(12, 13, 108, 124, ZC - 0.6, 40, axis="y")
        B.wall(-13, 13, 124, 125, ZC - 0.6, 40, openings=[(-2.5, 2.5, ZC, ZC + 4.5)], axis="x")
        B.slab(-12, 12, 108, 124, ZC - 0.5, ZC, "marble")
        sigil(B, "CP2", (5.0, 110.0, ZC), yaw=0.0)
        fissure(B, "F2", (8.5, 110.5, ZC))
        trace(B, "T2", (-10.8, 110.2, ZC + 1.0), "Twelve crowns for twelve reigns. The thirteenth plinth was left empty for the one who would keep Veyr forever.")
        encounter(B, "E2", "PRESENT", (-12, 12, 108, 124, ZC - 1, ZC + 5))
        enemy(B, "hollow_warden", (-5.0, 119.0, ZC), "E2", "PRESENT", yaw=math.pi)
        enemy(B, "hollow_warden", (5.0, 119.0, ZC), "E2", "PRESENT", yaw=math.pi)
        enemy(B, "hollow", (-3.0, 114.0, ZC), "E2", "PRESENT", yaw=math.pi, rise=True, wave=2)
        enemy(B, "hollow", (3.0, 114.0, ZC), "E2", "PRESENT", yaw=math.pi, rise=True, wave=2)
        enemy(B, "echo_archer", (11.0, 117.0, ZC + 3.0), "E2", "PRESENT", yaw=math.pi / 2, perch=True)
        prompt(B, "C_DOORS", (-3, 3, 121, 124, ZC - 1, ZC + 4), "Crystal has grown through the doors in this memory. In the other, the court is filing in.", state="PRESENT", requires="cleared:E2")
    with B.at(S, "PAST"):
        B.slab(-13, 13, 107, 125, 40, 40.6, "stone_block")
        for i in range(6):
            y = 111 + i * 2.2
            for x in (-7.5, 7.5):
                B.box(x - 0.45, x + 0.45, y - 0.45, y + 0.45, ZC, ZC + 1.2, "marble", col=True)
                B.prism(x, y, ZC + 1.2, ZC + 1.5, 0.28, 8, "fabric_gold")
        for x in (-10, 10):
            B.brazier(x, 122, ZC, lit=True, state="PAST")
        for i in range(4):
            B.marker("imprint", (-3.0 + i * 2.0, 121.0, ZC), yaw=0.0)
        light(B, (0, 116, ZC + 4), "candle", "ffc080", 3.0, 14.0, "PAST")
    with B.at(S, "PRESENT"):
        B.box(-2.5, 2.5, 124.0, 125.0, ZC, ZC + 4.5, "fx_crown", col=True)       # doors fused by crystal
        for i in range(6):
            y = 111 + i * 2.2
            for x, s in ((-7.5, 1), (7.5, -1)):
                B.obox((x + s * 0.7, y, ZC + 0.45), (1.2, 0.9, 0.9), (0, 0.3 * s, 0.4 * s), "marble", col=True)
        B.slab(10, 12, 113, 121, ZC + 2.6, ZC + 3.0, "stone_block")                # east ledge (the archer's perch)
        B.parapet(10, 10.2, 113, 121, ZC + 3.0, h=1.0)
        B.mound(-9, 114, 1.2, 1.4, 0.8, z0=ZC, seed=61, col=False)
        light(B, (0, 123, ZC + 2), "crown", "ff5a22", 3.0, 9.0, "PRESENT")
        light(B, (0, 115, ZC + 7), "moon", "9fb8ff", 2.0, 16.0, "PRESENT")


def sector(r0, r1, a0, a1, cx, cy, z, n=1):
    pts_in = [(cx + r0 * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + r0 * math.sin(math.radians(a0 + (a1 - a0) * k / n)), z) for k in range(n + 1)]
    pts_out = [(cx + r1 * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + r1 * math.sin(math.radians(a0 + (a1 - a0) * k / n)), z) for k in range(n + 1)]
    return pts_out + pts_in[::-1]


def in_wedge(a):
    return any(abs(((a - w + 180) % 360) - 180) < WEDGE_HALF - 0.01 for w in WEDGES)


def build_crown(B):
    S = "C5_CROWN"
    cx, cy = CR_C
    with B.at(S, "SHARED"):
        # threshold from the Crown doors into the ring
        B.slab(-2.5, 2.5, 124, 126.2, ZC - 0.5, ZC, "marble")
        # floor: 24 sectors of 15 deg; the lens r 3, the inner ring r 3..5 and the outer ring r 11..13 exist in both
        # memories; r 5..11 exists in both except inside the four wedges (Past only there)
        B.prism(cx, cy, ZC - 0.5, ZC + 0.02, 3.0, 24, "marble")
        B.prism(cx, cy, ZC + 0.02, ZC + 0.06, 2.6, 24, "fx_sigil", smooth=False)     # the lens
        for i in range(24):
            a0, a1 = i * 15.0, (i + 1) * 15.0
            B.poly(sector(3.0, 5.0, a0, a1, cx, cy, ZC), "marble", col=True)
            B.poly(sector(11.0, CR_R, a0, a1, cx, cy, ZC), "marble", col=True)
            mid = (a0 + a1) / 2
            if not in_wedge(mid):
                B.poly(sector(5.0, 11.0, a0, a1, cx, cy, ZC), "marble", col=True)
        # ring wall (low in both memories) with the door gap to the south
        for i in range(24):
            a = math.radians(i * 15.0 + 7.5)
            if abs(math.degrees(a) - 270) < 12:
                continue
            px, py = cx + (CR_R + 0.6) * math.cos(a), cy + (CR_R + 0.6) * math.sin(a)
            B.obox((px, py, ZC + 1.2), (1.2, 2 * math.pi * (CR_R + 0.6) / 24 + 0.15, 3.4), (0, 0, a), "stone_wall", col=True)
        for i, deg in enumerate(PILLARS):
            a = math.radians(deg)
            B.marker("pillar", (cx + PILLAR_R * math.cos(a), cy + PILLAR_R * math.sin(a), ZC), name="P%d" % (i + 1), r=0.95)
        for i in range(8):
            a = math.radians(i * 45.0 + 22.5)
            B.marker("boss_point", (cx + 9.8 * math.cos(a), cy + 9.8 * math.sin(a), ZC), name="BP%d" % (i + 1))
        for i, deg in enumerate(WEDGES):
            B.marker("wedge", (cx, cy, ZC), name="W%d" % (i + 1), angle=deg, half=WEDGE_HALF, r0=WEDGE_R[0], r1=WEDGE_R[1])
        B.marker("boss_lens", (cx, cy, ZC), name="LENS")
        encounter(B, "BOSS", "BOTH", (-12.5, 12.5, 126.5, 150.5, ZC - 1, ZC + 6), boss=True, surge=True, title="THE LAST CROWN")
        enemy(B, "last_crown", (cx, cy + 1.0, ZC), "BOSS", "BOTH", yaw=math.pi)
        B.volume("exit", -1, 1, 170, 172, 0, 2, name="EXIT")        # unreachable: the ending runs from the boss's death
        prompt(B, "C_CROWN", (-2.5, 2.5, 124, 127, ZC - 1, ZC + 4), "The court kneels to an empty throne. Something wearing the Queen's face waits on the lens.", state="PAST")
        light(B, (cx, cy, ZC + 1), "crown", "ff6a2a", 4.0, 12.0, "BOTH")
    with B.at(S, "PAST"):
        for i in range(24):
            mid = i * 15.0 + 7.5
            if in_wedge(mid):
                B.poly(sector(5.0, 11.0, i * 15.0, (i + 1) * 15.0, cx, cy, ZC), "marble", col=True)
        for deg in PILLARS:
            a = math.radians(deg)
            B.column(cx + PILLAR_R * math.cos(a), cy + PILLAR_R * math.sin(a), ZC, ZC + 11, r=0.95, mat="marble")
        for i in range(24):
            a = math.radians(i * 15.0 + 7.5)
            if abs(math.degrees(a) - 270) < 12:
                continue
            px, py = cx + (CR_R + 0.6) * math.cos(a), cy + (CR_R + 0.6) * math.sin(a)
            B.obox((px, py, ZC + 6.9), (1.2, 2 * math.pi * (CR_R + 0.6) / 24 + 0.15, 8.0), (0, 0, a), "stone_wall", col=True)
        for deg in (60, 120, 240, 300, 20, 160):
            a = math.radians(deg)
            B.brazier(cx + 12.0 * math.cos(a), cy + 12.0 * math.sin(a), ZC, lit=True, state="PAST")
        light(B, (cx, cy, ZC + 9), "candle", "ffc890", 3.5, 20.0, "PAST")
    with B.at(S, "PRESENT"):
        for deg in PILLARS:
            a = math.radians(deg)
            B.column(cx + PILLAR_R * math.cos(a), cy + PILLAR_R * math.sin(a), ZC, ZC + 1.3, r=0.95, mat="marble", capital=False)
            B.mound(cx + (PILLAR_R + 1.2) * math.cos(a), cy + (PILLAR_R + 1.2) * math.sin(a), 0.8, 0.8, 0.5, z0=ZC, seed=int(deg), col=False)
        # the Crownheart's glow in the depths under the wedges (+ the kill volumes below the floor)
        B.box(cx - CR_R, cx + CR_R, cy - CR_R, cy + CR_R, ZC - 9.3, ZC - 9.0, "fx_crown")
        for deg in WEDGES:
            a = math.radians(deg)
            mx, my = cx + 8.0 * math.cos(a), cy + 8.0 * math.sin(a)
            void(B, "V_W%d" % int(deg), (mx - 3.6, mx + 3.6, my - 3.6, my + 3.6, ZC - 9, ZC - 0.8), "PRESENT")
            light(B, (mx, my, ZC - 2), "crown", "ff4a1a", 3.0, 8.0, "PRESENT")
        light(B, (cx, cy, ZC + 10), "moon", "b0a0ff", 2.2, 24.0, "PRESENT")


def build_all(B):
    build_bell(B)
    build_gallery(B)
    build_stair(B)
    build_hall(B)
    build_crown(B)


SECTIONS = {
    "C1_BELL": {"bounds": (17, 27, 89, 101), "neighbors": ["C2_GALLERY"]},
    "C2_GALLERY": {"bounds": (-7, 18, 95, 101), "neighbors": ["C1_BELL", "C3_STAIR"]},
    "C3_STAIR": {"bounds": (-6, 1, 101, 108), "neighbors": ["C2_GALLERY", "C4_HALL"]},
    "C4_HALL": {"bounds": (-13, 13, 107, 125), "neighbors": ["C3_STAIR", "C5_CROWN"]},
    "C5_CROWN": {"bounds": (-15, 15, 124, 152), "neighbors": ["C4_HALL"]},
}

EXPECTED = {"sigils": ["CP1", "CP2"], "fissures": ["F1", "F2"]}
