"""Cinematic toolkit for Blender 5.2 (headless). Everything in the opening film is built by these functions.

Look: "ink, ember and gold". Surfaces are shaded non-photorealistically: EEVEE lighting is captured with
Shader-to-RGB, pushed through a painted value ramp (ink shadow -> body -> lit edge), mottled with brush-scale
noise and given a rim. Gilded memory (the Past's lights, the Crownheart) is emissive gold. The compositor adds a
painterly Kuwahara pass and bloom; grading, paper, flakes and titles happen later in tools/cinematic/post.py.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Euler, Matrix

# ---------------------------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    import mathutils
    try: bpy.context.preferences.filepaths.use_scripts_auto_execute = True
    except Exception: pass
    bpy.app.driver_namespace['noise'] = mathutils.noise
    return sc

# ---------------------------------------------------------------------------------------------- aerial perspective
def fog_group():
    """Shared shader group: every NPR material fades toward FogColor with camera distance (exp falloff).
    Change it per memory with set_fog(); all materials follow."""
    g = bpy.data.node_groups.get('Fog')
    if g: return g
    g = bpy.data.node_groups.new('Fog', 'ShaderNodeTree')
    g.interface.new_socket(name='Color', in_out='INPUT', socket_type='NodeSocketColor')
    g.interface.new_socket(name='Color', in_out='OUTPUT', socket_type='NodeSocketColor')
    N, L = g.nodes, g.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    cam = N.new('ShaderNodeCameraData')
    fc = N.new('ShaderNodeRGB'); fc.name = 'FogColor'; fc.outputs[0].default_value = (0.2, 0.2, 0.25, 1)
    dens = N.new('ShaderNodeValue'); dens.name = 'FogDensity'; dens.outputs[0].default_value = 0.0012
    start = N.new('ShaderNodeValue'); start.name = 'FogStart'; start.outputs[0].default_value = 0.0
    maxf = N.new('ShaderNodeValue'); maxf.name = 'FogMax'; maxf.outputs[0].default_value = 0.92
    sub = N.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.use_clamp = False
    L.new(cam.outputs['View Distance'], sub.inputs[0]); L.new(start.outputs[0], sub.inputs[1])
    clampd = N.new('ShaderNodeMath'); clampd.operation = 'MAXIMUM'; L.new(sub.outputs[0], clampd.inputs[0]); clampd.inputs[1].default_value = 0.0
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; L.new(clampd.outputs[0], mul.inputs[0]); L.new(dens.outputs[0], mul.inputs[1])
    # height factor: thicker below FogBase (exp falloff), a thin floor of haze above
    geo = N.new('ShaderNodeNewGeometry'); sz = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sz.inputs[0])
    base = N.new('ShaderNodeValue'); base.name = 'FogBase'; base.outputs[0].default_value = -1e6
    fall = N.new('ShaderNodeValue'); fall.name = 'FogFalloff'; fall.outputs[0].default_value = 60.0
    dz = N.new('ShaderNodeMath'); dz.operation = 'SUBTRACT'; L.new(base.outputs[0], dz.inputs[0]); L.new(sz.outputs['Z'], dz.inputs[1])
    dzd = N.new('ShaderNodeMath'); dzd.operation = 'DIVIDE'; L.new(dz.outputs[0], dzd.inputs[0]); L.new(fall.outputs[0], dzd.inputs[1])
    hexp = N.new('ShaderNodeMath'); hexp.operation = 'EXPONENT'; L.new(dzd.outputs[0], hexp.inputs[0])
    hcl = N.new('ShaderNodeMath'); hcl.operation = 'MINIMUM'; L.new(hexp.outputs[0], hcl.inputs[0]); hcl.inputs[1].default_value = 6.0
    floor_ = N.new('ShaderNodeValue'); floor_.name = 'FogFloor'; floor_.outputs[0].default_value = 1.0
    hsum = N.new('ShaderNodeMath'); hsum.operation = 'ADD'; L.new(hcl.outputs[0], hsum.inputs[0]); L.new(floor_.outputs[0], hsum.inputs[1])
    mulh = N.new('ShaderNodeMath'); mulh.operation = 'MULTIPLY'; L.new(mul.outputs[0], mulh.inputs[0]); L.new(hsum.outputs[0], mulh.inputs[1])
    neg = N.new('ShaderNodeMath'); neg.operation = 'MULTIPLY'; L.new(mulh.outputs[0], neg.inputs[0]); neg.inputs[1].default_value = -1.0
    ex = N.new('ShaderNodeMath'); ex.operation = 'EXPONENT'; L.new(neg.outputs[0], ex.inputs[0])
    one = N.new('ShaderNodeMath'); one.operation = 'SUBTRACT'; one.inputs[0].default_value = 1.0; L.new(ex.outputs[0], one.inputs[1])
    lim = N.new('ShaderNodeMath'); lim.operation = 'MULTIPLY'; L.new(one.outputs[0], lim.inputs[0]); L.new(maxf.outputs[0], lim.inputs[1])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    L.new(lim.outputs[0], mix.inputs['Factor']); L.new(gi.outputs['Color'], mix.inputs['A']); L.new(fc.outputs[0], mix.inputs['B'])
    L.new(mix.outputs['Result'], go.inputs['Color'])
    return g

def set_fog(color, density, start=0.0, maxf=0.92, base=None, falloff=60.0, floor=1.0):
    """density: per metre of view distance; base/falloff: height fog (z below base thickens exponentially);
    floor: haze weight everywhere (1 = uniform fog, 0.1 = mostly height fog)."""
    g = fog_group()
    g.nodes['FogColor'].outputs[0].default_value = hexc(color)
    g.nodes['FogDensity'].outputs[0].default_value = density
    g.nodes['FogStart'].outputs[0].default_value = start
    g.nodes['FogMax'].outputs[0].default_value = maxf
    g.nodes['FogBase'].outputs[0].default_value = -1e6 if base is None else base
    g.nodes['FogFalloff'].outputs[0].default_value = falloff
    g.nodes['FogFloor'].outputs[0].default_value = floor

def render_settings(res=(1080, 1920), pct=100, fps=24, samples=24, motion_blur=False, transparent=False):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = pct
    sc.render.fps = fps
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '8'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    ee = sc.eevee
    ee.taa_render_samples = samples
    for attr, val in (('use_volumetric_shadows', True), ('volumetric_tile_size', '8'), ('volumetric_samples', 64),
                      ('volumetric_end', 3000.0), ('volumetric_start', 1.0), ('use_shadows', True),
                      ('shadow_ray_count', 1), ('shadow_step_count', 6), ('use_raytracing', False),
                      ('fast_gi_method', 'GLOBAL_ILLUMINATION')):
        try: setattr(ee, attr, val)
        except Exception: pass
    sc.render.use_motion_blur = motion_blur
    try:
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
        sc.view_settings.exposure = 0.0
        sc.view_settings.gamma = 1.0
    except Exception: pass
    return sc

# ---------------------------------------------------------------------------------------------- compositor
def compositor(kuwahara=7, uniformity=4, sharpness=0.6, eccentricity=1.0, glare=0.7, glare_threshold=0.85, glare_size=7):
    """Painterly Kuwahara (anisotropic) + fog-glow bloom. kuwahara is in pixels at 1080 wide (scaled with pct)."""
    sc = bpy.context.scene
    sc.render.use_compositing = True
    ng = bpy.data.node_groups.new('CineComp', 'CompositorNodeTree')
    ng.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    sc.compositing_node_group = ng
    N, L = ng.nodes, ng.links
    rl = N.new('CompositorNodeRLayers')
    out = N.new('NodeGroupOutput')
    cur = rl.outputs['Image']
    scale = sc.render.resolution_percentage / 100.0 * sc.render.resolution_x / 1080.0
    if kuwahara:
        kw = N.new('CompositorNodeKuwahara')
        _set_input(kw, 'Size', max(2, round(kuwahara * scale)))
        _set_input(kw, 'Type', 'Anisotropic')
        _set_input(kw, 'Uniformity', uniformity)
        _set_input(kw, 'Sharpness', sharpness)
        _set_input(kw, 'Eccentricity', eccentricity)
        _set_input(kw, 'High Precision', True)
        L.new(cur, kw.inputs['Image']); cur = kw.outputs[0]
    if glare:
        gl = N.new('CompositorNodeGlare')
        _set_input(gl, 'Type', 'Fog Glow')
        _set_input(gl, 'Threshold', glare_threshold)
        _set_input(gl, 'Strength', glare)
        _set_input(gl, 'Size', glare_size)
        _set_input(gl, 'Quality', 'High')
        L.new(cur, gl.inputs['Image']); cur = gl.outputs['Image']
    # Freestyle ink lines arrive as their own pass: laid over the painterly image so they stay crisp
    fs_out = rl.outputs.get('Freestyle')
    if fs_out is not None and sc.render.use_freestyle:
        ao = N.new('CompositorNodeAlphaOver')
        img_inputs = [i for i in ao.inputs if i.type == 'RGBA']
        L.new(cur, img_inputs[0]); L.new(fs_out, img_inputs[1])
        cur = ao.outputs[0]
    L.new(cur, out.inputs[0])
    return ng

def ink_lines(color='#0a0707', thickness=1.6, crease=128.0, noise=1.2, fade=(300.0, 1600.0), pass_only=True):
    """Freestyle contours: silhouettes, borders and sharp creases with a hand-drawn wobble, thinner and fainter
    with distance. Rendered as a separate pass (composited over the painterly image by compositor())."""
    sc = bpy.context.scene
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = 'RELATIVE'
    vl = sc.view_layers[0]
    vl.use_freestyle = True
    try: vl.freestyle_settings.as_render_pass = pass_only
    except Exception: pass
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(crease)
    ls_set = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ink')
    ls_set.select_by_visibility = True; ls_set.visibility = 'VISIBLE'
    ls_set.select_by_edge_types = True
    ls_set.select_silhouette = True; ls_set.select_border = True; ls_set.select_crease = True
    ls_set.select_external_contour = True
    noink = bpy.data.collections.get('NOINK') or bpy.data.collections.new('NOINK')
    ls_set.select_by_collection = True; ls_set.collection = noink; ls_set.collection_negation = 'EXCLUSIVE'
    st = ls_set.linestyle
    if st is None:
        st = bpy.data.linestyles.new('ink'); ls_set.linestyle = st
    st.color = hexc(color)[:3]
    st.thickness = thickness
    st.chaining = 'PLAIN'; st.use_same_object = True
    for m in list(st.thickness_modifiers): st.thickness_modifiers.remove(m)
    for m in list(st.alpha_modifiers): st.alpha_modifiers.remove(m)
    for m in list(st.geometry_modifiers):
        if m.type not in ('SAMPLING',): st.geometry_modifiers.remove(m)
    tk = st.thickness_modifiers.new('along', 'ALONG_STROKE')  # tapered brush ends
    tk.mapping = 'CURVE'
    try:
        c = tk.curve; pts = c.curves[0].points
        pts[0].location = (0.0, 0.25); pts[1].location = (1.0, 0.25); pts.new(0.5, 1.0); c.update()
    except Exception: pass
    dk = st.thickness_modifiers.new('dist', 'DISTANCE_FROM_CAMERA'); dk.range_min, dk.range_max = fade; dk.value_min, dk.value_max = 1.0, 0.35
    dk.mapping = 'LINEAR'; dk.blend = 'MULTIPLY'
    da = st.alpha_modifiers.new('dist', 'DISTANCE_FROM_CAMERA'); da.range_min, da.range_max = fade; da.mapping = 'LINEAR'; da.blend = 'MULTIPLY'
    da.invert = True
    if noise:
        gn = st.geometry_modifiers.new('wobble', 'PERLIN_NOISE_1D'); gn.frequency = 8.0; gn.amplitude = noise; gn.octaves = 2
    return st

def _set_input(node, name, value):
    """Blender 5 moved most node options to inputs; fall back to properties for older layouts."""
    sock = node.inputs.get(name)
    if sock is not None:
        try:
            sock.default_value = value
            return
        except Exception:
            pass
    ident = name.lower().replace(' ', '_')
    for cand in (ident, 'glare_type' if name == 'Type' else ident, 'variation' if name == 'Type' else ident):
        if hasattr(node, cand):
            try:
                v = value.upper().replace(' ', '_') if isinstance(value, str) else value
                setattr(node, cand, v)
                return
            except Exception:
                continue

def noink(*names):
    """Exclude these collections from the ink lines (vegetation masses read as paint, not doodles)."""
    ni = bpy.data.collections.get('NOINK') or bpy.data.collections.new('NOINK')
    for n in names:
        c = bpy.data.collections.get(n)
        if c and c.name not in [x.name for x in ni.children]: ni.children.link(c)

# ---------------------------------------------------------------------------------------------- materials
def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    return nt.nodes, nt.links

def hexc(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

def mat_ink(name, dark, body, lit, rim=None, rim_width=0.35, mottle=0.18, mottle_scale=0.35, bands=(0.18, 0.55),
            height_fade=None, emission_boost=1.0, fog=True, sheen=0.28, masonry=None, masonry_strength=0.55, rim_power=2.5):
    """Painterly NPR surface. dark/body/lit are hex colours of the value ramp (shadow -> mid -> lit).
    mottle: brush-scale colour variation; height_fade: (z0, z1, hex) fades toward a colour with world height."""
    m = bpy.data.materials.new(name)
    N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    dif = N.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    bw = N.new('ShaderNodeRGBToBW'); L.new(s2r.outputs['Color'], bw.inputs[0])
    # brush mottling shifts the lighting value a little (paint is never flat)
    tc = N.new('ShaderNodeTexCoord')
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = mottle_scale; nz.inputs['Detail'].default_value = 6.0
    nz.inputs['Roughness'].default_value = 0.62; nz.inputs['Distortion'].default_value = 0.6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    # plus vertical brush streaks (weathering runs down stone; paint is dragged)
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, 1.0, 0.12)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz2 = N.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = mottle_scale * 4.0; nz2.inputs['Detail'].default_value = 3.0
    L.new(mp.outputs['Vector'], nz2.inputs['Vector'])
    mixn = N.new('ShaderNodeMix'); mixn.data_type = 'FLOAT'; mixn.inputs['Factor'].default_value = 0.45
    L.new(nz.outputs['Fac'], mixn.inputs['A']); L.new(nz2.outputs['Fac'], mixn.inputs['B'])
    mix_v = N.new('ShaderNodeMath'); mix_v.operation = 'MULTIPLY_ADD'
    L.new(mixn.outputs['Result'], mix_v.inputs[0]); mix_v.inputs[1].default_value = mottle; mix_v.inputs[2].default_value = -mottle * 0.5
    add = N.new('ShaderNodeMath'); add.operation = 'ADD'; add.use_clamp = True
    L.new(bw.outputs[0], add.inputs[0]); L.new(mix_v.outputs[0], add.inputs[1])
    ramp = N.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp; cr.interpolation = 'EASE'
    cr.elements[0].position = 0.0; cr.elements[0].color = hexc(dark)
    cr.elements[1].position = bands[1] + 0.25; cr.elements[1].color = hexc(lit)
    e = cr.elements.new(bands[0]); e.color = hexc(body)
    L.new(add.outputs[0], ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    if rim:
        lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = rim_width
        rimc = N.new('ShaderNodeMix'); rimc.data_type = 'RGBA'; rimc.blend_type = 'MIX'
        # rim only where the surface is lit a little (a backlit edge, not a glow everywhere)
        gate = N.new('ShaderNodeMath'); gate.operation = 'MULTIPLY'
        rp = N.new('ShaderNodeMath'); rp.operation = 'POWER'; L.new(lw.outputs['Facing'], rp.inputs[0]); rp.inputs[1].default_value = rim_power
        L.new(rp.outputs[0], gate.inputs[0])
        sm = N.new('ShaderNodeMapRange'); sm.inputs['From Min'].default_value = 0.02; sm.inputs['From Max'].default_value = 0.25
        L.new(bw.outputs[0], sm.inputs['Value']); L.new(sm.outputs['Result'], gate.inputs[1])
        L.new(gate.outputs[0], rimc.inputs['Factor'])
        L.new(col, rimc.inputs['A']); rimc.inputs['B'].default_value = hexc(rim)
        col = rimc.outputs['Result']
        # sky sheen: faces seen at a grazing angle pick up the sky behind them (keeps backlit forms legible)
        if sheen > 0:
            lw2 = N.new('ShaderNodeLayerWeight'); lw2.inputs['Blend'].default_value = 0.5
            pw = N.new('ShaderNodeMath'); pw.operation = 'POWER'; L.new(lw2.outputs['Facing'], pw.inputs[0]); pw.inputs[1].default_value = 2.2
            sf = N.new('ShaderNodeMath'); sf.operation = 'MULTIPLY'; L.new(pw.outputs[0], sf.inputs[0]); sf.inputs[1].default_value = sheen
            sh = N.new('ShaderNodeMix'); sh.data_type = 'RGBA'; sh.blend_type = 'MIX'
            L.new(sf.outputs[0], sh.inputs['Factor']); L.new(col, sh.inputs['A']); sh.inputs['B'].default_value = hexc(rim)
            col = sh.outputs['Result']
    if height_fade:
        z0, z1, fc = height_fade
        sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'] if False else N.new('ShaderNodeNewGeometry').outputs['Position'], sep.inputs[0])
        mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = z0; mr.inputs['From Max'].default_value = z1
        L.new(sep.outputs['Z'], mr.inputs['Value'])
        hm = N.new('ShaderNodeMix'); hm.data_type = 'RGBA'
        L.new(mr.outputs['Result'], hm.inputs['Factor']); L.new(col, hm.inputs['A']); hm.inputs['B'].default_value = hexc(fc)
        col = hm.outputs['Result']
    if masonry:
        # stone courses: a brick pattern in world space on (x + y, z); the joints darken the colour (inked joints)
        geo = N.new('ShaderNodeNewGeometry'); sp = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sp.inputs[0])
        hx = N.new('ShaderNodeMath'); hx.operation = 'ADD'; L.new(sp.outputs['X'], hx.inputs[0]); L.new(sp.outputs['Y'], hx.inputs[1])
        cv = N.new('ShaderNodeCombineXYZ'); L.new(hx.outputs[0], cv.inputs['X']); L.new(sp.outputs['Z'], cv.inputs['Y'])
        br = N.new('ShaderNodeTexBrick')
        bw_, bh_ = masonry
        br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = bw_; br.inputs['Row Height'].default_value = bh_
        br.inputs['Mortar Size'].default_value = 0.03; br.inputs['Mortar Smooth'].default_value = 0.4; br.offset = 0.5
        br.squash = 1.35; br.squash_frequency = 2; br.offset_frequency = 2
        br.inputs['Bias'].default_value = 0.1
        br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.86, 0.86, 0.86, 1); br.inputs['Mortar'].default_value = (0, 0, 0, 1)
        L.new(cv.outputs[0], br.inputs['Vector'])
        bf = N.new('ShaderNodeRGBToBW'); L.new(br.outputs['Color'], bf.inputs[0])
        mm = N.new('ShaderNodeMapRange'); mm.inputs['To Min'].default_value = 1.0 - masonry_strength; L.new(bf.outputs[0], mm.inputs['Value'])
        mc = N.new('ShaderNodeMix'); mc.data_type = 'RGBA'; mc.blend_type = 'MULTIPLY'; mc.inputs['Factor'].default_value = 1.0
        L.new(col, mc.inputs['A'])
        cc = N.new('ShaderNodeCombineColor'); L.new(mm.outputs['Result'], cc.inputs[0]); L.new(mm.outputs['Result'], cc.inputs[1]); L.new(mm.outputs['Result'], cc.inputs[2])
        L.new(cc.outputs[0], mc.inputs['B']); col = mc.outputs['Result']
    if fog:
        fg = N.new('ShaderNodeGroup'); fg.node_tree = fog_group()
        L.new(col, fg.inputs['Color']); col = fg.outputs['Color']
    em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = emission_boost
    L.new(col, em.inputs['Color']); L.new(em.outputs[0], out.inputs['Surface'])
    return m

def mat_emit(name, color, strength=4.0, flicker=0.0, seed=0.0):
    """Emissive gold/fire. flicker animates strength with a noise driver (per material)."""
    m = bpy.data.materials.new(name)
    N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = hexc(color); em.inputs['Strength'].default_value = strength
    L.new(em.outputs[0], out.inputs['Surface'])
    if flicker:
        d = em.inputs['Strength'].driver_add('default_value').driver
        d.type = 'SCRIPTED'
        d.expression = f'{strength}*(1.0+{flicker}*noise.noise((frame*0.21+{seed},{seed}*3.1,0.0)))'
    return m

def mat_flat(name, color, alpha=1.0):
    m = bpy.data.materials.new(name)
    N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = hexc(color); em.inputs['Strength'].default_value = 1.0
    if alpha < 1.0:
        tr = N.new('ShaderNodeBsdfTransparent'); mx = N.new('ShaderNodeMixShader'); mx.inputs['Fac'].default_value = alpha
        L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'BLENDED'
    else:
        L.new(em.outputs[0], out.inputs['Surface'])
    return m

def world_sky(top='#1b1622', horizon='#b86a3c', low='#2a1810', sun_dir=(0.0, 1.0, 0.08), sun_color='#ffd9a0', sun_size=0.012,
              sun_glow=0.18, clouds=0.55, cloud_color='#3a2530', cloud_lit='#e0a060', cloud_scale=2.2, stars=0.0,
              volume_density=0.0, volume_color='#ffffff', volume_aniso=0.3, strength=1.0, ambient='#101014', ambient_strength=1.0,
              glow_from=0.8, cloud_squash=3.0, cloud_threshold=(0.5, 0.64)):
    """Painted sky: vertical gradient, drifting brushy cloud bands lit toward the sun, sun/moon disk + glow."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new('Sky'); sc.world = w
    w.use_nodes = True
    nt = w.node_tree; N, L = nt.nodes, nt.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputWorld')
    tc = N.new('ShaderNodeTexCoord')
    dirn = N.new('ShaderNodeVectorMath'); dirn.operation = 'NORMALIZE'; L.new(tc.outputs['Generated'], dirn.inputs[0])
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(dirn.outputs[0], sep.inputs[0])
    grad = N.new('ShaderNodeValToRGB'); cr = grad.color_ramp; cr.interpolation = 'EASE'
    cr.elements[0].position = 0.40; cr.elements[0].color = hexc(low)
    cr.elements[1].position = 0.95; cr.elements[1].color = hexc(top)
    e = cr.elements.new(0.52); e.color = hexc(horizon)
    zmap = N.new('ShaderNodeMapRange'); zmap.inputs['From Min'].default_value = -1.0; zmap.inputs['From Max'].default_value = 1.0
    L.new(sep.outputs['Z'], zmap.inputs['Value']); L.new(zmap.outputs['Result'], grad.inputs['Fac'])
    col = grad.outputs['Color']
    sd = Vector(sun_dir).normalized()
    sdot = N.new('ShaderNodeVectorMath'); sdot.operation = 'DOT_PRODUCT'
    L.new(dirn.outputs[0], sdot.inputs[0]); sdot.inputs[1].default_value = sd
    # clouds: stretched noise in direction space, drifting with the frame
    if clouds > 0:
        mapn = N.new('ShaderNodeMapping'); mapn.inputs['Scale'].default_value = (cloud_scale * 0.7, cloud_scale * 0.7, cloud_scale * cloud_squash)
        L.new(dirn.outputs[0], mapn.inputs['Vector'])
        drv = mapn.inputs['Location'].driver_add('default_value', 0).driver; drv.type = 'SCRIPTED'; drv.expression = 'frame*0.0009'
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.6; nz.inputs['Detail'].default_value = 7.0
        nz.inputs['Roughness'].default_value = 0.52; nz.inputs['Distortion'].default_value = 0.25
        L.new(mapn.outputs['Vector'], nz.inputs['Vector'])
        cm = N.new('ShaderNodeMapRange'); cm.inputs['From Min'].default_value = cloud_threshold[0]; cm.inputs['From Max'].default_value = cloud_threshold[1]
        L.new(nz.outputs['Fac'], cm.inputs['Value'])
        # only above the horizon band
        hz = N.new('ShaderNodeMapRange'); hz.inputs['From Min'].default_value = -0.02; hz.inputs['From Max'].default_value = 0.18
        L.new(sep.outputs['Z'], hz.inputs['Value'])
        amt = N.new('ShaderNodeMath'); amt.operation = 'MULTIPLY'; L.new(cm.outputs['Result'], amt.inputs[0]); L.new(hz.outputs['Result'], amt.inputs[1])
        amt2 = N.new('ShaderNodeMath'); amt2.operation = 'MULTIPLY'; L.new(amt.outputs[0], amt2.inputs[0]); amt2.inputs[1].default_value = clouds
        # cloud colour: lit toward the sun
        litm = N.new('ShaderNodeMapRange'); litm.inputs['From Min'].default_value = 0.2; litm.inputs['From Max'].default_value = 1.0
        L.new(sdot.outputs['Value'], litm.inputs['Value'])
        cc = N.new('ShaderNodeMix'); cc.data_type = 'RGBA'; L.new(litm.outputs['Result'], cc.inputs['Factor'])
        cc.inputs['A'].default_value = hexc(cloud_color); cc.inputs['B'].default_value = hexc(cloud_lit)
        mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; L.new(amt2.outputs[0], mixc.inputs['Factor'])
        L.new(col, mixc.inputs['A']); L.new(cc.outputs['Result'], mixc.inputs['B']); col = mixc.outputs['Result']
    if stars > 0:
        vs = N.new('ShaderNodeTexVoronoi'); vs.inputs['Scale'].default_value = 380.0
        L.new(dirn.outputs[0], vs.inputs['Vector'])
        st = N.new('ShaderNodeMapRange'); st.inputs['From Min'].default_value = 0.035; st.inputs['From Max'].default_value = 0.0
        L.new(vs.outputs['Distance'], st.inputs['Value'])
        stz = N.new('ShaderNodeMapRange'); stz.inputs['From Min'].default_value = 0.05; stz.inputs['From Max'].default_value = 0.5
        L.new(sep.outputs['Z'], stz.inputs['Value'])
        sm = N.new('ShaderNodeMath'); sm.operation = 'MULTIPLY'; L.new(st.outputs['Result'], sm.inputs[0]); L.new(stz.outputs['Result'], sm.inputs[1])
        sm2 = N.new('ShaderNodeMath'); sm2.operation = 'MULTIPLY'; L.new(sm.outputs[0], sm2.inputs[0]); sm2.inputs[1].default_value = stars
        addc = N.new('ShaderNodeMix'); addc.data_type = 'RGBA'; addc.blend_type = 'ADD'; L.new(sm2.outputs[0], addc.inputs['Factor'])
        L.new(col, addc.inputs['A']); addc.inputs['B'].default_value = (0.9, 0.95, 1.0, 1.0); col = addc.outputs['Result']
    # sun / moon disk and glow
    disk = N.new('ShaderNodeMapRange'); disk.inputs['From Min'].default_value = 1.0 - sun_size * 1.15; disk.inputs['From Max'].default_value = 1.0 - sun_size
    L.new(sdot.outputs['Value'], disk.inputs['Value'])
    glow = N.new('ShaderNodeMapRange'); glow.inputs['From Min'].default_value = glow_from; glow.inputs['From Max'].default_value = 1.0
    L.new(sdot.outputs['Value'], glow.inputs['Value'])
    gpow = N.new('ShaderNodeMath'); gpow.operation = 'POWER'; L.new(glow.outputs['Result'], gpow.inputs[0]); gpow.inputs[1].default_value = 3.0
    gm = N.new('ShaderNodeMath'); gm.operation = 'MULTIPLY'; L.new(gpow.outputs[0], gm.inputs[0]); gm.inputs[1].default_value = sun_glow
    tot = N.new('ShaderNodeMath'); tot.operation = 'ADD'; tot.use_clamp = True; L.new(disk.outputs['Result'], tot.inputs[0]); L.new(gm.outputs[0], tot.inputs[1])
    sunc = N.new('ShaderNodeMix'); sunc.data_type = 'RGBA'; L.new(tot.outputs[0], sunc.inputs['Factor'])
    L.new(col, sunc.inputs['A']); sunc.inputs['B'].default_value = hexc(sun_color); col = sunc.outputs['Result']
    bg = N.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength
    L.new(col, bg.inputs['Color'])
    # the painted sky is only for the camera; surfaces get a dim ambient (so ink stays dark and lights read)
    amb = N.new('ShaderNodeBackground'); amb.inputs['Color'].default_value = hexc(ambient); amb.inputs['Strength'].default_value = ambient_strength
    lp = N.new('ShaderNodeLightPath')
    ms = N.new('ShaderNodeMixShader'); L.new(lp.outputs['Is Camera Ray'], ms.inputs['Fac'])
    L.new(amb.outputs[0], ms.inputs[1]); L.new(bg.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs['Surface'])
    if volume_density > 0:
        vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = volume_density
        vol.inputs['Color'].default_value = hexc(volume_color); vol.inputs['Anisotropy'].default_value = volume_aniso
        L.new(vol.outputs[0], out.inputs['Volume'])
    return w

