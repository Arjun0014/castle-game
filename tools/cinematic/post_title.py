"""S17: the title. Gold dust condenses out of the dark and assembles the crest of House Vaelor, then
THE CASTLE, then REMEMBERS — each on a bell of the score — then a light runs across the gold and it all goes dark.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import spatial
import post_fx as fx
from post_fx import W, H, hexf, smoothstep, sstep, blur, ease_out3
import crest as crest_mod

LINES = ['THE CASTLE', 'REMEMBERS']
SIZE = 116
TRACK = 0.15            # em
CREST_C = (W / 2, 0.392 * H)
CREST_R = 64.0
BASELINES = (0.486 * H, 0.486 * H + 134)
# arrival windows (s after the title starts): crest on the first theme bell, the lines on the next two
WINDOWS = {'crest': (0.5, 0.92), 'l0': (0.95, 1.52), 'l1': (1.5, 2.07)}

def _tracked(draw, text, font, y, ss, fill=255):
    tr = TRACK * SIZE * ss
    widths = [font.getlength(c) for c in text]
    total = sum(widths) + tr * (len(text) - 1)
    x = (W * ss - total) / 2
    for c, w_ in zip(text, widths):
        draw.text((x, y), c, font=font, fill=fill, anchor='ls')
        x += w_ + tr

def _masks(ss=2):
    font = ImageFont.truetype(fx.font_path('cormorant-garamond', 600), SIZE * ss)
    out = {}
    for k, (line, base) in enumerate(zip(LINES, BASELINES)):
        m = Image.new('L', (W * ss, H * ss), 0)
        _tracked(ImageDraw.Draw(m), line, font, base * ss, ss)
        out[f'l{k}'] = np.asarray(m.resize((W, H), Image.LANCZOS), np.float32) / 255.0
    # the crest, from its canonical vector (unit space, +y up, seal radius 1)
    d = crest_mod.build()
    cx, cy, r = CREST_C[0] * ss, CREST_C[1] * ss, CREST_R * ss
    P = lambda p: (cx + p[0] * r, cy - p[1] * r)
    gold = Image.new('L', (W * ss, H * ss), 0); blood = Image.new('L', (W * ss, H * ss), 0)
    g, b = ImageDraw.Draw(gold), ImageDraw.Draw(blood)
    g.polygon([P(p) for p in d['rim_outer']], fill=255); g.polygon([P(p) for p in d['rim_inner']], fill=0)
    for x, y, rr in d['beads']:
        X, Y = P((x, y)); g.ellipse([X - rr * r, Y - rr * r, X + rr * r, Y + rr * r], fill=255)
    g.polygon([P(p) for p in d['annulet_outer']], fill=255); g.polygon([P(p) for p in d['annulet_inner']], fill=0)
    for poly in d['crown']: g.polygon([P(p) for p in poly], fill=255)
    for x, y, rr in d['pearls']:
        X, Y = P((x, y)); g.ellipse([X - rr * r, Y - rr * r, X + rr * r, Y + rr * r], fill=255)
    for x, y, rr in d['jewels']:
        X, Y = P((x, y)); g.ellipse([X - rr * r, Y - rr * r, X + rr * r, Y + rr * r], fill=0)
    b.polygon([P(p) for p in d['goutte']], fill=255)
    out['crest'] = np.asarray(gold.resize((W, H), Image.LANCZOS), np.float32) / 255.0
    out['blood'] = np.asarray(blood.resize((W, H), Image.LANCZOS), np.float32) / 255.0
    return out

class Title:
    def __init__(self, seed=17, n=2800):
        self.m = _masks()
        rng = np.random.default_rng(seed)
        # gold material: a warm vertical gradient per element, gold leaf, relief lit from the upper left
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.diag = xx + 0.45 * (yy - H * 0.47)
        grad = np.zeros((H, W, 3), np.float32)
        top, mid, bot = hexf('#f6e4ac'), hexf('#d6a852'), hexf('#8a5a20')
        for key, (y0, y1) in (('l0', (BASELINES[0] - SIZE * 0.66, BASELINES[0])), ('l1', (BASELINES[1] - SIZE * 0.66, BASELINES[1])),
                              ('crest', (CREST_C[1] - CREST_R, CREST_C[1] + CREST_R))):
            u = np.clip((yy - y0) / (y1 - y0), 0, 1)[..., None]
            col = np.where(u < 0.5, top + (mid - top) * (u / 0.5), mid + (bot - mid) * ((u - 0.5) / 0.5))
            grad = np.where(self.m[key][..., None] > 0.002, col, grad)
        alpha_all = np.clip(self.m['l0'] + self.m['l1'] + self.m['crest'], 0, 1)
        hgt = blur(alpha_all + self.m['blood'], 1.4)
        gy, gx = np.gradient(hgt)
        relief = np.clip(1.0 + 2.2 * (-gx * 0.7 - gy * 0.7), 0.55, 1.6)[..., None]
        lf = fx.leaf()[..., None]
        self.gold = np.clip(grad * relief * (1.0 + (lf - 1.0) * 0.8), 0, 1.4)
        self.blood_col = hexf('#7e1614') * relief
        # particles: targets sampled from the masks, arrival windows per element (left to right within a line)
        self.parts = []
        areas = {k: self.m[k].sum() for k in ('crest', 'l0', 'l1')}
        tot = sum(areas.values())
        tgt_all, ta_all = [], []
        for key in ('crest', 'l0', 'l1'):
            k_n = int(n * areas[key] / tot)
            prob = (self.m[key] > 0.5).ravel().astype(np.float64); prob /= prob.sum()
            idx = rng.choice(prob.size, size=k_n, replace=False, p=prob)
            ty, tx = np.divmod(idx, W)
            a0, a1 = WINDOWS[key]
            if key == 'crest':
                ang = np.arctan2(ty - CREST_C[1], tx - CREST_C[0])
                order = (np.sin(ang) * 0.5 + 0.5) * 0.35 + rng.random(k_n) * 0.65     # from below, roughly
            else:
                order = (tx - tx.min()) / max(1, tx.max() - tx.min()) * 0.7 + rng.random(k_n) * 0.3
            ta = a0 + (a1 - a0) * order
            tgt_all.append(np.stack([tx, ty], -1).astype(np.float32)); ta_all.append(ta.astype(np.float32))
        self.tgt = np.concatenate(tgt_all); self.ta = np.concatenate(ta_all)
        k = len(self.ta)
        dur = rng.uniform(0.75, 1.25, k).astype(np.float32)
        self.ts = np.maximum(0.12, self.ta - dur); self.dur = self.ta - self.ts
        self.S = np.stack([self.tgt[:, 0] + rng.normal(0, 200, k), rng.uniform(0.66 * H, 1.04 * H, k)], -1).astype(np.float32)
        self.C = np.stack([(self.S[:, 0] + self.tgt[:, 0]) / 2 + rng.normal(0, 160, k), self.tgt[:, 1] + rng.uniform(110, 330, k)], -1).astype(np.float32)
        self.tw, self.tp = rng.uniform(5, 13, k).astype(np.float32), rng.uniform(0, 6.3, k).astype(np.float32)
        self.sz = rng.uniform(0.6, 1.4, k).astype(np.float32)
        # the reveal: every pixel of the type appears when the nearest particle lands on it
        ys, xs = np.nonzero(alpha_all + self.m['blood'] > 0.004)
        _, nn = spatial.cKDTree(self.tgt).query(np.stack([xs, ys], -1), k=3, workers=-1)
        rt = np.full((H, W), 9.0, np.float32)
        rt[ys, xs] = self.ta[nn].mean(1)
        self.rt = rt
        self.alpha_all = alpha_all

    def frame(self, t, fade_out=(3.25, 4.0)):
        """t: seconds since the title began. Returns a float HxWx3 image (on black)."""
        img = np.zeros((H, W, 3), np.float32)
        img += hexf('#050303')
        rev = smoothstep(0.0, 0.2, t - self.rt)
        a_gold = self.alpha_all * rev
        a_blood = self.m['blood'] * rev
        # a light runs across the gold once it is all there
        pr = sstep(2.2, 3.15, t)
        gold = self.gold
        if 0.0 < pr < 1.0:
            p = -300 + (W + 900) * pr
            band = np.exp(-((self.diag - p) / 70.0) ** 2)
            gold = gold * (1.0 + 0.9 * band[..., None])
        img = img * (1 - a_gold[..., None]) + gold * a_gold[..., None]
        img = img * (1 - a_blood[..., None]) + self.blood_col * a_blood[..., None]
        img += blur(a_gold, 12.0)[..., None] * fx.GOLD_GLOW * 0.22
        # the dust in flight
        live = (t >= self.ts) & (t < self.ta + 0.18)
        if live.any():
            u = np.clip((t - self.ts[live]) / self.dur[live], 0, 1)
            ue = 1 - (1 - u) ** 3
            S, C, T = self.S[live], self.C[live], self.tgt[live]
            pos = ((1 - ue) ** 2)[:, None] * S + (2 * (1 - ue) * ue)[:, None] * C + (ue ** 2)[:, None] * T
            br = smoothstep(0.0, 0.25, u) * (0.55 + 0.45 * np.sin(self.tw[live] * t + self.tp[live]) ** 8)
            arrived = t >= self.ta[live]
            br = np.where(arrived, 1.6 * (1 - smoothstep(0.0, 0.18, t - self.ta[live])), br) * self.sz[live]
            lay = np.zeros((H, W), np.float32)
            x, y = pos[:, 0], pos[:, 1]
            x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
            fxp, fyp = x - x0, y - y0
            for dx, dy, wgt in ((0, 0, (1 - fxp) * (1 - fyp)), (1, 0, fxp * (1 - fyp)), (0, 1, (1 - fxp) * fyp), (1, 1, fxp * fyp)):
                xi, yi = x0 + dx, y0 + dy
                ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
                np.add.at(lay, (yi[ok], xi[ok]), (br * wgt)[ok])
            dust = blur(lay, 0.9) * 3.2 + blur(lay, 5.0) * 2.0
            img += dust[..., None] * hexf('#ffcf78')
        # a few motes rise off the finished title
        if t > 1.8:
            img += fx.motes(t, seed=41, n=90, amount=0.9 * sstep(1.8, 2.6, t), rise=26.0,
                            box=(W * 0.12, H * 0.33, W * 0.88, H * 0.6))[..., None] * hexf('#ffc868')
        k = 1.0 - fx.ease_in((t - fade_out[0]) / (fade_out[1] - fade_out[0])) if t > fade_out[0] else 1.0
        return np.clip(img * k, 0, 1.5)
