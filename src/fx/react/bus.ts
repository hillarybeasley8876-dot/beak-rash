// All bus-driven particle/post reactions, as one fx part (subscribed for the app's lifetime).
import { subscribeCombat } from './bus-combat';
import { subscribeRide } from './bus-ride';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

export function busReactions(ctx: FxContext): FxPart {
  const offs = [...subscribeCombat(ctx), ...subscribeRide(ctx)];
  return {
    dispose: () => {
      for (const off of offs) off();
    },
  };
}
