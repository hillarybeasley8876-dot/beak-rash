// Deterministic Math — fdlibm's argument reduction for sin/cos/tan
// (__ieee754_rem_pio2 and __kernel_rem_pio2), ported line by line from
// V8 12.4's src/base/ieee754.cc. See src/net/detmath.ts for the notices.
//
// The reduction writes its two-part remainder into REM_Y and returns the
// quadrant n (n & 3 picks the sin/cos/tan combination).

import { getHighWord, getLowWord, setHighWord, setLowWord, scalbn } from './words';

/** The remainder x - n*pi/2, as a head (y[0]) and a tail (y[1]). */
export const REM_Y = new Float64Array(2);

/** 2/pi, 24 bits at a time (fdlibm's two_over_pi). */
const TWO_OVER_PI = new Int32Array([
  0xa2f983, 0x6e4e44, 0x1529fc, 0x2757d1, 0xf534dd, 0xc0db62, 0x95993c,
  0x439041, 0xfe5163, 0xabdebb, 0xc561b7, 0x246e3a, 0x424dd2, 0xe00649,
  0x2eea09, 0xd1921c, 0xfe1deb, 0x1cb129, 0xa73ee8, 0x8235f5, 0x2ebb44,
  0x84e99c, 0x7026b4, 0x5f7e41, 0x3991d6, 0x398353, 0x39f49c, 0x845f8b,
  0xbdf928, 0x3b1ff8, 0x97ffde, 0x05980f, 0xef2f11, 0x8b5a0a, 0x6d1f6d,
  0x367ecf, 0x27cb09, 0xb74f46, 0x3f669e, 0x5fea2d, 0x7527ba, 0xc7ebe5,
  0xf17b3d, 0x0739f7, 0x8a5292, 0xea6bfb, 0x5fb11f, 0x8d5d08, 0x560330,
  0x46fc7b, 0x6babf0, 0xcfbc20, 0x9af436, 0x1da9e3, 0x91615e, 0xe61b08,
  0x659985, 0x5f14a0, 0x68408d, 0xffd880, 0x4d7327, 0x310606, 0x1556ca,
  0x73a8c9, 0x60e27b, 0xc08c6b,
]);

/** The high words of n*pi/2, used for the quick cancellation check. */
const NPIO2_HW = new Int32Array([
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c,
  0x4025fdbb, 0x402921fb, 0x402c463a, 0x402f6a7a, 0x4031475c, 0x4032d97c,
  0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a,
  0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c,
  0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb, 0x40478fdb,
  0x404858eb, 0x404921fb,
]);

/** pi/2 in 33-bit chunks (fdlibm's PIo2). */
const PIO2 = new Float64Array([
  1.57079625129699707031e+00, // 0x3FF921FB, 0x40000000
  7.54978941586159635335e-08, // 0x3E74442D, 0x00000000
  5.39030252995776476554e-15, // 0x3CF84698, 0x80000000
  3.28200341580791294123e-22, // 0x3B78CC51, 0x60000000
  1.27065575308067607349e-29, // 0x39F01B83, 0x80000000
  1.22933308981111328932e-36, // 0x387A2520, 0x40000000
  2.73370053816464559624e-44, // 0x36E38222, 0x80000000
  2.16741683877804819444e-51, // 0x3569F31D, 0x00000000
]);

const INIT_JK = [2, 3, 4, 6];

/** Scratch for __kernel_rem_pio2: the 24-bit chunks, the products and the result. */
const IQ = new Int32Array(20);
const F = new Float64Array(20);
const FQ = new Float64Array(20);
const QQ = new Float64Array(20);
const TX = new Float64Array(3);

/**
 * __kernel_rem_pio2: y = x - n*pi/2 for |y| < pi/2, in 53-bit precision.
 * `xs` holds the 24-bit chunks of |x|, `e0` the exponent of xs[0].
 */
