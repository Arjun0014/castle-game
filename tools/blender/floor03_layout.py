"""Floor 3 — "The Crownheart", the deepest part of Caer Veyr. Mirrors docs/LEVEL_03_BLUEPRINT.md v3.0 (session 9).

The King's lift carries the Uncrowned down the conduit shaft from Floor 2's bell chamber; Floor 3 is the descent
beneath the castle to the Crownheart itself. Same frame as Floors 1-2 (Blender X east, Y north, Z up).

  C1 LIFT FOOT      round chamber at the bottom of the shaft (arrival, CP1)                       z 0
  C2 HALL OF ROOTS  50 m processional hall: Present chasm (Past floor) + Past grille (Present fallen)
  C3 OSSUARY        bridges over a cavern of the bloodline's dead: Past-only bridge, Present-only column
  C4 CISTERN        the blood font; THE MAW OF THE CROWNHEART (mini-boss). Past-sealed entry, Present-
                    fused exit: fight in the ruin, leave through the memory
  C5 GREAT DESCENT  a spiral ramp round the Crownheart shaft, z 0 -> -16: Present collapse (Past ramp),
                    Past iron door (Present burst), three escalating fights, CP3 at the foot
  C6 THE CROWNHEART the Threshold doors, then the arena: a ring platform over the abyss under the heart
                    (the Last Crown). Present wedge holes read as abysses (broken rims, black shafts,
                    a glow far below, rising embers) — never as red ground.

Groups: SHARED / PAST / PRESENT.
"""
import math

from floor01_layout import enemy, encounter, fissure, sigil, trace, prompt, void

Z = 0.0
ZB = -16.0                 # the bottom of the descent: threshold + arena
HR = (-9.0, 9.0, 10.0, 60.0)
CHASM_Y = (29.0, 40.0)     # Hall of Roots: fallen floor in the Present
GRILLE_Y = 51.0            # Hall of Roots: the Royal Grille (Past)
CAV = (-24.0, 24.0, 62.0, 98.0)
P1 = (0.0, 74.0, 4.4)      # ossuary platforms (x, y, r)
P2 = (-11.0, 86.0, 4.2)
P3 = (10.0, 86.0, 4.2)
CIS = (10.0, 113.0, 12.0)  # cistern centre + radius
CIS_PIT = 4.6
SP = (10.0, 146.0)         # the Great Descent: spiral centre
SP_RIN, SP_ROUT = 6.5, 13.0
SP_A0, SP_SWEEP = -90.0, 450.0   # degrees: starts south of the shaft, ends east of it after 1.25 turns
ARENA = (54.0, 148.0)
ARENA_R = 17.0
LENS_R = 4.2
PILLARS = [0.0, 90.0, 180.0, 270.0]
WEDGES = [45.0, 135.0, 225.0, 315.0]
WEDGE_HALF = 20.0
WEDGE_R = (6.0, 13.5)
HEART_Z = ZB + 13.0


# ------------------------------------------------------------------------------------------ helpers
def pit(B, x0, x1, y0, y1, z, vid, state):
    B.box(x0, x1, y0, y1, z - 0.3, z, "fx_void")
    void(B, vid, (x0, x1, y0, y1, z - 2, z + 4), state)


def light(B, pos, kind, color, intensity, rng, state):
    B.marker("light", pos, kind=kind, color=color, intensity=intensity, range=rng, state=state)


def pol(cx, cy, r, deg, z):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a), z)


def sector(cx, cy, r0, r1, a0, a1, z0, z1=None, n=1):
    """A floor sector (top face, normal up); z0 at a0 -> z1 at a1 for ramps."""
    z1 = z0 if z1 is None else z1
    outer = [pol(cx, cy, r1, a0 + (a1 - a0) * k / n, z0 + (z1 - z0) * k / n) for k in range(n + 1)]
    inner = [pol(cx, cy, r0, a0 + (a1 - a0) * k / n, z0 + (z1 - z0) * k / n) for k in range(n + 1)]
    return outer + inner[::-1]


def ring_floor(B, cx, cy, r0, r1, z, mat, segs=24, skip=None, col=True, thick=0.5):
    step = 360.0 / segs
    for i in range(segs):
        a0, a1 = i * step, (i + 1) * step
        if skip and skip((a0 + a1) / 2):
            continue
        B.poly(sector(cx, cy, r0, r1, a0, a1, z), mat, col=col)
        # the rim's thickness (seen from below / across a hole)
        o0, o1 = pol(cx, cy, r1, a0, z), pol(cx, cy, r1, a1, z)
        B.poly([(o0[0], o0[1], z - thick), (o1[0], o1[1], z - thick), (o1[0], o1[1], z), (o0[0], o0[1], z)], "stone_block")


def disc(B, cx, cy, r, z, mat, segs=24, col=True):
    ring_floor(B, cx, cy, 0.001, r, z, mat, segs, col=col)


def ring_wall(B, cx, cy, r, z0, z1, mat="stone_wall", segs=24, gaps=(), thick=1.2, col=True, visual=True):
    """A ring of wall segments; gaps = [(deg, half_width_deg)] left open."""
    step = 360.0 / segs
    for i in range(segs):
        mid = i * step + step / 2
        if any(abs(((mid - g + 180) % 360) - 180) < hw for g, hw in gaps):
            continue
        px, py, _ = pol(cx, cy, r + thick / 2, mid, 0)
        B.obox((px, py, (z0 + z1) / 2), (thick, 2 * math.pi * (r + thick / 2) / segs + 0.12, z1 - z0), (0, 0, math.radians(mid)), mat, col=col, visual=visual)


def in_ang(a, centre, half):
    return abs(((a - centre + 180) % 360) - 180) < half


def shard(B, x, y, z, h, w, lean, yaw, mat="fx_root", col=False):
    """A Crownheart crystal root / shard: a tall leaning oriented box pair."""
    B.obox((x, y, z + h / 2), (w, w * 0.8, h), (lean, 0, yaw), mat, col=col)
    B.obox((x + 0.25, y - 0.2, z + h * 0.3), (w * 0.6, w * 0.5, h * 0.6), (-lean * 0.7, lean * 0.5, yaw + 0.8), mat)


def abyss(B, x0, x1, y0, y1, z_top, depth, vid, state, glow=True):
    """A hole that LOOKS like one: a black shaft (fx_void walls inside the rim, so no floor is ever seen), broken
    rim chunks, a faint glow far below and the kill volume. Never a flat red plane at floor level."""
    zb = z_top - depth
    B.box(x0, x1, y0 - 0.05, y0, zb, z_top - 0.02, "fx_void")
    B.box(x0, x1, y1, y1 + 0.05, zb, z_top - 0.02, "fx_void")
    B.box(x0 - 0.05, x0, y0, y1, zb, z_top - 0.02, "fx_void")
    B.box(x1, x1 + 0.05, y0, y1, zb, z_top - 0.02, "fx_void")
    if glow:
        B.box(x0, x1, y0, y1, zb - 0.3, zb, "fx_ember")
        light(B, ((x0 + x1) / 2, (y0 + y1) / 2, zb + 3), "crown", "ff3a12", 3.0, 10.0, state)
    B.marker("abyss", ((x0 + x1) / 2, (y0 + y1) / 2, z_top), sx=x1 - x0, sy=y1 - y0, state=state)
    void(B, vid, (x0 + 0.25, x1 - 0.25, y0 + 0.25, y1 - 0.25, zb - 30, z_top - 1.2), state)


