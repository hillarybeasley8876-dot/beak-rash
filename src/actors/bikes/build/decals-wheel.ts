// Canvas drawing for the wheel/drivetrain atlas cards (white on transparent; vertex colour tints them,
// the body material alpha-tests them): wire spokes, the cartoon speed-blur disc and chain links.
type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, w: number, h: number) => void;

const TAU = Math.PI * 2;

/** 16 tangent-laced spokes from the hub flange to the rim (card spans the rim's inner diameter). */
export const spokes: Draw = (ctx, w) => {
  const c = w / 2, flange = w * 0.075, rim = w * 0.495, n = 16;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.019;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, b = a + (k % 2 ? 0.42 : -0.42);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * flange, c + Math.sin(a) * flange);
    ctx.lineTo(c + Math.cos(b) * rim, c + Math.sin(b) * rim);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c + Math.cos(b) * (rim - w * 0.012), c + Math.sin(b) * (rim - w * 0.012), w * 0.014, 0, TAU);
    ctx.fill();
  }
};

/** Speed-blur disc: four thin tapered swoosh arcs (clockwise as drawn) over a sparse halftone ring that fades
 *  out toward rim and hub; ~85 % of the disc stays see-through. */
export const blur: Draw = (ctx, w) => {
  const c = w / 2;
  ctx.fillStyle = '#ffffff';
  const step = w / 28;
  for (let y = step / 2; y < w; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const r = Math.hypot(x - c, y - c) / c;
      const cover = 0.15 * Math.max(0, 1 - Math.abs(r - 0.62) / 0.26); // dot area / cell area
      if (cover < 0.025) continue;
      ctx.beginPath();
      ctx.arc(x, y, step * Math.sqrt(cover / Math.PI), 0, TAU);
      ctx.fill();
    }
  }
  const arcs: ReadonlyArray<readonly [number, number, number, number]> = [[0.4, 0.2, 1.7, 0.045], [0.6, 1.9, 1.8, 0.05], [0.78, 3.7, 1.6, 0.05], [0.92, 5.3, 1.5, 0.04]];
  for (const [rr, a0, span, thick] of arcs) {
    const n = 28;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + span * t, half = c * thick * (0.15 + 0.85 * t);
      ctx.lineTo(c + Math.cos(a) * (c * rr + half), c + Math.sin(a) * (c * rr + half));
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n, a = a0 + span * t, half = c * thick * (0.15 + 0.85 * t);
      ctx.lineTo(c + Math.cos(a) * (c * rr - half), c + Math.sin(a) * (c * rr - half));
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c + Math.cos(a0 + span) * c * rr, c + Math.sin(a0 + span) * c * rr, c * thick, 0, TAU);
    ctx.fill();
  }
};

/** One chain link per tile along u (the chain strip maps every link-length segment to the whole tile):
 *  black edges double as the outline, dark outer plate, two light rollers. */
export const chain: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a2c31';
  ctx.beginPath();
  ctx.roundRect(w * 0.03, h * 0.2, w * 0.94, h * 0.6, h * 0.3);
  ctx.fill();
  ctx.fillStyle = '#9aa0a8';
  for (const x of [0.22, 0.78]) {
    ctx.beginPath();
    ctx.arc(w * x, h / 2, h * 0.2, 0, TAU);
    ctx.fill();
  }
};

/** Chainring face: dark inner band under the teeth, five rounded spider arms with bolts, crank boss. */
export const spider: Draw = (ctx, w) => {
  const c = w / 2;
  ctx.lineWidth = w * 0.09;
  ctx.strokeStyle = '#3a3d44';
  ctx.beginPath();
  ctx.arc(c, c, w * 0.42, 0, TAU);
  ctx.stroke();
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * TAU;
    const x = c + Math.cos(a) * w * 0.38, y = c + Math.sin(a) * w * 0.38;
    ctx.lineWidth = w * 0.13;
    ctx.strokeStyle = '#121216';
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(x, y); ctx.stroke();
    ctx.lineWidth = w * 0.09;
    ctx.strokeStyle = '#3a3d44';
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#c9ced6';
    ctx.beginPath(); ctx.arc(x, y, w * 0.035, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#121216';
  ctx.beginPath(); ctx.arc(c, c, w * 0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#55585f';
  ctx.beginPath(); ctx.arc(c, c, w * 0.11, 0, TAU); ctx.fill();
};
