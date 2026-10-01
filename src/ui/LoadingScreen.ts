import type { FloorDef } from '../levels/Floors';
import { Platform } from '../platform/Platform';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import './menu.css';

/**
 * The loading screen: the boot load and every chapter break between floors (session 10 redesign).
 *
 * A chapter card — floor numeral, name, subtitle, the chapter's epigraph — around the Crownheart's sigil. The sigil's
 * gilt ring is the REAL progress (byte-weighted asset loading → build → GPU warm-up, fed by Game.loadFloor): it only
 * ever moves toward the last reported fraction, never ahead of it. Under it the current step, in words.
 * When the floor is ready the ring closes, the heart flares, and the card fades into the game (or waits for a
 * key/tap when the next thing needs a user gesture: pointer lock, sound).
 */
const NUMERAL: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
const RING_R = 78;
const RING_C = 2 * Math.PI * RING_R;

/** The game's own card (the boot load, before the main menu). */
const BOOT = {
  title: 'ECHOES OF CAER VEYR',
  sub: 'A keep torn between two memories',
  epigraph: '“The castle remembers its rightful ruler.” So the people of Veyr were taught.',
};

/** The Crownheart's sigil (loading ring, menu crest). `id` keeps its gradient ids unique per instance. */
export const sigilSVG = (id: string) => `
<svg class="sigil" viewBox="-100 -100 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-heart" cx="50%" cy="42%" r="60%">
      <stop offset="0" stop-color="#ff6a4a"/><stop offset="0.35" stop-color="#b3242a"/><stop offset="1" stop-color="#2a0507"/>
    </radialGradient>
    <linearGradient id="${id}-gold" x1="0" y1="-1" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="#f3dca0"/><stop offset="0.5" stop-color="#d8b36a"/><stop offset="1" stop-color="#8a6a32"/>
    </linearGradient>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter>
  </defs>
  <circle class="sg-outer" r="93"/>
  <g class="sg-runes">${Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2, long = i % 4 === 0;
    const r0 = long ? 83 : 85.5, r1 = 89;
    return `<line x1="${(Math.sin(a) * r0).toFixed(2)}" y1="${(-Math.cos(a) * r0).toFixed(2)}" x2="${(Math.sin(a) * r1).toFixed(2)}" y2="${(-Math.cos(a) * r1).toFixed(2)}"${long ? ' class="l"' : ''}/>`;
  }).join('')}</g>
  <circle class="sg-track" r="${RING_R}"/>
  <circle class="sg-prog" stroke="url(#${id}-gold)" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}" transform="rotate(-90)"/>
  <g class="sg-inner">
    <circle r="62"/>
    ${[0, 90, 180, 270].map((d) => `<path d="M0 -66 L3.2 -62 L0 -58 L-3.2 -62 Z" transform="rotate(${d})"/>`).join('')}
  </g>
  <g class="sg-crown"><path stroke="url(#${id}-gold)" d="M-15 -50 L-15 -60 L-8 -54 L0 -66 L8 -54 L15 -60 L15 -50 Z"/></g>
  <g class="sg-heart">
    <path class="sg-heart-glow" d="M0 -40 L27 0 L0 45 L-27 0 Z" filter="url(#${id}-glow)"/>
    <path class="sg-heart-body" fill="url(#${id}-heart)" stroke="url(#${id}-gold)" d="M0 -40 L27 0 L0 45 L-27 0 Z"/>
    <path class="sg-heart-core" d="M0 -22 L13 0 L0 25 L-13 0 Z"/>
  </g>
</svg>`;

