// Small numeric helpers shared by every unit. All damping is frame-rate independent.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const KMH = 3.6; // m/s → km/h factor

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));
export const remap = (a0: number, a1: number, b0: number, b1: number, v: number): number =>
  lerp(b0, b1, clamp01(invLerp(a0, a1, v)));

/** Exponential approach: moves `current` toward `target` with rate `lambda` (1/s). */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Linear approach capped at `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number =>
  current < target ? Math.min(current + maxDelta, target) : Math.max(current - maxDelta, target);

export const wrapAngle = (a: number): number => {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
};

export const dampAngle = (current: number, target: number, lambda: number, dt: number): number =>
  current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number): number => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (t: number, k = 1.70158): number => {
  const x = clamp01(t) - 1;
  return 1 + (k + 1) * x * x * x + k * x * x;
};
export const easeOutElastic = (t: number): number => {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1;
};

/** Critically damped spring step (value + velocity), stable for any dt. */
export function springStep(
  value: number, velocity: number, target: number, omega: number, dt: number,
): [number, number] {
  const x = value - target;
  const exp = Math.exp(-omega * dt);
  const nextX = (x + (velocity + omega * x) * dt) * exp;
  const nextV = (velocity - omega * (velocity + omega * x) * dt) * exp;
  return [target + nextX, nextV];
}
