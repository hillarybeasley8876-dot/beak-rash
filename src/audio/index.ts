// audio unit entry: procedural music, synthesized sfx, TTS voice lines (see status/audio.md).
import { AudioRuntime } from './system';
import type { AppContext, AudioSystem } from '../core/contracts';

export function createAudio(app: AppContext): AudioSystem {
  return new AudioRuntime(app);
}

/** Boot warm-up: build the (suspended, silent) context and graph so the first key press is instant. */
export function preload(app: AppContext): Promise<void> {
  if (app.audio instanceof AudioRuntime) app.audio.prepare();
  return Promise.resolve();
}
