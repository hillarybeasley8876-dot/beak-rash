// Named bike colours and their surface finish. A part's gloss (0 matte rubber … 1 chrome) drives the body
// material's toon specular band, and chrome additionally gets two-tone sky/ground banding. PartSet uses
// glossOf() when a part does not set its own gloss: painted frame parts are gloss paint (0.5).
export const CHROME = '#d3d8df';
export const SILVER = '#c3c8d0';
export const ALLOY = '#c9ced6';
export const SPOKE = '#cfd3da';
export const STEEL = '#a9afb8';
export const DARK_METAL = '#55585f';
export const FITTING = '#3a3d44';
export const ANODIZED = '#2b2d33';
export const GOLD = '#d9b44a';

const FINISH: Record<string, number> = {
  [CHROME]: 1, [SILVER]: 1, [ALLOY]: 1, [SPOKE]: 1, [STEEL]: 0.9, '#d9dde3': 1, '#b9bec7': 0.9,
  '#8d939c': 0.8, '#9aa0a8': 0.8, '#8e949c': 0.7, '#585c63': 0.6, [DARK_METAL]: 0.6, [FITTING]: 0.35,
  [ANODIZED]: 0.35, [GOLD]: 0.8, '#e0b84c': 0.8, '#c9a24a': 0.8, '#fff6b8': 0.6,
};

export const PAINT_GLOSS = 0.5;
/** Gloss value marking self-lit parts (tail lights, lamp lenses): the body material shows their colour unlit. */
export const GLOW = 2;

export function glossOf(color: string | undefined, paint: number | undefined): number {
  if ((paint ?? 0) > 0) return PAINT_GLOSS;
  return color ? FINISH[color.toLowerCase()] ?? 0 : 0;
}
