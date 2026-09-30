import * as THREE from 'three';

export const UPPER_BONES = /Spine|Neck|Head|Shoulder|Arm|Hand/;
export const LOWER_BONES = /Hips|UpLeg|Leg|Foot|Toe/;

function filterClip(clip: THREE.AnimationClip, re: RegExp, suffix: string, positionOk: boolean) {
  const tracks = clip.tracks.filter((t) => {
    const bone = t.name.split('.')[0];
    if (!re.test(bone)) return false;
    if (t.name.endsWith('.position') && !positionOk) return false;
    return true;
  });
  return new THREE.AnimationClip(clip.name + suffix, clip.duration, tracks);
}

interface Overlay { action: THREE.AnimationAction; weight: number; target: number; speed: number; id: string; }

/**
 * Layered animation controller around THREE.AnimationMixer.
 * - Base layer: a set of looping clips whose weights are driven every frame (locomotion, crouch, guard).
 *   Base clips may be full-body or masked (".lower" / ".upper") so guarding can combine with walking.
 * - Overlay layer: one-shot clips (attacks, reactions, jumps, channel) that cross-fade over the base.
 * Weights always sum to 1 per bone set so nothing blends toward the bind pose.
 *
 * Base and overlay layers never share an AnimationAction: mixer.clipAction(clip) returns one cached action
 * per clip, so an overlay of a base clip (e.g. the dodge dash on run_fwd) used to overwrite the base weight
 * and then stop() the base loop when it faded out, leaving locomotion with zero animation weight.
 */
