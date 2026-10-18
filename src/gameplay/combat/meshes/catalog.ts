// Every combat prop geometry by key, so the PropLibrary can build them all at session start (a skill's first
// cast never builds geometry mid-race). Unit-size primitives are scaled by the visuals that use them.
import {
  CircleGeometry, CylinderGeometry, IcosahedronGeometry, Shape, ShapeGeometry, TorusGeometry, WireframeGeometry,
  type BufferGeometry,
} from 'three';
import type { WeaponId } from '../../../core/types';
import { WEAPONS } from '../../../data/weapons';
import { canGeometry, coinGeometry, crateGeometry, fishGeometry, shadowGeometry } from './pickup-props';
import { saltfishGeometry, weaponGeometry } from './weapon-props';

type Maker = () => BufferGeometry;
type ArmedWeapon = Exclude<WeaponId, 'none'>;

/** Unit four-point star in the XY plane (heavy-swing tell). */
function starGeometry(): ShapeGeometry {
  const s = new Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 2, rad = i % 2 === 0 ? 1 : 0.22;
    if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  s.closePath();
  return new ShapeGeometry(s);
}

const FIXED = {
  torpedo: () => saltfishGeometry(1.7),
  'tell:star': starGeometry,
  'wave:ring': () => new TorusGeometry(1, 0.07, 6, 48),
  'wave:wall': () => new CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0),
  'aura:disc': () => new CircleGeometry(1, 48),
  'aura:rim': () => new TorusGeometry(1, 0.012, 4, 72),
  'aura:ripple': () => new TorusGeometry(1, 0.008, 4, 64),
  'aura:shell': () => new IcosahedronGeometry(1.35, 1),
  'aura:wire': () => new WireframeGeometry(new IcosahedronGeometry(1.35, 1)), // the shell's edges
  'aura:arc': () => new TorusGeometry(1, 0.035, 4, 20, Math.PI * 0.55),
  'pickup:coin': coinGeometry,
  'pickup:fish': fishGeometry,
  'pickup:crate': crateGeometry,
  'pickup:can': canGeometry,
  'pickup:shadow': shadowGeometry,
} satisfies Record<string, Maker>;

export type PropKey = keyof typeof FIXED | `weapon:${ArmedWeapon}`;

const ARMED = (Object.keys(WEAPONS) as WeaponId[]).filter((w): w is ArmedWeapon => w !== 'none');

/** Every key the library knows (prebuilt at session start). */
export const PROP_KEYS: readonly PropKey[] = [...(Object.keys(FIXED) as Array<keyof typeof FIXED>), ...ARMED.map((w) => `weapon:${w}` as const)];

const isFixed = (key: PropKey): key is keyof typeof FIXED => key in FIXED;

/** Build the geometry for `key`. */
export function makeProp(key: PropKey): BufferGeometry {
  if (isFixed(key)) return FIXED[key]();
  return weaponGeometry(key.slice('weapon:'.length) as ArmedWeapon);
}
