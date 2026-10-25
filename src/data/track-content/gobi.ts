// 戈壁公路 GOBI HIGHWAY (r4, SPEC §20): menu text, billboard / sign lines and the loading calendar for this track.
// Scaffold content — the gobi track job owns this file and writes the real lines.
import type { CalendarLine } from '../strings';
import type { TrackInfo } from '../tracks';

export const INFO: TrackInfo = {
  id: 'gobi', name: '戈壁公路', nameEn: 'GOBI HIGHWAY', blurb: '风很大，路很直，鹈鹕很渺小。',
  weather: '晴 · 风沙 4 级', lengthKm: 3.8, difficulty: 2,
};

export const BILLBOARDS: string[] = ['戈壁欢迎你', '前方加油站 200 公里', '骆驼优先', '风车 正在发电'];

export const SIGNS: string[] = ['注意风沙', '骆驼出没', '前方直道', '补水点 ←'];

export const CALENDAR_LINES: CalendarLine[] = [
  { good: '直线冲刺', bad: '迎风骑行' }, { good: '跳沙丘', bad: '陷进沙里' }, { good: '喝水', bad: '晒太阳' },
];
