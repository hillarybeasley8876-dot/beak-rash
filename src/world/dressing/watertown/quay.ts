// The water town's quays: the stone landing (水埠头) — steps down from the quay into the canal —
// and the mooring rings the boats are tied to.
import { Color, Matrix4, Vector3 } from 'three';
import { box, cylinder, trs } from '../../kit/shapes';
import type { Dress } from '../dress';

const C = (h: string): Color => new Color(h);
const PAL = {
  stone: C('#c6bda9'),
  stoneDark: C('#a89e8b'),
  stoneLight: C('#d5cdb9'),
  iron: C('#4a4a4e'),
};

const m = new Matrix4();
const p = new Vector3();

/** The stone landing: a flight of steps from the quay down into the canal. */
export function quaySteps(d: Dress, side: -1 | 1, s: number): void {
  const q = d.ctx.q;
  const fr = q.frameVis(s);
  const bound = d.field.bound(s, side);
  const yaw = Math.atan2(fr.tangent.x, fr.tangent.z);
  const steps = 5, rise = 0.34, run = 0.44, wide = 1.7;
  for (let i = 0; i < steps; i++) {
    const x = side * (bound + 0.12 + (i + 0.5) * run);
    // The heights are relative to the road: the flight starts just under the kerb.
    const y = -0.12 - i * rise;
    q.toWorld(s, x, y, p);
    box(d.b.props.at(p.x, p.z), trs(p.x, p.y, p.z, yaw, run, rise, wide, m), i % 2 ? PAL.stone : PAL.stoneLight);
  }
  // A mooring ring on the top step.
  const x = side * (bound + 0.2);
  q.toWorld(s, x, 0.35, p);
  cylinder(d.b.props.at(p.x, p.z), trs(p.x, p.y, p.z, yaw, 0.05, 0.55, 0.05, m), PAL.iron, 5);
}
