// Motion preference (设置 › 动态效果: 跟随系统 / 减弱 / 完整) and the one reducedMotion() answer that menus,
// HUD, fx and the camera read every frame: the in-game choice wins, 'system' follows the OS
// prefers-reduced-motion flag. Kept in its own localStorage key (the settings row has written it since v1.0).
export type MotionPref = 'system' | 'reduced' | 'full';

const KEY = 'beak-rash.motion';
const VALUES: readonly string[] = ['system', 'reduced', 'full'];
const isPref = (v: string | null): v is MotionPref => v !== null && VALUES.includes(v);

function read(): MotionPref {
  try {
    const v = globalThis.localStorage?.getItem(KEY) ?? null;
    return isPref(v) ? v : 'system';
  } catch (err) {
    console.warn('[motion] preference unreadable', err);
    return 'system';
  }
}

let pref: MotionPref = read();
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const listeners = new Set<() => void>();
const notify = (): void => {
  for (const fn of listeners) fn();
};
media?.addEventListener('change', notify);

export const motionPref = (): MotionPref => pref;

/** True when motion should calm down: no inverted impact frames, softer flashes and shake, no slams. */
export function reducedMotion(): boolean {
  return pref === 'system' ? (media?.matches ?? false) : pref === 'reduced';
}

export function setMotionPref(v: MotionPref): void {
  pref = v;
  try {
    globalThis.localStorage?.setItem(KEY, v);
  } catch (err) {
    console.warn('[motion] preference not saved', err);
  }
  notify();
}

/** fn runs after every preference change and OS flag flip; returns the unsubscribe. */
export function onMotionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
