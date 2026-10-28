// UI copy owned by the content unit: how-to, credits, loading-calendar 宜/忌, grade quotes, announcer
// callouts and wreck lines. Screens/HUD read these; keep keys stable (add, never rename).
import type { CrashCause, TrackId } from '../core/types';
import { CALENDAR_LINES as GOBI_CALENDAR } from './track-content/gobi';
import { CALENDAR_LINES as WATERTOWN_CALENDAR } from './track-content/watertown';

// ---------------------------------------------------------------- how to play
export interface HowtoRow { keys: string; text: string }
export interface HowtoGroup { id: 'ride' | 'fight' | 'skill' | 'sys'; cn: string; en: string; rows: HowtoRow[] }

/** Keyboard legend (matches core/input.ts KEYMAP). */
export const HOWTO_KEYBOARD: HowtoGroup[] = [
  { id: 'ride', cn: '骑行', en: 'RIDE', rows: [
    { keys: 'W / ↑', text: '踩踏' }, { keys: 'S / ↓', text: '刹车' }, { keys: 'A D / ← →', text: '转向' },
    { keys: 'SHIFT + 转向', text: '漂移（松开加速）' }, { keys: 'SPACE', text: '跳跃' }, { keys: 'C', text: '回头看' },
  ] },
  { id: 'fight', cn: '战斗', en: 'FIGHT', rows: [
    { keys: 'J', text: '往左扇' }, { keys: 'L', text: '往右扇' }, { keys: 'K', text: '重击（自动挑边）' },
    { keys: 'B', text: '打铃嘲讽（+SP）' },
  ] },
  { id: 'skill', cn: '技能', en: 'SKILL', rows: [
    { keys: 'U', text: '咸鱼鱼雷' }, { keys: 'I', text: '大嘴吞噬' }, { keys: 'O', text: '翼展冲刺' },
    { keys: 'P', text: 'SHOWTIME（SP 满）' },
  ] },
  { id: 'sys', cn: '系统', en: 'SYSTEM', rows: [{ keys: 'ESC', text: '暂停 / 返回' }, { keys: 'ENTER', text: '确定' }] },
];

/** Gamepad legend (standard mapping, matches core/input.ts PADMAP). */
export const HOWTO_GAMEPAD: HowtoRow[] = [
  { keys: 'RT', text: '踩踏' }, { keys: 'LT', text: '刹车' }, { keys: '左摇杆', text: '转向（十字键 ←→ 亦可）' },
  { keys: 'RB', text: '漂移' }, { keys: 'A', text: '跳跃 / 确定' }, { keys: 'X', text: '往左扇' },
  { keys: 'B', text: '往右扇 / 返回' }, { keys: 'Y', text: '重击' }, { keys: 'LB', text: '咸鱼鱼雷' },
  { keys: '十字键 ↑', text: '大嘴吞噬' }, { keys: '十字键 ↓', text: '翼展冲刺' }, { keys: '右摇杆按下', text: 'SHOWTIME' },
  { keys: '左摇杆按下', text: '回头看' }, { keys: 'BACK', text: '打铃' }, { keys: 'START', text: '暂停' },
];

/** One-line usage hints per player skill (the skill's own desc lives in data/skills.ts). */
export const HOWTO_SKILL_TIPS: Record<string, string> = {
  'pelican.torpedo': '有人领先就放，它会自己找路。',
  'pelican.gulp': '鱼雷飞来？张嘴。小个子贴身？也张嘴。',
  'pelican.wing': '直道超车、冲散人堆，撞人不减速。',
  'pelican.ult': '等对手扎堆再放，一个都跑不了。',
};

/** Four lines for first-timers. */
export const HOWTO_BASICS: string[] = [
  '踩踏冲刺，漂移过弯，松开漂移键吃加速。',
  '左右扇人，重击打掉武器，空手就能抢过来。',
  '攒满 SP 就放大招：SHOWTIME，一锅端。',
  '警笛一响就加速：柯基警官专抓慢车。',
];

export const HOWTO_SP = '打人、挨打、击倒、蹭尾流、擦肩而过、完美落地、三段漂移、打铃，都能攒 SP。';

// ---------------------------------------------------------------- how to play: the r4 mechanics (SPEC §14–§21)
/** One card of the 「新玩法 NEW」 tab: the mechanic, its keys (keyboard and gamepad) and its rules. */
export interface HowtoNewCard {
  id: string;
  cn: string;
  en: string;
  /** Key chips: [keyboard, gamepad, what the key does]. */
  keys: Array<[kb: string, pad: string, text: string]>;
  lines: string[];
  /** A card that spans two columns of the grid. */
  wide?: boolean;
}

