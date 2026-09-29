import type { Action, Input } from '../game/Input';
import { Platform } from '../platform/Platform';

/**
 * Touch HUD (shown only while Platform.inputMode === 'touch').
 *
 *   left thumb   floating joystick (lower-left zone); pushing to the rim sprints
 *   right thumb  drag any empty area to turn the camera
 *   buttons      Light (large) with Heavy · Guard · Dodge · Jump in an arc around it, Hold-to-Shift above,
 *                a small lock-on toggle, a contextual Interact pill, pause
 *
 * Every pointer is owned by exactly one role (stick / look / button) from pointerdown to pointerup, and holds
 * are registered with Input per pointer id, so one finger can never release or cancel another's input:
 * move + look, move + attack, move + guard, look + attack all work together.
 *
 * Guard + attack with one thumb: a finger that went down on Guard keeps guarding while it slides; sliding onto
 * Light (shield bash) or Heavy (kick) fires that attack once. A second finger tapping them works too.
 */
type Role =
  | { kind: 'stick'; ox: number; oy: number }
  | { kind: 'look'; x: number; y: number }
  | { kind: 'button'; action: Action; el: HTMLElement; slid: Set<HTMLElement> };

const ICONS: Record<string, string> = {
  light: '<path d="M6 42 L38 10 L42 6 L40 12 L10 44 Z" /><path d="M9 33 l8 8 M4 44 l4 -4" stroke-width="3"/>',
  heavy: '<path d="M8 40 L34 8 L42 4 L40 12 L12 42 Z" /><path d="M4 30 l16 16 M14 26 L22 34" stroke-width="3"/><path d="M40 30 a14 14 0 0 1 -12 14" fill="none" stroke-width="2.5"/>',
  block: '<path d="M24 4 L41 10 L39 26 C37 36 31 42 24 45 C17 42 11 36 9 26 L7 10 Z" /><path d="M24 11 V38 M15 20 H33" stroke-width="2.5" fill="none"/>',
  dodge: '<path d="M8 30 C16 14 30 10 42 14" fill="none" stroke-width="4"/><path d="M36 6 L44 14 L34 20" fill="none" stroke-width="4"/><path d="M6 38 h10 M10 44 h8" stroke-width="3"/>',
  jump: '<path d="M10 30 L24 14 L38 30" fill="none" stroke-width="5"/><path d="M24 16 V42" stroke-width="4"/>',
  shift: '<path d="M14 6 H34 M14 42 H34 M16 6 C16 18 32 20 32 24 C32 28 16 30 16 42 M32 6 C32 18 16 20 16 24 C16 28 32 30 32 42" fill="none" stroke-width="3"/>',
  lock: '<circle cx="24" cy="24" r="12" fill="none" stroke-width="3"/><path d="M24 4 V14 M24 34 V44 M4 24 H14 M34 24 H44" stroke-width="3"/>',
  pause: '<path d="M15 10 H21 V38 H15 Z M27 10 H33 V38 H27 Z"/>',
};

const BUTTONS: { action: Action; icon: string; label: string; cls: string }[] = [
  { action: 'light', icon: 'light', label: 'ATTACK', cls: 't-light' },
  { action: 'heavy', icon: 'heavy', label: 'HEAVY', cls: 't-heavy' },
  { action: 'block', icon: 'block', label: 'GUARD', cls: 't-guard' },
  { action: 'dodge', icon: 'dodge', label: 'DODGE', cls: 't-dodge' },
  { action: 'jump', icon: 'jump', label: 'JUMP', cls: 't-jump' },
  { action: 'shift', icon: 'shift', label: 'SHIFT', cls: 't-shift' },
  { action: 'lock', icon: 'lock', label: '', cls: 't-lock' },
];

const svg = (id: string) => `<svg viewBox="0 0 48 48" aria-hidden="true">${ICONS[id]}</svg>`;

export class TouchControls {
  root: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private interactEl: HTMLElement;
  private shiftRing: HTMLElement;
  private pointers = new Map<number, Role>();
  private buttons = new Map<Action, HTMLElement>();
  /** stick radius in CSS px (recomputed on layout) */
  private radius = 58;
  private stickId = -1;
  onPause?: () => void;

