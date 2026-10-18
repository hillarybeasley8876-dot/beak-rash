// The player's continuous bike sounds, all speed-linked: wind, chain whirr (pedalling), freewheel
// ticks (coasting), tyre roll + surface layers (curb rumble, grass swish, sand hiss, gravel
// crunch, water), drift skid and boost jet. Layers that are silent get unplugged (no CPU). Wind and
// roll filter the shared noise sources (k-rate cutoffs follow the speed); the chain whirr is a
// pre-rendered loop (sfx/loop-buffers.ts). Sources run at playbackRate exactly 1 whenever the
// clock does: a resampling buffer source costs the audio thread ≈ 2× a unity-rate one.
import { filter, holdAt, steer } from '../dsp/env';
import { impulseWave } from '../dsp/curves';
import { noise } from '../dsp/noise';
import { LOOP_REF, loopSource } from './loop-buffers';
import { Rng } from '../../core/rng';
import type { Engine } from '../engine';
import type { Surface } from '../../core/types';

/** Level match of the chain loop to the old live chain (band-pass 3600 Hz), measured offline, then
 *  −2 dB with the wind (both sat on the music's hook band at race speed). */
const CHAIN_TRIM = 0.85;
/** Wind band centre (Hz) = WIND_LOW + WIND_SPAN · (speed / 20 m/s): it rises with speed, but stays
 *  under the 1.2–3 kHz band the lead's harmonics need. */
const WIND_LOW = 250;
const WIND_SPAN = 1100;
const WIND_LEVEL = 0.13;
/** Continuous changes (speed, pedal) are followed at 25 Hz: every move is an automation event the
 *  audio thread has to take in, and the 60 ms glides smooth the steps anyway. */
const UPDATE_EVERY = 0.04;

export interface LoopState {
  speed: number;        // m/s
  pedal: number;        // 0..1 throttle effort
  surface: Surface;
  drift: number;        // 0 = not drifting, else 1 + charge level (1..4)
  boost: boolean;
  airborne: boolean;
  active: boolean;      // on the bike and racing (not crashed / grid idle)
  timeScale: number;    // clock scale: 0 paused, 0.1 slow-mo
}

class Layer {
  readonly gain: GainNode;
  private plugged = false;
  private value = 0;

  constructor(private engine: Engine, private dest: AudioNode) {
    this.gain = new GainNode(engine.ctx, { gain: 0 });
  }

  set(target: number, tau = 0.06): void {
    const v = Math.max(0, target);
    if (v > 0.0005 && !this.plugged) {
      this.gain.connect(this.dest);
      this.plugged = true;
    }
    if (Math.abs(v - this.value) > Math.max(0.002, this.value * 0.03)) {
      steer(this.gain.gain, this.engine.now, v, tau);
      this.value = v;
    }
    if (v <= 0.0005 && this.plugged && this.gain.gain.value < 0.0005) {
      this.gain.disconnect(this.dest);
      this.plugged = false;
    }
  }
}

const SURFACE_ROLL: Record<Surface, number> = { road: 1, curb: 1, grass: 0.5, sand: 0.4, dirt: 0.7, water: 0.3, wall: 1 };

export class BikeLoops {
  private out: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private white: AudioBufferSourceNode;
  private crackle: AudioBufferSourceNode;
  private windBand: BiquadFilterNode;
  private chain: AudioBufferSourceNode;
  private rollLow: BiquadFilterNode;
  private ratchet: OscillatorNode;
  private rumble: OscillatorNode;
  private skidBand: BiquadFilterNode;
  private jetBand: BiquadFilterNode;
  private layers: Record<'wind' | 'chain' | 'free' | 'roll' | 'curb' | 'grass' | 'sand' | 'dirt' | 'water' | 'skid' | 'jet', Layer>;

  constructor(private engine: Engine) {
    const ctx = engine.ctx;
    this.out = new GainNode(ctx, { gain: 1 });
    this.out.connect(engine.sfxIn);
    const t = ctx.currentTime;
    const rng = new Rng(0xb1ce);
    this.white = noise(ctx, 'white', t, null, rng);
    const brown = noise(ctx, 'brown', t, null, rng);
    this.crackle = noise(ctx, 'crackle', t, null, rng);
    const L = (): Layer => new Layer(engine, this.out);
    this.layers = { wind: L(), chain: L(), free: L(), roll: L(), curb: L(), grass: L(), sand: L(), dirt: L(), water: L(), skid: L(), jet: L() };
    const ly = this.layers;
    // Always-on layers: wind (band-passed white), tyre roll (low-passed brown) and the chain whirr
    // (a pre-rendered tooth-rate gated noise loop, rate-shifted with the cadence).
    this.windBand = filter(ctx, { type: 'bandpass', frequency: WIND_LOW, Q: 0.6 });
    this.white.connect(this.windBand).connect(ly.wind.gain);
    this.chain = loopSource(ctx, 'chain', t, rng);
    this.chain.connect(ly.chain.gain);
    this.rollLow = filter(ctx, { type: 'lowpass', frequency: 320, Q: 0.7 });
    brown.connect(this.rollLow).connect(ly.roll.gain);
    // Freewheel: band-limited impulse train = pawl ticks, a buzz at speed.
    this.ratchet = new OscillatorNode(ctx, { frequency: 20 });
    this.ratchet.setPeriodicWave(impulseWave(ctx, 40));
    this.ratchet.connect(filter(ctx, { type: 'bandpass', frequency: 4600, Q: 3 })).connect(ly.free.gain);
    // Curb: rumble-strip pulses (AM of low noise at speed / strip spacing).
    const curbVca = new GainNode(ctx, { gain: 0.5 });
    this.rumble = new OscillatorNode(ctx, { type: 'square', frequency: 30 });
    this.rumble.connect(new GainNode(ctx, { gain: 0.5 })).connect(curbVca.gain);
    brown.connect(filter(ctx, { type: 'lowpass', frequency: 420 })).connect(curbVca).connect(ly.curb.gain);
    this.white.connect(filter(ctx, { type: 'bandpass', frequency: 3200, Q: 0.7 })).connect(ly.grass.gain);
    this.white.connect(filter(ctx, { type: 'lowpass', frequency: 1300 })).connect(ly.sand.gain);
    this.crackle.connect(filter(ctx, { type: 'bandpass', frequency: 1600, Q: 0.8 })).connect(ly.dirt.gain);
    this.white.connect(filter(ctx, { type: 'bandpass', frequency: 850, Q: 1.6 })).connect(ly.water.gain);
    this.skidBand = filter(ctx, { type: 'bandpass', frequency: 1900, Q: 3 });
    this.white.connect(this.skidBand).connect(ly.skid.gain);
    this.jetBand = filter(ctx, { type: 'bandpass', frequency: 1200, Q: 1 });
    this.white.connect(this.jetBand).connect(ly.jet.gain);
    for (const o of [this.ratchet, this.rumble]) {
      // Speed-linked rates glide over 60 ms: one value per render quantum is plenty (CPU).
      o.frequency.automationRate = 'k-rate';
      o.start(t);
    }
    this.sources = [this.white, brown, this.crackle, this.chain, this.ratchet, this.rumble];
  }

