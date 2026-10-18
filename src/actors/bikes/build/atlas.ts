// Shared decal atlas: one 1024² canvas texture for every bike (number plate, QR code, stickers, badges,
// alpha-tested spoke / speed-blur wheel cards, chain links). The 256² square at the top-left is opaque
// white: untextured geometry samples WHITE_UV, so one material (vertex colours × atlas) covers whole
// bikes and decals cost no extra draw calls.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { DECAL_DRAW } from './decals';

export interface UvRect { u0: number; v0: number; u1: number; v1: number }
export type DecalId = keyof typeof LAYOUT;

const SIZE = 1024;
export const WHITE_UV: readonly [number, number] = [128 / SIZE, 1 - 128 / SIZE];

/** Canvas pixel rects [x, y, w, h] (y down). */
const LAYOUT = {
  qr: [256, 0, 128, 128],
  badge: [384, 0, 128, 128],
  scan: [256, 128, 256, 64],
  plate: [256, 192, 128, 96],
  guard: [0, 256, 256, 64],
  nobrakes: [0, 320, 256, 48],
  offroad: [0, 368, 256, 48],
  fishsign: [256, 288, 128, 128],
  wind: [256, 416, 256, 64],
  star: [0, 416, 96, 96],
  heart: [96, 416, 96, 96],
  tandem: [384, 288, 128, 64],
  grid: [384, 192, 128, 96],
  spokes: [512, 0, 256, 256],
  blur: [768, 0, 256, 256],
  chain: [512, 256, 256, 32],
  taillight: [768, 256, 128, 64],
  spider: [896, 256, 128, 128],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export function decalUv(id: DecalId): UvRect {
  const [x, y, w, h] = LAYOUT[id];
  // Inset half a texel so bilinear filtering never bleeds a neighbour in.
  return { u0: (x + 0.5) / SIZE, u1: (x + w - 0.5) / SIZE, v0: 1 - (y + h - 0.5) / SIZE, v1: 1 - (y + 0.5) / SIZE };
}

let tex: CanvasTexture | null = null;

export function decalAtlas(): CanvasTexture {
  if (tex) return tex;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[bikes] 2D canvas unavailable for the decal atlas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (const [id, rect] of Object.entries(LAYOUT) as Array<[DecalId, readonly [number, number, number, number]]>) {
    const [x, y, w, h] = rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    DECAL_DRAW[id](ctx, w, h);
    ctx.restore();
  }
  tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.name = 'bikes:decals';
  return tex;
}
