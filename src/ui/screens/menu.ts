// menu: diagonal stair of skewed items with a jagged red cursor, pelican portrait, 小鱼干 balance,
// speech-bubble blurb for the focused item (per device), hint bar. Esc → title. In the desktop shell
// (AppContext.quit) a smaller 退出游戏 QUIT step ends the stair and asks before closing the game.
import './menu.css';
import { ART } from '../../data/assets';
import { ROSTER } from '../../data/roster';
import { MENU, MENU_QUIT } from '../copy';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, artImage, artReady, backdrop, coinBadge, h, jagged, portrait, ransom, reducedMotion } from '../p5';
import { frame, type ScreenCtx, type ScreenFactory } from '../screen';
import { createActionCode, createSequence, eggBubble, type CodeStep } from './eggs';
import { recall, remember } from './memory';

interface Entry { cn: string; en: string; blurb: string; padBlurb?: string; minor?: boolean; pick(): void }

/** 彩蛋 §21 #8: typing P-E-L-I-C-A-N on the menu makes the pelican talk back. */
const PELICAN_CODES = ['KeyP', 'KeyE', 'KeyL', 'KeyI', 'KeyC', 'KeyA', 'KeyN'];
const EGG_SHOW_MS = 2500;   // bubble on screen
const EGG_FADE_MS = 350;    // bubble fade-out after that

/** 彩蛋 §21 #2: the Konami code (↑↑↓↓←→←→ B A) on the ACTION stream, so a pad types it too.
 *  The pad's d-pad up/down arrive as skill2/skill3 (the shell maps them to up/down in menus) and
 *  its B / A buttons send two actions (attackR+back, hop+confirm): the B and A steps eat the
 *  action so the menu neither backs out to the title nor picks an entry. */
const KONAMI: CodeStep[] = [
  { actions: ['up', 'skill2'] },
  { actions: ['up', 'skill2'] },
  { actions: ['down', 'skill3'] },
  { actions: ['down', 'skill3'] },
  { actions: ['left'] },
  { actions: ['right'] },
  { actions: ['left'] },
  { actions: ['right'] },
  { actions: ['bell', 'back', 'attackR'], consume: true },
  { actions: ['left', 'confirm', 'hop'], consume: true },
];
const LLM_TOAST = '大模型限定款已解锁：链条接在脖子上，这很合理。';

async function askQuit(ctx: ScreenCtx, quit: () => void): Promise<void> {
  if (await ctx.confirm(MENU_QUIT.ask, MENU_QUIT.askText, MENU_QUIT.yes, MENU_QUIT.no)) quit();
}

/** Blurb text for the focused entry: keyboard and pad wording when they differ (.is-pad picks one). */
function blurbContent(e: Entry | undefined): Array<HTMLElement | string> {
  if (!e?.padBlurb) return [e?.blurb ?? ''];
  return [h('span', { class: 'br-kb-only', text: e.blurb }), h('span', { class: 'br-pad-only', text: e.padBlurb })];
}

