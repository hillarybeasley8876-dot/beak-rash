// Bike ↔ rider contract (actors unit: rider side; bikes sub-unit: bike side).
// Bike models face -Z, +Y up, +X right; root origin = road contact midway between the wheels.
import type { Group, Object3D } from 'three';
import type { BikeId, Quality } from '../../core/types';

export interface BikeMarkers {
  saddle: Object3D;    // top of the saddle; rider pelvis sits here
  gripL: Object3D;     // handlebar grips (children of `steer`, so they turn with it)
  gripR: Object3D;
  pedalL: Object3D;    // pedal centres (children of the crank arms, kept level)
  pedalR: Object3D;
  /** Bell on the bars (child of `steer`): the rider's hand target when ringing it (taunt). */
  bell?: Object3D;
  /** Optional: front basket (shared bike), rear rack (erba), stoker seat (tandem passenger). */
  basket?: Object3D;
  rack?: Object3D;
  stoker?: Object3D;
}

export interface BikeModel {
  readonly id: BikeId;
  readonly root: Group;
  readonly steer: Object3D;     // fork + bars pivot; rotation.y = steer angle
  readonly markers: BikeMarkers;
  readonly wheelRadius: number;
  readonly wheelbase: number;
  /** Spin wheels & crank from speed (m/s), turn the bars (rad). Crank cadence is the bike's own gearing. */
  update(dt: number, speed: number, steerAngle: number): void;
  /** Crank angle (rad) for pedalling IK phase. */
  readonly crankAngle: number;
  dispose(): void;
}

export type CreateBike = (id: BikeId, opts: { quality: Quality; tint?: string }) => BikeModel;
