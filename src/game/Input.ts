/**
 * Keyboard + mouse (pointer lock) input with an injectable virtual layer.
 * Gameplay reads semantic actions only; the autopilot/test harness drives the same actions.
 */
export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'sprint' | 'jump' | 'crouch'
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
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private pressTime = new Map<Action, number>();
  private virtual = new Set<Action>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;
  virtualLook = { dx: 0, dy: 0 };
  sensitivity = 0.0022;
  enabled = true;
  private time = 0;

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === 'lock' || a === 'jump') e.preventDefault();
      if (e.repeat) return;
      this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    el.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        el.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.press('light');
      if (e.button === 2) this.press('heavy');
      if (e.button === 1) { e.preventDefault(); this.press('lock'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.release('light');
      if (e.button === 2) this.release('heavy');
      if (e.button === 1) this.release('lock');
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
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  press(a: Action) {
    if (!this.down.has(a)) {
      this.pressed.add(a);
      this.pressTime.set(a, this.time);
    }
    this.down.add(a);
  }

  release(a: Action) {
    if (this.down.has(a)) this.released.add(a);
    this.down.delete(a);
  }

  /** Virtual (autopilot) hold state, merged with real input. */
  isVirtual(a: Action) { return this.virtual.has(a); }
  setVirtual(a: Action, on: boolean) {
    const was = this.virtual.has(a);
    if (on && !was) { this.virtual.add(a); this.press(a); }
    if (!on && was) { this.virtual.delete(a); this.release(a); }
  }
  tapVirtual(a: Action) { this.press(a); this.release(a); }

  isDown(a: Action) { return this.enabled && this.down.has(a); }
  wasPressed(a: Action) { return this.enabled && this.pressed.has(a); }
  wasReleased(a: Action) { return this.enabled && this.released.has(a); }
  heldFor(a: Action) { return this.down.has(a) ? this.time - (this.pressTime.get(a) ?? this.time) : 0; }
  /** How long the action was held before its release this frame (for tap detection). */
  releasedAfter(a: Action) { return this.released.has(a) ? this.time - (this.pressTime.get(a) ?? this.time) : -1; }

  moveAxes(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.isDown('forward')) y += 1;
    if (this.isDown('back')) y -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('left')) x -= 1;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  consumeLook(): { dx: number; dy: number } {
    const dx = this.mouseDX * this.sensitivity + this.virtualLook.dx;
    const dy = this.mouseDY * this.sensitivity + this.virtualLook.dy;
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
