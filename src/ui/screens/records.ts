// Records sheet (career screen, TAB / pad LB·RB) and the standalone 成就 screen: every achievement in
// catalogue order — earned ones with their red star icon, locked ones as grey silhouettes — in a dense
// grid with a red jagged cursor. The cells have no room for the description, so the focused achievement's
// FULL text (icon, name, description, 已解锁 / 未解锁) lives in the detail strip: the keyboard and the pad
// read every one of them, no mouse tooltip. Beside the grid: the nine easter eggs (SPEC §21) and the
// lifetime stats. Read-only; the career screen opens and closes it, the records screen shows it full size.
import './records.css';
import type { Action } from '../../core/input';
import type { SaveStore } from '../../core/save';
import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
import { Nav } from '../nav';
import { h, jagged, keyGlyph, starSvg, svg } from '../p5';
import { cupCleared, type Tier } from '../progress';

/** The grid is this wide; → walks the cells in catalogue order and continues on the next row. */
const COLS = 6;

export interface RecordsSheet {
  readonly el: HTMLDivElement;
  /** "12/71" for the chip that opens the sheet. */
  readonly count: string;
  readonly open: boolean;
  toggle(open: boolean): void;
  /** Arrow keys / d-pad: move the focus across the achievement grid. */
  handle(a: Action): boolean;
  dispose(): void;
}

/** 'sheet': the modal over the career screen. 'screen': the standalone 成就 screen (always open). */
export type RecordsMode = 'sheet' | 'screen';

/** The achievement's star: red when earned, a grey silhouette when it is still locked. */
function starFor(a: AchievementDef, earned: boolean): string {
  return starSvg({ points: 12, inner: 0.78, fill: earned ? '#e5191c' : '#3a3a44', stroke: '#0b0b0f', strokeWidth: 10, seed: `ach-${a.id}` });
}

/** One achievement cell: the star icon and the name (the description is in the detail strip). */
function cell(a: AchievementDef, earned: boolean, dense: boolean): HTMLDivElement {
  return h('div', { class: `br-rec-cell${earned ? ' is-earned' : ''}`, title: `${a.name} · ${a.desc}`, data: { ach: a.id } },
    h('i', { class: 'br-rec-icon' }, svg(starFor(a, earned)), h('b', { text: earned ? a.icon : '?' })),
    h('b', { class: 'br-rec-name', text: a.name }),
    dense ? null : h('span', { class: 'br-rec-desc', text: a.desc }));
}

/** The nine easter eggs (SPEC §21): the id, the name, the one-line description and the cryptic hint. */
interface EggDef { id: string; name: string; desc: string; hint: string }

const EGGS: EggDef[] = [
  { id: 'ducks', name: '小黄鸭', desc: '五条赛道各藏一只', hint: '路边有没有黄色的小东西？' },
  { id: 'konami', name: '经典代码', desc: '解锁大模型限定款', hint: '老游戏的开机密码' },
  { id: 'bribe', name: 'V我50', desc: '塞钱打点一次', hint: '警察蜀黍也要小费？' },
  { id: 'svg', name: '错误画作', desc: '击落画架致敬原作', hint: '风景里支着一块画架' },
  { id: 'goose_poem', name: '鹅鹅鹅', desc: '摇铃三下听首诗', hint: '曲项向天歌' },
  { id: 'sloth', name: '比树懒慢', desc: '八秒不踩它就闪电', hint: '有人比你还慢？' },
  { id: 'pelican_god', name: '鹈鹕神显灵', desc: '云上巨鹕铃一响', hint: '十五分之一的天气' },
  { id: 'pelican_word', name: '嘴大吃四方', desc: '菜单上打出 PELICAN', hint: '把名字一个个拼出来' },
  { id: 'credits_thanks', name: '特别鸣谢', desc: '致谢停留三十秒', hint: '什么都不做三十秒' },
];

/** The ducks are one egg in five spots: found when any duck_* is in the save. */
const duckCount = (secrets: readonly string[]): number => secrets.filter((s) => s.startsWith('duck_')).length;

const eggFound = (id: string, secrets: readonly string[], unlocks: readonly string[]): boolean => {
  if (id === 'konami') return unlocks.includes('llm');
  if (id === 'ducks') return secrets.some((s) => s.startsWith('duck_'));
  if (id === 'svg') return secrets.some((s) => s.startsWith('svg_'));
  return secrets.includes(id);
};

/** The 彩蛋 section: a count and the nine cells (found = name + description, else ??? + a hint). */
function eggsSection(save: SaveStore): HTMLDivElement {
  const secrets = save.data.secrets;
  const unlocks = save.data.unlocks;
  const found = EGGS.filter((e) => eggFound(e.id, secrets, unlocks));
  const cells = EGGS.map((e) => {
    const isFound = eggFound(e.id, secrets, unlocks);
    const extra = e.id === 'ducks' ? ` ${duckCount(secrets)}/5` : '';
    return h('div', { class: `br-egg${isFound ? ' is-found' : ''}`, data: { egg: e.id } },
      h('b', { class: 'br-egg-name', text: isFound ? e.name : '???' }),
      h('span', { class: 'br-egg-desc', text: isFound ? `${e.desc}${extra}` : e.hint }));
  });
  return h('div', { class: 'br-eggs', data: { eggs: '1' } },
    h('div', { class: 'br-eggs-head' },
      h('b', { text: '彩蛋' }), h('span', { class: 'br-rec-en', text: 'EASTER EGGS' }),
      h('span', { class: 'br-eggs-count' }, h('b', { text: String(found.length) }), h('i', { text: `/${EGGS.length}` }))),
    h('div', { class: 'br-eggs-grid' }, ...cells));
}

