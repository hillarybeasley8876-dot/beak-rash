// Terrain material: vertex-coloured toon with two detail textures blended by steepness — soft
// planar grain on flat ground, horizontal rock strata projected onto steep faces (world space).
import { CanvasTexture, LinearMipmapLinearFilter, MeshToonMaterial, RepeatWrapping, SRGBColorSpace, type WebGLRenderer } from 'three';
import { Rng } from '../../core/rng';
import { toonRamp } from '../../render/toon';
import type { WorldCtx } from '../ctx';
import { grainTexture } from '../road/textures';

/** Light-neutral strata (multiplied with the vertex colour): bands, ledges and cracks. */
function strataTexture(renderer: WebGLRenderer): CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (!g) throw new Error('[track] 2D canvas unavailable');
  const rng = new Rng(0x57a7a);
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const h = rng.range(10, 34);
    const l = rng.range(0.8, 1.05);
    g.fillStyle = `rgb(${Math.round(232 * l)},${Math.round(226 * l)},${Math.round(218 * l)})`;
    g.fillRect(0, y, S, h);
    // Dark ledge line under each band, slightly wavy.
    g.strokeStyle = 'rgba(40,28,20,0.55)';
    g.lineWidth = rng.range(1.5, 3.5);
    g.beginPath();
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + h + Math.sin(x * 0.05 + y) * 1.5);
    g.stroke();
    y += h;
  }
  // Vertical cracks.
  g.strokeStyle = 'rgba(40,28,20,0.4)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = rng.range(1, 2.5);
    let x = rng.range(0, S), yy = rng.range(0, S);
    g.beginPath();
    g.moveTo(x, yy);
    for (let k = 0; k < 4; k++) {
      x += rng.range(-6, 6);
      yy += rng.range(8, 20);
      g.lineTo(x, yy);
    }
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function terrainMat(ctx: WorldCtx): MeshToonMaterial {
  return ctx.shared('mat:terrain', () => {
    const grain = ctx.shared('tex:grain', () => grainTexture(ctx.app.renderer));
    const strata = ctx.shared('tex:strata', () => strataTexture(ctx.app.renderer));
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), map: grain });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uStrata = { value: strata };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uStrata;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
        .replace('#include <map_fragment>', `
          vec4 grainC = texture2D(map, vMapUv);
          // Strata run horizontally along the face: u along the wall, v up it.
          vec2 th = normalize(vec2(-vWNrm.z, vWNrm.x) + vec2(1e-4, 0.0));
          vec4 strataC = texture2D(uStrata, vec2(dot(vWPos.xz, th), vWPos.y) / 7.0);
          float steep = smoothstep(0.35, 0.6, 1.0 - abs(vWNrm.y));
          diffuseColor *= mix(grainC, strataC, steep);`);
    };
    m.customProgramCacheKey = () => 'track-terrain';
    return m;
  });
}
