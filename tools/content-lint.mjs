// Content lint: length limits (display width: CJK = 1, ASCII = ½), required counts, duplicates, banned
// words, positional/voice contracts and glyph coverage of the UI font each text is drawn in.
// Usage: node tools/content-lint.mjs [--verbose] [--dump]   (exit code 1 on errors; --dump prints every line)
import { importTs } from './content-ts.mjs';
import { missingGlyphs } from './content-fonts.mjs';
import { nearDuplicates, oneNote, styleIssues, templates } from './content-repeat.mjs';

const { ROSTER, POLICE_LINES } = await importTs('src/data/roster.ts');
const { TIPS } = await importTs('src/data/tips.ts');
const { BILLBOARD_LINES, TRACK_BILLBOARDS, ROAD_SIGNS, TRACK_SIGNS, GRADES } = await importTs('src/data/memes.ts');
const { ACHIEVEMENTS } = await importTs('src/data/achievements.ts');
const S = await importTs('src/data/strings.ts');
const { BIKES } = await importTs('src/data/bikes.ts');
const { VOICE } = await importTs('src/data/voice.ts');
const { TRACKS } = await importTs('src/data/tracks.ts');

const errors = [];
const warnings = [];
const verbose = process.argv.includes('--verbose');
const dump = process.argv.includes('--dump');

/** Display width in "字": CJK and full-width punctuation 1, ASCII/Latin ½. */
export function width(s) {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) < 0x2000 ? 0.5 : 1;
  return w;
}

/** Duplicate key: punctuation-blind, except one-syllable interjections (嘎！！ vs 嘎……？ differ in delivery). */
const norm = (s) => {
  const bare = s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  return Array.from(bare).length >= 2 ? bare : s.replace(/\s/g, '');
};
/** Symbols any fallback font draws fine (arrows on lane signs, the no-break spaces in the credits prompt). */
const FALLBACK_OK = new Set(['→', '←', '↑', '↓', '\u00a0']);

const FONTS = {
  play: ['zcool-kuaile', 400], block: ['zcool-qingke-huangyou', 400], brush: ['ma-shan-zheng', 400], heavy: ['noto-sans-sc', 900],
};

/** A family of strings sharing a width limit and a UI font. */
const groups = [];
const group = (name, items, { max, font, count, min }) => groups.push({ name, items, max, font, count, min });

// ---- racers
const LINE_COUNTS = { taunts: 12, koLines: 6, hurtLines: 6, victoryLines: 4, defeatLines: 4, skillLines: 3 };
for (const def of Object.values(ROSTER)) {
  for (const [field, count] of Object.entries(LINE_COUNTS)) {
    const arr = def[field];
    if (!Array.isArray(arr)) { errors.push(`${def.id}.${field}: missing array`); continue; }
    group(`${def.id}.${field}`, arr, { max: 12, font: 'play', count });
  }
  group(`${def.id}.name`, [def.name], { max: 5, font: 'block' });
  group(`${def.id}.title`, [def.title], { max: 12, font: 'block' });
  group(`${def.id}.tagline`, [def.tagline], { max: 16, font: 'play' });
}
for (const [phase, lines] of Object.entries(POLICE_LINES)) group(`police.${phase}`, lines, { max: 12, font: 'block', count: 6 });

// ---- world & loading
group('tips', TIPS, { max: 40, font: 'play', min: 60 });
group('billboards', BILLBOARD_LINES, { max: 14, font: 'block', min: 40 });
for (const [t, lines] of Object.entries(TRACK_BILLBOARDS)) group(`billboards.${t}`, lines, { max: 14, font: 'block' });
group('signs', ROAD_SIGNS, { max: 12, font: 'block', min: 20 });
for (const [t, lines] of Object.entries(TRACK_SIGNS)) group(`signs.${t}`, lines, { max: 12, font: 'block' });
for (const [t, lines] of Object.entries(S.CALENDAR)) {
  group(`calendar.${t}`, lines.flatMap((l) => [l.good, l.bad]), { max: 6, font: 'block', count: 20 });
}

