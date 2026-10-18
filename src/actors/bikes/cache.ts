// Geometry cache: one template per (bike, quality) built on first use, plus colour variants per tint.
// Templates are ref-counted by live instances: at zero their GPU buffers are released (CPU data stays,
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

interface Entry { tpl: BikeTemplate; refs: number }
interface Variant { geo: BufferGeometry | null; refs: number }

const templates = new Map<string, Entry>();
const variants = new Map<string, Variant>();

export function buildTemplate(id: BikeId, quality: Quality): BikeTemplate {
  const def = BIKE_DEFS[id];
  const b = new BikeBuilder(quality);
  def.build(b);
  const { built, groups, markers } = b.bake();
  return { def, quality, built, groups, markers, tris: built.tris, drawCalls: built.hull ? 2 : 1 };
}

function entry(id: BikeId, quality: Quality): Entry {
  const key = `${id}|${quality}`;
  let e = templates.get(key);
  if (!e) {
    e = { tpl: buildTemplate(id, quality), refs: 0 };
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

export interface Lease {
  tpl: BikeTemplate;
  /** Body geometry under this lease's tint. */
  body: BufferGeometry;
  release(): void;
}

export function acquire(id: BikeId, quality: Quality, tint?: string): Lease {
  const e = entry(id, quality);
  e.refs++;
  const vkey = tint ? `${id}|${quality}|${tint.toLowerCase()}` : null;
  let variant: Variant | null = null;
  if (vkey) {
    variant = variants.get(vkey) ?? makeVariant(e.tpl, tint as string);
    variants.set(vkey, variant);
    variant.refs++;
  }
  let released = false;
  return {
    tpl: e.tpl,
    body: variant?.geo ?? e.tpl.built.geo,
    release: () => {
      if (released) return;
      released = true;
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
