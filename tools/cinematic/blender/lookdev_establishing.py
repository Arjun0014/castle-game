"""Look-development: the establishing composition of Caer Veyr (portrait) in two memories.
blender --background --factory-startup --python lookdev_establishing.py -- <out_dir> [pct]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
import bpy
import cine, castle

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = argv[0] if argv else os.path.join(os.path.dirname(__file__), 'lookdev')
pct = int(argv[1]) if len(argv) > 1 else 50

cine.reset()
cine.render_settings(pct=pct, samples=16)
castle.build()
castle.terrain()
castle.backdrop()
cine.noink('CV_PRESENT_VEG', 'TERRAIN_VEG')
# low valley viewpoint, horizontal view + lens shift (verticals stay vertical, like a painting)
cam = cine.camera(loc=(-30, -370, 95), target=(-30, 0, 95), lens=35, clip=(1, 9000), shift=(0.02, 0.33))
cine.ink_lines(color='#0b0706', thickness=1.4, noise=1.0, fade=(250.0, 900.0))
cine.compositor(kuwahara=7, glare=0.55)

def clear_lights():
    for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o, do_unlink=True)

def dusk():
    castle.set_state('PAST_DUSK')
    sd = (-1.0, 0.55, 0.36)
    cine.world_sky(top='#2a1c34', horizon='#f0a060', low='#6a3a26', sun_dir=sd, sun_color='#fff0c8', sun_size=0.0004,
                   sun_glow=0.9, clouds=0.7, cloud_color='#583244', cloud_lit='#ffc684', cloud_scale=1.6, ambient='#2a1a1e', ambient_strength=1.0, cloud_squash=3.2, cloud_threshold=(0.5, 0.68), glow_from=0.9)
    cine.set_fog('#e0a070', 0.0011, start=120, maxf=0.94, base=115, falloff=30, floor=0.1)
    clear_lights()
    cine.sun('Key', sd, '#ffd49a', energy=5.0)
    cine.sun('Fill', (0.35, -1.0, 0.4), '#5a4a78', energy=0.18, shadow=False)

def night():
    castle.set_state('PRESENT_NIGHT')
    sd = (0.55, 1.0, 0.55)
    cine.world_sky(top='#05080f', horizon='#1e2e46', low='#0b1019', sun_dir=sd, sun_color='#eef4ff', sun_size=0.00045,
                   sun_glow=0.35, clouds=0.55, cloud_color='#0e1522', cloud_lit='#6a809e', cloud_scale=1.6, stars=1.3, ambient='#0c1220', ambient_strength=1.0, cloud_squash=3.2, cloud_threshold=(0.52, 0.7), glow_from=0.96)
    cine.set_fog('#34486a', 0.0012, start=120, maxf=0.94, base=115, falloff=30, floor=0.08)
    clear_lights()
    cine.sun('Moon', sd, '#c8d8ff', energy=2.4)
    cine.sun('Fill', (0.35, -1.0, 0.4), '#2a3a58', energy=0.45, shadow=False)

sc = bpy.context.scene
sc.frame_set(1)
for name, fn in (('dusk', dusk), ('night', night)):
    fn()
    sc.render.filepath = os.path.join(out, f'est_{name}.png')
    import time; t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'RENDERED {name} {time.time() - t:.1f}s', flush=True)
