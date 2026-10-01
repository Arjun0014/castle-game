import { LocalStore } from './Storage';
import { Wave } from './Wavedash';

/**
 * Presentation profile and input mode — two independent axes.
 *
 *   view  (layout/camera):  'wide'     = the widescreen game: the desktop default (Wavedash, any landscape window),
 *                                        and a phone/tablet whose player chose LANDSCAPE
 *                           'portrait' = the jam build's 9:16 stage: a phone/tablet whose player chose PORTRAIT, or a
 *                                        desktop window / embed that is clearly taller than wide (itch's portrait frame)
 *   input (controls):       'kbm'      = keyboard + mouse (no touch HUD)
 *                           'touch'    = touch HUD, touch camera, multitouch combat
 *
 * The view is re-evaluated on every resize and can change while the game runs (a desktop window dragged tall, a phone's
 * Display Mode changed in Settings) — never a reload: listeners (`onChange`) re-lay the camera, HUD and touch controls.
 * `?view=wide|portrait` pins it for tests. On a handheld the player chooses once (the title's HOW WOULD YOU LIKE TO
 * PLAY? card, ui/DisplayChoice.ts), the choice is kept (locally and in the cloud save) and Settings → Display changes it.
 *
 * Input mode is NEVER derived from the aspect ratio. It starts from the device's real capabilities (a coarse primary
 * pointer with touch points = phone/tablet) and then follows what the player actually uses: a touch `pointerdown`
 * switches to touch, a gameplay key or a real mouse press/move switches back (hybrid laptops). `?input=touch|kbm` pins it.
 *
 * Portrait stage: the canvas, HUD and overlays live in #stage. In portrait view the stage keeps a tall aspect between
 * 9:21 and 9:16 — it fills a phone held upright and is centred (pillar-boxed) in a wider window. In wide view the stage
 * is the whole window at any aspect (16:9, 16:10, 21:9 ultrawide). A handheld held the wrong way for its chosen mode gets
 * the "Rotate your device" card (game paused) with a one-tap switch to the other mode; desktops never see it.
 */
