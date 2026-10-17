// UI copy owned by the content unit: how-to, credits, loading-calendar 宜/忌, grade quotes, announcer
// callouts and wreck lines. Screens/HUD read these; keep keys stable (add, never rename).
import type { CrashCause, TrackId } from '../core/types';

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
  'pelican.ult': '等对手扎堆再放，一网打尽。',
};

/** Four lines for first-timers. */
export const HOWTO_BASICS: string[] = [
  '踩踏冲刺，漂移过弯，松开漂移键吃加速。',
  '左右扇人，重击打掉武器，空手就能抢过来。',
  '攒满 SP 按 P：SHOWTIME，前方对手一网打尽。',
  '别被柯基警官追上：停下来，罚单就到了。',
];

export const HOWTO_SP = '打人、挨打、击倒、蹭尾流、擦肩而过、完美落地、三段漂移、打铃，都能攒 SP。';

// ---------------------------------------------------------------- credits
export const CREDITS: Array<[role: string, name: string]> = [
  ['总导演', '一只想吃鱼的鹈鹕'],
  ['主演', '阿鹕（本色出演）'],
  ['反派', '鹅霸（也是本色出演）'],
  ['提示词', 'Generate an SVG of a pelican riding a bicycle'],
  ['链条位置审核', '所有画过鹈鹕骑车的大模型'],
  ['物理顾问', '牛顿的苹果（未到场）'],
  ['大鹅协调员', '职位空缺（没人敢应聘）'],
  ['情绪管理', '卡皮巴拉本人'],
  ['首席转圈官', '哈基米'],
  ['墨镜赞助', '神烦狗的私人收藏'],
  ['准时到场率统计', '咕咕（下次一定）'],
  ['冰面采购', '滑总（至今未到货）'],
  ['餐饮', '薯条大盗（已自行取用）'],
  ['进度管理', '闪电（马……上……好……）'],
  ['交通安全顾问', '柯基警官'],
  ['动作指导', '一辆二八大杠'],
  ['特技替身', '没请，都是真摔（假的）'],
  ['音乐', '一台会放克的合成器'],
  ['柚子赞助', '卡皮头顶那颗'],
  ['咸鱼供应', '鹈鹕湾海鲜市场'],
  ['拖鞋提供', '每一位妈妈'],
  ['加班夜宵', '小鱼干（已被海鸥吃完）'],
  ['测试员', '摔了 999 次的阿鹕'],
  ['特别感谢', '正在玩这个游戏的你'],
];

export const CREDIT_OUTRO = '本游戏中没有任何真实鹈鹕受到伤害。大鹅表示保留追究的权利。';

// ---------------------------------------------------------------- loading calendar (宜 / 忌)
export interface CalendarLine { good: string; bad: string }

export const CALENDAR: Record<TrackId, CalendarLine[]> = {
  coast: [
    { good: '撞鹅', bad: '放鸽子' }, { good: '吃鱼', bad: '喂海鸥' }, { good: '漂移', bad: '踩刹车' },
    { good: '晒太阳', bad: '晒薯条' }, { good: '张大嘴', bad: '闭嘴' }, { good: '蹭尾流', bad: '蹭护栏' },
    { good: '冲线', bad: '冲进海里' }, { good: '打铃', bad: '惹大鹅' }, { good: '咸鱼翻身', bad: '翻车' },
    { good: '抢先', bad: '被抢薯条' },
  ],
  city: [
    { good: '夜骑', bad: '熬夜加班' }, { good: '开灯', bad: '鹅叫扰民' }, { good: '甩尾', bad: '甩锅' },
    { good: '躺赢', bad: '躺平' }, { good: '超车', bad: '超速' }, { good: '撞鹅', bad: '撞广告牌' },
    { good: '带伞', bad: '淋雨' }, { good: '吃夜宵', bad: '吃罚单' }, { good: '发光', bad: '发呆' },
    { good: '卷对手', bad: '卷自己' },
  ],
  mountain: [
    { good: '看日落', bad: '看手机' }, { good: '漂移过弯', bad: '直线过弯' }, { good: '飞跃', bad: '飞出护栏' },
    { good: '下坡加速', bad: '下坡躺平' }, { good: '进隧道', bad: '在隧道里鹅叫' }, { good: '登高', bad: '恐高' },
    { good: '拍风景', bad: '拍护栏' }, { good: '腾空', bad: '落地成盒' }, { good: '等日落', bad: '等鸽子' },
    { good: '问路', bad: '问大鹅' },
  ],
};

/** Today's 宜/忌 for a track: stable for the whole day, different from day to day. */
export function calendarFor(trackId: TrackId, date: Date): CalendarLine {
  const list = CALENDAR[trackId];
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return list[((day % list.length) + list.length) % list.length] ?? { good: '骑车', bad: '摸鱼' };
}

