// Cues nobody calls view.cue() for, derived from the rider's own state: hop takeoff, landing squash after air time,
// boost stretch, respawn pop, end-of-race victory/defeat, and a taunt gesture when its taunt bubble shows.
import type { AppContext } from '../../core/contracts';
import { clamp } from '../../core/math';
import type { RiderId, RiderMode, RiderState, Side } from '../../core/types';
import type { CueSystem } from './cues';

export class StateCues {
  private air = 0;
  private wasAir = false;
  private boost = 0;
  private mode: RiderMode | null = null;
  private tauntPending = false;
  private readonly off: () => void;

  /** `id()` = this view's rider id (known after the first update); `tauntSide()` = side of the nearest rival. */
  constructor(app: AppContext, private readonly cues: CueSystem, id: () => RiderId, private readonly tauntSide: () => Side) {
    this.off = app.bus.on('taunt', (e) => {
      if (e.riderId === id()) this.tauntPending = true;
    });
  }

  update(st: RiderState, dt: number): void {
    if (st.mode !== this.mode) {
      if (st.mode === 'respawning') this.cues.trigger('respawn');
      if (st.mode === 'finished' && this.mode !== null) this.cues.trigger(st.place <= 3 ? 'victory' : 'defeat');
      this.mode = st.mode;
    }
    if (st.mode === 'crashed') {
      this.air = 0;
      this.wasAir = false;
      this.boost = st.boostTime;
      this.tauntPending = false;
      return;
    }
    if (st.airborne && !this.wasAir) this.cues.trigger('takeoff');
    if (st.airborne) this.air += dt;
    else if (this.wasAir) {
      if (this.air > 0.12) this.cues.trigger('land', 1, clamp(this.air / 0.7, 0.35, 1));
      this.air = 0;
    }
    this.wasAir = st.airborne;
    if (st.boostTime > this.boost + 0.15) this.cues.trigger('boost');
    this.boost = st.boostTime;
    if (this.tauntPending) {
      this.tauntPending = false;
      this.cues.trigger('taunt', this.tauntSide());
    }
  }

  dispose(): void {
    this.off();
  }
}
