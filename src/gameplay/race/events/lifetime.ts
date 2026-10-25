// The shared lifetime of an event's props (SPEC §19): they stay on the road until the player has driven
// past them, then linger a while (the wreck is swept away, the market packs up) before the director
// reports the event as ended.
export class Lifetime {
  private passed = false;
  private left = 0;

  /**
   * @param linger  seconds the props stay after the player passed them
   * @param passAt  the player's s at which the props count as passed
   */
  constructor(private readonly linger: number, private readonly passAt: number) {}

  /** Has the player driven past the props? */
  get isPassed(): boolean {
    return this.passed;
  }

  /** Advance the clock; true when the props are done and may be removed. */
  update(playerS: number, dt: number): boolean {
    if (!this.passed) {
      if (playerS <= this.passAt) return false;
      this.passed = true;
      this.left = this.linger;
    }
    this.left -= dt;
    return this.left <= 0;
  }
}
