"""Film v2: mark the subtitles that sit on parchment (ink passages), so the game and the share render draw them as ink
(dark sepia with a paper halo) instead of pale text on a dark scrim.

    python tools/cinematic/v2/game_data.py        (rewrites src/data/opening.json and the Remotion copy)

Run after `python tools/cinematic/post.py --game-data` (which regenerates opening.json from timeline.json).
"""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
# film seconds where the picture is parchment (see tools/cinematic/remotion/src/Film.tsx and docs/CINEMATIC_V2.md)
# the FINAL film is v1 up to 26.125 s (dark pictures) and v2 after: only v2's parchment passages after the cut count
PAPER = [(26.125, 28.0), (42.33, 48.25)]

def on_paper(s):
    mid_cover = 0.0
    for a, b in PAPER:
        mid_cover += max(0.0, min(b, s['end']) - max(a, s['start']))
    return mid_cover >= 0.6 * (s['end'] - s['start'])

for path in (os.path.join(ROOT, 'src', 'data', 'opening.json'), os.path.join(ROOT, 'tools', 'cinematic', 'remotion', 'src', 'opening.json')):
    d = json.load(open(path, encoding='utf-8'))
    for s in d['subtitles']:
        if on_paper(s): s['paper'] = True
        else: s.pop('paper', None)
    d['film'] = 'final (v1 to 26.125 s, then v2)'
    with open(path, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False, indent=1)
    print(path, sum(1 for s in d['subtitles'] if s.get('paper')), 'on paper')
