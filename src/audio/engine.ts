// The mixing graph shared by music, sfx and voice:
//   musicIn ─(+musicVerb return, delay-line reverb)→ muffle LP → duck → hit duck → music vol ┐
//   stingIn ────────────────────────────────────────────────→ music vol ┤
//   sfxIn   ─(+tunnel verb return)→ muffle LP ──────→ sfx vol         ├→ master vol → glue comp → ×0.5 → soft clip → out
//   voiceIn ───────────────────────────────────────────────→ voice vol ┘
//   impactIn (KO booms) → sfx × master vol ─────────────────────────────────────────→ ×0.5 → soft clip
// "duck" follows the slow-mo / pause muffle and announcer lines; "hit duck" is scheduled with
// 5 ms attacks for stingers and KO impacts. Works on a realtime AudioContext or an
// OfflineAudioContext (audio-check renders).
import { softClipCurve, impulseResponse } from './dsp/curves';
import { filter, holdAt, steer } from './dsp/env';
import { createReverb } from './dsp/reverb';

export interface Volumes { master: number; music: number; sfx: number; voice: number }

/**
 * Context sample rate. 32 kHz keeps everything audible (16 kHz bandwidth) while cutting the
 * audio thread's work by a third versus 48 kHz; the browser resamples to the device rate.
 */
export const AUDIO_RATE = 32000;

const MUSIC_LP_MIN = 360;   // Hz at full muffle (slow-mo / pause)
const SFX_LP_MIN = 2200;
const DUCK_ATTACK = 0.005;
const DUCK_RELEASE = 0.12;  // s time constant back to unity

export class Engine {
  readonly musicIn: GainNode;
  readonly sfxIn: GainNode;
  readonly voiceIn: GainNode;
  /** Stingers: music volume, but past the muffle / duck so KO and SHOWTIME hits cut through. */
  readonly stingIn: GainNode;
  /** Sub-heavy impacts (KO booms): after the glue compressor, so its gain riding never flattens them. */
  readonly impactIn: GainNode;
  private impactVol: GainNode;
  private levels: Volumes = { master: 1, music: 1, sfx: 1, voice: 1 };
  /** Reverb sends (post-fader returns land before the muffle filter, so tails muffle too). */
  readonly musicVerb: GainNode;
  readonly sfxVerb: GainNode;
  readonly output: AudioNode;
  private musicLP: BiquadFilterNode;
  private sfxLP: BiquadFilterNode;
  private musicDuck: GainNode;
  private hitDuck: GainNode;
  private sfxDuck: GainNode;
  private sfxSpace: GainNode;
  private sfxConv: ConvolverNode | null = null;
  private vol: Record<keyof Volumes, GainNode>;
  private muffle = 0;
  private voiceDuck = 0;
  private duckEnd = 0;
  private duckGain = 1;
  /** Fully open low-pass cutoff (just under Nyquist: 32 kHz contexts top out at 16 kHz). */
  private open: number;

