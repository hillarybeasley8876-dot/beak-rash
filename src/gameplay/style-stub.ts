// STUB kept by core as load fallback for gameplay/style (SPEC §17): no STYLE chains.
import type { AppContext } from '../core/contracts';
import type { SessionModuleLike } from './session-module';

export function createStyle(app: AppContext): SessionModuleLike {
  void app;
  return { attach: () => undefined, dispose: () => undefined };
}
