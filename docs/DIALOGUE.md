# DIALOGUE.md — the heroine's voice (session 7)

Authoritative plan for every spoken line of THE CASTLE REMEMBERS. The line data lives in
`src/data/dialogue.json` (id, subtitle text, TTS text with audio tags, category, trigger, floor, priority, pool);
generation is `tools/voice/gen_voice.mjs` (ElevenLabs v3, build time only); playback is `src/audio/Dialogue.ts`.

## 1. Who she is

The Uncrowned is never named in the game. She is a woman of about thirty from the forgotten, unbound branch of
House Vaelor. She grew up outside the old kingdom with fragments: a damaged crest the family kept, a royal name,
her grandmother's stories (the word "Echoes" comes from them), and a warning never to go near Caer Veyr. She
travels, she can fight — the Great Sword is not new to her — and she is used to being alone.

- **Manner:** grounded, observant, stubborn. Short sentences. She talks to herself the way people alone in a
  dangerous place do: rarely, under her breath, mostly when something surprises her.
- **Humour:** dry and small ("Sealed again. Of course.", "Grandmother, you undersold this place."). Never jokes
  about the dead, never winks at the player, no modern idiom.
- **What she never does:** narrate the obvious ("I should go through this door"), explain mechanics in game
  terms, repeat the objective text, or talk over fights.

## 2. Arc — what she knows, and what she must not know yet

| Floor | Feeling | She knows | She learns | She must NOT know yet |
|---|---|---|---|---|
| Opening (film) | wonder, doubt | her blood came from Caer Veyr; the gate was whole for one heartbeat | — | everything below |
| **1 · Inheritance** | curiosity → unease | family fragments, "Echoes", the last king's name | the keep was sealed *from the inside*; guards fought guards; the king's tomb is empty; the king dug toward a light → *"whatever broke this castle came from inside it"* | that Aldren planned it; the Queen; why seals reject her |
| **2 · Complicity** | suspicion → anger | the castle turned on its own people | orders to seal people in were paperwork; wardens who refused were executed; **the Queen smuggled an unmarked girl out (her line — "Unmarked. Like me.")**; Aldren's own plan ("every stone, every soul") | that Aldren still exists; what he wants from her |
| **3 · The Crown** | understanding → resolve | her family did this; she was spared on purpose | the Crown was built for a king who would "keep Veyr forever"; the Last Crown wears the Queen's face and wants her blood | — |

Her attitude to House Vaelor turns from *inheritance* (F1: "the crest we kept") to *complicity* (F2: "my own
blood did this") to *refusal* (F3: "You won't have it." — "The castle can forget now").

## 3. Categories (101 lines, `dialogue.json`)

| Category | Lines | Trigger | Priority |
|---|---|---|---|
| onboarding | 7 | objective start, first Echo fight, first kill, first sigil (near / rite), first shift, first Past fight | 5 / 4 |
| hint (stuck / denied) | 23 | objective stuck timer (never in combat), shift denied (no resonance / stone / no footing) | 4 |
| discovery | 19 | Interact on a Memory Trace (every trace on all three floors has a line) | 5 (story) / 2 |
| story | 5 | Floor 2 arrival, Floor 3 arrival, the Crown doors; the floor rewards (session 8): `ab_crownbreaker` on Floor 2, `ab_whirlwind` on Floor 3, said with the unlock reveal (`Game.announceAbilities`) | 5 |
| boss | 8 | Gate Warden, Kingsguard Captain, Last Crown: intro / phases / death | 5 |
| combat | 13 | fight start (pool), big fight, archers, a heavy foe, execution (pool), low health (pool), fight cleared (pool) | 3 / 2 |
| checkpoint | 6 | first activation of each sigil (pool, floor-flavoured) | 2 |
| shift | 7 | later shifts (pool, 35 %), a shift that lands in a fight | 2 / 3 |
| flavour | 2 | the breach, a sealed door on Floor 2 | 2 |
| idle | 11 | long genuine inactivity (floor-flavoured) | 1 |

Line-by-line text: `src/data/dialogue.json` (subtitle = `text`, performance = `tts`).

## 4. Trigger quality rules (implemented in `Dialogue.ts`)

- **One voice at a time.** Priority 5 story/boss/discovery · 4 tutorial/objective/hint · 3 combat · 2 flavour ·
  1 idle. A new line interrupts the current one only if the current one is ≤ 2 and the new one is higher (the old
  line fades out over 0.15 s). Otherwise a line of priority ≥ 3 waits in a queue (max 2, expires after 6 s);
  lower lines are dropped.
- **Breathing room:** ≥ 2.5 s of silence between lines (story lines excepted); ≥ 25 s between two combat barks.
  Queued tutorial/story lines wait up to 14 s for their turn, combat barks 5 s.
- **Once-only:** onboarding, story, boss, discovery and hint lines play once per run (a trace re-examined shows
  its text again but she does not repeat herself).
- **Pools** (a random line, never the same twice running, each line once before any repeats): checkpoint
  20 s, shift 100 s + 35 % chance, fight start 100 s + 35 %, fight cleared 130 s + 35 %, low health 90 s,
  execution 110 s + 35 %, idle 150 s; "Archers!" at most every 4 min, "Too many of them" every 5 min.
  (Tuned after a bot run said 22 lines in 6 minutes, half of them combat barks.)
- **Combat** barks never interrupt story; fight-start barks are skipped when a story/boss line fired in the last
  6 s (boss intros already speak).
- **Idle** needs all of: no combat, no line in the last 45 s, no hint pending, and the player has genuinely done
  nothing (no movement > 0.5 m, no attack, no camera input) for 30 s. Each idle line plays at most once per run.
- **Hints** fire from the objective's stuck timer, which only runs outside combat; each objective's hint plays
  once. A shift denial explains itself once per reason.
- **Subtitles** always show while she speaks (top of the portrait frame, under the HUD).
- Automation (`?mute`, autopilot, webdriver) never loads or plays voice.

## 5. Voice and generation (ElevenLabs, build time only)

- Model **Eleven v3** (`eleven_v3`), audio tags used sparingly (33 of 99 lines, at most two per line; most lines
  are directed by punctuation — ellipses for hesitation, full stops for weight).
- Names are pronounced through the `pronounce` map (Caer Veyr → "Kair Vair", Vaelor → "Vaylor"), matching the
  opening film's narrator.
- Budget: the account is on the free tier (10,000 credits/month; 7,041 left when this plan was written). The 99
  lines are 4,653 characters of TTS text; auditions ≈ 600; the rest is kept for retakes.
- Casting, settings and QA results: §7 (filled in after the auditions).

## 6. Streaming / memory (implemented in `Dialogue.ts` + `GameAssets`)

- Each line is a small mono OGG (`public/assets/voice/<id>.ogg`) listed in `src/data/voiceManifest.json` with its
  byte size and duration. Asset keys `vo:<id>`.
- Lines are decoded at **22.05 kHz** (an `OfflineAudioContext` resamples; the voice band needs no more), about
  90 KB of PCM per second of speech — a third of the game's usual 44.1 kHz stereo cost.
- **Loading-screen set** (scope `floorN`): the floor's onboarding/arrival lines, its boss lines, and the shared
  combat/hint barks that can fire at any moment.
- **Prefetch** (scope `voN`): every other line of the floor carries an anchor (the trace, sigil or objective
  position it belongs to); lines anchored within 40 m of the hero are fetched in the background (checked once a
  second), so the audio is resident before the interaction press. A line that is somehow not resident yet when
  triggered still plays when it arrives if that is within 1.2 s, otherwise it shows as a subtitle only.
- Leaving a floor releases both scopes; shared barks stay (scope `core-vo`).

## 7. Casting, settings, QA (done session 7)

**Auditions** (`tools/voice/audition.mjs`, same 148-character script — quiet awe, a dry aside, tension, anger —
v3, stability 0.5, seed 7; analysis `tools/voice/analyze.py`; files `assets/audio/voice/auditions/`):

| Voice (premade) | F0 median | Range | Quiet → angry | Rate | Verdict |
|---|---|---|---|---|---|
| **Lily** (British, velvety) | 172 Hz | 10.6 st | **+4.0 st, +9.3 dB** | 8.3 ch/s | **chosen**: warm mid-low register, follows the tags, deliberate |
| Alice (British, clear) | 188 Hz | 8.7 st | −0.5 st, +0.7 dB | 9.9 ch/s | flat — the tags barely land |
| Matilda (American alto) | 188 Hz | 9.9 st | +1.3 st, +6.2 dB | 10.5 ch/s | fine, but no sigh, quicker, American |
| Sarah (American, young) | 184 Hz | 6.6 st | +1.3 st, +3.6 dB | 9.0 ch/s | narrowest range |

All four transcribed word-perfect with no tag read aloud. Library/community voices return 402 through the API on
this tier, voice design 403, so the cast is the account's premade voices (the opening film's narrator is a
different, older designed voice — the two never sound alike).

