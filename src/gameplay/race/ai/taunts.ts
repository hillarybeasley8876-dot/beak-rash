// Taunts: roster lines from rivals near the player, paced so the chatter never stacks up. One idle line
// at a time across the field (4.5–6.5 s apart, from the nearest rider in front of the camera), each rider
// at most every ~8–14 s (longer when the pack is crowded), KO / respawn / signature-skill shouts ≥ 2 s after
// any other line, and every rider draws its lines from a shuffled no-repeat bag.
import { ROSTER } from '../../../data/roster';
import { NEMESIS_LINES } from '../../../data/rival-lines';
import type { Session } from '../../../core/contracts';
import type { Rng } from '../../../core/rng';
import type { RiderId, RiderState } from '../../../core/types';

const NEAR = 25;            // m from the player for idle taunts
const EARSHOT = 60;         // m from the player for KO / respawn lines
const BEHIND_CAM = -3;      // m: riders further behind the player are behind the chase camera
const GAP = [8, 14];        // s between idle taunts per rider (÷ taunty)
const CROWD = 0.15;         // per-rider gap grows by this per extra rider within NEAR
const IDLE_GAP = [4.5, 6.5]; // s between idle taunts across the whole field
const FORCE_GAP = 2;        // s after any line before a KO / respawn line
const BURST = 3;            // s window: never be the third line inside it
const SKILL_SHOUT = 0.6;    // chance a rival shouts its skillLines on a signature cast

type Kind = 'taunts' | 'koLines' | 'hurtLines' | 'skillLines' | 'nemesisLines';

export class Taunts {
  private next = new Map<RiderId, number>();
  private bags = new Map<string, string[]>();
  private last = new Map<string, string>();
  private time = 0;
  private lastLine = -Infinity;     // race-clock time of the last line of any kind
  private recent: number[] = [];    // times of lines (any source) in the last BURST s
  private idleAt = 0;               // earliest time for the next idle line
  private shouts: RiderState[] = []; // signature casts waiting for their shout (next tick)
  private offs: Array<() => void> = [];

  constructor(private session: Session, private rng: Rng, private taunty: (id: RiderId) => number, private nemesisId: RiderId | null = null) {
    const { bus } = session.app;
    // Any line (ours or a skill shout from combat) holds the idle chatter back for a moment.
    this.offs.push(bus.on('taunt', () => {
      this.lastLine = this.time;
      this.recent.push(this.time);
      this.idleAt = Math.max(this.idleAt, this.time + FORCE_GAP + 0.5);
    }));
    this.offs.push(bus.on('combat:ko', ({ attacker }) => {
      const r = attacker !== null ? session.rider(attacker) : undefined;
      if (r && !r.isPlayer && this.rng.next() < 0.75) this.forced(r, 'koLines');
    }));
    this.offs.push(bus.on('rider:respawn', ({ riderId }) => {
      const r = session.rider(riderId);
      if (r && !r.isPlayer && this.rng.next() < 0.45) this.forced(r, 'hurtLines');
    }));
    this.offs.push(bus.on('skill:cast', ({ riderId, slot }) => {
      const r = session.rider(riderId);
      // Shouted on the next tick, so a skill that already says something (seagull's MINE!) is not doubled.
      if (r && !r.isPlayer && slot === 1 && this.rng.next() < SKILL_SHOUT) this.shouts.push(r);
    }));
  }

  /** KO / respawn / skill line: within earshot and not on top of another line. */
  private forced(r: RiderState, kind: Kind): void {
    if (this.time - this.lastLine < FORCE_GAP || this.crowded() || !this.audible(r, EARSHOT)) return;
    this.say(r, kind);
  }

  /** Two lines (any source, e.g. combat's skill shouts) in the last BURST s: a third would stack up. */
  private crowded(): boolean {
    while (this.recent.length > 0 && this.time - this.recent[0] > BURST) this.recent.shift();
    return this.recent.length >= 2;
  }

  private say(r: RiderState, kind: Kind): void {
    const text = this.draw(r, kind);
    if (!text) return;
    this.next.set(r.id, this.time + this.gap(r));
    this.session.app.bus.emit('taunt', { riderId: r.id, text, character: r.character });
  }

  /** Next line from this rider's shuffled bag (refilled without repeating the line just said). */
  private draw(r: RiderState, kind: Kind): string | null {
    const lines = kind === 'nemesisLines' ? (NEMESIS_LINES[r.character] ?? []) : ROSTER[r.character][kind];
    if (lines.length === 0) return null;
    const key = `${r.id}:${kind}`;
    let bag = this.bags.get(key);
    if (!bag || bag.length === 0) {
      bag = this.rng.shuffle(lines);
      if (bag.length > 1 && bag[bag.length - 1] === this.last.get(key)) bag.unshift(bag.pop() as string);
      this.bags.set(key, bag);
    }
    const text = bag.pop() as string;
    this.last.set(key, text);
    return text;
  }

  private audible(r: RiderState, within: number): boolean {
    const ds = r.s - this.session.player.s;
    return Math.abs(ds) < within && !r.mods.invisible;
  }

  private gap(r: RiderState): number {
    const p = this.session.player;
    const crowd = this.session.riders.filter((o) => !o.isPlayer && Math.abs(o.s - p.s) < NEAR).length;
    const base = this.rng.range(GAP[0], GAP[1]) / Math.max(0.3, this.taunty(r.id));
    return base * (1 + CROWD * Math.max(0, crowd - 1));
  }

  update(dt: number): void {
    this.time += dt;
    for (const r of this.shouts) this.forced(r, 'skillLines');
    this.shouts.length = 0;
    if (this.session.phase !== 'racing' || this.time < this.idleAt || this.crowded()) return;
    const p = this.session.player;
    let best: RiderState | null = null;
    for (const r of this.session.riders) {
      if (r.isPlayer || r.mode !== 'racing') continue;
      const due = this.next.get(r.id);
      if (due === undefined) {
        // The nemesis has something to say early: its grudge is the story of this race.
        this.next.set(r.id, this.time + this.rng.range(r.id === this.nemesisId ? 1 : 2, r.id === this.nemesisId ? 3 : 9));
        continue;
      }
      const ds = r.s - p.s;
      if (this.time < due || ds < BEHIND_CAM || !this.audible(r, NEAR)) continue;
      if (r.id === this.nemesisId) { best = r; break; }   // 宿敌 first: it speaks for the race
      if (!best || Math.abs(ds) < Math.abs(best.s - p.s)) best = r;
    }
    if (!best) return;
    this.say(best, this.nemesisId === best.id ? 'nemesisLines' : 'taunts');
    this.idleAt = this.time + this.rng.range(IDLE_GAP[0], IDLE_GAP[1]);
  }

  /** Say a line right now (the nemesis, the betrayal): paced like the other lines, never stacked. */
  sayNow(r: RiderState, text: string): void {
    if (this.time - this.lastLine < FORCE_GAP || this.crowded()) return;
    this.next.set(r.id, this.time + this.gap(r));
    this.session.app.bus.emit('taunt', { riderId: r.id, text, character: r.character });
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
