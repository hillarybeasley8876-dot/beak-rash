// World text previews mirroring world/scenery/signs: billboard faces (plain 512×256 or poster 512×288,
// ransom glyphs) and road signs (256×160). Reports each line's glyph size so unreadable-at-speed lines stand out.
import { Rng, hashString } from '../src/core/rng';
import { assetUrl } from '../src/data/assets';
import { check, h } from './content.kit';

const STYLES: Array<[string, string]> = [['#fff', '#0b0b0f'], ['#0b0b0f', '#fff'], ['#fff', '#e5191c']];
const CN = '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif';
const HEAVY = '"Noto Sans SC", sans-serif';
const EN = '"Anton", sans-serif';

/** Same line split as the track's ransom(): two rows above 9 glyphs, preferring a space near the middle. */
function rows(text: string): string[][] {
  const chars = Array.from(text.replace(/\s+/g, ' '));
  if (chars.length <= 9) return [chars];
  const mid = Math.ceil(chars.length / 2);
  let best = mid;
  for (let d = 0; d < 4; d++) {
    if (chars[mid + d] === ' ') { best = mid + d; break; }
    if (chars[mid - d] === ' ') { best = mid - d; break; }
  }
  return [chars.slice(0, best), chars.slice(best).filter((c, i) => !(i === 0 && c === ' '))];
}

function ransom(g: CanvasRenderingContext2D, rng: Rng, text: string, x: number, y: number, w: number, hgt: number): number {
  const lines = rows(text);
  const size = Math.min(hgt / (lines.length * 1.25), (w / Math.max(...lines.map((l) => l.length))) * 0.92);
  lines.forEach((line, li) => {
    let cx = x + (w - line.length * size * 0.98) / 2 + size / 2;
    const cy = y + hgt / 2 + (li - (lines.length - 1) / 2) * size * 1.18;
    for (const ch of line) {
      if (ch === ' ') { cx += size * 0.6; continue; }
      const [fg, bg] = STYLES[rng.int(0, STYLES.length - 1)] ?? ['#fff', '#000'];
      const s = size * rng.range(0.82, 1.08);
      g.save();
      g.translate(cx, cy);
      g.rotate(rng.range(-0.14, 0.14));
      g.fillStyle = bg;
      g.fillRect(-s * 0.5, -s * 0.52, s, s * 1.04);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const ascii = /[\x20-\x7e]/.test(ch);
      g.font = `${ascii ? 400 : rng.chance(0.5) ? 400 : 900} ${Math.round(s * (ascii ? 0.9 : 0.78))}px ${ascii ? EN : rng.chance(0.6) ? CN : HEAVY}`;
      g.fillText(ch, 0, s * 0.04);
      g.restore();
      cx += size * 0.98;
    }
  });
  return size;
}

function canvas(w: number, hgt: number, scale: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = h('canvas');
  c.width = w;
  c.height = hgt;
  c.style.width = `${w * scale}px`;
  c.style.height = `${hgt * scale}px`;
  const g = c.getContext('2d');
  if (!g) throw new Error('[content] no 2d context');
  return [c, g];
}

const MIN_GLYPH = 34;   // px on the 512-px face ≈ 0.3 m tall letters on a 4–4.5 m board

/** Poster art for the billboard previews (assets manifest); a missing file falls back to a plain fill. */
export async function loadPosters(rels: string[]): Promise<Array<HTMLImageElement | null>> {
  return Promise.all(rels.map((rel) => new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`[content] poster ${rel} did not load; previewing a plain fill`);
      resolve(null);
    };
    img.src = assetUrl(rel);
  })));
}

function face(c: HTMLCanvasElement, where: string, text: string, size: number, tag: string): HTMLElement {
  const box = h('div', { class: 'cg-face' }, c, h('small', { text: `${tag}glyph ${Math.round(size)} px` }));
  check(box, where, text, () => (size < MIN_GLYPH ? `glyphs ${Math.round(size)} px (min ${MIN_GLYPH})` : null));
  return box;
}

/** Plain billboard like world billboardFace() without art: 512×256, white panel, ransom line. */
export function billboard(text: string, where: string): HTMLElement {
  const [c, g] = canvas(512, 256, 0.82);
  const rng = new Rng(hashString(text));
  g.fillStyle = rng.chance(0.5) ? '#0b0b0f' : '#e5191c';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#fff';
  g.fillRect(512 * 0.04, 256 * 0.06, 512 * 0.92, 256 * 0.88);
  const size = ransom(g, rng, text, 512 * 0.12, 256 * 0.2, 512 * 0.76, 256 * 0.6);
  g.lineWidth = 10; g.strokeStyle = '#0b0b0f'; g.strokeRect(5, 5, 502, 246);
  return face(c, where, text, size, '');
}

/** Poster billboard like world artBillboard(): 512×288 art, the line on a tilted red/black band on top. */
export function posterBillboard(text: string, where: string, art: HTMLImageElement | null): HTMLElement {
  const w = 512, ht = 288, band = ht * 0.3;
  const [c, g] = canvas(w, ht, 0.82);
  const rng = new Rng(hashString(text));
  if (art) {
    const k = Math.max(w / art.width, ht / art.height);
    g.drawImage(art, (w - art.width * k) / 2, 0, art.width * k, art.height * k);
  } else {
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, ht);
  }
  g.save();
  g.translate(w / 2, 14 + band / 2);
  g.rotate(-0.04);
  g.fillStyle = '#e5191c';
  g.beginPath(); g.moveTo(-w * 0.47, -band / 2 + 6); g.lineTo(w * 0.47, -band / 2 - 2); g.lineTo(w * 0.45, band / 2 + 4); g.lineTo(-w * 0.46, band / 2 + 8); g.closePath(); g.fill();
  g.fillStyle = '#0b0b0f';
  g.beginPath(); g.moveTo(-w * 0.45, -band / 2); g.lineTo(w * 0.455, -band / 2 - 6); g.lineTo(w * 0.44, band / 2 - 2); g.lineTo(-w * 0.44, band / 2 + 2); g.closePath(); g.fill();
  g.restore();
  const size = ransom(g, rng, text, w * 0.08, 10, w * 0.84, band + 6);
  g.lineWidth = 12; g.strokeStyle = '#0b0b0f'; g.strokeRect(6, 6, w - 12, ht - 12);
  return face(c, where, text, size, 'poster · ');
}

/** Road sign face like roadSignFace(): red header bar, one line of text. */
export function roadSign(text: string, where: string): HTMLElement {
  const [c, g] = canvas(256, 160, 1);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#e5191c'; g.fillRect(0, 0, 256, 38);
  g.fillStyle = '#fff'; g.font = `400 22px ${EN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PELICAN BAY', 138, 20);
  const size = Math.min(58, ((256 - 24) / Math.max(3, Array.from(text).length)) * 1.15);
  g.fillStyle = '#0b0b0f'; g.font = `400 ${size}px ${CN}`;
  g.fillText(text, 128, 38 + (160 - 38) / 2 + 2);
  g.lineWidth = 10; g.strokeStyle = '#0b0b0f'; g.strokeRect(5, 5, 246, 150);
  const box = h('div', { class: 'cg-face' }, c, h('small', { text: `${Math.round(size)} px` }));
  check(box, where, text, () => (size < 26 ? `text ${Math.round(size)} px (min 26)` : null));
  return box;
}
