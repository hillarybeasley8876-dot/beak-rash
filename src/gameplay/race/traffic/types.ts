// Traffic vehicle catalogue: sizes, cruising speeds, wheels, palettes, spawn weights.
import type { ObstacleKind } from '../../../core/types';

export type VehicleType = 'compact' | 'van' | 'pickup' | 'truck' | 'bus' | 'fish' | 'icecream';

export interface VehicleDef {
  type: VehicleType;
  kind: ObstacleKind;
  length: number;
  width: number;
  height: number;
  /** Cruising speed range (m/s); riders top out around 20 m/s, so most traffic gets overtaken. */
  speed: [number, number];
  wheelR: number;
  /** Wheel centres in model space: [x, z] (z + = rear, models face −Z). */
  wheels: Array<[number, number]>;
  palette: string[];
  weight: number;
  /** Max alive at once (instancing capacity). */
  cap: number;
}

export const VEHICLES: Record<VehicleType, VehicleDef> = {
  compact: {
    type: 'compact', kind: 'car', length: 3.9, width: 1.8, height: 1.55, speed: [10, 14.5], wheelR: 0.34,
    wheels: [[-0.8, -1.25], [0.8, -1.25], [-0.8, 1.25], [0.8, 1.25]],
    palette: ['#e5191c', '#2f80ed', '#ffd23f', '#f2f2f2', '#3fbf8f', '#ff8fb1', '#1d1f2b'], weight: 5, cap: 10,
  },
  van: {
    type: 'van', kind: 'van', length: 4.6, width: 1.95, height: 2.15, speed: [9.5, 13], wheelR: 0.36,
    wheels: [[-0.85, -1.5], [0.85, -1.5], [-0.85, 1.5], [0.85, 1.5]],
    palette: ['#f4f1ea', '#7fb3d5', '#f59a23', '#8e98a8'], weight: 3, cap: 6,
  },
  pickup: {
    type: 'pickup', kind: 'car', length: 4.9, width: 1.95, height: 1.8, speed: [10, 13.5], wheelR: 0.4,
    wheels: [[-0.85, -1.6], [0.85, -1.6], [-0.85, 1.55], [0.85, 1.55]],
    palette: ['#c0392b', '#2c3e50', '#16a085', '#d35400'], weight: 2, cap: 4,
  },
  truck: {
    type: 'truck', kind: 'truck', length: 7.6, width: 2.35, height: 3.2, speed: [8, 11], wheelR: 0.5,
    wheels: [[-1.0, -2.6], [1.0, -2.6], [-1.0, 1.6], [1.0, 1.6], [-1.0, 2.75], [1.0, 2.75]],
    palette: ['#2f80ed', '#e5191c', '#27ae60', '#f2c94c'], weight: 1.5, cap: 4,
  },
  bus: {
    type: 'bus', kind: 'bus', length: 10, width: 2.45, height: 3.05, speed: [8, 10.5], wheelR: 0.5,
    wheels: [[-1.05, -3.3], [1.05, -3.3], [-1.05, 3.0], [1.05, 3.0]],
    palette: ['#e5191c', '#2fbf71', '#ffb000'], weight: 1, cap: 3,
  },
  fish: {
    type: 'fish', kind: 'truck', length: 7.2, width: 2.3, height: 3.1, speed: [8.5, 11.5], wheelR: 0.48,
    wheels: [[-1.0, -2.45], [1.0, -2.45], [-1.0, 1.6], [1.0, 1.6], [-1.0, 2.7], [1.0, 2.7]],
    palette: ['#1f4fd1'], weight: 1, cap: 2,
  },
  icecream: {
    type: 'icecream', kind: 'van', length: 4.8, width: 2.0, height: 2.3, speed: [8, 11], wheelR: 0.36,
    wheels: [[-0.88, -1.55], [0.88, -1.55], [-0.88, 1.6], [0.88, 1.6]],
    palette: ['#ff9ecf', '#8ee3c8'], weight: 1, cap: 2,
  },
};

export const VEHICLE_TYPES = Object.keys(VEHICLES) as VehicleType[];
