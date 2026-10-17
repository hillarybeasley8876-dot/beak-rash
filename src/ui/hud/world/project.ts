// World → screen projection for anchored overlays, plus rider anchor lookup with a track fallback.
import { Matrix4, Vector3, type PerspectiveCamera } from 'three';
import type { Session } from '../../../core/contracts';
import type { RiderState, Vec3Like } from '../../../core/types';

export interface ScreenPoint {
  x: number;        // CSS px
  y: number;
  depth: number;    // metres in front of the camera (≤ 0 = behind)
  onScreen: boolean;
}

export class Projector {
  private inv = new Matrix4();
  private v = new Vector3();
  /** Views whose anchor() threw once: use the track pose for them from then on (no log spam). */
  private broken = new WeakSet<object>();
  width = 1;
  height = 1;

  constructor(private camera: PerspectiveCamera) {}

  /** Call once per frame before projecting (camera moved during this frame's render). */
  begin(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.updateMatrixWorld();
    this.inv.copy(this.camera.matrixWorld).invert();
  }

  project(p: Vec3Like, out: ScreenPoint, margin = 0): ScreenPoint {
    const v = this.v.set(p.x, p.y, p.z).applyMatrix4(this.inv);
    out.depth = -v.z;
    if (out.depth <= this.camera.near) {
      out.onScreen = false;
      // Mirror behind-camera points so edge clamping still knows the side.
      out.x = v.x >= 0 ? this.width * 2 : -this.width;
      out.y = this.height * 2;
      return out;
    }
    v.applyMatrix4(this.camera.projectionMatrix);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (0.5 - v.y * 0.5) * this.height;
    out.onScreen = out.x >= -margin && out.x <= this.width + margin && out.y >= -margin && out.y <= this.height + margin;
    return out;
  }

  /** Point above a rider's head: the view's head anchor, or the track pose if the view lacks one. */
  riderHead(session: Session, r: RiderState, lift: number, out: Vector3): Vector3 {
    const view = session.views.get(r.id);
    if (view && !this.broken.has(view)) {
      try {
        view.anchor('head', out);
        if (Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z)) {
          out.y += lift;
          return out;
        }
      } catch (err) {
        this.broken.add(view);
        console.warn(`[ui-hud] view.anchor('head') failed for rider ${r.id}; using the track pose`, err);
      }
    }
    return session.track.toWorld(r.s, r.x, r.y + 2.1 + lift, out);
  }
}

export const newPoint = (): ScreenPoint => ({ x: 0, y: 0, depth: 0, onScreen: false });
