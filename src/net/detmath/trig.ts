// Deterministic Math — fdlibm's sin, cos and tan (with the __kernel_* kernels),
// ported line by line from V8 12.4's src/base/ieee754.cc.
// See src/net/detmath.ts for the copyright notices.

import { getHighWord, getLowWord, insertWords, setLowWord } from './words';
import { REM_Y, remPio2 } from './rempio2';

/** __kernel_cos: cosine of x (|x| <= pi/4) with the tail y. */
export function kernelCos(x: number, y: number): number {
  const one = 1.00000000000000000000e+00;
  const C1 = 4.16666666666666019037e-02;
  const C2 = -1.38888888888741095749e-03;
  const C3 = 2.48015872894767294178e-05;
  const C4 = -2.75573143513906633035e-07;
  const C5 = 2.08757232129817482790e-09;
  const C6 = -1.13596475577881948265e-11;

  const ix = getHighWord(x) & 0x7fffffff; // ix = |x|'s high word
  if (ix < 0x3e400000) {
    // if x < 2**-27
    return one; // generate inexact
  }
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) {
    // if |x| < 0.3
    return one - (0.5 * z - (z * r - x * y));
  }
  let qx: number;
  if (ix > 0x3fe90000) {
    // x > 0.78125
    qx = 0.28125;
  } else {
    qx = insertWords(ix - 0x00200000, 0); // x/4
  }
  const iz = 0.5 * z - qx;
  const a = one - qx;
  return a - (iz - (z * r - x * y));
}

/** __kernel_sin: sine of x (|x| <= pi/4) with the tail y; iy says whether y is 0. */
export function kernelSin(x: number, y: number, iy: number): number {
  const half = 5.00000000000000000000e-01;
  const S1 = -1.66666666666666324348e-01;
  const S2 = 8.33333333332248946124e-03;
  const S3 = -1.98412698298579493134e-04;
  const S4 = 2.75573137070700676789e-06;
  const S5 = -2.50507602534068634195e-08;
  const S6 = 1.58969099521155010221e-10;

  const ix = getHighWord(x) & 0x7fffffff; // high word of |x|
  if (ix < 0x3e400000) {
    // |x| < 2**-27
    return x; // generate inexact
  }
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) {
    return x + v * (S1 + z * r);
  }
  return x - ((z * (half * y - v * r) - y) - v * S1);
}

/** The tan kernel's coefficients: T[0..12], then one, pio4, pio4lo. */
const T = new Float64Array([
  3.33333333333334091986e-01, // 3FD55555, 55555563
  1.33333333333201242699e-01, // 3FC11111, 1110FE7A
  5.39682539762260521377e-02, // 3FABA1BA, 1BB341FE
  2.18694882948595424599e-02, // 3F9664F4, 8406D637
  8.86323982359930005737e-03, // 3F8226E3, E96E8493
  3.59207910759131235356e-03, // 3F6D6D22, C9560328
  1.45620945432529025516e-03, // 3F57DBC8, FEE08315
  5.88041240820264096874e-04, // 3F4344D8, F2F26501
  2.46463134818469906812e-04, // 3F3026F7, 1A8D1068
  7.81794442939557092300e-05, // 3F147E88, A03792A6
  7.14072491382608190305e-05, // 3F12B80F, 32F0A7E9
  -1.85586374855275456654e-05, // BEF375CB, DB605373
  2.59073051863633712884e-05, // 3EFB2A70, 74BF7AD4
  1.00000000000000000000e+00, // 3FF00000, 00000000  (one)
  7.85398163397448278999e-01, // 3FE921FB, 54442D18  (pio4)
  3.06161699786838301793e-17, // 3C81A626, 33145C07  (pio4lo)
]);
const ONE = T[13];
const PIO4 = T[14];
const PIO4LO = T[15];

