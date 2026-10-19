// career: 3 cups × 3 tracks ladder with locks and best places, detail panel for the focused event,
// lifetime stats. Enter → flow:startRace (mode career, level = tier). Top 3 unlocks the next event; top 3
// on a cup's last event stamps the cup CLEAR (all three = 巡回赛通关 chip by the stats). TAB / pad LB·RB (or the
// 成就 chip) opens the records sheet: every achievement, earned or not, with counters.
import './career.css';
import { TRACKS } from '../../data/tracks';
import { CUPS } from '../copy';
import { Nav, isDirection } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, h, jagged, keyGlyph, ransom, torn } from '../p5';
import { CAREER, UNLOCK_PLACE, bestPlace, careerCleared, cupCleared, isCareerFinal, isCupFinal, isUnlocked, ordinal, type CareerEvent } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { trackArt } from '../track-stills';
import { recall, remember } from './memory';
import { recordsSheet } from './records';

const TIER_STARS = ['★', '★★', '★★★'];

/** One chain-tape sticker over the locked events of a cup row (grid columns 2–4 hold the events). */
function chainTape(tier: number, firstLockedCol: number, allLocked: boolean): HTMLDivElement {
  return h('div', { class: 'br-car-chain', style: `grid-row:${tier};grid-column:${firstLockedCol + 2} / 5` },
    h('b', { text: '???' }), h('span', { text: allLocked ? '上一杯通关后开放' : `上一站前 ${UNLOCK_PLACE} 名解锁` }));
}

const goalFor = (ev: CareerEvent, cup: string): string =>
  `前 ${UNLOCK_PLACE} 名${isCareerFinal(ev) ? '通关巡回赛' : isCupFinal(ev) ? `通关${cup}` : '解锁下一站'}`;

export const careerScreen: ScreenFactory = (ctx) => {
  const { save } = ctx.app;
  const bg = backdrop({ tone: 'black', seed: 'career', star: { x: '84%', y: '58%', size: 1500, color: '#17171e', spin: 90 } });
  const f = frame({ id: 'career', bg, title: { cn: '巡回赛', en: 'CAREER' }, hints: [HINT_NAV, HINT_OK, HINT_BACK] });
  const st = save.data.stats;
  f.stage.append(h('div', { class: 'br-car-stats' },
    careerCleared(save) ? h('span', { class: 'is-clear' }, h('b', { text: '★ 巡回赛通关' })) : null,
    ...[['比赛', st.races], ['冠军', st.wins], ['击倒', st.kos], ['被抓', st.busted]].map(([k, v]) => h('span', {}, h('i', { text: String(k) }), h('b', { text: String(v) })))));

  const grid = h('div', { class: 'br-car-grid' });
  const cells: HTMLDivElement[] = [];
  for (const cup of CUPS) {
    grid.append(h('div', { class: 'br-car-cup', vars: { '--t': cup.tier } },
      ransom(cup.cn, { seed: `cup${cup.tier}`, fonts: 'block', first: cup.tier === 3 ? 'wr' : 'bw' }),
      h('b', { text: cup.en }), h('p', { class: 'br-car-motto', text: cup.motto }),
      cupCleared(save, cup.tier) ? h('span', { class: 'br-car-clear', text: 'CLEAR!' }) : null));
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
        ['最佳名次', best === null ? '—' : ordinal(best)], open ? ['目标', goalFor(ev, cup?.cn ?? '本杯')] : ['解锁条件', '上一站拿到前三名']]
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

  const records = recordsSheet(save, () => setRecords(false));
  const recChip = h('div', { class: 'br-car-rec', attrs: { role: 'button' } }, ...keyGlyph('TAB', 'LB'), h('span', { text: '成就' }), h('b', { text: records.count }));
  f.stage.append(recChip, records.el);
  const setRecords = (open: boolean): void => {
    if (open === records.open) return;
    records.toggle(open);
    nav.enabled = !open;
    ctx.sfx(open ? 'ui.cutin' : 'ui.back');
  };
  recChip.addEventListener('click', () => {
    if (nav.gate()) setRecords(true);
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Tab') return;
    e.preventDefault();
    if (!e.repeat && nav.gate()) setRecords(!records.open);
  };
  window.addEventListener('keydown', onKey);
  return {
    root: f.root,
    dispose: () => window.removeEventListener('keydown', onKey),
    onAction: (a) => {
      const tab = (a === 'skill1' || a === 'drift') && ctx.app.input.lastDevice === 'gamepad';
      if (records.open) {
        // Pad B / pad A / Space fire attackR / hop before back / confirm: let those twins fall through.
        if (a === 'back' || a === 'confirm' || a === 'pause' || tab) setRecords(false);
        else if (!isDirection(a)) return false;
        return true;
      }
      if (tab) {
        setRecords(true);
        return true;
      }
      if (a === 'back') {
        ctx.sfx('ui.back');
        ctx.go('menu');
        return true;
      }
      return nav.handle(a);
    },
  };
};
