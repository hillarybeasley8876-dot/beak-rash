// 戈壁公路 GOBI HIGHWAY layout (r4, SPEC §20). 3.75 km desert highway: the speed track of the game.
// start straight → 430 m long run (boost pad) → first dune jump (crest) → dune flats → wide R 260
// sweeper past a butte → 420 m mid run with the truck stop → two sharp bends (R 75 / R 65) → oasis run
// → the salt lake (second crest) → R 200 sweeper under the turbine ridge → final run with a ramp and a
// boost pad → third dune crest → finish under a caravanserai arch at the oasis.
// Road: 16 m wide (halfWidth 8), sand shoulders (surface 'sand' slows a rider who drifts wide) and a
// guard rail beyond them; barrier at the start / finish, a stone dyke at the salt lake.
import { smoothstep } from '../../core/math';
import type { GroundDef, LayoutDef, SideDef } from '../layout/types';

const G = (g: Partial<GroundDef>): GroundDef => ({
  step: 0, stepW: 2, flat: 4, slope: 0.3, target: 30, rough: 3, abs: false, detached: false, mat: 'sand', ...g,
});

// ---- side presets
/** The default desert verge: sandy shoulder, then a guard rail, then dunes climbing away. */
const desertL: SideDef = { shoulder: 3.4, surface: 'sand', edge: 'rail', ground: G({ step: 0.25, stepW: 2, flat: 20, slope: 0.12, target: 20, rough: 2.2 }) };
const desertR: SideDef = { shoulder: 3.4, surface: 'sand', edge: 'rail', ground: G({ step: 0.25, stepW: 2, flat: 20, slope: 0.12, target: 20, rough: 2.2 }) };
/** Big sand shoulders where the road crosses a dune field. */
const duneL: SideDef = { shoulder: 5.4, surface: 'sand', edge: 'rail', ground: G({ step: 0.6, stepW: 7, flat: 14, slope: 0.3, target: 30, rough: 3.4 }) };
const duneR: SideDef = { shoulder: 5.4, surface: 'sand', edge: 'rail', ground: G({ step: 0.6, stepW: 7, flat: 14, slope: 0.3, target: 30, rough: 3.4 }) };
/** The butte pass: a rock face rises right at the edge (outside of the wide sweeper). */
const rockL: SideDef = { shoulder: 1.8, surface: 'road', edge: 'rock', ground: G({ step: 11, stepW: 2.6, flat: 4, slope: 0.5, target: 48, rough: 5, mat: 'sand' }) };
/** The salt lake: the ground drops to a white pan below the road, a low stone dyke on the edge. */
const lakeL: SideDef = { shoulder: 5, surface: 'sand', edge: 'stone', ground: G({ abs: true, step: 117, stepW: 55, flat: 70, slope: -0.01, target: 116.4, rough: 0.15 }) };
const lakeR: SideDef = { shoulder: 5, surface: 'sand', edge: 'stone', ground: G({ abs: true, step: 117, stepW: 55, flat: 70, slope: -0.01, target: 116.4, rough: 0.15 }) };
/** Start / finish: painted apron and a concrete barrier. */
const apronL: SideDef = { shoulder: 3.2, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 26, slope: 0.1, target: 16, rough: 1.2 }) };
const apronR: SideDef = { shoulder: 3.2, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 26, slope: 0.1, target: 16, rough: 1.2 }) };