function kernelRemPio2(xs: Float64Array, e0: number, nx: number, prec: number): number {
  const two24 = 1.67772160000000000000e+07;
  const twon24 = 5.96046447753906250000e-08;
  const one = 1.0;

  let jk = INIT_JK[prec];
  let jp = jk;

  // determine jx, jv, q0; note that 3 > q0
  const jx = nx - 1;
  let jv = (e0 - 3) / 24 | 0; // C integer division truncates toward zero
  if (jv < 0) jv = 0;
  let q0 = e0 - 24 * (jv + 1);

  // set up f[0] to f[jx+jk] where f[jx+jk] = ipio2[jv+jk]
  let j = jv - jx;
  const m = jx + jk;
  for (let i = 0; i <= m; i++, j++) {
    F[i] = j < 0 ? 0 : TWO_OVER_PI[j];
  }

  // compute q[0],q[1],...q[jk]
  for (let i = 0; i <= jk; i++) {
    let fw = 0.0;
    for (let k = 0; k <= jx; k++) fw += xs[k] * F[jx + i - k];
    QQ[i] = fw;
  }

  let jz = jk;
  let z = 0;
  let n = 0;
  let ih = 0;
  for (;;) {
    // distill q[] into iq[] reversingly
    z = QQ[jz];
    for (let i = 0, j2 = jz; j2 > 0; i++, j2--) {
      const fw = (twon24 * z) | 0;
      IQ[i] = (z - two24 * fw) | 0;
      z = QQ[j2 - 1] + fw;
    }

    // compute n
    z = scalbn(z, q0); // actual value of z
    z -= 8.0 * Math.floor(z * 0.125); // trim off integer >= 8
    n = z | 0;
    z -= n;
    ih = 0;
    if (q0 > 0) {
      // need iq[jz-1] to determine n
      const i = IQ[jz - 1] >> (24 - q0);
      n += i;
      IQ[jz - 1] -= i << (24 - q0);
      ih = IQ[jz - 1] >> (23 - q0);
    } else if (q0 === 0) {
      ih = IQ[jz - 1] >> 23;
    } else if (z >= 0.5) {
      ih = 2;
    }

    if (ih > 0) {
      // q > 0.5
      n += 1;
      let carry = 0;
      for (let i = 0; i < jz; i++) {
        // compute 1-q
        const jq = IQ[i];
        if (carry === 0) {
          if (jq !== 0) {
            carry = 1;
            IQ[i] = 0x1000000 - jq;
          }
        } else {
          IQ[i] = 0xffffff - jq;
        }
      }
      if (q0 > 0) {
        // rare case: chance is 1 in 12
        switch (q0) {
          case 1:
            IQ[jz - 1] &= 0x7fffff;
            break;
          case 2:
            IQ[jz - 1] &= 0x3fffff;
            break;
        }
      }
      if (ih === 2) {
        z = one - z;
        if (carry !== 0) z -= scalbn(one, q0);
      }
    }

    // check if recomputation is needed
    if (z === 0) {
      let jj = 0;
      for (let i = jz - 1; i >= jk; i--) jj |= IQ[i];
      if (jj === 0) {
        // need recomputation
        let k = 1;
        while (jk >= k && IQ[jk - k] === 0) k++;

        for (let i = jz + 1; i <= jz + k; i++) {
          // add q[jz+1] to q[jz+k]
          F[jx + i] = TWO_OVER_PI[jv + i];
          let fw = 0.0;
          for (let k2 = 0; k2 <= jx; k2++) fw += xs[k2] * F[jx + i - k2];
          QQ[i] = fw;
        }
        jz += k;
        continue;
      }
    }
    break;
  }

  // chop off zero terms
  if (z === 0.0) {
    jz -= 1;
    q0 -= 24;
    while (IQ[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    // break z into 24-bit if necessary
    z = scalbn(z, -q0);
    if (z >= two24) {
      const fw = (twon24 * z) | 0;
      IQ[jz] = (z - two24 * fw) | 0;
      jz += 1;
      q0 += 24;
      IQ[jz] = fw;
    } else {
      IQ[jz] = z | 0;
    }
  }

  // convert integer "bit" chunk to floating-point value
  let fw = scalbn(one, q0);
  for (let i = jz; i >= 0; i--) {
    QQ[i] = fw * IQ[i];
    fw *= twon24;
  }

  // compute PIo2[0,...,jp]*q[jz,...,0]
  for (let i = jz; i >= 0; i--) {
    let s = 0.0;
    for (let k = 0; k <= jp && k <= jz - i; k++) s += PIO2[k] * QQ[i + k];
    FQ[jz - i] = s;
  }

  // compress fq[] into y[]
  fw = 0.0;
  for (let i = jz; i >= 0; i--) fw += FQ[i];
  REM_Y[0] = ih === 0 ? fw : -fw;
  fw = FQ[0] - fw;
  for (let i = 1; i <= jz; i++) fw += FQ[i];
  REM_Y[1] = ih === 0 ? fw : -fw;
  return n & 7;
}

/**
 * __ieee754_rem_pio2(x): the remainder of x mod pi/2 in REM_Y[0] + REM_Y[1].
 * Returns n, the quadrant (n & 3 selects sin/cos/tan).
 */
export function remPio2(x: number): number {
  const half = 5.00000000000000000000e-01;
  const two24 = 1.67772160000000000000e+07;
  const invpio2 = 6.36619772367581382433e-01;
  const pio2_1 = 1.57079632673412561417e+00;
  const pio2_1t = 6.07710050650619224932e-11;
  const pio2_2 = 6.07710050630396597660e-11;
  const pio2_2t = 2.02226624879595063154e-21;
  const pio2_3 = 2.02226624871116645580e-21;
  const pio2_3t = 8.47842766036889956997e-32;

  const hx = getHighWord(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    // |x| ~<= pi/4, no need for reduction
    REM_Y[0] = x;
    REM_Y[1] = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    // |x| < 3pi/4, special case with n=+-1
    if (hx > 0) {
      let z = x - pio2_1;
      if (ix !== 0x3ff921fb) {
        // 33+53 bit pi is good enough
        REM_Y[0] = z - pio2_1t;
        REM_Y[1] = (z - REM_Y[0]) - pio2_1t;
      } else {
        // near pi/2, use 33+33+53 bit pi
        z -= pio2_2;
        REM_Y[0] = z - pio2_2t;
        REM_Y[1] = (z - REM_Y[0]) - pio2_2t;
      }
      return 1;
    }
    // negative x
    let z = x + pio2_1;
    if (ix !== 0x3ff921fb) {
      REM_Y[0] = z + pio2_1t;
      REM_Y[1] = (z - REM_Y[0]) + pio2_1t;
    } else {
      z += pio2_2;
      REM_Y[0] = z + pio2_2t;
      REM_Y[1] = (z - REM_Y[0]) + pio2_2t;
    }
    return -1;
  }
  if (ix <= 0x413921fb) {
    // |x| ~<= 2^19*(pi/2), medium size
    let t = Math.abs(x);
    const n = (t * invpio2 + half) | 0;
    const fn = n;
    let r = t - fn * pio2_1;
    let w = fn * pio2_1t; // 1st round good to 85 bit
    if (n < 32 && ix !== NPIO2_HW[n - 1]) {
      REM_Y[0] = r - w; // quick check no cancellation
    } else {
      const j = ix >> 20;
      REM_Y[0] = r - w;
      let i = j - ((getHighWord(REM_Y[0]) >> 20) & 0x7ff);
      if (i > 16) {
        // 2nd iteration needed, good to 118
        t = r;
        w = fn * pio2_2;
        r = t - w;
        w = fn * pio2_2t - ((t - r) - w);
        REM_Y[0] = r - w;
        i = j - ((getHighWord(REM_Y[0]) >> 20) & 0x7ff);
        if (i > 49) {
          // 3rd iteration need, 151 bits acc
          t = r;
          w = fn * pio2_3;
          r = t - w;
          w = fn * pio2_3t - ((t - r) - w);
          REM_Y[0] = r - w;
        }
      }
    }
    REM_Y[1] = (r - REM_Y[0]) - w;
    if (hx < 0) {
      REM_Y[0] = -REM_Y[0];
      REM_Y[1] = -REM_Y[1];
      return -n;
    }
    return n;
  }
  // all other (large) arguments
  if (ix >= 0x7ff00000) {
    // x is inf or NaN
    REM_Y[0] = x - x;
    REM_Y[1] = x - x;
    return 0;
  }
  // set z = scalbn(|x|,ilogb(x)-23)
  const low = getLowWord(x);
  let z = setLowWord(0, low);
  const e0 = (ix >> 20) - 1046; // e0 = ilogb(z)-23;
  z = setHighWord(z, (ix - (e0 << 20)) | 0);
  for (let i = 0; i < 2; i++) {
    TX[i] = z | 0;
    z = (z - TX[i]) * two24;
  }
  TX[2] = z;
  let nx = 3;
  while (TX[nx - 1] === 0) nx--; // skip zero term
  const n = kernelRemPio2(TX, e0, nx, 2);
  if (hx < 0) {
    REM_Y[0] = -REM_Y[0];
    REM_Y[1] = -REM_Y[1];
    return -n;
  }
  return n;
}