  /** `glue: false` = no master compression (analysis renders whose stems must add up). */
  constructor(readonly ctx: BaseAudioContext, volumes: Volumes, opts: { glue?: boolean } = {}) {
    const g = (v = 1): GainNode => new GainNode(ctx, { gain: v });
    this.open = Math.min(20000, ctx.sampleRate * 0.49);
    this.musicIn = g();
    this.sfxIn = g();
    this.voiceIn = g();
    this.stingIn = g();
    this.impactIn = g();
    this.impactVol = g();
    this.musicVerb = g();
    this.sfxVerb = g();
    this.musicLP = filter(ctx, { type: 'lowpass', frequency: this.open, Q: 0.9 });
    this.sfxLP = filter(ctx, { type: 'lowpass', frequency: this.open, Q: 0.7 });
    this.musicDuck = g();
    this.hitDuck = g();
    this.sfxDuck = g();
    this.vol = { master: g(), music: g(), sfx: g(), voice: g() };

    // Stereo delay-line reverb, RT60 ≈ 1.1 s (decay and level matched to the former convolution
    // plate, at a fraction of its audio-thread cost; left / right decorrelated).
    const verb = createReverb(ctx, 1.1, { preDelay: 0.018, damp: 4200, level: 0.07 });
    this.musicVerb.connect(verb.input);
    verb.output.connect(this.musicLP);
    // Open road = dry sfx; the tunnel reverb is built on first use (setSfxSpace).
    this.sfxSpace = g(0);
    this.sfxVerb.connect(this.sfxSpace);

    this.musicIn.connect(this.musicLP).connect(this.musicDuck).connect(this.hitDuck).connect(this.vol.music).connect(this.vol.master);
    this.sfxIn.connect(this.sfxLP).connect(this.sfxDuck).connect(this.vol.sfx).connect(this.vol.master);
    this.voiceIn.connect(this.vol.voice).connect(this.vol.master);
    this.stingIn.connect(this.vol.music);

    const comp = opts.glue === false
      ? new GainNode(ctx, { gain: 1 })
      : new DynamicsCompressorNode(ctx, { threshold: -14, knee: 10, ratio: 3.2, attack: 0.004, release: 0.22 });
    const pre = g(0.5);
    const clip = new WaveShaperNode(ctx, { curve: softClipCurve(0.88, 0.6), oversample: 'none' });
    this.vol.master.connect(comp).connect(pre).connect(clip).connect(ctx.destination);
    this.impactIn.connect(this.impactVol).connect(pre);
    this.output = clip;
    this.setVolumes(volumes);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Slider values 0..1 → perceptual gain (squared). */
  setVolumes(v: Partial<Volumes>): void {
    for (const key of Object.keys(this.vol) as Array<keyof Volumes>) {
      const value = v[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const x = Math.min(1, Math.max(0, value));
      this.levels[key] = x * x;
      steer(this.vol[key].gain, this.now, x * x, 0.03);
    }
    steer(this.impactVol.gain, this.now, this.levels.sfx * this.levels.master, 0.03);
  }

  /** 0 = clear, 1 = slow-mo / pause: music low-passed hard and ducked, sfx dulled a little. */
  setMuffle(amount: number): void {
    const m = Math.min(1, Math.max(0, amount));
    if (Math.abs(m - this.muffle) < 0.004) return;
    this.muffle = m;
    const shaped = Math.pow(m, 0.75);
    steer(this.musicLP.frequency, this.now, this.open * Math.pow(MUSIC_LP_MIN / this.open, shaped), 0.07);
    steer(this.sfxLP.frequency, this.now, this.open * Math.pow(SFX_LP_MIN / this.open, shaped * 0.85), 0.07);
    this.applyDuck();
  }

  get muffled(): number {
    return this.muffle;
  }

  /** Announcer lines duck the music (≈ −8 dB) and the sfx slightly while they play. */
  setVoiceDuck(amount: number): void {
    const v = Math.min(1, Math.max(0, amount));
    if (Math.abs(v - this.voiceDuck) < 0.01) return;
    this.voiceDuck = v;
    this.applyDuck();
  }

  /**
   * Scheduled music duck: down to `depthDb` within 5 ms at `at`, held for `hold` s, then back.
   * Overlapping ducks merge (deepest level, latest end). Stingers and KO impacts use it.
   */
  duckMusic(at: number, depthDb: number, hold: number): void {
    const g = this.hitDuck.gain;
    const start = Math.max(at, this.now);
    const active = start < this.duckEnd;
    const level = Math.min(active ? this.duckGain : 1, Math.pow(10, depthDb / 20));
    const end = Math.max(start + hold, active ? this.duckEnd : 0);
    // Exponential approaches start from the gain at their own time, whatever came before.
    holdAt(g, start);
    g.setTargetAtTime(level, start, DUCK_ATTACK / 3);
    g.setTargetAtTime(1, end, DUCK_RELEASE);
    this.duckEnd = end;
    this.duckGain = level;
  }

  /** Sfx reverb amount (tunnels, under bridges): 0 = open road. */
  setSfxSpace(amount: number): void {
    const a = Math.min(1, Math.max(0, amount));
    if (a > 0 && !this.sfxConv) {
      this.sfxConv = new ConvolverNode(this.ctx, { buffer: impulseResponse(this.ctx, 1.4, 1.1, { preDelay: 0.008, bright: 0.7, seed: 23 }) });
      this.sfxSpace.connect(this.sfxConv).connect(new GainNode(this.ctx, { gain: 0.9 })).connect(this.sfxLP);
    }
    steer(this.sfxSpace.gain, this.now, a, 0.15);
  }

  private applyDuck(): void {
    const music = (1 - 0.5 * this.muffle) * (1 - 0.6 * this.voiceDuck);
    const sfx = 1 - 0.25 * this.voiceDuck;
    steer(this.musicDuck.gain, this.now, music, this.voiceDuck > 0 ? 0.03 : 0.12);
    steer(this.sfxDuck.gain, this.now, sfx, 0.08);
  }
}
