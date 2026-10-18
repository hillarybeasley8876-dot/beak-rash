// Light city rain: thin additive streaks in a box that follows the camera (one draw call). Drops are
// world-anchored and wrap inside the box, so riding through the rain reads right; the streaks lean
// along the rain velocity relative to the camera. Fades out near tunnel roofs.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Sphere, Vector3 } from 'three';
import type { WorldCtx } from '../ctx';
import { cityCamS } from './city-cam';

const COUNT = { low: 900, medium: 1700, high: 2600 } as const;
const BOX = new Vector3(44, 24, 44);
const FALL = new Vector3(1.4, -13, 0.7);   // rain velocity (m/s), a little wind
const EXPOSURE = 0.042;                    // streak length = relative speed × exposure (s)
const CAM_DRAG = 0.5;                      // how much of the camera's own velocity bends the streaks
const TIME_WRAP = 600;                     // keeps mod() precise in long sessions
const ALPHA = 0.32;                        // streak opacity (light rain)

const VERT = /* glsl */`
attribute vec4 aDrop;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uFall;
uniform vec3 uRel;
uniform vec3 uCam;
uniform float uTime;
varying float vFade;
varying float vT;
void main() {
  vec3 base = aDrop.xyz * uBox + uFall * (uTime * (0.8 + 0.4 * aDrop.w));
  vec3 p = uCenter + mod(base - uCenter + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 dir = uRel * (0.75 + 0.5 * aDrop.w);
  vec3 pos = p - dir * position.x;
  float dist = length(pos - uCam);
  vec3 side = normalize(cross(normalize(dir), normalize(pos - uCam)));
  pos += side * position.y * (0.006 + dist * 0.0011);
  vec3 q = abs(p - uCenter) / (0.5 * uBox);
  vFade = (1.0 - smoothstep(14.0, 32.0, dist)) * smoothstep(0.8, 3.0, dist)
    * (1.0 - smoothstep(0.75, 1.0, max(q.x, max(q.y, q.z))));
  vT = position.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying float vFade;
varying float vT;
void main() {
  gl_FragColor = vec4(uColor, uAlpha * vFade * sin(vT * 3.14159));
}`;

/** N streak quads: position = quad corner (x: 0 head / 1 tail, y: side ±1); aDrop = random base (xyz in
 *  [0,1)) + size/speed (w), the same for the drop's 4 vertices. */
function rainGeometry(n: number, rnd: () => number): BufferGeometry {
  const corner = new Float32Array(n * 12), drop = new Float32Array(n * 16), index = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const d = [rnd(), rnd(), rnd(), rnd()];
    for (let v = 0; v < 4; v++) {
      corner.set([v >> 1, (v & 1) * 2 - 1, 0], (i * 4 + v) * 3);
      drop.set(d, (i * 4 + v) * 4);
    }
    index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(corner, 3));
  g.setAttribute('aDrop', new BufferAttribute(drop, 4));
  g.setIndex(new BufferAttribute(index, 1));
  // The streak box follows the camera: a huge bound keeps the fog cull (world/lod.ts) from hiding it.
  g.boundingSphere = new Sphere(new Vector3(), 1e5);
  return g;
}

/** Distance (m, up to `reach`) from s to the nearest roofed sample (tunnel), Infinity when none. */
function roofDistance(ctx: WorldCtx, s: number, reach: number): number {
  const { L, q } = ctx;
  const roofed = (ss: number): boolean => (L.roof[q.sampleAt(ss)] ?? 0) > 0;
  for (let d = 0; d <= reach; d += 2) if (roofed(s - d) || roofed(s + d)) return d;
  return Infinity;
}

export function buildRain(ctx: WorldCtx): void {
  const rng = ctx.rng.fork(0x4a17);
  const uniforms = {
    uCenter: { value: new Vector3() }, uBox: { value: BOX.clone() }, uFall: { value: FALL.clone() },
    uRel: { value: FALL.clone().multiplyScalar(EXPOSURE) }, uCam: { value: new Vector3() }, uTime: { value: 0 },
    uColor: { value: new Color(ctx.look.sky.horizon).lerp(new Color('#d6e2ff'), 0.7) }, uAlpha: { value: ALPHA },
  };
  const mat = ctx.own(new ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  }));
  const mesh = new Mesh(ctx.own(rainGeometry(COUNT[ctx.quality], () => rng.next())), mat);
  mesh.name = 'city:rain';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
  const last = new Vector3(), vel = new Vector3(), inst = new Vector3(), fwd = new Vector3();
  let primed = false;
  ctx.onUpdate((dtSim, dtReal, camera) => {
    uniforms.uTime.value = (uniforms.uTime.value + dtSim) % TIME_WRAP;
    const cam = camera.position;
    if (primed && dtReal > 0) {
      inst.subVectors(cam, last).divideScalar(dtReal);
      if (inst.length() > 60) vel.set(0, 0, 0);
      else vel.lerp(inst, 1 - Math.exp(-dtReal * 6));
    }
    last.copy(cam);
    primed = true;
    camera.getWorldDirection(fwd).setY(0).normalize();
    uniforms.uCam.value.copy(cam);
    uniforms.uCenter.value.copy(cam).addScaledVector(fwd, 12).setY(cam.y + 2);
    uniforms.uRel.value.copy(FALL).addScaledVector(vel, -CAM_DRAG).multiplyScalar(EXPOSURE);
    const d = roofDistance(ctx, cityCamS(ctx, camera).s, 26);
    uniforms.uAlpha.value = ALPHA * (d === Infinity ? 1 : Math.min(1, Math.max(0, (d - 4) / 20)));
    // No fog = aerial / debug views (see world/lod.ts): keep those clear.
    mat.visible = uniforms.uAlpha.value > 0.001 && ctx.app.scene.fog !== null;
  });
}
