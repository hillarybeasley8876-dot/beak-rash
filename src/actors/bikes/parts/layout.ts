// Frame geometry from a handful of numbers (like a real bike's geometry chart), plus the standard
// moving-group rig: rear wheel, crank + level pedals, headset tilted along the head tube → steer → front wheel.
import { Euler, Vector3 } from 'three';
import { v, type V3 } from '../build/geo';
import type { BikeBuilder } from '../template';

export interface LayoutSpec {
  R: number;                 // wheel outer radius (tyre included)
  wb: number;                // wheelbase (hubs at z = ±wb/2)
  bb: [number, number];      // bottom bracket [y, z]
  seatAngle: number;         // degrees from horizontal
  saddleY: number;           // saddle top height
  headAngle: number;         // degrees from horizontal
  head: [number, number];    // head tube [bottom y, top y]
  forkOffset: number;        // hub ahead of the steering axis (m)
  crank: number;             // crank length (0 = no cranks)
  pedalX?: number;           // |x| of the pedal centres
}

export interface Layout {
  s: LayoutSpec;
  hubR: V3; hubF: V3; bb: V3;
  seatDir: V3;               // unit, BB → saddle
  saddle: V3;                // saddle top centre (rider pelvis)
  axis: V3;                  // unit steering axis, pointing up and back
  rake: number;              // headset rest rotation.x
  headBot: V3; headTop: V3; headMid: V3;
  pedalX: number;
  /** Point on the seat-tube line at height y. */
  seat(y: number): V3;
  /** Point on the steering axis at height y. */
  onAxis(y: number): V3;
}

const DEG = Math.PI / 180;

export function layout(s: LayoutSpec): Layout {
  const hubR = v(0, s.R, s.wb / 2), hubF = v(0, s.R, -s.wb / 2);
  const bb = v(0, s.bb[0], s.bb[1]);
  const sa = s.seatAngle * DEG, ha = s.headAngle * DEG;
  const seatDir = v(0, Math.sin(sa), Math.cos(sa));
  const axis = v(0, Math.sin(ha), Math.cos(ha));
  const a0 = v(0, s.R, hubF.z + s.forkOffset / Math.sin(ha));
  const seat = (y: number): V3 => bb.clone().addScaledVector(seatDir, (y - bb.y) / seatDir.y);
  const onAxis = (y: number): V3 => a0.clone().addScaledVector(axis, (y - s.R) / axis.y);
  const headBot = onAxis(s.head[0]), headTop = onAxis(s.head[1]);
  return {
    s, hubR, hubF, bb, seatDir, axis, rake: Math.PI / 2 - ha,
    saddle: seat(s.saddleY), headBot, headTop, headMid: headBot.clone().lerp(headTop, 0.5),
    pedalX: s.pedalX ?? 0.11, seat, onAxis,
  };
}

/** Declare headset → steer → wheelF, wheelR, and (if cranked) crank + pedals; returns the steer rest rotation. */
export function standardRig(b: BikeBuilder, L: Layout, crankGroups: { crank: 'crank' | 'crank2'; bb: V3 }[] = [{ crank: 'crank', bb: L.bb }]): Euler {
  const tilt = new Euler(L.rake, 0, 0);
  b.group('wheelR', null, L.hubR);
  b.group('headset', null, L.headMid, tilt);
  b.group('steer', 'headset', L.headMid, tilt);
  b.group('wheelF', 'steer', L.hubF, tilt);
  if (L.s.crank > 0) {
    for (const { crank, bb } of crankGroups) {
      const pre = crank === 'crank' ? 'pedal' : 'pedal2';
      b.group(crank, null, bb);
      b.group(`${pre}R` as 'pedalR' | 'pedal2R', crank, pedalRest(bb, L, 1));
      b.group(`${pre}L` as 'pedalL' | 'pedal2L', crank, pedalRest(bb, L, -1));
    }
  }
  return tilt;
}

/** Pedal centre at crank angle 0 (right pedal at the top, left at the bottom). */
export function pedalRest(bb: V3, L: Layout, side: 1 | -1): V3 {
  return new Vector3(side * L.pedalX, bb.y + side * L.s.crank, bb.z);
}
