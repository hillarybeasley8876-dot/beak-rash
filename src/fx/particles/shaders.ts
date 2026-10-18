// GPU particle shaders: fire-and-forget analytic motion (drag + gravity + ground clamp) computed in the
// vertex shader from spawn attributes, so the CPU only writes a particle once at spawn.
// Instance layout (8 × vec4): aP = pos0.xyz, birth · aV = vel0.xyz, life · aS = size0, size1, rot0, spin
// aCA = colourA.rgb, atlas frame · aCB = colourB.rgb, flags (mode + 8·(follow+1) + 256·erode + 512·realtime)
// aX = drag, gravity, groundY, k
// aF = frame velocity xyz (inherited from a moving rider, not slowed by drag), frame damping · aT = birth (real s).
// Motion always runs on sim time; `realtime` particles animate (life/size/colour) on real time.
// Modes: 0 billboard · 1 velocity-stretched · 2 flat on the ground · 3 flutter (sway + flip) · 4 orbit anchor
// · 5 world line along the velocity (wind streaks: the quad spans depth too, so lines converge in perspective;
// constant ~2.5 px screen width, alpha tapering to both ends).
// Every sprite shrinks away within 1.2-2.5 m of the lens, billboards never exceed 35 % of the screen height,
// and uCull fades whatever was born in a real-time window (KO debris on the cinematic hand-back).

