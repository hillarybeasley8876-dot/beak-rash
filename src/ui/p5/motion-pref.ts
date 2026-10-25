// UI side of the in-game motion preference (设置 › 动态效果). The value lives in core/motion.ts, which races
// read too; this module toggles the CSS kill-switch classes on every .br-ui root (tokens.css), and
// reducedMotion() (dom.ts) answers for JS-driven menu motion.
import { motionPref, setMotionPref as storeMotionPref, type MotionPref } from '../../core/motion';

export { motionPref, type MotionPref };

/** Toggle .is-reduced / .is-full-motion on every UI root (the shell calls this once it has mounted). */
export function applyMotionPref(): void {
  const pref = motionPref();
  for (const el of document.querySelectorAll('.br-ui')) {
    el.classList.toggle('is-reduced', pref === 'reduced');
    el.classList.toggle('is-full-motion', pref === 'full');
  }
}

export function setMotionPref(v: MotionPref): void {
  storeMotionPref(v);
  applyMotionPref();
}
