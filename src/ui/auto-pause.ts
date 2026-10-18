// Auto-pause triggers: the window loses focus, the tab is hidden, or the gamepad drops out. Core Input
// clears held keys on blur, so without this a live race would run on without the player. The shell
// decides whether a race is live; this module only turns browser events into one callback.
export type PauseReason = 'focus' | 'pad';

export class AutoPause {
  private readonly onBlur = (): void => this.fire('focus');
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.fire('focus');
  };
  private readonly onPadLost = (): void => this.fire('pad');

  constructor(private readonly fire: (why: PauseReason) => void) {
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('gamepaddisconnected', this.onPadLost);
  }

  dispose(): void {
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('gamepaddisconnected', this.onPadLost);
  }
}
