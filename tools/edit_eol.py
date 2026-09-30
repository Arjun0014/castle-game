"""Exact-substring edits that keep a file's line endings (CRLF or LF): the needles are written with \\n.

python tools/edit_eol.py <edits.json>   where edits.json = [{"file": "...", "old": "...", "new": "..."}, ...]
Each old string must occur exactly once.
"""
import json
import sys

for e in json.load(open(sys.argv[1], encoding='utf-8')):
    raw = open(e['file'], 'rb').read().decode('utf-8')
    crlf = raw.count('\r\n') > raw.count('\n') / 2
    text = raw.replace('\r\n', '\n')
    n = text.count(e['old'])
    if n != 1:
        raise SystemExit(f"{e['file']}: expected 1 match, found {n}: {e['old'][:80]!r}")
    text = text.replace(e['old'], e['new'])
    if crlf:
        text = text.replace('\n', '\r\n')
    open(e['file'], 'wb').write(text.encode('utf-8'))
    print('edited', e['file'])