export const PARTICLE_VERT = /* glsl */ `
attribute vec4 aP;
attribute vec4 aV;
attribute vec4 aS;
attribute vec4 aCA;
attribute vec4 aCB;
attribute vec4 aX;
attribute vec4 aF;
attribute vec4 aT;
uniform float uTime;
uniform float uTimeReal;
uniform float uAtlasCols;
uniform vec3 uAnchors[16];
uniform vec3 uCull;
varying vec2 vUv;
varying float vLineY;
varying vec3 vCol;
varying float vT;
varying float vErode;

vec2 rot2(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

void main() {
  float realtime = floor(aCB.w / 512.0);
  float simAge = max(uTime - aP.w, 0.0);
  float age = realtime > 0.5 ? uTimeReal - aT.x : uTime - aP.w;
  float life = max(aV.w, 1e-3);
  float t = age / life;
  if (age < 0.0 || t >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float mode = mod(aCB.w, 8.0);
  float follow = mod(floor(aCB.w / 8.0), 32.0) - 1.0;
  float erode = mod(floor(aCB.w / 256.0), 2.0);
  bool orbit = mode > 3.5 && mode < 4.5;
  float seed = fract(sin(dot(aP.xyz, vec3(12.9898, 78.233, 37.719)) + aP.w * 17.0) * 43758.5453);
  float k = aX.x;
  vec3 gv = vec3(0.0, -aX.y, 0.0);
  vec3 p;
  vec3 vel;
  if (orbit) {
    float a = aS.z + aS.w * simAge;
    p = aP.xyz + vec3(cos(a) * aV.x, sin(simAge * 6.0 + seed * 6.28) * aV.y, sin(a) * aV.x);
    vel = vec3(0.0);
  } else if (k > 0.001) {
    vec3 term = gv / k;
    float e = exp(-k * simAge);
    p = aP.xyz + term * simAge + (aV.xyz - term) * (1.0 - e) / k;
    vel = term + (aV.xyz - term) * e;
  } else {
    p = aP.xyz + aV.xyz * simAge + 0.5 * gv * simAge * simAge;
    vel = aV.xyz + gv * simAge;
  }
  if (!orbit) {
    float ef = exp(-aF.w * simAge);
    p += aF.w > 0.001 ? aF.xyz * (1.0 - ef) / aF.w : aF.xyz * simAge;
    vel += aF.xyz * ef;
  }
  if (p.y < aX.z) { p.y = aX.z; vel *= 0.0; }
  if (follow >= 0.0) p += uAnchors[int(follow)];

  float popT = clamp(age / max(0.05, life * 0.08), 0.0, 1.0) - 1.0;
  float pop = 1.0 + 2.7 * popT * popT * popT + 1.7 * popT * popT;
  float size = mix(aS.x, aS.y, t) * pop;
#ifndef FX_ADDITIVE
  if (erode < 0.5) size *= 1.0 - smoothstep(0.72, 1.0, t);
#endif
  if (uCull.z > 0.0 && aT.x >= uCull.x && aT.x <= uCull.y) size *= 1.0 - smoothstep(uCull.z, uCull.z + 0.1, uTimeReal);
  float dist = max(-(modelViewMatrix * vec4(p, 1.0)).z, 0.01);
  size *= smoothstep(1.2, 2.5, dist);
  bool isFlat = mode > 1.5 && mode < 2.5;
  bool isLine = mode > 4.5;
  if (!isFlat && !isLine) size = min(size, 0.7 * dist / projectionMatrix[1][1]);
  float rot = orbit ? sin(age * 5.0 + seed * 6.28) * 0.35 : aS.z + aS.w * age;
  vec2 corner = position.xy;
  vLineY = 0.0;
  vec4 mv;
  if (isFlat) {
    vec2 c = rot2(corner, rot) * size;
    mv = modelViewMatrix * vec4(p + vec3(c.x, 0.02, c.y), 1.0);
  } else if (mode > 0.5 && mode < 1.5) {
    mv = modelViewMatrix * vec4(p, 1.0);
    vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
    float sp = length(vv.xy);
    vec2 dir = sp > 1e-4 ? vv.xy / sp : vec2(0.0, 1.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float len = max(size, sp * aX.w);
    mv.xy += dir * corner.y * len + perp * corner.x * size;
  } else if (isLine) {
    vec4 c = modelViewMatrix * vec4(p, 1.0);
    vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
    float sp = length(vv);
    vec3 dir = sp > 1e-4 ? vv / sp : vec3(0.0, 1.0, 0.0);
    vec3 side = cross(dir, normalize(c.xyz));
    side = length(side) > 1e-4 ? normalize(side) : vec3(1.0, 0.0, 0.0);
    // The streak sprite lights ~20 % of the quad width: 0.023 NDC of quad = ~2.5 px of line at 1080p.
    float width = size > 0.0 ? 0.023 * dist / projectionMatrix[1][1] : 0.0;
    mv = vec4(c.xyz + dir * corner.y * max(size, sp * aX.w) + side * corner.x * width, 1.0);
    vLineY = corner.y;
  } else {
    if (mode > 2.5) {
      float ph = age * (3.0 + seed * 4.0) + seed * 6.28;
      p += vec3(sin(ph), 0.0, cos(ph * 0.8)) * aX.w;
      rot += sin(ph * 0.9) * 1.1;
      corner.x *= 0.25 + 0.75 * abs(cos(ph * 1.7));
    }
    mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += rot2(corner, rot) * size;
  }
  gl_Position = projectionMatrix * mv;
  float frame = aCA.w;
  vec2 cell = vec2(mod(frame, uAtlasCols), floor(frame / uAtlasCols));
  vUv = vec2((cell.x + uv.x) / uAtlasCols, 1.0 - (cell.y + 1.0 - uv.y) / uAtlasCols);
  vCol = mix(aCA.rgb, aCB.rgb, smoothstep(0.0, 1.0, t));
  vT = t;
  vErode = erode * smoothstep(0.3, 1.0, t);
}
`;

export const PARTICLE_FRAG = /* glsl */ `
uniform sampler2D tAtlas;
varying vec2 vUv;
varying vec3 vCol;
varying float vT;
varying float vErode;
varying float vLineY;
void main() {
  vec4 tex = texture2D(tAtlas, vUv);
#ifdef FX_ADDITIVE
  float a = tex.a * (1.0 - smoothstep(0.55, 1.0, vT)) * (1.0 - 4.0 * vLineY * vLineY);
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol * tex.rgb, a);
#else
  if (tex.a < 0.5 + vErode * 0.49) discard;
  gl_FragColor = vec4(vCol * tex.rgb, 1.0);
#endif
}
`;
