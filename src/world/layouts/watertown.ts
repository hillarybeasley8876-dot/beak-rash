// 江南水乡 WATER TOWN layout (r4, SPEC §20). 3.4 km point-to-point ride through a canal town in a
// drizzle: narrow lanes between white-walled houses, three steel-arch canal crossings, two humpback
// stone bridges that launch the rider, a riverside promenade with market stalls, a tea house, a
// memorial archway and a finish on the town square.
// Water sits at y = 0; the town's lanes run at y = 1.6. Every canal crossing is a segment whose
// ground profile drops away (detached), so the road is a bridge there.
import type { GroundDef, LayoutDef, SideDef } from '../layout/types';

const G = (g: Partial<GroundDef>): GroundDef => ({
  step: 0, stepW: 2, flat: 4, slope: 0.3, target: 30, rough: 3, abs: false, detached: false, mat: 'grass', ...g,
});

// ---- side presets
/** Start / finish apron: painted ground behind red-and-white barriers. */
const apronL: SideDef = { shoulder: 3.2, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 16, slope: 0.06, target: 2.6, rough: 0.3, mat: 'stone' }) };
const apronR: SideDef = { ...apronL };
/** Old-town lane: a granite kerb and a low whitewashed wall (the shared 'stone' edge) with the
 *  houses right behind it. */
const laneL: SideDef = { shoulder: 0.9, surface: 'road', edge: 'stone', ground: G({ step: 0.14, stepW: 0.5, flat: 5, slope: 0.05, target: 2.4, rough: 0.3, mat: 'stone' }) };
const laneR: SideDef = { ...laneL };
/** Canal side: a stone quay (no barrier — the water is right there) with a 9 m canal beyond it. */
const quayL: SideDef = { shoulder: 1.6, surface: 'road', edge: 'quay', ground: G({ abs: true, step: -1.4, stepW: 0.06, flat: 9, slope: 0.25, target: 2.2, rough: 0.2, mat: 'stone' }) };
const quayR: SideDef = { ...quayL };
/** Humpback stone bridge: the ground drops away under the road (the canal runs underneath). */
const humpL: SideDef = { shoulder: 0.8, surface: 'road', edge: 'parapet', ground: G({ abs: true, detached: true, step: -1.3, stepW: 0, flat: 0, slope: 0.24, target: 1.7, rough: 0.15, mat: 'stone' }) };
const humpR: SideDef = { ...humpL };
/** Stone canal bridge: open water under the deck. */
const bridgeL: SideDef = { shoulder: 0.9, surface: 'road', edge: 'parapet', ground: G({ abs: true, detached: true, step: -1.4, stepW: 0, flat: 0, slope: 0.05, target: -2.6, rough: 0.2, mat: 'stone' }) };
const bridgeR: SideDef = { ...bridgeL };
/** Market lane: a kerb with bollards and planters on the town side. */
const stallL: SideDef = { shoulder: 1.5, surface: 'road', edge: 'stalls', ground: G({ step: 0.1, stepW: 0.6, flat: 5, slope: 0.08, target: 2.4, rough: 0.3, mat: 'stone' }) };
const stallR: SideDef = { ...stallL };

