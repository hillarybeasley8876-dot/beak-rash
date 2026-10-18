// Toon sea: one big plane at sea level following the camera. Colour bands by water depth (from the
// terrain height map), animated foam at the shoreline + wave bands rolling in, sun glints, fog.
// Every band edge and toon dash is anti-aliased with fwidth (no staircases or shimmer far off).
import { Color, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { HEIGHT_OFFSET, type HeightMap } from './heightmap';

const VERT = /* glsl */`
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
#include <fog_pars_fragment>
uniform sampler2D uHeight;
uniform vec4 uXform;
uniform vec2 uTexel;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSunDir;
uniform vec3 uCam;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float groundAt(vec2 uv) { return texture2D(uHeight, uv).r - ${HEIGHT_OFFSET.toFixed(1)}; }
/** Anti-aliased step(edge, x). */
float aastep(float edge, float x) { float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(edge - w, edge + w, x); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 uv = vec2(0.5 + (vWorld.x - uXform.x) * uXform.z, 0.5 - (vWorld.z - uXform.y) * uXform.w);
  float ground = -60.0, slope = 1.0;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
    ground = groundAt(uv);
    // Seabed slope (m per m) from the height map: turns depth into metres from the waterline.
    vec2 t = uTexel;
    float gx = (groundAt(uv + vec2(t.x, 0.0)) - groundAt(uv - vec2(t.x, 0.0))) * 0.5 * uXform.z / t.x;
    float gz = (groundAt(uv + vec2(0.0, t.y)) - groundAt(uv - vec2(0.0, t.y))) * 0.5 * uXform.w / t.y;
    slope = max(length(vec2(gx, gz)), 0.012);
  }
  float depth = max(0.0, -ground);
  float toShore = depth / slope;
  // Wobbly depth so band edges are not perfectly smooth.
  float wob = (vnoise(vWorld.xz * 0.11 + uTime * 0.05) - 0.5) * 0.6;
  float dd = depth + wob;
  vec3 col = mix(uShallow, mix(uShallow, uMid, 0.65), aastep(1.4, dd));
  col = mix(col, uMid, aastep(5.5, dd));
  col = mix(col, uDeep, aastep(11.0, dd));
  // Two or three thin surf lines rolling toward the shore (spaced in metres from the waterline,
  // so flat shallows never fill up with white), fading out beyond ~0.6 m depth.
  float band = sin(toShore * 0.85 - uTime * 2.2 + vnoise(vWorld.xz * 0.05) * 4.0);
  float rolling = aastep(0.94, band) * (1.0 - smoothstep(6.0, 16.0, toShore)) * (1.0 - smoothstep(0.35, 0.65, depth));
  // Shoreline foam: a lapping white edge 0.6–1.8 m wide.
  float lap = 1.2 + 0.6 * sin(uTime * 1.4 + vWorld.x * 0.07 + vWorld.z * 0.05);
  float shore = (1.0 - aastep(lap, toShore + wob * 0.8)) * (1.0 - smoothstep(0.3, 0.6, depth));
  // Open-water ripples: small toon dashes.
  // Small crest dashes (rotated grid so they never line up with the road).
  vec2 rp = mat2(0.8, -0.6, 0.6, 0.8) * vWorld.xz;
  float rip = aastep(0.86, vnoise(vec2(rp.x * 0.32 + uTime * 0.35, rp.y * 1.1 - uTime * 0.1)));
  float dist = length(vWorld - uCam);
  rip *= aastep(0.45, vnoise(vWorld.xz * 0.03 + 3.0)) * 0.6 * (1.0 - smoothstep(50.0, 140.0, dist));
  // Sun glints toward the reflected sun direction.
  vec3 view = normalize(vWorld - uCam);
  vec3 refl = reflect(view, vec3(0.0, 1.0, 0.0));
  float glint = pow(max(dot(refl, uSunDir), 0.0), 60.0);
  float sparkle = aastep(0.72, vnoise(vWorld.xz * 0.6 + uTime * 0.8)) * smoothstep(0.15, 0.6, glint * 6.0) * (1.0 - smoothstep(150.0, 400.0, dist));
  col = mix(col, uFoam, clamp(max(max(rolling, shore), max(rip, sparkle)), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildSea(ctx: WorldCtx, hm: HeightMap): void {
  const sunDir = new Vector3(-ctx.look.sun.dir.x, -ctx.look.sun.dir.y, -ctx.look.sun.dir.z).normalize();
  const night = ctx.look.grade.night;
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uHeight: { value: null }, uXform: { value: hm.xform }, uTexel: { value: hm.texel }, uTime: { value: 0 },
      uDeep: { value: new Color(night ? '#10184a' : '#1b78c2') },
      uMid: { value: new Color(night ? '#1d2c78' : '#1fa6d3') },
      uShallow: { value: new Color(night ? '#2c4aa0' : '#5fdbd6') },
      uFoam: { value: new Color(night ? '#7d86c8' : '#ffffff') },
      uSunDir: { value: sunDir }, uCam: { value: new Vector3() },
    }]),
  }));
  // UniformsUtils.merge clones values: hand over the live texture/vector afterwards.
  const u = mat.uniforms as Record<string, { value: unknown }>;
  (u.uHeight as { value: unknown }).value = hm.texture;
  (u.uXform as { value: unknown }).value = hm.xform;
  (u.uTexel as { value: unknown }).value = hm.texel;
  const size = (ctx.look.fog.far + 200) * 2;
  const geo = ctx.own(new PlaneGeometry(size, size, 8, 8));
  geo.rotateX(-Math.PI / 2);
  const sea = new Mesh(geo, mat);
  sea.name = 'sea';
  sea.frustumCulled = false;
  sea.receiveShadow = false;
  ctx.group.add(sea);
  const time = u.uTime as { value: number }, cam = u.uCam as { value: Vector3 };
  ctx.onUpdate((dtSim, _dtReal, camera) => {
    time.value += dtSim;
    cam.value.copy(camera.position);
    sea.position.set(Math.round(camera.position.x / 32) * 32, 0, Math.round(camera.position.z / 32) * 32);
  });
}
