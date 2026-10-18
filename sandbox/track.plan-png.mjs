// Top-down plan PNG for sandbox/track.plan.mjs (no canvas in node: a tiny rasterizer + PNG encoder).
// Road coloured by curvature (grey R > 200, orange ≤ 200, red ≤ 70, magenta ≤ 55); blue ticks = left
// (sea) side, green = right; black dots every 100 m, labels every 500 m; brown circles = terrain domes.
import fs from 'node:fs';
import zlib from 'node:zlib';

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

export function writePlanPng(file, L, bumps, i0, iEnd, W = 1500) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = i0; i <= iEnd; i++) { x0 = Math.min(x0, L.px[i]); x1 = Math.max(x1, L.px[i]); z0 = Math.min(z0, L.pz[i]); z1 = Math.max(z1, L.pz[i]); }
  const pad = 180, sc = (W - 2 * 40) / Math.max(x1 - x0 + 2 * pad, (z1 - z0 + 2 * pad) * 0.75);
  const H = Math.round((z1 - z0 + 2 * pad) * sc + 80);
  const img = new Uint8Array(W * H * 3).fill(246);
  const X = (x) => 40 + (x - x0 + pad) * sc, Y = (z) => 40 + (z - z0 + pad) * sc;
  const dot = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      img.set(c, (y * W + x) * 3);
    }
  };
  const line = (ax, ay, bx, by, r, c) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let k = 0; k <= n; k++) dot(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, r, c);
  };
  const text = (str, cx, cy, s = 3, c = [20, 20, 20]) => {
    [...str].forEach((ch, n) => {
      const g = DIGITS[Number(ch)];
      if (!g) return;
      for (let k = 0; k < 15; k++) if (g[k] === '1') for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
        const x = Math.round(cx + n * 4 * s + (k % 3) * s + a), y = Math.round(cy + Math.floor(k / 3) * s + b);
        if (x >= 0 && y >= 0 && x < W && y < H) img.set(c, (y * W + x) * 3);
      }
    });
  };
  for (const b of bumps) for (let a = 0; a < 360; a += 1) dot(X(b.wx + b.r * Math.cos((a * Math.PI) / 180)), Y(b.wz + b.r * Math.sin((a * Math.PI) / 180)), 1, [150, 100, 60]);
  for (let i = i0; i <= iEnd; i += 25) {
    const rl = Math.hypot(L.rx[i], L.rz[i]) || 1;
    for (const [side, c] of [[-1, [70, 140, 230]], [1, [90, 170, 90]]]) {
      line(X(L.px[i]), Y(L.pz[i]), X(L.px[i] + (side * 40 * L.rx[i]) / rl), Y(L.pz[i] + (side * 40 * L.rz[i]) / rl), 1, c);
    }
  }
  for (let i = 0; i < L.n - 1; i++) {
    const on = i >= i0 && i < iEnd, k = Math.abs(L.curv[i]);
    const c = !on ? [190, 190, 190] : k >= 1 / 55 ? [220, 30, 200] : k >= 1 / 70 ? [230, 30, 30] : k >= 1 / 200 ? [245, 150, 30] : [80, 80, 80];
    line(X(L.px[i]), Y(L.pz[i]), X(L.px[i + 1]), Y(L.pz[i + 1]), on ? 2.6 : 1.6, c);
  }
  for (let i = i0; i <= iEnd; i += 100) {
    const s = i - i0;
    dot(X(L.px[i]), Y(L.pz[i]), s % 500 === 0 ? 5 : 3, [10, 10, 10]);
    if (s % 500 === 0) text(String(s), X(L.px[i]) + 9, Y(L.pz[i]) - 18);
  }
  dot(X(L.px[i0]), Y(L.pz[i0]), 8, [40, 180, 60]);
  dot(X(L.px[iEnd]), Y(L.pz[iEnd]), 8, [220, 30, 30]);
  fs.writeFileSync(file, encodePng(img, W, H));
}

function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
