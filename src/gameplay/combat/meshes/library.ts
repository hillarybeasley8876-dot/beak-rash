// Per-session geometry cache for combat props (built lazily, disposed with the session).
import type { BufferGeometry } from 'three';

export class PropLibrary {
  private geos = new Map<string, BufferGeometry>();

  get(key: string, make: () => BufferGeometry): BufferGeometry {
    let g = this.geos.get(key);
    if (!g) {
      g = make();
      this.geos.set(key, g);
    }
    return g;
  }

  dispose(): void {
    for (const g of this.geos.values()) g.dispose();
    this.geos.clear();
  }
}
