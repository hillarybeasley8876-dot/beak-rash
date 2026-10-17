// Warm-up: build the hero's geometry before the first race; the rest of the roster is meshed in idle
// time afterwards so race loading never stalls on SDF meshing.
import type { AppContext } from '../core/contracts';
import type { CharacterId } from '../core/types';
import { speciesAsset } from './species';

const ROSTER_IDS: CharacterId[] = ['goose', 'capybara', 'cat', 'shiba', 'pigeon', 'penguin', 'seagull', 'sloth', 'corgi'];

export async function preload(app: AppContext): Promise<void> {
  speciesAsset('pelican', app.quality);
  const queue = [...ROSTER_IDS];
  const next = (): void => {
    const id = queue.shift();
    if (!id) return;
    try {
      speciesAsset(id, app.quality);
    } catch (err) {
      console.error(`[actors] warm-up of ${id} failed`, err);
    }
    setTimeout(next, 30);
  };
  setTimeout(next, 200);
}
