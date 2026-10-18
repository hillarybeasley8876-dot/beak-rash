// Sunset Pass sign faces drawn into the shared sign atlas: road signs with a SUNSET PASS band,
// brown scenic signs (观景台 / 温泉), the capybara hot-spring board and the lantern gantry header.
import type { Rng } from '../../../core/rng';
import { FONT } from '../../fonts';
import type { AtlasRect, SignAtlas } from '../../scenery/signs/atlas';
import { cell } from '../../scenery/signs/faces';
import { halftone, label, P5, ransom, star } from '../../scenery/signs/p5draw';

type G = CanvasRenderingContext2D;

/** Two little peaks + sun: the Sunset Pass emblem (fits a h × h box at x, y). */
function emblem(g: G, x: number, y: number, h: number, ink: string, sun: string): void {
  g.fillStyle = sun;
  g.beginPath(); g.arc(x + h * 0.62, y + h * 0.42, h * 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(x, y + h); g.lineTo(x + h * 0.36, y + h * 0.3); g.lineTo(x + h * 0.56, y + h * 0.62);
  g.lineTo(x + h * 0.72, y + h * 0.46); g.lineTo(x + h, y + h); g.closePath(); g.fill();
}

function fitSize(text: string, w: number, max: number, k = 1.12): number {
  return Math.min(max, (w / Math.max(2, Array.from(text).length)) * k);
}

/** Rectangular road sign: white plate, red SUNSET PASS band, big brush-blocky caption. */
export function passSignFace(atlas: SignAtlas, text: string): AtlasRect | null {
  return cell(atlas, 256, 160, (g, w, h) => {
    g.fillStyle = P5.white;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.red;
    g.fillRect(0, 0, w, 38);
    emblem(g, 12, 8, 24, P5.white, P5.yellow);
    label(g, 'SUNSET PASS', w / 2 + 12, 20, 22, P5.white, FONT.en, 400);
    const lines = text.includes(' ') ? text.split(' ') : [text];
    const size = Math.min(...lines.map((l) => fitSize(l, w - 24, lines.length > 1 ? 44 : 58)));
    lines.forEach((l, i) => {
      const cy = 38 + (h - 38) / 2 + 2 + (i - (lines.length - 1) / 2) * size * 1.08;
      label(g, l, w / 2, cy, size, P5.black, FONT.cn, 400);
    });
    g.lineWidth = 10;
    g.strokeStyle = P5.black;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** Brown scenic-area sign (景区): big title, smaller joke line, English caption, white rim. */
export function scenicFace(atlas: SignAtlas, title: string, sub: string, en: string): AtlasRect | null {
  return cell(atlas, 288, 160, (g, w, h) => {
    g.fillStyle = '#6b3a22';
    g.fillRect(0, 0, w, h);
    g.lineWidth = 6;
    g.strokeStyle = '#fff6e8';
    g.strokeRect(9, 9, w - 18, h - 18);
    emblem(g, 22, 30, 44, '#fff6e8', '#ffb84a');
    const cx = w / 2 + 28;
    label(g, title, cx, h * 0.3, fitSize(title, w - 104, 50, 1.0), '#fff6e8', FONT.cn, 400);
    label(g, sub, cx, h * 0.58, fitSize(sub, w - 110, 30, 1.0), '#ffd9a8', FONT.cnFun, 400);
    label(g, en, cx, h * 0.82, 18, '#ffd9a8', FONT.en, 400);
  });
}

/** Weathered wooden board for the capybara hot spring: ♨ marks, ransom-note headline, two lines. */
export function hotSpringFace(atlas: SignAtlas, rng: Rng, title: string, l1: string, l2: string): AtlasRect | null {
  return cell(atlas, 384, 224, (g, w, h) => {
    g.fillStyle = '#9a6a3f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,32,16,0.35)';
    g.lineWidth = 3;
    for (let y = 18; y < h; y += 26) { g.beginPath(); g.moveTo(0, y + rng.range(-3, 3)); g.lineTo(w, y + rng.range(-3, 3)); g.stroke(); }
    g.lineWidth = 10;
    g.strokeStyle = '#3b2414';
    g.strokeRect(5, 5, w - 10, h - 10);
    for (const x of [34, w - 34]) label(g, '♨', x, 50, 46, P5.red, FONT.heavy);
    ransom(g, rng, title, 62, 14, w - 124, 76);
    label(g, l1, w / 2, 128, 40, '#fff4dc', FONT.cnFun, 400);
    g.fillStyle = P5.red;
    g.beginPath(); g.moveTo(40, 158); g.lineTo(w - 30, 152); g.lineTo(w - 44, 206); g.lineTo(28, 210); g.closePath(); g.fill();
    star(g, 58, 182, 16, P5.yellow, 0.2);
    label(g, l2, w / 2 + 10, 182, 40, P5.white, FONT.cn, 400);
  });
}

/** Lantern-gantry header: black board, red halftone corners, big word + subtitle. */
export function lanternGantryFace(atlas: SignAtlas, word: string, sub: string): AtlasRect | null {
  return cell(atlas, 768, 128, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    halftone(g, 0, 0, 170, h, P5.red, 9);
    halftone(g, w - 170, 0, 170, h, P5.red, 9);
    emblem(g, 40, 22, 70, P5.white, P5.yellow);
    emblem(g, w - 110, 22, 70, P5.white, P5.yellow);
    label(g, word, w / 2, h * 0.45, 88, P5.white, FONT.en, 400);
    label(g, sub, w / 2, h * 0.87, 20, P5.yellow, FONT.cn, 400);
  });
}
