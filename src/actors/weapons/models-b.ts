// Weapon models, part 2: umbrella, selfie stick, mom's slipper, mechanical keyboard, police baton (grip space as
// in models-a: grip at the origin, length along +Y).
import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, LatheGeometry, Shape, TorusGeometry, Vector2 } from 'three';
import type { CharacterBuilder } from '../kit/builder';
import { extrudeSmooth } from '../kit/shapes';
import { put } from './models-a';

export function umbrella(b: CharacterBuilder): void {
  put(b, new CylinderGeometry(0.008, 0.008, 0.82, 6), [0, 0.41, 0], [0, 0, 0], 1, 0x2b2b30, 0.6);
  // Furled canopy: a lathe with a soft bulge, striped red/white like a beach-front umbrella.
  const pts = [0, 0.02, 0.05, 0.058, 0.05, 0.03, 0.012, 0].map((r, i) => new Vector2(r + 0.006, i * 0.08));
  put(b, new LatheGeometry(pts, 12), [0, 0.22, 0], [0, 0, 0], 1, (x, _y, z) => {
    const a = Math.atan2(z, x) + Math.PI;
    return Math.floor(a / (Math.PI / 3)) % 2 === 0 ? 0xe5191c : 0xfff4ea;
  });
  put(b, new TorusGeometry(0.06, 0.007, 4, 14), [0, 0.43, 0], [Math.PI / 2, 0, 0], 1, 0x2b2b30, 0.5);
  put(b, new ConeGeometry(0.01, 0.07, 6), [0, 0.86, 0], [0, 0, 0], 1, 0xc9cdd4, 0.6);
  // J-hook handle below the grip.
  put(b, new TorusGeometry(0.045, 0.013, 6, 12, Math.PI), [0, -0.01, 0.045], [0, Math.PI / 2, Math.PI], 1, 0x6b4226);
}

export function selfie(b: CharacterBuilder): void {
  put(b, new CapsuleGeometry(0.017, 0.12, 4, 8), [0, 0.06, 0], [0, 0, 0], 1, 0x1f1f24);
  put(b, new CylinderGeometry(0.009, 0.01, 0.45, 6), [0, 0.36, 0], [0, 0, 0], 1, 0xc9cdd4, 0.6);
  put(b, new CylinderGeometry(0.007, 0.007, 0.32, 6), [0, 0.73, 0], [0, 0, 0], 1, 0xdfe3ea, 0.6);
  put(b, new BoxGeometry(0.03, 0.03, 0.03), [0, 0.89, 0], [0, 0, 0], 1, 0x1f1f24, 0.6);
  put(b, new BoxGeometry(0.16, 0.085, 0.012), [0, 0.93, 0.012], [0, 0, 0], 1, 0x15151a);
  put(b, new BoxGeometry(0.145, 0.072, 0.004), [0, 0.93, 0.02], [0, 0, 0], 1, 0x6fd3ff, 0);
}

export function slipper(b: CharacterBuilder): void {
  const s = new Shape();
  s.moveTo(-0.035, 0);
  s.quadraticCurveTo(0, -0.02, 0.035, 0);
  s.quadraticCurveTo(0.05, 0.1, 0.045, 0.19);
  s.quadraticCurveTo(0.05, 0.27, 0, 0.285);
  s.quadraticCurveTo(-0.05, 0.27, -0.048, 0.19);
  s.quadraticCurveTo(-0.052, 0.1, -0.035, 0);
  put(b, extrudeSmooth(s, { depth: 0.026, bevel: 0.45, curveSegments: 5 }), [0, 0.01, 0], [0, 0, 0], 1, (_x, _y, z) => (z < -0.008 ? 0xd94b78 : 0xff79a6));
  put(b, new TorusGeometry(0.046, 0.013, 6, 14, Math.PI), [0, 0.2, 0.008], [Math.PI / 2, 0, 0], [1, 1, 0.9], 0xffffff);
  put(b, new CylinderGeometry(0.014, 0.014, 0.008, 10), [0, 0.2, 0.06], [Math.PI / 2, 0, 0], 1, 0xffd23f, 0.4);
}

export function keyboard(b: CharacterBuilder): void {
  put(b, new BoxGeometry(0.15, 0.44, 0.032), [0, 0.22, 0], [0, 0, 0], 1, 0x2e2f36);
  put(b, new BoxGeometry(0.152, 0.442, 0.006), [0, 0.22, -0.016], [0, 0, 0], 1, 0x3fe0ff, 0);
  const key = new BoxGeometry(0.026, 0.026, 0.014);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 12; c++) {
      const wasd = (r === 1 && c >= 2 && c <= 4) || (r === 2 && c === 3);
      put(b, key.clone(), [-0.051 + r * 0.034, 0.03 + c * 0.034, 0.022], [0, 0, 0], 1, wasd ? 0xe5191c : 0xe9e9ef, 0.25);
    }
  }
  key.dispose();
  put(b, new BoxGeometry(0.026, 0.2, 0.014), [0.051, 0.22, 0.022], [0, 0, 0], 1, 0xe9e9ef, 0.25);
}

/** The corgi officer's baton (police only): black rubber stick, ridged grip, a white reflective band near the tip. */
export function baton(b: CharacterBuilder): void {
  put(b, new CylinderGeometry(0.019, 0.017, 0.62, 10), [0, 0.31, 0], [0, 0, 0], 1, 0x18181d, 0.8);
  for (let i = 0; i < 4; i++) put(b, new TorusGeometry(0.02, 0.004, 4, 10), [0, 0.03 + i * 0.035, 0], [Math.PI / 2, 0, 0], 1, 0x3a3a44, 0);
  put(b, new CylinderGeometry(0.0195, 0.0195, 0.05, 10), [0, 0.5, 0], [0, 0, 0], 1, 0xf2f4f7, 0);
  put(b, new CylinderGeometry(0.024, 0.024, 0.02, 10), [0, -0.01, 0], [0, 0, 0], 1, 0x2a2a31, 0.6);
}
