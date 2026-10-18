// 霓虹夜城 Neon Night — 3.38 km point-to-point night city. Streets lie flat at STREET (9 m above the
// harbour, so the underpass floor stays above the water plane); the expressway climbs 9 m on a
// viaduct and ends in a crest jump, the underpass dips 8 m.
// The ground is absolute and flat ('paved', no relief) and runs out into the harbour ~200 m from the
// road, so blocks never sit on hills; the river lies on the LEFT of the riverside road.
// start plaza → boulevard → corner R35 → street → corner R30 → scramble crossing → neon arcade →
// S-chicane R34 → expressway → crest jump → riverside → red-arch bridge → underpass + tunnel →
// avenue → hairpin R28 round a roundabout → sprint between billboards → finish under the big screen.
import type { GroundDef, LayoutDef, SideDef } from '../layout/types';

/** Street level (m above the harbour water). */
export const STREET = 9;

const G = (g: Partial<GroundDef>): GroundDef => ({
  abs: true, step: STREET, stepW: 0.4, flat: 600, slope: -0.05, target: -12, rough: 0, detached: false, mat: 'paved', ...g,
});
const FLAT = G({});
/** Viaduct: the ground stays at street level under the deck. */
const UNDER = G({ detached: true });
/** Quay wall straight down into the river. */
const RIVER = G({ step: -6, stepW: 0.3, flat: 0, slope: -0.1 });
const RIVER_DECK = G({ step: -6, stepW: 0, flat: 0, slope: -0.1, detached: true });

const plaza: SideDef = { shoulder: 3, surface: 'road', edge: 'barrier', ground: FLAT };
/** Sidewalk (drivable) up to a bollard kerb; shop fronts stand a few metres behind it. */
const walk: SideDef = { shoulder: 2.5, surface: 'road', edge: 'stalls', ground: FLAT };
const arcade: SideDef = { shoulder: 0.9, surface: 'road', edge: 'stalls', ground: FLAT };
const crossing: SideDef = { shoulder: 4.5, surface: 'road', edge: 'stalls', ground: FLAT };
const deck: SideDef = { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: UNDER };
const quay: SideDef = { shoulder: 2.2, surface: 'road', edge: 'parapet', ground: RIVER };
const span: SideDef = { shoulder: 1.2, surface: 'road', edge: 'parapet', ground: RIVER_DECK };
/** Underpass ramps: the street-level ground forms the retaining walls (dressing skins them). */
const cut: SideDef = { shoulder: 1.0, surface: 'road', edge: 'rock', ground: FLAT };
const tube: SideDef = { shoulder: 1.0, surface: 'road', edge: 'tunnel', ground: FLAT };

/** s of the crest top (start of the 'drop' segment): sum of the segment lengths before it. */
const CREST = 160 + 300 + 55 + 140 + 47 + 120 + 260 + 42 + 42 + 150 + 200 + 50;

