// Records sheet (career screen, TAB / pad LB·RB): every achievement in catalogue order — earned ones with
// their red star icon, locked ones as grey silhouettes that still say what to do — plus an N/total counter,
// cups cleared and lifetime stats. Read-only; the career screen opens and closes it.
import './records.css';
import type { SaveStore } from '../../core/save';
import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
import { h, jagged, keyGlyph, starSvg, svg } from '../p5';
import { cupCleared, type Tier } from '../progress';

export interface RecordsSheet {
  readonly el: HTMLDivElement;
  /** "12/42" for the chip that opens the sheet. */
  readonly count: string;
  readonly open: boolean;
  toggle(open: boolean): void;
}

function cell(a: AchievementDef, earned: boolean): HTMLDivElement {
  const star = starSvg({ points: 12, inner: 0.78, fill: earned ? '#e5191c' : '#3a3a44', stroke: '#0b0b0f', strokeWidth: 10, seed: `ach-${a.id}` });
  return h('div', { class: `br-rec-cell${earned ? ' is-earned' : ''}`, title: a.desc },
    h('i', { class: 'br-rec-icon' }, svg(star), h('b', { text: earned ? a.icon : '?' })),
    h('b', { class: 'br-rec-name', text: a.name }),
    h('span', { class: 'br-rec-desc', text: a.desc }));
}

export function recordsSheet(save: SaveStore, onClose: () => void): RecordsSheet {
  const earned = new Set(save.data.achievements);
  const got = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;
  const cups = ([1, 2, 3] as Tier[]).filter((t) => cupCleared(save, t)).length;
  const st = save.data.stats;
  const facts: Array<[string, string]> = [
    ['杯赛通关', `${cups}/3`], ['比赛', String(st.races)], ['冠军', String(st.wins)], ['击倒', String(st.kos)], ['被击倒', String(st.wrecked)], ['被抓', String(st.busted)],
  ];
  const sheet = h('div', { class: 'br-rec-sheet br-panel is-white', vars: { '--clip': jagged('recsheet', { jx: 1.5, jy: 2.5, notches: 2 }) } },
    h('div', { class: 'br-rec-head' },
      h('b', { text: '成就' }), h('span', { class: 'br-rec-en', text: 'RECORDS' }),
      h('span', { class: 'br-rec-count' }, h('b', { text: String(got) }), h('i', { text: `/${ACHIEVEMENTS.length}` })),
      h('div', { class: 'br-rec-facts' }, ...facts.map(([k, v]) => h('span', {}, h('i', { text: k }), h('b', { text: v }))))),
    h('div', { class: 'br-rec-grid' }, ...ACHIEVEMENTS.map((a) => cell(a, earned.has(a.id)))),
    h('div', { class: 'br-rec-foot' }, ...keyGlyph('TAB', 'LB'), ...keyGlyph('ESC', 'B'), h('span', { text: '收起' })));
  const el = h('div', { class: 'br-rec' }, sheet);
  let open = false;
  el.addEventListener('click', (e) => {
    if (open && e.target === el) onClose();
  });
  return {
    el,
    count: `${got}/${ACHIEVEMENTS.length}`,
    get open() {
      return open;
    },
    toggle(next) {
      open = next;
      el.classList.toggle('is-open', next);
    },
  };
}