/** The r4 mechanics, one card each: the tricks, the throw, the weapon traits, the parry, the corgi, the
 *  bribe, STYLE, the rivals, the track events and the race options (SPEC §14–§21). */
export const HOWTO_NEW: HowtoNewCard[] = [
  { id: 'trick', cn: '空中特技', en: 'AIR TRICKS', keys: [
    ['SHIFT', 'RB', '+ 转向 = 转体 360°'],
    ['SHIFT + S', 'RB + LT', '= 后空翻'],
    ['SHIFT + SPACE', 'RB + A', '= 前空翻'],
    ['SHIFT', 'RB', '单独按 = 超人'],
  ], lines: ['一次腾空能连做，连做加分', '超人要在落地前松开', '没转完就落地 = 翻车'] },
  { id: 'throw', cn: '投掷', en: 'THROW', keys: [
    ['K', 'Y', '按住 = 投掷'],
    ['K + C', 'Y + L3', '松手时回头 = 往后扔'],
  ], lines: ['轻点 = 重击，按住 = 扔出去', '扔中对手 = 90 STYLE'] },
  { id: 'traits', cn: '武器特性', en: 'WEAPON TRAITS', wide: true, keys: [], lines: [
    '咸鱼：回旋镖，会飞回来',
    '法棍：硬核，必掉对手武器',
    '大葱：甩葱三连，第三下更疼',
    '雨伞：滑翔，空中飘着走',
    '自拍杆：闪光灯，打瞎 0.6 秒',
    '拖鞋：必中，追着你飞',
    '机械键盘：青轴，25% 暴击',
    '平底锅：完美格挡，见弹反',
  ] },
  { id: 'parry', cn: '平底锅弹反', en: 'PAN PARRY', keys: [
    ['J / L', 'X / B', '挨打前 0.15 秒内出手'],
  ], lines: ['当！——不掉血，攻击者晕 0.6 秒', '拿着锅本来就能挡掉 35%'] },
  { id: 'corgi', cn: '柯基警官', en: 'CORGI', keys: [], lines: [
    '★1 吹哨 · ★2 警棍 · ★3 增援',
    '头顶冒红「!」= 要抡警棍（0.45 秒）',
    '刹车 / 闪开 / 跳过去都能躲',
    '也能拿平底锅弹反',
    '把它打趴 = 柯基下班了',
  ] },
  { id: 'roadblock', cn: '★3 路障', en: 'ROADBLOCK', keys: [], lines: [
    '★3 会再叫来一只柯基',
    '前方设卡：只留 3.2 米缺口',
    '撞上去 = 罚款，钻缺口 = STYLE',
  ] },
  { id: 'bribe', cn: '「V我50」', en: 'BRIBE', keys: [
    ['B', 'BACK', '在柯基旁边打铃'],
  ], lines: ['★1–★2 才谈得拢，★3 没得谈', '要 50 小鱼干，当场少 50', '它说「……下不为例」'] },
  { id: 'style', cn: 'STYLE 连段', en: 'STYLE CHAIN', keys: [], lines: [
    '3 秒内连做动作就不断链',
    '动作越杂倍率越高，最高 ×4',
    '挨打 / 翻车 / 断 3 秒就断链',
    '结算给 SP 和小鱼干',
  ] },
  { id: 'nemesis', cn: '宿敌 · 围剿', en: 'NEMESIS', keys: [], lines: [
    '宿敌：仇记得越深，咬得越狠',
    '领先太多，他们临时结盟围剿',
    '盟友误伤 = 塑料友谊',
  ] },
  { id: 'events', cn: '赛道突发', en: 'TRACK EVENTS', keys: [], lines: [
    '鱼车侧翻：绕开，还能捡鱼干',
    '鹅群过马路：一只都别碰，穿过去有 STYLE',
    '施工改道：跟着锥桶走',
    '水果摊：撞摊子掉速，但有鱼干',
  ] },
  { id: 'modes', cn: '天气 · 反向 · 路线', en: 'RACE MODES', keys: [], lines: [
    '雨雪天气抓地力下降',
    '雾里看不清，跟着车灯',
    '反向：同一条路倒着骑',
    '随机路线：同种子同一条路',
  ] },
  // r6 (SPEC §24): the elements and the reactions they make.
  { id: 'elements', cn: '元素反应', en: 'REACTIONS', wide: true, keys: [], lines: [
    '火 + 水 = 蒸发：爆发伤害',
    '火 + 冰 = 融化：爆发伤害',
    '水 + 冰 = 冻结：冻住对方',
    '雷 + 水 = 感电：电流传给周围湿身的人',
    '雷 + 冰 = 超导：对方减速，护盾破碎',
    '雷 + 火 = 超载：爆炸掀开周围的人',
    '风 + 元素 = 扩散：元素吹给旁边的人',
    '火：烧，持续掉血',
    '冰：叠三层寒冷就冻住',
    '雷：留下感电标记',
    '水：淋湿；下雨天全员湿身',
  ] },
];

