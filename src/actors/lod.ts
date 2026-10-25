// Rider culling and distance LOD (perf). The skinned body and its ink hull share one bounding sphere padded to the
// rig's reach (spread wings, swings, reaching neck), so riders off-screen or far behind the camera are culled like any
// mesh instead of always costing body + hull + shadow draws. A crash tumble flings the body (and the helmet) far from
// that sphere, so culling is off while crashed. Beyond FAR metres the hull and the body's shadow are dropped (the
// outline is ~1–2 px there and the sun's shadow camera does not reach that far). The bike follows: beyond BIKE_FAR it
// swaps to its merged low-poly model (bikes' setLod), and drops its hull and shadow together with the rider's.
import { Sphere, Vector3, type Object3D, type SkinnedMesh } from 'three';
import type { BikeModel } from './bikes';

/** Body-space sphere around the saddle covering every ride pose and cue. */
const CENTRE = new Vector3(0, 0.25, -0.2), RADIUS = 1.45;
/** Distance band (m) to drop / restore the hull and shadow (hysteresis). */
const FAR = 60, NEAR = 52;
/** Distance band (m) for the bike's low-poly model (hysteresis): a frame tube is under a pixel wide there. */
const BIKE_FAR = 40, BIKE_NEAR = 35;

/** Give a skinned body and its hull one shared, static bounding sphere and turn frustum culling on. */
export function cullable(mesh: SkinnedMesh, hull: SkinnedMesh): void {
  const sphere = new Sphere(CENTRE.clone(), RADIUS);
  mesh.boundingSphere = sphere;
  hull.boundingSphere = sphere;
  mesh.frustumCulled = hull.frustumCulled = true;
}

const tmp = new Vector3();

export class RiderLod {
  private far = false;
  private bikeFar = false;

  constructor(private readonly mesh: SkinnedMesh, private readonly hull: SkinnedMesh,
    private readonly bike: BikeModel | null = null) {}

  /** `root` = the rider's root (its parent is the untransformed session world), `eye` = the render camera. */
  update(root: Object3D, eye: Vector3, crashed: boolean): void {
    const cull = !crashed;
    this.mesh.frustumCulled = this.hull.frustumCulled = cull;
    const d = tmp.copy(root.position).distanceTo(eye);
    const far = this.far ? d > NEAR : d > FAR;
    const bikeFar = this.bikeFar ? d > BIKE_NEAR : d > BIKE_FAR;
    if (far === this.far && bikeFar === this.bikeFar) return;
    this.far = far;
    this.bikeFar = bikeFar;
    this.hull.visible = !far;
    this.mesh.castShadow = !far;
    this.bike?.setLod?.(bikeFar, !far);
  }
}