# ---------------------------------------------------------------------------------------------- lights / camera
def sun(name, direction, color='#ffffff', energy=3.0, angle=0.02, shadow=True):
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy = energy; ld.color = hexc(color)[:3]; ld.angle = angle
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(ob)
    d = Vector(direction).normalized()
    ob.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return ob

def point(name, loc, color='#ffb060', energy=500.0, radius=0.5, shadow=False):
    ld = bpy.data.lights.new(name, 'POINT'); ld.energy = energy; ld.color = hexc(color)[:3]; ld.shadow_soft_size = radius
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    return ob

def camera(name='Cam', loc=(0, -10, 2), target=(0, 0, 2), lens=50.0, clip=(0.1, 5000.0), dof=None, shift=(0.0, 0.0)):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 36.0
    cd.clip_start, cd.clip_end = clip
    cd.shift_x, cd.shift_y = shift
    if dof:
        cd.dof.use_dof = True; cd.dof.focus_distance = dof[0]; cd.dof.aperture_fstop = dof[1]
    ob = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; look_at(ob, target)
    bpy.context.scene.camera = ob
    return ob

def look_at(ob, target, roll=0.0):
    d = Vector(target) - ob.location
    q = d.to_track_quat('-Z', 'Y')
    ob.rotation_euler = q.to_euler()
    if roll: ob.rotation_euler.rotate_axis('Z', roll)

