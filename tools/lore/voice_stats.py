"""Acoustic fingerprint of narration audio (voice consistency checks for the lore narration).

python tools/lore/voice_stats.py <file|dir> [...]  [--json out.json]

Per file: duration, loudness (active-speech RMS dBFS), median F0 and its 10-90th percentile range (Hz), spectral
centroid of voiced frames (Hz, "brightness"), share of silence. Two takes of the same voice with the same direction
should sit within ~1 semitone of F0 and ~10 % of centroid of each other.
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 16000


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def stats(path):
    x = pcm(path)
    hop, win = 160, 1024
    n = max(0, (len(x) - win) // hop)
    if n == 0:
        return {'file': os.path.basename(path), 'duration': round(len(x) / SR, 2)}
    idx = np.arange(win)[None, :] + hop * np.arange(n)[:, None]
    frames = x[idx] * np.hanning(win)[None, :]
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    active = rms > max(0.01, np.percentile(rms, 95) * 0.1)
    spec = np.abs(np.fft.rfft(frames, n=2 * win, axis=1))
    # autocorrelation via the power spectrum -> pitch in 60..400 Hz
    ac = np.fft.irfft(spec ** 2, axis=1)[:, :win]
    lo, hi = SR // 400, SR // 60
    lag = lo + np.argmax(ac[:, lo:hi], axis=1)
    strength = ac[np.arange(n), lag] / np.maximum(ac[:, 0], 1e-9)
    voiced = active & (strength > 0.45)
    f0 = SR / lag[voiced]
    freqs = np.fft.rfftfreq(2 * win, 1 / SR)
    cen = (spec[voiced] * freqs[None, :]).sum(1) / np.maximum(spec[voiced].sum(1), 1e-9)
    return {
        'file': os.path.basename(path), 'duration': round(len(x) / SR, 2),
        'loudnessDb': round(float(20 * np.log10(np.sqrt(np.mean(rms[active] ** 2)) + 1e-9)), 1) if active.any() else None,
        'f0Median': round(float(np.median(f0)), 1) if len(f0) else None,
        'f0P10': round(float(np.percentile(f0, 10)), 1) if len(f0) else None,
        'f0P90': round(float(np.percentile(f0, 90)), 1) if len(f0) else None,
        'centroid': round(float(np.median(cen)), 0) if len(cen) else None,
        'silence': round(float(1 - active.mean()), 2),
    }


if __name__ == '__main__':
    args = sys.argv[1:]
    out = None
    if '--json' in args:
        i = args.index('--json')
        out = args[i + 1]
        args = args[:i] + args[i + 2:]
    files = []
    for a in args:
        if os.path.isdir(a):
            files += [os.path.join(a, f) for f in sorted(os.listdir(a)) if f.lower().endswith(('.mp3', '.ogg', '.wav', '.opus'))]
        else:
            files.append(a)
    rows = [stats(f) for f in files]
    for r in rows:
        print(json.dumps(r))
    if out:
        json.dump(rows, open(out, 'w'), indent=1)
