// Rolling telemetry plot for the feel bench: the last 6 s of the player's handling channels.
import type { DebugRow } from '../src/sim/debug';

interface Channel { key: string; label: string; color: string; scale: number }

const CHANNELS: Channel[] = [
  { key: 'kmh', label: 'km/h', color: '#ffffff', scale: 100 },
  { key: 'steer', label: 'steer', color: '#ffe600', scale: 1 },
  { key: 'vx', label: 'vx m/s', color: '#3fd0ff', scale: 10 },
  { key: 'lean', label: 'lean°', color: '#ff1e3c', scale: 40 },
  { key: 'yaw', label: 'yaw°', color: '#ff9a2e', scale: 40 },
  { key: 'draft', label: 'draft', color: '#47e07a', scale: 1 },
  { key: 'y', label: 'y m', color: '#c78bff', scale: 3 },
];

const LEVEL_COLORS = ['transparent', 'rgba(60,140,255,0.28)', 'rgba(255,150,40,0.3)', 'rgba(255,80,200,0.32)'];
const SPAN = 6;

export interface Sample { t: number; level: number; boost: number; values: Record<string, number> }

export class FeelGraph {
  private samples: Sample[] = [];
  private g: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const g = canvas.getContext('2d');
    if (!g) throw new Error('[sim sandbox] 2d context unavailable');
    this.g = g;
  }

  push(t: number, row: DebugRow, steer: number): void {
    const num = (k: string): number => (typeof row[k] === 'number' ? (row[k] as number) : 0);
    const deg = 180 / Math.PI;
    this.samples.push({
      t, level: num('driftLevel') * (row.drifting ? 1 : 0), boost: num('boost'),
      values: { kmh: num('v') * 3.6, steer, vx: num('vx'), lean: num('lean') * deg, yaw: num('yaw') * deg, draft: num('draft'), y: num('y') },
    });
    while (this.samples.length && (this.samples[0]?.t ?? t) < t - SPAN) this.samples.shift();
  }

  draw(now: number): void {
    const { g, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    const xOf = (t: number): number => W - ((now - t) / SPAN) * W;
    const mid = H * 0.55;
    const amp = H * 0.4;
    for (const s of this.samples) {
      if (s.level > 0) {
        g.fillStyle = LEVEL_COLORS[s.level] ?? 'transparent';
        g.fillRect(xOf(s.t), 0, 3, H);
      }
      if (s.boost > 0) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(xOf(s.t), H - 8, 3, 8);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(W, mid);
    g.stroke();
    CHANNELS.forEach((ch, i) => {
      g.strokeStyle = ch.color;
      g.lineWidth = 1.5;
      g.beginPath();
      this.samples.forEach((s, j) => {
        const y = mid - ((s.values[ch.key] ?? 0) / ch.scale) * amp;
        if (j === 0) g.moveTo(xOf(s.t), y);
        else g.lineTo(xOf(s.t), y);
      });
      g.stroke();
      const last = this.samples[this.samples.length - 1]?.values[ch.key] ?? 0;
      g.fillStyle = ch.color;
      g.font = '11px ui-monospace, monospace';
      g.fillText(`${ch.label} ${last.toFixed(ch.scale >= 10 ? 1 : 2)}`, 6 + (i % 4) * 136, 13 + Math.floor(i / 4) * 13);
    });
  }
}
