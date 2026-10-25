// A Band is one song's mixer: per-instrument channel strips (gain → pan → sends), a tempo-synced
// delay, keys tremolo, bass grit, kick side-chain ducking, section dynamics and a bass-drop
// high-pass for KO slow-mo. Each SongPlayer owns a Band, so crossfades and stingers never fight
// over the same nodes. Strips, instruments and the shared noise source are created on first use:
// a band only runs the nodes its song actually needs (CPU). The same code also plays inside a bar
// render (music/bars.ts, an OfflineAudioContext); the result enters the song's realtime band at
// `out`:  strips → sum → [breakdown low-pass] → section shape → out (fade) → [KO high-pass] → dest.
import { Rng } from '../../core/rng';
import { driveCurve } from '../dsp/curves';
import { anchor, filter, holdAt, settle, steer } from '../dsp/env';
import { noise } from '../dsp/noise';
import { FilterSwitch } from '../dsp/switch';
import { dottedDelay, haasPair } from './band-fx';
import { Brass } from './instruments/brass';
import { DrumKit } from './instruments/drums';
import { SampledBass } from './instruments/bass-sampler';
import { SampledClav } from './instruments/clav-sampler';
import { SampledPad } from './instruments/pad-sampler';
import { SampledKeys } from './instruments/keys-sampler';
import { Lead } from './instruments/lead';
import { Gate, osc } from './instruments/voice';
import type { Channel, LeadVoice } from './types';

/** Where a band plays: its context, the music bus and the reverb send (the Engine, or a bar render's own graph). */
export interface MusicHost {
  readonly ctx: BaseAudioContext;
  readonly musicIn: AudioNode;
  readonly musicVerb: AudioNode;
}

// Balanced by spectrum (audio-check tone gates): kick + bass own 40–120 Hz, keys + pad the warm bed, the hook clears it.
const DEFAULT_MIX: Record<Channel, number> = {
  drums: 0.8, bass: 0.6, keys: 1.18, clav: 2.4, brass: 1.05, lead: 0.375, pad: 1.15, fx: 0.6,
};
// Send levels come in a few shared values: channels with the same level feed one send gain.
const VERB: Record<Channel, number> = { drums: 0.15, bass: 0, keys: 0.29, clav: 0.15, brass: 0.29, lead: 0.38, pad: 0.4, fx: 0.29 };
const DELAY: Record<Channel, number> = { drums: 0, bass: 0, keys: 0.09, clav: 0.09, brass: 0.09, lead: 0.22, pad: 0, fx: 0.09 };
/** Haas width sends (band-fx.ts): the lead and the horns spread without leaving the centre. */
const WIDTH: Partial<Record<Channel, number>> = { lead: 0.22, brass: 0.22 };
const DUCKED = new Set<Channel>(['bass', 'keys', 'pad', 'clav']);
/** Comping parts and horns step back (−7.5 dB) while the lead plays, so the hook sits on top. */
const UNDER_LEAD = new Set<Channel>(['keys', 'pad', 'clav', 'brass']);
const UNDER_LEAD_GAIN = 0.42;
/** A static dip in the comping bed where the hooks live (0.7–2 kHz). */
const BED_DIP = { f: 1100, q: 0.9, db: -4 };
/** Stereo image: the pad bakes its spread into its pre-mixed chords, the keys auto-pan, the horns
 *  sit right and the clav left, the drums are stereo samples, the reverb is decorrelated. */
const PAN: Partial<Record<Channel, number>> = { clav: -0.55, brass: 0.4 };
/** Breakdown: bars 1–4 BREAK_DB down (deep: the pad bed carries it) behind a BREAK_LP low-pass; the build climbs to BUILD_TOP_DB. */
const BREAK_DB = -8, BUILD_TOP_DB = 2, BREAK_LP = 900;

/** Section level (gain) at the end of a section: a breakdown ends on its build's top. */
export function sectionEnd(gainDb: number, shape: 'breakdown' | undefined): number {
  return Math.pow(10, (gainDb + (shape === 'breakdown' ? BUILD_TOP_DB : 0)) / 20);
}

