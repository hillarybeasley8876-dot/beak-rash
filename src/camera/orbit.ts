// Menu camera when no race is loaded: a slow, slightly bobbing orbit (the UI draws over it).
import { Vector3, type PerspectiveCamera } from 'three';

export class MenuOrbit {
  private angle = 0.6;
  private target = new Vector3(0, 1.4, 0);

  update(cam: PerspectiveCamera, dtReal: number, realTime: number): void {
    this.angle += dtReal * 0.11;
    const radius = 15 + Math.sin(realTime * 0.17) * 1.5;
    cam.position.set(Math.sin(this.angle) * radius, 5.2 + Math.sin(realTime * 0.23) * 0.8, Math.cos(this.angle) * radius);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    if (cam.fov !== 50) {
      cam.fov = 50;
      cam.updateProjectionMatrix();
    }
  }
}
