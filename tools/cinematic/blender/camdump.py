"""Dump the evaluated camera of a shot pass, per frame, so post.py can pin 2-D effects to world points
(her palm on the crest, the keep, the windows) without re-deriving Blender's easing.

blender --background --factory-startup --python camdump.py -- --shot S14_glimpse [--pass past] [--out build/cinematic/cams]

-> <out>/<shot>_<pass>.json: {res: [w, h], frames: {global: {m: 4x4 world matrix, lens, sensor, fit, shift: [x, y]}}}
"""
import sys, os, json, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import cine, shots

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--shot', required=True)
ap.add_argument('--pass', dest='pass_', default=None)
ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'cinematic', 'cams'))
a = ap.parse_args(argv)

tl = json.load(open(os.path.join(ROOT, 'tools', 'cinematic', 'timeline.json'), encoding='utf-8'))
shot = next(s for s in tl['shots'] if s['id'] == a.shot)
f0, f1 = shot['frames']
n = f1 - f0
spec = shots.REGISTRY[a.shot]
pass_name = a.pass_ or spec.get('passes', ['main'])[0]

cine.reset()
cine.render_settings(pct=100, samples=1)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, n
spec['build'](pass_name=pass_name, n=n, fps=tl['fps'], shot=shot, pct=100)
out = {'shot': a.shot, 'pass': pass_name, 'res': [sc.render.resolution_x, sc.render.resolution_y], 'frames': {}}
for lf in range(1, n + 1):
    sc.frame_set(lf)
    cam = sc.camera
    cd = cam.data
    out['frames'][str(f0 + lf - 1)] = {
        'm': [list(r) for r in cam.matrix_world],
        'lens': cd.lens, 'sensor': cd.sensor_height if cd.sensor_fit == 'VERTICAL' else cd.sensor_width,
        'fit': cd.sensor_fit, 'shift': [cd.shift_x, cd.shift_y],
    }
os.makedirs(a.out, exist_ok=True)
path = os.path.join(a.out, f'{a.shot}_{pass_name}.json')
with open(path, 'w') as fh: json.dump(out, fh)
print('CAMDUMP', path, n, 'frames', flush=True)
