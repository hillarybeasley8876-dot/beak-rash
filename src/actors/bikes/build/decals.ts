// Canvas drawing for every decal in the atlas (origin = the decal's top-left corner).
// Original artwork only: no real brands, no real QR payload.
import type { DecalId } from './atlas';

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, w: number, h: number) => void;

const CN = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const EN = 'Impact,"Arial Black","Helvetica Neue",sans-serif';

/** Deterministic cosmetic noise (decals look the same every run). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function label(ctx: Ctx, text: string, x: number, y: number, font: string, fill: string, stroke?: string, sw = 4): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function star(ctx: Ctx, cx: number, cy: number, r: number, inner = 0.45): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function fishIcon(ctx: Ctx, cx: number, cy: number, s: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.15, cy, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
  ctx.moveTo(cx + s * 0.3, cy);
  ctx.lineTo(cx + s * 0.75, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.75, cy + s * 0.3);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeStyle = '#111';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - s * 0.45, cy - s * 0.05, s * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
}

const qr: Draw = (ctx, w) => {
  rrect(ctx, 2, 2, w - 4, w - 4, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const n = 21, quiet = 2, m = (w - 4) / (n + quiet * 2), o = 2 + quiet * m;
  const rnd = lcg(0x51ed);
  const finder = (x: number, y: number): boolean => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  ctx.fillStyle = '#121216';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      const on = x === 6 || y === 6 ? (x + y) % 2 === 0 : rnd() < 0.5;
      if (on) ctx.fillRect(o + x * m, o + y * m, m + 0.4, m + 0.4);
    }
  }
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
    ctx.fillStyle = '#121216';
    ctx.fillRect(o + fx * m, o + fy * m, 7 * m, 7 * m);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(o + (fx + 1) * m, o + (fy + 1) * m, 5 * m, 5 * m);
    ctx.fillStyle = '#121216';
    ctx.fillRect(o + (fx + 2) * m, o + (fy + 2) * m, 3 * m, 3 * m);
  }
  const c = w / 2;
  rrect(ctx, c - 3.6 * m, c - 3.6 * m, 7.2 * m, 7.2 * m, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  rrect(ctx, c - 3 * m, c - 3 * m, 6 * m, 6 * m, 5);
  ctx.fillStyle = '#ffcc00';
  ctx.fill();
  fishIcon(ctx, c, c, 4.6 * m, '#ffffff');
};

const badge: Draw = (ctx, w, h) => {
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(w - 16, 12);
  ctx.lineTo(w - 16, 60);
  ctx.quadraticCurveTo(w - 16, h - 22, cx, h - 8);
  ctx.quadraticCurveTo(16, h - 22, 16, 60);
  ctx.closePath();
  ctx.fillStyle = '#a24a3e';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#c9a862';
  ctx.stroke();
  star(ctx, cx, 46, 20);
  ctx.fillStyle = '#d8bc72';
  ctx.fill();
  label(ctx, '鹈鹕', cx, 86, `bold 24px ${CN}`, '#efe3c6');
  const rnd = lcg(28);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(236,226,204,${0.18 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(16 + rnd() * (w - 32), 14 + rnd() * (h - 30), 1 + rnd() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
};

const scan: Draw = (ctx, w, h) => {
  rrect(ctx, 3, 3, w - 6, h - 6, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffcc00';
  ctx.stroke();
  ctx.strokeStyle = '#121216';
  ctx.lineWidth = 4;
  const s = h * 0.5, x0 = 18, y0 = (h - s) / 2, k = s * 0.32;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x0 + s, y0, -1, 1], [x0, y0 + s, 1, -1], [x0 + s, y0 + s, -1, -1]] as const) {
    ctx.moveTo(cx + dx * k, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * k);
  }
  ctx.moveTo(x0 - 3, h / 2);
  ctx.lineTo(x0 + s + 3, h / 2);
  ctx.stroke();
  label(ctx, '扫码骑行', w * 0.58, h * 0.44, `900 30px ${CN}`, '#121216');
  label(ctx, 'SCAN · RIDE · 押金？', w * 0.58, h * 0.8, `bold 11px ${CN}`, '#7a6400');
};

const plate: Draw = (ctx, w, h) => {
  rrect(ctx, 3, 3, w - 6, h - 6, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#e5191c';
  ctx.fillRect(0, 0, w, 22);
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#121216';
  rrect(ctx, 3, 3, w - 6, h - 6, 10);
  ctx.stroke();
  label(ctx, 'BEAK RASH', w / 2, 13, `bold 12px ${EN}`, '#ffffff');
  ctx.save();
  ctx.translate(w / 2, h * 0.62);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  label(ctx, '01', 0, 0, `64px ${EN}`, '#121216');
  ctx.restore();
};

const guard: Draw = (ctx, w, h) => {
  ctx.strokeStyle = '#d4a640';
  ctx.lineWidth = 3;
  for (const y of [6, h - 6]) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); }
  label(ctx, '28 · 载重', w / 2, h / 2 + 1, `900 34px ${CN}`, '#d9ae4c');
};

const nobrakes: Draw = (ctx, w, h) => label(ctx, 'NO BRAKES', w / 2, h / 2 + 2, `40px ${EN}`, '#ffffff', '#121216', 7);

const offroad: Draw = (ctx, w, h) => {
  ctx.save();
  ctx.translate(w / 2, h / 2 + 1);
  ctx.transform(1, 0, -0.25, 1, 0, 0);
  label(ctx, '越野王 OFF-ROAD', 0, 0, `900 30px ${CN}`, '#ffffff', '#121216', 6);
  ctx.restore();
};

const fishsign: Draw = (ctx, w) => {
  const c = w / 2, r = w / 2 - 6;
  ctx.beginPath();
  ctx.moveTo(c, c - r); ctx.lineTo(c + r, c); ctx.lineTo(c, c + r); ctx.lineTo(c - r, c);
  ctx.closePath();
  ctx.fillStyle = '#ffd400';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#121216';
  ctx.stroke();
  fishIcon(ctx, c, c - 18, 34, '#b8c4cc');
  label(ctx, '车上有咸鱼', c, c + 14, `900 17px ${CN}`, '#121216');
  label(ctx, 'FISH ON BOARD', c, c + 33, `bold 9px ${EN}`, '#121216');
};

const wind: Draw = (ctx, w, h) => {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [y, l] of [[18, 54], [32, 70], [46, 44]] as const) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(8 + l, y); ctx.stroke(); }
  ctx.save();
  ctx.translate(w * 0.62, h / 2 + 2);
  ctx.transform(1, 0, -0.3, 1, 0, 0);
  label(ctx, '风之翼', 0, 0, `900 42px ${CN}`, '#ffffff', '#121216', 6);
  ctx.restore();
};

const pastelStar: Draw = (ctx, w, h) => {
  star(ctx, w / 2, h / 2 + 3, w * 0.44, 0.5);
  ctx.fillStyle = '#ffe680';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
};

const heart: Draw = (ctx, w, h) => {
  const s = w / 2;
  ctx.beginPath();
  ctx.moveTo(s, h * 0.86);
  ctx.bezierCurveTo(-s * 0.1, h * 0.5, s * 0.25, h * 0.08, s, h * 0.32);
  ctx.bezierCurveTo(s * 1.75, h * 0.08, s * 2.1, h * 0.5, s, h * 0.86);
  ctx.closePath();
  ctx.fillStyle = '#ff9ec7';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
};

const tandem: Draw = (ctx, w, h) => label(ctx, '双人协力', w / 2, h / 2 + 1, `900 28px ${CN}`, '#f3e7c9', '#121216', 5);

/** Plastic basket mesh: dark grid with see-through holes (alpha-tested). */
const grid: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#2a2c31';
  const bar = 5, cell = 16;
  for (let x = 0; x <= w; x += cell) ctx.fillRect(x, 0, bar, h);
  for (let y = 0; y <= h; y += cell) ctx.fillRect(0, y, w, bar);
  ctx.fillRect(0, 0, w, 8);
  ctx.fillRect(0, h - 8, w, 8);
};

