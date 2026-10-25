// Easter egg tuning (SPEC §21). Every number the secrets module uses lives here, not inline in the logic.
export const DUCK = {
  findRadius: 1.2,     // m: the player is this close → the duck is found
  bobAmp: 0.035,       // m: the rubber duck bobs gently
  bobRate: 1.7,        // rad/s
  sFrom: 0.3,          // fraction of the track: the duck hides between 30 % and 85 %
  sTo: 0.85,
  edgeIn: 0.5,         // m from the asphalt edge: the closest the duck sits to the kerb
  edgeOut: 1.5,        // m from the asphalt edge: the furthest (still on the asphalt, still reachable)
  quack: 'ui.coin',    // sfx id until the audio unit grows a real quack
} as const;

export const EASEL = {
  sFrom: 0.4,          // fraction of the track: the easel stands at a scenic spot
  sTo: 0.7,
  beyond: 0.8,         // m past the drivable edge (it cannot be ridden into)
  halfWidth: 0.8,      // m: the obstacle box
  halfLength: 0.4,
  height: 2.2,
  coins: 50,
  spin: 7,             // rad/s: the easel spins when a thrown weapon hits it
} as const;

export const GOOSE = {
  presses: 3,          // bell presses …
  window: 5,           // … within 5 s
  range: 8,            // m: the goose must be this close
  berserk: 8,          // s: the goose stays angry
  boostPower: 0.15,    // +15 % top speed while berserk
} as const;

export const SLOTH = {
  idle: 8,             // s without pedalling after GO
  speed: 1,            // m/s: below this the player counts as idle
  stop: 2,             // s: the sloth stops too
  slow: 0.6,           // the slow status strength while it stops
  boost: 3,            // s: then it floors it
  boostPower: 0.6,
} as const;

export const GOD = {
  odds: 15,            // 1 race in 15
  minDelay: 30,        // s after GO …
  maxDelay: 120,       // … the god shows up somewhere in here
  duration: 12,        // s: it drifts across the sky
  height: 40,          // m above the road
  ahead: 100,          // m ahead of the player
  spread: 50,          // m: how far it drifts sideways while it crosses
  coins: 50,
} as const;

/** The five ducks (one per track). Finding all of them unlocks the duck rider. */
export const DUCK_IDS = ['duck_coast', 'duck_city', 'duck_mountain', 'duck_watertown', 'duck_gobi'] as const;
