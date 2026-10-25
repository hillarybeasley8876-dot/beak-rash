// credits: meme credit roll (auto-scrolls; ↑↓ / mouse wheel scroll it and pause the auto-scroll for a
// moment; reduced motion = manual only). Each credit is a skewed white / ink name card that slams in as it
// enters the view, with the credited character's sticker; pelican taking a bow on the left. Esc / Enter → menu.
// Finale variant (career clear, via results 通关!): header 通关, a trophy card heads the roll, the cups are
// stamped CLEAR, and backing out lands on the career ladder.
import './credits.css';
import type { CharacterId } from '../../core/types';
import { ART } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import { CREDITS, CREDIT_OUTRO } from '../../data/strings';
import { HINT_BACK, HINT_NAV, artImage, backdrop, h, jagged, pelicanSvg, portrait, ransom, reducedMotion, starSvg, svg } from '../p5';
import { CUPS, FINALE } from '../copy';
import { frame, type ScreenFactory } from '../screen';
import { takeFinale } from './finale';

const SPEED = 70;       // px/s in stage units
const VIEW_H = 760;     // .br-cr-view height
const HOLD_S = 3;       // a manual scroll pauses the auto-scroll this long
const NUDGE = 160;      // px per ↑↓ press
const LINE_PX = 40;     // wheel deltaMode 1 (lines) → px
const IDLE_S = 30;      // 彩蛋 §21 #9: idle this long and the hidden thank-you line shows up
const LATIN = /^[\x20-\x7e\u00a0]+$/;
const CAST = Object.values(ROSTER);

/** The roster character whose name appears in a credit line (阿鹕, 鹅霸, 卡皮…), if any. */
const creditedCharacter = (line: string): CharacterId | null => CAST.find((c) => line.includes(c.name))?.id ?? null;

function card(role: string, name: string, i: number): HTMLDivElement {
  const who = creditedCharacter(name);
  return h('div', { class: `br-cr-card${i % 2 ? ' is-ink' : ''}${who ? ' has-face' : ''}`, vars: { '--x': `${(i % 3) * 40}px`, '--clip': jagged(`cr${i}`, { jx: 1.5, jy: 6, notches: 1 }) } },
    who ? h('div', { class: 'br-cr-sticker' },
      svg(starSvg({ points: 12, inner: 0.74, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 8, seed: `crs${i}` })),
      portrait(who, { mood: 'smug', className: 'br-cr-face' })) : null,
    h('span', { class: 'br-cr-role', text: role }),
    h('b', { class: `br-cr-name${LATIN.test(name) ? ' is-latin' : ''}`, text: name }));
}

/** Career-clear trophy card at the head of the roll. */
function trophy(): HTMLDivElement {
  return h('div', { class: 'br-cr-trophy' },
    h('div', { class: 'br-cr-trophy-star' }, svg(starSvg({ points: 16, inner: 0.62, fill: '#ffe600', stroke: '#0b0b0f', strokeWidth: 10, seed: 'trophy' }))),
    ransom(FINALE.title, { seed: 'finale', fonts: 'block', first: 'wr', slam: true, className: 'br-cr-trophy-cn' }),
    h('b', { class: 'br-cr-trophy-en', text: FINALE.en }),
    h('p', { class: 'br-cr-trophy-line', text: FINALE.line }),
    h('div', { class: 'br-cr-cups' }, ...CUPS.map((c) => h('span', { text: `${c.cn} CLEAR` }))));
}