def key_camera(cam, keys, interp='BEZIER'):
    """keys: [(frame, loc, target, lens?)]"""
    for k in keys:
        f, loc, tgt = k[0], k[1], k[2]
        cam.location = loc; look_at(cam, tgt)
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
        if len(k) > 3 and k[3]:
            cam.data.lens = k[3]; cam.data.keyframe_insert('lens', frame=f)
    ease(cam, interp); ease(cam.data, interp)

def ease(idblock, interp='BEZIER'):
    ad = idblock.animation_data
    if not ad or not ad.action: return
    for fc in _fcurves(ad.action):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
            kp.easing = 'AUTO'

def _fcurves(action):
    """Blender 5 layered actions keep fcurves in channelbags; older ones on action.fcurves."""
    fcs = list(getattr(action, 'fcurves', []) or [])
    if fcs: return fcs
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for cb in getattr(strip, 'channelbags', []):
                out.extend(cb.fcurves)
    return out

# ---------------------------------------------------------------------------------------------- collections
def coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in [x.name for x in (parent or bpy.context.scene.collection).children]:
        (parent or bpy.context.scene.collection).children.link(c)
    return c

def show(collection_name, on=True):
    c = bpy.data.collections.get(collection_name)
    if c: c.hide_render = not on; c.hide_viewport = not on

