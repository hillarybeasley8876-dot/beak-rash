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
import { mount, signInset, towardRiders, zoneRuns } from './util';

export const BANNERS = ['暴力鹈鹕 BEAK RASH', '霓虹夜城 欢迎你', '今日宜：撞人', 'V我50 小鱼干', 'SHOWTIME!', '夜骑请开灯'];

const TURN = 0.28;

/** Nudges tried (m along the road) when a lot or prop already takes the spot behind the kerb. */
const NUDGE = [0, -6, 6, -12, 12];

/** Post sign near (s, side) behind the kerb, facing the riders; the board never reaches over the drivable edge. */
function sign(c: City, s: number, side: -1 | 1, rect: AtlasRect | null, w: number, h: number): void {
  if (!rect) return;
  for (const ds of NUDGE) {
    const mt = mount(c, s + ds, side, signInset(w, TURN));
    // Over drops the mount snaps onto the parapet, where a centred board would hang over the road.
    if (!mt || mt.onDeck || !c.d.place.claim(mt.sp.pos.x, mt.sp.pos.z, 0.5)) continue;
    const { sp } = mt;
    postSign(c.d.b.props.at(sp.pos.x, sp.pos.z), c.d.b.faces.at(sp.pos.x, sp.pos.z), sp.pos.x, mt.y, sp.pos.z, towardRiders(c.d.ctx, s + ds, side, TURN), w, h, 1.6, rect);
    return;
  }
  console.warn(`[track] city sign at s=${s} skipped (no room behind the kerb)`);
}

/** Road signs placed relative to the zones / marks they announce (they follow any layout change). */
function roadSigns(c: City): void {
  const { atlas, ctx } = c.d;
  const [limit, neon, metro, rain, , noHonk, camera] = CITY_SIGNS;
  const small = (text: string | undefined, fallback: string): string => (text ?? fallback).split('：')[1] ?? fallback;
  const zone = (name: string): number | null => zoneRuns(ctx, [name])[0]?.[0] ?? null;
  const subway = ctx.L.marks.find((m) => m.kind === 'subway')?.s ?? null;
  const at = (s0: number | null, ds: number, rect: AtlasRect | null, w: number, h: number): void => {
    if (s0 !== null) sign(c, s0 + ds, 1, rect, w, h);
  };
  const sharp = ROAD_SIGNS[8] ?? '急弯 别急';
  at(zone('boulevard'), 15, roundSignFace(atlas, '限速', small(limit, '看心情')), 1.4, 1.4);
  at(zone('boulevard'), 220, roadSignFace(atlas, neon ?? '霓虹路段 注意反光'), 2.6, 1.6);
  at(subway, -18, roadSignFace(atlas, metro ?? '地铁口 鸽子多'), 2.4, 1.5);
  // Corner warnings 35–42 m before the turn-in.
  at(zone('corner'), -35, roadSignFace(atlas, sharp), 2.2, 1.4);
  at(zone('chicane'), -42, roadSignFace(atlas, ROAD_SIGNS[5] ?? '连续弯道 弯弯有鹅'), 2.8, 1.6);
  at(zone('riverside'), 54, warnFace(atlas, '鹅', rain ?? '雨天 鹅更滑'), 1.3, 1.5);
  at(zone('avenue'), 50, roundSignFace(atlas, '禁止', (noHonk ?? '禁止鹅叫').replace('禁止', '')), 1.4, 1.4);
  at(zone('hairpin'), -35, roadSignFace(atlas, sharp), 2.2, 1.4);
  at(zone('sprint'), 72, roadSignFace(atlas, camera ?? '前方测速 柯基执勤'), 2.8, 1.6);
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
