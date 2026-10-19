// Device-aware key glyphs: every HUD key badge carries both the keyboard and the gamepad label. hud.ts
// toggles .is-pad on the HUD root from app.input.lastDevice and css/base.css shows the matching one,
// so prompts follow the device in use live (like ui-screens' keyGlyph() under .br-ui.is-pad).
import { el } from './dom';

export type HudKey =
  | 'skill1' | 'skill2' | 'skill3' | 'ult' | 'confirm' | 'up'
  | 'attackL' | 'attackR' | 'heavy' | 'drift' | 'hop';

/** [keyboard, gamepad] labels for core/input.ts KEYMAP / PADMAP (same names as the pause sheet). */
export const KEY_LABELS: Record<HudKey, readonly [string, string]> = {
  skill1: ['U', 'LB'],
  skill2: ['I', '✚↑'],
  skill3: ['O', '✚↓'],
  ult: ['P', 'R3'],
  confirm: ['ENTER', 'A'],
  up: ['W / ↑', 'RT'],
  attackL: ['J', 'X'],
  attackR: ['L', 'B'],
  heavy: ['K', 'Y'],
  drift: ['SHIFT', 'RB'],
  hop: ['SPACE', 'A'],
};

/** The skill slots' keys in diamond order (U / I / O). */
export const SLOT_KEYS: readonly HudKey[] = ['skill1', 'skill2', 'skill3'];

/** Append both labels of `key` to `parent`; CSS shows the keyboard one, or the pad one under .brh.is-pad. */
export function keyGlyphs(parent: HTMLElement, key: HudKey): HTMLElement {
  const [kb, pad] = KEY_LABELS[key];
  el('span', 'kg-kb', parent, kb);
  el('span', 'kg-pad', parent, pad);
  return parent;
}
