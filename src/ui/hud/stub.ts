// STUB HUD (core-owned fallback): text readout. ui-hud owns hud/index.ts.
import { KMH } from '../../core/math';
import type { AppContext, Session } from '../../core/contracts';
import type { Hud } from './contract';

export function createHud(app: AppContext, layer: HTMLElement): Hud {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:24px;top:20px;font-size:26px;line-height:1.4;color:#fff;text-shadow:2px 2px 0 #000';
  layer.append(el);
  let session: Session | null = null;
  let visible = false;
  let countdown = '';
  const off = app.bus.on('race:countdown', ({ n }) => {
    countdown = n > 0 ? String(n) : 'GO!';
    setTimeout(() => (countdown = ''), 900);
  });
  return {
    attach(s) { session = s; },
    setVisible(v) { visible = v; },
    update() {
      if (!session || !visible) { el.textContent = ''; return; }
      const p = session.player;
      el.innerHTML = `名次 ${p.place}/${session.riders.length}<br>${Math.round(p.speed * KMH)} km/h<br>HP ${Math.round(p.hp)}<br><span style="font-size:80px">${countdown}</span>`;
    },
    dispose() { off(); el.remove(); },
  };
}
