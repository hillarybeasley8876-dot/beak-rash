// A Band is one song's mixer: per-instrument channel strips (gain → pan → sends), a tempo-synced
// delay, keys tremolo, bass grit, kick side-chain ducking and a bass-drop high-pass for KO slow-mo.
// Each SongPlayer owns a Band, so crossfades and stingers never fight over the same nodes.
// Strips, instruments and the shared noise source are created on first use: a band only runs
// the nodes its song actually needs (CPU).
import { Rng } from '../../core/rng';
import { driveCurve } from '../dsp/curves';
import { anchor, filter, holdAt, settle, steer } from '../dsp/env';
import { noise } from '../dsp/noise';
import { FilterSwitch } from '../dsp/switch';
import { SampledBrass } from './instruments/brass-sampler';
import { DrumKit } from './instruments/drums';
import { SlapBass } from './instruments/bass';
import { Clav } from './instruments/keys';
import { SampledPad } from './instruments/pad-sampler';
import { SampledKeys } from './instruments/keys-sampler';
import { Lead } from './instruments/lead';
import { Gate, osc } from './instruments/voice';
import type { Engine } from '../engine';
import type { Channel, LeadVoice } from './types';

// Melody on top: lead hooks ≈ −5 LU under the full mix, bass ≈ −8, drums ≈ −4 (audio-check stems).
const DEFAULT_MIX: Record<Channel, number> = {
  drums: 0.8, bass: 0.6, keys: 0.8, clav: 2.4, brass: 0.84, lead: 0.45, pad: 0.45, fx: 0.6,
};
// Send levels come in a few shared values: channels with the same level feed one send gain.
const VERB: Record<Channel, number> = { drums: 0.15, bass: 0, keys: 0.29, clav: 0.15, brass: 0.29, lead: 0.5, pad: 0.4, fx: 0.29 };
const DELAY: Record<Channel, number> = { drums: 0, bass: 0, keys: 0.09, clav: 0.09, brass: 0.09, lead: 0.22, pad: 0, fx: 0.09 };
const DUCKED = new Set<Channel>(['bass', 'keys', 'pad', 'clav']);
/** Comping parts and horns step back (−7.5 dB) while the lead plays, so the hook sits on top. */
const UNDER_LEAD = new Set<Channel>(['keys', 'pad', 'clav', 'brass']);
const UNDER_LEAD_GAIN = 0.42;
/** Stereo image: brass and pad bake their spread into their pre-mixed chords, the keys auto-pan,
 *  the clav sits left, the drums are stereo samples, the reverb is decorrelated (the lead sends more). */
const PAN: Partial<Record<Channel, number>> = { clav: -0.5 };
/** Breakdown: bars 1–4 this far down (dB) behind a low-pass at BREAK_LP; the build climbs to BUILD_TOP dB. */
const BREAK_DB = -6;
const BUILD_TOP_DB = 2;
const BREAK_LP = 900;

