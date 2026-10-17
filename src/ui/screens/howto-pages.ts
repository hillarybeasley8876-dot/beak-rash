// How-to pages: keyboard map, gamepad map (code-drawn controller with callouts), skills.
import { PLAYER_SKILLS, PLAYER_ULT, SKILLS } from '../../data/skills';
import { h, svg } from '../p5';

type Group = 'ride' | 'fight' | 'skill' | 'sys' | null;
type Key = [label: string, units: number, group: Group];

const ROWS: Key[][] = [
  [['ESC', 1.2, 'sys'], ['1', 1, null], ['2', 1, null], ['3', 1, null], ['4', 1, null], ['5', 1, null], ['6', 1, null], ['7', 1, null], ['8', 1, null], ['9', 1, null], ['0', 1, null]],
  [['TAB', 1.5, null], ['Q', 1, null], ['W', 1, 'ride'], ['E', 1, null], ['R', 1, null], ['T', 1, null], ['Y', 1, null], ['U', 1, 'skill'], ['I', 1, 'skill'], ['O', 1, 'skill'], ['P', 1, 'skill']],
  [['CAPS', 1.8, null], ['A', 1, 'ride'], ['S', 1, 'ride'], ['D', 1, 'ride'], ['F', 1, null], ['G', 1, null], ['H', 1, null], ['J', 1, 'fight'], ['K', 1, 'fight'], ['L', 1, 'fight'], ['ENTER', 1.7, 'sys']],
  [['SHIFT', 2.3, 'ride'], ['Z', 1, null], ['X', 1, null], ['C', 1, 'ride'], ['V', 1, null], ['B', 1, 'fight'], ['N', 1, null], ['M', 1, null], [',', 1, null], ['.', 1, null], ['SHIFT', 1.8, 'ride']],
  [['SPACE', 6.2, 'ride'], ['←', 1, 'ride'], ['↑', 1, 'ride'], ['↓', 1, 'ride'], ['→', 1, 'ride']],
];

const LEGEND: Array<[Exclude<Group, null>, string, string, Array<[string, string]>]> = [
  ['ride', '骑行', 'RIDE', [['W / ↑', '踩踏'], ['S / ↓', '刹车'], ['A D / ← →', '转向'], ['SHIFT + 转向', '漂移（松开加速）'], ['SPACE', '跳跃'], ['C', '回头看']]],
  ['fight', '战斗', 'FIGHT', [['J / L', '往左扇 / 往右扇'], ['K', '重击（自动选边）'], ['B', '打铃嘲讽 +SP']]],
  ['skill', '技能', 'SKILL', [['U I O', '三个技能'], ['P', 'SHOWTIME（SP 满）']]],
  ['sys', '系统', 'SYSTEM', [['ESC', '暂停 / 返回'], ['ENTER', '确定']]],
];

export function keyboardPage(): HTMLDivElement {
  const board = h('div', { class: 'br-ht-board' });
  ROWS.forEach((row, r) => {
    const line = h('div', { class: 'br-ht-krow', vars: { '--r': r } });
    for (const [label, units, group] of row) line.append(h('span', { class: `br-ht-key${group ? ` is-${group}` : ''}`, text: label, vars: { '--u': units } }));
    board.append(line);
  });
  const legend = h('div', { class: 'br-ht-legend' });
  for (const [group, cn, en, rows] of LEGEND) {
    const box = h('div', { class: `br-ht-group is-${group}` }, h('div', { class: 'br-ht-gtitle' }, h('b', { text: cn }), h('span', { text: en })));
    for (const [k, v] of rows) box.append(h('div', { class: 'br-ht-line' }, h('kbd', { text: k }), h('span', { text: v })));
    legend.append(box);
  }
  return h('div', { class: 'br-ht-page is-kb' }, board, legend);
}

// Gamepad page geometry, in .br-ht-body pixels (1760×740). Controller art is drawn in a 600×420 box.
const PAD = { x: 500, y: 92, k: 1.267 };
type Callout = [bx: number, by: number, side: 'l' | 'r' | 't' | 'b', row: number, key: string, text: string];
const CALLOUTS: Callout[] = [
  [188, 71, 'l', 0, 'LT', '刹车'], [190, 101, 'l', 1, 'LB', '技能 U（鱼雷）'],
  [200, 196, 'l', 3, 'L 摇杆', '转向 · 按下回头看'], [240, 266, 'l', 4, '十字键', '↑ 技能 I　↓ 技能 O'],
  [268, 167, 't', 0, 'BACK', '打铃'], [332, 167, 't', 1, 'START', '暂停'],
  [412, 71, 'r', 0, 'RT', '踩踏'], [410, 101, 'r', 1, 'RB', '漂移'], [440, 150, 'r', 2, 'Y', '重击'],
  [474, 184, 'r', 3, 'B', '往右扇 / 返回'], [406, 184, 'r', 4, 'X', '往左扇'], [440, 218, 'r', 5, 'A', '跳跃 / 确定'],
  [350, 270, 'b', 0, 'R 摇杆', '按下 = SHOWTIME'],
];
const LABEL_L = 430;
const LABEL_R = 1330;
const rowY = (row: number): number => 40 + row * 92;

