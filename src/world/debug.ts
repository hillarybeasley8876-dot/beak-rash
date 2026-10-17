// window.__br.track: read-only debug view of the current track for tests and critics.
import type { TrackFeature } from '../core/types';
import type { BuiltLayout } from './layout/build';

export interface TrackDebug {
  id: string;
  length: number;
  layout: { segments: BuiltLayout['def']['segments']; zones: BuiltLayout['zones']; marks: BuiltLayout['marks'] };
  features: TrackFeature[];
}

declare module '../core/debug' {
  interface DebugApi {
    track?: TrackDebug;
  }
}

export function publishDebug(L: BuiltLayout): () => void {
  const api = typeof window !== 'undefined' ? window.__br : undefined;
  if (!api) return () => undefined;
  const info: TrackDebug = {
    id: L.def.id, length: L.length,
    layout: { segments: L.def.segments, zones: L.zones, marks: L.marks },
    features: L.features,
  };
  api.track = info;
  return () => {
    if (api.track === info) delete api.track;
  };
}
