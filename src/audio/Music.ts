import manifest from '../data/musicManifest.json';

/**
 * The adaptive score (session 13): "The Last Canopy Sleeps" while she explores, "Savage Ritual" while she fights.
 *
 * - EXPLORATION streams from short Ogg Opus segments (tools/build_music.py): only the piece playing and the next one
 *   are decoded (~12 MB instead of ~46 MB of PCM for the whole track), scheduled back to back on the audio clock, their
 *   shared overlap crossfaded. It loops across the silence the track itself fades into (116 s) and out of (1 s).
 * - COMBAT is one decoded buffer looping sample-accurately over its main section (after the 13 s intro, before the
 *   closing hit), so a long fight never hears the ending.
 * - When a fight begins the exploration score fades out and its position is REMEMBERED; when calm returns the combat
 *   score fades out from its next phrase boundary while the exploration score fades back in from where it stopped —
 *   no restart from the top, no hard cut. A fight that flares up again soon after resumes the combat cue from its next
 *   phrase instead of replaying the intro.
 * - Her voice ducks the score (AudioFX.duck); the pause menu lowers it.
 * Everything runs on AudioContext time: no per-frame automation, no decoding on the main thread, nothing decoded late.
 */

// Savage Ritual (measured, session 13): 180.0 BPM, first beat at 0.0116 s, beat 1 of every 8 the strongest.
const BEAT0 = 0.0116;
const PHRASE = (8 * 60) / 180;           // 2.667 s — combat entries and exits land on these boundaries
const LOOP_A = BEAT0 + 5 * PHRASE;       // 13.345 s: the full kit enters after the intro
const LOOP_B = BEAT0 + 21 * PHRASE;      // 56.012 s: just before the closing hit and its decay
// The Last Canopy Sleeps fades in out of silence at 1.1 s and back into it by 116.2 s: it loops across that silence
const CANOPY_A = 1.05;
const CANOPY_B = 116.1;

/**
 * Mix levels (linear, before the master and its compressor). Supplied masters measure −22.7 LUFS (exploration) and
 * −13.7 LUFS (combat): ≈ −24.4 and −21.2 LUFS here, under the blows, the voice and the ambience beds.
 */
export const MUSIC_LEVEL = { explore: 0.82, combat: 0.42 };
/** seconds of fighting before the combat cue, seconds of calm before it hands back */
const ENTER_AFTER = 0.35;
const CALM_AFTER = 3.0;
/** a fight within this many seconds of the last continues its cue from the next phrase instead of the intro */
const RESUME_WINDOW = 30;

interface Seg { url: string; start: number; length: number; bytes: number }
const SEGS = manifest.explore.segments as Seg[];
const OVERLAP = manifest.explore.overlap;

export type MusicMode = 'off' | 'explore' | 'combat' | 'leaving';

/** The exploration track as a stream of decoded segments on the audio clock. */
class SegmentStream {
  /** track position P plays at audio time T (the current run; a loop starts a new run) */
  private run: { T: number; P: number } | null = null;
  private nextIdx = 0;
  private nextAt = 0;
  private loopAt = Infinity;
  private decoded = new Map<number, AudioBuffer>();
  private decoding = new Map<number, Promise<AudioBuffer>>();
  private sources: { src: AudioBufferSourceNode; gain: GainNode; end: number; idx: number }[] = [];
  /** bumps on every start/stop: a decode that lands after a stop is dropped */
  private gen = 0;
  out: GainNode;

  constructor(private ctx: AudioContext, private bytes: ArrayBuffer[], dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
  }

  get playing() { return !!this.run; }

  /** track position at audio time t (null when stopped) */
  position(t: number): number | null {
    if (!this.run) return null;
    const p = this.run.P + (t - this.run.T);
    return p >= CANOPY_B ? CANOPY_A + (p - CANOPY_B) : Math.max(this.run.P, p);
  }

  private decode(i: number): Promise<AudioBuffer> {
    const have = this.decoded.get(i);
    if (have) return Promise.resolve(have);
    let p = this.decoding.get(i);
    if (!p) {
      // decodeAudioData runs off the main thread; it detaches its input, so it gets a copy
      p = this.ctx.decodeAudioData(this.bytes[i].slice(0)).then((b) => { this.decoded.set(i, b); this.decoding.delete(i); return b; });
      p.catch((err) => { this.decoding.delete(i); console.error(`[music] exploration segment ${i} failed to decode:`, err); });
      this.decoding.set(i, p);
    }
    return p;
  }

