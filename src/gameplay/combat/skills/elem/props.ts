// Geometries this folder's skills draw (built once at session start by the PropLibrary: no cast builds geometry
// mid-race). Key → maker; read them with ctx.lib.get('<key>'). Keys must be unique across all prop tables.
import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { PartBuilder } from '../../meshes/build';

const HALF_PI = Math.PI / 2;

/** The ice lance: a pale blue spike with a white tip, pointing forward (−Z, the way the models face). */
function iceLanceGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(new ConeGeometry(0.18, 1.3, 8), '#9fdcff', [0, 0, 0.15], [-HALF_PI, 0, 0])
    .add(new ConeGeometry(0.07, 0.55, 6), '#f2fbff', [0, 0, -0.62], [-HALF_PI, 0, 0])
    .add(new BoxGeometry(0.06, 0.34, 0.34), '#7cc6ee', [0, 0, 0.4], [0, 0.7, 0])
    .add(new BoxGeometry(0.05, 0.26, 0.26), '#bde9ff', [0.16, 0.1, 0.3], [0, -0.5, 0])
    .build();
}

/** The big snowball: a white ball with a cold blue sheen. */
function snowballGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(new SphereGeometry(0.44, 16, 12), '#f6fbff')
    .add(new SphereGeometry(0.35, 12, 10), '#cde9ff', [0.16, 0.13, -0.13])
    .build();
}

/** The 二踢脚: a little red firecracker with a gold band, lying along the road. */
function crackerGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(0.075, 0.075, 0.36, 12), '#d92b2b', [0, 0, 0], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.079, 0.079, 0.07, 12), '#f2c14e', [0, 0, 0.03], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.016, 0.016, 0.14, 6), '#c8b48a', [0, 0, -0.23], [HALF_PI, 0, 0])
    .build();
}

/** A patch of fire left on the road (the rocket's line): an orange flame with a hot core. */
function flameGeometry(): BufferGeometry {
  return new PartBuilder()
    .add(new ConeGeometry(0.16, 0.5, 7), '#ff7a18', [0, 0.25, 0])
    .add(new ConeGeometry(0.09, 0.3, 6), '#ffd24a', [0, 0.15, 0])
    .build();
}

export const PROPS = {
  'elem:icelance': iceLanceGeometry,
  'elem:snowball': snowballGeometry,
  'elem:cracker': crackerGeometry,
  'elem:flame': flameGeometry,
} satisfies Record<string, () => BufferGeometry>;
