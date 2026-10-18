// Results achievements: up to three chips, then a focusable "+N MORE" chip that opens the full list.
import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
import { h, jagged, keyGlyph, starSvg, svg } from '../p5';

const MAX_CHIPS = 3;
const LONG_NAME = 6;
const CHIP_DELAY_MS = 1700;

function icon(a: AchievementDef): HTMLElement {
  return h('i', { class: 'br-ach-icon' },
    svg(starSvg({ points: 12, inner: 0.78, fill: '#e5191c', stroke: '#0b0b0f', strokeWidth: 10, seed: `ach-${a.id}` })),
    h('b', { class: 'br-ach-glyph', text: a.icon }));
}

function chip(a: AchievementDef, i: number): HTMLDivElement {
  return h('div', { class: `br-ach-chip${[...a.name].length > LONG_NAME ? ' is-long' : ''}`, vars: { '--delay': `${CHIP_DELAY_MS + i * 140}ms` }, title: a.desc },
    icon(a), h('b', { class: 'br-ach-name', text: a.name }), h('span', { class: 'br-ach-desc', text: a.desc }));
}

const unlockedDefs = (ids: readonly string[]): AchievementDef[] => ACHIEVEMENTS.filter((a) => ids.includes(a.id));

export interface AchievementRow {
  el: HTMLDivElement;
  /** "+N MORE" (make it a nav item that opens achievementPanel) or null when everything fits. */
  more: HTMLDivElement | null;
}

/** Achievements unlocked this race (catalogue order): up to three chips, then "+N MORE". */
export function achievementChips(ids: readonly string[]): AchievementRow {
  const list = unlockedDefs(ids);
  const rest = list.slice(MAX_CHIPS);
  const el = h('div', { class: `br-ach${list.length > 2 ? ' is-many' : ''}` }, h('span', { class: 'br-tag is-white br-ach-tag', text: list.length ? '新成就' : '成就' }));
  if (!list.length) el.append(h('span', { class: 'br-ach-none', text: '本场无新成就，下次一定。' }));
  list.slice(0, MAX_CHIPS).forEach((a, i) => el.append(chip(a, i)));
  if (!rest.length) return { el, more: null };
  const more = h('div', { class: 'br-ach-more', vars: { '--delay': `${CHIP_DELAY_MS + MAX_CHIPS * 140}ms` }, attrs: { role: 'button', 'aria-label': `还有 ${rest.length} 个成就` } },
    h('b', { text: `+${rest.length}` }), h('span', { text: 'MORE' }));
  el.append(more);
  return { el, more };
}

/** Full list of this race's achievements on a white jagged sheet (results toggles .is-open). */
export function achievementPanel(ids: readonly string[]): HTMLDivElement {
  const list = unlockedDefs(ids);
  const sheet = h('div', { class: 'br-ach-sheet br-panel is-white', vars: { '--clip': jagged('achsheet', { jx: 2, jy: 3, notches: 2 }) } },
    h('div', { class: 'br-ach-sheet-head' }, h('b', { text: '本场成就' }), h('span', { text: `ACHIEVEMENTS ×${list.length}` })),
    h('div', { class: 'br-ach-sheet-list' }, ...list.map((a) => h('div', { class: 'br-ach-line' }, icon(a), h('b', { text: a.name }), h('span', { text: a.desc })))),
    h('div', { class: 'br-ach-sheet-foot' }, ...keyGlyph('ENTER', 'A'), ...keyGlyph('ESC', 'B'), h('span', { text: '收起' })));
  return h('div', { class: 'br-ach-all' }, sheet);
}