export function recordsSheet(save: SaveStore, o: { onClose(): void; sfx(id: string): void; mode?: RecordsMode }): RecordsSheet {
  const mode = o.mode ?? 'sheet';
  const earned = new Set(save.data.achievements);
  const got = ACHIEVEMENTS.filter((a) => earned.has(a.id)).length;
  const cups = ([1, 2, 3] as Tier[]).filter((t) => cupCleared(save, t)).length;
  const st = save.data.stats;
  // [label, value, hover note]: stats.wrecked counts KOs suffered (combat ko.ts), not every crash — the save
  // keeps no crash count, so the cell says exactly what it counts.
  const facts: Array<[string, string, string?]> = [
    ['杯赛通关', `${cups}/3`], ['比赛', String(st.races)], ['冠军', String(st.wins)], ['击倒', String(st.kos)],
    ['被击倒', String(st.wrecked), '被对手打下车的次数（自己翻车不算）'], ['被抓', String(st.busted)],
  ];
  // Past 42 achievements the cells tighten: the cut description moves into the detail strip.
  const dense = ACHIEVEMENTS.length > 42;
  const rows = Math.ceil(ACHIEVEMENTS.length / COLS);
  let open = mode === 'screen';

  // The grid: one cell per achievement, in catalogue order, each with data-ach (the id).
  const cells = ACHIEVEMENTS.map((a) => cell(a, earned.has(a.id), dense));
  const grid = h('div', { class: 'br-rec-grid', vars: { '--cols': COLS, '--rows': rows } }, ...cells);

  // The detail strip: the focused achievement in full — its icon, name, the whole description, its state.
  const dIcon = h('i', { class: 'br-rec-dicon' });
  const dName = h('b', { class: 'br-rec-dname' });
  const dDesc = h('span', { class: 'br-rec-ddesc' });
  const dState = h('span', { class: 'br-rec-dstate' });
  const detail = h('div', { class: 'br-rec-detail', data: { achDetail: '1' } },
    dIcon, h('div', { class: 'br-rec-dtext' }, dName, dDesc), dState);
  const show = (a: AchievementDef): void => {
    const isEarned = earned.has(a.id);
    dIcon.replaceChildren(svg(starFor(a, isEarned)), h('b', { text: a.icon }));
    dName.textContent = a.name;
    dDesc.textContent = a.desc;
    dState.textContent = isEarned ? '已解锁' : '未解锁';
    dState.className = `br-rec-dstate${isEarned ? ' is-earned' : ''}`;
  };

  // The grid is a Nav of its own: the arrow keys / d-pad walk the cells, → continues on the next row.
  const nav = new Nav(cells.map((el, i) => ({
    el,
    onFocus: () => { const a = ACHIEVEMENTS[i]; if (a) show(a); },
  })), { layout: 'grid', columns: COLS, sfx: o.sfx });
  // Hovering a cell focuses it too (the mouse is a first-class input, the pad is not).
  const cleanups: Array<() => void> = [];
  cells.forEach((el, i) => {
    const over = (): void => { if (open) nav.focus(i, true); };
    el.addEventListener('mouseenter', over);
    cleanups.push(() => el.removeEventListener('mouseenter', over));
  });

  const sheet = h('div', { class: `br-rec-sheet br-panel is-white${dense ? ' is-dense' : ''}`, vars: { '--clip': jagged('recsheet', { jx: 1.5, jy: 2.5, notches: 2 }) } },
    h('div', { class: 'br-rec-head' },
      h('div', { class: 'br-rec-title' }, h('b', { text: '成就' }), h('span', { class: 'br-rec-en', text: 'RECORDS' })),
      h('span', { class: 'br-rec-count' }, h('b', { text: String(got) }), h('i', { text: `/${ACHIEVEMENTS.length}` })),
      h('div', { class: 'br-rec-facts' }, ...facts.map(([k, v, note]) => h('span', note ? { title: note } : {}, h('i', { text: k }), h('b', { text: v }))))),
    h('div', { class: 'br-rec-body' },
      h('div', { class: 'br-rec-main' }, grid),
      h('div', { class: 'br-rec-side' }, detail, eggsSection(save))),
    h('div', { class: 'br-rec-foot' },
      ...keyGlyph('←→↑↓', '✚'), h('span', { text: '查看' }),
      ...(mode === 'screen'
        ? [...keyGlyph('ESC', 'B'), h('span', { text: '回主菜单' })]
        : [...keyGlyph('TAB', 'LB'), ...keyGlyph('ESC', 'B'), h('span', { text: '收起' })])));
  const el = h('div', { class: `br-rec${mode === 'screen' ? ' is-screen' : ''}` }, sheet);
  el.addEventListener('click', (e) => {
    if (open && e.target === el) o.onClose();
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
      nav.enabled = next;
      if (next) nav.focus(0, true); // the sheet always opens on the first achievement
    },
    handle(a) {
      return open ? nav.handle(a) : false;
    },
    dispose() {
      for (const fn of cleanups) fn();
      cleanups.length = 0;
      nav.dispose();
    },
  };
}
