"""Ship the Remotion opening (session 14) as the game's New Game cinematic.

    python tools/cinematic/ship_intro.py

Source (never modified): remotion-intro/out/the-castle-remembers-intro-9x16-720p.mp4 (720x1280, 30 fps, H.264 High
+ AAC, moov atom first so it streams). It is copied byte for byte to public/cinematic/intro_720.mp4 and
src/data/opening.json is rewritten for ui/Intro.ts. The film's narration captions are BURNED IN (remotion-intro
src/Intro.tsx), so the game's DOM subtitle track is empty — two sets of captions would fight.

The session-10 Blender film (tools/cinematic/post.py -> opening_1080/720.mp4) is retired; post.py still rebuilds
it, but running it would also overwrite opening.json — re-run this script afterwards to ship the Remotion cut again.
"""
import hashlib, json, os, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SRC = os.path.join(ROOT, 'remotion-intro', 'out', 'the-castle-remembers-intro-9x16-720p.mp4')
DST_REL = 'cinematic/intro_720.mp4'
DST = os.path.join(ROOT, 'public', *DST_REL.split('/'))
MANIFEST = os.path.join(ROOT, 'src', 'data', 'opening.json')


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,profile',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def moov_first(path):
    with open(path, 'rb') as f:
        head = f.read(1 << 20)
    i = 0
    while i + 8 <= len(head):
        size = int.from_bytes(head[i:i + 4], 'big')
        kind = head[i + 4:i + 8]
        if kind == b'moov':
            return True
        if kind == b'mdat' or size < 8:
            return False
        i += size
    return False


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    if not os.path.exists(SRC):
        sys.exit(f'missing source film: {SRC}')
    info = probe(SRC)
    v = next(s for s in info['streams'] if s['codec_type'] == 'video')
    a = [s for s in info['streams'] if s['codec_type'] == 'audio']
    dur = float(info['format']['duration'])
    if (v['width'], v['height']) != (720, 1280) or v['codec_name'] != 'h264' or not a:
        sys.exit(f'unexpected film format: {v} audio={a}')
    if not moov_first(SRC):
        sys.exit('the film is not fast-start (moov after mdat): remux it with ffmpeg -movflags +faststart -c copy first')
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    shutil.copyfile(SRC, DST)
    if sha(SRC) != sha(DST):
        sys.exit('copy mismatch')
    manifest = {
        '_generated': 'tools/cinematic/ship_intro.py from remotion-intro/out/the-castle-remembers-intro-9x16-720p.mp4 - do not edit',
        'title': 'The Castle Remembers',
        'duration': round(dur, 3),
        'videos': [{'src': DST_REL, 'height': 1280, 'bytes': os.path.getsize(DST)}],
        'burnedInCaptions': True,
        'subtitleFade': [0.22, 0.3],
        'subtitles': [],
    }
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'shipped {DST_REL}: {os.path.getsize(DST) / 1e6:.2f} MB, {dur:.2f} s, {v["profile"]} {v["width"]}x{v["height"]}')


if __name__ == '__main__':
    main()
