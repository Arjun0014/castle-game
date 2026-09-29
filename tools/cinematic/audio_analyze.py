"""Objective voice/music measurements (so audio can be judged without ears).

    python tools/cinematic/audio_analyze.py voice a.mp3 [b.mp3 ...]   -> pitch/pace/texture table
    python tools/cinematic/audio_analyze.py env file.wav [hop]        -> loudness envelope (LUFS-ish) per hop

Decodes with ffmpeg to mono float. Pitch: YIN (numpy). Roughness: cycle-to-cycle F0 jitter. Breathiness proxy:
high-band (4-8 kHz) energy share in voiced frames. Pauses: runs of frames 35 dB below the loud floor.
"""
import subprocess, sys, json, os
import numpy as np

def load(path, sr=22050):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr

def yin(x, sr, fmin=60, fmax=500, frame=1024, hop=256, thresh=0.12):
    tau_min, tau_max = int(sr / fmax), int(sr / fmin)
    f0 = []
    for s in range(0, len(x) - frame - tau_max, hop):
        seg = x[s:s + frame + tau_max]
        w = seg[:frame]
        if np.sqrt(np.mean(w ** 2)) < 0.01:
            f0.append(0.0); continue
        d = np.array([np.sum((seg[:frame] - seg[t:t + frame]) ** 2) for t in range(tau_max + 1)])
        cmnd = np.ones_like(d); run = np.cumsum(d[1:]); cmnd[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(run, 1e-9)
        idx = np.where(cmnd[tau_min:] < thresh)[0]
        if len(idx) == 0:
            f0.append(0.0); continue
        t = idx[0] + tau_min
        while t + 1 < len(cmnd) and cmnd[t + 1] < cmnd[t]: t += 1
        f0.append(sr / t)
    return np.array(f0), hop

def voice_stats(path):
    x, sr = load(path)
    dur = len(x) / sr
    f0, hop = yin(x, sr)
    v = f0[f0 > 0]
    # pauses: 20 ms frames, silence = < loud floor - 35 dB
    fl = int(sr * 0.02); n = len(x) // fl
    rms = np.sqrt(np.mean(x[:n * fl].reshape(n, fl) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    loud = np.percentile(db, 90)
    sil = db < loud - 35
    pauses, run = [], 0
    for s in sil:
        if s: run += 1
        else:
            if run * 0.02 >= 0.25: pauses.append(run * 0.02)
            run = 0
    speech = (~sil).sum() * 0.02
    # jitter: relative diff of consecutive voiced f0
    j = []
    for a, b in zip(f0[:-1], f0[1:]):
        if a > 0 and b > 0 and abs(a - b) / a < 0.2: j.append(abs(a - b) / a)
    # breathiness proxy
    spec_hi, spec_all = 0.0, 0.0
    step = 1024
    for s in range(0, len(x) - step, step * 4):
        w = x[s:s + step] * np.hanning(step)
        if np.sqrt(np.mean(w ** 2)) < 0.02: continue
        S = np.abs(np.fft.rfft(w)) ** 2; fr = np.fft.rfftfreq(step, 1 / sr)
        spec_hi += S[(fr > 4000) & (fr < 8000)].sum(); spec_all += S[(fr > 80) & (fr < 8000)].sum()
    cent = []
    for s in range(0, len(x) - step, step * 4):
        w = x[s:s + step] * np.hanning(step)
        if np.sqrt(np.mean(w ** 2)) < 0.02: continue
        S = np.abs(np.fft.rfft(w)); fr = np.fft.rfftfreq(step, 1 / sr)
        cent.append((S * fr).sum() / max(S.sum(), 1e-9))
    return {
        'file': os.path.basename(path), 'dur': round(dur, 2), 'speech_s': round(speech, 2),
        'f0_med': round(float(np.median(v)), 1) if len(v) else 0, 'f0_p10': round(float(np.percentile(v, 10)), 1) if len(v) else 0,
        'f0_p90': round(float(np.percentile(v, 90)), 1) if len(v) else 0,
        'range_st': round(float(12 * np.log2(np.percentile(v, 90) / np.percentile(v, 10))), 1) if len(v) else 0,
        'jitter_%': round(100 * float(np.median(j)), 2) if j else 0, 'hi_band_%': round(100 * spec_hi / max(spec_all, 1e-9), 2),
        'centroid_hz': round(float(np.median(cent)), 0) if cent else 0,
        'pauses': len(pauses), 'pause_mean_s': round(float(np.mean(pauses)), 2) if pauses else 0,
        'peak_db': round(float(20 * np.log10(np.max(np.abs(x)) + 1e-9)), 1),
    }

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def chroma(path, fmin=55.0, fmax=2000.0, t0=0.0, t1=None):
    """Pitch-class energy (12 bins, normalised) + tonality (share of spectral energy near equal-tempered pitches)."""
    x, sr = load(path)
    a = int(t0 * sr); b = int(t1 * sr) if t1 else len(x)
    x = x[a:b]
    n = 8192; hop = 2048
    ch = np.zeros(12); tonal, total = 0.0, 0.0
    freqs = np.fft.rfftfreq(n, 1 / sr)
    sel = (freqs >= fmin) & (freqs <= fmax)
    f = freqs[sel]
    midi = 69 + 12 * np.log2(f / 440.0)
    pc = np.mod(np.round(midi), 12).astype(int)
    dev = np.abs(midi - np.round(midi))
    for s in range(0, max(1, len(x) - n), hop):
        w = x[s:s + n] * np.hanning(n)
        S = np.abs(np.fft.rfft(w))[sel] ** 2
        if S.sum() < 1e-9: continue
        for k in range(12): ch[k] += S[pc == k].sum()
        tonal += S[dev < 0.18].sum(); total += S.sum()
    ch = ch / max(ch.sum(), 1e-12)
    return ch, tonal / max(total, 1e-12)

def key_guess(ch):
    """Krumhansl-Schmuckler correlation against major/minor profiles."""
    maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    best = []
    for k in range(12):
        for name, prof in (('major', maj), ('minor', mnr)):
            r = np.corrcoef(ch, np.roll(prof, k))[0, 1]
            best.append((r, f'{NOTES[k]} {name}'))
    best.sort(reverse=True)
    return best[:3]

def envelope(path, hop=0.5):
    x, sr = load(path)
    h = int(sr * hop); n = len(x) // h
    rms = np.sqrt(np.mean(x[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)
    return [round(float(20 * np.log10(r)), 1) for r in rms]

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'voice':
        rows = [voice_stats(p) for p in sys.argv[2:]]
        keys = list(rows[0].keys())
        print(' | '.join(keys))
        for r in rows: print(' | '.join(str(r[k]) for k in keys))
    elif mode == 'env':
        hop = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
        e = envelope(sys.argv[2], hop)
        print(json.dumps(e))
