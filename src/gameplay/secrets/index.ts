// Easter eggs (SPEC §21) — entry point loaded by core/modules.ts. Placeholder until the secrets job lands.
import type { AppContext } from '../../core/contracts';
import type { SessionModuleLike } from '../session-module';

export function createSecrets(app: AppContext): SessionModuleLike {
  void app;
  return { attach: () => undefined, dispose: () => undefined };
}
