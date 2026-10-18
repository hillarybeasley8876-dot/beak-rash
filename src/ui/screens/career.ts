// career: 3 cups × 3 tracks ladder with locks and best places, detail panel for the focused event,
// lifetime stats. Enter → flow:startRace (mode career, level = tier). Top 3 unlocks the next event.
import './career.css';
import { TRACKS } from '../../data/tracks';
import { CUPS } from '../copy';
import { Nav } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, h, jagged, keyGlyph, ransom, torn } from '../p5';
import { CAREER, UNLOCK_PLACE, bestPlace, isUnlocked, ordinal, type CareerEvent } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { trackArt } from '../track-stills';
import { recall, remember } from './memory';

const TIER_STARS = ['★', '★★', '★★★'];

/** One chain-tape sticker over the locked events of a cup row (grid columns 2–4 hold the events). */
function chainTape(tier: number, firstLockedCol: number, allLocked: boolean): HTMLDivElement {
  return h('div', { class: 'br-car-chain', style: `grid-row:${tier};grid-column:${firstLockedCol + 2} / 5` },
    h('b', { text: '???' }), h('span', { text: allLocked ? '上一杯通关后开放' : `上一站前 ${UNLOCK_PLACE} 名解锁` }));
}

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
    const events = CAREER.filter((e) => e.tier === cup.tier);
    events.forEach((ev) => {
      const open = isUnlocked(save, ev);
      const best = bestPlace(save, ev);
      const cell = h('div', { class: `br-car-ev is-t${ev.tier}${open ? '' : ' is-locked'}`, vars: { '--clip': jagged(`ev${ev.key}`, { jx: 2, jy: 4, notches: 1 }) } },
        h('div', { class: 'br-car-art', vars: { '--clip': torn(`ea${ev.key}`, 'bottom', 8, 16) } }, trackArt(ev.trackId)),
        h('span', { class: 'br-car-tier', text: TIER_STARS[ev.tier - 1] ?? '★' }),
        h('div', { class: 'br-car-name', text: TRACKS[ev.trackId].name }),
        best !== null ? h('span', { class: `br-car-best${best === 1 ? ' is-gold' : ''}`, text: `BEST ${ordinal(best)}` }) : h('span', { class: 'br-car-new', text: open ? 'NEW' : '' }),
        h('i', { class: 'br-car-cur' }),
        h('b', { class: 'br-car-sticker', text: open ? 'GO!' : 'LOCKED' }));
      cells.push(cell);
      grid.append(cell);
    });
    const firstLocked = events.findIndex((ev) => !isUnlocked(save, ev));
    if (firstLocked >= 0) grid.append(chainTape(cup.tier, firstLocked, firstLocked === 0));
  }

  const dName = h('div', { class: 'br-car-dname' });
  const dEn = h('div', { class: 'br-car-den' });
  const dRows = h('div', { class: 'br-car-drows' });
  const go = h('div', { class: 'br-car-dgo', attrs: { role: 'button' } }, ...keyGlyph('ENTER', 'A'), h('span', { text: '出发！' }));
  const detail = h('div', { class: 'br-car-detail br-panel is-white', vars: { '--clip': jagged('cardetail', { jx: 2, jy: 3, notches: 2 }) } },
    h('span', { class: 'br-tag is-red br-car-dtag', text: 'NEXT RACE' }), dName, dEn, dRows, go);
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
    onDenied: () => ctx.toast('先在上一站拿到前三名', 'warn'),
    confirm: () => ctx.app.bus.emit('flow:startRace', { config: { trackId: ev.trackId, mode: 'career', level: ev.tier } }),
    onFocus: () => {
      remember('career', i);
      show(ev);
    },
  })), { layout: 'grid', columns: 3, start: recall('career', Math.max(0, save.data.career.unlocked - 1)), sfx: ctx.sfx }));
  go.addEventListener('click', () => nav.pointerActivate());
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
