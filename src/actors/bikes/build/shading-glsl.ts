// GLSL snippets injected into the bike materials (build/material.ts):
// - fade: bones may carry a dissolve factor in their X scale (relative to Y). Spokes / blur discs use it
//   (animate.ts); every other bone has 1, so nothing else is touched. Fragments dither out by the factor.
// - finish: per-vertex gloss → hard-edged toon specular band, chrome sky/ground banding, cool stepped rim;
//   gloss ≥ 1.5 marks self-lit parts (palette GLOW), drawn in their own colour whatever the lighting.

export const FADE_VERTEX_DECL = 'varying float vBikeFade;';

export const FADE_VERTEX = `
#ifdef USE_SKINNING
  vBikeFade = length( boneMatX[ 0 ].xyz ) / max( length( boneMatX[ 1 ].xyz ), 1e-6 );
#else
  vBikeFade = 1.0;
#endif`;

export const FADE_FRAGMENT_DECL = 'varying float vBikeFade;';

/** Interleaved-gradient-noise dissolve (stable per pixel, halftone-like at partial fades). */
export const FADE_FRAGMENT = `
  if ( vBikeFade < 0.995 ) {
    float bikeN = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
    if ( vBikeFade < 0.01 || bikeN > vBikeFade ) discard;
  }`;

export const GLOSS_VERTEX_DECL = 'attribute float gloss;\nvarying float vGloss;';
export const GLOSS_VERTEX = 'vGloss = gloss;';
export const GLOSS_FRAGMENT_DECL = 'varying float vGloss;';

/** Runs after <lights_fragment_end> in MeshToonMaterial (normal, vViewPosition, reflectedLight in scope). */
export const FINISH_FRAGMENT = `
  {
    float bikeLit = step( 1.5, vGloss );
    float bikeGl = vGloss * ( 1.0 - bikeLit );
    reflectedLight.directDiffuse *= 1.0 - bikeLit;
    reflectedLight.indirectDiffuse *= 1.0 - 0.75 * bikeLit;
    totalEmissiveRadiance += diffuseColor.rgb * bikeLit;
    vec3 bikeV = normalize( vViewPosition );
    float bikeNdV = clamp( dot( normal, bikeV ), 0.0, 1.0 );
    float bikeChrome = smoothstep( 0.7, 0.95, bikeGl );
    if ( bikeChrome > 0.0 ) {
      vec3 bikeR = inverseTransformDirection( reflect( -bikeV, normal ), viewMatrix );
      float bikeSky = smoothstep( -0.05, 0.05, bikeR.y );
      float bikeBand = mix( 1.0, mix( 0.42, 1.12, bikeSky ), bikeChrome );
      reflectedLight.directDiffuse *= bikeBand;
      reflectedLight.indirectDiffuse *= bikeBand;
      totalEmissiveRadiance += vec3( 0.72, 0.86, 1.0 ) * 0.16 * bikeSky * bikeChrome;
    }
    #if NUM_DIR_LIGHTS > 0
    if ( bikeGl > 0.01 ) {
      vec3 bikeL = directionalLights[ 0 ].direction;
      float bikeNdH = max( dot( normal, normalize( bikeL + bikeV ) ), 0.0 );
      float bikeS = pow( bikeNdH, mix( 28.0, 110.0, bikeGl ) );
      float bikeW = fwidth( bikeS ) + 1e-4;
      float bikeSpec = smoothstep( 0.5 - bikeW, 0.5 + bikeW, bikeS ) * step( 0.0, dot( normal, bikeL ) );
      totalEmissiveRadiance += min( directionalLights[ 0 ].color, vec3( 1.6 ) ) * bikeSpec * mix( 0.35, 0.7, bikeGl );
    }
    #endif
    float bikeFr = 1.0 - bikeNdV;
    float bikeRw = fwidth( bikeFr ) + 1e-4;
    totalEmissiveRadiance += vec3( 0.62, 0.85, 1.0 ) * 0.3 * smoothstep( 0.66 - bikeRw, 0.66 + bikeRw, bikeFr );
  }`;
