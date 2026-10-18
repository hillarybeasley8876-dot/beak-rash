// Drum kit (all synthesized). Noise-based pieces (snare wires, clap, hats, shaker, tambourine,
// ride) are persistent voices re-triggered per hit; pitched one-shots (kick, snare body, rim,
// toms) and rare long ones (crash, swell) create short-lived nodes. Gains are calibrated so the
// drum strip at trim 1 peaks around −10 dBFS on accents.
import { noise } from '../../dsp/noise';
import { anchor, filter, perc, settle } from '../../dsp/env';
import { NoiseVoice, osc, type Gate } from './voice';
import type { Band } from '../band';

const TOMS: Record<1 | 2 | 3, [number, number, number]> = { 1: [215, 165, 0.42], 2: [160, 122, 0], 3: [118, 86, -0.4] };

export class DrumKit {
  private voices = new Map<string, NoiseVoice>();
  private pans = new Map<number, StereoPannerNode>();
  private rideBell: { vca: GainNode; gate: Gate } | null = null;

  constructor(private b: Band) {}

  private get out(): AudioNode {
    return this.b.input('drums');
  }

  private voice(key: string, make: () => NoiseVoice): NoiseVoice {
    let v = this.voices.get(key);
    if (!v) {
      v = make();
      this.voices.set(key, v);
    }
    return v;
  }

  /** One shared panner per position (one-shot hits connect into it; no per-hit panner nodes). */
  private panned(pan: number): AudioNode {
    let p = this.pans.get(pan);
    if (!p) {
      p = new StereoPannerNode(this.b.ctx, { pan });
      p.connect(this.out);
      this.pans.set(pan, p);
    }
    return p;
  }

