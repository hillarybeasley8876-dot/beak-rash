// Police 2.0 tuning (SPEC §14). Every number of the wanted stars, the baton, the backup, the
// roadblock and the 「V我50」 bribe lives here; the code only reads them.
export const T = {
  // ---- wanted stars (heat hysteresis) ----
  /** Heat at which the chase starts (★1). */
  w1: 0.5,
  /** Heat at which the officer arms its baton (★2). */
  w2: 0.75,
  /** Heat at which the backup and the roadblock come (★3). The line is crossed *above* this heat. */
  w3: 0.95,
  /** The level drops back when the heat falls under these lines (hysteresis). */
  w1Drop: 0.42,
  w2Drop: 0.68,
  w3Drop: 0.9,
  /** Two knocks on the officer in one chase → ★2. */
  knockBump: 2,
  /** A rival KO this close to the officer → ★2. */
  koRadius: 30,
  /** Two refused bribes → ★3. */
  refuseBump: 2,

  // ---- the baton (★2 and up) ----
  /** Wind-up time (s) at ★2 / ★3. */
  windup: 0.45,
  windupW3: 0.35,
  /** The wind-up starts when the officer is this close along the track (m). */
  reachDs: 1.5,
  /** …and this far to the side (m): the officer strikes from its own side of the player. */
  lateralMin: 0.5,
  lateralMax: 1.8,
  /** The swing connects inside this box (m): along the track, to the side, and the player's height. */
  hitDs: 1.6,
  /** The baton also catches a rider this far *behind* the officer (a forward sweep, m). */
  hitBehind: 1.0,
  hitLateral: 1.9,
  hitHeight: 0.5,
  /** Seconds between two wind-ups (★2 / ★3). */
  cooldown: 2.2,
  cooldownW3: 1.6,
  /** Two officers never wind up within this many seconds of each other. */
  windupGap: 0.6,
  /** The damage of a baton hit (★2 / ★3) and the knock it adds. */
  damage: 10,
  damageW3: 14,
  knock: 4.2,
  /** The officer lunges while it winds up: this much extra speed (m/s) on top of the player's. */
  lunge: 1.6,
  lungeAccel: 12,
  /** At ★2+ the officer rides just behind the player instead of level with it (m behind). */
  tailGap: 0.2,
  /** The officer's HP and how long it sits up after being knocked out. */
  hp: 60,
  downTime: 3,

  // ---- backup (★3) ----
  /** Seconds after the ★3 chase starts when the second corgi sprints in. */
  backupDelay: 4,
  /** Seconds after a corgi goes down when a backup arrives (if none is out). */
  backupDelayDown: 6,

  // ---- roadblock (★3, once per chase) ----
  /** How far ahead of the player the block goes up (m). */
  aheadMin: 220,
  aheadMax: 300,
  /** The width of the one gap in the block (m) and the width of one barrier (m). */
  gapWidth: 3.2,
  barrierWidth: 2,
  /** Never inside this distance of the finish (m). */
  finishMargin: 150,
  /** The block is taken down this many seconds after the player has passed it. */
  lifetime: 20,
  /** The block goes up this many seconds after the stars reach ★3 (the backup is out by then). */
  delay: 4.5,
  /** Hitting a barrier faster than this is a police crash (m/s) → bust. */
  crashSpeed: 8,

  // ---- 「V我50」 ----
  /** The price of a bribe (race coins) and how close the player must be (m). */
  price: 50,
  reach: 6,
  /** Bribes allowed per race. */
  maxBribes: 2,
  /** After an accepted bribe: the heat and how long no new chase starts (s). */
  heatAfter: 0.15,
  noChaseTime: 30,
  /** A refused bribe adds this much heat. */
  refuseHeat: 0.1,
  /** The minimum gap between two lines from the same officer (s). */
  sayGap: 2.5,

  // ---- extra heat ----
  /** A thrown weapon that hits an officer. */
  thrownHit: 0.1,
  /** A rival KO near an officer. */
  rivalKo: 0.15,
  /** Hitting traffic near an officer (m). */
  trafficRadius: 40,
  trafficHit: 0.05,
  /** In a tunnel the heat cools this much faster while every officer is far behind (m). */
  tunnelGap: 15,
  tunnelCool: 2,
} as const;

/** The old chase (SPEC §9): heat, the chase timers, the fine and the escape rules. */
export const CHASE = {
  /** The heat at which the officer comes (★1). */
  spawnHeat: 0.5,
  /** m behind the player it spawns (out of the chase camera, close enough to arrive in ~3 s). */
  spawnBehind: 20,
  /** No new chase in the last 10 % of the track. */
  spawnBefore: 0.9,
  /** × the player's flat top: slower than this next to the officer counts toward BUSTED. */
  slow: 0.6,
  /** s next to the officer while slow or wrecked before the ticket. */
  bustTime: 2,
  /** The fine (race coins) and the ticket stop (s). */
  fine: 100,
  penalty: 4,
  /** s between two whistles. */
  whistleCd: 9,
  /** s before a new chase may start. */
  chaseCooldown: 20,
  /** m held for s: the only escape ('lost'). */
  loseGap: 60,
  loseTime: 2,
  /** An officer this far back for this long lets the player go. */
  farGap: 38,
  farTime: 3,
  /** s far back before the officer's one out-of-sight shortcut. */
  shortcutAfter: 1,
  /** m the player must pull away from the officer's closest approach to escape. */
  leadBuilt: 25,
  /** s: no escape before the chase has really begun. */
  minChase: 8,
  /** m: the officer has caught up with the player this chase. */
  reached: 6,
  /** A calm heat and a calm lead end the chase as a let-go. */
  calmHeat: 0.3,
  calmGap: 15,
  letGoHeat: 0.12,
  /** Behind the chase camera for this long: re-sprint once, then give up. */
  trailGap: 4.5,
  trailTime: 2,
  /** s even while sprinting before it gives up. */
  stuckTime: 7,
  /** s: the chase ends. */
  max: 25,
  /** m clearance from other riders at the spot beside the player. */
  sideClear: 1.2,
  /** Knocking the officer about is an offence too. */
  knockHeat: 0.05,
  /** s: the pelican.wing duration (SPEC §7). */
  wingTime: 2.2,
} as const;

/** The lines the officer says when it lets the player go. */
export const LET_GO_LINES = ['算了，下不为例。', '今天心情好，放你一马。', '下次再让我看见……就算了。'];
