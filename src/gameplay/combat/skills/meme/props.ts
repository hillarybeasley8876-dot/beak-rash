// Geometries the meme-roster skills draw (SPEC §24, job r6-skills-meme): built once at session start by the
// PropLibrary, so no cast builds geometry mid-race. Keys are prefixed with the folder: 'meme:'.
import {
  BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, type BufferGeometry,
} from 'three';
import { PartBuilder } from '../../meshes/build';

export const PROPS = {
  // A dropped banana peel: three yellow prongs around a brown stalk (r7: bigger and brighter, it is read from
  // the chase camera several metres away, in the air and on the road).
  'meme:peel': () => new PartBuilder()
    .add(new ConeGeometry(0.2, 0.62, 5), '#ffe14d', [0, 0.32, 0], [0, 0, 0], [1, 1, 0.45])
    .add(new ConeGeometry(0.2, 0.62, 5), '#ffe14d', [0.2, 0.3, 0.06], [0, 0, -0.5], [1, 1, 0.45])
    .add(new ConeGeometry(0.2, 0.62, 5), '#ffe14d', [-0.2, 0.3, 0.06], [0, 0, 0.5], [1, 1, 0.45])
    .add(new CylinderGeometry(0.09, 0.11, 0.2, 6), '#8a6a2a', [0, 0.1, 0])
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
  // One sad note: a head, a stem and a little flag (the violin's tune, flying out to every listener).
  'meme:note': () => new PartBuilder()
    .add(new SphereGeometry(0.16, 10, 8), '#cfe0f5', [0, 0, 0], [0, 0, 0.35], [1, 0.8, 0.55])
    .add(new BoxGeometry(0.05, 0.52, 0.05), '#cfe0f5', [0.12, 0.28, 0])
    .add(new BoxGeometry(0.2, 0.09, 0.04), '#9fb8d8', [0.21, 0.48, 0])
    .build(),
  // The green stink cloud pedro may pull out of the bin.
  'meme:stink': () => new PartBuilder()
    .add(new SphereGeometry(0.34, 10, 8), '#8fd44a', [0, 0, 0], [0, 0, 0], [1.1, 0.85, 1])
    .add(new SphereGeometry(0.24, 10, 8), '#a6e35e', [0.3, 0.14, 0.08])
    .add(new SphereGeometry(0.2, 10, 8), '#79c23c', [-0.28, -0.06, -0.1])
    .add(new SphereGeometry(0.16, 10, 8), '#c2f08a', [0.06, 0.28, -0.14])
    .build(),
  // The handful of 小鱼干 pedro may find in the bin.
  'meme:coins': () => new PartBuilder()
    .add(new CylinderGeometry(0.22, 0.22, 0.05, 12), '#ffd76a', [0, 0.03, 0], [Math.PI / 2, 0, 0])
    .add(new CylinderGeometry(0.22, 0.22, 0.05, 12), '#ffd76a', [0.16, 0.12, 0.05], [Math.PI / 2, 0, 0.4])
    .add(new CylinderGeometry(0.22, 0.22, 0.05, 12), '#ffe9a8', [-0.12, 0.2, -0.06], [Math.PI / 2, 0, -0.3])
    .add(new CylinderGeometry(0.2, 0.2, 0.05, 12), '#ffcf4d', [0.02, 0.3, 0.1], [Math.PI / 2, 0, 0.15])
    .build(),
} satisfies Record<string, () => BufferGeometry>;
