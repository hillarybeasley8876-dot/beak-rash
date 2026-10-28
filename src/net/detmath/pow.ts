// Deterministic Math — fdlibm's pow, ported line by line from V8 12.4's
// src/base/ieee754.cc (ES2019 draft 12.6.4). See src/net/detmath.ts for the
// copyright notices.

import { scalbn } from './words';

// The pow's own scratch buffer and word operations.
//
// The hot path must not reach into another module: a cross-module call and a read of a
// live binding (an exported `let`) each cost about a nanosecond, and the pow does a
// dozen of them. Measured in Chromium, 1M calls: 115 ms with the shared module, 101 ms
// like this, with bit for bit the same results.
const BUF = new ArrayBuffer(8);
const F64 = new Float64Array(BUF);
const I32 = new Int32Array(BUF);
const U32 = new Uint32Array(BUF);

const BP = new Float64Array([1.0, 1.5]);
const DP_H = new Float64Array([0.0, 5.84962487220764160156e-01]);
const DP_L = new Float64Array([0.0, 1.35003920212974897128e-08]);

const L1 = 5.99999999999994648725e-01;
const L2 = 4.28571428578550184252e-01;
const L3 = 3.33333329818377432918e-01;
const L4 = 2.72728123808534006489e-01;
const L5 = 2.30660745775561754067e-01;
const L6 = 2.06975017800338417784e-01;
const P1 = 1.66666666666666019037e-01;
const P2 = -2.77777777770155933842e-03;
const P3 = 6.61375632143793436117e-05;
const P4 = -1.65339022054652515390e-06;
const P5 = 4.13813679705723846039e-08;
const LG2 = 6.93147180559945286227e-01;
const LG2_H = 6.93147182464599609375e-01;
const LG2_L = -1.90465429995776804525e-09;
const OVT = 8.0085662595372944372e-0017; // -(1024-log2(ovfl+.5ulp))
const CP = 9.61796693925975554329e-01; // 2/(3ln2)
const CP_H = 9.61796700954437255859e-01; // =(float)cp
const CP_L = -7.02846165095275826516e-09; // tail cp_h
const IVLN2 = 1.44269504088896338700e+00; // 1/ln2
const IVLN2_H = 1.44269502162933349609e+00; // 24b 1/ln2
const IVLN2_L = 1.92596299112661746887e-08; // 1/ln2 tail

