// City signage: road signs from content's TRACK_SIGNS.city (+ a few classics), the crest warning on
// the viaduct, chevrons on the outside of every tight corner, distance markers and the start /
// finish plaza banners. Sign faces are unlit (retro-reflective at night) in the shared atlas.
import { ROAD_SIGNS } from '../../../data/memes';
import { roadSignFace, roundSignFace, warnFace } from '../../scenery/signs/faces';
import type { AtlasRect } from '../../scenery/signs/atlas';
import { postSign } from '../../scenery/signs/boards';
import { banners, chevrons, distanceMarkers, warning } from '../coast/signage';
import type { City } from './city';
import { CITY_SIGNS } from './lines';
import { mount, towardRiders, zoneRuns } from './util';

export const BANNERS = ['暴力鹈鹕 BEAK RASH', '霓虹夜城 欢迎你', '今日宜：撞人', 'V我50 小鱼干', 'SHOWTIME!', '夜骑请开灯'];

/** Post sign at (s, side) just behind the kerb, facing the riders. */
function sign(c: City, s: number, side: -1 | 1, rect: AtlasRect | null, w: number, h: number): void {
  if (!rect) return;
  const mt = mount(c, s, side, 0.5);
  if (!mt || !c.d.place.claim(mt.sp.pos.x, mt.sp.pos.z, 0.5)) return;
  const { sp } = mt;
  postSign(c.d.b.props.at(sp.pos.x, sp.pos.z), c.d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, towardRiders(c.d.ctx, s, side, 0.28), w, h, 1.6, rect);
}

function roadSigns(c: City): void {
  const { atlas } = c.d;
  const [limit, neon, metro, rain, , noHonk, camera] = CITY_SIGNS;
  const small = (text: string | undefined, fallback: string): string => (text ?? fallback).split('：')[1] ?? fallback;
  sign(c, 175, 1, roundSignFace(atlas, '限速', small(limit, '看心情')), 1.4, 1.4);
  sign(c, 380, 1, roadSignFace(atlas, neon ?? '霓虹路段 注意反光'), 2.6, 1.6);
  sign(c, 292, 1, roadSignFace(atlas, metro ?? '地铁口 鸽子多'), 2.4, 1.5);
  sign(c, 425, 1, roadSignFace(atlas, ROAD_SIGNS[8] ?? '急弯 别急'), 2.2, 1.4);
  sign(c, 1040, 1, roadSignFace(atlas, ROAD_SIGNS[5] ?? '连续弯道 弯弯有鹅'), 2.8, 1.6);
  sign(c, 1690, 1, warnFace(atlas, '鹅', rain ?? '雨天 鹅更滑'), 1.3, 1.5);
  sign(c, 2620, 1, roundSignFace(atlas, '禁止', (noHonk ?? '禁止鹅叫').replace('禁止', '')), 1.4, 1.4);
  sign(c, 2695, 1, roadSignFace(atlas, ROAD_SIGNS[8] ?? '急弯 别急'), 2.2, 1.4);
  sign(c, 2990, 1, roadSignFace(atlas, camera ?? '前方测速 柯基执勤'), 2.8, 1.6);
}

/** Chevrons on the outside of each corner zone (sign of the curvature picks the side). */
function cornerChevrons(c: City): void {
  const { ctx } = c.d;
  for (const [s0, s1] of zoneRuns(ctx, ['corner', 'chicane', 'hairpin'])) {
    // Split S-chicanes where the curvature flips.
    let a = s0;
    let k0 = Math.sign(ctx.q.frameVis(s0 + 4).curvature);
    for (let s = s0 + 4; s <= s1; s += 2) {
      const k = Math.sign(ctx.q.frameVis(s).curvature);
      if (k !== k0 || s >= s1 - 1) {
        const outside: -1 | 1 = k0 > 0 ? -1 : 1;
        if (s - a > 12) chevrons(c.d, outside, a, s);
        a = s;
        k0 = k;
      }
    }
  }
}

export function citySignage(c: City): void {
  roadSigns(c);
  cornerChevrons(c);
  distanceMarkers(c.d);
  for (const m of c.d.ctx.L.marks.filter((k) => k.kind === 'warnCrest')) warning(c.d, m.s, m.x < 0 ? -1 : 1, '飞', '前方起飞');
  for (const [s0, s1] of zoneRuns(c.d.ctx, ['start', 'finish'])) {
    for (const side of [-1, 1] as const) banners(c.d, side, s0 + 8, s1 - 8, c.d.rng.shuffle(BANNERS));
  }
}
