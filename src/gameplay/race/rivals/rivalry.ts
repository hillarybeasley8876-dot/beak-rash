// Grudges (SPEC §18): SaveData.rivalry holds a 0..100 grudge per rival species. This tracker collects what
// happened in THIS race and writes the new values once, at race:end, in a single save update:
// the player KOs X +25 · steals X's weapon +10 · lands a thrown hit on X +5 · finishes ahead of X by < 1 s +5
// · X KOs the player −20 · then every species in the race −3, every rival species not in it −8 (floor 0).
// KO'ing the nemesis settles it: its grudge ends at exactly 20.
import type { Session } from '../../../core/contracts';
import type { CharacterId, RiderId } from '../../../core/types';
import { RIVAL_SPECIES } from '../../../data/rival-lines';

export const RIVALTY = {
  ko: 25,          // the player KOs this rival
  steal: 10,       // the player takes its weapon
  thrown: 5,       // a thrown weapon of the player lands on it
  finish: 5,       // the player finishes ahead of it by less than a second
  koed: -20,       // it KOs the player
  inRace: -3,      // every species in the race cools off a little
  absent: -8,      // … and the ones that were not there cool off more
  min: 0,
  max: 100,
  nemesisAfterKo: 20,   // the nemesis you KO'd starts over from here
  finishWindow: 1,      // s: finishing ahead by less than this counts
} as const;

export class Rivalry {
  private readonly kos = new Set<CharacterId>();
  private readonly steals = new Set<CharacterId>();
  private readonly thrown = new Set<CharacterId>();
  private readonly koedBy = new Set<CharacterId>();
  private readonly playerThrows = new Set<RiderId>();   // the ids of the player's thrown weapons
  private readonly inRace = new Set<CharacterId>();
  private readonly offs: Array<() => void> = [];

  constructor(private session: Session) {
    const { bus } = session.app;
    for (const r of session.riders) if (!r.isPlayer) this.inRace.add(r.character);
    this.offs.push(
      bus.on('combat:ko', ({ attacker, victim }) => {
        const a = attacker === null ? null : this.characterOf(attacker);
        const v = this.characterOf(victim);
        if (a && v && a === this.playerCharacter) this.kos.add(v);
        if (v && v === this.playerCharacter && a) this.koedBy.add(a);
      }),
      bus.on('combat:weaponPick', ({ riderId, stolenFrom }) => {
        if (stolenFrom === null) return;
        if (this.characterOf(riderId) !== this.playerCharacter) return;
        const from = this.characterOf(stolenFrom);
        if (from) this.steals.add(from);
      }),
      bus.on('combat:throw', ({ riderId, projectileId }) => {
        if (this.characterOf(riderId) === this.playerCharacter) this.playerThrows.add(projectileId);
      }),
      bus.on('projectile:end', ({ id, hit }) => {
        if (hit === null || !this.playerThrows.has(id)) return;
        const v = this.characterOf(hit);
        if (v) this.thrown.add(v);
      }),
    );
  }

  private get playerCharacter(): CharacterId {
    return this.session.player.character;
  }

  private characterOf(id: RiderId): CharacterId | null {
    return this.session.rider(id)?.character ?? null;
  }

  /** The species the player finished ahead of by less than a second. */
  private finishedAhead(): Set<CharacterId> {
    const out = new Set<CharacterId>();
    const p = this.session.player;
    if (p.finishTime === null) return out;
    for (const r of this.session.riders) {
      if (r.isPlayer || r.finishTime === null) continue;
      if (p.finishTime - r.finishTime < RIVALTY.finishWindow) out.add(r.character);
    }
    return out;
  }

  /** The new grudge of every rival species (0..100), ready to be written. */
  values(): Partial<Record<CharacterId, number>> {
    const ahead = this.finishedAhead();
    const base = this.session.app.save.data.rivalry;
    const out: Partial<Record<CharacterId, number>> = {};
    for (const c of RIVAL_SPECIES) {
      let v = base[c] ?? 0;
      if (this.kos.has(c)) v += RIVALTY.ko;
      if (this.steals.has(c)) v += RIVALTY.steal;
      if (this.thrown.has(c)) v += RIVALTY.thrown;
      if (ahead.has(c)) v += RIVALTY.finish;
      if (this.koedBy.has(c)) v += RIVALTY.koed;
      v += this.inRace.has(c) ? RIVALTY.inRace : RIVALTY.absent;
      out[c] = Math.min(RIVALTY.max, Math.max(RIVALTY.min, v));
    }
    const nemesis = this.session.config.nemesis ?? null;
    if (nemesis && this.kos.has(nemesis)) out[nemesis] = RIVALTY.nemesisAfterKo;
    return out;
  }

  /** Write the new grudge values (one save update at race:end). */
  apply(): void {
    const values = this.values();
    this.session.app.save.update((d) => {
      for (const c of RIVAL_SPECIES) {
        const v = values[c];
        if (v !== undefined) d.rivalry[c] = v;
      }
    });
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
