// Planar mirror for the wet city road: reflects the camera about the road plane under it, renders only
// the REFLECT_LAYER (neon, screens, lit windows, lamps) of the track's branch into a small HDR target
// with an oblique near plane (nothing below the road leaks in), and exposes the projective texture matrix.
import {
  Color, HalfFloatType, LinearFilter, Matrix4, PerspectiveCamera, Plane, Vector2, Vector3, Vector4, WebGLRenderTarget,
  type Camera, type Light, type Object3D, type Scene, type WebGLRenderer,
} from 'three';

const MAX_H = 720;

export class RoadMirror {
  readonly target: WebGLRenderTarget;
  readonly textureMatrix = new Matrix4();
  /** Plane used for the last render (world point + normal), for fading other road levels. */
  readonly planePoint = new Vector3();
  readonly planeNormal = new Vector3(0, 1, 0);
  private readonly cam = new PerspectiveCamera();
  private readonly size = new Vector2();
  private readonly v = { cam: new Vector3(), view: new Vector3(), target: new Vector3(), look: new Vector3(), rot: new Matrix4(), plane: new Plane(), clip: new Vector4(), q: new Vector4() };
  private readonly clear = new Color();

  private readonly hidden: Object3D[] = [];

  /** `keep` = the track group (the only branch with reflected meshes). */
  constructor(layer: number, private readonly scale: number, private readonly keep: Object3D) {
    this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true });
    this.target.texture.name = 'city.wetMirror';
    this.target.texture.generateMipmaps = false;
    this.cam.layers.set(layer);
  }

  private fit(renderer: WebGLRenderer): void {
    renderer.getDrawingBufferSize(this.size);
    // Scale of the drawing buffer, capped at MAX_H rows (dpr 2 would otherwise quadruple the cost).
    const k = Math.min(this.scale, MAX_H / Math.max(1, this.size.y));
    const w = Math.max(64, Math.round(this.size.x * k)), h = Math.max(36, Math.round(this.size.y * k));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
  }

  /** Render the mirrored view of `camera` about the plane (point, normal). False when skipped. */
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, point: Vector3, normal: Vector3): boolean {
    if (!(camera instanceof PerspectiveCamera)) return false;
    const { view, target, look, rot, plane, clip, q } = this.v;
    camera.updateMatrixWorld();
    const camPos = this.v.cam.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(point, camPos);
    if (view.dot(normal) > 0) return false;            // camera under the road
    this.planePoint.copy(point);
    this.planeNormal.copy(normal);
    view.reflect(normal).negate().add(point);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(point, look).reflect(normal).negate().add(point);
    const cam = this.cam;
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    cam.lookAt(target);
    cam.far = camera.far;
    cam.near = camera.near;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // Oblique near plane = the road plane (Lengyel), so geometry below the road is clipped away.
    plane.setFromNormalAndCoplanarPoint(normal, point).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + (e[8] ?? 0)) / (e[0] ?? 1), (Math.sign(clip.y) + (e[9] ?? 0)) / (e[5] ?? 1), -1, (1 + (e[10] ?? 0)) / (e[14] ?? 1));
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - 0.003; e[14] = clip.w;
    this.fit(renderer);
    // Nested render: keep the outer pass's target, clear colour, background and shadow maps.
    const prevTarget = renderer.getRenderTarget(), prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clear);
    const prevShadow = renderer.shadowMap.autoUpdate, prevBg = scene.background;
    renderer.shadowMap.autoUpdate = false;
    scene.background = null;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    // Accumulate stats into the outer frame instead of resetting them mid-frame.
    const prevReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    const hidden = this.prune(scene);
    renderer.render(scene, cam);
    for (const o of hidden) o.visible = true;
    renderer.info.autoReset = prevReset;
    scene.background = prevBg;
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setClearColor(this.clear, prevAlpha);
    renderer.setRenderTarget(prevTarget);
    return true;
  }

  /**
   * Hide every top-level branch except the track's (and the lights, so the materials keep their lit
   * program): only track meshes carry REFLECT_LAYER, and riders / fx / UI need not be traversed,
   * culled and sorted again for the nested pass. Returns what to unhide.
   */
  private prune(scene: Scene): Object3D[] {
    let keep: Object3D | null = this.keep;
    while (keep && keep.parent && keep.parent !== scene) keep = keep.parent;
    this.hidden.length = 0;
    for (const o of scene.children) {
      if (o === keep || !o.visible || (o as Light).isLight) continue;
      o.visible = false;
      this.hidden.push(o);
    }
    return this.hidden;
  }

  dispose(): void {
    this.target.dispose();
  }
}