  /** Start playing from track position `from` (as soon as its segment is decoded, never earlier than `at`). */
  async start(at: number, from: number) {
    this.stopNow();
    const gen = ++this.gen;
    from = Math.min(Math.max(from, CANOPY_A), CANOPY_B - 0.5);
    const i = Math.min(SEGS.length - 1, Math.floor(from / manifest.explore.segment));
    const buf = await this.decode(i);
    if (gen !== this.gen) return;
    const T = Math.max(at, this.ctx.currentTime + 0.03);
    this.run = { T, P: from };
    this.loopAt = T + (CANOPY_B - from);
    this.schedule(i, buf, T, from - SEGS[i].start, false);
    this.nextIdx = i + 1;
    this.nextAt = T + ((SEGS[i + 1]?.start ?? Infinity) - from);
  }

  /** one segment on the clock; `xfade` = crossfade in over the overlap with the one before */
  private schedule(i: number, buf: AudioBuffer, at: number, offset: number, xfade: boolean) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    src.connect(gain).connect(this.out);
    if (xfade) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + OVERLAP);
      // the one before fades out over the same shared samples (equal gain: identical audio sums to itself)
      const prev = this.sources[this.sources.length - 1];
      if (prev) { prev.gain.gain.setValueAtTime(1, at); prev.gain.gain.linearRampToValueAtTime(0, at + OVERLAP); }
    }
    src.start(at, Math.max(0, offset));
    const end = at + buf.duration - offset;
    this.sources.push({ src, gain, end, idx: i });
  }

  /** look-ahead: decode the next segment early, put it on the clock a moment before it is due, wrap at the loop */
  tick(now: number) {
    if (!this.run) return;
    // the loop: the track has faded into silence — the next run starts from the silence before its opening
    if (now > this.loopAt - 8) void this.decode(0);
    if (now > this.loopAt - 1.2 && this.decoded.has(0)) {
      const at = this.loopAt;
      for (const s of this.sources) { try { s.src.stop(at + 0.05); } catch { /* already stopping */ } }
      this.run = { T: at, P: CANOPY_A };
      this.loopAt = at + (CANOPY_B - CANOPY_A);
      this.schedule(0, this.decoded.get(0)!, at, CANOPY_A - SEGS[0].start, false);
      this.nextIdx = 1;
      this.nextAt = at + (SEGS[1].start - CANOPY_A);
    }
    const i = this.nextIdx;
    if (i < SEGS.length && SEGS[i].start < CANOPY_B && this.nextAt < this.loopAt) {
      if (now > this.nextAt - 8) void this.decode(i);
      const buf = this.decoded.get(i);
      if (buf && now > this.nextAt - 1.2) {
        // (a segment that decoded late joins where the track has got to, rather than never)
        const late = Math.max(0, now + 0.03 - this.nextAt);
        this.schedule(i, buf, this.nextAt + late, late, late === 0);
        this.nextIdx = i + 1;
        this.nextAt += (SEGS[i + 1]?.start ?? Infinity) - SEGS[i].start;
      }
    }
    // finished segments release their decoded audio (only the playing one and the next stay resident)
    this.sources = this.sources.filter((s) => {
      if (s.end > now - 0.1) return true;
      s.src.disconnect(); s.gain.disconnect();
      if (s.idx !== this.nextIdx && !(s.idx === 0 && now > this.loopAt - 8)) this.decoded.delete(s.idx);
      return false;
    });
  }

  /** stop every source now (the output is expected to be silent) */
  stopNow() {
    this.gen++;
    for (const s of this.sources) { try { s.src.stop(); } catch { /* not started */ } s.src.disconnect(); s.gain.disconnect(); }
    this.sources = [];
    this.run = null;
    this.loopAt = Infinity;
    this.decoded.clear();
  }

  /** decoded PCM bytes resident right now (tests / memory report) */
  residentBytes() { let n = 0; for (const b of this.decoded.values()) n += b.length * b.numberOfChannels * 4; return n; }
}

