// career: 3 cups × 3 tracks ladder with locks and best places, detail panel for the focused event,
// lifetime stats. Enter → flow:startRace (mode career, level = tier). Top 3 unlocks the next event.
import './career.css';
import { TRACKS } from '../../data/tracks';
import { CUPS } from '../copy';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, h, jagged, ransom, svg, torn, trackArtSvg } from '../p5';
import { CAREER, UNLOCK_PLACE, bestPlace, isUnlocked, ordinal, type CareerEvent } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { recall, remember } from './memory';

const LOCK = '<svg viewBox="0 0 64 64"><rect x="12" y="28" width="40" height="30" rx="4" fill="#fff" stroke="#0b0b0f" stroke-width="5"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#fff" stroke-width="7"/><circle cx="32" cy="42" r="5" fill="#0b0b0f"/></svg>';

export const careerScreen: ScreenFactory = (ctx) => {
  const { save } = ctx.app;
  const bg = backdrop({ tone: 'black', seed: 'career', star: { x: '84%', y: '58%', size: 1500, color: '#17171e', spin: 90 } });
  const f = frame({ id: 'career', bg, title: { cn: '巡回赛', en: 'CAREER' }, hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const st = save.data.stats;
  f.stage.append(h('div', { class: 'br-car-stats' },
    ...[['比赛', st.races], ['冠军', st.wins], ['击倒', st.kos], ['被抓', st.busted]].map(([k, v]) => h('span', {}, h('i', { text: String(k) }), h('b', { text: String(v) })))));

  const grid = h('div', { class: 'br-car-grid' });
  const cells: HTMLDivElement[] = [];
  for (const cup of CUPS) {
    grid.append(h('div', { class: 'br-car-cup', vars: { '--t': cup.tier } },
      ransom(cup.cn, { seed: `cup${cup.tier}`, fonts: 'block', first: cup.tier === 3 ? 'wr' : 'bw' }),
      h('b', { text: cup.en }), h('p', { class: 'br-car-motto', text: cup.motto })));
    for (const ev of CAREER.filter((e) => e.tier === cup.tier)) {
      const open = isUnlocked(save, ev);
      const best = bestPlace(save, ev);
      const cell = h('div', { class: `br-car-ev${open ? '' : ' is-locked'}`, vars: { '--clip': jagged(`ev${ev.key}`, { jx: 2, jy: 4, notches: 1 }) } },
        h('div', { class: 'br-car-art', vars: { '--clip': torn(`ea${ev.key}`, 'bottom', 8, 16) } }, svg(trackArtSvg(ev.trackId))),
        h('div', { class: 'br-car-name', text: TRACKS[ev.trackId].name }),
        best !== null ? h('span', { class: `br-car-best${best === 1 ? ' is-gold' : ''}`, text: `BEST ${ordinal(best)}` }) : h('span', { class: 'br-car-new', text: open ? 'NEW' : '' }),
        open ? null : h('div', { class: 'br-car-lock' }, svg(LOCK), h('b', { text: 'LOCKED' })));
      cells.push(cell);
      grid.append(cell);
    }
  }

  const dName = h('div', { class: 'br-car-dname' });
  const dEn = h('div', { class: 'br-car-den' });
  const dRows = h('div', { class: 'br-car-drows' });
  const detail = h('div', { class: 'br-car-detail br-panel is-white', vars: { '--clip': jagged('cardetail', { jx: 2, jy: 3, notches: 2 }) } },
    h('span', { class: 'br-tag is-red br-car-dtag', text: 'NEXT RACE' }), dName, dEn, dRows, h('div', { class: 'br-car-dgo', text: 'ENTER 出发！' }));
  f.stage.append(grid, detail);

  const show = (ev: CareerEvent): void => {
    const t = TRACKS[ev.trackId];
    const cup = CUPS[ev.tier - 1];
    const best = bestPlace(save, ev);
    const open = isUnlocked(save, ev);
    dName.textContent = t.name;
    dEn.textContent = `${cup?.en ?? ''} · ${t.nameEn}`;
    dRows.replaceChildren(
      ...[['难度', '★'.repeat(t.difficulty) + '☆'.repeat(3 - t.difficulty)], ['天气', t.weather], ['对手等级', `LV.${ev.tier}`],
        ['最佳名次', best === null ? '—' : ordinal(best)], ['解锁条件', open ? `前 ${UNLOCK_PLACE} 名解锁下一站` : '上一站拿到前三名']]
        .map(([k, v]) => h('div', {}, h('span', { text: k }), h('b', { text: v }))));
    detail.classList.toggle('is-locked', !open);
  };
  const nav = ctx.nav(new Nav(CAREER.map((ev, i) => ({
    el: cells[i]!,
    disabled: () => !isUnlocked(save, ev),
    confirm: () => ctx.app.bus.emit('flow:startRace', { config: { trackId: ev.trackId, mode: 'career', level: ev.tier } }),
    onFocus: () => {
      remember('career', i);
      show(ev);
    },
  })), { layout: 'grid', columns: 3, start: recall('career', Math.max(0, save.data.career.unlocked - 1)), sfx: ctx.sfx }));
  return {
    root: f.root,
    onAction: (a) => {
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      if (a === 'confirm' && nav.current?.disabled?.()) ctx.toast('先在上一站拿到前三名', 'warn');
      return nav.handle(a);
    },
  };
};