  private tuned = new Map<AudioParam, number>();
  private lastAt = -Infinity;
  private lastKey = '';

  /** Move a parameter (60 ms ramp) only when it changed by > 1 %; ramps land exactly on their value
   *  (a playbackRate approaching 1 asymptotically would keep its source resampling). */
  private tune(p: AudioParam, value: number): void {
    const prev = this.tuned.get(p);
    if (prev === value || (prev !== undefined && value !== 1 && Math.abs(value - prev) <= Math.abs(prev) * 0.01)) return;
    this.tuned.set(p, value);
    const now = this.engine.now;
    holdAt(p, now);
    p.linearRampToValueAtTime(value, now + 0.06);
  }

  update(st: LoopState): void {
    // Discrete changes (surface, drift level, boost, air, on / off, pause) apply at once.
    const key = `${st.surface}|${st.drift}|${st.boost}|${st.airborne}|${st.active}|${st.timeScale > 0.02}|${st.pedal > 0.1}`;
    const now = this.engine.now;
    if (key === this.lastKey && now - this.lastAt < UPDATE_EVERY) return;
    this.lastKey = key;
    this.lastAt = now;
    const ly = this.layers;
    const run = st.timeScale > 0.02 ? 1 : 0;
    const on = run * (st.active ? 1 : 0);
    const slow = 0.55 + 0.45 * Math.min(1, st.timeScale);
    const v = Math.max(0, st.speed);
    const k = Math.min(1.3, v / 20);
    const ground = st.airborne ? 0 : 1;
    this.tune(this.white.playbackRate, slow);
    // Live band-pass power grew with its centre (constant Q); a rate-shifted buffer keeps its power.
    // A constant-Q band-pass passes more power as its centre rises (the old loops scaled by √rate).
    this.tune(this.windBand.frequency, (WIND_LOW + WIND_SPAN * k) * slow);
    ly.wind.set(run * (0.012 + WIND_LEVEL * k * k) * (st.boost ? 1.35 : 1));
    const pedalling = st.pedal > 0.1 && ground > 0 && v > 0.5;
    this.tune(this.chain.playbackRate, ((3 + v * 5.5) * slow) / LOOP_REF.chainTooth);
    ly.chain.set(on * (pedalling ? (0.03 + 0.07 * Math.min(1, k)) * (0.6 + 0.4 * st.pedal) * CHAIN_TRIM : 0));
    this.tune(this.ratchet.frequency, Math.max(2, v * 7) * slow);
    ly.free.set(on * (!pedalling && v > 1.5 ? 0.05 + 0.04 * Math.min(1, v / 15) : 0));
    this.tune(this.rollLow.frequency, 160 + v * 12);
    ly.roll.set(on * ground * 0.18 * Math.min(1, v / 12) * SURFACE_ROLL[st.surface]);
    this.tune(this.rumble.frequency, Math.max(4, v / 0.35) * slow);
    const surf = (s: Surface, level: number, full: number): number => (st.surface === s ? on * ground * level * Math.min(1, v / full) : 0);
    ly.curb.set(surf('curb', 0.3, 8));
    ly.grass.set(surf('grass', 0.08, 10));
    ly.sand.set(surf('sand', 0.09, 10));
    this.tune(this.crackle.playbackRate, (0.6 + v / 20) * slow);
    ly.dirt.set(surf('dirt', 0.55, 10));
    ly.water.set(surf('water', 0.12, 6));
    this.tune(this.skidBand.frequency, (1700 + 300 * st.drift) * slow);
    ly.skid.set(on * ground * (st.drift > 0 && v > 4 ? 0.06 + 0.015 * st.drift : 0));
    this.tune(this.jetBand.frequency, (900 + 1200 * k) * slow);
    ly.jet.set(on * (st.boost ? 0.1 : 0));
  }

  /** Fade out and release every node (race over / session disposed). */
  stop(): void {
    const now = this.engine.now;
    steer(this.out.gain, now, 0, 0.06);
    for (const s of this.sources) s.stop(now + 0.4);
    const first = this.sources[0];
    if (first) first.onended = () => this.out.disconnect();
    this.sources = [];
  }
}