/** __kernel_tan: tangent of x (|x| <= pi/4) with the tail y; iy is 1 or -1. */
export function kernelTan(x: number, y: number, iy: number): number {
  let z: number;
  let r: number;
  let v: number;
  let w: number;
  let s: number;

  const hx = getHighWord(x); // high word of x
  const ix = hx & 0x7fffffff; // high word of |x|
  if (ix < 0x3e300000) {
    // x < 2**-28
    const low = getLowWord(x);
    if (((ix | low) | (iy + 1)) === 0) {
      return ONE / Math.abs(x);
    }
    if (iy === 1) {
      return x;
    }
    // compute -1 / (x+y) carefully
    let a: number;
    let t: number;
    z = w = x + y;
    z = setLowWord(z, 0);
    v = y - (z - x);
    t = a = -ONE / w;
    t = setLowWord(t, 0);
    s = ONE + t * z;
    return t + a * (s + t * v);
  }
  if (ix >= 0x3fe59428) {
    // |x| >= 0.6744
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    z = PIO4 - x;
    w = PIO4LO - y;
    x = z + w;
    y = 0.0;
  }
  z = x * x;
  w = z * z;
  /*
   * Break x^5*(T[1]+x^2*T[2]+...) into
   * x^5(T[1]+x^4*T[3]+...+x^20*T[11]) +
   * x^5(x^2*(T[2]+x^4*T[4]+...+x^22*[T12]))
   */
  r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2.0 * (x - (w * w / (w + v) - r)));
  }
  if (iy === 1) {
    return w;
  }
  // compute -1.0 / (x+r) accurately
  let a: number;
  let t: number;
  z = w;
  z = setLowWord(z, 0);
  v = r - (z - x); // z+v = r+x
  t = a = -1.0 / w; // a = -1.0/w
  t = setLowWord(t, 0);
  s = 1.0 + t * z;
  return t + a * (s + t * v);
}

/** Math.sin. */
export function sin(x: number): number {
  const z = 0.0;
  const ix = getHighWord(x) & 0x7fffffff; // |x| ~< pi/4
  if (ix <= 0x3fe921fb) {
    return kernelSin(x, z, 0);
  }
  if (ix >= 0x7ff00000) {
    return x - x; // sin(Inf or NaN) is NaN
  }
  const n = remPio2(x);
  switch (n & 3) {
    case 0:
      return kernelSin(REM_Y[0], REM_Y[1], 1);
    case 1:
      return kernelCos(REM_Y[0], REM_Y[1]);
    case 2:
      return -kernelSin(REM_Y[0], REM_Y[1], 1);
    default:
      return -kernelCos(REM_Y[0], REM_Y[1]);
  }
}

/** Math.cos. */
export function cos(x: number): number {
  const z = 0.0;
  const ix = getHighWord(x) & 0x7fffffff; // |x| ~< pi/4
  if (ix <= 0x3fe921fb) {
    return kernelCos(x, z);
  }
  if (ix >= 0x7ff00000) {
    return x - x; // cos(Inf or NaN) is NaN
  }
  const n = remPio2(x);
  switch (n & 3) {
    case 0:
      return kernelCos(REM_Y[0], REM_Y[1]);
    case 1:
      return -kernelSin(REM_Y[0], REM_Y[1], 1);
    case 2:
      return -kernelCos(REM_Y[0], REM_Y[1]);
    default:
      return kernelSin(REM_Y[0], REM_Y[1], 1);
  }
}

/** Math.tan. */
export function tan(x: number): number {
  const z = 0.0;
  const ix = getHighWord(x) & 0x7fffffff; // |x| ~< pi/4
  if (ix <= 0x3fe921fb) {
    return kernelTan(x, z, 1);
  }
  if (ix >= 0x7ff00000) {
    return x - x; // NaN
  }
  const n = remPio2(x);
  // 1 -> n even, -1 -> n odd
  return kernelTan(REM_Y[0], REM_Y[1], 1 - ((n & 1) << 1));
}
