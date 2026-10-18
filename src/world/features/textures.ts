// Canvas textures for road decals: oil slick, puddle, boost-pad chevrons, chequered line, painted
// words, grid slots. Drawn once per track; P5 palette (red / black / white, yellow for boost).
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';
import { FONT } from '../fonts';

function make(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, renderer: WebGLRenderer): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/** Irregular blob path made of overlapping circles around the centre. */
function blob(g: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, r: number, lumps: number): void {
  g.beginPath();
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const d = r * rng.range(0.25, 0.55), rr = r * rng.range(0.35, 0.55);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 1.4;
    g.moveTo(x + rr, y);
    g.arc(x, y, rr, 0, Math.PI * 2);
  }
  g.moveTo(cx + r * 0.5, cy);
  g.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
}

export function oilTexture(renderer: WebGLRenderer): CanvasTexture {
  return make(256, 256, (g) => {
    const rng = new Rng(0x0111);
    g.fillStyle = '#17121f';
    blob(g, rng, 128, 128, 118, 9);
    g.fill();
    // Rainbow sheen swirls + glossy highlights.
    const cols = ['#7b3fe0', '#2bb3e6', '#e6d22b', '#e0408f'];
    g.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      g.strokeStyle = cols[i % cols.length] ?? '#ffffff';
      g.globalAlpha = 0.55;
      g.beginPath();
      const cx = 128 + rng.range(-40, 40), cy = 128 + rng.range(-50, 50);
      g.ellipse(cx, cy, rng.range(16, 46), rng.range(10, 30), rng.range(0, 3), 0, Math.PI * rng.range(0.8, 1.6));
      g.stroke();
    }
    g.globalAlpha = 0.9;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(100, 92, 22, 7, -0.5, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }, renderer);
}

export function puddleTexture(renderer: WebGLRenderer): CanvasTexture {
  return make(256, 256, (g) => {
    const rng = new Rng(0x9dd1e);
    g.fillStyle = '#2f6f9a';
    blob(g, rng, 128, 128, 120, 8);
    g.fill();
    g.fillStyle = '#7cc6ea';
    blob(g, new Rng(0x9dd1e), 128, 128, 104, 8);
    g.fill();
    g.strokeStyle = '#e9f8ff';
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (const [x, y, l] of [[86, 96, 46], [150, 150, 30], [118, 176, 22]] as Array<[number, number, number]>) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + l, y - l * 0.35);
      g.stroke();
    }
  }, renderer);
}

/** Two chevrons per tile; tiles vertically (scroll along s for motion). */
export function boostTexture(renderer: WebGLRenderer): CanvasTexture {
  const t = make(128, 128, (g) => {
    g.fillStyle = '#0b0b0f';
    g.fillRect(0, 0, 128, 128);
    for (const [y, col] of [[10, '#ffe600'], [74, '#ff1e3c']] as Array<[number, string]>) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(14, y + 44); g.lineTo(64, y); g.lineTo(114, y + 44); g.lineTo(114, y + 60); g.lineTo(64, y + 18); g.lineTo(14, y + 60);
      g.closePath();
      g.fill();
    }
  }, renderer);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Chequered band: `cols` squares across, 2 rows. */
export function checkerTexture(renderer: WebGLRenderer, cols: number): CanvasTexture {
  return make(cols * 16, 32, (g) => {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 === 0 ? '#101014' : '#f5f5f0';
        g.fillRect(i * 16, j * 16, 16, 16);
      }
    }
  }, renderer);
}

/** Big painted word on the asphalt (read from the rider's view: text runs bottom→top). If its font is
 *  not loaded yet the word is painted with a fallback and repainted once the font arrives. */
export function wordTexture(renderer: WebGLRenderer, text: string, color = '#f5f5f0', font: string = FONT.en): CanvasTexture {
  const spec = `400 150px ${font}`;
  const paint = (g: CanvasRenderingContext2D): void => {
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = spec;
    g.save();
    g.translate(256, 128);
    g.scale(1, 1.6);
    g.fillText(text, 0, 0);
    g.restore();
  };
  const t = make(512, 256, paint, renderer);
  if (typeof document !== 'undefined' && document.fonts && !document.fonts.check(spec, text)) {
    document.fonts.load(spec, text).then(() => {
      const g = (t.image as HTMLCanvasElement).getContext('2d');
      if (!g) return;
      paint(g);
      t.needsUpdate = true;
    }, (err: unknown) => console.warn('[track] road word font failed', text, err));
  }
  return t;
}

/** One grid row: three bracket slots across the road (u = x across, v = along). */
export function gridTexture(renderer: WebGLRenderer, slotsX: number[], halfWidth: number): CanvasTexture {
  return make(512, 64, (g) => {
    const px = (m: number): number => ((m + halfWidth) / (halfWidth * 2)) * 512;
    g.strokeStyle = '#f5f5f0';
    g.lineWidth = 7;
    for (const x of slotsX) {
      const l = px(x - 1.1), r = px(x + 1.1);
      g.beginPath();
      g.moveTo(l, 60); g.lineTo(l, 6); g.lineTo(r, 6); g.lineTo(r, 60);
      g.stroke();
    }
  }, renderer);
}
