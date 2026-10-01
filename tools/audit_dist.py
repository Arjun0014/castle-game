"""Audit the production build folder (dist/) before a Wavedash upload (`npm run build:wavedash`).

python tools/audit_dist.py [dist]

Wavedash serves the folder named by wavedash.toml's upload_dir with index.html as the entrypoint, cross-origin
isolated (COEP require-corp: every cross-origin request must opt in — docs: Cross-origin isolation). Checks:
index.html at the root; every URL in index.html relative; nothing that must not ship (.env, keys, source packs,
.blend/.fbx, dev probes — the mock SDK above all —, source maps, tools); no ElevenLabs key material; the SDK's npm
package is NOT bundled (the game reads the host-injected window.Wavedash: types only); no absolute http(s) URL in the
code that the game would fetch from another origin (it would be blocked); the size and file count (the Developer
Portal takes up to 1 GB uncompressed; the CLI more). Exit 1 on a failure.
"""
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else 'dist'
fails, notes = [], []
files = []
for d, _, fs in os.walk(root):
    for f in fs:
        p = os.path.join(d, f)
        files.append((os.path.relpath(p, root).replace(os.sep, '/'), os.path.getsize(p)))
names = [n for n, _ in files]
if 'index.html' not in names:
    fails.append('index.html is not at the root of ' + root)

FORBID = re.compile(r'(^|/)(\.env[^/]*|\.git|node_modules|dev|tools|remotion-intro|extracted|_downloads|takes|clone_src)(/|$)'
                    r'|\.(blend1?|fbx|psd|map|py|mjs|ts|tsx|zip|mp3|wav)$|(^|/)(package(-lock)?\.json|tsconfig\.json|vite\.config\.\w+|wavedash\.toml)$', re.I)
bad = [n for n in names if FORBID.search(n)]
if bad:
    fails.append(f'files that must not ship: {bad[:12]}{" …" if len(bad) > 12 else ""}')

secret = re.compile(rb'sk_[0-9a-f]{40,}|ELEVENLABS_API_KEY\s*=|xi-api-key')
code = re.compile(r'\.(js|css|html)$')
ext_url = re.compile(rb'''["'`(](https?://[^"'`)\s]+)''')
# URLs that are data, never requests (XML namespaces, licences and credits, the docs' own links)
HARMLESS = re.compile(rb'^https?://(www\.w3\.org/|[^/]*(creativecommons|opengameart|kenney|polyhaven|ambientcg|mixamo|sketchfab|freesound|elevenlabs|github|threejs|wavedash)\.)', re.I)
external = set()
for n, _ in files:
    if not n.endswith(('.html', '.js', '.css', '.json', '.txt', '.md')):
        continue
    data = open(os.path.join(root, n), 'rb').read()
    if secret.search(data):
        fails.append(f'secret-like content in {n}')
    if code.search(n):
        for m in ext_url.finditer(data):
            u = m.group(1)
            if not HARMLESS.match(u):
                external.add(u.decode('utf-8', 'replace')[:120])
        if b'wavedashMock' in data or b'__wdmock' in data:
            fails.append(f'the dev mock SDK leaked into {n}')
        if b'Wavedash is not initialized' in data:
            fails.append(f'the @wvdsh/sdk-js runtime was bundled into {n} (it throws outside Wavedash — import types only)')
if external:
    notes.append(f'absolute URLs in the code (fine only if never fetched): {sorted(external)[:8]}')

html = open(os.path.join(root, 'index.html'), encoding='utf-8').read() if 'index.html' in names else ''
for m in re.finditer(r'(?:src|href)="([^"]+)"', html):
    u = m.group(1)
    if u.startswith('/') or u.startswith('//') or u.startswith('http://localhost'):
        fails.append(f'index.html references an absolute URL: {u}')

total = sum(s for _, s in files)
big = max(files, key=lambda x: x[1]) if files else ('', 0)
notes.append(f'{len(files)} files, {total / 1e6:.1f} MB; largest {big[0]} {big[1] / 1e6:.1f} MB')
if total > 1e9:
    fails.append(f'{total / 1e6:.0f} MB is over the Developer Portal upload limit (1 GB) — push with the CLI')

for n in notes:
    print('note:', n)
if fails:
    for f in fails:
        print('FAIL:', f)
    sys.exit(1)
print(f'dist OK for Wavedash: {root}/ ({len(files)} files, {total / 1e6:.1f} MB)')
