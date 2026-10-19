// Sampled slap bass: the live voice's tone through its plucked resonant low-pass and envelope, with
// its string transient baked in (bass.ts), rendered per pitch zone and articulation (plain / thumb
// / pop, plus dead ghost notes; bank.ts). Each note is pre-mixed at rate 1 with its release and any
// slide baked in (premix.ts) and plays as one buffer source + gain; the gain closes the previous
// note in 6 ms at the next onset, so the line stays monophonic like the live voice. Before the
// banks exist, and for notes outside them or held longer, the live voice plays.
import { midiToHz } from '../theory';
import {
  BASS_RELEASE, BASS_SLIDE, BASS_SLIDE_FROM, SlapBass, bassAmp, bassDead, bassFilter, bassTransient, bassWave, type BassNote,
} from './bass';
import { bankOf, prepareBank, zoneOf, type BankSpec } from './bank';
import { playSample } from './drum-samples';
import { premix, type MixNote } from './premix';
import { filter } from '../../dsp/env';
import type { Band } from '../band';

const HELD = 1.5;
const VEL = 0.92;
const DEAD_VEL = 0.85;

/** One note of the live voice (tone → low-pass → VCA, transient beside it) into `dest`. */
function voice(b: Band, dest: AudioNode, midi: number): { o: OscillatorNode; lp: BiquadFilterNode; amp: GainNode } {
  const ctx = b.ctx;
  const o = new OscillatorNode(ctx, { frequency: midiToHz(midi) });
  o.setPeriodicWave(bassWave(ctx));
  const lp = filter(ctx, { type: 'lowpass', frequency: 400, Q: 5 });
  const amp = new GainNode(ctx, { gain: 0 });
  o.connect(lp).connect(amp).connect(dest);
  return { o, lp, amp };
}

const TONE: BankSpec = {
  id: 'bass', low: 26, step: 4, count: 11, vels: [VEL], variants: 3, held: HELD, tail: 0.1,
  play(b, dest, t, midi, vel, variant) {
    const n: BassNote = { midi, dur: HELD, vel, pop: variant === 2, accent: variant === 1, slide: false };
    const v = voice(b, dest, midi);
    bassFilter(v.lp.frequency, v.lp.Q, t, n);
    const end = bassAmp(v.amp.gain, t, n);
    v.o.start(t);
    v.o.stop(end + 0.01);
    const click = bassTransient(n);
    if (click) playSample(b.ctx, click[0], 0, t, click[1], dest);
  },
};

const DEAD: BankSpec = {
  id: 'bassDead', low: 26, step: 4, count: 11, vels: [DEAD_VEL], variants: 1, held: 0.05, tail: 0.1,
  play(b, dest, t, midi, vel) {
    const v = voice(b, dest, midi);
    const end = bassDead(v.lp.frequency, v.amp.gain, t, vel);
    v.o.start(t);
    v.o.stop(end + 0.01);
    playSample(b.ctx, 'slapDead', 0, t, 0.1 * vel, dest);
  },
};

export function prepareBassSamples(sampleRate: number): Promise<void> {
  return Promise.all([prepareBank(TONE, sampleRate), prepareBank(DEAD, sampleRate)]).then(() => undefined);
}

export class SampledBass {
  private live: SlapBass | null = null;
  /** The sounding note (closed at the next onset). */
  private last: { src: AudioBufferSourceNode; gain: GainNode; end: number } | null = null;

  constructor(private b: Band) {}

  note(t: number, n: BassNote): void {
    const bank = bankOf(TONE, this.b.ctx.sampleRate);
    const z = zoneOf(TONE, n.midi);
    const buf = z ? bank?.[n.pop ? 2 : n.accent ? 1 : 0]?.[0]?.[z.zone] : undefined;
    if (!z || !buf || n.dur > HELD) {
      this.liveVoice(t).note(t, n);
      return;
    }
    const bend = n.slide ? { from: Math.pow(2, BASS_SLIDE_FROM / 12), time: BASS_SLIDE } : undefined;
    this.play(t, { buf, rate: z.rate, gain: n.vel / VEL, pan: 0, bend }, n.dur, BASS_RELEASE);
  }

  /** Muted ghost note. */
  dead(t: number, midi: number, vel: number): void {
    const bank = bankOf(DEAD, this.b.ctx.sampleRate);
    const z = zoneOf(DEAD, midi);
    const buf = z ? bank?.[0]?.[0]?.[z.zone] : undefined;
    if (!z || !buf) {
      this.liveVoice(t).dead(t, midi, vel);
      return;
    }
    this.play(t, { buf, rate: z.rate, gain: vel / DEAD_VEL, pan: 0 }, 0.05, 0.1);
  }

  /** The live voice takes over (no bank yet / out of range): the sampled note sounding stops first. */
  private liveVoice(t: number): SlapBass {
    this.close(t);
    return (this.live ??= new SlapBass(this.b));
  }

  private play(t: number, note: MixNote, off: number, release: number): void {
    this.close(t);
    const ctx = this.b.ctx;
    const buffer = premix([note], { off, release }, ctx.sampleRate);
    const src = new AudioBufferSourceNode(ctx, { buffer });
    const gain = new GainNode(ctx, { gain: 1 });
    src.connect(gain).connect(this.b.input('bass'));
    src.start(t);
    this.last = { src, gain, end: t + buffer.duration };
  }

  /** Close the sounding note in the 6 ms from `t` (monophonic, like the string being re-plucked). */
  private close(t: number): void {
    const last = this.last;
    this.last = null;
    if (!last || last.end <= t) return;
    last.gain.gain.setValueAtTime(1, t);
    last.gain.gain.linearRampToValueAtTime(0, t + 0.006);
    last.src.stop(t + 0.008);
  }
}
