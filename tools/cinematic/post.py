"""Assemble the opening film from the Blender passes: the edit and its transitions, the Sundering (craquelure,
silence, the gilded past flaking off the ruin), the centuries, the glimpse at the gate, the title; then the film's
surface (paper, grain, vignette), subtitles, and the encodes.

    python tools/cinematic/post.py --preview 850,900,1300-1320/5 [--standin]  -> build/cinematic/post_preview/*.jpg
    python tools/cinematic/post.py --encode [--workers 4]                      -> game + share masters

Outputs (--encode):
    public/cinematic/opening_1080.mp4, opening_720.mp4        clean picture for the game (subtitles are DOM, in sync)
    build/cinematic/out/the_castle_remembers_portrait.mp4       1080x1920, subtitles burned in
    build/cinematic/out/the_castle_remembers_wide.mp4           1920x1080, the portrait film on its own ambient light
"""
import argparse, glob, json, math, os, subprocess, sys, time, functools
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import post_fx as fx
from post_fx import W, H, FPS, sstep, smoothstep, ease_in, ease_out, ease_out3, hexf

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FR = os.path.join(ROOT, 'build', 'cinematic', 'frames')
REVIEW = os.path.join(ROOT, 'build', 'cinematic', 'review', 'frames')
CAMS = os.path.join(ROOT, 'build', 'cinematic', 'cams')
AUDIO = os.path.join(ROOT, 'build', 'cinematic', 'audio', 'mix.wav')
TL = json.load(open(os.path.join(HERE, 'timeline.json'), encoding='utf-8'))
SHOTS = {s['id']: s for s in TL['shots']}
N = int(round(TL['duration'] * FPS))
STANDIN = False
Z0 = 200.0                               # castle.Z0
TOUCH = (-0.24, 0.40, 1.96)              # shot_gate.TOUCH: her palm on the crest
WHITE = hexf('#fff3dc')

def shot_at(g):
    for s in TL['shots']:
        if s['frames'][0] <= g < s['frames'][1]: return s
    return TL['shots'][-1]

# ---------------------------------------------------------------------------------------------------- sources
@functools.lru_cache(maxsize=10)
def src(shot, pas, g):
    p = os.path.join(FR, shot, pas, f'f{g:04d}.png')
    if os.path.exists(p): return fx.load_rgb(p)
    if not STANDIN: raise FileNotFoundError(p)
    for base in (FR, REVIEW):             # preview before the renders finish: the nearest frame of that pass
        c = glob.glob(os.path.join(base, shot, pas, 'f*.png'))
        if c:
            best = min(c, key=lambda q: abs(int(os.path.basename(q)[1:5]) - g))
            return fx.load_rgb(best)
    return np.zeros((H, W, 3), np.float32)

class Cam:
    """The evaluated Blender camera per frame (camdump.py), for pinning 2-D effects to world points."""
    def __init__(self, name):
        d = json.load(open(os.path.join(CAMS, name + '.json')))
        self.f = {int(k): v for k, v in d['frames'].items()}
    def _c(self, g):
        c = self.f.get(g)
        return c if c is not None else self.f[min(self.f, key=lambda k: abs(k - g))]
    def project(self, g, P):
        c = self._c(g); M = np.array(c['m'])
        p = np.linalg.inv(M) @ np.array([P[0], P[1], P[2], 1.0])
        z = -p[2]; th = c['sensor'] / 2 / c['lens']
        v = p[1] / z / th - 2 * c['shift'][1]
        u = p[0] / z / (th * W / H) - 2 * c['shift'][0] * H / W
        return (u + 1) / 2 * W, (1 - (v + 1) / 2) * H, z
    def unproject_y(self, g, x, y, plane_y):
        c = self._c(g); M = np.array(c['m']); th = c['sensor'] / 2 / c['lens']
        u, v = 2 * x / W - 1, 1 - 2 * y / H
        d = M[:3, :3] @ np.array([(u + 2 * c['shift'][0] * H / W) * th * W / H, (v + 2 * c['shift'][1]) * th, -1.0])
        o = M[:3, 3]
        return o + d * ((plane_y - o[1]) / d[1])

