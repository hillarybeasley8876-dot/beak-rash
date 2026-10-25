// The egg records (SPEC §21): every first find goes into SaveData.secrets, and the five ducks unlock the duck rider.
import type { AppContext } from '../../core/contracts';
import { DUCK_IDS } from './tuning';

/**
 * Record an easter egg on the profile. One save write per new egg; the five ducks also open the garage's
 * 小黄鸭乘客 row (the garage reads SaveData.unlocks).
 * Returns true when the egg is new on this profile (the 'first' flag of secret:found).
 */
export function recordSecret(app: AppContext, id: string): boolean {
  if (app.save.data.secrets.includes(id)) return false;
  app.save.update((d) => {
    if (!d.secrets.includes(id)) d.secrets.push(id);
    if (id.startsWith('duck_') && DUCK_IDS.every((duck) => d.secrets.includes(duck)) && !d.unlocks.includes('duck')) {
      d.unlocks.push('duck');
    }
  });
  return true;
}

/** How many of the five ducks are on the profile. */
export function duckCount(app: AppContext): number {
  return DUCK_IDS.filter((id) => app.save.data.secrets.includes(id)).length;
}