export class LoadingScreen {
  private el: HTMLElement;
  private card: HTMLElement;
  private chapter: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private epigraph: HTMLElement;
  private stepEl: HTMLElement;
  private detail: HTMLElement;
  private pct: HTMLElement;
  private prog: SVGCircleElement;
  private promptEl: HTMLElement;
  private embers: HTMLCanvasElement;
  private shown = 0;
  private target = 0;
  private label = '';
  private raf = 0;
  private lastPaint = -1;
  private lastLabel = '';
  private hideTimer = 0;
  private parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }[] = [];
  private lastT = 0;

  constructor(root: HTMLElement) {
    this.el = root;
    root.className = 'ld';
    root.innerHTML = `
      <canvas class="ld-embers"></canvas>
      <div class="ld-veil"></div>
      <div class="ld-card">
        <div class="ld-chapter"></div>
        <h1 class="ld-title"></h1>
        <div class="ld-sub"></div>
        <div class="ld-sigil">${sigilSVG('ld')}<div class="ld-pct"></div></div>
        <p class="ld-epigraph"></p>
        <div class="ld-step"></div>
        <div class="ld-detail"></div>
        <div class="ld-prompt"></div>
      </div>`;
    const q = <T extends Element>(s: string) => root.querySelector(s) as T;
    this.card = q('.ld-card');
    this.chapter = q('.ld-chapter');
    this.title = q('.ld-title');
    this.sub = q('.ld-sub');
    this.epigraph = q('.ld-epigraph');
    this.stepEl = q('.ld-step');
    this.detail = q('.ld-detail');
    this.pct = q('.ld-pct');
    this.prog = q<SVGCircleElement>('.sg-prog');
    this.promptEl = q('.ld-prompt');
    this.embers = q<HTMLCanvasElement>('.ld-embers');
  }

  /** The boot load (the game's own card; the main menu follows). */
  showInitial(_floor: FloorDef) {
    this.chapter.textContent = '';
    this.title.textContent = BOOT.title;
    this.sub.textContent = BOOT.sub;
    this.epigraph.textContent = BOOT.epigraph;
    this.el.classList.add('boot');
    this.open();
  }

  /** A chapter card: the floor that is loading (a floor transition, or Continue from the menu). */
  showTransition(floor: FloorDef, chapter?: string) {
    this.chapter.textContent = chapter ?? `FLOOR ${NUMERAL[floor.id] ?? floor.id}`;
    this.title.textContent = floor.title;
    this.sub.textContent = floor.subtitle.replace(/^Floor [IVX]+ — /, '');
    this.epigraph.textContent = floor.epigraph ?? '';
    this.el.classList.remove('boot');
    document.title = `Echoes of Caer Veyr — ${floor.subtitle}`;
    this.open();
  }

  private open() {
    clearTimeout(this.hideTimer);
    this.el.classList.remove('hidden', 'out', 'ready', 'waiting', 'failed');
    this.promptEl.textContent = '';
    this.shown = 0; this.target = 0; this.label = ''; this.lastPaint = -1; this.lastLabel = '';
    this.parts = [];
    // restart the card's entrance
    this.card.classList.remove('in'); void this.card.offsetWidth; this.card.classList.add('in');
    this.paint();
    if (!this.raf) { this.lastT = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }

  /** f in 0..1 (monotonic: a lower value never moves the ring back). */
  progress(f: number, label?: string) {
    this.target = Math.max(this.target, Math.min(1, f));
    if (label) this.label = label;
    // rAF does not run in hidden tabs: paint directly as well (never ahead of the real value)
    this.shown = Math.max(this.shown, this.target - 0.02);
    this.paint();
  }

  /** Loading finished: the ring closes and the heart flares. */
  ready(message: string) {
    this.target = this.shown = 1;
    this.label = message;
    this.paint();
    this.el.classList.add('ready');
  }

  /** Wait for a key / click / tap on the card (sound and pointer lock need a user gesture). */
  waitForGesture(): Promise<void> {
    this.promptEl.textContent = Platform.isTouch ? 'Tap to enter' : 'Press any key or click to enter';
    this.el.classList.add('waiting');
    return new Promise((resolve) => {
      const done = (e: Event) => {
        if (e instanceof KeyboardEvent && (e.repeat || e.code === 'Escape' || e.code === 'F12')) return;
        window.removeEventListener('keydown', done, true);
        this.el.removeEventListener('pointerdown', done);
        this.el.classList.remove('waiting');
        resolve();
      };
      window.addEventListener('keydown', done, true);
      this.el.addEventListener('pointerdown', done);
    });
  }

  /**
   * The load failed. With `retry` the card offers TRY AGAIN (a click / tap / Enter): a floor transition resumes in
   * place (Game.transitionTo keeps what already arrived); without it the page must be reloaded.
   */
  error(message: string, retry?: () => void) {
    this.el.classList.remove('netwait');
    this.el.classList.add('failed');
    this.chapter.textContent = 'THE CASTLE RESISTS';
    this.stepEl.textContent = message;
    this.detail.textContent = retry ? 'The way down was lost. Check the connection, then try again.' : 'Reload the page to try again.';
    this.promptEl.textContent = '';
    if (!retry) return;
    const b = document.createElement('button');
    b.className = 'mm-item ld-retry focus';
    b.innerHTML = '<span>Try again</span>';
    this.promptEl.appendChild(b);
    const go = (e: Event) => {
      if (e instanceof KeyboardEvent && e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      window.removeEventListener('keydown', go, true);
      b.removeEventListener('click', go);
      this.el.classList.remove('failed');
      this.promptEl.textContent = '';
      retry();
    };
    b.addEventListener('click', go);
    window.addEventListener('keydown', go, true);
  }

  /**
   * Network status while loading (AssetManager Net): attempt > 0 = a request failed and is being retried (the card
   * says so instead of seeming to hang); 0 = the connection answered again.
   */
  connection(attempt: number, waitMs = 0) {
    this.el.classList.toggle('netwait', attempt > 0);
    if (attempt > 0) this.detail.textContent = `The way is lost — seeking it again (attempt ${attempt + 1}, ${Math.ceil(waitMs / 1000)} s)…`;
  }

  /** Fade into whatever is behind (the game, the menu). */
  hide() {
    this.el.classList.add('out');
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.el.classList.add('hidden');
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }, 700);
  }

  get visible() { return !this.el.classList.contains('hidden') && !this.el.classList.contains('out'); }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.shown += (this.target - this.shown) * Math.min(1, dt * 9);
    if (this.target - this.shown < 0.002) this.shown = this.target;
    this.paint();
    this.drawEmbers(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** "Preparing the Royal Floor — raising the walls" → step "Preparing the Royal Floor", detail "raising the walls". */
  private paint() {
    const f = this.shown;
    const p = Math.floor(f * 100 + 1e-6);
    if (p === this.lastPaint && this.label === this.lastLabel) return;
    this.lastPaint = p;
    this.lastLabel = this.label;
    this.prog.style.strokeDashoffset = (RING_C * (1 - f)).toFixed(2);
    this.pct.textContent = String(p);
    // a failure message, or the "seeking the way again" note, stays until the load moves on
    if (this.el.classList.contains('failed')) return;
    const [step, ...rest] = this.label.split(' — ');
    this.stepEl.textContent = step ?? '';
    if (!this.el.classList.contains('netwait')) this.detail.textContent = rest.join(' — ').replace(/\s*\(\d+\/\d+\)\s*$/, '');
  }

  /** A few embers rising through the dark (the Crownheart's light), drawn on a small canvas. */
  private drawEmbers(dt: number) {
    const c = this.embers;
    const w = Math.round(c.clientWidth / 2), h = Math.round(c.clientHeight / 2);
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const want = Math.round(24 + (w * h) / 9000);
    while (this.parts.length < want) {
      const max = 4 + Math.random() * 6;
      this.parts.push({ x: Math.random() * w, y: h + Math.random() * h * 0.3, vx: (Math.random() - 0.5) * 6, vy: -(8 + Math.random() * 18), life: this.parts.length < want / 2 ? Math.random() * max : 0, max, r: 0.5 + Math.random() * 1.3 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.parts) {
      q.life += dt;
      q.x += (q.vx + Math.sin((q.life + q.r) * 1.7) * 4) * dt;
      q.y += q.vy * dt;
      const k = q.life / q.max;
      if (k >= 1 || q.y < -4) { q.life = 0; q.x = Math.random() * w; q.y = h + 4; continue; }
      const a = Math.sin(Math.PI * k) * 0.75;
      ctx.fillStyle = `rgba(255,${Math.round(120 + 70 * (1 - k))},70,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}
