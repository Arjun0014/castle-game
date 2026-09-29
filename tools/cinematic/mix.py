"""THE CASTLE REMEMBERS — the opening film's soundtrack: narration + score + sound design, mixed in code.

    python tools/cinematic/mix.py            -> build/cinematic/audio/{mix.wav, narration.wav, music.wav, sfx.wav}

Inputs: assets/audio/cinematic/narration/A.mp3 (ElevenLabs v3), assets/audio/cinematic/sfx/*.mp3 (ElevenLabs sound
generation: orchestral texture stems t_* and effects sfx_*), CC0 recordings in assets/audio/_downloads, and the
instruments in synth.py. Every event is placed on the film clock from timeline.json.

The score's identity: the "Veyr theme" is rung on church bells (D minor: bells carry a minor third in their
own overtones) and echoed by the glass harmonica of the Crownheart; orchestral stems are pitch-corrected into D.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import synth
from synth import SR, bell, glass, heartbeat, drone, high_drone, riser, ring, reverb_ir, reverb, hz

TL = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
DUR = TL['duration'] + 1.0
N = int(DUR * SR)
SFX = os.path.join(ROOT, 'assets', 'audio', 'cinematic', 'sfx')
DL = os.path.join(ROOT, 'assets', 'audio', '_downloads')
OUT = os.path.join(ROOT, 'build', 'cinematic', 'audio')
CACHE = os.path.join(ROOT, 'build', 'cinematic', 'audio', 'cache')
os.makedirs(CACHE, exist_ok=True)

def db(x): return 10 ** (x / 20.0)

def load(path, pitch=0.0, tempo=1.0, reverse=False):
    """Decode to (n, 2) float32 @ SR, optionally pitch-shifted (semitones) / time-stretched with rubberband."""
    key = f'{os.path.basename(path)}_{pitch:+.2f}_{tempo:.3f}_{int(reverse)}.f32'
    cp = os.path.join(CACHE, key)
    if not os.path.exists(cp):
        af = []
        if pitch or tempo != 1.0:
            af.append(f'rubberband=pitch={2 ** (pitch / 12):.6f}:tempo={tempo:.6f}:transients=smooth:window=long')
        if reverse: af.append('areverse')
        cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR)] + (['-af', ','.join(af)] if af else []) + ['-f', 'f32le', cp]
        subprocess.run(cmd, check=True)
    return np.fromfile(cp, dtype=np.float32).reshape(-1, 2)

def sfx(name, **k): return load(os.path.join(SFX, name + '_0.mp3'), **k)

def normalize(x, peak_db=-1.0):
    return x / (np.max(np.abs(x)) + 1e-9) * db(peak_db)

class Bus:
    def __init__(self, name): self.name = name; self.x = np.zeros((N, 2), np.float32)
    def add(self, clip, t, gain_db=0.0, fade_in=0.0, fade_out=0.0, length=None, start=0.0):
        """Place clip at film time t (s). start: offset into the clip; length: max seconds; fades in seconds."""
        c = clip[int(start * SR):]
        if length is not None: c = c[:int(length * SR)]
        c = c.copy()
        n = len(c)
        if fade_in > 0:
            k = min(n, int(fade_in * SR)); c[:k] *= np.linspace(0, 1, k)[:, None] ** 1.5
        if fade_out > 0:
            k = min(n, int(fade_out * SR)); c[n - k:] *= np.linspace(1, 0, k)[:, None] ** 1.5
        a = int(t * SR)
        if a < 0: c = c[-a:]; a = 0
        b = min(N, a + len(c))
        if b > a: self.x[a:b] += c[:b - a] * db(gain_db)
        return self
    def gain_curve(self, points):
        """Multiply by a piecewise-linear gain curve [(t, dB)]."""
        ts = np.array([p[0] for p in points]); gs = np.array([db(p[1]) for p in points])
        g = np.interp(np.arange(N) / SR, ts, gs)
        self.x *= g[:, None].astype(np.float32)

def env_follow(x, attack=0.03, release=0.35):
    m = np.abs(x).max(axis=1)
    out = np.zeros_like(m); a = np.exp(-1 / (attack * SR)); r = np.exp(-1 / (release * SR)); v = 0.0
    # vectorised enough for 70 s: process in chunks
    for i in range(len(m)):
        v = a * v + (1 - a) * m[i] if m[i] > v else r * v + (1 - r) * m[i]
        out[i] = v
    return out

def shot(sid):
    return next(s for s in TL['shots'] if s['id'] == sid)

# ---------------------------------------------------------------------------------------------------- narration
def build_narration():
    bus = Bus('narration')
    src = os.path.join(ROOT, 'assets', 'audio', 'cinematic', 'narration', TL['narration_take'] + '.mp3')
    full = load(src)                                   # 48 kHz stereo
    ir = reverb_ir(1.3, predelay=0.012, damp=0.4, seed=11)
    for ph in TL['narration']:
        a, b = ph['src']
        clip = full[int(a * SR):int(b * SR)]
        tmp = os.path.join(CACHE, f"phrase_{ph['id']}.wav")
        wav_write(tmp, clip)
        st = load(tmp, tempo=TL['stretch'])
        # gentle hi-pass + a touch of warmth, then a small stone room around the voice
        bh, ah = signal.butter(2, 70 / (SR / 2), 'high'); st = signal.lfilter(bh, ah, st, axis=0).astype(np.float32)
        st = reverb(st, ir, wet=0.09)
        bus.add(st, ph['start'], 0.0, fade_in=0.02, fade_out=0.08)
    # level the voice (slow compressor): target a steady presence
    e = env_follow(bus.x, 0.01, 0.4) + 1e-6
    target = db(-12.0)
    g = np.clip(target / e, db(-6), db(6)) ** 0.5
    bus.x *= g[:, None].astype(np.float32)
    return bus

def wav_write(path, x):
    import wave
    y = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())

def wav_write24(path, x):
    import wave
    y = np.clip(x, -1, 1)
    v = (y * 8388607).astype('<i4')
    b = np.zeros((v.size, 3), np.uint8)
    flat = v.reshape(-1)
    b[:, 0] = flat & 0xFF; b[:, 1] = (flat >> 8) & 0xFF; b[:, 2] = (flat >> 16) & 0xFF
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
        w.writeframes(b.tobytes())

# ---------------------------------------------------------------------------------------------------- score
THEME = ['D5', 'F5', 'E5', 'D5', 'A4']     # the Veyr theme: a question (D F E D) and its answer (A, then home to D)

def build_music():
    m = Bus('music')
    hall = reverb_ir(5.5, predelay=0.03, damp=0.5, seed=7)
    dry = Bus('music_dry')                      # bells / glass go through the hall
    # ---- 1. the heart in the dark (0-6.9): pedal D, the glass voice, an ancient open fifth (cello)
    m.add(drone([hz('D1'), hz('D2'), hz('A2')], 8.4, amp=0.55, swell=3.0, seed=1), 0.2, -9, fade_out=1.5)
    dry.add(glass('D5', 5.2, amp=0.35, attack=1.4, release=2.5), 1.3, -14)
    dry.add(glass('A5', 4.0, amp=0.25, attack=1.2, release=2.5, seed=2), 2.9, -17)
    m.add(normalize(sfx('t_cello', tempo=0.55)), 3.2, -21, fade_in=1.5, fade_out=2.0, length=7.5)
    # ---- 2. the binding (6.9-13.8): the drop rings a small bell; the theme asks its question on bells; choir
    imp = 6.90 + 2.82
    dry.add(bell('D6', size=0.35, amp=0.5, bright=1.3, seed=4), imp, -12)
    dry.add(glass('D6', 3.5, amp=0.3, attack=0.05, release=3.0, seed=5), imp, -18)
    for i, (n_, dt) in enumerate(zip(THEME[:4], (0.55, 1.55, 2.45, 3.3))):
        dry.add(bell(n_, size=0.55, amp=0.55, bright=0.9, pan=-0.2 + 0.13 * i, seed=10 + i), imp + dt, -15)
    m.add(normalize(sfx('t_choir', tempo=0.6)), imp - 0.2, -18, fade_in=2.5, fade_out=2.5, length=7.2)
    # ---- 3. the rise (13.8-20.3): D major strings bloom as the castle grows; the living castle's bells peal
    m.add(normalize(sfx('t_strings', tempo=0.62)), 14.6, -15, fade_in=2.5, fade_out=2.2, length=7.8)
    peal = ['D5', 'F#5', 'A5', 'D5', 'E5', 'A4', 'D5', 'F#5']
    for i, n_ in enumerate(peal):
        dry.add(bell(n_, size=0.6, amp=0.5, bright=1.0, pan=np.sin(i * 1.7) * 0.5, seed=30 + i), 18.1 + i * 0.36, -18 - (i % 3))
    # ---- 4. the last night (20.3-33.8): the warmth drains; drums far off; tremolo; brass; bells toll
    m.add(normalize(sfx('t_wardrums', tempo=0.85)), 20.2, -10, fade_in=0.4, fade_out=3.0, length=12.0)
    m.add(normalize(sfx('t_tremolo', pitch=-4.0, tempo=0.75)), 20.8, -17, fade_in=2.5, fade_out=2.0, length=12.0)
    m.add(normalize(sfx('t_strings_minor', pitch=7.0, tempo=0.7)), 22.0, -20, fade_in=3.0, fade_out=2.0, length=11.5)
    m.add(normalize(sfx('t_brass', tempo=0.8)), 24.2, -19, fade_in=1.2, fade_out=1.8, length=5.5)
    m.add(normalize(sfx('t_brass', pitch=-2.0, tempo=0.8)), 29.0, -17, fade_in=1.2, fade_out=1.5, length=5.0)
    dry.add(bell('D4', size=0.9, amp=0.5, bright=0.7, pan=-0.1, seed=40), 28.2, -19)          # the theme, broken: D ...
    dry.add(bell('F4', size=0.9, amp=0.5, bright=0.7, pan=0.1, seed=41), 29.9, -20)           # ... F ... and no more
    for i, t in enumerate((31.55, 32.55, 33.45)):                                              # the castle bells sound
        dry.add(bell('D3', size=1.4, amp=0.8, bright=0.8, pan=(-0.25, 0.25, 0.0)[i], seed=50 + i), t, -9 - i * 0.5)
    # ---- 5. the Sundering (33.8-37): crescendo, the shattering, a hard silence
    m.add(normalize(sfx('t_swell', pitch=-3.0, tempo=0.85)), 33.3, -10, fade_in=0.8, length=2.25)
    m.add(riser(1.7, amp=0.5, f0=150, f1=6000), 33.8, -16)
    m.add(normalize(sfx('t_hit')), 35.02, -6, length=0.5, fade_out=0.08)
    # ---- 6. two memories (37-47.6): lament
    m.add(normalize(sfx('t_cello2', tempo=0.8)), 37.2, -15, fade_in=1.5, fade_out=2.5, length=10.0)
    m.add(high_drone(['D6', 'A6'], 11.0, amp=0.25, swell=3.0), 36.8, -24)
    m.add(drone([hz('D2'), hz('A2')], 11.5, amp=0.4, swell=3.0, seed=3, cutoff=300), 36.6, -19)
    for i, (n_, dt) in enumerate(zip(THEME, (0.0, 1.6, 3.0, 4.2, 5.8))):          # the theme as a ghost, on glass
        dry.add(glass(n_, 1.4, amp=0.3, attack=0.25, release=2.2, seed=60 + i), 39.6 + dt, -20)
    dry.add(bell('D4', size=1.2, amp=0.45, bright=0.6, pan=0.35, seed=70), 46.4, -18)   # a bell from a tower with no bell
    # ---- 7. the return (47.6-56.2): intimate pulse, the first notes, rising
    m.add(drone([hz('D2'), hz('A2'), hz('D3')], 9.2, amp=0.4, swell=2.5, seed=4, cutoff=380), 47.4, -19)
    for k in range(9):
        m.add(heartbeat(0.55), 48.1 + k * 1.05, -21 + k * 0.5)
    m.add(normalize(sfx('t_cello', tempo=0.6)), 50.4, -21, fade_in=1.5, fade_out=2.0, length=6.0)
    dry.add(glass('D5', 1.5, amp=0.25, attack=0.3, release=1.5, seed=80), 50.1, -24)     # the far window flares
    m.add(riser(1.4, amp=0.35, f0=300, f1=3000, seed=9), 54.8, -24)
    # ---- 8. the glimpse, the threshold, the title (56.2-66)
    g0 = shot('S14_glimpse')['start']; g1 = shot('S14_glimpse')['end']
    m.add(normalize(sfx('t_strings', tempo=1.0)), g0, -8, fade_in=0.04, length=g1 - g0, fade_out=0.03)
    m.add(normalize(sfx('t_strings', pitch=12.0, tempo=1.0)), g0, -17, fade_in=0.04, length=g1 - g0, fade_out=0.03)
    for i, n_ in enumerate(['D5', 'F#5', 'A5']):
        dry.add(bell(n_, size=0.5, amp=0.5, bright=1.2, seed=90 + i), g0 + 0.05 + i * 0.12, -16)
    m.add(drone([hz('D1'), hz('D2')], 6.0, amp=0.45, swell=2.0, seed=5, cutoff=250), 57.6, -19)
    t0 = shot('S17_title')['start']
    dry.add(bell('D2', size=1.8, amp=0.9, bright=0.6, seed=100), t0 + 0.15, -9)             # the deep bell under the title
    for i, (n_, dt) in enumerate(zip(THEME + ['D4'], (0.9, 1.5, 2.05, 2.55, 3.05, 3.6))):  # the theme, answered at last
        dry.add(bell(n_, size=0.7, amp=0.5, bright=0.85, pan=-0.3 + 0.12 * i, seed=110 + i), t0 + dt, -17)
    m.add(normalize(sfx('t_choir', tempo=0.7)), t0 + 0.2, -16, fade_in=0.8, fade_out=2.5, length=4.0)
    m.add(normalize(sfx('t_strings_minor', pitch=7.0, tempo=0.7)), t0 + 0.2, -20, fade_in=1.0, fade_out=2.5, length=4.0)
    dry.add(glass('D6', 3.0, amp=0.25, attack=0.6, release=2.0, seed=120), t0 + 1.2, -21)
    # hall
    wet = reverb(dry.x, hall, wet=0.55, dry=0.85)[:N]
    m.x += wet
    mw = reverb(m.x, hall, wet=0.18, dry=1.0)[:N]
    m.x = mw
    # the Sundering's silence: everything stops at the shatter, a thin ring hangs, then the lament breathes in
    s_cut = 35.52
    m.gain_curve([(0, 0), (s_cut - 0.005, 0), (s_cut, -90), (35.95, -90), (37.0, 0), (DUR, 0)])
    m.add(ring(6400, 1.6, amp=0.05, decay=0.6), s_cut + 0.02, -12)
    # the glimpse: in hard, out hard
    return m

# ---------------------------------------------------------------------------------------------------- sound design
def cc0(rel):
    return load(os.path.join(DL, rel))

def build_sfx():
    s = Bus('sfx')
    room = reverb_ir(2.2, predelay=0.02, damp=0.45, seed=21)
    cave = reverb_ir(4.0, predelay=0.04, damp=0.5, seed=22)
    # S01/S02 under the mountain: the heart's hum, a heartbeat, torches, footsteps, the drop
    s.add(normalize(sfx('sfx_heart_hum', tempo=0.6)), 0.4, -18, fade_in=2.5, fade_out=2.0, length=9.0)
    for k, t in enumerate((1.8, 3.4, 5.0, 6.35)):
        s.add(heartbeat(0.9 if t < 6 else 1.0), t, -13 if t < 6 else -9)
    s.add(normalize(cc0('fireplace_loop.wav')), 6.9, -26, fade_in=0.4, fade_out=1.5, length=6.5)
    imp = 6.90 + 2.82
    s.add(reverb(normalize(sfx('sfx_drop')), cave, wet=0.35), imp - 0.06, -10, length=3.0)
    s.add(normalize(sfx('sfx_heart_hum', tempo=0.8, pitch=2.0)), imp, -15, fade_in=0.3, fade_out=2.5, length=4.5)
    # S03 the rise: rushing up the shaft, bursting out, stone rising, the living castle
    s.add(riser(2.3, amp=0.6, f0=120, f1=4000, seed=12), 13.8, -20)
    s.add(normalize(sfx('sfx_stone_rise')), 15.9, -13, fade_in=0.2, fade_out=1.0, length=4.4)
    s.add(normalize(sfx('sfx_bells_peal')), 18.0, -21, fade_in=0.6, fade_out=1.4, length=3.2)
    # S04 war
    s.add(normalize(sfx('sfx_war')), 20.3, -8, fade_in=0.15, fade_out=1.2, length=3.8)
    # S05 sealed: fear in the passage, the portcullis slams on "sealed"
    s.add(reverb(normalize(sfx('sfx_crowd_fear')), room, wet=0.3), 22.6, -17, fade_in=0.4, fade_out=0.6, length=3.4)
    pc = normalize(sfx('sfx_portcullis'))
    peak = int(np.argmax(np.abs(pc).max(axis=1))) / SR
    slam = 22.60 + 2.72
    s.add(reverb(pc, room, wet=0.3), slam - peak, -6, length=3.6, fade_out=0.8)
    # S06 the child: quick soft steps, the door shut
    for k in range(4):
        s.add(normalize(cc0('kenney_rpg-audio/Audio/footstep0%d.ogg' % (k % 10))), 26.25 + k * 0.28, -26)
    dc = normalize(sfx('sfx_door_close'))
    dpk = int(np.argmax(np.abs(dc).max(axis=1))) / SR
    s.add(reverb(dc, room, wet=0.25), 26.13 + (1 + round(1.0 * 24) + 9) / 24 - dpk, -11, length=1.6)
    # S07/S08 the descent and the asking
    s.add(reverb(normalize(sfx('sfx_steps_stair')), cave, wet=0.3), 28.0, -15, fade_in=0.2, fade_out=0.8, length=3.4)
    s.add(normalize(sfx('sfx_heart_hum', tempo=0.7, pitch=-2.0)), 29.0, -17, fade_in=2.0, fade_out=0.5, length=5.0)
    s.add(normalize(sfx('sfx_glove_iron', pitch=-5.0)), 31.35, -14)
    # S09 the Sundering: the surge, the crazing, the fall (and some of it falling upward)
    s.add(normalize(sfx('sfx_collapse', reverse=True)), 33.85, -12, fade_in=0.4, length=1.25)
    s.add(normalize(sfx('sfx_crack')), 34.95, -8, length=0.6)
    s.add(normalize(sfx('sfx_crack', pitch=-5.0)), 35.1, -10, length=0.45)
    s.add(normalize(sfx('sfx_collapse')), 35.95, -17, fade_in=0.2, fade_out=1.5, length=3.0)
    s.add(normalize(sfx('sfx_collapse', reverse=True, pitch=3.0)), 37.2, -22, fade_in=0.8, length=1.4)
    for k in range(18):   # flakes: tiny glass ticks as gold leaf falls
        rng = np.random.default_rng(k)
        s.add(glass(float(hz('D6') * 2 ** (rng.integers(0, 12) / 12)), 0.12, amp=0.15, attack=0.005, release=0.8, seed=200 + k), 36.0 + rng.uniform(0, 2.8), -26 - rng.uniform(0, 8))
    s.gain_curve([(0, 0), (35.515, 0), (35.52, -90), (35.95, -90), (36.05, 0), (DUR, 0)])
    # S09b/S10 the ruin and the centuries: wind, a storm, time
    s.add(normalize(sfx('sfx_night_ruin')), 36.2, -20, fade_in=1.5, length=7.5, fade_out=1.0)
    s.add(normalize(cc0('wind_woosh_loop.ogg')), 42.3, -19, fade_in=1.0, fade_out=1.5, length=6.0)
    thunder = os.path.join(DL, 'sfx_100_v2')
    try:
        import glob
        th = sorted(glob.glob(os.path.join(DL, 'sfx_100_v2', '**', '*thunder*'), recursive=True))
        if th: s.add(normalize(load(th[0])), 44.0, -22, fade_out=1.5, length=3.5)
    except Exception: pass
    # S11-S12 her approach: night, footsteps on grass and stone
    s.add(normalize(sfx('sfx_night_ruin')), 47.6, -19, fade_in=1.0, length=8.0, fade_out=0.5)
    for k in range(int((52.7 - 47.8) / 0.55)):
        s.add(normalize(cc0('kenney_rpg-audio/Audio/footstep0%d.ogg' % (k % 10))), 47.8 + k * 0.55, -24 + min(6, k * 0.8))
    for k in range(2):
        s.add(normalize(cc0('kenney_rpg-audio/Audio/footstep0%d.ogg' % ((k + 3) % 10))), 52.8 + k * 0.55, -19)
    # S13 the touch
    s.add(normalize(sfx('sfx_glove_iron')), 55.35, -12)
    s.add(heartbeat(1.0, f_hi=58, f_lo=34), 55.55, -12)
    # S14 the glimpse: one breath of the living castle — hard in, hard out
    g0 = shot('S14_glimpse')['start']; g1 = shot('S14_glimpse')['end']
    s.add(normalize(sfx('sfx_glimpse')), g0, -3, fade_in=0.02, length=g1 - g0, fade_out=0.03)
    # the glimpse crazes from her palm (post.py Glimpse.CRAZE0) ...
    s.add(normalize(sfx('sfx_crack', pitch=4.0)), g0 + 0.73, -11, length=0.4, fade_out=0.08)
    # ... and on the cut to silence it falls away: only the faintest ticks of gold leaf
    for k in range(9):
        rng = np.random.default_rng(300 + k)
        s.add(glass(float(hz('D6') * 2 ** (rng.integers(0, 12) / 12)), 0.1, amp=0.12, attack=0.004, release=0.6, seed=300 + k),
              g1 + 0.04 + rng.uniform(0, 0.7), -30 - rng.uniform(0, 7))
    # S15 ruin: the wind comes back
    s.add(normalize(sfx('sfx_night_ruin', pitch=-2.0)), g1 + 0.1, -22, fade_in=0.8, length=4.0, fade_out=1.0)
    # S16 the threshold: the gate groans open; her steps change to stone; the dark breathes
    go = shot('S16_threshold')['start']
    s.add(reverb(normalize(sfx('sfx_gate_open')), room, wet=0.35), go + 0.4, -9, fade_out=0.8, length=4.4)
    for k in range(4):
        s.add(reverb(normalize(cc0('kenney_impact-sounds/Audio/footstep_concrete_00%d.ogg' % (k % 5))), room, wet=0.4), go + 2.1 + k * 0.55, -17)
    s.add(normalize(cc0('dungeon_ambient_1_0.ogg')), go + 1.0, -26, fade_in=1.5, fade_out=1.5, length=5.0)
    return s

# ---------------------------------------------------------------------------------------------------- master
def master(narr, music, sfxb):
    # duck the score under the voice (-5 dB) and the effects a little (-2 dB)
    ve = env_follow(narr.x, 0.02, 0.6)
    ve = ve / (np.max(ve) + 1e-9)
    duck = np.clip(ve * 3.0, 0, 1)
    music.x *= (1 - duck * (1 - db(-5)))[:, None].astype(np.float32)
    sfxb.x *= (1 - duck * (1 - db(-2)))[:, None].astype(np.float32)
    mix = narr.x * db(0) + music.x * db(-1) + sfxb.x * db(-1)
    # the film ends at TL['duration']: everything rings down to silence by then
    t = np.arange(N) / SR
    end = TL['duration']
    mix *= np.clip((end - t) / 1.6, 0, 1)[:, None] ** 1.5
    return mix.astype(np.float32)

def integrated_lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    import re
    m = re.findall(r'I:\s+(-?[0-9.]+) LUFS', r.stderr)
    return float(m[-1]) if m else None

def limit(x, ceiling_db=-1.5, knee=0.85):
    """Soft-knee peak limiter: above knee*ceiling, compress smoothly toward the ceiling (tanh)."""
    c = db(ceiling_db); k = c * knee
    a = np.abs(x); over = a > k
    y = x.copy()
    y[over] = np.sign(x[over]) * (k + (c - k) * np.tanh((a[over] - k) / (c - k)))
    return y

def main():
    os.makedirs(OUT, exist_ok=True)
    narr = build_narration(); print('narration ok')
    music = build_music(); print('music ok')
    sfxb = build_sfx(); print('sfx ok')
    for b in (narr, music, sfxb): wav_write(os.path.join(OUT, f'{b.name}.wav'), normalize(b.x, -1))
    mix = master(narr, music, sfxb)
    raw = os.path.join(OUT, 'mix_raw.wav'); wav_write24(raw, mix / (np.max(np.abs(mix)) + 1e-9) * 0.5)
    # loudness: measure, then a linear gain to -16 LUFS integrated and a soft limiter at -1.5 dBFS
    L = integrated_lufs(raw)
    gain = db(-16.0 - L) * 0.5 / (np.max(np.abs(mix)) + 1e-9)
    final_x = limit(mix * gain, -1.5)
    final = os.path.join(OUT, 'mix.wav'); wav_write24(final, final_x)
    print(f'raw {L:.1f} LUFS -> gain {20 * np.log10(gain):+.1f} dB; final {integrated_lufs(final):.1f} LUFS, peak {20 * np.log10(np.max(np.abs(final_x))):.2f} dBFS')
    print('->', final)

if __name__ == '__main__':
    main()
