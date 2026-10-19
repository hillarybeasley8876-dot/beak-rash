// KO cast look (composite fragment stage): the subject mask (post/mask.ts) tells the victim, the
// attacker and bystanders apart. The victim keeps its own toon colours (lifted when dark) inside a paper
// sticker border with an ink line; the attacker is muted; bystanders become dark ink ghosts on the backdrop.
export const CAST_GLSL = /* glsl */ `
uniform sampler2D tMask;
uniform float uMask;
uniform vec2 uMaskRes;
uniform vec3 uVicWB;
uniform float uCastView;
varying float vVicGain;

// Role of the cast surface at p (1 victim, .66 attacker, .33 bystander), 0 where something nearer covers it.
float fxRoleAt(vec2 p, float sceneDepth) {
  vec2 m = texture2D(tMask, p).rg;
  return m.g * step(0.05, m.g) * step(m.r - 0.3, sceneDepth);
}

// Silhouettes in the MSAA depth are ~1 px wider than in the single-sample mask: an empty mask pixel at
// the depth of a visible cast neighbour takes that neighbour's role (no paper fringe round bystanders).
float fxFringeRole(vec2 uv, float depth) {
  vec2 px = max(vec2(1.5) / uRes, vec2(1.0) / uMaskRes);
  float role = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = px * vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0);
    vec2 m = texture2D(tMask, uv + o).rg;
    float vis = step(0.05, m.g) * step(m.r - 0.3, fxViewDepth(uv + o)) * step(abs(depth - m.r), 0.6);
    role = max(role, m.g * vis);
  }
  return role;
}

float fxVictimAt(vec2 p) {
  return step(0.83, fxRoleAt(p, fxViewDepth(p)));
}

// Sticker border outside the visible victim: x = paper (within ~4 px at 1080p), y = ink line (~4-7 px).
vec2 fxSticker(vec2 uv) {
  vec2 px = vec2(uRes.y / 1080.0) / uRes;
  float inner = 0.0;
  float outer = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982 + 0.39;
    vec2 d = vec2(cos(a), sin(a)) * px;
    inner = max(inner, fxVictimAt(uv + d * 4.0));
    outer = max(outer, fxVictimAt(uv + d * 7.0));
  }
  return vec2(inner, outer * (1.0 - inner));
}

// Victim colours: white-balanced and lifted when dark. Near-neutral parts (white plumage, grey fur) go to
// clean paper / ink manga shading, so a sunset or neon key light never tints them pink or blue; saturated
// parts (fur, beaks, helmets, bikes) keep their own colour.
vec3 fxVictimTone(vec3 col) {
  vec3 c = clamp(col * uVicWB * vVicGain, 0.0, 1.0);
  float mx = max(c.r, max(c.g, c.b));
  float sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.001);
  float l = fxLuma(c);
  float g = clamp((l - 0.5) * 1.6 + 0.55, 0.0, 1.0);
  // Three clean tones (ink, cool grey, paper): no screen-tone dots on small faces.
  vec3 manga = mix(mix(FX_INK, vec3(0.74, 0.74, 0.79), smoothstep(0.16, 0.3, g)), FX_PAPER, smoothstep(0.42, 0.58, g));
  return mix(manga, clamp(mix(vec3(l), c, 1.1), 0.0, 1.0), smoothstep(0.3, 0.46, sat));
}

vec3 fxAttackerTone(vec3 col) {
  vec3 c = fxVictimTone(col);
  return mix(vec3(fxLuma(c)), c, 0.5) * 0.78;
}

// Cast look over the comic look 'koc' (already graded + KO-mapped): victim colour, attacker muted,
// bystanders as ~35 % ink over the backdrop burst, then the victim's sticker border on top.
float fxCastRole(vec2 uv, float depth) {
  float role = fxRoleAt(uv, depth);
  return role < 0.05 ? fxFringeRole(uv, depth) : role;
}

vec3 fxCastLook(vec3 koc, vec3 graded, vec2 uv, float role, vec3 burst) {
  float victim = step(0.83, role);
  float attacker = step(0.5, role) * (1.0 - victim);
  float ghost = step(0.16, role) * (1.0 - step(0.5, role));
  if (uCastView > 0.5) return vec3(ghost, victim, attacker);
  float l = fxLuma(graded);
  vec3 col = koc;
  col = mix(col, mix(burst, FX_INK, 0.3 + 0.25 * (1.0 - smoothstep(0.2, 0.8, l))), ghost);
  col = mix(col, fxAttackerTone(graded), attacker);
  col = mix(col, fxVictimTone(graded), victim);
  if (victim < 0.5) {
    vec2 st = fxSticker(uv);
    col = mix(col, FX_PAPER, st.x);
    col = mix(col, FX_INK, st.y);
  }
  return col;
}
`;

/** Vertex stage: mean graded luma of the visible victim around the focus -> exposure lift (night victims). */
export const CAST_VERT_GLSL = /* glsl */ `
uniform sampler2D tMask;
uniform float uMask;
varying float vVicGain;

float fxVictimGain(vec2 focus) {
  float sum = 0.0;
  float n = 0.0;
  for (int j = 0; j < 5; j++) {
    for (int i = 0; i < 5; i++) {
      vec2 p = clamp(focus + vec2((float(i) - 2.0) * 0.04, (float(j) - 2.0) * 0.06), 0.001, 0.999);
      vec2 m = texture2D(tMask, p).rg;
      float w = step(0.83, m.g) * step(m.r - 0.3, fxViewDepth(p));
      sum += fxLuma(fxGrade(texture2D(tScene, p).rgb)) * w;
      n += w;
    }
  }
  return n > 0.5 ? clamp(0.5 / max(sum / n, 0.05), 1.0, 1.8) : 1.0;
}
`;
