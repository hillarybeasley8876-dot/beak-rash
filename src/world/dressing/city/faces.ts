// City landmark faces (canvas → atlas): subway sign, convenience-store lightbox, night-market gate,
// and the P5-style "calling card" mural (original design: red card, ransom-note lettering, a masked
// pelican silhouette, stars and halftone).
import type { Rng } from '../../../core/rng';
import { FONT } from '../../fonts';
import type { AtlasRect, SignAtlas } from '../../scenery/signs/atlas';
import { artReady } from '../../scenery/signs/art';
import { cell } from '../../scenery/signs/faces';
import { burst, halftone, label, P5, ransom, star } from '../../scenery/signs/p5draw';
import { fit, frameTube, tube } from './neon-faces';

type G = CanvasRenderingContext2D;

/** Subway pylon sign (3:2): blue lightbox, white ring with a pelican glyph, 地铁 / METRO. */
export function metroFace(atlas: SignAtlas): AtlasRect | null {
  return cell(atlas, 192, 128, (g, w, h) => {
    g.fillStyle = '#1f5fd0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = P5.white;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(w * 0.27, h * 0.5, h * 0.3, 0, Math.PI * 2);
    g.stroke();
    label(g, '鹕', w * 0.27, h * 0.52, h * 0.34, P5.white, FONT.cn, 400);
    label(g, '地铁', w * 0.68, h * 0.4, h * 0.34, P5.white);
    label(g, 'METRO', w * 0.68, h * 0.74, h * 0.2, P5.white, FONT.en, 400);
  });
}

/** Convenience-store fascia (5:1): white lightbox, 便利店 in green, red 24H tag. */
export function storeFace(atlas: SignAtlas): AtlasRect | null {
  return cell(atlas, 400, 80, (g, w, h) => {
    g.fillStyle = '#f7f7f4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff8a1f';
    g.fillRect(0, 0, w, 8);
    g.fillStyle = '#1fae5c';
    g.fillRect(0, h - 8, w, 8);
    label(g, '便利店', w * 0.4, h * 0.52, fit(g, '便利店', FONT.heavy, h * 0.62, w * 0.55, 900), '#138a48');
    g.fillStyle = P5.red;
    g.fillRect(w * 0.73, h * 0.2, w * 0.22, h * 0.6);
    label(g, '24H', w * 0.84, h * 0.52, h * 0.42, P5.white, FONT.en, 400);
  });
}

/** Night-market gate header (5:1): neon tube 鹈鹕夜市 + NIGHT MARKET on a dark board. */
export function gateFace(atlas: SignAtlas, title: string, sub: string): AtlasRect | null {
  return cell(atlas, 640, 128, (g, w, h) => {
    g.fillStyle = '#0d0a16';
    g.fillRect(0, 0, w, h);
    frameTube(g, 8, 8, w - 16, h - 16, '#ffe600', 4);
    tube(g, title, w / 2, h * 0.38, fit(g, title, FONT.cn, h * 0.46, w - 80), '#ff2d95', FONT.cn);
    tube(g, sub, w / 2, h * 0.8, fit(g, sub, FONT.en, h * 0.15, w - 160), '#22e8ff', FONT.en);
  });
}

