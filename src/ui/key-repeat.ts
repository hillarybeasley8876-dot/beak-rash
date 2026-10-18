// Keyboard hold-to-repeat for menus. Core Input drops OS auto-repeat keydowns (racing wants clean
// edges), so a held arrow / WASD key in a menu re-sends its direction at the gamepad's repeat rate
// (ui/pad-menu.ts). The OS key-repeat delay doubles as the initial delay.
import { KEYMAP, type Action } from '../core/input';

const REPEAT_MS = 110;
const DIRS = ['up', 'down', 'left', 'right'] as const;

export class KeyRepeat {
  private last = -Infinity;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (!e.repeat || e.metaKey || e.ctrlKey || e.altKey || !this.enabled()) return;
    const dir = DIRS.find((d) => KEYMAP[d].includes(e.code));
    if (!dir) return;
    const now = performance.now();
    if (now - this.last < REPEAT_MS) return;
    this.last = now;
    this.emit(dir);
  };

  /** `enabled` is asked on every repeat (menus only, never during a transition). */
  constructor(private readonly emit: (a: Action) => void, private readonly enabled: () => boolean) {
    window.addEventListener('keydown', this.onKey);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
  }
}