def similarity(cam_a, ga, cam_b, gb, plane_y):
    """2-D similarity taking screen points of camera A (frame ga) to camera B (frame gb) for the plane y=plane_y
    (exact for these shots: the cameras translate but never rotate)."""
    p1, p2 = (W / 2, H * 0.45), (W / 2, H * 0.45 - 500)
    q = [cam_b.project(gb, cam_a.unproject_y(ga, *p, plane_y))[:2] for p in (p1, p2)]
    s = math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / 500.0
    return s, (q[0][0] - s * p1[0], q[0][1] - s * p1[1])

# ---------------------------------------------------------------------------------------------------- small helpers
def mix(a, b, t): return a * (1 - t) + b * t

def shake(img, t_rel, amp=11.0, freq=13.0, decay=0.13):
    if t_rel < 0 or t_rel > 0.7: return img
    e = amp * math.exp(-t_rel / decay)
    dy = int(round(e * math.sin(2 * math.pi * freq * t_rel)))
    dx = int(round(0.45 * e * math.sin(2 * math.pi * freq * 0.77 * t_rel + 1.3)))
    if dx == 0 and dy == 0: return img
    py, px = abs(dy), abs(dx)
    p = np.pad(img, ((py, py), (px, px), (0, 0)), mode='edge')
    return p[py - dy:py - dy + H, px - dx:px - dx + W]

@functools.lru_cache(None)
def _field04():
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
    return np.clip(0.8 * (1 - yy / H) + 0.05 * fx.fbm(H, W, 404, (60, 240), (0.5, 0.5)) + 0.014 * fx.fbm(H, W, 405, (4, 12), (0.5, 0.5)), -0.1, 1.1)

@functools.lru_cache(None)
def _yx():
    return np.mgrid[0:H, 0:W].astype(np.float32)

# ---------------------------------------------------------------------------------------------------- the shots
def c_S01(g, lf, tau):
    return src('S01_heart', 'main', g) * sstep(0.0, 0.6, tau)

def c_S02(g, lf, tau):
    P = lambda p: src('S02_blood', p, g)
    if lf < 36: return P('wide')
    if lf <= 38: return mix(P('wide'), P('kneel'), (lf - 35) / 4)          # to the lord kneeling at the heart
    if lf < 60: return P('kneel')
    if lf < 79: return P('drop')                                           # hard cut: the drop falls
    if lf <= 81: return mix(P('drop'), P('wide'), (lf - 78) / 4)          # gold runs through the whorls
    return P('wide')

def c_S03(g, lf, tau):
    """Up the conduit into a flash of dusk light, out over the ward as Caer Veyr grows."""
    if lf < 49:
        img = src('S03_rise', 'shaft', g); a = ease_in((lf - 41) / 8) if lf > 41 else 0.0
    else:
        img = src('S03_rise', 'castle', g); a = 1.0 - ease_out((lf - 49) / 10)
    if a > 0: img = fx.bloom(img, 0.6, 32.0, 0.8 * a)
    return mix(img, WHITE, 0.88 * a)

def c_S04(g, lf, tau):
    """Same place, the same dusk — then the red bleeds up out of the valley like ink into wet paper."""
    war = src('S04_war', 'war', g)
    if lf > 28: return war
    dusk = src('S04_war', 'dusk', g)
    p = -0.15 + 1.4 * sstep(4, 27, lf)
    d = p - _field04()
    m = smoothstep(0.0, 0.2, d)[..., None]
    edge = np.exp(-(d / 0.045) ** 2)[..., None] if -0.1 < p < 1.2 else 0.0
    img = mix(dusk, war, m)
    return img * (1 - 0.22 * edge) + edge * hexf('#5a0a04') * 0.2

def c_S05(g, lf, tau):
    img = src('S05_sealed', 'main', g)
    return shake(img, (lf - 66) / FPS)                                      # the portcullis lands on "sealed"

def c_plain(shot):
    return lambda g, lf, tau: src(shot, 'main', g)

