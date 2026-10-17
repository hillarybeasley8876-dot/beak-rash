// STUB bike (core-owned fallback). The bikes sub-unit owns bikes/index.ts and replaces the re-export.
import { CylinderGeometry, Group, Mesh, Object3D, TorusGeometry, Vector3 } from 'three';
import { toon } from '../../render/toon';
import type { BikeId, Quality } from '../../core/types';
import type { BikeMarkers, BikeModel } from './types';

const R = 0.34;
const BASE = 1.02;

function tube(a: Vector3, b: Vector3, r: number, color: string): Mesh {
  const len = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(r, r, len, 8), toon(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function createBike(id: BikeId, opts: { quality: Quality; tint?: string }): BikeModel {
  void opts;
  const root = new Group();
  root.name = `bike:${id}`;
  const color = opts.tint ?? '#e5191c';
  const wheelGeo = new TorusGeometry(R, 0.045, 8, 24);
  const wheelR = new Mesh(wheelGeo, toon('#1b1b1f'));
  const wheelF = new Mesh(wheelGeo, toon('#1b1b1f'));
  wheelR.rotation.y = wheelF.rotation.y = Math.PI / 2;
  const hubR = new Object3D(); hubR.position.set(0, R, BASE / 2); hubR.add(wheelR);
  const bb = new Vector3(0, 0.3, 0.05), seat = new Vector3(0, 0.92, 0.26), head = new Vector3(0, 0.86, -0.36);
  root.add(hubR);
  root.add(tube(bb, seat, 0.025, color), tube(bb, head, 0.03, color), tube(seat, head, 0.025, color));
  root.add(tube(bb, new Vector3(0, R, BASE / 2), 0.02, color), tube(seat, new Vector3(0, R, BASE / 2), 0.02, color));
  const steer = new Object3D(); steer.position.copy(head); root.add(steer);
  const hubF = new Object3D(); hubF.position.set(0, R - head.y, -BASE / 2 - head.z); hubF.add(wheelF); steer.add(hubF);
  steer.add(tube(new Vector3(0, 0, 0), hubF.position.clone(), 0.022, color));
  const bar = tube(new Vector3(-0.24, 0.16, -0.05), new Vector3(0.24, 0.16, -0.05), 0.018, '#2a2a2a');
  steer.add(bar, tube(new Vector3(0, 0, 0), new Vector3(0, 0.16, -0.05), 0.022, '#2a2a2a'));
  const gripL = new Object3D(); gripL.position.set(-0.22, 0.16, -0.05); steer.add(gripL);
  const gripR = new Object3D(); gripR.position.set(0.22, 0.16, -0.05); steer.add(gripR);
  const saddle = new Object3D(); saddle.position.copy(seat).add(new Vector3(0, 0.05, 0)); root.add(saddle);
  const seatMesh = new Mesh(new CylinderGeometry(0.07, 0.05, 0.06, 10), toon('#222'));
  seatMesh.position.copy(seat).add(new Vector3(0, 0.03, 0));
  root.add(seatMesh);
  const crank = new Object3D(); crank.position.copy(bb); root.add(crank);
  const pedalL = new Object3D(), pedalR = new Object3D();
  const armL = new Object3D(), armR = new Object3D();
  armL.position.x = -0.09; armR.position.x = 0.09;
  pedalL.position.set(-0.04, -0.17, 0); pedalR.position.set(0.04, 0.17, 0);
  armL.add(pedalL); armR.add(pedalR); crank.add(armL, armR);
  const markers: BikeMarkers = { saddle, gripL, gripR, pedalL, pedalR };
  let crankAngle = 0;
  return {
    id, root, steer, markers, wheelRadius: R, wheelbase: BASE,
    get crankAngle() { return crankAngle; },
    update(dt, speed, steerAngle) {
      const spin = (speed * dt) / R;
      wheelR.rotation.x -= spin;
      wheelF.rotation.x -= spin;
      crankAngle = (crankAngle + spin / 2.6) % (Math.PI * 2);
      crank.rotation.x = -crankAngle;
      pedalL.rotation.x = pedalR.rotation.x = crankAngle;
      steer.rotation.y = -steerAngle;
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); });
    },
  };
}
