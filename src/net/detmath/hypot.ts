// Deterministic Math — V8's Math.hypot, ported from src/builtins/math.tq
// (FastMathHypot for 0-3 arguments, the Kahan-summed slow path for more).
// See src/net/detmath.ts for the copyright notices.

/** ToNumber, the way V8 converts a Math.hypot argument. */
function num(v: number): number {
  return typeof v === 'number' ? v : Number(v);
}

/** Math.hypot: the Euclidean length of the vector of arguments. */
export function hypot(...args: number[]): number {
  const n = args.length;
  if (n === 0) return 0;
  const a = Math.abs(num(args[0]));
  if (n === 1) return a;
  const b = Math.abs(num(args[1]));
  if (n === 2) {
    if (a === Infinity || b === Infinity) return Infinity;
    const max = Math.max(a, b);
    if (Number.isNaN(max)) return NaN;
    if (max === 0) return 0;
    return Math.sqrt((a / max) * (a / max) + (b / max) * (b / max)) * max;
  }
  if (n === 3) {
    const c = Math.abs(num(args[2]));
    if (a === Infinity || b === Infinity || c === Infinity) return Infinity;
    const max = Math.max(Math.max(a, b), c);
    if (Number.isNaN(max)) return NaN;
    if (max === 0) return 0;
    const powerA = (a / max) * (a / max);
    const powerB = (b / max) * (b / max);
    const compensation = (powerA + powerB) - powerA - powerB;
    const powerC = (c / max) * (c / max) - compensation;
    return Math.sqrt(powerA + powerB + powerC) * max;
  }
  // More than three arguments: V8's slow path (Kahan summation).
  const absValues: number[] = [];
  let oneArgIsNaN = false;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const value = num(args[i]);
    if (Number.isNaN(value)) {
      oneArgIsNaN = true;
    } else {
      const absValue = Math.abs(value);
      absValues.push(absValue);
      if (absValue > max) max = absValue;
    }
  }
  if (max === Infinity) return Infinity;
  if (oneArgIsNaN) return NaN;
  if (max === 0) return 0;
  // Kahan summation to avoid rounding errors; normalize to the largest one.
  let sum = 0;
  let compensation = 0;
  for (let i = 0; i < absValues.length; i++) {
    const v = absValues[i] / max;
    const summand = v * v - compensation;
    const preliminary = sum + summand;
    compensation = (preliminary - sum) - summand;
    sum = preliminary;
  }
  return Math.sqrt(sum) * max;
}
