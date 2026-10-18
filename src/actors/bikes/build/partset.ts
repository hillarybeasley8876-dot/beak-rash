// Collects bike parts (geometry + colour + outline width + paint/decal flags + bone) and merges a whole
// bike into ONE indexed, rigidly skinned BufferGeometry (each part follows one bone: frame, wheels, crank,
// pedals, steer…), so a bike costs two draw calls. Outlined parts come first so the hull can draw only
// them (it shares the attributes and index, with a shorter drawRange).
import { BufferAttribute, BufferGeometry, Color, SRGBColorSpace } from 'three';
import { WHITE_UV, type UvRect } from './atlas';
import { GLOW, glossOf } from './palette';

export interface PartOpts {
  /** Flat colour; omitted = keep the geometry's own 'color' attribute (white if none). */
  color?: string;
  /** Hull width in metres as seen from 6 m (0/omitted = no outline). */
  outline?: number;
  /** > 0: tintable frame paint; the tint is multiplied by this shade. */
  paint?: number;
  /** Surface finish 0 (matte) … 1 (chrome); default from the palette (build/palette.ts). */
  gloss?: number;
  /** Self-lit (tail lights, lamp lenses): full colour in shade and at night, no shading. */
  glow?: boolean;
  /** Map the geometry's uv (0..1) into this atlas rectangle. */
  decal?: UvRect;
  /** Skeleton bone the part follows (set by PartSet.absorb; 0 = frame). */
  bone?: number;
}

export interface BuiltGroup {
  geo: BufferGeometry;
  hull: BufferGeometry | null;
  paintIdx: Uint32Array;
  paintShade: Float32Array;
  tris: number;
}

const tmpC = new Color();

/** Per-vertex normals averaged over coincident positions (crack-free hull extrusion). */
function smoothNormals(g: BufferGeometry): Float32Array {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const acc = new Map<string, [number, number, number]>();
  const key = (i: number): string => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i), a = acc.get(k) ?? [0, 0, 0];
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
    acc.set(k, a);
  }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i)) as [number, number, number];
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  return out;
}

export class PartSet {
  private parts: Array<{ geo: BufferGeometry; o: PartOpts }> = [];

  add(geo: BufferGeometry, o: PartOpts = {}): this {
    this.parts.push({ geo, o });
    return this;
  }

  get empty(): boolean { return this.parts.length === 0; }

  /** Take over another set's parts, bound to `bone`. */
  absorb(other: PartSet, bone: number): this {
    for (const p of other.parts) this.parts.push({ geo: p.geo, o: { ...p.o, bone } });
    other.parts = [];
    return this;
  }

