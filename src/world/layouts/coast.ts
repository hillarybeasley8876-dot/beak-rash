// 鹈鹕湾海滨公路 Pelican Bay — 3.3 km point-to-point coast road, sea on the LEFT.
// start straight → promenade → beach road → bay sweeper → S-bend → cliffside (rock wall / rail + drop)
// → crest jump → descent with ramp → headland tunnel → bridge over a cove → hillside → fish-market
// quay → final sprint. Heights: sea level 0, road 1–37 m.
import type { GroundDef, LayoutDef, SideDef } from '../layout/types';

const G = (g: Partial<GroundDef>): GroundDef => ({
  step: 0, stepW: 2, flat: 4, slope: 0.3, target: 30, rough: 3, abs: false, detached: false, mat: 'grass', ...g,
});

// ---- sea side presets (left)
const startL: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ abs: true, step: 0.6, stepW: 0.5, flat: 10, slope: -0.05, target: -18, rough: 0.4, mat: 'sand' }) };
const seawallL: SideDef = { shoulder: 2.2, surface: 'road', edge: 'seawall', ground: G({ abs: true, step: 0.35, stepW: 0.35, flat: 4, slope: -0.05, target: -18, rough: 0.4, mat: 'sand' }) };
const beachL: SideDef = { shoulder: 7, surface: 'sand', edge: 'water', ground: G({ abs: true, step: -0.45, stepW: 0.35, flat: 0, slope: -0.06, target: -18, rough: 0.4, mat: 'sand' }) };
const rocksL: SideDef = { shoulder: 1.8, surface: 'road', edge: 'rail', ground: G({ abs: true, step: 1.2, stepW: 7, flat: 2, slope: -0.22, target: -18, rough: 1.5, mat: 'rock' }) };
const cliffL: SideDef = { shoulder: 1.6, surface: 'road', edge: 'rail', ground: G({ abs: true, step: 2.5, stepW: 15, flat: 3, slope: -0.35, target: -18, rough: 2, mat: 'rock' }) };
const quayL: SideDef = { shoulder: 3.4, surface: 'road', edge: 'quay', ground: G({ abs: true, step: -2.6, stepW: 0.25, flat: 0, slope: -0.25, target: -18, rough: 0.3, mat: 'stone' }) };

// ---- land side presets (right)
const startR: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 34, slope: 0.22, target: 38, rough: 3, mat: 'grass' }) };
const villasR: SideDef = { shoulder: 3.5, surface: 'grass', edge: 'stone', ground: G({ step: 0, stepW: 1, flat: 7, slope: 0.3, target: 42, rough: 4, mat: 'grass' }) };
const hillsR: SideDef = { shoulder: 3, surface: 'grass', edge: 'stone', ground: G({ step: 0, stepW: 1, flat: 4, slope: 0.42, target: 50, rough: 5, mat: 'grass' }) };
const rockWallR: SideDef = { shoulder: 1.4, surface: 'road', edge: 'rock', ground: G({ step: 13, stepW: 1.6, flat: 3, slope: 0.55, target: 55, rough: 6, mat: 'rock' }) };
const marketR: SideDef = { shoulder: 3.6, surface: 'road', edge: 'stalls', ground: G({ step: 0, stepW: 1, flat: 9, slope: 0.3, target: 34, rough: 3, mat: 'stone' }) };
const finishR: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: G({ step: 0, stepW: 1, flat: 30, slope: 0.25, target: 30, rough: 3, mat: 'grass' }) };

