// howto: five tabs — keyboard map, gamepad map, skills, the new mechanics, the elements. ←→ (or click)
// switch tabs, Esc → menu.
import './howto.css';
import type { SaveStore } from '../../core/save';
import { Nav } from '../nav';
import { HINT_BACK, HINT_LR, backdrop, h } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { elementsPage, gamepadPage, keyboardPage, newPage, skillsPage } from './howto-pages';
import { recall, remember } from './memory';

const TABS: Array<[string, string, (save: SaveStore) => HTMLDivElement]> = [
  ['键盘', 'KEYBOARD', keyboardPage],
  ['手柄', 'GAMEPAD', gamepadPage],
  ['技能', 'SKILLS', skillsPage],
  ['新玩法', 'NEW', newPage],
  ['元素', 'ELEMENTS', elementsPage],
];

export const howtoScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'black', seed: 'howto', star: { x: '90%', y: '86%', size: 1100, color: '#17171e', spin: 70 },
    dots: { color: 'rgba(229,25,28,.35)', size: 16, mask: 'linear-gradient(160deg, transparent 40%, #000 100%)' } });
  const f = frame({ id: 'howto', bg, title: { cn: '操作', en: 'HOW TO' }, hints: [HINT_LR, HINT_BACK] });
  const bar = h('div', { class: 'br-ht-tabs' });
  const body = h('div', { class: 'br-ht-body' });
  const pages = TABS.map(([, , build]) => build(ctx.app.save));
  const tabs = TABS.map(([cn, en], i) => {
    const tab = h('div', { class: 'br-ht-tab', vars: { '--i': i } }, h('b', { text: cn }), h('span', { text: en }));
    bar.append(tab);
    return tab;
  });
  const showPage = (i: number): void => {
    pages.forEach((p, j) => p.classList.toggle('is-on', i === j));
    remember('howto', i);
  };
  body.append(...pages);
  f.stage.append(bar, body);
  // First visit this session: open on the map of the device in use (keyboard, or the gamepad tab).
  const first = ctx.app.input.lastDevice === 'gamepad' ? 1 : 0;
  const nav = ctx.nav(new Nav(tabs.map((el, i) => ({ el, onFocus: () => showPage(i) })), { layout: 'horizontal', start: recall('howto', first), sfx: ctx.sfx }));
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      if (a === 'confirm') {
        nav.handle('right');
        return true;
      }
      return nav.handle(a);
    },
  };
};
