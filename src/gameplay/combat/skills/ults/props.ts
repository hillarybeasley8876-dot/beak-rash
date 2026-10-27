// Geometries the shared ults draw (SPEC §24, job r6-skills-meme): built once at session start by the
// PropLibrary, so no cast builds geometry mid-race. Keys are prefixed with the folder: 'ult:'.
import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, type BufferGeometry } from 'three';
import { PartBuilder } from '../../meshes/build';

export const PROPS = {
  // The meteor: a rocky lump with a fiery tail.
  'ult:meteor': () => new PartBuilder()
    .add(new IcosahedronGeometry(0.55, 0), '#6b4a3a', [0, 0, 0], [0.4, 0.7, 0.2])
    .add(new IcosahedronGeometry(0.26, 0), '#8a6247', [0.3, 0.18, 0.16], [1.1, 0.2, 0.5])
    .add(new ConeGeometry(0.34, 1.5, 8), '#ff7a2a', [0, 0, -0.95], [-Math.PI / 2, 0, 0])
    .build(),
  // The storm's cloud cover: a wide dark lid.
  'ult:storm': () => new PartBuilder()
    .add(new SphereGeometry(1, 14, 10), '#3a4358', [0, 0, 0], [0, 0, 0], [1.5, 0.55, 1.1])
    .add(new SphereGeometry(0.7, 12, 8), '#4b5670', [0.9, -0.1, 0.2], [0, 0, 0], [1.2, 0.6, 1])
    .add(new SphereGeometry(0.6, 12, 8), '#2f3749', [-1.05, -0.12, -0.15], [0, 0, 0], [1.2, 0.6, 1])
    .build(),
  // The thunderstorm's rain shaft under the cloud.
  'ult:rain': () => new PartBuilder()
    .add(new CylinderGeometry(0.55, 0.85, 1, 10, 1, true), '#5f7fa8', [0, 0, 0], [0, 0, 0], [1, 1, 1])
    .build(),
} satisfies Record<string, () => BufferGeometry>;