  constructor(stage: HTMLElement, private input: Input) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-stick-home"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-cluster">${BUTTONS.map((b) => `<div class="t-btn ${b.cls}" data-a="${b.action}">${svg(b.icon)}${b.label ? `<span>${b.label}</span>` : ''}</div>`).join('')}</div>
      <div class="t-interact t-btn" data-a="interact"><span></span></div>
      <div class="t-pause" role="button" aria-label="Pause">${svg('pause')}</div>`;
    stage.appendChild(root);
    this.root = root;
    this.stickBase = root.querySelector('.t-stick') as HTMLElement;
    this.stickKnob = root.querySelector('.t-knob') as HTMLElement;
    this.interactEl = root.querySelector('.t-interact') as HTMLElement;
    root.querySelectorAll<HTMLElement>('.t-btn').forEach((el) => this.buttons.set(el.dataset.a as Action, el));
    this.shiftRing = document.createElement('i');
    this.shiftRing.className = 't-ring';
    this.buttons.get('shift')!.appendChild(this.shiftRing);
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
    this.radius = Math.max(46, Math.min(72, Platform.width * 0.14));
    this.root.style.setProperty('--tu', String(Math.max(0.82, Math.min(1.3, Platform.width / 400))));
  }

  /** Contextual interact pill (null hides it). */
  setInteract(text: string | null) {
    this.interactEl.classList.toggle('on', !!text);
    if (text) (this.interactEl.firstElementChild as HTMLElement).textContent = text;
  }

  /** Per-frame HUD state: guard/shift feedback, lock-on state, shift channel ring. */
  update(state: { channel: number; locked: boolean; canShift: boolean; guarding: boolean }) {
    this.shiftRing.style.setProperty('--p', String(state.channel));
    this.buttons.get('shift')!.classList.toggle('dim', !state.canShift);
    this.buttons.get('lock')!.classList.toggle('active', state.locked);
    this.buttons.get('block')!.classList.toggle('held', state.guarding);
    this.buttons.get('light')!.classList.toggle('bash', state.guarding);
    this.buttons.get('heavy')!.classList.toggle('bash', state.guarding);
  }

  // ------------------------------------------------------------------ pointer routing
  private stageRect() { return this.root.getBoundingClientRect(); }

  private onDown = (e: PointerEvent) => {
    if (!Platform.isTouch) return;
    e.preventDefault();
    try { this.root.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    const btn = (e.target as HTMLElement).closest('.t-btn') as HTMLElement | null;
    const src = 'touch:' + e.pointerId;
    if (btn && btn.dataset.a && (btn !== this.interactEl || btn.classList.contains('on'))) {
      const action = btn.dataset.a as Action;
      this.input.press(action, src);
      btn.classList.add('down');
      this.pointers.set(e.pointerId, { kind: 'button', action, el: btn, slid: new Set() });
      return;
    }
    const r = this.stageRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    // left-lower zone owns the stick (one stick finger at a time); everything else turns the camera
    if (this.stickId < 0 && x < r.width * 0.5 && y > r.height * 0.42) {
      const R = this.radius;
      const ox = Math.max(R + 8, Math.min(r.width * 0.5 - R * 0.4, x));
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
    this.pointers.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
  };

  private onMove = (e: PointerEvent) => {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    e.preventDefault();
    if (role.kind === 'stick') {
      const r = this.stageRect();
      this.moveStick(e.pointerId, e.clientX - r.left, e.clientY - r.top);
    } else if (role.kind === 'look') {
      // resolution independent: a swipe across the whole stage turns ~150°
      const k = 2.6 / Math.max(240, Platform.width);
      this.input.virtualLook.dx += (e.clientX - role.x) * k;
      this.input.virtualLook.dy += (e.clientY - role.y) * k * 0.75;
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
    for (const [id, role] of this.pointers) {
      this.input.releaseSource('touch:' + id);
      if (role.kind === 'button') role.el.classList.remove('down');
    }
    this.pointers.clear();
    this.endStick();
  }
}
