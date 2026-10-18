// Shaders of the wet city road overlay (env/city-wet.ts). USE_MIRROR = 0 (quality low) compiles the
// overlay without the planar reflection: only Fresnel sky sheen and puddle patches remain.

export const WET_VERT = /* glsl */`
#if USE_MIRROR
uniform mat4 uTexMat;
varying vec4 vRefl;
#endif
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
#if USE_MIRROR
  vRefl = uTexMat * w;
#endif
  vec4 mv = viewMatrix * w;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const WET_FRAG = /* glsl */`
uniform vec3 uCam;
uniform vec3 uPlaneP;
uniform vec3 uPlaneN;
uniform vec3 uSheen;
uniform float uStrength;
uniform float uOn;
uniform float uTime;
uniform vec2 uFog;
varying vec3 vWorld;
varying float vDepth;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
#if USE_MIRROR
uniform sampler2D uRefl;
varying vec4 vRefl;
/** Rain-streaked reflection: vertical smear (sharper in puddles), soft horizontal taps, ripples. */
vec3 mirrored(float wet) {
  vec2 uv = vRefl.xy / vRefl.w;
  // Ripples fade out once a pixel spans a good part of a noise cell (no sawtooth in the distance).
  vec2 fw = fwidth(vWorld.xz) * 1.7;
  float rip = 1.0 - smoothstep(0.15, 0.6, max(fw.x, fw.y));
  uv.x += (vnoise(vWorld.xz * 1.7 + vec2(0.0, uTime * 0.6)) - 0.5) * mix(0.0028, 0.0012, wet) * rip;
  float spread = mix(0.045, 0.012, wet);
  // Per-pixel jitter of the taps turns discrete copies (comb bands) into fine grain.
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 10; i++) {
    float o = (float(i) - 4.5 + j) / 4.5;
    float w = 1.0 - abs(o) * 0.7;
    float h = (mod(float(i), 2.0) - 0.5) * 0.003;
    acc += texture2D(uRefl, uv + vec2(h, o * spread)).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}
#endif
void main() {
  vec3 V = normalize(uCam - vWorld);
  float fres = 0.06 + 0.94 * pow(1.0 - clamp(dot(V, uPlaneN), 0.0, 1.0), 4.0);
  float wet = smoothstep(0.42, 0.72, vnoise(vWorld.xz * 0.11) * 0.7 + vnoise(vWorld.xz * 0.37) * 0.3);
  // Low-frequency drier patches keep a third of the asphalt showing its own albedo and paint.
  float damp = max(wet, mix(0.25, 1.0, smoothstep(0.32, 0.56, vnoise(vWorld.xz * 0.045 + 17.0))));
  vec3 refl = vec3(0.0);
#if USE_MIRROR
  if (uOn > 0.5) refl = mirrored(wet);
#endif
  float level = 1.0 - smoothstep(0.8, 3.0, abs(dot(vWorld - uPlaneP, uPlaneN)));
  vec3 col = (refl * uStrength * mix(0.45, 1.3, wet) * level + uSheen * mix(0.5, 1.0, wet)) * fres * damp;
  gl_FragColor = vec4(col * (1.0 - smoothstep(uFog.x, uFog.y, vDepth)), 1.0);
}`;