# ============================================================================== C1 lift foot
def build_lift(B):
    S = "C1_LIFT"
    with B.at(S, "SHARED"):
        B.slab(-8, 8, -8, 8, Z - 0.5, Z, "marble", holes=[(-2.2, 2.2, -1.9, 1.9)])
        ring_wall(B, 0, 0, 7.6, Z - 0.6, 12, gaps=[(90, 18)])
        B.slab(-8.5, 8.5, -8.5, 8.5, 12, 12.8, "stone_block", holes=[(-2.4, 2.4, -2.1, 2.1)])
        # the shaft rising out of sight, and the arrived lift cage filling the pit
        for x0, x1, y0, y1 in ((-2.9, -2.4, -2.1, 2.1), (2.4, 2.9, -2.1, 2.1), (-2.9, 2.9, -2.6, -2.1), (-2.9, 2.9, 2.1, 2.6)):
            B.box(x0, x1, y0, y1, 12.8, 40, "stone_block")
        B.box(-2.2, 2.2, -1.9, 1.9, Z - 0.35, Z, "iron", col=True)
        for sx in (-2.0, 2.0):
            for sy in (-1.7, 1.7):
                B.box(sx - 0.07, sx + 0.07, sy - 0.07, sy + 0.07, Z, Z + 3.2, "iron")
                B.box(sx - 0.03, sx + 0.03, sy - 0.03, sy + 0.03, Z + 3.2, 40, "iron_rust")
        B.box(-2.2, 2.2, -1.9, -1.75, Z + 3.0, Z + 3.2, "iron")
        B.box(-2.2, 2.2, 1.75, 1.9, Z + 3.0, Z + 3.2, "iron")
        # passage north into the Hall of Roots
        B.wall(-4, -2, 7, 10, Z - 0.6, 7, axis="y")
        B.wall(2, 4, 7, 10, Z - 0.6, 7, axis="y")
        B.slab(-2, 2, 7, 10, Z - 0.5, Z, "marble")
        B.slab(-4, 4, 7, 10, 6.5, 7, "stone_block")
        B.marker("spawn", (0.0, -0.4, Z + 0.05), name="SPAWN", yaw=0.0, state="PRESENT")
        B.marker("lift", (0.0, 0.0, Z), name="LIFT_ARRIVE", role="arrive")
        sigil(B, "CP1", (4.6, -2.8, Z), yaw=math.pi / 2)
        fissure(B, "F1", (-4.8, -2.4, Z))
        trace(B, "T1", (-5.4, 2.8, Z + 1.0), "The lift keeper's ledger. Every night of the siege: 'The King went down alone.' The last line is in another hand: 'He did not come back up.'")
        prompt(B, "C_ARRIVE", (-7, 7, -7, 7, Z - 1, Z + 4), "The Crownheart is below. Down here the castle's memories bleed into each other.", state="BOTH")
    with B.at(S, "PAST"):
        B.hprism(4.2, 6.4, -5.2, Z + 1.3, 0.9, 12, "wood_rough", axis="x")          # the lift winch
        B.box(4.0, 4.2, -6.2, -4.2, Z, Z + 2.4, "timber", col=True)
        B.box(6.4, 6.6, -6.2, -4.2, Z, Z + 2.4, "timber", col=True)
        for a in (40, 140, 220, 320):
            x, y, _ = pol(0, 0, 6.6, a, 0)
            B.brazier(x, y, Z, lit=True, state="PAST")
        B.banner(-3.5, -1.5, 7.02, 6.4, 4.5, "-y")
        B.banner(1.5, 3.5, 7.02, 6.4, 4.5, "-y")
        light(B, (0, 0, Z + 5), "candle", "ffb070", 3.0, 12.0, "PAST")
    with B.at(S, "PRESENT"):
        B.mound(5.6, -4.8, 1.2, 1.0, 0.8, z0=Z, seed=301, col=False)
        B.mound(-5.2, 4.9, 1.0, 1.3, 0.7, z0=Z, seed=302, col=False)
        shard(B, -6.2, -4.4, Z, 3.4, 0.5, 0.35, 0.7)
        shard(B, 6.1, 4.2, Z, 2.8, 0.45, -0.3, 2.2)
        light(B, (0, 8, Z + 3), "crown", "ff4a1a", 3.0, 12.0, "PRESENT")
        light(B, (0, 0, Z + 6), "crown", "b04030", 1.4, 10.0, "PRESENT")


# ============================================================================== C2 hall of roots
def build_hall(B):
    S = "C2_HALL"
    x0, x1, y0, y1 = HR
    with B.at(S, "SHARED"):
        B.wall(x0 - 1, x0, y0, y1, Z - 0.6, 11, axis="y")
        B.wall(x1, x1 + 1, y0, y1, Z - 0.6, 11, axis="y")
        B.wall(x0 - 1, x1 + 1, y0 - 1, y0, Z - 0.6, 20.5, openings=[(-2, 2, Z, Z + 5)], axis="x")
        B.wall(x0 - 1, x1 + 1, y1, y1 + 1, Z - 0.6, 20.5, openings=[(-2.5, 2.5, Z, Z + 5.5)], axis="x")
        B.barrel_vault("y", y0, y1, x0, x1, 11, mat="stone_block", segs=14)
        B.slab(x0, x1, y0, CHASM_Y[0], Z - 0.5, Z, "marble")
        B.slab(x0, x1, CHASM_Y[1], y1, Z - 0.5, Z, "marble")
        # colossal pillars (the pair in the chasm span stands only in the Past)
        for y in (14, 21, 44, 51, 57):
            for x in (-6.0, 6.0):
                B.column(x, y, Z, 11, r=0.95, mat="stone_block", sides=12)
        fissure(B, "F2", (5.6, 45.5, Z))
        B.marker("light", (0, 58, Z + 3), kind="crown", color="ff4418", intensity=2.4, range=10.0, state="BOTH")
        encounter(B, "E1", "PRESENT", (x0, x1, 11, CHASM_Y[0], Z - 1, Z + 6))
        encounter(B, "E2", "PAST", (x0, x1, CHASM_Y[1], y1, Z - 1, Z + 6))
        prompt(B, "C_HALL", (-6, 6, 11, 16, Z - 1, Z + 4), "The Hall of Roots. The kings walked down this hall to the heart of the castle.", state="BOTH")
    with B.at(S, "PAST"):
        B.slab(x0, x1, CHASM_Y[0], CHASM_Y[1], Z - 0.5, Z, "marble")
        for y in (29.5, 36.5):
            for x in (-6.0, 6.0):
                B.column(x, y, Z, 11, r=0.95, mat="stone_block", sides=12)
        B.box(-1.6, 1.6, y0, y1, Z, Z + 0.03, "fabric_royal")                     # the processional carpet
        for y in range(15, 58, 7):
            for x in (-7.8, 7.8):
                B.brazier(x, y + 3.5, Z, lit=True, state="PAST")
        for bx in (-7.5, -4.5, 4.5, 7.5):
            B.banner(bx - 1.1, bx + 1.1, y0 + 0.02, 10.5, 5.5, "+y")
            B.banner(bx - 1.1, bx + 1.1, y1 - 0.02, 10.5, 5.5, "-y")
        # the Royal Grille: a portcullis across the whole hall
        B.portcullis(x0, x1, GRILLE_Y, Z, 8, axis="x")
        light(B, (0, 20, Z + 6), "candle", "ffb070", 3.0, 16.0, "PAST")
        light(B, (0, 44, Z + 6), "candle", "ffb070", 3.0, 16.0, "PAST")
        prompt(B, "C_GRILLE", (-8, 8, GRILLE_Y - 4, GRILLE_Y - 0.5, Z - 1, Z + 4), "The Royal Grille holds in this memory. In the ruin it lies in the dust.", state="PAST")
        # E2: the King's last guard at the grille
        enemy(B, "royal_warden", (-3.5, 47, Z), "E2", "PAST", yaw=math.pi)
        enemy(B, "royal_warden", (3.5, 47, Z), "E2", "PAST", yaw=math.pi)
        enemy(B, "guard", (0, 44, Z), "E2", "PAST", yaw=math.pi)
        enemy(B, "archer", (-6.5, 49.5, Z), "E2", "PAST", yaw=math.pi)
        enemy(B, "guard", (-4, 42.5, Z), "E2", "PAST", yaw=math.pi, wave=2)
        enemy(B, "guard", (4, 42.5, Z), "E2", "PAST", yaw=math.pi, wave=2)
    with B.at(S, "PRESENT"):
        # the floor gave way into the dark: a real abyss across the hall
        abyss(B, x0, x1, CHASM_Y[0], CHASM_Y[1], Z, 26, "V_HALL", "PRESENT")
        B.broken_edge(x0, x1, CHASM_Y[0] - 0.4, CHASM_Y[0], Z, 14, seed=311)
        B.broken_edge(x0, x1, CHASM_Y[1], CHASM_Y[1] + 0.4, Z, 14, seed=312)
        for x in (-6.0, 6.0):
            B.column(x, 29.5, Z - 3, Z - 1.5, r=0.95, mat="stone_block", sides=12, capital=False, col=False)
        B.fallen_grille((0, GRILLE_Y + 1.8, Z + 0.06), (17, 3.4), (0, 0, 0.04))
        # the Crownheart's roots: crystal breaking up through the floor and arching over the hall
        for x, y, h, lean, yaw in ((-7.2, 13, 5.5, 0.45, 0.3), (7.4, 19, 6.5, -0.4, 2.8), (-7.6, 25, 4.2, 0.5, 0.9),
                                   (7.2, 45, 5.0, -0.5, 3.1), (-7.0, 55, 6.0, 0.4, 0.2), (6.5, 57, 3.5, -0.3, 2.0)):
            shard(B, x, y, Z, h, 0.6, lean, yaw)
        for y in (26.5, 42.5):
            B.obox((0, y, Z + 9.5), (17, 0.5, 0.45), (0, 0.06, 0), "fx_root")           # roots spanning the vault
        # the chasm lights its own rims from below
        for x, y in ((-5, CHASM_Y[0] + 0.5), (5, CHASM_Y[0] + 0.5), (-5, CHASM_Y[1] - 0.5), (5, CHASM_Y[1] - 0.5)):
            light(B, (x, y, Z - 2.5), "crown", "ff3a12", 3.5, 9.0, "PRESENT")
        B.mound(-6.8, 17, 1.4, 1.0, 0.8, z0=Z, seed=313)
        B.mound(6.6, 54, 1.1, 1.6, 0.9, z0=Z, seed=314)
        prompt(B, "C_GAP", (-8, 8, CHASM_Y[0] - 4, CHASM_Y[0] - 0.5, Z - 1, Z + 4), "The floor fell away in this memory. It stood in the other.", state="PRESENT")
        light(B, (0, 20, Z + 5), "crown", "ff4a1a", 2.4, 14.0, "PRESENT")
        light(B, (0, 48, Z + 5), "crown", "ff4a1a", 2.4, 14.0, "PRESENT")
        # E1: the ruin's scavengers — goblins and bats, a Widow in the vault
        enemy(B, "goblin", (-3.5, 22, Z), "E1", "PRESENT", yaw=math.pi)
        enemy(B, "goblin", (3.5, 24, Z), "E1", "PRESENT", yaw=math.pi)
        enemy(B, "goblin", (0, 26.5, Z), "E1", "PRESENT", yaw=math.pi)
        enemy(B, "bat", (-4, 18, Z + 3.5), "E1", "PRESENT")
        enemy(B, "bat", (4, 21, Z + 3.8), "E1", "PRESENT")
        enemy(B, "widow", (0, 19, Z), "E1", "PRESENT", yaw=math.pi, rise=True, ceiling=True, wave=2)
        enemy(B, "goblin", (-5, 27, Z), "E1", "PRESENT", yaw=math.pi, rise=True, wave=2)


