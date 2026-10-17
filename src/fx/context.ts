// What the fx sub-systems (reactions, emitters, KO director) share.
import type { AppContext, Session } from '../core/contracts';
import type { Vec3Like } from '../core/types';
import type { Particles } from './particles/system';
import type { BurstOpts } from './presets/kit';
import type { RiderTracker } from './react/tracker';
import type { PostState } from './state';

export interface FxContext {
  readonly app: AppContext;
  readonly post: PostState;
  readonly particles: Particles;
  readonly tracker: RiderTracker;
  /** Current race session (null in menus). */
  session(): Session | null;
  burst(name: string, pos: Vec3Like, opts?: BurstOpts): void;
}
