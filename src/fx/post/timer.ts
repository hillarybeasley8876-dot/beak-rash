// GPU pass timing with EXT_disjoint_timer_query_webgl2 (debug benches only; no-op when unsupported).
export class GpuTimer {
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: Array<{ q: WebGLQuery; label: string }> = [];
  private current: { q: WebGLQuery; label: string } | null = null;
  readonly totals: Record<string, { ms: number; n: number }> = {};

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as GpuTimer['ext'];
  }

  get supported(): boolean {
    return this.ext !== null;
  }

  begin(label: string): void {
    if (!this.ext || this.current) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.current = { q, label };
  }

  end(): void {
    if (!this.ext || !this.current) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.current);
    this.current = null;
  }

  /** Collect finished queries; returns how many are still in flight. */
  poll(): number {
    const { gl, ext } = this;
    if (!ext) return 0;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    this.pending = this.pending.filter(({ q, label }) => {
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!disjoint) {
        const t = this.totals[label] ?? { ms: 0, n: 0 };
        t.ms += (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
        t.n++;
        this.totals[label] = t;
      }
      gl.deleteQuery(q);
      return false;
    });
    return this.pending.length;
  }

  averages(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.totals)) out[k] = +(v.ms / Math.max(1, v.n)).toFixed(3);
    return out;
  }
}
