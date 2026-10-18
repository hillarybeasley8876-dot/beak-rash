// Repetition checks for content-lint.mjs: near-duplicates the exact-duplicate check cannot see, one-note
// pools (a single gag in too many lines), dated memes, the 不是…是 tic and doge punctuation.
// Tokens: a CJK glyph or a Latin word is one token; punctuation, spaces and the sloth's …… are ignored.
// Names and game terms (TERMS) fold into one token each, so two lines that merely share 柯基警官 do not
// match, but 柯基警官 + three more shared glyphs do.

/** Shared token runs this long (or longer) between two lines are near-duplicates. */
export const RUN = 4;

/** Proper names, skill names and game terms: one token each. */
const TERMS = [
  'Generate an SVG of a pelican riding a bicycle', '暴力鹈鹕', 'BEAK RASH', '柯基警官', '薯条大盗', '卡皮巴拉', '哈基米', '神烦狗', '二八大杠',
  '咸鱼鱼雷', '大嘴吞噬', '翼展冲刺', '妈妈的拖鞋', '儿童滑步车', '共享单车', '双人协力车', '山地车', '公路车',
  '完美落地', '完美起步', '最后冲刺', '擦肩而过', '小鱼干', '鹈鹕湾', '霓虹夜城', '落日山道', '下次一定',
  'ONE MORE', 'SHOWTIME', 'PERFECT', '领奖台', '第一名', '冠军', '鹈鹕骑车', '骑自行车', '海鲜市场',
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
const TERM_RE = new RegExp([...TERMS].sort((a, b) => b.length - a.length).map(escape).join('|'), 'gi');
const termChar = (m) => String.fromCodePoint(0xe000 + TERMS.findIndex((t) => t.toLowerCase() === m.toLowerCase().replace(/\s+/g, ' ')));

/** Token list of a line (see header). */
export function tokens(text) {
  const folded = text.replace(TERM_RE, termChar).toLowerCase();
  return Array.from(folded.matchAll(/[\ue000-\uf8ff]|[a-z0-9]+|\p{Script=Han}/gu), (m) => m[0]);
}

/** A token run back as readable text (Latin words keep their spaces). */
const show = (toks) => toks.reduce((out, t, i) => {
  const word = /[\ue000-\uf8ff]/.test(t) ? TERMS[t.codePointAt(0) - 0xe000] : t;
  const latin = /^[a-z0-9]/i.test(word) && i > 0 && /[a-z0-9]$/i.test(out);
  return out + (latin ? ' ' : '') + word;
}, '');

/** Longest shared token run of two token lists. */
function longestRun(a, b) {
  let best = [0, 0];
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = b.length; j >= 1; j--) {
      prev[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
      if (prev[j] > best[0]) best = [prev[j], i];
    }
  }
  return a.slice(best[1] - best[0], best[1]);
}

/**
 * Near-duplicate pairs among `items` ({ where, text, mine }): every pair of lines sharing a run of ≥ RUN
 * tokens, reported once per pair. `mine: false` marks read-only context (other units' text): a pair of two
 * context lines is never reported.
 */
export function nearDuplicates(items) {
  const byGram = new Map();
  items.forEach((it, i) => {
    const t = tokens(it.text);
    const seen = new Set();
    for (let k = 0; k + RUN <= t.length; k++) {
      const gram = t.slice(k, k + RUN).join('\u0001');
      if (seen.has(gram)) continue;
      seen.add(gram);
      if (!byGram.has(gram)) byGram.set(gram, []);
      byGram.get(gram).push(i);
    }
  });
  const pairs = new Map();
  for (const [gram, owners] of byGram) {
    for (let a = 0; a < owners.length; a++) {
      for (let b = a + 1; b < owners.length; b++) {
        const [i, j] = [owners[a], owners[b]];
        if (items[i].text === items[j].text && items[i].where === items[j].where) continue;
        if (!items[i].mine && !items[j].mine) continue;
        const key = `${i}:${j}`;
        if (!pairs.has(key)) pairs.set(key, { a: items[i], b: items[j], run: show(longestRun(tokens(items[i].text), tokens(items[j].text))) });
      }
    }
  }
  return [...pairs.values()];
}

