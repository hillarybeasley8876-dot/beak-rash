// STUB (sim unit replaces this file with the real chase camera): follows the player from behind.
// Contract: createCameraRig(app) → CameraRig (core/contracts.ts).
import { Quaternion, Vector3 } from 'three';
import type { AppContext, CameraOverride, CameraRig, Session } from '../core/contracts';

export function createCameraRig(app: AppContext): CameraRig {
  const camera = app.camera;
  let session: Session | null = null;
  let override: CameraOverride | null = null;
  const pos = new Vector3(), quat = new Quaternion(), back = new Vector3(), target = new Vector3();
  camera.position.set(0, 8, 20);
  camera.lookAt(0, 0, 0);
  return {
    camera,
    mode: 'chase',
    attach(s) {
      session = s;
    },
    update(dtReal) {
      if (override) {
        if (!override(camera, dtReal)) override = null;
        return;
      }
      if (!session) {
        camera.position.set(Math.sin(app.clock.realTime * 0.1) * 30, 12, Math.cos(app.clock.realTime * 0.1) * 30);
        camera.lookAt(0, 0, 0);
        return;
      }
      const p = session.player;
      session.physics.pose(p, pos, quat);
      const fr = session.track.frameAt(p.s);
      back.set(-fr.tangent.x, 0, -fr.tangent.z).normalize();
      camera.position.copy(pos).addScaledVector(back, 5).add(new Vector3(0, 2.2, 0));
      session.track.toWorld(p.s + 8, p.x * 0.7, 1, target);
      camera.lookAt(target);
    },
    shake() {},
    kick() {},
    override(fn) {
      override = fn;
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
  };
}
