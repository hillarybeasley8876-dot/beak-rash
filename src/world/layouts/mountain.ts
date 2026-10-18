// 落日山道 Sunset Pass — ≈3.6 km point-to-point mountain road at golden hour. Lake level = sea level 0
// (the water plane is the lake and the gorge river). Village square by the lake (6 m) → pine climb →
// 3 switchback hairpins stacked up a sunlit face (uphill = east-north-east) → cliff road (rock wall /
// rail + drop) → curved lit tunnel through the ridge → gorge bridge over the river, waterfall beside it
// → summit crest jump with the pagoda viewpoint (≈123 m) → fast descent with an S-chicane and a ramp →
// lakeside straight into the sunset → finish gantry with paper lanterns.
import { MountainTerrain } from '../env/mountain-relief';
import type { GroundDef, LayoutDef, SideDef } from '../layout/types';

const G = (g: Partial<GroundDef>): GroundDef => ({
  step: 0, stepW: 2, flat: 3, slope: 0.35, target: 40, rough: 3, abs: false, detached: false, mat: 'grass', ...g,
});
const PI = Math.PI;

// ---- start / village (lake on the left)
const startL: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ abs: true, step: 5.4, stepW: 0.6, flat: 16, slope: -0.08, target: -10, rough: 0.5, mat: 'stone' }) };
const startR: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 20, slope: 0.22, target: 34, rough: 2, mat: 'stone' }) };
const lakeL: SideDef = { shoulder: 2.4, surface: 'road', edge: 'stone', ground: G({ abs: true, step: 4.2, stepW: 4, flat: 8, slope: -0.1, target: -10, rough: 0.6, mat: 'grass' }) };
const houseR: SideDef = { shoulder: 2.4, surface: 'road', edge: 'stone', ground: G({ step: 0.2, stepW: 1, flat: 9, slope: 0.3, target: 45, rough: 3, mat: 'grass' }) };

// ---- mountain sides: uphill (cut slope) / downhill (rail + fall-away)
const forestUp: SideDef = { shoulder: 1.8, surface: 'road', edge: 'stone', ground: G({ step: 0.4, stepW: 2, flat: 2, slope: 0.45, target: 55, rough: 5 }) };
// Downhill toward the lake: an absolute fall-away (steep wooded bank, then the shore below).
const forestDown: SideDef = { shoulder: 1.8, surface: 'road', edge: 'rail', ground: G({ abs: true, step: 7, stepW: 22, flat: 0, slope: -0.3, target: -10, rough: 3 }) };
const legUp: SideDef = { shoulder: 1.6, surface: 'road', edge: 'stone', ground: G({ step: 0.6, stepW: 1.6, flat: 1, slope: 0.5, target: 30, rough: 2 }) };
const legDown: SideDef = { shoulder: 1.6, surface: 'road', edge: 'rail', ground: G({ step: -1.2, stepW: 2.6, flat: 0.5, slope: -0.5, target: -30, rough: 2 }) };
const pinOut: SideDef = { shoulder: 2.2, surface: 'road', edge: 'rail', ground: G({ step: -0.6, stepW: 2.5, flat: 3, slope: -0.25, target: -20, rough: 2 }) };
const pinIn: SideDef = { shoulder: 1.6, surface: 'road', edge: 'stone', ground: G({ step: 0.3, stepW: 1.5, flat: 2, slope: 0.2, target: 8, rough: 1 }) };
const cliffWall: SideDef = { shoulder: 1.4, surface: 'road', edge: 'rock', ground: G({ step: 16, stepW: 1.6, flat: 3, slope: 0.6, target: 70, rough: 6, mat: 'rock' }) };
const cliffDrop: SideDef = { shoulder: 1.6, surface: 'road', edge: 'rail', ground: G({ step: -3, stepW: 6, flat: 1, slope: -0.7, target: -60, rough: 4, mat: 'rock' }) };
const ridgeUp: SideDef = { shoulder: 1.8, surface: 'road', edge: 'stone', ground: G({ step: 0.5, stepW: 2, flat: 4, slope: 0.4, target: 40, rough: 5 }) };
const ridgeDown: SideDef = { shoulder: 1.8, surface: 'road', edge: 'rail', ground: G({ step: -0.6, stepW: 3, flat: 3, slope: -0.3, target: -45, rough: 4 }) };
const summitL: SideDef = { shoulder: 2.6, surface: 'road', edge: 'stone', ground: G({ step: 0.3, stepW: 2, flat: 6, slope: 0.35, target: 45, rough: 4 }) };
const summitR: SideDef = { shoulder: 2.6, surface: 'road', edge: 'rail', ground: G({ step: -0.3, stepW: 2, flat: 12, slope: -0.3, target: -60, rough: 3 }) };

