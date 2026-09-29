"""Floor 2 — "Complicity", the Royal Floor of Caer Veyr. Mirrors docs/LEVEL_02_BLUEPRINT.md §M.

Same frame as Floor 1 (Blender X east, Y north, Z up). Groups:
  SHARED / PAST / PRESENT as on Floor 1, plus fracture-conditional groups written as
  "<STATE>|FLAG"  (shown only once FLAG is broken) and "<STATE>|!FLAG" (shown only until FLAG is broken).
The runtime (src/levels/Level.ts) parses the suffix for visibility and rebuilds collision when a flag flips.
"""
import math

from floor01_layout import enemy, encounter, fissure, sigil, trace, prompt, void, veg_scatter, timber_stair

Z = 8.0            # royal wing floor
ZR = 10.0          # wardens' range floor (on the armory roof)
ZG = 16.0          # long gallery / tower top
ZL = 14.0          # crown loft / crown bridge

ANT_VOID = (-6.0, 8.0, 68.0, 77.0)          # Present collapse in the antechamber (threshold ledge y 77..78 stays)
CHN_VOID = [(26.0, 32.0, 60.0, 70.0), (32.0, 34.0, 66.0, 70.0)]
KAP_VOIDS = [(-10.0, -4.0, 82.0, 88.0), (4.0, 10.0, 82.0, 88.0), (-3.0, 3.0, 84.0, 88.0)]
LG_GAP = (26.0, 36.0)
SHAFT = (22.5, 26.5, 86.0, 94.0)


def fracture(B, fid, flag, box, attack="heavy", fall=0.0, impact=None, text=""):
    x0, x1, y0, y1, z0, z1 = box
    B.volume("fracture", x0, x1, y0, y1, z0, z1, name=fid, fid=fid, flag=flag, attack=attack, fall=fall,
             impact=list(impact) if impact else [], text=text, state="PAST")


def ring(B, cx, cy, z, r, n=20, w=0.28, h=0.22, mat="iron", tilt=0.0):
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        zz = z + math.sin(a) * r * math.sin(tilt)
        B.obox((x, y, zz), (w, 2 * math.pi * r / n + 0.05, h), (0, 0, a), mat)


def chandelier(B, cx, cy, z, r=2.5, lit=True):
    ring(B, cx, cy, z, r)
    ring(B, cx, cy, z + 0.05, r * 0.55, n=12, w=0.2, h=0.18)
    for i in range(4):
        a = i * math.pi / 2
        B.obox((cx + math.cos(a) * r * 0.5, cy + math.sin(a) * r * 0.5, z), (r, 0.16, 0.16), (0, 0, a), "iron")
    for i in range(10):
        a = 2 * math.pi * i / 10
        B.prism(cx + r * math.cos(a), cy + r * math.sin(a), z + 0.11, z + 0.45, 0.07, 6, "candle")


def room(B, x0, x1, y0, y1, z0, z1, t=1.0, openings=None, skip=()):
    """Four walls around an interior rectangle. openings: dict side -> list of openings."""
    o = openings or {}
    if "S" not in skip:
        B.wall(x0 - t, x1 + t, y0 - t, y0, z0 - 0.6, z1, openings=o.get("S", []), axis="x")
    if "N" not in skip:
        B.wall(x0 - t, x1 + t, y1, y1 + t, z0 - 0.6, z1, openings=o.get("N", []), axis="x")
    if "W" not in skip:
        B.wall(x0 - t, x0, y0, y1, z0 - 0.6, z1, openings=o.get("W", []), axis="y")
    if "E" not in skip:
        B.wall(x1, x1 + t, y0, y1, z0 - 0.6, z1, openings=o.get("E", []), axis="y")


def pit_floor(B, x0, x1, y0, y1, z, vid, state):
    """Dark bottom + kill volume under a void."""
    B.box(x0, x1, y0, y1, z - 0.3, z, "fx_void")
    void(B, vid, (x0, x1, y0, y1, z - 2, z + 4), state)


