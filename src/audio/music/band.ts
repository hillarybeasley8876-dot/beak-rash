// A Band is one song's mixer: per-instrument channel strips (gain → pan → sends), a tempo-synced
// delay, keys tremolo, bass grit, kick side-chain ducking and a bass-drop high-pass for KO slow-mo.
// Each SongPlayer owns a Band, so crossfades and stingers never fight over the same nodes.
// Strips, instruments and the shared noise source are created on first use: a band only runs
// the nodes its song actually needs (CPU).
import { Rng } from '../../core/rng';
import { driveCurve } from '../dsp/curves';
import { filter, holdAt, steer } from '../dsp/env';
import { noise } from '../dsp/noise';
import { Brass } from './instruments/brass';
import { DrumKit } from './instruments/drums';
import { SlapBass } from './instruments/bass';
import { Clav, Pad, Rhodes } from './instruments/keys';
import { Lead } from './instruments/lead';
import { Gate } from './instruments/voice';
import type { Engine } from '../engine';
import type { Channel, LeadVoice } from './types';

interface Strip {
  input: GainNode;
  trim: GainNode;
}

// Melody on top: lead hooks ≈ −5 LU under the full mix, bass ≈ −8, drums ≈ −3 (audio-check stems).
const DEFAULT_MIX: Record<Channel, number> = {
  drums: 0.8, bass: 0.6, keys: 0.8, clav: 1.7, brass: 0.84, lead: 1.0, pad: 0.62, fx: 0.6,
};
const VERB: Record<Channel, number> = { drums: 0.12, bass: 0, keys: 0.28, clav: 0.1, brass: 0.3, lead: 0.26, pad: 0.4, fx: 0.3 };
const DELAY: Record<Channel, number> = { drums: 0, bass: 0, keys: 0.08, clav: 0.12, brass: 0.06, lead: 0.22, pad: 0, fx: 0.1 };
const DUCKED = new Set<Channel>(['bass', 'keys', 'pad', 'clav']);
/** Comping parts that step back (−3.5 dB) while the lead plays, so the hook sits on top. */
const UNDER_LEAD = new Set<Channel>(['keys', 'pad', 'clav']);
const UNDER_LEAD_GAIN = 0.67;

