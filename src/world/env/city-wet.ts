// Wet city road: an additive overlay on the asphalt + sidewalks that mirrors the neon layer (see
// city-mirror.ts) with rain-streak blur, puddle patches (sharper, stronger), ripples, Fresnel and a
// faint sky sheen. Rendered just in time from the overlay's onBeforeRender with the real camera.
import { AdditiveBlending, Color, Mesh, PerspectiveCamera, ShaderMaterial, Vector3, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { TrackFrame } from '../../core/types';
import type { WorldCtx } from '../ctx';
import { GridGeo, frameOffset } from '../geom';
import { RoadMirror } from './city-mirror';

const VERT = /* glsl */`
uniform mat4 uTexMat;
varying vec4 vRefl;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vRefl = uTexMat * w;
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform sampler2D uRefl;
uniform vec3 uCam;
uniform vec3 uPlaneP;
uniform vec3 uPlaneN;
uniform vec3 uSheen;
uniform float uStrength;
uniform float uOn;
uniform float uTime;
uniform vec2 uFog;
varying vec4 vRefl;
varying vec3 vWorld;
varying float vDepth;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.06 + 0.94 * pow(1.0 - clamp(dot(V, uPlaneN), 0.0, 1.0), 4.0);
  float wet = smoothstep(0.42, 0.72, vnoise(vWorld.xz * 0.11) * 0.7 + vnoise(vWorld.xz * 0.37) * 0.3);
  vec3 refl = vec3(0.0);
  if (uOn > 0.5) {
    vec2 uv = vRefl.xy / vRefl.w;
    uv.x += (vnoise(vWorld.xz * 1.7 + vec2(0.0, uTime * 0.6)) - 0.5) * mix(0.007, 0.002, wet);
    float spread = mix(0.055, 0.014, wet);
    float wsum = 0.0;
    for (int i = 0; i < 9; i++) {
      float o = (float(i) - 4.0) / 4.0;
      float w = 1.0 - abs(o) * 0.75;
      refl += texture2D(uRefl, uv + vec2(o * 0.0025, o * spread)).rgb * w;
      wsum += w;
    }
    refl /= wsum;
  }
  float level = 1.0 - smoothstep(0.8, 3.0, abs(dot(vWorld - uPlaneP, uPlaneN)));
  vec3 col = refl * uStrength * fres * mix(0.45, 1.3, wet) * level + uSheen * fres * mix(0.5, 1.0, wet);
  gl_FragColor = vec4(col * (1.0 - smoothstep(uFog.x, uFog.y, vDepth)), 1.0);
}`;

/** Overlay strip from the left to the right drivable bound along the whole visual road. */
function overlayGeometry(ctx: WorldCtx): GridGeo {
  const { L, q } = ctx;
  const s0 = L.sMin, rows = Math.floor((L.n - 1) / 2) + 1;
  const g = new GridGeo(rows, 2);
  const fr: TrackFrame = q.frameVis(s0);
  for (let r = 0; r < rows; r++) {
    const s = s0 + r * 2;
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
  const mirror = quality === 'low' ? null : ctx.own(new RoadMirror(layer, quality === 'high' ? 0.4 : 0.28));
  const uniforms = {
    uRefl: { value: mirror ? mirror.target.texture : null }, uTexMat: { value: mirror ? mirror.textureMatrix : null },
    uCam: { value: new Vector3() }, uPlaneP: { value: new Vector3() }, uPlaneN: { value: new Vector3(0, 1, 0) },
    uSheen: { value: new Color(look.sky.horizon).multiplyScalar(0.22) }, uStrength: { value: 1.1 }, uOn: { value: 0 },
    uTime: { value: 0 }, uFog: { value: [look.fog.near, look.fog.far] },
  };
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  const mesh = new Mesh(ctx.own(overlayGeometry(ctx).build()), mat);
  mesh.name = 'city:wet';
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  const fr = q.frameAt(0), camPos = new Vector3();
  let hint = 0;
  mesh.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    hint = q.project(camPos, hint).s;
    q.frameAt(hint, fr);
    uniforms.uCam.value.copy(camPos);
    uniforms.uPlaneP.value.set(fr.pos.x, fr.pos.y, fr.pos.z);
    uniforms.uPlaneN.value.set(fr.up.x, fr.up.y, fr.up.z);
    uniforms.uOn.value = mirror && mirror.render(renderer, scene, camera, uniforms.uPlaneP.value, uniforms.uPlaneN.value) ? 1 : 0;
  };
  ctx.onUpdate((dtSim) => {
    uniforms.uTime.value += dtSim;
  });
}