# =====================================================================================
def build_royal(B):
    S = "R1_ROYAL"
    with B.at(S, "SHARED"):
        # landing (top of Floor 1's Royal Stair)
        B.slab(-3, 3, 58, 62, Z - 0.5, Z, "marble")
        B.wall(-5, 5, 56.6, 58, Z - 0.6, 13, axis="x")
        B.door_leaf((-2, 57.9, Z), 4.0, 4.6, "x", angle=0.0, col=False)
        B.wall(-5, -3, 58, 62, Z - 0.6, 13, axis="y")
        B.wall(3, 5, 58, 62, Z - 0.6, 13, axis="y")
        B.slab(-5, 5, 58, 62, 13, 13.5, "stone_block")
        B.marker("spawn", (0, 59.2, Z), name="SPAWN", yaw=0.0, state="PRESENT")
        # antechamber shell: S wall (landing door + crown-bridge door at loft level), W (QS), E (CHN), N (Royal door)
        # (two bands: the kit's wall splitter needs non-overlapping openings per call)
        B.wall(-14, 14, 62, 63, Z - 0.6, ZL - 0.4, openings=[(-2, 2, Z, Z + 3.4)], axis="x")
        B.wall(-14, 14, 62, 63, ZL - 0.4, 18, openings=[(-1.2, 1.2, ZL, ZL + 3.0, "flat")], axis="x")
        B.wall(-14, -12, 63, 79, Z - 0.6, 18, openings=[(68.8, 71.2, Z, Z + 3.2)], axis="y")
        B.wall(12, 14, 63, 79, Z - 0.6, 18, openings=[(68.8, 71.2, Z, Z + 3.2)], axis="y")
        B.wall(-14, 14, 78, 79, Z - 0.6, 18, openings=[(-2, 2, Z, Z + 4.4)], axis="x")
        # floor strips that survive in both memories
        B.slab(-12, 12, 63, 68, Z - 0.5, Z, "marble")
        B.slab(-12, -6, 68, 78, Z - 0.5, Z, "marble")
        B.slab(8, 12, 68, 78, Z - 0.5, Z, "marble")
        B.slab(-3, 3, 77, 78, Z - 0.5, Z, "marble")          # Royal door threshold ledge
        for px, py in ((-6, 66), (6, 66), (-6, 74.5), (6, 74.5)):
            B.box(px - 0.8, px + 0.8, py - 0.8, py + 0.8, Z - 0.5, 18, "stone_block", col=True)
        # crown loft: S side + W north part + N side (z 14)
        B.slab(-12, 12, 63, 65.5, ZL - 0.4, ZL, "stone_block")
        B.slab(-12, -9.5, 68, 70.8, ZL - 0.4, ZL, "stone_block")
        B.slab(-12, -9.5, 71.2, 78, ZL - 0.4, ZL, "stone_block")
        B.slab(-9.5, 12, 75.5, 78, ZL - 0.4, ZL, "stone_block")
        B.parapet(-9.5, 12, 65.3, 65.5, ZL, h=1.1)
        B.parapet(-9.5, 12, 75.5, 75.7, ZL, h=1.1)
        B.parapet(-9.7, -9.5, 68, 73, ZL, h=1.1)
        # one Blood Sigil for the antechamber (session 7 checkpoint audit): CP1 also serves the return after the
        # crown loft drop — the old CP4 on the west strip stood 9 m away in the same room
        sigil(B, "CP1", (0, 64.6, Z), yaw=0.0)
        fissure(B, "F1", (4.5, 64.2, Z))
        fissure(B, "F5", (6, 64.3, ZL))
        B.marker("light", (0, 60, 12.0), kind="moon", color="9fb8ff", intensity=2.0, range=10.0, state="PRESENT")
        trace(B, "T5", (-10.8, 70.0, ZL + 1.0), "The crown chain was wound here, and every night the court watched it lowered for the King's hand to light.")
        pit_floor(B, ANT_VOID[0], ANT_VOID[1], ANT_VOID[2], ANT_VOID[3], -8, "V_ANT", "PRESENT")
        encounter(B, "E1", "PRESENT", (-12, 12, 63, 78, Z - 1, Z + 5))
        encounter(B, "E1b", "PAST", (-12, 12, 63, 78, Z - 1, Z + 5))
        encounter(B, "E8", "PAST", (-12, 12, 63, 78, ZL - 0.5, ZL + 3))
        prompt(B, "T_F2", (-3, 3, 58, 62, Z, Z + 4), "Floor II — the Royal Floor. The court's rooms lie above the hall.")
        prompt(B, "T_ANT", (-12, 12, 63, 67, Z, Z + 4), "The antechamber's floor has fallen away. The Chancery door lies east.", state="PRESENT")

    with B.at(S, "PAST"):
        B.slab(ANT_VOID[0], ANT_VOID[1], ANT_VOID[2], ANT_VOID[3], Z - 0.5, Z, "marble")
        B.slab(-12, -9.5, 65.5, 68, ZL - 0.4, ZL, "stone_block")        # SW loft corner (Past only)
        B.parapet(-9.7, -9.5, 65.5, 68, ZL, h=1.1)
        B.parapet(-9.7, -9.5, 73, 75.5, ZL, h=1.1)
        B.slab(-14, 14, 62, 79, 18, 18.6, "timber")
        B.beams(-12, 12, 63, 78, 17.6, "x", spacing=3.0)
        # sealed doors: crown bridge (loft level) + Royal door; the Queen's door barred from within
        B.box(-1.2, 1.2, 62.35, 62.65, ZL, ZL + 3.0, "iron", col=True)
        B.box(-2, 2, 78.3, 78.7, Z, Z + 4.4, "fabric_gold", col=True)
        B.box(-13.4, -12.6, 68.8, 71.2, Z, Z + 3.2, "wood_door", col=True)
        B.box(12.6, 13.4, 68.8, 71.2, Z, Z + 0.05, "wood_planks")
        for x in (-10, -4, 4, 10):
            B.bench(x, 63.8, 2.4, axis="x", z=Z)
        B.table(0, 67.2, 4.0, 1.0, axis="x")
        B.banner(-8, -4, 62.95, 17, 5, "+y")
        B.banner(4, 8, 62.95, 17, 5, "+y")
        for x, y in ((-11.5, 66), (11.5, 66), (-11.5, 76), (11.5, 76)):
            B.marker("light", (x, y, Z + 3), kind="candle", color="ffb070", intensity=6.0, range=9.0, state="PAST")
            B.candles(x, y, Z + 1.0, n=4, state="PAST")
        enemy(B, "guard", (-3, 70, Z), "E1b", "PAST", yaw=math.pi)
        enemy(B, "guard", (3, 70, Z), "E1b", "PAST", yaw=math.pi)
        enemy(B, "guard", (0, 74, Z), "E1b", "PAST", yaw=math.pi)
        enemy(B, "archer", (6, 76.6, ZL), "E1b", "PAST", yaw=math.pi, perch=True)
        # loft garrison around the crown winch
        enemy(B, "guard", (-10.7, 67, ZL), "E8", "PAST", yaw=0.0)
        enemy(B, "guard", (-4, 64.2, ZL), "E8", "PAST", yaw=math.pi / 2)
        enemy(B, "archer", (-10.7, 76.5, ZL), "E8", "PAST", yaw=math.pi, perch=True)

    # the Crown Chandelier and its winch — FR1
    with B.at(S, "PAST|!FR1"):
        chandelier(B, 0, 72, 15.0)
        B.box(-0.08, 0.08, 71.92, 72.08, 15.2, 18.0, "iron")               # drop chain to the roof pulley
        B.obox((-5.4, 71.1, 16.5), (10.4, 0.1, 0.1), (0, math.radians(-8), 0), "iron")  # chain to the winch
        # the taut chain bars the loft at y 71 until the brake is broken
        B.box(-12, -9.5, 70.85, 71.15, ZL + 0.9, ZL + 1.1, "iron", col=True)
        B.col_box(-12, -9.5, 70.8, 71.2, ZL, ZL + 2.4)
        # winch drum + fractured brake (glowing crack lines)
        B.hprism(-12.0, -11.3, 70.2, ZL + 0.9, 0.5, 10, "wood_rough", axis="x")
        B.box(-12.0, -11.3, 69.5, 69.9, ZL, ZL + 1.6, "iron", col=True)
        B.obox((-11.65, 69.45, ZL + 1.0), (0.9, 0.04, 0.05), (0, 0.5, 0), "fx_crown")
        B.obox((-11.65, 69.45, ZL + 0.7), (0.6, 0.04, 0.05), (0, -0.7, 0), "fx_crown")
    with B.at(S, "PAST|FR1"):
        chandelier(B, 0.4, 71.6, Z + 0.25, lit=False)
        B.box(-12.0, -11.3, 69.5, 69.9, ZL, ZL + 0.5, "iron", col=True)
    with B.at(S, "PRESENT|FR1"):
        # generations later the fallen crown lies wedged across the collapse: a walkway to the Royal door
        ring(B, 0, 72.3, Z - 0.1, 3.2, n=24, w=0.35, h=0.3, mat="rust", tilt=0.05)
        B.box(-1.1, 1.1, 67.4, 77.4, Z - 0.28, Z + 0.02, "wood_moss", col=True)
        for y in (68.5, 70.5, 72.5, 74.5, 76.5):
            B.box(-1.6, 1.6, y - 0.15, y + 0.15, Z - 0.3, Z + 0.08, "rust")
        B.col_box(-1.6, -1.1, 67.4, 77.4, Z, Z + 1.0)
        B.col_box(1.1, 1.6, 67.4, 77.4, Z, Z + 1.0)
    fracture(B, "FR1", "FR1", (-12, -9.5, 69.0, 71.0, ZL, ZL + 2.2), attack="heavy", fall=6.8,
             impact=(-3.5, 3.5, 68.5, 75.5, Z - 0.5, Z + 3), text="A resonant fracture runs through the winch's brake. Strike it with a heavy blow.")

    with B.at(S, "PRESENT"):
        # broken parapet stubs and the rubble mound under the loft's west side (one-way drop)
        B.parapet(-9.7, -9.5, 65.5, 66.5, ZL, h=0.6)
        B.parapet(-12, -9.5, 65.5, 65.7, ZL, h=1.1)          # the fallen SW corner: no stepping off the south loft
        B.mound(-8.4, 75.2, 1.6, 2.2, 2.6, z0=Z, seed=211)
        B.mound(-3.5, 66.8, 1.8, 0.9, 0.7, z0=Z, seed=212, col=False)
        B.broken_edge(ANT_VOID[0], ANT_VOID[1], ANT_VOID[2], ANT_VOID[2] + 0.4, Z, 9, seed=213)
        B.box(-1.6, 1.6, 78.2, 78.6, Z, Z + 0.3, "wood_door")              # the split Royal door leaf on the floor
        B.box(12.2, 13.8, 68.8, 71.2, Z, Z + 3.0, "rock", col=True)       # chancery door choked
        veg_scatter(B, (-12, 12, 63, 67.5), 22, z=Z, seed=221)
        veg_scatter(B, (-12, -6.5, 68, 78), 14, z=Z, seed=222)
        enemy(B, "hollow", (-8, 71, Z), "E1", "PRESENT", rise=True)
        enemy(B, "hollow", (9.5, 70, Z), "E1", "PRESENT", rise=True)
        enemy(B, "hollow", (2, 65.5, Z), "E1", "PRESENT", rise=True)
        enemy(B, "wraith", (1, 72, Z + 2.5), "E1", "PRESENT")
        # session 9: gloom bats roost in the broken roof — the floor's first new monster, two of them to learn on
        enemy(B, "bat", (-4, 67, Z + 3.0), "E1", "PRESENT")
        enemy(B, "bat", (6, 75, Z + 3.2), "E1", "PRESENT")
        encounter(B, "E9", "PRESENT", (-12, -5.5, 68, 78, Z - 1, Z + 4))
        # E9 (session 7 variety): wraiths over the void + Remnants rising on the strips — air and ground at once
        enemy(B, "wraith", (-2, 73, Z + 2.2), "E9", "PRESENT")
        # session 9: a Widow lowers itself from the broken timbers onto the strip; its brood follows
        enemy(B, "widow", (-8.6, 73.5, Z), "E9", "PRESENT", yaw=0.0, rise=True, ceiling=True)
        enemy(B, "remnant", (-9.5, 65.5, Z), "E9", "PRESENT", yaw=0.0, rise=True)
        enemy(B, "widowling", (-10.5, 70.2, Z), "E9", "PRESENT", yaw=0.0, rise=True, wave=2)
        enemy(B, "widowling", (-7.2, 76.4, Z), "E9", "PRESENT", yaw=math.pi, rise=True, wave=2)
        prompt(B, "T_DROP", (-12, -9.5, 72, 78, ZL, ZL + 3), "The loft's edge has crumbled over a heap of rubble below.", state="PRESENT")
        prompt(B, "T_CROWN", (-12, -6, 68, 78, Z, Z + 4), "The crown still hangs in memory.", state="PRESENT", requires="noflag:FR1")

    # ---------------------------------------------------------------- Queen's Solar (optional, Present-only access)
    with B.at(S, "SHARED"):
        B.slab(-30, -14, 63, 78, Z - 0.5, Z, "marble")
        B.slab(-30, -20, 78, 86, Z - 0.5, Z, "wood_fine")
        room(B, -30, -14, 63, 78, Z, 14, openings={"N": [(-28, -22, Z, Z + 3.2)]}, skip=("E",))
        room(B, -30, -20, 78, 86, Z, 14, skip=("S",))
        B.box(-19, -16, 76, 77.5, Z, Z + 0.8, "wood_fine", col=True)           # the Queen's desk
        fissure(B, "F2", (-22, 66, Z))
        trace(B, "T3", (-17.5, 76.6, Z + 1.0), "\"He means to bind every soul in Caer Veyr to that stone. The girl is not of his line — take her by the servants' stair, and let no priest mark her.\"")
        encounter(B, "E2b", "PRESENT", (-30, -14, 63, 86, Z - 1, Z + 5), optional=True, boss=True, surge=True, title="THE WEEPING MOTHER")
    with B.at(S, "PAST"):
        B.slab(-32, -12, 62, 88, 14, 14.5, "timber")
        B.bench(-24, 64, 2.0, axis="x", z=Z)
        for x in (-27, -23):
            B.box(x - 0.6, x + 0.6, 82, 83.4, Z, Z + 0.7, "wood_fine", col=True)   # two cradles
    with B.at(S, "PRESENT"):
        B.slab(-32, -12, 62, 70, 14, 14.5, "timber")
        veg_scatter(B, (-30, -14, 70, 86), 18, z=Z, seed=231)
        # E2b (optional mini-boss, session 9): the Weeping Mother nests in the ruined solar. A Widow drops from the
        # vault as she wakes; her brood hatches at 65 % and 35 % (waves 2-3 crawl out of her)
        enemy(B, "widow_mother", (-25, 81.5, Z), "E2b", "PRESENT", yaw=math.pi)
        enemy(B, "widow", (-17.5, 70, Z), "E2b", "PRESENT", yaw=math.pi / 2, rise=True, ceiling=True)
        for i, (x, y) in enumerate(((-24, 78), (-26, 78), (-22, 79))):
            enemy(B, "widowling", (x, y, Z), "E2b", "PRESENT", yaw=math.pi, rise=True, brood=True, wave=2)
        for i, (x, y) in enumerate(((-23, 79), (-27, 79), (-25, 77.5))):
            enemy(B, "widowling", (x, y, Z), "E2b", "PRESENT", yaw=math.pi, rise=True, brood=True, wave=3)
        enemy(B, "widow", (-20, 66, Z), "E2b", "PRESENT", yaw=math.pi / 2, rise=True, ceiling=True, wave=3)


