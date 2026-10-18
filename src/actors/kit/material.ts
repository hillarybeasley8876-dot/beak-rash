// Rider material: the shared cel look (three bands at the render/toon.ts ramp levels 90/170/255) with soft,
// anti-aliased band edges, so band borders on decimated SDF meshes read as smooth curves instead of jagged
// "camo" patches, plus a stepped cool fresnel rim (SPEC §5) that separates riders from busy backgrounds.
import { Color, MeshToonMaterial } from 'three';

const BANDS = /* glsl */ `
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float x = dot( normal, lightDirection ) * 0.5 + 0.5;
  float w = max( 0.03, fwidth( x ) * 1.5 );
  return vec3( 0.353 + 0.314 * smoothstep( 0.3333 - w, 0.3333 + w, x ) + 0.333 * smoothstep( 0.6667 - w, 0.6667 + w, x ) );
}
`;

const RIM = /* glsl */ `
  {
    float facing = saturate( dot( normalize( normal ), normalize( vViewPosition ) ) );
    float rim = smoothstep( 0.62, 0.78, pow( 1.0 - facing, 1.6 ) );
    outgoingLight += vec3( 0.55, 0.75, 1.0 ) * rim * 0.28;
  }
  #include <opaque_fragment>
`;

let shared: MeshToonMaterial | null = null;

/** One shared material for every rider body and held weapon (vertex colours × cel bands + rim). */
export function riderMaterial(): MeshToonMaterial {
  if (shared) return shared;
  const m = new MeshToonMaterial({ color: new Color('#ffffff'), vertexColors: true });
  m.name = 'actors:rider';
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <gradientmap_pars_fragment>', BANDS)
      .replace('#include <opaque_fragment>', RIM);
  };
  m.customProgramCacheKey = () => 'actors-rider-v1';
  shared = m;
  return m;
}
