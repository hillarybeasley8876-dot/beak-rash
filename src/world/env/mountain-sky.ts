// Sunset Pass sky (env-mountain): replaces the track's sky-dome material with a golden-hour shader —
// gold horizon → pink band → violet → indigo zenith, a Belt-of-Venus pink band opposite the sun,
// a big toon sun with a soft halo and a hint of god rays — and warms the cartoon clouds.
import { Color, Mesh, MeshBasicMaterial, ShaderMaterial, Vector3, BackSide } from 'three';
import type { WorldCtx } from '../ctx';

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHigh; uniform vec3 uPink; uniform vec3 uGold; uniform vec3 uBottom;
uniform vec3 uAnti; uniform vec3 uSunDir; uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // Azimuthal factor: 1 toward the sun, 0 opposite it.
  vec2 sa = normalize(uSunDir.xz + 1e-5), da = normalize(d.xz + 1e-5);
  float toward = dot(sa, da) * 0.5 + 0.5;
  // Wide gold band: the horizon glows across the sun's half of the sky.
  vec3 horizon = mix(uAnti, uGold, smoothstep(0.05, 0.6, toward));
  vec3 col = mix(horizon, uPink, smoothstep(0.015, 0.16, h));
  col = mix(col, uHigh, smoothstep(0.12, 0.42, h));
  col = mix(col, uTop, smoothstep(0.38, 0.95, h));
  // Belt of Venus: a pink band low over the anti-sun horizon.
  col = mix(col, uPink * 1.08, (1.0 - toward) * smoothstep(0.02, 0.07, h) * (1.0 - smoothstep(0.1, 0.24, h)) * 0.6);
  if (h < 0.0) col = mix(horizon, uBottom, smoothstep(0.0, -0.22, h));
  float cs = max(dot(d, uSunDir), 0.0);
  // Warm glow around the sun, strongest along the horizon.
  col += uSunColor * (pow(cs, 220.0) * 0.55 + pow(cs, 24.0) * 0.22 + pow(cs, 5.0) * 0.12 * (1.0 - smoothstep(0.0, 0.35, h)));
  // God-ray hint: soft radial streaks around the sun.
  vec3 sx = normalize(cross(uSunDir, vec3(0.0, 1.0, 0.0)));
  vec3 sy = cross(sx, uSunDir);
  float phi = atan(dot(d, sy), dot(d, sx));
  float streak = 0.5 + 0.5 * sin(phi * 13.0) * sin(phi * 7.0 + 1.7);
  float ang = acos(clamp(cs, -1.0, 1.0));
  col += uSunColor * smoothstep(0.6, 1.0, streak) * smoothstep(0.42, 0.05, ang) * smoothstep(0.03, 0.06, ang) * 0.055;
  // Toon sun: hard-edged disc, pale core, thin bright ring.
  float disc = smoothstep(0.99895, 0.99905, cs);
  float ring = smoothstep(0.99795, 0.99805, cs) * (1.0 - smoothstep(0.99835, 0.99845, cs));
  vec3 sunCol = mix(vec3(1.0, 0.86, 0.56), vec3(1.0, 0.98, 0.9), smoothstep(0.99905, 0.99975, cs));
  col = mix(col, sunCol, disc);
  col = mix(col, vec3(1.0, 0.9, 0.7), ring * 0.45);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Swap the dome's material for the golden-hour sky and tint the clouds. */
export function buildMountainSky(ctx: WorldCtx): void {
  const dome = ctx.group.getObjectByName('sky');
  const look = ctx.look;
  const sunDir = new Vector3(-look.sun.dir.x, -look.sun.dir.y, -look.sun.dir.z).normalize();
  if (dome instanceof Mesh) {
    dome.material = ctx.own(new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uTop: { value: new Color(look.sky.top) },
        uHigh: { value: new Color('#7a4f9c') },
        uPink: { value: new Color('#f08fa0') },
        uGold: { value: new Color(look.sky.horizon) },
        uAnti: { value: new Color('#b98cc0') },
        uBottom: { value: new Color(look.sky.bottom) },
        uSunDir: { value: sunDir },
        uSunColor: { value: new Color(look.sun.color) },
      },
    }));
  } else console.warn('[mountain] sky dome not found');
  const clouds = ctx.group.getObjectByName('clouds');
  if (clouds instanceof Mesh && clouds.material instanceof MeshBasicMaterial) clouds.material.color.set('#ffc4b4');
  else console.warn('[mountain] clouds not found');
}
