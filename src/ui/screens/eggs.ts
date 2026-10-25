// Easter eggs: ordered key sequences (P-E-L-I-C-A-N on the menu, the Konami code later) and the
// P5 speech bubble they draw. A sequence is a plain list of KeyboardEvent.codes: the whole word has
// to land within the window of its first key, a wrong key wipes the run and the first key starts over.
// The Konami code lives on the ACTION stream instead (keyboard and pad alike), so it gets its own
// matcher: createActionCode.
import './eggs.css';
import type { Action } from '../../core/input';
import { h, jagged } from '../p5';

export interface Sequence {
  /** Feed a KeyboardEvent.code; true when the whole sequence has been typed, in order. */
  push(code: string): boolean;
  reset(): void;
}

/**
 * An ordered key sequence. `windowMs` is measured from the first key of the current run: a slower
 * word (or a wrong key in between) drops the progress back to zero.
 */
export function createSequence(codes: readonly string[], windowMs = 4000): Sequence {
  let index = 0;
  let startedAt = 0;
  const reset = (): void => {
    index = 0;
    startedAt = 0;
  };
  return {
    reset,
    push(code: string): boolean {
      const now = performance.now();
      if (index > 0 && now - startedAt > windowMs) reset();
      if (code === codes[index]) {
        index += 1;
        if (index === 1) startedAt = now;
        if (index === codes.length) {
          reset();
          return true;
        }
        return false;
      }
      // A wrong key wipes the run; typing the first key again starts a fresh one.
      if (code === codes[0]) {
        index = 1;
        startedAt = now;
        return false;
      }
      reset();
      return false;
    },
  };
}

/** One step of an action code: the actions that satisfy it, and whether it swallows the action. */
export interface CodeStep {
  /** Actions that satisfy this step (a pad press sends two: the twin is dropped by the shell). */
  actions: readonly string[];
  /** The step eats the action: the screen must not act on it (the menu's back / confirm). */
  consume?: boolean;
}

export interface CodeResult {
  /** The action matched the step that was expected. */
  matched: boolean;
  /** The caller must swallow the action (the step asked for it). */
  consume: boolean;
  /** The whole code has been typed. */
  done: boolean;
}

export interface ActionCode {
  /** Feed one action; the result says what the screen should do with it. */
  push(action: Action): CodeResult;
  /** Forget the run (the next action starts a new one). */
  reset(): void;
  /** Steps matched so far (0 = nothing typed yet). */
  readonly index: number;
}

/**
 * An ordered code of ACTIONS (not key codes), so the same code works on a keyboard and on a pad.
 * `windowMs` is measured from the first action of the run: a slower code (or a wrong action in
 * between) drops the progress back to zero.
 */
export function createActionCode(steps: readonly CodeStep[], windowMs = 6000): ActionCode {
  let index = 0;
  let startedAt = 0;
  const reset = (): void => {
    index = 0;
    startedAt = 0;
  };
  const first = steps[0];
  return {
    reset,
    get index(): number { return index; },
    push(action: Action): CodeResult {
      const now = performance.now();
      if (index > 0 && now - startedAt > windowMs) reset();
      const step = steps[index];
      if (!step) return { matched: false, consume: false, done: false };
      if (!step.actions.includes(action)) {
        // A wrong action wipes the run; typing the first step's action again starts a fresh one.
        if (first?.actions.includes(action)) {
          index = 1;
          startedAt = now;
          return { matched: true, consume: false, done: false };
        }
        reset();
        return { matched: false, consume: false, done: false };
      }
      index += 1;
      if (index === 1) startedAt = now;
      const done = index === steps.length;
      if (done) reset();   // the code may be typed again later
      return { matched: true, consume: step.consume === true, done };
    },
  };
}

/** A P5 speech bubble: a jagged white plate with a tail, drawn next to the character that talks. */
export function eggBubble(text: string, seed: string): HTMLDivElement {
  return h('div', { class: 'br-egg-bubble' },
    h('div', { class: 'br-egg-bubble-plate', vars: { '--clip': jagged(seed, { jx: 1.5, jy: 5, notches: 2 }) }, text }),
    h('div', { class: 'br-egg-bubble-tail' }));
}
