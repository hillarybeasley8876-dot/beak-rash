// Geometries this folder's skills draw (built once at session start by the PropLibrary: no cast builds geometry
// mid-race). Key → maker; read them with ctx.lib.get('<key>'). Keys must be unique across all prop tables.
import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { PartBuilder } from '../../meshes/build';
import { saltfishGeometry } from '../../meshes/weapon-props';

const HALF_PI = Math.PI / 2;

/** The boomerang: a dried salted fish (the same fish the pelican spits, at throw size). */
function fish(): BufferGeometry {
  return saltfishGeometry(1);
}

/** The pie: a golden crust with a creamy top and a cherry in the middle. */
function pie(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(0.5, 0.44, 0.13, 22), '#d99a3f', [0, 0, 0])
    .add(new CylinderGeometry(0.44, 0.44, 0.03, 22), '#f0d9a4', [0, 0.07, 0])
    .add(new SphereGeometry(0.09, 12, 8), '#c0392b', [0, 0.1, 0])
    .build();
}

/** A little yellow duck: body, head, beak and two eyes. */
function duck(): BufferGeometry {
  const b = new PartBuilder()
    .add(new SphereGeometry(1, 14, 10), '#f7d03c', [0, 0.22, 0], [0, 0, 0], [0.26, 0.22, 0.32])
    .add(new SphereGeometry(1, 14, 10), '#f7d03c', [0, 0.44, -0.16], [0, 0, 0], [0.15, 0.16, 0.15])
    .add(new ConeGeometry(0.055, 0.17, 6), '#ef7d26', [0, 0.42, -0.32], [-HALF_PI, 0, 0]);
  for (const sx of [1, -1]) b.add(new SphereGeometry(0.028, 8, 6), '#20202a', [sx * 0.1, 0.5, -0.24]);
  return b.build();
}

/** The pop-up ad: a bright panel with a fake close button. */
function ad(): BufferGeometry {
  return new PartBuilder()
    .add(new BoxGeometry(1.1, 1.5, 0.04), '#ffcf3f', [0, 0, 0])
    .add(new BoxGeometry(0.86, 0.5, 0.02), '#ffffff', [0, 0.28, 0.03])
    .add(new BoxGeometry(0.86, 0.12, 0.02), '#ff1e3c', [0, -0.12, 0.03])
    .add(new BoxGeometry(0.26, 0.14, 0.05), '#20202a', [0.34, -0.6, 0.04])
    .build();
}

/** A little music note for the war song. */
function note(): BufferGeometry {
  return new PartBuilder()
    .add(new BoxGeometry(0.07, 0.36, 0.05), '#f7d03c', [0.05, 0.14, 0])
    .add(new SphereGeometry(0.1, 10, 8), '#f7d03c', [-0.05, -0.08, 0], [0, 0, 0], [1, 0.8, 0.55])
    .build();
}

export const PROPS = {
  'gag:fish': fish,
  'gag:pie': pie,
  'gag:duck': duck,
  'gag:ad': ad,
  'gag:note': note,
} satisfies Record<string, () => BufferGeometry>;
