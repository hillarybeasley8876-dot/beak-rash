// In-game motion preference (设置 › 动态效果): 跟随系统 / 减弱 / 完整. Kept in its own localStorage key until
// core adds Settings.motion (ui-screens status request). The class on every .br-ui root drives the CSS
// kill-switch (tokens.css); reducedMotion() (dom.ts) reads it for JS-driven motion.
export type MotionPref = 'system' | 'reduced' | 'full';

const KEY = 'beak-rash.motion';
const VALUES: readonly string[] = ['system', 'reduced', 'full'];
const isPref = (v: string | null): v is MotionPref => v !== null && VALUES.includes(v);

function read(): MotionPref {
  try {
    const v = globalThis.localStorage?.getItem(KEY) ?? null;
    return isPref(v) ? v : 'system';
  } catch (err) {
    console.warn('[ui] motion preference unreadable', err);
    return 'system';
  }
}

let pref: MotionPref = read();

export const motionPref = (): MotionPref => pref;

/** Toggle .is-reduced / .is-full-motion on every UI root (the shell calls this once it has mounted). */
export function applyMotionPref(): void {
  for (const el of document.querySelectorAll('.br-ui')) {
    el.classList.toggle('is-reduced', pref === 'reduced');
    el.classList.toggle('is-full-motion', pref === 'full');
  }
}

export function setMotionPref(v: MotionPref): void {
  pref = v;
  try {
    globalThis.localStorage?.setItem(KEY, v);
  } catch (err) {
    console.warn('[ui] motion preference not saved', err);
  }
  applyMotionPref();
}
