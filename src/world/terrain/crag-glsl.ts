// Limestone face shading for craggy tracks (LayoutDef.crags; terrain/material.ts sets CRAG_FACES):
// wavy horizontal ochre / chalk bands across steep faces and a cool tint on the ambient light there,
// so faces turned from the sun and overhang undersides read blue-grey instead of flat tan.

/** After the strata mix in map_fragment (needs vWPos, steep, diffuseColor). */
export const CRAG_BANDS = `
#ifdef CRAG_FACES
  float bh = (vWPos.y + 1.4 * sin(vWPos.x * 0.031 + vWPos.z * 0.027)) / 11.0;
  float bf = fract(bh), baa = fwidth(bh) + 0.008;
  float ochre = smoothstep(0.6 - baa, 0.6 + baa, bf) * (1.0 - smoothstep(0.76 - baa, 0.76 + baa, bf));
  float chalk = smoothstep(0.15 - baa, 0.15 + baa, bf) * (1.0 - smoothstep(0.205 - baa, 0.205 + baa, bf));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.94, 0.8, 0.62), ochre * steep);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.94, 0.9), chalk * steep * 0.6);
#endif
`;

/** After lights_fragment_end: cool ambient on steep faces (shadowed rock goes blue-grey). */
export const CRAG_AMBIENT = `
#ifdef CRAG_FACES
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.76, 0.84, 1.22), steep);
#endif
`;
