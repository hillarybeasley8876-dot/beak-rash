// Received sun shadow fades out on faces at a grazing angle to the sun (N·L < 0.25). Those faces sit
// in the toon mid band anyway, and their self-shadowing against the back faces of a rippled rock face
// is what shows up as woven shadow acne. Used by the terrain material (terrain/material.ts).
import { ShaderChunk } from 'three';

const CALL = 'getShadow( directionalShadowMap[ i ],';
const END = 'vDirectionalShadowCoord[ i ] ) : 1.0;';

/** GLSL helper to declare before main(). */
export const SHADOW_FADE_FN = 'float shadowFadeNL( float nl, float sh ) { return mix( 1.0, sh, smoothstep( 0.0, 0.25, nl ) ); }';

let warned = false;

/** lights_fragment_begin with the directional shadow term faded by N·L (the stock chunk if three changed it). */
export function fadedLightsChunk(): string {
  const src = ShaderChunk.lights_fragment_begin;
  if (src.split(CALL).length !== 2 || src.split(END).length !== 2) {
    if (!warned) console.warn('[track] lights_fragment_begin changed: terrain shadow fade disabled');
    warned = true;
    return src;
  }
  return src
    .replace(CALL, `shadowFadeNL( dot( geometryNormal, directLight.direction ), ${CALL}`)
    .replace(END, 'vDirectionalShadowCoord[ i ] ) ) : 1.0;');
}