// ---- results & meta
group('grades', GRADES.map((g) => g.title), { max: 4, font: 'brush', count: 5 });
for (const [g, lines] of Object.entries(S.GRADE_QUOTES)) group(`gradeQuotes.${g}`, lines, { max: 14, font: 'play', count: 3 });
group('achievements.name', ACHIEVEMENTS.map((a) => a.name), { max: 8, font: 'block', min: 30 });
group('achievements.desc', ACHIEVEMENTS.map((a) => a.desc), { max: 16, font: 'heavy' });
group('achievements.icon', ACHIEVEMENTS.map((a) => a.icon), { max: 1, font: 'block' });
group('bikes.name', Object.values(BIKES).map((b) => b.name), { max: 8, font: 'block' });
group('bikes.blurb', Object.values(BIKES).map((b) => b.blurb), { max: 20, font: 'play' });

// ---- UI copy
group('announcer.cn', [...Object.values(S.ANNOUNCER), ...S.PLACE_CALLOUTS].map((c) => c.cn), { max: 8, font: 'brush' });
group('announcer.alt', [...Object.values(S.ANNOUNCER), ...S.PLACE_CALLOUTS].flatMap((c) => c.alt), { max: 12, font: 'play' });
for (const [cause, lines] of Object.entries(S.WRECK_LINES)) group(`wreck.${cause}`, lines, { max: 12, font: 'play', min: 2 });
group('credits.role', S.CREDITS.map(([r]) => r), { max: 8, font: 'block' });
group('credits.name', S.CREDITS.map(([, n]) => n), { max: 24, font: 'block' });
group('howto.keyboard', S.HOWTO_KEYBOARD.flatMap((g) => g.rows).map((r) => r.text), { max: 12, font: 'heavy' });
group('howto.gamepad', S.HOWTO_GAMEPAD.map((r) => r.text), { max: 12, font: 'heavy' });
group('howto.basics', [...S.HOWTO_BASICS, ...Object.values(S.HOWTO_SKILL_TIPS)], { max: 24, font: 'play' });
group('howto.sp', [S.HOWTO_SP], { max: 40, font: 'heavy' });
group('credits.outro', [S.CREDIT_OUTRO], { max: 40, font: 'play' });

// ---------------------------------------------------------------- checks
const BANNED = [
  // vulgar / mean / body-shaming
  '他妈', /(?<!妈)妈的/, '卧槽', '我靠', '傻逼', '煞笔', '尼玛', '草泥马', '操你', '屌', '废物', '垃圾人', '弱智', '智障',
  '脑残', '去死', '滚蛋', '死胖子', '肥猪', '丑八怪', '矮子', '贱',
  // real people, brands, other games' catch-phrases, politics
  '马保国', '不讲武德', '余承东', '遥遥领先', '马斯克', '华为', '小米', '腾讯', '微信', '支付宝', '淘宝', '京东',
  '美团', '饿了么', '抖音', '快手', 'B站', '肯德基', 'KFC', '麦当劳', '星巴克', '可口可乐', '耐克', 'Nike', '迪士尼',
  'Disney', 'Persona', '女神异闻录', 'Take Your', 'All-Out', '总攻击', 'ChatGPT', 'OpenAI', 'Gemini', 'iPhone',
  'Tesla', '特斯拉', '2077', 'Cyberpunk', '狗狗币', 'Dogecoin', '比特币', '流浪地球', '同志', '喝茶',
  '政府', '主席', '总统', '共产', '国民党', '台独', '六四', '法轮', '习近平', '毛泽东',
];

const allText = [];
for (const g of groups) {
  const [family, weight] = FONTS[g.font];
  if (g.count !== undefined && g.items.length !== g.count) errors.push(`${g.name}: ${g.items.length} lines, want ${g.count}`);
  if (g.min !== undefined && g.items.length < g.min) errors.push(`${g.name}: ${g.items.length} lines, want ≥ ${g.min}`);
  const seen = new Map();
  g.items.forEach((text, i) => {
    allText.push({ where: `${g.name}[${i}]`, text });
    if (typeof text !== 'string' || !text.trim()) { errors.push(`${g.name}[${i}]: empty`); return; }
    if (text !== text.trim()) errors.push(`${g.name}[${i}]: leading/trailing space «${text}»`);
    if (width(text) > g.max) errors.push(`${g.name}[${i}]: «${text}» is ${width(text)} 字 (max ${g.max})`);
    const miss = missingGlyphs(text, family, weight).filter((ch) => !FALLBACK_OK.has(ch));
    if (miss.length) errors.push(`${g.name}[${i}]: «${text}» — ${family} lacks ${miss.join(' ')}`);
    const key = norm(text);
    if (key && seen.has(key)) errors.push(`${g.name}: duplicate «${text}» (also [${seen.get(key)}])`);
    seen.set(key, i);
  });
}