export const menuScreen: ScreenFactory = (ctx) => {
  const { app } = ctx;
  const bg = backdrop({ tone: 'red', seed: 'menu', star: { x: '74%', y: '46%', size: 1500, color: '#ff1e3c', spin: 60 } });
  bg.append(h('div', { class: 'br-menu-slab' }), h('div', { class: 'br-menu-slab is-white' }));
  const f = frame({ id: 'menu', bg, hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const pel = ROSTER.pelican;
  const cursor = h('div', { class: 'br-menu-cursor', vars: { '--clip': jagged('menu-cursor', { jx: 3, jy: 16, notches: 2 }) } });
  const entries: Entry[] = MENU.map((m, i) => ({ ...m, pick: () => {
    remember('menu', i);
    ctx.go(m.to);
  } }));
  const quit = app.quit;
  if (quit) entries.push({ ...MENU_QUIT, minor: true, pick: () => void askQuit(ctx, quit) });
  const list = h('div', { class: `br-menu-list${quit ? ' has-quit' : ''}` }, cursor);
  const items = entries.map((m, i) => {
    const el = h('div', { class: `br-menu-item${m.minor ? ' is-minor' : ''}`, vars: { '--i': i, '--clip': jagged(`mi${i}`, { jx: 2, jy: 12, notches: 1 }) }, attrs: { role: 'button', 'aria-label': `${m.cn} ${m.en}` } },
      h('span', { class: 'br-menu-cn', text: m.cn }), h('span', { class: 'br-menu-en', text: m.en }));
    list.append(el);
    return el;
  });
  const blurb = h('div', { class: 'br-menu-blurb', vars: { '--clip': jagged('blurb', { jx: 1.5, jy: 6, notches: 2 }) } });
  // Generated cut-out bursts out of the frame (P5 style); without it the framed portrait carries the hero.
  const heroFrame = h('div', { class: 'br-menu-frame', vars: { '--clip': jagged('menu-frame', { jx: 3, jy: 3, notches: 2 }) } });
  // A drawn sticker stands in while the cut-out decodes; a broken file swaps in the portrait.
  const framed = (): HTMLDivElement => portrait('pelican', { mood: 'main' });
  const stand = portrait('pelican', { mood: 'main', drawn: true });
  const heroArt = artImage(ART.menu, 'br-menu-art', () => stand.replaceWith(framed()), stand);
  heroFrame.append(heroArt ? stand : framed());
  if (heroArt) heroFrame.classList.add('is-backing');
  // The frame and the art share one box so the whole hero can gulp as one.
  const heroWrap = h('div', { class: 'br-menu-portrait' }, heroFrame);
  if (heroArt) heroWrap.append(heroArt);
  const coins = coinBadge(app.save.data.coins);
  coins.el.classList.add('br-menu-coins');
  f.stage.append(
    h('div', { class: 'br-menu-logo' }, ransom('暴力鹈鹕', { seed: 'menu-logo', fonts: 'block', styles: ['wb', 'bw', 'wr'] })),
    list,
    h('div', { class: 'br-menu-hero' },
      heroWrap,
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
    confirm: () => entries[i]?.pick(),
    onFocus: () => {
      blurb.replaceChildren(...blurbContent(entries[i]));
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

  // 彩蛋: P-E-L-I-C-A-N on the menu → the pelican gulps and talks back. The menu's own onAction
  // (P = ult, L = attackR, I = skill2, C = lookBack, A = left) keeps working exactly as before.
  const sequence = createSequence(PELICAN_CODES);
  const timers: number[] = [];
  const later = (fn: () => void, ms: number): void => { timers.push(window.setTimeout(fn, ms)); };
  let bubble: HTMLElement | null = null;
  const showEgg = (): void => {
    const el = eggBubble('嘴大吃四方！', 'egg-pelican');
    bubble?.remove();
    bubble = el;
    f.stage.append(el);
    app.audio.voice('pelican_taunt_0');
    if (!reducedMotion()) {
      heroWrap.classList.remove('is-gulp');
      void heroWrap.offsetWidth;
      heroWrap.classList.add('is-gulp');
    }
    later(() => {
      el.classList.add('is-out');
      later(() => {
        el.remove();
        if (bubble === el) bubble = null;
      }, EGG_FADE_MS);
    }, EGG_SHOW_MS);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (sequence.push(e.code)) showEgg();
  };
  window.addEventListener('keydown', onKey);

  // 彩蛋 §21 #2: the Konami code unlocks the 大模型限定款. Typing it again only re-shows the toast.
  const konami = createActionCode(KONAMI, 6000);
  const unlockLlm = (): void => {
    if (!app.save.data.unlocks.includes('llm')) {
      app.save.update((d) => {
        if (!d.unlocks.includes('llm')) d.unlocks.push('llm');
        if (!d.ownedBikes.includes('llm')) d.ownedBikes.push('llm');
      });
      ctx.sfx('ui.unlock');
    }
    ctx.toast(LLM_TOAST, 'meme');
  };

  return {
    root: f.root,
    ready: artReady(heroArt),
    onAction: (a) => {
      // The code runs on every action; its B and A steps are eaten (the menu must not react).
      const code = konami.push(a);
      if (code.done) {
        unlockLlm();
        return true;
      }
      if (code.consume) return true;
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('title');
        return true;
      }
      // Pad START picks like A (keyboard Esc also sends pause, but from the keyboard).
      if (a === 'pause' && app.input.lastDevice === 'gamepad') return nav.handle('confirm');
      return nav.handle(a);
    },
    dispose: () => {
      offSave();
      window.removeEventListener('keydown', onKey);
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
    },
  };
};
