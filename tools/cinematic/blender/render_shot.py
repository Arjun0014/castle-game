"""Render one shot (or one pass of a shot) of the opening film.

blender --background --factory-startup --python render_shot.py -- --shot S04_war [--pass war] [--pct 50]
        [--frames all|first|mid|last|a-b|a,b,c] [--samples 16] [--out build/cinematic/frames]

Frames are numbered on the FILM clock (global frame = shot start frame + local index), so post.py can assemble
any mix of passes by time. Shot builders live in shot_*.py and register themselves in shots.REGISTRY.
"""
import sys, os, json, time, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import cine, shots

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--shot', required=True)
ap.add_argument('--pass', dest='pass_', default=None)
ap.add_argument('--pct', type=int, default=50)
ap.add_argument('--frames', default='all')
ap.add_argument('--samples', type=int, default=16)
ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'cinematic', 'frames'))
a = ap.parse_args(argv)

tl = json.load(open(os.path.join(ROOT, 'tools', 'cinematic', 'timeline.json'), encoding='utf-8'))
shot = next(s for s in tl['shots'] if s['id'] == a.shot)
f0, f1 = shot['frames']
n = f1 - f0
spec = shots.REGISTRY[a.shot]
passes = spec.get('passes', ['main'])
pass_name = a.pass_ or passes[0]
assert pass_name in passes, f'{a.shot} has passes {passes}'

cine.reset()
cine.render_settings(pct=a.pct, samples=a.samples, motion_blur=spec.get('motion_blur', False))
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, n
spec['build'](pass_name=pass_name, n=n, fps=tl['fps'], shot=shot, pct=a.pct)

def parse_frames(spec):
    if spec == 'all': return list(range(1, n + 1))
    words = {'first': [1], 'mid': [max(1, n // 2)], 'last': [n],
             'key': [1, max(1, n // 4), max(1, n // 2), max(1, 3 * n // 4), n]}
    out = []
    for tok in spec.split(','):
        tok = tok.strip()
        if tok in words: out += words[tok]
        elif '-' in tok:
            x, y = tok.split('-'); out += list(range(int(x), int(y) + 1))
        elif tok.startswith('/'):  # every k-th frame: /4
            out += list(range(1, n + 1, int(tok[1:])))
        else: out.append(int(tok))
    return sorted({f for f in out if 1 <= f <= n})
local = parse_frames(a.frames)

out_dir = os.path.join(a.out, a.shot, pass_name)
os.makedirs(out_dir, exist_ok=True)
t0 = time.time()
for lf in local:
    sc.frame_set(lf)
    spec.get('per_frame', lambda **k: None)(frame=lf, n=n, pass_name=pass_name)
    sc.render.filepath = os.path.join(out_dir, f'f{f0 + lf - 1:04d}.png')
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'RENDERED {a.shot}/{pass_name} local {lf}/{n} global {f0 + lf - 1} in {time.time() - t:.1f}s', flush=True)
print(f'DONE {a.shot}/{pass_name}: {len(local)} frames in {time.time() - t0:.0f}s', flush=True)