def build_chancery(B):
    S = "R2_CHANCERY"
    with B.at(S, "SHARED"):
        B.slab(14, 26, 60, 80, Z - 0.5, Z, "wood_planks")
        B.slab(26, 34, 70, 80, Z - 0.5, Z, "wood_planks")
        B.slab(32, 34, 60, 66, Z - 0.5, Z, "wood_planks")                 # threshold ledge along the east wall
        B.wall(12, 36, 58, 60, Z - 0.6, 16.5, axis="x")
        B.wall(12, 14, 60, 63, Z - 0.6, 16.5, axis="y")
        B.wall(12, 14, 79, 80, Z - 0.6, 16.5, axis="y")
        B.wall(12, 36, 80, 82, Z - 0.6, 16.5, axis="x")
        B.wall(34, 36, 60, 80, Z - 0.6, 16.5, openings=[(61, 64, Z, Z + 3.2)], axis="y")
        B.slab(12, 36, 58, 82, 16.5, 17, "timber")
        # archive mezzanine (z 12): north + east-north parts in both memories
        B.slab(14, 30, 77, 80, 11.6, 12, "wood_planks")
        B.slab(30, 34, 72, 80, 11.6, 12, "wood_planks")
        B.parapet(16, 30, 76.8, 77, 12, h=1.1)
        B.parapet(29.8, 30, 72, 77, 12, h=1.1)
        for y in (74, 78):
            B.box(29.8, 30.1, y - 0.15, y + 0.15, Z, 11.6, "timber", col=True)
        for x in (18, 22, 26):
            B.box(x - 0.15, x + 0.15, 76.8, 77.1, Z, 11.6, "timber", col=True)
        for y in (63, 67.5):
            B.box(15, 17, y, y + 0.6, Z, Z + 2.4, "wood_rough", col=True)    # record shelves (clear of the stair x 14..16, y 70..77)
            B.box(20, 23, y + 1, y + 1.6, Z, Z + 2.4, "wood_rough", col=True)
        sigil(B, "CP2", (38, 62, Z), yaw=0.0)
        fissure(B, "F3", (38, 45, ZR))
        trace(B, "T1", (24.5, 61.5, Z + 1.0), "\"By the King's hand: the east wards to be moved below, and the doors made fast behind them.\"")
        B.marker("shift", (32, 73, 12), name="shift_G2")
        encounter(B, "E3", "PAST", (14, 34, 60, 80, Z - 1, 13))
        encounter(B, "E3p", "PRESENT", (14, 34, 60, 80, Z - 1, 13))
        prompt(B, "T_MEZZ", (30, 34, 72, 75, 12, 15), "The mezzanine breaks here in the other memory.", state="PAST")
        # wardens' walk: corridor east of the chancery, down to the range
        B.slab(36, 40, 52, 68, Z - 0.5, Z, "stone_block")
        B.wall(40, 41, 39, 69, Z - 0.6, 14, axis="y")
        B.wall(36, 41, 68, 69, Z - 0.6, 14, axis="x")
        B.wall(34, 36, 44, 58, Z - 0.6, 14, axis="y")
        B.wall(34, 41, 39, 40, Z - 0.6, 14, axis="x")
        B.slab(34, 41, 39, 69, 14, 14.5, "stone_block")
        B.stairs(36, 40, 48, 52, Z, ZR, "-y")                 # the walk climbs south toward the range (z 8 → 10)
        B.slab(36, 40, 40, 48, ZR - 0.5, ZR, "stone_block")
        B.slab(34, 36, 40, 43.6, ZR - 0.5, ZR, "stone_block")
    with B.at(S, "PAST"):
        for x0, x1, y0, y1 in CHN_VOID:
            B.slab(x0, x1, y0, y1, Z - 0.5, Z, "wood_planks")
        B.slab(30, 34, 60, 72, 11.6, 12, "wood_planks")
        B.parapet(29.8, 30, 60, 72, 12, h=1.1)
        for y in (62, 66, 70):
            B.box(29.8, 30.1, y - 0.15, y + 0.15, Z, 11.6, "timber", col=True)
        timber_stair(B, 14, 16, 70, 77, Z, 12, "+y", rails=("x1",))
        B.box(34.3, 34.7, 61, 64, Z, Z + 3.2, "iron", col=True)             # east door sealed by Royal Order
        for x in (18, 22, 26):
            for y in (63, 67, 71):
                B.table(x, y, 1.6, 0.9, axis="x")
        B.box(26.5, 28, 76, 76.8, Z, Z + 1.6, "iron", col=True)             # sealing press
        for x, y in ((15, 60.6), (33, 60.6), (15, 79.4), (33, 79.4)):
            B.marker("light", (x, y, Z + 3), kind="candle", color="ffb070", intensity=5.0, range=9.0, state="PAST")
            B.candles(x, y, Z + 1.0, n=3, state="PAST")
        enemy(B, "guard", (20, 66, Z), "E3", "PAST", yaw=math.pi / 2)
        enemy(B, "guard", (24, 70, Z), "E3", "PAST", yaw=math.pi / 2)
        enemy(B, "guard", (22, 74, Z), "E3", "PAST", yaw=math.pi / 2)
        enemy(B, "archer", (32, 64, 12), "E3", "PAST", yaw=math.pi / 2, perch=True, wave=2)
        enemy(B, "archer", (32, 74, 12), "E3", "PAST", yaw=math.pi / 2, perch=True, wave=2)
    with B.at(S, "PRESENT"):
        # sagged mezzanine: slope from the break line (y 68, z 12) down to the threshold ledge
        B.rubble_ramp(32, 34, 66, 72, Z + 0.1, 12, "y", 1, mat="wood_planks", seed=241, n=6)
        for x0, x1, y0, y1 in CHN_VOID:
            pit_floor(B, x0, x1, y0, y1, -8, "V_CHN_%d" % int(x0), "PRESENT")
        B.broken_edge(26, 32, 70, 70.4, Z, 7, seed=242)
        B.box(34.2, 34.5, 63.8, 64, Z, Z + 0.2, "wood_door")                # rotted door leaf
        for x, y, r in ((18, 64, 0.4), (22, 69, -0.3), (19, 73, 0.9)):
            B.obox((x, y, Z + 0.35), (3.2, 0.7, 0.7), (0, 0, r), "wood_rough", col=True)
        enemy(B, "hollow", (20, 64, Z), "E3p", "PRESENT", rise=True)
        # session 9: ruin goblins nest in the fallen chancery — a pair, then one more drops from the mezzanine
        enemy(B, "goblin", (23, 72.5, Z), "E3p", "PRESENT", yaw=math.pi / 2)
        enemy(B, "goblin", (25, 75.5, Z), "E3p", "PRESENT", yaw=math.pi / 2)
        enemy(B, "goblin", (24, 67, Z), "E3p", "PRESENT", yaw=math.pi / 2, rise=True, wave=2)
        enemy(B, "echo_archer", (20, 78.5, 12), "E3p", "PRESENT", yaw=math.pi, perch=True)


