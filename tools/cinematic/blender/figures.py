"""Human figures for the film, from the game's own rigs (so anatomy and motion are real), rendered as ink
silhouettes with rim light. hero = Maria (the protagonist; also lends her hand to the founder and the Queen),
knight = the Royal Guard (guards, founders, the king with crown and cloak), archer = Erika (civilians).
"""
import math, os
import bpy
from mathutils import Vector, Euler
import cine

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
CHAR = os.path.join(ROOT, 'assets', 'blender', 'characters')
SRC = {
    'hero': (os.path.join(CHAR, 'hero.blend'), ['Hero', 'HeroBody', 'HeroSword']),
    'knight': (os.path.join(CHAR, 'enemies_knight.blend'), ['Knight', 'Object_7', 'Object_8']),
    'archer': (os.path.join(CHAR, 'enemies_archer.blend'), ['Archer', 'Erika_Archer_Body_Mesh', 'Erika_Archer_Clothes_Mesh', 'Erika_Archer_Bow_Mesh', 'Erika_Archer_Arrow_Mesh']),
}
BONES = {
    'hero': {'head': 'mixamorig:Head', 'hand_r': 'mixamorig:RightHand', 'hand_l': 'mixamorig:LeftHand', 'chest': 'mixamorig:Spine2', 'hips': 'mixamorig:Hips', 'neck': 'mixamorig:Neck'},
    'knight': {'head': 'Head_0', 'hand_r': 'Hand.R_47', 'hand_l': 'Hand.L_22', 'chest': 'Spine_55', 'neck': 'Neck_1'},
}
_loaded_actions = {}

class Figure:
    def __init__(self, kind, arm, meshes):
        self.kind, self.arm, self.meshes = kind, arm, meshes
    def bone(self, key): return BONES[self.kind].get(key, key)
    def place(self, loc, facing_deg=0.0, scale=1.0):
        """facing_deg: direction the figure faces, degrees from +X (the rigs face -Y at 0 yaw -> facing -90)."""
        self.arm.location = loc
        base = self.arm.rotation_euler.copy()
        self.arm.rotation_euler = (base.x, base.y, math.radians(facing_deg + 90.0))
        s = 0.01 * scale
        self.arm.scale = (s, s, s)
        return self
    def hide(self, *names):
        for m in self.meshes:
            if any(n in m.name for n in names): m.hide_render = True; m.hide_viewport = True
        return self

def _append(kind, actions=()):
    blend, names = SRC[kind]
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = [o for o in src.objects if o in names]
        want = [a for a in src.actions if a in actions and a not in _loaded_actions]
        dst.actions = want
    for a in dst.actions:
        if a: _loaded_actions[a.name] = a
    return dst.objects

def load(kind, name, collection, actions=()):
    objs = _append(kind, actions)
    col = cine.coll(collection)
    arm, meshes = None, []
    for o in objs:
        if o is None: continue
        col.objects.link(o)
        if o.type == 'ARMATURE': arm = o
        else: meshes.append(o)
    arm.name = name
    for m in meshes: m.name = f'{name}_{m.name}'
    return Figure(kind, arm, meshes)

def action(name):
    a = _loaded_actions.get(name) or bpy.data.actions.get(name)
    if a is None: raise KeyError('action not loaded: ' + name)
    return a

def hold_pose(fig, action_name, frame):
    """Freeze the pose of `action_name` at `frame` (evaluated fcurves written into the pose; no action left on)."""
    act = action(action_name)
    for fc in cine._fcurves(act):
        try:
            prop = fig.arm.path_resolve(fc.data_path, False)
        except Exception:
            continue
        try:
            if hasattr(prop, '__len__') and not isinstance(prop, str):
                owner_path, attr = fc.data_path.rsplit('.', 1)
                owner = fig.arm.path_resolve(owner_path)
                vec = getattr(owner, attr)
                vec[fc.array_index] = fc.evaluate(frame)
            else:
                owner_path, attr = fc.data_path.rsplit('.', 1)
                setattr(fig.arm.path_resolve(owner_path), attr, fc.evaluate(frame))
        except Exception:
            pass
    return fig

def play(fig, action_name, start=1, speed=0.8, repeat=1.0, offset=0.0):
    """Play a clip from scene frame `start` (speed 0.8 = 30 fps clips in a 24 fps film at real time)."""
    act = action(action_name)
    ad = fig.arm.animation_data or fig.arm.animation_data_create()
    tr = ad.nla_tracks.new(); tr.name = action_name
    st = tr.strips.new(action_name, int(start), act)
    st.scale = 1.0 / speed
    st.repeat = repeat
    st.action_frame_start = act.frame_range[0] + offset
    try:
        if hasattr(st, 'action_slot') and act.slots: st.action_slot = act.slots[0]
    except Exception:
        pass
    st.extrapolation = 'HOLD'
    return st

def silhouette(fig, body='#050304', mid='#140c0a', lit='#4a2a18', rim='#ffb468', sheen=0.35):
    m = cine.mat_ink(f'sil_{fig.arm.name}', body, mid, lit, rim=rim, rim_width=0.25, mottle=0.06, mottle_scale=6.0, sheen=sheen, fog=True)
    for me in fig.meshes:
        me.data.materials.clear(); me.data.materials.append(m)
    return m