export const GOBI: LayoutDef = {
  id: 'gobi',
  heading: 0,
  elevation: 130,
  halfWidth: 8,
  pre: 200,
  post: 320,
  left: apronL,
  right: apronR,
  terrainMod: (field) => ({
    room: () => Infinity,
    // Keep the far plain high and dry: the shared far grid paints farmland on flat ground
    // between 4 and 115 m, which has no business in the Gobi.
    height: (s, side, u, wx, wz, h) => {
      const k = smoothstep(180, 340, u);
      return h * (1 - k) + Math.max(h, 122) * k;
    },
  }),
  bumps: [
    { s: 1010, x: -150, r: 88, h: 180, mat: 'sand' },   // the butte the sweeper wraps around
    { s: 2960, x: 215, r: 105, h: 172, mat: 'sand' },   // the far mesa by the turbine ridge
  ],
  segments: [
    // ---- 0 – 150: start apron under the gantry
    {
      len: 150, name: 'start',
      marks: [
        { kind: 'startGantry', at: 74, x: 0 },
        { kind: 'billboard', at: 40, x: 1 },
      ],
    },
    // ---- 150 – 580: the first long run. Everything is straight here; the boost pad and the ramp are.
    {
      len: 430, name: 'longRun', rise: -1.5, left: desertL, right: desertR,
      features: [
        { kind: 'boostPad', at: 180, len: 6, x0: -5.2, x1: -1.8, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 250, len: 15, x0: -4.5, x1: 1.5, data: { kind: 'coin' } },
        { kind: 'pickupRow', at: 320, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'can' } },
        { kind: 'oil', at: 380, len: 9, x0: 0.8, x1: 4.2 },
        { kind: 'ramp', at: 395, len: 7, x0: 1.2, x1: 5.0, data: { height: 1.7 } },
      ],
      marks: [
        { kind: 'warnRamp', at: 365, x: 1 },
        { kind: 'turbines', at: 120, x: -1, data: { count: 3 } },
        { kind: 'poles', at: 0, x: -1, data: { len: 430 } },
        { kind: 'dustDevil', at: 260, x: 1, data: { count: 2 } },
        { kind: 'mesa', at: 300, x: -1, data: { count: 2 } },
      ],
    },
    // ---- 580 – 920: the first dune crossing. Up over a sand ridge, then the road drops away: a crest.
    { len: 70, name: 'dune', rise: 7, vEase: 24, left: duneL, right: duneR },
    {
      len: 70, name: 'dune', rise: -8, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -8, x1: 8, data: { peak: 650 } }],
      marks: [{ kind: 'dunes', at: 0, x: 1, data: { len: 70 } }],
    },
    {
      len: 200, name: 'dune',
      features: [{ kind: 'pickupRow', at: 120, len: 12, x0: -3.5, x1: -3.5, data: { kind: 'crate' } }],
      marks: [
        { kind: 'dunes', at: 0, x: -1, data: { len: 200 } },
        { kind: 'camelCaravan', at: 60, x: 1 },
        { kind: 'dustDevil', at: 150, x: -1, data: { count: 2 } },
      ],
    },
    // ---- 920 – 1300: wide R 260 sweeper around the butte.
    {
      len: 380, name: 'sweeperA', radius: 260, rise: -3, bank: 3, ease: 80, left: rockL, right: desertR,
      features: [
        { kind: 'pickupRow', at: 150, len: 18, x0: 4.5, x1: -1.5, data: { kind: 'coin' } },
        { kind: 'oil', at: 250, len: 8, x0: -5, x1: -2 },
      ],
      marks: [
        { kind: 'mesa', at: 20, x: -1, data: { count: 3 } },
        { kind: 'sign', at: 120, x: 1, data: { sign: 'dune' } },
        { kind: 'turbines', at: 200, x: 1, data: { count: 2 } },
      ],
    },
    // ---- 1300 – 1720: the mid run past the truck stop and the oil field.
    {
      len: 420, name: 'midRun', rise: -1, left: desertL, right: desertR,
      features: [
        { kind: 'boostPad', at: 120, len: 6, x0: 1.6, x1: 5.0, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 200, len: 15, x0: 0, x1: 0, data: { kind: 'coin' } },
        { kind: 'pickupRow', at: 280, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'can' } },
      ],
      marks: [
        { kind: 'truckStop', at: 150, x: 1 },
        { kind: 'pumpjacks', at: 240, x: -1, data: { count: 4 } },
        { kind: 'poles', at: 0, x: 1, data: { len: 420 } },
        { kind: 'billboard', at: 60, x: -1 },
      ],
    },
    // ---- 1720 – 2080: the two sharp bends (R 75 then R 65) — the only place drifting really matters.
    {
      len: 180, name: 'sharp', radius: 75, bank: 6, ease: 40,
      marks: [
        { kind: 'chevrons', at: 6, x: 1, data: { len: 160 } },
        { kind: 'sign', at: 20, x: 1, data: { sign: 'sharp' } },
      ],
    },
    {
      len: 180, name: 'sharp', radius: -65, bank: -6, ease: 40,
      marks: [
        { kind: 'chevrons', at: 4, x: -1, data: { len: 160 } },
        { kind: 'sign', at: 16, x: -1, data: { sign: 'sharp' } },
      ],
    },
    // ---- 2080 – 2340: the oasis run (palm shade and a water hole by the road).
    {
      len: 260, name: 'oasisRun', rise: 2,
      features: [{ kind: 'pickupRow', at: 60, len: 12, x0: -2, x1: -2, data: { kind: 'crate' } }],
      marks: [
        { kind: 'oasis', at: 40, x: -1 },
        { kind: 'billboard', at: 120, x: 1 },
        { kind: 'dustDevil', at: 180, x: 1, data: { count: 2 } },
      ],
    },
    // ---- 2340 – 2720: the salt lake. The road crests a rise, then the white pan opens up below it.
    { len: 70, name: 'lake', rise: 5.5, vEase: 24, left: lakeL, right: lakeR },
    {
      len: 70, name: 'lake', rise: -6.5, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -8, x1: 8, data: { peak: 2410 } }],
    },
    {
      len: 240, name: 'lake',
      features: [
        { kind: 'pickupRow', at: 60, len: 18, x0: -4.5, x1: 4.5, data: { kind: 'coin' } },
        { kind: 'oil', at: 150, len: 9, x0: 0.8, x1: 4.2 },
      ],
      marks: [
        { kind: 'saltLake', at: 0, x: 0, data: { len: 240 } },
        { kind: 'camelCaravan', at: 120, x: 1 },
        { kind: 'billboard', at: 190, x: -1 },
      ],
    },
    // ---- 2720 – 3040: the R 200 sweeper under the wind-turbine ridge.
    {
      len: 320, name: 'sweeperB', radius: 200, rise: -2, bank: 3, ease: 70, left: desertL, right: desertR,
      features: [{ kind: 'pickupRow', at: 120, len: 15, x0: 4.5, x1: -1.5, data: { kind: 'coin' } }],
      marks: [
        { kind: 'turbines', at: 10, x: -1, data: { count: 3 } },
        { kind: 'mesa', at: 60, x: 1, data: { count: 2 } },
        { kind: 'poles', at: 0, x: 1, data: { len: 320 } },
      ],
    },
    // ---- 3040 – 3420: the final run — a ramp, a boost pad, and the last dune ahead.
    {
      len: 380, name: 'finalRun', rise: -2, left: desertL, right: desertR,
      features: [
        { kind: 'ramp', at: 120, len: 8, x0: -3.0, x1: 0.8, data: { height: 2.0 } },
        { kind: 'pickupRow', at: 200, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'can' } },
        { kind: 'boostPad', at: 300, len: 6, x0: -5.2, x1: -1.8, data: { power: 0.3, time: 1 } },
      ],
      marks: [
        { kind: 'warnRamp', at: 90, x: 1 },
        { kind: 'dunes', at: 0, x: -1, data: { len: 380 } },
        { kind: 'dustDevil', at: 240, x: 1, data: { count: 3 } },
      ],
    },
    // ---- 3420 – 3560: the last dune crest before the oasis.
    { len: 70, name: 'finalDune', rise: 6, vEase: 24, left: duneL, right: duneR },
    {
      len: 70, name: 'finalDune', rise: -7, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -8, x1: 8, data: { peak: 3490 } }],
    },
    // ---- 3560 – 3750: the oasis finish, under a caravanserai arch.
    {
      len: 190, name: 'finish', left: apronL, right: apronR,
      marks: [
        { kind: 'finishArch', at: 60, x: 0 },
        { kind: 'oasis', at: 20, x: -1 },
        { kind: 'billboard', at: 120, x: 1 },
        { kind: 'camelCaravan', at: 90, x: 1 },
      ],
    },
  ],
};
