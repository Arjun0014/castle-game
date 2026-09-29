"""Instruments synthesised in code for the opening film's score and sound design (numpy/scipy).

bell()      — church bell by modal synthesis: hum / prime / tierce (a minor third: bells are born minor) / quint /
              nominal / upper partials, each a slowly beating doublet with its own decay, plus a strike transient.
glass()     — glass harmonica (the Crownheart's voice): pure partials, a slow rubbed attack, a trembling sustain.
heartbeat() — the heart's double thump (lub-dub): a falling sub sine with a soft click.
drone()     — low bowed/organ-like pedal with slow motion; high_drone() a thin string harmonic haze.
riser()     — reversed-bell / filtered-noise swell into a hit.
reverb()    — convolution with a synthetic stereo hall (exponential tail that darkens as it decays).
All functions return float32 arrays shaped (n, 2) at SR.
"""
import numpy as np
from scipy import signal

SR = 48000
NOTE = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}

def hz(name):
    """'D4' -> frequency (A4 = 440)."""
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4)) / 12)

def _t(dur): return np.arange(int(dur * SR)) / SR

def stereo(x, pan=0.0, width=0.0, seed=0):
    """Mono -> stereo with equal-power pan; width adds a tiny decorrelation delay."""
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L = x * l * np.sqrt(2); R = x * r * np.sqrt(2)
    if width:
        d = int(SR * 0.0007 * width)
        R = np.concatenate([np.zeros(d), R[:len(R) - d]]) if d else R
    return np.stack([L, R], axis=1).astype(np.float32)

BELL_PARTIALS = [  # ratio to the prime, amplitude, decay (s) for a medium church bell
    (0.500, 0.40, 1.00), (1.000, 0.75, 0.80), (1.195, 0.62, 0.62), (1.498, 0.30, 0.40), (2.000, 1.00, 0.46),
    (2.520, 0.30, 0.22), (2.663, 0.26, 0.20), (3.008, 0.30, 0.16), (4.160, 0.14, 0.10), (5.430, 0.07, 0.06),
]

def bell(note, dur=None, size=1.0, amp=1.0, bright=1.0, pan=0.0, seed=0):
    """size scales decay (a big bell rings for many seconds); bright scales upper partials."""
    rng = np.random.default_rng(seed)
    f0 = hz(note) if isinstance(note, str) else float(note)
    tmax = 14.0 * size
    dur = dur or tmax
    t = _t(dur)
    y = np.zeros_like(t)
    for ratio, a, dec in BELL_PARTIALS:
        f = f0 * ratio * (1 + rng.uniform(-0.0015, 0.0015))
        if f > 16000: continue
        tau = dec * 14.0 * size * (1.0 if ratio <= 1.0 else 0.8)
        w = a * (bright ** max(0.0, np.log2(ratio)))
        beat = rng.uniform(0.15, 1.2)
        env = np.exp(-t / tau)
        y += w * env * (np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) + 0.6 * np.sin(2 * np.pi * (f + beat) * t + rng.uniform(0, 6.28)))
    # the strike: a short filtered noise burst
    n = rng.standard_normal(len(t)) * np.exp(-t / 0.012)
    b, a_ = signal.butter(2, [min(1500 * size ** -0.3, 8000) / (SR / 2), min(9000, 0.95 * SR / 2) / (SR / 2)], 'band')
    y += 0.35 * bright * signal.lfilter(b, a_, n)
    y *= np.minimum(1.0, t / 0.002)
    y = y / (np.max(np.abs(y)) + 1e-9) * amp
    return stereo(y, pan, width=1.0, seed=seed)

def glass(note, dur, amp=1.0, attack=0.35, release=1.2, vibrato=0.0025, pan=0.0, seed=0):
    rng = np.random.default_rng(seed)
    f0 = hz(note) if isinstance(note, str) else float(note)
    t = _t(dur + release)
    vib = 1 + vibrato * np.sin(2 * np.pi * 5.1 * t + rng.uniform(0, 6)) * np.minimum(1, t / 0.8)
    phase = 2 * np.pi * np.cumsum(f0 * vib) / SR
    y = np.sin(phase) + 0.28 * np.sin(2 * phase + 0.3) + 0.1 * np.sin(3 * phase + 1.1) + 0.04 * np.sin(4 * phase)
    env = np.minimum(1.0, t / attack) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 4)))
    trem = 1 + 0.12 * np.sin(2 * np.pi * 3.3 * t)
    rub = rng.standard_normal(len(t))
    b, a_ = signal.butter(2, [min(f0 * 5, 20000) / (SR / 2) * 0.9, min(f0 * 7, 22000) / (SR / 2) * 0.95], 'band')
    y = y * env * trem + 0.015 * signal.lfilter(b, a_, rub) * env
    y = y / (np.max(np.abs(y)) + 1e-9) * amp
    return stereo(y, pan, width=0.6)

