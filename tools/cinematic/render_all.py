"""Render every pass the edit needs at final resolution, with two Blender workers, resumable.

    python tools/cinematic/render_all.py [--pct 100] [--workers 2] [--only S12_gate,...]

Each job renders one shot pass over the frame ranges the edit uses (local frames, see JOBS). Frames that already
exist are skipped, so the command can be re-run after an interruption. Log: build/cinematic/render_all.log.
"""
import argparse, json, os, subprocess, threading, time, queue

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BLENDER = r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
OUT = os.path.join(ROOT, 'build', 'cinematic', 'frames')
# heavy first (they set the total time), light ones fill in
JOBS = [
    ('S11_road', 'main', 'all'), ('S16_threshold', 'main', 'all'), ('S12_gate', 'main', 'all'), ('S05_sealed', 'main', 'all'),
    ('S14_glimpse', 'past', 'all'), ('S14_glimpse', 'present', 'all'), ('S13_touch', 'main', 'all'), ('S15_ruin', 'main', 'all'),
    ('S09b_sundering', 'present', 'all'), ('S09b_sundering', 'past', '1-100'), ('S10_centuries', 'main', 'all'),
    ('S04_war', 'war', 'all'), ('S04_war', 'dusk', '1-30'), ('S03_rise', 'castle', '47-156'), ('S03_rise', 'shaft', '1-58'),
    ('S01_heart', 'main', 'all'), ('S02_blood', 'wide', '1-38,78-166'), ('S02_blood', 'kneel', '36-62'), ('S02_blood', 'drop', '57-82'),
    ('S06_child', 'main', 'all'), ('S07_descent', 'main', 'all'), ('S08_asking', 'main', 'all'), ('S09a_surge', 'main', 'all'),
]

def expand(spec, n):
    if spec == 'all': return list(range(1, n + 1))
    out = []
    for tok in spec.split(','):
        a, b = tok.split('-'); out += list(range(int(a), int(b) + 1))
    return [f for f in out if 1 <= f <= n]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pct', type=int, default=100)
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--only', default='')
    ap.add_argument('--samples', type=int, default=16)
    a = ap.parse_args()
    tl = json.load(open(os.path.join(ROOT, 'tools', 'cinematic', 'timeline.json'), encoding='utf-8'))
    shots = {s['id']: s for s in tl['shots']}
    only = [s for s in a.only.split(',') if s]
    log = open(os.path.join(ROOT, 'build', 'cinematic', 'render_all.log'), 'a', encoding='utf-8')
    q = queue.Queue()
    total = 0
    for shot, p, spec in JOBS:
        if only and shot not in only: continue
        f0, f1 = shots[shot]['frames']; n = f1 - f0
        need = [lf for lf in expand(spec, n) if not os.path.exists(os.path.join(OUT, shot, p, f'f{f0 + lf - 1:04d}.png'))]
        if not need: continue
        total += len(need)
        # compress to ranges
        rngs, s0, prev = [], need[0], need[0]
        for f in need[1:] + [None]:
            if f is None or f != prev + 1:
                rngs.append(f'{s0}-{prev}' if s0 != prev else f'{s0}'); s0 = f
            prev = f if f is not None else prev
        q.put((shot, p, ','.join(rngs), len(need)))
    print(f'{q.qsize()} jobs, {total} frames', flush=True); log.write(f'--- {time.ctime()} {q.qsize()} jobs, {total} frames\n'); log.flush()
    lock = threading.Lock()
    done = [0]
    t0 = time.time()
    def worker(wid):
        while True:
            try: shot, p, frames, cnt = q.get_nowait()
            except queue.Empty: return
            cmd = [BLENDER, '--background', '--factory-startup', '--python', os.path.join(ROOT, 'tools', 'cinematic', 'blender', 'render_shot.py'),
                   '--', '--shot', shot, '--pass', p, '--pct', str(a.pct), '--frames', frames, '--samples', str(a.samples), '--out', OUT]
            ts = time.time()
            r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            ok = r.returncode == 0 and 'Traceback' not in (r.stdout + r.stderr)
            with lock:
                done[0] += cnt
                msg = f'[w{wid}] {shot}/{p} {cnt} frames in {time.time() - ts:.0f}s {"ok" if ok else "FAILED"}  ({done[0]}/{total}, {time.time() - t0:.0f}s elapsed)'
                print(msg, flush=True); log.write(msg + '\n')
                if not ok: log.write('\n'.join((r.stdout + r.stderr).splitlines()[-20:]) + '\n')
                log.flush()
    th = [threading.Thread(target=worker, args=(i,)) for i in range(a.workers)]
    for t in th: t.start()
    for t in th: t.join()
    print(f'all done in {time.time() - t0:.0f}s', flush=True); log.write(f'all done in {time.time() - t0:.0f}s\n')

if __name__ == '__main__':
    main()
