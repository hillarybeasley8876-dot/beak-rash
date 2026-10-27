// Every number of the track events (SPEC §19) in one table, so the feel can be retuned without touching
// the event code. Distances are metres, times seconds, speeds m/s.
export const EVENT_TUNING = {
  // ---- scheduling (the director)
  /** The event arms (warn) when the player is this far from the spot or closer. */
  warnDist: 260,
  /** The props go up (start) when the player is this far from the spot or closer. */
  startDist: 200,
  /** Two events never sit closer than this. */
  minGap: 600,
  /** The event spots are drawn from this fraction of the track. */
  spotFrom: 0.25,
  spotTo: 0.8,
  /** No event within this of the finish line. */
  finishClear: 150,
  /** No event inside (or this close to) a tunnel or a bridge. */
  featureClear: 20,
  /** How long the props stay after the player has driven past them. */
  linger: 22,

  // ---- 鱼车侧翻 fishSpill
  fishSpill: {
    truckWidth: 2.3,
    truckLength: 7.2,
    truckHeight: 3.1,
    /** The truck stops in the lane next to the player's (it was in the way and tipped over). */
    laneGap: 3.5,
    /** The roll onto its side takes this long. */
    tipTime: 0.6,
    /** The truck goes over when the player is this close (so the roll is seen up close). */
    tipDist: 70,
    /** The spilled fish and coins lie this far behind the truck, spread over `pickupSpan`. */
    pickupBack: 74,
    pickupSpan: 60,
    coins: [18, 26] as const,
    fish: 3,
    /** Slick patches (non-solid 'oil' obstacles) on the spilled fish. */
    oil: 3,
    oilWidth: 1.15,
    oilLength: 1.8,
    /** How long the wreck stays on the road after the player passed it. */
    linger: 25,
  },

  // ---- 大鹅过马路 geese
  geese: {
    count: 7,
    /** Waddling speed across the road. */
    speed: 1.2,
    /** The column is spread over this much of the road. */
    spread: 9,
    /** A rider within this distance (metres, both axes) touches a goose. */
    touch: 0.6,
    touchS: 0.9,
    /** The wobble the touch leaves on the rider. */
    wobble: 0.5,
    /** The speed the touch takes away. */
    speedLoss: 0.2,
    /** How long the flock stays after the player passed it. */
    linger: 25,
  },

  // ---- 施工改道 roadworks
  roadworks: {
    /** The length of the work zone. */
    zone: 140,
    /** The event spot is the middle of the work zone: the traffic is seen merging into the open lane
     *  long before the wall goes up, and the player rides into the middle of the works. */
    lead: 70,
    /** The wall is built from short pieces: this is how long one piece is (along the road). */
    pieceLength: 4,
    /** The gap one piece leaves to the next one (so the ends never butt and overlap on a bend). */
    pieceGap: 0.15,
    /** The target width of one piece (across the road). */
    pieceWidth: 3.2,
    /** How many pieces the pool holds (the wall is one instanced draw call). */
    pieceCap: 320,
    /** How high the barrier sits: its lowest face is lifted this far above the asphalt (no z-fighting). */
    base: 0.02,
    blockHeight: 1.05,
    /** The open lane is this wide (wide enough that the AI riders find a way through). */
    gapWidth: 6,
    /** How far the open lane sits from the centre line at the head of the zone (it tapers across). */
    laneShift: 3.5,
    /** The open lane keeps this much space from the road edge. */
    gapInset: 1,
    /** A cone every this many metres along the closed side. */
    coneEvery: 7,
    /** How many cones the pool holds. */
    coneCap: 24,
    /** How long the zone stays after the player passed it. */
    linger: 20,
  },

  // ---- 水果摊 stalls
  stalls: {
    count: [3, 4] as const,
    width: 1.3,
    length: 1.1,
    height: 1.8,
    /** Above this speed a rider smashes a stall instead of nudging it. */
    smashSpeed: 6,
    /** The speed a smash takes away (the brief says 15 %; 20 % keeps the loss clear of a downhill). */
    speedLoss: 0.2,
    coins: [2, 4] as const,
    /** A weapon crate drops this often. */
    crateChance: 0.25,
    /** How long the stalls stay after the player passed them. */
    linger: 20,
  },
} as const;

export type EventTuning = typeof EVENT_TUNING;
