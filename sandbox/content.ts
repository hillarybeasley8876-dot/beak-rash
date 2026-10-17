// Content gallery (/sandbox/content.html): every line the content unit owns, drawn in the game's fonts at
// the game's sizes; anything that would overflow its UI box is outlined in yellow and listed on
// window.__content.overflow (tools/content-shots.mjs reads it).
import '@fontsource/anton/400.css';
import '@fontsource/zcool-kuaile/400.css';
import '@fontsource/zcool-qingke-huangyou/400.css';
import '@fontsource/ma-shan-zheng/400.css';
import '@fontsource/noto-sans-sc/900.css';
import './content.css';
import { POLICE_LINES, ROSTER, type CharacterDef } from '../src/data/roster';
import { TIP_GROUPS } from '../src/data/tips';
import { BILLBOARD_LINES, ROAD_SIGNS, TRACK_BILLBOARDS, TRACK_SIGNS, GRADES } from '../src/data/memes';
import { ACHIEVEMENTS } from '../src/data/achievements';
import * as S from '../src/data/strings';
import { BIKES, BIKE_ORDER } from '../src/data/bikes';
import { TRACKS, TRACK_ORDER } from '../src/data/tracks';
import { check, h, label, maxLines, maxWidth, noOverflow, runChecks, section } from './content.kit';
import { billboard, roadSign } from './content.world';

const stats: Record<string, number> = {};
const count = (key: string, n: number): void => { stats[key] = (stats[key] ?? 0) + n; };

// ---------------------------------------------------------------- racers
const KINDS: Array<[keyof CharacterDef, string, string]> = [
  ['taunts', 'TAUNT 嘲讽', 'k-taunt'], ['koLines', 'KO 击倒', 'k-ko'], ['hurtLines', 'HURT 被击倒', 'k-hurt'],
  ['victoryLines', 'WIN 胜利', 'k-win'], ['defeatLines', 'LOSE 失败', 'k-lose'], ['skillLines', 'SKILL 技能', 'k-skill'],
];

function bubble(text: string, kind: string, where: string): HTMLElement {
  const box = h('div', { class: 'cg-bubble-box', text });
  const el = h('div', { class: `cg-bubble ${kind}` }, h('div', { class: 'cg-bubble-out' }), box);
  check(el, where, text, maxLines(box, 2));
  return el;
}

const luma = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
};
/** Card accent: the character's accent unless it is near-black or near-white. */
const brighter = (accent: string, secondary: string): string => (luma(accent) < 60 || luma(accent) > 235 ? secondary : accent);

function racerCard(def: CharacterDef): HTMLElement {
  const card = h('div', { class: 'cg-racer', style: `--c:${brighter(def.colors.accent, def.colors.secondary)}` },
    h('div', { class: 'cg-racer-head' },
      h('span', { class: 'cg-racer-name', text: def.name }), h('span', { class: 'cg-racer-code', text: def.codename }),
      h('span', { class: 'cg-racer-title', text: def.title })),
    h('div', { class: 'cg-racer-tag', text: `「${def.tagline}」` }));
  for (const [field, title, kind] of KINDS) {
    const lines = def[field] as string[];
    count('racer lines', lines.length);
    card.append(label(`${title} ×${lines.length}`),
      h('div', { class: 'cg-wrap' }, ...lines.map((t, i) => bubble(t, kind, `${def.id}.${String(field)}[${i}]`))));
  }
  return card;
}

const racers = section('racers', '角色台词', 'RACERS');
racers.append(h('div', { class: 'cg-grid' }, ...Object.values(ROSTER).map(racerCard)));

const police = section('police', '柯基警官', 'POLICE');
for (const phase of ['alert', 'chase', 'busted', 'lost'] as const) {
  const lines = POLICE_LINES[phase];
  count('police', lines.length);
  police.append(label(phase.toUpperCase()), h('div', { class: 'cg-wrap' }, ...lines.map((t, i) => {
    const el = h('div', { class: 'cg-toast', text: `${ROSTER.corgi.name}：${t}` });
    check(el, `police.${phase}[${i}]`, t, maxLines(el, 1));
    return el;
  })));
}

