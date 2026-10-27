// career: 3 cups × 5 tracks, one cup at a time (SPEC §26). The cup tabs (or ↑↓ / the d-pad) switch the
// cup; its five events are a ladder of big cards, three of them in view, the other two narrow slivers,
// so the ladder reads at a glance. The detail panel keeps the full info of the focused event.
// Enter → flow:startRace (mode career, level = tier, with the event's weather / direction / route).
// Top 3 unlocks the next event; top 3 on a cup's last event stamps the cup CLEAR (all three =
// 巡回赛通关 chip by the stats). TAB / pad LB·RB (or the 成就 chip) opens the records sheet: every
// achievement, earned or not, with counters.
import './career.css';
import { TRACKS, TRACK_ORDER } from '../../data/tracks';
import { CUPS, WEATHER_CN } from '../copy';
import { Nav, isDirection } from '../nav';
import { HINT_BACK, HINT_NAV, HINT_OK, backdrop, h, jagged, keyGlyph, ransom, torn } from '../p5';
import { CAREER, UNLOCK_PLACE, bestPlace, careerCleared, cupCleared, highestOpen, isCareerFinal, isCupFinal, isUnlocked, ordinal, type CareerEvent } from '../progress';
import { frame, type ScreenFactory } from '../screen';
import { trackArt } from '../track-stills';
import { recall, remember } from './memory';
import { recordsSheet } from './records';
import { weatherChip } from './weather-ui';

