// Shape of the per-session gameplay modules that core loads like units (achievements, style, secrets): created once
// at boot, attached to each race session and detached (null) when it ends.
import type { Session } from '../core/contracts';

export interface SessionModuleLike {
  attach(session: Session | null): void;
  /** Optional, once per rendered frame after the session stepped (timers that no bus event drives). */
  update?(dtSim: number, dtReal: number): void;
  dispose(): void;
}
