// Subject mask for the KO look: the cast (victims, attacker, bystanders) is drawn again with a role id
// and its view depth into a small RG target, so the composite can keep the victim in its own colours with
// a sticker rim and push everyone else into the backdrop. Objects join layer 30 only for this one call.
import {
  HalfFloatType, NearestFilter, RGFormat, ShaderMaterial, WebGLRenderTarget, Color, DoubleSide,
  type Camera, type Material, type Mesh, type Object3D, type Scene, type Texture, type WebGLRenderer,
} from 'three';

export type CastRole = 'victim' | 'attacker' | 'ghost';

/** Role ids written to the mask's G channel (composite: > .83 victim, > .5 attacker, > .16 ghost). */
const ROLE_ID: Record<CastRole, number> = { victim: 1, attacker: 0.66, ghost: 0.33 };
const MASK_LAYER = 30;
/** The mask never needs more than ~1100 rows (rim taps are scaled to its texel size). */
const MAX_ROWS = 1100;

const VERT = /* glsl */ `
#include <common>
#include <batching_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
varying float vDepth;
void main() {
  #include <batching_vertex>
  #include <skinbase_vertex>
  #include <morphinstance_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vDepth = -mvPosition.z;
}
`;

const FRAG = /* glsl */ `
uniform float uRole;
varying float vDepth;
void main() {
  gl_FragColor = vec4(vDepth, uRole, 0.0, 1.0);
}
`;

/** Solid parts only: blob shadows, glows, auras and trails (transparent, no depth) stay out of the mask. */
function solid(m: Material | Material[]): boolean {
  const first = Array.isArray(m) ? m[0] : m;
  return !!first && first.visible && !(first.transparent && !first.depthWrite);
}

export class SubjectMask {
  private readonly rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, format: RGFormat, minFilter: NearestFilter, magFilter: NearestFilter });
  private readonly material: ShaderMaterial;
  private readonly roles = new Map<Object3D, number>();
  private readonly tagged: Object3D[] = [];
  /** frustumCulled of each tagged object (culling is off for the mask draw so warm-up compiles off-screen riders too). */
  private readonly culled: boolean[] = [];
  private readonly clear = new Color();

  constructor() {
    this.rt.texture.name = 'fx.subjectMask';
    this.material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uRole: { value: 0 } }, side: DoubleSide });
    this.material.name = 'fx.subjectMask';
    // One draw per cast mesh: its role id goes up just before the draw.
    this.material.onBeforeRender = (_r, _s, _c, _g, object) => {
      const role = this.roles.get(object) ?? 0;
      const u = this.material.uniforms.uRole as { value: number };
      if (u.value !== role) {
        u.value = role;
        this.material.uniformsNeedUpdate = true;
      }
    };
  }

  get texture(): Texture {
    return this.rt.texture;
  }

  setSize(width: number, height: number): void {
    const k = Math.min(1, MAX_ROWS / Math.max(1, height));
    this.rt.setSize(Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)));
  }

  /** Draw the cast into the mask (R = view depth, G = role id); scene, camera and renderer state are restored. */
  render(r: WebGLRenderer, scene: Scene, camera: Camera, cast: ReadonlyMap<Object3D, CastRole>): void {
    for (const [root, role] of cast) this.tag(root, ROLE_ID[role]);
    const prev = {
      target: r.getRenderTarget(), alpha: r.getClearAlpha(), override: scene.overrideMaterial, background: scene.background,
      auto: scene.matrixWorldAutoUpdate, layers: camera.layers.mask,
    };
    r.getClearColor(this.clear);
    try {
      scene.overrideMaterial = this.material;
      scene.background = null;
      scene.matrixWorldAutoUpdate = false;
      camera.layers.set(MASK_LAYER);
      r.setRenderTarget(this.rt);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, false);
      r.render(scene, camera);
    } finally {
      scene.overrideMaterial = prev.override;
      scene.background = prev.background;
      scene.matrixWorldAutoUpdate = prev.auto;
      camera.layers.mask = prev.layers;
      r.setClearColor(this.clear, prev.alpha);
      r.setRenderTarget(prev.target);
      this.untag();
    }
  }

  private tag(root: Object3D, role: number): void {
    root.traverseVisible((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !solid(mesh.material) || this.roles.has(o)) return;
      this.roles.set(o, role);
      o.layers.enable(MASK_LAYER);
      this.tagged.push(o);
      this.culled.push(o.frustumCulled);
      o.frustumCulled = false;
    });
  }

  private untag(): void {
    this.tagged.forEach((o, i) => {
      o.layers.disable(MASK_LAYER);
      o.frustumCulled = this.culled[i] ?? true;
    });
    this.tagged.length = 0;
    this.culled.length = 0;
    this.roles.clear();
  }

  dispose(): void {
    this.rt.dispose();
    this.material.dispose();
  }
}
