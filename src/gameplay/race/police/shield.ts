// The 特警 squad's riot shield (SPEC §25): a simple toon box in front of the corgi. The corgi holds it
// with the left paw, so it rides a little to the side of the bike's centre line.
import { BoxGeometry, Group, Mesh } from 'three';
import { outline, toon } from '../../../render/toon';

export interface Shield {
  /** The shield mesh (added to the rider view's root). */
  readonly group: Group;
  dispose(): void;
}

const W = 0.95, H = 1.15, D = 0.09;

/** A blue riot shield with a white stripe — the squad's colours. */
export function createShield(): Shield {
  const group = new Group();
  group.name = 'race:police:shield';
  const plate = new Mesh(new BoxGeometry(W, H, D), toon('#2a5bff', { transparent: true, opacity: 0.92 }));
  plate.position.set(0, 1.02, -0.62);
  const stripe = new Mesh(new BoxGeometry(W * 0.8, 0.12, D + 0.02), toon('#f2f4ff'));
  stripe.position.set(0, 1.02, -0.62);
  outline(plate, 0.025);
  outline(stripe, 0.02);
  group.add(plate, stripe);
  return {
    group,
    dispose() {
      plate.geometry.dispose();
      stripe.geometry.dispose();
      group.removeFromParent();
    },
  };
}
