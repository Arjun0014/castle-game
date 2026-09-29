"""Compose labelled contact sheets from tools/blender/inspect_pack.py frames.

Run: python tools/contact_sheet.py <frames_dir> <inspect.json> <out_prefix> [rows_per_sheet]
Each row = one clip (8 frames left→right over its duration) labelled with name, duration, root travel,
yaw change, blade/hand peak times and the two-handed grip fraction.
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

frames_dir, report_path, out_prefix = sys.argv[1], sys.argv[2], sys.argv[3]
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 9
rep = json.load(open(report_path))
clips = list(rep["clips"].items())
W, H, N, LABEL = 200, 250, 8, 20
try:
    font = ImageFont.truetype("arial.ttf", 14)
except OSError:
    font = ImageFont.load_default()
for s in range(0, len(clips), rows):
    chunk = clips[s:s + rows]
    sheet = Image.new("RGB", (W * N, (H + LABEL) * len(chunk)), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for r, (name, c) in enumerate(chunk):
        y = r * (H + LABEL)
        pk = c.get("tipPeaks") or []
        hp = c.get("rightHandPeaks") or []
        lab = (f"{name}  {c['duration']}s  root {c['rootTravel'][0]:+.2f}f {c['rootTravel'][1]:+.2f}r  yaw {c['yawChangeDeg']:+.0f}  "
               f"loop {c['loopClosureDeg']:.0f}deg  2H {c['twoHandedFrac']:.2f}  tip {[p['t'] for p in pk]}  rh {[p['t'] for p in hp][:4]}")
        d.text((4, y + 2), lab, fill=(255, 230, 160), font=font)
        for k in range(N):
            p = os.path.join(frames_dir, f"{name.replace(' ', '_')}__{k}.png")
            if os.path.exists(p):
                sheet.paste(Image.open(p).convert("RGB"), (k * W, y + LABEL))
    out = f"{out_prefix}_{s // rows}.png"
    sheet.save(out)
    print("sheet", out, len(chunk))
