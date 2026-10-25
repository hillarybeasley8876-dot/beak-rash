// Per-track route hints (SPEC §20): what a seeded route may draw from, and which pieces of the
// authored layout it keeps. The table lives here (not in the layout files) so the authored layouts
// stay bit-for-bit identical: route 0 never touches the generator.
import type { TrackId } from '../../core/types';

/** The shape a generic piece is cut in. */
export type GenericKind = 'curve' | 'chicane' | 'hairpin' | 'straight';

export interface RouteHint {
  /** Authored segments kept at the start (the grid and its run-up). */
  head: number;
  /** Authored segments kept at the end (the finish and its run-in). */
  tail: number;
  /** Radii (m) a generic piece may draw from; never below minRadius. */
  radii: number[];
  /** Radius of a generic S-chicane (m). */
  chicane: number;
  /** Radius of a generic hairpin (m). */
  hairpin: number;
  /** The generic shapes this track's pool holds. */
  kinds: GenericKind[];
  /** Tightest curve a route may draw (m). */
  minRadius: number;
  /** How far above the authored maximum the road may climb (m). */
  bandTop: number;
  /** How far below the authored minimum the road may drop (m); 0 = never below the sea. */
  bandBottom: number;
  /**
   * Terrain domes the road must stay clear of, as [s, along, x, radius] in the road's frame — the
   * mountain's lake peaks, which the terrain mod anchors to a fixed s (env/mountain-relief.ts).
   */
  keepClear?: Array<[number, number, number, number]>;
}

/**
 * The hints per track. The head / tail keep the start grid and the finish (with their gantries,
 * stands and banners); the middle is redrawn from the pool. The generic radii are the track's own
 * character: tight and busy in the city, wide and fast on the gobi.
 */
export const ROUTE_HINTS: Record<TrackId, RouteHint> = {
  coast: {
    head: 1, tail: 1,
    radii: [70, 110, 170, 260, 380],
    chicane: 55, hairpin: 48,
    kinds: ['curve', 'chicane', 'straight'],
    minRadius: 25,
    bandTop: 3, bandBottom: 0,
  },
  city: {
    head: 1, tail: 1,
    radii: [40, 60, 95, 150, 240, 380],
    chicane: 32, hairpin: 28,
    kinds: ['curve', 'chicane', 'straight'],
    minRadius: 25,
    bandTop: 3, bandBottom: 0,
  },
  mountain: {
    head: 1, tail: 1,
    radii: [50, 85, 140, 240, 420],
    chicane: 45, hairpin: 27,
    kinds: ['curve', 'chicane', 'hairpin', 'straight'],
    minRadius: 25,
    bandTop: 6, bandBottom: 0,
    // The lake peaks across the water (env/mountain-relief.ts): the road may not run into one.
    keepClear: [
      [631, -3, -708, 260], [40, 0, -980, 330], [0, -380, -640, 240], [641, 1, -1109, 300],
      [652, 9, -423, 220], [3588, 779, -162, 280], [3588, 620, -478, 260], [3527, 0, -541, 300],
    ],
  },
  watertown: {
    head: 1, tail: 1,
    radii: [40, 62, 100, 170, 280],
    chicane: 34, hairpin: 32,
    kinds: ['curve', 'chicane', 'straight'],
    minRadius: 25,
    bandTop: 2, bandBottom: 0,
  },
  gobi: {
    head: 1, tail: 1,
    radii: [90, 150, 260, 420, 700],
    chicane: 70, hairpin: 75,
    kinds: ['curve', 'chicane', 'straight'],
    minRadius: 25,
    bandTop: 4, bandBottom: 0,
  },
};

/** The hint for a track (every track has one). */
export const routeHint = (id: TrackId): RouteHint => ROUTE_HINTS[id];