// ---------------------------------------------------------------- loading
const loading = section('loading', '加载页', 'LOADING');
for (const [group, tips] of Object.entries(TIP_GROUPS)) {
  count('tips', tips.length);
  loading.append(label(`TIPS · ${group} ×${tips.length} (art layout: 560 px box)`), h('div', { class: 'cg-wrap' }, ...tips.map((t, i) => {
    const p = h('p', { text: t });
    const el = h('div', { class: 'cg-tip' }, h('span', { class: 'cg-tip-tag', text: 'TIPS 小贴士' }), p);
    check(el, `tips.${group}[${i}]`, t, maxLines(p, 4));
    return el;
  })));
}
loading.append(label('CALENDAR 宜 / 忌 ×10 per track'), h('div', { class: 'cg-wrap' }, ...TRACK_ORDER.map((id) => {
  const lines = S.CALENDAR[id];
  count('calendar', lines.length * 2);
  return h('div', { class: 'cg-cal' }, h('h3', { text: `${TRACKS[id].nameEn} · ${TRACKS[id].weather}` }),
    ...lines.map((l, i) => {
      const row = h('div', { class: 'cg-cal-row' }, h('i', { text: '宜' }), h('span', { text: l.good }), h('i', { class: 'bad', text: '忌' }), h('span', { text: l.bad }));
      check(row, `calendar.${id}[${i}]`, `${l.good}/${l.bad}`, noOverflow(row));
      return row;
    }));
})));

// ---------------------------------------------------------------- results
function results(): void {
  const sec = section('results', '结算', 'RESULTS');
  sec.append(label('GRADES + QUOTES (results stamp)'), h('div', { class: 'cg-wrap' }, ...GRADES.map((g) => {
    const quotes = S.GRADE_QUOTES[g.grade];
    count('grades', 1 + quotes.length);
    const el = h('div', { class: 'cg-grade' }, h('div', { class: 'cg-grade-stamp', text: g.grade }),
      h('div', {}, h('div', { class: 'cg-grade-title', text: g.title }), ...quotes.map((q, i) => {
        const line = h('div', { class: 'cg-grade-quote', text: `「${q}」` });
        check(line, `gradeQuotes.${g.grade}[${i}]`, q, maxLines(line, 1));
        return line;
      })));
    return el;
  })));
  count('achievements', ACHIEVEMENTS.length * 2);
  sec.append(label(`ACHIEVEMENTS ×${ACHIEVEMENTS.length} (chip: one third of the 1000 px results row)`),
    h('div', { class: 'cg-wrap' }, ...ACHIEVEMENTS.map((a) => {
      const chip = h('div', { class: 'cg-ach' }, h('i', { class: 'cg-ach-icon', text: a.icon }),
        h('div', {}, h('b', { text: a.name }), h('br'), h('span', { text: a.desc }), h('small', { text: `  ${a.id}` })));
      check(chip, `achievements.${a.id}`, a.name, maxWidth(chip, 420));
      return chip;
    })));
  const places = S.PLACE_CALLOUTS.map((c, i) => callout(c, `place[${i + 1}]`));
  sec.append(label('FINISH PLACE CALLOUTS'), h('div', { class: 'cg-wrap' }, ...places));
}

function callout(c: S.Callout, where: string): HTMLElement {
  count('callouts', 1 + c.alt.length);
  const big = h('b', { text: c.cn });
  const el = h('div', { class: 'cg-call' }, big, h('em', { text: c.en }), ...c.alt.map((t) => h('span', { text: t })));
  check(el, where, c.cn, maxWidth(big, 760));
  return el;
}

// ---------------------------------------------------------------- HUD callouts
function hud(): void {
  const sec = section('hud', '播报', 'HUD CALLOUTS');
  sec.append(h('div', { class: 'cg-wrap' }, ...Object.entries(S.ANNOUNCER).map(([id, c]) => callout(c, `announcer.${id}`))));
  sec.append(label('WRECKED sub-lines by crash cause'), h('div', { class: 'cg-wrap' },
    ...Object.entries(S.WRECK_LINES).flatMap(([cause, lines]) => lines.map((t, i) => {
      count('wreck', 1);
      const el = h('div', { class: 'cg-wreck', text: `${cause} · ${t}` });
      check(el, `wreck.${cause}[${i}]`, t, maxLines(el, 1));
      return el;
    }))));
}

