// Sunset Pass mark dispatcher: turns the layout's scenery marks into dressing calls. Landmark marks
// run first (they claim their footprint), then the village, then signs.
import { ROAD_SIGNS, TRACK_SIGNS } from '../../../data/memes';
import { roundSignFace, warnFace } from '../../scenery/signs/faces';
import { stands } from '../coast/event';
import { warning } from '../coast/signage';
import type { Dress } from '../dress';
import type { Mark } from '../../layout/build';
import { cowPasture, teaTerraces } from './farm';
import { gorgeBridge, waterfall } from './gorge';
import { hotSpring, pagodaViewpoint, prayerFlagLine } from './landmarks';
import { chevronRow, roadSign, scenicSign, signAt } from './signage';
import { houses, lanternGantry, lanternPosts, lanternStrings } from './village';

const ORDER = ['gorgeBridge', 'waterfall', 'pagoda', 'hotSpring', 'teaTerraces', 'cows', 'startGantry', 'finishGantry', 'stands', 'houses'];
const rank = (m: Mark): number => {
  const i = ORDER.indexOf(m.kind);
  return i < 0 ? ORDER.length : i;
};

/** Every text a mark may draw (font preloading). */
export const MARK_TEXTS = [
  ...ROAD_SIGNS, ...TRACK_SIGNS.mountain, '注意落石石飞前方起飞跳跳台 · 别怂限速随缘鹕鹈鹕出没', '卡皮巴拉温泉情绪稳定包月价♨',
  'START暴力鹈鹕 · 落日山道 SUNSET PASS', 'FINISH终点 · 日落前到家 GG 落日山道 欢迎再来',
];

function dispatch(d: Dress, m: Mark): void {
  const side: -1 | 1 = m.x < 0 ? -1 : 1;
  const len = typeof m.data.len === 'number' ? m.data.len : 100;
  const every = typeof m.data.every === 'number' ? m.data.every : 24;
  const [, , pelican, , , curves, , , sharp] = ROAD_SIGNS;
  const [downhill, tunnel, view, rocks] = TRACK_SIGNS.mountain;
  switch (m.kind) {
    case 'gorgeBridge': gorgeBridge(d, m.s, len); break;
    case 'waterfall': waterfall(d, m.s, m.x, typeof m.data.w === 'number' ? m.data.w : 14); break;
    case 'pagoda': pagodaViewpoint(d, m.s, side); break;
    case 'hotSpring': hotSpring(d, m.s, side); break;
    case 'teaTerraces': teaTerraces(d, side, m.s, m.s + len); break;
    case 'cows': cowPasture(d, side, m.s, m.s + len); break;
    case 'prayerFlags': prayerFlagLine(d, side, m.s, m.s + len); break;
    case 'startGantry': lanternGantry(d, m.s, 'START', '暴力鹈鹕 · 落日山道 SUNSET PASS', 'BEAK RASH', '本路段已被 AI 画过 请谨慎骑行'); break;
    case 'finishGantry': lanternGantry(d, m.s, 'FINISH', '终点 · 日落前到家', 'GG', '落日山道 欢迎再来'); break;
    case 'stands': stands(d, side, m.s, m.s + Math.min(len, 90)); break;
    case 'houses': houses(d, side, m.s, m.s + len); break;
    case 'lanterns':
      if (m.data.style === 'posts') lanternPosts(d, m.s, m.s + len, every);
      else lanternStrings(d, m.s, m.s + len, every);
      break;
    case 'chevrons': chevronRow(d, side, m.s, m.s + len, len < 100 ? 10 : 14); break;
    case 'signCurves': roadSign(d, m.s, side, curves ?? '连续弯道 弯弯有鹅'); break;
    case 'signRocks':
      signAt(d, m.s, side, d.face('warn:rocks', () => warnFace(d.atlas, '石', '注意落石')), 1.3, 1.5);
      roadSign(d, m.s + 24, side, rocks ?? '落石区 其实是落鱼');
      break;
    case 'signTunnel': roadSign(d, m.s, side, tunnel ?? '前方隧道 请开灯'); break;
    case 'signChicane': roadSign(d, m.s, side, sharp ?? '急弯 别急'); break;
    case 'signDownhill': roadSign(d, m.s, side, downhill ?? '连续下坡 别躺平'); break;
    case 'signPelican': signAt(d, m.s, side, d.face('warn:pelican', () => warnFace(d.atlas, '鹕', pelican ?? '鹈鹕出没')), 1.3, 1.5); break;
    case 'signLimit': signAt(d, m.s, side, d.face('limit', () => roundSignFace(d.atlas, '限速', '随缘')), 1.4, 1.4); break;
    case 'signScenic': scenicSign(d, m.s, side, String(m.data.text ?? view ?? '观景台 鹅已就位'), String(m.data.en ?? 'VIEWPOINT')); break;
    case 'warnCrest': warning(d, m.s, side, '飞', '前方起飞'); break;
    case 'warnRamp': warning(d, m.s, side, '跳', '跳台 · 别怂'); break;
    default: console.warn('[mountain] unknown mark', m.kind);
  }
}

export function marks(d: Dress): void {
  const list = [...d.ctx.L.marks].sort((a, b) => rank(a) - rank(b) || a.s - b.s);
  for (const m of list) dispatch(d, m);
}
