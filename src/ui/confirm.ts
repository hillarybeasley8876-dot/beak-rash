// Yes/No confirm modal drawn inside a screen's stage. Keyboard: ←→ pick, Enter confirm, Esc = no.
import type { Action } from '../core/input';
import { button, h, jagged } from './p5';
import { Nav } from './nav';

export interface Modal {
  /** Route an action to the modal; always consumes while open. */
  handle(a: Action): boolean;
  result: Promise<boolean>;
}

export function openConfirm(
  host: HTMLElement, title: string, text: string, yes: string, no: string, sfx: (id: string) => void,
): Modal {
  let done: (v: boolean) => void = () => undefined;
  const result = new Promise<boolean>((r) => (done = r));
  const yesBtn = button(yes, { seed: `y${yes}` });
  const noBtn = button(no, { seed: `n${no}` });
  const box = h('div', { class: 'br-panel is-black br-modal-box', vars: { '--clip': jagged(title, { jx: 2, jy: 5, notches: 2 }) } },
    h('div', { class: 'br-modal-title', text: title }),
    h('div', { class: 'br-modal-text', text }),
    h('div', { class: 'br-modal-row' }, yesBtn, noBtn));
  const veil = h('div', { class: 'br-modal' }, box);
  let closed = false;
  const close = (v: boolean): void => {
    if (closed) return;
    closed = true;
    nav.dispose();
    veil.remove();
    done(v);
  };
  const nav = new Nav([
    { el: yesBtn, confirm: () => close(true) },
    { el: noBtn, confirm: () => close(false) },
  ], { layout: 'horizontal', start: 1, sfx });
  veil.addEventListener('click', (e) => {
    if (e.target === veil) {
      sfx('ui.back');
      close(false);
    }
  });
  host.append(veil);
  return {
    result,
    handle(a) {
      if (closed) return false;
      if (a === 'back' || a === 'pause') {
        sfx('ui.back');
        close(false);
        return true;
      }
      if (a === 'up' || a === 'down') return true;
      nav.handle(a);
      return true;
    },
  };
}
