// Debug spectator cameras (critics/screenshots): chase any rider, or an aerial view over the pack.
import { Vector3 } from 'three';
import type { Session } from '../../core/contracts';

export type SpectateTarget = number | 'aerial' | 'side' | null;

export function createSpectator(session: Session): (target: SpectateTarget) => void {
  const { track } = session;
  const pos = new Vector3(), look = new Vector3();
  let target: SpectateTarget = null;
  let installed = false;

  const install = (): void => {
    installed = true;
    session.app.rig.override((cam) => {
      if (target === null) { installed = false; return false; }
      const p = session.player;
      if (target === 'aerial') {
        track.toWorld(p.s - 14, p.x * 0.5, 15, pos);
        track.toWorld(p.s + 22, p.x * 0.5, 0, look);
      } else if (target === 'side') {
        track.toWorld(p.s + 2, -16, 5, pos);
        track.toWorld(p.s + 4, 0, 0.8, look);
      } else {
        const r = session.rider(target) ?? p;
        track.toWorld(r.s - 5.2, r.x * 0.85, 2.2, pos);
        track.toWorld(r.s + 9, r.x * 0.7, 1, look);
      }
      cam.position.copy(pos);
      cam.lookAt(look);
      return true;
    }, 0.2);
  };

  return (t) => {
    target = t;
    if (t !== null && !installed) install();
  };
}
