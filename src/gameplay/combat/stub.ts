// STUB kept by core for isolation tests (?stub=...) and as load fallback. The combat unit owns index.ts: only the KO path, so debug.ko() and crashes work.
// Contract: createCombat(session) → CombatSystem (core/contracts.ts).
import { Vector3 } from 'three';
import type { CombatSystem, Session } from '../../core/contracts';

export function createCombat(session: Session): CombatSystem {
  const { bus } = session.app;
  return {
    preStep() {},
    postStep() {
      for (const r of session.riders) {
        if (r.hp > 0 || r.mode !== 'racing') continue;
        const pos = session.track.toWorld(r.s, r.x, r.y, new Vector3());
        r.wrecked++;
        const attacker = r.lastHitBy !== null ? session.rider(r.lastHitBy) : undefined;
        if (attacker) attacker.kos++;
        session.physics.crash(r, 'ko', r.lastHitBy);
        bus.emit('combat:ko', { attacker: r.lastHitBy, victim: r.id, cause: 'ko', pos, skillId: null, weapon: 'none' });
      }
    },
    dispose() {},
  };
}
