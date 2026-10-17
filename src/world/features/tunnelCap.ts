// The hill over a tunnel: a terrain-material ribbon spanning the cutting's wall tops, coloured like
// the surrounding ground (grass on top, rock where steep) so the headland reads as one landform.
import { Color, Mesh, Vector3 } from 'three';
import type { TrackFeature } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { GridGeo, rowsBetween } from '../geom';
import type { TerrainField } from '../terrain/field';
import { terrainMat } from '../terrain/material';
import { groundColor } from '../terrain/profile';

export function buildTunnelCap(ctx: WorldCtx, field: TerrainField, f: TrackFeature, W: number, capY: (s: number, x: number, W: number) => number): void {
  const COLS = 15;
  const rows = rowsBetween(f.s0, f.s1, 3);
  const g = new GridGeo(rows.length, COLS);
  const p = new Vector3();
  rows.forEach((s, r) => {
    for (let c = 0; c < COLS; c++) {
      const x = -W + (2 * W * c) / (COLS - 1);
      ctx.q.toWorld(s, x, 0, p);
      p.y = capY(s, x, W);
      g.set(r, c, p, p, p.x / 6, p.z / 6);
    }
  });
  const geo = g.build({ colors: true, computeNormals: true });
  const nrm = geo.getAttribute('normal');
  const col = new Color();
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const y = g.pos[i * 3 + 1] ?? 0;
      groundColor('grass', y, nrm.getY(i), 30, field.noise.get((g.pos[i * 3] ?? 0) / 23, (g.pos[i * 3 + 2] ?? 0) / 23), false, col);
      g.color(r, c, col);
    }
  }
  const mesh = new Mesh(ctx.own(geo), terrainMat(ctx));
  mesh.name = 'tunnelCap';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  ctx.group.add(mesh);
}
