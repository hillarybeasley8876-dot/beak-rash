// Yes/No confirm modal drawn inside a screen's stage: jagged red/ink burst panel, ransom title, halftone,
// big slanted buttons and a pelican sticker. Keyboard/pad: ←→ pick, Enter/Space/A confirm, Esc/B = no.
import './confirm.css';
import type { Action } from '../core/input';
import { SaveStore } from '../core/save';
import type { CharacterId } from '../core/types';
import { ROSTER } from '../data/roster';
import { button, h, jagged, portrait, ransom, starSvg, svg } from './p5';
import { Nav } from './nav';

export interface Modal {
  /** Route an action to the modal; consumes menu actions only, so the menu twin of a game key still arrives. */
  handle(a: Action): boolean;
  result: Promise<boolean>;
}

/** A double-click that opened the modal must not land its second click on the veil and cancel it. */
const VEIL_GUARD_MS = 320;

/** r6 (SPEC §23): the sticker is the character the player rides. The shell owns the modal and hands over
 *  no save, so the sticker reads the profile from the store. */
function pickedCharacter(): CharacterId {
  const c = new SaveStore().data.character;
  return ROSTER[c]?.racer ? c : 'pelican';
}

export function openConfirm(
  host: HTMLElement, title: string, text: string, yes: string, no: string, sfx: (id: string) => void,
): Modal {
  let done: (v: boolean) => void = () => undefined;
  const result = new Promise<boolean>((r) => (done = r));
  const yesBtn = button(yes, { seed: `y${yes}`, sub: 'YES', className: 'br-modal-btn' });
  const noBtn = button(no, { seed: `n${no}`, sub: 'NO', className: 'br-modal-btn' });
  const box = h('div', { class: 'br-modal-box' },
    svg(starSvg({ points: 16, inner: 0.78, wobble: 0.12, fill: '#e5191c', stroke: '#0b0b0f', strokeWidth: 6, seed: `mb${title}` }), 'br-modal-burst'),
    h('div', { class: 'br-modal-panel br-panel is-black', vars: { '--clip': jagged(title, { jx: 2.4, jy: 6, notches: 3 }) } },
      h('div', { class: 'br-halftone', vars: { '--dot': 'rgba(229,25,28,.35)', '--dot-size': '14px' } }),
      h('div', { class: 'br-modal-head' }, h('span', { class: 'br-modal-ask', text: 'REALLY?' }),
        ransom(title, { seed: `m${title}`, slam: true, fonts: 'block', first: 'wr', className: 'br-modal-title' })),
      h('div', { class: 'br-modal-text', text }),
      h('div', { class: 'br-modal-row' }, yesBtn, noBtn)),
    portrait(pickedCharacter(), { mood: 'hurt', className: 'br-modal-pelican' }));
  const veil = h('div', { class: 'br-modal' }, box);
  const openedAt = performance.now();
  let veilDown = false;
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
  veil.addEventListener('pointerdown', (e) => {
    veilDown = e.target === veil && performance.now() - openedAt > VEIL_GUARD_MS;
  });
  veil.addEventListener('click', (e) => {
    if (e.target !== veil || !veilDown) return;
    sfx('ui.back');
    close(false);
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
      if (a === 'left' || a === 'right' || a === 'confirm') {
        nav.handle(a);
        return true;
      }
      return false;
    },
  };
}