# ============================================================================== C3 ossuary bridges
def build_ossuary(B):
    S = "C3_OSSUARY"
    cx0, cx1, cy0, cy1 = CAV
    with B.at(S, "SHARED"):
        # the cavern: rock walls far out, a low rock ceiling, the drop into the dark
        B.wall(cx0 - 2, cx0, cy0, cy1, -30, 18, mat="rock", axis="y")
        B.wall(cx1, cx1 + 2, cy0, cy1, -30, 18, mat="rock", axis="y")
        B.wall(cx0 - 2, cx1 + 2, cy1, cy1 + 2, -30, 18, mat="rock", openings=[(8.5, 11.5, Z, Z + 4.4)], axis="x")
        B.wall(cx0 - 2, cx1 + 2, cy0 - 1, cy0, -30, 18, mat="rock", openings=[(-2.5, 2.5, Z, Z + 5.5)], axis="x")
        B.slab(cx0 - 2, cx1 + 2, cy0 - 1, cy1 + 2, 18, 19, "rock")
        B.box(cx0, cx1, cy0, cy1, -30.3, -30, "fx_ember")
        light(B, (0, 80, -22), "crown", "ff3010", 4.0, 26.0, "BOTH")
        void(B, "V_CAV", (cx0, cx1, cy0, cy1, -60, -4), "BOTH")
        B.marker("abyss", ((cx0 + cx1) / 2, (cy0 + cy1) / 2, Z), sx=cx1 - cx0, sy=cy1 - cy0, state="BOTH")
        # ossuary niches: the bloodline's dead stacked in the cavern walls
        for y in range(66, 96, 5):
            for x, face in ((cx0 + 0.02, 1), (cx1 - 0.02, -1)):
                B.box(x - (0.9 if face < 0 else 0), x + (0.9 if face > 0 else 0), y - 1.2, y + 1.2, 2, 3.4, "fx_void")
                B.bones(x + face * 0.5, y, 2.05, n=6, r=0.5, seed=y + int(x))
        # B1 bridge -> P1; P2; P3; B4 -> the cistern
        B.slab(-1.5, 1.5, cy0 - 1, P1[1] - P1[2] + 0.4, Z - 0.8, Z, "stone_block")
        for (px, py, r) in (P1, P2, P3):
            disc(B, px, py, r, Z, "stone_block", segs=20)
            B.prism(px, py, -14, Z - 0.8, r * 0.55, 10, "rock")                     # the rock pillar under it
        B.slab(P3[0] - 1.5, P3[0] + 1.5, P3[1] + P3[2] - 0.4, cy1 + 2, Z - 0.8, Z, "stone_block")
        sigil(B, "CP2", (P3[0] + 1.6, P3[1] - 1.8, Z), yaw=0.0)
        fissure(B, "F3", (P2[0] - 1.8, P2[1] + 1.2, Z))
        encounter(B, "E3", "PRESENT", (P1[0] - 6, P1[0] + 6, P1[1] - 7, P1[1] + 6, Z - 1, Z + 6))
        encounter(B, "E4", "PAST", (P2[0] - 5.5, P2[0] + 5.5, P2[1] - 5.5, P2[1] + 5.5, Z - 1, Z + 6))
        prompt(B, "C_OSS", (-1.5, 1.5, 62, 68, Z - 1, Z + 4), "The ossuary of the royal line. Every king who kept the heart is buried here.", state="BOTH")
    with B.at(S, "PAST"):
        # B2: P1 -> P2, a bridge with low walls (safe in the living castle)
        a = (P1[0] - 2.8, P1[1] + 2.4); b = (P2[0] + 2.6, P2[1] - 2.2)
        ang = math.atan2(b[1] - a[1], b[0] - a[0]); L = math.hypot(b[0] - a[0], b[1] - a[1])
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        B.obox((mid[0], mid[1], Z - 0.4), (L + 1.2, 3.0, 0.8), (0, 0, ang), "stone_block", col=True)
        for side in (-1, 1):
            ox, oy = -math.sin(ang) * 1.6 * side, math.cos(ang) * 1.6 * side
            B.obox((mid[0] + ox, mid[1] + oy, Z + 0.35), (L, 0.25, 0.7), (0, 0, ang), "stone_wall", col=True)
        for (px, py, r) in (P1, P2, P3):
            for k in range(6):
                x, y, _ = pol(px, py, r - 0.3, k * 60 + 30, 0)
                B.candles(x, y, Z, n=3, state="PAST")
        light(B, (P1[0], P1[1], Z + 3), "candle", "ffb070", 2.5, 9.0, "PAST")
        light(B, (P2[0], P2[1], Z + 3), "candle", "ffb070", 2.5, 9.0, "PAST")
        light(B, (P3[0], P3[1], Z + 3), "candle", "ffb070", 2.5, 9.0, "PAST")
        # E4: the King's guard keeps the west platform
        enemy(B, "royal_warden", (P2[0] + 0.5, P2[1] + 1.0, Z), "E4", "PAST", yaw=-math.pi / 3)
        enemy(B, "guard", (P2[0] - 1.8, P2[1] - 1.2, Z), "E4", "PAST", yaw=-math.pi / 3)
        enemy(B, "guard", (P2[0] + 1.5, P2[1] - 2.2, Z), "E4", "PAST", yaw=-math.pi / 3)
        prompt(B, "C_B2", (P1[0] - 4, P1[0] + 1, P1[1] + 1, P1[1] + 5, Z - 1, Z + 4), "In this memory a bridge runs west.", state="PAST")
    with B.at(S, "PRESENT"):
        # B2 collapsed: two broken stubs over the drop
        B.obox((P1[0] - 3.4, P1[1] + 2.9, Z - 0.4), (2.0, 3.0, 0.8), (0, 0.1, math.radians(140)), "stone_block", col=True)
        B.obox((P2[0] + 3.3, P2[1] - 2.8, Z - 0.5), (1.8, 3.0, 0.8), (0, -0.12, math.radians(140)), "stone_block", col=True)
        # B3: a colossal column fell across from P2 to P3 — the ruin's only way east
        B.hprism(P2[0] + 3.6, P3[0] - 3.6, P2[1], Z - 0.9, 1.05, 14, "marble", axis="x")
        B.col_box(P2[0] + 3.4, P3[0] - 3.4, P2[1] - 0.95, P2[1] + 0.95, Z - 1.5, Z + 0.1)
        B.column(P2[0] - 2.8, P2[1] + 2.6, Z, Z + 2.2, r=1.05, mat="marble", sides=14, capital=False)   # its broken base
        for (px, py, r) in (P1, P2, P3):
            B.broken_edge(px - r * 0.7, px + r * 0.7, py - r - 0.2, py - r + 0.2, Z, 6, seed=int(px * 7 + py))
        shard(B, P1[0] + 3.2, P1[1] - 2.4, Z, 2.4, 0.4, -0.4, 1.0)
        prompt(B, "C_B3", (P2[0] - 3, P2[0] + 3, P2[1] - 3, P2[1] + 3, Z - 1, Z + 4), "A fallen column bridges the dark to the east — in this memory.", state="PRESENT")
        light(B, (P1[0], P1[1], Z + 4), "crown", "ff4a1a", 3.0, 12.0, "PRESENT")
        light(B, (P2[0], P2[1], Z + 4), "crown", "ff4a1a", 2.6, 11.0, "PRESENT")
        light(B, (P3[0], P3[1], Z + 4), "crown", "ff4a1a", 3.0, 12.0, "PRESENT")
        light(B, (0, 66, Z - 1.5), "crown", "ff3a12", 3.0, 10.0, "PRESENT")
        # E3: the Widow's bridge — it drops from the dark, bats circle, the brood follows
        enemy(B, "widow", (P1[0] + 1.0, P1[1] + 1.2, Z), "E3", "PRESENT", yaw=math.pi, rise=True, ceiling=True)
        enemy(B, "bat", (P1[0] - 2.5, P1[1] + 2.0, Z + 3.4), "E3", "PRESENT")
        enemy(B, "bat", (P1[0] + 2.5, P1[1] - 1.5, Z + 3.6), "E3", "PRESENT")
        enemy(B, "widowling", (P1[0] - 1.5, P1[1] + 2.5, Z), "E3", "PRESENT", yaw=math.pi, rise=True, wave=2)
        enemy(B, "widowling", (P1[0] + 2.2, P1[1] + 1.8, Z), "E3", "PRESENT", yaw=math.pi, rise=True, wave=2)


