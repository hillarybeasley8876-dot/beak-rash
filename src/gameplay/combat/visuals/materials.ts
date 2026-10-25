// Session material pool for combat visuals. Tinted materials are recycled instead of disposed, so their GL
// programs stay linked between casts (no relink on every honk / torpedo / doge); vertex-coloured ribbons share
// one material per blend mode. warmUp() parks one hidden sub-pixel instance of every variant under the combat
// root for the whole session: core's race warm-up (core/warmup.ts) compiles hidden objects too, behind the
// loading screen, so no combat program compiles after GO (removing them on the first rendered frame let the
// loading screen's frames drop them before the warm-up ever saw them).
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, FrontSide, Mesh, MeshBasicMaterial, NormalBlending,
  type ColorRepresentation, type Material, type Object3D, type Side,
} from 'three';
import { toonMesh } from '../meshes/build';
import { makeRimMaterial, setRim, type RimMaterial } from './rim';

export interface GlowOpts { additive?: boolean; side?: Side }

/**
 * One tiny triangle shaped like the real geometry of a variant: vertex colours (3) or colours + alphas (4)
 * and whether it has normals all change the compiled shader.
 */
function triangle(colors: 0 | 3 | 4, normals: boolean): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  if (normals) g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  if (colors > 0) g.setAttribute('color', new BufferAttribute(new Float32Array(3 * colors).fill(1), colors));
  return g;
}

export class MaterialPool {
  private free = new Map<string, Material[]>();
  private made: Material[] = [];
  private ribbons = new Map<boolean, MeshBasicMaterial>();
  private warm: { objects: Object3D[]; geos: BufferGeometry[] } | null = null;

  /** Per-visual tinted transparent material; hand it back with release() when the visual ends. */
  glow(color: ColorRepresentation, opacity: number, o: GlowOpts = {}): MeshBasicMaterial {
    const side = o.side ?? FrontSide;
    const key = `glow|${o.additive ? 'add' : 'norm'}|${side}`;
    const m = (this.free.get(key)?.pop() as MeshBasicMaterial | undefined) ?? this.track(key, new MeshBasicMaterial({
      transparent: true, depthWrite: false, side, blending: o.additive ? AdditiveBlending : NormalBlending,
    }));
    m.color.set(color);
    m.opacity = opacity;
    return m;
  }

  /** Per-visual rim-lit bubble material (rim.ts); hand it back with release(). */
  rim(color: ColorRepresentation, opacity: number): RimMaterial {
    const m = (this.free.get('rim')?.pop() as RimMaterial | undefined) ?? this.track('rim', makeRimMaterial());
    return setRim(m, color, opacity);
  }

  /** Shared ribbon material: colour and alpha live in the vertices, so every ribbon can use the same one. */
  ribbon(additive: boolean): MeshBasicMaterial {
    let m = this.ribbons.get(additive);
    if (!m) {
      m = new MeshBasicMaterial({
        vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, blending: additive ? AdditiveBlending : NormalBlending,
      });
      this.ribbons.set(additive, m);
      this.made.push(m);
    }
    return m;
  }

  release(m: Material): void {
    const key = m.userData.poolKey;
    if (typeof key !== 'string') return;
    const list = this.free.get(key);
    if (list) list.push(m);
    else this.free.set(key, [m]);
  }

  private track<T extends Material>(key: string, m: T): T {
    m.userData.poolKey = key;
    this.made.push(m);
    return m;
  }

  /** Park one hidden sub-pixel instance of each variant under `root` (compiled by core's warm-up; see header). */
  warmUp(root: Object3D): void {
    // glows, shield rim: tori / discs / spheres (normals) · ribbons: colours + alphas · props: vertex colours + normals
    const geos = [triangle(0, true), triangle(4, false), triangle(3, true)];
    const [solid, rgba, rgb] = geos as [BufferGeometry, BufferGeometry, BufferGeometry];
    const mats: Material[] = [this.glow('#ffffff', 0), this.glow('#ffffff', 0, { side: DoubleSide }), this.rim('#ffffff', 0)];
    const [front, double, rim] = mats as [MeshBasicMaterial, MeshBasicMaterial, RimMaterial];
    const objects: Object3D[] = [
      new Mesh(solid, front), new Mesh(solid, double), new Mesh(solid, rim),
      new Mesh(rgba, this.ribbon(false)), toonMesh(rgb, 0.03), toonMesh(rgb, 0.035), // drops / projectiles
    ];
    for (const o of objects) {
      o.scale.setScalar(1e-4);
      o.visible = false;
      root.add(o);
    }
    for (const m of mats) this.release(m); // the first casts reuse these compiled materials
    this.warm = { objects, geos };
  }

  dispose(): void {
    if (this.warm) {
      for (const o of this.warm.objects) o.removeFromParent();
      for (const g of this.warm.geos) g.dispose();
      this.warm = null;
    }
    for (const m of this.made) m.dispose();
    this.made.length = 0;
    this.free.clear();
    this.ribbons.clear();
  }
}