  /** Merge everything (bike space = bind pose). */
  build(): BuiltGroup {
    const parts = [...this.parts].sort((a, b) => Number((b.o.outline ?? 0) > 0) - Number((a.o.outline ?? 0) > 0));
    let nv = 0, ni = 0;
    for (const { geo } of parts) {
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      nv += geo.getAttribute('position').count;
      ni += geo.index ? geo.index.count : geo.getAttribute('position').count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2), ow = new Float32Array(nv), on = new Float32Array(nv * 3), gl = new Float32Array(nv);
    const skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4);
    const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const paintIdx: number[] = [], paintShade: number[] = [];
    let vo = 0, io = 0, hullCount = 0;
    for (const { geo, o } of parts) {
      const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
      const gc = geo.getAttribute('color'), gu = geo.getAttribute('uv');
      const width = o.outline ?? 0;
      const sn = width > 0 ? smoothNormals(geo) : null;
      const flat = o.color !== undefined ? tmpC.set(o.color).clone() : null;
      const gloss = o.glow ? GLOW : o.gloss ?? glossOf(o.color, o.paint);
      for (let i = 0; i < p.count; i++) {
        const k = vo + i;
        pos[k * 3] = p.getX(i); pos[k * 3 + 1] = p.getY(i); pos[k * 3 + 2] = p.getZ(i);
        nor[k * 3] = n.getX(i); nor[k * 3 + 1] = n.getY(i); nor[k * 3 + 2] = n.getZ(i);
        let r = 1, g = 1, b = 1;
        if (gc) { r = gc.getX(i); g = gc.getY(i); b = gc.getZ(i); }
        if (flat) { r *= flat.r; g *= flat.g; b *= flat.b; }
        col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
        if (o.decal && gu) {
          uv[k * 2] = o.decal.u0 + gu.getX(i) * (o.decal.u1 - o.decal.u0);
          uv[k * 2 + 1] = o.decal.v0 + gu.getY(i) * (o.decal.v1 - o.decal.v0);
        } else { uv[k * 2] = WHITE_UV[0]; uv[k * 2 + 1] = WHITE_UV[1]; }
        ow[k] = width;
        gl[k] = gloss;
        const src = sn ?? null;
        on[k * 3] = src ? (src[i * 3] as number) : n.getX(i);
        on[k * 3 + 1] = src ? (src[i * 3 + 1] as number) : n.getY(i);
        on[k * 3 + 2] = src ? (src[i * 3 + 2] as number) : n.getZ(i);
        if ((o.paint ?? 0) > 0) { paintIdx.push(k); paintShade.push(o.paint as number); }
        skinIndex[k * 4] = o.bone ?? 0;
        skinWeight[k * 4] = 1;
      }
      const cnt = geo.index ? geo.index.count : p.count;
      for (let j = 0; j < cnt; j++) index[io + j] = vo + (geo.index ? geo.index.getX(j) : j);
      io += cnt;
      if (width > 0) hullCount = io;
      vo += p.count;
      geo.dispose();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nor, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setAttribute('gloss', new BufferAttribute(gl, 1));
    const si = new BufferAttribute(skinIndex, 4), sw = new BufferAttribute(skinWeight, 4);
    geo.setAttribute('skinIndex', si);
    geo.setAttribute('skinWeight', sw);
    geo.setIndex(new BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    let hull: BufferGeometry | null = null;
    if (hullCount > 0) {
      hull = new BufferGeometry();
      hull.setAttribute('position', geo.getAttribute('position'));
      hull.setAttribute('aOutline', new BufferAttribute(ow, 1));
      hull.setAttribute('aOutlineN', new BufferAttribute(on, 3));
      hull.setAttribute('skinIndex', si);
      hull.setAttribute('skinWeight', sw);
      hull.setIndex(geo.index);
      hull.setDrawRange(0, hullCount);
      hull.boundingSphere = geo.boundingSphere?.clone() ?? null;
      if (hull.boundingSphere) hull.boundingSphere.radius += 0.08;
    }
    return { geo, hull, paintIdx: new Uint32Array(paintIdx), paintShade: new Float32Array(paintShade), tris: ni / 3 };
  }
}

const hsl = { h: 0, s: 0, l: 0 };
/** Tint colour with very dark tints lifted (sRGB lightness ≥ .3) so a black rival frame still shows its shape. */
export function liftTint(tint: string): Color {
  const c = new Color(tint);
  c.getHSL(hsl, SRGBColorSpace);
  if (hsl.l < 0.3) c.setHSL(hsl.h, hsl.s, 0.3, SRGBColorSpace);
  return c;
}

/** A colour attribute for `g` with its paint vertices (the main frame tubes) recoloured to `tint` × shade. */
export function tintColors(g: BuiltGroup, tint: string): BufferAttribute {
  const base = g.geo.getAttribute('color').array as Float32Array;
  const out = new Float32Array(base);
  const c = liftTint(tint);
  for (let i = 0; i < g.paintIdx.length; i++) {
    const k = g.paintIdx[i] as number, s = g.paintShade[i] as number;
    out[k * 3] = c.r * s; out[k * 3 + 1] = c.g * s; out[k * 3 + 2] = c.b * s;
  }
  return new BufferAttribute(out, 3);
}