/** Masked pelican head in profile (black silhouette, white eye in a red domino mask). */
function pelicanMask(g: G, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = P5.black;
  g.beginPath();
  g.arc(0, 0, s * 0.42, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(s * 0.25, -s * 0.12); g.lineTo(s * 1.35, s * 0.05); g.lineTo(s * 1.3, s * 0.14); g.lineTo(s * 0.3, s * 0.36);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.3, -s * 0.3); g.lineTo(-s * 0.05, -s * 0.85); g.lineTo(s * 0.06, -s * 0.34);
  g.closePath();
  g.fill();
  g.fillStyle = P5.red;
  g.beginPath();
  g.moveTo(-s * 0.38, -s * 0.2); g.lineTo(s * 0.42, -s * 0.24); g.lineTo(s * 0.36, s * 0.0); g.lineTo(-s * 0.34, s * 0.04);
  g.closePath();
  g.fill();
  g.fillStyle = P5.white;
  g.beginPath();
  g.ellipse(s * 0.12, -s * 0.11, s * 0.09, s * 0.06, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** The calling-card mural (2:1). */
export function muralFace(atlas: SignAtlas, rng: Rng, title: string, body: string, sign: string): AtlasRect | null {
  return cell(atlas, 1024, 512, (g, w, h) => {
    g.fillStyle = P5.black;
    g.fillRect(0, 0, w, h);
    burst(g, rng, -w * 0.1, -h * 0.4, w * 1.2, h * 1.8, 22, P5.red);
    halftone(g, 0, 0, w, h, 'rgba(11,11,15,0.55)', 16);
    g.save();
    g.translate(w * 0.5, h * 0.53);
    g.rotate(-0.06);
    g.fillStyle = P5.white;
    g.fillRect(-w * 0.34, -h * 0.36, w * 0.68, h * 0.72);
    g.lineWidth = 10;
    g.strokeStyle = P5.black;
    g.strokeRect(-w * 0.34 + 14, -h * 0.36 + 14, w * 0.68 - 28, h * 0.72 - 28);
    g.restore();
    ransom(g, rng, title, w * 0.06, h * 0.03, w * 0.42, h * 0.27);
    ransom(g, rng, body, w * 0.2, h * 0.32, w * 0.6, h * 0.38);
    g.save();
    g.translate(w * 0.62, h * 0.82);
    g.rotate(-0.06);
    label(g, sign, 0, 0, h * 0.075, P5.black, FONT.cn, 400);
    g.restore();
    pelicanMask(g, w * 0.83, h * 0.24, h * 0.17);
    star(g, w * 0.07, h * 0.86, h * 0.09, P5.yellow, 0.3);
    star(g, w * 0.93, h * 0.78, h * 0.07, P5.white, -0.2);
    star(g, w * 0.2, h * 0.86, h * 0.045, P5.white, 0.1);
  });
}

/** Giant finish screen (16:9): poster art (or a red burst while it decodes or when missing; the atlas
 *  draws the cell again when late art lands), chequered band, slammed FINISH! word. */
export function finishScreenFace(atlas: SignAtlas, rng: Rng, art: HTMLImageElement | null, word: string, sub: string): AtlasRect | null {
  return cell(atlas, 768, 432, (g, w, h) => {
    if (art && artReady(art)) {
      const k = Math.max(w / art.width, h / art.height);
      g.drawImage(art, (w - art.width * k) / 2, (h - art.height * k) / 2, art.width * k, art.height * k);
    } else {
      g.fillStyle = P5.black;
      g.fillRect(0, 0, w, h);
      burst(g, rng, -w * 0.1, -h * 0.3, w * 1.2, h * 1.6, 18, P5.red);
    }
    halftone(g, 0, 0, w, h, 'rgba(11,11,15,0.45)', 14);
    const band = h * 0.12;
    for (let x = 0; x < w; x += band / 2) {
      for (let r = 0; r < 2; r++) {
        g.fillStyle = (Math.round(x / (band / 2)) + r) % 2 ? P5.white : P5.black;
        g.fillRect(x, h - band + (r * band) / 2, band / 2, band / 2);
      }
    }
    g.save();
    g.translate(w / 2, h * 0.46);
    g.rotate(-0.08);
    g.fillStyle = P5.black;
    g.fillRect(-w * 0.44, -h * 0.2, w * 0.88, h * 0.4);
    g.fillStyle = P5.red;
    g.fillRect(-w * 0.42, -h * 0.17, w * 0.84, h * 0.34);
    label(g, word, 0, h * 0.01, h * 0.3, P5.white, FONT.en, 400);
    g.restore();
    label(g, sub, w / 2, h * 0.76, h * 0.07, P5.yellow, FONT.cn, 400);
    star(g, w * 0.1, h * 0.2, h * 0.08, P5.yellow, 0.2);
    star(g, w * 0.9, h * 0.22, h * 0.06, P5.white, -0.3);
  }, art ? [art] : undefined);
}
