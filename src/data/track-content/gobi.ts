// 戈壁公路 GOBI HIGHWAY (r4, SPEC §20): menu text, billboard / sign lines and the loading calendar
// for this track. The gobi's voice: dry, hot, and quietly funny about the fact that the road is
// just sand and the wind.
import type { CalendarLine } from '../strings';
import type { TrackInfo } from '../tracks';

export const INFO: TrackInfo = {
  id: 'gobi', name: '戈壁公路', nameEn: 'GOBI HIGHWAY', blurb: '风很大，路很直，鹈鹕很渺小。',
  weather: '晴 · 风沙 4 级', lengthKm: 3.8, difficulty: 2,
};

/** Billboards (≤ 14 字): fake ads for a place where only sand and wind live. */
export const BILLBOARDS: string[] = [
  '戈壁欢迎你 前面还有戈壁',
  '加油站 今日油价：一条鱼',
  '骆驼优先 鹈鹕靠边',
  '风车在转 你在发呆',
  '前方加油站 200 公里（可能不准）',
  '跳沙丘不加分 摔沙丘扣鱼干',
  '今日宜：疾驰 忌：追骆驼',
  '此路段 无鹅 无海鸥 只有热风',
];

/** Road signs (≤ 10 字). */
export const SIGNS: string[] = [
  '注意风沙', '骆驼出没', '前方直道', '补水点 ←',
];

/** The loading calendar: 宜 / 忌 of the day on the gobi highway. */
export const CALENDAR_LINES: CalendarLine[] = [
  { good: '直线冲刺', bad: '迎风骑行' }, { good: '跳沙丘', bad: '陷进沙里' },
  { good: '喝水', bad: '晒太阳' }, { good: '追骆驼', bad: '超过骆驼' },
  { good: '钻风车', bad: '钻沙尘暴' }, { good: '加油', bad: '加错油' },
  { good: '吃鱼干', bad: '吃沙子' }, { good: '压弯', bad: '压骆驼' },
  { good: '看日落', bad: '看手机' }, { good: '冲线', bad: '冲进沙里' },
];
