import '@fontsource/eb-garamond/latin-500.css';
import opening from '../data/opening.json';

type Sub = { start: number; end: number; text: string; paper?: boolean };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The opening film. It plays inside the stage after the player's first click (which also unlocked audio) and hands
 * straight over to gameplay when it ends or is skipped — no reload, the floor is already loaded behind it.
 * Session 14: the film is the Remotion cut "The Castle Remembers" (tools/cinematic/ship_intro.py ->
 * public/cinematic/intro_720.mp4 + src/data/opening.json); its captions are burned in, so the DOM subtitle track
 * (used by the session-10 film, driven by the video clock) stays empty.
 *
 * Skip: the Skip button, Esc / Enter / Space, or on touch a tap (which reveals Skip) then Skip.
 * A video that cannot load or play never blocks the game: the error is logged and play begins.
 */
export class Intro {
  private root: HTMLDivElement;
  private video: HTMLVideoElement;
  private subEl: HTMLParagraphElement;
  private skipBtn: HTMLButtonElement;
  private glow: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D | null;
  private raf = 0;
  private done = false;
  private onDone: ((gesture: boolean) => void) | null = null;
  private skipShownAt = 0;
  private useGlow = false;
  private failed = false;
  /** the Remotion cut (session 14) burns its narration captions into the picture: no DOM subtitle track then */
  private readonly subs: Sub[] = opening.burnedInCaptions ? [] : (opening.subtitles as Sub[]);
  private readonly fade = opening.subtitleFade as [number, number];

  /** Automated runs (autopilot, tests, benchmarks), later floors and `?nointro` go straight to play. */
  static enabled(params: URLSearchParams, floorId: number, automated: boolean) {
    return floorId === 1 && !automated && !params.has('nointro');
  }

  constructor(private stage: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'intro';
    this.video = document.createElement('video');
    this.video.className = 'intro-video';
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('webkit-playsinline', '');
    this.video.preload = 'metadata';
    this.video.disablePictureInPicture = true;
    this.video.controls = false;
    const subs = document.createElement('div');
    subs.className = 'intro-subs';
    this.subEl = document.createElement('p');
    subs.appendChild(this.subEl);
    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'intro-skip';
    this.skipBtn.type = 'button';
    this.skipBtn.textContent = 'Skip';
    this.root.append(this.video, subs, this.skipBtn);
    // the film's own light, blurred wide behind the stage (widescreen windows, letterbox bars)
    this.glow = document.createElement('canvas');
    this.glow.id = 'intro-glow';
    this.glow.width = 18; this.glow.height = 32;
    this.glowCtx = this.glow.getContext('2d', { alpha: false });
  }

  /** Start fetching the film once the floor has loaded (so it never competes with the floor's own assets). */
  preload() {
    if (this.video.src) return;
    this.video.addEventListener('error', () => {
      this.failed = true;
      console.error('[intro] the opening film failed to load:', this.video.error?.message || this.video.error?.code, this.video.currentSrc);
      if (this.onDone) this.finish(false);
    });
    this.video.src = this.pickSource();
    this.video.preload = 'auto';
    this.video.load();
  }

  /** Must be called from the click that dismissed the title card (a user gesture: sound is allowed). */
  play(onDone: (gesture: boolean) => void) {
    this.onDone = onDone;
    this.preload();
    if (this.failed) { this.done = true; this.onDone = null; onDone(true); return; }   // already failed: straight to play
    document.documentElement.classList.add('intro-on');
    // the glow only matters where the 9:16 film leaves the window uncovered (desktop, letterboxed phones)
    const r = this.stage.getBoundingClientRect();
    const k = Math.min(r.width / 9, r.height / 16);
    this.useGlow = 9 * k * 16 * k < window.innerWidth * window.innerHeight * 0.92;
    if (this.useGlow) document.body.insertBefore(this.glow, document.body.firstChild);
    this.stage.appendChild(this.root);
    this.video.addEventListener('ended', () => this.finish(false));
    this.skipBtn.addEventListener('click', (e) => { e.stopPropagation(); this.finish(true); });
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.skipBtn) return;
      if (this.video.paused && !this.done) void this.video.play().catch(() => undefined);   // resume after a stall/background
      this.showSkip();
    });
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('mousemove', this.onMove, true);
    document.addEventListener('visibilitychange', this.onVisibility);
    const p = this.video.play();
    if (p) p.catch((err) => {
      // autoplay refused (should not happen after a click); show Skip so the player is never stuck
      console.warn('[intro] play() was refused:', err);
      this.showSkip(true);
    });
    setTimeout(() => this.showSkip(), 1200);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** the smallest encode that still covers the stage's device pixels (the tallest when none does) */
  private pickSource() {
    const r = this.stage.getBoundingClientRect();
    const px = Math.max(r.width, r.height) * (window.devicePixelRatio || 1);
    const vids = [...opening.videos].sort((a, b) => a.height - b.height);
    const v = vids.find((x) => x.height >= px * 0.85) ?? vids[vids.length - 1];
    return import.meta.env.BASE_URL + v.src;
  }

  private onKey = (e: KeyboardEvent) => {
    // the intro owns the keyboard while it plays (nothing reaches the game's input)
    e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.finish(true);
    } else this.showSkip();
  };

  private onMove = () => this.showSkip();

  private onVisibility = () => {
    if (this.done) return;
    if (document.hidden) this.video.pause();
    else void this.video.play().catch(() => this.showSkip(true));
  };

  private showSkip(stay = false) {
    this.skipShownAt = stay ? Infinity : performance.now();
    this.skipBtn.classList.add('on');
  }

  private tick = () => {
    if (this.done) return;
    const t = this.video.currentTime;
    // subtitles: the same timing and fades as the burned-in share version
    let text = '', a = 0, paper = false;
    for (const s of this.subs) {
      if (t >= s.start - 0.01 && t <= s.end + 0.01) {
        text = s.text; paper = s.paper === true;
        a = Math.min(smooth(s.start, s.start + this.fade[0], t), 1 - smooth(s.end - this.fade[1], s.end, t));
        break;
      }
    }
    if (this.subEl.textContent !== text) this.subEl.textContent = text;
    this.subEl.classList.toggle('paper', paper);   // lines over the parchment passages are written in ink
    this.subEl.style.opacity = a.toFixed(3);
    if (this.skipShownAt !== Infinity && performance.now() - this.skipShownAt > 2600) this.skipBtn.classList.remove('on');
    if (this.useGlow && this.glowCtx && this.video.readyState >= 2) {
      try { this.glowCtx.drawImage(this.video, 0, 0, this.glow.width, this.glow.height); } catch { /* not decodable yet */ }
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  /** End or skip: fade the film out and hand over to the game (gesture: a user action ended it). */
  finish(gesture: boolean) {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('mousemove', this.onMove, true);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.root.classList.add('out');
    this.glow.classList.add('out');
    // let the audio duck out with the picture instead of cutting
    const v = this.video, v0 = v.volume, t0 = performance.now();
    const duck = () => {
      const k = Math.min(1, (performance.now() - t0) / 380);
      v.volume = Math.max(0, v0 * (1 - k));
      if (k < 1) requestAnimationFrame(duck);
      else { v.pause(); v.removeAttribute('src'); v.load(); this.root.remove(); this.glow.remove(); }
    };
    requestAnimationFrame(duck);
    document.documentElement.classList.remove('intro-on');
    const cb = this.onDone; this.onDone = null;
    cb?.(gesture);
  }
}
