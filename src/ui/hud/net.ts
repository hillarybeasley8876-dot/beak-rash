// The online race's HUD layer (SPEC §28): the 「等待其他玩家…」 cover while the relay's ticks have not
// arrived (or stopped arriving), and the ping to the relay in a corner. Pure presentation: it reads the
// session and the net system, it never writes to them.
import './css/net.css';
import type { AppContext, Session } from '../../core/contracts';
import { el } from './dom';

/** How long the ticks may stall before the cover comes back. */
const STALL_MS = 500;

export class NetHud {
  private readonly root: HTMLElement;
  private readonly cover: HTMLElement;
  private readonly ping: HTMLElement;
  /** A tick has run (the countdown starts on the first one). */
  private ticked = false;
  /** The sim time of the last tick we saw. */
  private lastTime = 0;
  /** When the last tick arrived (real time). */
  private lastTickAt = -Infinity;
  private readonly off: () => void;

  constructor(private readonly app: AppContext, parent: HTMLElement) {
    this.root = el('div', 'brh-net', parent);
    this.cover = el('div', 'brh-net-wait', this.root, '等待其他玩家…');
    this.cover.dataset.netWait = '1';
    this.ping = el('div', 'brh-net-ping', this.root);
    // The countdown runs on the relay's ticks: the first number means the race is moving.
    this.off = app.bus.on('race:countdown', () => {
      this.ticked = true;
      this.lastTickAt = performance.now();
    });
  }

  update(session: Session | null): void {
    const online = !!session?.config.online;
    this.root.classList.toggle('is-off', !online);
    if (!online || !session) return;
    // A racing sim only advances on ticks: its clock is the tick counter.
    if (session.time > this.lastTime) {
      this.lastTime = session.time;
      this.lastTickAt = performance.now();
    }
    const stalled = session.phase === 'racing' && performance.now() - this.lastTickAt > STALL_MS;
    this.cover.classList.toggle('is-off', !( !this.ticked || stalled));
    const ping = this.app.net.ping;
    this.ping.textContent = ping === null ? '' : `${ping} ms`;
    this.ping.classList.toggle('is-off', ping === null);
  }

  dispose(): void {
    this.off();
    this.root.remove();
  }
}