/** Math.pow. */
export function pow(x: number, y: number): number {
  const zero = 0.0;
  const one = 1.0;
  const two = 2.0;
  const two53 = 9007199254740992.0;
  const huge = 1.0e300;
  const tiny = 1.0e-300;

  F64[0] = x;
  const hx = I32[1];
  const lx = U32[0];
  F64[0] = y;
  const hy = I32[1];
  const ly = U32[0];
  let ix = hx & 0x7fffffff;
  const iy = hy & 0x7fffffff;

  // y == zero: x**0 = 1
  if ((iy | ly) === 0) return one;

  // +-NaN return x+y
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) {
    return x + y;
  }

  /*
   * determine if y is an odd int when x < 0
   * yisint = 0 ... y is not an integer
   * yisint = 1 ... y is an odd int
   * yisint = 2 ... y is an even int
   */
  let yisint = 0;
  if (hx < 0) {
    if (iy >= 0x43400000) {
      yisint = 2; // even integer y
    } else if (iy >= 0x3ff00000) {
      const k = (iy >> 20) - 0x3ff; // exponent
      if (k > 20) {
        const j = ly >>> (52 - k);
        if (((j << (52 - k)) >>> 0) === ly) yisint = 2 - (j & 1);
      } else if (ly === 0) {
        const j = iy >> (20 - k);
        if ((j << (20 - k)) === iy) yisint = 2 - (j & 1);
      }
    }
  }

  // special value of y
  if (ly === 0) {
    if (iy === 0x7ff00000) {
      // y is +-inf
      if (((ix - 0x3ff00000) | lx) === 0) return y - y; // inf**+-1 is NaN
      if (ix >= 0x3ff00000) return hy >= 0 ? y : zero; // (|x|>1)**+-inf = inf,0
      return hy < 0 ? -y : zero; // (|x|<1)**-,+inf = inf,0
    }
    if (iy === 0x3ff00000) {
      // y is +-1
      if (hy < 0) return one / x;
      return x;
    }
    if (hy === 0x40000000) return x * x; // y is 2
    if (hy === 0x3fe00000) {
      // y is 0.5
      if (hx >= 0) return Math.sqrt(x);
    }
  }

  let ax = Math.abs(x);
  // special value of x
  if (lx === 0) {
    if (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000) {
      let z = ax; // x is +-0,+-inf,+-1
      if (hy < 0) z = one / z; // z = (1/|x|)
      if (hx < 0) {
        if (((ix - 0x3ff00000) | yisint) === 0) {
          z = NaN; // (-1)**non-int is NaN
        } else if (yisint === 1) {
          z = -z; // (x<0)**odd = -(|x|**odd)
        }
      }
      return z;
    }
  }

  let n = (hx >> 31) + 1;

  // (x<0)**(non-int) is NaN
  if ((n | yisint) === 0) return NaN;

  let s = one; // s (sign of result -ve**odd) = -1 else = 1
  if ((n | (yisint - 1)) === 0) s = -one; // (-ve)**(odd int)

  let t1: number;
  let t2: number;
  // |y| is huge
  if (iy > 0x41e00000) {
    // if |y| > 2**31
    if (iy > 0x43f00000) {
      // if |y| > 2**64, must o/uflow
      if (ix <= 0x3fefffff) return hy < 0 ? huge * huge : tiny * tiny;
      if (ix >= 0x3ff00000) return hy > 0 ? huge * huge : tiny * tiny;
    }
    // over/underflow if x is not close to one
    if (ix < 0x3fefffff) return hy < 0 ? s * huge * huge : s * tiny * tiny;
    if (ix > 0x3ff00000) return hy > 0 ? s * huge * huge : s * tiny * tiny;
    /* now |1-x| is tiny <= 2**-20, suffice to compute
       log(x) by x-x^2/2+x^3/3-x^4/4 */
    const t = ax - one; // t has 20 trailing zeros
    const w = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25));
    const u = IVLN2_H * t; // ivln2_h has 21 sig. bits
    const v = t * IVLN2_L - w * IVLN2;
    t1 = u + v;
    F64[0] = t1;
    U32[0] = 0;
    t1 = F64[0];
    t2 = v - (t1 - u);
  } else {
    let ss: number;
    let s2: number;
    let s_h: number;
    let s_l: number;
    let t_h: number;
    let t_l: number;
    n = 0;
    // take care subnormal number
    if (ix < 0x00100000) {
      ax *= two53;
      n -= 53;
      F64[0] = ax;
      ix = I32[1];
    }
    n += (ix >> 20) - 0x3ff;
    const jm = ix & 0x000fffff;
    // determine interval
    ix = jm | 0x3ff00000; // normalize ix
    let k: number;
    if (jm <= 0x3988e) {
      k = 0; // |x| < sqrt(3/2)
    } else if (jm < 0xbb67a) {
      k = 1; // |x| < sqrt(3)
    } else {
      k = 0;
      n += 1;
      ix -= 0x00100000;
    }
    F64[0] = ax;
    U32[1] = ix | 0;
    ax = F64[0];

    // compute ss = s_h+s_l = (x-1)/(x+1) or (x-1.5)/(x+1.5)
    const u = ax - BP[k]; // bp[0]=1.0, bp[1]=1.5
    const v = one / (ax + BP[k]);
    ss = u * v;
    s_h = ss;
    F64[0] = s_h;
    U32[0] = 0;
    s_h = F64[0];
    // t_h = ax+bp[k] High
    t_h = zero;
    F64[0] = t_h;
    U32[1] = (((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18)) | 0;
    t_h = F64[0];
    t_l = ax - (t_h - BP[k]);
    s_l = v * ((u - s_h * t_h) - s_h * t_l);
    // compute log(ax)
    s2 = ss * ss;
    let r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += s_l * (s_h + ss);
    s2 = s_h * s_h;
    t_h = 3.0 + s2 + r;
    F64[0] = t_h;
    U32[0] = 0;
    t_h = F64[0];
    t_l = r - ((t_h - 3.0) - s2);
    // u+v = ss*(1+...)
    const u2 = s_h * t_h;
    const v2 = s_l * t_h + t_l * ss;
    // 2/(3log2)*(ss+...)
    let p_h = u2 + v2;
    F64[0] = p_h;
    U32[0] = 0;
    p_h = F64[0];
    const p_l = v2 - (p_h - u2);
    const z_h = CP_H * p_h; // cp_h+cp_l = 2/(3*log2)
    const z_l = CP_L * p_h + p_l * CP + DP_L[k];
    // log2(ax) = (ss+..)*2/(3*log2) = n + dp_h + z_h + z_l
    const t = n;
    t1 = z_h + z_l + DP_H[k] + t;
    F64[0] = t1;
    U32[0] = 0;
    t1 = F64[0];
    t2 = z_l - (((t1 - t) - DP_H[k]) - z_h);
  }

  // split up y into y1+y2 and compute (y1+y2)*(t1+t2)
  F64[0] = y;
  U32[0] = 0;
  const y1 = F64[0];
  let p_l = (y - y1) * t1 + y * t2;
  let p_h = y1 * t1;
  let z = p_l + p_h;
  F64[0] = z;
  const j = I32[1];
  const i = U32[0];
  if (j >= 0x40900000) {
    // z >= 1024
    if (((j - 0x40900000) | i) !== 0) return s * huge * huge; // overflow
    if (p_l + OVT > z - p_h) return s * huge * huge; // overflow
  } else if ((j & 0x7fffffff) >= 0x4090cc00) {
    // z <= -1075
    if (((j - 0xc090cc00) | i) !== 0) return s * tiny * tiny; // underflow
    if (p_l <= z - p_h) return s * tiny * tiny; // underflow
  }
  /*
   * compute 2**(p_h+p_l)
   */
  const ih = j & 0x7fffffff;
  let k = (ih >> 20) - 0x3ff;
  n = 0;
  if (ih > 0x3fe00000) {
    // if |z| > 0.5, set n = [z+0.5]
    n = (j + (0x00100000 >> (k + 1))) | 0;
    k = ((n & 0x7fffffff) >> 20) - 0x3ff; // new k for n
    let t = zero;
    F64[0] = t;
    U32[1] = (n & ~(0x000fffff >> k)) | 0;
    t = F64[0];
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
    if (j < 0) n = -n;
    p_h -= t;
  }
  let t = p_l + p_h;
  F64[0] = t;
  U32[0] = 0;
  t = F64[0];
  const u = t * LG2_H;
  const v = (p_l - (t - p_h)) * LG2 + t * LG2_L;
  z = u + v;
  const w = v - (z - u);
  t = z * z;
  t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  const r = (z * t1) / ((t1 - two) - (w + z * w));
  z = one - (r - z);
  // GET_HIGH_WORD(j, z); j += n<<20; SET_HIGH_WORD(z, j) — in one memory pass.
  F64[0] = z;
  const bumpedHigh = (U32[1] + (n << 20)) | 0;
  U32[1] = bumpedHigh >>> 0;
  const bumped = F64[0];
  if ((bumpedHigh >> 20) <= 0) {
    z = scalbn(z, n); // subnormal output
  } else {
    z = bumped;
  }
  return s * z;
}