export type ViewProfile = 'portrait' | 'wide';
export type InputMode = 'kbm' | 'touch';
/** a handheld player's choice (Settings → Display) */
export type DisplayPref = 'portrait' | 'landscape';

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
const DISPLAY_KEY = 'caer-veyr:display';

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
  /** a handheld player's Portrait / Landscape choice (null = not chosen yet — the title asks) */
  displayPref: DisplayPref | null = null;
  /** when it was chosen (ms) — the cloud save keeps the newer choice */
  displayAt = 0;
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
  /** true while a handheld is held the wrong way for its display mode (game paused behind the overlay) */
  rotateBlocked = false;
  /** the display choice card is up (no rotate card behind it) */
  choosing = false;
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
    this.view = this.pinnedView ?? (this.handheld ? 'portrait' : 'wide');
  }

  get isTouch() { return this.inputMode === 'touch'; }
  get isPortrait() { return this.view === 'portrait'; }
  /** the touch-landscape layout (wide view, touch HUD) */
  get isTouchWide() { return this.view === 'wide' && this.inputMode === 'touch'; }
  /** a handheld that has not chosen Portrait / Landscape yet (and nothing pins the view) */
  get needsDisplayChoice() { return this.handheld && !this.pinnedView && this.displayPref === null; }

  /** Attach to the DOM: stage element + rotate overlay; installs resize and input-mode listeners. */
  init(stage: HTMLElement, rotateEl: HTMLElement) {
    this.stage = stage;
    this.rotateEl = rotateEl;
    this.loadDisplayPref();
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
    // the rotate card's one-tap way out: play in the other mode instead
    rotateEl.querySelector('.rotate-alt')?.addEventListener('click', (e) => {
      e.preventDefault();
      const to: DisplayPref = this.view === 'portrait' ? 'landscape' : 'portrait';
      this.setDisplayPref(to);
      void this.enterImmersive();
    });
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

  /** Re-read the stored display choice (after the storage scope is known — main.ts — or a cloud save restored it). */
  loadDisplayPref() {
    const v = LocalStore.get(DISPLAY_KEY);
    this.displayPref = v === 'portrait' || v === 'landscape' ? v : null;
    this.displayAt = Number(LocalStore.get(DISPLAY_KEY + ':t')) || 0;
  }

  /** The player's Portrait / Landscape choice (handhelds): kept, and the layout follows at once — no reload. */
  setDisplayPref(p: DisplayPref, persist = true, at = Date.now()) {
    const changed = p !== this.displayPref;
    this.displayPref = p;
    this.displayAt = at;
    if (persist) { LocalStore.set(DISPLAY_KEY, p); LocalStore.set(DISPLAY_KEY + ':t', String(at)); }
    this.layout();
    if (changed) for (const f of this.prefListeners) f(p);
  }
  private prefListeners = new Set<(p: DisplayPref) => void>();
  /** the Portrait / Landscape choice changed (the cloud save keeps it) */
  onDisplayPref(f: (p: DisplayPref) => void) { this.prefListeners.add(f); return () => this.prefListeners.delete(f); }

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
    // a phone / tablet: its player's choice — and until there is one (the first boot, the choice card), the way it is held
    if (this.handheld) return this.displayPref ? (this.displayPref === 'landscape' ? 'wide' : 'portrait') : (vw > vh ? 'wide' : 'portrait');
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
    // widescreen UI scale: desktop grows with the height (720p = 1); a phone held sideways stays legible
    const z = this.view === 'portrait' ? 1
      : this.inputMode === 'touch' ? Math.min(1.3, Math.max(0.82, h / 430))
      : Math.min(2.2, Math.max(0.8, Math.pow(h / 720, 0.85)));
    this.uiScale = Math.round(z * 1000) / 1000;
    document.documentElement.style.setProperty('--uiz', String(this.uiScale));
    this.updateRotate(vw, vh);
    this.emit();
  }

  /** a handheld held the wrong way for its display mode: the card (and the game pauses — main.ts) */
  private updateRotate(vw: number, vh: number) {
    let want: DisplayPref | null = null;
    // never before the player has chosen (nothing to rotate to yet); a pinned test view keeps the jam build's rule
    if (this.handheld && !this.choosing && (this.displayPref !== null || this.pinnedView !== null)) {
      if (this.view === 'portrait' && vw > vh * 1.05) want = 'portrait';
      else if (this.view === 'wide' && !this.pinnedView && vh > vw * 1.05) want = 'landscape';
    }
    this.rotateBlocked = !!want;
    const el = this.rotateEl;
    if (!el) return;
    el.classList.toggle('on', !!want);
    el.hidden = !want;
    if (!want) return;
    el.classList.toggle('to-landscape', want === 'landscape');
    const msg = el.querySelector('.rotate-msg'), sub = el.querySelector('.rotate-sub'), alt = el.querySelector('.rotate-alt');
    if (msg) msg.textContent = `Rotate your device to ${want}`;
    if (sub) sub.textContent = want === 'portrait' ? 'You chose to play Caer Veyr upright' : 'You chose to play Caer Veyr held sideways';
    if (alt) alt.textContent = want === 'portrait' ? 'Play in landscape instead' : 'Play in portrait instead';
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
   * Handhelds, inside a user gesture (New Game, Continue, the Landscape choice): fullscreen, then lock the orientation of
   * the chosen display mode. Both are optional — a browser or an embedding frame that refuses simply stays windowed and,
   * if the device is held the wrong way, the rotate card asks instead.
   */
  async enterImmersive() {
    if (!this.handheld) return;
    if (!this.isFullscreen()) await this.setFullscreen(true);
    try {
      const lock = (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock;
      if (lock && !this.pinnedView) await lock.call(screen.orientation, this.view === 'portrait' ? 'portrait' : 'landscape');
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
