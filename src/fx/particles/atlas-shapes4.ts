// Comic atlas sprites for the r4 effects: police cap, little fish, watermelon wedge, round fruit, rubber duck.
// Same conventions as atlas-shapes.ts: white/grey fill (the particle colour tints it), solid black ink outline,
// alpha = coverage.
import type { Ctx } from './atlas-shapes';

const INK = '#0b0b0f';

function ink(c: Ctx, width: number): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = INK;
  c.stroke();
}

/** Police cap: a domed crown with a peak and a small badge. */
export function cap(c: Ctx): void {
  c.beginPath();
  c.moveTo(-46, 16);
  c.quadraticCurveTo(-44, -40, 0, -44);
  c.quadraticCurveTo(44, -40, 46, 16);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  // The peak: a flat brim across the front.
  c.beginPath();
  c.ellipse(0, 18, 54, 13, 0, 0, Math.PI * 2);
  c.fillStyle = '#d7d7de';
  c.fill();
  ink(c, 6);
  // Badge.
  c.beginPath();
  c.moveTo(0, -30);
  c.lineTo(11, -18);
  c.lineTo(0, -6);
  c.lineTo(-11, -18);
  c.closePath();
  c.fillStyle = INK;
  c.fill();
}

/** Little fish: an oval body, a tail and an eye. */
export function fish(c: Ctx): void {
  c.beginPath();
  c.ellipse(-4, 0, 40, 24, 0, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.moveTo(32, 0);
  c.lineTo(58, -20);
  c.lineTo(58, 20);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.arc(-26, -6, 6, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
  // A fin line.
  c.beginPath();
  c.moveTo(-6, -18);
  c.quadraticCurveTo(4, -30, 16, -20);
  c.strokeStyle = 'rgba(11,11,15,0.35)';
  c.lineWidth = 5;
  c.stroke();
}

/** Watermelon wedge: a slice seen from the side, rind at the bottom. */
export function melon(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, -50);
  c.lineTo(52, 34);
  c.quadraticCurveTo(0, 58, -52, 34);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  // The rind band along the bottom edge.
  c.beginPath();
  c.moveTo(-50, 33);
  c.quadraticCurveTo(0, 55, 50, 33);
  c.lineTo(44, 22);
  c.quadraticCurveTo(0, 42, -44, 22);
  c.closePath();
  c.fillStyle = 'rgba(11,11,15,0.22)';
  c.fill();
  // Seeds.
  c.beginPath();
  c.ellipse(-12, 2, 4, 7, 0.4, 0, Math.PI * 2);
  c.ellipse(10, 8, 4, 7, -0.3, 0, Math.PI * 2);
  c.ellipse(0, 22, 4, 6, 0.1, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
}

/** Round fruit: a ball with a stem and a leaf. */
export function fruit(c: Ctx): void {
  c.beginPath();
  c.arc(0, 8, 40, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.moveTo(0, -30);
  c.quadraticCurveTo(4, -44, 12, -50);
  c.strokeStyle = INK;
  c.lineWidth = 7;
  c.stroke();
  c.beginPath();
  c.ellipse(26, -40, 20, 11, -0.5, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 5);
  c.beginPath();
  c.ellipse(-14, -4, 11, 8, -0.5, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fill();
}

/** Rubber duck: a round body, a head and a beak. */
export function duck(c: Ctx): void {
  c.beginPath();
  c.ellipse(2, 18, 40, 28, 0, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  c.beginPath();
  c.arc(-16, -20, 24, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 6);
  // The beak.
  c.beginPath();
  c.moveTo(-34, -22);
  c.lineTo(-58, -14);
  c.lineTo(-34, -8);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 5);
  // The eye and a little tail flick.
  c.beginPath();
  c.arc(-22, -26, 5, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.moveTo(38, 6);
  c.lineTo(56, -6);
  c.lineTo(54, 20);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  ink(c, 5);
}