// ---------------------------------------------------------------- grade quotes (results stamp)
export const GRADE_QUOTES: Record<'S' | 'A' | 'B' | 'C' | 'D', string[]> = {
  S: ['这条路，以后就叫鹈鹕大道。', '嘴大，路宽，鱼管够。', '连大鹅都闭嘴了。'],
  A: ['鱼塘里，你说了算。', '离神只差一条咸鱼。', '再张大一点嘴，就是神。'],
  B: ['平平无奇，但鱼照吃。', '中规中矩，像一条认真的鱼。', '普通，但普通得很稳。'],
  C: ['状态说：下次一定。', '发挥被鸽了，人没事就好。', '咕咕表示：欢迎入群。'],
  D: ['咸鱼也有梦想，先翻个身。', '没关系，咸鱼晒晒更香。', '躺平不可耻，记得起来就行。'],
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
  go: { cn: '冲！', en: 'GO!', voice: 'ann_go', alt: ['出发！鱼在前方！', '冲就完事了！'] },
  ko: { cn: '击倒！', en: 'KNOCK OUT!', voice: 'ann_ko', alt: ['一嘴入魂！', '躺好别动！', '下车休息！'] },
  double: { cn: '双杀！', en: 'DOUBLE KNOCK OUT!', voice: 'ann_double', alt: ['一鱼两吃！', '买一送一！'] },
  triple: { cn: '三杀！', en: 'TRIPLE KNOCK OUT!', voice: 'ann_triple', alt: ['一条龙服务！', '全家桶！'] },
  multi: { cn: '超神！', en: 'UNSTOPPABLE!', alt: ['鹈鹕之神降临！', '没有人能拦住你！'] },
  showtime: { cn: 'SHOWTIME！', en: 'SHOWTIME!', voice: 'ann_showtime', alt: ['鹈鹕天降！', '从天而降的鱼！'] },
  perfect: { cn: '完美落地！', en: 'PERFECT!', voice: 'ann_perfect', alt: ['稳如老狗！', '十分！'] },
  finalStretch: { cn: '最后冲刺！', en: 'FINAL STRETCH!', voice: 'ann_final', alt: ['终点就在眼前！', '最后一口气！'] },
  busted: { cn: '被抓了！', en: 'BUSTED!', voice: 'ann_busted', alt: ['罚单请收好。', '我错了警官！'] },
  wrecked: { cn: '翻车了！', en: 'WRECKED', voice: 'ann_wrecked', alt: ['人仰车翻……', '这不怪你，怪大鹅。'] },
  comeback: { cn: '逆袭！', en: 'COMEBACK!', alt: ['咸鱼翻身！', '从最后杀上来了！'] },
  nearMiss: { cn: '好险！', en: 'NEAR MISS!', voice: 'ann_nearmiss', alt: ['擦肩而过！', '就差亿点点！'] },
  oneMore: { cn: 'ONE MORE！', en: 'ONE MORE!', voice: 'ann_onemore', alt: ['再来一下！', '连击停不下来！'] },
  lead: { cn: '领先了！', en: 'TAKE THE LEAD!', voice: 'ann_lead', alt: ['跑在最前面！', '这里风景最好！'] },
  finish: { cn: '冲线！', en: 'FINISH!', voice: 'ann_finish', alt: ['到站了！', '比赛结束！'] },
  perfectStart: { cn: '完美起步！', en: 'PERFECT START!', alt: ['赢在起跑线！'] },
};

/** Finish splash by place (index 0 = 1st). */
export const PLACE_CALLOUTS: Callout[] = [
  { cn: '第一名！', en: '1ST', voice: 'ann_place1', alt: ['鱼和荣耀，都是你的！'] },
  { cn: '第二名！', en: '2ND', voice: 'ann_place2', alt: ['就差一张嘴的距离。'] },
  { cn: '第三名！', en: '3RD', voice: 'ann_place3', alt: ['领奖台，有你的位置。'] },
  { cn: '第四名', en: '4TH', alt: ['离领奖台，只差一步。'] },
  { cn: '第五名', en: '5TH', alt: ['不上不下，刚刚好。'] },
  { cn: '第六名', en: '6TH', alt: ['中游选手，稳住。'] },
  { cn: '第七名', en: '7TH', alt: ['至少，你没垫底。'] },
  { cn: '第八名', en: '8TH', alt: ['重在参与，鱼照样吃。'] },
];

/** WRECKED splash sub-lines by crash cause. */
export const WRECK_LINES: Record<CrashCause, string[]> = {
  ko: ['被打下车了……', '被揍趴下了……', '眼前全是小鱼干……'],
  traffic: ['撞车了……', '和汽车比了比硬度……', '请勿与汽车争道……'],
  wall: ['亲吻护栏……', '墙：你礼貌吗？', '护栏不是用来抱的……'],
  water: ['下海喂鱼了……', '原来是去捞鱼了……', '海水有点咸……'],
  obstacle: ['人仰车翻……', '路障赢了……', '落地姿势不对……'],
  skill: ['中招翻车……', '被技能送走了……', '技能太强，不怪你……'],
  police: ['被柯基警官拦下……', '配合执法中……', '罚单比车还长……'],
};