// ---------------------------------------------------------------- credits
export const CREDITS: Array<[role: string, name: string]> = [
  ['总导演', '一只想吃鱼的鹈鹕'],
  ['主演', '阿鹕（本色出演）'],
  ['反派', '鹅霸（不用演）'],
  // U+00A0 keeps "riding a bicycle" together, so the credits column wraps it into two balanced lines.
  ['提示词', 'Generate an SVG of a pelican riding\u00a0a\u00a0bicycle'],
  ['链条位置审核', '所有画过鹈鹕骑车的大模型'],
  ['物理顾问', '一颗掉下来的苹果'],
  ['大鹅协调员', '职位空缺（没人敢应聘）'],
  ['情绪管理', '卡皮巴拉本人'],
  ['首席转圈官', '哈基米'],
  ['墨镜赞助', '神烦狗的私人收藏'],
  ['准时到场率统计', '咕咕（报表已读未回）'],
  ['冰面采购', '滑总（至今未到货）'],
  ['餐饮', '薯条大盗（已自行取用）'],
  ['进度管理', '闪电（马……上……好……）'],
  ['交通安全顾问', '柯基警官'],
  ['动作指导', '一辆二八大杠'],
  ['特技替身', '一只橡皮鸭（全程淡定）'],
  ['音乐', '一台会放克的合成器'],
  ['柚子赞助', '卡皮头顶那颗'],
  ['咸鱼供应', '鹈鹕湾海鲜市场'],
  ['拖鞋提供', '每一位妈妈'],
  ['加班夜宵', '一锅鱼汤（来源不明）'],
  ['测试员', '摔了 999 次的阿鹕'],
  ['特别感谢', '正在玩这个游戏的你'],
];

export const CREDIT_OUTRO = '感谢观看。鹈鹕已回海边，大鹅仍在村口巡逻。';

// ---------------------------------------------------------------- loading calendar (宜 / 忌)
export interface CalendarLine { good: string; bad: string }

export const CALENDAR: Record<TrackId, CalendarLine[]> = {
  coast: [
    { good: '撞鹅', bad: '放鸽子' }, { good: '吃鱼', bad: '喂海鸥' }, { good: '漂移', bad: '踩刹车' },
    { good: '晒太阳', bad: '晒薯条' }, { good: '张大嘴', bad: '闭嘴' }, { good: '蹭尾流', bad: '蹭护栏' },
    { good: '冲线', bad: '冲进海里' }, { good: '打铃', bad: '惹大鹅' }, { good: '翻身', bad: '翻车' },
    { good: '抢先', bad: '被抢薯条' },
  ],
  city: [
    { good: '夜骑', bad: '熬夜加班' }, { good: '开灯', bad: '摸黑漂移' }, { good: '甩尾', bad: '甩锅' },
    { good: '躺赢', bad: '躺平' }, { good: '超车', bad: '超速' }, { good: 'City Ride', bad: 'City Walk' },
    { good: '带伞', bad: '当落汤鹈' }, { good: '吃夜宵', bad: '吃罚单' }, { good: '当显眼包', bad: '当背景板' },
    { good: '卷对手', bad: '卷自己' },
  ],
  mountain: [
    { good: '看日落', bad: '看手机' }, { good: '漂着过弯', bad: '直线过弯' }, { good: '飞跃', bad: '飞出护栏' },
    { good: '下坡加速', bad: '上坡逞强' }, { good: '进隧道', bad: '隧道里唱歌' }, { good: '出片', bad: '糊片' },
    { good: '特种兵骑行', bad: '中途下车' }, { good: '腾空', bad: '空中犹豫' }, { good: '等日落', bad: '等鸽子' },
    { good: '问路', bad: '问大鹅' },
  ],
  watertown: WATERTOWN_CALENDAR,
  gobi: GOBI_CALENDAR,
};