export const creditsScreen: ScreenFactory = (ctx) => {
  const finale = takeFinale();
  const bg = backdrop({ tone: 'red', seed: 'credits', star: { x: '22%', y: '60%', size: 1300, color: '#ff1e3c', spin: 50 } });
  bg.append(h('div', { class: 'br-cr-slab' },
    h('div', { class: 'br-halftone is-drift', vars: { '--dot': 'rgba(229,25,28,.3)', '--dot-size': '18px', '--dot-mask': 'linear-gradient(160deg, #000 0%, transparent 70%)' } }),
    h('div', { class: 'br-cr-star' }, svg(starSvg({ points: 14, inner: 0.6, fill: '#17171e', seed: 'crstar' })))));
  const f = frame({ id: 'credits', bg, title: finale ? { cn: '通关', en: 'CAREER CLEAR' } : { cn: '致谢', en: 'CREDITS' },
    hints: [{ ...HINT_NAV, label: '滚动' }, finale ? { ...HINT_BACK, label: '巡回赛' } : HINT_BACK] });
  const roll = h('div', { class: 'br-cr-roll' });
  const cards = CREDITS.map(([role, name], i) => card(role, name, i));
  roll.append(h('div', { class: `br-cr-gap${finale ? ' is-short' : ''}` }), ...(finale ? [trophy()] : []), ...cards,
    h('div', { class: 'br-cr-outro', text: CREDIT_OUTRO }),
    h('div', { class: 'br-cr-logo' }, ransom('暴力鹈鹕', { seed: 'cr-logo', fonts: 'block', first: 'wr' }), ransom('BEAK RASH', { seed: 'cr-en', styles: ['wb', 'bw', 'wr'] })),
    h('div', { class: 'br-cr-gap' }));
  f.stage.append(
    h('div', { class: 'br-cr-hero' }, heroArt(),
      h('div', { class: 'br-cr-bubble', vars: { '--clip': jagged('crb', { jx: 2, jy: 8, notches: 2 }) }, text: finale ? FINALE.bubble : '谢谢你，愿意陪一只鹈鹕骑车。' })),
    h('div', { class: 'br-cr-view' }, roll));
  let y = 0;
  let span = 0;
  let tops: number[] = [];
  /** Cards slam in once they rise into the lower part of the view; a wrap-around resets them. */
  const reveal = (): void => {
    if (!tops.length) tops = cards.map((c) => c.offsetTop);
    cards.forEach((c, i) => {
      if (!c.classList.contains('is-in') && (tops[i] ?? 0) - y < VIEW_H - 90) c.classList.add('is-in');
    });
  };
  const wrap = (): void => {
    span = span || Math.max(1, roll.scrollHeight - 700);
    if (y > span || y < 0) {
      y = y > span ? 0 : span;
      for (const c of cards) c.classList.remove('is-in');
    }
    roll.style.transform = `translateY(${-y}px)`;
    reveal();
  };
  const auto = !reducedMotion();
  let hold = 0;
  const scrollBy = (px: number): void => {
    y += px;
    hold = HOLD_S;
    wrap();
  };
  // 彩蛋 §21 #9: 30 s without any input and a hidden thank-you line slides in at the bottom. It is
  // fixed on the stage (not part of the scrolling roll) and stays until the screen closes.
  const thanks = h('div', { class: 'br-egg-thanks', vars: { '--clip': jagged('egg-thanks', { jx: 1.5, jy: 6, notches: 1 }) },
    text: '特别鸣谢：每一只被画歪的鹈鹕。' });
  let thanksShown = false;
  let idleTimer = 0;
  let lastInputAt = performance.now();
  const showThanks = (): void => {
    if (thanksShown) return;
    thanksShown = true;
    f.stage.append(thanks);
  };
  /** Any input (key, pad button, click, wheel) restarts the idle countdown. */
  const armIdle = (): void => {
    lastInputAt = performance.now();
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(showThanks, IDLE_S * 1000);
  };
  const onKey = (): void => armIdle();
  const onPointer = (): void => armIdle();
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);
  armIdle();

  const view = f.stage.querySelector<HTMLElement>('.br-cr-view');
  // On window: the overlay passes pointer events through its non-interactive parts to the game canvas.
  const onWheel = (e: WheelEvent): void => {
    armIdle();
    const scale = (view?.getBoundingClientRect().height ?? VIEW_H) / VIEW_H || 1;
    scrollBy((e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaY) / scale);
  };
  window.addEventListener('wheel', onWheel, { passive: true });

  if (finale) ctx.sfx('ui.unlock');
  return {
    root: f.root,
    dispose: () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      window.clearTimeout(idleTimer);
    },
    update: (dt) => {
      hold = Math.max(0, hold - dt);
      if (auto && hold === 0) y += SPEED * dt;
      wrap();
      // Backstop for a throttled timer (a hidden tab): the countdown runs on real time.
      if (!thanksShown && performance.now() - lastInputAt >= IDLE_S * 1000) showThanks();
    },
    onAction: (a) => {
      armIdle();
      if (a === 'back' || a === 'confirm') {
        ctx.sfx('ui.back');
        ctx.go(finale ? 'career' : 'menu');
        return true;
      }
      if (a === 'up' || a === 'down') {
        scrollBy(a === 'down' ? NUDGE : -NUDGE);
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
