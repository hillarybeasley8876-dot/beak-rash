// The air-trick trail (SPEC §16): from a trick's start (`rider:trick` phase 'start') until its rider lands, fails
// or crashes — or the trick's own time is up — bright ribbons are shed behind them. The landing burst and the
// failed trick live in react/r4.ts.
import type { Session } from '../../core/contracts';
import type { RiderId, TrickKind } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

const TRAIL_FRAMES = 2;      // emit every other frame (the trail is a hint, not a firework)
/** How long a trail may run without its landing (s): spin 0.55 s, flips 0.65 s, a held superman longer. */
const LEASH: Record<TrickKind, number> = { spin: 0.75, backflip: 0.85, frontflip: 0.85, superman: 1.6 };

interface Run { until: number; kind: TrickKind }

export class TrickTrails implements FxPart {
  private readonly runs = new Map<RiderId, Run>();
  private readonly offs: Array<() => void>;
  private clock = 0;
  private frame = 0;

  constructor(private readonly ctx: FxContext) {
    const bus = ctx.app.bus;
    this.offs = [
      bus.on('rider:trick', ({ riderId, phase, kind }) => {
        if (phase === 'start') this.runs.set(riderId, { until: this.clock + LEASH[kind], kind });
        else this.runs.delete(riderId);
      }),
      bus.on('rider:land', ({ riderId }) => { this.runs.delete(riderId); }),
      bus.on('rider:crash', ({ riderId }) => { this.runs.delete(riderId); }),
    ];
  }

  attach(session: Session | null): void {
    this.runs.clear();
    this.clock = 0;
    this.frame = 0;
    void session;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.runs.clear();
  }

  update(dtSim: number): void {
    this.clock += dtSim;
    this.frame++;
    if (this.runs.size === 0 || !this.ctx.session()) return;
    for (const [id, run] of this.runs) {
      if (this.clock >= run.until) {
        this.runs.delete(id);
        continue;
      }
      if (this.frame % TRAIL_FRAMES === 0) this.emit(id, run.kind);
    }
  }

  /** One ribbon burst behind a tricking rider. */
  private emit(id: RiderId, kind: TrickKind): void {
    const t = this.ctx.tracker.get(id);
    if (!t) return;
    const color = kind === 'backflip' || kind === 'frontflip' ? '#ffd0f4' : '#7ff0ff';
    this.ctx.burst('trickTrail', t.body, { vel: t.vel, dir: t.fwd, color, scale: 0.9 });
  }
}