def attach(ob, fig, bone_key, offset=(0, 0, 0), rot=(0, 0, 0)):
    """Parent a prop to a bone. offset in metres in the bone's space (Y runs along the bone); the rig object
    carries a 0.01 scale, so the prop is counter-scaled to stay in metres."""
    ob.parent = fig.arm
    ob.parent_type = 'BONE'
    ob.parent_bone = fig.bone(bone_key)
    k = 1.0 / fig.arm.scale.x
    ob.scale = (k, k, k)
    # bone-parented children sit at the bone's TAIL; offset is measured from there
    ob.location = (offset[0] * k, offset[1] * k, offset[2] * k)
    ob.rotation_euler = rot
    return ob

IK_BONES = {
    'hero': {'Right': ('mixamorig:RightForeArm', 'mixamorig:RightHand'), 'Left': ('mixamorig:LeftForeArm', 'mixamorig:LeftHand')},
    'knight': {'Right': ('Forearm.R_48', 'Hand.R_47'), 'Left': ('Forearm.L_23', 'Hand.L_22')},
}

def reach(fig, side, target, pole=None, name=None):
    """Two-bone IK on the forearm toward a world-space point (an empty; animate the empty to animate the reach).
    Returns the target empty."""
    fore, hand = IK_BONES[fig.kind][side]
    if fore not in fig.arm.pose.bones:  # knight bone names carry numeric suffixes; find by prefix
        fore = next(b.name for b in fig.arm.pose.bones if b.name.startswith(fore.split('_')[0]))
    emp = bpy.data.objects.new(name or f'{fig.arm.name}_{side}_ik', None)
    cine.coll('PROPS').objects.link(emp); emp.location = target; emp.empty_display_size = 0.05
    c = fig.arm.pose.bones[fore].constraints.new('IK')
    c.target = emp; c.chain_count = 2; c.use_stretch = False
    if pole is not None:
        pe = bpy.data.objects.new(f'{emp.name}_pole', None); cine.coll('PROPS').objects.link(pe); pe.location = pole
        c.pole_target = pe; c.pole_angle = math.radians(-90)
    return emp

def point_fingers(fig, side, target, name=None):
    """Aim a hand's fingers (bone Y) at a world point: with the arm reaching forward, fingers up = palm flat on a wall."""
    hand = IK_BONES[fig.kind][side][1]
    emp = bpy.data.objects.new(name or f'{fig.arm.name}_{side}_aim', None)
    cine.coll('PROPS').objects.link(emp); emp.location = target
    c = fig.arm.pose.bones[hand].constraints.new('DAMPED_TRACK')
    c.target = emp; c.track_axis = 'TRACK_Y'
    return emp

def bone_world(fig, key):
    bpy.context.view_layer.update()
    pb = fig.arm.pose.bones[fig.bone(key)]
    return fig.arm.matrix_world @ pb.head

FINGERS = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')

def open_hand(fig, side='Right', spread=0.0, curl=0.0):
    """Straighten a Mixamo hand (rest pose = flat open hand); curl 0..1 bends the fingers slightly."""
    for b in fig.arm.pose.bones:
        if f'{side}Hand' in b.name and any(f in b.name for f in FINGERS):
            b.rotation_mode = 'XYZ'
            b.rotation_euler = (0.0, 0.0, 0.0)
            b.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            if curl and 'Thumb' not in b.name:
                b.rotation_mode = 'XYZ'; b.rotation_euler = (curl * 0.35, 0.0, 0.0)
    return fig

def crown_mesh(name, mat, r=0.13, h=0.1):
    """A small open crown of five points (the crest's crown), in metres."""
    mb = cine.MeshBuilder()
    mb.cylinder('PROPS', mat, 0, 0, 0, h * 0.45, r, n=20, top=False)
    for i in range(5):
        a = 2 * math.pi * i / 5
        mb.cone('PROPS', mat, r * math.cos(a), r * math.sin(a), h * 0.4, 0.028, h * (1.3 if i == 0 else 1.0), n=6)
    return mb.build(name)[0]

def cloak_mesh(name, mat, height=1.45, r_top=0.26, r_bot=0.62, open_front=0.55):
    """A heavy cloak: an open cone hanging from the shoulders (front gap faces -Y)."""
    segs = 22
    verts, faces = [], []
    gap = open_front
    for j, (z, r) in enumerate(((0.0, r_top), (-height * 0.5, (r_top + r_bot) / 2), (-height, r_bot))):
        for i in range(segs + 1):
            a = -math.pi / 2 + gap / 2 + (2 * math.pi - gap) * i / segs
            wob = 1.0 + 0.06 * math.sin(i * 1.7 + j)
            verts.append((r * wob * math.cos(a), r * wob * math.sin(a), z))
    for j in range(2):
        for i in range(segs):
            a = j * (segs + 1) + i
            faces.append((a, a + 1, a + segs + 2, a + segs + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat); cine.coll('PROPS').objects.link(ob)
    return ob

def torch_mesh(name, mat, flame_mat):
    mb = cine.MeshBuilder()
    mb.cylinder('PROPS', mat, 0, 0, -0.35, 0.35, 0.025, n=8)
    import castle, random
    castle._flame(mb, 'PROPS', flame_mat, (0, 0, 0.5), 0.12, random.Random(2))
    objs = mb.build(name)
    return objs
