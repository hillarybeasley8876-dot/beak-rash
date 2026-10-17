// Sign faces drawn into the shared atlas: meme billboards (P5 frames, optional generated art),
// road signs, warning signs, chevrons, distance markers and banners.
import type { Rng } from '../../../core/rng';
import { FONT } from '../../fonts';
import type { AtlasRect, SignAtlas } from './atlas';
import { burst, halftone, label, P5, ransom, star } from './p5draw';

type G = CanvasRenderingContext2D;

function cell(atlas: SignAtlas, w: number, h: number, draw: (g: G, w: number, h: number) => void): AtlasRect | null {
  const c = atlas.alloc(w, h);
  if (!c) {
    console.warn('[track] sign atlas full; skipping a sign face');
    return null;
  }
  const g = atlas.g;
  g.save();
  g.translate(c.x, c.y);
  g.beginPath();
  g.rect(0, 0, w, h);
  g.clip();
  draw(g, w, h);
  g.restore();
  return c.rect;
}

/** Billboard with generated poster art (16:9): full-bleed art, ransom-note line on a jagged band
 *  across the calm top of the poster, thick ink frame with a red corner star. */
function artBillboard(atlas: SignAtlas, rng: Rng, text: string, art: HTMLImageElement): AtlasRect | null {
  return cell(atlas, 512, 288, (g, w, h) => {
    const k = Math.max(w / art.width, h / art.height);
    // Keep the top of the poster (its calm band is reserved for our text).
    g.drawImage(art, (w - art.width * k) / 2, 0, art.width * k, art.height * k);
    const bandH = h * 0.3;
    g.save();
    g.translate(w / 2, 14 + bandH / 2);
    g.rotate(-0.04);
    g.fillStyle = P5.red;
    g.beginPath();
    g.moveTo(-w * 0.47, -bandH / 2 + 6); g.lineTo(w * 0.47, -bandH / 2 - 2); g.lineTo(w * 0.45, bandH / 2 + 4); g.lineTo(-w * 0.46, bandH / 2 + 8);
    g.closePath();
    g.fill();
    g.fillStyle = P5.black;
    g.beginPath();
    g.moveTo(-w * 0.45, -bandH / 2); g.lineTo(w * 0.455, -bandH / 2 - 6); g.lineTo(w * 0.44, bandH / 2 - 2); g.lineTo(-w * 0.44, bandH / 2 + 2);
    g.closePath();
    g.fill();
    g.restore();
    ransom(g, rng, text, w * 0.08, 10, w * 0.84, bandH + 6);
    g.fillStyle = P5.red;
    g.beginPath(); g.moveTo(w, h); g.lineTo(w - 70, h); g.lineTo(w, h - 70); g.closePath(); g.fill();
    star(g, w - 22, h - 22, 13, P5.white, 0.2);
    g.lineWidth = 12;
    g.strokeStyle = P5.black;
    g.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** 2:1 meme billboard: red field + halftone, white jagged panel, ransom-note line, stars, tag. */
export function billboardFace(atlas: SignAtlas, rng: Rng, text: string, art: HTMLImageElement | null): AtlasRect | null {
  if (art) return artBillboard(atlas, rng, text, art);
  return cell(atlas, 512, 256, (g, w, h) => {
    const variant = rng.int(0, 2);
    g.fillStyle = variant === 1 ? P5.black : P5.red;
    g.fillRect(0, 0, w, h);
    halftone(g, 0, 0, w, h, variant === 1 ? '#3a0a0e' : '#9e0f13', 12);
    burst(g, rng, w * 0.04, h * 0.06, w * 0.92, h * 0.88, 14, P5.white);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.1);
    burst(g, rng, -w * 0.42, -h * 0.36, w * 0.84, h * 0.72, 12, variant === 2 ? P5.yellow : P5.black);
    g.restore();
    ransom(g, rng, text, w * 0.12, h * 0.2, w * 0.76, h * 0.6);
    star(g, w * 0.1, h * 0.18, 18, P5.yellow, rng.range(0, 1));
    star(g, w * 0.9, h * 0.82, 14, P5.white, rng.range(0, 1));
    g.fillStyle = P5.black;
    g.fillRect(w - 112, h - 30, 108, 26);
    label(g, '鹈鹕湾', w - 58, h - 17, 18, P5.white, FONT.cn, 400);
    g.lineWidth = 10;
    g.strokeStyle = P5.black;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** Rectangular road sign: white plate, black rim, red band with a star. */
export function roadSignFace(atlas: SignAtlas, text: string): AtlasRect | null {
  return cell(atlas, 256, 160, (g, w, h) => {
    g.fillStyle = P5.white;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.red;
    g.fillRect(0, 0, w, 38);
    star(g, 24, 19, 13, P5.white);
    label(g, 'PELICAN BAY', w / 2 + 10, 20, 22, P5.white, FONT.en, 400);
    const size = Math.min(58, (w - 24) / Math.max(3, Array.from(text).length) * 1.15);
    label(g, text, w / 2, 38 + (h - 38) / 2 + 2, size, P5.black, FONT.cn, 400);
    g.lineWidth = 10;
    g.strokeStyle = P5.black;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** Round prohibition-style sign (red ring): small caption + big word, e.g. 限速 / 随缘. */
export function roundSignFace(atlas: SignAtlas, small: string, big: string): AtlasRect | null {
  return cell(atlas, 160, 160, (g, w, h) => {
    g.fillStyle = P5.white;
    g.beginPath(); g.arc(w / 2, h / 2, 76, 0, Math.PI * 2); g.fill();
    g.lineWidth = 18; g.strokeStyle = P5.red;
    g.beginPath(); g.arc(w / 2, h / 2, 66, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4; g.strokeStyle = P5.black;
    g.beginPath(); g.arc(w / 2, h / 2, 77, 0, Math.PI * 2); g.stroke();
    label(g, small, w / 2, h / 2 - 26, 24, P5.black, FONT.heavy);
    label(g, big, w / 2, h / 2 + 12, 46, P5.black, FONT.cn, 400);
  });
}

/** Yellow warning triangle with a big glyph and a caption plate. */
export function warnFace(atlas: SignAtlas, glyph: string, caption: string): AtlasRect | null {
  return cell(atlas, 192, 224, (g, w) => {
    g.fillStyle = P5.black;
    g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 4, 168); g.lineTo(4, 168); g.closePath(); g.fill();
    g.fillStyle = P5.yellow;
    g.beginPath(); g.moveTo(w / 2, 22); g.lineTo(w - 20, 158); g.lineTo(20, 158); g.closePath(); g.fill();
    label(g, glyph, w / 2, 112, 70, P5.black, FONT.cn, 400);
    g.fillStyle = P5.black;
    g.fillRect(0, 176, w, 48);
    label(g, caption, w / 2, 201, Math.min(30, (w - 12) / Math.max(1, Array.from(caption).length) * 1.1), P5.white, FONT.heavy);
  });
}

/** Curve chevron board (arrows point in +u direction; mirrored per side by UVs). */
export function chevronFace(atlas: SignAtlas): AtlasRect | null {
  return cell(atlas, 128, 128, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.white;
    g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = P5.red;
    for (const ox of [16, 58]) {
      g.beginPath();
      g.moveTo(ox, 20); g.lineTo(ox + 26, 20); g.lineTo(ox + 52, h / 2); g.lineTo(ox + 26, h - 20); g.lineTo(ox, h - 20); g.lineTo(ox + 26, h / 2);
      g.closePath();
      g.fill();
    }
  });
}

/** Distance-to-finish marker: black plate, red slash, white number. */
export function distanceFace(atlas: SignAtlas, text: string): AtlasRect | null {
  return cell(atlas, 160, 128, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.red;
    g.beginPath(); g.moveTo(0, h * 0.72); g.lineTo(w, h * 0.42); g.lineTo(w, h * 0.6); g.lineTo(0, h * 0.9); g.closePath(); g.fill();
    label(g, text, w / 2, h * 0.44, 62, P5.white, FONT.en, 400);
    label(g, 'TO FINISH', w / 2, h * 0.86, 18, P5.white, FONT.en, 400);
  });
}

/** Long banner (8:1): ransom-note title on red/black diagonal split. */
export function bannerFace(atlas: SignAtlas, rng: Rng, text: string, tone: 'red' | 'black' | 'white' = 'red'): AtlasRect | null {
  return cell(atlas, 1024, 128, (g, w, h) => {
    g.fillStyle = tone === 'black' ? P5.black : tone === 'white' ? P5.white : P5.red;
    g.fillRect(0, 0, w, h);
    g.fillStyle = tone === 'black' ? P5.red : P5.black;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(150, 0); g.lineTo(100, h); g.lineTo(0, h); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w - 100, 0); g.lineTo(w - 150, h); g.lineTo(w, h); g.closePath(); g.fill();
    star(g, 52, h / 2, 30, P5.white, 0.3);
    star(g, w - 52, h / 2, 30, P5.white, -0.3);
    ransom(g, rng, text, 160, 8, w - 320, h - 16);
  });
}

/** Gantry header (6:1): big Anton word on black with red speed slashes. */
export function gantryFace(atlas: SignAtlas, word: string, sub: string): AtlasRect | null {
  return cell(atlas, 768, 128, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P5.red;
    for (let i = 0; i < 6; i++) {
      const x = 30 + i * 22;
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 52, 0); g.lineTo(x + 40, 0); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(w - x, 0); g.lineTo(w - x - 12, 0); g.lineTo(w - x - 52, h); g.lineTo(w - x - 40, h); g.closePath(); g.fill();
    }
    label(g, word, w / 2, h * 0.47, 92, P5.white, FONT.en, 400);
    label(g, sub, w / 2, h * 0.88, 18, P5.yellow, FONT.cn, 400);
  });
}
