// Easter eggs: ordered key sequences (P-E-L-I-C-A-N on the menu, the Konami code later) and the
// P5 speech bubble they draw. A sequence is a plain list of KeyboardEvent.codes: the whole word has
// to land within the window of its first key, a wrong key wipes the run and the first key starts over.
import './eggs.css';
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

/** A P5 speech bubble: a jagged white plate with a tail, drawn next to the character that talks. */
export function eggBubble(text: string, seed: string): HTMLDivElement {
  return h('div', { class: 'br-egg-bubble' },
    h('div', { class: 'br-egg-bubble-plate', vars: { '--clip': jagged(seed, { jx: 1.5, jy: 5, notches: 2 }) }, text }),
    h('div', { class: 'br-egg-bubble-tail' }));
}
