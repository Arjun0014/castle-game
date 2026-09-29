"""THE CASTLE REMEMBERS — master timeline of the opening film (single source of truth).

    python tools/cinematic/timeline.py        -> tools/cinematic/timeline.json

Everything downstream reads timeline.json: the Blender shot scripts (frame ranges), the audio mixer
(narration placement, music sections, sound cues) and the game (subtitles). Times are seconds on the film clock.
Narration comes from take A (assets/audio/cinematic/narration/A.mp3), cut into phrases at real silences, sped
up by STRETCH with rubberband (pitch preserved), and placed with the gaps below.
"""
import json, os

FPS = 24
STRETCH = 1.07          # narration tempo factor (her natural delivery is slow; 7 % keeps the weight, saves ~3 s)

# phrase id -> (source in, source out) in take A, seconds (cut inside measured silences, with a little air)
PHRASES = {
    'P1': (0.45, 3.12),   'P2': (4.10, 6.80),   'P3': (7.74, 10.72),  'P4': (11.55, 14.82),
    'P5': (15.93, 20.36), 'P6': (21.30, 23.38), 'P8': (28.20, 31.98), 'P9': (32.73, 36.26),
    'P10': (37.44, 39.62), 'P11': (40.69, 43.34), 'P12': (43.70, 47.06), 'P13': (48.08, 50.60),
    'P14': (51.22, 53.64), 'P15': (54.71, 58.88), 'P16': (59.21, 60.88),
}
# placement on the film clock (start seconds)
PLACE = {
    'P1': 1.00, 'P2': 3.83, 'P3': 6.94, 'P4': 10.07, 'P5': 13.83, 'P6': 18.36, 'P8': 22.60, 'P9': 28.00,
    'P10': 31.79, 'P11': 36.40, 'P12': 39.22, 'P13': 42.85, 'P14': 45.54, 'P15': 48.40, 'P16': 52.64,
}

def phrase_span(pid):
    a, b = PHRASES[pid]
    s = PLACE[pid]
    return s, s + (b - a) / STRETCH

SUBTITLES = [  # display text, phrases it covers
    ('Before Veyr had a king, the mountain had a heart.', ['P1', 'P2']),
    ('It answered only to blood.', ['P3']),
    ('And House Vaelor gave it theirs.', ['P4']),
    ('“The castle remembers its rightful ruler.”', ['P5']),
    ('So their people were taught.', ['P6']),
    ('On the last night, the gates were sealed…', ['P8']),
    ('…and the king went down to the heart.', ['P9']),
    ('Whatever he asked of it…', ['P10']),
    ('Caer Veyr was torn between two memories of itself.', ['P11', 'P12']),
    ('The kingdom became a story. Then a warning.', ['P13', 'P14']),
    ('Now, a daughter of the forgotten line has come home.', ['P15', 'P16']),
]

SHOTS = [  # id, start, end, what
    ('S01_heart',     0.00,  6.90, 'Black. The Crownheart wakes in the dark beneath the mountain.'),
    ('S02_blood',     6.90, 13.80, 'Torchlit founders; a cut palm; the drop lands on "blood"; gold runs through the whorls.'),
    ('S03_rise',     13.80, 20.30, 'Cutaway: the camera rises through the rock as Caer Veyr grows above it, gilded at dusk.'),
    ('S04_war',      20.30, 22.60, 'Same composition: the sky bleeds red, the valley fills with the fires of an army.'),
    ('S05_sealed',   22.60, 26.13, 'Inside the gate passage: the portcullis slams on "sealed"; guards turn their spears inward.'),
    ('S06_child',    26.13, 28.00, 'A servants\' door: a woman\'s hand pushes a hooded child into the dark; she looks back; the door shuts.'),
    ('S07_descent',  28.00, 31.29, 'The spiral stair from above: the crowned shadow descends toward red-gold light.'),
    ('S08_asking',   31.29, 33.81, 'His gauntlet on the heart; the whorls blaze; bells toll above.'),
    ('S09a_surge',   33.81, 34.90, 'Cutaway: the heart flares; a column of light rises through the rock toward the castle.'),
    ('S09b_sundering', 34.90, 42.35, 'The castle blazes gold; its gilded image crazes like old varnish; silence; the Past flakes away to reveal the ruin in register; flakes hang where windows were.'),
    ('S10_centuries', 42.35, 47.60, 'Time-lapse on the ruin: moon, stars, snow, rain, growth; one gold window flickers, then goes out.'),
    ('S11_road',     47.60, 52.70, 'Night, now. A woman climbs the overgrown road beneath the dead silhouette.'),
    ('S12_gate',     52.70, 55.00, 'Behind her, low: the rotted gate, the faded crest; her shield on her back.'),
    ('S13_touch',    55.00, 56.20, 'Her hand on the crest; the engraving fills with a hairline of red-gold.'),
    ('S14_glimpse',  56.20, 57.30, 'Gilding sweeps out from her palm: the living gate, torches, banners, guards turning their heads.'),
    ('S15_ruin',     57.30, 58.20, 'It cracks away. Ruin. Silence. She does not understand.'),
    ('S16_threshold', 58.20, 62.00, 'From inside the dark: the gate groans open, moonlight, her silhouette; she crosses into darkness.'),
    ('S17_title',    62.00, 66.00, 'Gold flakes drift up in the dark and assemble: THE CASTLE REMEMBERS.'),
]
END = 66.0

