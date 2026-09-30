/**
 * Presentation profile and input mode — two independent axes.
 *
 *   view  (layout/camera):  'portrait' = the jam build (9:16 stage, default)
 *                           'wide'     = internal widescreen build (`?view=wide`, not exposed in the UI)
 *   input (controls):       'kbm'      = keyboard + mouse (no touch HUD)
 *                           'touch'    = touch HUD, touch camera, multitouch combat
 *
 * Input mode is NEVER derived from the aspect ratio. It starts from the device's real capabilities (a coarse
 * primary pointer with touch points = phone/tablet) and then follows what the player actually uses: a touch
 * `pointerdown` switches to touch, a gameplay key or a real mouse press/move switches back (hybrid laptops).
 * `?input=touch|kbm` pins it for testing.
 *
 * Portrait stage: the canvas, HUD and overlays live in #stage. In portrait view the stage keeps a tall aspect
 * between 9:21 and 9:16 — it fills a phone held upright and is centred (pillar-boxed) in a landscape desktop
 * window or itch.io iframe. Handhelds held in landscape get the "rotate your device" overlay; desktops never do.
 */
export type ViewProfile = 'portrait' | 'wide';
export type InputMode = 'kbm' | 'touch';

/**
 * Load-time render quality (fixed per session: light count and shadow size are part of shader program keys
 * and GPU allocations). Handhelds default to 'mobile'; `?quality=high|mobile` overrides.
 */
export interface Quality { name: 'high' | 'mobile'; pointLights: number; shadowMap: number }
const QUALITY: Record<Quality['name'], Quality> = {
  high: { name: 'high', pointLights: 10, shadowMap: 2048 },
  mobile: { name: 'mobile', pointLights: 6, shadowMap: 1024 },
};

/** tallest / widest stage aspect (width / height) in portrait view */
export const PORTRAIT_ASPECT_MIN = 9 / 21;
export const PORTRAIT_ASPECT_MAX = 9 / 16;

const GAMEPLAY_KEYS = /^(Key[A-Z]|Digit\d|Arrow|Space|Shift|Control|Tab|Escape|Backquote|Enter)/;

type Listener = () => void;

class PlatformImpl {
  readonly params = new URLSearchParams(location.search);
  readonly view: ViewProfile = this.params.get('view') === 'wide' ? 'wide' : 'portrait';
  readonly forcedInput: InputMode | null = ((): InputMode | null => {
    const v = this.params.get('input');
    return v === 'touch' || v === 'kbm' ? v : null;
  })();
  /** the device can produce touch input at all */
  readonly touchCapable = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  /** phone/tablet: the primary pointer is a finger (a touchscreen laptop's primary pointer is fine) */
  readonly handheld: boolean;
  inputMode: InputMode;
  quality: Quality;
  /** stage size in CSS px (what the renderer and HUD lay out against) */
  width = 1;
  height = 1;
  /** true while a handheld in portrait view is held in landscape (game paused behind the overlay) */
  rotateBlocked = false;
  private stage: HTMLElement | null = null;
  private rotateEl: HTMLElement | null = null;
  private listeners = new Set<Listener>();
  private lastMouse = { x: -1, y: -1 };

