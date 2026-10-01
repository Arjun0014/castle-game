import { Wave } from './Wavedash';

/**
 * Presentation profile and input mode — two independent axes.
 *
 *   view  (layout/camera):  'wide'     = the widescreen game: the desktop default (Wavedash, any landscape window) and
 *                                        EVERY phone / tablet (held sideways — Wavedash's "Wide" mobile layout turns its
 *                                        frame for a phone held upright, so the game always gets a landscape frame there)
 *                           'portrait' = the jam build's 9:16 stage: only a desktop window / embed that is clearly taller
 *                                        than wide (itch's portrait frame)
 *   input (controls):       'kbm'      = keyboard + mouse (no touch HUD)
 *                           'touch'    = touch HUD, touch camera, multitouch combat
 *
 * The view is re-evaluated on every resize and can change while the game runs (a desktop window dragged tall) — never a
 * reload: listeners (`onChange`) re-lay the camera, HUD and touch controls. `?view=wide|portrait` pins it for tests.
 * (Session 16 shipped a Portrait / Landscape choice for phones; the playtest on a real phone settled it: landscape only.)
 *
 * Input mode is NEVER derived from the aspect ratio. It starts from the device's real capabilities (a coarse primary
 * pointer with touch points = phone/tablet) and then follows what the player actually uses: a touch `pointerdown`
 * switches to touch, a gameplay key or a real mouse press/move switches back (hybrid laptops). `?input=touch|kbm` pins it.
 *
 * Portrait stage: the canvas, HUD and overlays live in #stage. In portrait view the stage keeps a tall aspect between
 * 9:21 and 9:16 — it fills a phone held upright and is centred (pillar-boxed) in a wider window. In wide view the stage
 * is the whole window at any aspect (16:9, 16:10, 21:9 ultrawide). A handheld held upright in a frame that does not turn
 * for it (itch, the bare page) gets the "Turn your device sideways" card (game paused); desktops never see it.
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
/** desktop: a window narrower than this (w/h) uses the portrait layout; wider than DESK_WIDE goes back (hysteresis) */
const DESK_TALL = 0.8;
const DESK_WIDE = 0.9;

const GAMEPLAY_KEYS = /^(Key[A-Z]|Digit\d|Arrow|Space|Shift|Control|Tab|Escape|Backquote|Enter)/;

type Listener = () => void;

