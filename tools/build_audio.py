"""Deterministic audio build: CC0 source recordings -> processed runtime OGGs + src/data/audioManifest.json.

Run:  python tools/build_audio.py

Sources live in assets/audio/_downloads (downloaded packs, never modified; see assets/audio/SOURCES.md).
Every runtime sound is defined below as one or more *variants*; a variant is a single processed source
or a mix of layers. Processing: decode (ffmpeg, 48 kHz mono or stereo) -> optional ffmpeg filter chain
(-af) -> trim / offset -> varispeed pitch -> reverse -> fades -> layering -> peak-normalise -> Vorbis.
Runtime gain per sound lives in the manifest so levels can be balanced without re-encoding.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'assets', 'audio', '_downloads')
OUT = os.path.join(ROOT, 'public', 'assets', 'audio')
MANIFEST = os.path.join(ROOT, 'src', 'data', 'audioManifest.json')
SR = 48000
os.makedirs(OUT, exist_ok=True)

K_IMP = 'kenney_impact-sounds/Audio/'
K_RPG = 'kenney_rpg-audio/Audio/'
RPG80 = '80-CC0-RPG-SFX_0/'
CRE80 = '80-CC0-creature-SFX_0/'
SFX100 = 'sfx_100_v2/sfx100v2_'
SWISH = 'swishes/swishes/'
SN_SWORD = 'sword_-_starninjas_1/sword - StarNinjas/'
SN_CLASH = 'sword_clash_-_starninjas_0/'
MONSTER = 'monster-sounds-volume-2/Monster-Sounds-Volume-2/'
GHOST = 'qubodup-GhostMoans/qubodup-GhostMoans/wav/'

_cache = {}


def load(rel, stereo=False, af=None):
    key = (rel, stereo, af)
    if key in _cache:
        return _cache[key].copy()
    path = os.path.join(SRC, rel)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    ch = 2 if stereo else 1
    cmd = ['ffmpeg', '-v', 'error', '-i', path]
    if af:
        cmd += ['-af', af]
    cmd += ['-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    x = x.reshape(-1, ch) if stereo else x
    _cache[key] = x
    return x.copy()


def trim_silence(x, thr_db=-50.0, pad=0.004):
    mag = np.abs(x if x.ndim == 1 else x.max(axis=1))
    thr = 10 ** (thr_db / 20) * max(1e-9, mag.max())
    idx = np.where(mag > thr)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(0.02 * SR))
    return x[a:b]


def varispeed(x, rate):
    if abs(rate - 1) < 1e-4:
        return x
    n = int(len(x) / rate)
    t = np.arange(n) * rate
    if x.ndim == 1:
        return np.interp(t, np.arange(len(x)), x).astype(np.float32)
    return np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(x.shape[1])], axis=1).astype(np.float32)


def fades(x, fin=0.003, fout=0.03):
    n = len(x)
    a = min(n, int(fin * SR))
    b = min(n, int(fout * SR))
    env = np.ones(n, dtype=np.float32)
    if a > 0:
        env[:a] = np.linspace(0, 1, a) ** 2
    if b > 0:
        env[n - b:] = np.minimum(env[n - b:], np.linspace(1, 0, b) ** 2)
    return x * (env if x.ndim == 1 else env[:, None])


def V(rel, af=None, start=0.0, dur=None, rate=1.0, rev=False, gain=0.0, trim=True, fin=0.003, fout=0.03, stereo=False):
    """One processed layer from a source file."""
    x = load(rel, stereo, af)
    if trim:
        x = trim_silence(x)
    s = int(start * SR)
    x = x[s:] if dur is None else x[s:s + int(dur * SR)]
    x = varispeed(x, rate)
    if rev:
        x = x[::-1].copy()
    x = fades(x, fin, fout)
    return x * (10 ** (gain / 20))


def mix(*layers):
    """layers: (signal, offset_seconds) pairs."""
    n = max(int(o * SR) + len(s) for s, o in layers)
    ch = layers[0][0].shape[1] if layers[0][0].ndim == 2 else None
    out = np.zeros((n, ch) if ch else n, dtype=np.float32)
    for s, o in layers:
        a = int(o * SR)
        out[a:a + len(s)] += s
    return out


def loopify(x, xfade=1.0):
    """Make a seamless loop: crossfade the tail into the head."""
    f = int(xfade * SR)
    head, body, tail = x[:f], x[f:len(x) - f], x[len(x) - f:]
    ramp = np.linspace(0, 1, f, dtype=np.float32)
    if x.ndim == 2:
        ramp = ramp[:, None]
    blend = tail * (1 - ramp) + head * ramp
    return np.concatenate([body, blend])


def write(name, x, peak_db=-1.0, quality=4):
    peak = float(np.abs(x).max())
    if peak > 0:
        x = x * (10 ** (peak_db / 20) / peak)
    ch = 2 if x.ndim == 2 else 1
    with tempfile.NamedTemporaryFile(suffix='.f32', delete=False) as tf:
        tf.write(x.astype(np.float32).tobytes())
        tmp = tf.name
    out = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', tmp,
                    '-c:a', 'libvorbis', '-q:a', str(quality), out], check=True)
    os.unlink(tmp)
    return 'assets/audio/' + name + '.ogg', len(x) / SR


HP = 'highpass=f=110'
HP_CLASH = 'highpass=f=180'

# ------------------------------------------------------------------------------------------------ bank
# id: dict(bus, gain (dB at runtime), variants: [callables returning signal], sources: [...], use: '...')
BANK = {}


def sound(id, bus, gain, use, variants, sources, loop=False, stereo=False):
    BANK[id] = dict(bus=bus, gain=gain, use=use, variants=variants, sources=sources, loop=loop, stereo=stereo)


# --- player sword
sound('swing', 'sfx', -3, 'Every player/enemy sword swing (pitch/rate varied per attack weight).',
      [lambda i=i: V(SWISH + f'swish-{i}.wav', af=HP, fout=0.02) for i in range(1, 14)],
      ['swishes (artisticdude, CC0)'])
sound('blade_ring', 'sfx', -12, 'Quiet metallic "shing" layered on sword swings and finishers.',
      [lambda f=f: V(RPG80 + f, af='highpass=f=900', dur=0.35, fout=0.12) for f in ('blade_01.ogg', 'blade_02.ogg', 'blade_03.ogg')] +
      [lambda i=i: V(SN_SWORD + f'sword.{i}.ogg', af='highpass=f=1200', dur=0.4, fout=0.18) for i in (1, 4, 5, 7)],
      ['80 CC0 RPG SFX blade_01-03 (rubberduck, CC0)', '20 Sword Sound Effects: sword.N (StarNinjas, CC0)'])
# --- impacts
sound('hit_flesh', 'sfx', -2, 'Sword landing on Hollows/unarmoured targets (thump layer).',
      [lambda i=i: V(K_IMP + f'impactPunch_heavy_00{i}.ogg', fout=0.08) for i in range(5)],
      ['Kenney Impact Sounds impactPunch_heavy (CC0)'])
sound('hit_slice', 'sfx', -7, 'Cut layer on sword hits (flesh).',
      [lambda: V(K_RPG + 'knifeSlice.ogg', dur=0.3, fout=0.1), lambda: V(K_RPG + 'knifeSlice2.ogg', dur=0.3, fout=0.1),
       lambda: V(K_RPG + 'chop.ogg', fout=0.06), lambda: V(RPG80 + 'blade_02.ogg', dur=0.2, rate=0.85, fout=0.08)],
      ['Kenney RPG Audio knifeSlice/chop (CC0)', '80 CC0 RPG SFX blade_02 (CC0)'])
sound('hit_armor', 'sfx', -3, 'Sword landing on armoured knights / guards.',
      [lambda i=i: V(K_IMP + f'impactPlate_medium_00{i}.ogg', fout=0.12) for i in range(5)] +
      [lambda i=i: V(K_IMP + f'impactPlate_heavy_00{i}.ogg', dur=0.35, fout=0.15) for i in range(3)],
      ['Kenney Impact Sounds impactPlate_medium/heavy (CC0)'])
sound('clash', 'sfx', -3, 'Blade on blade: enemy blocks, player parries (bright ring).',
      [lambda i=i: V(SN_CLASH + f'sword_clash.{i}.ogg', af=HP_CLASH, dur=0.75, fout=0.3) for i in range(1, 11)],
      ['20 Sword Sound Effects: sword_clash.N (StarNinjas, CC0)'])
sound('shield_block', 'sfx', -2, 'Hits absorbed by the player\'s shield (heavy plate crash + clash tail).',
      [lambda i=i: mix((V(K_IMP + f'impactPlate_heavy_00{i}.ogg', fout=0.15), 0),
                       (V(SN_CLASH + f'sword_clash.{(i % 5) + 2}.ogg', af=HP_CLASH, dur=0.5, fout=0.25, gain=-9), 0.004)) for i in range(5)],
      ['Kenney impactPlate_heavy (CC0)', 'StarNinjas sword_clash (CC0)'])
sound('parry', 'sfx', -1, 'Perfect parry: bright clash + bell shimmer.',
      [lambda i=i: mix((V(SN_CLASH + f'sword_clash.{i}.ogg', af=HP_CLASH, dur=0.9, fout=0.4, rate=1.12), 0),
                       (V(K_IMP + 'impactBell_heavy_001.ogg', af='highpass=f=400', rate=1.5, fout=0.4, gain=-10), 0.01)) for i in (1, 3, 5, 8)],
      ['StarNinjas sword_clash (CC0)', 'Kenney impactBell_heavy (CC0)'])
sound('kick_hit', 'sfx', -2, 'Kick / shield bash connecting.',
      [lambda i=i: mix((V(K_IMP + f'impactPunch_heavy_00{i}.ogg', rate=0.85), 0), (V(K_IMP + f'impactSoft_heavy_00{i}.ogg', gain=-6), 0)) for i in range(4)],
      ['Kenney impactPunch_heavy + impactSoft_heavy (CC0)'])
sound('body_fall', 'sfx', -4, 'Enemy/player hits the floor (deaths, knockdowns).',
      [lambda i=i: V(K_IMP + f'impactSoft_heavy_00{i}.ogg', rate=0.8, fout=0.2) for i in range(5)],
      ['Kenney impactSoft_heavy (CC0)'])
sound('armor_crash', 'sfx', -4, 'Armoured Echo collapsing.',
      [lambda i=i: mix((V(K_IMP + f'impactPlate_heavy_00{i}.ogg', rate=0.8), 0), (V(RPG80 + f'chain_0{(i % 3) + 1}.ogg', gain=-4), 0.05),
                       (V(K_IMP + f'impactSoft_heavy_00{i}.ogg', gain=-3), 0.12)) for i in range(4)],
      ['Kenney impactPlate/impactSoft (CC0)', '80 CC0 RPG SFX chain (CC0)'])
sound('armor_rattle', 'sfx', -13, 'Knights shifting their armour when winding up / running.',
      [lambda f=f: V(RPG80 + f, fout=0.1) for f in ('chain_01.ogg', 'chain_02.ogg', 'chain_03.ogg')] +
      [lambda f=f: V(K_RPG + f, fout=0.1) for f in ('beltHandle1.ogg', 'beltHandle2.ogg', 'clothBelt2.ogg')],
      ['80 CC0 RPG SFX chain (CC0)', 'Kenney RPG Audio beltHandle/clothBelt (CC0)'])
# --- movement
sound('step_stone', 'sfx', -14, 'Hero footsteps in the Past (dressed stone).',
      [lambda i=i: V(K_IMP + f'footstep_concrete_00{i}.ogg', fout=0.05) for i in range(5)],
      ['Kenney Impact Sounds footstep_concrete (CC0)'])
sound('step_ruin', 'sfx', -13, 'Hero footsteps in the Present (grit and rubble).',
      [lambda i=i: V(K_RPG + f'footstep0{i}.ogg', fout=0.05) for i in range(10)],
      ['Kenney RPG Audio footstep00-09 (CC0)'])
sound('step_grit', 'sfx', -19, 'Loose-stone layer under Present footsteps.',
      [lambda f=f, s=s: V(f, start=s, dur=0.18, fout=0.08, af='highpass=f=500') for f, s in
       ((RPG80 + 'stones_01.ogg', 0), (RPG80 + 'stones_02.ogg', 0.1), (RPG80 + 'stones_04.ogg', 0), (SFX100 + 'stones_01.ogg', 0), (SFX100 + 'stones_03.ogg', 0.05))],
      ['80 CC0 RPG SFX stones (CC0)', '100 CC0 SFX #2 stones (CC0)'])
sound('enemy_step', 'sfx', -17, 'Enemy footfalls (armoured knights, hollows).',
      [lambda i=i: V(K_IMP + f'footstep_concrete_00{i}.ogg', rate=0.8, fout=0.05) for i in range(5)],
      ['Kenney footstep_concrete (CC0)'])
sound('jump', 'sfx', -10, 'Take-off (cloth + scuff).',
      [lambda i=i: mix((V(K_RPG + f'cloth{i}.ogg', dur=0.3, fout=0.1), 0), (V(K_IMP + f'footstep_concrete_00{i}.ogg', gain=-4), 0)) for i in range(1, 5)],
      ['Kenney RPG cloth (CC0)', 'Kenney footstep_concrete (CC0)'])
sound('land', 'sfx', -7, 'Landing thud.',
      [lambda i=i: mix((V(K_IMP + f'impactSoft_medium_00{i}.ogg'), 0), (V(K_IMP + f'footstep_concrete_00{i}.ogg', gain=-3), 0.01)) for i in range(5)],
      ['Kenney impactSoft_medium + footstep_concrete (CC0)'])
sound('land_heavy', 'sfx', -4, 'Landing from a long fall.',
      [lambda i=i: mix((V(K_IMP + f'impactSoft_heavy_00{i}.ogg'), 0), (V(K_IMP + f'footstep_concrete_00{i}.ogg'), 0.0)) for i in range(4)],
      ['Kenney impactSoft_heavy + footstep_concrete (CC0)'])
sound('dodge', 'sfx', -6, 'Dodge dash: cloth + air.',
      [lambda i=i: mix((V(K_RPG + f'cloth{i}.ogg', dur=0.35, fout=0.12), 0), (V(SWISH + f'swish-{i + 6}.wav', rate=0.7, gain=-5, af=HP), 0.03)) for i in range(1, 5)],
      ['Kenney RPG cloth (CC0)', 'swishes (CC0)'])
# --- enemies
sound('hollow_growl', 'sfx', -6, 'Hollow aggro / attack wind-up.',
      [lambda f=f: V(MONSTER + f, af=HP, fout=0.12) for f in ('Monster-1.wav', 'Monster-3.wav', 'Monster-4.wav', 'monster-10.wav', 'monster-14.wav', 'monster-15.wav', 'monster-13.wav')] +
      [lambda f=f: V(CRE80 + f, af=HP, fout=0.15) for f in ('monster_01.ogg', 'monster_03.ogg', 'monster_06.ogg', 'grunt_03.ogg', 'grunt_05.ogg')],
      ['Monster Sound Pack Vol. 1 (Ogrebane, CC0)', '80 CC0 creature SFX (rubberduck, CC0)'])
sound('hollow_hurt', 'sfx', -6, 'Hollow flinch.',
      [lambda f=f: V(CRE80 + f, af=HP, fout=0.1, rate=0.85) for f in ('hurt_01.ogg', 'hurt_02.ogg', 'hurt_03.ogg', 'hurt_05.ogg')] +
      [lambda f=f: V(RPG80 + f, af=HP, fout=0.1) for f in ('creature_hurt_01.ogg', 'creature_hurt_02.ogg')],
      ['80 CC0 creature SFX hurt (CC0)', '80 CC0 RPG SFX creature_hurt (CC0)'])
sound('hollow_death', 'sfx', -4, 'Hollow death cry.',
      [lambda: V(RPG80 + 'creature_die_01.ogg', af=HP, fout=0.3), lambda: V(CRE80 + 'scream_01.ogg', rate=0.72, fout=0.3, af=HP),
       lambda: V(CRE80 + 'roar_02.ogg', rate=0.8, fout=0.3, af=HP), lambda: V(CRE80 + 'monster_07.ogg', rate=0.85, fout=0.3, af=HP)],
      ['80 CC0 RPG SFX creature_die_01 (CC0)', '80 CC0 creature SFX scream/roar/monster (CC0)'])
sound('wraith_moan', 'sfx', -9, 'Echo Wraith presence / dive.',
      [lambda f=f, s=s: V(GHOST + f, start=s, dur=1.8, rate=0.88, fin=0.15, fout=0.6, af=HP) for f, s in
       (('qubodup-GhostMoan01.wav', 0.0), ('qubodup-GhostMoan02.wav', 0.3), ('qubodup-GhostMoan03.wav', 1.0), ('qubodup-GhostMoan04.wav', 0.5), ('qubodup-GhostMoan05.wav', 0.0))],
      ['Ghost Monster Voice Moaning & Growling (qubodup, CC0)'])
sound('wraith_dive', 'sfx', -5, 'Wraith swoop attack (reversed moan into air rush).',
      [lambda i=i: mix((V(GHOST + f'qubodup-GhostMoan0{i}.wav', dur=0.9, rev=True, fin=0.3, fout=0.02, af=HP, gain=-4), 0),
                       (V(SFX100 + 'air_02.ogg', dur=0.8, rate=1.2, fout=0.3), 0.55)) for i in (1, 3, 4)],
      ['qubodup Ghost Moans (CC0)', '100 CC0 SFX #2 air_02 (CC0)'])
sound('wraith_death', 'sfx', -5, 'Wraith dissolving.',
      [lambda i=i: mix((V(GHOST + f'qubodup-GhostMoan0{i}.wav', dur=1.4, rate=0.7, fout=0.9, af=HP), 0),
                       (V(SFX100 + 'air_01.ogg', dur=1.4, rev=True, fin=0.4, fout=0.4, gain=-6), 0.0)) for i in (2, 3, 5)],
      ['qubodup Ghost Moans (CC0)', '100 CC0 SFX #2 air_01 (CC0)'])
sound('bow_draw', 'sfx', -10, 'Archer drawing (creak + leather).',
      [lambda f=f: mix((V(K_RPG + f, fout=0.2, rate=1.1), 0), (V(K_RPG + 'handleSmallLeather.ogg', gain=-6), 0.05)) for f in ('creak1.ogg', 'creak2.ogg', 'creak3.ogg')],
      ['Kenney RPG Audio creak/handleSmallLeather (CC0)'])
sound('bow_release', 'sfx', -4, 'Arrow loosed: string snap + whip of air.',
      [lambda i=i: mix((V(K_IMP + f'impactWood_light_00{i}.ogg', rate=1.6, dur=0.12, fout=0.05), 0),
                       (V(SWISH + f'swish-{i + 3}.wav', rate=1.45, af='highpass=f=600', gain=-2), 0.01)) for i in range(4)],
      ['Kenney impactWood_light (CC0)', 'swishes (CC0)'])
sound('arrow_hit', 'sfx', -5, 'Arrow striking stone/wood.',
      [lambda i=i: V(K_IMP + f'impactWood_light_00{i}.ogg', fout=0.06) for i in range(5)],
      ['Kenney impactWood_light (CC0)'])
# --- player body
sound('player_hurt', 'sfx', -3, 'Hero takes a hit.',
      [lambda i=i: mix((V(K_IMP + f'impactPunch_medium_00{i}.ogg'), 0), (V(K_RPG + f'cloth{(i % 4) + 1}.ogg', dur=0.25, gain=-8, fout=0.1), 0.01)) for i in range(5)],
      ['Kenney impactPunch_medium + RPG cloth (CC0)'])
sound('player_death', 'sfx', -2, 'Hero falls.',
      [lambda: mix((V(K_IMP + 'impactSoft_heavy_002.ogg', rate=0.75), 0), (V(K_IMP + 'impactPlate_heavy_003.ogg', gain=-8, rate=0.8), 0.02), (V(K_IMP + 'impactSoft_heavy_004.ogg', gain=-4, rate=0.7), 0.45))],
      ['Kenney impactSoft/impactPlate (CC0)'])
# --- temporal
sound('shift_charge', 'sfx', -3, '2.4 s channel: reversed thunder and air rising into the shift.',
      [lambda: mix((V(SFX100 + 'thunder_01.ogg', dur=2.6, rev=True, fin=1.2, fout=0.05, af='lowpass=f=1800'), 0),
                   (V(SFX100 + 'air_01.ogg', rev=True, rate=1.05, fin=0.8, fout=0.02, gain=-4), 0.1),
                   (V(RPG80 + 'spell_01.ogg', rev=True, rate=0.6, fin=0.4, fout=0.02, gain=-8), 1.55))],
      ['100 CC0 SFX #2 thunder_01, air_01 (CC0)', '80 CC0 RPG SFX spell_01 (CC0)'])
sound('shift_boom', 'sfx', 0, 'Shift completes: the castle snaps into the other memory.',
      [lambda: mix((V(SFX100 + 'thunder_01.ogg', dur=3.4, fout=1.4, af='lowpass=f=900'), 0),
                   (V(K_IMP + 'impactMining_002.ogg', rate=0.6, gain=-3), 0), (V(K_IMP + 'impactSoft_heavy_001.ogg', rate=0.55), 0),
                   (V(K_IMP + 'impactBell_heavy_003.ogg', rate=0.5, fout=1.0, gain=-9), 0.02))],
      ['100 CC0 SFX #2 thunder_01 (CC0)', 'Kenney impactMining/impactSoft/impactBell (CC0)'])
sound('shift_deny', 'sfx', -5, 'Shift refused / seal does not know you.',
      [lambda f=f: mix((V(RPG80 + f, fout=0.1), 0), (V(K_IMP + 'impactWood_heavy_001.ogg', rate=0.7, gain=-6), 0)) for f in ('lock_01.ogg', 'lock_02.ogg', 'lock_03.ogg')],
      ['80 CC0 RPG SFX lock (CC0)', 'Kenney impactWood_heavy (CC0)'])
# ---- ElevenLabs sound-generation layers (tools/elevenlabs_sfx.mjs; prompts in assets/audio/elevenlabs/MANIFEST.json).
# Used as *layers* on top of the CC0 sounds at conservative gains; not yet reviewed by ear (see CONTEXT.md).
EL = '../elevenlabs/'
sound('gore_splat', 'sfx', -8, 'Wet flesh/blood layer on killing blows against flesh (Hollows, guards, hero hits).',
      [lambda i=i: V(EL + f'gore_splat_{i}.mp3', af='highpass=f=90', fout=0.12) for i in range(4)],
      ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)'])
sound('kill_impact', 'sfx', -7, 'Body-blow layer on heavy / finisher kills.',
      [lambda i=i: V(EL + f'kill_impact_{i}.mp3', af='highpass=f=50', fout=0.2) for i in range(3)],
      ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)'])
sound('bone_crunch', 'sfx', -9, 'Bone crunch on finisher kills (power > 0.7).',
      [lambda i=i: V(EL + f'bone_crunch_{i}.mp3', fout=0.1) for i in range(3)],
      ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)'])
sound('echo_shatter', 'sfx', -9, 'An Echo breaking apart into embers/ash (enemy shatter).',
      [lambda i=i: V(EL + f'echo_shatter_{i}.mp3', fout=0.4) for i in range(3)],
      ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)'])
sound('blood_splash', 'sfx', -12, 'Blood hitting stone when a body lands.',
      [lambda i=i: V(EL + f'blood_splash_{i}.mp3', fout=0.1) for i in range(3)],
      ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)'])
sound('resonance', 'sfx', -9, 'Resonance released by a defeated Echo flowing into the hero.',
      [lambda i=i: mix((V(RPG80 + f'item_gem_0{i}.ogg', rate=0.62, fout=0.5, af='aecho=0.8:0.7:90|160:0.35|0.22'), 0),
                       (V(RPG80 + 'spell_02.ogg', rate=0.8, gain=-10, fout=0.3), 0.05)) for i in range(1, 5)],
      ['80 CC0 RPG SFX item_gem, spell_02 (CC0)'])
sound('sigil', 'sfx', -2, 'Blood Sigil (checkpoint) awakened.',
      [lambda: mix((V(K_IMP + 'impactBell_heavy_000.ogg', rate=0.5, fout=1.5, af='aecho=0.8:0.6:120|240:0.4|0.25'), 0),
                   (V(RPG80 + 'spell_02.ogg', rate=0.7, gain=-6, fout=0.4), 0.1), (V(SFX100 + 'thunder_01.ogg', dur=2.0, fout=1.2, af='lowpass=f=300', gain=-8), 0))],
      ['Kenney impactBell_heavy (CC0)', '80 CC0 RPG SFX spell_02 (CC0)', '100 CC0 SFX #2 thunder_01 (CC0)'])
sound('memory', 'sfx', -6, 'Memory Trace read.',
      [lambda: mix((V(RPG80 + 'item_gem_02.ogg', rate=0.5, fout=0.8, af='aecho=0.8:0.7:140|260:0.4|0.3'), 0), (V(K_RPG + 'bookFlip2.ogg', gain=-8), 0.1))],
      ['80 CC0 RPG SFX item_gem_02 (CC0)', 'Kenney bookFlip2 (CC0)'])
sound('boss_sting', 'sfx', 0, 'The Gate Warden wakes.',
      [lambda: mix((V(RPG80 + 'creature_roar_03.ogg', rate=0.55, fout=0.8, af=HP), 0), (V(SFX100 + 'thunder_01.ogg', dur=3.5, fout=1.5, af='lowpass=f=700'), 0),
                   (V(K_IMP + 'impactBell_heavy_004.ogg', rate=0.45, fout=1.5, gain=-6), 0.15))],
      ['80 CC0 RPG SFX creature_roar_03 (CC0)', '100 CC0 SFX #2 thunder_01 (CC0)', 'Kenney impactBell_heavy (CC0)'])
sound('hatch_slam', 'sfx', -2, 'The diggers\' hatch slams shut.',
      [lambda: mix((V(K_IMP + 'impactWood_heavy_003.ogg', rate=0.7), 0), (V(K_IMP + 'impactSoft_heavy_003.ogg', rate=0.6), 0), (V(RPG80 + 'chain_03.ogg', gain=-6), 0.05))],
      ['Kenney impactWood_heavy/impactSoft_heavy (CC0)', '80 CC0 RPG SFX chain_03 (CC0)'])
# --- environment one-shots
sound('rubble', 'amb', -10, 'Present: masonry settling somewhere nearby.',
      [lambda f=f: V(f, fout=0.3, af='lowpass=f=5000') for f in (RPG80 + 'stones_01.ogg', RPG80 + 'stones_02.ogg', RPG80 + 'stones_03.ogg', SFX100 + 'stones_02.ogg')],
      ['80 CC0 RPG SFX stones (CC0)', '100 CC0 SFX #2 stones (CC0)'])
sound('creak', 'amb', -14, 'Present: old timber creaking in the wind.',
      [lambda f=f: V(K_RPG + f, rate=0.7, fout=0.3, af='lowpass=f=3000') for f in ('creak1.ogg', 'creak2.ogg', 'creak3.ogg')],
      ['Kenney RPG Audio creak (CC0)'])
sound('distant_moan', 'amb', -17, 'Present: an Echo somewhere in the dark.',
      [lambda i=i: V(GHOST + f'qubodup-GhostMoan0{i}.wav', dur=2.5, rate=0.75, fin=0.4, fout=1.0, af='lowpass=f=1200,aecho=0.8:0.8:300|520:0.4|0.3') for i in (2, 3, 4)],
      ['qubodup Ghost Moans (CC0)'])
sound('thunder', 'amb', -9, 'Present: far thunder over the broken roofs.',
      [lambda: V(SFX100 + 'thunder_01.ogg', af='lowpass=f=600', fout=1.5)],
      ['100 CC0 SFX #2 thunder_01 (CC0)'])
# --- ambience beds (stereo loops)
sound('amb_present', 'amb', -4, 'Present bed: low wind through the ruin + drips.',
      [lambda: loopify(V('dungeon_ambient_1_0.ogg', stereo=True, trim=False, fin=0, fout=0), 2.0)],
      ['Loopable Dungeon Ambience (JaggedStone, CC0)'], loop=True, stereo=True)
sound('amb_wind', 'amb', -8, 'Present: wind where the sky is open (Ward, collapsed roofs).',
      [lambda: loopify(V('wind_woosh_loop.ogg', stereo=True, trim=False, fin=0, fout=0), 0.8)],
      ['wind whoosh loop (SketchMan3, CC0)'], loop=True, stereo=True)
# session 9: the running-water loop was broadband and ~10 dB hotter than the other beds; in the Floor 1 crypt /
# excavation it swamped the whole mix. Now low-passed (distant water in the dark, not a torrent) and 11 dB quieter;
# Audio.update also ramps it in with depth and ducks it in combat.
sound('amb_drips', 'amb', -21, 'Present undercroft/crypt water (distant, low-passed).',
      [lambda: loopify(V(SFX100 + 'loop_water_02.ogg', stereo=True, trim=False, fin=0, fout=0, af='highpass=f=110,lowpass=f=1700'), 0.6)],
      ['100 CC0 SFX #2 loop_water_02 (CC0)'], loop=True, stereo=True)
sound('amb_fire', 'amb', -3, 'Past: torches, braziers and hearths (volume follows the nearest flame).',
      [lambda: loopify(V('fireplace_loop.wav', stereo=True, trim=False, fin=0, fout=0), 1.5)],
      ['Fireplace Sound loop (PagDev, CC0)'], loop=True, stereo=True)
sound('amb_past', 'amb', -9, 'Past bed: the inhabited keep\'s room tone (warm, low).',
      [lambda: loopify(V('dungeon_ambient_1_0.ogg', stereo=True, trim=False, fin=0, fout=0, af='lowpass=f=380,volume=2'), 2.0)],
      ['Loopable Dungeon Ambience (JaggedStone, CC0), low-passed'], loop=True, stereo=True)



# ---- Floor 3: the Last Crown (mage boss) — ElevenLabs sound generation, build-time only (session 5).
_EL_SRC = ['ElevenLabs sound generation (generated 2026-09-29, prompt in MANIFEST.json)']
for _id, _n, _gain, _fout, _desc in [
    ('mage_charge', 3, -9, 0.2, 'Last Crown: gathering a spell (cast tell).'),
    ('mage_bolt', 4, -7, 0.1, 'Last Crown: bolt leaves the hand.'),
    ('mage_impact', 4, -8, 0.15, 'Magic bolt / orb bursting.'),
    ('mage_nova', 2, -6, 0.3, 'Radial burst / repel / ground wave.'),
    ('mage_teleport', 3, -8, 0.15, 'Blink out / in.'),
    ('mage_beam', 2, -8, 0.4, 'Channelled beam.'),
    ('mage_ward', 2, -8, 0.2, 'Ward forming / shattering, binding.'),
    ('mage_rune', 3, -8, 0.2, 'Rune circle erupting (bombardment).'),
    ('crown_resonance', 2, -6, 0.8, 'Crownheart resonance: slips, phase breaks.'),
    ('boss_scream', 3, -8, 0.2, 'Last Crown pain / fury cry.'),
    ('boss_death', 1, -5, 0.8, 'Last Crown death.'),
    ('final_collapse', 1, -5, 1.0, 'The Crownheart falls silent (ending).'),
]:
    sound(_id, 'sfx', _gain, _desc, [lambda i=i, _id=_id, _fout=_fout: V(EL + f'{_id}_{i}.mp3', fout=_fout) for i in range(_n)], _EL_SRC)

def main():
    only = set(sys.argv[1:])
    manifest = {'_generatedBy': 'tools/build_audio.py', 'sounds': {}}
    old = {}
    if only and os.path.exists(MANIFEST):
        old = json.load(open(MANIFEST))['sounds']
    for id, d in BANK.items():
        if only and id not in only:
            if id in old:
                manifest['sounds'][id] = old[id]
            continue
        files, durs = [], []
        for i, fn in enumerate(d['variants']):
            x = fn()
            name = id if len(d['variants']) == 1 else f'{id}_{i}'
            url, dur = write(name, x, quality=3 if d['bus'] == 'amb' and d['loop'] else 4)
            files.append(url)
            durs.append(round(dur, 3))
        manifest['sounds'][id] = {'bus': d['bus'], 'gain': d['gain'], 'loop': d['loop'], 'files': files, 'durations': durs,
                                  'use': d['use'], 'sources': d['sources']}
        print(f'{id:14s} {len(files):2d} files  {min(durs):.2f}-{max(durs):.2f}s')
    json.dump(manifest, open(MANIFEST, 'w'), indent=1)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('AUDIO BUILD OK', len(manifest['sounds']), 'sounds,', round(total / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
