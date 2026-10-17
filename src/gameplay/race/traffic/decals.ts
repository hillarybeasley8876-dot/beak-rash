// Canvas atlas for vehicle signage: 鹈鹕海鲜 fish truck, 冰淇淋 van, bus route sign and a bus-side meme ad.
import { CanvasTexture, DoubleSide, MeshToonMaterial, SRGBColorSpace } from 'three';
import { toonRamp } from '../../../render/toon';
import type { DecalRegion } from './models-cars';

const W = 1024, H = 512;
const RECT: Record<DecalRegion, [number, number, number, number]> = {
  fish: [0, 0, 720, 256],
  icecream: [0, 256, 520, 416],
  route: [520, 256, 896, 336],
  ad: [0, 416, 614, 512],
};
const CN = '"ZCOOL QingKe HuangYou", "Noto Sans SC", "PingFang SC", sans-serif';
const EN = '"Anton", "Bebas Neue", Impact, sans-serif';

/** UV rect (u0, v0, u1, v1) of a region (canvas y is flipped into texture v). */
export function decalUv(region: DecalRegion): [number, number, number, number] {
  const [x0, y0, x1, y1] = RECT[region];
  return [x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H];
}

function drawFish(g: CanvasRenderingContext2D): void {
  const [x0, y0, x1, y1] = RECT.fish;
  const w = x1 - x0, h = y1 - y0;
  g.fillStyle = '#f7f8fa'; g.fillRect(x0, y0, w, h);
  g.fillStyle = '#1f4fd1';
  g.beginPath();
  g.moveTo(x0, y1);
  for (let x = 0; x <= w; x += 8) g.lineTo(x0 + x, y1 - 34 - 10 * Math.sin(x / 38));
  g.lineTo(x1, y1); g.closePath(); g.fill();
  g.save();
  g.translate(x0 + 70, y0 + 34);
  g.transform(1, 0, -0.18, 1, 0, 0);
  g.fillStyle = '#e5191c'; g.fillRect(0, 0, 470, 118);
  g.fillStyle = '#ffffff'; g.font = `96px ${CN}`; g.textBaseline = 'middle';
  g.fillText('鹈鹕海鲜', 22, 62);
  g.restore();
  g.fillStyle = '#0b0b0f'; g.font = `34px ${CN}`; g.textBaseline = 'middle';
  g.fillText('今日现捞 · 一口一个', x0 + 80, y0 + 188);
  const fx = x0 + 625, fy = y0 + 100;
  g.fillStyle = '#5f8fc4';
  g.beginPath(); g.ellipse(fx, fy, 62, 36, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(fx + 50, fy); g.lineTo(fx + 92, fy - 34); g.lineTo(fx + 92, fy + 34); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(fx - 30, fy - 8, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b0b0f'; g.beginPath(); g.arc(fx - 33, fy - 8, 5, 0, Math.PI * 2); g.fill();
}

function drawIcecream(g: CanvasRenderingContext2D): void {
  const [x0, y0, x1, y1] = RECT.icecream;
  const w = x1 - x0, h = y1 - y0;
  for (let i = -4; i < 14; i++) {
    g.fillStyle = i % 2 === 0 ? '#ffd6ea' : '#ffffff';
    g.beginPath();
    g.moveTo(x0 + i * 48, y0); g.lineTo(x0 + i * 48 + 48, y0); g.lineTo(x0 + i * 48 + 48 - h * 0.4, y1); g.lineTo(x0 + i * 48 - h * 0.4, y1);
    g.closePath(); g.fill();
  }
  g.strokeStyle = '#7a3e1d'; g.lineWidth = 8; g.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8);
  g.fillStyle = '#7a3e1d'; g.textBaseline = 'middle';
  g.font = `84px ${CN}`; g.fillText('冰淇淋', x0 + 40, y0 + 70);
  g.font = `36px ${EN}`; g.fillText('ICE CREAM · 第二支半价', x0 + 44, y0 + 128);
}

function drawRoute(g: CanvasRenderingContext2D): void {
  const [x0, y0, x1, y1] = RECT.route;
  g.fillStyle = '#0b0b0f'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = '#ffb000'; g.font = `52px ${CN}`; g.textBaseline = 'middle';
  g.fillText('1路 鹈鹕湾', x0 + 40, (y0 + y1) / 2 + 2);
}

function drawAd(g: CanvasRenderingContext2D, text: string): void {
  const [x0, y0, x1, y1] = RECT.ad;
  const w = x1 - x0, h = y1 - y0;
  g.fillStyle = '#e5191c'; g.fillRect(x0, y0, w, h);
  g.fillStyle = '#0b0b0f';
  g.beginPath(); g.moveTo(x0 + w * 0.72, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.lineTo(x0 + w * 0.64, y1); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
  let size = 60;
  g.font = `${size}px ${CN}`;
  while (g.measureText(text).width > w * 0.66 && size > 24) { size -= 4; g.font = `${size}px ${CN}`; }
  g.fillText(text, x0 + 22, y0 + h / 2 + 2);
  g.font = `44px ${EN}`; g.fillStyle = '#ffe600'; g.fillText('BEAK!', x0 + w * 0.76, y0 + h / 2 + 2);
}

export interface DecalAtlas {
  material: MeshToonMaterial;
  dispose(): void;
}

export function createDecalAtlas(adText: string): DecalAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('[race] traffic: no 2D canvas context for decals');
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = (): void => {
    g.clearRect(0, 0, W, H);
    drawFish(g); drawIcecream(g); drawRoute(g); drawAd(g, adText);
    tex.needsUpdate = true;
  };
  paint();
  let alive = true;
  Promise.all([document.fonts.load(`64px ${CN}`, '鹈鹕海鲜冰淇淋'), document.fonts.load(`40px ${EN}`, 'ICE')])
    .then(() => { if (alive) paint(); })
    .catch((err: unknown) => console.warn('[race] decal fonts unavailable, using fallback', err));
  const material = new MeshToonMaterial({ map: tex, gradientMap: toonRamp(), side: DoubleSide });
  return {
    material,
    dispose() {
      alive = false;
      tex.dispose();
      material.dispose();
    },
  };
}
