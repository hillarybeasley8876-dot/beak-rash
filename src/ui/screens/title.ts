// title: key art + ransom-note logo, prompt-joke subtitle, pulsing PRESS ANY KEY. Any key/click → menu
// (the shell unlocks audio on that same gesture), pad START included. Back keys (Esc / Backspace / pad B)
// are not "any key": nothing lies behind the title, and mashing back on the menu must not bounce menu <-> title.
import './title.css';
import { ART } from '../../data/assets';
import { artImage, artReady, backdrop, h, pelicanSvg, ransom, starSvg, svg } from '../p5';
import { frame, type ScreenFactory } from '../screen';

const BACK_KEYS = new Set(['Escape', 'Backspace']);

export const titleScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({
    tone: 'red',
    seed: 'title',
    star: { x: '73%', y: '52%', size: 1900, color: '#0b0b0f', spin: 70 },
    dots: { color: 'rgba(0,0,0,.38)', size: 18, mask: 'linear-gradient(100deg, #000 10%, transparent 55%)' },
    speedlines: true,
  });
  const f = frame({ id: 'title', bg });
  // The key art sits in the stage (not the full-bleed bg), so the crop that keeps the whole pelican, red
  // beak hook included, and its distance to the logo are the same at 16:9 and 16:10. The drawn hero stands
  // in until the art is decoded (a slow cold start), and stays if the file is broken.
  const hero = drawnHero();
  const art = artImage(ART.title, 'br-title-art', undefined, hero);
  f.stage.prepend(...(art ? [h('div', { class: 'br-title-artbox' }, art)] : []), hero);
  const cn = ransom('暴力鹈鹕', { seed: 'logo-cn', slam: true, fonts: 'block', first: 'wb', styles: ['bw', 'wb', 'wr', 'bw'], rot: 7, className: 'br-title-cn' });
  // The last glyph sits where the logo's -7° tilt lifts it most: normal size, a touch lower and tilted the
  // other way, so its box clears the top edge of the stage.
  const last = cn.lastElementChild;
  if (last instanceof HTMLElement) {
    for (const [k, v] of [['--k', '1'], ['--dy', '0.05em'], ['--r', '1.5deg']]) last.style.setProperty(k, v);
  }
  f.stage.append(
    h('div', { class: 'br-title-logo' },
      cn,
      ransom('BEAK RASH', { seed: 'logo-en7', slam: true, styles: ['wb', 'bw', 'wr', 'rw'], className: 'br-title-en' })),
    h('div', { class: 'br-title-sub' },
      h('span', { class: 'br-title-prompt', text: 'Generate an SVG of a pelican riding a bicycle' }),
      h('span', { class: 'br-title-joke', text: '—— 这次是 3D 的。' })),
    h('div', { class: 'br-title-press' },
      h('span', { class: 'br-title-press-cn', text: '按任意键' }),
      h('span', { class: 'br-title-press-en', text: 'PRESS ANY KEY' })),
    h('div', { class: 'br-title-ver', text: 'v0.1 · 2026 · 本作没有真实鹈鹕受到伤害' }),
  );

  let gone = false;
  const proceed = (): void => {
    if (gone) return;
    gone = true;
    f.root.classList.add('is-leaving');
    ctx.sfx('ui.confirm');
    ctx.go('menu');
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!e.repeat && !e.metaKey && !e.ctrlKey && !BACK_KEYS.has(e.code)) proceed();
  };
  window.addEventListener('keydown', onKey);
  f.root.addEventListener('pointerdown', (e) => {
    if (e.button === 0) proceed();
  });
  return {
    root: f.root,
    ready: artReady(art),
    onAction(a) {
      // Pad B also fires attackR first, Esc fires pause first: isDown('back') tells those twins apart from a
      // real attack key or pad START (pause alone), which does proceed.
      if (a === 'back' || ctx.app.input.isDown('back')) return false;
      proceed();
      return true;
    },
    dispose() {
      window.removeEventListener('keydown', onKey);
    },
  };
};

function drawnHero(): HTMLDivElement {
  return h('div', { class: 'br-title-hero' },
    svg(starSvg({ points: 14, inner: 0.7, wobble: 0.18, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 5, seed: 'hero' }), 'br-title-burst'),
    svg(pelicanSvg({ mood: 'smug' }), 'br-title-pelican'),
    h('div', { class: 'br-title-sticker' }, svg(starSvg({ points: 9, inner: 0.62, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 7, seed: 's3d' })), h('b', { text: '3D!' })));
}