export class Band {
  readonly ctx: BaseAudioContext;
  /** The fader (crossfades, levels, stop): pre-rendered bars play into it. */
  readonly out: GainNode;
  private sum: GainNode;         // every strip and the effect returns, before the section dynamics
  private strips = new Map<Channel, GainNode>();
  /** Each strip's fader (the input, or the gain after a drive) and the trims applied to it. */
  private faders = new Map<Channel, GainNode>();
  private trims = new Map<Channel, number>();
  private sc: GainNode;          // side-chain gain shared by bass / keys / pad / clav
  private under: GainNode;       // lead side-chain for keys / pad / clav (then the kick side-chain)
  private underFree: GainNode;   // lead side-chain for the horns (no kick duck)
  private hp: BiquadFilterNode;  // bass drop
  private bassDrop: FilterSwitch; // the high-pass is only in the path during a KO drop
  private dropClear = Infinity;
  private goneAt = Infinity;     // when dispose() unplugs the band (audio time)
  gone = false;                  // unplugged for good
  private shape: GainNode;       // section dynamics (levels, breakdowns)
  private sweep: FilterSwitch;   // the breakdown low-pass, only in the path during a breakdown
  private sweepEnd = Infinity;
  private sends: GainNode;       // reverb send bus, post-fader (follows fade())
  private live = true;           // the instrument graph is plugged in (setLive)
  private delayIn: GainNode | null = null;
  private delayLine: DelayNode | null = null;
  private widthIn: GainNode | null = null;
  private tremolo: OscillatorNode | null = null;
  private tempo: number;
  private owned: AudioScheduledSourceNode[] = [];
  private gates: Gate[] = [];
  private noiseSrc: AudioBufferSourceNode | null = null;
  private kit: DrumKit | null = null;
  private slap: SampledBass | null = null;
  private ep: SampledKeys | null = null;
  private clavi: SampledClav | null = null;
  private horns: Brass | null = null;
  private strings: SampledPad | null = null;
  private leads = new Map<string, Lead>();
  private lfos = new Map<number, OscillatorNode>();
  private sendGains = new Map<string, GainNode>();

  constructor(
    private host: MusicHost, bpm: number, private mix: Partial<Record<Channel, number>> = {},
    dest: AudioNode = host.musicIn, readonly rng: Rng = new Rng(0xba4d),
  ) {
    const ctx = host.ctx;
    this.ctx = ctx;
    this.tempo = bpm;
    this.sum = new GainNode(ctx, { gain: 1 });
    this.shape = new GainNode(ctx, { gain: 1 });
    this.sweep = new FilterSwitch(this.sum, filter(ctx, { type: 'lowpass', frequency: BREAK_LP, Q: 1.2 }), this.shape);
    this.out = new GainNode(ctx, { gain: 0 });
    this.shape.connect(this.out);
    this.hp = filter(ctx, { type: 'highpass', frequency: 18, Q: 0.7 });
    this.bassDrop = new FilterSwitch(this.out, this.hp, dest);
    this.sc = new GainNode(ctx, { gain: 1 });
    this.sc.connect(this.sum);
    this.under = new GainNode(ctx, { gain: 1 });
    // The comping bed (keys, pad, clav) leaves the hook's band a little room: warmth below, not on it.
    this.under.connect(filter(ctx, { type: 'peaking', frequency: BED_DIP.f, Q: BED_DIP.q, gain: BED_DIP.db })).connect(this.sc);
    this.underFree = new GainNode(ctx, { gain: 1 });
    this.underFree.connect(this.sum);
    this.sends = new GainNode(ctx, { gain: 0 });
    this.sends.connect(host.musicVerb);
  }

  /** A bar render's band: fader and sends open from the first sample (no fade-in), section level `level`. */
  open(level: number): void {
    this.out.gain.value = 1;
    this.sends.gain.value = 1;
    this.shape.gain.value = level;
  }

  /**
   * Plug the instrument graph in or out. While a song plays pre-rendered bars, its live strips,
   * voices, LFOs and delay loop are unplugged: the audio thread no longer renders any of them.
   */
  setLive(on: boolean): void {
    if (on === this.live) return;
    this.live = on;
    this.sweep.attach(on);
    if (on) this.sends.connect(this.host.musicVerb);
    else this.sends.disconnect();
  }

  /** A channel's fader level (the default mix × the song's trim). */
  level(ch: Channel): number {
    return DEFAULT_MIX[ch] * (this.mix[ch] ?? 1);
  }

  /** Trim a channel's fader by `gain` from `at` (60 ms move), e.g. the lead in the final stretch. */
  trim(ch: Channel, gain: number, at: number): void {
    if ((this.trims.get(ch) ?? 1) === gain) return;
    this.trims.set(ch, gain);
    const f = this.faders.get(ch)?.gain;
    if (!f) return;
    anchor(f, at);
    f.linearRampToValueAtTime(this.level(ch) * gain, at + 0.06);
    settle(f, at + 0.06, this.level(ch) * gain);
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
    const level = this.level(ch);
    // Without a drive insert the input node is the fader itself (one node less per channel).
    const driven = ch === 'bass' || ch === 'lead';
    const trimmed = level * (this.trims.get(ch) ?? 1);
    const input = new GainNode(ctx, { gain: driven ? 1 : trimmed });
    let head: AudioNode = input;
    if (driven) {
      head = head.connect(new WaveShaperNode(ctx, { curve: driveCurve(ch === 'bass' ? 1.3 : 2.2), oversample: 'none' }));
      head = head.connect(new GainNode(ctx, { gain: trimmed }));
    }
    this.faders.set(ch, head as GainNode);
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
    const dest = UNDER_LEAD.has(ch) ? (DUCKED.has(ch) ? this.under : this.underFree) : DUCKED.has(ch) ? this.sc : this.sum;
    const pan = (x: number): StereoPannerNode => new StereoPannerNode(ctx, { pan: x });
    const side = PAN[ch];
    (side === undefined ? head : head.connect(pan(side))).connect(dest);
    if (VERB[ch] > 0) head.connect(this.send('verb', VERB[ch]));
    if (DELAY[ch] > 0) head.connect(this.send('delay', DELAY[ch]));
    const width = WIDTH[ch];
    if (width) head.connect(this.send('width', width));
    this.strips.set(ch, input);
    return input;
  }

