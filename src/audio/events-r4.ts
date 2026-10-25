// Bus → audio, part 3: the r4 events (SPEC §14–§21) — the police 2.0 cues, the r4 combat
// (parry, thrown weapons, the player's grunt), the air tricks, the STYLE chains, the rival drama
// (nemesis / alliance), the track events and the easter eggs. Everything is rate limited: a cue
// that can repeat (a wind-up, a style tick, a chain) never stacks.
import { hitSfx } from './events-combat';
import type { EventBus } from '../core/events';
import type { GameEvents } from '../core/events-map';
import type { Host, Where } from './host';
import type { PlayOpts } from './sfx/bank';

/** A cue the player must hear is never placed so quietly that it is missed under the music. */
const MIN_CUE_GAIN = 0.55;
/** Rate limits (s) of the repeating r4 cues. */
const GAP = {
  windup: 0.3, swing: 0.2, throw: 0.12, trick: 0.15, chain: 0.1, bank: 0.25,
  event: 0.5, secret: 0.3, wanted: 0.4, hurt: 0.12,
};
/** A thrown weapon's whoosh pitch (a slipper flutters, a pan sails). */
const THROW_PITCH: Record<string, number> = {
  slipper: 1.3, keyboard: 1.2, selfie: 1.15, leek: 1.1, saltfish: 0.95, umbrella: 1,
  baguette: 0.82, pan: 0.72, none: 1,
};
/** The sound of each track event starting. */
const EVENT_SFX: Record<string, string> = {
  fishSpill: 'race.event.fishSpill', geese: 'race.event.geese', roadworks: 'race.event.roadworks', stalls: 'race.event.stalls',
};

