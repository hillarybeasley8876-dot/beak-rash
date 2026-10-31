// Keyboard + gamepad → abstract actions. Keyboard steering is ramped so it feels analog;
// edge actions (hop, attacks, skills) are latched until a sim step consumes them, so a tap
// during hit-stop or slow-mo is never lost.

import { approach, clamp } from './math';
import type { Controls } from './types';

export type Action =
  | 'left' | 'right' | 'up' | 'down' | 'drift' | 'hop' | 'attackL' | 'attackR' | 'heavy'
  | 'skill1' | 'skill2' | 'skill3' | 'ult' | 'bell' | 'lookBack' | 'pause' | 'confirm' | 'back';

export const KEYMAP: Record<Action, string[]> = {
  left: ['ArrowLeft', 'KeyA', 'TouchLeft'],
  right: ['ArrowRight', 'KeyD', 'TouchRight'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  drift: ['ShiftLeft', 'ShiftRight', 'TouchDrift'],
  hop: ['Space'],
  attackL: ['KeyJ'],
  heavy: ['KeyK', 'TouchHeavy'],
  attackR: ['KeyL'],
  skill1: ['KeyU'],
  skill2: ['KeyI'],
  skill3: ['KeyO'],
  ult: ['KeyP'],
  bell: ['KeyB'],
  lookBack: ['KeyC'],
  pause: ['Escape'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
};

/** On-screen binding inside KEYMAP (not a real KeyboardEvent.code). A finger and a physical key never share a code. */
export function touchCode(action: Action): string | undefined {
  return KEYMAP[action].find((code) => code.startsWith('Touch'));
}

/** Standard-mapping gamepad buttons per action. */
export const PADMAP: Partial<Record<Action, number[]>> = {
  hop: [0], confirm: [0], attackR: [1], back: [1], attackL: [2], heavy: [3],
  skill1: [4], drift: [5], down: [6], up: [7], bell: [8], pause: [9],
  lookBack: [10], ult: [11], skill2: [12], skill3: [13], left: [14], right: [15],
};

const EDGE_ACTIONS = ['hop', 'attackL', 'attackR', 'heavy', 'skill1', 'skill2', 'skill3', 'ult', 'bell'] as const;
type EdgeAction = (typeof EDGE_ACTIONS)[number];

const STEER_RISE = 6.5;   // /s, digital (keyboard / d-pad) steer ramp toward full lock
const STEER_FALL = 11;    // /s, ramp back to centre
const STICK_DEADZONE = 0.14;
const MOUSE_BACK = 3;     // MouseEvent.button of the side "back" button
const MOUSE_FORWARD = 4;

export class Input {
  steer = 0;
  throttle = 0;
  brake = 0;
  autoPedal = false;
  /** Test/autopilot override: replaces device input entirely while set. */
  scripted: Partial<Controls> | null = null;
  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';

  private keys = new Set<string>();
  private padDown = new Set<Action>();
  private padPrev = new Set<Action>();
  private edges = new Set<EdgeAction>();
  private listeners = new Set<(action: Action) => void>();
  private padSteer = 0;
  private padThrottle = 0;
  private padBrake = 0;
  private detach: (() => void) | null = null;

  attach(target: Window): void {
    // Tab would move focus to the browser chrome (the race auto-pauses on blur and menus stop hearing keys).
    const captured = new Set([...Object.values(KEYMAP).flat(), 'Tab']);
    const onDown = (e: KeyboardEvent): void => {
      if (captured.has(e.code)) e.preventDefault();
      this.lastDevice = 'keyboard';
      if (e.repeat) return;
      this.keys.add(e.code);
      for (const action of this.actionsForKey(e.code)) this.press(action);
    };
    const onUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    const onBlur = (): void => this.keys.clear();
    // Right-click and the mouse back button mean 'back' (no browser menu over the game, no history navigation).
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      this.press('back');
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (e.button !== MOUSE_BACK && e.button !== MOUSE_FORWARD) return;
      e.preventDefault();
      if (e.button === MOUSE_BACK) this.press('back');
    };
    target.addEventListener('keydown', onDown);
    target.addEventListener('keyup', onUp);
    target.addEventListener('blur', onBlur);
    target.addEventListener('contextmenu', onContextMenu);
    target.addEventListener('mouseup', onMouseUp);
    this.detach = () => {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('contextmenu', onContextMenu);
      target.removeEventListener('mouseup', onMouseUp);
    };
  }

  dispose(): void {
    this.detach?.();
    this.listeners.clear();
  }

  /** Menu/UI listeners: called on every fresh press from any device. */
  onAction(fn: (action: Action) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isDown(action: Action): boolean {
    return this.padDown.has(action) || KEYMAP[action].some((code) => this.keys.has(code));
  }

  /** Simulate a press (tests, on-screen buttons). Edges latch; this does not hold a key. */
  press(action: Action): void {
    if ((EDGE_ACTIONS as readonly string[]).includes(action)) this.edges.add(action as EdgeAction);
    for (const fn of Array.from(this.listeners)) {
      try {
        fn(action);
      } catch (err) {
        console.error('[input] action listener threw', err);
      }
    }
  }

  /**
   * On-screen button down. Holds the action through its virtual KEYMAP code (steer, drift, heavy)
   * and fires press() once, so isDown / digital steer / heavyHeld stay on the keyboard path.
   * No-op when the action has no touch code or the finger is already down.
   */
  hold(action: Action): void {
    const code = touchCode(action);
    if (!code || this.keys.has(code)) return;
    this.keys.add(code);
    this.lastDevice = 'keyboard';
    this.press(action);
  }

  /** On-screen button up. Drops the virtual KEYMAP code; a latched edge stays until consumeEdges(). */
  release(action: Action): void {
    const code = touchCode(action);
    if (code) this.keys.delete(code);
  }

  /** Per rendered frame: poll gamepads and ramp analog values. */
  update(dtReal: number): void {
    this.pollPad();
    const digital = this.digitalSteer();
    if (Math.abs(this.padSteer) > 0) {
      this.steer = this.padSteer;
    } else if (digital !== 0) {
      if (Math.sign(this.steer) === -digital) this.steer = 0; // instant reversal through centre
      this.steer = approach(this.steer, digital, STEER_RISE * dtReal);
    } else {
      this.steer = approach(this.steer, 0, STEER_FALL * dtReal);
    }
    const kbThrottle = this.isKeyDown('up') ? 1 : 0;
    const kbBrake = this.isKeyDown('down') ? 1 : 0;
    this.brake = Math.max(kbBrake, this.padBrake);
    const wantThrottle = Math.max(kbThrottle, this.padThrottle, this.autoPedal && this.brake === 0 ? 1 : 0);
    this.throttle = approach(this.throttle, wantThrottle, 9 * dtReal);
  }

  /** Current player controls; edges stay latched until consumeEdges(). */
  peek(out: Controls): Controls {
    if (this.scripted) {
      Object.assign(out, { steer: 0, throttle: 0, brake: 0, drift: false, lookBack: false, heavyHeld: false }, this.scripted);
    } else {
      out.steer = this.steer;
      out.throttle = this.throttle;
      out.brake = this.brake;
      out.drift = this.isDown('drift');
      out.lookBack = this.isDown('lookBack');
      out.heavyHeld = this.isDown('heavy');
    }
    for (const a of EDGE_ACTIONS) out[a] = this.edges.has(a) || (this.scripted?.[a] ?? false);
    return out;
  }

  consumeEdges(): void {
    this.edges.clear();
    if (this.scripted) for (const a of EDGE_ACTIONS) this.scripted[a] = false;
  }

  rumble(strong: number, weak: number, ms: number): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      const actuator = pad?.vibrationActuator as
        | { playEffect?: (type: string, p: Record<string, number>) => Promise<unknown> }
        | undefined;
      actuator?.playEffect?.('dual-rumble', {
        duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1),
      }).catch((err: unknown) => console.warn('[input] rumble failed', err));
    }
  }

  private isKeyDown(action: Action): boolean {
    return KEYMAP[action].some((code) => this.keys.has(code));
  }

  /** Digital steering (arrows / A-D and the pad's d-pad, for pads without a stick) in -1..1. */
  private digitalSteer(): number {
    const right = this.isKeyDown('right') || this.padDown.has('right');
    const left = this.isKeyDown('left') || this.padDown.has('left');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  private actionsForKey(code: string): Action[] {
    return (Object.keys(KEYMAP) as Action[]).filter((a) => KEYMAP[a].includes(code));
  }

  private pollPad(): void {
    const pad = (navigator.getGamepads?.() ?? []).find((p) => p && p.connected) ?? null;
    this.padPrev = this.padDown;
    this.padDown = new Set();
    this.padSteer = this.padThrottle = this.padBrake = 0;
    if (!pad) return;
    for (const action of Object.keys(PADMAP) as Action[]) {
      if ((PADMAP[action] ?? []).some((i) => pad.buttons[i]?.pressed)) this.padDown.add(action);
    }
    const ax = pad.axes[0] ?? 0;
    const mag = Math.abs(ax);
    if (mag > STICK_DEADZONE) this.padSteer = Math.sign(ax) * Math.pow((mag - STICK_DEADZONE) / (1 - STICK_DEADZONE), 1.5);
    this.padThrottle = pad.buttons[7]?.value ?? 0;
    this.padBrake = pad.buttons[6]?.value ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (ay < -0.6) this.padDown.add('up');
    if (ay > 0.6) this.padDown.add('down');
    for (const action of this.padDown) {
      if (!this.padPrev.has(action)) {
        this.lastDevice = 'gamepad';
        this.press(action);
      }
    }
  }
}