def c_S09a(g, lf, tau):
    img = src('S09a_surge', 'main', g)
    a = ease_in((lf - 15) / 12) if lf > 15 else 0.0                         # white-out into the Sundering
    img = fx.bloom(img, 0.6, 30.0, 0.35 + 0.9 * a)
    return mix(img, WHITE, a)

# ---------------------------------------------------------------------------------------------------- the Sundering
class Sundering:
    """S09b. The light hits the castle; its gilded image crazes (with the cracks' sound), freezes in silence, then
    flakes away from the keep outward to reveal the ruin in register. Some flakes float back up and cling on for a
    while; small shards hang where the windows were and outlive the shot (S10)."""
    T_CRAZE, T_HOLD, T_FALL = 0.05, 0.62, 1.05     # s into the shot (mix.py: cracks 34.95/35.10, silence 35.52-35.95)
    def __init__(self):
        sh = SHOTS['S09b_sundering']; self.f0 = sh['frames'][0]; self.n = sh['frames'][1] - self.f0
        self.cam = Cam('S09b_sundering_present'); self.cam10 = Cam('S10_centuries_main')
        self.lf_hold = 1 + round(self.T_HOLD * FPS)
        self.g_hold = self.f0 + self.lf_hold - 1
        ox, oy, _ = self.cam.project(self.g_hold, (33.0, 15.0, Z0 + 40.0))
        self.origin = (ox, oy)
        self.cr = fx.Cracks(901, 420, 3200).schedule(self.origin, self.T_CRAZE, 4300.0, 3400.0, jitter=0.06)
        past_raw = src('S09b_sundering', 'past', self.g_hold)
        self.past_hold = self.gilded(past_raw, self.T_HOLD)
        self.pres_hold = src('S09b_sundering', 'present', self.g_hold)
        gap, craze, cup = self.cr.state(self.T_HOLD)
        self.frozen = fx.crazed(self.past_hold, self.pres_hold, (gap, craze, cup), hl=0.3)
        # the varnish layer that flakes: colour = the crazed gilding, alpha = everything but the coarse cracks
        self.varnish = fx.crazed(self.past_hold, self.past_hold, (np.zeros_like(gap), craze, cup), hl=0.3)
        self.valpha = 1.0 - gap
        # shards where the windows were (cut first: the flakes that fall carry a hole where a shard stays behind)
        anchors = self.windows(past_raw)
        k = len(anchors)
        fades = []
        for j in range(k):                          # they go out one by one during the centuries; the last on the bell
            t1 = 43.2 + (46.1 - 43.2) * j / max(1, k - 1)
            fades.append((t1 - 0.5, t1, False))
        if fades: fades[-1] = (45.8, 46.42, True)
        self.hangers = fx.Hangers(self.varnish, anchors, 5, fades)
        self.flakes = fx.Flakes(self.cr, self.varnish, self.origin, self.T_FALL, 1150.0, seed=77, jitter=0.45,
                                returners=0.05, return_at=2.35, return_fade=(3.9, 5.2), wind=22.0, hole=self.hangers.hole)
        for f in self.flakes.fl:                   # returners leave around the fall and come home on the reversed swell
            if f['kind'] == 'return': f['T'] = max(self.T_FALL + 0.05, 2.35 - 0.5 * f['D'])
        self.flakes.T[:] = np.inf
        for f in self.flakes.fl: self.flakes.T[f['i']] = f['T']
        for s_, (ax, ay, _) in zip(self.hangers.sh, anchors):
            tc = self.flakes.T[self.cr.lab_c[int(ay), int(ax)]]
            s_['T'] = sh['start'] + (tc if np.isfinite(tc) else self.T_FALL)

    def gilded(self, img, tau):
        blaze = 1.0 - sstep(0.0, 0.45, tau)
        out = fx.icon_gild(img, 0.9, 2.6)
        return fx.bloom(out, 0.55, 30.0, 0.2 + 0.9 * blaze)

    def windows(self, img, k=6):
        """Lit windows in the Past, below the keep's crown and above the ward (not the column, not the army)."""
        from scipy import ndimage
        g = self.g_hold
        y_top = self.cam.project(g, (33.0, 15.0, Z0 + 62.0))[1]
        y_bot = self.cam.project(g, (0.0, 0.0, Z0 - 3.0))[1]
        x_l = self.cam.project(g, (-80.0, 0.0, Z0))[0]; x_r = self.cam.project(g, (62.0, 0.0, Z0))[0]
        r, gg, b = img[..., 0], img[..., 1], img[..., 2]
        m = (r > 0.8) & (gg > 0.55) & (r - b > 0.25)
        yy, xx = _yx()
        m &= (yy > y_top) & (yy < y_bot) & (xx > x_l) & (xx < x_r)
        lab, n = ndimage.label(m)
        if n == 0: return []
        idx = list(range(1, n + 1))
        sizes = ndimage.sum(m, lab, idx)
        cents = ndimage.center_of_mass(m, lab, idx)
        order = np.argsort(-np.asarray(sizes))
        out = []
        for j in order:
            cy, cx = cents[j]
            if sizes[j] < 3 or any(math.hypot(cx - a, cy - b_) < 115 for a, b_, _ in out): continue   # spread over the whole castle
            out.append((cx, cy, tuple(self.cam.unproject_y(g, cx, cy, 2.0))))
            if len(out) >= k: break
        return out

    def lf_eff(self, lf):
        tau = (lf - 1) / FPS
        if tau < self.T_HOLD: return lf
        if tau < self.T_FALL: return self.lf_hold
        return min(self.n, self.lf_hold + round((tau - self.T_FALL) * FPS))

    def project09(self, g_cam):
        z_ref = {}
        def pr(wp):
            x, y, z = self.cam.project(g_cam, wp)
            zr = z_ref.setdefault(wp, self.cam.project(self.g_hold, wp)[2])
            return x, y, zr / z
        return pr

    def project10(self, g):
        def pr(wp):
            x, y, z = self.cam10.project(g, wp)
            return x, y, self.cam.project(self.g_hold, wp)[2] / z
        return pr

    def frame(self, g, lf, tau):
        t_film = g / FPS
        if tau < self.T_HOLD:                                                        # blazing, crazing
            past = self.gilded(src('S09b_sundering', 'past', g), tau)
            pres = src('S09b_sundering', 'present', g)
            glow = 1.3 * math.exp(-(tau - 0.12) / 0.12) if tau >= 0.12 else 1.3 * sstep(0.06, 0.12, tau)
            img = fx.crazed(past, pres, self.cr.state(tau), hl=0.3, glow=glow)
            if tau < 0.22: img = mix(img, WHITE, 1.0 - ease_out(tau / 0.22))
            return img
        if tau < self.T_FALL:                                                        # silence: the picture holds
            return self.frozen
        lfe = self.lf_eff(lf); g_cam = self.f0 + lfe - 1
        s, tr = similarity(self.cam, self.g_hold, self.cam, g_cam, 10.0)
        pres = src('S09b_sundering', 'present', g_cam)
        att = self.flakes.attached(self.cr.lab_c, tau) * self.valpha
        if att.any():
            v = fx.warp(self.varnish, s, tr); a = fx.warp(att, s, tr)[..., None]
            img = pres * (1 - a) + v * a
        else:
            img = pres.copy()
        img = img + fx.motes(tau, seed=12, n=150, amount=0.55 * sstep(1.4, 2.4, tau) * (1 - sstep(6.4, 7.4, tau)))[..., None] * fx.GOLD_GLOW
        img, pastes = self.hangers.draw(img, t_film, self.project09(g_cam))
        img = fx.paste_all(img, pastes)
        cv = Image.fromarray(fx.to_u8(img)).convert('RGBA')
        self.flakes.draw(cv, tau, sim=(s, tr))
        return np.asarray(cv.convert('RGB'), np.float32) / 255.0

    def s10(self, img, g):
        img = img.copy()
        img, pastes = self.hangers.draw(img, g / FPS, self.project10(g))
        return fx.paste_all(img, pastes)

