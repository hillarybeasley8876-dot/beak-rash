// Geometries the meme-roster skills draw (SPEC §24, job r6-skills-meme): built once at session start by the
// PropLibrary, so no cast builds geometry mid-race. Keys are prefixed with the folder: 'meme:'.
import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, type BufferGeometry,
} from 'three';
import { PartBuilder } from '../../meshes/build';

export const PROPS = {
  // A dropped banana peel: three yellow prongs around a brown stalk.
  'meme:peel': () => new PartBuilder()
    .add(new ConeGeometry(0.16, 0.5, 5), '#f6d63d', [0, 0.26, 0], [0, 0, 0], [1, 1, 0.45])
    .add(new ConeGeometry(0.16, 0.5, 5), '#f6d63d', [0.16, 0.24, 0.05], [0, 0, -0.5], [1, 1, 0.45])
    .add(new ConeGeometry(0.16, 0.5, 5), '#f6d63d', [-0.16, 0.24, 0.05], [0, 0, 0.5], [1, 1, 0.45])
    .add(new CylinderGeometry(0.07, 0.09, 0.16, 6), '#8a6a2a', [0, 0.08, 0])
    .build(),
  // The sad violin: a body, a neck and a bow.
  'meme:violin': () => new PartBuilder()
    .add(new SphereGeometry(0.22, 12, 8), '#c8763a', [0, 0, 0], [0, 0, 0], [1, 1.25, 0.4])
    .add(new BoxGeometry(0.09, 0.5, 0.05), '#5a3218', [0, 0.42, 0])
    .add(new BoxGeometry(0.14, 0.06, 0.04), '#3a2010', [0, 0.68, 0])
    .add(new BoxGeometry(0.03, 0.5, 0.03), '#f0e6c8', [0.04, 0.1, 0.06])
    .add(new BoxGeometry(0.03, 0.5, 0.03), '#f0e6c8', [-0.04, 0.1, 0.06])
    .add(new BoxGeometry(0.03, 0.44, 0.03), '#e0c070', [0.12, 0.16, 0.1], [0, 0, 0.3])
    .build(),
  // The bin pedro rummages in.
  'meme:bin': () => new PartBuilder()
    .add(new CylinderGeometry(0.34, 0.27, 0.66, 12), '#5c6672', [0, 0.33, 0])
    .add(new TorusGeometry(0.34, 0.035, 6, 16), '#39414b', [0, 0.66, 0], [Math.PI / 2, 0, 0])
    .add(new CylinderGeometry(0.3, 0.3, 0.05, 12), '#48505a', [0, 0.36, 0])
    .build(),
  // The missile pedro may find in the bin.
  'meme:can': () => new PartBuilder()
    .add(new CylinderGeometry(0.11, 0.11, 0.42, 10), '#c9cbd0', [0, 0, 0], [Math.PI / 2, 0, 0])
    .add(new ConeGeometry(0.11, 0.22, 10), '#e0563f', [0, 0, 0.3], [Math.PI / 2, 0, 0])
    .add(new BoxGeometry(0.03, 0.16, 0.16), '#f0a03c', [0, 0.1, -0.16])
    .build(),
  // The little rain cloud over the crying cat.
  'meme:cloud': () => new PartBuilder()    .add(new SphereGeometry(0.5, 12, 8), '#d8e2ee', [0, 0, 0], [0, 0, 0], [1.1, 0.7, 0.9])
    .add(new SphereGeometry(0.36, 12, 8), '#e6edf5', [0.42, -0.06, 0.1], [0, 0, 0], [1, 0.75, 0.9])
    .add(new SphereGeometry(0.32, 12, 8), '#c9d6e6', [-0.44, -0.08, -0.06], [0, 0, 0], [1, 0.75, 0.9])
    .build(),
  // A rain drop under the cloud.
  'meme:drop': () => new PartBuilder()
    .add(new ConeGeometry(0.05, 0.3, 6), '#8fc7f0', [0, 0, 0], [Math.PI, 0, 0])
    .build(),
} satisfies Record<string, () => BufferGeometry>;
