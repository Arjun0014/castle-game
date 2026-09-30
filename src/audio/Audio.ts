import * as THREE from 'three';
import type { TimeState } from '../levels/Materials';
import manifest from '../data/audioManifest.json';
import { Music } from './Music';

/**
 * Sample-based audio (CC0 recordings processed by tools/build_audio.py → public/assets/audio, listed in
 * src/data/audioManifest.json; provenance in assets/audio/SOURCES.md).
 * - one-shots: random variant (never the same twice in a row), pitch jitter, optional 3D position
 * - buses: sfx / amb → master → compressor → destination
 * - ambience beds (loops) crossfade by time state and context (open sky, flames nearby, underground)
 */
type SoundId = keyof typeof manifest.sounds;
interface SoundDef { bus: string; gain: number; loop: boolean; files: string[] }
export interface PlayOpts { pos?: THREE.Vector3; vol?: number; rate?: number; jitter?: number; delay?: number }
export interface AmbientContext { state: TimeState; openSky: number; fire: number; underground: number; inCombat: boolean }

const DEFS = manifest.sounds as unknown as Record<SoundId, SoundDef>;
const MAX_VOICES = 40;
const PER_SOUND = 5;
const BEDS: SoundId[] = ['amb_present', 'amb_wind', 'amb_drips', 'amb_fire', 'amb_past'];

export class AudioFX {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses: Record<string, GainNode> = {};
  private buffers = new Map<SoundId, AudioBuffer[]>();
  private lastVariant = new Map<SoundId, number>();
  private voices: { id: SoundId; src: AudioBufferSourceNode; end: number }[] = [];
  private beds = new Map<SoundId, { src: AudioBufferSourceNode; gain: GainNode; aim?: number }>();
  private channel: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private oneShotT = 6;
  enabled = true;
  loaded = false;
  volume = 0.9;
  /**
   * Automation mute (autopilot / Claude tests / `?mute`): master silent and the ambience beds are never even
   * loaded. Normal play is NOT muted — players hear the full mix including the ambience beds.
   */
  muted = false;
  /** Background ambience (beds + random Present one-shots). On in normal play; off only in automation mute. */
  get ambienceEnabled() { return !this.muted; }

  constructor(opts: { muted?: boolean } = {}) {
    this.muted = !!opts.muted;
  }

