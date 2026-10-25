// Particle sprite atlas: 6×6 cells of 128 px drawn once at runtime (no image files, no network).
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, type Texture } from 'three';
import * as S from './atlas-shapes';
import * as S2 from './atlas-shapes2';
import * as S3 from './atlas-shapes3';
import * as S4 from './atlas-shapes4';

/** Atlas frame indices. glow / streak / spark are soft (for the additive pool). */
export const FRAME = {
  spark4: 0, star5: 1, puff: 2, feather: 3, fur: 4, drop: 5, bolt: 6, stick: 7,
  confetti: 8, scale: 9, coin: 10, ring: 11, glow: 12, streak: 13, spark: 14, smear: 15,
  burst: 16, rays: 17, heart: 18, note: 19, zap: 20, swirl: 21, keycap: 22, leaf: 23, fry: 24,
  shock: 25, hex: 26, plus: 27, glint: 28, dash: 29, shard: 30,
  // r4 (fx unit): the police cap, the spilled fish, the market fruit and the rubber duck.
  cap: 31, fish: 32, melon: 33, fruit: 34, duck: 35,
} as const;
export type FrameName = keyof typeof FRAME;

export const ATLAS_COLS = 6;
const CELL = 128;

const DRAW: Record<FrameName, (c: S.Ctx) => void> = {
  spark4: S.spark4, star5: S.star5, puff: S.puff, feather: S.feather, fur: S.fur, drop: S.drop,
  bolt: S.bolt, stick: S.stick, confetti: S.confetti, scale: S.scale, coin: S.coin, ring: S.ring,
  glow: S.glow, streak: S.streak, spark: S.sparkAdd, smear: S.smear,
  burst: S2.burst, rays: S2.rays, heart: S2.heart, note: S2.note, zap: S2.zap, swirl: S2.swirl,
  keycap: S2.keycap, leaf: S2.leaf, fry: S2.fry,
  shock: S3.shock, hex: S3.hex, plus: S3.plus, glint: S3.glint, dash: S3.dash, shard: S3.shard,
  cap: S4.cap, fish: S4.fish, melon: S4.melon, fruit: S4.fruit, duck: S4.duck,
};

let atlas: Texture | null = null;

export function particleAtlas(): Texture {
  if (atlas) return atlas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CELL * ATLAS_COLS;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('[fx] 2D canvas unavailable for the particle atlas');
  for (const name of Object.keys(FRAME) as FrameName[]) {
    const i = FRAME[name];
    c.save();
    c.translate((i % ATLAS_COLS) * CELL + CELL / 2, Math.floor(i / ATLAS_COLS) * CELL + CELL / 2);
    c.beginPath();
    c.rect(-CELL / 2, -CELL / 2, CELL, CELL);
    c.clip();
    DRAW[name](c);
    c.restore();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 4;
  tex.name = 'fx.particleAtlas';
  atlas = tex;
  return tex;
}

/** For the sandbox gallery: the raw atlas canvas. */
export function atlasCanvas(): HTMLCanvasElement | null {
  const img = particleAtlas().image as unknown;
  return img instanceof HTMLCanvasElement ? img : null;
}
