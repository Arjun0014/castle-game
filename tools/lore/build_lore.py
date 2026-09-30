"""Build the lore book's runtime assets (session 15).

python tools/lore/build_lore.py [take]        (default take: tools/lore/selection.json "take")

Inputs
  assets/Echoes_of_Caer_Veyr_All_12_Pages/Page_01..12.webp   the illustrated pages (the user's; never modified)
  assets/audio/lore/takes/<take>/book.mp3 + book.json         the narration take (tools/lore/gen_lore.mjs book)
  tools/lore/narration.json                                   titles + subtitle lines
Outputs
  public/assets/lore/page_NN.webp        byte copies of the pages (1024x1536, ~0.4 MB; no resize needed: decoded 6.3 MB each)
  public/assets/lore/narration_NN.ogg    each page's narration, Opus mono 64 kbps / 48 kHz, -18 LUFS
  src/data/loreManifest.json             per page: title, image, a tiny blurred placeholder, audio, duration, cues

The take is ONE request for all twelve pages (one performance arc). Each page is cut from it at the silence between
pages; inside a page every subtitle line is cut at the silence after it and the pause after each line is opened to a
recited cadence (LINE_PAUSE) — the voice itself is never time-stretched. Cue times come from the ElevenLabs character
alignment, refined against the audio envelope (alignment starts can come early after a pause).
"""
import base64
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_PAGES = os.path.join(ROOT, 'assets', 'Echoes_of_Caer_Veyr_All_12_Pages')
OUT = os.path.join(ROOT, 'public', 'assets', 'lore')
MANIFEST = os.path.join(ROOT, 'src', 'data', 'loreManifest.json')
SR = 48000
LEAD_IN = 0.2      # s of silence before the first word
LINE_PAUSE = 0.75  # s: the pause after each line is at least this long (the take's own gaps are ~0.05-0.5 s)
LAST_PAUSE = 1.1   # s before a page's closing line (the page's last beat lands alone)
TAIL = 0.6         # s after the last word


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


ALIAS = {'vair': 'veyr', 'verre': 'veyr', 'verr': 'veyr', 'vere': 'veyr', 'ver': 'veyr', 'vera': 'veyr', 'vaer': 'veyr', 'vier': 'veyr',
         'vare': 'veyr', 'kair': 'caer', 'care': 'caer', 'vaylor': 'vaelor', 'valor': 'vaelor', 'valar': 'vaelor', 'aldrin': 'aldren',
         'aldrins': 'aldrens'}


def norm(s):
    s = s.lower().replace('’', '').replace("'", '')
    return [t for t in ''.join(c if c.isalnum() else ' ' for c in s).split() if t]


def canon(t):
    return ALIAS.get(t, t)


