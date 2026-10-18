// Neon sign faces drawn into the city's neon atlas: glowing tube lettering on dark boards, bright
// lightbox shop signs, vertical blade signs and big rooftop letters. Unlit + HDR boost in neonMat.
import type { Rng } from '../../../core/rng';
import { FONT } from '../../fonts';
import type { AtlasRect, SignAtlas } from '../../scenery/signs/atlas';
import { cell } from '../../scenery/signs/faces';
import { P5, ransom, star } from '../../scenery/signs/p5draw';

type G = CanvasRenderingContext2D;

export const NEON = ['#ff2d95', '#22e8ff', '#ffe600', '#ff6a1f', '#7cff5a', '#b46bff', '#ff3048', '#ffffff'] as const;
const BOARD = '#0d0a16';
const LIGHTBOX = ['#e5191c', '#ffe600', '#1f6fe0', '#13a36f', '#ff7a1a', '#f4f1ea'] as const;

/** Glowing tube text: coloured halo, coloured body, pale hot core. */
export function tube(g: G, text: string, x: number, y: number, size: number, color: string, font: string, weight = 400): void {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${weight} ${Math.round(size)}px ${font}`;
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = size * 0.45;
  g.fillText(text, x, y);
  g.shadowBlur = size * 0.18;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
  g.lineWidth = Math.max(1.5, size * 0.035);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.strokeText(text, x, y);
  g.restore();
}

/** Neon outline tube around a rectangle. */
export function frameTube(g: G, x: number, y: number, w: number, h: number, color: string, lw: number): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.shadowColor = color;
  g.shadowBlur = lw * 3;
  g.strokeRect(x, y, w, h);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(1, lw * 0.35);
  g.strokeRect(x, y, w, h);
  g.restore();
}

/** Fits a font size so `text` spans at most `maxW` px. */
export function fit(g: G, text: string, font: string, size: number, maxW: number, weight = 400): number {
  g.font = `${weight} ${Math.round(size)}px ${font}`;
  const w = g.measureText(text).width;
  return w > maxW ? size * (maxW / w) : size;
}

/** Shop fascia (16:3): neon tube text on a dark board, or a bright lightbox with white/ink text. */
export function fasciaFace(atlas: SignAtlas, rng: Rng, text: string, lightbox: boolean): AtlasRect | null {
  return cell(atlas, 384, 72, (g, w, h) => {
    if (lightbox) {
      const bg = rng.pick(LIGHTBOX);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const ink = bg === '#ffe600' || bg === '#f4f1ea' ? P5.black : P5.white;
      const size = fit(g, text, FONT.heavy, h * 0.66, w - 40, 900);
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `900 ${Math.round(size)}px ${FONT.heavy}`;
      g.fillText(text, w / 2, h / 2 + 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, h - 6, w, 6);
      return;
    }
    g.fillStyle = BOARD;
    g.fillRect(0, 0, w, h);
    const col = rng.pick(NEON);
    frameTube(g, 6, 6, w - 12, h - 12, rng.pick(NEON), 3);
    const font = rng.chance(0.5) ? FONT.cn : FONT.cnFun;
    tube(g, text, w / 2, h / 2 + 2, fit(g, text, font, h * 0.62, w - 48), col, font);
  });
}

/** Vertical blade sign (1:3): characters stacked top to bottom. */
export function bladeFace(atlas: SignAtlas, rng: Rng, text: string, lightbox: boolean): AtlasRect | null {
  return cell(atlas, 96, 288, (g, w, h) => {
    const chars = Array.from(text).slice(0, 4);
    const bg = lightbox ? rng.pick(LIGHTBOX) : BOARD;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const col = rng.pick(NEON);
    if (!lightbox) frameTube(g, 5, 5, w - 10, h - 10, col, 3);
    const step = (h - 24) / chars.length, size = Math.min(w * 0.72, step * 0.82);
    chars.forEach((ch, i) => {
      const y = 12 + step * (i + 0.5);
      if (lightbox) {
        g.fillStyle = bg === '#ffe600' || bg === '#f4f1ea' ? P5.black : P5.white;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `900 ${Math.round(size)}px ${FONT.heavy}`;
        g.fillText(ch, w / 2, y);
      } else tube(g, ch, w / 2, y, size, rng.chance(0.8) ? col : rng.pick(NEON), FONT.cn);
    });
  });
}

/** Rooftop sign (4:1): big tube letters on a scaffold board, small tag line. */
export function roofFace(atlas: SignAtlas, rng: Rng, text: string): AtlasRect | null {
  return cell(atlas, 640, 160, (g, w, h) => {
    g.fillStyle = BOARD;
    g.fillRect(0, 0, w, h);
    const col = rng.pick(NEON), alt = rng.pick(NEON);
    const parts = text.split(' ');
    const main = parts[0] ?? text, sub = parts.slice(1).join(' ');
    tube(g, main, w / 2, sub ? h * 0.38 : h * 0.5, fit(g, main, FONT.cn, sub ? h * 0.5 : h * 0.66, w - 40), col, FONT.cn);
    if (sub) tube(g, sub, w / 2, h * 0.8, fit(g, sub, FONT.heavy, h * 0.24, w - 80, 900), alt, FONT.heavy, 900);
  });
}

/** P5 red/black board: ransom-note line with stars. */
export function p5Face(atlas: SignAtlas, rng: Rng, text: string): AtlasRect | null {
  return cell(atlas, 512, 160, (g, w, h) => {
    g.fillStyle = P5.red;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.black;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.22, 0); g.lineTo(w * 0.14, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.86, 0); g.lineTo(w * 0.78, h); g.lineTo(w, h); g.closePath(); g.fill();
    star(g, w * 0.08, h * 0.5, h * 0.24, P5.white, 0.2);
    star(g, w * 0.93, h * 0.5, h * 0.2, P5.yellow, -0.3);
    ransom(g, rng, text, w * 0.17, h * 0.1, w * 0.64, h * 0.8);
  });
}
