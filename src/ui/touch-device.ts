// When the in-race touch bar should exist. Coarse pointers, phones, and Android WebView.
// Pure enough to unit-check: pass signals instead of reading the browser.

/** Chinese the touch bar and the title hint draw (hud/fonts.ts preloads the subsets). */
export const TOUCH_CN = '转向跳跃漂移攻击扇翅长按重击投掷铃暂停横屏触控底部就能骑自动踩踏开关点按';

/** A flap starts if the finger is up before this. At or after it, the attack button is heavy / throw. */
export const ATTACK_HOLD_MS = 340;

/** Fraction of the steer disc's half-width that still counts as straight. */
export const STEER_DEADZONE = 0.16;

export interface TouchSignals {
  ua: string;
  maxTouchPoints: number;
  /** Primary pointer is coarse (`(pointer: coarse)`). */
  coarse: boolean;
  /** Primary pointer is fine (`(pointer: fine)`). */
  fine: boolean;
  /** A host object exposed by an Android shell (`window.Android`). */
  androidBridge: boolean;
}

export function readTouchSignals(): TouchSignals {
  const ua = globalThis.navigator?.userAgent ?? '';
  const mm = (q: string): boolean => globalThis.matchMedia?.(q).matches ?? false;
  const host = globalThis as { Android?: unknown };
  return {
    ua,
    maxTouchPoints: globalThis.navigator?.maxTouchPoints ?? 0,
    coarse: mm('(pointer: coarse)'),
    fine: mm('(pointer: fine)'),
    androidBridge: typeof host.Android !== 'undefined',
  };
}

/** System WebView: `; wv)`, a JS bridge, or the old Version/ token without Chrome. */
export function isAndroidWebView(s: TouchSignals): boolean {
  if (!/Android/i.test(s.ua)) return false;
  if (/;\s*wv\)/i.test(s.ua)) return true;
  if (s.androidBridge) return true;
  return /Version\/\d/i.test(s.ua) && !/Chrome\/\d/i.test(s.ua);
}

/**
 * This device is a phone / tablet / WebView, not a desktop that merely owns a touchscreen.
 * Desktop touchscreens still get the bar after a real touch (see TouchControls), but they keep
 * the saved auto-pedal value because a keyboard is right there.
 */
export function touchPrimary(s: TouchSignals = readTouchSignals()): boolean {
  if (isAndroidWebView(s)) return true;
  if (s.coarse) return true;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(s.ua);
  return s.maxTouchPoints > 0 && mobile && !s.fine;
}

/** `?touch=1` forces the bar, `?touch=0` keeps the desktop HUD, otherwise follow the device. */
export function wantsTouchHud(params: URLSearchParams | null, s: TouchSignals = readTouchSignals()): boolean {
  const flag = params?.get('touch');
  if (flag === '0') return false;
  if (flag === '1') return true;
  return touchPrimary(s);
}

/** -1 left, +1 right, 0 inside the dead zone. Position is in client pixels across the steer disc. */
export function steerAxis(clientX: number, rect: { left: number; width: number }): -1 | 0 | 1 {
  const half = rect.width / 2;
  if (half <= 0) return 0;
  const nx = (clientX - (rect.left + half)) / half;
  if (nx <= -STEER_DEADZONE) return -1;
  if (nx >= STEER_DEADZONE) return 1;
  return 0;
}

export interface FlapRider {
  s: number;
  x: number;
  mode: string;
  isPlayer: boolean;
}

/**
 * One flap button, no left/right pads. The nearer racing rival picks the wing (J / L);
 * with nobody in reach, wing toward the road centre — the same fallback melee uses for a heavy.
 */
export function flapSide(me: { s: number; x: number }, riders: readonly FlapRider[]): 'attackL' | 'attackR' {
  let bestX: number | null = null;
  let bestD = Infinity;
  for (const o of riders) {
    if (o.isPlayer || o.mode !== 'racing') continue;
    const ds = o.s - me.s;
    const dx = o.x - me.x;
    if (Math.abs(ds) >= 8 || Math.abs(dx) >= 6) continue;
    const d = ds * ds + dx * dx;
    if (d < bestD) {
      bestD = d;
      bestX = o.x;
    }
  }
  if (bestX !== null) return bestX >= me.x ? 'attackR' : 'attackL';
  return me.x > 0 ? 'attackL' : 'attackR';
}
