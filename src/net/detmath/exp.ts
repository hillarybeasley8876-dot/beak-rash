// Deterministic Math — fdlibm's exp and expm1, ported line by line from
// V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.

import { getHighWord, getLowWord, insertWords } from './words';

/** Math.exp. */
export function exp(x: number): number {
  const one = 1.0;
  const o_threshold = 7.09782712893383973096e+02;
  const u_threshold = -7.45133219101941108420e+02;
  const invln2 = 1.44269504088896338700e+00;
  const P1 = 1.66666666666666019037e-01;
  const P2 = -2.77777777770155933842e-03;
  const P3 = 6.61375632143793436117e-05;
  const P4 = -1.65339022054652515390e-06;
  const P5 = 4.13813679705723846039e-08;
  const E = 2.718281828459045;
  const huge = 1.0e+300;
  const twom1000 = 9.33263618503218878990e-302; // 2**-1000
  const two1023 = 8.988465674311579539e307; // 0x1p1023

  let hx = getHighWord(x);
  const xsb = (hx >>> 31) & 1; // sign bit of x
  hx &= 0x7fffffff; // high word of |x|

  // filter out non-finite argument
  if (hx >= 0x40862e42) {
    // if |x| >= 709.78...
    if (hx >= 0x7ff00000) {
      const lx = getLowWord(x);
      if (((hx & 0xfffff) | lx) !== 0) return x + x; // NaN
      return xsb === 0 ? x : 0.0; // exp(+-inf)={inf,0}
    }
    if (x > o_threshold) return huge * huge; // overflow
    if (x < u_threshold) return twom1000 * twom1000; // underflow
  }

  // argument reduction
  let k = 0;
  let hi = 0.0;
  let lo = 0.0;
  if (hx > 0x3fd62e42) {
    // if |x| > 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      // and |x| < 1.5 ln2
      if (x === 1.0) return E;
      hi = x - (xsb ? -6.93147180369123816490e-01 : 6.93147180369123816490e-01);
      lo = xsb ? -1.90821492927058770002e-10 : 1.90821492927058770002e-10;
      k = 1 - xsb - xsb;
    } else {
      k = (invln2 * x + (xsb ? -0.5 : 0.5)) | 0;
      const t = k;
      hi = x - t * 6.93147180369123816490e-01; // t*ln2HI is exact here
      lo = t * 1.90821492927058770002e-10;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    // when |x| < 2**-28
    return one + x; // trigger inexact
  } else {
    k = 0;
  }

  // x is now in primary range
  const t = x * x;
  let twopk: number;
  if (k >= -1021) {
    twopk = insertWords((0x3ff00000 + ((k << 20) | 0)) | 0, 0);
  } else {
    twopk = insertWords((0x3ff00000 + (((k + 1000) << 20) | 0)) | 0, 0);
  }
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) {
    return one - ((x * c) / (c - 2.0) - x);
  }
  const y = one - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) {
    if (k === 1024) return y * 2.0 * two1023;
    return y * twopk;
  }
  return y * twopk * twom1000;
}

/** Math.expm1. */
export function expm1(x: number): number {
  const one = 1.0;
  const tiny = 1.0e-300;
  const o_threshold = 7.09782712893383973096e+02;
  const ln2_hi = 6.93147180369123816490e-01;
  const ln2_lo = 1.90821492927058770002e-10;
  const invln2 = 1.44269504088896338700e+00;
  /* Scaled Q's: Qn_here = 2**n * Qn_above, for R(2*z) where z = hxs = x*x/2 */
  const Q1 = -3.33333333333331316428e-02;
  const Q2 = 1.58730158725481460165e-03;
  const Q3 = -7.93650757867487942473e-05;
  const Q4 = 4.00821782732936239552e-06;
  const Q5 = -2.01099218183624371326e-07;
  const huge = 1.0e+300;

  let hx = getHighWord(x);
  const neg = (hx & 0x80000000) !== 0; // sign bit of x
  hx &= 0x7fffffff; // high word of |x|

  // filter out huge and non-finite argument
  if (hx >= 0x4043687a) {
    // if |x| >= 56*ln2
    if (hx >= 0x40862e42) {
      // if |x| >= 709.78...
      if (hx >= 0x7ff00000) {
        const low = getLowWord(x);
        if (((hx & 0xfffff) | low) !== 0) return x + x; // NaN
        return neg ? -1.0 : x; // exp(+-inf)={inf,-1}
      }
      if (x > o_threshold) return huge * huge; // overflow
    }
    if (neg) {
      // x < -56*ln2, return -1.0 with inexact
      if (x + tiny < 0.0) return tiny - one; // return -1
    }
  }

  // argument reduction
  let k = 0;
  let hi = 0.0;
  let lo = 0.0;
  let c = 0.0;
  if (hx > 0x3fd62e42) {
    // if |x| > 0.5 ln2
    if (hx < 0x3ff0a2b2) {
      // and |x| < 1.5 ln2
      if (!neg) {
        hi = x - ln2_hi;
        lo = ln2_lo;
        k = 1;
      } else {
        hi = x + ln2_hi;
        lo = -ln2_lo;
        k = -1;
      }
    } else {
      k = (invln2 * x + (neg ? -0.5 : 0.5)) | 0;
      const t = k;
      hi = x - t * ln2_hi; // t*ln2_hi is exact here
      lo = t * ln2_lo;
    }
    x = hi - lo;
    c = (hi - x) - lo;
  } else if (hx < 0x3c900000) {
    // when |x| < 2**-54, return x
    const t = huge + x; // return x with inexact flags when x != 0
    return x - (t - (huge + x));
  } else {
    k = 0;
  }

  // x is now in primary range
  const hfx = 0.5 * x;
  const hxs = x * hfx;
  const r1 = one + hxs * (Q1 + hxs * (Q2 + hxs * (Q3 + hxs * (Q4 + hxs * Q5))));
  const t = 3.0 - r1 * hfx;
  let e = hxs * ((r1 - t) / (6.0 - x * t));
  if (k === 0) {
    return x - (x * e - hxs); // c is 0
  }
  const twopk = insertWords((0x3ff00000 + ((k << 20) | 0)) | 0, 0); // 2^k
  e = x * (e - c) - c;
  e -= hxs;
  if (k === -1) return 0.5 * (x - e) - 0.5;
  if (k === 1) {
    if (x < -0.25) return -2.0 * (e - (x + 0.5));
    return one + 2.0 * (x - e);
  }
  let y: number;
  if (k <= -2 || k > 56) {
    // suffice to return exp(x)-1
    y = one - (e - x);
    if (k === 1024) y = y * 2.0 * 8.98846567431158e+307;
    else y = y * twopk;
    return y - one;
  }
  let ts: number;
  if (k < 20) {
    ts = insertWords((0x3ff00000 - (0x200000 >> k)) | 0, 0); // t = 1-2^-k
    y = ts - (e - x);
    y = y * twopk;
  } else {
    ts = insertWords(((0x3ff - k) << 20) | 0, 0); // 2^-k
    y = x - (e + ts);
    y += one;
    y = y * twopk;
  }
  return y;
}
