"""Audit the itch.io HTML5 ZIP (build/caer-veyr-itch.zip) before upload.

python tools/audit_itch.py [zip]

Checks: index.html at the ZIP root; forward-slash entry names (a backslash name unpacks as one odd file on itch's
Linux servers); every URL in index.html and the built CSS/JS relative (no leading "/", no localhost); nothing that must
not ship (.env, keys, source packs, .blend/.fbx, dev probes, source maps, Python/Node tools); no ElevenLabs key
material in any text file; the itch limits (≤ 1,000 files, ≤ 1 GB unpacked, ≤ 200 MB per file). Exit 1 on a failure.
"""
import re
import sys
import zipfile

path = sys.argv[1] if len(sys.argv) > 1 else 'build/caer-veyr-itch.zip'
z = zipfile.ZipFile(path)
infos = z.infolist()
names = [i.filename for i in infos]
fails, notes = [], []
BS = chr(92)

if 'index.html' not in names:
    fails.append('index.html is not at the ZIP root')
if any(BS in n for n in names):
    fails.append(f'{sum(BS in n for n in names)} entries use backslashes')
roots = sorted({n.split('/')[0] for n in names})
notes.append(f'root entries: {roots}')

# (the ZIP's assets/ is public/assets — the runtime files; the repository's source assets/ never reaches dist/)
FORBID = re.compile(r'(^|/)(\.env[^/]*|\.git|node_modules|dev|tools|remotion-intro|extracted|_downloads|takes|clone_src)(/|$)'
                    r'|\.(blend1?|fbx|psd|map|py|mjs|ts|tsx|zip|mp3|wav)$|(^|/)(package(-lock)?\.json|tsconfig\.json|vite\.config\.\w+)$', re.I)
bad = [n for n in names if FORBID.search(n)]
if bad:
    fails.append(f'files that must not ship: {bad[:12]}{" …" if len(bad) > 12 else ""}')

# secrets: ElevenLabs keys look like sk_ + 48 hex; also any literal env names with a value
secret = re.compile(rb'sk_[0-9a-f]{40,}|ELEVENLABS_API_KEY\s*=|xi-api-key')
for i in infos:
    if i.filename.endswith(('.html', '.js', '.css', '.json', '.txt', '.md')):
        if secret.search(z.read(i)):
            fails.append(f'secret-like content in {i.filename}')

# relative URLs in the page and the built code
html = z.read('index.html').decode('utf-8', 'replace') if 'index.html' in names else ''
for m in re.finditer(r'(?:src|href)="([^"]+)"', html):
    u = m.group(1)
    if u.startswith('/') or u.startswith('http://localhost') or u.startswith('//'):
        fails.append(f'index.html: absolute URL {u}')
for i in infos:
    if i.filename.startswith('app/') and i.filename.endswith(('.js', '.css')):
        t = z.read(i).decode('utf-8', 'replace')
        if 'localhost:5173' in t or 'localhost:4173' in t:
            fails.append(f'{i.filename}: a localhost URL')
        for m in re.finditer(r'''["'(](/assets/[^"')]+)''', t):
            fails.append(f'{i.filename}: root-absolute asset URL {m.group(1)}')
            break

size = sum(i.file_size for i in infos)
big = [(i.filename, i.file_size) for i in infos if i.file_size > 200e6]
if len(infos) > 1000:
    fails.append(f'{len(infos)} files (itch limit 1,000)')
if size > 1e9:
    fails.append(f'{size / 1e6:.0f} MB unpacked (itch limit 1 GB)')
if big:
    fails.append(f'files over 200 MB: {big}')
notes.append(f'{len(infos)} files, {size / 1e6:.1f} MB unpacked, zip {sum(i.compress_size for i in infos) / 1e6:.1f} MB')
notes.append(f'viewport meta: {re.search(r"<meta name=.viewport.[^>]*>", html).group(0) if re.search(r"<meta name=.viewport.[^>]*>", html) else "MISSING"}')

for n in notes:
    print('  ', n)
for f in fails:
    print('FAIL', f)
print('ITCH ZIP OK' if not fails else f'{len(fails)} problem(s)')
sys.exit(1 if fails else 0)
