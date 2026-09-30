import * as THREE from 'three';
import type { Action, Input } from '../game/Input';
import { Platform } from '../platform/Platform';

/**
 * Touch HUD (shown only while Platform.inputMode === 'touch'). Layout (session 9: the camera pocket grew ~40 %
 * — the whole cluster sits a little higher and Guard moved left — and swipes turn the camera much faster):
 *
 *                              ◇SHIFT        (JUMP)      temporal and rare: small, up-left of Jump
 *                                          [ATTACK]      the two prominent verbs on the right edge
 *                             (HEAVY)                    left of Attack, a thumb-roll away
 *                  (GUARD)                               bottom of the arc: slides onto Heavy (kick) / Attack (bash)
 *                               [  camera pocket  ]      the lower-right corner (≈177 × 163 u) stays EMPTY for swipes
 *   left thumb   floating joystick (lower-left zone); pushing to the rim sprints
 *
 * There is no Dodge button on touch (desktop keeps its Shift-tap / key dodge). The soft combat camera
 * (combat/TargetAssist) keeps the fight framed, so there is no lock-on button either.
 * Every pointer is owned by exactly one role (stick / look / button) from pointerdown to pointerup, and holds
 * are registered with Input per pointer id, so one finger can never release or cancel another's input.
 *
 * HOLD moves (floor rewards: Crownbreaker = hold HEAVY, Whirlwind = hold ATTACK): a gold arc fills round the
 * button while it is held; once the hold move engages the arc turns solid (the charge / the spin time left), so a
 * hold is never mistaken for a tap.
 *
 * The buttons are drawn as heraldic seals (SVG): an aged-gold rim with the role's device — battlements for
 * Attack, rivets for Heavy, a shield-boss bead ring for Guard, a pointed arch for Jump — over an enamel field
 * tinted per role; Shift is a small azure lozenge with an hourglass.
 */
type Role =
  | { kind: 'stick'; ox: number; oy: number }
  | { kind: 'look'; x: number; y: number; t: number; v: number }
  | { kind: 'button'; action: Action; el: HTMLElement; slid: Set<HTMLElement> };

const GLYPHS: Record<string, string> = {
  light: '<path d="M10 38 L34 14 L40 8 L38 15 L14 41 Z"/><path d="M9 29 l10 10 M6 42 l4 -4" stroke-width="3" fill="none"/>',
  heavy: '<path d="M8 40 L31 10 L40 6 L37 15 L12 43 Z"/><path d="M5 31 l13 13 M13 27 L21 35" stroke-width="3" fill="none"/><path d="M40 28 a15 15 0 0 1 -13 15" fill="none" stroke-width="2.6"/>',
  block: '<path d="M24 5 L39 11 V23 C39 33 32 40 24 44 C16 40 9 33 9 23 V11 Z" fill="none" stroke-width="3"/><path d="M15 34 L33 12" stroke-width="3.2" fill="none"/>',
  jump: '<path d="M12 27 L24 14 L36 27" fill="none" stroke-width="4"/><path d="M15 37 L24 28 L33 37" fill="none" stroke-width="3" opacity=".7"/>',
  shift: '<path d="M15 7 H33 M15 41 H33 M17 7 C17 18 31 20 31 24 C31 28 17 30 17 41 M31 7 C31 18 17 20 17 24 C17 28 31 30 31 41" fill="none" stroke-width="2.8"/><path d="M20 37 C22 32 26 32 28 37 Z" stroke-width="1"/>',
  pause: '<path d="M15 10 H21 V38 H15 Z M27 10 H33 V38 H27 Z"/>',
  look: '<path d="M10 24 a14 14 0 0 1 28 0" fill="none" stroke-width="2.6"/><path d="M34 18 l4 6 l-7 1" fill="none" stroke-width="2.6"/><path d="M38 28 a14 14 0 0 1 -28 0" fill="none" stroke-width="2.6" opacity=".55"/>',
};

