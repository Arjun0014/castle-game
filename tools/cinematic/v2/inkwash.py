"""Ink-wash silhouettes and parchment for the legend passages of film v2 (after the manner of an ink-on-parchment
flashback): a lit figure render on black becomes sepia-black ink with wet edges, pooling and a few spatters, on a
transparent ground (the edit multiplies it onto parchment). Also builds the parchment itself.

    python tools/cinematic/v2/inkwash.py figure <in.png> <out.png> [--seed 3]
    python tools/cinematic/v2/inkwash.py parchment <out.png> [--w 1080 --h 1920]
"""
import argparse, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def _noise(h, w, scale, rng, octaves=4):
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        sh, sw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
        n = rng.standard_normal((sh, sw)).astype(np.float32)
        n = ndi.zoom(n, (h / sh, w / sw), order=3)[:h, :w]
        out += amp * n; tot += amp; amp *= 0.5; scale /= 2.0
    return out / tot

def figure(inp, out, seed=3):
    rng = np.random.default_rng(seed)
    im = Image.open(inp).convert('RGBA')
    a = np.asarray(im, np.float32) / 255.0
    lum = a[..., :3].max(axis=2)
    m = a[..., 3]                                               # the figure's own coverage (transparent render)
    m = ndi.binary_opening(m > 0.5, iterations=1).astype(np.float32)
    h, w = m.shape
    # wet edge: the ink bleeds a little outward with a ragged, fibrous border
    n = _noise(h, w, 28, rng)
    soft = ndi.gaussian_filter(m, 3.0)
    ragged = np.clip((soft + 0.18 * n - 0.42) / 0.12, 0, 1)
    edge = np.clip(ragged - ndi.gaussian_filter(ragged, 5.0), 0, 1) * 1.8   # darker rim where ink pools
    # interior value: keep a little of the figure's own light as thinner ink (form reads through the wash)
    inner = 1.0 - np.clip(lum * 3.0, 0, 0.55)
    dens = np.clip(ragged * (0.72 + 0.28 * inner) + edge * 0.35 + 0.08 * _noise(h, w, 6, rng), 0, 1)
    # spatters around the figure
    sp = np.zeros_like(m)
    ys, xs = np.nonzero(m[::8, ::8])
    for _ in range(int(min(260, len(ys) * 0.02) + 40)):
        k = rng.integers(len(ys)); cy, cx = ys[k] * 8, xs[k] * 8
        ang = rng.uniform(0, 2 * np.pi); dist = rng.gamma(2.0, 60.0)
        y, x = int(cy + np.sin(ang) * dist), int(cx + np.cos(ang) * dist)
        r = max(1, int(rng.gamma(1.4, 3.0)))
        if r <= y < h - r and r <= x < w - r:                    # round drops, not squares
            yy, xx = np.ogrid[-r:r + 1, -r:r + 1]
            sp[y - r:y + r + 1, x - r:x + r + 1] = np.maximum(sp[y - r:y + r + 1, x - r:x + r + 1], (xx * xx + yy * yy <= r * r).astype(np.float32))
    sp = np.clip(ndi.gaussian_filter(sp, 1.4) * 1.6, 0, 1)
    dens = np.maximum(dens, sp * 0.85)
    ink = np.array((0.10, 0.06, 0.035), np.float32)
    rgba = np.dstack([np.broadcast_to(ink, (h, w, 3)), dens])
    Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(out)

def parchment(out, w=1080, h=1920, seed=11):
    rng = np.random.default_rng(seed)
    base = np.array((0.925, 0.885, 0.80), np.float32)
    n1 = _noise(h, w, 420, rng); n2 = _noise(h, w, 60, rng); n3 = _noise(h, w, 4, rng, 2)
    stain = np.clip(_noise(h, w, 300, rng) * 1.4 - 0.2, 0, 1)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    vig = np.clip((d - 0.55) / 0.7, 0, 1) ** 1.6
    v = 1.0 - 0.05 * n1 - 0.025 * n2 - 0.02 * n3 - 0.10 * stain - 0.28 * vig
    col = base[None, None, :] * v[..., None]
    col[..., 2] -= 0.05 * stain + 0.06 * vig                      # warmer where it has aged
    # a few long hairline cracks (old, folded vellum)
    crack = np.zeros((h, w), np.float32)
    for _ in range(5):
        y, x = rng.uniform(0, h), rng.uniform(0, w); ang = rng.uniform(0, 2 * np.pi)
        for step in range(int(rng.uniform(300, 900))):
            ang += rng.normal(0, 0.12); y += np.sin(ang) * 2; x += np.cos(ang) * 2
            if 0 <= int(y) < h and 0 <= int(x) < w: crack[int(y), int(x)] = 1.0
    crack = ndi.gaussian_filter(crack, 0.9)
    col *= (1 - 0.35 * np.clip(crack * 3, 0, 1))[..., None]
    Image.fromarray((np.clip(col, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(out)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd'); ap.add_argument('a'); ap.add_argument('b', nargs='?')
    ap.add_argument('--seed', type=int, default=3); ap.add_argument('--w', type=int, default=1080); ap.add_argument('--h', type=int, default=1920)
    x = ap.parse_args()
    if x.cmd == 'figure': figure(x.a, x.b, x.seed)
    else: parchment(x.a, x.w, x.h)
