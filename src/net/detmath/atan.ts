// Deterministic Math — fdlibm's atan and atan2, ported line by line from
// V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.

import { getHighWord, getLowWord } from './words';

const ATANHI = new Float64Array([
  4.63647609000806093515e-01, // atan(0.5)hi
  7.85398163397448278999e-01, // atan(1.0)hi
  9.82793723247329054082e-01, // atan(1.5)hi
  1.57079632679489655800e+00, // atan(inf)hi
]);
const ATANLO = new Float64Array([
  2.26987774529616870924e-17, // atan(0.5)lo
  3.06161699786838301793e-17, // atan(1.0)lo
  1.39033110312309984516e-17, // atan(1.5)lo
  6.12323399573676603587e-17, // atan(inf)lo
]);
const AT = new Float64Array([
  3.33333333333329318027e-01,
  -1.99999999998764832476e-01,
  1.42857142725034663711e-01,
  -1.11111104054623557880e-01,
  9.09088713343650656196e-02,
  -7.69187620504482999495e-02,
  6.66107313738753120669e-02,
  -5.83357013379057348645e-02,
  4.97687799461593236017e-02,
  -3.65315727442169155270e-02,
  1.62858201153657823623e-02,
]);

/** Math.atan. */
export function atan(x: number): number {
  const one = 1.0;
  const hx = getHighWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    // if |x| >= 2^66
    const low = getLowWord(x);
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && low !== 0)) return x + x; // NaN
    if (hx > 0) return ATANHI[3] + ATANLO[3];
    return -ATANHI[3] - ATANLO[3];
  }
  let id: number;
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e400000) {
      // |x| < 2^-27
      return x; // raise inexact
    }
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      // |x| < 1.1875
      if (ix < 0x3fe60000) {
        // 7/16 <= |x| < 11/16
        id = 0;
        x = (2.0 * x - one) / (2.0 + x);
      } else {
        // 11/16 <= |x| < 19/16
        id = 1;
        x = (x - one) / (x + one);
      }
    } else if (ix < 0x40038000) {
      // |x| < 2.4375
      id = 2;
      x = (x - 1.5) / (one + 1.5 * x);
    } else {
      // 2.4375 <= |x| < 2^66
      id = 3;
      x = -1.0 / x;
    }
  }
  // end of argument reduction
  const z = x * x;
  const w = z * z;
  // break sum from i=0 to 10 aT[i]z**(i+1) into odd and even poly
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) {
    return x - x * (s1 + s2);
  }
  const zz = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
  return hx < 0 ? -zz : zz;
}

/** Math.atan2. */
export function atan2(y: number, x: number): number {
  const zero = 0.0;
  const pi_o_4 = 7.8539816339744827900e-01;
  const pi_o_2 = 1.5707963267948965580e+00;
  const pi = 3.1415926535897931160e+00;
  const pi_lo = 1.2246467991473531772e-16;
  const tiny = 1.0e-300;

  const hx = getHighWord(x);
  const lx = getLowWord(x);
  const ix = hx & 0x7fffffff;
  const hy = getHighWord(y);
  const ly = getLowWord(y);
  const iy = hy & 0x7fffffff;
  // x or y is NaN
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) {
    return x + y;
  }
  if (((hx - 0x3ff00000) | lx) === 0) return atan(y); // x = 1.0
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2); // 2*sign(x)+sign(y)

  // when y = 0
  if ((iy | ly) === 0) {
    switch (m) {
      case 0:
      case 1:
        return y; // atan(+-0,+anything) = +-0
      case 2:
        return pi + tiny; // atan(+0,-anything) = pi
      default:
        return -pi - tiny; // atan(-0,-anything) = -pi
    }
  }
  // when x = 0
  if ((ix | lx) === 0) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny;

  // when x is INF
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0:
          return pi_o_4 + tiny; // atan(+INF,+INF)
        case 1:
          return -pi_o_4 - tiny; // atan(-INF,+INF)
        case 2:
          return 3.0 * pi_o_4 + tiny; // atan(+INF,-INF)
        default:
          return -3.0 * pi_o_4 - tiny; // atan(-INF,-INF)
      }
    }
    switch (m) {
      case 0:
        return zero; // atan(+...,+INF)
      case 1:
        return -zero; // atan(-...,+INF)
      case 2:
        return pi + tiny; // atan(+...,-INF)
      default:
        return -pi - tiny; // atan(-...,-INF)
    }
  }
  // when y is INF
  if (iy === 0x7ff00000) return hy < 0 ? -pi_o_2 - tiny : pi_o_2 + tiny;

  // compute y/x
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) {
    // |y/x| > 2**60
    z = pi_o_2 + 0.5 * pi_lo;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0.0; // 0 > |y|/x > -2**-60
  } else {
    z = atan(Math.abs(y / x)); // safe to do y/x
  }
  switch (m) {
    case 0:
      return z; // atan(+,+)
    case 1:
      return -z; // atan(-,+)
    case 2:
      return pi - (z - pi_lo); // atan(+,-)
    default:
      return (z - pi_lo) - pi; // atan(-,-)
  }
}
