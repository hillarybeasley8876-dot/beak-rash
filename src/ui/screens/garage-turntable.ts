// Garage turntable: one small WebGLRenderer showing a bike from the bikes unit (createBike), clamped by
// its seatpost in the repair stand drawn in art/garage (the canvas and the art share the 1920×1080 stage,
// so the clamp lines up at every size; a small 3D jaw grips the post in front). It swings around a 3/4
// view (drag to turn), wheels turning slowly, with a soft contact shadow on the drawn floor. Bikes shorter
// than the road bike are shown larger (scaled about the clamp) so the showroom never looks empty. Falls
// back to the stub bike, then a flat SVG.
import {
  Box3, CanvasTexture, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene,
  Vector3, WebGLRenderer,
} from 'three';
import type { AppContext } from '../../core/contracts';
import type { BikeId } from '../../core/types';
import type { BikeModel, CreateBike } from '../../actors/bikes/types';
import { clampJaw } from './garage-clamp';

/** Stage geometry (px) shared with garage.css: canvas box, the drawn clamp head, the stand's scale. */
const SHOW_BOX = { left: 0, top: 160, width: 1180, height: 920 };
const CLAMP = { x: 815, y: 486 };
const PX_PER_M = 448;
const FLOOR_DROP = 0.98;        // m from the clamp down to the drawn floor
const CLAMP_BELOW_SADDLE = 0.12;
/** Display length (m) every bike is grown to (the road bike's): a kids' bike fills the stand like the rest. */
const SHOW_LENGTH = 1.39;
const MAX_GROW = 1.6;
const CAM_DIST = 5.2;
const CAM_ELEVATION = (12 * Math.PI) / 180;
/** Yaw: π/2 = side view, front to the left; larger turns the front towards the camera (never edge-on). */
const SWING_CENTER = Math.PI / 2 + 0.55;
const SWING_AMP = 0.5;
const SWING_SPEED = 0.55;
/** Wheel speed (m/s): slow enough that the bikes unit draws real spokes, not its speed-blur disc. */
const WHEEL_SPEED = 0.6;
/** Supersampling: 2× the on-screen pixels (thin spokes stop crawling), capped at ~8 MP of backing store. */
const SUPERSAMPLE = 2;
const MAX_RATIO = Math.sqrt(8e6 / (SHOW_BOX.width * SHOW_BOX.height));

async function loadFactories(app: AppContext): Promise<CreateBike[]> {
  const stubs = (app.params.get('stub') ?? '').split(',');
  const stub = (await import('../../actors/bikes/stub')).createBike;
  if (stubs.includes('bikes') || stubs.includes('actors') || stubs.includes('all')) return [stub];
  try {
    const real = (await import('../../actors/bikes')).createBike;
    return real === stub ? [stub] : [real, stub];
  } catch (err) {
    console.error('[ui] garage: bikes unit failed to load, using the stub bike', err);
    return [stub];
  }
}

/** Soft radial contact shadow (canvas texture) for the floor under the hanging bike. */
function shadowMesh(): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const mat = new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

