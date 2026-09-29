import type { FloorDef } from '../levels/Floors';

/**
 * Loading screen for the initial load and every floor transition. Shows real, byte-weighted progress
 * (fed by Game.loadFloor → AssetManager → GPU warm-up) as a block bar + percentage + what is happening:
 *
 *   LOADING CAER VEYR
 *   ████████░░ 82%
 *   Preparing the Royal Floor…
 *
 * Initial mode ends with the "Enter the Keep" button (a user gesture is needed for audio + pointer lock);
 * transition mode dismisses itself once the next floor is ready.
 */
const BLOCKS = 24;

export class LoadingScreen {
  private el: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private heading: HTMLElement;
  private blocks: HTMLElement;
  private pct: HTMLElement;
  private fill: HTMLElement;
  private status: HTMLElement;
  private btn: HTMLButtonElement;
  private help: HTMLElement;
  private shown = 0;
  private target = 0;
  private label = '';
  private raf = 0;
  private lastPaint = -1;

  constructor(root: HTMLElement) {
    this.el = root;
    const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    this.title = q('#title-card h1');
    this.sub = q('#title-card h2');
    this.heading = q('#load-heading');
    this.blocks = q('#load-blocks');
    this.pct = q('#load-pct');
    this.fill = q('#load-fill');
    this.status = q('#load-status');
    this.btn = q<HTMLButtonElement>('#start-btn');
    this.help = q('#controls-help');
  }

  /** Initial load of `floor` (title card + controls; ends with the start button). */
  showInitial(floor: FloorDef) {
    this.setFloor(floor);
    // the first card carries the game's name; chapter cards between floors carry the floor's
    this.title.textContent = 'THE CASTLE REMEMBERS';
    this.sub.textContent = floor.subtitle;
    this.el.classList.remove('hidden', 'transition');
    this.btn.style.display = '';
    this.btn.disabled = true;
    this.help.style.display = '';
    this.reset();
  }

  /** Chapter break between floors: no button, the game continues as soon as the floor is ready. */
  showTransition(floor: FloorDef) {
    this.setFloor(floor);
    this.el.classList.remove('hidden');
    this.el.classList.add('transition');
    this.btn.style.display = 'none';
    this.help.style.display = 'none';
    this.reset();
  }

  private setFloor(floor: FloorDef) {
    this.title.textContent = floor.title;
    this.sub.textContent = floor.subtitle;
    this.heading.textContent = 'LOADING CAER VEYR';
    document.title = `The Castle Remembers — ${floor.subtitle}`;
  }

  private reset() {
    this.shown = 0; this.target = 0; this.label = 'Preparing…'; this.lastPaint = -1;
    this.status.style.color = '';
    this.paint();
    if (!this.raf) this.tick();
  }

  /** f in 0..1 (monotonic: a lower value never moves the bar back). */
  progress(f: number, label?: string) {
    this.target = Math.max(this.target, Math.min(1, f));
    if (label) this.label = label;
    // rAF does not run in hidden tabs: paint directly as well
    this.shown = Math.max(this.shown, this.target - 0.02);
    this.paint();
  }

  /** Loading finished. Initial: enable the button with `message`. */
  ready(message: string) {
    this.target = this.shown = 1;
    this.label = message;
    this.paint();
    this.btn.disabled = false;
  }

  error(message: string) {
    this.status.textContent = message;
    this.status.style.color = '#ff7a6a';
    this.heading.textContent = 'THE CASTLE RESISTS';
  }

  hide() {
    this.el.classList.add('hidden');
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = () => {
    this.shown += (this.target - this.shown) * 0.25;
    if (this.target - this.shown < 0.002) this.shown = this.target;
    this.paint();
    this.raf = requestAnimationFrame(this.tick);
  };

  private paint() {
    const f = this.shown;
    const p = Math.floor(f * 100 + 1e-6);
    if (p === this.lastPaint && this.status.textContent === this.label) return;
    this.lastPaint = p;
    const n = Math.round(f * BLOCKS);
    this.blocks.textContent = '█'.repeat(n) + '░'.repeat(BLOCKS - n);
    this.pct.textContent = `${p}%`;
    this.fill.style.width = `${(f * 100).toFixed(1)}%`;
    this.status.textContent = this.label;
  }
}
