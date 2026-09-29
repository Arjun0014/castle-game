"""The FINAL film: v1 up to the cut, v2 after it (the user's choice: v2's opening legend out, v1's in).

    python tools/cinematic/v2/hybrid.py            (then: CLEAN=... SHARE=... NAME=final bash tools/cinematic/v2/finish.sh)

Both films share one timeline and one soundtrack, so the cut needs no audio work. CUT is a shot boundary:
frame 627 = 26.125 s, where v1's S05 (the portcullis slams on "sealed") ends and v2's S06 (the queen and the child) begins.
v1's head is regenerated from its lossless renders through tools/cinematic/post.py (no re-compression of an old encode):
the clean picture for the game, the subtitled picture for the share master.
"""
import os, subprocess, sys, time
from multiprocessing import Pool

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'cinematic'))
import post  # noqa: E402

CUT = 627
OUT = os.path.join(ROOT, 'build', 'cinematic', 'hybrid')
V2 = os.path.join(ROOT, 'tools', 'cinematic', 'remotion', 'out', 'final')

def _job(g):
    o = post.render(g, outputs=('clean', 'portrait'))
    return g, o['clean'].tobytes(), o['portrait'].tobytes()

def _pipe(path):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1080x1920', '-r', '24', '-i', '-',
                             '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', path], stdin=subprocess.PIPE)

def main():
    os.makedirs(OUT, exist_ok=True)
    heads = {k: os.path.join(OUT, f'v1_head_{k}.mp4') for k in ('clean', 'share')}
    post.warm()
    t0 = time.time()
    pc, ps = _pipe(heads['clean']), _pipe(heads['share'])
    with Pool(4, initializer=post._init_worker, initargs=(False,)) as pool:
        for g, c, p in pool.imap(_job, range(CUT), chunksize=2):
            pc.stdin.write(c); ps.stdin.write(p)
            if g % 96 == 0: print(f'v1 frame {g}/{CUT} {time.time() - t0:.0f}s', flush=True)
    for p in (pc, ps):
        p.stdin.close(); p.wait()
    # v1 head + v2 tail (from the same frame on), high-quality masters without audio (finish.sh muxes the soundtrack)
    for k, v2 in (('clean', 'opening_v2_clean_master.mp4'), ('share', 'opening_v2_share_master.mp4')):
        dst = os.path.join(OUT, f'final_{k}_master.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', heads[k], '-i', os.path.join(V2, v2), '-filter_complex',
                        f'[1:v]trim=start_frame={CUT},setpts=PTS-STARTPTS[t];[0:v][t]concat=n=2:v=1:a=0[v]', '-map', '[v]',
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '24', dst], check=True)
        print('wrote', dst, flush=True)
    print(f'done in {time.time() - t0:.0f}s')

if __name__ == '__main__':
    main()
