// Layout format: a track is a list of segments (curvature / elevation / bank) plus side profiles and
// gameplay features positioned relative to each segment. layout/build.ts turns it into a sampled
// centre line; one new environment = one layout file (layouts/<id>.ts) + one dressing module.
import type { FeatureKind, Surface, TrackId } from '../../core/types';

/** What bounds the drivable area on one side (drawn by road/edges.ts, mapped to bounds().*Kind). */
export type EdgeKind =
  | 'rail'      // steel guard rail on posts
  | 'barrier'   // red/white concrete barrier (start / finish areas)
  | 'seawall'   // low white wall with railing (promenade)
  | 'stone'     // low rough stone wall
  | 'parapet'   // bridge parapet
  | 'rock'      // natural rock wall (the near terrain rises right at the edge)
  | 'tunnel'    // tunnel wall (inside the tube)
  | 'stalls'    // market kerb + planters
  | 'quay'      // quay edge, no barrier: beyond is water (riders can fall in)
  | 'water';    // sand runs into the sea: beyond is water

/** Terrain beyond the drivable edge. Heights in metres; `abs` = absolute (sea level 0) else relative to the road. */
export interface GroundDef {
  /** Height reached right after the edge (wall top, embankment foot, beach level). */
  step: number;
  /** Width over which the step happens (0.3 = vertical face, 8 = embankment). */
  stepW: number;
  /** Width of the level band after the step (beach, verge, village plaza, cove). */
  flat: number;
  /** Grade of the main slope after the band (rise per metre, sign gives direction). */
  slope: number;
  /** Height where the main slope stops. */
  target: number;
  /** Noise amplitude far from the road (m). */
  rough: number;
  /** step/target are absolute heights (sea level 0) instead of relative to the road. */
  abs: boolean;
  /** Terrain does not touch the road edge (bridge): the edge column starts at `step`. */
  detached: boolean;
  /** Dominant ground material near the road. */
  mat: 'sand' | 'grass' | 'rock' | 'dirt' | 'stone';
}

export interface SideDef {
  /** Drivable shoulder beyond the asphalt edge (m), coplanar with the road. */
  shoulder: number;
  /** Shoulder surface. */
  surface: Surface;
  edge: EdgeKind;
  ground: GroundDef;
}

/** Gameplay feature positioned relative to its segment's start (s = segStart + at). */
export interface FeatureDef {
  kind: FeatureKind;
  at: number;
  len: number;
  x0: number;
  x1: number;
  data?: Record<string, number | string | boolean>;
}

/** Scenery hook for the dressing module (landmarks placed by layout authors). */
export interface MarkDef {
  kind: string;
  at: number;
  x: number;
  data?: Record<string, number | string | boolean>;
}

export interface SegmentDef {
  len: number;
  /** Signed radius (m): + turns right, − turns left; omitted = straight. */
  radius?: number;
  /** Elevation change over the segment (m). */
  rise?: number;
  /** Bank in degrees, + = right side lower. */
  bank?: number;
  /** Curvature/bank transition length centred on this segment's start (m, default 30). */
  ease?: number;
  /** Slope transition length centred on this segment's start (m, default = ease). */
  vEase?: number;
  /** Zone name for dressing (consecutive segments with the same name merge). */
  name?: string;
  /** Side profile changes from this segment's start (merged onto the previous profile). */
  left?: Partial<Omit<SideDef, 'ground'>> & { ground?: Partial<GroundDef> };
  right?: Partial<Omit<SideDef, 'ground'>> & { ground?: Partial<GroundDef> };
  /** Metres over which side changes blend (default 24). */
  sideEase?: number;
  /** Tunnel roof height above the road over this segment (m); terrain covers the road. */
  roof?: number;
  features?: FeatureDef[];
  marks?: MarkDef[];
}

/** Landmark terrain dome (island, promontory): terrain = max(terrain, dome) around (s, x). */
export interface BumpDef {
  s: number;
  x: number;
  /** Radius (m) and absolute peak height (m above sea level). */
  r: number;
  h: number;
  mat?: 'sand' | 'grass' | 'rock';
}

export interface LayoutDef {
  id: TrackId;
  bumps?: BumpDef[];
  /** Heading at s = 0 (rad, 0 = −Z, + turns right). */
  heading: number;
  /** Road elevation at s = 0 (m above sea level). */
  elevation: number;
  halfWidth: number;
  /** Visual road before the start / after the finish (straight extrapolation, m). */
  pre: number;
  post: number;
  /** Initial side profiles at s = 0. */
  left: SideDef;
  right: SideDef;
  segments: SegmentDef[];
}
