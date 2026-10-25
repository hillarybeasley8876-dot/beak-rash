// Results screen building blocks: standings table, podium (+ victory / defeat lines), grade stamp + quote,
// coin counter (achievements live in results-achievements.ts). Line picks are seeded by the race, so a
// re-mount says the same thing.
import type { RaceResult } from '../../core/contracts';
import { Rng } from '../../core/rng';
import { ROSTER } from '../../data/roster';
import { GRADE_QUOTES, GRADE_QUOTES_PLACE } from '../../data/strings';
import { fishSvg, h, headSvg, jagged, portrait, reducedMotion, starSvg, svg } from '../p5';
import { ordinal, type Reward } from '../progress';
import type { RaceReport } from '../race-tracker';

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

const pickLine = (list: readonly string[], seed: number): string | null => (list.length ? new Rng(seed).pick(list) : null);

/** The (finished) winner gloats; the player, when on the podium but not winning, sulks. Everyone else keeps quiet. */
function podiumLine(r: RaceResult, place: number, seed: number): HTMLDivElement | null {
  const def = ROSTER[r.character];
  const win = place === 1 && r.time !== null;
  const text = win || r.isPlayer ? pickLine(win ? def.victoryLines : def.defeatLines, seed + r.riderId * 7919) : null;
  return text ? h('div', { class: `br-pod-say${win ? '' : ' is-defeat'}`, text }) : null;
}

export function podium(results: RaceResult[], seed: number): HTMLDivElement {
  const el = h('div', { class: 'br-podium' });
  const top = [...results].sort((a, b) => a.place - b.place).slice(0, 3);
  top.forEach((r, i) => {
    const def = ROSTER[r.character];
    el.append(h('div', { class: `br-pod is-p${i + 1}${r.isPlayer ? ' is-player' : ''}`, vars: { '--delay': `${380 + i * 110}ms`, '--clip': jagged(`pod${i}`, { jx: 3, jy: 3, notches: 1 }) } },
      h('div', { class: 'br-pod-frame' }, portrait(r.character, { mood: 'smug' })),
      h('div', { class: 'br-pod-plate' }, h('b', { text: def.name }), h('span', { text: def.codename })),
      h('div', { class: 'br-pod-block' }, h('span', { text: String(i + 1) })),
      podiumLine(r, i + 1, seed)));
  });
  return el;
}

/** Rubber-stamp ink: speckled holes + a slightly wobbly edge (filter referenced by results.css). */
const INK_FILTER = `<svg width="0" height="0" aria-hidden="true"><filter id="br-ink" x="-8%" y="-8%" width="116%" height="116%">
<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 6.4" result="holes"/>
<feComposite in="SourceGraphic" in2="holes" operator="in" result="speckled"/>
<feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="9" result="warp"/>
<feDisplacementMap in="speckled" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G"/>
</filter></svg>`;

/** A line that claims the win ('你最快') never shows off a 1st place, whatever pool it sits in. */
const CLAIMS_WIN = /最快|第一|冠军/;

/** The grade's lines plus the ones written for this finish (win / podium), seeded by the race. */
function gradeQuote(reward: Reward, seed: number): string | null {
  const { grade } = reward.grade;
  const place = reward.place;
  const extra = GRADE_QUOTES_PLACE[grade];
  const tagged = place === 1 ? extra?.win : place !== null && place <= 3 ? extra?.podium : undefined;
  const all = [...GRADE_QUOTES[grade], ...(tagged ?? [])];
  return pickLine(place === 1 ? all : all.filter((q) => !CLAIMS_WIN.test(q)), seed);
}

export function gradeBlock(reward: Reward, seed: number): HTMLDivElement {
  const quote = gradeQuote(reward, seed);
  return h('div', { class: `br-grade is-${reward.grade.grade.toLowerCase()}` },
    h('div', { class: 'br-grade-stamp' },
      svg(INK_FILTER, 'br-grade-defs'),
      svg(starSvg({ points: 16, inner: 0.82, fill: 'none', stroke: '#e5191c', strokeWidth: 9, seed: 'stamp' }), 'br-grade-ring'),
      h('div', { class: 'br-grade-ink' }, h('b', { text: reward.grade.grade }))),
    h('div', { class: 'br-grade-title' }, h('small', { text: 'RANK' }), h('span', { text: reward.grade.title })),
    quote ? h('div', { class: 'br-grade-quote', text: quote }) : null);
}

/** The race report (SPEC §14, §17, §18): the nemesis, the STYLE chain and the police — a line only
 *  when the thing actually happened. The +150 of the nemesis is already in the player's coins. */
export function raceReport(report: RaceReport, results: RaceResult[]): HTMLDivElement | null {
  const lines: Array<[string, string]> = [];
  if (report.nemesis) {
    const name = ROSTER[report.nemesis]?.name ?? '';
    const down = report.nemesisBonus > 0 ? ` · 已击倒 +${report.nemesisBonus} 小鱼干` : '';
    lines.push(['nemesis', `宿敌 ${name}${down}`]);
  }
  const style = results.find((r) => r.isPlayer)?.styleBest ?? 0;
  if (style > 0) lines.push(['style', `最佳连段 ${style.toLocaleString('en-US')}`]);
  const police: string[] = [];
  if (report.corgisDown > 0) police.push(`放倒柯基 ×${report.corgisDown}`);
  if (report.bribes > 0) police.push(`V我50 ×${report.bribes}`);
  if (police.length) lines.push(['police', police.join(' · ')]);
  if (!lines.length) return null;
  return h('div', { class: 'br-res-report' }, ...lines.map(([line, text]) => h('div', { data: { line }, text })));
}

export interface CoinCounter {
  el: HTMLDivElement;
  tick(dt: number): boolean;
  /** Jump to the end (a press during the count-up skips the show). */
  skip(): void;
}

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
        sfx('ui.count');
      }
      if (k >= 1) {
        el.classList.add('is-done');
        if (reward.coins > 0) sfx('ui.coin');
      }
      return k < 1;
    },
    skip() {
      if (t < dur) t = dur - 1e-6;
    },
  };
}
