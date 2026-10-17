// Pickup props (SPEC §7): 小鱼干 coin, fresh fish (+HP), weapon crate, 能量鱼罐头 (+SP), plus the
// ground shadow blob. Models face −Z, origin at their centre; sizes are readable from the chase cam.
import {
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, type BufferGeometry,
} from 'three';
import { PartBuilder } from './build';

const HALF_PI = Math.PI / 2;
const sphere = (): SphereGeometry => new SphereGeometry(1, 16, 12);

/** Dried little fish: golden, curled, with a tail fan and a black eye each side. */
export function coinGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(sphere(), '#f0a52e', [0, 0, 0], [0, 0, 0], [0.1, 0.12, 0.27])
    .add(sphere(), '#ffd779', [0, -0.045, -0.02], [0, 0, 0], [0.085, 0.06, 0.22])
    .add(new ConeGeometry(0.15, 0.2, 4), '#d9861c', [0, 0.01, 0.33], [-HALF_PI, 0, 0], [0.35, 1, 1])
    .add(new ConeGeometry(0.06, 0.12, 4), '#d9861c', [0, 0.13, 0.02], [0, 0, 0], [0.3, 1, 1])
    .add(sphere(), '#ffffff', [0.085, 0.035, -0.17], [0, 0, 0], [0.032, 0.032, 0.032])
    .add(sphere(), '#ffffff', [-0.085, 0.035, -0.17], [0, 0, 0], [0.032, 0.032, 0.032])
    .add(sphere(), '#111111', [0.1, 0.035, -0.175], [0, 0, 0], [0.018, 0.018, 0.018])
    .add(sphere(), '#111111', [-0.1, 0.035, -0.175], [0, 0, 0], [0.018, 0.018, 0.018])
    .build();
}

/** Fat blue fish with a red medic cross floating above it (+25 HP). */
export function fishGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(sphere(), '#3e8ede', [0, 0, 0], [0, 0, 0], [0.17, 0.21, 0.4])
    .add(sphere(), '#f4f7fb', [0, -0.08, -0.03], [0, 0, 0], [0.15, 0.12, 0.33])
    .add(new ConeGeometry(0.22, 0.3, 4), '#ff7a45', [0, 0.02, 0.48], [-HALF_PI, 0, 0], [0.3, 1, 1])
    .add(new ConeGeometry(0.1, 0.18, 4), '#ff7a45', [0, 0.22, 0.05], [0, 0, 0], [0.3, 1, 1])
    .add(sphere(), '#ffffff', [0.12, 0.07, -0.25], [0, 0, 0], [0.055, 0.055, 0.055])
    .add(sphere(), '#ffffff', [-0.12, 0.07, -0.25], [0, 0, 0], [0.055, 0.055, 0.055])
    .add(sphere(), '#111111', [0.16, 0.07, -0.27], [0, 0, 0], [0.03, 0.03, 0.03])
    .add(sphere(), '#111111', [-0.16, 0.07, -0.27], [0, 0, 0], [0.03, 0.03, 0.03])
    .add(new BoxGeometry(0.34, 0.11, 0.11), '#e5191c', [0, 0.5, 0])
    .add(new BoxGeometry(0.11, 0.34, 0.11), '#e5191c', [0, 0.5, 0])
    .build();
}

/** Wooden weapon crate: planks, dark edge frame, a red P5 diamond on every side. */
export function crateGeometry(): BufferGeometry {
  const b = new PartBuilder().add(new BoxGeometry(0.62, 0.62, 0.62), '#c98a4b');
  const e = 0.33;
  for (const [x, z] of [[e, e], [e, -e], [-e, e], [-e, -e]] as const) {
    b.add(new BoxGeometry(0.09, 0.7, 0.09), '#6e4320', [x, 0, z]);
    b.add(new BoxGeometry(0.7, 0.09, 0.09), '#6e4320', [0, x, z]);
    b.add(new BoxGeometry(0.09, 0.09, 0.7), '#6e4320', [x, z, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const r = 0.315;
    b.add(new BoxGeometry(0.26, 0.26, 0.03), '#e5191c', [Math.sin(a) * r, 0, Math.cos(a) * r], [0, a, Math.PI / 4]);
    b.add(new BoxGeometry(0.1, 0.1, 0.035), '#ffffff', [Math.sin(a) * (r + 0.004), 0, Math.cos(a) * (r + 0.004)], [0, a, Math.PI / 4]);
  }
  b.add(new BoxGeometry(0.26, 0.03, 0.26), '#e5191c', [0, 0.315, 0], [0, Math.PI / 4, 0]);
  return b.build();
}

/** 能量鱼罐头: SP-yellow can, black band with a red fish, silver rims and pull tab. */
export function canGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(0.2, 0.2, 0.42, 20), '#ffe600')
    .add(new CylinderGeometry(0.206, 0.206, 0.15, 20), '#0b0b0f')
    .add(sphere(), '#e5191c', [0, 0, -0.205], [0, 0, 0], [0.09, 0.045, 0.02])
    .add(sphere(), '#e5191c', [0, 0, 0.205], [0, 0, 0], [0.09, 0.045, 0.02])
    .add(new ConeGeometry(0.045, 0.06, 3), '#e5191c', [0.1, 0, -0.205], [0, 0, -HALF_PI], [1, 1, 0.3])
    .add(new TorusGeometry(0.19, 0.025, 6, 24), '#c9d1d9', [0, 0.21, 0], [HALF_PI, 0, 0])
    .add(new TorusGeometry(0.19, 0.025, 6, 24), '#c9d1d9', [0, -0.21, 0], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.19, 0.19, 0.02, 20), '#dfe5ea', [0, 0.215, 0])
    .add(new TorusGeometry(0.045, 0.012, 5, 12), '#9aa4ad', [0.05, 0.232, 0], [HALF_PI, 0, 0])
    .build();
}

/** Soft round shadow under hovering pickups (flat, faces +Y). */
export function shadowGeometry(): BufferGeometry {
  const g = new CircleGeometry(0.42, 18);
  g.rotateX(-HALF_PI);
  return g;
}