export function gamepadPage(): HTMLDivElement {
  const page = h('div', { class: 'br-ht-page is-pad' });
  const body = `<path d="M180 110 C 120 110, 96 150, 84 220 C 72 300, 92 360, 136 360 C 170 360, 196 320, 226 290 L 374 290 C 404 320, 430 360, 464 360 C 508 360, 528 300, 516 220 C 504 150, 480 110, 420 110 Z" fill="#1b1b22" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
  <rect x="156" y="56" width="64" height="28" rx="10" fill="#2b2b34" stroke="#fff" stroke-width="4"/><rect x="380" y="56" width="64" height="28" rx="10" fill="#2b2b34" stroke="#fff" stroke-width="4"/>
  <rect x="150" y="92" width="80" height="18" rx="8" fill="#2b2b34" stroke="#fff" stroke-width="4"/><rect x="370" y="92" width="80" height="18" rx="8" fill="#2b2b34" stroke="#fff" stroke-width="4"/>
  <circle cx="200" cy="196" r="30" fill="#2b2b34" stroke="#fff" stroke-width="4"/><circle cx="350" cy="270" r="26" fill="#2b2b34" stroke="#fff" stroke-width="4"/>
  <path d="M210 256 h20 v-20 h20 v20 h20 v20 h-20 v20 h-20 v-20 h-20 Z" fill="#2b2b34" stroke="#fff" stroke-width="4"/>
  <rect x="256" y="160" width="24" height="14" rx="6" fill="#fff"/><rect x="320" y="160" width="24" height="14" rx="6" fill="#fff"/>
  <circle cx="440" cy="150" r="16" fill="#fff"/><circle cx="474" cy="184" r="16" fill="#e5191c"/><circle cx="406" cy="184" r="16" fill="#fff"/><circle cx="440" cy="218" r="16" fill="#e5191c"/>`;
  page.append(svg(`<svg viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">${body}</svg>`, 'br-ht-pad'));
  const lines: string[] = [];
  for (const [bx, by, side, row, key, text] of CALLOUTS) {
    const px = PAD.x + bx * PAD.k;
    const py = PAD.y + by * PAD.k;
    const label = h('div', { class: `br-ht-call is-${side}${side === 't' && row === 0 ? ' is-l' : ''}` }, h('kbd', { text: key }), h('span', { text }));
    if (side === 'b') {
      label.style.cssText = 'left:1010px;top:650px';
      lines.push(`M${px} ${py} L 1000 672`);
    } else if (side === 't') {
      label.style.cssText = row === 0 ? `right:${1760 - px + 14}px;top:118px` : `left:${px - 14}px;top:118px`;
      lines.push(`M${px} ${py} L ${px} 166`);
    } else {
      const y = rowY(row);
      label.style.cssText = side === 'l' ? `right:${1760 - LABEL_L}px;top:${y}px` : `left:${LABEL_R}px;top:${y}px`;
      const ax = side === 'l' ? LABEL_L + 12 : LABEL_R - 12;
      const ex = side === 'l' ? ax + 50 : ax - 50;
      lines.push(`M${px} ${py} L ${ex} ${y + 24} L ${ax} ${y + 24}`);
    }
    page.append(label);
  }
  const dots = CALLOUTS.map(([bx, by]) => `<circle cx="${PAD.x + bx * PAD.k}" cy="${PAD.y + by * PAD.k}" r="7" fill="#e5191c" stroke="#fff" stroke-width="3"/>`).join('');
  page.append(svg(`<svg viewBox="0 0 1760 740" xmlns="http://www.w3.org/2000/svg"><path d="${lines.join(' ')}" fill="none" stroke="#fff" stroke-width="3"/>${dots}</svg>`, 'br-ht-lines'));
  return page;
}

export function skillsPage(): HTMLDivElement {
  const keys = ['U', 'I', 'O'];
  const cards = [...PLAYER_SKILLS, PLAYER_ULT].map((id, i) => {
    const s = SKILLS[id];
    if (!s) return null;
    const ult = id === PLAYER_ULT;
    return h('div', { class: `br-ht-skill${ult ? ' is-ult' : ''}`, vars: { '--i': i } },
      h('div', { class: 'br-ht-diamond' }, h('b', { text: s.glyph })),
      h('kbd', { class: 'br-ht-skey', text: ult ? 'P' : keys[i] ?? '' }),
      h('div', { class: 'br-ht-sname', text: s.name }),
      h('div', { class: 'br-ht-sen', text: s.nameEn }),
      h('p', { class: 'br-ht-sdesc', text: s.desc }),
      h('div', { class: 'br-ht-scd', text: ult ? `SP ${s.spCost}` : `冷却 ${s.cooldown}s` }));
  });
  const sp = h('div', { class: 'br-ht-sp' }, h('span', { class: 'br-tag is-yellow', text: 'SP' }),
    h('span', { text: '命中 +6 · 被打 +3 · 击倒 +20 · 尾流 +1/秒 · 擦肩 +4 · 完美落地 +8 · 三级漂移 +5 · 打铃 +5' }));
  return h('div', { class: 'br-ht-page is-skills' }, h('div', { class: 'br-ht-cards' }, ...cards), sp);
}
