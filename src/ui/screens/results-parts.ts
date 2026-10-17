// Results screen building blocks: standings table, podium, grade stamp, coin counter, achievement chips.
import type { RaceResult } from '../../core/contracts';
import type { AchievementDef } from '../../data/memes';
import { ROSTER } from '../../data/roster';
import { fishSvg, h, headSvg, jagged, portrait, reducedMotion, starSvg, svg } from '../p5';
import { ordinal, type Reward } from '../progress';

export const fmtTime = (t: number | null): string => {
  if (t === null) return 'DNF';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

export function standingsTable(results: RaceResult[]): HTMLDivElement {
  const table = h('div', { class: 'br-res-table' },
    h('div', { class: 'br-res-row is-head' },
      h('span', { class: 'c-place', text: '名次' }), h('span', { class: 'c-name', text: '选手' }),
      h('span', { class: 'c-time', text: '用时' }), h('span', { class: 'c-ko', text: '击倒' }), h('span', { class: 'c-coin', text: '小鱼干' })));
  const sorted = [...results].sort((a, b) => a.place - b.place);
  sorted.forEach((r, i) => {
    table.append(h('div', { class: `br-res-row${r.isPlayer ? ' is-player' : ''}${r.time === null ? ' is-dnf' : ''}`, vars: { '--i': i } },
      h('span', { class: 'c-place', text: ordinal(r.place) }),
      h('span', { class: 'c-name' }, svg(headSvg(r.character), 'br-res-head'), h('b', { text: r.name }), r.isPlayer ? h('i', { text: 'YOU' }) : null),
      h('span', { class: 'c-time', text: fmtTime(r.time) }),
      h('span', { class: 'c-ko', text: String(r.kos) }),
      h('span', { class: 'c-coin', text: `+${r.coins}` })));
  });
  return table;
}

export function podium(results: RaceResult[]): HTMLDivElement {
  const el = h('div', { class: 'br-podium' });
  const top = [...results].sort((a, b) => a.place - b.place).slice(0, 3);
  top.forEach((r, i) => {
    const def = ROSTER[r.character];
    el.append(h('div', { class: `br-pod is-p${i + 1}${r.isPlayer ? ' is-player' : ''}`, vars: { '--delay': `${380 + i * 110}ms`, '--clip': jagged(`pod${i}`, { jx: 3, jy: 3, notches: 1 }) } },
      h('div', { class: 'br-pod-frame' }, portrait(r.character, { mood: i === 0 ? 'smug' : 'main' })),
      h('div', { class: 'br-pod-plate' }, h('b', { text: def.name }), h('span', { text: def.codename })),
      h('div', { class: 'br-pod-block' }, h('span', { text: String(i + 1) }))));
  });
  return el;
}

export function gradeBlock(reward: Reward): HTMLDivElement {
  return h('div', { class: `br-grade is-${reward.grade.grade.toLowerCase()}` },
    h('div', { class: 'br-grade-stamp' }, svg(starSvg({ points: 16, inner: 0.82, fill: 'none', stroke: '#e5191c', strokeWidth: 9, seed: 'stamp' }), 'br-grade-ring'), h('b', { text: reward.grade.grade })),
    h('div', { class: 'br-grade-title' }, h('small', { text: 'RANK' }), h('span', { text: reward.grade.title })));
}

export interface CoinCounter { el: HTMLDivElement; tick(dt: number): boolean }

/** +coins count-up with the balance rolling alongside; tick() returns true while counting. */
export function coinCounter(reward: Reward, sfx: (id: string) => void): CoinCounter {
  const gain = h('b', { class: 'br-cc-gain', text: '+0' });
  const bal = h('span', { class: 'br-cc-bal', text: String(reward.balanceBefore) });
  const rows = h('div', { class: 'br-cc-rows' });
  for (const b of reward.breakdown) rows.append(h('div', {}, h('span', { text: b.label }), h('b', { text: `+${b.value}` })));
  const el = h('div', { class: 'br-cc' },
    h('div', { class: 'br-cc-main' }, svg(fishSvg(), 'br-cc-fish'), gain),
    h('div', { class: 'br-cc-balance' }, h('span', { text: '余额' }), bal),
    rows);
  const dur = 1.3;
  let t = reducedMotion() ? dur - 1e-3 : -0.9;
  let lastSfx = 0;
  return {
    el,
    tick(dt) {
      if (t >= dur) return false;
      t += dt;
      const k = Math.max(0, Math.min(1, t / dur));
      const eased = 1 - Math.pow(1 - k, 3);
      const n = Math.round(reward.coins * eased);
      gain.textContent = `+${n}`;
      bal.textContent = String(Math.round(reward.balanceBefore + (reward.balanceAfter - reward.balanceBefore) * eased));
      if (k > 0 && k < 1 && t - lastSfx > 0.07) {
        lastSfx = t;
        sfx('ui.coin');
      }
      if (k >= 1) el.classList.add('is-done');
      return k < 1;
    },
  };
}

export function achievementChips(list: AchievementDef[]): HTMLDivElement {
  const el = h('div', { class: 'br-ach' }, h('span', { class: 'br-tag is-white br-ach-tag', text: list.length ? '新成就' : '成就' }));
  if (!list.length) el.append(h('span', { class: 'br-ach-none', text: '本场无新成就，下次一定。' }));
  list.forEach((a, i) => el.append(h('div', { class: 'br-ach-chip', vars: { '--delay': `${1700 + i * 140}ms` }, title: a.desc },
    svg(starSvg({ points: 5, inner: 0.48, fill: '#e5191c', stroke: '#0b0b0f', strokeWidth: 12 }), 'br-ach-star'),
    h('b', { text: a.name }), h('span', { text: a.desc }))));
  return el;
}