# ---------------------------------------------------------------------------------------------- geometry
class MeshBuilder:
    """Accumulates polygons, one object per (collection, material[, tag]) batch. Set .tag to split elements into
    their own objects (e.g. to animate the castle growing element by element)."""
    def __init__(self):
        self.batches = {}
        self.tag = None
    def poly(self, collection, mat, pts):
        key = (collection, mat.name) if self.tag is None else (collection, mat.name, self.tag)
        b = self.batches.setdefault(key, {'mat': mat, 'coll': collection, 'v': [], 'f': [], 'tag': self.tag})
        base = len(b['v']); b['v'].extend(pts); b['f'].append(tuple(range(base, base + len(pts))))
    def box(self, c, mat, x0, x1, y0, y1, z0, z1, top=True, bottom=False, skew_top=0.0):
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        if top: f.append((4, 5, 6, 7))
        if bottom: f.append((3, 2, 1, 0))
        for q in f: self.poly(c, mat, [p[i] for i in q])
    def oriented_box(self, c, mat, center, size, rot=(0, 0, 0)):
        R = Euler(rot).to_matrix()
        hx, hy, hz = (s / 2 for s in size)
        corners = [Vector((sx * hx, sy * hy, sz * hz)) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
        P = [tuple(Vector(center) + R @ v) for v in corners]
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.poly(c, mat, [P[i] for i in q])
    def cylinder(self, c, mat, x, y, z0, z1, r, n=20, top=True, r_top=None, jag=None, rng=None):
        rt = r if r_top is None else r_top
        ring0 = [(x + r * math.cos(2 * math.pi * i / n), y + r * math.sin(2 * math.pi * i / n), z0) for i in range(n)]
        tops = []
        for i in range(n):
            zz = z1
            if jag and rng: zz = z1 - rng.random() * jag
            tops.append((x + rt * math.cos(2 * math.pi * i / n), y + rt * math.sin(2 * math.pi * i / n), zz))
        for i in range(n):
            j = (i + 1) % n
            self.poly(c, mat, [ring0[i], ring0[j], tops[j], tops[i]])
        if top and not jag: self.poly(c, mat, tops)
    def cone(self, c, mat, x, y, z0, r, h, n=20):
        apex = (x, y, z0 + h)
        ring = [(x + r * math.cos(2 * math.pi * i / n), y + r * math.sin(2 * math.pi * i / n), z0) for i in range(n)]
        for i in range(n): self.poly(c, mat, [ring[i], ring[(i + 1) % n], apex])
    def pyramid(self, c, mat, x, y, z0, hw, h):
        a = (x, y, z0 + h); q = [(x - hw, y - hw, z0), (x + hw, y - hw, z0), (x + hw, y + hw, z0), (x - hw, y + hw, z0)]
        for i in range(4): self.poly(c, mat, [q[i], q[(i + 1) % 4], a])
    def gable(self, c, mat, x0, x1, y0, y1, z0, h, along='x', overhang=0.6):
        """Pitched roof. along = ridge direction."""
        if along == 'x':
            ym = (y0 + y1) / 2; x0 -= overhang * 0.5; x1 += overhang * 0.5; y0 -= overhang; y1 += overhang
            r0, r1 = (x0, ym, z0 + h), (x1, ym, z0 + h)
            self.poly(c, mat, [(x0, y0, z0), (x1, y0, z0), r1, r0]); self.poly(c, mat, [(x1, y1, z0), (x0, y1, z0), r0, r1])
            self.poly(c, mat, [(x0, y1, z0), (x0, y0, z0), r0]); self.poly(c, mat, [(x1, y0, z0), (x1, y1, z0), r1])
        else:
            xm = (x0 + x1) / 2; y0 -= overhang * 0.5; y1 += overhang * 0.5; x0 -= overhang; x1 += overhang
            r0, r1 = (xm, y0, z0 + h), (xm, y1, z0 + h)
            self.poly(c, mat, [(x1, y0, z0), (x1, y1, z0), r1, r0]); self.poly(c, mat, [(x0, y1, z0), (x0, y0, z0), r0, r1])
            self.poly(c, mat, [(x0, y0, z0), (x1, y0, z0), r0]); self.poly(c, mat, [(x1, y1, z0), (x0, y1, z0), r1])
    def crenels(self, c, mat, pts, z, h=1.6, w=1.4, gap=1.1, depth=1.2, rng=None, missing=0.0):
        """Merlons along a polyline at height z."""
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            L = math.hypot(bx - ax, by - ay)
            if L < 0.01: continue
            ux, uy = (bx - ax) / L, (by - ay) / L
            n = int(L // (w + gap))
            for i in range(n):
                if rng and rng.random() < missing: continue
                t = i * (w + gap) + gap * 0.5
                cx, cy = ax + ux * (t + w / 2), ay + uy * (t + w / 2)
                ang = math.atan2(uy, ux)
                hh = h * (0.4 + 0.6 * rng.random()) if (rng and missing > 0) else h
                self.oriented_box(c, mat, (cx, cy, z + hh / 2), (w, depth, hh), (0, 0, ang))
    def quad_window(self, c, mat, center, normal_angle, w, h, off=0.05):
        cx, cy, cz = center
        nx, ny = math.cos(normal_angle), math.sin(normal_angle)
        tx, ty = -ny, nx
        px, py = cx + nx * off, cy + ny * off
        self.poly(c, mat, [(px - tx * w / 2, py - ty * w / 2, cz - h / 2), (px + tx * w / 2, py + ty * w / 2, cz - h / 2),
                           (px + tx * w / 2, py + ty * w / 2, cz + h / 2), (px - tx * w / 2, py - ty * w / 2, cz + h / 2)])
    def build(self, name_prefix):
        objs = []
        for key, b in self.batches.items():
            cname, mname = key[0], key[1]
            me = bpy.data.meshes.new(f'{name_prefix}_{cname}_{mname}' + (f'_{b["tag"]}' if b.get('tag') else ''))
            me.from_pydata(b['v'], [], b['f'])
            me.validate(clean_customdata=False); me.update()
            mat = b['mat']
            role = getattr(mat, 'role', None)
            if role is not None:  # role placeholder: real materials are assigned per memory later
                mat = bpy.data.materials.get('role_' + role) or bpy.data.materials.new('role_' + role)
            ob = bpy.data.objects.new(me.name, me); ob.data.materials.append(mat)
            if role is not None: ob['role'] = role
            if b.get('tag'): ob['tag'] = b['tag']
            coll(cname).objects.link(ob)
            objs.append(ob)
        self.batches = {}
        return objs

def heightfield(name, collection, mat, size, res, fn, origin=(0, 0, 0)):
    """Grid mesh with z = fn(x, y)."""
    import numpy as np
    nx, ny = res
    xs = np.linspace(-size[0] / 2, size[0] / 2, nx) + origin[0]
    ys = np.linspace(-size[1] / 2, size[1] / 2, ny) + origin[1]
    verts = [(float(x), float(y), float(fn(x, y)) + origin[2]) for y in ys for x in xs]
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(ny - 1) for i in range(nx - 1)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat); coll(collection).objects.link(ob)
    return ob

# ---------------------------------------------------------------------------------------------- foliage
def grass_tuft(mb, coll, mat, x, y, z, rng, h=0.45, blades=14, spread=0.18):
    """A tuft of thin blades (triangles) leaning outward."""
    for i in range(blades):
        a = rng.uniform(0, 2 * math.pi); r = rng.uniform(0, spread * 0.4)
        bx, by = x + r * math.cos(a), y + r * math.sin(a)
        hh = h * rng.uniform(0.5, 1.15); lean = rng.uniform(0.15, 0.55) * hh
        w = rng.uniform(0.012, 0.028)
        tx, ty = bx + lean * math.cos(a), by + lean * math.sin(a)
        px, py = -math.sin(a) * w, math.cos(a) * w
        mb.poly(coll, mat, [(bx - px, by - py, z), (bx + px, by + py, z), (tx, ty, z + hh)])

def ivy_patch(mb, coll, mat, origin, u, v, n, size, rng, droop=0.0):
    """Many small leaves (quads) scattered over a wall region: origin + a*u + b*v (u, v in-plane vectors)."""
    ox, oy, oz = origin
    for i in range(n):
        a, b = rng.random(), 1.0 - rng.random() ** (1.0 + droop)   # droop > 0: denser toward the top (hangs down)
        c = (ox + a * u[0] + b * v[0], oy + a * u[1] + b * v[1], oz + a * u[2] + b * v[2])
        s = size * rng.uniform(0.6, 1.4); t = rng.uniform(0, 2 * math.pi)
        d1 = (math.cos(t) * s, 0.0, math.sin(t) * s); d2 = (-math.sin(t) * s * 0.6, 0.0, math.cos(t) * s * 0.6)
        off = rng.uniform(-0.06, -0.01)
        mb.poly(coll, mat, [(c[0] - d1[0], c[1] + off, c[2] - d1[2]), (c[0] + d2[0], c[1] + off - 0.02, c[2] + d2[2]),
                            (c[0] + d1[0], c[1] + off, c[2] + d1[2]), (c[0] - d2[0], c[1] + off + 0.02, c[2] - d2[2])])

# ---------------------------------------------------------------------------------------------- noise (python side)
def hash2(x, y, s=0):
    h = math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
    return h - math.floor(h)

def vnoise(x, y, s=0):
    xi, yi = math.floor(x), math.floor(y); xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = hash2(xi, yi, s), hash2(xi + 1, yi, s)
    c, d = hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

def fbm(x, y, oct=5, s=0):
    t, amp, f, norm = 0.0, 1.0, 1.0, 0.0
    for i in range(oct):
        t += amp * vnoise(x * f, y * f, s + i * 13); norm += amp; amp *= 0.5; f *= 2.03
    return t / norm

# ---------------------------------------------------------------------------------------------- render
def render_frames(out_dir, frames, prefix='f'):
    import os, time
    sc = bpy.context.scene
    os.makedirs(out_dir, exist_ok=True)
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out_dir, f'{prefix}{f:04d}.png')
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'RENDERED {f} in {time.time() - t:.1f}s', flush=True)
