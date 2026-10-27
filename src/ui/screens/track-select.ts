// trackSelect (quick race): five skewed track cards (still, name, blurb, ★ difficulty, the chosen
// weather). Three of them are in view and big (SPEC §26: "3 cards per row at 1280×720"); ←→ walks the
// tracks and the row scrolls (the focused card is always fully on screen, the other two shrink away).
// The race options (weather / direction / route) sit in a compact strip under the row, reached with ↓.
// Enter starts the race with the focused track and its options, Esc backs out.
import './track-select.css';
import type { Action } from '../../core/input';
import type { TrackId } from '../../core/types';
import { TRACKS, TRACK_ORDER, TRACK_WEATHER } from '../../data/tracks';
import { Nav } from '../nav';
import { HINT_BACK, HINT_LR, HINT_OK, backdrop, h, jagged, starSvg, svg, torn } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { trackArt } from '../track-stills';
import { recall, remember } from './memory';
import { weatherChip, type WeatherValue } from './weather-ui';

type RouteValue = '0' | 'random';
type OptRow = 'weather' | 'reverse' | 'route';

const OPT_ROWS: readonly OptRow[] = ['weather', 'reverse', 'route'];
const REVERSE_CYCLE = ['0', '1'] as const;
const ROUTE_CYCLE: readonly RouteValue[] = ['0', 'random'];
const ROUTE_SEED_MAX = 9999;
/** How many track cards are in view at once (the others shrink away).
 *  SPEC §26 wants "3 cards per row at 1280×720" (the pre-r4 look) and tools/r6/ui.mjs counts every
 *  card whose rect touches the viewport (`shown <= 3`). The r4-era tools/r4/w3-screens.mjs wants all
 *  five inside the viewport instead: a card that is inside is always counted by the r6 filter, so
 *  five inside => shown = 5 > 3 — the two assertions cannot both hold. The three-card window is the
 *  one the SPEC, the brief and the r6 check ask for; the one-line fix for the w3 side is in
 *  shots/r6-ui/w3-five-cards.patch (not applied — the check is the lead's). */
const WINDOW = 3;
/** The three card slots (stage x). */
const SLOTS = [225, 705, 1185];

interface TrackOpts { weather: WeatherValue; reverse: '0' | '1'; route: RouteValue }

/** The weather cycle of a track: 随机 first, then the weathers it allows (its own weather first). */
const weatherCycle = (id: TrackId): WeatherValue[] => ['random', ...TRACK_WEATHER[id]];

const defaultOpts = (id: TrackId): TrackOpts => ({
  weather: TRACK_WEATHER[id][0] ?? 'clear', reverse: '0', route: '0',
});

/** Step one step along a cycle (wrapping). */
const step = <T>(list: readonly T[], cur: T, dir: 1 | -1): T => {
  const i = list.indexOf(cur);
  const n = list.length;
  if (i < 0 || n === 0) return cur;
  return list[(((i + dir) % n) + n) % n] ?? cur;
};

const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

export function trackCard(id: TrackId, i: number): HTMLDivElement {
  const t = TRACKS[id];
  const stars = h('span', { class: 'br-tc-stars', attrs: { 'aria-label': `难度 ${t.difficulty}/3` } });
  for (let k = 1; k <= 3; k++) stars.append(svg(starSvg({ points: 5, inner: 0.45, fill: k <= t.difficulty ? '#e5191c' : 'none', stroke: '#0b0b0f', strokeWidth: 14 }), 'br-tc-star'));
  return h('div', { class: `br-tc is-${id}`, vars: { '--i': i, '--clip': jagged(`tc-${id}`, { jx: 1.5, jy: 2, notches: 2 }) }, data: { track: id } },
    h('div', { class: 'br-tc-art', vars: { '--clip': torn(`art-${id}`, 'bottom', 6, 22) } }, trackArt(id)),
    h('div', { class: 'br-tc-num', text: String(i + 1).padStart(2, '0') }),
    h('div', { class: 'br-tc-body' },
      h('div', { class: 'br-tc-name', text: t.name }),
      h('div', { class: 'br-tc-en', text: t.nameEn }),
      h('div', { class: 'br-tc-blurb', text: t.blurb }),
      h('div', { class: 'br-tc-meta' }, stars, h('b', { text: `${t.lengthKm.toFixed(1)} KM` })),
      h('span', { class: 'br-tc-wx' })),
    h('div', { class: 'br-tc-go' }, svg(starSvg({ points: 10, inner: 0.66, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 8, seed: `go${id}` })), h('b', { text: 'GO!' })));
}

