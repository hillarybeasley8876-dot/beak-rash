// Rider-wide opacity for the pigeon ghost, respawn materialise and invulnerability pulse (no hard whole-rider
// blinking). While faded, every opaque mesh of the rider (body, bike, weapon) first draws a depth-only copy, then a
// transparent clone of its material (tinted/glowing on request) on top, so only the outer surface blends: no x-ray of
// limbs, the far wing or bike tubes. The ink hulls fade with the same alpha (they keep the silhouette) instead of
// blinking off. Render order band while faded: depth 40 → colour 41 → hulls 42 (after the rider's own fx sprites).
import { Color, Mesh, SkinnedMesh, type Material, type Object3D } from 'three';

type Tintable = Material & { color?: Color; emissive?: Color; emissiveIntensity?: number };

interface Swap { mesh: Mesh; orig: Material; order: number; proxy: Mesh | null }

const DEPTH = 40, COLOUR = 41, HULL = 42;

/** Transparent copy of `m` that keeps its custom shading (bikes: spoke dissolve, gloss; riders: cel bands + rim). */
function cloneMat(m: Material, key: string): Tintable {
  const c = m.clone() as Tintable;
  c.onBeforeCompile = m.onBeforeCompile;
  const base = m.customProgramCacheKey.bind(m);
  c.customProgramCacheKey = () => `${base()}|${key}`;
  c.transparent = true;
  c.alphaTest = 0;
  return c;
}

/** A child that draws `mesh`'s geometry with `mat` (skinned meshes share the skeleton, like the outline hulls). */
function proxyOf(mesh: Mesh, mat: Material): Mesh {
  let p: Mesh;
  if (mesh instanceof SkinnedMesh) {
    const s = new SkinnedMesh(mesh.geometry, mat);
    s.bind(mesh.skeleton, mesh.bindMatrix);
    s.bindMode = mesh.bindMode;
    s.boundingSphere = mesh.boundingSphere; // shared bounds (lod.ts): no per-swap skinned bounds computation
    p = s;
  } else {
    p = new Mesh(mesh.geometry, mat);
  }
  p.frustumCulled = mesh.frustumCulled;
  p.renderOrder = DEPTH;
  p.userData.noOutline = true;
  return p;
}

export class RiderFade {
  private readonly clones = new Map<Material, Tintable>();
  private readonly hullClones = new Map<Material, Material>();
  private readonly depthMats = new Map<Material, Material>();
  private readonly swaps: Swap[] = [];

  constructor(private readonly root: Object3D) {}

  get active(): boolean {
    return this.swaps.length > 0;
  }

  /** alpha 1 = normal (originals restored); `tint` lerps the colour by `mix`, `glow` adds emissive light. */
  set(alpha: number, tint: Color, mix: number, glow: number): void {
    if (alpha >= 0.995) {
      this.restore();
      return;
    }
    if (!this.active) this.swap();
    for (const [orig, c] of this.clones) {
      c.opacity = alpha;
      const o = orig as Tintable;
      if (c.color && o.color) c.color.copy(o.color).lerp(tint, mix);
      if (c.emissive) {
        c.emissive.copy(tint);
        c.emissiveIntensity = glow;
      }
    }
    for (const h of this.hullClones.values()) h.opacity = alpha;
  }

  private swap(): void {
    const meshes: Mesh[] = [];
    this.root.traverse((o) => {
      if (o instanceof Mesh && !Array.isArray(o.material) && !(o.material as Material).transparent) meshes.push(o);
    });
    for (const mesh of meshes) {
      const m = mesh.material as Material;
      const hull = mesh.userData.isOutline === true;
      const swap: Swap = { mesh, orig: m, order: mesh.renderOrder, proxy: null };
      if (hull) {
        let h = this.hullClones.get(m);
        if (!h) {
          h = cloneMat(m, 'fade-hull');
          h.depthWrite = false;
          this.hullClones.set(m, h);
        }
        mesh.material = h;
        mesh.renderOrder = HULL;
      } else {
        let c = this.clones.get(m), d = this.depthMats.get(m);
        if (!c) {
          c = cloneMat(m, 'fade');
          c.depthWrite = false;
          this.clones.set(m, c);
        }
        if (!d) {
          d = cloneMat(m, 'fade-depth');
          d.colorWrite = false;
          d.depthWrite = true;
          this.depthMats.set(m, d);
        }
        mesh.material = c;
        mesh.renderOrder = COLOUR;
        swap.proxy = proxyOf(mesh, d);
        mesh.add(swap.proxy);
      }
      this.swaps.push(swap);
    }
  }

  private restore(): void {
    for (const s of this.swaps) {
      s.mesh.material = s.orig;
      s.mesh.renderOrder = s.order;
      s.proxy?.removeFromParent();
    }
    this.swaps.length = 0;
  }

  dispose(): void {
    this.restore();
    for (const c of this.clones.values()) c.dispose();
    for (const c of this.hullClones.values()) c.dispose();
    for (const c of this.depthMats.values()) c.dispose();
    this.clones.clear();
    this.hullClones.clear();
    this.depthMats.clear();
  }
}
