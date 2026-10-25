// Road-mark designs (road/marks.ts) in one small sign atlas: flat tar / concrete patches with sealed seams,
// a manhole cover (embossed star), worn white lane arrows (straight, bend left / right), paired skid marks
// and meme words stacked along the lane, one heavy glyph per GLYPH_M of road, first glyph nearest the rider
// (road text reads from near to far). Canvas top = far end of a mark (v = 1); canvas left = road left.
import { Rng } from '../../core/rng';
import { FONT } from '../fonts';
import { SignAtlas, type AtlasRect } from '../scenery/signs/atlas';
import { cell } from '../scenery/signs/faces';

type G = CanvasRenderingContext2D;
export type MarkDesign = 'patchDark' | 'patchLight' | 'manhole' | 'arrow' | 'bendL' | 'bendR' | 'skid';

/** Pixels per glyph along a word cell, its width, and the road length of one glyph (m). */
const GLYPH_PX = 80, WORD_W = 96;
export const GLYPH_M = 3;
const PAINT = 'rgba(244, 242, 234, 0.92)';
export const WORD_SPEC = `900 ${GLYPH_PX - 8}px ${FONT.heavy}`;

/** Knock small holes out of the paint just drawn (worn markings). */
function wear(g: G, w: number, h: number, rng: Rng, n: number): void {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${rng.range(0.25, 0.7).toFixed(2)})`;
    const r = rng.range(0.8, 2.6);
    g.beginPath();
    g.arc(rng.range(0, w), rng.range(0, h), r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function patch(g: G, w: number, h: number, fill: string, seam: string, rng: Rng): void {
  g.fillStyle = fill;
  g.fillRect(8, 8, w - 16, h - 16);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)';
    g.fillRect(rng.range(10, w - 12), rng.range(10, h - 12), 2, 2);
  }
  g.strokeStyle = seam;
  g.lineWidth = 6;
  g.strokeRect(9, 9, w - 18, h - 18);
}

function manhole(g: G, w: number, h: number): void {
  const c = w / 2, r = w / 2 - 4;
  const disc = (rr: number, fill: string): void => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(c, h / 2, rr, 0, Math.PI * 2);
    g.fill();
  };
  disc(r, 'rgba(28, 29, 34, 0.92)');
  disc(r - 5, 'rgba(78, 80, 88, 0.92)');
  g.save();
  g.beginPath();
  g.arc(c, h / 2, r - 9, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = 'rgba(34, 35, 41, 0.85)';
  g.lineWidth = 3;
  for (let x = 0; x < w; x += 9) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke();
  }
  g.restore();
  disc(r * 0.34, 'rgba(78, 80, 88, 0.95)');
  // Embossed star in the middle (a P5 wink on the iron).
  g.fillStyle = 'rgba(30, 31, 37, 0.9)';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.12 : r * 0.28;
    g.lineTo(c + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** Lane arrow pointing to the far end; `bend` −1 / 1 curls the head left / right. */
function arrow(g: G, w: number, h: number, bend: number, rng: Rng): void {
  const cx = w / 2, shaft = w * 0.2, headW = w * 0.8;
  g.fillStyle = PAINT;
  g.strokeStyle = PAINT;
  if (!bend) {
    g.fillRect(cx - shaft / 2, h * 0.36, shaft, h * 0.6);
    g.beginPath();
    g.moveTo(cx - headW / 2, h * 0.4); g.lineTo(cx, h * 0.04); g.lineTo(cx + headW / 2, h * 0.4);
    g.closePath();
    g.fill();
  } else {
    // Shaft up the lane, then a curve toward the bend; the head points along the curve's end.
    const ex = cx + bend * w * 0.3, ey = h * 0.2;
    g.lineWidth = shaft;
    g.beginPath();
    g.moveTo(cx - bend * w * 0.12, h * 0.96);
    g.lineTo(cx - bend * w * 0.12, h * 0.55);
    g.quadraticCurveTo(cx - bend * w * 0.12, h * 0.3, ex - bend * w * 0.02, ey + h * 0.06);
    g.stroke();
    g.beginPath();
    g.moveTo(ex - bend * w * 0.36, ey + h * 0.02); g.lineTo(ex + bend * w * 0.16, ey - h * 0.14); g.lineTo(ex + bend * w * 0.06, ey + h * 0.2);
    g.closePath();
    g.fill();
  }
  wear(g, w, h, rng, 120);
}

/** Two dark tyre streaks along the cell, broken and fading in / out at the ends. */
function skid(g: G, w: number, h: number, rng: Rng): void {
  for (const x of [w * 0.22, w * 0.7]) {
    for (let y = 0; y < h; y += 4) {
      const t = y / h, fade = Math.min(1, t * 5, (1 - t) * 3);
      g.fillStyle = `rgba(16, 16, 20, ${(0.42 * fade * rng.range(0.55, 1)).toFixed(3)})`;
      g.fillRect(x + rng.range(-1, 1), y, w * 0.14, 4);
    }
  }
}

/** A meme word along the lane: glyph i (0 = nearest) in slot i from the bottom, squeezed to the cell width. */
function word(g: G, w: number, h: number, text: string, rng: Rng): void {
  const chars = Array.from(text);
  g.fillStyle = PAINT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = WORD_SPEC;
  chars.forEach((ch, i) => {
    const cy = h - (i + 0.5) * GLYPH_PX;
    const k = Math.min(1, (w - 10) / Math.max(1, g.measureText(ch).width));
    g.save();
    g.translate(w / 2, cy);
    g.scale(k, 1);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  wear(g, w, h, rng, 60 * chars.length);
}

export interface MarkFaces { atlas: SignAtlas; design(d: MarkDesign): AtlasRect | null; word(text: string): AtlasRect | null }

/** Paint every design and word (deferred atlas: flushed here; repaint() redraws them once a late font lands).
 *  Tallest cells first (arrows, long words) so the shelves pack tightly. */
export function markFaces(words: string[]): MarkFaces {
  const atlas = new SignAtlas(1024, 1024, true);
  const rng = new Rng(0x9a17);
  const designs = new Map<MarkDesign, AtlasRect | null>();
  for (const [d, bend, salt] of [['arrow', 0, 11], ['bendL', -1, 12], ['bendR', 1, 13]] as Array<[MarkDesign, number, number]>) {
    designs.set(d, cell(atlas, WORD_W, 400, (g, w, h) => arrow(g, w, h, bend, rng.fork(salt))));
  }
  designs.set('skid', cell(atlas, 64, 320, (g, w, h) => skid(g, w, h, rng.fork(16))));
  const words2 = new Map<string, AtlasRect | null>();
  for (const text of [...new Set(words)].sort((a, b) => Array.from(b).length - Array.from(a).length)) {
    const r = rng.fork(words2.size + 1);
    words2.set(text, cell(atlas, WORD_W, GLYPH_PX * Array.from(text).length, (g, w, h) => word(g, w, h, text, r.fork(1))));
  }
  designs.set('patchDark', cell(atlas, 192, 192, (g, w, h) => patch(g, w, h, 'rgba(22, 22, 28, 0.32)', 'rgba(12, 12, 16, 0.6)', rng.fork(14))));
  designs.set('patchLight', cell(atlas, 192, 192, (g, w, h) => patch(g, w, h, 'rgba(232, 228, 216, 0.17)', 'rgba(16, 16, 20, 0.5)', rng.fork(15))));
  designs.set('manhole', cell(atlas, 96, 96, (g, w, h) => manhole(g, w, h)));
  atlas.flush();
  return { atlas, design: (d) => designs.get(d) ?? null, word: (t) => words2.get(t) ?? null };
}