@functools.lru_cache(None)
def sundering(): return Sundering()

def c_S09b(g, lf, tau): return sundering().frame(g, lf, tau)

def c_S10(g, lf, tau):
    """The centuries: snow, then rain and lightning, then clear night; the last shards go out one by one."""
    t = g / FPS
    img = src('S10_centuries', 'main', g)
    sn = sstep(0.0, 0.45, tau) * (1 - sstep(1.65, 2.15, tau))
    if sn > 0.01: img = img + fx.snow(tau, amount=sn)[..., None] * hexf('#dde6ff') * 0.8
    rn = sstep(1.75, 2.05, tau) * (1 - sstep(3.4, 3.95, tau))
    if rn > 0.01: img = img * (1 - 0.12 * rn) + fx.rain(tau, amount=rn)[..., None] * hexf('#c4d0e6') * 0.55
    lt = t - 43.92                                                                  # lightning; thunder at 44.0
    if -0.01 < lt < 0.6:
        fl = (math.exp(-lt / 0.05) if lt >= 0 else 0.0) + (0.65 * math.exp(-(lt - 0.13) / 0.07) if lt >= 0.13 else 0.0)
        yy = _yx()[0]
        img = img + fl * (img * 2.2 + (0.10 * (1 - yy / H))[..., None] * hexf('#cfd8ff'))
    return sundering().s10(img, g)