  /** Create the context (suspended until a user gesture). Samples are decoded by the AssetManager (snd:* keys). */
  createContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      this.enabled = false;
      return null;
    }
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(comp).connect(ctx.destination);
    for (const b of ['sfx', 'amb']) { const g = ctx.createGain(); g.connect(this.master); this.buses[b] = g; }
    this.buses.amb.gain.value = 0.8 * this.lv.music;
    this.buses.sfx.gain.value = this.lv.sfx;
    return ctx;
  }

  /**
   * The heroine's voice: a dry, centred bus straight into the master. While she speaks, the ambience and the
   * effects dip a little so the line reads (duck).
   */
  voiceOut(): AudioNode | null {
    if (!this.ctx) return null;
    if (!this.buses.voice) { const g = this.ctx.createGain(); g.gain.value = 1.05 * this.lv.voice; g.connect(this.master); this.buses.voice = g; }
    return this.buses.voice;
  }
  duck(on: boolean) {
    this.ducked = on;
    this.music?.duck(on);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.buses.amb.gain.setTargetAtTime(0.8 * this.lv.music * (on ? 0.5 : 1), t, on ? 0.08 : 0.4);
    this.buses.sfx.gain.setTargetAtTime(this.lv.sfx * (on ? 0.78 : 1), t, on ? 0.08 : 0.4);
  }

  /** Settings (menu → Settings): multipliers on the tuned bus levels, 1 = as mixed (`music` = the ambience beds, `score` = the music). */
  private lv = { master: 1, music: 1, sfx: 1, voice: 1, score: 1 };
  private ducked = false;
  setLevels(l: { master: number; music: number; sfx: number; voice: number; score: number }) {
    this.lv = { master: l.master, music: l.music, sfx: l.sfx, voice: l.voice, score: l.score };
    this.volume = 0.9 * l.master;
    this.music?.setLevel(l.score);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.05);
    this.buses.amb.gain.setTargetAtTime(0.8 * l.music * (this.ducked ? 0.5 : 1), t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(l.sfx * (this.ducked ? 0.78 : 1), t, 0.05);
    this.buses.voice?.gain.setTargetAtTime(1.05 * l.voice, t, 0.05);
  }
  /** A menu sound (title screen / pause menu): a dry one-shot on the effects bus, no position. */
  ui(kind: 'move' | 'select' | 'back') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (kind === 'move') this.play('blade_ring' as SoundId, { vol: 0.16, rate: 1.9, jitter: 0.04 });
    else if (kind === 'select') { this.play('blade_ring' as SoundId, { vol: 0.34, rate: 1.25 }); this.play('resonance' as SoundId, { vol: 0.18, rate: 0.8 }); }
    else this.play('swing' as SoundId, { vol: 0.2, rate: 0.8 });
  }

  /** The adaptive score (audio/Music.ts): null in automation mute, and until its files are loaded. */
  music: Music | null = null;
  bindMusic(explore: ArrayBuffer[], combat: AudioBuffer | null) {
    if (!this.ctx || this.music) return;
    this.music = new Music(this.ctx, this.master, explore, combat);
    this.music.setLevel(this.lv.score);
  }
  /** the context is running (sound can be heard: autoplay allowed or a gesture unlocked it) */
  get running() { return this.ctx?.state === 'running'; }

  /** Decoded buffers for a sound id (from the AssetManager). */
  bind(id: string, buffers: AudioBuffer[]) { this.buffers.set(id as SoundId, buffers); this.loaded = true; }
  /** Drop a sound's buffers (its asset was released); stops a bed using it. */
  unbind(id: string) {
    const bed = this.beds.get(id as SoundId);
    if (bed) { try { bed.src.stop(); } catch { /* stopped */ } this.beds.delete(id as SoundId); }
    this.buffers.delete(id as SoundId);
  }
  isBound(id: string) { return this.buffers.has(id as SoundId); }

  /** Runtime mute toggle (M key). Unmuting mid-game also loads nothing: beds start only if already decoded. */
  setMuted(on: boolean) {
    this.muted = on;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? 0 : this.volume, this.ctx.currentTime, 0.05);
    if (!on) this.startBeds();
  }

  /** Stop every one-shot (floor transitions). Ambience beds keep playing. */
  stopVoices() {
    for (const v of this.voices) { try { v.src.stop(); } catch { /* done */ } }
    this.voices = [];
    this.channelStop();
  }

  /** Unlock the context inside a user gesture without starting any sound (the opening film plays first). */
  unlock() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** Resume on the first user gesture and start the ambience beds. */
  init() {
    if (!this.ctx || !this.loaded) return;
    void this.ctx.resume();
    this.startBeds();
    this.music?.start();
  }

  private startBeds() {
    if (!this.ambienceEnabled || !this.ctx) return;
    for (const id of BEDS) if (!this.beds.has(id) && this.buffers.has(id)) this.startBed(id);
  }

  private startBed(id: SoundId) {
    const ctx = this.ctx!;
    const buf = this.buffers.get(id)![0];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.buses.amb);
    src.start(0, Math.random() * buf.duration);
    this.beds.set(id, { src, gain });
  }

  private pick(id: SoundId) {
    const list = this.buffers.get(id);
    if (!list || !list.length) throw new Error('Unknown or unloaded sound ' + id);
    if (list.length === 1) return list[0];
    const last = this.lastVariant.get(id) ?? -1;
    let i = Math.floor(Math.random() * list.length);
    if (i === last) i = (i + 1) % list.length;
    this.lastVariant.set(id, i);
    return list[i];
  }

  /** Play a one-shot. Returns the source (for cancellable sounds) or null when culled. */
  play(id: SoundId, o: PlayOpts = {}): AudioBufferSourceNode | null {
    if (!this.ctx || !this.loaded || this.ctx.state !== 'running') return null;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= MAX_VOICES) return null;
    const same = this.voices.filter((v) => v.id === id);
    if (same.length >= PER_SOUND) { try { same[0].src.stop(); } catch { /* already stopped */ } }
    const def = DEFS[id];
    const src = ctx.createBufferSource();
    src.buffer = this.pick(id);
    const rate = (o.rate ?? 1) * (1 + ((Math.random() * 2 - 1) * (o.jitter ?? 0.06)));
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = Math.pow(10, def.gain / 20) * (o.vol ?? 1);
    let tail: AudioNode = g;
    if (o.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 3;
      p.rolloffFactor = 1.15;
      p.maxDistance = 70;
      p.positionX.value = o.pos.x; p.positionY.value = o.pos.y; p.positionZ.value = o.pos.z;
      g.connect(p);
      tail = p;
    }
    src.connect(g);
    tail.connect(this.buses[def.bus] ?? this.buses.sfx);
    const t0 = now + (o.delay ?? 0);
    src.start(t0);
    this.voices.push({ id, src, end: t0 + src.buffer!.duration / rate + 0.05 });
    return src;
  }

  /** Listener follows the camera (automation is scheduled only when the camera has actually moved or turned). */
  private lastListener = { p: new THREE.Vector3(1e9, 0, 0), f: new THREE.Vector3() };
  setListener(cam: THREE.Camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const f = cam.getWorldDirection(_f);
    const last = this.lastListener;
    if (last.p.distanceToSquared(cam.position) < 1e-4 && last.f.dot(f) > 0.99998) return;
    last.p.copy(cam.position); last.f.copy(f);
    const u = _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(cam.position.x, t, 0.02); l.positionY.setTargetAtTime(cam.position.y, t, 0.02); l.positionZ.setTargetAtTime(cam.position.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02); l.forwardY.setTargetAtTime(f.y, t, 0.02); l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.setTargetAtTime(u.x, t, 0.02); l.upY.setTargetAtTime(u.y, t, 0.02); l.upZ.setTargetAtTime(u.z, t, 0.02);
    } else {
      l.setPosition(cam.position.x, cam.position.y, cam.position.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  // ------------------------------------------------------------------ gameplay vocabulary
  swing(weight: number, pos?: THREE.Vector3, vol = 1) {
    // weight 0 (light) … 1 (heavy): heavier swings are slower and deeper
    this.play('swing', { pos, rate: 1.18 - weight * 0.42, vol, jitter: 0.07 });
    if (weight > 0.45) this.play('blade_ring', { pos, rate: 1.05 - weight * 0.2, vol: vol * (0.6 + weight * 0.4) });
  }
  /**
   * Sword connects. Layers: the cut (slice), the body (flesh / plate), and for heavy blows a low body-blow
   * thump; `weight` 0 (light) .. 1 (heavy/finisher) lowers the pitch and raises the low end. Every layer is
   * pitch-jittered so a combo of identical swings never sounds like one sample repeated.
   */
  hitEnemy(kind: 'flesh' | 'armor' | 'spirit' | 'blocked', dmg: number, pos: THREE.Vector3, weight = Math.min(1, dmg / 40)) {
    const w = weight;
    if (kind === 'blocked') {
      this.play('clash', { pos, rate: 1.02 - w * 0.12, jitter: 0.06 });
      this.play('hit_armor', { pos, vol: 0.55, rate: 0.9, jitter: 0.06 });
      this.play('shield_block', { pos, vol: 0.5, rate: 0.95, jitter: 0.05 });
      return;
    }
    if (kind === 'spirit') {
      this.play('hit_slice', { pos, rate: 0.82 - w * 0.1, jitter: 0.08 });
      this.play('hit_flesh', { pos, vol: 0.35, rate: 1.3, jitter: 0.08 });
      return;
    }
    if (kind === 'armor') {
      this.play('hit_armor', { pos, rate: 1.08 - w * 0.25, jitter: 0.07 });
      this.play('hit_flesh', { pos, vol: 0.45 + w * 0.3, rate: 1.05 - w * 0.15, jitter: 0.08 });
      if (w < 0.5) this.play('blade_ring', { pos, vol: 0.22, rate: 1.25, jitter: 0.1 });
    } else {
      this.play('hit_flesh', { pos, rate: 1.08 - w * 0.25, jitter: 0.08 });
      this.play('hit_slice', { pos, vol: 0.7 + w * 0.3, rate: 1.06 - w * 0.14, jitter: 0.08 });
    }
    if (w > 0.5) this.play('kill_impact', { pos, vol: 0.25 + (w - 0.5) * 0.7, rate: 1.12 - w * 0.2, jitter: 0.05 });
  }
  kickHit(pos: THREE.Vector3) { this.play('kick_hit', { pos }); }
  block(parry: boolean) { this.play(parry ? 'parry' : 'shield_block'); }
  hurt() { this.play('player_hurt'); }
  footstep(state: TimeState, speed: number, crouch: boolean) {
    const vol = (crouch ? 0.45 : 1) * THREE.MathUtils.clamp(0.55 + speed / 9, 0.55, 1.2);
    if (state === 'PAST') this.play('step_stone', { vol, jitter: 0.08 });
    else { this.play('step_ruin', { vol, jitter: 0.08 }); if (Math.random() < 0.55) this.play('step_grit', { vol: vol * 0.8 }); }
  }
  jump() { this.play('jump'); }
  land(fall: number) { if (fall > 2.2) this.play('land_heavy', { vol: Math.min(1.3, 0.7 + fall / 8) }); else this.play('land'); }
  dodge() { this.play('dodge'); }
  enemyStep(pos: THREE.Vector3, heavy: boolean) { this.play('enemy_step', { pos, rate: heavy ? 0.85 : 1.05, vol: heavy ? 1 : 0.7 }); }
  arrowLoose(pos: THREE.Vector3) { this.play('bow_release', { pos }); }
  arrowHit(pos: THREE.Vector3) { this.play('arrow_hit', { pos }); }
  release(pos?: THREE.Vector3) { this.play('resonance', { pos, jitter: 0.03 }); }
  deny() { this.play('shift_deny'); }
  death() { this.play('player_death'); }
  bossSting() { this.play('boss_sting'); }
  sigil() { this.play('sigil'); }
  memory() { this.play('memory'); }
  hatchSlam(pos: THREE.Vector3) { this.play('hatch_slam', { pos }); }

  channelStart() {
    this.channelStop();
    if (!this.ctx) return;
    const src = this.play('shift_charge', { jitter: 0 });
    if (!src) return;
    // route through a dedicated gain so a cancelled channel can fade out
    const gain = this.ctx.createGain();
    src.disconnect();
    const def = DEFS.shift_charge;
    gain.gain.value = Math.pow(10, def.gain / 20);
    src.connect(gain).connect(this.buses.sfx);
    this.channel = { src, gain };
  }
  channelStop() {
    if (!this.channel || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.channel.gain.gain.cancelScheduledValues(t);
    this.channel.gain.gain.setTargetAtTime(0.0001, t, 0.06);
    const s = this.channel.src;
    setTimeout(() => { try { s.stop(); } catch { /* done */ } }, 400);
    this.channel = null;
  }
  /** The channel completed: let the charge ring out, then the boom. */
  shiftBoom(to: TimeState) {
    this.channel = null;
    this.play('shift_boom', { jitter: 0, rate: to === 'PAST' ? 1.04 : 0.96 });
  }

  // ------------------------------------------------------------------ ambience
  update(dt: number, amb: AmbientContext, listener: THREE.Vector3) {
    if (this.music && this.ctx?.state === 'running') this.music.update(amb.inCombat);
    if (!this.ambienceEnabled || !this.ctx || !this.beds.size || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const P = amb.state === 'PRESENT';
    const duck = amb.inCombat ? 0.75 : 1;
    const target: Partial<Record<SoundId, number>> = {
      amb_present: P ? 1 * duck : 0,
      amb_wind: (P ? 0.25 + 0.75 * amb.openSky : 0.2 * amb.openSky) * duck,
      // distant water under the floors: fades in with depth, steps back in a fight (it used to drown the mix)
      amb_drips: (P ? 1 : 0.4) * amb.underground * duck,
      amb_fire: P ? 0 : 0.18 + 0.82 * amb.fire,
      amb_past: P ? 0 : 1 * duck,
    };
    for (const [id, bed] of this.beds) {
      const g = (target[id] ?? 0) * Math.pow(10, DEFS[id].gain / 20);
      // re-aim the fade only when the mix wants something new (not five automation events every frame)
      if (Math.abs(g - (bed.aim ?? -1)) < 0.002) continue;
      bed.aim = g;
      bed.gain.gain.setTargetAtTime(g, t, 0.6);
    }
    // sparse Present one-shots around the listener: settling rubble, creaking timber, a far-off Echo, thunder
    if (P) {
      this.oneShotT -= dt;
      if (this.oneShotT <= 0) {
        this.oneShotT = 5 + Math.random() * 9;
        const r = Math.random();
        const id: SoundId = r < 0.4 ? 'rubble' : r < 0.68 ? 'creak' : r < 0.9 ? 'distant_moan' : 'thunder';
        const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 14;
        const pos = id === 'thunder' ? undefined : new THREE.Vector3(listener.x + Math.cos(a) * d, listener.y + 2 + Math.random() * 4, listener.z + Math.sin(a) * d);
        this.play(id, { pos, jitter: 0.1 });
      }
    }
  }
}

const _f = new THREE.Vector3();
const _u = new THREE.Vector3();
