// Additive light pools (env-mountain): soft elliptic glows laid on the road or a wall under lamps.
// Each pool is a two-ring vertex-colour fan (bright centre → black rim), all merged into one unlit
// additive mesh, so a tunnel full of lamps costs a single draw call and no textures.
import { AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { WorldCtx } from '../../ctx';
import { MeshBuf } from '../../geom';

const RING = 12;
const p = new Vector3();
const BLACK = new Color(0, 0, 0);

export class LightPools {
  private readonly buf = new MeshBuf();
  private readonly mid = new Color();

  constructor(private readonly ctx: WorldCtx) {}

  /** Pool centred at c with half-axes a and b (world vectors), normal n, colour col at the centre. */
  add(c: Vector3, a: Vector3, b: Vector3, n: Vector3, col: Color): void {
    const { buf } = this;
    const centre = buf.vert(c, n, col);
    this.mid.copy(col).multiplyScalar(0.5);
    const inner: number[] = [], outer: number[] = [];
    for (let i = 0; i < RING; i++) {
      const t = (i / RING) * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t);
      inner.push(buf.vert(p.copy(c).addScaledVector(a, ca * 0.5).addScaledVector(b, sa * 0.5), n, this.mid));
      outer.push(buf.vert(p.copy(c).addScaledVector(a, ca).addScaledVector(b, sa), n, BLACK));
    }
    for (let i = 0; i < RING; i++) {
      const j = (i + 1) % RING;
      buf.tri(centre, inner[i] ?? 0, inner[j] ?? 0);
      buf.quad(inner[i] ?? 0, outer[i] ?? 0, outer[j] ?? 0, inner[j] ?? 0);
    }
  }

  /** Pool on the road at track (s, x): rs metres along the road, rx across. */
  road(s: number, x: number, rs: number, rx: number, col: Color): void {
    const fr = this.ctx.q.frameVis(s);
    const c = this.ctx.q.toWorld(s, x, 0.04, new Vector3());
    this.add(c, new Vector3().copy(fr.tangent).setY(0).normalize().multiplyScalar(rs), new Vector3().copy(fr.right).setY(0).normalize().multiplyScalar(rx), new Vector3(0, 1, 0), col);
  }

  build(name: string): void {
    if (!this.buf.idx.length) return;
    const mat = this.ctx.own(new MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
      side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    const mesh = new Mesh(this.ctx.own(this.buf.build()), mat);
    mesh.name = name;
    mesh.renderOrder = 3;
    this.ctx.group.add(mesh);
  }
}
