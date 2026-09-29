/**
 * Semantic input: keyboard + mouse (pointer lock), the touch HUD (ui/TouchControls) and the virtual layer used
 * by the autopilot/test harness all drive the same actions. Gameplay reads actions only.
 *
 * Holds are counted per SOURCE (a key code, a mouse button, a touch pointer id, 'virtual'): an action is down
 * while any source holds it, "pressed" when the first source grabs it and "released" when the last lets go.
 * So W + ArrowUp, or two fingers on the same button, never cancel each other.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'sprint' | 'jump' | 'crouch' | 'dodge'
  | 'light' | 'heavy' | 'block' | 'kick'
  | 'shift' | 'interact' | 'lock' | 'pause' | 'debug';

const KEYMAP: Record<string, Action> = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch',
  KeyQ: 'block', KeyF: 'kick', KeyR: 'shift', KeyE: 'interact', Tab: 'lock',
  Escape: 'pause', Backquote: 'debug',
};

export class Input {
  private holds = new Map<Action, Set<string>>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private pressTime = new Map<Action, number>();
  private virtual = new Set<Action>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;
  virtualLook = { dx: 0, dy: 0 };
  sensitivity = 0.0022;
  /** Settings → Camera sensitivity (mouse and touch swipes) */
  lookScale = 1;
  enabled = true;
  /** Analog stick (touch joystick): x right, y forward, magnitude 0..1. Merged with WASD in moveAxes(). */
  analog = { x: 0, y: 0 };
  /** Stick pushed to its rim: sprint without the Shift hold/tap ambiguity. */
  analogSprint = false;
  /** Touch devices: crouch automatically under low ceilings and stand up after (Player). */
  autoCrouch = false;
  private time = 0;

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === 'lock' || a === 'jump') e.preventDefault();
      if (e.repeat) return;
      this.press(a, 'key:' + e.code);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a, 'key:' + e.code);
    });
    el.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        el.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.press('light', 'mouse:0');
      if (e.button === 2) this.press('heavy', 'mouse:2');
      if (e.button === 1) { e.preventDefault(); this.press('lock', 'mouse:1'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.release('light', 'mouse:0');
      if (e.button === 2) this.release('heavy', 'mouse:2');
      if (e.button === 1) this.release('lock', 'mouse:1');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  /** Grab `a` for `source`. 'virtual' is the autopilot/test source. */
  press(a: Action, source = 'virtual') {
    let set = this.holds.get(a);
    if (!set) this.holds.set(a, set = new Set());
    if (set.size === 0) {
      this.pressed.add(a);
      this.pressTime.set(a, this.time);
    }
    set.add(source);
  }

  release(a: Action, source = 'virtual') {
    const set = this.holds.get(a);
    if (!set || !set.has(source)) return;
    set.delete(source);
    if (set.size === 0) this.released.add(a);
  }

  /** Release everything one source (and its ':'-suffixed sub-sources) holds — a lifted finger. */
  releaseSource(source: string) {
    for (const [a, set] of this.holds) for (const s of [...set]) if (s === source || s.startsWith(source + ':')) this.release(a, s);
  }

  releaseAll() {
    for (const [a, set] of this.holds) if (set.size) { set.clear(); this.released.add(a); }
    this.analog.x = this.analog.y = 0;
    this.analogSprint = false;
  }

  /** Virtual (autopilot) hold state, merged with real input. */
  isVirtual(a: Action) { return this.virtual.has(a); }
  setVirtual(a: Action, on: boolean) {
    const was = this.virtual.has(a);
    if (on && !was) { this.virtual.add(a); this.press(a, 'virtual'); }
    if (!on && was) { this.virtual.delete(a); this.release(a, 'virtual'); }
  }
  tapVirtual(a: Action) { this.press(a, 'tap'); this.release(a, 'tap'); }

  private held(a: Action) { return (this.holds.get(a)?.size ?? 0) > 0; }
  isDown(a: Action) { return this.enabled && this.held(a); }
  wasPressed(a: Action) { return this.enabled && this.pressed.has(a); }
  wasReleased(a: Action) { return this.enabled && this.released.has(a); }
  heldFor(a: Action) { return this.held(a) ? this.time - (this.pressTime.get(a) ?? this.time) : 0; }
  /** How long the action was held before its release this frame (for tap detection). */
  releasedAfter(a: Action) { return this.released.has(a) ? this.time - (this.pressTime.get(a) ?? this.time) : -1; }

  moveAxes(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.isDown('forward')) y += 1;
    if (this.isDown('back')) y -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('left')) x -= 1;
    if (this.enabled && (this.analog.x || this.analog.y)) { x += this.analog.x; y += this.analog.y; }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  consumeLook(): { dx: number; dy: number } {
    const dx = (this.mouseDX * this.sensitivity + this.virtualLook.dx) * this.lookScale;
    const dy = (this.mouseDY * this.sensitivity + this.virtualLook.dy) * this.lookScale;
    this.mouseDX = this.mouseDY = 0;
    this.virtualLook.dx = this.virtualLook.dy = 0;
    return { dx, dy };
  }

  /** Call at the end of each frame. */
  endFrame(dt: number) {
    this.pressed.clear();
    this.released.clear();
    this.time += dt;
  }
  get now() { return this.time; }
}
