// The composite "uber" pass: HDR scene + bloom → speed/zoom blur, chroma, grade, KO comic look,
// speed lines, damage pulse, impact frame, flash, vignette, letterbox → sRGB screen.
// Defines: FX_BLUR (radial blur + chroma taps), FX_TAPS, FX_BLOOM, FX_TONEMAP (0 shoulder, 1 ACES).
import { GLSL_COMMON } from './glsl-common';

// Shared by both stages: tone map + grade, and linear view depth.
const GRADE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float uNear, uFar;
uniform float uExposure, uSat, uContrast;
uniform vec3 uTintN;

vec3 fxTonemap(vec3 x) {
#if FX_TONEMAP == 1
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
#else
  const float k = 0.86;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
#endif
}

// Track grade: the (luminance-normalised) tint is a split tone on shadows and mid-tones, so whites and
// the sky stay clean; saturation works as vibrance (dull colours gain most, near-whites none).
vec3 fxGrade(vec3 hdr) {
  vec3 col = fxToSRGB(fxTonemap(hdr * uExposure));
  float l = fxLuma(col);
  col *= mix(uTintN, vec3(1.0), smoothstep(0.55, 0.9, l));
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float vib = uSat - 1.0;
  if (vib > 0.0) vib *= 1.5 * (1.0 - sat) * (1.0 - smoothstep(0.8, 0.97, l));
  col = mix(vec3(fxLuma(col)), col, 1.0 + vib);
  return clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
}

// Comic accent red (helmets, beak tips): vivid, bright and a TRUE red (hue within ~10 deg); oranges and
// tans (cat, shiba, corgi fur, beaks) go through the ink / halftone / paper map instead.
float fxRedness(vec3 col) {
  float mx = max(col.r, max(col.g, col.b));
  float mn = min(col.r, min(col.g, col.b));
  float sat = (mx - mn) / max(mx, 0.001);
  float hueOff = abs(col.g - col.b) / max(mx - mn, 0.001);
  return smoothstep(0.6, 0.78, sat) * smoothstep(0.0, 0.08, col.r - max(col.g, col.b)) * smoothstep(0.55, 0.75, col.r)
    * (1.0 - smoothstep(0.16, 0.26, hueOff));
}

float fxViewDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  return (uNear * uFar) / (uFar - z * (uFar - uNear));
}
`;

/**
 * Vertex stage: besides the fullscreen triangle it measures the KO subject once per vertex (not per
 * pixel): the mean graded luma of taps around the focus that lie at the subject's depth, so the comic
 * tone map is centred on the subject on every track (bright noon, night city, red sunset), and its
 * share of accent red: red stays an accent, so a mostly red subject goes through the ink/paper map.
 */
export const COMPOSITE_VERT = /* glsl */ `
uniform float uKo, uSubjectDepth;
uniform vec2 uFocus;
varying vec2 vUv;
varying float vKoMid;
varying float vKoRed;
${GLSL_COMMON}
${GRADE}
void main() {
  vUv = uv;
  vKoMid = 0.45;
  vKoRed = 1.0;
  if (uKo > 0.001) {
    float sum = 0.0;
    float red = 0.0;
    float n = 0.0;
    for (int j = 0; j < 5; j++) {
      for (int i = 0; i < 3; i++) {
        vec2 p = clamp(uFocus + vec2((float(i) - 1.0) * 0.03, (float(j) - 2.0) * 0.05), 0.001, 0.999);
        float w = step(fxViewDepth(p), uSubjectDepth + 1.2);
        vec3 g = fxGrade(texture2D(tScene, p).rgb);
        sum += fxLuma(g) * w;
        red += fxRedness(g) * w;
        n += w;
      }
    }
    if (n > 0.5) {
      vKoMid = clamp(sum / n, 0.1, 0.8);
      vKoRed = 1.0 - smoothstep(0.2, 0.35, red / n);
    }
  }
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const HEADER = /* glsl */ `
uniform sampler2D tBloom;
uniform float uSubjectDepth, uBgBurst, uBgMargin, uBehindAt, uBurstInk, uRim;
uniform vec2 uTanHalf;
uniform vec3 uViewUp;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloom;
uniform float uEdgeBlur, uChroma, uZoom;
uniform vec2 uBlurCenter;
uniform float uKo, uHalftone, uRed, uGrain, uVignette, uLetterbox;
uniform float uLines, uKoLines;
uniform vec2 uFocus;
uniform float uDamage, uFlash, uImpact;
uniform vec3 uFlashColor, uImpactColor, uLinesColor;
varying vec2 vUv;
varying float vKoMid;
varying float vKoRed;
${GLSL_COMMON}
${GRADE}

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
`;

const SHAPES = /* glsl */ `
// Anime speed lines: wedge-shaped rays around c that re-randomise at 18 fps. 'edge' 1 = gameplay lines:
// even a small amount (plain top speed) shows a few thin lines in the outer 12-15 % of the frame.
float fxSpeedLines(vec2 uv, vec2 c, float amount, float seed, float edge) {
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
  float amt = clamp(amount, 0.0, 1.0);
  float inner = mix(mix(0.95, 0.42, amt), mix(0.8, 0.42, sqrt(amt)), edge) + h2 * mix(0.22, 0.16, edge);
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

// Comic KO palette, centred on the subject's own luma (vKoMid). The subject zone is black-and-white
// manga (ink, halftone mid-tones, paper); whatever lies a few metres behind it (night reflections,
// far road) takes the ink / deep-red band of the backdrop, so the subject never melts into the rays.
// Only small, vivid true-red accents (helmets, beak tips) stay red (fxRedness x vKoRed).
vec3 fxKoLook(vec3 col, float bg, float behind, float ground) {
  float lk = fxLuma(col);
  float redness = fxRedness(col) * vKoRed;
  float g = clamp((lk - vKoMid) * 1.7 + 0.5, 0.0, 1.0);
  vec3 subj = mix(FX_INK, FX_PAPER, smoothstep(0.34, 0.5, g));
  vec3 back = mix(FX_INK, FX_RED_DEEP, smoothstep(0.15, 0.5, g));
  vec3 reds = vec3(min(1.0, col.r * 1.12 + 0.05), col.g * 0.45, col.b * 0.45);
  vec3 koc = mix(mix(subj, back, max(bg, behind)), reds, redness);
  float mid = smoothstep(0.12, 0.34, g) * (1.0 - smoothstep(0.62, 0.8, g));
  float dots = fxHalftone(gl_FragCoord.xy, g) * mid * (1.0 - redness);
  koc = mix(koc, FX_INK, dots * uHalftone * 0.75);
  // The road in front is a screen-tone floor (paper + luma-sized dots, never solid ink or paper),
  // so wet reflections and shadows never turn into hard stripes.
  vec3 floorTone = mix(FX_PAPER, FX_INK, fxHalftone(gl_FragCoord.xy, 0.3 + 0.55 * g) * 0.85);
  return mix(koc, floorTone, ground * (1.0 - max(bg, behind)) * (1.0 - redness));
}

// 1 = far enough behind the subject (view depth d) to belong to the backdrop.
float fxBgMaskD(float d) {
  return smoothstep(uSubjectDepth + uBgMargin, uSubjectDepth + uBgMargin + 2.5, d);
}

// 1 on near-horizontal surfaces (the road): normal from the depth derivatives vs world up.
float fxGround(vec2 uv, float d) {
  vec3 p = vec3((uv * 2.0 - 1.0) * uTanHalf * d, -d);
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  return smoothstep(0.75, 0.92, abs(dot(n, uViewUp)));
}

// Sticker rim: subject pixels within ~3 px of the backdrop edge, or of a drop of 0.7-3 m onto a surface
// close behind (a dark victim in front of a dark wall keeps its paper outline).
float fxRim(vec2 uv, float depth, float bg) {
  vec2 o = vec2(3.0 * uRes.y / 1080.0) / uRes;
  float far = max(max(fxViewDepth(uv + vec2(o.x, 0.0)), fxViewDepth(uv - vec2(o.x, 0.0))),
                  max(fxViewDepth(uv + vec2(0.0, o.y)), fxViewDepth(uv - vec2(0.0, o.y))));
  float edge = smoothstep(0.3, 0.7, fxBgMaskD(far) - bg);
  float jump = far - depth;
  float near = 1.0 - smoothstep(uSubjectDepth + uBehindAt - 1.0, uSubjectDepth + uBehindAt, depth);
  return max(edge, smoothstep(0.7, 0.9, jump) * (1.0 - smoothstep(2.5, 3.0, jump)) * near);
}

// P5-style backdrop: slowly turning rays around the subject, ink dots outward.
// uBurstInk 0 = red / deep-red rays (KO), 1 = ink rays on deep red (WRECKED).
vec3 fxBurst(vec2 uv, vec2 asp) {
  vec2 d = (uv - uFocus) * asp;
  float f = fract((atan(d.y, d.x) / 6.2831853 + uTime * 0.035) * 14.0);
  float ray = smoothstep(0.47, 0.53, f) * (1.0 - smoothstep(0.97, 1.0, f));
  vec3 base = mix(FX_RED, FX_RED_DEEP, uBurstInk);
  vec3 rays = mix(vec3(0.5, 0.02, 0.05), FX_INK, uBurstInk);
  vec3 c = mix(base, rays, ray);
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
`;

const FINISH = /* glsl */ `
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
  vec3 hdr = fxSampleScene(uv);
#if FX_BLOOM
  hdr += texture2D(tBloom, uv).rgb * uBloom;
#endif
  vec3 col = fxGrade(hdr);
  float vr = length((uv - 0.5) * vec2(1.0, 0.9));
  if (uKo > 0.001) {
    float depth = fxViewDepth(uv);
    float bg = fxBgMaskD(depth);
    // Behind the subject: anything past +uBehindAt (2 m; ult: past the farthest victim), and the road
    // (wet reflections) past +0.4 m.
    float ground = fxGround(uv, depth);
    float behind = max(smoothstep(uSubjectDepth + uBehindAt, uSubjectDepth + uBehindAt + 1.5, depth), ground * smoothstep(uSubjectDepth + 0.4, uSubjectDepth + 1.2, depth));
    col = mix(col, fxKoLook(col, bg, behind, ground), uKo);
    if (uBgBurst > 0.001) {
      col = mix(col, fxBurst(uv, asp), bg * uBgBurst);
      if (uRim > 0.001) col = mix(col, FX_PAPER, fxRim(uv, depth, bg) * uRim);
    }
  }
  if (uRed > 0.001) col = mix(col, FX_RED, smoothstep(0.3, 0.78, vr) * uRed);
  col = mix(col, uLinesColor, fxSpeedLines(uv, uBlurCenter, uLines, 0.0, 1.0) * 0.5);
  col = mix(col, FX_INK, fxSpeedLines(uv, uFocus, uKoLines, 17.0, 0.0) * 0.92);
  if (uDamage > 0.001) col = fxDamage(col, uv, vr, asp);
  col *= 1.0 - smoothstep(0.36, 0.86, vr) * (0.24 + uVignette);
  if (uGrain > 0.001) col += (fxHash12(gl_FragCoord.xy + fract(uTime * 7.31) * 311.0) - 0.5) * uGrain * 0.14;
  if (uImpact > 0.5) col = mix(uImpactColor, FX_INK, step(0.45, fxLuma(col)));
  col = mix(col, uFlashColor, uFlash);
  if (uLetterbox > 0.001) col = fxLetterbox(col, uv);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const COMPOSITE_FRAG = HEADER + SHAPES + MAIN + FINISH;
