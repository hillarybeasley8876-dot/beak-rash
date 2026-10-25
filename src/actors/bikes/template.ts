// Bike construction API used by the per-bike definitions (defs/*.ts).
// Parts are authored in BIKE SPACE; each moving group declares its pivot (bike space) and becomes a bone.
// bake() merges the whole bike into one rigidly skinned geometry (bind pose = bike space) and returns
// the bone rest transforms and marker positions (local to their parent bone).
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { BikeId, Quality } from '../../core/types';
import { farSeg, segScale, type Seg } from './build/geo';
import { PartSet, type BuiltGroup } from './build/partset';

export type GroupName =
  | 'headset' | 'steer' | 'wheelR' | 'wheelF' | 'crank' | 'pedalL' | 'pedalR'
  | 'crank2' | 'pedal2L' | 'pedal2R' | 'fish'
  /** Kid-bike streamer chains (root at the grip end → mid → tip). */
  | 'streamerL' | 'streamerL2' | 'streamerL3' | 'streamerR' | 'streamerR2' | 'streamerR3'
  /** Per wheel: spokes/mag arms (child of the wheel, dissolved at speed), speed-blur disc and knobbly tread
   *  (siblings of the wheel, turned at a capped rate so they never strobe). */
  | 'spokesR' | 'spokesF' | 'blurR' | 'blurF' | 'treadR' | 'treadF';
export type MarkerName = 'saddle' | 'gripL' | 'gripR' | 'pedalL' | 'pedalR' | 'basket' | 'rack' | 'stoker' | 'bell';
/** null = the bike root (static frame). */
export type Parent = GroupName | null;

export interface DriveSpec {
  /** free = freewheel (cranks stop while braking), fixed = fixie, balance = no pedals (feet paddle). */
  kind: 'free' | 'fixed' | 'balance';
  /** Wheel revolutions per crank revolution (balance: metres of road per paddle cycle). */
  gear: number;
  /** Balance bikes: foot-peg centres (bike space) and the paddle stride. */
  pegs?: { L: Vector3; R: Vector3 };
  stride?: { x: number; ahead: number; behind: number; lift: number };
}

export interface BikeDef {
  id: BikeId;
  wheelRadius: number;
  wheelbase: number;
  drive: DriveSpec;
  build(b: BikeBuilder): void;
}

export interface TemplateGroup {
  name: GroupName;
  parent: Parent;
  /** Rest transform relative to the parent bone. */
  position: Vector3;
  quaternion: Quaternion;
  /** Inverse of the bone's bike-space rest matrix (skeleton bind inverse). */
  bindInverse: Matrix4;
  /** Angular period (rad) of a spinning pattern on this bone (spoke / tread spacing), if declared. */
  period?: number;
}

export interface TemplateMarker { name: MarkerName; parent: Parent; position: Vector3 }

interface GroupRec { name: GroupName; parent: Parent; world: Matrix4; parts: PartSet }

const QUALITY_SCALE: Record<Quality, number> = { high: 1, medium: 0.75, low: 0.5 };

export class BikeBuilder {
  readonly seg: Seg;
  private readonly frame: PartSet;
  private readonly groups = new Map<GroupName, GroupRec>();
  private readonly marks = new Map<MarkerName, { parent: Parent; pos: Vector3 }>();
  private readonly periods = new Map<GroupName, number>();

  /** `far`: the distance LOD — same groups, pivots and markers, a third of the segments, no detail parts
   *  (PartSet.detail), whatever the quality. */
  constructor(readonly quality: Quality, readonly far = false) {
    this.seg = far ? farSeg : segScale(QUALITY_SCALE[quality]);
    this.frame = new PartSet(far);
  }

  /** Declare a moving group pivoting at `pos` with rest rotation `rot` (both bike space). */
  group(name: GroupName, parent: Parent, pos: Vector3, rot = new Euler()): PartSet {
    if (this.groups.has(name)) throw new Error(`[bikes] group ${name} declared twice`);
    if (parent && !this.groups.has(parent)) throw new Error(`[bikes] group ${name}: parent ${parent} not declared yet`);
    const world = new Matrix4().compose(pos, new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1));
    const rec: GroupRec = { name, parent, world, parts: new PartSet(this.far) };
    this.groups.set(name, rec);
    return rec.parts;
  }

  /** Declare a group with `like`'s pivot and rest rotation, under `parent` (default: like's own parent). */
  alias(name: GroupName, like: GroupName, parent?: Parent): PartSet {
    const src = this.groups.get(like);
    if (!src) throw new Error(`[bikes] group ${name}: ${like} not declared yet`);
    const pos = new Vector3(), q = new Quaternion(), scale = new Vector3();
    src.world.decompose(pos, q, scale);
    return this.group(name, parent === undefined ? src.parent : parent, pos, new Euler().setFromQuaternion(q));
  }

  /** Parts list of a declared group, or of the static frame (null). */
  parts(name: Parent): PartSet {
    if (name === null) return this.frame;
    const g = this.groups.get(name);
    if (!g) throw new Error(`[bikes] unknown group ${name}`);
    return g.parts;
  }

  has(name: GroupName): boolean { return this.groups.has(name); }

  /** Record the angular period of the pattern a spinning group carries (animate.ts reads it). */
  period(name: GroupName, rad: number): void { this.periods.set(name, rad); }

  marker(name: MarkerName, parent: Parent, pos: Vector3): void {
    this.marks.set(name, { parent, pos: pos.clone() });
  }

  private worldOf(p: Parent): Matrix4 {
    return p ? (this.groups.get(p) as GroupRec).world : new Matrix4();
  }

  /** Merge the whole bike (bone 0 = frame, bone i+1 = groups[i], parent-first order). */
  bake(): { built: BuiltGroup; groups: TemplateGroup[]; markers: TemplateMarker[] } {
    const groups: TemplateGroup[] = [];
    const all = new PartSet().absorb(this.frame, 0);
    [...this.groups.values()].forEach((g, i) => {
      const local = this.worldOf(g.parent).clone().invert().multiply(g.world);
      const position = new Vector3(), quaternion = new Quaternion(), scale = new Vector3();
      local.decompose(position, quaternion, scale);
      groups.push({ name: g.name, parent: g.parent, position, quaternion, bindInverse: g.world.clone().invert(), period: this.periods.get(g.name) });
      all.absorb(g.parts, i + 1);
    });
    const markers: TemplateMarker[] = [];
    for (const [name, m] of this.marks) {
      markers.push({ name, parent: m.parent, position: m.pos.clone().applyMatrix4(this.worldOf(m.parent).clone().invert()) });
    }
    return { built: all.build(), groups, markers };
  }
}