export class Band {
  readonly ctx: BaseAudioContext;
  readonly out: GainNode;
  private strips = new Map<Channel, Strip>();
  private sc: GainNode;          // side-chain gain shared by bass / keys / pad / clav
  private under: GainNode;       // lead side-chain for keys / pad / clav
  private hp: BiquadFilterNode;  // bass drop
  private delayIn: GainNode | null = null;
  private delayLine: DelayNode | null = null;
  private tremolo: OscillatorNode | null = null;
  private tempo: number;
  private owned: AudioScheduledSourceNode[] = [];
  private gates: Gate[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null;
  private kit: DrumKit | null = null;
  private slap: SlapBass | null = null;
  private ep: Rhodes | null = null;
  private clavi: Clav | null = null;
  private horns: Brass | null = null;
  private strings: Pad | null = null;
  private leads = new Map<string, Lead>();

  constructor(
    readonly engine: Engine, bpm: number, private mix: Partial<Record<Channel, number>> = {},
    dest: AudioNode = engine.musicIn, readonly rng: Rng = new Rng(0xba4d),
  ) {
    const ctx = engine.ctx;
    this.ctx = ctx;
    this.tempo = bpm;
    this.out = new GainNode(ctx, { gain: 0 });
    this.hp = filter(ctx, { type: 'highpass', frequency: 18, Q: 0.7 });
    this.out.connect(this.hp).connect(dest);
    this.sc = new GainNode(ctx, { gain: 1 });
    this.sc.connect(this.out);
    this.under = new GainNode(ctx, { gain: 1 });
    this.under.connect(this.sc);
  }

  /** Channel input for instrument voices (strip created on first use). */
  input(ch: Channel): AudioNode {
    return this.strip(ch).input;
  }

  /** Shared looping white noise for every noise-based voice in this band. */
  get noise(): AudioNode {
    if (!this.noiseSrc) {
      this.noiseSrc = noise(this.ctx, 'white', this.ctx.currentTime, null, this.rng);
      this.own(this.noiseSrc);
    }
    return this.noiseSrc;
  }

  private strip(ch: Channel): Strip {
    const hit = this.strips.get(ch);
    if (hit) return hit;
    const ctx = this.ctx;
    const input = new GainNode(ctx, { gain: 1 });
    const trim = new GainNode(ctx, { gain: DEFAULT_MIX[ch] * (this.mix[ch] ?? 1) });
    let head: AudioNode = input;
    if (ch === 'bass' || ch === 'lead') {
      head = head.connect(new WaveShaperNode(ctx, { curve: driveCurve(ch === 'bass' ? 1.3 : 2.2), oversample: 'none' }));
    }
    if (ch === 'bass') {
      // Slap needs its snap: high-pass the rumble, lift the string click / growl.
      head = head.connect(filter(ctx, { type: 'highpass', frequency: 38, Q: 0.6 }))
        .connect(filter(ctx, { type: 'peaking', frequency: 1100, Q: 0.9, gain: 5 }));
    }
    head = head.connect(trim);
    if (ch === 'keys') {
      // 8th-note auto-pan, the classic suitcase-piano tremolo.
      const pan = new StereoPannerNode(ctx, { pan: 0 });
      pan.pan.automationRate = 'k-rate';
      const lfo = new OscillatorNode(ctx, { type: 'sine', frequency: this.tempo / 30 });
      lfo.connect(new GainNode(ctx, { gain: 0.32 })).connect(pan.pan);
      lfo.start(ctx.currentTime);
      this.own(lfo);
      this.tremolo = lfo;
      head = head.connect(pan);
    }
    head.connect(UNDER_LEAD.has(ch) ? this.under : DUCKED.has(ch) ? this.sc : this.out);
    if (VERB[ch] > 0) head.connect(new GainNode(ctx, { gain: VERB[ch] })).connect(this.engine.musicVerb);
    if (DELAY[ch] > 0) head.connect(new GainNode(ctx, { gain: DELAY[ch] })).connect(this.delay());
    const strip = { input, trim };
    this.strips.set(ch, strip);
    return strip;
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

  get keys(): Rhodes {
    return (this.ep ??= new Rhodes(this));
  }

  get clav(): Clav {
    return (this.clavi ??= new Clav(this));
  }

  get brass(): Brass {
    return (this.horns ??= new Brass(this));
  }

  get pad(): Pad {
    return (this.strings ??= new Pad(this));
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

  /** A sleep gate for a persistent voice's output (see Gate). */
  gate(out: AudioNode, dest: AudioNode): Gate {
    const g = new Gate(out, dest);
    this.gates.push(g);
    return g;
  }

  /** Unplug voices that have finished sounding (called from the scheduler). */
  tick(now: number): void {
    for (const g of this.gates) g.sleep(now);
  }

  /** Register a persistent source; it stops when the band is disposed. */
  own(src: AudioScheduledSourceNode): void {
    this.owned.push(src);
  }

  /** Kick side-chain: dip the sustained instruments for a beat fraction. */
  duck(t: number, amount: number): void {
    const g = this.sc.gain;
    holdAt(g, t);
    g.linearRampToValueAtTime(1 - amount, t + 0.008);
    g.setTargetAtTime(1, t + 0.03, 0.06);
  }

  /** A lead note from `t` for `dur` s: the comping parts dip under it, then come back. */
  underLead(t: number, dur: number): void {
    const g = this.under.gain;
    holdAt(g, t);
    g.linearRampToValueAtTime(UNDER_LEAD_GAIN, t + 0.03);
    g.setValueAtTime(UNDER_LEAD_GAIN, t + Math.max(0.03, dur));
    g.setTargetAtTime(1, t + Math.max(0.03, dur), 0.18);
  }

  fade(to: number, seconds: number, at = this.ctx.currentTime): void {
    const g = this.out.gain;
    holdAt(g, at);
    g.linearRampToValueAtTime(to, at + Math.max(0.01, seconds));
  }

  /** KO: high-pass the band (kick + bass vanish), 0 = full range; `tau` = response time constant. */
  dropBass(amount: number, tau = 0.05): void {
    steer(this.hp.frequency, this.ctx.currentTime, 18 + 340 * Math.min(1, Math.max(0, amount)), tau);
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
    if (last) last.onended = () => this.out.disconnect();
    else this.out.disconnect();
  }
}
