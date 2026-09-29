"""Acoustic comparison of heroine voice takes (auditions or generated lines).

python tools/voice/analyze.py [dir]   (default assets/audio/voice/auditions)

Per take: median F0, F0 range (10-90th pct, semitones), speaking rate (spoken characters / voiced span),
loudness contrast between the quiet opening and the angry close (dB), pitch contrast (semitones), pause share.
Uses each take's ElevenLabs character alignment to find the segments.
"""
import json, os, subprocess, sys
import numpy as np

SR = 16000
d = sys.argv[1] if len(sys.argv) > 1 else os.path.join('assets', 'audio', 'voice', 'auditions')


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def f0_track(x, hop=160, win=640, fmin=70, fmax=420):
    out = []
    for i in range(0, len(x) - win, hop):
        f = x[i:i + win] - x[i:i + win].mean()
        e = np.sqrt(np.mean(f * f))
        if e < 0.012:
            out.append((0.0, e)); continue
        ac = np.correlate(f, f, 'full')[win - 1:]
        lo, hi = SR // fmax, SR // fmin
        k = lo + int(np.argmax(ac[lo:hi]))
        conf = ac[k] / (ac[0] + 1e-9)
        out.append((SR / k if conf > 0.45 else 0.0, e))
    return np.array(out)


def seg_stats(tr, t0, t1, hop=160):
    a, b = int(t0 * SR / hop), int(t1 * SR / hop)
    s = tr[a:b]
    v = s[s[:, 0] > 0]
    f0 = float(np.median(v[:, 0])) if len(v) else 0.0
    db = 20 * np.log10(np.sqrt(np.mean(s[:, 1] ** 2)) + 1e-9) if len(s) else -99
    return f0, db


for fn in sorted(os.listdir(d)):
    if not fn.endswith('.mp3'):
        continue
    meta_p = os.path.join(d, fn[:-4] + '.json')
    meta = json.load(open(meta_p)) if os.path.exists(meta_p) else {}
    x = pcm(os.path.join(d, fn))
    tr = f0_track(x)
    voiced = tr[tr[:, 0] > 0]
    f0 = voiced[:, 0]
    med = float(np.median(f0))
    p10, p90 = np.percentile(f0, [10, 90])
    rng = 12 * np.log2(p90 / p10)
    dur = len(x) / SR
    active = float(np.mean(tr[:, 1] > 0.012))
    line = f'{fn[:-4]:10s} dur {dur:5.2f}s  F0 med {med:5.1f} Hz  range {rng:4.1f} st  speech {active*100:4.1f}%'
    al = meta.get('alignment')
    if al:
        chars = ''.join(al['characters'])
        st, en = al['character_start_times_seconds'], al['character_end_times_seconds']
        def span(phrase):
            i = chars.find(phrase)
            return (st[i], en[i + len(phrase) - 1]) if i >= 0 else None
        q, a = span('That gate was whole'), span('My own blood did this')
        if q and a:
            fq, dq = seg_stats(tr, *q)
            fa, da = seg_stats(tr, *a)
            line += f'  quiet {fq:5.1f}Hz {dq:5.1f}dB -> angry {fa:5.1f}Hz {da:5.1f}dB  (pitch +{12*np.log2(max(fa,1)/max(fq,1)):4.1f} st, loud +{da-dq:4.1f} dB)'
        spoken = sum(1 for c in chars if c.isalpha())
        line += f'  rate {spoken / max(0.1, en[-1] - st[0]):4.1f} ch/s'
    print(line)