// ---- lakeside finish (lake on the right)
const shoreR: SideDef = { shoulder: 3, surface: 'road', edge: 'stone', ground: G({ abs: true, step: 1.4, stepW: 1.5, flat: 6, slope: -0.08, target: -10, rough: 0.4, mat: 'sand' }) };
const meadowL: SideDef = { shoulder: 2.6, surface: 'grass', edge: 'stone', ground: G({ step: 0, stepW: 1, flat: 10, slope: 0.3, target: 60, rough: 4 }) };
const finishL: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 26, slope: 0.25, target: 50, rough: 3, mat: 'stone' }) };
const finishR: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ abs: true, step: 1.6, stepW: 0.6, flat: 14, slope: -0.08, target: -10, rough: 0.4, mat: 'stone' }) };

/** 180° hairpin of radius r (signed). */
const pin = (r: number): number => PI * Math.abs(r);

// ---- gorge (river at lake level, waterfall cliff on the left)
const gorgeL = { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: { abs: true, detached: true, step: -2.5, stepW: 0, flat: 30, slope: 1.1, target: 150, rough: 5, mat: 'rock' } } as const;
const gorgeR = { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: { abs: true, detached: true, step: -3, stepW: 0, flat: 0, slope: -0.04, target: -14, rough: 1, mat: 'rock' } } as const;

