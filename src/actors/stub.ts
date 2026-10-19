// STUB kept by core for isolation tests (?stub=...) and as load fallback. The actors unit owns index.ts: coloured capsule riders on box bikes.
// Contract: createRiderView(app, character, bike, opts) → RiderView (core/contracts.ts).
// Models face -Z (forward), +Y up, +X right; origin = road contact point under the saddle.
import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshLambertMaterial, Quaternion, TorusGeometry, Vector3 } from 'three';
import { ROSTER } from '../data/roster';
import type { AppContext, RiderView, RiderViewOpts } from '../core/contracts';
import type { BikeId, CharacterId } from '../core/types';

export function createRiderView(
  app: AppContext, character: CharacterId, bike: BikeId, opts: RiderViewOpts,
): RiderView {
  void app; void bike; void opts;
  const def = ROSTER[character];
  const root = new Group();
  root.name = `rider:${character}`;
  const bodyMat = new MeshLambertMaterial({ color: def.colors.primary });
  const body = new Mesh(new CapsuleGeometry(0.32, 0.6, 6, 12), bodyMat);
  body.position.set(0, 1.45, 0.1);
  body.rotation.x = -0.4;
  const head = new Mesh(new CapsuleGeometry(0.18, 0.1, 4, 10), new MeshLambertMaterial({ color: def.colors.secondary }));
  head.position.set(0, 2.05, -0.35);
  const frame = new Mesh(new BoxGeometry(0.08, 0.5, 1.2), new MeshLambertMaterial({ color: def.colors.accent }));
  frame.position.set(0, 0.7, 0);
  const wheelGeo = new TorusGeometry(0.34, 0.05, 8, 20);
  const wheelMat = new MeshLambertMaterial({ color: '#222' });
  const wf = new Mesh(wheelGeo, wheelMat), wr = new Mesh(wheelGeo, wheelMat);
  wf.rotation.y = wr.rotation.y = Math.PI / 2;
  wf.position.set(0, 0.34, -0.55);
  wr.position.set(0, 0.34, 0.55);
  root.add(body, head, frame, wf, wr);
  const tmp = new Vector3();
  return {
    root,
    update(state, pos: Vector3, quat: Quaternion, dtSim) {
      root.position.copy(pos);
      root.quaternion.copy(quat);
      const spin = (state.speed * dtSim) / 0.34;
      wf.rotation.x -= spin;
      wr.rotation.x -= spin;
      root.visible = state.mode !== 'crashed' || Math.floor(state.modeTime * 10) % 2 === 0;
    },
    cue() {},
    setWeapon() {},
    anchor(name, out) {
      const local = name === 'head' || name === 'beak' ? head.position : body.position;
      return out.copy(local).applyMatrix4(root.matrixWorld);
    },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      void tmp;
    },
  };
}
