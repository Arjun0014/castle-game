"""Render key frames of every shot/pass (or a subset) and build a contact sheet for review.

    python tools/cinematic/render_keys.py [--pct 30] [--frames key] [--only S12_gate,S13_touch] [--sheet out.png]
"""
import argparse, json, os, subprocess, sys, time, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLENDER = r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
SHOT_PASSES = {
    'S01_heart': ['main'], 'S02_blood': ['wide', 'kneel', 'drop'], 'S03_rise': ['shaft', 'castle'], 'S04_war': ['dusk', 'war'],
    'S05_sealed': ['main'], 'S06_child': ['main'], 'S07_descent': ['main'], 'S08_asking': ['main'], 'S09a_surge': ['main'],
    'S09b_sundering': ['past', 'present'], 'S10_centuries': ['main'], 'S11_road': ['main'], 'S12_gate': ['main'],
    'S13_touch': ['main'], 'S14_glimpse': ['past', 'present'], 'S15_ruin': ['main'], 'S16_threshold': ['main'],
}
# key frames for passes that only cover part of their shot
PASS_FRAMES = {('S02_blood', 'wide'): '1,18,36,90,166', ('S02_blood', 'kneel'): '37,48,59', ('S02_blood', 'drop'): '60,66,70,76',
               ('S03_rise', 'shaft'): '1,20,40,56', ('S03_rise', 'castle'): '49,70,95,120,156'}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pct', type=int, default=30)
    ap.add_argument('--frames', default='key')
    ap.add_argument('--only', default='')
    ap.add_argument('--sheet', default=os.path.join(ROOT, 'build', 'cinematic', 'review', 'sheet.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'cinematic', 'review', 'frames'))
    a = ap.parse_args()
    only = [s for s in a.only.split(',') if s]
    rows = []
    t0 = time.time()
    for shot, passes in SHOT_PASSES.items():
        if only and shot not in only: continue
        for p in passes:
            frames = PASS_FRAMES.get((shot, p), a.frames)
            cmd = [BLENDER, '--background', '--factory-startup', '--python', os.path.join(ROOT, 'tools', 'cinematic', 'blender', 'render_shot.py'),
                   '--', '--shot', shot, '--pass', p, '--pct', str(a.pct), '--frames', frames, '--samples', '12', '--out', a.out]
            t = time.time()
            r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            errs = [l for l in (r.stdout + r.stderr).splitlines() if 'Traceback' in l or 'Error:' in l and 'strokes set empty' not in l or 'rror:' in l and 'strokes' not in l]
            print(f'{shot}/{p}: {time.time() - t:.0f}s rc={r.returncode}', ('ERR ' + ' | '.join(errs[:3])) if errs else '', flush=True)
            if r.returncode != 0 or any('Traceback' in l for l in errs):
                tail = [l for l in (r.stdout + r.stderr).splitlines()][-12:]
                print('   ' + '\n   '.join(tail))
            rows.append((shot, p, sorted(glob.glob(os.path.join(a.out, shot, p, '*.png')))))
    sheet(rows, a.sheet)
    print(f'total {time.time() - t0:.0f}s -> {a.sheet}')

def sheet(rows, path):
    from PIL import Image, ImageDraw
    rows = [r for r in rows if r[2]]
    if not rows: return
    th = 300
    ims = [[Image.open(f) for f in fs] for _, _, fs in rows]
    tw = max(int(im.width * th / im.height) for r in ims for im in r)
    cols = max(len(r) for r in ims)
    W = 170 + cols * (tw + 6); H = len(rows) * (th + 6)
    out = Image.new('RGB', (W, H), (10, 10, 12))
    d = ImageDraw.Draw(out)
    for i, ((shot, p, fs), r) in enumerate(zip(rows, ims)):
        y = i * (th + 6)
        d.text((6, y + 6), f'{shot}\n{p}', fill=(220, 210, 190))
        for j, (f, im) in enumerate(zip(fs, r)):
            t = im.resize((int(im.width * th / im.height), th))
            out.paste(t, (170 + j * (tw + 6), y))
            d.text((172 + j * (tw + 6), y + 2), os.path.basename(f)[1:5], fill=(255, 255, 0))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path)

if __name__ == '__main__':
    main()
