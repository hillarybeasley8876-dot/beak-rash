// Rim-lit bubble material (doge shield): a clear centre, one hard toon rim band in the tint, a thin white edge, a
// screen-space halftone ramp inside the band, and a ripple ring that runs over the shell when a hit bounces off it.
import { Color, FrontSide, NormalBlending, ShaderMaterial, Vector3, type ColorRepresentation } from 'three';

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vO;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vO = normalize(position);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uHit;
uniform float uRipple;
varying vec3 vN;
varying vec3 vV;
varying vec3 vO;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float band = smoothstep(0.55, 0.6, f);
  float edge = smoothstep(0.8, 0.84, f);
  vec2 cell = fract(gl_FragCoord.xy / 7.0) - 0.5;
  float dots = step(length(cell), 0.4 * smoothstep(0.25, 0.55, f)) * (1.0 - band);
  float ang = acos(clamp(dot(normalize(vO), uHit), -1.0, 1.0));
  float ring = (1.0 - uRipple) * (1.0 - smoothstep(0.0, 0.22, abs(ang - uRipple * 3.14159)));
  float alpha = 0.03 + dots * 0.2 + band * 0.6 + ring * 0.75;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), max(edge, ring * 0.85)), clamp(alpha, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}`;

export type RimUniforms = {
  uColor: { value: Color };
  uOpacity: { value: number };
  uHit: { value: Vector3 };    // object-space unit direction of the last bounced hit
  uRipple: { value: number };  // ripple progress 0..1 (1 = no ripple)
};

export type RimMaterial = ShaderMaterial & { uniforms: RimUniforms };

/** A new rim material (one shader program shared by every instance). */
export function makeRimMaterial(): RimMaterial {
  const uniforms: RimUniforms = {
    uColor: { value: new Color() }, uOpacity: { value: 1 }, uHit: { value: new Vector3(0, 0, -1) }, uRipple: { value: 1 },
  };
  return new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: FrontSide, blending: NormalBlending,
  }) as RimMaterial;
}

/** Reset a (pooled) rim material for a new bubble. */
export function setRim(m: RimMaterial, color: ColorRepresentation, opacity: number): RimMaterial {
  m.uniforms.uColor.value.set(color);
  m.uniforms.uOpacity.value = opacity;
  m.uniforms.uRipple.value = 1;
  return m;
}
