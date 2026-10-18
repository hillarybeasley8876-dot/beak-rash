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
}`;

/**
 * Night windows. aux.x = style (0 none, 1 flats warm, 2 offices cool by floor, 3 mixed, 4 shop glass),
 * aux.y = seed, aux.z = lit ratio, aux.w = LED floor-line colour (0 none, 1 magenta, 2 cyan, 3 amber, 4 red).
 * uv = facade coordinates: one unit per window bay across, one per floor up.
 */
export const BUILDING_FRAG = /* glsl */`
if (vAux.x > 0.5) {
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
  float lit = step(1.0 - vAux.z, office ? mix(h, hf, 0.7) : h);
  lit = shop ? 1.0 : abs(lit - flip);
  vec3 warm = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.78, 0.42), hash12(cell + 3.1));
  vec3 cool = mix(vec3(0.5, 0.72, 1.0), vec3(0.82, 0.92, 1.0), hash12(cell + 5.3));
  vec3 col = office ? cool : style > 2.5 && !shop ? (h > 0.5 ? warm : cool) : warm;
  float accent = step(0.95, hash12(cell + 9.7)) * (shop ? 0.0 : 1.0);
  col = mix(col, h > 0.6 ? vec3(1.0, 0.3, 0.8) : vec3(0.3, 0.95, 1.0), accent);
  float tv = step(0.965, hash12(cell + 1.9)) * (shop ? 0.0 : 1.0);
  float tvAmt = 0.6 + 0.4 * sin(uCityTime * 9.0 + h * 40.0) * sin(uCityTime * 2.3 + h * 13.0);
  col = mix(col, vec3(0.4, 0.58, 1.0) * tvAmt, tv);
  lit = max(lit, tv);
  float curtain = step(0.72, hash12(cell + 7.7)) * (style < 1.5 ? 1.0 : 0.0);
  float shade = mix(1.0, 0.35 + 0.65 * step(0.5, f.x), curtain);
  float bright = shop ? 0.55 : 1.15;
  if (shop) {
    // Shop interiors: tinted per bay, shelves and a counter band, mullions between panes.
    vec3 tint = h > 0.66 ? vec3(1.0, 0.82, 0.62) : h > 0.33 ? vec3(0.75, 0.9, 1.0) : vec3(1.0, 0.7, 0.85);
    float shelves = 0.65 + 0.35 * step(0.18, fract(f.y * 3.0));
    float counter = mix(0.35, 1.0, step(0.32, f.y));
    col = tint * shelves * counter;
  }
  vec3 emi = col * lit * win * shade * bright;
  vec3 band = vAux.w > 0.5 ? ledColor(vAux.w) : vec3(0.0);
  emi += band * (1.0 - smoothstep(0.0, 0.06 + fw.y, f.y)) * 2.0 * (1.0 - far);
  vec3 avg = col * (shop ? 1.0 : vAux.z) * 0.36 * bright + band * 0.14;
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
