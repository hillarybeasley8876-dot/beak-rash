// trackSelect (quick race): three skewed track cards (scene art, names, blurb, ★ difficulty, weather,
// length). ←→ choose, Enter → flow:startRace, Esc → menu.
import './track-select.css';
import type { TrackId } from '../../core/types';
import { TRACKS, TRACK_ORDER } from '../../data/tracks';
import { Nav } from '../nav';
import { HINT_BACK, HINT_LR, HINT_OK, backdrop, h, jagged, starSvg, svg, torn, trackArtSvg } from '../p5';
import { frame, type ScreenFactory } from '../screen';
import { recall, remember } from './memory';

export function trackCard(id: TrackId, i: number): HTMLDivElement {
  const t = TRACKS[id];
  const stars = h('span', { class: 'br-tc-stars', attrs: { 'aria-label': `难度 ${t.difficulty}/3` } });
  for (let k = 1; k <= 3; k++) stars.append(svg(starSvg({ points: 5, inner: 0.45, fill: k <= t.difficulty ? '#e5191c' : 'none', stroke: '#0b0b0f', strokeWidth: 14 }), 'br-tc-star'));
  return h('div', { class: `br-tc is-${id}`, vars: { '--i': i, '--clip': jagged(`tc-${id}`, { jx: 1.5, jy: 2, notches: 2 }) } },
    h('div', { class: 'br-tc-art', vars: { '--clip': torn(`art-${id}`, 'bottom', 6, 22) } }, svg(trackArtSvg(id))),
    h('div', { class: 'br-tc-num', text: String(i + 1).padStart(2, '0') }),
    h('div', { class: 'br-tc-body' },
      h('div', { class: 'br-tc-name', text: t.name }),
      h('div', { class: 'br-tc-en', text: t.nameEn }),
      h('div', { class: 'br-tc-blurb', text: t.blurb }),
      h('div', { class: 'br-tc-meta' }, stars, h('span', { text: `${t.weather}` }), h('b', { text: `${t.lengthKm.toFixed(1)} KM` }))),
    h('div', { class: 'br-tc-go' }, svg(starSvg({ points: 10, inner: 0.66, fill: '#ffffff', stroke: '#0b0b0f', strokeWidth: 8, seed: `go${id}` })), h('b', { text: 'GO!' })));
}

export const trackSelectScreen: ScreenFactory = (ctx) => {
  const bg = backdrop({ tone: 'black', seed: 'tracks', star: { x: '50%', y: '62%', size: 1700, color: '#16161d', spin: 80 },
    bands: [{ top: '64%', height: 300, color: '#e5191c', rotate: -6 }] });
  const f = frame({ id: 'tracks', bg, title: { cn: '快速比赛', en: 'QUICK RACE' }, hints: [HINT_LR, HINT_OK, HINT_BACK] });
  const sub = h('div', { class: 'br-tracks-sub' }, h('span', { class: 'br-tag is-red', text: 'SELECT TRACK' }), h('span', { class: 'br-tracks-rule', text: '7 名对手 · 交通 · 柯基警官巡逻中' }));
  const row = h('div', { class: 'br-tracks-row' });
  const cards = TRACK_ORDER.map((id, i) => {
    const card = trackCard(id, i);
    row.append(card);
    return card;
  });
  f.stage.append(sub, row);
  const nav = ctx.nav(new Nav(cards.map((el, i) => ({
    el,
    confirm: () => {
      const trackId = TRACK_ORDER[i] ?? 'coast';
      remember('trackSelect', i);
      ctx.app.bus.emit('flow:startRace', { config: { trackId, mode: 'quick' } });
    },
    onFocus: () => remember('trackSelect', i),
  })), { layout: 'horizontal', wrap: false, start: recall('trackSelect'), sfx: ctx.sfx }));
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      return nav.handle(a);
    },
  };
};