// ---------------------------------------------------------------- world (canvas: after fonts load)
function world(): void {
  const sec = section('world', '路边广告', 'WORLD TEXT');
  count('billboards', BILLBOARD_LINES.length);
  sec.append(label(`BILLBOARDS ×${BILLBOARD_LINES.length} (plain / with poster art)`),
    h('div', { class: 'cg-wrap' }, ...BILLBOARD_LINES.flatMap((t, i) => [billboard(t, `billboards[${i}]`, false), billboard(t, `billboards[${i}]+art`, true)])));
  for (const id of TRACK_ORDER) {
    count('billboards', TRACK_BILLBOARDS[id].length);
    sec.append(label(`${id.toUpperCase()} EXTRAS`), h('div', { class: 'cg-wrap' }, ...TRACK_BILLBOARDS[id].map((t, i) => billboard(t, `billboards.${id}[${i}]`, false))));
  }
  const signs = [...ROAD_SIGNS.map((t, i) => roadSign(t, `signs[${i}]`)),
    ...TRACK_ORDER.flatMap((id) => TRACK_SIGNS[id].map((t, i) => roadSign(t, `signs.${id}[${i}]`)))];
  count('signs', signs.length);
  sec.append(label(`ROAD SIGNS ×${signs.length} (first six are placed by position)`), h('div', { class: 'cg-wrap' }, ...signs));
}

// ---------------------------------------------------------------- menus
function menus(): void {
  const sec = section('menus', '菜单', 'MENUS');
  const rows = (title: string, list: S.HowtoRow[]): HTMLElement => h('div', { class: 'cg-howto' }, label(title),
    ...list.map((r) => h('div', { class: 'cg-howto-row' }, h('kbd', { text: r.keys }), h('span', { text: r.text }))));
  sec.append(h('div', { class: 'cg-grid' },
    ...S.HOWTO_KEYBOARD.map((g) => rows(`${g.cn} ${g.en}`, g.rows)),
    rows('GAMEPAD 手柄', S.HOWTO_GAMEPAD),
    rows('BASICS · SKILL TIPS', [...S.HOWTO_BASICS.map((t, i) => ({ keys: `#${i + 1}`, text: t })),
      ...Object.entries(S.HOWTO_SKILL_TIPS).map(([id, t]) => ({ keys: id.replace('pelican.', ''), text: t })), { keys: 'SP', text: S.HOWTO_SP }])));
  count('howto', S.HOWTO_KEYBOARD.flatMap((g) => g.rows).length + S.HOWTO_GAMEPAD.length + S.HOWTO_BASICS.length);
  count('credits', S.CREDITS.length + 1);
  sec.append(label('CREDITS'), ...S.CREDITS.map(([role, name]) => h('div', { class: 'cg-credit' }, h('span', { text: role }), h('b', { text: name }))),
    h('div', { class: 'cg-note', text: S.CREDIT_OUTRO }));
  count('bikes', BIKE_ORDER.length * 2);
  sec.append(label('GARAGE'), h('div', { class: 'cg-wrap' }, ...BIKE_ORDER.map((id) => {
    const p = h('p', { text: BIKES[id].blurb });
    const el = h('div', { class: 'cg-bike' }, h('b', { text: BIKES[id].name }), p);
    check(el, `bikes.${id}`, BIKES[id].blurb, maxLines(p, 2));
    return el;
  })));
}

async function fontsReady(): Promise<void> {
  const all = document.body.innerText + [...BILLBOARD_LINES, ...ROAD_SIGNS, ...Object.values(TRACK_BILLBOARDS).flat(), ...Object.values(TRACK_SIGNS).flat()].join('');
  const faces = ['400 30px "ZCOOL KuaiLe"', '400 30px "ZCOOL QingKe HuangYou"', '400 30px "Ma Shan Zheng"', '900 30px "Noto Sans SC"', '400 30px "Anton"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, all)));
  await document.fonts.ready;
}

results();
hud();
menus();
fontsReady()
  .then(() => {
    world();
    requestAnimationFrame(() => requestAnimationFrame(() => runChecks(stats)));
  })
  .catch((err: unknown) => console.error('[content] gallery failed', err));
