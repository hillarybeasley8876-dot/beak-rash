// KO cast look (composite fragment stage): the subject mask (post/mask.ts) tells the victim, the
// attacker and bystanders apart. The victim keeps its own toon colours (lifted when the light is dim) inside a
// paper sticker border with an ink line; the attacker is muted; bystanders become dark ink ghosts on the backdrop.
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

// Victim colours: white-balanced and lifted when dark. Near-neutral parts (plumage, grey fur) keep their own
// lightness on four clean tones (ink, dark grey, light grey, paper; no screen-tone dots on small faces), so a
// grey pigeon stays grey and a penguin's back black next to a white goose, and a sunset or neon key light never
// tints them pink or blue; saturated parts (fur, beaks, helmets, bikes) keep their own colour.
vec3 fxVictimTone(vec3 col) {
  vec3 c = clamp(col * uVicWB * vVicGain, 0.0, 1.0);
  float mx = max(c.r, max(c.g, c.b));
  float sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.001);
  float l = fxLuma(c);
  vec3 manga = mix(FX_INK, vec3(0.34, 0.35, 0.39), smoothstep(0.17, 0.24, l));
  manga = mix(manga, vec3(0.66, 0.67, 0.71), smoothstep(0.39, 0.46, l));
  manga = mix(manga, FX_PAPER, smoothstep(0.72, 0.79, l));
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

/** Vertex stage: exposure lift of the victim from the light level, not from the victim itself, so every species
 *  keeps its own lightness: a white surface in the toon lit band under the scene's lights right now (uLitWhite,
 *  linear) is graded like the frame and lifted toward paper when the light is dim (night city, tunnels). A lift
 *  measured on the victim (the old way) pushed a grey pigeon up to the white of a white goose. */
export const CAST_VERT_GLSL = /* glsl */ `
uniform sampler2D tMask;
uniform float uMask;
uniform float uLitWhite;
varying float vVicGain;

float fxVictimGain() {
  return clamp(0.92 / max(fxLuma(fxGrade(vec3(uLitWhite))), 0.05), 1.0, 2.4);
}
`;
