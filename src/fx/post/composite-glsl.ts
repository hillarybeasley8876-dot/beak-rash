// The composite "uber" pass: HDR scene + bloom → speed/zoom blur, chroma, grade, KO comic look,
// speed lines, damage pulse, impact frame, flash, vignette, letterbox → sRGB screen.
// Defines: FX_BLUR (radial blur + chroma taps), FX_TAPS, FX_BLOOM, FX_TONEMAP (0 shoulder, 1 ACES).
import { GLSL_COMMON } from './glsl-common';

const HEADER = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform float uNear, uFar, uSubjectDepth, uBgBurst, uBgMargin;
uniform vec2 uRes;
uniform float uTime;
uniform float uExposure, uSat, uContrast, uBloom;
uniform vec3 uTint;
uniform float uEdgeBlur, uChroma, uZoom;
uniform vec2 uBlurCenter;
uniform float uKo, uHalftone, uRed, uGrain, uVignette, uLetterbox;
uniform float uLines, uKoLines;
uniform vec2 uFocus;
uniform float uDamage, uFlash, uImpact;
uniform vec3 uFlashColor, uImpactColor, uLinesColor;
varying vec2 vUv;
${GLSL_COMMON}

vec3 fxTonemap(vec3 x) {
#if FX_TONEMAP == 1
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
#else
  const float k = 0.86;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
#endif
}

// Radial blur toward uBlurCenter: strength grows toward the screen edge (speed) or is uniform (KO zoom).
vec3 fxSampleScene(vec2 uv) {
#if FX_BLUR
  vec2 d = uv - uBlurCenter;
  float edge = smoothstep(0.26, 0.7, length(d * vec2(uRes.x / uRes.y, 1.0)) * 0.72);
  float amount = uEdgeBlur * edge + uZoom;
  float ca = uChroma * (0.25 + edge);
  if (amount > 0.0008 || ca > 0.0008) {
    float jitter = fxIgn(gl_FragCoord.xy);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < FX_TAPS; i++) {
      float t = (float(i) + jitter) / float(FX_TAPS);
      vec2 base = uBlurCenter + d * (1.0 - amount * t);
      vec2 dc = d * ca * (0.6 + t);
      acc.r += texture2D(tScene, base + dc).r;
      acc.g += texture2D(tScene, base).g;
      acc.b += texture2D(tScene, base - dc).b;
    }
    return acc / float(FX_TAPS);
  }
#endif
  return texture2D(tScene, uv).rgb;
}

// Anime speed lines: wedge-shaped rays around c that re-randomise at 18 fps.
float fxSpeedLines(vec2 uv, vec2 c, float amount, float seed) {
  if (amount < 0.001) return 0.0;
  vec2 d = (uv - c) * vec2(uRes.x / uRes.y, 1.0);
  float ang = atan(d.y, d.x) / 6.2831853 + 0.5;
  float rad = length(d);
  float slots = 150.0;
  float a = ang * slots;
  float id = floor(a);
  float frame = floor(uTime * 18.0) + seed;
  float h = fxHash12(vec2(id, frame));
  float h2 = fxHash12(vec2(id * 1.37 + 7.0, frame * 0.61 + 3.0));
  float present = step(1.0 - amount * 0.7, h);
  float width = 0.25 + 0.55 * h2;
  float f = abs(fract(a) - 0.5) * 2.0;
  float line = 1.0 - smoothstep(width * 0.7, width, f);
  float inner = mix(0.95, 0.42, clamp(amount, 0.0, 1.0)) + h2 * 0.22;
  return line * present * smoothstep(inner, inner + 0.18, rad);
}

// Comic halftone dot coverage (1 inside a dot) for luminance l; dots grow in darker tones.
float fxHalftone(vec2 frag, float l) {
  float cell = max(5.0, uRes.y / 120.0);
  vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / cell;
  vec2 f = fract(p) - 0.5;
  float rad = sqrt(clamp(1.0 - l, 0.0, 1.0)) * 0.62;
  float aa = 1.2 / cell;
  return 1.0 - smoothstep(rad - aa, rad + aa, length(f));
}
`;

const MAIN = /* glsl */ `
const vec3 FX_INK = vec3(0.043, 0.043, 0.059);
const vec3 FX_RED = vec3(0.898, 0.098, 0.11);
const vec3 FX_PAPER = vec3(0.97, 0.96, 0.94);
const vec3 FX_RED_DEEP = vec3(0.76, 0.06, 0.08);