const LABELS: Record<OptRow, string> = { weather: '天气', reverse: '方向', route: '路线' };

export const trackSelectScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'black', seed: 'tracks', star: { x: '50%', y: '62%', size: 1700, color: '#16161d', spin: 80 },
    bands: [{ top: '64%', height: 300, color: '#e5191c', rotate: -6 }] });
  const f = frame({ id: 'tracks', bg, title: { cn: '快速比赛', en: 'QUICK RACE' }, hints: [HINT_LR, HINT_OK, HINT_BACK] });
  const counter = h('span', { class: 'br-tracks-of', text: '01 / 05' });
  const sub = h('div', { class: 'br-tracks-sub' },
    h('span', { class: 'br-tag is-red', text: 'SELECT TRACK' }),
    h('span', { class: 'br-tracks-rule', text: '7 名对手 · 交通 · 柯基警官巡逻中' }),
    counter);

  // --- the five cards ---
  const row = h('div', { class: 'br-tracks-row' });
  const cardEls: HTMLDivElement[] = [];
  const cards = new Map<TrackId, HTMLDivElement>();
  TRACK_ORDER.forEach((id, i) => {
    const card = trackCard(id, i);
    row.append(card);
    cardEls.push(card);
    cards.set(id, card);
  });

  // --- the race options of the focused track (kept per track while the screen is open) ---
  const opts = new Map<TrackId, TrackOpts>();
  for (const id of TRACK_ORDER) opts.set(id, defaultOpts(id));
  const forName = h('b', { class: 'br-ro-for' });
  const panel = h('div', { class: 'br-race-opts br-panel is-white', vars: { '--clip': jagged('raceopts', { jx: 1.5, jy: 3, notches: 2 }) } },
    h('div', { class: 'br-ro-head' }, h('span', { class: 'br-tag is-red', text: '比赛选项' }), forName));
  const rowEls = OPT_ROWS.map((opt) => {
    const value = h('span', { class: 'br-ro-value' });
    const el = h('div', { class: 'br-ro', data: { opt, value: '' } },
      h('span', { class: 'br-ro-label', text: LABELS[opt] }), value);
    panel.append(el);
    return { opt, row: el, value };
  });
  panel.append(h('div', { class: 'br-ro-hint', text: '←→ 换选项 · ↓ 进入选项 · ENTER 出发' }));
  f.stage.append(sub, row, panel);

  const cardId = (i: number): TrackId => TRACK_ORDER[i] ?? 'coast';
  /** The card's own weather line: the weather this track's race will use. */
  const paintCard = (id: TrackId): void => {
    const o = opts.get(id);
    const slot = cards.get(id)?.querySelector('.br-tc-wx');
    if (!o || !slot) return;
    slot.replaceChildren(weatherChip(o.weather));
  };
  /** The panel: the focused track and its three options. */
  const showPanel = (id: TrackId): void => {
    const o = opts.get(id);
    if (!o) return;
    panel.dataset.for = id;
    forName.textContent = TRACKS[id].name;
    // The card whose options are on show stays marked while the rows have the focus.
    for (const [cid, card] of cards) card.classList.toggle('is-current', cid === id);
    for (const r of rowEls) {
      r.row.dataset.value = String(o[r.opt]);
      r.value.replaceChildren(r.opt === 'weather' ? weatherChip(o.weather)
        : h('b', { text: r.opt === 'reverse' ? (o.reverse === '1' ? '反向' : '正向') : (o.route === 'random' ? '随机路线' : '经典路线') }));
    }
  };
  for (const id of TRACK_ORDER) paintCard(id);

  let cardIndex = 0;
  /** The window of WINDOW big cards around the focus; the other two shrink away at the window's edge
   *  (so only three cards are on screen, and the row scrolls with ←→). */
  const paintWindow = (focus: number): void => {
    const lo = Math.max(0, Math.min(focus - 1, TRACK_ORDER.length - WINDOW));
    TRACK_ORDER.forEach((id, i) => {
      const card = cards.get(id);
      if (!card) return;
      const slot = i - lo;
      const inWindow = slot >= 0 && slot < WINDOW;
      const at = inWindow ? slot : slot < 0 ? 0 : WINDOW - 1;
      card.style.setProperty('--x', `${SLOTS[at] ?? SLOTS[0]}px`);
      card.classList.toggle('is-parked', !inWindow);
    });
    counter.textContent = `${String(focus + 1).padStart(2, '0')} / ${String(TRACK_ORDER.length).padStart(2, '0')}`;
  };
  /** Cycle one option of the focused track (the value is kept per track). */
  const cycle = (opt: OptRow, dir: 1 | -1): void => {
    const id = cardId(cardIndex);
    const o = opts.get(id);
    if (!o) return;
    if (opt === 'weather') o.weather = step(weatherCycle(id), o.weather, dir);
    else if (opt === 'reverse') o.reverse = step(REVERSE_CYCLE, o.reverse, dir);
    else o.route = step(ROUTE_CYCLE, o.route, dir);
    paintCard(id);
    showPanel(id);
    ctx.sfx('ui.move');
  };
  /** Start the race with the focused track and its options (随机 weather → one of the track's weathers). */
  const start = (): void => {
    const id = cardId(cardIndex);
    const o = opts.get(id);
    if (!o) return;
    remember('trackSelect', cardIndex);
    const weather = o.weather === 'random' ? (pick(TRACK_WEATHER[id]) ?? 'clear') : o.weather;
    const route = o.route === 'random' ? 1 + Math.floor(Math.random() * ROUTE_SEED_MAX) : 0;
    ctx.app.bus.emit('flow:startRace', { config: { trackId: id, mode: 'quick', weather, reverse: o.reverse === '1', route } });
  };
  const nav = ctx.nav(new Nav([
    ...cardEls.map((el, i) => ({
      el,
      confirm: () => start(),
      onFocus: () => { cardIndex = i; remember('trackSelect', i); showPanel(cardId(i)); paintWindow(i); },
    })),
    ...rowEls.map((r) => ({
      el: r.row,
      confirm: () => cycle(r.opt, 1),
    })),
  ], { layout: 'grid', columns: 1, start: Math.min(recall('trackSelect'), TRACK_ORDER.length - 1), sfx: ctx.sfx }));

  return {
    root: f.root,
    onAction: (a: Action): boolean => {
      if (a === 'confirm') {
        start();
        return true;
      }
      if (a === 'back') {
        if (nav.index >= TRACK_ORDER.length) {   // on an option row: back to the cards
          nav.focus(cardIndex);
          return true;
        }
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      if (a === 'left' || a === 'right') {
        const dir = a === 'right' ? 1 : -1;
        if (nav.index < TRACK_ORDER.length) {
          const next = Math.max(0, Math.min(TRACK_ORDER.length - 1, cardIndex + dir));
          nav.focus(next);
        } else {
          cycle(OPT_ROWS[nav.index - TRACK_ORDER.length], dir);
        }
        return true;
      }
      if (a === 'up') {
        if (nav.index > TRACK_ORDER.length) nav.focus(nav.index - 1);
        else if (nav.index === TRACK_ORDER.length) nav.focus(cardIndex);
        return true;
      }
      if (a === 'down') {
        if (nav.index < TRACK_ORDER.length) nav.focus(TRACK_ORDER.length);
        else if (nav.index < TRACK_ORDER.length + OPT_ROWS.length - 1) nav.focus(nav.index + 1);
        return true;
      }
      return false;
    },
  };
};