const TIER_STARS = ['★', '★★', '★★★'];
/** How many event cards are wide at once; the others collapse to a sliver. */
const WINDOW = 3;
/** Events per cup. */
const PER_CUP = TRACK_ORDER.length;

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

  // --- the cup tabs: the ladder shows one cup at a time ---
  const tabs = h('div', { class: 'br-car-cups' });
  const tabEls = CUPS.map((cup) => {
    const el = h('div', { class: 'br-car-cup', attrs: { role: 'button', 'aria-label': `${cup.cn} ${cup.en}` }, data: { cup: cup.tier } },
      ransom(cup.cn, { seed: `cup${cup.tier}`, fonts: 'block', first: cup.tier === 3 ? 'wr' : 'bw' }),
      h('b', { text: cup.en }),
      h('span', { class: 'br-car-cup-tier', text: TIER_STARS[cup.tier - 1] ?? '★' }),
      cupCleared(save, cup.tier) ? h('span', { class: 'br-car-clear', text: 'CLEAR!' }) : null);
    tabs.append(el);
    return el;
  });
  const motto = h('p', { class: 'br-car-motto' });

  // --- the ladder: every event cell stays in the DOM, only the active cup's are shown ---
  const ladder = h('div', { class: 'br-car-row' });
  const cells: HTMLDivElement[] = [];
  for (const ev of CAREER) {
    const open = isUnlocked(save, ev);
    const best = bestPlace(save, ev);
    const cell = h('div', { class: `br-car-ev is-t${ev.tier}${open ? '' : ' is-locked'}`, vars: { '--clip': jagged(`ev${ev.key}`, { jx: 2, jy: 4, notches: 1 }) }, data: { event: ev.key } },
      h('div', { class: 'br-car-face' },
        h('div', { class: 'br-car-art', vars: { '--clip': torn(`ea${ev.key}`, 'bottom', 8, 16) } }, trackArt(ev.trackId)),
        h('span', { class: 'br-car-tier', text: TIER_STARS[ev.tier - 1] ?? '★' }),
        h('div', { class: 'br-car-name', text: TRACKS[ev.trackId].name }),
        best !== null ? h('span', { class: `br-car-best${best === 1 ? ' is-gold' : ''}`, text: `BEST ${ordinal(best)}` }) : h('span', { class: 'br-car-new', text: open ? 'NEW' : '' }),
        h('div', { class: 'br-car-chips' },
          h('span', { class: 'br-car-chip is-wx' }, weatherChip(ev.weather)),
          ev.reverse ? h('span', { class: 'br-car-chip', text: '反向' }) : null,
          ev.route > 0 ? h('span', { class: 'br-car-chip', text: `路线 #${ev.route}` }) : null),
        open ? null : h('div', { class: 'br-car-lock' }, h('b', { text: '???' }))),
      h('i', { class: 'br-car-cur' }),
      h('b', { class: 'br-car-sticker', text: open ? 'GO!' : 'LOCKED' }));
    cells.push(cell);
    ladder.append(cell);
  }

  const dName = h('div', { class: 'br-car-dname' });
  const dEn = h('div', { class: 'br-car-den' });
  const dRows = h('div', { class: 'br-car-drows' });
  const go = h('div', { class: 'br-car-dgo', attrs: { role: 'button' } }, ...keyGlyph('ENTER', 'A'), h('span', { text: '出发！' }));
  const detail = h('div', { class: 'br-car-detail br-panel is-white', vars: { '--clip': jagged('cardetail', { jx: 2, jy: 3, notches: 2 }) } },
    h('span', { class: 'br-tag is-red br-car-dtag', text: 'NEXT RACE' }), dName, dEn, dRows, go);
  f.stage.append(tabs, motto, ladder, detail);

  /** One detail row; the weather row carries the weather id (data-weather) for the menu and the tests. */
  const row = (k: string, v: string, weather?: string): HTMLDivElement =>
    h('div', weather ? { data: { weather } } : {}, h('span', { text: k }), h('b', { text: v }));
  const show = (ev: CareerEvent): void => {
    const t = TRACKS[ev.trackId];
    const cup = CUPS[ev.tier - 1];
    const best = bestPlace(save, ev);
    const open = isUnlocked(save, ev);
    dName.textContent = t.name;
    dEn.textContent = `${cup?.en ?? ''} · ${t.nameEn}`;
    dRows.replaceChildren(
      row('难度', '★'.repeat(t.difficulty) + '☆'.repeat(3 - t.difficulty)),
      row('天气', WEATHER_CN[ev.weather], ev.weather),
      row('方向', ev.reverse ? '反向' : '正向'),
      row('路线', ev.route > 0 ? `路线 #${ev.route}` : '经典路线'),
      row('对手等级', `LV.${ev.tier}`),
      row('最佳名次', best === null ? '—' : ordinal(best)),
      open ? row('目标', goalFor(ev, cup?.cn ?? '本杯')) : row('解锁条件', '上一站拿到前三名'));
    detail.classList.toggle('is-locked', !open);
  };
  const nav = ctx.nav(new Nav(CAREER.map((ev, i) => ({
    el: cells[i]!,
    disabled: () => !isUnlocked(save, ev),
    onDenied: () => ctx.toast('先在上一站拿到前三名', 'warn'),
    confirm: () => ctx.app.bus.emit('flow:startRace', { config: {
      trackId: ev.trackId, mode: 'career', level: ev.tier, weather: ev.weather, reverse: ev.reverse, route: ev.route,
    } }),
    onFocus: () => {
      remember('career', i);
      show(ev);
      syncCup(ev.tier);
    },
  })), { layout: 'grid', columns: PER_CUP, start: recall('career', Math.max(0, highestOpen(save) - 1)), sfx: ctx.sfx }));
  go.addEventListener('click', () => nav.pointerActivate());

  /** Only the active cup's events are on the ladder; the other cups stay in the DOM (hidden). */
  function syncCup(tier: number): void {
    for (const ev of CAREER) cells[ev.index - 1]?.classList.toggle('is-off', ev.tier !== tier);
    for (const el of tabEls) el.classList.toggle('is-on', Number(el.dataset.cup) === tier);
    motto.textContent = CUPS[tier - 1]?.motto ?? '';
  }
  /** The window of WINDOW wide cards around the focus; the rest collapse to a sliver. */
  function paintWindow(focus: number): void {
    const base = Math.floor(focus / PER_CUP) * PER_CUP;
    const off = focus - base;
    const lo = Math.max(0, Math.min(off - 1, PER_CUP - WINDOW));
    for (let i = 0; i < PER_CUP; i++) cells[base + i]?.classList.toggle('is-sliver', i < lo || i > lo + WINDOW - 1);
  }
  /** ←→ walks the events of the active cup; ↑↓ switches the cup. */
  function move(dir: 1 | -1): void {
    const base = Math.floor(nav.index / PER_CUP) * PER_CUP;
    const off = nav.index - base;
    const next = base + ((off + dir + PER_CUP) % PER_CUP);
    nav.focus(next);
    paintWindow(next);
  }
  function switchCup(dir: 1 | -1): void {
    const tier = Math.floor(nav.index / PER_CUP) + 1;
    const next = Math.max(1, Math.min(CUPS.length, tier + dir));
    if (next === tier) return;
    const first = (next - 1) * PER_CUP;
    nav.focus(first);
    paintWindow(first);
  }
  for (const el of tabEls) {
    el.addEventListener('click', () => {
      const tier = Number(el.dataset.cup);
      const first = (tier - 1) * PER_CUP;
      nav.focus(first);
      paintWindow(first);
    });
  }
  // The ladder opens on the remembered event: its cup is the one on show.
  syncCup(Math.floor(nav.index / PER_CUP) + 1);
  paintWindow(nav.index);

  const records = recordsSheet(save, { onClose: () => setRecords(false), sfx: ctx.sfx });
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
    dispose: () => { window.removeEventListener('keydown', onKey); records.dispose(); },
    onAction: (a) => {
      const tab = (a === 'skill1' || a === 'drift') && ctx.app.input.lastDevice === 'gamepad';
      if (records.open) {
        // Pad B / pad A / Space fire attackR / hop before back / confirm: let those twins fall through.
        if (a === 'back' || a === 'confirm' || a === 'pause' || tab) setRecords(false);
        else if (!isDirection(a)) return false;
        else return records.handle(a); // the arrows walk the achievement grid, not the ladder
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
      if (a === 'left' || a === 'right') {
        move(a === 'right' ? 1 : -1);
        return true;
      }
      if (a === 'up' || a === 'down') {
        switchCup(a === 'down' ? 1 : -1);
        return true;
      }
      return nav.handle(a);
    },
  };
};
