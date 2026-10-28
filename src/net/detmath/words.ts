// Deterministic Math — bit-level access to doubles, the JS stand-in for fdlibm's
// GET_HIGH_WORD / GET_LOW_WORD / EXTRACT_WORDS / INSERT_WORDS / SET_*_WORD.
//
// The scratch buffer lives at module level: the ports must not allocate per call.
// A little-endian view is used: index 0 is the low word, index 1 the high word.
//
// This file is part of the port in src/net/detmath.ts (fdlibm / V8, see that
// file for the copyright notices).

const BUF = new ArrayBuffer(8);
const F64 = new Float64Array(BUF);
const I32 = new Int32Array(BUF);
const U32 = new Uint32Array(BUF);

/** The high 32 bits of `d`, as a signed int32 (fdlibm's GET_HIGH_WORD). */
export function getHighWord(d: number): number {
  F64[0] = d;
  return I32[1];
}

/** The low 32 bits of `d`, as an unsigned int32 (fdlibm's GET_LOW_WORD). */
export function getLowWord(d: number): number {
  F64[0] = d;
  return U32[0];
}

/** fdlibm's EXTRACT_WORDS: the two halves of `d`, in one store. */
export let wHi = 0;
export let wLo = 0;
export function extractWords(d: number): void {
  F64[0] = d;
  wHi = I32[1];
  wLo = U32[0];
}

/** fdlibm's SET_HIGH_WORD: `d` with its high 32 bits replaced by `v`. */
export function setHighWord(d: number, v: number): number {
  F64[0] = d;
  U32[1] = v >>> 0;
  return F64[0];
}

/** fdlibm's SET_LOW_WORD: `d` with its low 32 bits replaced by `v`. */
export function setLowWord(d: number, v: number): number {
  F64[0] = d;
  U32[0] = v >>> 0;
  return F64[0];
}

/** fdlibm's SET_LOW_WORD(d, 0): `d` with its low 32 bits cleared (the usual case). */
export function clearLowWord(d: number): number {
  F64[0] = d;
  U32[0] = 0;
  return F64[0];
}

/** fdlibm's INSERT_WORDS: a double rebuilt from its two 32-bit halves. */
export function insertWords(hiWord: number, loWord: number): number {
  U32[1] = hiWord >>> 0;
  U32[0] = loWord >>> 0;
  return F64[0];
}

/**
 * fdlibm's GET_HIGH_WORD + SET_HIGH_WORD in one pass: the high word of `d`
 * plus `add`, written back. Saves a store/load round trip in the hot paths.
 * The new high word (as a signed int32) lands in `bumpedHigh`.
 */
export let bumpedHigh = 0;
export function bumpHighWord(d: number, add: number): number {
  F64[0] = d;
  const hi = (U32[1] + add) | 0;
  U32[1] = hi >>> 0;
  bumpedHigh = hi;
  return F64[0];
}

const TWO54 = 1.80143985094819840000e+16; // 2**54
const TWO52 = 4503599627370496; // 2**52
const TWO32 = 4294967296; // 2**32

/** 2**-s for 0 <= s <= 52, exactly (built from the exponent word). */
function twoNeg(s: number): number {
  return insertWords((1023 - s) << 20, 0);
}

/**
 * C's scalbn(x, n): x * 2**n.
 * Exact while the result is normal; subnormal results are rounded once, to
 * nearest-even, exactly like the hardware.
 */
export function scalbn(x: number, n: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  let d = x;
  let k = n | 0;
  let h = getHighWord(d);
  let e = (h >>> 20) & 0x7ff;
  if (e === 0) {
    // subnormal input: scale it up by 2**54 first (exact)
    d *= TWO54;
    k -= 54;
    h = getHighWord(d);
    e = (h >>> 20) & 0x7ff;
  }
  const ne = e + k;
  if (ne >= 1 && ne <= 0x7fe) {
    return setHighWord(d, ((h & 0x800fffff) | (ne << 20)) >>> 0);
  }
  if (ne > 0x7fe) return x > 0 ? Infinity : -Infinity;
  // Subnormal result: the 53-bit significand has to shift right by s bits.
  const s = 1 - e - k;
  const m = (h & 0xfffff) * TWO32 + getLowWord(d) + TWO52; // 53-bit significand
  let q: number;
  if (s >= 54) {
    q = 0;
  } else if (s === 53) {
    q = m > TWO52 ? 1 : 0;
  } else {
    const qe = m * twoNeg(s); // exact
    q = Math.floor(qe);
    const frac = qe - q;
    if (frac > 0.5 || (frac === 0.5 && q % 2 === 1)) q += 1;
  }
  if (q === 0) return x > 0 ? 0 : -0;
  // Q is the 52-bit fraction field: the high word keeps the sign, the low 32 bits of Q go low.
  const qHi = Math.floor(q / TWO32);
  const qLo = q - qHi * TWO32;
  return insertWords(((h & 0x80000000) >>> 0) | qHi, qLo);
}