export class Turntable {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.05, 60);
  private readonly pivot = new Group();
  private readonly shadow = shadowMesh();
  private readonly jaw = clampJaw();
  private factories: CreateBike[] | null = null;
  private bike: BikeModel | null = null;
  private want: BikeId | null = null;
  private angle = SWING_CENTER;
  private time = 0;
  private dragX: number | null = null;
  private disposed = false;
  private frames = 0;

  constructor(private readonly app: AppContext, private readonly onFail: () => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'br-gar-canvas';
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(1.5);
      this.renderer.setSize(SHOW_BOX.width, SHOW_BOX.height, false);
    } catch (err) {
      console.error('[ui] garage turntable: WebGL unavailable', err);
    }
    this.aimCamera();
    const key = new DirectionalLight('#ffffff', 2.6);
    key.position.set(3, 5, 4);
    const rim = new DirectionalLight('#9fd8ff', 1.6);
    rim.position.set(-3, 2.5, -4);
    this.scene.add(new HemisphereLight('#ffffff', '#5a3038', 1.5), key, rim, this.pivot);
    this.pivot.add(this.jaw.group);
    this.listenDrag();
    if (!this.renderer) {
      this.onFail();
      return;
    }
    loadFactories(app).then((f) => {
      this.factories = f;
      if (this.want) this.build(this.want);
    }).catch((err: unknown) => {
      console.error('[ui] garage: could not load any bike model', err);
      this.onFail();
    });
  }

  show(id: BikeId): void {
    if (id === this.want && this.bike) return;
    this.want = id;
    if (this.factories) this.build(id);
  }

  update(dt: number): void {
    if (this.disposed || !this.renderer) return;
    this.time += dt;
    this.fitPixels();
    if (this.dragX === null) {
      const target = SWING_CENTER + SWING_AMP * Math.sin(this.time * SWING_SPEED);
      this.angle += (target - this.angle) * Math.min(1, dt * 2.2);
    }
    this.pivot.rotation.y = this.angle;
    this.bike?.update(dt, WHEEL_SPEED, Math.sin(this.time * 1.3) * 0.18);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.bike?.dispose();
    this.bike = null;
    this.shadow.geometry.dispose();
    this.shadow.material.map?.dispose();
    this.shadow.material.dispose();
    this.jaw.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }

  /** Look at the clamp from above; a view offset puts it on the drawn clamp head at the stand's scale. */
  private aimCamera(): void {
    const { width: w, height: hgt } = SHOW_BOX;
    const cx = CLAMP.x - SHOW_BOX.left;
    const cy = CLAMP.y - SHOW_BOX.top;
    const fullW = 2 * Math.max(cx, w - cx);
    const fullH = 2 * Math.max(cy, hgt - cy);
    this.camera.fov = (2 * Math.atan(fullH / 2 / (PX_PER_M * CAM_DIST)) * 180) / Math.PI;
    this.camera.aspect = fullW / fullH;
    this.camera.position.set(0, CAM_DIST * Math.sin(CAM_ELEVATION), CAM_DIST * Math.cos(CAM_ELEVATION));
    this.camera.lookAt(0, 0, 0);
    this.camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, w, hgt);
    this.camera.updateProjectionMatrix();
  }

  private listenDrag(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragX = e.clientX;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragX === null) return;
      this.angle += (e.clientX - this.dragX) * 0.012;
      this.dragX = e.clientX;
    });
    this.canvas.addEventListener('pointerup', () => (this.dragX = null));
  }

  private build(id: BikeId): void {
    if (this.disposed) return;
    this.bike?.dispose();
    this.bike = null;
    for (const make of this.factories ?? []) {
      try {
        this.bike = make(id, { quality: this.app.quality });
        break;
      } catch (err) {
        console.error(`[ui] garage: createBike(${id}) failed`, err);
      }
    }
    if (!this.bike) {
      this.onFail();
      return;
    }
    this.mount(this.bike);
  }

  /** Hang the bike by its (rear) seatpost on the pivot = the drawn clamp; the shadow lies on the floor.
   * Short bikes grow about the clamp (never so much that the wheels reach the drawn floor). */
  private mount(bike: BikeModel): void {
    const root = bike.root;
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    root.updateMatrixWorld(true);
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    const seat = (bike.markers.stoker ?? bike.markers.saddle).getWorldPosition(new Vector3());
    const clampY = seat.y - CLAMP_BELOW_SADDLE;
    const fit = SHOW_LENGTH / Math.max(0.3, size.x, size.z);
    const k = Math.min(MAX_GROW, Math.max(1, fit), (FLOOR_DROP - 0.06) / Math.max(0.1, clampY));
    root.scale.setScalar(k);
    root.position.set(-seat.x * k, -clampY * k, -seat.z * k);
    this.pivot.add(root);
    const lift = Math.max(0, FLOOR_DROP - clampY * k);
    this.shadow.position.set(-seat.x * k, -FLOOR_DROP + 0.004, -seat.z * k);
    this.shadow.scale.set(0.75 * k, (bike.wheelbase + 2 * bike.wheelRadius + 0.35) * k, 1);
    this.shadow.material.opacity = Math.max(0.3, 0.95 - lift * 1.2);
    this.pivot.add(this.shadow);
  }

  /** The stage is CSS-scaled: supersample the on-screen size so spokes and outlines stay clean. */
  private fitPixels(): void {
    if (!this.renderer || ++this.frames % 30 !== 1) return;
    const shown = this.canvas.getBoundingClientRect().width;
    const onScreen = (window.devicePixelRatio || 1) * (shown / SHOW_BOX.width);
    const ratio = Math.min(MAX_RATIO, Math.max(1.5, SUPERSAMPLE * onScreen));
    if (Math.abs(ratio - this.renderer.getPixelRatio()) < 0.05) return;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(SHOW_BOX.width, SHOW_BOX.height, false);
  }
}
