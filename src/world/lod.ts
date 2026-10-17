// Distance culling against the fog: meshes whose bounding sphere lies entirely past fog.far are
// hidden (frustum culling alone would still draw fogged-out props up to the 2.4 km far plane).
// Without fog (aerial / debug views) everything stays visible.
import { Mesh, type Group, type Object3D } from 'three';
import type { WorldCtx } from './ctx';

const MARGIN = 40;
const SKIP = new Set(['sky', 'clouds', 'sea', 'gulls', 'road', 'shoulderL', 'shoulderR', 'curbs']);

export function installFogCull(ctx: WorldCtx, group: Group): void {
  const list: Mesh[] = [];
  group.children.forEach((o: Object3D) => {
    if (!(o instanceof Mesh) || SKIP.has(o.name) || o.name.startsWith('far:')) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    list.push(o);
  });
  ctx.onUpdate((_dtSim, _dtReal, camera) => {
    const fog = ctx.app.scene.fog;
    const far = fog && 'far' in fog ? fog.far + MARGIN : Infinity;
    for (const m of list) {
      const bs = m.geometry.boundingSphere;
      m.visible = !bs || bs.center.distanceTo(camera.position) - bs.radius < far;
    }
  });
}
