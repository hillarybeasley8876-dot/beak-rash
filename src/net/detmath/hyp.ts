// Deterministic Math — fdlibm's sinh, cosh, tanh and cbrt, ported line by line
// from V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.

import { getHighWord, getLowWord, insertWords, setHighWord } from './words';
import { exp, expm1 } from './exp';
import { expm1DoubleDouble, negDivPlus2 } from './dd';

const KSINH_OVERFLOW = 710.4758600739439;
const KCOSH_OVERFLOW = 710.4758600739439;
const TWO_M28 = 3.725290298461914e-9; // 2^-28
const LOG_MAXD = 709.7822265625;

/** Math.sinh. */
export function sinh(x: number): number {
  const shuge = 1.0e307;
  const h = x < 0 ? -0.5 : 0.5;
  const ax = Math.abs(x);
  if (ax < 22) {
    // For |x| < 2^-28, sinh(x) = x
    if (ax < TWO_M28) return x;
    const t = expm1(ax);
    if (ax < 1) return h * (2 * t - (t * t) / (t + 1));
    return h * (t + t / (t + 1));
  }
  // |x| in [22, log(maxdouble)], return 0.5 * exp(|x|)
  if (ax < LOG_MAXD) return h * exp(ax);
  // |x| in [log(maxdouble), overflowthreshold]
  if (ax <= KSINH_OVERFLOW) {
    const w = exp(0.5 * ax);
    const t = h * w;
    return t * w;
  }
  // |x| > overflowthreshold or is NaN.
  return x * shuge;
}

/** Math.cosh. */
export function cosh(x: number): number {
  const one = 1.0;
  const half = 0.5;
  const huge = 1.0e+300;
  const ix = getHighWord(x) & 0x7fffffff; // high word of |x|

  // |x| in [0,0.5*log2], return 1+expm1(|x|)^2/(2*exp(|x|))
  if (ix < 0x3fd62e43) {
    const t = expm1(Math.abs(x));
    const w = one + t;
    // For |x| < 2^-55, cosh(x) = 1
    if (ix < 0x3c800000) return w;
    return one + (t * t) / (w + w);
  }
  // |x| in [0.5*log2, 22], return (exp(|x|)+1/exp(|x|))/2
  if (ix < 0x40360000) {
    const t = exp(Math.abs(x));
    return half * t + half / t;
  }
  // |x| in [22, log(maxdouble)], return half*exp(|x|)
  if (ix < 0x40862e42) return half * exp(Math.abs(x));
  // |x| in [log(maxdouble), overflowthreshold]
  if (Math.abs(x) <= KCOSH_OVERFLOW) {
    const w = exp(half * Math.abs(x));
    const t = half * w;
    return t * w;
  }
  // x is INF or NaN
  if (ix >= 0x7ff00000) return x * x;
  // |x| > overflowthreshold.
  return huge * huge;
}

/** Scratch for the double-double tanh. */
const T_DD = new Float64Array(2);
const U_DD = new Float64Array(2);

/**
 * Math.tanh.
 *
 * The fdlibm tanh rounds expm1's result to 53 bits, which leaves it 1-2 ulp off; the browser's
 * Math.tanh is correctly rounded. Below 1 the "small" branch (z = -t/(t+2)) is therefore computed
 * with expm1 in double-double, which puts the result on the correctly rounded value; from 1 on the
 * "big" branch (z = 1-2/(t+2)) is already accurate to a quarter of an ulp.
 */
export function tanh(x: number): number {
  const one = 1.0;
  const two = 2.0;
  const jx = getHighWord(x);
  const ix = jx & 0x7fffffff;

  // x is INF or NaN
  if (ix >= 0x7ff00000) {
    if (jx >= 0) return one / x + one; // tanh(+-inf) = +-1
    return one / x - one; // tanh(NaN) = NaN
  }

  let z: number;
  // |x| < 22
  if (ix < 0x40360000) {
    // |x| < 2**-28
    if (ix < 0x3e300000) return x; // tanh(tiny) = tiny with inexact
    if (ix >= 0x3ff00000) {
      // |x| >= 1
      const t = expm1(two * Math.abs(x));
      z = one - two / (t + two);
    } else {
      // |x| < 1: expm1 in double-double, so the result is correctly rounded
      expm1DoubleDouble(-two * Math.abs(x), T_DD);
      negDivPlus2(T_DD, U_DD);
      z = U_DD[0] + U_DD[1];
    }
  } else {
    // |x| >= 22, return +-1
    z = one - 1.0e-300; // raise inexact flag
  }
  return jx >= 0 ? z : -z;
}

/** Math.cbrt. */
export function cbrt(x: number): number {
  const B1 = 715094163; // B1 = (1023-1023/3-0.03306235651)*2**20
  const B2 = 696219795; // B2 = (1023-1023/3-54/3-0.03306235651)*2**20
  /* |1/cbrt(x) - p(x)| < 2**-23.5 (~[-7.93e-8, 7.929e-8]). */
  const P0 = 1.87595182427177009643;
  const P1 = -1.88497979543377169875;
  const P2 = 1.621429720105354466140;
  const P3 = -0.758397934778766047437;
  const P4 = 0.145996192886612446982;

  let hx = getHighWord(x);
  const low = getLowWord(x);
  const sign = (hx & 0x80000000) >>> 0; // sign = sign(x)
  hx = (hx ^ sign) | 0;
  if (hx >= 0x7ff00000) return x + x; // cbrt(NaN,INF) is itself

  let t = 0.0;
  /*
   * Rough cbrt to 5 bits:
   *    cbrt(2**e*(1+m) ~= 2**(e/3)*(1+(e%3+m)/3)
   */
  if (hx < 0x00100000) {
    // zero or subnormal?
    if ((hx | low) === 0) return x; // cbrt(0) is itself
    t = setHighWord(t, 0x43500000); // set t = 2**54
    t *= x;
    const high = getHighWord(t);
    t = insertWords(sign | ((((high & 0x7fffffff) / 3) | 0) + B2), 0);
  } else {
    t = insertWords(sign | (((hx / 3) | 0) + B1), 0);
  }

  /*
   * New cbrt to 23 bits:
   *    cbrt(x) = t*cbrt(x/t**3) ~= t*P(t**3/x)
   */
  let r = (t * t) * (t / x);
  t = t * ((P0 + r * (P1 + r * P2)) + (r * r * r) * (P3 + r * P4));

  /*
   * Round t away from zero to 23 bits.
   */
  let hi = getHighWord(t);
  let lo = getLowWord(t);
  const newLo = (lo + 0x80000000) >>> 0;
  const carry = newLo < 0x80000000 ? 1 : 0;
  hi = (hi + carry) >>> 0;
  lo = newLo & 0xc0000000;
  t = insertWords(hi, lo);

  // one step Newton iteration to 53 bits with error < 0.667 ulps
  const s = t * t; // t*t is exact
  r = x / s; // error <= 0.5 ulps; |r| < |t|
  const w = t + t; // t+t is exact
  r = (r - t) / (w + r); // r-t is exact; w+r ~= 3*t
  t = t + t * r; // error <= 0.5 + 0.5/3 + epsilon

  return t;
}
