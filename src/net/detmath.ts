// The following is adapted from fdlibm (http://www.netlib.org/fdlibm).
//
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
//
// The original source code covered by the above license above has been
// modified significantly by Google Inc.
// Copyright 2016 the V8 project authors. All rights reserved.
//
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//
// ====================================================
//
// Deterministic Math (SPEC §28, the online lockstep determinism contract).
//
// Browsers' Math.sin / exp / pow … may differ in the last bit between engines
// (V8 uses LLVM's libc, WebKit the system libm, Firefox an fdlibm port), so two
// clients of the same online race drift apart after a few seconds of simulation.
// This module is a pure-JS port of V8 12.4's fdlibm (src/base/ieee754.cc) and
// of V8's Math.hypot (src/builtins/math.tq), built only from + - * / and
// Math.sqrt — IEEE 754 makes those identical in every engine — so installing
// it over Math.* gives every client bit-identical results.
//
// The port is line by line: the same constants, the same branches, the same
// order of operations (floating point is not associative, so a*b+c must stay
// a*b+c). C's word access (GET_HIGH_WORD, EXTRACT_WORDS, …) becomes a shared
// scratch Float64Array with an Int32Array view on the same buffer.
//
//   installDetMath() puts the port in place of Math.*; it is idempotent.

import { sin, cos, tan } from './detmath/trig';
import { asin, acos } from './detmath/asin';
import { atan, atan2 } from './detmath/atan';
import { exp, expm1 } from './detmath/exp';
import { log, log1p, log2, log10 } from './detmath/log';
import { sinh, cosh, tanh, cbrt } from './detmath/hyp';
import { pow } from './detmath/pow';
import { hypot } from './detmath/hypot';

export { sin, cos, tan, asin, acos, atan, atan2, exp, expm1, log, log1p, log2, log10, sinh, cosh, tanh, cbrt, pow, hypot };

type MathFn = (...args: number[]) => number;

/** Every function the installer replaces, in the order the spec lists them. */
const TABLE: Record<string, MathFn> = {
  sin, cos, tan, asin, acos, atan, atan2,
  exp, expm1, log, log1p, log2, log10,
  sinh, cosh, tanh, cbrt, pow, hypot,
};

/** The names installDetMath() overwrites. */
export const DET_MATH_NAMES = Object.keys(TABLE);

/**
 * Install the deterministic port over Math.*, so every engine computes the same
 * bits for the same inputs. Idempotent: calling it twice changes nothing.
 */
export function installDetMath(): void {
  const m = Math as unknown as Record<string, MathFn>;
  for (const name of DET_MATH_NAMES) m[name] = TABLE[name];
}