export const CITY: LayoutDef = {
  id: 'city',
  heading: 0,
  elevation: STREET,
  halfWidth: 7,
  pre: 160,
  post: 280,
  // The city ends in the harbour ~170–430 m from the road (flat 'shore' ground): no need for 1 km of sea.
  farMargin: 460,
  left: plaza,
  right: plaza,
  segments: [
    {
      len: 160, name: 'start',
      marks: [{ kind: 'startGantry', at: 46, x: 0 }],
    },
    {
      len: 300, name: 'boulevard', radius: 900, ease: 60, left: walk, right: walk,
      features: [
        { kind: 'pickupRow', at: 90, len: 18, x0: -4.5, x1: 1.5, data: { kind: 'coin' } },
        { kind: 'puddle', at: 200, len: 6, x0: 1.5, x1: 4.5 },
      ],
      marks: [
        { kind: 'busStop', at: 60, x: 1 }, { kind: 'subway', at: 150, x: 1 }, { kind: 'busStop', at: 240, x: -1 },
      ],
    },
    { len: 55, name: 'corner', radius: 35, ease: 18 },
    {
      len: 140, name: 'street', ease: 18,
      features: [
        { kind: 'pickupRow', at: 50, len: 12, x0: 3.5, x1: 3.5, data: { kind: 'crate' } },
        { kind: 'oil', at: 100, len: 8, x0: -4.2, x1: -1.0 },
      ],
      marks: [{ kind: 'mural', at: 70, x: -1 }],
    },
    { len: 47, name: 'corner', radius: -30, ease: 16 },
    {
      len: 120, name: 'scramble', ease: 16, left: crossing, right: crossing, sideEase: 12,
      features: [{ kind: 'pickupRow', at: 62, len: 15, x0: 0, x1: 0, data: { kind: 'coin' } }],
      marks: [{ kind: 'scramble', at: 60, x: 0 }, { kind: 'store', at: 18, x: 1 }],
    },
    {
      len: 260, name: 'arcade', radius: -1200, left: arcade, right: arcade, sideEase: 16,
      features: [
        { kind: 'puddle', at: 60, len: 6, x0: -4.5, x1: -1.5 },
        { kind: 'pickupRow', at: 130, len: 12, x0: -3, x1: -3, data: { kind: 'can' } },
        { kind: 'puddle', at: 200, len: 7, x0: 1.0, x1: 4.0 },
      ],
      marks: [{ kind: 'stalls', at: 20, x: -1, data: { len: 220 } }],
    },
    { len: 42, name: 'chicane', radius: -34, ease: 16, left: walk, right: walk },
    { len: 42, name: 'chicane', radius: 34, ease: 16 },
    {
      len: 150, name: 'ramp', rise: 9, ease: 30, left: deck, right: deck, sideEase: 8,
      features: [{ kind: 'pickupRow', at: 70, len: 12, x0: 2.5, x1: 2.5, data: { kind: 'coin' } }],
    },
    {
      len: 200, name: 'expressway', radius: 320, rise: 1, ease: 50,
      features: [
        { kind: 'boostPad', at: 60, len: 6, x0: -5.2, x1: -1.8, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 130, len: 15, x0: 3.5, x1: 3.5, data: { kind: 'can' } },
      ],
      marks: [{ kind: 'warnCrest', at: 150, x: 1 }],
    },
    { len: 50, name: 'crest', rise: 2.5, vEase: 20 },
    {
      len: 70, name: 'drop', rise: -11.5, vEase: 5,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -7, x1: 7, data: { peak: CREST } }],
    },
    {
      len: 300, name: 'riverside', radius: 520, ease: 60, left: quay, right: walk,
      features: [
        { kind: 'pickupRow', at: 100, len: 15, x0: -3.5, x1: -3.5, data: { kind: 'fish' } },
        { kind: 'puddle', at: 210, len: 7, x0: -5.0, x1: -2.0 },
      ],
      marks: [{ kind: 'skyline', at: 150, x: -1 }, { kind: 'busStop', at: 160, x: 1 }],
    },
    {
      len: 140, name: 'bridge', sideEase: 2, left: span, right: span,
      features: [
        { kind: 'bridge', at: 0, len: 140, x0: -8.2, x1: 8.2 },
        { kind: 'pickupRow', at: 70, len: 12, x0: 2.5, x1: 2.5, data: { kind: 'crate' } },
      ],
    },
    { len: 110, name: 'riverside', sideEase: 2, left: quay, right: walk },
    {
      len: 110, name: 'underpass', rise: -8, ease: 30, left: cut, right: cut,
      features: [{ kind: 'pickupRow', at: 50, len: 15, x0: 0, x1: 0, data: { kind: 'coin' } }],
    },
    {
      len: 170, name: 'tunnel', roof: 8, left: tube, right: tube, sideEase: 4,
      features: [
        { kind: 'tunnel', at: 0, len: 170, x0: -8, x1: 8 },
        { kind: 'puddle', at: 95, len: 7, x0: -4.2, x1: -0.8 },
      ],
    },
    { len: 104, name: 'underpass', rise: 8, ease: 30, left: cut, right: cut, sideEase: 4 },
    {
      len: 160, name: 'avenue', left: walk, right: walk,
      features: [{ kind: 'pickupRow', at: 70, len: 12, x0: -3.5, x1: -3.5, data: { kind: 'can' } }],
      marks: [{ kind: 'subway', at: 100, x: -1 }],
    },
    { len: 88, name: 'hairpin', radius: 28, ease: 20, marks: [{ kind: 'roundabout', at: 44, x: 28 }] },
    {
      len: 100, name: 'avenue', ease: 20,
      features: [{ kind: 'oil', at: 50, len: 8, x0: 0.8, x1: 4.2 }],
    },
    {
      len: 300, name: 'sprint',
      features: [
        { kind: 'boostPad', at: 110, len: 6, x0: 1.6, x1: 5.0, data: { power: 0.3, time: 1 } },
        { kind: 'pickupRow', at: 200, len: 15, x0: -2, x1: -2, data: { kind: 'coin' } },
      ],
      marks: [{ kind: 'busStop', at: 60, x: 1 }],
    },
    {
      len: 160, name: 'finish', left: plaza, right: plaza,
      marks: [{ kind: 'finishGantry', at: 160, x: 0 }],
    },
  ],
};
