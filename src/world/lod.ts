// Distance culling against the fog: meshes whose bounding sphere lies entirely past fog.far are
// hidden (frustum culling alone would still draw fogged-out props up to the 2.4 km far plane).
// Without fog (aerial / debug views) everything stays visible. A mesh may widen its margin with
// userData.cullMargin (m), e.g. the far terrain chunks. Outline hulls (userData.isOutline children)
// switch off once their whole batch cell is past HULL_FAR: a 4 cm outline is < 0.4 px there.
import { Mesh, type Group, type Object3D } from 'three';
import type { WorldCtx } from './ctx';

const MARGIN = 40;
const HULL_FAR = 130;
const SKIP = new Set(['sky', 'clouds', 'sea', 'gulls', 'road', 'shoulderL', 'shoulderR', 'curbs', 'roadMarks']);

interface Culled { mesh: Mesh; hull: Object3D | null; margin: number }

export function installFogCull(ctx: WorldCtx, group: Group): void {
  const list: Culled[] = [];
  group.children.forEach((o: Object3D) => {
    if (!(o instanceof Mesh) || SKIP.has(o.name)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const margin = typeof o.userData.cullMargin === 'number' ? o.userData.cullMargin : MARGIN;
    list.push({ mesh: o, hull: o.children.find((c) => c.userData.isOutline === true) ?? null, margin });
  });
  ctx.onUpdate((_dtSim, _dtReal, camera) => {
    const fog = ctx.app.scene.fog;
    const far = fog && 'far' in fog ? fog.far : Infinity;
    for (const { mesh, hull, margin } of list) {
      const bs = mesh.geometry.boundingSphere;
      const near = bs ? bs.center.distanceTo(camera.position) - bs.radius : 0;
      mesh.visible = near < far + margin;
      if (hull) hull.visible = far === Infinity || near < HULL_FAR;
    }
  });
}
