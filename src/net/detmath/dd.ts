// Deterministic Math — double-double arithmetic.
//
// The fdlibm tanh (the V8 12.4 reference this port follows) rounds expm1's result to 53 bits, so it
// is 1-2 ulp off; the browser's Math.tanh (V8 14) is correctly rounded. Summing the Taylor series
// of expm1 in double-double and dividing in double-double puts this port's tanh on the correctly
// rounded value as well.
//
// A double-double is a pair of doubles (hi, lo) with hi + lo ≈ the value to ~1e-32 relative.
// Everything here is built from +, -, * and / only, so every engine computes the same bits.

/** Scratch: a double-double is a pair of doubles in one of these. */
const A = new Float64Array(2);
const B = new Float64Array(2);
const C = new Float64Array(2);
/** Scratch for ddDiv's own two steps (so its arguments are never overwritten). */
const D = new Float64Array(2);
const E = new Float64Array(2);

/** The exact sum of two double-doubles. */
function ddAdd(ah: number, al: number, bh: number, bl: number, out: Float64Array): void {
  const s = ah + bh;
  const bb = s - ah;
  out[0] = s;
  out[1] = (ah - (s - bb)) + (bh - bb) + (al + bl);
}

/**
 * The product of two double-doubles. Dekker's splitting keeps the product exact for normal
 * operands; the correction is ~1e-32 relative.
 */
function ddMul(ah: number, al: number, bh: number, bl: number, out: Float64Array): void {
  const p = ah * bh;
  const ca = 134217729 * ah;
  const ahi = ca - (ca - ah);
  const alo = ah - ahi;
  const cb = 134217729 * bh;
  const bhi = cb - (cb - bh);
  const blo = bh - bhi;
  out[0] = p;
  out[1] = ((ahi * bhi - p) + ahi * blo + alo * bhi) + alo * blo + ah * bl + al * bh;
}

/** a / b, with a a double-double and b a plain double (one Newton step). */
function ddDivDouble(ah: number, al: number, bh: number, out: Float64Array): void {
  const q1 = ah / bh;
  const p = q1 * bh;
  // the exact error of q1 * bh
  const cb = 134217729 * bh;
  const bhi = cb - (cb - bh);
  const blo = bh - bhi;
  const cq = 134217729 * q1;
  const qhi = cq - (cq - q1);
  const qlo = q1 - qhi;
  const err = ((qhi * bhi - p) + qhi * blo + qlo * bhi) + qlo * blo;
  const r = (ah - p) - err + al;
  out[0] = q1;
  out[1] = r / bh;
}

/** a / b, with both double-doubles (one Newton step). */
function ddDiv(ah: number, al: number, bh: number, bl: number, out: Float64Array): void {
  const q1 = ah / bh;
  ddMul(q1, 0, bh, bl, D);
  ddAdd(ah, al, -D[0], -D[1], E); // the residual, exactly (E[0] + E[1])
  out[0] = q1;
  out[1] = (E[0] + E[1]) / bh;
}

/**
 * expm1(x) for -2 <= x <= 0, as a double-double: the Taylor series x + x²/2! + x³/3! + ...
 * summed in double-double. The truncation error after 28 terms is below 1e-20 and the summation
 * error below 1e-31, so the result is the correctly rounded expm1 to within 1e-20 relative.
 */
export function expm1DoubleDouble(x: number, out: Float64Array): void {
  let th = 1; // the term, x^n / n!
  let tl = 0;
  let sh = 1; // the sum
  let sl = 0;
  for (let n = 1; n <= 28; n++) {
    ddMul(th, tl, x, 0, A); // the term *= x
    ddDivDouble(A[0], A[1], n, C); // the term /= n
    th = C[0];
    tl = C[1];
    ddAdd(sh, sl, th, tl, B);
    sh = B[0];
    sl = B[1];
  }
  ddAdd(sh, sl, -1, 0, A); // expm1 = exp - 1
  out[0] = A[0];
  out[1] = A[1];
}

/**
 * -t / (t + 2) for a double-double t, as a double-double: tanh's "small" branch, evaluated with
 * the extra precision that makes it correctly rounded.
 */
export function negDivPlus2(t: Float64Array, out: Float64Array): void {
  ddAdd(t[0], t[1], 2, 0, A); // the denominator, t + 2
  ddDiv(-t[0], -t[1], A[0], A[1], B);
  out[0] = B[0];
  out[1] = B[1];
}