export class AnimController {
  mixer: THREE.AnimationMixer;
  clips = new Map<string, THREE.AnimationClip>();
  private overlayClips = new Map<string, THREE.AnimationClip>();
  base = new Map<string, { action: THREE.AnimationAction; weight: number; target: number }>();
  overlays: Overlay[] = [];
  current: Overlay | null = null;
  baseResponse = 12;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[], private loops: Set<string>) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const c of clips) {
      this.clips.set(c.name, c);
      this.clips.set(c.name + '.lower', filterClip(c, LOWER_BONES, '.lower', true));
      this.clips.set(c.name + '.upper', filterClip(c, UPPER_BONES, '.upper', false));
    }
  }

  has(id: string) { return this.clips.has(id); }

  /** Extra clips on the same rig (the title screen's pack, hero_menu.glb): full-body only, no masked variants. */
  addClips(clips: THREE.AnimationClip[]) {
    for (const c of clips) if (!this.clips.has(c.name)) this.clips.set(c.name, c);
  }

  /** Drop clips added with addClips (their actions are stopped and uncached; the tracks are garbage-collected). */
  removeClips(ids: string[]) {
    for (const id of ids) {
      const c = this.clips.get(id);
      if (!c) continue;
      const ov = this.overlayClips.get(id);
      this.overlays = this.overlays.filter((o) => {
        if (o.id !== id) return true;
        o.action.stop();
        return false;
      });
      if (this.current?.id === id) this.current = null;
      const b = this.base.get(id);
      if (b) { b.action.stop(); this.base.delete(id); }
      if (ov) { this.mixer.uncacheClip(ov); this.overlayClips.delete(id); }
      this.mixer.uncacheClip(c);
      this.clips.delete(id);
    }
  }

  duration(id: string) {
    const c = this.clips.get(id);
    if (!c) throw new Error('Unknown clip ' + id);
    return c.duration;
  }

  private baseEntry(id: string) {
    let e = this.base.get(id);
    if (!e) {
      const clip = this.clips.get(id);
      if (!clip) throw new Error('Unknown clip ' + id);
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      e = { action: a, weight: 0, target: 0 };
      this.base.set(id, e);
    }
    return e;
  }

  /** Set base-layer blend targets. Entries not listed fade to 0. Values are normalised per mask. */
  setBase(targets: Record<string, number>, timeScales?: Record<string, number>) {
    // first call: start at the targets instead of fading in from nothing (a zero-weight base blends to rest pose)
    let fresh = true;
    for (const [, e] of this.base) { if (e.weight > 0) fresh = false; e.target = 0; }
    const sums = { full: 0, lower: 0, upper: 0 };
    for (const [id, w] of Object.entries(targets)) {
      const k = id.endsWith('.lower') ? 'lower' : id.endsWith('.upper') ? 'upper' : 'full';
      sums[k] += w;
    }
    for (const [id, w] of Object.entries(targets)) {
      if (w <= 0) continue;
      const e = this.baseEntry(id);
      const k = id.endsWith('.lower') ? 'lower' : id.endsWith('.upper') ? 'upper' : 'full';
      e.target = w / (sums[k] || 1);
      if (fresh) e.weight = e.target;
      if (timeScales && timeScales[id] !== undefined) e.action.timeScale = timeScales[id];
    }
  }

  /** Overlay-only alias of a clip (same tracks, own uuid → its own AnimationAction). */
  private overlayClip(id: string) {
    let c = this.overlayClips.get(id);
    if (!c) {
      const src = this.clips.get(id);
      if (!src) throw new Error('Unknown clip ' + id);
      c = new THREE.AnimationClip(id + '#ov', src.duration, src.tracks);
      this.overlayClips.set(id, c);
    }
    return c;
  }

  /** Synchronise the phase of looping base clips (e.g. walk/run) by normalised time. */
  syncPhase(ids: string[]) {
    let lead: THREE.AnimationAction | null = null;
    let best = -1;
    for (const id of ids) {
      const e = this.base.get(id);
      if (e && e.weight > best) { best = e.weight; lead = e.action; }
    }
    if (!lead) return;
    const phase = lead.time / lead.getClip().duration;
    for (const id of ids) {
      const e = this.base.get(id);
      if (e && e.action !== lead) e.action.time = phase * e.action.getClip().duration;
    }
  }

  /** Play a one-shot (or looping) overlay clip, cross-fading from the previous overlay. */
  play(id: string, opts: { fade?: number; speed?: number; loop?: boolean; start?: number; clamp?: boolean; freezeOut?: boolean } = {}) {
    const clip = this.overlayClip(id);
    const fade = opts.fade ?? 0.12;
    if (this.current) {
      this.current.target = 0;
      this.current.speed = 1 / Math.max(0.02, fade);
      // the outgoing clip holds its last pose while it fades (a spin that kept turning under a fast spin would
      // drift past 180° from it and flip the quaternion blend: the Whirlwind's segment seams)
      if (opts.freezeOut) this.current.action.timeScale = 0;
    }
    const a = this.mixer.clipAction(clip);
    a.reset();
    a.enabled = true;
    a.setLoop(opts.loop || this.loops.has(id) && opts.loop !== false ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = opts.clamp ?? true;
    a.timeScale = opts.speed ?? 1;
    a.time = opts.start ?? 0;
    a.setEffectiveWeight(0);
    a.play();
    // remove duplicate overlay entries of the same action
    this.overlays = this.overlays.filter((o) => o.action !== a);
    const ov: Overlay = { action: a, weight: 0, target: 1, speed: 1 / Math.max(0.02, fade), id };
    this.overlays.push(ov);
    this.current = ov;
    return a;
  }

  /** Fade the overlay out and give control back to the base layer. */
  release(fade = 0.18) {
    if (this.current) {
      this.current.target = 0;
      this.current.speed = 1 / Math.max(0.02, fade);
      this.current = null;
    }
  }

  get overlayTime() { return this.current ? this.current.action.time : 0; }
  get overlayId() { return this.current?.id ?? null; }
  setOverlaySpeed(s: number) { if (this.current) this.current.action.timeScale = s; }

  update(dt: number) {
    let overlayW = 0;
    for (const o of this.overlays) {
      const k = Math.min(1, o.speed * dt);
      o.weight += (o.target - o.weight) * (o.target > o.weight ? Math.min(1, k * 1.0) : k);
      if (Math.abs(o.target - o.weight) < 0.01) o.weight = o.target;
      overlayW += o.weight;
    }
    this.overlays = this.overlays.filter((o) => {
      if (o.target === 0 && o.weight <= 0.001) { o.action.stop(); return false; }
      return true;
    });
    const norm = overlayW > 1 ? 1 / overlayW : 1;
    for (const o of this.overlays) o.action.setEffectiveWeight(o.weight * norm);
    const baseScale = Math.max(0, 1 - Math.min(1, overlayW));
    const kb = Math.min(1, this.baseResponse * dt);
    for (const [, e] of this.base) {
      e.weight += (e.target - e.weight) * kb;
      if (e.weight < 0.002 && e.target === 0) e.weight = 0;
      e.action.setEffectiveWeight(e.weight * baseScale);
    }
    this.mixer.update(dt);
  }
}