def heartbeat(amp=1.0, f_hi=62.0, f_lo=36.0, second=0.62, gap=0.27):
    def thump(a):
        t = _t(0.55)
        f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.06)
        ph = 2 * np.pi * np.cumsum(f) / SR
        env = np.minimum(1, t / 0.004) * np.exp(-t / 0.13)
        click = np.random.default_rng(3).standard_normal(len(t)) * np.exp(-t / 0.004)
        b, a_ = signal.butter(2, 900 / (SR / 2))
        return a * (np.sin(ph) * env + 0.08 * signal.lfilter(b, a_, click))
    y = np.zeros(int(1.0 * SR))
    a1 = thump(1.0); y[:len(a1)] += a1
    a2 = thump(second); o = int(gap * SR); y[o:o + len(a2)] += a2[:len(y) - o]
    return stereo(y / np.max(np.abs(y)) * amp)

def drone(freqs, dur, amp=1.0, swell=2.0, seed=0, saw=0.35, cutoff=420.0):
    rng = np.random.default_rng(seed)
    t = _t(dur)
    y = np.zeros_like(t)
    for i, f in enumerate(freqs):
        mod = 1 + 0.15 * np.sin(2 * np.pi * (0.07 + 0.03 * i) * t + rng.uniform(0, 6))
        ph = 2 * np.pi * np.cumsum(f * (1 + 0.0015 * np.sin(2 * np.pi * 0.2 * t + i))) / SR
        s = np.sin(ph)
        sw = 2 * ((ph / (2 * np.pi)) % 1.0) - 1.0
        y += mod * ((1 - saw) * s + saw * sw) / (1 + i * 0.4)
    b, a_ = signal.butter(3, cutoff / (SR / 2))
    y = signal.lfilter(b, a_, y)
    env = np.minimum(1.0, t / swell) * np.minimum(1.0, (dur - t) / min(swell, dur / 2))
    y = y * env
    return stereo(y / (np.max(np.abs(y)) + 1e-9) * amp, width=1.0)

def high_drone(notes, dur, amp=1.0, swell=3.0, seed=1):
    rng = np.random.default_rng(seed)
    t = _t(dur); y = np.zeros_like(t)
    for n in notes:
        f = hz(n)
        for k in range(4):
            det = f * (1 + rng.uniform(-0.004, 0.004))
            y += np.sin(2 * np.pi * det * t + rng.uniform(0, 6)) * (1 + 0.3 * np.sin(2 * np.pi * rng.uniform(4, 7) * t))
    env = np.minimum(1.0, t / swell) * np.minimum(1.0, (dur - t) / min(swell, dur / 2))
    y *= env
    return stereo(y / (np.max(np.abs(y)) + 1e-9) * amp, width=2.0)

def riser(dur, amp=1.0, f0=200.0, f1=5000.0, seed=2):
    """A band of noise sweeping upward (STFT mask), swelling into the next hit."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR); x = rng.standard_normal(n)
    f, tt, Z = signal.stft(x, SR, nperseg=2048)
    for j in range(Z.shape[1]):
        fc = f0 * (f1 / f0) ** min(1.0, tt[j] / dur)
        Z[:, j] *= np.exp(-0.5 * (np.log2(np.maximum(f, 1.0) / fc) / 0.35) ** 2)
    _, y = signal.istft(Z, SR, nperseg=2048)
    y = y[:n]
    t = np.arange(len(y)) / SR
    env = (t / dur) ** 2.2
    return stereo(y / (np.max(np.abs(y)) + 1e-9) * env * amp, width=2.0)

def ring(freq, dur, amp=0.1, decay=None):
    t = _t(dur)
    env = np.exp(-t / (decay or dur / 3)) * np.minimum(1, t / 0.01)
    return stereo(np.sin(2 * np.pi * freq * t) * env * amp)

def reverb_ir(seconds=4.5, predelay=0.025, damp=0.55, seed=5, er=True):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR); t = np.arange(n) / SR
    out = []
    for ch in range(2):
        x = rng.standard_normal(n)
        env = 10 ** (-3 * t / seconds)
        # darker as it decays: blend a low-passed copy in over time
        b, a_ = signal.butter(2, 2500 / (SR / 2)); lp = signal.lfilter(b, a_, x)
        mix = np.minimum(1.0, t / (seconds * damp))
        y = (x * (1 - mix) + lp * mix * 1.6) * env
        if er:
            for d, g in ((0.011, 0.5), (0.019, 0.35), (0.031, 0.3), (0.047, 0.22), (0.063, 0.18)):
                k = int((d + (0.002 * ch)) * SR)
                if k < n: y[k] += g * 8
        pd = int(predelay * SR)
        y = np.concatenate([np.zeros(pd), y])[:n]
        out.append(y)
    ir = np.stack(out, axis=1)
    return (ir / np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))).astype(np.float32)

def reverb(x, ir, wet=0.35, dry=1.0):
    """x (n, 2) -> x convolved; output length = len(x) + len(ir) - 1."""
    yl = signal.fftconvolve(x[:, 0], ir[:, 0]); yr = signal.fftconvolve(x[:, 1], ir[:, 1])
    y = np.stack([yl, yr], axis=1) * wet
    y[:len(x)] += x * dry
    return y.astype(np.float32)