/** the role's device on the rim (drawn in a 100×100 box, centre 50,50) */
function device(kind: string): string {
  const pts = (n: number, r: number, f: (x: number, y: number, a: number) => string) => {
    let s = '';
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; s += f(50 + Math.cos(a) * r, 50 + Math.sin(a) * r, a); }
    return s;
  };
  if (kind === 'light') {
    // battlements: a crenellated ring (merlons) round the seal — the castle's own crown
    let d = '';
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n * 0.55;
      const p = (a: number, r: number) => `${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;
      d += `M${p(a0, 44)} L${p(a0, 48.5)} A48.5 48.5 0 0 1 ${p(a1, 48.5)} L${p(a1, 44)} Z `;
    }
    return `<path class="dev" d="${d}"/>`;
  }
  if (kind === 'heavy') return pts(8, 45.6, (x, y) => `<circle class="dev" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.3"/>`);
  if (kind === 'block') return pts(20, 45.6, (x, y) => `<circle class="dev" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.25"/>`);
  if (kind === 'jump') return '<path class="dev" d="M50 1.5 L55 8 L45 8 Z M50 98.5 L55 92 L45 92 Z M1.5 50 L8 45 L8 55 Z M98.5 50 L92 45 L92 55 Z"/>';
  return '';
}

const BUTTONS: { action: Action; icon: string; label: string; cls: string; shape: 'seal' | 'lozenge' }[] = [
  { action: 'light', icon: 'light', label: 'ATTACK', cls: 't-light', shape: 'seal' },
  { action: 'jump', icon: 'jump', label: 'JUMP', cls: 't-jump', shape: 'seal' },
  { action: 'heavy', icon: 'heavy', label: 'HEAVY', cls: 't-heavy', shape: 'seal' },
  { action: 'block', icon: 'block', label: 'GUARD', cls: 't-guard', shape: 'seal' },
  { action: 'shift', icon: 'shift', label: 'SHIFT', cls: 't-shift', shape: 'lozenge' },
];

/** shared gradients (document-global SVG defs) */
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="tg-gold" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#f3dca0"/><stop offset=".45" stop-color="#c49a52"/><stop offset="1" stop-color="#6e5025"/></linearGradient>
  <radialGradient id="tg-light" cx=".5" cy=".36" r=".7"><stop offset="0" stop-color="#8e2a22"/><stop offset=".62" stop-color="#3a0d0b"/><stop offset="1" stop-color="#170605"/></radialGradient>
  <radialGradient id="tg-heavy" cx=".5" cy=".36" r=".7"><stop offset="0" stop-color="#8a4a1c"/><stop offset=".62" stop-color="#34190b"/><stop offset="1" stop-color="#140905"/></radialGradient>
  <radialGradient id="tg-block" cx=".5" cy=".36" r=".7"><stop offset="0" stop-color="#4c5866"/><stop offset=".62" stop-color="#1b2027"/><stop offset="1" stop-color="#0b0d10"/></radialGradient>
  <radialGradient id="tg-jump" cx=".5" cy=".36" r=".7"><stop offset="0" stop-color="#6d6352"/><stop offset=".62" stop-color="#27231d"/><stop offset="1" stop-color="#0e0c0a"/></radialGradient>
  <radialGradient id="tg-shift" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#2f5577"/><stop offset=".64" stop-color="#0f1e2d"/><stop offset="1" stop-color="#070c12"/></radialGradient>