# ============================================================================== C4 the cistern
def build_cistern(B):
    S = "C4_CISTERN"
    cx, cy, r = CIS
    with B.at(S, "SHARED"):
        ring_floor(B, cx, cy, CIS_PIT, r, Z, "marble", segs=28)
        ring_wall(B, cx, cy, r, Z - 0.6, 10, gaps=[(270, 8), (90, 8)], segs=28)
        # a dome of stone rings stepping in
        for k, (rr, zz) in enumerate(((r - 0.5, 10), (r - 2.5, 12.5), (r - 5.5, 14.5))):
            ring_wall(B, cx, cy, rr, zz, zz + 1.2, mat="stone_block", segs=28, thick=2.2 + k, col=False)
        B.slab(cx - 5, cx + 5, cy - 5, cy + 5, 15.5, 16.2, "stone_block")
        # the font's rim: a waist-high ring round the basin (the fight turns round it; nobody falls in)
        for i in range(24):
            mid = i * 15 + 7.5
            px, py, _ = pol(cx, cy, CIS_PIT + 0.3, mid, 0)
            B.obox((px, py, Z + 0.45), (0.6, 2 * math.pi * (CIS_PIT + 0.3) / 24 + 0.1, 0.9), (0, 0, math.radians(mid)), "stone_wall", col=True)
        # doors: south (from the bridges), north (to the descent)
        B.slab(cx - 1.5, cx + 1.5, cy - r - 1.4, cy - r + 0.2, Z - 0.5, Z, "marble")
        B.slab(cx - 1.5, cx + 1.5, cy + r - 0.2, cy + r + 1.8, Z - 0.5, Z, "marble")
        encounter(B, "E5", "PRESENT", (cx - r, cx + r, cy - r, cy + r, Z - 1, Z + 6), boss=True, surge=True, title="THE MAW OF THE CROWNHEART")
        prompt(B, "C_DOORS", (cx - 2, cx + 2, cy + r - 3, cy + r - 0.5, Z - 1, Z + 4), "Crystal has fused the far door in this memory. In the other it stands open.", state="PRESENT", requires="cleared:E5")
    with B.at(S, "PAST"):
        # the blood font: the basin brimming, candles round the rim
        disc(B, cx, cy, CIS_PIT, Z - 0.35, "fx_blood", segs=24, col=True)
        for i in range(12):
            x, y, _ = pol(cx, cy, CIS_PIT + 0.9, i * 30, 0)
            B.candles(x, y, Z, n=3, state="PAST")
        # the south door is warded: the Crown admits the crowned (Past); the ruin's door hangs open
        B.box(cx - 1.5, cx + 1.5, cy - r - 0.35, cy - r - 0.2, Z, Z + 4.2, "fx_crown")
        B.col_box(cx - 1.5, cx + 1.5, cy - r - 0.6, cy - r, Z - 0.2, Z + 4.4)
        light(B, (cx, cy, Z + 4), "candle", "ffb070", 3.0, 14.0, "PAST")
        trace(B, "T3", (cx + 5.5, cy - 5.5, Z + 1.0), "The blood font. Each heir of Vaelor was bled into it once, and the heart learned their name.")
    with B.at(S, "PRESENT"):
        abyss(B, cx - CIS_PIT * 0.72, cx + CIS_PIT * 0.72, cy - CIS_PIT * 0.72, cy + CIS_PIT * 0.72, Z, 20, "V_FONT", "PRESENT")
        disc(B, cx, cy, CIS_PIT, Z - 20, "fx_void", segs=16, col=False)
        # the far door fused by crystal
        B.box(cx - 1.6, cx + 1.6, cy + r + 0.1, cy + r + 0.8, Z, Z + 4.4, "fx_crown", col=True)
        for a in (30, 150, 210, 330):
            x, y, _ = pol(cx, cy, r - 1.2, a, 0)
            shard(B, x, y, Z, 3.2, 0.5, 0.35, math.radians(a))
        light(B, (cx, cy, Z + 3), "crown", "ff4a1a", 3.0, 14.0, "PRESENT")
        # E5: THE MAW — its belly looses gloom bats at 65 %; goblins drop from the dome at 35 %
        enemy(B, "lamia_maw", (cx, cy + 7.5, Z), "E5", "PRESENT", yaw=math.pi)
        enemy(B, "bat", (cx - 2, cy + 7, Z + 2.5), "E5", "PRESENT", rise=True, wave=2)
        enemy(B, "bat", (cx + 2, cy + 7, Z + 2.5), "E5", "PRESENT", rise=True, wave=2)
        enemy(B, "bat", (cx, cy + 6, Z + 2.8), "E5", "PRESENT", rise=True, wave=2)
        enemy(B, "goblin", (cx - 7, cy + 2, Z), "E5", "PRESENT", yaw=0.0, rise=True, wave=3)
        enemy(B, "goblin", (cx + 7, cy + 2, Z), "E5", "PRESENT", yaw=math.pi, rise=True, wave=3)