  constructor() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const noHover = matchMedia('(hover: none)').matches;
    this.handheld = this.touchCapable && (coarse || noHover);
    this.inputMode = this.forcedInput ?? (this.handheld ? 'touch' : 'kbm');
    const q = this.params.get('quality');
    this.quality = QUALITY[q === 'high' || q === 'mobile' ? q : this.handheld ? 'mobile' : 'high'];
  }

  get isTouch() { return this.inputMode === 'touch'; }
  get isPortrait() { return this.view === 'portrait'; }

  /** Attach to the DOM: stage element + rotate overlay; installs resize and input-mode listeners. */
  init(stage: HTMLElement, rotateEl: HTMLElement) {
    this.stage = stage;
    this.rotateEl = rotateEl;
    const root = document.documentElement;
    root.classList.add('view-' + this.view);
    this.applyInputClass();
    const relayout = () => this.layout();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => setTimeout(relayout, 60));
    window.visualViewport?.addEventListener('resize', relayout);
    if (!this.forcedInput) {
      // capture phase: decide before any handler acts on the event
      window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setInputMode('touch');
        else if (e.pointerType === 'mouse') this.setInputMode('kbm');
      }, true);
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || this.inputMode === 'kbm') return;
        // a real mouse moving a meaningful distance (not a stray synthetic event) hands control back
        if (this.lastMouse.x >= 0 && Math.hypot(e.clientX - this.lastMouse.x, e.clientY - this.lastMouse.y) > 24) this.setInputMode('kbm');
        this.lastMouse.x = e.clientX; this.lastMouse.y = e.clientY;
      }, true);
      window.addEventListener('keydown', (e) => { if (GAMEPLAY_KEYS.test(e.code)) this.setInputMode('kbm'); }, true);
    }
    this.layout();
  }

  onChange(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const fn of this.listeners) fn(); }

  setInputMode(m: InputMode) {
    if (this.forcedInput || m === this.inputMode) return;
    this.inputMode = m;
    this.lastMouse.x = this.lastMouse.y = -1;
    this.applyInputClass();
    this.layout();
  }

  private applyInputClass() {
    const root = document.documentElement;
    root.classList.toggle('input-touch', this.inputMode === 'touch');
    root.classList.toggle('input-kbm', this.inputMode === 'kbm');
  }

  /** Viewport size (visualViewport is exact on mobile browsers with collapsing toolbars). */
  private viewport() {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  layout() {
    const { w: vw, h: vh } = this.viewport();
    let w = vw, h = vh;
    if (this.view === 'portrait') {
      const a = vw / vh;
      if (a > PORTRAIT_ASPECT_MAX) w = Math.round(vh * PORTRAIT_ASPECT_MAX);
      else if (a < PORTRAIT_ASPECT_MIN) h = Math.round(vw / PORTRAIT_ASPECT_MIN);
    }
    this.width = w;
    this.height = h;
    if (this.stage) {
      const s = this.stage.style;
      s.width = w + 'px';
      s.height = h + 'px';
      s.left = Math.round((vw - w) / 2) + 'px';
      s.top = Math.round((vh - h) / 2) + 'px';
    }
    const blocked = this.view === 'portrait' && this.handheld && vw > vh * 1.05;
    this.rotateBlocked = blocked;
    this.rotateEl?.classList.toggle('on', blocked);
    if (this.rotateEl) this.rotateEl.hidden = !blocked;
    this.emit();
  }

  /** Fullscreen + portrait lock on handhelds (must run inside a user gesture; silently optional). */
  async enterImmersive() {
    if (!this.handheld) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        else el.webkitRequestFullscreen?.();
      }
    } catch { /* iOS Safari / sandboxed iframes: stay windowed */ }
    try {
      if (this.view === 'portrait') await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait');
    } catch { /* not supported outside fullscreen / on iOS */ }
    setTimeout(() => this.layout(), 250);
  }

  /** Short vibration on touch devices that support it (never the only feedback channel). */
  private lastBuzz = 0;
  haptic(ms: number) {
    if (this.inputMode !== 'touch' || !('vibrate' in navigator)) return;
    // before the first tap Chrome refuses (and logs) every vibrate call: nothing to feel yet anyway
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return;
    const now = performance.now();
    if (now - this.lastBuzz < 45) return;
    this.lastBuzz = now;
    try { navigator.vibrate(Math.round(ms)); } catch { /* ignore */ }
  }
}

/**
 * Pointer lock, asked politely: requestPointerLock() returns a promise in current browsers and rejects outside a
 * gesture or in an embedded frame that may not lock — an unhandled rejection otherwise (the first click locks).
 */
export function lockPointer(el: HTMLElement) {
  try {
    const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => undefined);
  } catch { /* not allowed here */ }
}

export const Platform = new PlatformImpl();
(window as unknown as { __platform: PlatformImpl }).__platform = Platform;
