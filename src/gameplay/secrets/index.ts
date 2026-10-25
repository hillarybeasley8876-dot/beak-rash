// Easter eggs (SPEC §21): 小黄鸭 ducks, the SVG easel, the goose poem, the lazy sloth and the pelican god.
// The module is loaded by core/modules.ts like the STYLE chains: it is created once, attached to every race
// session and detached when the race ends (everything it put in the world goes with it).
import type { AppContext } from '../../core/contracts';
import type { SessionModuleLike } from '../session-module';
import { SecretsRunner } from './runner';

export function createSecrets(app: AppContext): SessionModuleLike {
  const runner = new SecretsRunner(app);
  return {
    attach: (session) => runner.attach(session),
    update: (dtSim) => runner.update(dtSim),
    dispose: () => runner.dispose(),
  };
}
