// More comic sprite shapes (impact burst, manga impact lines, hearts, notes, zaps, swirls, keycaps,
// leaves, fries). Same conventions as atlas-shapes.ts.
import type { Ctx } from './atlas-shapes';

const INK = '#0b0b0f';

function ink(c: Ctx, width: number): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = INK;
  c.stroke();
}

/** Irregular jagged impact star (the main "POW" shape). */
export function burst(c: Ctx): void {
  const spikes = [56, 34, 50, 30, 58, 36, 46, 28, 54, 33, 49, 31, 57, 35, 44, 29];
  c.beginPath();
  spikes.forEach((r, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / spikes.length + (i % 2 ? 0.06 : -0.04);
    const rr = i % 2 ? r * 0.62 : r;
    if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  });
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
}

/** Manga impact lines: thin tapered rays around an empty centre. */
export function rays(c: Ctx): void {
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ((i * 5) % 3) * 0.06;
    const r0 = 30 + ((i * 7) % 5) * 3;
    const r1 = 52 + ((i * 3) % 4) * 2;
    const w = 0.035 + (i % 2) * 0.02;
    c.beginPath();
    c.moveTo(Math.cos(a - w) * r1, Math.sin(a - w) * r1);
    c.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
    c.lineTo(Math.cos(a + w) * r1, Math.sin(a + w) * r1);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    ink(c, 2.5);
  }
}

export function heart(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, 46);
  c.bezierCurveTo(-60, 4, -40, -48, 0, -20);
  c.bezierCurveTo(40, -48, 60, 4, 0, 46);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.ellipse(-20, -14, 8, 5, -0.6, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,1)';
  c.fill();
}

export function note(c: Ctx): void {
  c.beginPath();
  c.ellipse(-16, 30, 18, 13, -0.4, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.moveTo(0, 26);
  c.lineTo(0, -46);
  c.quadraticCurveTo(26, -38, 30, -14);
  ink(c, 7);
}

export function zap(c: Ctx): void {
  c.beginPath();
  c.moveTo(10, -56);
  c.lineTo(-26, 6);
  c.lineTo(-2, 6);
  c.lineTo(-14, 56);
  c.lineTo(28, -10);
  c.lineTo(4, -10);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
}

export function swirl(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = t * Math.PI * 4;
    const r = 6 + t * 44;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ink(c, 14);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 7;
  c.stroke();
}

export function keycap(c: Ctx): void {
  c.beginPath();
  c.roundRect(-38, -38, 76, 76, 12);
  c.fillStyle = '#c9c9d2';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.roundRect(-28, -32, 56, 50, 8);
  c.fillStyle = '#ffffff';
  c.fill();
  c.fillStyle = INK;
  c.font = 'bold 30px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('Q', 0, -6);
}

export function leaf(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, -56);
  c.quadraticCurveTo(34, -10, 4, 54);
  c.quadraticCurveTo(-34, -10, 0, -56);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.moveTo(0, -44);
  c.lineTo(2, 46);
  c.strokeStyle = 'rgba(11,11,15,0.35)';
  c.lineWidth = 4;
  c.stroke();
}

export function fry(c: Ctx): void {
  c.save();
  c.rotate(0.5);
  c.beginPath();
  c.roundRect(-11, -54, 22, 108, 5);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.moveTo(-4, -40);
  c.lineTo(-4, 30);
  c.strokeStyle = 'rgba(11,11,15,0.2)';
  c.lineWidth = 4;
  c.stroke();
  c.restore();
}
