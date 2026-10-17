// Helpers for writing song data compactly.
import { noteToMidi } from '../theory';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Join bar strings with the '|' bar separator. */
export const bars = (...lines: string[]): string => lines.join(' | ');

/** Repeat one bar (or phrase) n times. */
export const rep = (line: string, n: number): string => Array.from({ length: n }, () => line).join(' | ');

/** Transpose a lead line by semitones (keeps ties, rests and scoops). */
export function transpose(line: string, semis: number): string {
  return line
    .split(/(\s+|\|)/)
    .map((tok) => {
      if (!/^[A-G][#b]?-?\d~?$/.test(tok)) return tok;
      const scoop = tok.endsWith('~');
      const midi = noteToMidi(scoop ? tok.slice(0, -1) : tok) + semis;
      return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}${scoop ? '~' : ''}`;
    })
    .join('');
}
