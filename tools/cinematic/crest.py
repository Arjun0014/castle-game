"""House Vaelor crest — canonical vector definition (the game had no crest before the opening cinematic).

Blazon (for the record): a crown of five points upon an annulet, within the annulet a goutte de sang, the
whole within a beaded seal rim. Crown = the dynasty, annulet = the Crownheart (the binding), goutte = the
royal blood that bound them. Used by the cinematic (gate boss, banners, seals, title) and exportable to SVG.

    python tools/cinematic/crest.py [out_dir]     -> crest.json, crest.svg, crest_preview.png

Coordinates: unit space, origin at the seal centre, +y up, seal outer radius 1.0.
"""
import json, math, os, sys

def circle(cx, cy, r, n=96):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]

def teardrop(cx, tip_y, bottom_y, width, n=120):
    # x = sin t * sin(t/2)^m, y = cos t   (point at the top, round belly at the bottom)
    h = (tip_y - bottom_y) / 2.0
    cy = bottom_y + h
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = math.sin(t) * (math.sin(t / 2) ** 1.25)
        y = math.cos(t)
        pts.append((cx + x * width / 2 / 0.77, cy + y * h))
    return pts

def crown(cx, base_y, w, h):
    """Open crown: a slightly arched band and five points (tall centre, pearls on every tip)."""
    band_h = h * 0.30
    polys = []
    band = []
    for i in range(33):
        t = i / 32
        band.append((cx - w / 2 + w * t, base_y - 0.012 * math.sin(math.pi * t)))
    top = [(x, y + band_h) for (x, y) in reversed(band)]
    polys.append(band + top)
    pearls = []
    xs = [-0.44, -0.22, 0.0, 0.22, 0.44]
    hs = [0.66, 0.80, 1.0, 0.80, 0.66]
    for i, (fx, fh) in enumerate(zip(xs, hs)):
        x = cx + fx * w
        by = base_y + band_h - 0.004
        tip = base_y + band_h + (h - band_h) * fh
        pw = w * (0.075 if i % 2 == 0 else 0.05)
        polys.append([(x - pw, by), (x + pw, by), (x + pw * 0.22, tip - pw * 0.9), (x - pw * 0.22, tip - pw * 0.9)])
        pearls.append((x, tip - pw * 0.25, pw * (0.62 if i % 2 == 0 else 0.7)))
    # jewels set into the band (holes)
    jewels = [(cx + fx * w, base_y + band_h * 0.48, band_h * 0.2) for fx in (-0.3, 0.0, 0.3)]
    return polys, pearls, jewels

def build():
    R = 1.0
    d = {
        'rim_outer': circle(0, 0, R),
        'rim_inner': circle(0, 0, R * 0.90),
        'beads': [(0.87 * math.cos(2 * math.pi * i / 48), 0.87 * math.sin(2 * math.pi * i / 48), 0.022) for i in range(48)],
        'annulet_outer': circle(0, -0.18, 0.42),
        'annulet_inner': circle(0, -0.18, 0.325),
        'goutte': teardrop(0, 0.08, -0.43, 0.30),
    }
    cpolys, pearls, jewels = crown(0, 0.215, 0.80, 0.50)
    d['crown'] = cpolys
    d['pearls'] = pearls
    d['jewels'] = jewels
    return d

def to_svg(d, size=512, gold='#d6b060', blood='#96201e', ink='#120e0c', background=True):
    s = size / 2.2
    def P(p): return f'{size / 2 + p[0] * s:.2f},{size / 2 - p[1] * s:.2f}'
    def poly(pts, fill): return f'<polygon points="{" ".join(P(p) for p in pts)}" fill="{fill}"/>'
    def circ(x, y, r, fill): return f'<circle cx="{size / 2 + x * s:.2f}" cy="{size / 2 - y * s:.2f}" r="{r * s:.2f}" fill="{fill}"/>'
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">']
    if background: out.append(f'<rect width="{size}" height="{size}" fill="{ink}"/>')
    out.append(poly(d['rim_outer'], gold)); out.append(poly(d['rim_inner'], ink))
    for x, y, r in d['beads']: out.append(circ(x, y, r, gold))
    out.append(poly(d['annulet_outer'], gold)); out.append(poly(d['annulet_inner'], ink))
    out.append(poly(d['goutte'], blood))
    for p in d['crown']: out.append(poly(p, gold))
    for x, y, r in d['pearls']: out.append(circ(x, y, r, gold))
    for x, y, r in d['jewels']: out.append(circ(x, y, r, ink))
    out.append('</svg>')
    return '\n'.join(out)

if __name__ == '__main__':
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'out')
    os.makedirs(out_dir, exist_ok=True)
    d = build()
    with open(os.path.join(out_dir, 'crest.json'), 'w') as f: json.dump(d, f)
    with open(os.path.join(out_dir, 'crest.svg'), 'w') as f: f.write(to_svg(d))
    try:
        from PIL import Image, ImageDraw
        S, size = 4, 512
        W = size * S; img = Image.new('RGB', (W, W), (18, 14, 12)); dr = ImageDraw.Draw(img)
        sc = W / 2.2
        P = lambda p: (W / 2 + p[0] * sc, W / 2 - p[1] * sc)
        G, B, K = (214, 176, 96), (150, 32, 30), (18, 14, 12)
        dr.polygon([P(p) for p in d['rim_outer']], fill=G); dr.polygon([P(p) for p in d['rim_inner']], fill=K)
        for x, y, r in d['beads']:
            X, Y = P((x, y)); dr.ellipse([X - r * sc, Y - r * sc, X + r * sc, Y + r * sc], fill=G)
        dr.polygon([P(p) for p in d['annulet_outer']], fill=G); dr.polygon([P(p) for p in d['annulet_inner']], fill=K)
        dr.polygon([P(p) for p in d['goutte']], fill=B)
        for p in d['crown']: dr.polygon([P(q) for q in p], fill=G)
        for x, y, r in d['pearls']:
            X, Y = P((x, y)); dr.ellipse([X - r * sc, Y - r * sc, X + r * sc, Y + r * sc], fill=G)
        for x, y, r in d['jewels']:
            X, Y = P((x, y)); dr.ellipse([X - r * sc, Y - r * sc, X + r * sc, Y + r * sc], fill=K)
        img.resize((size, size), Image.LANCZOS).save(os.path.join(out_dir, 'crest_preview.png'))
    except ImportError:
        pass
    print('crest ->', out_dir)
