// Audio unlock: the first key / click (and, where autoplay allows it, the first gamepad press) starts
// WebAudio. Pad-only players see a "press a key or click" chip on title/menu until it is running.
import type { AudioSystem } from '../core/contracts';
import { h } from './p5';

export class AudioUnlock {
  unlocked = false;
  readonly chip: HTMLDivElement;
  private readonly onGesture = (): void => this.attempt();

  /** `audio` is read lazily: core builds the UI before the audio system exists. */
  constructor(private readonly audio: () => AudioSystem) {
    this.chip = h('div', { class: 'br-sound-chip', attrs: { role: 'status' } },
      h('b', { text: 'SOUND OFF' }), h('span', { text: '按任意键或点一下画面，开启声音' }));
    window.addEventListener('keydown', this.onGesture, true);
    window.addEventListener('pointerdown', this.onGesture, true);
  }

  /** Safe to call often: a resume refused for lack of a gesture stays pending and resolves later. */
  attempt(): void {
    if (this.unlocked) return;
    this.audio().unlock().then(() => {
      if (this.unlocked) return;
      this.unlocked = true;
      window.removeEventListener('keydown', this.onGesture, true);
      window.removeEventListener('pointerdown', this.onGesture, true);
    }).catch((err: unknown) => console.warn('[ui] audio unlock failed, will retry on next input', err));
  }
}
