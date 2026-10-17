// Road-pickup versions of every weapon (dropped / knocked loose) and the salted-fish torpedo.
// Long axis along Z (tip toward −Z), centred, ~0.8–1 m so they read on the road.
import {
  BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, type BufferGeometry,
} from 'three';
import type { WeaponId } from '../../../core/types';
import { PartBuilder } from './build';

const HALF_PI = Math.PI / 2;
const sphere = (): SphereGeometry => new SphereGeometry(1, 16, 12);

/** Flat dried salted fish with cross-eyes (×_×). `k` scales the whole fish. */
export function saltfishGeometry(k = 1): BufferGeometry {
  const b = new PartBuilder()
    .add(sphere(), '#b8c2c9', [0, 0, 0], [0, 0, 0], [0.07 * k, 0.15 * k, 0.42 * k])
    .add(sphere(), '#e6ebee', [0, -0.06 * k, -0.02 * k], [0, 0, 0], [0.06 * k, 0.07 * k, 0.34 * k])
    .add(new ConeGeometry(0.2 * k, 0.26 * k, 4), '#8f9aa3', [0, 0, 0.5 * k], [-HALF_PI, 0, 0], [0.3, 1, 1])
    .add(new ConeGeometry(0.07 * k, 0.16 * k, 4), '#8f9aa3', [0, 0.15 * k, 0.04 * k], [0, 0, 0], [0.3, 1, 1]);
  for (const sx of [1, -1]) {
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      b.add(new BoxGeometry(0.012 * k, 0.07 * k, 0.016 * k), '#111111', [sx * 0.07 * k, 0.05 * k, -0.27 * k], [r, 0, 0]);
    }
  }
  return b.build();
}

function baguette(): BufferGeometry {
  const b = new PartBuilder().add(new CapsuleGeometry(0.085, 0.8, 6, 12), '#d9a04e', [0, 0, 0], [HALF_PI, 0, 0]);
  for (let i = 0; i < 4; i++) b.add(new BoxGeometry(0.05, 0.03, 0.14), '#f6d79a', [0, 0.075, -0.3 + i * 0.2], [0, 0.7, 0]);
  return b.build();
}

function pan(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(0.27, 0.23, 0.07, 22), '#2b2b33', [0, 0, -0.18])
    .add(new CylinderGeometry(0.22, 0.22, 0.02, 22), '#55555f', [0, 0.03, -0.18])
    .add(new BoxGeometry(0.07, 0.05, 0.3), '#2b2b33', [0, 0.01, 0.22])
    .add(new BoxGeometry(0.08, 0.06, 0.18), '#8b5a2b', [0, 0.01, 0.38])
    .build();
}

function leek(): BufferGeometry {
  const b = new PartBuilder()
    .add(new CylinderGeometry(0.06, 0.065, 0.45, 12), '#f3f3e8', [0, 0, 0.2], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.055, 0.06, 0.3, 12), '#9ed36a', [0, 0, -0.17], [HALF_PI, 0, 0])
    .add(sphere(), '#d8cfb0', [0, 0, 0.44], [0, 0, 0], [0.07, 0.07, 0.04]);
  for (const a of [-0.35, 0, 0.35]) b.add(new ConeGeometry(0.06, 0.42, 4), '#2f9a3d', [a * 0.25, 0, -0.5], [-HALF_PI, 0, a], [1, 1, 0.3]);
  return b.build();
}

function umbrella(): BufferGeometry {
  return new PartBuilder()
    .add(new ConeGeometry(0.13, 0.75, 10), '#e5191c', [0, 0, -0.1], [-HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.11, 0.11, 0.06, 10), '#ffffff', [0, 0, 0.15], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.018, 0.018, 0.3, 6), '#333333', [0, 0, 0.36], [HALF_PI, 0, 0])
    .add(new TorusGeometry(0.07, 0.022, 6, 12, Math.PI), '#5a3a1e', [0, -0.07, 0.5], [0, HALF_PI, 0])
    .build();
}

function selfie(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(0.016, 0.016, 0.9, 6), '#c0c6cc', [0, 0, 0], [HALF_PI, 0, 0])
    .add(new CylinderGeometry(0.035, 0.035, 0.18, 8), '#222222', [0, 0, 0.42], [HALF_PI, 0, 0])
    .add(new BoxGeometry(0.14, 0.025, 0.24), '#111111', [0, 0.02, -0.5])
    .add(new BoxGeometry(0.11, 0.028, 0.19), '#5ec8f2', [0, 0.024, -0.5])
    .build();
}

function slipper(): BufferGeometry {
  return new PartBuilder()
    .add(new CylinderGeometry(1, 1, 1, 20), '#5aa9e6', [0, 0, 0], [0, 0, 0], [0.14, 0.05, 0.32])
    .add(new CylinderGeometry(1, 1, 1, 20), '#f2f2f2', [0, 0.03, 0], [0, 0, 0], [0.12, 0.012, 0.29])
    .add(new TorusGeometry(0.12, 0.035, 6, 14, Math.PI), '#2f7fc4', [0, 0.03, -0.1], [0, 0, 0], [1, 0.8, 1.6])
    .build();
}

function keyboard(): BufferGeometry {
  const b = new PartBuilder().add(new BoxGeometry(0.34, 0.05, 0.92), '#2a2d34');
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 11; col++) {
      const accent = row === 1 && col >= 1 && col <= 3;
      b.add(new BoxGeometry(0.06, 0.035, 0.06), accent ? '#e5191c' : '#e9e9ea', [-0.12 + row * 0.08, 0.04, -0.4 + col * 0.08]);
    }
  }
  return b.build();
}

/** Geometry for a weapon lying on the road ('none' has no prop). */
export function weaponGeometry(id: Exclude<WeaponId, 'none'>): BufferGeometry {
  switch (id) {
    case 'saltfish': return saltfishGeometry(1);
    case 'baguette': return baguette();
    case 'pan': return pan();
    case 'leek': return leek();
    case 'umbrella': return umbrella();
    case 'selfie': return selfie();
    case 'slipper': return slipper();
    case 'keyboard': return keyboard();
  }
}
