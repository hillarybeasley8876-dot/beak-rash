// GLSL snippets for the city materials (dressing/city/mats.ts). Everything reads `vAux` (batch aux
// attribute), `vFac` (uv) and `uCityTime` (sim seconds).

export const HASH_GLSL = /* glsl */`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

export const BUILDING_FRAG_HEAD = /* glsl */`
vec3 ledColor(float k) {
  return k < 1.5 ? vec3(1.0, 0.2, 0.7) : k < 2.5 ? vec3(0.2, 0.95, 1.0) : k < 3.5 ? vec3(1.0, 0.75, 0.3) : vec3(1.0, 0.15, 0.2);
}
float boxMask(vec2 f, vec4 r) {
  return step(r.x, f.x) * step(f.x, r.z) * step(r.y, f.y) * step(f.y, r.w);
}
float ell(vec2 f, vec2 c, vec2 r) {
  vec2 d = (f - c) / r;
  return step(dot(d, d), 1.0);
}
/** Animal shopper silhouette at x = px, scale sc: kind 0 cat ears, 1 bird beak, 2 round capybara, 3 long-necked goose. */
float shopper(vec2 f, float px, float sc, float kind) {
  const float ASP = 0.67; // a bay is ~2 m wide and 3 m tall: y radii shrink so heads stay round
  float top = 0.06 + 0.33 * sc;
  float m = boxMask(f, vec4(px - 0.065 * sc, 0.06, px + 0.065 * sc, top)) + ell(f, vec2(px, top), vec2(0.065, 0.04 * ASP) * sc);
  float neck = kind > 2.5 ? 0.11 * sc : 0.0;
  m += boxMask(f, vec4(px - 0.018 * sc, top, px + 0.018 * sc, top + neck + 0.04 * sc));
  float hy = top + neck + 0.07 * sc;
  vec2 hr = kind > 1.5 && kind < 2.5 ? vec2(0.095, 0.07 * ASP) : vec2(0.068, 0.068 * ASP);
  m += ell(f, vec2(px, hy), hr * sc);
  if (kind < 0.5) m += ell(f, vec2(px - 0.042 * sc, hy + 0.06 * sc), vec2(0.02, 0.05 * ASP) * sc) + ell(f, vec2(px + 0.042 * sc, hy + 0.06 * sc), vec2(0.02, 0.05 * ASP) * sc);
  else if (kind < 1.5 || kind > 2.5) m += boxMask(f, vec4(px + 0.05 * sc, hy - 0.02 * sc, px + 0.13 * sc, hy + 0.008 * sc));
  else m += ell(f, vec2(px - 0.06 * sc, hy + 0.045 * sc), vec2(0.02, 0.02 * ASP) * sc) + ell(f, vec2(px + 0.06 * sc, hy + 0.045 * sc), vec2(0.02, 0.02 * ASP) * sc);
  return clamp(m, 0.0, 1.0);
}
/** Lit shop bay (f = bay uv): dim interior, a bright ceiling strip, two shelf rows of goods, animal shoppers (about half the bays, some drifting), sometimes a red P5 poster. */
vec3 shopInterior(vec2 f, float h, vec2 cell) {
  vec3 tint = h > 0.78 ? vec3(1.0, 0.78, 0.5) : h > 0.58 ? vec3(0.6, 0.86, 1.0) : vec3(1.0, 0.6, 0.82);
  vec3 c = tint * 0.32;
  float goods = hash12(vec2(floor(f.x * 9.0), cell.x + floor(f.y * 4.0)));
  vec3 goodsCol = goods > 0.66 ? vec3(1.0, 0.35, 0.3) : goods > 0.33 ? vec3(0.3, 0.9, 0.6) : vec3(1.0, 0.85, 0.3);
  float shelf = boxMask(f, vec4(0.08, 0.3, 0.92, 0.4)) + boxMask(f, vec4(0.08, 0.5, 0.92, 0.6));
  c = mix(c, goodsCol * 0.7, shelf * step(0.25, fract(f.x * 9.0)));
  c = mix(c, tint * 2.2, boxMask(f, vec4(0.1, 0.84, 0.9, 0.89)));
  c *= mix(0.45, 1.0, step(0.26, f.y));
  float has = step(0.45, hash12(cell + 6.1));
  float drift = step(0.7, hash12(cell + 3.3)) * 0.07 * sin(uCityTime * 0.35 + h * 20.0);
  float px = 0.24 + 0.52 * hash12(cell + 4.4) + drift;
  float body = shopper(f, px, 0.8 + 0.45 * hash12(cell + 5.5), floor(hash12(cell + 7.1) * 3.99));
  float px2 = 0.2 + 0.6 * hash12(cell + 8.8);
  body += step(0.62, h) * shopper(f, px2, 0.65 + 0.35 * hash12(cell + 9.9), floor(hash12(cell + 2.2) * 3.99));
  c *= 1.0 - 0.9 * has * clamp(body, 0.0, 1.0);
  float poster = step(0.82, hash12(cell + 2.6)) * boxMask(f, vec4(0.62, 0.1, 0.9, 0.46));
  c = mix(c, mix(vec3(1.4, 0.06, 0.08), vec3(1.2), step(0.62, fract(f.y * 5.0 + f.x * 2.0))), poster);
  return c;
}`;

/**
 * Night windows. aux.x = style (0 none, 1 flats warm, 2 offices cool by floor, 3 mixed, 4 shop glass),
 * aux.y = seed, aux.z = lit ratio, aux.w = LED floor-line colour (0 none, 1 magenta, 2 cyan, 3 amber, 4 red).
 * uv = facade coordinates: one unit per window bay across, one per floor up.
 * Style 5 = self-lit prop (trees, statue, flowers): the cel-shaded colour plus aux.y of it as emissive.
 */
export const BUILDING_FRAG = /* glsl */`
// Street glow: light spilling from shops and lamps washes the lowest storeys (no black walls beside the lanes).
float streetGlow = 1.0 - smoothstep(0.5, 9.0, vWorldY - uStreetY);
totalEmissiveRadiance += diffuseColor.rgb * mix(vec3(1.0), vec3(1.25, 0.95, 0.75), 0.5) * 0.42 * streetGlow * step(vAux.x, 4.5);
if (vAux.x > 4.5) {
  totalEmissiveRadiance += diffuseColor.rgb * vAux.y;
} else if (vAux.x > 0.5) {
  float style = floor(vAux.x + 0.5);
  bool office = style > 1.5 && style < 2.5;
  bool shop = style > 3.5;
  vec2 cell = floor(vFac);
  vec2 f = fract(vFac);
  vec2 fw = max(fwidth(vFac), vec2(1e-4));
  float far = smoothstep(0.22, 0.6, max(fw.x, fw.y));
  vec4 rect = shop ? vec4(0.05, 0.06, 0.95, 0.94) : office ? vec4(0.08, 0.18, 0.92, 0.82) : vec4(0.26, 0.2, 0.74, 0.82);
  float wx = smoothstep(rect.x - fw.x, rect.x + fw.x, f.x) - smoothstep(rect.z - fw.x, rect.z + fw.x, f.x);
  float wy = smoothstep(rect.y - fw.y, rect.y + fw.y, f.y) - smoothstep(rect.w - fw.y, rect.w + fw.y, f.y);
  float win = clamp(wx * wy, 0.0, 1.0);
  float h = hash12(cell + vAux.y * 7.13);
  float hf = hash12(vec2(cell.y * 1.37, vAux.y * 3.7));
  float slow = floor(uCityTime / 17.0 + h * 11.0);
  float flip = step(0.93, hash12(vec2(slow, h * 97.0)));
  // Street-level floors of offices / mixed blocks stay mostly dark so the neon keeps its pop.
  float ratio = style > 1.5 && cell.y < 3.5 ? min(vAux.z, 0.45) : vAux.z;
  float lit = step(1.0 - ratio, office ? mix(h, hf, 0.7) : h);
  lit = shop ? step(0.38, h) : abs(lit - flip);
  vec3 warm = mix(vec3(1.0, 0.46, 0.1), vec3(1.0, 0.66, 0.26), hash12(cell + 3.1));
  vec3 cool = mix(vec3(0.22, 0.56, 1.0), vec3(0.42, 0.84, 1.0), hash12(cell + 5.3));
  vec3 col = office ? cool : style > 2.5 && !shop ? (h > 0.5 ? warm : cool) : warm;
  float accent = step(0.95, hash12(cell + 9.7)) * (shop ? 0.0 : 1.0);
  col = mix(col, h > 0.6 ? vec3(1.0, 0.3, 0.8) : vec3(0.3, 0.95, 1.0), accent);
  float tv = step(0.965, hash12(cell + 1.9)) * (shop ? 0.0 : 1.0);
  float tvAmt = 0.6 + 0.4 * sin(uCityTime * 9.0 + h * 40.0) * sin(uCityTime * 2.3 + h * 13.0);
  col = mix(col, vec3(0.4, 0.58, 1.0) * tvAmt, tv);
  lit = max(lit, tv);
  float curtain = step(0.72, hash12(cell + 7.7)) * (style < 1.5 ? 1.0 : 0.0);
  float shade = mix(1.0, 0.35 + 0.65 * step(0.5, f.x), curtain);
  float bright = shop ? 0.62 : 1.15;
  if (shop) col = shopInterior(f, h, cell);
  vec3 emi = col * lit * win * shade * bright;
  vec3 band = vAux.w > 0.5 ? ledColor(vAux.w) : vec3(0.0);
  emi += band * (1.0 - smoothstep(0.0, 0.06 + fw.y, f.y)) * 2.0 * (1.0 - far);
  vec3 avg = shop ? vec3(0.9, 0.75, 0.75) * 0.13 : col * ratio * 0.36 * bright + band * 0.14;
  emi = mix(emi, avg, far);
  diffuseColor.rgb *= 1.0 - win * (1.0 - far) * 0.7;
  totalEmissiveRadiance += emi;
}`;

/** Neon / screen boost: aux.x = intensity, aux.y = phase, aux.z = flicker amount (0 = steady). */
export const NEON_FRAG = /* glsl */`
{
  float flick = 1.0;
  if (vAux.z > 0.0) {
    float t = uCityTime * (5.0 + vAux.y * 2.0) + vAux.y * 17.0;
    float drop = step(0.8, hash12(vec2(floor(t), vAux.y * 31.0)));
    flick = mix(1.0, 0.12 + 0.3 * fract(t * 3.7), drop * vAux.z);
  }
  diffuseColor.rgb *= vAux.x * flick;
}`;

/**
 * Light cycles: aux.x = phase offset (s), aux.y = role: 0 red, 1 amber, 2 green (14 s cycle),
 * 3 walk-red, 4 walk-green (blinks before red), 5 aviation blink, 6 steady.
 */
export const CYCLE_FRAG = /* glsl */`
{
  float t = mod(uCityTime + vAux.x, 14.0);
  float role = floor(vAux.y + 0.5);
  float on = 1.0;
  if (role < 0.5) on = step(8.0, t);
  else if (role < 1.5) on = step(6.0, t) * step(t, 8.0);
  else if (role < 2.5) on = step(t, 6.0);
  else if (role < 3.5) on = 1.0 - step(8.5, t) * step(t, 13.5);
  else if (role < 4.5) on = step(8.5, t) * step(t, 13.5) * (t > 12.0 ? step(0.5, fract(t * 2.0)) : 1.0);
  else if (role < 5.5) on = step(fract(uCityTime * 0.7 + vAux.x), 0.2);
  diffuseColor.rgb *= mix(0.08, 2.4, on);
}`;