def align_tokens(ref, hyp):
    """edit-distance alignment; returns for each ref token the index of the hyp token it matched (or None)"""
    n, m = len(ref), len(hyp)
    d = np.zeros((n + 1, m + 1), np.int32)
    d[:, 0] = np.arange(n + 1)
    d[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1))
    out = [None] * n
    i, j = n, m
    while i > 0 and j > 0:
        if d[i, j] == d[i - 1, j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            out[i - 1] = j - 1  # a match or a substitution (a misheard name still marks the word's time)
            i, j = i - 1, j - 1
        elif d[i, j] == d[i - 1, j] + 1:
            i -= 1
        else:
            j -= 1
    return out


def envelope(x, hop=0.01):
    h = int(SR * hop)
    n = len(x) // h
    e = np.sqrt(np.mean(x[:n * h].reshape(n, h) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(e), hop


def main():
    sel_path = os.path.join(ROOT, 'tools', 'lore', 'selection.json')
    sel = json.load(open(sel_path)) if os.path.exists(sel_path) else {}
    take = sys.argv[1] if len(sys.argv) > 1 else sel.get('take', 'b1')
    tdir = os.path.join(ROOT, 'assets', 'audio', 'lore', 'takes', take)
    meta = json.load(open(os.path.join(tdir, 'book.json'), encoding='utf-8'))
    script = json.load(open(os.path.join(ROOT, 'tools', 'lore', 'narration.json'), encoding='utf-8'))
    x = pcm(os.path.join(tdir, 'book.mp3'))
    env, hop = envelope(x)
    thr = np.percentile(env, 99) - 45  # whispers sit ~14 dB under the voice; the take's silence ~-70 dB
    loud = env > thr
    st = meta['alignment']['character_start_times_seconds']
    en = meta['alignment']['character_end_times_seconds']
    total = len(x) / SR

    def speech_end(t):
        """first >= 80 ms silence starting after t - 0.15 s -> its start"""
        i = max(0, int((t - 0.15) / hop))
        run = 0
        while i < len(loud):
            run = run + 1 if not loud[i] else 0
            if run >= 8:
                return (i - run + 1) * hop
            i += 1
        return total

    def onset(t):
        i = max(0, int(t / hop))
        while i < len(loud) and not loud[i]:
            i += 1
        return i * hop

    # every line in book order. Its speech span comes from what was actually heard: Scribe's word timings of the whole
    # take (book.scribe.json, written by tools/lore/qa_lore.mjs) aligned word by word to the script. The TTS character
    # alignment drifted by 2-3 s in places (page 6's first sentence would have ended page 5), so it is only the fallback.
    lines = []
    for p in meta['pages']:
        for l in p['lines']:
            lines.append({'page': p['page'], 'line': l['line'], 'text': l['display'], 'a0': st[l['start']], 'a1': en[l['end'] - 1]})
    scribe_path = os.path.join(tdir, 'book.scribe.json')
    if not os.path.exists(scribe_path):
        raise SystemExit(f'run node tools/lore/qa_lore.mjs {take} book first (Scribe timings of the take)')
    heard = [w for w in json.load(open(scribe_path, encoding='utf-8'))['words'] if w['type'] == 'word']
    hyp = []  # (token, start, end)
    for w in heard:
        for tok in norm(w['text']):
            hyp.append((canon(tok), w['start'], w['end']))
    ref = []  # (token, line index)
    for li, l in enumerate(lines):
        for tok in norm(l['text']):
            ref.append((canon(tok), li))
    match = align_tokens([r[0] for r in ref], [h[0] for h in hyp])
    for li, l in enumerate(lines):
        got = [hyp[match[k]] for k, r in enumerate(ref) if r[1] == li and match[k] is not None]
        if len(got) < max(1, len([r for r in ref if r[1] == li]) // 2):
            raise SystemExit(f'line not found in the take: page {l["page"]} line {l["line"]}: {l["text"]}')
        l['a0'], l['a1'] = got[0][1], got[-1][2]
    for i, l in enumerate(lines):
        l['end'] = speech_end(l['a1'])
    for i, l in enumerate(lines):
        prev_end = lines[i - 1]['end'] if i else 0.0
        l['on'] = onset(max(prev_end + 0.06, l['a0'] - 0.3)) if i else onset(0)
    # cut points: the middle of the silence between consecutive lines
    for i, l in enumerate(lines):
        l['cut0'] = 0.0 if i == 0 else (lines[i - 1]['end'] + l['on']) / 2
        l['cut1'] = total if i == len(lines) - 1 else (l['end'] + lines[i + 1]['on']) / 2

    os.makedirs(OUT, exist_ok=True)
    pages_out = []
    for pi, page in enumerate(script['pages']):
        n = pi + 1
        pl = [l for l in lines if l['page'] == n]
        # ---- audio: lead-in, each line chunk (its own natural gaps), the pause after each line opened to LINE_PAUSE
        parts, cues, t = [np.zeros(int(SR * LEAD_IN), np.float32)], [], LEAD_IN
        for k, l in enumerate(pl):
            a = l['on'] - 0.08 if k == 0 else l['cut0']
            b = l['end'] + 0.12 if k == len(pl) - 1 else l['cut1']
            seg = x[int(a * SR):int(b * SR)].copy()
            f = int(SR * 0.012)
            seg[:f] *= np.linspace(0, 1, f)
            seg[-f:] *= np.linspace(1, 0, f)
            cues.append({'t0': round(t + (l['on'] - a), 2), 't1': round(t + (l['end'] - a), 2), 'text': l['text']})
            parts.append(seg)
            t += len(seg) / SR
            if k < len(pl) - 1:
                natural = pl[k + 1]['on'] - l['end']
                want = LAST_PAUSE if k == len(pl) - 2 else LINE_PAUSE
                extra = max(0.0, want - natural)
                parts.append(np.zeros(int(SR * extra), np.float32))
                t += extra
        parts.append(np.zeros(int(SR * TAIL), np.float32))
        page_audio = np.concatenate(parts)
        ogg = os.path.join(OUT, f'narration_{n:02d}.ogg')
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, 'p.wav')
            write_wav(wav, page_audio)
            # a gentle compressor (the whispers stay audible under the score), then two-pass loudness to -18 LUFS
            chain = 'acompressor=threshold=-26dB:ratio=2.2:attack=12:release=260:makeup=1'
            m = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', chain + ',loudnorm=I=-18:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                               capture_output=True, text=True).stderr
            j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
            ln = (f"loudnorm=I=-18:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
                  f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', chain + ',' + ln, '-ar', str(SR), '-ac', '1',
                            '-c:a', 'libopus', '-b:a', '64k', '-application', 'audio', ogg], check=True)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ogg],
                                   capture_output=True, text=True, check=True).stdout)
        # ---- the page image: a byte copy + a tiny blurred placeholder (shown at once, and as the ambient backdrop)
        src = os.path.join(SRC_PAGES, f'Page_{n:02d}.webp')
        dst = os.path.join(OUT, f'page_{n:02d}.webp')
        shutil.copyfile(src, dst)
        im = Image.open(src).convert('RGB')
        w, h = im.size
        thumb = im.resize((24, 36), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
        buf = io.BytesIO()
        thumb.save(buf, 'JPEG', quality=70)
        pages_out.append({
            'n': n, 'title': page['title'], 'image': f'assets/lore/page_{n:02d}.webp', 'width': w, 'height': h,
            'imageBytes': os.path.getsize(dst), 'placeholder': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(),
            'audio': f'assets/lore/narration_{n:02d}.ogg', 'audioBytes': os.path.getsize(ogg), 'duration': round(dur, 2), 'cues': cues,
        })
        print(f'page {n:02d}  {dur:5.1f} s  {len(cues)} cues  {os.path.getsize(ogg) / 1024:5.0f} KB ogg  {os.path.getsize(dst) / 1024:5.0f} KB webp  {page["title"]}')

    voice = json.load(open(os.path.join(ROOT, 'tools', 'lore', 'voice.json')))
    manifest = {
        '_generatedBy': 'tools/lore/build_lore.py', 'take': take, 'model': meta['model'], 'stability': meta['stability'],
        'similarity': meta['similarity'], 'seed': meta['seed'], 'voice': {'id': voice['voiceId'], 'name': voice['name'], 'source': voice['source']},
        'pages': pages_out,
    }
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('total narration', round(sum(p['duration'] for p in pages_out), 1), 's ->', MANIFEST)


if __name__ == '__main__':
    main()
