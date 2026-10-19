// boot: ~1 s P5 splash. A red slash slams across black, a white star bursts behind the brush ransom
// 暴力鹈鹕 (the hero, centred on the band), stencil BEAK RASH above, a halftone sweep → title.
// Meanwhile it warms the key art: the title art first, decoded before boot ends (≤ 1.5 s); the rest (menu,
// garage, loading vignettes) only starts after it (or its cap), so it never competes with the title download.
import './boot.css';
import { ART, LOADING_ART } from '../../data/assets';
import { backdrop, h, preloadArt, ransom, starSvg, svg, wait } from '../p5';
import { frame, type ScreenFactory } from '../screen';

const HOLD_MS = 1050;

export const bootScreen: ScreenFactory = () => {
  const f = frame({
    id: 'boot',
    bg: backdrop({ tone: 'black', star: { x: '50%', y: '50%', size: 1700, color: '#15151b', spin: 18 }, dots: { color: 'rgba(229,25,28,.5)', size: 14, mask: 'radial-gradient(circle at 50% 50%, transparent 25%, #000 75%)' } }),
  });
  f.stage.append(
    h('div', { class: 'br-boot-slash' }),
    h('div', { class: 'br-boot-slash is-thin' }),
    h('div', { class: 'br-boot-sweep' }),
    h('div', { class: 'br-boot-en', text: 'BEAK RASH' }),
    h('div', { class: 'br-boot-cnwrap' },
      svg(starSvg({ points: 16, inner: 0.72, wobble: 0.16, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 5, seed: 'boot-burst' }), 'br-boot-burst'),
      ransom('暴力鹈鹕', { seed: 'boot', slam: true, fonts: 'brush', styles: ['wb', 'wr', 'wb', 'wr'], className: 'br-boot-cn' })),
    h('div', { class: 'br-boot-credit', text: 'A PELICAN-POWERED PRODUCTION · 鹈鹕出品' }),
  );
  const title = preloadArt([ART.title], 1500);
  void title.then(() => preloadArt([ART.menu, ART.garage, ...LOADING_ART], 8000));
  const ready = Promise.all([wait(HOLD_MS), title]).then(() => undefined);
  return { root: f.root, ready };
};