export class Band {
  readonly ctx: BaseAudioContext;
  readonly out: GainNode;
  private strips = new Map<Channel, GainNode>();
  private sc: GainNode;          // side-chain gain shared by bass / keys / pad / clav
  private under: GainNode;       // lead side-chain for keys / pad / clav (then the kick side-chain)
  private underFree: GainNode;   // lead side-chain for the horns (no kick duck)
  private hp: BiquadFilterNode;  // bass drop
  private bassDrop: FilterSwitch; // the high-pass is only in the path during a KO drop
  private dropClear = Infinity;
  private shape: GainNode;       // section dynamics (levels, breakdowns)
  private sweep: FilterSwitch;   // the breakdown low-pass, only in the path during a breakdown
  private sweepEnd = Infinity;
  private sends: GainNode;       // reverb send bus, post-fader (follows fade())
  private delayIn: GainNode | null = null;
  private delayLine: DelayNode | null = null;
  private tremolo: OscillatorNode | null = null;
  private tempo: number;
  private owned: AudioScheduledSourceNode[] = [];
  private gates: Gate[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null;
  private kit: DrumKit | null = null;
  private slap: SlapBass | null = null;
  private ep: SampledKeys | null = null;
  private clavi: Clav | null = null;
  private horns: SampledBrass | null = null;
  private strings: SampledPad | null = null;
  private leads = new Map<string, Lead>();
  private lfos = new Map<number, OscillatorNode>();
  private sendGains = new Map<string, GainNode>();

  constructor(
    readonly engine: Engine, bpm: number, private mix: Partial<Record<Channel, number>> = {},
    dest: AudioNode = engine.musicIn, readonly rng: Rng = new Rng(0xba4d),
  ) {
    const ctx = engine.ctx;
    this.ctx = ctx;
    this.tempo = bpm;
    this.out = new GainNode(ctx, { gain: 0 });
    this.shape = new GainNode(ctx, { gain: 1 });
    this.sweep = new FilterSwitch(this.out, filter(ctx, { type: 'lowpass', frequency: BREAK_LP, Q: 1.2 }), this.shape);
    this.hp = filter(ctx, { type: 'highpass', frequency: 18, Q: 0.7 });
    this.bassDrop = new FilterSwitch(this.shape, this.hp, dest);
    this.sc = new GainNode(ctx, { gain: 1 });
    this.sc.connect(this.out);
    this.under = new GainNode(ctx, { gain: 1 });
    this.under.connect(this.sc);
    this.underFree = new GainNode(ctx, { gain: 1 });
    this.underFree.connect(this.out);
    this.sends = new GainNode(ctx, { gain: 0 });
    this.sends.connect(engine.musicVerb);
  }

  /** Channel input for instrument voices (strip created on first use). */
  input(ch: Channel): AudioNode {
    return this.strip(ch);
  }

  /** Shared looping white noise for every noise-based voice in this band. */
  get noise(): AudioNode {
    if (!this.noiseSrc) {
      this.noiseSrc = noise(this.ctx, 'white', this.ctx.currentTime, null, this.rng);
      this.own(this.noiseSrc);
    }
    return this.noiseSrc;
  }

  private strip(ch: Channel): GainNode {
    const hit = this.strips.get(ch);
    if (hit) return hit;
    const ctx = this.ctx;
    const level = DEFAULT_MIX[ch] * (this.mix[ch] ?? 1);
    // Without a drive insert the input node is the fader itself (one node less per channel).
    const driven = ch === 'bass' || ch === 'lead';
    const input = new GainNode(ctx, { gain: driven ? 1 : level });
    let head: AudioNode = input;
    if (driven) {
      head = head.connect(new WaveShaperNode(ctx, { curve: driveCurve(ch === 'bass' ? 1.3 : 2.2), oversample: 'none' }));
      head = head.connect(new GainNode(ctx, { gain: level }));
    }
    if (ch === 'keys') {
      // 8th-note auto-pan, the classic suitcase-piano tremolo.
      const pan = new StereoPannerNode(ctx, { pan: 0 });
      pan.pan.automationRate = 'k-rate';
      const lfo = new OscillatorNode(ctx, { type: 'sine', frequency: this.tempo / 30 });
      lfo.connect(new GainNode(ctx, { gain: 0.85 })).connect(pan.pan);
      lfo.start(ctx.currentTime);
      this.own(lfo);
      this.tremolo = lfo;
      head = head.connect(pan);
    }
    const dest = UNDER_LEAD.has(ch) ? (DUCKED.has(ch) ? this.under : this.underFree) : DUCKED.has(ch) ? this.sc : this.out;
    const pan = (x: number): StereoPannerNode => new StereoPannerNode(ctx, { pan: x });
    const side = PAN[ch];
    (side === undefined ? head : head.connect(pan(side))).connect(dest);
    if (VERB[ch] > 0) head.connect(this.send('verb', VERB[ch]));
    if (DELAY[ch] > 0) head.connect(this.send('delay', DELAY[ch]));
    this.strips.set(ch, input);
    return input;
  }

  /** The shared send gain for `level` into the reverb or the delay. */
  private send(kind: 'verb' | 'delay', level: number): GainNode {
    const key = `${kind}${level}`;
    let g = this.sendGains.get(key);
    if (!g) {
      g = new GainNode(this.ctx, { gain: level });
      g.connect(kind === 'verb' ? this.sends : this.delay());
      this.sendGains.set(key, g);
    }
    return g;
  }

  /** Dotted-8th feedback delay (band-passed repeats), created with the first strip that sends. */
  private delay(): AudioNode {
    if (this.delayIn) return this.delayIn;
    const ctx = this.ctx;
    const d = new DelayNode(ctx, { delayTime: (60 / this.tempo) * 0.75, maxDelayTime: 2 });
    this.delayLine = d;
    const fb = new GainNode(ctx, { gain: 0.32 });
    const tone = filter(ctx, { type: 'bandpass', frequency: 1600, Q: 0.5 });
    this.delayIn = new GainNode(ctx, { gain: 1 });
    this.delayIn.connect(d).connect(tone).connect(fb).connect(d);
    tone.connect(this.out);
    return this.delayIn;
  }

  /** Instruments are created on first use, so a band only runs the voices its song needs. */
  get drums(): DrumKit {
    return (this.kit ??= new DrumKit(this));
  }

  get bass(): SlapBass {
    return (this.slap ??= new SlapBass(this));
  }

  get keys(): SampledKeys {
    return (this.ep ??= new SampledKeys(this));
  }

  get clav(): Clav {
    return (this.clavi ??= new Clav(this));
  }

  get brass(): SampledBrass {
    return (this.horns ??= new SampledBrass(this));
  }

  get pad(): SampledPad {
    return (this.strings ??= new SampledPad(this));
  }

  lead(voice: LeadVoice, slot = 0): Lead {
    const key = `${voice}${slot}`;
    let l = this.leads.get(key);
    if (!l) {
      l = new Lead(this, voice);
      this.leads.set(key, l);
    }
    return l;
  }

  /** One shared vibrato LFO per rate (each lead scales it with its own depth gain). */
  lfo(rate: number): OscillatorNode {
    let o = this.lfos.get(rate);
    if (!o) {
      o = osc(this, 'sine', rate);
      this.lfos.set(rate, o);
    }
    return o;
  }

  /** A sleep gate for a persistent voice's output (see Gate). */
  gate(out: AudioNode, dest: AudioNode): Gate {
    const g = new Gate(out, dest);
    this.gates.push(g);
    return g;
  }

  /** Section dynamics from `t` (bars of `bar` s): the section's level, and the breakdown filter sweep. */
  section(t: number, bar: number, gainDb: number, shape: 'breakdown' | undefined): void {
    const g = this.shape.gain;
    const level = Math.pow(10, gainDb / 20);
    anchor(g, t);
    if (shape !== 'breakdown') {
      g.linearRampToValueAtTime(level, t + 0.12);
      settle(g, t + 0.12, level);
      if (this.sweep.engaged) this.sweep.set(false, t);
      this.sweepEnd = Infinity;
      return;
    }
    // Bars 1–4 down and filtered; bars 5–8 climb back bar by bar (even steps in dB) as the filter opens.
    const at = (k: number): number => t + k * bar;
    g.linearRampToValueAtTime(level * Math.pow(10, BREAK_DB / 20), t + 0.12);
    g.setValueAtTime(level * Math.pow(10, BREAK_DB / 20), at(4));
    for (let k = 1; k <= 4; k++) g.linearRampToValueAtTime(level * Math.pow(10, (BREAK_DB + ((BUILD_TOP_DB - BREAK_DB) * k) / 4) / 20), at(4 + k));
    settle(g, at(8), level * Math.pow(10, BUILD_TOP_DB / 20));
    const f = this.sweep.filter.frequency;
    holdAt(f, t);
    f.setValueAtTime(BREAK_LP, t);
    f.setValueAtTime(BREAK_LP, at(4));
    f.exponentialRampToValueAtTime(Math.min(14000, this.ctx.sampleRate * 0.45), at(8));
    this.sweep.set(true, t);
    this.sweepEnd = at(8);
  }

  /** Unplug voices that have finished sounding (called from the scheduler). */
  tick(now: number): void {
    for (const g of this.gates) g.sleep(now);
    if (now >= this.sweepEnd) {
      this.sweep.set(false, now);
      this.sweepEnd = Infinity;
    }
    this.sweep.tick(now);
    if (now >= this.dropClear) {
      this.bassDrop.set(false, now);
      this.dropClear = Infinity;
    }
    this.bassDrop.tick(now);
  }

  /** Register a persistent source; it stops when the band is disposed. */
  own(src: AudioScheduledSourceNode): void {
    this.owned.push(src);
  }

  /** Kick side-chain: dip the sustained instruments for a beat fraction. */
  duck(t: number, amount: number): void {
    // setTarget starts from whatever the gain is at t (a ramp would start at the previous event).
    const g = this.sc.gain;
    holdAt(g, t);
    g.setTargetAtTime(1 - amount, t, 0.003);
    g.setTargetAtTime(1, t + 0.03, 0.06);
  }

  /** A lead note from `t` for `dur` s: the comping parts dip under it, then come back. */
  underLead(t: number, dur: number): void {
    for (const g of [this.under.gain, this.underFree.gain]) {
      holdAt(g, t);
      g.setTargetAtTime(UNDER_LEAD_GAIN, t, 0.01);
      g.setTargetAtTime(1, t + Math.max(0.03, dur), 0.18);
    }
  }

  /** Linear fade from the level the band has at `at` (not from the previous fade's end time). */
  fade(to: number, seconds: number, at = this.ctx.currentTime): void {
    const end = at + Math.max(0.01, seconds);
    for (const g of [this.out.gain, this.sends.gain]) {
      anchor(g, at);
      g.linearRampToValueAtTime(to, end);
      settle(g, end, to);
    }
  }

  /** KO: high-pass the band (kick + bass vanish), 0 = full range; `tau` = response time constant. */
  dropBass(amount: number, tau = 0.05): void {
    const a = Math.min(1, Math.max(0, amount));
    const now = this.ctx.currentTime;
    if (a > 0) {
      this.dropClear = Infinity;
      this.bassDrop.set(true, now);
    } else if (this.bassDrop.engaged) {
      // Unplug once the cutoff has glided back down (5 time constants).
      this.dropClear = now + Math.max(0.1, tau * 5);
    }
    steer(this.hp.frequency, now, 18 + 340 * a, tau);
  }

  /** Tempo change (final-stretch lift): the dotted-8th delay and the keys tremolo follow. */
  setTempo(bpm: number, at: number): void {
    this.tempo = bpm;
    this.delayLine?.delayTime.setValueAtTime((60 / bpm) * 0.75, at);
    this.tremolo?.frequency.setValueAtTime(bpm / 30, at);
  }

  dispose(at: number): void {
    const last = this.owned[0];
    for (const src of this.owned) src.stop(at);
    this.owned = [];
    const unplug = (): void => {
      this.out.disconnect();
      this.sends.disconnect();
    };
    if (last) last.onended = unplug;
    else unplug();
  }
}
