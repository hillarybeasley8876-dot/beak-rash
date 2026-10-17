// boot: ~1 s P5 splash (red slash slams across black, stencil logo, brush 暴力鹈鹕) → title.
import './boot.css';
import { backdrop, h, ransom, wait } from '../p5';
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
    h('div', { class: 'br-boot-logo' },
      h('div', { class: 'br-boot-en', text: 'BEAK RASH' }),
      ransom('暴力鹈鹕', { seed: 'boot', slam: true, fonts: 'brush', styles: ['wb', 'wr', 'bw'], className: 'br-boot-cn' })),
    h('div', { class: 'br-boot-credit', text: 'A PELICAN-POWERED PRODUCTION · 鹈鹕出品' }),
  );
  return { root: f.root, ready: wait(HOLD_MS) };
};
