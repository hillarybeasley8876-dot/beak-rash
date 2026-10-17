// Comic sprite shapes for the particle atlas, drawn with Canvas2D into a 128 px cell centred on (0,0).
// Convention: white/grey fill (tinted by particle colour), solid black ink outline, alpha = coverage.
// Additive sprites (glow, streak, spark) are soft white gradients.

export type Ctx = CanvasRenderingContext2D;

const INK = '#0b0b0f';

function inkStroke(c: Ctx, width: number): void {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = width;
  c.strokeStyle = INK;
  c.stroke();
}

function starPath(c: Ctx, points: number, outer: number, inner: number, rot = -Math.PI / 2): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
}

/** Comic impact star: 4 long spikes + 4 short ones. */
export function spark4(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const r = i % 2 === 1 ? 13 : i % 4 === 0 ? 56 : 30;
    if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fillStyle = '#fff';
  c.fill();
  inkStroke(c, 7);
}

export function star5(c: Ctx): void {
  starPath(c, 5, 54, 24);
  c.fillStyle = '#fff';
  c.fill();
  inkStroke(c, 7);
  c.beginPath();
  c.moveTo(-8, -30);
  c.lineTo(-16, -8);
  inkStroke(c, 4);
}

export function puff(c: Ctx): void {
  const blobs: Array<[number, number, number]> = [[-20, 8, 26], [18, 10, 24], [0, -12, 30], [-2, 18, 24]];
  c.fillStyle = INK;
  for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x, y, r + 5, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#ffffff';
  for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#c9c9cf';
  c.save();
  c.beginPath();
  for (const [x, y, r] of blobs) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
  c.clip();
  for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x + 6, y + 10, r, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.fillStyle = '#ffffff';
  for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x - 3, y - 4, r * 0.82, 0, Math.PI * 2); c.fill(); }
}

export function feather(c: Ctx): void {
  c.save();
  c.rotate(0.35);
  c.beginPath();
  c.moveTo(0, -56);
  c.bezierCurveTo(26, -34, 24, 22, 4, 50);
  c.lineTo(-2, 50);
  c.bezierCurveTo(-24, 20, -24, -34, 0, -56);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 6);
  c.beginPath();
  c.moveTo(0, -46);
  c.quadraticCurveTo(3, 0, 1, 56);
  inkStroke(c, 4);
  c.beginPath();
  c.moveTo(14, -6); c.lineTo(5, 2);
  c.moveTo(-14, 8); c.lineTo(-4, 14);
  c.moveTo(12, 20); c.lineTo(4, 26);
  inkStroke(c, 3);
  c.restore();
}

export function fur(c: Ctx): void {
  c.beginPath();
  c.moveTo(-30, 40);
  c.quadraticCurveTo(-40, -10, -22, -48);
  c.quadraticCurveTo(-14, -10, -6, 4);
  c.quadraticCurveTo(-4, -40, 8, -56);
  c.quadraticCurveTo(12, -16, 14, 2);
  c.quadraticCurveTo(24, -26, 40, -36);
  c.quadraticCurveTo(30, 6, 30, 40);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 6);
}

export function drop(c: Ctx): void {
  c.beginPath();
  c.moveTo(0, -56);
  c.bezierCurveTo(14, -30, 36, -4, 36, 18);
  c.arc(0, 18, 36, 0, Math.PI);
  c.bezierCurveTo(-36, -4, -14, -30, 0, -56);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 6);
  c.beginPath();
  c.ellipse(-12, 16, 7, 12, 0.3, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  c.beginPath();
  c.arc(0, 18, 26, 0.2, Math.PI * 0.8);
  c.strokeStyle = 'rgba(11,11,15,0.25)';
  c.lineWidth = 6;
  c.stroke();
}

export function bolt(c: Ctx): void {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    if (i === 0) c.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
    else c.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
  }
  c.closePath();
  c.fillStyle = '#d6d8de';
  c.fill();
  inkStroke(c, 7);
  c.beginPath();
  c.arc(0, 0, 17, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.moveTo(-30, -18); c.lineTo(-10, -34);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 6;
  c.stroke();
}

export function stick(c: Ctx): void {
  c.beginPath();
  c.roundRect(-9, -56, 18, 112, 9);
  c.fillStyle = '#e4e6ea';
  c.fill();
  inkStroke(c, 6);
}

export function confetti(c: Ctx): void {
  c.beginPath();
  c.roundRect(-26, -40, 52, 80, 6);
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 5);
}

export function scale(c: Ctx): void {
  c.beginPath();
  c.moveTo(-40, -20);
  c.quadraticCurveTo(0, -46, 40, -20);
  c.quadraticCurveTo(42, 30, 0, 50);
  c.quadraticCurveTo(-42, 30, -40, -20);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 6);
  c.beginPath();
  c.moveTo(-22, -10);
  c.quadraticCurveTo(-18, 18, 0, 32);
  c.strokeStyle = 'rgba(11,11,15,0.3)';
  c.lineWidth = 6;
  c.stroke();
}

export function coin(c: Ctx): void {
  c.beginPath();
  c.arc(0, 0, 50, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  inkStroke(c, 7);
  c.beginPath();
  c.arc(0, 0, 33, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(11,11,15,0.45)';
  c.lineWidth = 5;
  c.stroke();
  starPath(c, 4, 22, 6, 0);
  c.fillStyle = '#ffffff';
  c.fill();
  c.strokeStyle = 'rgba(11,11,15,0.45)';
  c.lineWidth = 3;
  c.stroke();
}

/** Thin band with a soft alpha profile: an alpha-threshold "erode" thins it to a hairline. */
export function ring(c: Ctx): void {
  const g = c.createRadialGradient(0, 0, 42, 0, 0, 58);
  g.addColorStop(0, 'rgba(11,11,15,0)');
  g.addColorStop(0.2, 'rgba(11,11,15,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.85, 'rgba(11,11,15,0.85)');
  g.addColorStop(1, 'rgba(11,11,15,0)');
  c.beginPath();
  c.arc(0, 0, 58, 0, Math.PI * 2);
  c.arc(0, 0, 42, 0, Math.PI * 2, true);
  c.fillStyle = g;
  c.fill('evenodd');
}

export function smear(c: Ctx): void {
  c.beginPath();
  c.ellipse(0, 0, 54, 40, 0, 0, Math.PI * 2);
  c.fillStyle = '#26222c';
  c.fill();
  inkStroke(c, 5);
  const bands = ['#7b4dff', '#21c7a8', '#ffd23a'];
  bands.forEach((col, i) => {
    c.beginPath();
    c.ellipse(-6 + i * 6, -4 + i * 4, 36 - i * 8, 20 - i * 5, -0.3, Math.PI * 1.05, Math.PI * 1.75);
    c.strokeStyle = col;
    c.lineWidth = 5;
    c.stroke();
  });
}

function soft(c: Ctx, rx: number, ry: number, core: number): void {
  c.save();
  c.scale(rx / 60, ry / 60);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(core, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 60, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export const glow = (c: Ctx): void => soft(c, 60, 60, 0.18);
export const streak = (c: Ctx): void => soft(c, 12, 62, 0.45);

export function sparkAdd(c: Ctx): void {
  soft(c, 26, 62, 0.25);
  c.beginPath();
  c.moveTo(0, -58); c.lineTo(7, 0); c.lineTo(0, 58); c.lineTo(-7, 0);
  c.closePath();
  c.fillStyle = '#ffffff';
  c.fill();
}
