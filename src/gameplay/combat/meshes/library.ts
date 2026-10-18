// Per-session geometry cache for combat props: every catalog prop is built once at session start (prebuild),
// shared by all meshes that show it, and disposed with the session.
import type { BufferGeometry } from 'three';
import { makeProp, PROP_KEYS, type PropKey } from './catalog';

export class PropLibrary {
  private geos = new Map<PropKey, BufferGeometry>();

  /** Build every prop now (session start), so no cast or drop builds geometry mid-race. */
  prebuild(): void {
    for (const key of PROP_KEYS) this.get(key);
  }

  get(key: PropKey): BufferGeometry {
    let g = this.geos.get(key);
    if (!g) {
      g = makeProp(key);
      this.geos.set(key, g);
    }
    return g;
  }

  dispose(): void {
    for (const g of this.geos.values()) g.dispose();
    this.geos.clear();
  }
}