export function wireR4(bus: EventBus<GameEvents>, h: Host): void {
  const isPlayer = (id: number | null): boolean => h.isPlayer(id);

  /** Play a cue in the world, but never so quietly that the player misses it. */
  const cue = (id: string, where: Where, opts: PlayOpts = {}): void => {
    if (where === null || typeof where === 'number') {
      h.play(id, where, opts);
      return;
    }
    const p = h.place(where);
    h.play(id, null, {
      ...opts,
      volume: (opts.volume ?? 1) * Math.max(p.gain, MIN_CUE_GAIN),
      pan: (opts.pan ?? 0) + p.pan,
      lowpass: p.lowpass,
    });
  };

  // ---------------------------------------------------------------- police 2.0
  bus.on('police:wanted', ({ riderId, level, prev }) => {
    if (!isPlayer(riderId) || level <= prev) return;
    h.play(level >= 3 ? 'police.wanted3' : 'police.wanted');
    if (level >= 3) h.announce('ann_wanted3', 2);
  });
  bus.on('police:windup', ({ obstacleId, pos }) => {
    if (!h.cooldown(`windup${obstacleId}`, GAP.windup)) return;
    cue('police.windup', pos, { volume: 1.1 });
  });
  bus.on('police:swing', ({ obstacleId, pos, hit }) => {
    if (!h.cooldown(`pswing${obstacleId}`, GAP.swing)) return;
    cue('police.swing', pos, { volume: hit ? 1.1 : 0.9 });
  });
  bus.on('npc:hit', ({ victim, weapon, blocked, parried, pos }) => {
    if (parried) return;   // the parry has its own CLANG
    if (blocked) {
      cue('hit.block', pos);
      return;
    }
    cue(hitSfx(weapon), pos, { volume: 1 });
    // The player takes the baton: a grunt over the hit.
    if (isPlayer(victim)) cue('combat.hurt', pos, { volume: 0.9 });
  });
  bus.on('police:roadblock', ({ pos }) => cue('police.roadblock', pos));
  bus.on('police:down', ({ pos }) => {
    cue('police.down', pos, { volume: 1.1 });
  });
  bus.on('police:hurt', ({ obstacleId, pos }) => {
    if (!h.cooldown(`phurt${obstacleId}`, GAP.hurt)) return;
    cue('police.hurt', pos);
  });
  bus.on('police:bribe', ({ accepted }) => {
    h.play(accepted ? 'police.bribe.ok' : 'police.bribe.no');
  });

  // ---------------------------------------------------------------- r4 combat
  bus.on('combat:parry', ({ weapon, pos }) => {
    cue('combat.parry', pos, { volume: 1.15, impact: true });
    // The parried weapon's own sound, quieter, under the CLANG.
    cue(hitSfx(weapon), pos, { volume: 0.4 });
  });
  bus.on('combat:throw', ({ weapon, pos }) => {
    if (!h.cooldown('throw', GAP.throw)) return;
    cue('combat.throw', pos, { pitch: THROW_PITCH[weapon] ?? 1, volume: 0.9 });
  });

  // ---------------------------------------------------------------- tricks & STYLE
  bus.on('rider:trick', ({ riderId, phase, count }) => {
    if (phase === 'start') {
      if (!h.cooldown(`trick${riderId}`, GAP.trick)) return;
      h.play('trick.start', riderId, { volume: 0.8 });
      return;
    }
    if (phase !== 'land') return;   // a failed trick is the crash's business
    h.play('trick.land', riderId, { pitch: 1 + 0.1 * Math.max(0, count - 1), volume: 0.95 });
  });
  bus.on('style:chain', ({ riderId, count }) => {
    if (!isPlayer(riderId) || !h.cooldown('styleChain', GAP.chain)) return;
    h.play('style.chain', riderId, { pitch: 1 + 0.055 * Math.min(8, count), volume: 0.5 });
  });
  bus.on('style:bank', ({ riderId, total, broken }) => {
    if (!isPlayer(riderId)) return;
    if (broken) {
      h.play('style.broken', riderId, { volume: 0.7 });
      return;
    }
    // A big chain banks on a bigger register.
    const big = Math.min(1, total / 2000);
    h.play('style.bank', riderId, { volume: 0.7 + 0.3 * big, pitch: 1 + 0.06 * big });
  });

  // ---------------------------------------------------------------- rival drama
  // The nemesis and the alliance are the player's drama: they play centred, not in the world.
  bus.on('race:nemesis', ({ riderId, grudge }) => {
    h.play('race.nemesis', null, { volume: 1 });
    if (grudge >= 70) h.announce('ann_nemesis', 2);
  });
  bus.on('race:nemesisDown', () => {
    h.play('race.nemesisDown', null, { volume: 1.1 });
  });
  bus.on('race:alliance', ({ phase }) => {
    if (phase === 'form') {
      h.play('race.alliance', null, { volume: 1 });
      h.announce('ann_alliance', 2);
      return;
    }
    h.play('race.allianceBreak', null, { volume: 0.9 });
  });

  // ---------------------------------------------------------------- track events
  bus.on('race:event', ({ kind, phase, pos }) => {
    if (phase === 'warn') {
      if (!h.cooldown(`event${kind}`, GAP.event)) return;
      h.play('race.event.warn', null, { volume: 0.9 });
      h.announce(`ann_event_${kind}`, 2);
      return;
    }
    if (phase !== 'start') return;
    const id = EVENT_SFX[kind];
    if (id) cue(id, pos, { volume: 0.9 });
  });

  // ---------------------------------------------------------------- easter eggs
  bus.on('secret:found', ({ id, pos, riderId }) => {
    if (!h.cooldown(`secret${id}`, GAP.secret)) return;
    cue('secret.found', pos, { volume: 0.9 });
    // The rubber duck quacks.
    if (id.startsWith('duck_')) cue('secret.quack', pos, { volume: 0.9 });
    else if (id === 'goose_poem') cue('animal.goose', riderId, { volume: 0.8 });
  });

  // ---------------------------------------------------------------- voices
  bus.on('npc:say', ({ obstacleId, character, text }) => h.npcVoice(obstacleId, text, character));
}
