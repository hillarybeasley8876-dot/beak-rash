// credits: meme credit roll (auto-scrolls, ↑↓ nudge), pelican taking a bow. Esc / Enter → menu.
import './credits.css';
import { CREDITS, CREDIT_OUTRO } from '../copy';
import { ART } from '../../data/assets';
import { HINT_BACK, HINT_NAV, artImage, backdrop, h, jagged, pelicanSvg, ransom, svg } from '../p5';
import { frame, type ScreenFactory } from '../screen';

const SPEED = 70; // px/s in stage units

export const creditsScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'red', seed: 'credits', star: { x: '22%', y: '60%', size: 1300, color: '#ff1e3c', spin: 50 } });
  bg.append(h('div', { class: 'br-cr-slab' }));
  const f = frame({ id: 'credits', bg, title: { cn: '致谢', en: 'CREDITS' }, hints: [HINT_NAV, HINT_BACK] });
  const roll = h('div', { class: 'br-cr-roll' });
  roll.append(h('div', { class: 'br-cr-gap' }));
  CREDITS.forEach(([role, name], i) => {
    roll.append(h('div', { class: 'br-cr-entry', vars: { '--x': `${(i % 3) * 36}px` } },
      h('span', { class: 'br-cr-role', text: role }), h('b', { class: 'br-cr-name', text: name })));
  });
  roll.append(
    h('div', { class: 'br-cr-outro', text: CREDIT_OUTRO }),
    h('div', { class: 'br-cr-logo' }, ransom('暴力鹈鹕', { seed: 'cr-logo', fonts: 'block', first: 'wr' }), ransom('BEAK RASH', { seed: 'cr-en', styles: ['wb', 'bw', 'wr'] })),
    h('div', { class: 'br-cr-gap' }));
  const viewport = h('div', { class: 'br-cr-view' }, roll);
  f.stage.append(
    h('div', { class: 'br-cr-hero' }, heroArt(),
      h('div', { class: 'br-cr-bubble', vars: { '--clip': jagged('crb', { jx: 2, jy: 8, notches: 2 }) }, text: '谢谢你，愿意陪一只鹈鹕骑车。' })),
    viewport);
  let y = 0;
  let span = 0;
  const wrap = (): void => {
    span = span || Math.max(1, roll.scrollHeight - 700);
    if (y > span) y = 0;
    if (y < 0) y = span;
    roll.style.transform = `translateY(${-y}px)`;
  };
  return {
    root: f.root,
    update: (dt) => {
      y += SPEED * dt;
      wrap();
    },
    onAction: (a) => {
      if (a === 'back' || a === 'confirm') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      if (a === 'up' || a === 'down') {
        y += a === 'down' ? 160 : -160;
        wrap();
        ctx.sfx('ui.move');
        return true;
      }
      return false;
    },
  };
};

/** Generated podium vignette when present, else the drawn pelican. */
function heroArt(): Element {
  const drawn = (): SVGSVGElement => svg(pelicanSvg({ mood: 'smug' }), 'br-cr-pelican');
  const img = artImage(ART.results, 'br-cr-pelican is-art', () => img?.replaceWith(drawn()));
  return img ?? drawn();
}
