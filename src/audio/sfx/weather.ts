// Weather ambience: the rain (a soft noise bed + a shimmer of droplets) and the wind (a low
// rumble under a slowly gusting band). Both are loops that fade with the race: they exist only
// while a session is running, drop out in a tunnel (the roof takes the rain away) and fade with
// the clock's pause / slow-mo like the bike loops do.
import { filter, steer } from '../dsp/env';
import { noise } from '../dsp/noise';
import { Rng } from '../../core/rng';
import type { Engine } from '../engine';

export type WeatherLoop = 'none' | 'rain' | 'wind';

/** The rain bed's level (the wind is quieter: it is a bed, not a downpour). */
const RAIN_LEVEL = 0.5;
const WIND_LEVEL = 0.34;
/** The rain under a roof (a tunnel): quieter and duller. */
const INDOOR = 0.45;
/** How fast a loop fades in or out (s). */
const FADE = 0.9;

export class WeatherLoops {
  private out: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private rainBed: GainNode;
  private rainDrops: GainNode;
  private wind: GainNode;
  private windBand: BiquadFilterNode;
  private plugged = false;
  /** The last level each gain was steered to (a steady level is not re-automated every frame). */
  private levels = { bed: -1, drops: -1, wind: -1 };

  constructor(private engine: Engine) {
    const ctx = engine.ctx;
    const t = ctx.currentTime;
    const rng = new Rng(0x7ea7);
    this.out = new GainNode(ctx, { gain: 1 });
    // The rain: a soft pink bed (the sheet of water) and a bright hiss on top (the drops).
    this.rainBed = new GainNode(ctx, { gain: 0 });
    this.rainDrops = new GainNode(ctx, { gain: 0 });
    const pink = noise(ctx, 'pink', t, null, rng);
    const white = noise(ctx, 'white', t, null, rng);
    this.sources.push(pink, white);
    pink.connect(filter(ctx, { type: 'bandpass', frequency: 1400, Q: 0.5 })).connect(this.rainBed);
    const drops = new GainNode(ctx, { gain: 1 });
    white.connect(filter(ctx, { type: 'highpass', frequency: 3800, Q: 0.7 })).connect(drops).connect(this.rainDrops);
    this.rainBed.connect(this.out);
    this.rainDrops.connect(this.out);
    // The drops shimmer: a slow swell on the bright layer (the gain stays positive).
    const shimmer = new OscillatorNode(ctx, { type: 'sine', frequency: 0.23 });
    shimmer.connect(new GainNode(ctx, { gain: 0.5 })).connect(drops.gain);
    shimmer.start(t);
    this.sources.push(shimmer);
    // The wind: a brown rumble under a band that gusts.
    this.wind = new GainNode(ctx, { gain: 0 });
    const brown = noise(ctx, 'brown', t, null, rng);
    this.sources.push(brown);
    this.windBand = filter(ctx, { type: 'bandpass', frequency: 420, Q: 0.6 });
    brown.connect(this.windBand).connect(this.wind);
    const gust = new OscillatorNode(ctx, { type: 'sine', frequency: 0.08 });
    gust.connect(new GainNode(ctx, { gain: 190 })).connect(this.windBand.frequency);
    gust.start(t);
    this.sources.push(gust);
    this.wind.connect(this.out);
  }

  /** The loop that plays now and how loud it is (0 = silent; the nodes unplug then). */
  update(loop: WeatherLoop, level: number, indoor: boolean): void {
    const rain = loop === 'rain' ? RAIN_LEVEL * level * (indoor ? INDOOR : 1) : 0;
    const wind = loop === 'wind' ? WIND_LEVEL * level * (indoor ? INDOOR : 1) : 0;
    const now = this.engine.now;
    // Only a changed level is automated: a steady loop must not touch the timeline every frame
    // (cancelAndHoldAtTime is expensive, and the main thread runs this every frame).
    this.level('bed', this.rainBed, rain * 0.8, now);
    this.level('drops', this.rainDrops, rain * 0.45, now);
    this.level('wind', this.wind, wind, now);
    const live = rain > 0.001 || wind > 0.001;
    if (live && !this.plugged) {
      this.out.connect(this.engine.sfxIn);
      this.plugged = true;
    } else if (!live && this.plugged) {
      this.out.disconnect(this.engine.sfxIn);
      this.plugged = false;
    }
  }

  /** Steer one gain, but only when the level really changed. */
  private level(key: 'bed' | 'drops' | 'wind', gain: GainNode, value: number, now: number): void {
    const last = this.levels[key];
    if (last >= 0 && Math.abs(value - last) < Math.max(0.002, last * 0.03)) return;
    this.levels[key] = value;
    steer(gain.gain, now, value, FADE);
  }

  /** Fade out and release every node (the race ended / the session was disposed). */
  stop(): void {
    const now = this.engine.now;
    this.level('bed', this.rainBed, 0, now);
    this.level('drops', this.rainDrops, 0, now);
    this.level('wind', this.wind, 0, now);
    for (const s of this.sources) s.stop(now + 0.3);
    this.sources = [];
    this.out.disconnect();
    this.plugged = false;
  }
}
