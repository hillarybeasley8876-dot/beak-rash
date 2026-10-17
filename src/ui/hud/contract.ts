// ui-screens ↔ ui-hud contract (core-owned). ui-screens creates one full-screen layer for the HUD
// and calls createHud(app, layer) once; the HUD shows itself while a session is attached and the
// screen is 'race' (it also owns every in-race cut-in: countdown, skill, KO, SHOWTIME, BUSTED, FINISH).
import type { AppContext, Session } from '../../core/contracts';

export interface Hud {
  attach(session: Session | null): void;
  /** ui-screens tells the HUD whether the race screen is up (pause/results hide it). */
  setVisible(visible: boolean): void;
  update(dtReal: number): void;
  dispose(): void;
}

export type CreateHud = (app: AppContext, layer: HTMLElement) => Hud;