export const WATERTOWN: LayoutDef = {
  id: 'watertown',
  heading: 0,
  elevation: 1.6,
  halfWidth: 3.6,
  pre: 160,
  post: 300,
  left: apronL,
  right: apronR,
  curbs: false,
  segments: [
    // ---- 0 – 150: the town gate, the start line under the arch.
    {
      len: 150, name: 'start',
      marks: [
        { kind: 'startGantry', at: 62, x: 0 },
        { kind: 'stands', at: 12, x: -1, data: { len: 130 } },
        { kind: 'stands', at: 12, x: 1, data: { len: 130 } },
        { kind: 'sign', at: 120, x: 1, data: { sign: 'limit' } },
        { kind: 'lantern', at: 40, x: 0 },
      ],
    },
    // ---- 150 – 470: the old-town lanes. White walls right at the kerb; one R 48 bend through the
    // first quarter, then a short straight to the canal.
    {
      len: 60, name: 'lanes', left: laneL, right: laneR,
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 60 } },
        { kind: 'house', at: 0, x: 1, data: { len: 60 } },
        { kind: 'lantern', at: 20, x: 0 },
      ],
    },
    {
      len: 64, name: 'lanes', radius: -48, ease: 30, left: laneL, right: laneR,
      features: [{ kind: 'pickupRow', at: 26, len: 15, x0: -3.2, x1: 3.2, data: { kind: 'coin' } }],
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 64 } },
        { kind: 'house', at: 0, x: 1, data: { len: 64 } },
        { kind: 'chevrons', at: 4, x: 1, data: { len: 56 } },
        { kind: 'lantern', at: 30, x: 0 },
      ],
    },
    {
      len: 66, name: 'lanes',
      features: [{ kind: 'pickupRow', at: 16, len: 12, x0: 3, x1: 3, data: { kind: 'can' } }],
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 46 } },
        { kind: 'house', at: 0, x: 1, data: { len: 46 } },
        { kind: 'roofline', at: 0, x: 1, data: { len: 46 } },
        { kind: 'sign', at: 24, x: -1, data: { sign: 'fish' } },
      ],
    },
    // ---- 470 – 750: the first canal. The water runs along the left; the houses line the right.
    {
      len: 280, name: 'canal', radius: 520, ease: 60, left: quayL, right: laneR,
      features: [
        { kind: 'pickupRow', at: 120, len: 15, x0: 3.2, x1: -1.5, data: { kind: 'coin' } },
        { kind: 'puddle', at: 196, len: 7, x0: 1, x1: 3.3 },
      ],
      marks: [
        { kind: 'willow', at: 0, x: -1, data: { len: 280 } },
        { kind: 'boat', at: 20, x: -1, data: { len: 220 } },
        { kind: 'house', at: 0, x: 1, data: { len: 280 } },
        { kind: 'lantern', at: 90, x: 0 },
        { kind: 'lantern', at: 210, x: 0 },
      ],
    },
    // ---- 750 – 906: the first humpback stone bridge. The road climbs to the crest and the canal
    // runs underneath; the jumpCrest on the far side of the crest launches the rider.
    {
      len: 70, name: 'hump', rise: 2,
      marks: [
        { kind: 'warnCrest', at: 24, x: 1 },
        { kind: 'house', at: 0, x: -1, data: { len: 70 } },
        { kind: 'house', at: 0, x: 1, data: { len: 70 } },
      ],
    },
    { len: 8, name: 'hump', rise: 1.6, vEase: 8, ease: 8, sideEase: 6, left: humpL, right: humpR },
    {
      len: 8, name: 'hump', rise: -1.6, vEase: 8, ease: 8, sideEase: 6, left: humpL, right: humpR,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -3.6, x1: 3.6 }],
    },
    {
      len: 70, name: 'hump', rise: -2, left: quayL, right: laneR, sideEase: 8,
      marks: [
        { kind: 'house', at: 0, x: 1, data: { len: 70 } },
        { kind: 'willow', at: 10, x: -1, data: { len: 60 } },
      ],
    },
    // ---- 906 – 1156: the market quay. Stalls on the town side, the canal and the boats on the left.
    {
      len: 310, name: 'market', left: quayL, right: stallR,
      features: [
        { kind: 'pickupRow', at: 70, len: 12, x0: -3.2, x1: -3.2, data: { kind: 'fish' } },
        { kind: 'puddle', at: 140, len: 6, x0: -3.3, x1: -1.5 },
        { kind: 'boostPad', at: 190, len: 6, x0: 1.2, x1: 3.3, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 214, len: 12, x0: 3, x1: 3, data: { kind: 'crate' } },
      ],
      marks: [
        { kind: 'stalls', at: 10, x: 1, data: { len: 210 } },
        { kind: 'boat', at: 20, x: -1, data: { len: 200 } },
        { kind: 'willow', at: 0, x: -1, data: { len: 250 } },
        { kind: 'lantern', at: 120, x: 0 },
      ],
    },
    // ---- 1156 – 1376: the tea house quarter, one tight R 34 bend and a short straight.
    {
      len: 50, name: 'tea', radius: 34, ease: 22, left: laneL, right: laneR,
      features: [{ kind: 'pickupRow', at: 24, len: 12, x0: 3, x1: 3, data: { kind: 'coin' } }],
      marks: [
        { kind: 'teahouse', at: 20, x: 1 },
        { kind: 'chevrons', at: 4, x: -1, data: { len: 44 } },
        { kind: 'sign', at: 30, x: 1, data: { sign: 'sharp' } },
        { kind: 'house', at: 0, x: -1, data: { len: 50 } },
      ],
    },
    {
      len: 60, name: 'tea',
      marks: [
        { kind: 'teahouse', at: 0, x: -1 },
        { kind: 'house', at: 0, x: 1, data: { len: 60 } },
        { kind: 'lantern', at: 30, x: 0 },
      ],
    },
    // ---- 1376 – 1756: the long canal-side sweeper. A breath of speed between the tight lanes.
    {
      len: 440, name: 'sweeper', radius: 240, bank: 3, ease: 80, left: quayL, right: laneR,
      features: [
        { kind: 'pickupRow', at: 110, len: 15, x0: 3.2, x1: -1.5, data: { kind: 'coin' } },
        { kind: 'puddle', at: 200, len: 8, x0: -4.5, x1: -1 },
        { kind: 'boostPad', at: 280, len: 6, x0: -3.3, x1: -1.4, data: { power: 0.3, time: 1 } },
      ],
      marks: [
        { kind: 'willow', at: 0, x: -1, data: { len: 380 } },
        { kind: 'boat', at: 30, x: -1, data: { len: 300 } },
        { kind: 'roofline', at: 0, x: 1, data: { len: 380 } },
        { kind: 'lantern', at: 150, x: 0 },
        { kind: 'pagoda', at: 60, x: 190 },
      ],
    },
    // ---- 1756 – 1912: the second humpback stone bridge, on the rise out of the sweeper.
    {
      len: 70, name: 'hump', rise: 2,
      marks: [
        { kind: 'warnCrest', at: 26, x: -1 },
        { kind: 'house', at: 0, x: 1, data: { len: 70 } },
      ],
    },
    { len: 8, name: 'hump', rise: 1.6, vEase: 8, ease: 8, sideEase: 6, left: humpL, right: humpR },
    {
      len: 8, name: 'hump', rise: -1.6, vEase: 8, ease: 8, sideEase: 6, left: humpL, right: humpR,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -3.6, x1: 3.6 }],
    },
    {
      len: 70, name: 'hump', rise: -2, left: laneL, right: laneR, sideEase: 8,
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 70 } },
        { kind: 'lantern', at: 30, x: 0 },
      ],
    },
    // ---- 1912 – 2142: the memorial archway (牌坊) over the lane, the town's landmark.
    {
      len: 120, name: 'archway', left: laneL, right: laneR,
      features: [{ kind: 'pickupRow', at: 60, len: 15, x0: -3, x1: 3, data: { kind: 'coin' } }],
      marks: [
        { kind: 'archway', at: 66, x: 0 },
        { kind: 'house', at: 0, x: -1, data: { len: 120 } },
        { kind: 'house', at: 0, x: 1, data: { len: 120 } },
        { kind: 'lantern', at: 20, x: 0 },
        { kind: 'lantern', at: 92, x: 0 },
      ],
    },
    {
      len: 70, name: 'archway', radius: -60, ease: 30, left: laneL, right: laneR,
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 70 } },
        { kind: 'house', at: 0, x: 1, data: { len: 70 } },
        { kind: 'chevrons', at: 4, x: 1, data: { len: 62 } },
      ],
    },
    {
      len: 40, name: 'archway',
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 40 } },
        { kind: 'house', at: 0, x: 1, data: { len: 40 } },
        { kind: 'roofline', at: 0, x: 1, data: { len: 40 } },
      ],
    },
    // ---- 2142 – 2242: the first big canal crossing (the shared steel arch bridge).
    {
      len: 100, name: 'bridge', left: bridgeL, right: bridgeR,
      features: [
        { kind: 'bridge', at: 12, len: 76, x0: -4.2, x1: 4.2 },
        { kind: 'pickupRow', at: 58, len: 12, x0: 3, x1: 3, data: { kind: 'can' } },
      ],
      marks: [
        { kind: 'boat', at: 30, x: -1, data: { len: 60 } },
        { kind: 'boat', at: 30, x: 1, data: { len: 60 } },
        { kind: 'sign', at: 88, x: 1, data: { sign: 'fish' } },
      ],
    },
    // ---- 2242 – 2562: the tight old-town corners. Drift or lose it.
    {
      len: 55, name: 'corners', radius: 34, bank: -3, ease: 20, left: laneL, right: laneR,
      marks: [
        { kind: 'chevrons', at: 4, x: -1, data: { len: 48 } },
        { kind: 'sign', at: 14, x: 1, data: { sign: 'sharp' } },
      ],
    },
    {
      len: 30, name: 'corners',
      features: [{ kind: 'pickupRow', at: 10, len: 12, x0: -3.2, x1: -3.2, data: { kind: 'fish' } }],
      marks: [{ kind: 'house', at: 0, x: 1, data: { len: 30 } }],
    },
    {
      len: 60, name: 'corners', radius: -38, ease: 24, left: laneL, right: laneR,
      marks: [
        { kind: 'chevrons', at: 4, x: 1, data: { len: 52 } },
        { kind: 'house', at: 0, x: 1, data: { len: 60 } },
      ],
    },
    {
      len: 15, name: 'corners',
      marks: [{ kind: 'lantern', at: 4, x: 0 }],
    },
    // ---- 2562 – 2662: the second canal crossing.
    {
      len: 100, name: 'bridge', left: bridgeL, right: bridgeR,
      features: [{ kind: 'bridge', at: 12, len: 76, x0: -4.2, x1: 4.2 }],
      marks: [
        { kind: 'boat', at: 24, x: -1, data: { len: 60 } },
        { kind: 'boat', at: 24, x: 1, data: { len: 60 } },
        { kind: 'lantern', at: 50, x: 0 },
      ],
    },
    // ---- 2662 – 2942: the riverside promenade. The canal is on the right this time.
    {
      len: 320, name: 'promenade', radius: -180, ease: 60, left: stallL, right: quayR,
      features: [
        { kind: 'pickupRow', at: 90, len: 15, x0: 3.2, x1: -1.5, data: { kind: 'coin' } },
        { kind: 'puddle', at: 150, len: 7, x0: 1, x1: 3.3 },
        { kind: 'boostPad', at: 200, len: 6, x0: 1.2, x1: 3.3, data: { power: 0.3, time: 1 } },
      ],
      marks: [
        { kind: 'stalls', at: 0, x: -1, data: { len: 240 } },
        { kind: 'willow', at: 0, x: 1, data: { len: 280 } },
        { kind: 'boat', at: 20, x: 1, data: { len: 220 } },
        { kind: 'lantern', at: 120, x: 0 },
      ],
    },
    // ---- 2942 – 3042: the third canal crossing, straight into the finishing straight.
    {
      len: 100, name: 'bridge', left: bridgeL, right: bridgeR,
      features: [{ kind: 'bridge', at: 12, len: 76, x0: -4.2, x1: 4.2 }],
      marks: [
        { kind: 'boat', at: 26, x: -1, data: { len: 60 } },
        { kind: 'boat', at: 26, x: 1, data: { len: 60 } },
      ],
    },
    // ---- 3042 – 3432: the sprint past the tea houses and the finish on the town square.
    {
      len: 210, name: 'sprint', radius: 300, ease: 60, left: laneL, right: laneR,
      features: [{ kind: 'pickupRow', at: 90, len: 15, x0: 0, x1: 0, data: { kind: 'coin' } }],
      marks: [
        { kind: 'house', at: 0, x: -1, data: { len: 190 } },
        { kind: 'house', at: 0, x: 1, data: { len: 190 } },
        { kind: 'roofline', at: 0, x: -1, data: { len: 190 } },
        { kind: 'lantern', at: 60, x: 0 },
      ],
    },
    {
      len: 200, name: 'finish', left: apronL, right: apronR,
      marks: [
        { kind: 'stands', at: 30, x: -1, data: { len: 150 } },
        { kind: 'stands', at: 30, x: 1, data: { len: 150 } },
        { kind: 'finishGantry', at: 160, x: 0 },
        { kind: 'house', at: 0, x: -1, data: { len: 120 } },
        { kind: 'lantern', at: 40, x: 0 },
      ],
    },
  ],
};
