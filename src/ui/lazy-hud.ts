// Loads the ui-hud unit lazily so a broken HUD build can never take the menus down with it:
// falls back to the core HUD stub on import/creation failure (or with ?stub=hud|all).
import type { AppContext, Session } from '../core/contracts';
import type { Hud } from './hud/contract';

export function createLazyHud(app: AppContext, layer: HTMLElement): Hud {
  let real: Hud | null = null;
  let session: Session | null = null;
  let visible = false;
  let disposed = false;
  const stubs = (app.params.get('stub') ?? '').split(',');
  const wantStub = stubs.includes('hud') || stubs.includes('all');

  const adopt = (hud: Hud): void => {
    if (disposed) {
      hud.dispose();
      return;
    }
    real = hud;
    hud.attach(session);
    hud.setVisible(visible);
  };
  const loadStub = async (): Promise<void> => {
    const mod = await import('./hud/stub');
    adopt(mod.createHud(app, layer));
  };
  const load = async (): Promise<void> => {
    if (wantStub) return loadStub();
    try {
      const mod = await import('./hud');
      adopt(mod.createHud(app, layer));
    } catch (err) {
      console.error('[ui] HUD unit failed, using the HUD stub', err);
      layer.replaceChildren();
      await loadStub();
    }
  };
  load().catch((err: unknown) => console.error('[ui] HUD stub failed too', err));

  return {
    attach(s) {
      session = s;
      real?.attach(s);
    },
    setVisible(v) {
      visible = v;
      real?.setVisible(v);
    },
    update(dt) {
      if (!real) return;
      try {
        real.update(dt);
      } catch (err) {
        // A throwing HUD must not stop the render loop: drop it and continue on the stub.
        console.error('[ui] HUD update threw, switching to the HUD stub', err);
        const broken = real;
        real = null;
        try {
          broken.dispose();
        } catch (disposeErr) {
          console.error('[ui] HUD dispose threw', disposeErr);
        }
        layer.replaceChildren();
        loadStub().catch((e: unknown) => console.error('[ui] HUD stub failed', e));
      }
    },
    dispose() {
      disposed = true;
      real?.dispose();
      real = null;
    },
  };
}