/** Today's 宜/忌 for a track: stable for the whole day, different from day to day. */
export function calendarFor(trackId: TrackId, date: Date): CalendarLine {
  const list = CALENDAR[trackId];
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return list[((day % list.length) + list.length) % list.length] ?? { good: '骑车', bad: '摸鱼' };
}

// ---------------------------------------------------------------- grade quotes (results stamp)
export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

/** Lines that fit every finish able to earn the grade (ui/progress.ts gradeFor: S is always a win, so S may
 *  claim it; A is a win or a podium, B–D any place). Place-specific lines live in GRADE_QUOTES_PLACE. */
export const GRADE_QUOTES: Record<GradeLetter, string[]> = {
  S: ['这条路，以后就叫鹈鹕大道。', '路宽，鱼多，你最快。', '连大鹅都闭嘴了。'],
  A: ['鱼塘里，你说了算。', '离封神，只差一口气。', '这成绩，够吃一个月的鱼。'],
  B: ['平平无奇，但鱼照吃。', '中规中矩，像一条认真的鱼。', '普通，但普通得很稳。'],
  C: ['状态请假了，明天补上。', '人和车都没事，挺好。', '咕咕表示：欢迎入群。'],
  D: ['下一局，从翻身开始。', '没关系，咸鱼晒晒更香。', '躺平不可耻，记得起来就行。'],
};

/** Extra lines for one finish only, mixed into the grade's pool: `win` = 1st place, `podium` = 2nd / 3rd. */
export const GRADE_QUOTES_PLACE: Partial<Record<GradeLetter, { win?: string[]; podium?: string[] }>> = {
  A: { win: ['赢是赢了，还不够凶。', '冠军到手，下回连鹅一起收。'], podium: ['再快半秒，就封神了。', '领奖台上，嘴最大的是你。'] },
  B: { podium: ['上台了，鱼照领。'] },
};

// ---------------------------------------------------------------- announcer callouts
/** cn = big splash text, en = P5 caption, voice = data/voice.ts clip id when one exists, alt = flavour sub-lines. */
export interface Callout { cn: string; en: string; voice?: string; alt: string[] }

export type CalloutId =
  | 'count3' | 'count2' | 'count1' | 'go' | 'ko' | 'double' | 'triple' | 'multi' | 'showtime' | 'perfect'
  | 'finalStretch' | 'busted' | 'wrecked' | 'comeback' | 'nearMiss' | 'oneMore' | 'lead' | 'finish' | 'perfectStart';

export const ANNOUNCER: Record<CalloutId, Callout> = {
  count3: { cn: '三！', en: '3', voice: 'ann_3', alt: ['握紧车把！'] },
  count2: { cn: '二！', en: '2', voice: 'ann_2', alt: ['张开大嘴！'] },
  count1: { cn: '一！', en: '1', voice: 'ann_1', alt: ['现在踩踏！'] },
  go: { cn: '冲！', en: 'GO!', voice: 'ann_go', alt: ['出发！鱼在前方！', '冲！别回头！'] },
  ko: { cn: '击倒！', en: 'KNOCK OUT!', voice: 'ann_ko', alt: ['躺好别动！', '这下老实了！', '送你下车！'] },
  double: { cn: '双杀！', en: 'DOUBLE KNOCK OUT!', voice: 'ann_double', alt: ['买一送一！', '成双成对！'] },
  triple: { cn: '三杀！', en: 'TRIPLE KNOCK OUT!', voice: 'ann_triple', alt: ['帽子都不够戴了！', '整整齐齐！'] },
  multi: { cn: '超神！', en: 'UNSTOPPABLE!', alt: ['谁来管管这只鹈鹕！', '没有人能拦住你！'] },
  showtime: { cn: 'SHOWTIME！', en: 'SHOWTIME!', voice: 'ann_showtime', alt: ['鹈鹕天降！', '抬头！是鹈鹕！'] },
  perfect: { cn: '完美落地！', en: 'PERFECT!', voice: 'ann_perfect', alt: ['十分！', '裁判给满分！'] },
  finalStretch: { cn: '最后冲刺！', en: 'FINAL STRETCH!', voice: 'ann_final', alt: ['终点就在眼前！', '最后一口气！'] },
  busted: { cn: '被抓了！', en: 'BUSTED!', voice: 'ann_busted', alt: ['小鱼干，又少了。', '态度良好，照罚不误。'] },
  wrecked: { cn: '翻车了！', en: 'WRECKED', voice: 'ann_wrecked', alt: ['人仰车翻……', '这不怪你，怪大鹅。'] },
  comeback: { cn: '逆袭！', en: 'COMEBACK!', alt: ['逆风翻盘！', '从最后杀上来了！'] },
  nearMiss: { cn: '好险！', en: 'NEAR MISS!', voice: 'ann_nearmiss', alt: ['心跳漏了一拍！', '差点就亲上了！'] },
  oneMore: { cn: 'ONE MORE！', en: 'ONE MORE!', voice: 'ann_onemore', alt: ['手感来了！', '连击停不下来！'] },
  lead: { cn: '领先了！', en: 'TAKE THE LEAD!', voice: 'ann_lead', alt: ['跑在最前面！', '这里风景最好！'] },
  finish: { cn: '冲线！', en: 'FINISH!', voice: 'ann_finish', alt: ['到站了！', '这一路，值了！'] },
  perfectStart: { cn: '完美起步！', en: 'PERFECT START!', alt: ['反应神速！'] },
};

