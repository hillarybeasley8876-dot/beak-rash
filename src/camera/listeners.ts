// Bus listeners of the camera rig: trauma shakes, FOV kicks, landing dips, respawn glide, scrape buzz.
import { clamp } from '../core/math';
import { boostKick, RIG, type RigState } from './rig-state';
import type { RiderId } from '../core/types';

export function listenRig(st: RigState): void {
  const { bus } = st.app;
  const { fx, chase } = st;
  const isPlayer = (id: RiderId | null): boolean => st.session !== null && id === st.session.player.id;
  bus.on('cam:shake', ({ intensity, duration }) => fx.shake(intensity, duration));
  bus.on('cam:kick', ({ fov, duration }) => fx.kick(fov, duration));
  bus.on('hitstop', ({ seconds }) => {
    fx.kick(-3, seconds + 0.12);
    fx.shake(0.12, seconds + 0.1);
  });
  bus.on('rider:crash', ({ riderId }) => { if (isPlayer(riderId)) fx.shake(0.6, 0.9); });
  bus.on('rider:respawn', ({ riderId }) => {
    if (!isPlayer(riderId) || !st.session) return;
    chase.reset(st.session);
    if (!st.cine) st.blend.start(st.app.camera, RIG.respawnBlend); // glide to the new spot instead of cutting
  });
  bus.on('rider:land', ({ riderId, airTime, perfect }) => {
    if (!isPlayer(riderId)) return;
    fx.shake(Math.min(0.5, 0.15 * airTime), 0.3);
    chase.dip(clamp(0.04 + 0.25 * airTime, 0, 0.45));
    if (!perfect && airTime >= 0.5) fx.kick(-2, 0.12); // hard landing: a short punch-in
  });
  bus.on('rider:boost', ({ riderId, power, time }) => {
    if (!isPlayer(riderId)) return;
    boostKick(st, power, time);
    st.boostKicked = true;
  });
  bus.on('combat:hit', ({ attacker, victim, heavy, crit }) => {
    if (isPlayer(attacker) || isPlayer(victim)) fx.shake(heavy || crit ? 0.45 : 0.25, heavy || crit ? 0.35 : 0.25);
  });
  bus.on('rider:bump', ({ a, b, strength }) => { if (isPlayer(a) || isPlayer(b)) fx.shake(Math.min(0.35, 0.05 * strength), 0.25); });
  bus.on('rider:obstacleHit', ({ riderId, kind, speed }) => {
    if (!isPlayer(riderId)) return;
    if (kind === 'wallScrape') st.scrapeUntil = st.app.clock.realTime + RIG.scrapeHold; // continuous: buzz, not trauma
    else fx.shake(kind === 'wall' ? Math.min(0.4, 0.05 * speed + 0.05) : 0.35, 0.3);
  });
}
