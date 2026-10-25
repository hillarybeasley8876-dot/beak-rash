// Geometry cache: one template per (bike, quality) built on first use, plus colour variants per tint, and per
// bike one far-LOD template (quality-independent: a third of the segments, no detail parts) skinned to the same
// bones. Templates are ref-counted by live instances: at zero their GPU buffers are released (CPU data stays,
// so the next race re-uploads instead of rebuilding). Tint variants own only their colour attribute.
import { BufferGeometry } from 'three';
import type { BikeId, Quality } from '../../core/types';
import { tintColors, type BuiltGroup } from './build/partset';
import { BIKE_DEFS } from './defs';
import { BikeBuilder, type BikeDef, type TemplateGroup, type TemplateMarker } from './template';

export interface BikeTemplate {
  def: BikeDef;
  quality: Quality;
  built: BuiltGroup;
  groups: TemplateGroup[];
  markers: TemplateMarker[];
  tris: number;
  drawCalls: number;
}

interface Entry { key: string; tpl: BikeTemplate; refs: number }
interface Variant { geo: BufferGeometry | null; refs: number }

const templates = new Map<string, Entry>();
const variants = new Map<string, Variant>();

export function buildTemplate(id: BikeId, quality: Quality, far = false): BikeTemplate {
  const def = BIKE_DEFS[id];
  const b = new BikeBuilder(quality, far);
  def.build(b);
  const { built, groups, markers } = b.bake();
  return { def, quality, built, groups, markers, tris: built.tris, drawCalls: built.hull ? 2 : 1 };
}

/** The far build declares the same groups as the full one; point its skin indices at the full build's bones
 *  (both draw over one skeleton), whatever order the groups were declared in. */
function matchBones(far: BikeTemplate, full: BikeTemplate): BikeTemplate {
  const map = [0, ...far.groups.map((g) => full.groups.findIndex((f) => f.name === g.name) + 1)];
  if (map.includes(0, 1)) throw new Error(`[bikes] ${far.def.id}: far-LOD group missing from the full build`);
  if (map.some((m, i) => m !== i)) {
    const si = far.built.geo.getAttribute('skinIndex');
    for (let k = 0; k < si.count; k++) si.setX(k, map[si.getX(k)] ?? 0);
  }
  return far;
}

function entry(key: string, build: () => BikeTemplate): Entry {
  let e = templates.get(key);
  if (!e) {
    e = { key, tpl: build(), refs: 0 };
    templates.set(key, e);
  }
  return e;
}

/** Same attributes and index as the template, but its own tinted colour buffer. */
function makeVariant(tpl: BikeTemplate, tint: string): Variant {
  const g = tpl.built;
  if (!g.paintIdx.length) return { geo: null, refs: 0 };
  const geo = new BufferGeometry();
  for (const [name, attr] of Object.entries(g.geo.attributes)) if (name !== 'color') geo.setAttribute(name, attr);
  geo.setAttribute('color', tintColors(g, tint));
  geo.setIndex(g.geo.index);
  geo.boundingSphere = g.geo.boundingSphere;
  return { geo, refs: 0 };
}

/** Free only the variant's own colour buffer (shared attributes stay on the GPU). */
function disposeVariant(v: Variant): void {
  const geo = v.geo;
  if (!geo) return;
  for (const name of Object.keys(geo.attributes)) if (name !== 'color') geo.deleteAttribute(name);
  geo.setIndex(null);
  geo.dispose();
}

/** One reference on a template (and its tint variant): the body geometry to draw, and how to let go of it. */
function hold(e: Entry, tint: string | undefined): { body: BufferGeometry; release(): void } {
  e.refs++;
  const vkey = tint ? `${e.key}|${tint.toLowerCase()}` : null;
  let variant: Variant | null = null;
  if (vkey) {
    variant = variants.get(vkey) ?? makeVariant(e.tpl, tint as string);
    variants.set(vkey, variant);
    variant.refs++;
  }
  return {
    body: variant?.geo ?? e.tpl.built.geo,
    release: () => {
      if (variant && vkey && --variant.refs <= 0) {
        disposeVariant(variant);
        variants.delete(vkey);
      }
      if (--e.refs <= 0) {
        e.tpl.built.geo.dispose();
        e.tpl.built.hull?.dispose();
      }
    },
  };
}

export interface Lease {
  tpl: BikeTemplate;
  /** The distance LOD (same bones as `tpl`). */
  far: BikeTemplate;
  /** Body geometries under this lease's tint. */
  body: BufferGeometry;
  farBody: BufferGeometry;
  release(): void;
}

export function acquire(id: BikeId, quality: Quality, tint?: string): Lease {
  const full = entry(`${id}|${quality}`, () => buildTemplate(id, quality));
  const far = entry(`${id}|far`, () => matchBones(buildTemplate(id, quality, true), full.tpl));
  const a = hold(full, tint), b = hold(far, tint);
  let released = false;
  return {
    tpl: full.tpl,
    far: far.tpl,
    body: a.body,
    farBody: b.body,
    release: () => {
      if (released) return;
      released = true;
      a.release();
      b.release();
    },
  };
}