/** Finish splash by place (index 0 = 1st). */
export const PLACE_CALLOUTS: Callout[] = [
  { cn: '第一名！', en: '1ST', voice: 'ann_place1', alt: ['鱼和荣耀，都是你的！'] },
  { cn: '第二名！', en: '2ND', voice: 'ann_place2', alt: ['银牌也能换不少鱼。'] },
  { cn: '第三名！', en: '3RD', voice: 'ann_place3', alt: ['领奖台，有你的位置。'] },
  { cn: '第四名', en: '4TH', alt: ['离领奖台，只差一步。'] },
  { cn: '第五名', en: '5TH', alt: ['中间位置，视野最好。'] },
  { cn: '第六名', en: '6TH', alt: ['六六大顺，下把更顺。'] },
  { cn: '第七名', en: '7TH', alt: ['至少，你没垫底。'] },
  { cn: '第八名', en: '8TH', alt: ['倒数第一，也是第一。'] },
];

// ---------------------------------------------------------------- r4 race HUD (SPEC §14–§19)
/** Copy for the r4 in-race HUD: police, tricks, STYLE, weapons, rivals and track events. */
export const R4_HUD = {
  wanted: { en: 'WANTED', cn: '通缉' },
  roadblock: { en: 'ROADBLOCK', cn: '前方设卡！' },
  policeDown: { en: 'OFF DUTY', cn: '柯基下班了！' },
  bribeOk: 'BRIBE',
  bribeNo: { en: 'NO DEAL', cn: '这次不行！' },
  throw: { en: 'THROW', cn: '投掷', hold: '按住' },
  parry: { en: 'PARRY!', cn: '当！' },
  nemesis: { en: 'NEMESIS', cn: '宿敌' },
  alliance: { en: 'SQUAD', cn: '围剿！' },
  betrayal: { en: 'BROKEN', cn: '塑料友谊！' },
  style: 'STYLE',
  trickFail: { en: 'FAIL', cn: '失败' },
  trick: {
    spin: { en: '360°', cn: '360°' },
    backflip: { en: 'BACKFLIP', cn: '后空翻' },
    frontflip: { en: 'FRONTFLIP', cn: '前空翻' },
    superman: { en: 'SUPERMAN', cn: '超人' },
  },
  event: {
    fishSpill: { en: 'FISH SPILL', cn: '前方鱼车侧翻！小心路滑' },
    geese: { en: 'GEESE', cn: '前方鹅群过马路！' },
    roadworks: { en: 'ROADWORKS', cn: '前方施工！' },
    stalls: { en: '', cn: '' },   // the market stalls warn nobody (SPEC §19)
  },
} as const;

/** WRECKED splash sub-lines by crash cause. */
export const WRECK_LINES: Record<CrashCause, string[]> = {
  ko: ['眼前全是小鱼干……', '天上怎么全是星星……', '这一下，记住了……'],
  traffic: ['汽车：我也没想到……', '和汽车比了比硬度……', '请勿与汽车争道……'],
  wall: ['墙：你礼貌吗？', '护栏不是用来抱的……', '和护栏贴贴了……'],
  water: ['下海喂鱼了……', '原来是去捞鱼了……', '顺便洗了个澡……'],
  obstacle: ['锥桶表示很无辜……', '路障：站着也有错？', '落地姿势……很有创意……'],
  skill: ['技能说明，没骗人……', '技能太强，不怪你……', '这招……没见过……'],
  police: ['警官：请出示鱼证……', '配合执法中……', '罚单比车还长……'],
  trick: ['后空翻……翻过头了……', '落地这件事，下次一定……', '特技演员需要休息……'],
};
