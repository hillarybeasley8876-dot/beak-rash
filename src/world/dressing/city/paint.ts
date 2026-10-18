// City road paint: paved sidewalks with kerb stones and tactile strips over the drivable shoulders,
// zebra crossings, the scramble-crossing plaza and additive lamp pools on the wet asphalt.
import { AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicMaterial, MeshToonMaterial, Vector3 } from 'three';
import { toonRamp } from '../../../render/toon';
import type { TrackFrame } from '../../../core/types';
import type { WorldCtx } from '../../ctx';
import { decal } from '../../features/decals';
import { GridGeo, MeshBuf, frameOffset } from '../../geom';
import { PAVE_L, PAVE_W, pavingTexture, poolTexture, scrambleTexture, zebraTexture } from './paint-tex';

/** Paved sidewalk over each drivable shoulder (opaque, follows the shoulder width exactly). */
export function sidewalks(ctx: WorldCtx): void {
  const { L, q, app } = ctx;
  const mat = ctx.own(new MeshToonMaterial({
    map: ctx.own(pavingTexture(app.renderer)), gradientMap: toonRamp(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  const rows = Math.floor((L.n - 1) / 2) + 1;
  const fr: TrackFrame = q.frameVis(L.sMin);
  for (const side of [-1, 1] as const) {
    const sd = side < 0 ? L.sides.left : L.sides.right;
    const g = new GridGeo(rows, 2);
    for (let r = 0; r < rows; r++) {
      const s = L.sMin + r * 2;
      q.frameVis(s, fr);
      const w = sd.shoulder[q.sampleAt(s)] ?? 0;
      const inner = side * L.halfWidth, outer = side * (L.halfWidth + w);
      const [a, b] = side < 0 ? [outer, inner] : [inner, outer];
      const [ua, ub] = side < 0 ? [w / PAVE_W, 0] : [0, w / PAVE_W];
      g.set(r, 0, frameOffset(fr, a, 0.008), fr.up, ua, s / PAVE_L);
      g.set(r, 1, frameOffset(fr, b, 0.008), fr.up, ub, s / PAVE_L);
    }
    const mesh = new Mesh(ctx.own(g.build()), mat);
    mesh.name = `city:sidewalk${side < 0 ? 'L' : 'R'}`;
    mesh.receiveShadow = true;
    ctx.group.add(mesh);
  }
}

function paintMat(ctx: WorldCtx, map: ReturnType<typeof zebraTexture>): MeshToonMaterial {
  return ctx.own(new MeshToonMaterial({
    map, gradientMap: toonRamp(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: DoubleSide,
  }));
}

/** Zebra crossings (4 m deep) across the asphalt at each s. */
export function crossings(ctx: WorldCtx, at: number[]): void {
  const mat = paintMat(ctx, ctx.own(zebraTexture(ctx.app.renderer)));
  const hw = ctx.L.halfWidth;
  for (const s of at) decal(ctx, s - 2, s + 2, -hw, hw, mat);
}

/** Scramble plaza paint centred on s (len m along the road, full drivable width). */
export function scramble(ctx: WorldCtx, s: number, len: number): void {
  const half = Math.max(ctx.q.bounds(s).left, ctx.q.bounds(s).right);
  const mat = paintMat(ctx, ctx.own(scrambleTexture(ctx.app.renderer, half, len)));
  decal(ctx, s - len / 2, s + len / 2, -half, half, mat);
}

/** Additive light pools on the road (one mesh); call add() per lamp, then build(). */
export class Pools {
  private readonly buf = new MeshBuf();
  private readonly p = new Vector3();
  private readonly n = new Vector3(0, 1, 0);

  constructor(private readonly ctx: WorldCtx) {}

  /** Pool of radius r (m) centred at track (s, x), coloured `col` (HDR allowed). */
  add(s: number, x: number, r: number, col: Color): void {
    const { q } = this.ctx;
    const ids: number[] = [];
    for (const [a, b, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]] as Array<[number, number, number, number]>) {
      q.toWorld(s + b * r, x + a * r, 0.03, this.p);
      ids.push(this.buf.vert(this.p, this.n, col, u, v));
    }
    this.buf.quad(ids[0] ?? 0, ids[1] ?? 0, ids[2] ?? 0, ids[3] ?? 0);
  }

  build(): void {
    const { ctx } = this;
    if (!this.buf.idx.length) return;
    const mat = ctx.own(new MeshBasicMaterial({
      map: ctx.own(poolTexture(ctx.app.renderer)), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: DoubleSide,
    }));
    // Additive light fades out with distance instead of turning fog-coloured.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n  gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);\n#endif');
    };
    mat.customProgramCacheKey = () => 'city-pool';
    const mesh = new Mesh(ctx.own(this.buf.build()), mat);
    mesh.name = 'city:pools';
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    ctx.group.add(mesh);
  }
}
