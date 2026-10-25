// Bars rendered ahead. In a realtime context the SongPlayer sequences each bar into a fresh Band on
// its own OfflineAudioContext (the same instruments, strips, side-chain, sends, delay and a reverb
// loop of its own), renders it off the audio thread and plays the result as ONE stereo buffer into
// the song's realtime band at `out` (fade, KO bass drop; muffle, ducks and the glue comp follow in
// the engine). The realtime audio thread then runs a few buffer sources instead of the band's
// 50–100 nodes. A render keeps its notes' releases and the delay / reverb tails, so consecutive
// bars overlap and sum (the band is linear). Renders start on a sample frame: a source that starts
// between two frames is resampled for its whole length (≈ 3× the audio-thread cost).
import { loopReverb } from '../dsp/plate';
import { VERB_RETURN } from '../engine';
import type { MusicHost } from './band';

/** Rendered tail below this level is not played. */
const SILENT = 1e-5;
/** A buffer arriving after its start joins this far ahead of the clock (s). */
const JOIN = 0.005;

interface Chunk {
  src: AudioBufferSourceNode | null;
  at: number;
  end: number;
}

/** A bar being built: sequence it on `host` (time 0 = its start), then finish() renders and plays it. */
export interface BarJob {
  readonly host: MusicHost;
  finish(): void;
}

/** A render's host: its destination is the music bus; the sends feed a reverb loop like the engine's. */
function barHost(ctx: OfflineAudioContext): MusicHost {
  const verbIn = new GainNode(ctx, { gain: 1, channelCount: 1, channelCountMode: 'explicit' });
  loopReverb(ctx, verbIn, ctx.destination, VERB_RETURN);
  return { ctx, musicIn: ctx.destination, musicVerb: verbIn };
}

/** Seconds of `buf` up to its last audible sample. */
function audible(buf: AudioBuffer): number {
  let end = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    let i = d.length - 1;
    while (i >= end && Math.abs(d[i] ?? 0) < SILENT) i--;
    end = Math.max(end, i + 1);
  }
  return end / buf.sampleRate;
}

export class BarRenderer {
  private chunks: Chunk[] = [];
  /** Shared by every bar: a cut fades it (re-phase), new bars find it open again. */
  private gain: GainNode;
  private stopAt = Infinity;
  private warned = false;
  /** A render failed: the song plays its bars live from then on. */
  failed = false;
  /** Renders made (diagnostics). */
  count = 0;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.gain = new GainNode(ctx, { gain: 1 });
    this.gain.connect(dest);
  }

  /** The render start for a bar at `t`: the sample frame at or before it (bar times are relative to it). */
  frame(t: number): number {
    return Math.floor(t * this.ctx.sampleRate) / this.ctx.sampleRate;
  }

  /**
   * A render of `seconds` that plays from audio time `at` (a frame(): time 0 of the render). The
   * caller sequences the bar on the job's host (over several calls if it likes), then finishes it.
   * Null = no render possible (the bar plays live).
   */
  open(at: number, seconds: number): BarJob | null {
    const now = this.ctx.currentTime;
    this.chunks = this.chunks.filter((c) => c.end > now);
    try {
      const off = new OfflineAudioContext(2, Math.ceil(seconds * this.ctx.sampleRate), this.ctx.sampleRate);
      const chunk: Chunk = { src: null, at, end: at + seconds };
      this.chunks.push(chunk);
      this.count++;
      return {
        host: barHost(off),
        finish: () => {
          off.startRendering().then((buf) => this.play(chunk, buf), (err: unknown) => this.fail(err));
        },
      };
    } catch (err) {
      this.fail(err);
      return null;
    }
  }

  private fail(err: unknown): void {
    this.failed = true;
    if (this.warned) return;
    this.warned = true;
    console.warn('[audio] bar render failed, the music plays live', err);
  }

  private play(chunk: Chunk, buf: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const end = Math.min(chunk.at + audible(buf), this.stopAt);
    // Cut or stopped while rendering, or already over.
    if (!this.chunks.includes(chunk) || end <= now + JOIN) return;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: buf });
    src.connect(this.gain);
    const late = Math.max(0, now + JOIN - chunk.at);
    src.start(chunk.at + late, late);
    src.stop(end);
    chunk.src = src;
    chunk.end = end;
  }

  /** Nothing rendered sounds from `at` on (the song re-phased): the bar playing then fades in 8 ms. */
  cut(at: number): void {
    const t = Math.max(at, this.ctx.currentTime);
    const g = this.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(0, t + 0.008);
    g.setValueAtTime(1, t + 0.012);
    for (const c of this.chunks) c.src?.stop(Math.max(c.at, t + 0.01));
    this.chunks = [];
  }

  /** The song stops at `at` (it has faded out by then): every bar ends there. */
  stop(at: number): void {
    this.stopAt = at;
    for (const c of this.chunks) {
      if (c.end > at) c.src?.stop(Math.max(c.at, at));
    }
  }
}
