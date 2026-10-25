// 江南水乡 WATER TOWN (r4, SPEC §20): menu text, billboard / sign lines and the loading calendar.
import type { CalendarLine } from '../strings';
import type { TrackInfo } from '../tracks';

export const INFO: TrackInfo = {
  id: 'watertown', name: '江南水乡', nameEn: 'WATER TOWN', blurb: '小桥流水人家，鹈鹕骑车经过。',
  weather: '小雨 · 梅雨季', lengthKm: 3.2, difficulty: 2,
};

/** The town's posters: ≤ 14 字 (a space is the preferred line break). */
export const BILLBOARDS: string[] = [
  '水乡欢迎你 慢慢骑', '咸鱼干铺 今日新货', '前方石桥 请勿飞驰', '乌篷船出租 老板不催',
  '桥上禁止摆摊 会被抢', '雨伞买三把 送一把', '茶馆二两 老板请客', '水上公交 只到桥那边',
];

/** The town's road signs: ≤ 10 字. */
export const SIGNS: string[] = ['石桥 慢行', '码头 ←', '小心路滑', '前方茶馆'];

/** The loading calendar: 今日宜 / 今日忌. */
export const CALENDAR_LINES: CalendarLine[] = [
  { good: '漂移', bad: '落水' },
  { good: '撑伞', bad: '淋雨' },
  { good: '过桥', bad: '撞桥墩' },
  { good: '喝奶茶', bad: '空腹' },
  { good: '钓咸鱼', bad: '喂猫' },
  { good: '划乌篷船', bad: '跳水' },
  { good: '看白墙', bad: '数青瓦' },
  { good: '压马路', bad: '压水花' },
  { good: '甩尾', bad: '甩鱼' },
  { good: '抢鱼干', bad: '抢航道' },
];
