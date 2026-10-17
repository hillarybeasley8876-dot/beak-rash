// Audio lab meter: live peak / RMS bars (dBFS, with the −1 dBFS ceiling marked) and a scrolling
// log-frequency spectrogram of the final mix, so screenshots show what is playing.
export class Meter {
  private analyser: AnalyserNode;
  private freq: Uint8Array<ArrayBuffer>;
  private wave: Float32Array<ArrayBuffer>;
  private g: CanvasRenderingContext2D;
  private peakHold = -90;

  constructor(ctx: BaseAudioContext, source: AudioNode, readonly canvas: HTMLCanvasElement) {
    this.analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.2 });
    source.connect(this.analyser);
    this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.wave = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    const g = canvas.getContext('2d');
    if (!g) throw new Error('[audio] lab meter needs a 2d canvas');
    this.g = g;
    g.fillStyle = '#0b0b0f';
    g.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Draw one frame; returns the instantaneous peak / RMS in dBFS. */
  draw(): { peak: number; rms: number } {
    const { g, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const barW = 90;
    this.analyser.getFloatTimeDomainData(this.wave);
    let pk = 0;
    let sum = 0;
    for (const x of this.wave) {
      pk = Math.max(pk, Math.abs(x));
      sum += x * x;
    }
    const peak = 20 * Math.log10(pk || 1e-6);
    const rms = 20 * Math.log10(Math.sqrt(sum / this.wave.length) || 1e-6);
    this.peakHold = Math.max(peak, this.peakHold - 0.4);
    // Spectrogram: shift left by 2 px, draw the newest column on the right.
    g.drawImage(canvas, barW + 2, 0, W - barW - 2, H, barW, 0, W - barW - 2, H);
    this.analyser.getByteFrequencyData(this.freq);
    const bins = this.freq.length;
    const nyq = this.analyser.context.sampleRate / 2;
    for (let y = 0; y < H; y++) {
      const f = 30 * Math.pow(nyq / 30, 1 - y / H);
      const v = this.freq[Math.min(bins - 1, Math.floor((f / nyq) * bins))] ?? 0;
      g.fillStyle = `rgb(${Math.min(255, v * 1.6)},${Math.max(0, v * 1.4 - 140)},${Math.max(0, v - 200) * 3})`;
      g.fillRect(W - 2, y, 2, 1);
    }
    g.fillStyle = '#0b0b0f';
    g.fillRect(0, 0, barW, H);
    const yOf = (db: number): number => H * Math.min(1, Math.max(0, -db / 60));
    g.fillStyle = '#ffffff';
    g.fillRect(12, yOf(rms), 28, H - yOf(rms));
    g.fillStyle = pk >= 0.89 ? '#ffe600' : '#e5191c';
    g.fillRect(48, yOf(peak), 28, H - yOf(peak));
    g.fillStyle = '#ffe600';
    g.fillRect(44, yOf(this.peakHold), 36, 3);
    g.fillStyle = '#ff1e3c';
    g.fillRect(8, yOf(-1), 76, 1);
    g.font = 'bold 11px sans-serif';
    g.fillStyle = '#fff';
    g.fillText(`${rms.toFixed(0)}`, 12, 14);
    g.fillText(`${this.peakHold.toFixed(1)}`, 48, 14);
    return { peak, rms };
  }
}