MUSIC_SECTIONS = [  # name, start, end, direction (for the composition plan)
    ('crownheart', 0.0, 6.9, 'darkness, a single low sustained tone, glass harmonica shimmer, sub pulse like a slow heartbeat, sacred and ancient'),
    ('binding', 6.9, 13.8, 'the tone blooms into warm low strings, a slow reverent swell, first hint of the Veyr theme on solo cello'),
    ('rise', 13.8, 20.3, 'noble, reverent processional: the Veyr theme on solo cello over strings and soft horns, building to a warm golden peak'),
    ('last_night', 20.3, 33.8, 'the warmth drains away: low war drums far off, tremolo strings, dissonant low brass, the theme fragmented, dread building, heavy bells tolling at the end'),
    ('sundering', 33.8, 37.0, 'a massive swelling crescendo that shatters, then sudden near-silence'),
    ('two_memories', 37.0, 47.6, 'mournful and suspended: solo cello plays the theme slowly over a thin high string drone, reversed textures, a distant bell, centuries passing'),
    ('return', 47.6, 56.2, 'intimate and restrained: a low heartbeat pulse, sparse piano-less strings, the first notes of the theme, tension rising gently'),
    ('threshold', 56.2, 66.0, 'one brief full statement of the theme, then hush: a low sustained drone as she enters the dark, resolving to a final deep chord for the title'),
]

def build():
    narr = []
    for pid in PLACE:
        s, e = phrase_span(pid)
        narr.append({'id': pid, 'src': list(PHRASES[pid]), 'start': round(s, 3), 'end': round(e, 3)})
    subs = []
    for text, pids in SUBTITLES:
        s = min(phrase_span(p)[0] for p in pids); e = max(phrase_span(p)[1] for p in pids)
        subs.append({'text': text, 'start': round(s - 0.12, 3), 'end': round(e + 0.45, 3)})
    for a, b in zip(subs, subs[1:]):  # clean hand-over: never two subtitles at once
        a['end'] = round(min(a['end'], b['start'] - 0.06), 3)
    shots = [{'id': i, 'start': s, 'end': e, 'frames': [round(s * FPS), round(e * FPS)], 'note': n} for i, s, e, n in SHOTS]
    music = [{'name': n, 'start': s, 'end': e, 'style': d} for n, s, e, d in MUSIC_SECTIONS]
    return {'fps': FPS, 'duration': END, 'stretch': STRETCH, 'narration_take': 'A', 'narration': narr, 'subtitles': subs,
            'shots': shots, 'music': music}

if __name__ == '__main__':
    tl = build()
    out = os.path.join(os.path.dirname(__file__), 'timeline.json')
    with open(out, 'w', encoding='utf-8') as f: json.dump(tl, f, indent=1, ensure_ascii=False)
    for n in tl['narration']: print(f"{n['id']:>4} {n['start']:6.2f} -> {n['end']:6.2f}")
    for s in tl['subtitles']: print(f"SUB {s['start']:6.2f} -> {s['end']:6.2f}  {s['text']}")
    # overlap check between consecutive subtitles
    for a, b in zip(tl['subtitles'], tl['subtitles'][1:]):
        if a['end'] > b['start']: print('  WARN subtitle overlap:', a['text'][:30], '|', b['text'][:30], round(a['end'] - b['start'], 2))
    print('frames', round(END * FPS))