  /** The shared send gain for `level` into the reverb or the delay. */
  private send(kind: 'verb' | 'delay' | 'width', level: number): GainNode {
    const key = `${kind}${level}`;
    let g = this.sendGains.get(key);
    if (!g) {
      g = new GainNode(this.ctx, { gain: level });
      g.connect(kind === 'verb' ? this.sends : kind === 'delay' ? this.delay() : (this.widthIn ??= haasPair(this.ctx, this.sum)));
      this.sendGains.set(key, g);
    }
    return g;
  }

  /** The dotted-8th delay (band-fx.ts), created with the first strip that sends. */
  private delay(): AudioNode {
    if (this.delayIn) return this.delayIn;
    const { input, line } = dottedDelay(this.ctx, this.tempo, this.sum);
    this.delayLine = line;
    return (this.delayIn = input);
  }

  /** Instruments are created on first use, so a band only runs the voices its song needs. */
  get drums(): DrumKit {
    return (this.kit ??= new DrumKit(this));
  }

  get bass(): SampledBass {
    return (this.slap ??= new SampledBass(this));
  }

  get keys(): SampledKeys {
    return (this.ep ??= new SampledKeys(this));
  }

  get clav(): SampledClav {
    return (this.clavi ??= new SampledClav(this));
  }

  get brass(): Brass {
    return (this.horns ??= new Brass(this));
  }

  get pad(): SampledPad {
    return (this.strings ??= new SampledPad(this));
  }

  /** A lead voice; `prev` = the last note it played before this band existed (a bar render's legato). */
  lead(voice: LeadVoice, slot = 0, prev?: { midi: number; end: number }): Lead {
    const key = `${voice}${slot}`;
    let l = this.leads.get(key);
    if (!l) {
      l = new Lead(this, voice);
      if (prev) l.follow(prev.midi, prev.end);
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

  /**
   * Section dynamics from `t` (bars of `bar` s): the section's level, and the breakdown filter
   * sweep. `from` > 0 = start at that bar of the section (a bar render), at its level at once.
   */
  section(t: number, bar: number, gainDb: number, shape: 'breakdown' | undefined, from = 0): void {
    const g = this.shape.gain;
    const level = Math.pow(10, gainDb / 20);
    const enter = from === 0;
    anchor(g, t);
    if (shape !== 'breakdown') {
      if (enter) g.linearRampToValueAtTime(level, t + 0.12);
      else g.setValueAtTime(level, t);
      settle(g, enter ? t + 0.12 : t, level);
      if (this.sweep.engaged) this.sweep.set(false, t);
      this.sweepEnd = Infinity;
      return;
    }
    // Bars 1–4 down and filtered; bars 5–8 climb back bar by bar (even steps in dB) as the filter opens.
    const at = (k: number): number => t + (k - from) * bar;
    const v = (k: number): number => level * Math.pow(10, (k <= 4 ? BREAK_DB : BREAK_DB + ((BUILD_TOP_DB - BREAK_DB) * (k - 4)) / 4) / 20);
    if (enter) g.linearRampToValueAtTime(v(0), t + 0.12);
    else g.setValueAtTime(v(from), t);
    if (from < 4) g.setValueAtTime(v(4), at(4));
    for (let k = Math.max(5, from + 1); k <= 8; k++) g.linearRampToValueAtTime(v(k), at(k));
    settle(g, at(8), v(8));
    const f = this.sweep.filter.frequency;
    const top = Math.min(14000, this.ctx.sampleRate * 0.45);
    holdAt(f, t);
    f.setValueAtTime(from <= 4 ? BREAK_LP : BREAK_LP * Math.pow(top / BREAK_LP, (from - 4) / 4), t);
    if (from < 4) f.setValueAtTime(BREAK_LP, at(4));
    f.exponentialRampToValueAtTime(top, at(8));
    this.sweep.set(true, t, !enter);
    this.sweepEnd = at(8);
  }

  /** Unplug voices that have finished sounding (called from the scheduler). */
  tick(now: number): void {
    if (now >= this.goneAt && !this.gone) {
      this.gone = true;
      this.out.disconnect();
      this.sends.disconnect();
      this.bassDrop.disconnect();
    }
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

  /** Stop every source at `at`; the next tick() from then on unplugs the band. */
  dispose(at: number): void {
    for (const src of this.owned) src.stop(at);
    this.owned = [];
    this.goneAt = at;
  }
}
