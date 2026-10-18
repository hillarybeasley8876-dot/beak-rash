// P5-style canvas drawing helpers for signage: ransom-note lettering, jagged bursts, halftone,
// stars. Original designs (no Persona assets): red #E5191C, black #0B0B0F, white, yellow accents.
import type { Rng } from '../../../core/rng';
import { FONT } from '../../fonts';

export const P5 = { red: '#e5191c', hot: '#ff1e3c', black: '#0b0b0f', white: '#ffffff', yellow: '#ffe600' } as const;

type G = CanvasRenderingContext2D;

/** Jagged star-burst polygon filling roughly the box (x, y, w, h). */
export function burst(g: G, rng: Rng, x: number, y: number, w: number, h: number, spikes: number, fill: string): void {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.5 : rng.range(0.32, 0.42);
    const px = x + w / 2 + Math.cos(a) * w * r, py = y + h / 2 + Math.sin(a) * h * r;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

/** Halftone dot field in a rectangle, dots growing toward one corner. */
export function halftone(g: G, x: number, y: number, w: number, h: number, color: string, step = 10): void {
  g.fillStyle = color;
  for (let py = y; py < y + h; py += step) {
    for (let px = x + ((py / step) % 2) * (step / 2); px < x + w; px += step) {
      const t = ((px - x) / w + (py - y) / h) / 2;
      const r = step * 0.42 * t;
      if (r < 0.6) continue;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export function star(g: G, cx: number, cy: number, r: number, fill: string, rot = 0): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

const STYLES: Array<[string, string]> = [[P5.black, P5.white], [P5.white, P5.black], [P5.white, P5.red], [P5.black, P5.white]];

/**
 * Ransom-note text centred in (x, y, w, h): every glyph in its own tilted box, mixed fonts and
 * colours, ±20 % scale. Wraps to two lines when long.
 */
export function ransom(g: G, rng: Rng, text: string, x: number, y: number, w: number, h: number): void {
  const chars = Array.from(text.replace(/\s+/g, ' '));
  const lines = chars.length > 9 ? splitLine(chars) : [chars];
  const size = Math.min(h / (lines.length * 1.25), (w / Math.max(...lines.map((l) => l.length))) * 0.92);
  lines.forEach((line, li) => {
    const lw = line.length * size * 0.98;
    let cx = x + (w - lw) / 2 + size / 2;
    const cy = y + h / 2 + (li - (lines.length - 1) / 2) * size * 1.18;
    for (const ch of line) {
      if (ch === ' ') { cx += size * 0.6; continue; }
      const [fg, bg] = rng.pick(STYLES);
      const s = size * rng.range(0.82, 1.08);
      g.save();
      g.translate(cx, cy + rng.range(-0.06, 0.06) * size);
      g.rotate(rng.range(-0.14, 0.14));
      g.fillStyle = bg;
      g.fillRect(-s * 0.5, -s * 0.52, s, s * 1.04);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const ascii = /[\x20-\x7e]/.test(ch);
      const weight = ascii ? 400 : rng.chance(0.5) ? 400 : 900;
      g.font = `${weight} ${Math.round(s * (ascii ? 0.9 : 0.78))}px ${ascii ? FONT.en : rng.chance(0.6) ? FONT.cn : FONT.heavy}`;
      g.fillText(ch, 0, s * 0.04);
      g.restore();
      cx += size * 0.98;
    }
  });
}

function splitLine(chars: string[]): string[][] {
  const mid = Math.ceil(chars.length / 2);
  // Prefer breaking at a space near the middle.
  let best = mid;
  for (let d = 0; d < 4; d++) {
    if (chars[mid + d] === ' ') { best = mid + d; break; }
    if (chars[mid - d] === ' ') { best = mid - d; break; }
  }
  return [chars.slice(0, best), chars.slice(best).filter((c, i) => !(i === 0 && c === ' '))];
}

/** Plain bold text helper (signs that should look official, e.g. road signs). */
export function label(g: G, text: string, cx: number, cy: number, size: number, color: string, font: string = FONT.heavy, weight = 900): void {
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${weight} ${Math.round(size)}px ${font}`;
  g.fillText(text, cx, cy);
}
