// Drum kit (all synthesized). Every hit (kick, snare, rim, toms, clap, hats, shaker, tambourine,
// ride, crash, cowbell) plays a sample rendered once (drum-samples.ts): one buffer source + gain,
// alive only while it sounds, so no oscillators, pitch glides or filter chains run on the audio
// thread. The rare long effects (swell, riser) create short-lived nodes. Gains are calibrated so
// the drum strip at trim 1 peaks around −10 dBFS on accents; the noise hits sit 3.5 dB (cymbals
// 5.5 dB) over the former live voices, which had sounded early (pre-onset swells) and so carried
// more energy than their envelopes.
import { noise } from '../../dsp/noise';
import { filter } from '../../dsp/env';
import { playSample, type DrumSample } from './drum-samples';
import type { Band } from '../band';

const TOM_PAN: Record<1 | 2 | 3, number> = { 1: 0.42, 2: 0, 3: -0.4 };
const OPEN_HAT_S = 0.34;

export class DrumKit {
  private pans = new Map<number, StereoPannerNode>();
  private turns = new Map<DrumSample, number>();
  /** The ringing open hat, choked by the next hat like a closing pedal. */
  private openHat: { gain: GainNode; level: number; end: number } | null = null;

  constructor(private b: Band) {}

  private get out(): AudioNode {
    return this.b.input('drums');
  }

  /** One shared panner per position (hits connect into it; no per-hit panner nodes). */
  private panned(pan: number): AudioNode {
    if (pan === 0) return this.out;
    let p = this.pans.get(pan);
    if (!p) {
      p = new StereoPannerNode(this.b.ctx, { pan });
      p.connect(this.out);
      this.pans.set(pan, p);
    }
    return p;
  }

  /** A sample hit at `level` (its takes rotate); returns the hit's gain node. */
  private sample(kind: DrumSample, t: number, level: number, pan = 0): GainNode {
    const turn = (this.turns.get(kind) ?? 0) + 1;
    this.turns.set(kind, turn);
    return playSample(this.b.ctx, kind, turn, t, level, this.panned(pan));
  }

  kick(t: number, vel: number): void {
    this.sample('kick', t, 0.76 * vel);
    this.b.duck(t, 0.42 * vel);
  }

  snare(t: number, vel: number, ghost = false): void {
    this.sample(ghost ? 'snareGhost' : 'snare', t, (ghost ? 0.24 : 0.75) * vel);
  }

  rim(t: number, vel: number): void {
    this.sample('rim', t, 0.3 * vel, -0.15);
  }

  clap(t: number, vel: number): void {
    this.sample('clap', t, 0.82 * vel);
  }

  hat(t: number, vel: number, open: boolean): void {
    this.choke(t);
    const level = (open ? 0.64 : 0.55) * vel;
    const gain = this.sample(open ? 'hatOpen' : 'hat', t, level, 0.28);
    if (open) this.openHat = { gain, level, end: t + OPEN_HAT_S };
  }

  private choke(t: number): void {
    const o = this.openHat;
    if (!o || t >= o.end) return;
    o.gain.gain.setValueAtTime(o.level, t);
    o.gain.gain.linearRampToValueAtTime(0, t + 0.008);
    this.openHat = null;
  }

  shaker(t: number, vel: number): void {
    this.sample('shaker', t, 0.8 * vel, -0.38);
  }

  tambourine(t: number, vel: number): void {
    this.sample('tamb', t, 0.68 * vel, 0.42);
  }

  tom(t: number, vel: number, which: 1 | 2 | 3): void {
    this.sample(`tom${which}`, t, 0.62 * vel, TOM_PAN[which]);
  }

  crash(t: number, vel: number): void {
    this.sample('crash', t, 0.3 * vel, -0.2);
  }

  ride(t: number, vel: number): void {
    this.sample('ride', t, 0.25 * vel, 0.32);
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
    this.sample('cowbell', t, 1.3 * vel, 0.22);
  }
}