class PlatformImpl {
  readonly params = new URLSearchParams(location.search);
  /** `?view=` pins the layout (tests, captures) */
  readonly pinnedView: ViewProfile | null = ((): ViewProfile | null => {
    const v = this.params.get('view');
    return v === 'wide' || v === 'portrait' ? v : null;
  })();
  view: ViewProfile;
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
  /**
   * UI scale of the widescreen layouts (CSS `--uiz`): the HUD and the menus were drawn for 1280×720 and grow with the
   * stage height, so 1080p / 1440p / ultrawide read like the same game rather than a small HUD in a big frame.
   */
  uiScale = 1;
  /** true while a handheld is held upright in a frame that does not turn for it (game paused behind the overlay) */
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
    this.view = this.pinnedView ?? 'wide';
  }

  get isTouch() { return this.inputMode === 'touch'; }
  get isPortrait() { return this.view === 'portrait'; }
  /** the touch-landscape layout (wide view, touch HUD) */
  get isTouchWide() { return this.view === 'wide' && this.inputMode === 'touch'; }

  /** Attach to the DOM: stage element + rotate overlay; installs resize and input-mode listeners. */
  init(stage: HTMLElement, rotateEl: HTMLElement) {
    this.stage = stage;
    this.rotateEl = rotateEl;
    this.applyViewClass();
    this.applyInputClass();
    const relayout = () => this.layout();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => setTimeout(relayout, 60));
    window.visualViewport?.addEventListener('resize', relayout);
    screen.orientation?.addEventListener?.('change', () => setTimeout(relayout, 60));
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
    document.addEventListener('fullscreenchange', () => this.layout());
    Wave.fullscreen.onChange(() => this.layout());
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
  private applyViewClass() {
    const root = document.documentElement;
    root.classList.toggle('view-portrait', this.view === 'portrait');
    root.classList.toggle('view-wide', this.view === 'wide');
    root.classList.toggle('handheld', this.handheld);
  }

  /** Viewport size (visualViewport is exact on mobile browsers with collapsing toolbars). */
  private viewport() {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  private resolveView(vw: number, vh: number): ViewProfile {
    if (this.pinnedView) return this.pinnedView;
    // a phone / tablet always plays the widescreen game (held upright outside Wavedash: the turn card asks)
    if (this.handheld) return 'wide';
    const a = vw / vh;
    return this.view === 'portrait' ? (a > DESK_WIDE ? 'wide' : 'portrait') : (a < DESK_TALL ? 'portrait' : 'wide');
  }

  layout() {
    const { w: vw, h: vh } = this.viewport();
    const view = this.resolveView(vw, vh);
    if (view !== this.view) { this.view = view; this.applyViewClass(); }
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
    // widescreen UI scale: desktop grows with the height (720p = 1); a phone held sideways (≈360-430 px tall) reads at
    // ≈0.7 — the words stay legible without covering the fight (playtest: 0.9 was far too big); tablets grow to 1.3
    const z = this.view === 'portrait' ? 1
      : this.inputMode === 'touch' ? Math.min(1.3, Math.max(0.66, h / 540))
      : Math.min(2.2, Math.max(0.8, Math.pow(h / 720, 0.85)));
    this.uiScale = Math.round(z * 1000) / 1000;
    document.documentElement.style.setProperty('--uiz', String(this.uiScale));
    this.updateRotate(vw, vh);
    this.emit();
  }

  /**
   * A handheld held upright in a frame that does not turn for it (itch, the bare page — Wavedash's Wide layout turns its
   * own frame): the card asks to turn it sideways (and the game pauses — main.ts). A pinned test view never sees it.
   */
  private updateRotate(vw: number, vh: number) {
    const want = this.handheld && !this.pinnedView && this.view === 'wide' && vh > vw * 1.05;
    this.rotateBlocked = want;
    const el = this.rotateEl;
    if (!el) return;
    el.classList.toggle('on', want);
    el.hidden = !want;
  }

  // ------------------------------------------------------------------ fullscreen + orientation
  /** the game is presented fullscreen (Wavedash host fullscreen, or the browser's own) */
  isFullscreen() { return Wave.available ? Wave.fullscreen.isOn() : !!document.fullscreenElement; }
  /** a fullscreen request can be made at all here */
  get canFullscreen() {
    if (Wave.available) return Wave.fullscreen.supported;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    return !!(document.fullscreenEnabled && el.requestFullscreen) || !!el.webkitRequestFullscreen;
  }

  /**
   * Enter / leave fullscreen (must run inside a user gesture to enter). On Wavedash the host owns the fullscreen target
   * (its overlay stays on top): the request goes through the SDK; elsewhere the page asks the browser directly.
   * Resolves whether it is now in the wanted state.
   */
  async setFullscreen(on: boolean): Promise<boolean> {
    if (Wave.available) {
      const ok = await Wave.fullscreen.request(on);
      setTimeout(() => this.layout(), 250);
      return ok;
    }
    try {
      if (on && !document.fullscreenElement) {
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        else el.webkitRequestFullscreen?.();
      } else if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* iOS Safari / an iframe without allowfullscreen: stay windowed */ }
    setTimeout(() => this.layout(), 250);
    return !!document.fullscreenElement === on;
  }

  /**
   * Handhelds, inside a user gesture (New Game, Continue): fullscreen, then lock the orientation to landscape. Both are
   * optional — a browser or an embedding frame that refuses simply stays windowed and, if the device is held upright in a
   * frame that does not turn, the turn card asks instead.
   */
  async enterImmersive() {
    if (!this.handheld) return;
    if (!this.isFullscreen()) await this.setFullscreen(true);
    try {
      const lock = (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock;
      if (lock && !this.pinnedView) await lock.call(screen.orientation, 'landscape');
    } catch { /* not supported outside fullscreen / in an iframe / on iOS: the rotate card covers it */ }
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
