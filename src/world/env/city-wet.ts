// Wet city road: an additive overlay on the asphalt + sidewalks that mirrors the neon layer (see
// city-mirror.ts) with rain-streak blur, puddle patches (sharper, stronger), ripples, Fresnel and a
// faint sky sheen. Rendered just in time from the overlay's onBeforeRender with the real camera.
// Quality low skips the mirror and compiles the overlay without it (USE_MIRROR 0).
import { AdditiveBlending, Color, Matrix4, Mesh, PerspectiveCamera, ShaderMaterial, Vector3, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { TrackFrame } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { GridGeo, frameOffset } from '../geom';
import { RoadMirror } from './city-mirror';
import { cityCamS } from './city-cam';
import { WET_FRAG, WET_VERT } from './city-wet-glsl';

/** Mirror plane: the road this far ahead of the camera (where reflections show), normal leaning to world up. */
const PLANE_AHEAD = 12;
const UP_BLEND = 2;

/** Overlay strip from the left to the right drivable bound, on the road mesh's own 1 m rows. */
function overlayGeometry(ctx: WorldCtx): GridGeo {
  const { L, q } = ctx;
  const s0 = L.sMin, rows = L.n;
  const g = new GridGeo(rows, 2);
  const fr: TrackFrame = q.frameVis(s0);
  for (let r = 0; r < rows; r++) {
    const s = s0 + r;
    q.frameVis(s, fr);
    const i = q.sampleAt(s);
    const xl = -(L.halfWidth + (L.sides.left.shoulder[i] ?? 0)), xr = L.halfWidth + (L.sides.right.shoulder[i] ?? 0);
    g.set(r, 0, frameOffset(fr, xl, 0.02), fr.up, 0, s);
    g.set(r, 1, frameOffset(fr, xr, 0.02), fr.up, 1, s);
  }
  return g;
}

export function buildWetRoad(ctx: WorldCtx, layer: number): void {
  const { quality, look, q } = ctx;
  const mirror = quality === 'low' ? null : ctx.own(new RoadMirror(layer, quality === 'high' ? 0.6 : 0.4, ctx.group));
  const uniforms = {
    uRefl: { value: mirror ? mirror.target.texture : null }, uTexMat: { value: mirror ? mirror.textureMatrix : new Matrix4() },
    uCam: { value: new Vector3() }, uPlaneP: { value: new Vector3() }, uPlaneN: { value: new Vector3(0, 1, 0) },
    uSheen: { value: new Color(look.sky.horizon).multiplyScalar(0.22) }, uStrength: { value: 1.1 }, uOn: { value: 0 },
    uTime: { value: 0 }, uFog: { value: [look.fog.near, look.fog.far] },
  };
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: WET_VERT, fragmentShader: WET_FRAG, uniforms, defines: { USE_MIRROR: mirror ? 1 : 0 },
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  const mesh = new Mesh(ctx.own(overlayGeometry(ctx).build()), mat);
  mesh.name = 'city:wet';
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  const fr = q.frameVis(0);
  mesh.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const cam = cityCamS(ctx, camera);
    // On crests a plane from the camera's own frame tilts against the road ahead and shears the reflections.
    q.frameVis(cam.s + PLANE_AHEAD, fr);
    uniforms.uCam.value.copy(cam.pos);
    uniforms.uPlaneP.value.set(fr.pos.x, fr.pos.y, fr.pos.z);
    uniforms.uPlaneN.value.set(fr.up.x, fr.up.y + UP_BLEND, fr.up.z).normalize();
    uniforms.uOn.value = mirror && mirror.render(renderer, scene, camera, uniforms.uPlaneP.value, uniforms.uPlaneN.value) ? 1 : 0;
  };
  ctx.onUpdate((dtSim) => {
    uniforms.uTime.value += dtSim;
  });
}
