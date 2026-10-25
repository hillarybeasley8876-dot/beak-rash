// STYLE chains (SPEC §17) — entry point loaded by core/modules.ts. Placeholder until the style job lands.
import type { AppContext } from '../../core/contracts';
import type { SessionModuleLike } from '../session-module';

export function createStyle(app: AppContext): SessionModuleLike {
  void app;
  return { attach: () => undefined, dispose: () => undefined };
}
