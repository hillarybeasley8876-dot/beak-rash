// Geometries this folder's skills draw (built once at session start by the PropLibrary: no cast builds geometry
// mid-race). Key → maker; read them with ctx.lib.get('<key>'). Keys must be unique across all prop tables.
import type { BufferGeometry } from 'three';

export const PROPS = {} satisfies Record<string, () => BufferGeometry>;