// Lines must not repeat inside one character's voice, nor between two characters.
const owner = new Map();
for (const def of Object.values(ROSTER)) {
  const mine = new Map();
  for (const field of Object.keys(LINE_COUNTS)) {
    for (const text of def[field] ?? []) {
      const key = norm(text);
      if (!key) continue;
      if (mine.has(key) && mine.get(key) !== field) errors.push(`${def.id}: «${text}» in both ${mine.get(key)} and ${field}`);
      mine.set(key, field);
      const other = owner.get(key);
      if (other && other !== def.id) errors.push(`«${text}» said by both ${other} and ${def.id}`);
      owner.set(key, def.id);
    }
  }
}
const tipKeys = new Set();
for (const t of TIPS) { if (tipKeys.has(norm(t))) errors.push(`tips: duplicate «${t}»`); tipKeys.add(norm(t)); }

for (const { where, text } of allText) {
  for (const word of BANNED) {
    if (typeof word === 'string' ? text.includes(word) : word.test(text)) errors.push(`${where}: banned «${word}» in «${text}»`);
  }
}

// Contracts other units rely on.
// world/dressing reads the first six signs by position: [limit (split on '：'), fish, pelican, lane →, ← lane, curves].
const SIGN_ROLES = [['限速', '：'], ['鱼'], ['鹈鹕'], ['→'], ['←'], ['弯']];
SIGN_ROLES.forEach((marks, i) => {
  if (!marks.every((m) => ROAD_SIGNS[i]?.includes(m))) errors.push(`ROAD_SIGNS[${i}] «${ROAD_SIGNS[i]}» must contain ${marks.join(' + ')} (read by position)`);
});
for (const v of Object.values(VOICE)) {
  if (v.speaker === 'announcer') continue;
  const def = ROSTER[v.speaker];
  const lines = v.kind === 'ko' ? def?.koLines : v.kind === 'hurt' ? def?.hurtLines : def?.taunts;
  if (!lines?.includes(v.text)) errors.push(`voice ${v.id}: «${v.text}» no longer in ${v.speaker}.${v.kind} (audio matches bubbles by text)`);
}
const achIds = new Set();
for (const a of ACHIEVEMENTS) { if (achIds.has(a.id)) errors.push(`achievement id ${a.id} twice`); achIds.add(a.id); }
for (const id of ['comeback', 'double', 'goose', 'pacifist', 'pigeon', 'corgi', 'gulp', 'showtime']) {
  if (!achIds.has(id)) errors.push(`achievement id ${id} removed (ui/race-tracker and saves use it)`);
}
const icons = new Map();
for (const a of ACHIEVEMENTS) { if (icons.has(a.icon)) warnings.push(`achievement icon ${a.icon} shared by ${icons.get(a.icon)} and ${a.id}`); icons.set(a.icon, a.id); }