# ---------------------------------------------------------------------------------------------------- the glimpse
class Glimpse:
    """S14-S15. Gilding sweeps out from her palm (the same radial wave the game uses for a time shift): the living
    gate for one breath. Then it crazes from her palm, and on the cut to silence it shatters and falls away."""
    SWEEP = 0.42
    CRAZE0 = 0.72
    def __init__(self):
        sh = SHOTS['S14_glimpse']; self.f0 = sh['frames'][0]; self.n = sh['frames'][1] - self.f0
        self.cam = Cam('S14_glimpse_present'); self.cam15 = Cam('S15_ruin_main')
        px, py, _ = self.cam.project(self.f0, TOUCH)
        self.palm = (px, py)
        yy, xx = _yx()
        self.R = np.hypot(xx - px, yy - py) + 30.0 * fx.fbm(H, W, 1402, (9, 40), (0.5, 0.5))
        self.cr = fx.Cracks(1401, 300, 2600).schedule(self.palm, self.CRAZE0, 7200.0, 5600.0, jitter=0.04)
        self._out = None

    def past(self, g): return fx.icon_gild(src('S14_glimpse', 'past', g), 0.5, 1.5)

    def frame(self, g, lf, tau):
        pres = src('S14_glimpse', 'present', g)
        past = self.past(g)
        r = 2400.0 * ease_out(tau / self.SWEEP)
        d = r - self.R
        m = smoothstep(-8.0, 8.0, d)[..., None]
        img = mix(pres, past, m)
        k = 1.0 - sstep(0.12, self.SWEEP + 0.1, tau)
        if k > 0: img = img + (np.exp(-(d / 9.0) ** 2) * 1.2 * k)[..., None] * fx.GOLD_GLOW + (np.exp(-(d / 60.0) ** 2) * 0.25 * k)[..., None] * fx.GOLD_HL
        if tau < 0.25:                                                               # her palm flares
            yy, xx = _yx()
            fl = np.exp(-((xx - self.palm[0]) ** 2 + (yy - self.palm[1]) ** 2) / (2 * 70.0 ** 2)) * 1.6 * (1 - tau / 0.25)
            img = img + fl[..., None] * fx.GOLD_HL
        if tau >= self.CRAZE0:
            img = fx.crazed(img, pres, self.cr.state(tau), hl=0.35, glow=0.5 * sstep(self.CRAZE0, self.CRAZE0 + 0.1, tau))
        return img

    def out(self):
        if self._out is None:
            g_last = self.f0 + self.n - 1; tau_last = (self.n - 1) / FPS
            past = self.past(g_last)
            gap, craze, cup = self.cr.state(tau_last + 0.05)
            varnish = fx.crazed(past, past, (np.zeros_like(gap), craze, cup), hl=0.35)
            fl = fx.Flakes(self.cr, varnish, self.palm, 0.0, 7000.0, seed=141, vt=(1600.0, 2600.0), g=5200.0,
                           push=(150.0, 600.0), jitter=0.03, explosive=True, wind=0.0, rock=0.25, dissolve_dark=False,
                           life=(0.3, 0.75))
            self._out = (varnish, 1.0 - gap, fl, g_last)
        return self._out

    def frame15(self, g, lf, tau):
        pres = src('S15_ruin', 'main', g)
        varnish, valpha, fl, g_last = self.out()
        s, tr = similarity(self.cam, g_last, self.cam15, g, 0.4)
        att = fl.attached(self.cr.lab_c, tau) * valpha
        img = pres
        if att.any():
            v = fx.warp(varnish, s, tr); a = fx.warp(att, s, tr)[..., None]
            img = pres * (1 - a) + v * a
        cv = Image.fromarray(fx.to_u8(img)).convert('RGBA')
        fl.draw(cv, tau, sim=(s, tr), shade=0.9)
        return np.asarray(cv.convert('RGB'), np.float32) / 255.0

