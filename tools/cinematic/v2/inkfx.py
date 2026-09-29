"""Graphic-novel finish for film v2 panels (numpy/scipy/PIL): turns a lit render into an inked, hatched, graded
illustration in the manner of a painted game-intro comic — ink contours from luminance edges, cross-hatching that
builds with the depth of shadow, a desaturated steel/sepia split grade that keeps fire and blood warm, paper tooth.

    python tools/cinematic/v2/inkfx.py <in.png> <out.png> [--grade steel|sepia|blood|gold] [--hatch 1.0] [--ink 1.0]

RGBA in -> RGBA out (alpha preserved), so lifted parallax layers stay separable.
"""
import argparse, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

GRADES = {
    # shadow tint, highlight tint, saturation kept, warm-accent keep (0..1)
    'steel': ((0.10, 0.13, 0.17), (0.86, 0.88, 0.90), 0.28, 0.85),
    'sepia': ((0.12, 0.08, 0.05), (0.93, 0.86, 0.72), 0.22, 0.6),
    'blood': ((0.14, 0.03, 0.03), (0.95, 0.70, 0.62), 0.55, 1.0),
    'gold':  ((0.10, 0.07, 0.04), (1.00, 0.86, 0.58), 0.45, 1.0),
    'night': ((0.05, 0.07, 0.11), (0.70, 0.80, 0.95), 0.30, 0.9),
}

def _lum(rgb): return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722

def _hatch_field(h, w, angle, period, rng, wobble=1.4):
    """A field of slightly wobbly parallel strokes, value in [0,1] (1 = on a stroke centre)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = np.deg2rad(angle)
    u = xx * np.cos(a) + yy * np.sin(a)
    v = -xx * np.sin(a) + yy * np.cos(a)
    # low-frequency wobble along the stroke so lines read hand-drawn; stroke breaks via a second noise
    n1 = ndi.gaussian_filter(rng.standard_normal((h // 16 + 2, w // 16 + 2)).astype(np.float32), 1.2)
    n1 = ndi.zoom(n1, (h / n1.shape[0], w / n1.shape[1]), order=1)[:h, :w]
    phase = (u + n1 * wobble * period * 0.35) / period
    d = np.abs(phase - np.round(phase))                # 0 at stroke centre .. 0.5 between
    stroke = np.clip(1.0 - d / 0.22, 0, 1) ** 1.6
    brk = ndi.gaussian_filter(rng.random((h // 6 + 2, w // 6 + 2)).astype(np.float32), 0.8)
    brk = ndi.zoom(brk, (h / brk.shape[0], w / brk.shape[1]), order=1)[:h, :w]
    return stroke * np.clip((brk - 0.18) * 3.0, 0, 1), v

def ink(img, grade='steel', hatch=1.0, inkw=1.0, seed=7, paper=True, exposure=1.0):
    rgba = np.asarray(img.convert('RGBA'), np.float32) / 255.0
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    if exposure != 1.0:                                   # lift a dark plate before inking (soft shoulder, no clipping)
        rgb = 1.0 - np.exp(-rgb * exposure * 1.6) * 1.0
        rgb = rgb / max(1e-6, 1.0 - np.exp(-exposure * 1.6))
    h, w = alpha.shape
    s = w / 1440.0                                        # stroke scale relative to a 1440-wide panel
    rng = np.random.default_rng(seed)
    L = _lum(rgb)
    # --- tone: gentle posterisation of the value (illustration planes) + contrast
    Ls = ndi.gaussian_filter(L, 0.8 * s)
    tone = np.clip((Ls - 0.015) / 0.8, 0, 1) ** 0.75
    tone = tone * tone * (3 - 2 * tone)                   # S-curve: ink-black shadows, crisp lights
    tone = np.clip((tone - 0.06) / 0.94, 0, 1)
    bands = np.round(tone * 5) / 5
    tone = tone * 0.55 + bands * 0.45
    # --- colour grade: desaturate, split-tone, keep warm accents (fire, blood, gold)
    sh, hi, keep_sat, warm_keep = GRADES[grade]
    gray = L[..., None]
    sat = rgb - gray
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    warm = np.clip((r - np.maximum(g, b)) * 3.0, 0, 1) * np.clip(L * 4, 0, 1)
    k = keep_sat + (1 - keep_sat) * warm * warm_keep
    base = np.array(sh)[None, None, :] * (1 - tone[..., None]) + np.array(hi)[None, None, :] * tone[..., None]
    col = base + sat * k[..., None] * 1.15
    # --- hatching: three directions, each switched on below a darker threshold
    period = max(3.0, 7.0 * s)
    dark = 1.0 - tone
    shade = np.zeros_like(L)
    for i, (ang, t0) in enumerate(((58, 0.30), (-32, 0.52), (12, 0.72))):
        f, _ = _hatch_field(h, w, ang, period * (1.0 + 0.15 * i), rng)
        m = np.clip((dark - t0) / 0.18, 0, 1)
        shade = np.maximum(shade, f * m)
    col = col * (1 - 0.72 * hatch * shade[..., None])
    # --- ink contours: luminance edges (fine) + alpha edges (silhouettes), thickened, with pressure noise
    gx = ndi.sobel(Ls, 1); gy = ndi.sobel(Ls, 0)
    e = np.hypot(gx, gy)
    e = np.clip((e - 0.10) / 0.35, 0, 1)
    ae = np.hypot(ndi.sobel(alpha, 1), ndi.sobel(alpha, 0))
    edges = np.maximum(e, np.clip(ae * 1.5, 0, 1))
    edges = ndi.grey_dilation(edges, size=(max(1, int(round(1.6 * s * inkw))),) * 2)
    edges = ndi.gaussian_filter(edges, 0.6 * s)
    pressure = ndi.zoom(ndi.gaussian_filter(rng.random((h // 24 + 2, w // 24 + 2)).astype(np.float32), 1.0), (h / (h // 24 + 2), w / (w // 24 + 2)), order=1)[:h, :w]
    edges = edges * np.clip(0.55 + pressure, 0, 1)
    inkc = np.array((0.035, 0.03, 0.035))
    col = col * (1 - np.clip(edges * 0.9 * inkw, 0, 0.95)[..., None]) + inkc * np.clip(edges * 0.9 * inkw, 0, 0.95)[..., None]
    # --- keep true emissive fire bright (it reads as painted light over the ink)
    glow = np.clip((L - 0.82) / 0.18, 0, 1)[..., None]
    col = col * (1 - glow) + rgb * glow
    # --- paper tooth + grain
    if paper:
        tooth = ndi.gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), 1.1 * s)
        col = col * (1 + 0.05 * tooth[..., None]) + 0.012 * rng.standard_normal((h, w, 1)).astype(np.float32)
    out = np.dstack([np.clip(col, 0, 1), alpha])
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--grade', default='steel'); ap.add_argument('--hatch', type=float, default=1.0)
    ap.add_argument('--ink', type=float, default=1.0); ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--exposure', type=float, default=1.0)
    a = ap.parse_args()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    ink(Image.open(a.inp), a.grade, a.hatch, a.ink, a.seed, exposure=a.exposure).save(a.out)

if __name__ == '__main__':
    main()
