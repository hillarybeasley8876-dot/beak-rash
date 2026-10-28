// Deterministic Math — fdlibm's log, log1p, log2 and log10, ported line by line
// from V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.

import { getHighWord, getLowWord, setHighWord, setLowWord } from './words';

const LN2_HI = 6.93147180369123816490e-01;
const LN2_LO = 1.90821492927058770002e-10;
const TWO54 = 1.80143985094819840000e+16;

const LG1 = 6.66666666666673513e-01;
const LG2 = 3.999999999940941908e-01;
const LG3 = 2.857142874366239149e-01;
const LG4 = 2.222219843214978396e-01;
const LG5 = 1.818357216161805012e-01;
const LG6 = 1.531383769920937332e-01;
const LG7 = 1.479819860511658591e-01;

/** k_log1p(f): log(1+f) - f for 1+f in ~[sqrt(2)/2, sqrt(2)]. */
function kLog1p(f: number): number {
  const s = f / (2.0 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1;
  const hfsq = 0.5 * f * f;
  return s * (hfsq + R);
}

/** Math.log. */
export function log(x: number): number {
  let hx = getHighWord(x);
  const lx = getLowWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2**-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity; // log(+-0) = -inf
    if (hx < 0) return NaN; // log(-#) = NaN
    k -= 54;
    x *= TWO54; // subnormal number, scale up x
    hx = getHighWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = setHighWord(x, (hx | (i ^ 0x3ff00000)) | 0); // normalize x or x/2
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    // -2**-20 <= f < 2**-20
    if (f === 0) {
      if (k === 0) return 0;
      const dk = k;
      return dk * LN2_HI + dk * LN2_LO;
    }
    const R = f * f * (0.5 - 0.33333333333333333 * f);
    if (k === 0) return f - R;
    const dk = k;
    return dk * LN2_HI - ((R - dk * LN2_LO) - f);
  }
  const s = f / (2.0 + f);
  const dk = k;
  const z = s * s;
  let i2 = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i2 |= j;
  const R = t2 + t1;
  if (i2 > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * LN2_HI - ((hfsq - (s * (hfsq + R) + dk * LN2_LO)) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * LN2_HI - ((s * (f - R) - dk * LN2_LO) - f);
}

/** Math.log1p. */
export function log1p(x: number): number {
  let hx = getHighWord(x);
  const ax = hx & 0x7fffffff;
  let k = 1;
  let f = 0;
  let hu = 0;
  let c = 0;
  if (hx < 0x3fda827a) {
    // 1+x < sqrt(2)+
    if (ax >= 0x3ff00000) {
      // x <= -1.0
      if (x === -1.0) return -Infinity; // log1p(-1) = -inf
      return NaN; // log1p(x < -1) = NaN
    }
    if (ax < 0x3e200000) {
      // |x| < 2**-29
      if (ax < 0x3c900000) return x; // |x| < 2**-54
      return x - x * x * 0.5;
    }
    if (hx > 0 || hx <= (0xbfd2bec4 | 0)) {
      // sqrt(2)/2- <= 1+x < sqrt(2)+
      k = 0;
      f = x;
      hu = 1;
    }
  }
  if (hx >= 0x7ff00000) return x + x;
  let u = 0;
  if (k !== 0) {
    if (hx < 0x43400000) {
      u = 1.0 + x;
      hu = getHighWord(u);
      k = (hu >> 20) - 1023;
      c = k > 0 ? 1.0 - (u - x) : x - (u - 1.0); // correction term
      c /= u;
    } else {
      u = x;
      hu = getHighWord(u);
      k = (hu >> 20) - 1023;
      c = 0;
    }
    hu &= 0x000fffff;
    if (hu < 0x6a09e) {
      // u ~< sqrt(2)
      u = setHighWord(u, (hu | 0x3ff00000) | 0); // normalize u
    } else {
      k += 1;
      u = setHighWord(u, (hu | 0x3fe00000) | 0); // normalize u/2
      hu = (0x00100000 - hu) >> 2;
    }
    f = u - 1.0;
  }
  const hfsq = 0.5 * f * f;
  if (hu === 0) {
    // |f| < 2**-20
    if (f === 0) {
      if (k === 0) return 0;
      c += k * LN2_LO;
      return k * LN2_HI + c;
    }
    const R = hfsq * (1.0 - 0.66666666666666666 * f);
    if (k === 0) return f - R;
    return k * LN2_HI - ((R - (k * LN2_LO + c)) - f);
  }
  const s = f / (2.0 + f);
  const z = s * s;
  const R = z * (LG1 + z * (LG2 + z * (LG3 + z * (LG4 + z * (LG5 + z * (LG6 + z * LG7))))));
  if (k === 0) return f - (hfsq - s * (hfsq + R));
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + (k * LN2_LO + c))) - f);
}

/** Math.log2. */
export function log2(x: number): number {
  const ivln2hi = 1.44269504072144627571e+00;
  const ivln2lo = 1.67517131648865118353e-10;

  let hx = getHighWord(x);
  const lx = getLowWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2**-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity; // log(+-0) = -inf
    if (hx < 0) return NaN; // log(-#) = NaN
    k -= 54;
    x *= TWO54; // subnormal number, scale up x
    hx = getHighWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lx === 0) return 0.0; // log(1) = +0
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = setHighWord(x, (hx | (i ^ 0x3ff00000)) | 0); // normalize x or x/2
  k += i >> 20;
  const y = k;
  const f = x - 1.0;
  const hfsq = 0.5 * f * f;
  const r = kLog1p(f);

  let hi = f - hfsq;
  hi = setLowWord(hi, 0);
  const lo = (f - hi) - hfsq + r;
  let val_hi = hi * ivln2hi;
  let val_lo = (lo + hi) * ivln2lo + lo * ivln2hi;

  // spadd(val_hi, val_lo, y), except for not using double_t:
  const w = y + val_hi;
  val_lo += (y - w) + val_hi;
  val_hi = w;

  return val_lo + val_hi;
}

/** Math.log10. */
export function log10(x: number): number {
  const ivln10 = 4.34294481903251816668e-01;
  const log10_2hi = 3.01029995663611771306e-01;
  const log10_2lo = 3.69423907715893078616e-13;

  let hx = getHighWord(x);
  let lx = getLowWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2**-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity; // log(+-0) = -inf
    if (hx < 0) return NaN; // log(-#) = NaN
    k -= 54;
    x *= TWO54; // subnormal number, scale up x
    hx = getHighWord(x);
    lx = getLowWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lx === 0) return 0.0; // log(1) = +0
  k += (hx >> 20) - 1023;

  const i = (k & 0x80000000) >>> 31;
  hx = (hx & 0x000fffff) | ((0x3ff - i) << 20);
  const y = k + i;
  x = setHighWord(x, hx | 0);
  x = setLowWord(x, lx | 0);

  const z = y * log10_2lo + ivln10 * log(x);
  return z + y * log10_2hi;
}