// Comic KO palette: shadows → ink, mid-tones → deep red with ink halftone, lights → paper;
// genuinely red/orange things (helmets, beaks) stay saturated.
vec3 fxKoLook(vec3 col) {
  float lk = fxLuma(col);
  float redness = smoothstep(0.06, 0.22, col.r - max(col.g, col.b)) * smoothstep(0.18, 0.4, col.r);
  float g = clamp((lk - 0.5) * 1.5 + 0.52, 0.0, 1.0);
  vec3 tone = mix(FX_INK, FX_RED_DEEP, smoothstep(0.1, 0.3, g));
  tone = mix(tone, FX_PAPER, smoothstep(0.48, 0.66, g));
  vec3 reds = vec3(min(1.0, col.r * 1.12 + 0.05), col.g * 0.45, col.b * 0.45);
  vec3 koc = mix(tone, reds, redness);
  float dots = fxHalftone(gl_FragCoord.xy, lk) * smoothstep(0.08, 0.3, g) * (1.0 - smoothstep(0.6, 0.78, g));
  return mix(koc, FX_INK, dots * uHalftone * 0.7);
}

float fxViewDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  return (uNear * uFar) / (uFar - z * (uFar - uNear));
}

// P5-style backdrop: slowly turning red / deep-red rays around the subject, ink dots outward.
vec3 fxBurst(vec2 uv, vec2 asp) {
  vec2 d = (uv - uFocus) * asp;
  float f = fract((atan(d.y, d.x) / 6.2831853 + uTime * 0.035) * 14.0);
  float ray = smoothstep(0.47, 0.53, f) * (1.0 - smoothstep(0.97, 1.0, f));
  vec3 c = mix(FX_RED, vec3(0.5, 0.02, 0.05), ray);
  float dots = fxHalftone(gl_FragCoord.xy, 1.0 - clamp(length(d) * 0.75, 0.0, 0.8));
  return mix(c, FX_INK, dots * 0.55);
}

vec3 fxDamage(vec3 col, vec2 uv, float vr, vec2 asp) {
  float a = atan(uv.y - 0.5, (uv.x - 0.5) * asp.x);
  float saw = abs(fract(a * 3.8197) - 0.5) * 2.0;
  float edgeR = mix(0.74, 0.4, uDamage) - saw * 0.07;
  float m = smoothstep(edgeR, edgeR + 0.04, vr);
  vec3 red = mix(FX_RED, vec3(0.32, 0.0, 0.02), smoothstep(edgeR + 0.05, edgeR + 0.32, vr));
  return mix(col, red, m * min(1.0, uDamage * 1.6) * 0.85);
}

vec3 fxLetterbox(vec3 col, vec2 uv) {
  float h = uLetterbox * 0.12;
  float slope = 0.035;
  float top = 1.0 - h + (uv.x - 0.5) * slope;
  float bot = h + (uv.x - 0.5) * slope;
  float px = 1.0 / uRes.y;
  float lw = 0.007;
  float inTop = smoothstep(top - px, top + px, uv.y);
  float inBot = 1.0 - smoothstep(bot - px, bot + px, uv.y);
  float redTop = smoothstep(top - lw - px, top - lw + px, uv.y) * (1.0 - inTop);
  float redBot = (1.0 - smoothstep(bot + lw - px, bot + lw + px, uv.y)) * (1.0 - inBot);
  col = mix(col, FX_RED, max(redTop, redBot) * smoothstep(0.0, 0.3, uLetterbox));
  return mix(col, FX_INK, max(inTop, inBot));
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec3 col = fxSampleScene(uv);
#if FX_BLOOM
  col += texture2D(tBloom, uv).rgb * uBloom;
#endif
  col = fxToSRGB(fxTonemap(col * uExposure));
  float l = fxLuma(col);
  col = mix(vec3(l), col, uSat);
  col = clamp(((col - 0.5) * uContrast + 0.5) * uTint, 0.0, 1.0);
  float vr = length((uv - 0.5) * vec2(1.0, 0.9));
  if (uKo > 0.001) col = mix(col, fxKoLook(col), uKo);
  if (uBgBurst > 0.001) {
    float bg = smoothstep(uSubjectDepth + uBgMargin, uSubjectDepth + uBgMargin * 2.0 + 2.0, fxViewDepth(uv));
    col = mix(col, fxBurst(uv, asp), bg * uBgBurst);
  }
  if (uRed > 0.001) col = mix(col, col * vec3(1.0, 0.32, 0.3) + vec3(0.2, 0.0, 0.0), uRed);
  col = mix(col, uLinesColor, fxSpeedLines(uv, uBlurCenter, uLines, 0.0) * 0.5);
  col = mix(col, FX_INK, fxSpeedLines(uv, uFocus, uKoLines, 17.0) * 0.92);
  if (uDamage > 0.001) col = fxDamage(col, uv, vr, asp);
  col *= 1.0 - smoothstep(0.36, 0.86, vr) * (0.24 + uVignette);
  if (uGrain > 0.001) col += (fxHash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * uGrain * 0.14;
  if (uImpact > 0.5) col = mix(uImpactColor, FX_INK, step(0.45, fxLuma(col)));
  col = mix(col, uFlashColor, uFlash);
  if (uLetterbox > 0.001) col = fxLetterbox(col, uv);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const COMPOSITE_FRAG = HEADER + MAIN;
