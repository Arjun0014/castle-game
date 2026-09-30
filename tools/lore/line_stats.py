"""Per-line acoustic stats of a lore take (uses the take's character alignment to cut each subtitle line).
python tools/lore/line_stats.py assets/audio/lore/takes/<take>/<name>.json"""
import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from voice_stats import stats

meta = json.load(open(sys.argv[1], encoding='utf-8'))
mp3 = sys.argv[1][:-5] + '.mp3'
al = meta['alignment']
st, en = al['character_start_times_seconds'], al['character_end_times_seconds']
for p in meta['pages']:
    for l in p['lines']:
        t0, t1 = st[l['start']], en[l['end'] - 1]
        with tempfile.TemporaryDirectory() as d:
            w = os.path.join(d, 'x.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t0), '-to', str(t1), '-i', mp3, w], check=True)
            s = stats(w)
        print(f"p{p['page']:02d} l{l['line']}  {t0:6.2f}-{t1:6.2f}  F0 {s.get('f0Median')} ({s.get('f0P10')}-{s.get('f0P90')})  cen {s.get('centroid')}  {l['spoken'][:60]}")
