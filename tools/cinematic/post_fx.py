"""Post-production toolkit for the opening film (numpy + scipy + PIL only).

Everything here is a pure function of time and fixed seeds, so any frame can be rendered alone, in any process,
in any order (post.py renders frames in parallel and streams them to ffmpeg in order).

The language is material, never digital: paper, grain, gold leaf, varnish craquelure, flakes of gilding falling
away, snow, rain, type set in gold. No glitch.
"""
import math, os, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage, spatial

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CACHE = os.path.join(ROOT, 'build', 'cinematic', 'post_cache')
W, H = 1080, 1920
FPS = 24

# ---------------------------------------------------------------------------------------------------- basics
def hexf(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)

def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, np.float32) - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def sstep(a, b, x):
    """smoothstep for python floats"""
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)

def ease_in(x): x = min(1.0, max(0.0, x)); return x * x
def ease_out(x): x = min(1.0, max(0.0, x)); return 1.0 - (1.0 - x) ** 2
def ease_out3(x): x = min(1.0, max(0.0, x)); return 1.0 - (1.0 - x) ** 3

def load_rgb(path, size=(W, H)):
    im = Image.open(path).convert('RGB')
    if im.size != size: im = im.resize(size, Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0

def to_u8(a): return (np.clip(a, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
def lum(a): return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722

def shoulder(x, knee=0.8):
    """Roll highlights above `knee` smoothly into 1.0 instead of clipping them."""
    y = x.copy()
    m = x > knee
    y[m] = knee + (1.0 - knee) * np.tanh((x[m] - knee) / (1.0 - knee))
    return y

def _cached(name, fn):
    path = os.path.join(CACHE, name + '.npy')
    if os.path.exists(path): return np.load(path)
    a = fn()
    os.makedirs(CACHE, exist_ok=True)
    np.save(path, a)
    return a

def fbm(h, w, seed, scales, weights):
    """Smooth value noise: normal deviates on coarse lattices, B-spline upsampled, summed; zero mean, unit std."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    for s, wt in zip(scales, weights):
        g = rng.standard_normal((h // s + 4, w // s + 4)).astype(np.float32)
        up = ndimage.zoom(g, s, order=3, prefilter=False) if s > 1 else g
        out += wt * up[:h, :w]
    out -= out.mean(); out /= out.std() + 1e-6
    return out

def _rs(a, size, resample):
    a = np.ascontiguousarray(a, np.float32)
    if a.ndim == 2: return np.asarray(Image.fromarray(a, 'F').resize(size, resample), np.float32)
    return np.stack([_rs(a[..., c], size, resample) for c in range(a.shape[2])], -1)

def blur(a, sigma):
    """Gaussian blur; large radii run at reduced resolution (a box-downsample, blur, bilinear upsample)."""
    if sigma <= 0: return a
    h, w = a.shape[:2]
    k = max(1, int(sigma / 2.5))
    tail = (0,) * (a.ndim - 2)
    if k == 1: return ndimage.gaussian_filter(a.astype(np.float32), (sigma, sigma) + tail)
    small = _rs(a, (max(1, w // k), max(1, h // k)), Image.BOX)
    small = ndimage.gaussian_filter(small, (sigma / k, sigma / k) + tail)
    return _rs(small, (w, h), Image.BILINEAR)

def bloom(img, threshold=0.65, sigma=26.0, strength=0.5, tint=(1.0, 0.86, 0.6)):
    hi = np.clip((img - threshold) / (1.0 - threshold), 0.0, None)
    return img + blur(hi, sigma) * strength * np.asarray(tint, np.float32)

def warp(a, s, t, order=1):
    """2-D similarity for image layers: out(p) = a((p - t) / s). Keeps a 'painted' layer pinned to the scene while
    the camera pushes in. s = scale, t = (tx, ty) in pixels."""
    if abs(s - 1.0) < 1e-5 and abs(t[0]) < 0.01 and abs(t[1]) < 0.01: return a
    inv = 1.0 / s
    data = (inv, 0.0, -t[0] * inv, 0.0, inv, -t[1] * inv)
    rs = Image.BILINEAR if order else Image.NEAREST
    if a.ndim == 2:
        return np.asarray(Image.fromarray(np.ascontiguousarray(a, np.float32), 'F').transform((W, H), Image.AFFINE, data, resample=rs), np.float32)
    return np.stack([warp(a[..., c], s, t, order) for c in range(a.shape[2])], -1)

# ---------------------------------------------------------------------------------------------------- fonts
def font_path(family, weight, style='normal'):
    """@fontsource ships woff2; PIL wants sfnt: decompress once into the cache (OFL fonts, bundled in the game too)."""
    dst = os.path.join(CACHE, f'{family}-{weight}-{style}.ttf')
    if not os.path.exists(dst):
        from fontTools.ttLib import TTFont
        src = os.path.join(ROOT, 'node_modules', '@fontsource', family, 'files', f'{family}-latin-{weight}-{style}.woff2')
        f = TTFont(src); f.flavor = None
        os.makedirs(CACHE, exist_ok=True); f.save(dst)
    return dst

# ---------------------------------------------------------------------------------------------------- paper, grain, vignette
PAPER_TINT = hexf('#e8d8bc')

def paper():
    def make():
        tooth = fbm(H, W, 11, (2, 7, 30, 160), (0.25, 0.3, 0.25, 0.2))
        img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img); rng = np.random.default_rng(12)
        for _ in range(3200):
            x, y = rng.uniform(0, W), rng.uniform(0, H); a = rng.normal(0.35, 0.6); L = rng.uniform(5, 26)
            d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=int(rng.uniform(50, 190)), width=1)
        fib = ndimage.gaussian_filter(np.asarray(img, np.float32) / 255.0, 0.7)
        return np.stack([tooth, fib]).astype(np.float32)
    return _cached('paper', make)

@functools.lru_cache(None)
def _vignette():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xx - W / 2) / (W / 2); v = (yy - H * 0.47) / (H / 2)
    r = np.sqrt(u * u * 0.95 + v * v)
    return (1.0 - 0.3 * smoothstep(0.5, 1.45, r)).astype(np.float32)

@functools.lru_cache(None)
def _grain_tiles():
    rng = np.random.default_rng(77)
    t = rng.standard_normal((6, 512, 512)).astype(np.float32)
    t = np.stack([ndimage.gaussian_filter(x, 0.85) for x in t])
    return t / t.std()

def grain(g):
    t = _grain_tiles()[g % 6]
    oy, ox = np.random.default_rng(1000 + g).integers(0, 512, 2)
    t = np.roll(np.roll(t, oy, 0), ox, 1)
    return np.tile(t, (H // 512 + 1, W // 512 + 1))[:H, :W]

def finish(img, g, grain_amp=0.010, paper_amt=1.0, vignette=1.0):
    """The film's surface: ink laid on toothy paper, a soft vignette, fine grain in the mid-tones."""
    P = paper()
    l = lum(img)
    m = 1.0 - paper_amt * (0.022 * np.clip(P[0], -2.5, 2.5) + 0.05 * P[1])
    out = img * m[..., None]
    out += (paper_amt * 0.011 * (1.0 - l) * np.clip(0.6 + 0.35 * P[0], 0, 1.4))[..., None] * PAPER_TINT
    if vignette: out *= (1.0 - vignette * (1.0 - _vignette()))[..., None]
    amp = grain_amp * (0.35 + 2.4 * l * (1.0 - l))
    out += (grain(g) * amp)[..., None]
    return np.clip(out, 0.0, 1.0)

# ---------------------------------------------------------------------------------------------------- gold
GOLD = [(0.0, '#040201'), (0.16, '#241205'), (0.38, '#7a4a16'), (0.6, '#c8923a'), (0.8, '#f0cf7e'), (1.0, '#fff6dc')]
_GX = np.array([p for p, _ in GOLD], np.float32)
_GC = np.stack([hexf(c) for _, c in GOLD])
GOLD_HL = hexf('#ffe7a8')
GOLD_GLOW = hexf('#ffb040')
LEAF_GOLD = hexf('#d9a94a')
BOLE = hexf('#6a3420')
GESSO = hexf('#c9a57a')

def gold_ramp(l):
    return np.stack([np.interp(l, _GX, _GC[:, c]) for c in range(3)], -1).astype(np.float32)

def leaf():
    """Gold leaf: squares laid in offset rows, each a slightly different tone, overlapping seams, burnished."""
    def make():
        rng = np.random.default_rng(31); s = 92.0
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        row = np.floor(yy / s).astype(np.int32)
        offs = rng.uniform(0, s, row.max() + 2).astype(np.float32)
        xs = xx + offs[row]
        col = np.floor(xs / s).astype(np.int32)
        tones = rng.normal(1.0, 0.045, (row.max() + 2, col.max() + 2)).astype(np.float32)
        fx = xs - col * s; fy = yy - row * s
        e = np.minimum(np.minimum(fx, s - fx), np.minimum(fy, s - fy))
        seam = np.exp(-(e / 1.2) ** 2) * np.clip(0.6 + 0.5 * fbm(H, W, 32, (3, 12), (0.6, 0.4)), 0, 1.3)
        burnish = fbm(H, W, 33, (60, 240), (0.5, 0.5))
        return (tones[row, col] * (1 + 0.035 * burnish) * (1 + 0.08 * seam)).astype(np.float32)
    return _cached('leaf', make)

def gild(img, amount=0.45, leaf_amt=1.0):
    """Memory is gilded: pull the image toward a gold-leaf rendering of itself (strongest in the lights)."""
    l = lum(img)
    gold = gold_ramp(np.clip(l * 1.1, 0.0, 1.0))
    w = (amount * (0.35 + 0.65 * smoothstep(0.05, 0.55, l)))[..., None]
    out = img * (1.0 - w) + gold * w
    if leaf_amt: out = out * (1.0 + (leaf() - 1.0) * leaf_amt * smoothstep(0.04, 0.3, l))[..., None]
    return out

def icon_gild(img, amount=0.85, gain=2.4, leaf_amt=1.0):
    """Memory as a gilded icon: the sky and the lights become gold leaf laid on bole; the dark shapes stay ink."""
    l = lum(img)
    gold = gold_ramp(np.clip(l * gain, 0.0, 1.0))
    w = (amount * smoothstep(0.015, 0.16, l))[..., None]
    out = img * (1.0 - w) + gold * w
    if leaf_amt: out = out * (1.0 + (leaf() - 1.0) * leaf_amt * smoothstep(0.04, 0.22, l))[..., None]
    return out

# ---------------------------------------------------------------------------------------------------- craquelure
class Cracks:
    """A varnish craquelure over the whole frame. Coarse cells are the flakes that fall; fine cells are the crazing
    inside them. Both are Voronoi networks whose edges wobble (the pixel lattice is displaced by noise before the
    nearest-seed query), so no cell is a clean polygon and every crack is hand-irregular."""
    def __init__(self, seed, n_coarse=170, n_fine=2400):
        path = os.path.join(CACHE, f'cracks_v3_{seed}_{n_coarse}_{n_fine}.npz')
        if os.path.exists(path):
            z = np.load(path)
            self.lab_c, self.ed_c, self.ed_f, self.seeds_c = z['lab_c'], z['ed_c'].astype(np.float32), z['ed_f'].astype(np.float32), z['seeds_c']
            self.wfield = z['wfield'].astype(np.float32)
        else:
            rng = np.random.default_rng(seed)
            self.seeds_c = self._seeds(rng, n_coarse)
            self.lab_c, self.ed_c = self._net(self.seeds_c, seed + 10, 5.5, (7, 30, 120), (0.14, 0.36, 0.5))
            _, self.ed_f = self._net(self._seeds(rng, n_fine), seed + 20, 1.8, (4, 12, 40), (0.2, 0.4, 0.4))
            self.wfield = np.clip(1.0 + 0.45 * fbm(H, W, seed + 30, (20, 90), (0.5, 0.5)), 0.45, 2.0).astype(np.float32)
            os.makedirs(CACHE, exist_ok=True)
            np.savez(path, lab_c=self.lab_c, ed_c=self.ed_c.astype(np.float16), ed_f=self.ed_f.astype(np.float16),
                     seeds_c=self.seeds_c, wfield=self.wfield.astype(np.float16))
        self.n = int(self.lab_c.max()) + 1
        self.line_c = np.clip(1.0 - self.ed_c / (2.6 * self.wfield), 0.0, 1.0) ** 1.2
        self.line_f = np.clip(1.0 - self.ed_f / (1.3 * self.wfield), 0.0, 1.0) ** 1.5
        self.inner = np.clip((self.ed_c - 1.4) / 1.4, 0.0, 1.0)       # flake alpha: the crack itself is a gap
        self.cupping = np.exp(-self.ed_c / 10.0).astype(np.float32)   # cells curl up at their edges

    @staticmethod
    def _seeds(rng, n, margin=60):
        step = math.sqrt((W + 2 * margin) * (H + 2 * margin) / n)
        xs = np.arange(-margin, W + margin, step); ys = np.arange(-margin, H + margin, step)
        gx, gy = np.meshgrid(xs, ys)
        pts = np.stack([gx.ravel(), gy.ravel()], -1) + rng.uniform(-0.42, 0.42, (gx.size, 2)) * step
        return pts.astype(np.float32)

    @staticmethod
    def _net(pts, seed, wobble, scales, weights):
        dx = fbm(H, W, seed, scales, weights) * wobble
        dy = fbm(H, W, seed + 1, scales, weights) * wobble
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        q = np.stack([(xx + dx).ravel(), (yy + dy).ravel()], -1)
        d, i = spatial.cKDTree(pts).query(q, k=2, workers=-1)
        return i[:, 0].reshape(H, W).astype(np.int32), (d[:, 1] - d[:, 0]).reshape(H, W).astype(np.float32)

    def schedule(self, origin, t0, speed_c, speed_f, jitter=0.08, lag_f=0.05, seed=3):
        """When each pixel's crack arrives: a front spreading from `origin` (px) at `speed` px/s, unevenly."""
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.hypot(xx - origin[0], yy - origin[1])
        n = fbm(H, W, seed, (30, 120), (0.5, 0.5))
        self.t_c = (t0 + d / speed_c + jitter * n).astype(np.float32)
        self.t_f = (t0 + lag_f + d / speed_f + jitter * 1.4 * fbm(H, W, seed + 1, (12, 60), (0.5, 0.5))).astype(np.float32)
        return self

    def state(self, t):
        gap = self.line_c * smoothstep(0.0, 0.05, t - self.t_c)
        craze = self.line_f * smoothstep(0.0, 0.08, t - self.t_f)
        cup = 1.0 - 0.13 * self.cupping * smoothstep(0.0, 0.25, t - self.t_c)
        return gap, craze, cup

def crazed(past, present, st, hl=0.3, glow=0.0):
    """The gilded layer crazes: fine crazing darkens it, cells cup at their edges and the lifted rims catch light;
    each coarse crack is a dark gap in which the other memory (the ruin) dimly shows."""
    gap, craze, cup = st
    out = past * (cup * (1.0 - 0.6 * craze))[..., None]
    halo = np.clip(blur(gap, 1.3) * 1.6 - gap, 0.0, 1.0)                    # the dirty edge of each crack
    out = out * (1.0 - 0.55 * halo)[..., None]
    edge = np.maximum(gap, 0.5 * craze)
    lift = np.clip(np.roll(np.roll(edge, -2, 0), -1, 1) - edge, 0.0, 1.0)  # the rim above-left catches the light
    out = out + lift[..., None] * GOLD_HL * hl
    out = out * (1.0 - gap[..., None]) + present * 0.55 * gap[..., None]
    if glow: out = out + (gap + 0.35 * craze)[..., None] * GOLD_GLOW * glow
    return out

# ---------------------------------------------------------------------------------------------------- flakes
def _affine(theta, psi, cphi, s):
    c, sn = math.cos(theta), math.sin(theta)
    R = np.array([[c, -sn], [sn, c]])
    cp, sp = math.cos(psi), math.sin(psi)
    P = np.array([[cp, -sp], [sp, cp]])
    return s * R @ P @ np.diag([cphi, 1.0]) @ P.T

class Flakes:
    """The coarse cells of a Cracks network as sprites that detach and fall: fluttering gold-leaf physics (terminal
    velocity, sway, tumbling that shows the gilt back and throws glints), a wave of detachment from `origin`.
    Some flakes ('return') fall a little and float back up into place: the castle remembering incorrectly."""
    def __init__(self, cracks, tex, origin, T0, wave_speed, seed, vt=(420.0, 900.0), g=1400.0, push=(30.0, 170.0),
                 jitter=0.3, returners=0.0, return_at=None, return_fade=(0.0, 0.0), explosive=False, keep=None, wind=25.0, hole=None, rock=0.8, dissolve_dark=True, life=None):
        rng = np.random.default_rng(seed)
        self.wind = wind
        lab, inner = cracks.lab_c, cracks.inner
        lf = leaf()
        objs = ndimage.find_objects(lab + 1)
        self.fl = []
        ids = [i for i, sl in enumerate(objs) if sl is not None]
        for i in ids:
            sl = objs[i]
            if keep is not None and not keep(i): continue
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            y0, x0 = max(0, y0 - 2), max(0, x0 - 2); y1, x1 = min(H, y1 + 2), min(W, x1 + 2)
            m = (lab[y0:y1, x0:x1] == i) * inner[y0:y1, x0:x1]
            if hole is not None: m = m * (1.0 - hole[y0:y1, x0:x1])
            if m.sum() < 30: continue
            a8 = (m * 255 + 0.5).astype(np.uint8)
            rim = np.clip(m - ndimage.minimum_filter(m, 3), 0, 1)[..., None] * 0.75   # gesso at the broken edge
            fr = tex[y0:y1, x0:x1] * (1 - rim) + GESSO * rim
            front = np.dstack([to_u8(fr), a8])
            bk = np.clip(BOLE[None, None, :] * (0.8 + 0.4 * (lf[y0:y1, x0:x1, None] - 0.9)), 0, 1) * (1 - rim) + GESSO * 0.7 * rim
            back = np.dstack([to_u8(bk), a8])
            ys, xs = np.nonzero(m > 0.5)
            cx, cy = x0 + xs.mean(), y0 + ys.mean()
            bright = float((lum(tex[y0:y1, x0:x1]) * m).sum() / (m.sum() + 1e-6))
            gilt = sstep(0.08, 0.22, bright)       # ink-dark chips drop and crumble; gilt leaf flutters and glints
            d = math.hypot(cx - origin[0], cy - origin[1])
            u = np.array([cx - origin[0], cy - origin[1]]) / (d + 1e-6)
            f = dict(i=i, x0=x0, y0=y0, cx=cx, cy=cy, lx=cx - x0, ly=cy - y0,
                     front=Image.fromarray(front, 'RGBA'), back=Image.fromarray(back, 'RGBA'),
                     T=T0 + d / wave_speed + rng.uniform(0, jitter),
                     vt=rng.uniform(*vt) * (1.7 - 0.7 * gilt), g=g, v0=u * rng.uniform(*push) + np.array([0.0, -rng.uniform(0, 70)]),
                     th=rng.normal(0, 0.4 + 0.8 * gilt), ph=rng.uniform(0.6, 3.6) * (0.35 + 0.65 * gilt) * rng.choice([-1, 1]),
                     psi=rng.uniform(0, math.pi), zr=rng.uniform(-0.05, 0.12), sway=rng.uniform(4, 26) * (0.25 + 0.75 * gilt),
                     sw=rng.uniform(2.0, 4.5), sp=rng.uniform(0, 6.3), life=(0.5, 1.25) if rng.random() < 0.45 else (0.45 + 2.3 * gilt, 1.1 + 2.5 * gilt),
                     kind='fall', gilt=gilt, rock=rng.random() < rock, rw=rng.uniform(2.6, 5.2), ra=rng.uniform(0.35, 1.15))
            if explosive:
                f['v0'] = u * rng.uniform(*push) * (0.6 + 0.8 * rng.random()) + np.array([0.0, -rng.uniform(40, 220)])
            if dissolve_dark and gilt < 0.35: f['kind'] = 'dissolve'   # ink looks alike in both memories: let it fade
            if life is not None: f['life'] = (life[0] * rng.uniform(0.8, 1.2), life[1] * rng.uniform(0.9, 1.1))
            self.fl.append(f)
        # returners: gilt cells about the castle (the middle of the frame), never the sky's edges
        cand = [f for f in self.fl if f['kind'] == 'fall' and f['gilt'] > 0.6 and abs(f['cx'] - W / 2) < W * 0.36 and H * 0.25 < f['cy'] < H * 0.62]
        n_ret = min(len(cand), int(round(returners * len(self.fl))))
        for j in (rng.choice(len(cand), size=n_ret, replace=False) if n_ret else []):
            f = cand[j]
            f['kind'] = 'return'
            f['D'] = rng.uniform(1.7, 2.5)                           # out-and-back duration
            f['T'] = min(f['T'], (return_at or f['T'] + 1.0) - f['D'] * 0.55)
            f['drop'] = rng.uniform(70, 170)
            f['fade'] = (return_fade[0] + rng.uniform(0, 0.8), return_fade[1] + rng.uniform(0, 0.8))
        self.T = np.full(cracks.n, np.inf, np.float32)
        for f in self.fl: self.T[f['i']] = f['T']

    def attached(self, lab, t):
        """Per-pixel: is the cell still on the painting?"""
        return (self.T[lab] > t).astype(np.float32)

    def _pose(self, f, t):
        tau = t - f['T']
        if f['kind'] == 'dissolve':
            return f['cx'], f['cy'], 0.0, 1.0, 1.0, 1.0 - sstep(0.0, 0.55, tau)
        if f['kind'] == 'return':
            D = f['D']
            if tau >= D:                                             # home again: flat, in place, fading slowly
                a = 1.0 - sstep(f['fade'][0], f['fade'][1], t) if f['fade'][1] > f['fade'][0] else 1.0
                return f['cx'], f['cy'], 0.0, 1.0, 1.0, a
            u = tau / D
            s_ = math.sin(math.pi * u)
            x = f['cx'] + 0.4 * f['sway'] * math.sin(f['sw'] * tau + f['sp']) * s_
            y = f['cy'] + f['drop'] * s_ ** 0.8
            return x, y, 0.35 * f['th'] * s_, math.cos(2 * math.pi * sstep(0.0, 1.0, u)), 1.0 + 0.08 * s_, 1.0
        k = f['vt'] / f['g']
        yf = f['vt'] * (tau - k * (1.0 - math.exp(-tau / k)))
        kp = 0.4
        px, py = f['v0'] * kp * (1.0 - math.exp(-tau / kp))
        a = 1.0 - sstep(f['life'][0], f['life'][1], tau)
        ramp = 1.0 - math.exp(-tau / 0.4)
        if f['rock']:             # a thin leaf falls rocking like a pendulum, sliding sideways with each swing
            ph = f['rw'] * tau
            x = f['cx'] + px + f['sway'] * (1.0 - math.cos(ph)) * ramp * (1 if f['sp'] > 3.14 else -1) + self.wind * tau
            y = f['cy'] + py + yf
            return x, y, 0.25 * f['th'] * tau, math.cos(f['ra'] * math.sin(ph) * ramp), 1.0 + f['zr'] * tau, a
        x = f['cx'] + px + f['sway'] * math.sin(f['sw'] * tau + f['sp']) * ramp + self.wind * tau
        y = f['cy'] + py + yf
        return x, y, f['th'] * tau, math.cos(f['ph'] * tau), 1.0 + f['zr'] * tau, a

    def draw(self, canvas, t, sim=(1.0, (0.0, 0.0)), shade=1.0):
        """Composite every detached flake onto a PIL RGBA canvas. `sim` pins flake origins to the scene."""
        s0, (tx, ty) = sim
        for f in self.fl:
            if t < f['T']: continue
            x, y, th, cphi, sc, a = self._pose(f, t)
            if a <= 0.01 or abs(cphi) < 0.05: continue
            x, y = x * s0 + tx, y * s0 + ty
            M = _affine(th, f['psi'], cphi, sc * s0)
            spr = f['front'] if cphi > 0 else f['back']
            w_, h_ = spr.size
            corners = np.array([[-f['lx'], -f['ly']], [w_ - f['lx'], -f['ly']], [-f['lx'], h_ - f['ly']], [w_ - f['lx'], h_ - f['ly']]]) @ M.T
            ox, oy = int(math.floor(x + corners[:, 0].min())) - 1, int(math.floor(y + corners[:, 1].min())) - 1
            ow, oh = int(math.ceil(corners[:, 0].max() - corners[:, 0].min())) + 3, int(math.ceil(corners[:, 1].max() - corners[:, 1].min())) + 3
            if ox >= W or oy >= H or ox + ow <= 0 or oy + oh <= 0: continue
            Mi = np.linalg.inv(M)
            off = Mi @ (np.array([ox, oy]) - np.array([x, y])) + np.array([f['lx'], f['ly']])
            im = spr.transform((ow, oh), Image.AFFINE, (Mi[0, 0], Mi[0, 1], off[0], Mi[1, 0], Mi[1, 1], off[1]), resample=Image.BILINEAR)
            arr = np.asarray(im, np.float32)
            phase = math.acos(max(-1.0, min(1.0, cphi)))
            if cphi > 0:          # the gilt face: darker as it turns away, a glint as it passes the light
                k = shade * (0.5 + 0.5 * cphi) * (1.0 + 0.9 * math.exp(-((phase - 0.8) ** 2) / 0.015))
            else:                 # the back: dull red bole
                k = shade * (0.55 + 0.35 * -cphi)
            arr[..., :3] *= k
            arr[..., 3] *= a
            im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
            cx0, cy0 = max(0, -ox), max(0, -oy)
            cx1, cy1 = min(ow, W - ox), min(oh, H - oy)
            if cx1 <= cx0 or cy1 <= cy0: continue
            if (cx0, cy0, cx1, cy1) != (0, 0, ow, oh): im = im.crop((cx0, cy0, cx1, cy1))
            canvas.alpha_composite(im, dest=(ox + cx0, oy + cy0))
        return canvas

class Hangers:
    """Small shards of the gilded image that do not fall: they hang in the air where the windows were, glowing,
    and go out one by one over the centuries. Anchored in WORLD space so they stay on the castle as the camera moves."""
    def __init__(self, tex, anchors, seed, fades):
        """anchors: [(x_px, y_px, world_xyz)] at the frame `tex` came from; fades: [(t_start, t_end, flicker)] per shard.
        Each shard's release time (film seconds) is set afterwards in s['T'] (= when its parent flake falls)."""
        rng = np.random.default_rng(seed)
        tex8 = to_u8(tex)
        self.sh = []
        hole = Image.new('L', (W, H), 0); hd = ImageDraw.Draw(hole)
        for k, ((ax, ay, wp), fd) in enumerate(zip(anchors, fades)):
            r = rng.uniform(15, 26)
            n = int(rng.integers(6, 9))
            ang = np.sort(rng.uniform(0, 2 * math.pi, n))
            poly = [(ax + r * rng.uniform(0.6, 1.25) * math.cos(a_), ay + r * rng.uniform(0.6, 1.25) * math.sin(a_)) for a_ in ang]
            hd.polygon(poly, fill=255)
            x0, y0 = int(ax - 2 * r), int(ay - 2 * r); sz = int(4 * r)
            m = Image.new('L', (sz, sz), 0)
            ImageDraw.Draw(m).polygon([(px - x0, py - y0) for px, py in poly], fill=255)
            crop = np.zeros((sz, sz, 3), np.uint8)
            ys0, xs0 = max(0, y0), max(0, x0); ys1, xs1 = min(H, y0 + sz), min(W, x0 + sz)
            crop[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0] = tex8[ys0:ys1, xs0:xs1]
            spr = Image.fromarray(np.dstack([crop, np.asarray(m)]), 'RGBA')
            self.sh.append(dict(spr=spr, lx=ax - x0, ly=ay - y0, wp=wp, T=float('inf'), fade=fd,
                                bob=rng.uniform(4, 10), bw=rng.uniform(0.7, 1.6), bp=rng.uniform(0, 6.3), rise=rng.uniform(20, 55),
                                rot=rng.uniform(0.05, 0.25), r=r))
        self.hole = np.asarray(hole, np.float32) / 255.0
        self.halo = self._halo()

    @staticmethod
    def _halo(size=160):
        yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) - size / 2
        g = np.exp(-(xx ** 2 + yy ** 2) / (2 * (size / 6.5) ** 2))
        return g

    def alpha(self, s, t):
        t0, t1, flick = s['fade']
        a = 1.0 - sstep(t0, t1, t)
        if flick and t0 - 0.6 < t < t1:                             # the last one gutters before it goes out
            a *= 0.6 + 0.4 * (0.5 + 0.5 * math.sin(t * 37.0)) * (0.5 + 0.5 * math.sin(t * 23.0 + 1.0))
        return a * sstep(s['T'], s['T'] + 0.15, t) if t < s['T'] + 0.15 else a

    def draw(self, canvas_f, t, project, depth_scale=1.0):
        """canvas_f: float HxWx3 (additive halos applied here); returns (float image, list of (sprite, dest) to paste)."""
        pastes = []
        for s in self.sh:
            a = self.alpha(s, t)
            if a <= 0.01: continue
            tau = max(0.0, t - s['T'])
            x, y, sc = project(s['wp'])
            x += s['bob'] * 0.5 * math.sin(s['bw'] * tau + s['bp'])
            y += -s['rise'] * ease_out(tau / 2.5) + s['bob'] * math.sin(s['bw'] * 0.8 * tau + s['bp'] + 1.0)
            sc *= depth_scale
            th = s['rot'] * math.sin(0.6 * tau + s['bp'])
            M = _affine(th, 0.0, 1.0, sc)
            spr = s['spr']; w_, h_ = spr.size
            Mi = np.linalg.inv(M)
            ow = oh = int(max(w_, h_) * sc * 1.5) + 4
            ox, oy = int(x - ow / 2), int(y - oh / 2)
            off = Mi @ (np.array([ox, oy]) - np.array([x, y])) + np.array([s['lx'], s['ly']])
            im = spr.transform((ow, oh), Image.AFFINE, (Mi[0, 0], Mi[0, 1], off[0], Mi[1, 0], Mi[1, 1], off[1]), resample=Image.BILINEAR)
            arr = np.asarray(im, np.float32)
            arr[..., :3] = np.clip(arr[..., :3] * (1.15 + 0.25 * math.sin(3.0 * tau + s['bp'])), 0, 255)
            arr[..., 3] *= a
            pastes.append((Image.fromarray(arr.astype(np.uint8), 'RGBA'), (ox, oy)))
            # the halo: warm light around the shard
            hs = int(160 * sc * s['r'] / 20.0) | 1
            if hs >= 9:
                hal = _rs(self.halo, (hs, hs), Image.BILINEAR) * 0.42 * a
                hx0, hy0 = int(x - hs / 2), int(y - hs / 2)
                ya, yb, xa, xb = max(0, hy0), min(H, hy0 + hs), max(0, hx0), min(W, hx0 + hs)
                if yb > ya and xb > xa:
                    canvas_f[ya:yb, xa:xb] += hal[ya - hy0:yb - hy0, xa - hx0:xb - hx0, None] * GOLD_GLOW
        return canvas_f, pastes

def paste_all(img_f, pastes):
    if not pastes: return img_f
    cv = Image.fromarray(to_u8(img_f)).convert('RGBA')
    for im, (ox, oy) in pastes:
        w_, h_ = im.size
        cx0, cy0 = max(0, -ox), max(0, -oy); cx1, cy1 = min(w_, W - ox), min(h_, H - oy)
        if cx1 <= cx0 or cy1 <= cy0: continue
        cv.alpha_composite(im.crop((cx0, cy0, cx1, cy1)), dest=(ox + cx0, oy + cy0))
    return np.asarray(cv.convert('RGB'), np.float32) / 255.0

# ---------------------------------------------------------------------------------------------------- weather
def snow(t, seed=5, n=620, amount=1.0, wind=90.0):
    """Snow at depth: small far flakes, stretched a little by their fall; large soft near flakes out of focus."""
    rng = np.random.default_rng(seed)
    z = rng.random(n) ** 1.25
    x0, y0 = rng.uniform(-200, W + 200, n), rng.uniform(0, H + 60, n)
    vy = 60 + 300 * z; vx = wind * (0.4 + z)
    sw, sp = rng.uniform(0.6, 1.6, n), rng.uniform(0, 6.3, n)
    x = (x0 + vx * t + 22 * z * np.sin(sw * t + sp)) % (W + 400) - 200
    y = (y0 + vy * t) % (H + 60) - 30
    r = 1.0 + 3.6 * z ** 1.5
    far = Image.new('L', (W, H), 0); near = Image.new('L', (W, H), 0)
    df, dn = ImageDraw.Draw(far), ImageDraw.Draw(near)
    for i in np.argsort(z):
        d, al = (dn, 150 + 90 * z[i]) if z[i] > 0.82 else (df, 70 + 170 * z[i])
        rx, ry = r[i], r[i] * (1.0 + 1.1 * z[i])
        d.ellipse([x[i] - rx, y[i] - ry, x[i] + rx, y[i] + ry], fill=int(al * amount))
    return blur(np.asarray(far, np.float32) / 255.0, 1.0) + blur(np.asarray(near, np.float32) / 255.0, 3.2) * 0.8

def rain(t, seed=6, n=520, amount=1.0, angle=0.2):
    rng = np.random.default_rng(seed)
    z = rng.random(n)
    x0, y0 = rng.uniform(-300, W + 300, n), rng.uniform(0, H, n)
    v = 1500 + 1300 * z
    L = 26 + 70 * z
    dx, dy = math.sin(angle), math.cos(angle)
    x = (x0 + dx * v * t) % (W + 600) - 300
    y = (y0 + dy * v * t) % (H + 200) - 100
    lay = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lay)
    for i in range(n):
        d.line([(x[i], y[i]), (x[i] - dx * L[i], y[i] - dy * L[i])], fill=int((40 + 70 * z[i]) * amount), width=1 if z[i] < 0.7 else 2)
    return blur(np.asarray(lay, np.float32) / 255.0, 0.7)

def motes(t, seed=9, n=260, amount=1.0, rise=38.0, box=(0, 0, W, H)):
    """Slow drifting gold dust (after the Sundering, around the title)."""
    rng = np.random.default_rng(seed)
    bx0, by0, bx1, by1 = box
    x0, y0 = rng.uniform(bx0, bx1, n), rng.uniform(by0, by1, n)
    z = rng.random(n)
    x = x0 + 14 * np.sin(0.5 * t * (0.5 + z) + x0)
    y = by0 + (y0 - by0 - rise * (0.4 + z) * t) % (by1 - by0)
    tw = 0.5 + 0.5 * np.sin(t * (2 + 3 * z) + y0) ** 8
    lay = np.zeros((H, W), np.float32)
    xi, yi = np.clip(x.astype(int), 0, W - 1), np.clip(y.astype(int), 0, H - 1)
    np.add.at(lay, (yi, xi), (0.25 + 0.75 * tw) * amount * (0.4 + 0.6 * z))
    return blur(lay, 1.3) * 5.0

def mist(t, seed=21, speed=26.0, y0=0.55, y1=1.0, amount=1.0):
    """Low mist drifting across the lower frame: two layers of noise sliding at different speeds (parallax)."""
    def make():
        w2 = 2 * W
        a_ = fbm(H, w2, seed, (60, 240), (0.5, 0.5)); b_ = fbm(H, w2, seed + 1, (25, 90), (0.6, 0.4))
        return np.stack([a_, b_]).astype(np.float32)
    tex = _cached(f'mist_{seed}', make)
    o1, o2 = int(speed * t) % (2 * W), int(speed * 1.7 * t + 400) % (2 * W)
    l1 = np.roll(tex[0], -o1, 1)[:, :W]; l2 = np.roll(tex[1], -o2, 1)[:, :W]
    m = np.clip(0.5 + 0.35 * l1 + 0.2 * l2, 0, 1) ** 2.2
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    return m * smoothstep(y0, y1, yy) * amount

# ---------------------------------------------------------------------------------------------------- type
class Subtitles:
    """Restrained narration subtitles: EB Garamond, sentence case, warm parchment white with a soft shadow,
    fading in and out, one at a time, centred in the lower third."""
    def __init__(self, subs, width=W, height=H, size=46, max_w=0.8, base=0.876):
        self.font = ImageFont.truetype(font_path('eb-garamond', 500), size)
        self.subs = []
        for s in subs:
            spr, (ox, oy) = self._render(s['text'], width, height, size, max_w, base)
            self.subs.append(dict(start=s['start'], end=s['end'], spr=spr, dest=(ox, oy)))

    def _wrap(self, text, maxw):
        words = text.split()
        if self.font.getlength(text) <= maxw: return [text]
        best = None
        for k in range(1, len(words)):
            a, b = ' '.join(words[:k]), ' '.join(words[k:])
            m = max(self.font.getlength(a), self.font.getlength(b))
            if m <= maxw and (best is None or m < best[0]): best = (m, [a, b])
        return best[1] if best else [text]

    def _render(self, text, width, height, size, max_w, base):
        lines = self._wrap(text, width * max_w)
        lh = int(size * 1.32)
        pad = 72  # room for the scrim's feather (the text stays centred on `base`)
        tw = int(max(self.font.getlength(l) for l in lines)) + 2 * pad
        th = lh * len(lines) + 2 * pad
        m = Image.new('L', (tw, th), 0); d = ImageDraw.Draw(m)
        box = Image.new('L', (tw, th), 0); db = ImageDraw.Draw(box)
        for k, l in enumerate(lines):
            lw = self.font.getlength(l)
            d.text(((tw - lw) / 2, pad + k * lh), l, font=self.font, fill=255)
            db.rectangle(((tw - lw) / 2 - size * 0.3, pad + k * lh - size * 0.05, (tw + lw) / 2 + size * 0.3, pad + k * lh + size * 1.2), fill=255)
        a = np.asarray(m, np.float32) / 255.0
        sh = np.clip(blur(a, 8.0) * 1.5 + blur(a, 2.0) * 0.6, 0, 1)
        # scrim: a feathered dark cloud behind the lines, only raised over bright pictures (see draw)
        sc = blur(np.asarray(box, np.float32) / 255.0, size * 0.55)
        sc = np.clip(sc / max(float(sc.max()), 1e-6), 0, 1)
        col = hexf('#efe4cc')
        text = Image.fromarray(np.dstack([to_u8(np.broadcast_to(col, a.shape + (3,))), to_u8(a)]), 'RGBA')
        shadow = np.dstack([np.zeros(a.shape + (3,), np.uint8), to_u8(sh)])
        scrim = np.dstack([np.zeros(a.shape + (3,), np.uint8), to_u8(sc)])
        return (text, shadow, scrim), (int((width - tw) / 2), int(height * base - th / 2))

    def draw(self, canvas, t, fade_in=0.22, fade_out=0.3):
        for s in self.subs:
            if s['start'] - 0.01 <= t <= s['end'] + 0.01:
                a = min(sstep(s['start'], s['start'] + fade_in, t), 1.0 - sstep(s['end'] - fade_out, s['end'], t))
                if a <= 0.01: continue
                text, shadow, scrim = s['spr']
                x, y = s['dest']
                h_, w_ = shadow.shape[:2]
                under = np.asarray(canvas.crop((x, y, x + w_, y + h_)).convert('L'), np.float32) / 255.0
                k = 0.62 + 0.5 * float(smoothstep(0.2, 0.7, np.percentile(under, 75)))
                ks = 0.78 * float(smoothstep(0.3, 0.75, np.percentile(under[shadow[..., 3] > 8], 95)))
                if ks * a > 0.01:
                    sc = scrim.copy(); sc[..., 3] = (sc[..., 3] * (ks * a)).astype(np.uint8)
                    canvas.alpha_composite(Image.fromarray(sc, 'RGBA'), dest=(x, y))
                sh = shadow.copy(); sh[..., 3] = (sh[..., 3] * min(1.0, k * a)).astype(np.uint8)
                canvas.alpha_composite(Image.fromarray(sh, 'RGBA'), dest=(x, y))
                if a < 0.999:
                    arr = np.asarray(text).copy(); arr[..., 3] = (arr[..., 3] * a).astype(np.uint8); text = Image.fromarray(arr, 'RGBA')
                canvas.alpha_composite(text, dest=(x, y))
        return canvas