/**
 * One-note limits: at most `max` (a fraction of the pool, floored, at least 1) lines of a pool may match `re`.
 * `pools` names which pools a gag is capped in ('*' = all, '!x' = all but pool x).
 */
export const GAGS = [
  { gag: '鹅', re: /鹅|HONK|嘎/i, max: 0.1, pools: ['!goose'] },
  { gag: '鸽', re: /鸽|咕/, max: 0.1, pools: ['!pigeon'] },
  { gag: '咸鱼', re: /咸鱼(?!鱼雷)/, max: 0.1, pools: ['*'] },
  { gag: '嘴', re: /嘴/, max: 0.1, pools: ['!pelican'] },
  { gag: '嘴 / 喉囊', re: /嘴|喉囊/, max: 0.25, pools: ['pelican'] },
  { gag: '迟到 / 下次', re: /下次|在路上|迟到|准时|鸽了|放鸽|没鸽|被鸽|改天|说好|马上/, max: 0.35, pools: ['pigeon'] },
  { gag: '冰 / 冷静 / 优雅', re: /冰|冷|优雅/, max: 0.25, pools: ['penguin'] },
  { gag: '狗头', re: /狗头/, max: 0.2, pools: ['shiba'] },
  { gag: '急', re: /急/, max: 0.2, pools: ['capybara'] },
  { gag: '腿短', re: /腿/, max: 0.2, pools: ['corgi'] },
];

const applies = (pools, name) => pools.some((p) => p === '*' || p === name) || (pools.every((p) => p.startsWith('!')) && !pools.includes(`!${name}`));

/** Gag counts over the limit, per pool ({ name, lines }). */
export function oneNote(pools) {
  const out = [];
  for (const { name, lines } of pools) {
    for (const g of GAGS) {
      if (!applies(g.pools, name)) continue;
      const hits = lines.filter((l) => g.re.test(l));
      const cap = Math.max(1, Math.floor(g.max * lines.length + 1e-9));
      if (hits.length > cap) out.push(`${name}: ${hits.length}/${lines.length} lines on ${g.gag} (max ${cap}): ${hits.map((l) => `«${l}»`).join(' ')}`);
    }
  }
  return out;
}

/** Memes the meme critic called dated (2016–2021); a line may keep one only if it is listed in `allow`. */
const DATED = ['了解一下', '我全都要', '永远的神', '还有谁', '飘了', '落地成盒', '秋名山', '不存在的', '亿点点', '稳如老狗',
  'C 位', '承包', '全村的', '怀疑人生', '有点东西', '全家桶', '城市套路深'];

/** The "不是 X，是 Y" / "不叫 X，叫 Y" template the brief bans (AI-tic punchlines). */
const TICS = [/不是[^。！？…]{0,12}[，,]\s*(而)?是/, /不叫[^。！？…]{0,10}[，,]\s*叫/];

/** Style problems in one line: dated memes, the 不是…是 tic, and doge lines that end on a full-width 。. */
export function styleIssues({ where, text, speaker }, allow = []) {
  const out = [];
  for (const d of DATED) if (text.includes(d) && !allow.includes(text)) out.push(`${where}: dated meme «${d}» in «${text}»`);
  for (const re of TICS) if (re.test(text)) out.push(`${where}: 不是…是 template in «${text}» (make it a straight punchline)`);
  if (speaker === 'shiba' && text.includes('。')) out.push(`${where}: doge lines use ASCII '.' («${text}»)`);
  return out;
}

/** Short set phrases the critic saw recycled: each may appear in one line of the whole flavour corpus. */
const TEMPLATES = ['热身', '启动', '让一让', '骄傲', '这叫', '我只是', '意不意外', '会回来', '记住你', '专业', '就完事了',
  '一网打尽', '主角光环', '承让', '你等着', '为所欲为', '从不迟到', '起飞'];

/** Template phrases used in more than one line. */
export function templates(items) {
  const out = [];
  for (const t of TEMPLATES) {
    const hits = items.filter((it) => it.mine !== false && it.text.includes(t));
    if (hits.length > 1) out.push(`«${t}» in ${hits.length} lines: ${hits.map((h) => `${h.where} «${h.text}»`).join(' · ')}`);
  }
  return out;
}
