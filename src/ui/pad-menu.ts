// Gamepad comfort for menus (core Input only knows racing): left stick X → left/right, hold-to-repeat on
// the d-pad / stick, and LT/RT (mapped to up/down for racing) kept out of menu navigation.
import type { Action } from '../core/input';

const STICK_ON = 0.6;
const STICK_OFF = 0.35;
const REPEAT_DELAY = 0.38;
const REPEAT_EVERY = 0.11;
type Dir = 'up' | 'down' | 'left' | 'right';

/** Standard mapping: d-pad 12 up, 13 down, 14 left, 15 right; LT 6, RT 7. */
const DPAD: Record<Dir, number> = { up: 12, down: 13, left: 14, right: 15 };

function activePad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

export class PadMenu {
  private stickX: -1 | 0 | 1 = 0;
  private held: Dir | null = null;
  private heldFor = 0;
  private nextRepeat = 0;

  constructor(private readonly emit: (a: Action) => void) {}

  /** True when an up/down press came from a trigger alone (no d-pad, no stick): menus ignore it. */
  fromTrigger(a: Action): boolean {
    if (a !== 'up' && a !== 'down') return false;
    const pad = activePad();
    if (!pad) return false;
    const trigger = pad.buttons[a === 'up' ? 7 : 6]?.pressed ?? false;
    const ay = pad.axes[1] ?? 0;
    const dpad = pad.buttons[DPAD[a]]?.pressed ?? false;
    const stick = a === 'up' ? ay < -STICK_ON : ay > STICK_ON;
    return trigger && !dpad && !stick;
  }

  /** Per frame while a menu screen is up. */
  update(dt: number): void {
    const pad = activePad();
    if (!pad) {
      this.stickX = 0;
      this.held = null;
      return;
    }
    const ax = pad.axes[0] ?? 0;
    const was = this.stickX;
    if (was === 0 && Math.abs(ax) > STICK_ON) this.stickX = ax > 0 ? 1 : -1;
    else if (was !== 0 && Math.abs(ax) < STICK_OFF) this.stickX = 0;
    if (this.stickX !== 0 && this.stickX !== was) this.emit(this.stickX > 0 ? 'right' : 'left');
    this.repeat(this.heldDir(pad), dt);
  }

  private heldDir(pad: Gamepad): Dir | null {
    const ay = pad.axes[1] ?? 0;
    for (const d of Object.keys(DPAD) as Dir[]) if (pad.buttons[DPAD[d]]?.pressed) return d;
    if (ay < -STICK_ON) return 'up';
    if (ay > STICK_ON) return 'down';
    if (this.stickX !== 0) return this.stickX > 0 ? 'right' : 'left';
    return null;
  }

  /** The first press comes from core Input (or the stick edge above); this adds the repeats. */
  private repeat(dir: Dir | null, dt: number): void {
    if (dir !== this.held) {
      this.held = dir;
      this.heldFor = 0;
      this.nextRepeat = REPEAT_DELAY;
      return;
    }
    if (!dir) return;
    this.heldFor += dt;
    if (this.heldFor < this.nextRepeat) return;
    this.nextRepeat += REPEAT_EVERY;
    this.emit(dir);
  }
}
