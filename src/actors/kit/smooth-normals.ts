// Low-pass filter for SDF mesh normals after decimation: a few Laplacian passes over the 1-ring (vertices
// split along colour borders are welded by position first, so both sides keep one shared normal). Toon
// band borders then run as smooth curves instead of following the decimated triangles.

/** Smooth `nrm` in place (unit normals per vertex) using the triangle adjacency of `idx`. */
export function smoothNormals(pos: Float32Array, nrm: Float32Array, idx: Uint32Array, passes = 2): void {
  const n = pos.length / 3;
  // Weld coincident vertices (crisp borders duplicate them) into groups.
  const group = new Int32Array(n);
  const keyOf = new Map<string, number>();
  let groups = 0;
  for (let v = 0; v < n; v++) {
    const k = `${Math.round((pos[v * 3] ?? 0) * 1e5)},${Math.round((pos[v * 3 + 1] ?? 0) * 1e5)},${Math.round((pos[v * 3 + 2] ?? 0) * 1e5)}`;
    let g = keyOf.get(k);
    if (g === undefined) {
      g = groups++;
      keyOf.set(k, g);
    }
    group[v] = g;
  }
  // Group normals (average of members) and group adjacency (unique neighbour pairs from triangle edges).
  let gn = new Float32Array(groups * 3);
  for (let v = 0; v < n; v++) {
    const g = group[v] ?? 0;
    for (let k = 0; k < 3; k++) gn[g * 3 + k] = (gn[g * 3 + k] ?? 0) + (nrm[v * 3 + k] ?? 0);
  }
  const edges = new Set<number>();
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = group[idx[t + e] ?? 0] ?? 0, b = group[idx[t + ((e + 1) % 3)] ?? 0] ?? 0;
      if (a !== b) edges.add(a < b ? a * groups + b : b * groups + a);
    }
  }
  const pairs = Uint32Array.from(edges);
  for (let p = 0; p < passes; p++) {
    const acc = Float32Array.from(gn);
    for (const e of pairs) {
      const a = Math.floor(e / groups), b = e - a * groups;
      for (let k = 0; k < 3; k++) {
        acc[a * 3 + k] = (acc[a * 3 + k] ?? 0) + (gn[b * 3 + k] ?? 0);
        acc[b * 3 + k] = (acc[b * 3 + k] ?? 0) + (gn[a * 3 + k] ?? 0);
      }
    }
    for (let g = 0; g < groups; g++) {
      const l = Math.hypot(acc[g * 3] ?? 0, acc[g * 3 + 1] ?? 0, acc[g * 3 + 2] ?? 0) || 1;
      for (let k = 0; k < 3; k++) acc[g * 3 + k] = (acc[g * 3 + k] ?? 0) / l;
    }
    gn = acc;
  }
  for (let v = 0; v < n; v++) {
    const g = group[v] ?? 0;
    for (let k = 0; k < 3; k++) nrm[v * 3 + k] = gn[g * 3 + k] ?? 0;
  }
}
