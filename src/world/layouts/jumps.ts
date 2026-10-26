// The jump catalogue (r5): the same kickers and jump hills on every track, so the air is the same
// everywhere and the feel can be tuned from one table.
//   kicker — a wedge the sim rides up (src/sim/features.ts) and the world draws (world/features/ramp.ts).
//   hill   — the road's own shape: it climbs and drops again, and the jumpCrest on its top launches
//            the rider (the road falls away under the flight, so the air is long).
// The air times below are what the sim gives at 22 m/s (measured with the offline model, ~8 % less
// in the browser because the rider loses a little speed on the way up).
import type { FeatureDef, MarkDef, SegmentDef, SideDef } from '../layout/types';

/** The kicker presets: the wedge's length and lip height (m), and the air they give. */
export const KICK = {
  /** A low kicker on the shoulder — ≈ 0.85 s of air. */
  low: { len: 8, height: 1.8, air: 0.85 },
  /** A full kicker — ≈ 0.95 s of air. */
  mid: { len: 9, height: 2.2, air: 0.93 },
  /** The big one, for a road that falls away under the flight — ≈ 1.4 s of air. */
  big: { len: 12, height: 3, air: 1.45 },
} as const;

export type KickerKind = keyof typeof KICK;

/** A kicker feature: the wedge the sim rides. `x0`/`x1` are its lateral extent on the road. */
export function kicker(kind: KickerKind, at: number, x0: number, x1: number): FeatureDef {
  const k = KICK[kind];
  return { kind: 'ramp', at, len: k.len, x0, x1, data: { height: k.height } };
}

/** The jump hill: the road climbs `rise` over `len` metres and drops back, with a sharp crest on top. */
export const HILL = { len: 12, rise: 3.4, vEase: 6 } as const;

/**
 * The two segments of a jump hill, in the order they are laid down. The crest's feature sits on the
 * second one, so it straddles the top; its peak is filled in by `fixCrestPeaks`.
 */
export function hill(name: string, halfWidth: number): [SegmentDef, SegmentDef] {
  return [
    { len: HILL.len, name, rise: HILL.rise, vEase: HILL.len, ease: HILL.len },
    {
      len: HILL.len, name, rise: -HILL.rise, vEase: HILL.vEase, ease: HILL.vEase,
      features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -halfWidth - 1, x1: halfWidth + 1, data: { big: 1 } }],
    },
  ];
}

/** Fill in every jump crest's absolute peak (the top of the hill it stands on). */
export function fixCrestPeaks(segs: SegmentDef[]): void {
  let s = 0;
  for (const g of segs) {
    for (const f of g.features ?? []) {
      if (f.kind !== 'jumpCrest') continue;
      f.data = { ...(f.data ?? {}), peak: s + f.at + f.len / 2 };
    }
    s += g.len;
  }
}

/**
 * The mega jump (r5): the landmark launch — a tall kicker hill with a long downhill landing.
 * The road climbs `upRise` over `upLen` metres, crests, and drops away over `downLen` metres, so
 * the rider flies the whole descent: ≈ 2.2 s of air at 22 m/s, enough for a three-trick chain
 * (SPEC §16: 0.25 s before the first trick + 0.55 s per spin + 85 % of the last one ≈ 1.95 s).
 * The shape is the same on every track, so the feel is tuned from one table.
 */
export const MEGA = {
  upLen: 18, upRise: 8, downLen: 44, downRise: 8, vEaseUp: 10, vEaseDown: 12,
} as const;

/** A mega-jump shape: the climb, the crest and the long landing (metres). */
export interface MegaShape {
  upLen: number; upRise: number; downLen: number; downRise: number;
  vEaseUp?: number; vEaseDown?: number;
}

/** The ground the mega jump stands on: the sides of the road and how fast they change. */
export interface MegaSides {
  left?: SideDef;
  right?: SideDef;
  sideEase?: number;
}

/**
 * The two segments of the mega jump, in the order they are laid down. The crest's feature sits on
 * the second one, so it straddles the top; its peak is filled in by `fixCrestPeaks`. `marks` are
 * placed on the climb, `at` metres from its start. `sides` gives the ground the jump stands on
 * (a bridge over a canal, a viaduct over the street) and how fast the sides change.
 */
export function megaHill(name: string, halfWidth: number, shape: MegaShape = MEGA, marks?: MarkDef[], sides?: MegaSides): [SegmentDef, SegmentDef] {
  const vUp = shape.vEaseUp ?? 10;
  const vDown = shape.vEaseDown ?? 12;
  const up: SegmentDef = { len: shape.upLen, name, rise: shape.upRise, vEase: vUp, ease: vUp };
  const down: SegmentDef = {
    len: shape.downLen, name, rise: -shape.downRise, vEase: vDown, ease: vDown,
    features: [{ kind: 'jumpCrest', at: -8, len: 16, x0: -halfWidth - 1, x1: halfWidth + 1, data: { big: 1, mega: 1 } }],
  };
  if (marks?.length) up.marks = marks;
  if (sides) {
    if (sides.left) up.left = sides.left;
    if (sides.right) up.right = sides.right;
    if (sides.sideEase !== undefined) up.sideEase = sides.sideEase;
    down.left = up.left;
    down.right = up.right;
    down.sideEase = up.sideEase;
  }
  return [up, down];
}

/**
 * A segment with a jump hill cut into it `at` metres in: the head keeps the segment's own content
 * (its features, marks and grade) and the hill and the tail follow. The tail keeps the segment's
 * radius, so a straight segment stays straight.
 */
export function hillIn(seg: SegmentDef, at: number, halfWidth: number): SegmentDef[] {
  const [up, down] = hill(seg.name ?? 'road', halfWidth);
  const head: SegmentDef = { ...seg, len: at, rise: (seg.rise ?? 0) * (at / seg.len) };
  const tailLen = seg.len - at - up.len - down.len;
  const tail: SegmentDef = { len: tailLen, name: seg.name, rise: (seg.rise ?? 0) * (tailLen / seg.len) };
  if (seg.radius !== undefined) tail.radius = seg.radius;
  if (seg.bank !== undefined) tail.bank = seg.bank;
  if (seg.ease !== undefined) tail.ease = seg.ease;
  return [head, up, down, tail];
}
