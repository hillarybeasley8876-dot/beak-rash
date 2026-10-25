// The rubber-duck passenger (SPEC §21 #1): a small yellow toy duck on the handlebar, a child of the
// steer pivot so it turns with the bars. Only the player's bike carries one, and only once every duck
// has been found and the garage toggle is on.
import { Group, Mesh } from 'three';
import { SaveStore } from '../../core/save';
import { outline, toon } from '../../render/toon';
import { ellip, sph, v } from './build/geo';

/** The unlock that unlocks the passenger (the five ducks of SPEC §21 #1). */
const DUCK_UNLOCK = 'duck';
const YELLOW = '#ffd23f', BEAK = '#ff8a00', EYE = '#15151a';

/** The player's profile: the bikes unit has no app handle, so it reads the stored one. */
export function duckRiderWanted(): boolean {
  try {
    const save = new SaveStore();
    return save.data.unlocks.includes(DUCK_UNLOCK) && save.data.settings.duckRider;
  } catch (err) {
    console.warn('[bikes] could not read the profile, no duck passenger', err);
    return false;
  }
}

/** The duck: ~12 cm tall, yellow with an orange beak and ink-outlined eyes; its base (y = 0) sits on the bars. */
export function createDuckRider(): Group {
  const g = new Group();
  g.name = 'duck-rider';
  const body = new Mesh(ellip(v(0, 0.042, 0), 0.046, 0.042, 0.056, 16, 12), toon(YELLOW));
  const head = new Mesh(sph(v(0, 0.082, -0.032), 0.032, 16, 12), toon(YELLOW));
  const beak = new Mesh(ellip(v(0, 0.075, -0.062), 0.013, 0.0105, 0.024, 12, 8), toon(BEAK));
  const tail = new Mesh(ellip(v(0, 0.06, 0.05), 0.016, 0.024, 0.014, 10, 8), toon(YELLOW));
  tail.rotation.x = -0.5;
  g.add(body, head, beak, tail);
  for (const s of [-1, 1] as const) {
    const eye = new Mesh(sph(v(s * 0.021, 0.092, -0.044), 0.0075, 10, 8), toon(EYE));
    const glint = new Mesh(sph(v(s * 0.0235, 0.0945, -0.048), 0.0026, 6, 5), toon('#ffffff'));
    g.add(eye, glint);
  }
  outline(g, 0.004);
  return g;
}
