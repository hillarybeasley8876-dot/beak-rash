// Bike construction API used by the per-bike definitions (defs/*.ts).
// Parts are authored in BIKE SPACE; each moving group declares its pivot (bike space) and becomes a bone.
// bake() merges the whole bike into one rigidly skinned geometry (bind pose = bike space) and returns
// the bone rest transforms and marker positions (local to their parent bone).
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { BikeId, Quality } from '../../core/types';
import { segScale, type Seg } from './build/geo';
import { PartSet, type BuiltGroup } from './build/partset';

export type GroupName =
  | 'headset' | 'steer' | 'wheelR' | 'wheelF' | 'crank' | 'pedalL' | 'pedalR'
  | 'crank2' | 'pedal2L' | 'pedal2R' | 'fish' | 'streamerL' | 'streamerR';
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
  /** Segment-count multiplier on top of quality (busy bikes trade smoothness for the tri budget). */
  detail?: number;
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
}

export interface TemplateMarker { name: MarkerName; parent: Parent; position: Vector3 }

interface GroupRec { name: GroupName; parent: Parent; world: Matrix4; parts: PartSet }

const QUALITY_SCALE: Record<Quality, number> = { high: 1, medium: 0.75, low: 0.5 };

export class BikeBuilder {
  readonly seg: Seg;
  private readonly frame = new PartSet();
  private readonly groups = new Map<GroupName, GroupRec>();
  private readonly marks = new Map<MarkerName, { parent: Parent; pos: Vector3 }>();

  constructor(readonly quality: Quality, detail = 1) {
    this.seg = segScale(QUALITY_SCALE[quality] * detail);
  }

  /** Declare a moving group pivoting at `pos` with rest rotation `rot` (both bike space). */
  group(name: GroupName, parent: Parent, pos: Vector3, rot = new Euler()): PartSet {
    if (this.groups.has(name)) throw new Error(`[bikes] group ${name} declared twice`);
    if (parent && !this.groups.has(parent)) throw new Error(`[bikes] group ${name}: parent ${parent} not declared yet`);
    const world = new Matrix4().compose(pos, new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1));
    const rec: GroupRec = { name, parent, world, parts: new PartSet() };
    this.groups.set(name, rec);
    return rec.parts;
  }

  /** Parts list of a declared group, or of the static frame (null). */
  parts(name: Parent): PartSet {
    if (name === null) return this.frame;
    const g = this.groups.get(name);
    if (!g) throw new Error(`[bikes] unknown group ${name}`);
    return g.parts;
  }

  has(name: GroupName): boolean { return this.groups.has(name); }

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
      groups.push({ name: g.name, parent: g.parent, position, quaternion, bindInverse: g.world.clone().invert() });
      all.absorb(g.parts, i + 1);
    });
    const markers: TemplateMarker[] = [];
    for (const [name, m] of this.marks) {
      markers.push({ name, parent: m.parent, position: m.pos.clone().applyMatrix4(this.worldOf(m.parent).clone().invert()) });
    }
    return { built: all.build(), groups, markers };
  }
}
