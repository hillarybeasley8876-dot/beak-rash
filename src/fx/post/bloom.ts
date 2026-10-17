// Cheap HDR bloom: soft-threshold prefilter straight to 1/4 res (4 bilinear taps = a 4×4 block),
// dual-filter (Kawase) downsample chain, then progressive additive upsample back to 1/4 res.
// ~9 tiny passes; result = mips[0].
import {
  AdditiveBlending, HalfFloatType, LinearFilter, NoBlending, ShaderMaterial, Vector2, WebGLRenderTarget,
  type Texture, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT, GLSL_COMMON } from './glsl-common';

const PREFILTER = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
${GLSL_COMMON}
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  return c * (max(soft, br - uThreshold) / max(br, 1e-4));
}
void main() {
  vec2 o = uTexel;
  vec3 a = texture2D(tInput, vUv + vec2(-o.x, -o.y)).rgb;
  vec3 b = texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb;
  vec3 c = texture2D(tInput, vUv + vec2(-o.x, o.y)).rgb;
  vec3 d = texture2D(tInput, vUv + vec2(o.x, o.y)).rgb;
  // Karis average: tames single-pixel fireflies (specks of sun glint) before they bloom.
  float wa = 1.0 / (1.0 + fxLuma(a)), wb = 1.0 / (1.0 + fxLuma(b));
  float wc = 1.0 / (1.0 + fxLuma(c)), wd = 1.0 / (1.0 + fxLuma(d));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  gl_FragColor = vec4(prefilter(col), 1.0);
}
`;

const DOWN = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 sum = texture2D(tInput, vUv).rgb * 4.0;
  sum += texture2D(tInput, vUv - o).rgb;
  sum += texture2D(tInput, vUv + o).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb;
  sum += texture2D(tInput, vUv - vec2(o.x, -o.y)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}
`;

const UP = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 sum = texture2D(tInput, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(0.0, o.y * 2.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture2D(tInput, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  sum += texture2D(tInput, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(sum / 12.0 * uWeight, 1.0);
}
`;

function pass(fragmentShader: string, extra: Record<string, { value: unknown }> = {}, additive = false): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms: { tInput: { value: null }, uTexel: { value: new Vector2() }, ...extra },
    depthTest: false,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NoBlending,
    transparent: additive,
  });
}

export class Bloom {
  readonly levels: number;
  private mips: WebGLRenderTarget[] = [];
  private quad = new FullScreenQuad();
  private prefilter = pass(PREFILTER, { uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
  private down = pass(DOWN);
  private up = pass(UP, { uWeight: { value: 1 } }, true);

  constructor(levels = 5) {
    this.levels = levels;
    for (let i = 0; i < levels; i++) {
      const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
      rt.texture.name = `fx.bloom${i}`;
      this.mips.push(rt);
    }
  }

  setSize(width: number, height: number): void {
    this.mips.forEach((rt, i) => {
      const d = 2 ** (i + 2);
      rt.setSize(Math.max(1, Math.floor(width / d)), Math.max(1, Math.floor(height / d)));
    });
  }

  /** Bloom of `input` (linear HDR); returns the 1/4-res bloom texture. */
  render(renderer: WebGLRenderer, input: Texture, inputSize: Vector2, threshold: number, knee: number): Texture {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    this.prefilter.uniforms.tInput!.value = input;
    (this.prefilter.uniforms.uTexel!.value as Vector2).set(1 / inputSize.x, 1 / inputSize.y);
    this.prefilter.uniforms.uThreshold!.value = threshold;
    this.prefilter.uniforms.uKnee!.value = knee;
    this.draw(renderer, this.prefilter, this.mips[0]!);
    for (let i = 1; i < this.levels; i++) {
      const src = this.mips[i - 1]!;
      this.down.uniforms.tInput!.value = src.texture;
      (this.down.uniforms.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.down, this.mips[i]!);
    }
    for (let i = this.levels - 2; i >= 0; i--) {
      const src = this.mips[i + 1]!;
      this.up.uniforms.tInput!.value = src.texture;
      (this.up.uniforms.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.up, this.mips[i]!);
    }
    renderer.autoClear = autoClear;
    return this.mips[0]!.texture;
  }

  private draw(renderer: WebGLRenderer, material: ShaderMaterial, target: WebGLRenderTarget): void {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }

  dispose(): void {
    for (const rt of this.mips) rt.dispose();
    this.prefilter.dispose();
    this.down.dispose();
    this.up.dispose();
    this.quad.dispose();
  }
}