def build_range(B):
    S = "R3_RANGE"
    with B.at(S, "SHARED"):
        # wardens' range above the armory: interior x 23..34, y 12..44 at z 10
        B.slab(23, 34, 12, 44, ZR - 0.5, ZR, "wood_planks")
        B.wall(21, 23, 15, 44, ZR - 0.6, 13, axis="y")
        B.wall(34, 36, 12, 44, ZR - 0.6, 13, openings=[(40, 43.6, ZR, ZR + 3.0)], axis="y")
        B.wall(21, 36, 44, 46, ZR - 0.6, 13, axis="x")
        B.wall(21, 36, 10, 12, ZR - 0.6, 13, axis="x")
        # the "Wardens only" gate (Past iron / Present rusted solid)
        B.col_box(23, 34, 26.3, 26.7, ZR, ZR + 3.0)
        # minstrels' tower: interior x 14..22, y 6..14 (floor z 10, top z 16)
        B.slab(14, 22, 6, 14, ZR - 0.5, ZR, "stone_block")
        room(B, 14, 22, 6, 14, ZR, ZG + 1.2, openings={"E": [(12.2, 14.6, ZR, ZR + 3.0)], "W": [(7, 9, ZG, ZG + 3, "flat")]})
        B.stairs(14.2, 15.8, 6.2, 11.2, ZR, 13, "+y")
        B.slab(14, 18, 11.2, 14, 12.6, 13, "stone_block")
        B.stairs(18, 22, 12.2, 14, 13, ZG, "+x")
        B.slab(13, 23, 5, 15, ZG - 0.4, ZG, "stone_block", holes=[(17.6, 22, 12, 14)])
        B.parapet(13, 23, 14.8, 15, ZG, h=1.1)
        B.parapet(22.8, 23, 5, 15, ZG, h=1.1)
        B.crenellations(13, 23, 14.6, 15, ZG + 1.1, "x")
        sigil(B, "CP3", (19.5, 8.2, ZR), yaw=0.0)
        fissure(B, "F4", (17, 9, ZR))
        trace(B, "T2", (31, 40, ZR + 1.0), "A wardens' roster. Eleven names are struck through, each with the same word beside it: refused.")
        encounter(B, "E4", "PRESENT", (23, 34, 27, 44, ZR - 1, ZR + 4), boss=True, surge=True, title="THE GUTTER KING")
        encounter(B, "E5b", "PAST", (23, 34, 27, 44, ZR - 1, ZR + 4), optional=True)
        encounter(B, "E6", "PRESENT", (27, 29, 14, 36.5, 13, 17))
    with B.at(S, "PAST"):
        B.box(23, 34, 26.35, 26.65, ZR, ZR + 3.0, "iron")
        for x in range(24, 34, 2):
            B.box(x, x + 0.08, 26.3, 26.7, ZR, ZR + 3.0, "iron")
        # pitched roof (the ridge beam sits where the Present ridge-walk is — shifting up there is buried)
        B.obox((25.5, 28, 14.0), (6.1, 34, 0.35), (0, math.radians(-18), 0), "timber")
        B.obox((30.5, 28, 14.0), (6.1, 34, 0.35), (0, math.radians(18), 0), "timber")
        B.col_box(23, 34, 12, 44, 13, 15.2)
        for y in range(14, 44, 3):
            B.box(23, 34, y - 0.15, y + 0.15, 12.7, 13.0, "timber")
        for y in (30, 34, 38, 42):
            B.bunk(25, y, axis="x")
            B.bunk(32, y, axis="x")
        B.table(28.5, 20, 5, 1.1, axis="y")
        for x, y in ((24, 43), (33, 43), (24, 13), (33, 13)):
            B.marker("light", (x, y, ZR + 2.5), kind="lantern", color="ffb070", intensity=6.0, range=9.0, state="PAST")
        enemy(B, "royal_warden", (26, 36, ZR), "E5b", "PAST", yaw=math.pi)
        enemy(B, "royal_warden", (31, 36, ZR), "E5b", "PAST", yaw=math.pi)
        enemy(B, "guard", (28.5, 31, ZR), "E5b", "PAST", yaw=math.pi)
    with B.at(S, "PRESENT"):
        B.box(23, 34, 26.35, 26.65, ZR, ZR + 3.0, "rust")
        # fallen trusses → ramp up to the surviving ridge; the ridge walk over the gate; heap down past it
        B.rubble_ramp(26, 30, 36, 43.5, ZR, 14, "y", -1, mat="wood_moss", seed=251, n=8)
        B.slab(27.4, 28.6, 22, 36.2, 13.6, 14, "stone_block")
        for y in (24, 30):
            B.box(27.6, 28.4, y - 0.4, y + 0.4, ZR, 13.6, "stone_block", col=True)
        B.rubble_ramp(26.5, 29.5, 15, 22, ZR, 13.9, "y", 1, mat="rock", seed=252, n=7)
        for i in range(8):
            B.obox((24 + (i % 4) * 2.6, 30 + (i // 4) * 5, ZR + 0.3), (0.3, 5.5, 0.35), (0.2, 0, 0.4 * ((-1) ** i)), "wood_moss", col=True)
        veg_scatter(B, (27.4, 28.6, 15, 36), 10, z=14, seed=253)
        veg_scatter(B, (23, 34, 12, 44), 22, z=ZR, seed=254)
        # E4 (session 9 mini-boss): THE GUTTER KING holds the wardens' range with his pack. His war cry (60 %)
        # frenzies them; at 65 % / 35 % more goblins drop from the fallen trusses, the last wave with the Remnants
        # the Crownheart pushes up through the stone (they return on Floor 3 and at the Last Crown's call)
        enemy(B, "goblin_king", (31.5, 38.5, ZR), "E4", "PRESENT", yaw=math.pi)
        enemy(B, "goblin", (25, 31, ZR), "E4", "PRESENT", yaw=math.pi)
        enemy(B, "goblin", (32.5, 32, ZR), "E4", "PRESENT", yaw=math.pi)
        enemy(B, "goblin", (28.5, 35, ZR), "E4", "PRESENT", yaw=math.pi, rise=True, wave=2)
        enemy(B, "goblin", (24.5, 36.5, ZR), "E4", "PRESENT", yaw=math.pi, rise=True, wave=2)
        enemy(B, "goblin", (32, 41, ZR), "E4", "PRESENT", yaw=math.pi, rise=True, wave=3)
        enemy(B, "remnant", (25.5, 33, ZR), "E4", "PRESENT", yaw=math.pi, rise=True, wave=3)
        enemy(B, "remnant", (31, 29.5, ZR), "E4", "PRESENT", yaw=math.pi, rise=True, wave=3)
        # E6: the ridge walk — wraiths and a pair of gloom bats over the narrow beam
        enemy(B, "wraith", (26, 30, 16.5), "E6", "PRESENT")
        enemy(B, "wraith", (30, 24, 16.8), "E6", "PRESENT")
        enemy(B, "bat", (27, 20, 16.6), "E6", "PRESENT")
        enemy(B, "bat", (29.5, 27, 16.8), "E6", "PRESENT")
        prompt(B, "T_GATE2", (23, 34, 27, 30, ZR, ZR + 3), "\"Wardens only.\" The gate is rusted into its frame — but the fallen roof climbs north of it.", state="PRESENT")


def build_gallery(B):
    S = "R4_GALLERY"
    with B.at(S, "SHARED"):
        # south walk along the top of the hall's south wall, tower → gallery
        B.slab(2.5, 14, 7, 9, ZG - 0.5, ZG, "stone_block")
        B.parapet(2.5, 13, 6.8, 7, ZG, h=1.1)
        B.parapet(3.1, 13, 9, 9.2, ZG, h=1.1)
        # long gallery: floor + walls (S part and N part exist in both memories)
        B.slab(-2.5, 2.5, 7, LG_GAP[0], ZG - 0.5, ZG, "marble")
        B.slab(-2.5, 2.5, LG_GAP[1], 44, ZG - 0.5, ZG, "marble")
        B.wall(-3.1, -2.5, 7, LG_GAP[0], ZG - 0.4, ZG + 3.6, axis="y", openings=[(12, 14, ZG + 1, ZG + 2.8, "flat"), (18, 20, ZG + 1, ZG + 2.8, "flat")])
        B.wall(2.5, 3.1, 9.4, LG_GAP[0], ZG - 0.4, ZG + 3.6, axis="y", openings=[(14, 16, ZG + 1, ZG + 2.8, "flat")])
        B.wall(-3.1, -2.5, LG_GAP[1], 44, ZG - 0.4, ZG + 3.6, axis="y")
        B.wall(2.5, 3.1, LG_GAP[1], 44, ZG - 0.4, ZG + 3.6, axis="y")
        B.wall(-3.1, 3.1, 6.4, 7, ZG - 0.4, ZG + 3.6, axis="x")
        B.wall(-3.1, -1.5, 44, 44.6, ZG - 0.4, ZG + 3.6, axis="x")
        B.wall(1.5, 3.1, 44, 44.6, ZG - 0.4, ZG + 3.6, axis="x")
        # crown bridge: gallery north end → antechamber loft door (z 16 → 14 over the Royal Stair roof)
        B.slab(-1.5, 1.5, 44, 48, ZL - 0.4, ZL, "stone_block")
        B.stairs(-1.5, 1.5, 44, 48, ZL, ZG, "-y")
        B.slab(-1.5, 1.5, 48, 62, ZL - 0.4, ZL, "stone_block")
        B.parapet(-1.7, -1.5, 44, 62, ZL, h=1.2)
        B.parapet(1.5, 1.7, 44, 62, ZL, h=1.2)
        B.marker("shift", (0, 18, ZG), name="shift_G3")
        B.marker("shift", (0, 58, ZL), name="shift_G4")
        encounter(B, "E7", "PAST", (-2.5, 2.5, 22, 38, ZG - 1, ZG + 4))
        prompt(B, "T_LG", (-2.5, 2.5, 20, 25.5, ZG, ZG + 3), "The gallery of kings fell into the hall here. In the other memory it still stands.", state="PRESENT")
        prompt(B, "T_SEAL", (-1.5, 1.5, 58, 62, ZL, ZL + 3), "The door does not know you.", state="PAST")
        pit_floor(B, -2.5, 2.5, LG_GAP[0], LG_GAP[1], -2, "V_LG", "PRESENT")
        B.marker("light", (0, 31, 4), kind="crown", color="ff5a2a", intensity=16.0, range=22.0, state="PRESENT")
    with B.at(S, "PAST"):
        B.slab(-2.5, 2.5, LG_GAP[0], LG_GAP[1], ZG - 0.5, ZG, "marble")
        B.wall(-3.1, -2.5, LG_GAP[0], LG_GAP[1], ZG - 0.4, ZG + 3.6, axis="y")
        B.wall(2.5, 3.1, LG_GAP[0], LG_GAP[1], ZG - 0.4, ZG + 3.6, axis="y")
        B.slab(-3.1, 3.1, 7, 44, ZG + 3.6, ZG + 4.0, "timber")
        for y in range(10, 44, 4):
            B.box(-2.45, -2.4, y, y + 1.4, ZG + 1.0, ZG + 2.8, "fabric_gold")      # portraits
            B.box(2.4, 2.45, y + 1.5, y + 2.9, ZG + 1.0, ZG + 2.8, "fabric_gold")
            B.marker("light", (0, y + 1, ZG + 2.8), kind="candle", color="ffb070", intensity=4.0, range=7.0, state="PAST")
        enemy(B, "royal_warden", (-1, 29, ZG), "E7", "PAST", yaw=math.pi)
        enemy(B, "royal_warden", (1, 33, ZG), "E7", "PAST", yaw=math.pi)
        enemy(B, "guard", (0, 25.5, ZG), "E7", "PAST", yaw=math.pi)
        enemy(B, "guard", (0, 36, ZG), "E7", "PAST", yaw=math.pi)
    with B.at(S, "PRESENT"):
        B.broken_edge(-2.5, 2.5, LG_GAP[0] - 0.4, LG_GAP[0], ZG, 6, seed=261)
        B.broken_edge(-2.5, 2.5, LG_GAP[1], LG_GAP[1] + 0.4, ZG, 6, seed=262)
        B.box(-2.45, -2.35, 38, 39.6, ZG + 1.0, ZG + 2.9, "fabric_royal")          # the Queen's portrait, slashed
        veg_scatter(B, (-2.5, 2.5, 8, 25), 10, z=ZG, seed=263)


def build_apartments(B):
    S = "R5_APART"
    with B.at(S, "SHARED"):
        B.slab(-12, 12, 79, 95, Z - 0.5, Z, "marble", holes=KAP_VOIDS)
        room(B, -12, 12, 79, 95, Z, 16, skip=("S", "E"))
        B.wall(12, 13, 79, 95, Z - 0.6, 16, openings=[(86, 88.4, Z, Z + 3.2)], axis="y")
        # king's study
        B.slab(13, 19.5, 82, 95, Z - 0.5, Z, "wood_fine")
        B.wall(13, 20.5, 81, 82, Z - 0.6, 16, axis="x")
        B.wall(13, 20.5, 95, 96, Z - 0.6, 16, axis="x")
        B.wall(19.5, 20.5, 82, 95, Z - 0.6, 16, openings=[(83, 85.4, Z, Z + 3.0)], axis="y")
        B.box(14, 17, 91, 92.2, Z, Z + 0.85, "wood_fine", col=True)                 # Aldren's desk
        sigil(B, "CP5", (16, 87.5, Z), yaw=0.0)
        fissure(B, "F6", (-8, 80.2, Z))
        trace(B, "T4", (15.5, 92.8, Z + 1.0), "Diagrams of the keep drawn as one instrument, strung from the stone below to the crown above. In the margin: \"To lose Veyr is the only crime. I will keep it — every stone, every soul — at this hour, forever.\"")
        B.marker("shift", (16, 85, Z), name="shift_G7")
        encounter(B, "E10", "BOTH", (-12, 12, 79.5, 95, Z - 1, Z + 5), boss=True, surge=True, title="THE KINGSGUARD CAPTAIN")
        # conduit stair tower: shaft x 22.5..26.5, y 86..94; outer walls
        B.wall(20.5, 29.5, 81, 82, Z - 0.6, 30, axis="x")
        B.wall(20.5, 29.5, 96, 97, Z - 0.6, 24, axis="x")
        B.wall(28.5, 29.5, 82, 96, Z - 0.6, 30, axis="y")
        B.wall(19.5, 20.5, 82, 96, 16, 30, axis="y")
        B.slab(20.5, 28.5, 82, 96, Z - 0.5, Z, "stone_block", holes=[SHAFT])
        B.box(SHAFT[0], SHAFT[1], SHAFT[2], SHAFT[3], -30.3, -30, "fx_crown")
        void(B, "V_SHAFT", (SHAFT[0], SHAFT[1], SHAFT[2], SHAFT[3], -32, Z - 1), "BOTH")
        B.marker("light", (24.5, 90, 2), kind="crown", color="ff5a2a", intensity=24.0, range=26.0, state="BOTH")
        B.parapet(22.3, 22.5, 86, 94, Z, h=1.1)
        # upper flights (both memories)
        B.slab(20.7, 28.3, 94, 95.8, 13.6, 14, "stone_block")
        B.stairs(26.7, 28.3, 84, 94, 14, 20, "-y")
        B.slab(20.7, 28.3, 82.2, 84, 19.6, 20, "stone_block")
        B.stairs(20.7, 22.3, 84, 90.67, 20, 24, "+y")
        # bell chamber (z 24) and the exit toward the crown
        B.slab(18, 30, 90.67, 100, 23.6, 24, "stone_block", holes=[(22.5, 26.5, 90.67, 94)])
        B.wall(17, 18, 88, 101, 23.4, 30, axis="y")
        B.wall(30, 31, 88, 101, 23.4, 30, axis="y")
        B.wall(17, 31, 100, 101, 23.4, 30, openings=[(22, 26, 24, 28.4)], axis="x")
        B.parapet(22.3, 26.7, 94, 94.2, 24, h=1.1)
        B.volume("exit", 22, 26, 100, 102, 24, 28, name="EXIT")
        prompt(B, "T_CS", (13, 19.5, 82, 88, Z, Z + 4), "The conduit stair's lower flight is gone here. It stood in the other memory.", state="PRESENT")
    with B.at(S, "PAST"):
        for x0, x1, y0, y1 in KAP_VOIDS:
            B.slab(x0, x1, y0, y1, Z - 0.5, Z, "marble")
        B.slab(-13, 20.5, 78, 96, 16, 16.5, "timber")
        B.box(6, 10, 90, 94, Z, Z + 0.7, "fabric_royal", col=True)                 # the King's bed
        for x in (6.2, 9.8):
            for y in (90.2, 93.8):
                B.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, Z, Z + 3.2, "wood_fine")
        B.table(-6, 90, 4, 1.4, axis="x")                                            # map table (siege lines)
        B.box(-11, -10, 84, 89, Z, Z + 2.2, "wood_fine", col=True)                  # wardrobe
        B.brazier(-8, 80.8, z=Z, state="PAST")
        B.brazier(8, 80.8, z=Z, state="PAST")
        # conduit stair lower flight (Past only) and its landing
        B.stairs(20.7, 22.3, 83, 93, Z, 14, "+y")
        B.slab(20.7, 22.3, 93, 94, 13.6, 14, "stone_block")                     # top step → landing (was a 1 m gap)
        for i, (x, y) in enumerate(((20.5, 97.5), (24.5, 98.2), (28, 97.5))):
            B.prism(x, y, 26.2, 27.8, 0.9 - i * 0.1, 12, "rust_plate")
        enemy(B, "kingsguard", (0, 91, Z), "E10", "BOTH", yaw=math.pi)
        enemy(B, "guard", (-6, 84, Z), "E10", "PAST", yaw=math.pi, wave=2)
        enemy(B, "guard", (6, 84, Z), "E10", "PAST", yaw=math.pi, wave=3)
    with B.at(S, "PRESENT"):
        for i, (x0, x1, y0, y1) in enumerate(KAP_VOIDS):
            pit_floor(B, x0, x1, y0, y1, -8, "V_KAP_%d" % i, "PRESENT")
            B.broken_edge(x0, x1, y0 - 0.3, y0, Z, 5, seed=270 + i)
        B.box(6, 10, 90, 94, Z, Z + 0.5, "fabric_banner", col=True)
        B.prism(24.5, 97.8, 23.8, 25.2, 0.9, 12, "rust_plate")                  # one bell fallen
        veg_scatter(B, (-12, 12, 88, 95), 16, z=Z, seed=275)
        # the Captain's Present reinforcements rise as Remnants from the glowing floor holes (session 7 variety)
        enemy(B, "remnant", (-6, 84, Z), "E10", "PRESENT", rise=True, wave=2)
        enemy(B, "remnant", (6, 84, Z), "E10", "PRESENT", rise=True, wave=2)
        enemy(B, "hollow", (0, 81.5, Z), "E10", "PRESENT", rise=True, wave=3)


def build_all(B):
    build_royal(B)
    build_chancery(B)
    build_range(B)
    build_gallery(B)
    build_apartments(B)


SECTIONS = {
    "R1_ROYAL": {"bounds": (-32, 14, 56, 88), "neighbors": ["R2_CHANCERY", "R4_GALLERY", "R5_APART"]},
    "R2_CHANCERY": {"bounds": (12, 41, 42, 82), "neighbors": ["R1_ROYAL", "R3_RANGE"]},
    "R3_RANGE": {"bounds": (13, 36, 5, 46), "neighbors": ["R2_CHANCERY", "R4_GALLERY"]},
    "R4_GALLERY": {"bounds": (-3.1, 14, 6, 62), "neighbors": ["R3_RANGE", "R1_ROYAL"]},
    "R5_APART": {"bounds": (-13, 31, 78, 102), "neighbors": ["R1_ROYAL"]},
}

EXPECTED = {"sigils": ["CP1", "CP2", "CP3", "CP5"], "fissures": ["F1", "F2", "F3", "F4", "F5", "F6"]}