export const COAST: LayoutDef = {
  id: 'coast',
  heading: 0,
  elevation: 1.0,
  halfWidth: 7,
  pre: 160,
  post: 280,
  left: startL,
  right: startR,
  bumps: [
    { s: 1505, x: -88, r: 46, h: 13, mat: 'rock' },     // lighthouse promontory
    { s: 640, x: -430, r: 70, h: 16, mat: 'grass' },    // palm island
    { s: 1950, x: -400, r: 95, h: 38, mat: 'rock' },    // rocky island
    { s: 2950, x: -330, r: 46, h: 7, mat: 'sand' },     // sandbar islet
    { s: 2440, x: -160, r: 30, h: 6, mat: 'rock' },     // sea stack
  ],
  segments: [
    {
      len: 150, name: 'start',
      marks: [
        { kind: 'startGantry', at: 46, x: 0 },
        { kind: 'stands', at: 8, x: -1, data: { len: 120 } },
        { kind: 'stands', at: 8, x: 1, data: { len: 120 } },
      ],
    },
    {
      len: 250, name: 'promenade', rise: -0.25, left: seawallL, right: villasR,
      features: [{ kind: 'pickupRow', at: 90, len: 18, x0: -4.5, x1: 1.5, data: { kind: 'coin' } }],
      marks: [{ kind: 'umbrellas', at: 0, x: -1, data: { len: 250 } }, { kind: 'villas', at: 10, x: 1, data: { len: 230 } }],
    },
    {
      len: 300, name: 'beach', radius: -380, rise: -0.1, bank: -2, ease: 60, left: beachL,
      features: [
        { kind: 'pickupRow', at: 30, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'crate' } },
        { kind: 'pickupRow', at: 150, len: 21, x0: -6, x1: -1, data: { kind: 'coin' } },
      ],
      marks: [{ kind: 'villas', at: 20, x: 1, data: { len: 260 } }, { kind: 'towels', at: 30, x: -1, data: { len: 240 } }],
    },
    {
      len: 280, name: 'bay', radius: 320, rise: 7.35, bank: 4, ease: 70, left: rocksL, right: hillsR,
      features: [
        { kind: 'pickupRow', at: 120, len: 15, x0: 2.5, x1: 2.5, data: { kind: 'can' } },
        { kind: 'oil', at: 210, len: 9, x0: -5.5, x1: -2.0 },
      ],
      marks: [{ kind: 'palms', at: 0, x: 1, data: { len: 280 } }],
    },
    { len: 90, name: 'sbend', radius: -150, rise: 4, bank: -5, ease: 40, marks: [{ kind: 'chevrons', at: 0, x: 1, data: { len: 90 } }] },
    {
      len: 90, name: 'sbend', radius: 150, rise: 5, bank: 5, ease: 45,
      marks: [{ kind: 'chevrons', at: 0, x: -1, data: { len: 90 } }],
      features: [{ kind: 'pickupRow', at: 40, len: 12, x0: 0.5, x1: 4.5 }],
    },
    {
      len: 240, name: 'cliff', radius: -600, rise: 9, ease: 60, left: cliffL, right: rockWallR,
      features: [
        { kind: 'pickupRow', at: 90, len: 12, x0: 1.5, x1: -1.5, data: { kind: 'crate' } },
        { kind: 'pickupRow', at: 150, len: 18, x0: -4.5, x1: -4.5, data: { kind: 'coin' } },
      ],
      marks: [{ kind: 'chevrons', at: 20, x: -1, data: { len: 200 } }],
    },
    {
      len: 180, name: 'cliff', radius: 520, rise: 5, ease: 60,
      features: [{ kind: 'pickupRow', at: 80, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'can' } }],
      marks: [{ kind: 'lighthouse', at: 105, x: -88 }, { kind: 'warnCrest', at: 120, x: 1 }],
    },
    { len: 60, name: 'crest', rise: 6, vEase: 24, right: hillsR, sideEase: 40 },
    {
      len: 60, name: 'crest', rise: -8, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -7, x1: 7, data: { peak: 1640 } }],
    },
    {
      len: 200, name: 'descent', radius: -420, rise: -11, vEase: 20, ease: 50,
      features: [
        { kind: 'ramp', at: 112, len: 7, x0: 1.2, x1: 5.0, data: { height: 1.2 } },
        { kind: 'pickupRow', at: 125, len: 10, x0: 3.1, x1: 3.1, data: { kind: 'can' } },
      ],
      marks: [{ kind: 'warnRamp', at: 60, x: 1 }],
    },
    {
      len: 36, name: 'cutting', rise: -0.9, ease: 30,
      left: { shoulder: 1.4, surface: 'road', edge: 'rock', ground: { abs: true, step: 30, stepW: 1.8, flat: 30, slope: -0.4, target: -18, rough: 4, mat: 'rock' } },
      right: { shoulder: 1.4, surface: 'road', edge: 'rock', ground: { abs: false, step: 15, stepW: 1.8, flat: 4, slope: 0.5, target: 48, rough: 5, mat: 'rock' } },
      sideEase: 36,
    },
    // The cutting narrows to the tunnel's bound before the portal plane (portal arch never inside bounds).
    { len: 4, name: 'cutting', rise: -0.1, sideEase: 4, left: { shoulder: 1.0 }, right: { shoulder: 1.0 } },
    {
      len: 160, name: 'tunnel', radius: 900, rise: -2, roof: 17,
      left: { shoulder: 1.0, edge: 'tunnel' }, right: { shoulder: 1.0, edge: 'tunnel' }, sideEase: 4,
      features: [
        { kind: 'tunnel', at: 0, len: 160, x0: -8, x1: 8 },
        { kind: 'puddle', at: 92, len: 7, x0: -4.2, x1: -0.8 },
      ],
    },
    { len: 4, name: 'portal', sideEase: 0, left: { edge: 'rock' }, right: { edge: 'rock' } },
    {
      len: 26, name: 'portal', sideEase: 4,
      left: { shoulder: 1.4, edge: 'rock' }, right: { shoulder: 1.4, edge: 'rock' },
    },
    {
      len: 160, name: 'bridge', radius: -2400, sideEase: 2,
      left: { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: { abs: true, detached: true, step: -9, stepW: 0, flat: 0, slope: -0.1, target: -18, rough: 1, mat: 'sand' } },
      right: { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: { abs: true, detached: true, step: -6, stepW: 0, flat: 64, slope: 0.45, target: 32, rough: 3, mat: 'rock' } },
      features: [
        { kind: 'bridge', at: 0, len: 160, x0: -8.2, x1: 8.2 },
        { kind: 'boostPad', at: 66, len: 6, x0: -5.2, x1: -1.8, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 110, len: 12, x0: 2.5, x1: 2.5, data: { kind: 'crate' } },
      ],
      marks: [{ kind: 'sailboats', at: 80, x: 1, data: { count: 4 } }],
    },
    { len: 40, name: 'bridgeExit', rise: -1, sideEase: 2, left: rocksL, right: hillsR },
    {
      len: 230, name: 'hillside', radius: 300, rise: -9, bank: 4, ease: 70,
      features: [
        { kind: 'pickupRow', at: 60, len: 18, x0: 4.5, x1: -1.5 },
        { kind: 'oil', at: 158, len: 8, x0: 0.8, x1: 4.2 },
      ],
      marks: [{ kind: 'villas', at: 40, x: 1, data: { len: 180 } }, { kind: 'palms', at: 0, x: -1, data: { len: 230 } }],
    },
    {
      len: 140, name: 'village', radius: -340, rise: -2.5, bank: -3, ease: 60, left: seawallL, right: villasR,
      features: [{ kind: 'pickupRow', at: 60, len: 12, x0: -2, x1: -2, data: { kind: 'crate' } }],
      marks: [{ kind: 'umbrellas', at: 10, x: -1, data: { len: 130 } }, { kind: 'villas', at: 0, x: 1, data: { len: 140 } }],
    },
    {
      len: 320, name: 'market', ease: 50, left: quayL, right: marketR,
      features: [
        { kind: 'puddle', at: 70, len: 6, x0: 1.0, x1: 4.0 },
        { kind: 'pickupRow', at: 120, len: 15, x0: -3.5, x1: -3.5, data: { kind: 'fish' } },
        { kind: 'puddle', at: 205, len: 7, x0: -5.0, x1: -2.0 },
        { kind: 'boostPad', at: 262, len: 6, x0: 1.6, x1: 5.0, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 290, len: 12, x0: -3.5, x1: -3.5, data: { kind: 'can' } },
      ],
      marks: [
        { kind: 'stalls', at: 10, x: 1, data: { len: 300 } },
        { kind: 'boats', at: 20, x: -1, data: { len: 280 } },
        { kind: 'pier', at: 150, x: -1 },
      ],
    },
    {
      len: 120, name: 'sprint', radius: 420, ease: 50, left: seawallL, right: villasR,
      features: [{ kind: 'pickupRow', at: 50, len: 15, x0: 0, x1: 0, data: { kind: 'coin' } }],
    },
    {
      len: 160, name: 'finish', left: startL, right: finishR,
      marks: [
        { kind: 'stands', at: 40, x: -1, data: { len: 150 } },
        { kind: 'stands', at: 40, x: 1, data: { len: 150 } },
        { kind: 'finishGantry', at: 160, x: 0 },
      ],
    },
  ],
};
