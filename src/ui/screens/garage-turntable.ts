// Garage turntable: one small WebGLRenderer showing a bike from the bikes unit (createBike), slowly
// spinning (drag to turn). Falls back to the core stub bike, then to a flat SVG if WebGL/models fail.
import {
  CircleGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import type { AppContext } from '../../core/contracts';
import type { BikeId } from '../../core/types';
import type { BikeModel, CreateBike } from '../../actors/bikes/types';

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

export class Turntable {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.05, 60);
  private readonly pivot = new Group();
  private readonly floor: Mesh<CircleGeometry, MeshBasicMaterial>;
  private factories: CreateBike[] | null = null;
  private bike: BikeModel | null = null;
  private want: BikeId | null = null;
  private angle = 0.75;
  private time = 0;
  private dragX: number | null = null;
  private disposed = false;
  private frames = 0;

  constructor(private readonly app: AppContext, private readonly width: number, private readonly height: number, private readonly onFail: () => void) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'br-gar-canvas';
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
    } catch (err) {
      console.error('[ui] garage turntable: WebGL unavailable', err);
    }
    this.camera.aspect = width / height;
    this.camera.position.set(1.62, 0.92, 1.78);
    this.camera.lookAt(0, 0.5, 0);
    this.camera.updateProjectionMatrix();
    const key = new DirectionalLight('#ffffff', 2.6);
    key.position.set(3, 5, 4);
    const rim = new DirectionalLight('#9fd8ff', 1.6);
    rim.position.set(-3, 2.5, -4);
    this.floor = new Mesh(new CircleGeometry(0.95, 48), new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.002;
    this.scene.add(new HemisphereLight('#ffffff', '#5a3038', 1.5), key, rim, this.floor, this.pivot);
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
    this.bike.root.position.set(0, 0, 0);
    this.pivot.add(this.bike.root);
  }

  update(dt: number): void {
    if (this.disposed || !this.renderer) return;
    this.time += dt;
    this.fitPixels();
    if (this.dragX === null) this.angle += dt * 0.55;
    this.pivot.rotation.y = this.angle;
    this.bike?.update(dt, 3.2, Math.sin(this.time * 1.3) * 0.18);
    this.renderer.render(this.scene, this.camera);
  }

  /** The stage is CSS-scaled: match the backing store to the on-screen size so 1440p stays crisp. */
  private fitPixels(): void {
    if (!this.renderer || ++this.frames % 30 !== 1) return;
    const shown = this.canvas.getBoundingClientRect().width;
    const ratio = Math.min(3, Math.max(0.5, (window.devicePixelRatio || 1) * (shown / this.width)));
    if (Math.abs(ratio - this.renderer.getPixelRatio()) < 0.05) return;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.width, this.height, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.bike?.dispose();
    this.bike = null;
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
