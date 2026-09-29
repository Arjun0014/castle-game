"""Cut, clean and encode the heroine's lines for runtime (see docs/DIALOGUE.md).

python tools/voice/build_voice.py

Input : assets/audio/voice/batches/*.mp3 + .json (tools/voice/gen_voice.mjs; a later redo_<id>_<n> wins)
Output: public/assets/voice/<id>.ogg   mono Vorbis at 22.05 kHz (the voice band needs no more)
        build/voice/<id>.wav            the same cut at 44.1 kHz (QA / listening)
        src/data/voiceManifest.json     id -> url, bytes, duration (runtime asset keys vo:<id>)

Cutting: each request's character timestamps give the spoken span of every line; boundaries sit in the pauses
between lines (a line that opens with a breath/sigh tag keeps the sound before its first word). Then silence is
trimmed (-48 dBFS, 60 ms pre-roll, 140 ms tail), 12 ms fades, and a static gain sets the speech level to
-19 dBFS RMS with peaks below -1.5 dBFS (every line sits at the same loudness in the mix).
"""
import json, os, re, subprocess
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BATCH = os.path.join(ROOT, 'assets', 'audio', 'voice', 'batches')
OUT = os.path.join(ROOT, 'public', 'assets', 'voice')
QA = os.path.join(ROOT, 'build', 'voice')
MANIFEST = os.path.join(ROOT, 'src', 'data', 'voiceManifest.json')
SR = 44100
os.makedirs(OUT, exist_ok=True)
os.makedirs(QA, exist_ok=True)

data = json.load(open(os.path.join(ROOT, 'src', 'data', 'dialogue.json'), encoding='utf8'))
wanted = {l['id'] for l in data['lines']}


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def letters_map(text, chars):
    """request offset -> alignment index (the alignment may drop/normalise characters)"""
    m = [-1] * len(text)
    j = 0
    for i, ch in enumerate(text):
        if j < len(chars) and ch == chars[j]:
            m[i] = j
            j += 1
    return m


def in_tag(text):
    t = [False] * len(text)
    depth = 0
    for i, ch in enumerate(text):
        if ch == '[':
            depth += 1
        t[i] = depth > 0
        if ch == ']':
            depth = max(0, depth - 1)
    return t


# source for each line: the latest redo, else the batch that contains it
sources = {}
files = sorted(f for f in os.listdir(BATCH) if f.endswith('.json'))
for f in sorted(files, key=lambda f: (f.startswith('redo_'), f)):
    j = json.load(open(os.path.join(BATCH, f), encoding='utf8'))
    for r in j['ranges']:
        sources[r['id']] = (f, j)

manifest = {'voice': None, 'lines': {}}
cache = {}
for lid in sorted(wanted):
    if lid not in sources:
        print('MISSING', lid)
        continue
    f, j = sources[lid]
    manifest['voice'] = j['voice']
    if f not in cache:
        cache[f] = decode(os.path.join(BATCH, f[:-5] + '.mp3'))
    x = cache[f]
    text, al = j['text'], j['alignment']
    chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    m, tag = letters_map(text, chars), in_tag(text)

    def spoken(r):
        idx = [m[i] for i in range(r['from'], r['to']) if not tag[i] and text[i].isalpha() and m[i] >= 0]
        return (st[idx[0]], en[idx[-1]]) if idx else (None, None)

    ranges = j['ranges']
    k = next(i for i, r in enumerate(ranges) if r['id'] == lid)
    a, b = spoken(ranges[k])
    prev_end = spoken(ranges[k - 1])[1] if k > 0 else 0.0
    next_start = spoken(ranges[k + 1])[0] if k + 1 < len(ranges) else len(x) / SR
    opens_with_tag = ranges[k]['tts'].lstrip().startswith('[') and re.match(r'\[(sighs|exhales|gasps|breathless|laughs)', ranges[k]['tts'].lstrip()) is not None
    t0 = prev_end + 0.08 if opens_with_tag else max(prev_end + 0.05, (prev_end + a) / 2, a - 0.35)
    t1 = min(next_start - 0.05, b + 0.6) if k + 1 < len(ranges) else len(x) / SR
    seg = x[int(t0 * SR):int(t1 * SR)].copy()
    # trim silence at the ends
    win = int(0.02 * SR)
    frames = np.array([np.sqrt(np.mean(seg[i:i + win] ** 2) + 1e-12) for i in range(0, max(1, len(seg) - win), win)])
    loud = np.where(20 * np.log10(frames) > -48)[0]
    if len(loud):
        s0 = max(0, loud[0] * win - int(0.06 * SR))
        s1 = min(len(seg), (loud[-1] + 1) * win + int(0.14 * SR))
        seg = seg[s0:s1]
    # level: speech RMS (frames above -40 dBFS) to -19 dBFS, peaks below -1.5 dBFS
    fr = np.array([np.sqrt(np.mean(seg[i:i + win] ** 2) + 1e-12) for i in range(0, max(1, len(seg) - win), win)])
    sp = fr[20 * np.log10(fr) > -40]
    rms = float(np.sqrt(np.mean(sp ** 2))) if len(sp) else float(np.sqrt(np.mean(seg ** 2)))
    gain = 10 ** (-19 / 20) / max(rms, 1e-6)
    peak = float(np.max(np.abs(seg))) * gain
    if peak > 10 ** (-1.5 / 20):
        gain *= 10 ** (-1.5 / 20) / peak
    seg *= gain
    fade = int(0.012 * SR)
    if len(seg) > 2 * fade:
        seg[:fade] *= np.linspace(0, 1, fade)
        seg[-fade:] *= np.linspace(1, 0, fade)
    wav = os.path.join(QA, lid + '.wav')
    pcm16 = (np.clip(seg, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', wav], input=pcm16, check=True)
    ogg = os.path.join(OUT, lid + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ar', '22050', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '3', ogg], check=True)
    manifest['lines'][lid] = {'url': 'assets/voice/' + lid + '.ogg', 'bytes': os.path.getsize(ogg), 'dur': round(len(seg) / SR, 3), 'source': f[:-5]}

for f in os.listdir(OUT):
    if f.endswith('.ogg') and f[:-4] not in wanted:
        os.remove(os.path.join(OUT, f))
json.dump(manifest, open(MANIFEST, 'w', encoding='utf8', newline='\n'), indent=1)
tot = sum(v['bytes'] for v in manifest['lines'].values())
dur = sum(v['dur'] for v in manifest['lines'].values())
print(f"{len(manifest['lines'])} lines, {tot / 1024:.0f} KB, {dur:.1f} s of speech -> {MANIFEST}")
