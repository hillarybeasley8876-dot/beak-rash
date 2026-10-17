// menu: diagonal stair of skewed items with a jagged red cursor, pelican portrait, 小鱼干 balance,
// speech-bubble blurb for the focused item, hint bar. Esc → title.
import './menu.css';
import { ART } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import { MENU } from '../copy';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, artImage, backdrop, coinBadge, h, jagged, portrait, ransom } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { recall, remember } from './memory';

export const menuScreen: ScreenFactory = (ctx) => {
  const { app } = ctx;
  const bg = backdrop({ tone: 'red', seed: 'menu', star: { x: '74%', y: '46%', size: 1500, color: '#ff1e3c', spin: 60 } });
  bg.append(h('div', { class: 'br-menu-slab' }), h('div', { class: 'br-menu-slab is-white' }));
  const f = frame({ id: 'menu', bg, hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const pel = ROSTER.pelican;
  const cursor = h('div', { class: 'br-menu-cursor', vars: { '--clip': jagged('menu-cursor', { jx: 3, jy: 16, notches: 2 }) } });
  const list = h('div', { class: 'br-menu-list' }, cursor);
  const items = MENU.map((m, i) => {
    const el = h('div', { class: 'br-menu-item', vars: { '--i': i, '--clip': jagged(`mi${i}`, { jx: 2, jy: 12, notches: 1 }) }, attrs: { role: 'button', 'aria-label': `${m.cn} ${m.en}` } },
      h('span', { class: 'br-menu-cn', text: m.cn }), h('span', { class: 'br-menu-en', text: m.en }));
    list.append(el);
    return el;
  });
  const blurb = h('div', { class: 'br-menu-blurb', vars: { '--clip': jagged('blurb', { jx: 1.5, jy: 6, notches: 2 }) } });
  // Generated cut-out bursts out of the frame (P5 style); without it the framed portrait carries the hero.
  const heroFrame = h('div', { class: 'br-menu-frame', vars: { '--clip': jagged('menu-frame', { jx: 3, jy: 3, notches: 2 }) } });
  const heroArt = artImage(ART.menu, 'br-menu-art', () => heroFrame.append(portrait('pelican', { mood: 'main' })));
  if (!heroArt) heroFrame.append(portrait('pelican', { mood: 'main' }));
  else heroFrame.classList.add('is-backing');
  const coins = coinBadge(app.save.data.coins);
  coins.el.classList.add('br-menu-coins');
  f.stage.append(
    h('div', { class: 'br-menu-logo' }, ransom('暴力鹈鹕', { seed: 'menu-logo', fonts: 'block', styles: ['wb', 'bw', 'wr'] })),
    list,
    h('div', { class: 'br-menu-hero' },
      heroFrame,
      heroArt,
      h('div', { class: 'br-menu-name' }, h('b', { text: pel.name }), h('span', { text: pel.codename })),
      h('div', { class: 'br-menu-epithet', text: pel.title })),
    blurb,
    coins.el,
  );

  const placeCursor = (el: HTMLElement): void => {
    cursor.style.transform = `translate(${el.offsetLeft - 60}px, ${el.offsetTop - 26}px)`;
    cursor.style.width = `${el.offsetWidth + 150}px`;
    cursor.style.height = `${el.offsetHeight + 52}px`;
  };
  const nav = ctx.nav(new Nav(items.map((el, i) => ({
    el,
    confirm: () => {
      remember('menu', i);
      ctx.go((MENU[i] ?? MENU[0]!).to);
    },
    onFocus: () => {
      blurb.textContent = MENU[i]?.blurb ?? '';
      blurb.classList.remove('br-anim-pop');
      void blurb.offsetWidth;
      blurb.classList.add('br-anim-pop');
      placeCursor(el);
    },
  })), { layout: 'vertical', start: recall('menu'), sfx: ctx.sfx }));

  // First placement once the root is in the document (the shell mounts it right after this returns).
  requestAnimationFrame(() => {
    const cur = nav.current;
    if (!cur) return;
    cursor.classList.add('is-instant');
    placeCursor(cur.el);
    void cursor.offsetWidth;
    cursor.classList.remove('is-instant');
  });
  if (ctx.props.message) ctx.toast(ctx.props.message, 'warn');
  const offSave = app.save.onChange((d) => coins.set(d.coins));
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('title');
        return true;
      }
      return nav.handle(a);
    },
    dispose: offSave,
  };
};