</defs></svg>`;

function face(b: typeof BUTTONS[number]): string {
  if (b.shape === 'lozenge') {
    return `<svg class="t-face" viewBox="0 0 100 100" aria-hidden="true">
      <path class="rim" d="M50 2 L98 50 L50 98 L2 50 Z"/>
      <path class="field" d="M50 11 L89 50 L50 89 L11 50 Z" fill="url(#tg-shift)"/>
      <path class="edge" d="M50 11 L89 50 L50 89 L11 50 Z"/>
      <path class="prog" pathLength="100" d="M50 2 L98 50 L50 98 L2 50 Z"/>
    </svg>`;
  }
  const grad = b.action === 'block' ? 'tg-block' : `tg-${b.action}`;
  return `<svg class="t-face" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="rim" cx="50" cy="50" r="43.6"/>
    ${device(b.action)}
    <circle class="field" cx="50" cy="50" r="39.5" fill="url(#${grad})"/>
    <circle class="edge" cx="50" cy="50" r="39.5"/>
    <circle class="gloss" cx="50" cy="50" r="33"/>
    ${b.action === 'light' || b.action === 'heavy' ? '<circle class="prog" pathLength="100" cx="50" cy="50" r="46.8" transform="rotate(-90 50 50)"/>' : ''}
  </svg>`;
}

/** touch camera: radians of yaw per stage width of slow drag (fast flicks gain up to 2x this) */
const LOOK_GAIN = 5.2;
/** touch look smoothing time constant (s): irons out 60-120 Hz touch-event jitter, never feels laggy */
const LOOK_SMOOTH = 0.03;
/** the look hint fades for good once the player has turned the camera this far (px of drag) */
const LOOK_LEARNED_PX = 900;
const LOOK_KEY = 'tcr-look-learned';

const svg = (id: string) => `<svg class="t-glyph" viewBox="0 0 48 48" aria-hidden="true">${GLYPHS[id]}</svg>`;

export interface TouchState {
  channel: number; canShift: boolean; guarding: boolean;
  /** hold progress on Attack / Heavy (0..1 toward the hold threshold), and whether the hold move is running */
  hold?: { light: number; heavy: number; lightOn: boolean; heavyOn: boolean };
  /** which buttons have an unlocked HOLD move */
  canHold?: { light: boolean; heavy: boolean };
}

export class TouchControls {
  root: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private interactEl: HTMLElement;
  private pointers = new Map<number, Role>();
  private buttons = new Map<Action, HTMLElement>();
  private progs = new Map<Action, SVGElement>();
  /** stick radius in CSS px (recomputed on layout) */
  private radius = 58;
  private stickId = -1;
  onPause?: () => void;

  constructor(stage: HTMLElement, private input: Input) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `${DEFS}
      <div class="t-stick-home"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-cluster">${BUTTONS.map((b) => `<div class="t-btn ${b.cls}" data-a="${b.action}">${face(b)}${svg(b.icon)}<span>${b.label}</span><em>HOLD</em></div>`).join('')}</div>
      <div class="t-look-hint">${svg('look')}<span>LOOK</span></div>
      <div class="t-cta" aria-live="polite">
        <div class="t-cta-line"></div>
        <div class="t-cta-dot"><i></i></div>
        <div class="t-cta-group">
          <div class="t-cta-btn t-btn" data-a="interact" role="button"><i class="t-cta-ring"></i><i class="t-cta-ripple"></i><b></b></div>
          <div class="t-cta-name"></div>
          <div class="t-cta-teach"><span class="t-cta-finger"></span><p>Tap here to use it — anything you can use shows this button.</p></div>
        </div>
      </div>
      <div class="t-pause" role="button" aria-label="Pause">${svg('pause')}</div>`;
    stage.appendChild(root);
    this.root = root;
    this.stickBase = root.querySelector('.t-stick') as HTMLElement;
    this.stickKnob = root.querySelector('.t-knob') as HTMLElement;
    this.interactEl = root.querySelector('.t-cta-btn') as HTMLElement;
    this.cta = root.querySelector('.t-cta') as HTMLElement;
    this.ctaGroup = root.querySelector('.t-cta-group') as HTMLElement;
    this.ctaLine = root.querySelector('.t-cta-line') as HTMLElement;
    this.ctaDot = root.querySelector('.t-cta-dot') as HTMLElement;
    this.ctaName = root.querySelector('.t-cta-name') as HTMLElement;
    this.ctaVerb = this.interactEl.querySelector('b') as HTMLElement;
    this.lookHint = root.querySelector('.t-look-hint') as HTMLElement;
    try { this.lookLearned = localStorage.getItem(LOOK_KEY) === '1'; } catch { /* storage unavailable */ }
    this.lookHint.classList.toggle('learned', this.lookLearned);
    root.querySelectorAll<HTMLElement>('.t-btn').forEach((el) => {
      this.buttons.set(el.dataset.a as Action, el);
      const prog = el.querySelector('.prog') as SVGElement | null;
      if (prog) this.progs.set(el.dataset.a as Action, prog);
    });
    root.addEventListener('pointerdown', this.onDown, { passive: false });
    root.addEventListener('pointermove', this.onMove, { passive: false });
    root.addEventListener('pointerup', this.onUp);
    root.addEventListener('pointercancel', this.onUp);
    root.addEventListener('lostpointercapture', this.onUp);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    (root.querySelector('.t-pause') as HTMLElement).addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.onPause?.(); });
    Platform.onChange(() => { this.layout(); if (!Platform.isTouch) this.releaseAll(); });
    this.layout();
  }

  private layout() {
    this.W = this.root.clientWidth || Platform.width; this.H = this.root.clientHeight || Platform.height;
    this.radius = Math.max(46, Math.min(72, Platform.width * 0.14));
    this.root.style.setProperty('--tu', String(Math.max(0.82, Math.min(1.3, Platform.width / 400))));
  }

  private lookHint: HTMLElement;
  private lookLearned = false;
  private lookPx = 0;

  // ------------------------------------------------------------------ the contextual button (session 14)
  private cta: HTMLElement; private ctaGroup: HTMLElement; private ctaLine: HTMLElement; private ctaDot: HTMLElement;
  private ctaName: HTMLElement; private ctaVerb: HTMLElement;
  private W = 400; private H = 800;
  private ctaPos = { x: -1, y: -1 };
  private ctaOn = false;
  private ctaRead = false;
  /**
   * The contextual button: a big seal over the thing itself (a Blood Sigil, a memory, the lift), labelled with what
   * a tap does — ACTIVATE, RENEW, INSPECT, DESCEND — and its name under it; `disabled` greys it (WAIT: enemies near) and
   * taps do nothing. It used to be a text pill in the middle of the screen that new players read as a message.
   */
  setInteract(text: string | null, title = '', disabled = false, verb = '', read = false) {
    const on = !!text;
    if (on && !this.ctaOn) this.ctaPos.x = -1;         // it appears where the thing is, not sliding in from before
    this.ctaOn = on;
    this.cta.classList.toggle('on', on);
    this.interactEl.classList.toggle('on', on);
    this.interactEl.classList.toggle('off', on && disabled);
    this.cta.classList.toggle('off', on && disabled);
    // already read: a small, muted seal (the tether and the ring on the object follow its size)
    this.ctaRead = on && read;
    this.cta.classList.toggle('read', this.ctaRead);
    if (on) {
      this.ctaVerb.textContent = (verb || text!.split(' ')[0]).toUpperCase();
      this.ctaName.textContent = disabled ? `${title} · ${text}` : title;
    } else this.teach(false);
  }

  /** the one-time lesson on the first Blood Sigil: a finger taps the button, one line says what it is */
  teach(on: boolean) { this.cta.classList.toggle('teach', on); }

  private _v = new THREE.Vector3();
  /**
   * Per frame while the button shows: stand it just above the thing's place on screen (kept out of the top bars and
   * the thumbs' arcs), a gold tether down to a pulsing ring on the thing itself. Off screen: it waits mid-frame with the
   * tether pointing the way. Transforms only (compositor), eased so it never jitters with the camera.
   */
  placeInteract(at: THREE.Vector3 | null, camera: THREE.Camera, dt: number) {
    if (!this.ctaOn) return;
    const W = this.W, H = this.H;
    let ax = W * 0.5, ay = H * 0.5, seen = false;
    if (at) {
      const v = this._v.copy(at).project(camera);
      if (v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15) { ax = (v.x + 1) * 0.5 * W; ay = (1 - v.y) * 0.5 * H; seen = true; }
      else { const s = v.z >= 1 ? -1 : 1; ax = W * 0.5 + Math.sign(v.x * s || 1) * W * 0.4; ay = H * 0.42; }
    }
    // the button: ~1 button above the thing, inside the free band of the portrait frame
    const u = W / 400;
    const tx = THREE.MathUtils.clamp(ax, W * 0.2, W * 0.8);
    const ty = THREE.MathUtils.clamp(ay - (this.ctaRead ? 72 : 96) * u, H * 0.2, H * 0.5);
    const k = this.ctaPos.x < 0 ? 1 : 1 - Math.exp(-dt * 12);
    this.ctaPos.x += (tx - this.ctaPos.x) * k;
    this.ctaPos.y += (ty - this.ctaPos.y) * k;
    const x = this.ctaPos.x, y = this.ctaPos.y;
    this.ctaGroup.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const dx = ax - x, dy = ay - y, len = Math.hypot(dx, dy);
    const r = (this.ctaRead ? 30 : 44) * u;
    const show = len > r + 8;
    this.ctaLine.style.opacity = show ? '' : '0';
    if (show) {
      this.ctaLine.style.width = `${(len - r - (seen ? 10 * u : 0)).toFixed(1)}px`;
      this.ctaLine.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(3)}rad) translateX(${r.toFixed(1)}px)`;
    }
    this.ctaDot.style.opacity = seen && show ? '' : '0';
    this.ctaDot.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
  }

  /** Pulse one button (tutorial: the first shift, the first guard ...); null clears. */
  highlight(action: Action | null) {
    for (const [a, el] of this.buttons) el.classList.toggle('teach', a === action);
  }
  /** Teach a HOLD move on a button (the unlock tip): its HOLD tag shows and the rim breathes; null clears. */
  holdHint(action: Action | null) {
    for (const [a, el] of this.buttons) el.classList.toggle('teach-hold', a === action);
  }
  /** a cinematic finisher is playing: the controls dim and ignore nothing (holds are released by the game) */
  cinematic(on: boolean) { this.root.classList.toggle('cine', on); }

  private progKey = new Map<Action, string>();
  private setProg(a: Action, f: number) {
    const el = this.progs.get(a);
    if (!el) return;
    const v = Math.max(0, Math.min(1, f));
    const key = v.toFixed(3);
    if (this.progKey.get(a) === key) return;
    this.progKey.set(a, key);
    el.setAttribute('stroke-dasharray', `${(v * 100).toFixed(2)} 100`);
  }

  /** swipe rotation not yet handed to the camera (released smoothly each frame by flushLook) */
  private lookBuf = { dx: 0, dy: 0 };
  /** Per frame (touch mode): feed the buffered swipe into the camera with a short exponential ease. */
  flushLook(dt: number) {
    const b = this.lookBuf;
    if (Math.abs(b.dx) + Math.abs(b.dy) < 1e-6) { b.dx = b.dy = 0; return; }
    const k = 1 - Math.exp(-Math.max(0, dt) / LOOK_SMOOTH);
    this.input.virtualLook.dx += b.dx * k;
    this.input.virtualLook.dy += b.dy * k;
    b.dx *= 1 - k; b.dy *= 1 - k;
  }

  /** Per-frame HUD state: guard/shift feedback, shift channel, hold progress. */
  update(state: TouchState) {
    this.setProg('shift', state.channel);
    this.buttons.get('shift')!.classList.toggle('dim', !state.canShift);
    this.buttons.get('shift')!.classList.toggle('channel', state.channel > 0);
    this.buttons.get('block')!.classList.toggle('held', state.guarding);
    this.buttons.get('light')!.classList.toggle('bash', state.guarding);
    this.buttons.get('heavy')!.classList.toggle('bash', state.guarding);
    const h = state.hold, c = state.canHold;
    for (const a of ['light', 'heavy'] as const) {
      const el = this.buttons.get(a)!;
      el.classList.toggle('can-hold', !!c?.[a]);
      const on = !!h?.[a === 'light' ? 'lightOn' : 'heavyOn'];
      el.classList.toggle('holding', on);
      this.setProg(a, h ? h[a] : 0);
    }
  }

  // ------------------------------------------------------------------ pointer routing
  private stageRect() { return this.root.getBoundingClientRect(); }

  private onDown = (e: PointerEvent) => {
    if (!Platform.isTouch) return;
    e.preventDefault();
    try { this.root.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    const btn = (e.target as HTMLElement).closest('.t-btn') as HTMLElement | null;
    const src = 'touch:' + e.pointerId;
    if (btn && btn.dataset.a && (btn !== this.interactEl || (btn.classList.contains('on') && !btn.classList.contains('off')))) {
      const action = btn.dataset.a as Action;
      this.input.press(action, src);
      btn.classList.add('down');
      this.pointers.set(e.pointerId, { kind: 'button', action, el: btn, slid: new Set() });
      return;
    }
    const r = this.stageRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    // left-lower zone owns the stick (one stick finger at a time); everything else turns the camera
    if (this.stickId < 0 && x < r.width * 0.46 && y > r.height * 0.42) {
      const R = this.radius;
      const ox = Math.max(R + 8, Math.min(r.width * 0.46 - R * 0.4, x));
      const oy = Math.max(r.height * 0.42 + R * 0.5, Math.min(r.height - R - 8, y));
      this.stickId = e.pointerId;
      this.pointers.set(e.pointerId, { kind: 'stick', ox, oy });
      this.stickBase.style.transform = `translate(${ox - R}px, ${oy - R}px)`;
      this.stickBase.style.width = this.stickBase.style.height = 2 * R + 'px';
      this.stickBase.classList.add('on');
      this.root.classList.add('sticking');
      this.moveStick(e.pointerId, x, y);
      return;
    }
    this.pointers.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY, t: e.timeStamp, v: 0 });
    this.root.classList.add('looking');
  };

  private onMove = (e: PointerEvent) => {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    e.preventDefault();
    if (role.kind === 'stick') {
      const r = this.stageRect();
      this.moveStick(e.pointerId, e.clientX - r.left, e.clientY - r.top);
    } else if (role.kind === 'look') {
      // resolution independent and fast (session 9 playtest: "I have to swipe too much"): a slow swipe across a
      // third of the stage already turns ~90°; quick flicks gain up to 2× more (swipe acceleration), so a short
      // thumb flick spins the camera round while slow drags stay precise. Vertical is gentler (pitch is clamped).
      const dx = e.clientX - role.x, dy = e.clientY - role.y;
      const dt = Math.max(0.004, Math.min(0.1, (e.timeStamp - role.t) / 1000));
      const speed = Math.hypot(dx, dy) / dt / Math.max(240, Platform.width);   // stage widths per second
      role.v += (speed - role.v) * 0.5;
      const k = LOOK_GAIN / Math.max(240, Platform.width) * (1 + Math.min(1, Math.max(0, role.v - 0.6) / 2.4));
      this.lookBuf.dx += dx * k;
      this.lookBuf.dy += dy * k * 0.62;
      role.t = e.timeStamp;
      if (!this.lookLearned) {
        this.lookPx += Math.abs(e.clientX - role.x) + Math.abs(e.clientY - role.y);
        if (this.lookPx > LOOK_LEARNED_PX) {
          this.lookLearned = true;
          this.lookHint.classList.add('learned');
          try { localStorage.setItem(LOOK_KEY, '1'); } catch { /* storage unavailable */ }
        }
      }
      role.x = e.clientX; role.y = e.clientY;
    } else if (role.action === 'block') {
      // slide from Guard onto an attack button: bash (light) / kick (heavy), once per entry, guard stays held
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.t-btn') as HTMLElement | null;
      for (const el of [...role.slid]) if (el !== over) { role.slid.delete(el); el.classList.remove('down'); }
      if (over && over !== role.el && !role.slid.has(over)) {
        const a = over.dataset.a as Action;
        if (a === 'light' || a === 'heavy') {
          role.slid.add(over);
          over.classList.add('down');
          const src = `touch:${e.pointerId}:slide`;
          this.input.press(a, src);
          this.input.release(a, src);
        }
      }
    }
  };

  private moveStick(id: number, x: number, y: number) {
    const role = this.pointers.get(id);
    if (!role || role.kind !== 'stick') return;
    const R = this.radius;
    let dx = x - role.ox, dy = y - role.oy;
    let d = Math.hypot(dx, dy);
    // dragging far past the rim drags the base along, so direction changes stay immediate
    if (d > R * 1.6) {
      const pull = (d - R * 1.6) / d;
      role.ox += dx * pull; role.oy += dy * pull;
      dx = x - role.ox; dy = y - role.oy; d = Math.hypot(dx, dy);
      this.stickBase.style.transform = `translate(${role.ox - R}px, ${role.oy - R}px)`;
    }
    const m = Math.min(1, d / R);
    const k = d > 1e-3 ? m / d : 0;
    // dead zone 12 %, rescaled so walking starts smoothly
    const mag = m < 0.12 ? 0 : (m - 0.12) / 0.88;
    this.input.analog.x = dx * k * (mag / Math.max(1e-3, m));
    this.input.analog.y = -dy * k * (mag / Math.max(1e-3, m));
    const sprint = this.input.analogSprint ? d > R * 0.86 : d > R * 0.97;
    this.input.analogSprint = sprint && mag > 0;
    this.stickBase.classList.toggle('sprint', this.input.analogSprint);
    this.stickKnob.style.transform = `translate(${dx * Math.min(1, R / Math.max(d, 1e-3))}px, ${dy * Math.min(1, R / Math.max(d, 1e-3))}px)`;
  }

  private onUp = (e: PointerEvent) => {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    this.pointers.delete(e.pointerId);
    this.input.releaseSource('touch:' + e.pointerId);
    if (role.kind === 'stick') this.endStick();
    else if (role.kind === 'look' && ![...this.pointers.values()].some((r) => r.kind === 'look')) this.root.classList.remove('looking');
    else if (role.kind === 'button') { role.el.classList.remove('down'); for (const el of role.slid) el.classList.remove('down'); }
  };

  private endStick() {
    this.stickId = -1;
    this.input.analog.x = this.input.analog.y = 0;
    this.input.analogSprint = false;
    this.stickBase.classList.remove('on', 'sprint');
    this.root.classList.remove('sticking');
    this.stickKnob.style.transform = '';
  }

  /** Drop every touch hold (switching to keyboard/mouse, pausing, rotating). */
  releaseAll() {
    this.lookBuf.dx = this.lookBuf.dy = 0;
    for (const [id, role] of this.pointers) {
      this.input.releaseSource('touch:' + id);
      if (role.kind === 'button') role.el.classList.remove('down');
    }
    this.pointers.clear();
    this.root.classList.remove('looking');
    this.endStick();
  }
}
