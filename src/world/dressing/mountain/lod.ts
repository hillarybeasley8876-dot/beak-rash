// Sunset Pass distance LOD (env-mountain). The switchback legs see far down the face, so batches
// 300–900 m away were drawn at full detail. Per frame (before the track's fog cull):
// - outline hulls of every batched cell turn off once the cell's nearest point is HULL_FAR away
//   (a 0.04 m outline is a third of a pixel at 100 m in 1080p), saving the hull's triangles and draw call;
// - crowd cells (start/finish stands) get a short draw distance through the fog cull's documented
//   per-mesh margin (userData.cullMargin), since spectators are a few px tall beyond CROWD_FAR.
import { Mesh, Vector3, type Object3D } from 'three';
import type { WorldCtx } from '../../ctx';

const HULL_FAR = 120;
const CROWD_FAR = 160;
const FOG_MARGIN = 40; // the fog cull's default margin (world/lod.ts)

interface Cell { obj: Object3D; c: Vector3; r: number }

function cellOf(m: Mesh, obj: Object3D = m): Cell {
  if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
  const bs = m.geometry.boundingSphere;
  return { obj, c: bs ? bs.center.clone() : new Vector3(), r: bs ? bs.radius : 0 };
}

/** Nearest distance from the camera to the cell's bounding sphere. */
const reach = (cell: Cell, cam: Vector3): number => cell.c.distanceTo(cam) - cell.r;

/** Install the LOD rules for the finished dressing meshes plus this unit's own 'mountain:*' batches in the group. */
export function installMountainLod(ctx: WorldCtx, meshes: Mesh[]): void {
  const hulls: Cell[] = [];
  const crowd: Mesh[] = [];
  const own = ctx.group.children.filter((o): o is Mesh => o instanceof Mesh && o.name.startsWith('mountain:'));
  for (const m of [...meshes, ...own]) {
    for (const ch of m.children) if (ch.userData.isOutline) hulls.push(cellOf(m, ch));
    if (m.name.startsWith('crowd:')) crowd.push(m);
  }
  ctx.onUpdate((_dtSim, _dtReal, camera) => {
    const cam = camera.position;
    const fog = ctx.app.scene.fog;
    const fogFar = fog && 'far' in fog ? fog.far : Infinity;
    for (const h of hulls) h.obj.visible = reach(h, cam) < HULL_FAR;
    // The fog cull runs after this and owns `visible` of top-level meshes: shrink its margin instead.
    const crowdMargin = Number.isFinite(fogFar) ? Math.min(FOG_MARGIN, CROWD_FAR - fogFar) : FOG_MARGIN;
    for (const m of crowd) m.userData.cullMargin = crowdMargin;
  });
}
