// The sea's colours, per track and per weather. The coast keeps its turquoise, the water town's
// canals are dark green-teal, rain and fog grey and pale the water, dusk warms it to the evening
// colours and the night city keeps its indigo.
import { Color } from 'three';
import type { EnvLook, TrackId, Weather } from '../../core/types';

export interface SeaPalette {
  deep: Color;
  mid: Color;
  shallow: Color;
  foam: Color;
}

interface Rgba { deep: string; mid: string; shallow: string; foam: string }

/** Noon turquoise (the coast), the night city's indigo, the canals' green-teal, the evening sea. */
const DAY: Rgba = { deep: '#1b78c2', mid: '#1fa6d3', shallow: '#5fdbd6', foam: '#ffffff' };
const NIGHT: Rgba = { deep: '#10184a', mid: '#1d2c78', shallow: '#2c4aa0', foam: '#7d86c8' };
const CANAL: Rgba = { deep: '#17352f', mid: '#2a574c', shallow: '#43796a', foam: '#cfe2d8' };
const DUSK: Rgba = { deep: '#3a2a4e', mid: '#c4693a', shallow: '#e8a45f', foam: '#ffd9b0' };

function palette(a: Rgba): SeaPalette {
  return { deep: new Color(a.deep), mid: new Color(a.mid), shallow: new Color(a.shallow), foam: new Color(a.foam) };
}

/** Scale a colour's saturation (in the colour's own working space) and pull it toward a grey. */
function wash(c: Color, base: Color, ratio: number, grey: Color, mix: number): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  const b = { h: 0, s: 0, l: 0 };
  c.lerp(grey, mix);
  c.getHSL(hsl);
  base.getHSL(b);
  // The saturation ends at a fixed share of the clear one, so a rainy sea is never as blue as a
  // clear one (mixing toward a grey can even raise the saturation, so it is set, not scaled).
  c.setHSL(hsl.h, b.s * ratio, hsl.l);
  return c;
}

/** A palette washed toward a grey: how much saturation is left and how far the water drifts. */
function washed(a: Rgba, ratio: number, greyHex: string, mix: number): SeaPalette {
  const grey = new Color(greyHex);
  const p = palette(a);
  const src = palette(a);
  return {
    deep: wash(p.deep, src.deep, ratio, grey, mix),
    mid: wash(p.mid, src.mid, ratio, grey, mix),
    shallow: wash(p.shallow, src.shallow, ratio, grey, mix),
    foam: wash(p.foam, src.foam, ratio * 0.6, grey, mix * 0.8),
  };
}

/**
 * The sea of one track in one weather. The night city never changes; the water town's canals stay
 * green-teal but grey with the weather; dusk warms every sea to the evening colours.
 */
export function seaPalette(id: TrackId, look: EnvLook, weather: Weather): SeaPalette {
  if (look.grade.night) return palette(NIGHT);
  const base = id === 'watertown' ? CANAL : DAY;
  if (weather === 'dusk') return palette(DUSK);
  if (weather === 'rain') return washed(base, 0.55, '#6b7a82', 0.45);
  if (weather === 'fog') return washed(base, 0.4, '#d2d9dc', 0.55);
  if (weather === 'snow') return washed(base, 0.5, '#c6d5e0', 0.4);
  return palette(base);
}