export class Music {
  mode: MusicMode = 'off';
  /** the bus: level × settings, the voice duck, the pause dip */
  readonly bus: GainNode;
  private duckGain: GainNode;
  private explore: SegmentStream;
  private combatGain: GainNode;
  private combatBuf: AudioBuffer;
  private combatSrc: { src: AudioBufferSourceNode; t0: number; offset: number } | null = null;
  /** where the exploration score was when it last stopped (resumed from here) */
  exploreAt = CANOPY_A;
  private heat = 0;
  private calm = 0;
  private lastT = 0;
  private leaveAt = 0;
  private lastCombatEnd = -1e9;
  private lastCombatPos = 0;
  private level = 1;
  /** transitions for tests: [audio time, what] */
  log: [number, string][] = [];

  constructor(private ctx: AudioContext, dest: AudioNode, exploreBytes: ArrayBuffer[], combat: AudioBuffer) {
    this.bus = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.bus.connect(this.duckGain).connect(dest);
    this.explore = new SegmentStream(ctx, exploreBytes, this.bus);
    this.combatBuf = combat;
    this.combatGain = ctx.createGain();
    this.combatGain.gain.value = 0;
    this.combatGain.connect(this.bus);
    (window as unknown as { __music?: Music }).__music = this;
  }

  private note(what: string) { this.log.push([+this.ctx.currentTime.toFixed(2), what]); if (this.log.length > 60) this.log.shift(); }

  /** settings: the Music slider (1 = as mixed) */
  setLevel(v: number) { this.level = v; this.bus.gain.setTargetAtTime(v * (this.paused ? 0.4 : 1), this.ctx.currentTime, 0.05); }
  private paused = false;
  /** her voice (and any important line): the score steps back ~7 dB, then returns */
  duck(on: boolean) { this.duckGain.gain.setTargetAtTime(on ? 0.45 : 1, this.ctx.currentTime, on ? 0.12 : 0.55); }
  /** the pause menu: quieter, still there */
  setPaused(on: boolean) { this.paused = on; this.bus.gain.setTargetAtTime(this.level * (on ? 0.4 : 1), this.ctx.currentTime, 0.2); }

  // ------------------------------------------------------------------ exploration on / off
  /** Start (or resume) the exploration score: from where it last stopped, rising in over a few seconds. */
  start(fade = 3) {
    if (this.mode !== 'off') return;
    this.mode = 'explore';
    this.heat = this.calm = 0;
    this.fadeInExplore(this.ctx.currentTime, fade, 1.2);
    this.note('explore from ' + this.exploreAt.toFixed(1));
  }
  /** Fade everything out and stop (the opening film, the end). The exploration position is kept. */
  stop(fade = 0.6) {
    if (this.mode === 'off') return;
    const t = this.ctx.currentTime;
    this.fadeOutExplore(t, fade);
    this.fadeOutCombat(t, fade);
    this.mode = 'off';
    this.note('stop');
  }