# ============================================================================== C5 the great descent
def ramp_z(deg):
    t = (deg - SP_A0) / SP_SWEEP
    return Z + (ZB - Z) * max(0.0, min(1.0, t))


SP_GAP = (40.0, 62.0)      # Present collapse (angles, degrees)
SP_DOOR = 222.0            # Past iron door across the ramp


def build_descent(B):
    S = "C5_DESCENT"
    cx, cy = SP
    seg = 15.0
    with B.at(S, "SHARED"):
        # landing between the cistern and the ramp's head
        B.slab(cx - 3, cx + 3, CIS[1] + CIS[2] + 1.8, cy - SP_ROUT + 0.5, Z - 0.5, Z, "marble")
        B.wall(cx - 4, cx - 3, CIS[1] + CIS[2] + 1.8, cy - SP_ROUT + 1, Z - 0.6, 7, axis="y")
        B.wall(cx + 3, cx + 4, CIS[1] + CIS[2] + 1.8, cy - SP_ROUT + 1, Z - 0.6, 7, axis="y")
        a = SP_A0
        while a < SP_A0 + SP_SWEEP - 1e-6:
            a1 = a + seg
            mid = (a + a1) / 2
            z0, z1 = ramp_z(a), ramp_z(a1)
            gap = SP_GAP[0] <= mid <= SP_GAP[1]
            grp = "PAST" if gap else "SHARED"
            with B.at(S, grp):
                B.poly(sector(cx, cy, SP_RIN, SP_ROUT, a, a1, z0, z1), "stone_block", col=True)
                # underside and the inner lip
                i0, i1 = pol(cx, cy, SP_RIN, a, z0), pol(cx, cy, SP_RIN, a1, z1)
                B.poly([(i1[0], i1[1], z1 - 0.9), (i0[0], i0[1], z0 - 0.9), (i0[0], i0[1], z0), (i1[0], i1[1], z1)], "stone_block")
                B.poly([p for p in reversed(sector(cx, cy, SP_RIN, SP_ROUT, a, a1, z0 - 0.9, z1 - 0.9))], "stone_block")
            # the outer wall climbs with the ramp (both memories; open at the head and the foot), the inner parapet
            # only in the living castle
            m = pol(cx, cy, SP_ROUT + 0.6, mid, 0)
            zm = (z0 + z1) / 2
            if not (mid < SP_A0 + 16 or mid > SP_A0 + SP_SWEEP - 16):
                B.obox((m[0], m[1], zm + 3.2), (1.2, 2 * math.pi * (SP_ROUT + 0.6) * seg / 360 + 0.15, 8.8), (0, 0, math.radians(mid)), "stone_wall", col=True)
            if not gap:
                pi = pol(cx, cy, SP_RIN + 0.18, mid, 0)
                with B.at(S, "PAST"):
                    B.obox((pi[0], pi[1], zm + 0.5), (0.36, 2 * math.pi * SP_RIN * seg / 360 + 0.08, 1.0), (0, math.radians(0), math.radians(mid)), "stone_wall")
                    B.obox((pi[0], pi[1], zm + 0.95), (0.4, 2 * math.pi * SP_RIN * seg / 360 + 0.08, 1.9), (0, 0, math.radians(mid)), "stone_wall", col=True, visual=False)
                with B.at(S, "PRESENT"):
                    if int(mid) % 45 < 30:
                        B.obox((pi[0], pi[1], zm + 0.3), (0.36, 2 * math.pi * SP_RIN * seg / 360 * 0.6, 0.6), (0, 0, math.radians(mid)), "stone_wall")
                    B.obox((pi[0], pi[1], zm + 0.95), (0.4, 2 * math.pi * SP_RIN * seg / 360 + 0.08, 1.9), (0, 0, math.radians(mid)), "stone_wall", col=True, visual=False)
            a = a1
        # the foot of the ramp: a flat landing turning east to the threshold
        end = SP_A0 + SP_SWEEP
        B.poly(sector(cx, cy, SP_RIN, SP_ROUT, end, end + 24, ZB, n=2), "stone_block", col=True)
        B.poly([p for p in reversed(sector(cx, cy, SP_RIN, SP_ROUT, end, end + 24, ZB - 0.9, n=2))], "stone_block")
        for d in (end + 6, end + 18):
            pi = pol(cx, cy, SP_RIN + 0.18, d, 0)
            B.obox((pi[0], pi[1], ZB + 0.95), (0.4, 2 * math.pi * SP_RIN * 12 / 360 + 0.08, 1.9), (0, 0, math.radians(d)), "stone_wall", col=True)
        pw = pol(cx, cy, SP_ROUT + 0.6, end + 30, 0)
        B.obox((pw[0], pw[1], ZB + 4), (1.2, 4.5, 9), (0, 0, math.radians(end + 30)), "stone_wall", col=True)
        # the shaft: the Crownheart glows far below; its roots climb the walls
        B.box(cx - SP_RIN, cx + SP_RIN, cy - SP_RIN, cy + SP_RIN, -60.3, -60, "fx_ember")
        light(B, (cx, cy, -40), "crown", "ff3010", 6.0, 40.0, "BOTH")
        void(B, "V_SHAFT", (cx - SP_RIN + 0.3, cx + SP_RIN - 0.3, cy - SP_RIN + 0.3, cy + SP_RIN - 0.3, -90, ZB - 5), "BOTH")
        B.marker("abyss", (cx, cy, Z), sx=SP_RIN * 1.6, sy=SP_RIN * 1.6, state="BOTH", deep=1)
        for k, (deg, h) in enumerate(((0, -6), (120, -10), (240, -3))):
            p0 = pol(cx, cy, SP_RIN - 0.2, deg, 0)
            B.obox((p0[0], p0[1], h), (0.6, 0.6, 18), (0.35 * (1 if k % 2 else -1), 0.2, math.radians(deg)), "fx_root")
        # waypoints of the spiral (objectives / hints)
        for i, deg in enumerate((0, 90, 180, 270, 360)):
            p = pol(cx, cy, (SP_RIN + SP_ROUT) / 2, deg, ramp_z(deg))
            B.marker("ramp_pt", p, name="RP%d" % i)
        fissure(B, "F4", pol(cx, cy, 10.5, 150, ramp_z(150)))
        fissure(B, "F5", pol(cx, cy, 10.5, 318, ramp_z(318)))
        # encounters along the ramp: boxes round each stretch (height follows the ramp)
        def enc_arc(eid, state, a0, a1, **kw):
            pts = [pol(cx, cy, r, d, 0) for r in (SP_RIN, SP_ROUT) for d in (a0, (a0 + a1) / 2, a1)]
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            encounter(B, eid, state, (min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1, min(ramp_z(a0), ramp_z(a1)) - 1.5, max(ramp_z(a0), ramp_z(a1)) + 5), **kw)
        enc_arc("E6", "PRESENT", -60, 30)
        enc_arc("E7", "PAST", 110, 200)
        enc_arc("E8", "PRESENT", 250, 345)
        prompt(B, "C_DESC", (cx - 3, cx + 3, cy - SP_ROUT - 1, cy - SP_ROUT + 3, Z - 1, Z + 4), "The Great Descent winds down round the heart's own shaft.", state="BOTH")
    # the Present collapse: a gap in the ramp, rims broken, the shaft below
    with B.at(S, "PRESENT"):
        g0, g1 = SP_GAP
        for d in (g0, g1):
            p = pol(cx, cy, (SP_RIN + SP_ROUT) / 2, d, ramp_z(d))
            B.obox((p[0], p[1], ramp_z(d) - 0.25), (1.2, 6.4, 0.5), (0.2, 0.3, math.radians(d)), "rock")
        gm = pol(cx, cy, (SP_RIN + SP_ROUT) / 2, (g0 + g1) / 2, 0)
        void(B, "V_RAMPGAP", (gm[0] - 3.2, gm[0] + 3.2, gm[1] - 3.2, gm[1] + 3.2, ramp_z(g1) - 30, ramp_z(g0) - 1.5), "PRESENT")
        B.marker("abyss", (gm[0], gm[1], ramp_z((g0 + g1) / 2)), sx=6, sy=6, state="PRESENT")
        prompt(B, "C_RGAP", (cx + 8, cx + 14, cy - 6, cy + 2, ramp_z(35) - 1, ramp_z(35) + 4), "The ramp has fallen into the shaft here — only in this memory.", state="PRESENT")
        light(B, (cx + 11, cy + 6, ramp_z(50) - 4), "crown", "ff3a12", 2.5, 10.0, "PRESENT")
    # the Past iron door: the King's last gate, broken open in the ruin
    with B.at(S, "PAST"):
        d0 = pol(cx, cy, SP_RIN, SP_DOOR, 0); d1 = pol(cx, cy, SP_ROUT, SP_DOOR, 0)
        mid = ((d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2)
        zd = ramp_z(SP_DOOR)
        # the door spans the ramp radially (box X = inner rim -> outer wall): rotated by the door's own angle. Session 10:
        # it was rotated by +90 deg, lying ALONG the ramp — the Past could walk straight past the King's last gate
        B.obox((mid[0], mid[1], zd + 2.4), (SP_ROUT - SP_RIN + 0.4, 0.5, 4.8), (0, 0, math.radians(SP_DOOR)), "iron", col=True)
        B.obox((mid[0], mid[1], zd + 4.9), (SP_ROUT - SP_RIN + 0.6, 0.8, 0.4), (0, 0, math.radians(SP_DOOR)), "stone_block")
        prompt(B, "C_RDOOR", (mid[0] - 4, mid[0] + 4, mid[1] - 4, mid[1] + 4, zd - 1, zd + 4), "The King's last gate is shut in this memory. In the ruin it was torn open.", state="PAST")
        for deg in range(-60, 360, 60):
            p = pol(cx, cy, SP_ROUT - 0.6, deg, ramp_z(deg))
            B.marker("light", (p[0], p[1], ramp_z(deg) + 2.5), kind="torch", color="ffb070", intensity=3.5, range=8.0, state="PAST")
        light(B, (cx, cy, -8), "candle", "ffb070", 3.0, 18.0, "PAST")
    with B.at(S, "PRESENT"):
        d0 = pol(cx, cy, SP_RIN + 1.2, SP_DOOR, 0)
        zd = ramp_z(SP_DOOR)
        B.obox((d0[0], d0[1], zd + 0.15), (2.2, 3.4, 0.3), (0.1, 0.05, math.radians(SP_DOOR + 20)), "rust", col=True)
        for deg in (0, 120, 250, 330):
            p = pol(cx, cy, SP_ROUT - 0.8, deg, ramp_z(deg))
            light(B, (p[0], p[1], ramp_z(deg) + 3), "crown", "ff4a1a", 1.8, 9.0, "PRESENT")
    # --- the fights of the descent
    with B.at(S, "PRESENT"):
        for i, deg in enumerate((-45, -20, 5)):
            enemy(B, "goblin", pol(cx, cy, 9.6 + (i % 2), deg, ramp_z(deg)), "E6", "PRESENT", yaw=math.radians(deg + 180))
        enemy(B, "bat", pol(cx, cy, 9.5, -10, ramp_z(-10) + 3), "E6", "PRESENT")
        enemy(B, "bat", pol(cx, cy, 10.5, 15, ramp_z(15) + 3), "E6", "PRESENT")
        enemy(B, "goblin", pol(cx, cy, 10, 20, ramp_z(20)), "E6", "PRESENT", yaw=math.radians(200), rise=True, wave=2)
        enemy(B, "goblin", pol(cx, cy, 10, -30, ramp_z(-30)), "E6", "PRESENT", yaw=math.radians(150), rise=True, wave=2)
        # E8: the deepest fight — a lamia, Widows from the dark, the Crownheart's Remnants
        enemy(B, "lamia", pol(cx, cy, 9.8, 300, ramp_z(300)), "E8", "PRESENT", yaw=math.radians(120))
        enemy(B, "widow", pol(cx, cy, 10, 275, ramp_z(275)), "E8", "PRESENT", yaw=math.radians(95), rise=True, ceiling=True)
        enemy(B, "goblin", pol(cx, cy, 10.5, 325, ramp_z(325)), "E8", "PRESENT", yaw=math.radians(150))
        enemy(B, "widow", pol(cx, cy, 10, 330, ramp_z(330)), "E8", "PRESENT", yaw=math.radians(150), rise=True, ceiling=True, wave=2)
        enemy(B, "remnant", pol(cx, cy, 9.5, 285, ramp_z(285)), "E8", "PRESENT", yaw=math.radians(105), rise=True, wave=2)
        enemy(B, "remnant", pol(cx, cy, 10.5, 310, ramp_z(310)), "E8", "PRESENT", yaw=math.radians(130), rise=True, wave=2)
    with B.at(S, "PAST"):
        # E7: the Kingsguard's last post on the stair
        enemy(B, "royal_warden", pol(cx, cy, 9.8, 160, ramp_z(160)), "E7", "PAST", yaw=math.radians(340))
        enemy(B, "royal_warden", pol(cx, cy, 10.2, 185, ramp_z(185)), "E7", "PAST", yaw=math.radians(5))
        enemy(B, "guard", pol(cx, cy, 9.5, 140, ramp_z(140)), "E7", "PAST", yaw=math.radians(320))
        enemy(B, "guard", pol(cx, cy, 11, 170, ramp_z(170)), "E7", "PAST", yaw=math.radians(350))
        enemy(B, "archer", pol(cx, cy, 11.6, 200, ramp_z(200)), "E7", "PAST", yaw=math.radians(20))
        enemy(B, "muster", pol(cx, cy, 10, 150, ramp_z(150)), "E7", "PAST", yaw=math.radians(330), wave=2)
        enemy(B, "muster", pol(cx, cy, 10, 195, ramp_z(195)), "E7", "PAST", yaw=math.radians(15), wave=2)


# ============================================================================== C6 threshold + the Crownheart
def build_crownheart(B):
    S = "C6_HEART"
    ax, ay = ARENA
    tx0 = SP[0] + SP_ROUT - 1.0            # out of the ramp's foot landing
    tdoor = tx0 + 5.5                      # the Crown doors, where the threshold opens onto the cavern
    tx1 = ax - ARENA_R + 0.3               # the bridge meets the ring
    with B.at(S, "SHARED"):
        # the threshold: a short passage cut through the rock
        B.slab(tx0, tdoor, ay - 3.2, ay + 3.2, ZB - 0.5, ZB, "marble")
        B.wall(tx0, tdoor, ay - 4.2, ay - 3.2, ZB - 0.6, ZB + 7, axis="x")
        B.wall(tx0, tdoor, ay + 3.2, ay + 4.2, ZB - 0.6, ZB + 7, axis="x")
        B.slab(tx0, tdoor, ay - 4.2, ay + 4.2, ZB + 7, ZB + 7.6, "stone_block")
        B.box(tdoor - 0.4, tdoor, ay - 4.2, ay - 3.0, ZB, ZB + 7, "stone_block", col=True)
        B.box(tdoor - 0.4, tdoor, ay + 3.0, ay + 4.2, ZB, ZB + 7, "stone_block", col=True)
        B.box(tdoor - 0.4, tdoor, ay - 4.2, ay + 4.2, ZB + 5.8, ZB + 7, "stone_block")
        sigil(B, "CP3", (tx0 + 2.0, ay - 2.2, ZB), yaw=0.0)
        trace(B, "T2", (tx0 + 3.8, ay + 2.4, ZB + 1.0), "A throne carved for the heart's chamber, never sat in. Scratched into the arm: 'For the one who keeps Veyr forever.'")
        B.box(tx0 + 3.2, tx0 + 4.4, ay + 2.2, ay + 3.1, ZB, ZB + 2.4, "marble", col=True)      # the empty throne
        # the bridge over the abyss to the ring: parapets both sides
        B.slab(tdoor, tx1 + 0.8, ay - 3.0, ay + 3.0, ZB - 0.9, ZB, "stone_block")
        for sy in (-1, 1):
            B.box(tdoor, tx1 + 0.3, ay + sy * 3.0 - 0.25, ay + sy * 3.0 + 0.25, ZB, ZB + 0.9, "stone_wall")
            B.col_box(tdoor, tx1 + 0.3, ay + sy * 3.0 - 0.25, ay + sy * 3.0 + 0.25, ZB, ZB + 1.9)
        # the arena: lens dais, the ring, the parapet round the edge (the abyss beyond), the four pillars' bases
        ring_floor(B, ax, ay, 0.001, LENS_R, ZB, "marble", segs=24)
        B.prism(ax, ay, ZB + 0.02, ZB + 0.06, LENS_R - 0.4, 24, "fx_sigil", smooth=False)
        ring_floor(B, ax, ay, LENS_R, WEDGE_R[0], ZB, "marble", segs=32)
        ring_floor(B, ax, ay, WEDGE_R[1], ARENA_R, ZB, "marble", segs=40)
        ring_floor(B, ax, ay, WEDGE_R[0], WEDGE_R[1], ZB, "marble", segs=40, skip=lambda a: any(in_ang(a, w, WEDGE_HALF) for w in WEDGES))
        for i in range(40):
            mid = i * 9 + 4.5
            if in_ang(mid, 180, 7):
                continue
            px, py, _ = pol(ax, ay, ARENA_R + 0.3, mid, 0)
            B.obox((px, py, ZB + 0.95), (0.6, 2 * math.pi * (ARENA_R + 0.3) / 40 + 0.1, 1.9), (0, 0, math.radians(mid)), "stone_wall", col=True, visual=False)
        for deg in PILLARS:
            x, y, _ = pol(ax, ay, 11.0, deg, 0)
            B.column(x, y, ZB, ZB + 1.3, r=1.0, mat="marble", sides=14, capital=False)
            B.marker("pillar", (x, y, ZB), name="P%d" % int(deg), r=1.0)
        for i in range(8):
            B.marker("boss_point", pol(ax, ay, 12.5, i * 45.0 + 22.5 if i % 2 else i * 45.0, ZB), name="BP%d" % (i + 1))
        for i, deg in enumerate(WEDGES):
            B.marker("wedge", (ax, ay, ZB), name="W%d" % (i + 1), angle=deg, half=WEDGE_HALF, r0=WEDGE_R[0], r1=WEDGE_R[1])
        B.marker("boss_lens", (ax, ay, ZB), name="LENS", r=ARENA_R - 2.5)
        B.marker("heart", (ax, ay, HEART_Z), name="HEART")
        # the cavern: a vast rock ring far out, the drop all round the platform, a rock dome
        ring_wall(B, ax, ay, 30, -70, 26, mat="rock", segs=24, thick=3, gaps=[(180, 9)])
        B.slab(ax - 33, ax + 33, ay - 33, ay + 33, 26, 27, "rock")
        B.box(ax - 30, ax + 30, ay - 30, ay + 30, -70.3, -70, "fx_ember")
        for vx0, vx1, vy0, vy1 in ((ax - 31, ax - ARENA_R - 0.4, ay - 31, ay + 31), (ax + ARENA_R + 0.4, ax + 31, ay - 31, ay + 31),
                                   (ax - ARENA_R - 0.4, ax + ARENA_R + 0.4, ay + ARENA_R + 0.4, ay + 31), (ax - ARENA_R - 0.4, ax + ARENA_R + 0.4, ay - 31, ay - ARENA_R - 0.4)):
            if vx0 < tx1 and vx1 > tdoor and vy0 < ay < vy1:
                # leave the threshold bridge out of the west kill volume
                void(B, "V_ARW_S", (max(vx0, tdoor), vx1, vy0, ay - 3.4, -90, ZB - 3), "BOTH")
                void(B, "V_ARW_N", (max(vx0, tdoor), vx1, ay + 3.4, vy1, -90, ZB - 3), "BOTH")
            else:
                void(B, "V_AR_%d_%d" % (int(vx0), int(vy0)), (vx0, vx1, vy0, vy1, -90, ZB - 3), "BOTH")
        B.marker("abyss", (ax, ay, ZB), sx=60, sy=60, state="BOTH", ring=ARENA_R)
        # the heart's cradle: four colossal chains from the cavern walls, crystal roots down to the pillars
        for deg in (45, 135, 225, 315):
            p = pol(ax, ay, 18, deg, 0)
            ang = math.radians(deg)
            B.obox(((ax + p[0]) / 2, (ay + p[1]) / 2, HEART_Z + 5), (math.hypot(p[0] - ax, p[1] - ay) + 6, 0.35, 0.35), (0, -0.42, ang), "iron_rust")
        encounter(B, "BOSS", "BOTH", (ax - ARENA_R, ax + ARENA_R, ay - ARENA_R, ay + ARENA_R, ZB - 1, ZB + 7), boss=True, surge=True, title="THE LAST CROWN")
        enemy(B, "last_crown", (ax + 1.0, ay, ZB), "BOSS", "BOTH", yaw=math.pi / 2)
        # her call: bats out of the heart at 65 %, goblins and the brood at 35 %
        for i, deg in enumerate((60, 150, 240)):
            enemy(B, "bat", pol(ax, ay, 7, deg, ZB + 3), "BOSS", "PRESENT", rise=True, wave=2, from_heart=True)
        for i, deg in enumerate((20, 200)):
            enemy(B, "goblin", pol(ax, ay, 14.5, deg, ZB), "BOSS", "PRESENT", yaw=math.radians(deg + 180), rise=True, wave=3)
        for i, deg in enumerate((100, 280)):
            enemy(B, "widowling", pol(ax, ay, 14.5, deg, ZB), "BOSS", "PRESENT", yaw=math.radians(deg + 180), rise=True, wave=3)
        B.volume("exit", ax - 1, ax + 1, ay + 60, ay + 62, -10, -8, name="EXIT")      # unreachable: the ending runs from her death
        prompt(B, "C_THRESH", (tx0, tx0 + 3, ay - 3, ay + 3, ZB - 1, ZB + 4), "The Threshold. Beyond it, the heart of Caer Veyr.", state="BOTH")
        light(B, (ax, ay, HEART_Z), "crown", "ff5a22", 8.0, 44.0, "BOTH")
    with B.at(S, "PAST"):
        # the coronation chamber: the ring whole, the Sealbearer pillars standing to the dome, braziers round the edge
        ring_floor(B, ax, ay, WEDGE_R[0], WEDGE_R[1], ZB, "marble", segs=40, skip=lambda a: not any(in_ang(a, w, WEDGE_HALF) for w in WEDGES))
        for deg in PILLARS:
            x, y, _ = pol(ax, ay, 11.0, deg, 0)
            B.column(x, y, ZB, ZB + 16, r=1.0, mat="marble", sides=14)
        for i in range(12):
            if in_ang(i * 30 + 15, 180, 20):
                continue
            x, y, _ = pol(ax, ay, 15.6, i * 30 + 15, 0)
            B.brazier(x, y, ZB, lit=True, state="PAST")
        for i in range(40):
            mid = i * 9 + 4.5
            if in_ang(mid, 180, 7):
                continue
            px, py, _ = pol(ax, ay, ARENA_R + 0.3, mid, 0)
            B.obox((px, py, ZB + 0.55), (0.55, 2 * math.pi * (ARENA_R + 0.3) / 40 + 0.08, 1.1), (0, 0, math.radians(mid)), "stone_wall")
        # the Crown doors at the threshold: shut and warded in the living memory
        B.box(tdoor - 0.35, tdoor - 0.2, ay - 3.0, ay + 3.0, ZB, ZB + 5.8, "wood_door")
        B.box(tdoor - 0.7, tdoor - 0.55, ay - 3.0, ay + 3.0, ZB, ZB + 5.8, "fx_crown")
        B.col_box(tdoor - 0.8, tdoor, ay - 3.2, ay + 3.2, ZB - 0.2, ZB + 6.5)
        prompt(B, "C_WARD", (tdoor - 3.5, tdoor - 0.8, ay - 3, ay + 3, ZB - 1, ZB + 4), "The Crown admits the crowned. In the ruin, the doors are broken.", state="PAST")
        light(B, (ax, ay, ZB + 8), "candle", "ffc890", 3.5, 24.0, "PAST")
    with B.at(S, "PRESENT"):
        # the ruin: four wedge-shaped abysses between the pillar stumps — each one a black shaft with a broken rim
        for deg in WEDGES:
            for k in (-1, 1):
                a = deg + k * WEDGE_HALF
                for rr in (WEDGE_R[0] + 1.2, (WEDGE_R[0] + WEDGE_R[1]) / 2, WEDGE_R[1] - 1.2):
                    p = pol(ax, ay, rr, a, 0)
                    B.obox((p[0], p[1], ZB - 0.2), (1.1, 0.7, 0.5), (0.3 * k, 0.2, math.radians(a + 70 * k)), "rock")
            # the shaft walls under the hole (black, so no floor is ever seen through it) + the glow far below
            for r0 in (WEDGE_R[0], WEDGE_R[1]):
                seg = sector(ax, ay, r0 - 0.02, r0, deg - WEDGE_HALF, deg + WEDGE_HALF, ZB - 0.01, n=4)
                outer = seg[:5]
                B.poly([(p[0], p[1], ZB - 18) for p in outer] + [(p[0], p[1], ZB - 0.05) for p in reversed(outer)], "fx_void", double=True)
            for a in (deg - WEDGE_HALF, deg + WEDGE_HALF):
                q0, q1 = pol(ax, ay, WEDGE_R[0], a, 0), pol(ax, ay, WEDGE_R[1], a, 0)
                B.poly([(q0[0], q0[1], ZB - 18), (q1[0], q1[1], ZB - 18), (q1[0], q1[1], ZB - 0.05), (q0[0], q0[1], ZB - 0.05)], "fx_void", double=True)
            m = pol(ax, ay, (WEDGE_R[0] + WEDGE_R[1]) / 2, deg, 0)
            void(B, "V_W%d" % int(deg), (m[0] - 3.2, m[0] + 3.2, m[1] - 3.2, m[1] + 3.2, ZB - 40, ZB - 1.2), "PRESENT")
            B.marker("abyss", (m[0], m[1], ZB), sx=5.5, sy=5.5, state="PRESENT", wedge=deg)
            light(B, (m[0], m[1], ZB - 12), "crown", "ff3a12", 3.0, 12.0, "PRESENT")
            light(B, (m[0], m[1], ZB - 2), "crown", "ff4a1a", 2.6, 8.0, "PRESENT")
        # broken parapet stubs round the edge
        for i in range(40):
            mid = i * 9 + 4.5
            if in_ang(mid, 180, 7) or i % 3 == 1:
                continue
            px, py, _ = pol(ax, ay, ARENA_R + 0.3, mid, 0)
            B.obox((px, py, ZB + 0.3), (0.55, 2 * math.pi * (ARENA_R + 0.3) / 40 * 0.7, 0.6 - (i % 2) * 0.25), (0, 0.1, math.radians(mid)), "stone_wall")
        # the doors lie broken at the threshold
        B.obox((tdoor + 1.2, ay - 1.8, ZB + 0.2), (0.4, 3.0, 5.5), (0, 1.35, 0.2), "wood_door")
        B.obox((tdoor - 0.3, ay + 2.6, ZB + 2.2), (0.3, 1.4, 4.4), (0.2, 0, 0.5), "wood_door")
        shard(B, tdoor - 1.5, ay + 2.2, ZB, 3.0, 0.5, 0.4, 0.4)
        for deg in PILLARS:
            x, y, _ = pol(ax, ay, 12.4, deg, 0)
            B.mound(x, y, 0.9, 0.9, 0.5, z0=ZB, seed=int(deg) + 400, col=False)
            shard(B, x, y, ZB, 7.0, 0.7, 0.45, math.radians(deg + 180))
        light(B, (ax, ay, ZB + 2), "crown", "ff4418", 3.5, 20.0, "PRESENT")


def build_all(B):
    build_lift(B)
    build_hall(B)
    build_ossuary(B)
    build_cistern(B)
    build_descent(B)
    build_crownheart(B)


SECTIONS = {
    "C1_LIFT": {"bounds": (-9, 9, -9, 11), "neighbors": ["C2_HALL"]},
    "C2_HALL": {"bounds": (-10, 10, 9, 61), "neighbors": ["C1_LIFT", "C3_OSSUARY"]},
    "C3_OSSUARY": {"bounds": (-26, 26, 61, 100), "neighbors": ["C2_HALL", "C4_CISTERN"]},
    "C4_CISTERN": {"bounds": (-3, 23, 99, 128), "neighbors": ["C3_OSSUARY", "C5_DESCENT"]},
    "C5_DESCENT": {"bounds": (-5, 25, 126, 161), "neighbors": ["C4_CISTERN", "C6_HEART"]},
    "C6_HEART": {"bounds": (22, 88, 112, 180), "neighbors": ["C5_DESCENT"]},
}

EXPECTED = {"sigils": ["CP1", "CP2", "CP3"], "fissures": ["F1", "F2", "F3", "F4", "F5"]}

# Blender QA renders (build_floor03.py): the top-down plan and perspective views
PLAN_CAM = {"center": (20, 88), "scale": 190, "height": 120, "cut": 22}
QA_VIEWS = [
    ("lift", (5, -5, 3.5), (0, 8, 2)),
    ("hall", (0, 12, 4), (0, 40, 1)),
    ("ossuary", (0, 64, 4), (-6, 84, 0)),
    ("cistern", (10, 102, 5), (10, 113, 1)),
    ("descent", (10, 131, 3), (16, 146, -2)),
    ("heart", (30, 146, -12), (54, 146, -8)),
]
