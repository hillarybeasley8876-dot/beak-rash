// More comic atlas sprites: segmented shock ring, cracked shield hexagon, heal plus, 4-point needle glint,
// ring dash (one shock segment that flies out on its own), shield shard.
// Solid-pool alpha doubles as "core strength": eroding sprites (erode flag) lose alpha < threshold
// first, so the shock segments taper toward their middles and the hexagon keeps its rim longest.
import type { Ctx } from './atlas-shapes';

const INK = '#0b0b0f';
const TAU = Math.PI * 2;

/** Conic gradient of `rgb` whose alpha peaks (1) at each segment centre and drops to 0.5 at its ends. */
function segmentAlpha(c: Ctx, rgb: string, segs: number, span: number): CanvasGradient {
  const g = c.createConicGradient(0, 0, 0);
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs;
    const w = span / segs;
    g.addColorStop(a0, `rgba(${rgb},0.5)`);
    g.addColorStop(a0 + w * 0.5, `rgba(${rgb},1)`);
    g.addColorStop(Math.min(1, a0 + w), `rgba(${rgb},0.5)`);
    if (a0 + w < 1) g.addColorStop(Math.min(1, a0 + w + 0.001), `rgba(${rgb},0)`);
  }
  return g;
}

/** Comic shockwave: 9 jagged arc segments with gaps, thick in the middle, thin at the ends, inked. */
export function shock(c: Ctx): void {
  const segs = 9;
  const span = 0.78; // share of each segment slot that is drawn (the rest is the gap)
  c.beginPath();
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * TAU;
    const a1 = a0 + (span / segs) * TAU;
    const steps = 10;
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      const a = a0 + (a1 - a0) * u;
      const thick = 3 + 7 * Math.sin(Math.PI * u);
      const r = 50 + thick * 0.5 + (j % 2 === 0 ? 2.5 : -1);
      if (j === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let j = steps; j >= 0; j--) {
      const u = j / steps;
      const a = a0 + (a1 - a0) * u;
      const r = 50 - (3 + 7 * Math.sin(Math.PI * u)) * 0.5;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  }
  c.lineJoin = 'round';
  c.lineWidth = 5;
  c.strokeStyle = segmentAlpha(c, '11,11,15', segs, span);
  c.stroke();
  c.fillStyle = segmentAlpha(c, '255,255,255', segs, span);
  c.fill();
}

/** Shield flash: a filled pale hexagon face with an ink rim and crack lines (it shatters into shards). */
export function hex(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 6;
    if (i === 0) c.moveTo(Math.cos(a) * 50, Math.sin(a) * 50);
    else c.lineTo(Math.cos(a) * 50, Math.sin(a) * 50);
  }
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  c.lineJoin = 'round';
  c.lineWidth = 9;
  c.strokeStyle = INK;
  c.stroke();
  // Cracks: zig-zags from an off-centre impact point out to the rim.
  c.beginPath();
  for (const [a, kink] of [[-0.4, 9], [1.5, -8], [2.9, 7], [4.4, -6]] as const) {
    c.moveTo(-6, -4);
    c.lineTo(-6 + Math.cos(a + 0.25) * 20 + kink, -4 + Math.sin(a + 0.25) * 20);
    c.lineTo(-6 + Math.cos(a) * 46, -4 + Math.sin(a) * 46);
  }
  c.lineWidth = 4;
  c.stroke();
}

/** Heal glyph: chunky inked plus. */
export function plus(c: Ctx): void {
  const a = 16;
  const b = 50;
  c.beginPath();
  c.moveTo(-a, -b); c.lineTo(a, -b); c.lineTo(a, -a); c.lineTo(b, -a); c.lineTo(b, a); c.lineTo(a, a);
  c.lineTo(a, b); c.lineTo(-a, b); c.lineTo(-a, a); c.lineTo(-b, a); c.lineTo(-b, -a); c.lineTo(-a, -a);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.lineJoin = 'round';
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.stroke();
}

/** Sparkle glint: 4 long thin needles, thin ink outline. */
export function glint(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 60 : 4.5;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.lineJoin = 'miter';
  c.lineWidth = 3;
  c.strokeStyle = INK;
  c.stroke();
}

/** One shock-ring segment: a slightly curved inked dash, thick in the middle, pointed at both ends. */
export function dash(c: Ctx): void {
  const n = 12;
  c.beginPath();
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    const x = -56 + 112 * u;
    c.lineTo(x, 6 - 0.0025 * x * x - 15 * Math.sin(Math.PI * u));
  }
  for (let j = n; j >= 0; j--) {
    const u = j / n;
    const x = -56 + 112 * u;
    c.lineTo(x, 6 - 0.0025 * x * x + 15 * Math.sin(Math.PI * u));
  }
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.strokeStyle = INK;
  c.stroke();
}

/** Shield shard: a jagged inked sliver. */
export function shard(c: Ctx): void {
  c.beginPath();
  c.moveTo(-10, -48);
  c.lineTo(22, -10);
  c.lineTo(12, 6);
  c.lineTo(18, 44);
  c.lineTo(-16, 14);
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  c.lineJoin = 'miter';
  c.lineWidth = 5;
  c.strokeStyle = INK;
  c.stroke();
}
