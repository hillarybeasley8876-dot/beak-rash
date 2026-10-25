// r4 event reactions (fx unit, SPEC §14-§19): the landed trick, the pan parry, the thrown weapon, the
// downed corgi, the track events (the tipped fish truck, the goose flock, the smashed fruit stall) and the
// easter eggs. Every reaction reads the position it is given and falls back to the tracked rider.
import { Vector3 } from 'three';
import type { Obstacle, RiderId, Vec3Like } from '../../core/types';
import type { FxContext } from '../context';
import type { FxPart } from '../system';

const tmp = new Vector3();

/** The world position of an obstacle on the road. */
function obstacleAt(ctx: FxContext, id: number): { pos: Vec3Like; obstacle: Obstacle } | null {
  const session = ctx.session();
  if (!session) return null;
  const obstacle = session.obstacles.find((o) => o.id === id);
  if (!obstacle) return null;
  const p = session.track.toWorld(obstacle.s, obstacle.x, 0, tmp);
  return { pos: { x: p.x, y: p.y, z: p.z }, obstacle };
}

/** A point in front of the player (used when an event has no position of its own). */
function aheadOfPlayer(ctx: FxContext, ahead: number, up: number): Vec3Like {
  const session = ctx.session();
  if (!session) return { x: 0, y: 1, z: 0 };
  const t = ctx.tracker.get(session.player.id);
  const fwd = t?.fwd ?? new Vector3(0, 0, -1);
  const p = t?.pos ?? tmp.set(0, 0, 0);
  return { x: p.x + fwd.x * ahead, y: p.y + up, z: p.z + fwd.z * ahead };
}

/** The direction of a throw: along the track, forwards or backwards. */
function throwDir(ctx: FxContext, riderId: RiderId, dir: 1 | -1): Vec3Like {
  const session = ctx.session();
  const r = session?.rider(riderId);
  if (session && r) {
    const f = session.track.frameAt(r.s);
    return { x: f.tangent.x * dir, y: 0.2, z: f.tangent.z * dir };
  }
  return { x: 0, y: 0.2, z: -dir };
}

/** Subscribe every r4 reaction. Returns the unsubscribe functions. */
export function subscribeR4(ctx: FxContext): Array<() => void> {
  const { bus } = ctx.app;

  return [
    // The landed trick: a star burst and a ring on the ground, bigger with the number of tricks.
    bus.on('rider:trick', (e) => {
      const t = ctx.tracker.get(e.riderId);
      if (e.phase === 'land') {
        const at = t?.body ?? { x: 0, y: 1, z: 0 };
        ctx.burst('trickLand', at, { vel: t?.vel, ground: t?.ground, level: Math.max(1, e.count), dir: t?.fwd });
      } else if (e.phase === 'fail') {
        const at = t?.pos ?? { x: 0, y: 0.5, z: 0 };
        ctx.burst('dust', at, { vel: t?.vel, ground: t?.ground, count: 6 });
        ctx.burst('sparks', at, { vel: t?.vel });
      }
    }),
    // The pan parry: the "当！" moment.
    bus.on('combat:parry', (e) => {
      const v = ctx.tracker.get(e.riderId);
      ctx.burst('parry', e.pos, { vel: v?.vel, ground: v?.ground, scale: 1.1 });
    }),
    // A thrown weapon leaving the hand: a fan of streaks in the throw direction.
    bus.on('combat:throw', (e) => {
      const v = ctx.tracker.get(e.riderId);
      const color = e.weapon === 'slipper' ? '#ff6fae' : '#ffe600';
      ctx.burst('throwTrail', e.pos, { vel: v?.vel, dir: throwDir(ctx, e.riderId, e.dir), color, scale: 1.1 });
    }),
    // A keyboard crit sprays keycaps.
    bus.on('combat:hit', (e) => {
      if (e.weapon !== 'keyboard' || !e.crit || e.blocked) return;
      ctx.burst('keys', e.pos, { count: 9, scale: 1.2 });
    }),
    // The corgi: knocked down, or hit and still standing.
    bus.on('police:down', (e) => {
      ctx.burst('policeDown', e.pos, { ground: e.pos.y - 0.8, scale: 1.1 });
    }),
    bus.on('police:hurt', (e) => {
      ctx.burst('hit', e.pos, { scale: 0.8 });
    }),
    // Track events: the tipped fish truck and the goose flock crossing the road.
    bus.on('race:event', (e) => {
      if (e.phase !== 'start') return;
      if (e.kind === 'fishSpill') {
        ctx.burst('truckDust', e.pos, { ground: e.pos.y - 0.6, scale: 1.2 });
        ctx.burst('fishSplash', e.pos, { ground: e.pos.y - 0.6, scale: 1.1 });
      } else if (e.kind === 'geese') {
        ctx.burst('gooseFeathers', e.pos, { ground: e.pos.y - 0.6, scale: 1.1 });
      }
    }),
    // A honking goose loses feathers.
    bus.on('traffic:honk', (e) => {
      const found = obstacleAt(ctx, e.obstacleId);
      if (!found || found.obstacle.kind !== 'goose') return;
      ctx.burst('gooseFeathers', found.pos, { ground: found.pos.y - 0.4, scale: 0.9 });
    }),
    // The stall owner shouting: the fruit goes everywhere.
    bus.on('npc:say', (e) => {
      const found = obstacleAt(ctx, e.obstacleId);
      if (!found || found.obstacle.kind !== 'stall') return;
      ctx.burst('fruit', found.pos, { ground: found.pos.y - 0.4, scale: 1.1 });
    }),
    // An easter egg: a rubber duck quacks, anything else is a small celebration.
    bus.on('secret:found', (e) => {
      const at = e.pos ?? aheadOfPlayer(ctx, 3, 1.4);
      if (e.id.startsWith('duck_')) {
        ctx.burst('quack', at, { scale: 1.1 });
        return;
      }
      ctx.burst('confetti', at, { scale: 0.8 });
      ctx.burst('sparkle', at, { scale: 1 });
    }),
  ];
}

/** The r4 reactions as one fx part (subscribed for the app's lifetime). */
export function r4Reactions(ctx: FxContext): FxPart {
  const offs = subscribeR4(ctx);
  return {
    dispose: () => {
      for (const off of offs) off();
    },
  };
}
