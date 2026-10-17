// Shared cel-shading look (core-owned so every unit's meshes match). fx/ may tune the globals.
//   toon(color)      → MeshToonMaterial on the shared 3-band ramp
//   outline(mesh, w) → inverted-hull black outline child (characters, bikes, vehicles, props)
import {
  BackSide, Color, DataTexture, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat,
  type ColorRepresentation, type Material, type Object3D,
} from 'three';

let ramp: DataTexture | null = null;

/** 3-band light ramp: shadow / mid / lit. */
export function toonRamp(): DataTexture {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 170, 255]);
  ramp = new DataTexture(data, data.length, 1, RedFormat);
  ramp.minFilter = ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map<string, MeshToonMaterial>();

/** Shared toon material per colour (+ options key). Do not mutate returned materials; clone first. */
export function toon(color: ColorRepresentation, opts: { emissive?: ColorRepresentation; emissiveIntensity?: number; vertexColors?: boolean; transparent?: boolean; opacity?: number } = {}): MeshToonMaterial {
  const key = `${new Color(color).getHexString()}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}|${opts.vertexColors ?? ''}|${opts.opacity ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new MeshToonMaterial({
      color, gradientMap: toonRamp(), vertexColors: opts.vertexColors ?? false,
      transparent: opts.transparent ?? (opts.opacity !== undefined && opts.opacity < 1), opacity: opts.opacity ?? 1,
    });
    if (opts.emissive !== undefined) {
      m.emissive = new Color(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    cache.set(key, m);
  }
  return m;
}

const outlineMats = new Map<string, MeshBasicMaterial>();

/** Back-face hull material pushed out along normals by `width` (object-space metres). */
function outlineMaterial(color: ColorRepresentation, width: number): MeshBasicMaterial {
  const key = `${new Color(color).getHexString()}|${width.toFixed(4)}`;
  let m = outlineMats.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color, side: BackSide });
    const w = width.toFixed(4);
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  transformed += normalize(objectNormal) * ${w};`,
      );
    };
    m.customProgramCacheKey = () => `outline-${w}`;
    outlineMats.set(key, m);
  }
  return m;
}

/** Add an inverted-hull outline child to every mesh under `root` (skips outlines and userData.noOutline). */
export function outline(root: Object3D, width = 0.025, color: ColorRepresentation = '#0b0b0f'): void {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && !o.userData.isOutline && !o.userData.noOutline) meshes.push(o);
  });
  const mat: Material = outlineMaterial(color, width);
  for (const mesh of meshes) {
    const hull = new Mesh(mesh.geometry, mat);
    hull.userData.isOutline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.renderOrder = mesh.renderOrder - 1;
    mesh.add(hull);
  }
}