// ---------------------------------------------------------------- repetition (tools/content-repeat.mjs)
// Flavour text only (functional copy such as achievement descs and key legends may repeat its terms).
const flavour = [];
const add = (where, lines, speaker) => lines.forEach((text, i) => flavour.push({ where: `${where}[${i}]`, text, mine: true, speaker }));
for (const def of Object.values(ROSTER)) {
  for (const field of [...Object.keys(LINE_COUNTS), 'tagline', 'title']) add(`${def.id}.${field}`, [def[field]].flat(), def.id);
}
for (const [phase, lines] of Object.entries(POLICE_LINES)) add(`police.${phase}`, lines, 'corgi');
add('tips', TIPS);
add('billboards', BILLBOARD_LINES);
add('signs', ROAD_SIGNS);
for (const [t, lines] of Object.entries(TRACK_BILLBOARDS)) add(`billboards.${t}`, lines);
for (const [t, lines] of Object.entries(TRACK_SIGNS)) add(`signs.${t}`, lines);
for (const [t, lines] of Object.entries(S.CALENDAR)) add(`calendar.${t}`, lines.flatMap((l) => [l.good, l.bad]));
for (const [g, lines] of Object.entries(S.GRADE_QUOTES)) add(`gradeQuotes.${g}`, lines);
add('grades', GRADES.map((g) => g.title));
add('achievements.name', ACHIEVEMENTS.map((a) => a.name));
add('bikes.blurb', Object.values(BIKES).map((b) => b.blurb));
add('announcer.alt', [...Object.values(S.ANNOUNCER), ...S.PLACE_CALLOUTS].flatMap((c) => c.alt));
for (const [cause, lines] of Object.entries(S.WRECK_LINES)) add(`wreck.${cause}`, lines);
add('credits.name', S.CREDITS.map(([, n]) => n));
add('credits.outro', [S.CREDIT_OUTRO]);
add('howto', [...S.HOWTO_BASICS, ...Object.values(S.HOWTO_SKILL_TIPS)]);
// Read-only context on the same screens (other units' text): content lines must not echo it.
const context = Object.values(TRACKS).map((t) => ({ where: `tracks.${t.id}.blurb`, text: t.blurb, mine: false }));
try {
  const { CITY_LINES, GANTRY } = await importTs('src/world/dressing/city/lines.ts');
  CITY_LINES.forEach((text, i) => context.push({ where: `env-city CITY_LINES[${i}]`, text, mine: false }));
  for (const [k, g] of Object.entries(GANTRY)) context.push({ where: `env-city GANTRY.${k}`, text: `${g.sub} ${g.backSub}`, mine: false });
} catch (err) {
  warnings.push(`context: env-city CITY_LINES not loaded (${err instanceof Error ? err.message : String(err)})`);
}
for (const { a, b, run } of nearDuplicates([...flavour, ...context])) {
  errors.push(`near-duplicate «${run}»: ${a.where} «${a.text}» ~ ${b.where} «${b.text}»`);
}
for (const t of templates(flavour)) errors.push(`template ${t}`);
for (const it of flavour) for (const issue of styleIssues(it)) errors.push(issue);
const pools = Object.values(ROSTER).map((def) => ({
  name: def.id, lines: [...Object.keys(LINE_COUNTS).flatMap((f) => def[f]), def.tagline],
}));
pools.push({ name: 'police', lines: Object.values(POLICE_LINES).flat() }, { name: 'tips', lines: TIPS },
  { name: 'billboards', lines: BILLBOARD_LINES }, { name: 'signs', lines: ROAD_SIGNS },
  ...Object.entries(S.GRADE_QUOTES).map(([g, lines]) => ({ name: `gradeQuotes.${g}`, lines })),
  { name: 'announcer', lines: [...Object.values(S.ANNOUNCER), ...S.PLACE_CALLOUTS].flatMap((c) => c.alt) },
  { name: 'wreck', lines: Object.values(S.WRECK_LINES).flat() }, { name: 'credits', lines: S.CREDITS.map(([, n]) => n) });
for (const t of Object.keys(TRACK_BILLBOARDS)) {
  pools.push({ name: `track.${t}`, lines: [...TRACK_BILLBOARDS[t], ...TRACK_SIGNS[t], ...S.CALENDAR[t].flatMap((l) => [l.good, l.bad])] });
}
for (const issue of oneNote(pools)) errors.push(`one-note ${issue}`);

// ---------------------------------------------------------------- report
const total = allText.length;
if (dump) for (const g of groups) console.log(`\n## ${g.name}\n${g.items.map((t) => `- ${t}`).join('\n')}`);
if (verbose) for (const g of groups) console.log(`${g.name.padEnd(24)} ${String(g.items.length).padStart(3)} lines · max ${Math.max(...g.items.map(width))}/${g.max} 字 · ${FONTS[g.font][0]}`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\ncontent-lint: ${total} strings in ${groups.length} groups · ${errors.length} errors · ${warnings.length} warnings`);
process.exitCode = errors.length ? 1 : 0;
