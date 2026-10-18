// window.__br.audio — test surface for the audio unit (state, trigger trace, triggers, and
// measurements of the real final mix: level meter and a recording).
import type { StingerId } from './music/stingers';

export type TraceEntry = { ms: number; kind: string; id: string; gain: number };

/** Recent triggers (for tests): what sounded, when (unrounded performance.now ms), at what gain. */
export class Trace {
  private list: TraceEntry[] = [];

  note(kind: string, id: string, gain: number): void {
    this.list.push({ ms: performance.now(), kind, id, gain: +gain.toFixed(3) });
    if (this.list.length > 200) this.list.shift();
  }

  log(): TraceEntry[] {
    return this.list.slice();
  }
}

export interface AudioDebugTarget {
  debugState(): Record<string, unknown>;
  traceLog(): TraceEntry[];
  mixOutput(): { ctx: AudioContext; node: AudioNode } | null;
  unlock(): Promise<void>;
  play(id: string): void;
  music(id: string | null): void;
  stinger(id: StingerId): void;
  voice(id: string): void;
}

/** Peak / RMS (dBFS) of the final mix over `seconds` of real time, sampled with an analyser. */
function level(t: AudioDebugTarget, seconds: number): Promise<{ peakDb: number; rmsDb: number; blocks: number }> {
  const out = t.mixOutput();
  if (!out) return Promise.reject(new Error('[audio] not unlocked'));
  const an = new AnalyserNode(out.ctx, { fftSize: 2048 });
  out.node.connect(an);
  const buf = new Float32Array(new ArrayBuffer(an.fftSize * 4));
  let peak = 0;
  let sum = 0;
  let n = 0;
  let blocks = 0;
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      for (const x of buf) {
        peak = Math.max(peak, Math.abs(x));
        sum += x * x;
      }
      n += buf.length;
      blocks++;
    }, 20);
    setTimeout(() => {
      clearInterval(iv);
      out.node.disconnect(an);
      const db = (x: number): number => +(20 * Math.log10(x || 1e-9)).toFixed(2);
      resolve({ peakDb: db(peak), rmsDb: db(Math.sqrt(sum / Math.max(1, n))), blocks });
    }, seconds * 1000);
  });
}

/** Capture the final mix for `seconds` as a base64 audio/webm clip. */
function record(t: AudioDebugTarget, seconds: number): Promise<string> {
  const out = t.mixOutput();
  if (!out) return Promise.reject(new Error('[audio] not unlocked'));
  const dest = out.ctx.createMediaStreamDestination();
  out.node.connect(dest);
  const rec = new MediaRecorder(dest.stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  return new Promise((resolve, reject) => {
    rec.onstop = () => {
      out.node.disconnect(dest);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error ?? new Error('[audio] recording read failed'));
      reader.readAsDataURL(new Blob(chunks, { type: rec.mimeType }));
    };
    rec.start();
    setTimeout(() => rec.stop(), seconds * 1000);
  });
}

/** Install once window.__br exists; returns true when installed. */
export function installAudioDebug(t: AudioDebugTarget): boolean {
  const br = window.__br;
  if (!br) return false;
  if ('audio' in br) return true;
  Object.assign(br, {
    audio: {
      state: () => t.debugState(),
      trace: () => t.traceLog(),
      unlock: () => t.unlock(),
      play: (id: string) => t.play(id),
      music: (id: string | null) => t.music(id),
      stinger: (id: StingerId) => t.stinger(id),
      voice: (id: string) => t.voice(id),
      level: (seconds: number) => level(t, seconds),
      record: (seconds: number) => record(t, seconds),
    },
  });
  return true;
}
