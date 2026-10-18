// Renders the terrain once from above into a half-float height texture (world y per texel).
// The sea shader reads it for shallow-water colour bands and the shoreline foam.
import {
  Box3, Color, HalfFloatType, LinearFilter, Mesh, OrthographicCamera, RedFormat, RGBAFormat, Scene, ShaderMaterial, Vector2, Vector4,
  WebGLRenderTarget, type Group, type Object3D,
} from 'three';
import type { WorldCtx } from '../ctx';

export interface HeightMap {
  texture: WebGLRenderTarget['texture'];
  /** (centreX, centreZ, 1/width, 1/depth): uv = (0.5 + (x − cx)/W, 0.5 − (z − cz)/D). */
  xform: Vector4;
  /** One texel in uv (1/texture width, 1/texture height). */
  texel: Vector2;
}

/** Long side of the height map (texels); the short side follows the terrain's aspect (square texels). */
const LONG = { high: 4096, medium: 2048, low: 2048 } as const;

const VERT = /* glsl */`
varying float vY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vY = w.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// Stored as y + HEIGHT_OFFSET so the cleared value 0 reads as "very deep" (open sea).
export const HEIGHT_OFFSET = 100;
const FRAG = /* glsl */`
varying float vY;
void main() { gl_FragColor = vec4(vY + ${HEIGHT_OFFSET.toFixed(1)}, 0.0, 0.0, 1.0); }`;

/** Render meshes flagged `userData.heightmap` under `group` into a height texture. Restores the
 *  renderer state, the group's parent and every mesh's visibility even if the render throws. */
export function renderHeightMap(ctx: WorldCtx, group: Group): HeightMap {
  const { renderer } = ctx.app;
  const box = new Box3();
  const hidden: Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof Mesh && !o.userData.heightmap && o.visible) {
      hidden.push(o);
    } else if (o instanceof Mesh) box.expandByObject(o);
  });
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const W = Math.max(1, box.max.x - box.min.x), D = Math.max(1, box.max.z - box.min.z);
  // Single-channel half floats when they are renderable (4× less memory), else RGBA; at most 2048 then.
  const red = renderer.extensions.has('EXT_color_buffer_float');
  const long = red ? LONG[ctx.quality] : 2048;
  const tw = W >= D ? long : Math.max(256, Math.round((long * W) / D));
  const th = W >= D ? Math.max(256, Math.round((long * D) / W)) : long;
  const cam = new OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 1, 2000);
  cam.position.set(cx, 800, cz);
  cam.up.set(0, 0, -1);
  cam.lookAt(cx, 0, cz);
  cam.updateMatrixWorld();
  const target = ctx.own(new WebGLRenderTarget(tw, th, {
    type: HalfFloatType, format: red ? RedFormat : RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true,
  }));
  const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG });
  const scene = new Scene();
  scene.overrideMaterial = mat;
  const parent = group.parent;
  const prevTarget = renderer.getRenderTarget();
  const prevAlpha = renderer.getClearAlpha();
  const prevColor = renderer.getClearColor(new Color());
  try {
    for (const o of hidden) o.visible = false;
    scene.add(group);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
    scene.remove(group);
    if (parent) parent.add(group);
    mat.dispose();
    for (const o of hidden) o.visible = true;
  }
  return { texture: target.texture, xform: new Vector4(cx, cz, 1 / W, 1 / D), texel: new Vector2(1 / tw, 1 / th) };
}