  kick(t: number, vel: number): void {
    const ctx = this.b.ctx;
    const o = new OscillatorNode(ctx, { type: 'sine', frequency: 165 });
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(54, t + 0.065);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.32);
    const g = new GainNode(ctx, { gain: 0 });
    const end = perc(g.gain, t, 0.95 * vel, 0.002, 0.34);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(end);
    this.voice('click', () => new NoiseVoice(this.b, [{ type: 'bandpass', frequency: 3200, Q: 0.8 }], this.out))
      .hit(t, 0.22 * vel, 0.0008, 0.008);
    this.b.duck(t, 0.42 * vel);
  }

  snare(t: number, vel: number, ghost = false): void {
    const ctx = this.b.ctx;
    const body = new OscillatorNode(ctx, { type: 'triangle', frequency: 240 });
    body.frequency.setValueAtTime(240, t);
    body.frequency.exponentialRampToValueAtTime(180, t + 0.04);
    const bg = new GainNode(ctx, { gain: 0 });
    const end = perc(bg.gain, t, (ghost ? 0.12 : 0.42) * vel, 0.001, ghost ? 0.04 : 0.09);
    body.connect(bg).connect(this.out);
    body.start(t);
    body.stop(end);
    this.voice('snare', () => new NoiseVoice(this.b, [
      { type: 'highpass', frequency: 1300, Q: 0.7 }, { type: 'peaking', frequency: 4200, Q: 1.2, gain: 5 },
    ], this.out, -0.06)).hit(t, (ghost ? 0.16 : 0.5) * vel, 0.0015, ghost ? 0.06 : 0.17);
  }

  rim(t: number, vel: number): void {
    const ctx = this.b.ctx;
    const o = new OscillatorNode(ctx, { type: 'triangle', frequency: 1750 });
    const g = new GainNode(ctx, { gain: 0 });
    const end = perc(g.gain, t, 0.3 * vel, 0.0005, 0.03);
    o.connect(g).connect(this.panned(-0.15));
    o.start(t);
    o.stop(end);
  }

  clap(t: number, vel: number): void {
    const v = this.voice('clap', () => new NoiseVoice(this.b, [{ type: 'bandpass', frequency: 1150, Q: 1.1 }], this.out, 0.05));
    const p = v.vca.gain;
    const peak = 0.55 * vel;
    anchor(p, t);
    for (let k = 0; k < 3; k++) {
      const at = t + k * 0.011;
      p.linearRampToValueAtTime(peak, at + 0.001);
      p.exponentialRampToValueAtTime(peak * 0.15, at + 0.009);
    }
    p.linearRampToValueAtTime(peak * 0.8, t + 0.034);
    p.exponentialRampToValueAtTime(0.0001, t + 0.22);
    p.linearRampToValueAtTime(0, t + 0.225);
    settle(p, t + 0.225, 0);
    v.wake(t + 0.23);
  }

  hat(t: number, vel: number, open: boolean): void {
    this.voice('hat', () => new NoiseVoice(this.b, [
      { type: 'highpass', frequency: 7200, Q: 0.6 }, { type: 'peaking', frequency: 10500, Q: 0.9, gain: 6 },
    ], this.out, 0.28)).hit(t, (open ? 0.3 : 0.26) * vel, 0.0012, open ? 0.3 : 0.04 + 0.02 * vel);
  }

  shaker(t: number, vel: number): void {
    this.voice('shaker', () => new NoiseVoice(this.b, [{ type: 'bandpass', frequency: 5600, Q: 1.4 }], this.out, -0.38))
      .hit(t, 0.42 * vel, 0.012, 0.07);
  }

  tambourine(t: number, vel: number): void {
    const v = this.voice('tamb', () => new NoiseVoice(this.b, [
      { type: 'highpass', frequency: 5200, Q: 0.7 }, { type: 'peaking', frequency: 8800, Q: 3, gain: 9 },
    ], this.out, 0.42));
    const p = v.vca.gain;
    const peak = 0.36 * vel;
    anchor(p, t);
    for (let k = 0; k < 3; k++) {
      p.linearRampToValueAtTime(peak * (1 - k * 0.22), t + k * 0.016 + 0.001);
      p.exponentialRampToValueAtTime(peak * 0.3, t + k * 0.016 + 0.012);
    }
    p.exponentialRampToValueAtTime(0.0001, t + 0.17);
    p.linearRampToValueAtTime(0, t + 0.175);
    settle(p, t + 0.175, 0);
    v.wake(t + 0.18);
  }

  tom(t: number, vel: number, which: 1 | 2 | 3): void {
    const ctx = this.b.ctx;
    const [f0, f1, pan] = TOMS[which];
    const o = new OscillatorNode(ctx, { type: 'sine', frequency: f0 });
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.18);
    const g = new GainNode(ctx, { gain: 0 });
    const end = perc(g.gain, t, 0.62 * vel, 0.002, 0.3 + which * 0.04);
    o.connect(g).connect(this.panned(pan));
    o.start(t);
    o.stop(end);
    this.voice('click', () => new NoiseVoice(this.b, [{ type: 'bandpass', frequency: 3200, Q: 0.8 }], this.out))
      .hit(t, 0.1 * vel, 0.001, 0.02);
  }

  crash(t: number, vel: number): void {
    const ctx = this.b.ctx;
    const n = noise(ctx, 'white', t, 2.1, this.b.rng);
    const hp = filter(ctx, { type: 'highpass', frequency: 4200, Q: 0.5 });
    const pk = filter(ctx, { type: 'peaking', frequency: 7600, Q: 0.7, gain: 4 });
    const g = new GainNode(ctx, { gain: 0 });
    perc(g.gain, t, 0.3 * vel, 0.002, 1.9);
    n.connect(hp).connect(pk).connect(g).connect(this.panned(-0.2));
  }

  ride(t: number, vel: number): void {
    this.voice('ride', () => new NoiseVoice(this.b, [{ type: 'highpass', frequency: 6500, Q: 0.6 }], this.out, 0.32))
      .hit(t, 0.13 * vel, 0.001, 0.45);
    if (!this.rideBell) {
      const vca = new GainNode(this.b.ctx, { gain: 0 });
      osc(this.b, 'sine', 4630).connect(vca);
      this.rideBell = { vca, gate: this.b.gate(vca, this.panned(0.32)) };
    }
    this.rideBell.gate.open(perc(this.rideBell.vca.gain, t, 0.035 * vel, 0.001, 0.35, true));
  }

  /** Reverse-cymbal swell that lands exactly on `t + dur` (section transitions, stingers). */
  swell(t: number, dur: number, vel = 1): void {
    const ctx = this.b.ctx;
    const n = noise(ctx, 'white', t, dur, this.b.rng);
    const hp = filter(ctx, { type: 'highpass', frequency: 1500, Q: 0.6 });
    hp.frequency.setValueAtTime(1500, t);
    hp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02 * vel, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.32 * vel, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(hp).connect(g).connect(this.panned(0.1));
  }

  /**
   * Riser into `t + dur`: band-passed noise sweeping `from` → `to` Hz plus a square gliding up
   * three octaves underneath, swelling to the downbeat.
   */
  riser(t: number, dur: number, vel = 1, from = 350, to = 5200): void {
    const ctx = this.b.ctx;
    const end = t + dur;
    const n = noise(ctx, 'white', t, dur, this.b.rng);
    const bp = filter(ctx, { type: 'bandpass', frequency: from, Q: 1.4 });
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, end);
    const o = new OscillatorNode(ctx, { type: 'square', frequency: from / 3 });
    o.frequency.setValueAtTime(from / 3, t);
    o.frequency.exponentialRampToValueAtTime(to / 6, end);
    const lp = filter(ctx, { type: 'lowpass', frequency: 1400, Q: 0.7 });
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.015 * vel, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, end - 0.01);
    g.gain.linearRampToValueAtTime(0, end);
    n.connect(bp).connect(g);
    o.connect(lp).connect(new GainNode(ctx, { gain: 0.35 })).connect(g);
    g.connect(this.panned(0));
    o.start(t);
    o.stop(end + 0.02);
  }

  /** Two-square disco cowbell (lives in 0.5–3 kHz, cuts through a busy mix). */
  cowbell(t: number, vel: number): void {
    const ctx = this.b.ctx;
    const bp = filter(ctx, { type: 'bandpass', frequency: 1700, Q: 1.1 });
    const g = new GainNode(ctx, { gain: 0 });
    const end = perc(g.gain, t, 1.3 * vel, 0.001, 0.28);
    bp.connect(g).connect(this.panned(0.22));
    for (const f of [562, 845]) {
      const o = new OscillatorNode(ctx, { type: 'square', frequency: f });
      o.connect(bp);
      o.start(t);
      o.stop(end + 0.01);
    }
  }
}
