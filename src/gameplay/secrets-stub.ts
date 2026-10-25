// STUB kept by core as load fallback for gameplay/secrets (SPEC §21): no easter eggs.
import type { AppContext } from '../core/contracts';
import type { SessionModuleLike } from './session-module';

export function createSecrets(app: AppContext): SessionModuleLike {
  void app;
  return { attach: () => undefined, dispose: () => undefined };
}