  private fadeToken = 0;
  private fadeInExplore(at: number, seconds: number, preroll: number) {
    this.fadeToken++;
    const g = this.explore.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(MUSIC_LEVEL.explore, at + seconds);
    // a little before the remembered point, so the fade has music to rise through
    void this.explore.start(at, this.exploreAt - preroll);
  }
  private fadeOutExplore(at: number, seconds: number) {
    const pos = this.explore.position(at);
    if (pos !== null) this.exploreAt = pos;
    const g = this.explore.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + seconds);
    // once silent, release the segments — unless the score was asked back in meanwhile (a newer fade owns it)
    const token = ++this.fadeToken;
    window.setTimeout(() => { if (token === this.fadeToken) this.explore.stopNow(); }, (seconds + 0.15) * 1000);
  }

  // ------------------------------------------------------------------ combat
  private combatPos(t: number) {
    const c = this.combatSrc;
    if (!c) return 0;
    const p = c.offset + (t - c.t0);
    return p < LOOP_B ? p : LOOP_A + ((p - LOOP_A) % (LOOP_B - LOOP_A));
  }
  /** the first phrase boundary at or after track position p (inside the loop) */
  private static nextPhrase(p: number) {
    const b = BEAT0 + Math.ceil((p - BEAT0 - 1e-3) / PHRASE) * PHRASE;
    return b >= LOOP_B - 1e-3 ? LOOP_A : b;
  }

  private enterCombat(t: number) {
    this.mode = 'combat';
    this.fadeOutExplore(t, 1.1);
    // a fresh fight opens with the cue's intro; one that flares up soon after the last continues from its next phrase
    const offset = t - this.lastCombatEnd < RESUME_WINDOW ? Music.nextPhrase(this.lastCombatPos) : 0;
    const src = this.ctx.createBufferSource();
    src.buffer = this.combatBuf;
    src.loop = true;
    src.loopStart = LOOP_A;
    src.loopEnd = LOOP_B;
    src.connect(this.combatGain);
    const at = t + 0.03;
    src.start(at, offset);
    this.combatSrc?.src.stop();
    this.combatSrc = { src, t0: at, offset };
    const g = this.combatGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(MUSIC_LEVEL.combat, at + (offset === 0 ? 0.35 : 0.9));
    this.note(`combat from ${offset.toFixed(2)} (explore kept at ${this.exploreAt.toFixed(1)})`);
  }

  /** calm again: the combat cue ends at its next phrase boundary while the exploration score rises back in */
  private leaveCombat(t: number) {
    const pos = this.combatPos(t);
    let wait = Music.nextPhrase(pos) - pos;
    if (wait < 0) wait += LOOP_B - pos;          // wraps to the loop start
    if (wait < 0.25) wait += PHRASE;            // too close to act on: the phrase after
    const at = t + wait;
    this.leaveAt = at + PHRASE;
    this.mode = 'leaving';
    const g = this.combatGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(0, at + PHRASE);
    this.fadeInExplore(at - 0.4, 4.5, 1.5);
    this.note(`leave combat at +${wait.toFixed(2)} s (phrase), explore from ${this.exploreAt.toFixed(1)}`);
  }

  private fadeOutCombat(t: number, seconds: number) {
    const c = this.combatSrc;
    if (!c) return;
    this.lastCombatPos = this.combatPos(t);
    this.lastCombatEnd = t;
    const g = this.combatGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + seconds);
    try { c.src.stop(t + seconds + 0.05); } catch { /* stopped */ }
    this.combatSrc = null;
  }

  // ------------------------------------------------------------------ per frame
  /** `inCombat`: a live fight is on her (EnemyManager.inCombat). Timing runs on the audio clock, not game time. */
  update(inCombat: boolean) {
    const t = this.ctx.currentTime;
    const dt = Math.min(0.25, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.explore.tick(t);
    if (this.mode === 'off') return;
    if (inCombat) { this.heat += dt; this.calm = 0; } else { this.calm += dt; this.heat = 0; }
    if (this.mode === 'explore' && this.heat >= ENTER_AFTER) this.enterCombat(t);
    else if (this.mode === 'combat' && this.calm >= CALM_AFTER) this.leaveCombat(t);
    else if (this.mode === 'leaving') {
      if (inCombat) {
        // the fight flared up again before the hand-over finished: back to the cue at once
        const g = this.combatGain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(MUSIC_LEVEL.combat, t + 0.4);
        this.mode = 'combat';
        this.fadeOutExplore(t, 0.6);
        this.note('combat resumed during the hand-over');
      } else if (t >= this.leaveAt) {
        this.fadeOutCombat(t, 0.05);
        this.mode = 'explore';
        this.note('explore');
      }
    }
  }

  /** state for tests and the perf overlay */
  debug() {
    const t = this.ctx.currentTime;
    return {
      mode: this.mode, explorePos: this.explore.position(t), exploreKept: +this.exploreAt.toFixed(2),
      combatPos: this.combatSrc ? +this.combatPos(t).toFixed(2) : null,
      exploreGain: +this.explore.out.gain.value.toFixed(3), combatGain: +this.combatGain.gain.value.toFixed(3),
      duck: +this.duckGain.gain.value.toFixed(3), decodedMB: +((this.explore.residentBytes() + this.combatBuf.length * this.combatBuf.numberOfChannels * 4) / 1e6).toFixed(1),
    };
  }
}
