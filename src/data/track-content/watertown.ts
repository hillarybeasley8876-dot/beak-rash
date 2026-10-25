// 江南水乡 WATER TOWN (r4, SPEC §20): menu text, billboard / sign lines and the loading calendar for this track.
// Scaffold content — the watertown track job owns this file and writes the real lines.
import type { CalendarLine } from '../strings';
import type { TrackInfo } from '../tracks';

export const INFO: TrackInfo = {
  id: 'watertown', name: '江南水乡', nameEn: 'WATER TOWN', blurb: '小桥流水人家，鹈鹕骑车经过。',
  weather: '小雨 · 梅雨季', lengthKm: 3.2, difficulty: 2,
};

export const BILLBOARDS: string[] = ['水乡欢迎你', '小心落水', '鹈鹕禁止捕鱼', '乌篷船 出租'];

export const SIGNS: string[] = ['石桥 慢行', '码头 ←', '小心路滑', '前方茶馆'];

export const CALENDAR_LINES: CalendarLine[] = [
  { good: '漂移', bad: '落水' }, { good: '撑伞', bad: '淋雨' }, { good: '过桥', bad: '撞桥墩' },
];
