// Song data model. Songs are pure data (music/songs/*.ts); the SongPlayer interprets them.
//
// Lane notation (16 steps per bar; '|' between bars is optional and ignored):
//   drums  kick/snare/clap/hat/perc/tom/cym: one char per step.
//          X accent · x hit · o soft · g ghost · . rest   hat: O = open hat
//          perc: s shaker, t tambourine, b cowbell (uppercase = accent)
//          tom: 1 high · 2 mid · 3 low (uppercase = accent) · cym: C crash · R ride · W reverse swell
//   bass   space-separated tokens: degree relative to the bar's chord (1 b3 3 5 7 b7 8 9 …; plain 3/5/7
//          follow the chord quality), suffix , = octave down, ' = up, ^ = slap pop, > = thumb accent,
//          ~ = slide in from a tone below; x = dead note · - = tie · . = rest
//   keys/pad/brass/clav  chord hits on the bar's chord: X loud · x normal · s staccato · - tie · . rest
//          brass: f = hit with fall-off, r = rip up into it · clav: g = muted scratch
//   lead   note names (A4, C#5): suffix ~ = scoop up, - = tie, . = rest
//   chords one or more symbols per bar, bars separated by '|': 'Dm9 | G13 | Bbmaj7 A7#9'

export type Channel = 'drums' | 'bass' | 'keys' | 'clav' | 'brass' | 'lead' | 'pad' | 'fx';
export type LeadVoice = 'wah' | 'flute' | 'synth';

export interface Lanes {
  chords?: string;
  kick?: string;
  snare?: string;
  clap?: string;
  hat?: string;
  perc?: string;
  tom?: string;
  cym?: string;
  bass?: string;
  keys?: string;
  clav?: string;
  brass?: string;
  lead?: string;
  lead2?: string;   // harmony / octave line on a second lead voice
  pad?: string;
}

export type LaneName = keyof Lanes;

export interface Section extends Lanes {
  bars: number;
  /** Lead voice for this section's lead lanes (a solo on another instrument); default = the song's. */
  voice?: LeadVoice;
  /**
   * Lanes that replace the base lanes in the section's last bar (drum fills, pickups). Several
   * variants rotate: each pass through a section plays the next one.
   */
  fill?: Lanes | Lanes[];
  /** Adaptive layers: lanes that replace/add to the base while intensity ≥ the key (1 top-3, 2 final stretch). */
  layers?: { 1?: Lanes; 2?: Lanes };
  /** Section level (dB, default 0): macro-dynamics — a lighter opening, a louder climax. */
  gainDb?: number;
  /** 'breakdown' (8 bars): bars 1–4 sit 6 dB down behind a 900 Hz low-pass, bars 5–8 climb back as it opens. */
  shape?: 'breakdown';
}

export interface Song {
  id: string;
  title: string;
  bpm: number;
  /** 16th-note swing: fraction of a step the off-16ths are delayed (0 straight … 0.33 hard shuffle). */
  swing: number;
  /** Tonic + mode, e.g. 'A major', 'C minor', 'D dorian' (stingers are built in this key). */
  key: string;
  lead: LeadVoice;
  sections: Record<string, Section>;
  form: string[];
  /** Index in `form` to jump back to after the last section (seamless loop). */
  loopFrom: number;
  /** Form used while intensity 2 (final stretch) is active; entered after a one-bar build. */
  stretch?: string[];
  /** Final-stretch lift applied with the stretch form: tempo factor and transposition (semitones). */
  lift?: { tempo: number; semis: number };
  /** Section looped while a race intro / countdown runs (the song re-phases to bar 1 of A on GO). */
  vamp?: string;
  /** Song-wide adaptive layers (a section's own `layers` take precedence lane by lane). */
  layers?: { 1?: Lanes; 2?: Lanes };
  /** Channel gain trims for this song. */
  mix?: Partial<Record<Channel, number>>;
  crackle?: number;
  /** Arrangement notes for the status doc (critics can't listen). */
  notes: string;
}