@functools.lru_cache(None)
def glimpse(): return Glimpse()

def c_S14(g, lf, tau): return glimpse().frame(g, lf, tau)
def c_S15(g, lf, tau): return glimpse().frame15(g, lf, tau)

def c_S16(g, lf, tau):
    img = src('S16_threshold', 'main', g)
    amt = sstep(0.7, 1.6, tau) * (1.0 - sstep(2.8, 3.5, tau))                     # dust stirs in the moonbeam
    if amt > 0.01:
        lit = smoothstep(0.06, 0.32, fx.lum(img))
        d = fx.motes(tau, seed=16, n=260, amount=amt, rise=9.0, box=(W * 0.15, H * 0.08, W * 0.95, H * 0.9))
        img = img + (d * lit)[..., None] * hexf('#dfe8ff') * 0.9
    return img * (1.0 - ease_in((tau - 3.15) / 0.65))                              # into the dark

def c_night(shot, y0=0.6, amount=0.1, speed=24.0):
    """The present at night: low mist drifting through (the renders are still; the night is not)."""
    def f(g, lf, tau):
        img = src(shot, 'main', g)
        m = fx.mist(g / FPS, speed=speed, y0=y0, amount=amount)
        return img * (1 - m[..., None]) + m[..., None] * hexf('#5a6a86')
    return f

@functools.lru_cache(None)
def title():
    import post_title
    return post_title.Title()

def c_S17(g, lf, tau): return title().frame(tau)

COMP = {
    'S01_heart': c_S01, 'S02_blood': c_S02, 'S03_rise': c_S03, 'S04_war': c_S04, 'S05_sealed': c_S05,
    'S06_child': c_plain('S06_child'), 'S07_descent': c_plain('S07_descent'), 'S08_asking': c_plain('S08_asking'),
    'S09a_surge': c_S09a, 'S09b_sundering': c_S09b, 'S10_centuries': c_S10, 'S11_road': c_night('S11_road', 0.55, 0.12),
    'S12_gate': c_night('S12_gate', 0.62, 0.1, 16.0), 'S13_touch': c_plain('S13_touch'), 'S14_glimpse': c_S14, 'S15_ruin': c_S15,
    'S16_threshold': c_S16, 'S17_title': c_S17,
}
# dissolves across cuts: first frame of the incoming shot -> length in frames (centred on the cut)
DISSOLVE = {SHOTS['S10_centuries']['frames'][0]: 10, SHOTS['S11_road']['frames'][0]: 8}