**Settings:** `eleven_v3`, voice Lily (`pFZP5JQG7iQjIQuC4Bku`), stability 0.5 (Natural), similarity 0.75, seed 7,
mp3 44.1 kHz 128 kbps. Lines are requested in 18 batches of one emotional register each (≤ 330 characters:
story, hints, discoveries, combat, bosses, calm) — v3 is steadier on a few sentences than on a two-word bark —
and cut apart with the returned character timestamps (`tools/voice/build_voice.py`: boundaries in the pauses,
breath/sigh openings kept, silence trimmed, speech RMS −19 dBFS, peaks < −1.5 dBFS, 22.05 kHz mono Vorbis q3).

**QA** (`tools/voice/qa_voice.mjs`, Scribe on every cut line): 99/99 lines say their script with no tag spoken and
nothing from a neighbouring line (one flag is the homophone "rite"/"right"). Consistency: median F0 181 Hz, 80 % of
lines within 158–211 Hz. Two first-batch discovery lines came out high and alarmed (≈ 260 Hz, peaks 380 Hz);
they were re-directed ([uneasy], [quietly]) and regenerated alone — now 180 / 164 Hz. (`tr_orders`: Scribe hears
"who are they" for "who were they" — a reduced vowel; kept.)

**Output:** 99 lines, 388 s of speech, 2.2 MB of OGG (`public/assets/voice/`, manifest `src/data/voiceManifest.json`).
**Credits:** auditions ≈ 640, lines ≈ 4,850, retakes ≈ 120 → about 1,150 left of 10,000 this month.

**Session 8 additions:** `ab_crownbreaker` ("My blade's heavier. As if the keep is lending me its weight.") and
`ab_whirlwind` ("The castle turns when I turn now. I'll use that.") — same voice and settings (Lily, eleven_v3,
stability 0.5, similarity 0.75, seed 7), one 139-character request → batch `ability_0` (4.6 s / 4.4 s). Account after:
8,983 / 10,000 used. Not yet run through Scribe QA or heard by a human. Note: `gen_voice.mjs` now never reuses an
existing batch name (the first run of this session wrote over `story_0`; restored from git), and `build_voice.py`
re-encodes every OGG with byte-level differences — commit only the new files.

**Regenerating:** edit `dialogue.json`, then `node tools/voice/gen_voice.mjs` (only lines whose TTS text changed),
or `--redo id1,id2` for single takes; `python tools/voice/build_voice.py`; `node tools/voice/qa_voice.mjs`.