export const MOUNTAIN: LayoutDef = {
  id: 'mountain',
  heading: 0,
  elevation: 6,
  halfWidth: 6.5,
  pre: 160,
  post: 280,
  left: startL,
  right: startR,
  terrainMod: (field) => new MountainTerrain(field),
  segments: [
    {
      len: 160, name: 'start', rise: 0.4,
      marks: [
        { kind: 'startGantry', at: 46, x: 0 },
        { kind: 'stands', at: 8, x: -1, data: { len: 110 } },
        { kind: 'stands', at: 8, x: 1, data: { len: 110 } },
        { kind: 'lanterns', at: 20, x: 0, data: { len: 130, every: 22 } },
        { kind: 'signLimit', at: 150, x: 1 },
      ],
    },
    {
      len: 140, name: 'village', radius: 500, rise: 2.5, ease: 50, left: lakeL, right: houseR,
      features: [{ kind: 'pickupRow', at: 70, len: 15, x0: -3.5, x1: 1.5, data: { kind: 'coin' } }],
      marks: [
        { kind: 'houses', at: 0, x: 1, data: { len: 140 } },
        { kind: 'lanterns', at: 10, x: 0, data: { len: 120, every: 30 } },
        { kind: 'signPelican', at: 125, x: 1 },
      ],
    },
    {
      len: 200, name: 'pines', radius: -300, rise: 14, bank: -3, ease: 60, left: forestDown, right: forestUp,
      features: [{ kind: 'pickupRow', at: 110, len: 12, x0: 3, x1: 3, data: { kind: 'crate' } }],
      marks: [{ kind: 'teaTerraces', at: 20, x: 1, data: { len: 170 } }],
    },
    {
      len: 130, name: 'pines', rise: 9, ease: 50,
      marks: [{ kind: 'signCurves', at: 40, x: 1 }, { kind: 'chevrons', at: 100, x: -1, data: { len: 30 } }],
    },
    // ---- switchbacks: three hairpins, legs stacked up the face (uphill = right of the first leg)
    {
      len: pin(27), name: 'hairpin', radius: 27, rise: 5, bank: 7, ease: 26, left: pinOut, right: pinIn,
      marks: [{ kind: 'chevrons', at: 0, x: -1, data: { len: pin(27) } }],
    },
    {
      len: 140, name: 'leg', rise: 11, ease: 26, left: legUp, right: legDown,
      features: [{ kind: 'pickupRow', at: 60, len: 18, x0: -4, x1: 2, data: { kind: 'coin' } }],
      marks: [{ kind: 'chevrons', at: 110, x: 1, data: { len: 30 } }],
    },
    {
      len: pin(30), name: 'hairpin', radius: -30, rise: 6, bank: -7, ease: 28, left: pinIn, right: pinOut,
      marks: [{ kind: 'chevrons', at: 0, x: 1, data: { len: pin(30) } }],
    },
    {
      len: 140, name: 'leg', rise: 11, ease: 28, left: legDown, right: legUp,
      features: [
        { kind: 'boostPad', at: 40, len: 6, x0: -1.7, x1: 1.7, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 90, len: 12, x0: 3, x1: 3, data: { kind: 'can' } },
      ],
      marks: [{ kind: 'chevrons', at: 110, x: -1, data: { len: 30 } }],
    },
    {
      len: pin(26), name: 'hairpin', radius: 26, rise: 5, bank: 7, ease: 26, left: pinOut, right: pinIn,
      marks: [{ kind: 'chevrons', at: 0, x: -1, data: { len: pin(26) } }],
    },
    // ---- cliff road high on the face: rock wall uphill (left), rail + drop (right) over the switchbacks
    {
      len: 150, name: 'cliff', rise: 10, ease: 26, left: legUp, right: legDown,
      features: [{ kind: 'pickupRow', at: 70, len: 12, x0: -2, x1: -2, data: { kind: 'crate' } }],
      marks: [{ kind: 'signRocks', at: 100, x: 1 }],
    },
    {
      len: 220, name: 'cliff', radius: -700, rise: 12, ease: 60, left: cliffWall, right: cliffDrop, sideEase: 40,
      features: [
        { kind: 'oil', at: 80, len: 9, x0: 1.2, x1: 4.6 },
        { kind: 'pickupRow', at: 150, len: 18, x0: 4, x1: 4, data: { kind: 'coin' } },
      ],
      marks: [{ kind: 'chevrons', at: 160, x: 1, data: { len: 60 } }],
    },
    {
      len: 110, name: 'cliff', radius: -150, rise: 4, ease: 50, bank: -4,
      marks: [{ kind: 'chevrons', at: 0, x: 1, data: { len: 110 } }, { kind: 'signTunnel', at: 60, x: 1 }],
    },
    // ---- cutting → curved tunnel through the ridge (narrowed to the tunnel bound before the portal)
    {
      len: 36, name: 'cutting', rise: 1, ease: 30,
      left: { shoulder: 1.4, surface: 'road', edge: 'rock', ground: { abs: false, step: 18, stepW: 1.8, flat: 6, slope: 0.5, target: 60, rough: 5, mat: 'rock' } },
      right: { shoulder: 1.4, surface: 'road', edge: 'rock', ground: { abs: false, step: 14, stepW: 1.8, flat: 6, slope: 0.4, target: 40, rough: 5, mat: 'rock' } },
      sideEase: 36,
    },
    { len: 4, name: 'cutting', sideEase: 4, left: { shoulder: 1.0 }, right: { shoulder: 1.0 } },
    {
      len: 240, name: 'tunnel', radius: 600, rise: 3, roof: 22,
      left: { shoulder: 1.0, edge: 'tunnel' }, right: { shoulder: 1.0, edge: 'tunnel' }, sideEase: 4,
      features: [
        { kind: 'tunnel', at: 0, len: 240, x0: -7.5, x1: 7.5 },
        { kind: 'puddle', at: 70, len: 7, x0: 0.8, x1: 4.0 },
        { kind: 'puddle', at: 170, len: 6, x0: -4.0, x1: -1.0 },
      ],
    },
    { len: 4, name: 'portal', sideEase: 0, left: { edge: 'rock' }, right: { edge: 'rock' } },
    { len: 22, name: 'portal', sideEase: 4, left: { shoulder: 1.4, edge: 'rock' }, right: { shoulder: 1.4, edge: 'rock' } },
    // ---- gorge bridge (custom suspension bridge from the dressing; river + waterfall below)
    {
      len: 130, name: 'bridge', sideEase: 2, left: gorgeL, right: gorgeR,
      features: [{ kind: 'pickupRow', at: 50, len: 15, x0: 0, x1: 0, data: { kind: 'fish' } }],
      marks: [{ kind: 'gorgeBridge', at: 0, x: 0, data: { len: 130 } }, { kind: 'waterfall', at: 130, x: -36, data: { w: 18 } }],
    },
    { len: 36, name: 'bridgeExit', sideEase: 2, left: ridgeUp, right: ridgeDown },
    {
      len: 160, name: 'summit', radius: 260, rise: 13, bank: 4, ease: 60, left: summitL, right: summitR, sideEase: 30,
      features: [{ kind: 'pickupRow', at: 70, len: 15, x0: 3, x1: -1, data: { kind: 'can' } }],
      marks: [
        { kind: 'warnCrest', at: 130, x: 1 },
        { kind: 'signScenic', at: 95, x: 1 },
        { kind: 'prayerFlags', at: 20, x: 1, data: { len: 140 } },
      ],
    },
    { len: 60, name: 'crest', rise: 6, vEase: 24 },
    {
      len: 60, name: 'crest', rise: -8, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -7.5, x1: 7.5, data: { peak: 0 } }],
      marks: [{ kind: 'pagoda', at: -4, x: 1 }],
    },
    // ---- fast descent: sweeper → S-chicane → ramp → down to the lake
    {
      len: 260, name: 'descent', radius: 400, rise: -40, bank: 4, ease: 60, vEase: 20, left: ridgeUp, right: ridgeDown, sideEase: 30,
      features: [
        { kind: 'pickupRow', at: 120, len: 12, x0: -3, x1: -3, data: { kind: 'crate' } },
        { kind: 'oil', at: 200, len: 8, x0: -4.6, x1: -1.4 },
      ],
      marks: [{ kind: 'signDownhill', at: 30, x: 1 }, { kind: 'signChicane', at: 200, x: 1 }],
    },
    {
      len: 50, name: 'chicane', radius: -45, rise: -7, bank: -6, ease: 30,
      marks: [{ kind: 'chevrons', at: 0, x: 1, data: { len: 50 } }],
    },
    {
      len: 55, name: 'chicane', radius: 50, rise: -8, bank: 6, ease: 30,
      marks: [{ kind: 'chevrons', at: 0, x: -1, data: { len: 55 } }],
      features: [{ kind: 'pickupRow', at: 30, len: 12, x0: 1, x1: 4, data: { kind: 'coin' } }],
    },
    {
      len: 240, name: 'descent', radius: 380, rise: -32, bank: 3, ease: 50,
      features: [
        { kind: 'ramp', at: 120, len: 7, x0: -4.6, x1: -1.0, data: { height: 1.2 } },
        { kind: 'pickupRow', at: 133, len: 10, x0: -2.8, x1: -2.8, data: { kind: 'can' } },
      ],
      marks: [{ kind: 'warnRamp', at: 70, x: 1 }],
    },
    {
      len: 180, name: 'lake', radius: 500, rise: -20, ease: 60, left: meadowL, right: shoreR, sideEase: 60,
      features: [{ kind: 'pickupRow', at: 90, len: 15, x0: 2, x1: -3, data: { kind: 'coin' } }],
      marks: [{ kind: 'cows', at: 20, x: -1, data: { len: 150 } }],
    },
    {
      len: 240, name: 'lakeside', rise: -0.6, ease: 50,
      features: [
        { kind: 'puddle', at: 60, len: 6, x0: 1.5, x1: 4.5 },
        { kind: 'boostPad', at: 140, len: 6, x0: -1.7, x1: 1.7, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 190, len: 15, x0: -3, x1: -3, data: { kind: 'crate' } },
      ],
      marks: [
        { kind: 'hotSpring', at: 70, x: -1 },
        { kind: 'lanterns', at: 120, x: 0, data: { len: 120, every: 40, style: 'posts' } },
      ],
    },
    {
      len: 160, name: 'finish', left: finishL, right: finishR,
      marks: [
        { kind: 'stands', at: 40, x: -1, data: { len: 110 } },
        { kind: 'stands', at: 40, x: 1, data: { len: 110 } },
        { kind: 'lanterns', at: 10, x: 0, data: { len: 150, every: 18 } },
        { kind: 'finishGantry', at: 160, x: 0 },
      ],
    },
  ],
};

// The crest-jump feature needs the absolute s of the crest top: the start of the second 'crest' segment.
{
  let s = 0;
  for (const g of MOUNTAIN.segments) {
    const crest = g.features?.find((f) => f.kind === 'jumpCrest');
    if (crest) crest.data = { ...crest.data, peak: s };
    s += g.len;
  }
}