def composite(g):
    s = shot_at(g)
    for cut, L in DISSOLVE.items():
        if cut - L // 2 <= g < cut + L - L // 2:
            a_shot, b_shot = shot_at(cut - 1), shot_at(cut)
            ga, gb = min(g, cut - 1), max(g, cut)
            A = _shot_frame(a_shot, ga); B = _shot_frame(b_shot, gb)
            return mix(A, B, (g - (cut - L // 2) + 0.5) / L)
    return _shot_frame(s, g)

def _shot_frame(s, g):
    f0 = s['frames'][0]
    return COMP[s['id']](g, g - f0 + 1, (g - f0) / FPS)

# ---------------------------------------------------------------------------------------------------- the frame
_SUBS = {}
def subs(kind):
    if kind not in _SUBS:
        if kind == 'portrait': _SUBS[kind] = fx.Subtitles(TL['subtitles'])
        else: _SUBS[kind] = fx.Subtitles(TL['subtitles'], width=1920, height=1080, size=40, max_w=0.62, base=0.885)
    return _SUBS[kind]

def wide(clean_u8):
    """1920x1080: the portrait film centred, standing in a dim, deeply blurred wash of its own light."""
    im = Image.fromarray(clean_u8)
    small = np.asarray(im.resize((W // 8, H // 8), Image.BOX), np.float32) / 255.0
    bg = fx.blur(small, 6.0)
    bgi = Image.fromarray(fx.to_u8(bg)).resize((1920, int(1920 * H / W)), Image.BILINEAR)
    top = (bgi.size[1] - 1080) // 2
    bg = np.asarray(bgi.crop((0, top, 1920, top + 1080)), np.float32) / 255.0 * 0.2
    xx = np.abs(np.arange(1920, dtype=np.float32) - 960) / 960
    bg *= (1.0 - 0.55 * xx)[None, :, None]
    cw = int(round(1080 * W / H))
    col = np.asarray(im.resize((cw, 1080), Image.LANCZOS), np.float32) / 255.0
    x0 = (1920 - cw) // 2
    bg[:, x0:x0 + cw] = col
    edge = 18
    for k in range(edge):                         # a soft shadow either side of the picture
        a = 0.35 * (1 - k / edge) ** 2
        bg[:, x0 - 1 - k] *= (1 - a); bg[:, x0 + cw + k] *= (1 - a)
    return fx.to_u8(bg)

def render(g, outputs=('clean', 'portrait', 'wide')):
    s = shot_at(g)
    img = composite(g)
    img = fx.shoulder(np.maximum(img, 0.0))
    ti = s['id'] == 'S17_title'
    img = fx.finish(img, g, paper_amt=0.7 if ti else 1.0, vignette=0.6 if ti else 1.0)
    clean = fx.to_u8(img)
    out = {'clean': clean}
    t = g / FPS
    if 'portrait' in outputs:
        cv = Image.fromarray(clean).convert('RGBA'); subs('portrait').draw(cv, t)
        out['portrait'] = np.asarray(cv.convert('RGB'))
    if 'wide' in outputs:
        wv = Image.fromarray(wide(clean)).convert('RGBA'); subs('wide').draw(wv, t)
        out['wide'] = np.asarray(wv.convert('RGB'))
    return out

def _render_bytes(g):
    o = render(g)
    return g, o['clean'].tobytes(), o['portrait'].tobytes(), o['wide'].tobytes()

# ---------------------------------------------------------------------------------------------------- main
def parse_frames(spec):
    out = []
    for tok in spec.split(','):
        step = 1
        if '/' in tok: tok, st = tok.split('/'); step = int(st)
        if '-' in tok:
            a, b = tok.split('-'); out += list(range(int(a), int(b) + 1, step))
        else: out.append(int(tok))
    return out

def write_game_data():
    """src/data/opening.json: what the game needs to play the film (the subtitles follow the video clock)."""
    d = {
        '_generated': 'tools/cinematic/post.py from tools/cinematic/timeline.json - do not edit',
        'duration': TL['duration'],
        'videos': [{'src': 'cinematic/opening_1080.mp4', 'height': 1920}, {'src': 'cinematic/opening_720.mp4', 'height': 1280}],
        'subtitleFade': [0.22, 0.3],
        'subtitles': [{'start': round(s['start'], 3), 'end': round(s['end'], 3), 'text': s['text']} for s in TL['subtitles']],
    }
    path = os.path.join(ROOT, 'src', 'data', 'opening.json')
    with open(path, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False, indent=1)
    print('wrote', path)

def warm():
    """Build every cached texture once in this process before workers start (they then only read the cache)."""
    fx.paper(); fx.leaf(); fx.font_path('eb-garamond', 500); fx.font_path('cormorant-garamond', 600)
    fx.Cracks(901, 420, 3200); fx.Cracks(1401, 300, 2600)

def ffmpeg_out(size, outs, crf_list, audio=True):
    """One raw RGB stream in, one or more H.264/AAC files out (each output optionally rescaled in the graph)."""
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{size[0]}x{size[1]}', '-r', str(FPS), '-i', '-']
    if audio: cmd += ['-i', AUDIO]
    parts = [f'[0:v]split={len(outs)}' + ''.join(f'[s{k}]' for k in range(len(outs)))]
    for k, (path, scale) in enumerate(outs):
        parts.append(f'[s{k}]scale={scale[0]}:{scale[1]}:flags=lanczos[v{k}]' if scale else f'[s{k}]null[v{k}]')
    cmd += ['-filter_complex', ';'.join(parts)]
    for k, ((path, scale), crf) in enumerate(zip(outs, crf_list)):
        cmd += ['-map', f'[v{k}]']
        if audio: cmd += ['-map', '1:a']
        cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
                '-profile:v', 'high', '-movflags', '+faststart']
        if audio: cmd += ['-c:a', 'aac', '-b:a', '192k', '-shortest']
        cmd += [path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)

def main():
    global STANDIN
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default='')
    ap.add_argument('--encode', action='store_true')
    ap.add_argument('--standin', action='store_true')
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--out', default=os.path.join(ROOT, 'build', 'cinematic', 'post_preview'))
    ap.add_argument('--kind', default='portrait', help='preview: clean|portrait|wide')
    ap.add_argument('--game-data', action='store_true')
    a = ap.parse_args()
    STANDIN = a.standin
    if a.game_data or a.encode: write_game_data()
    if a.game_data and not (a.preview or a.encode): return
    if a.standin: os.environ['CINE_STANDIN'] = '1'
    warm()
    if a.preview:
        os.makedirs(a.out, exist_ok=True)
        for g in parse_frames(a.preview):
            t0 = time.time()
            o = render(g, outputs=('clean', a.kind) if a.kind != 'clean' else ('clean',))
            Image.fromarray(o[a.kind]).save(os.path.join(a.out, f'{a.kind}_f{g:04d}.jpg'), quality=92)
            print(f'f{g:04d} {shot_at(g)["id"]} {time.time() - t0:.2f}s', flush=True)
        return
    if a.encode:
        game = os.path.join(ROOT, 'public', 'cinematic'); share = os.path.join(ROOT, 'build', 'cinematic', 'out')
        os.makedirs(game, exist_ok=True); os.makedirs(share, exist_ok=True)
        p_clean = ffmpeg_out((W, H), [(os.path.join(game, 'opening_1080.mp4'), None), (os.path.join(game, 'opening_720.mp4'), (720, 1280))], [24, 23])
        p_port = ffmpeg_out((W, H), [(os.path.join(share, 'the_castle_remembers_portrait.mp4'), None)], [20])
        p_wide = ffmpeg_out((1920, 1080), [(os.path.join(share, 'the_castle_remembers_wide.mp4'), None)], [20])
        from multiprocessing import Pool
        t0 = time.time()
        with Pool(a.workers, initializer=_init_worker, initargs=(STANDIN,)) as pool:
            for k, (g, c, p, w_) in enumerate(pool.imap(_render_bytes, range(N), chunksize=2)):
                p_clean.stdin.write(c); p_port.stdin.write(p); p_wide.stdin.write(w_)
                if g % 48 == 0: print(f'frame {g}/{N}  {time.time() - t0:.0f}s', flush=True)
        for p in (p_clean, p_port, p_wide):
            p.stdin.close(); p.wait()
        print(f'encoded in {time.time() - t0:.0f}s', flush=True)

def _init_worker(standin):
    global STANDIN
    STANDIN = standin

if __name__ == '__main__':
    main()
