// Deterministic Math — fdlibm's asin and acos, ported line by line from
// V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.

import { getHighWord, getLowWord, setLowWord } from './words';

const ONE = 1.00000000000000000000e+00;
const PIO2_HI = 1.57079632679489655800e+00;
const PIO2_LO = 6.12323399573676603587e-17;
const PIO4_HI = 7.85398163397448278999e-01;
const PI = 3.14159265358979311600e+00;
/* coefficients for R(x^2) */
const PS0 = 1.66666666666666657415e-01;
const PS1 = -3.25565818622400915405e-01;
const PS2 = 2.01212532134862925881e-01;
const PS3 = -4.00555345006794114027e-02;
const PS4 = 7.91534994289814532176e-04;
const PS5 = 3.47933107596021167570e-05;
const QS1 = -2.40339491173441421878e+00;
const QS2 = 2.02094576023350569471e+00;
const QS3 = -6.88283971605453293030e-01;
const QS4 = 7.70381505559019352791e-02;

/** Math.asin. */
export function asin(x: number): number {
  let t = 0;
  const hx = getHighWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    // |x| >= 1
    const lx = getLowWord(x);
    if (((ix - 0x3ff00000) | lx) === 0) {
      // asin(1) = +-pi/2 with inexact
      return x * PIO2_HI + x * PIO2_LO;
    }
    return NaN; // asin(|x|>1) is NaN
  }
  if (ix < 0x3fe00000) {
    // |x| < 0.5
    if (ix < 0x3e400000) {
      // |x| < 2**-27
      return x; // return x with inexact if x != 0
    }
    t = x * x;
    const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
    const q = ONE + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
    const w = p / q;
    return x + x * w;
  }
  // 1 > |x| >= 0.5
  let w = ONE - Math.abs(x);
  t = w * 0.5;
  let p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
  let q = ONE + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
  const s = Math.sqrt(t);
  if (ix >= 0x3fef3333) {
    // |x| > 0.975
    w = p / q;
    t = PIO2_HI - (2.0 * (s + s * w) - PIO2_LO);
  } else {
    w = s;
    w = setLowWord(w, 0);
    const c = (t - w * w) / (s + w);
    const r = p / q;
    p = 2.0 * s * r - (PIO2_LO - 2.0 * c);
    q = PIO4_HI - 2.0 * w;
    t = PIO4_HI - (p - q);
  }
  if (hx > 0) return t;
  return -t;
}

/** Math.acos. */
export function acos(x: number): number {
  const hx = getHighWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    // |x| >= 1
    const lx = getLowWord(x);
    if (((ix - 0x3ff00000) | lx) === 0) {
      // |x| == 1
      if (hx > 0) return 0.0; // acos(1) = 0
      return PI + 2.0 * PIO2_LO; // acos(-1) = pi
    }
    return NaN; // acos(|x|>1) is NaN
  }
  if (ix < 0x3fe00000) {
    // |x| < 0.5
    if (ix <= 0x3c600000) return PIO2_HI + PIO2_LO; // if |x| < 2**-57
    const z = x * x;
    const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
    const q = ONE + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
    const r = p / q;
    return PIO2_HI - (x - (PIO2_LO - x * r));
  }
  if (hx < 0) {
    // x < -0.5
    const z = (ONE + x) * 0.5;
    const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
    const q = ONE + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
    const s = Math.sqrt(z);
    const r = p / q;
    const w = r * s - PIO2_LO;
    return PI - 2.0 * (s + w);
  }
  // x > 0.5
  const z = (ONE - x) * 0.5;
  const s = Math.sqrt(z);
  let df = s;
  df = setLowWord(df, 0);
  const c = (z - df * df) / (s + df);
  const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
  const q = ONE + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
  const r = p / q;
  const w = r * s + c;
  return 2.0 * (df + w);
}