/** Grumpy salted-fish face (mouth on the right = forward): salt crust, gill, half-lidded eye, angry brow. */
const fishface: Draw = (ctx, w, h) => {
  const rnd = lcg(0xf15);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(250,248,236,${0.35 + rnd() * 0.4})`;
    ctx.beginPath();
    ctx.arc(6 + rnd() * w * 0.55, 8 + rnd() * (h - 16), 1.5 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3c4650';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(w * 0.92, h * 0.5, h * 0.42, Math.PI * 0.72, Math.PI * 1.28);
  ctx.stroke();
  const ex = w * 0.74, ey = h * 0.5, r = 17;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#121216';
  ctx.beginPath(); ctx.arc(ex + 5, ey + 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ex + 7, ey + 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7b8a96';
  ctx.beginPath(); ctx.arc(ex, ey, r + 0.5, Math.PI * 1.08, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#121216';
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(ex - 19, ey - 23); ctx.lineTo(ex + 17, ey - 11); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w - 2, h * 0.7); ctx.quadraticCurveTo(w - 9, h * 0.6, w - 17, h * 0.8); ctx.stroke();
};

export const DECAL_DRAW: Record<DecalId, Draw> = {
  qr, badge, scan, plate, guard, nobrakes, offroad, fishsign, wind, star: pastelStar, heart, tandem, grid, fishface,
};
