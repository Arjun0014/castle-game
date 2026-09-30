"""Zip dist/ for itch.io: build/caer-veyr-itch.zip with index.html at the root and FORWARD-SLASH entry names.

python tools/zip_itch.py            (npm run package:itch = build → this → tools/audit_itch.py)

Why not PowerShell: Windows PowerShell 5.1's Compress-Archive (Microsoft.PowerShell.Archive 1.0.1.0) stores entries as
`app\\index.js`. itch.io unpacks on Linux, where a backslash is an ordinary character, so every file lands in the root
under a name like "app\\index.js", ./app/... and ./assets/... 404, and the page shows only its bare HTML (session 15).
Already-compressed media are stored, everything else deflated; entries sorted; no directory entries.
"""
import os
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(ROOT, 'build', 'caer-veyr-itch.zip')
STORE = ('.ogg', '.mp4', '.webp', '.jpg', '.jpeg', '.png', '.woff2', '.ktx2')

if not os.path.exists(os.path.join(DIST, 'index.html')):
    sys.exit('dist/index.html missing: run npm run build first')
files = []
for d, _, names in os.walk(DIST):
    for n in names:
        p = os.path.join(d, n)
        files.append((os.path.relpath(p, DIST).replace(os.sep, '/'), p))
files.sort()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
tmp = OUT + '.tmp'
with zipfile.ZipFile(tmp, 'w') as z:
    for arc, p in files:
        assert '\\' not in arc and not arc.startswith('/')
        info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o644 << 16
        info.compress_type = zipfile.ZIP_STORED if arc.lower().endswith(STORE) else zipfile.ZIP_DEFLATED
        with open(p, 'rb') as f:
            z.writestr(info, f.read(), compresslevel=9 if info.compress_type == zipfile.ZIP_DEFLATED else None)
os.replace(tmp, OUT)
print(f'{OUT}: {len(files)} files, {os.path.getsize(OUT) / 1e6:.1f} MB')
