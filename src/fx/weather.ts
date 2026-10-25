// The weather layer (SPEC §20): rain and snow around the camera, one instanced draw call each.
//
// The layer lives in the scene as a group named 'fx:weather' (userData.kind = 'rain' | 'snow'). The
// drops are placed in the shader: a fixed world position per drop, falling, then wrapped around the
// camera, so the weather is anchored to the world and streaks past at the rider's speed. The layer is
// hidden for clear / fog / dusk and outside a race; its program is compiled behind the loading screen.
import {
  Color, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NormalBlending,
  PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { Rng } from '../core/rng';
import { reducedMotion } from '../core/motion';
import type { AppContext, Session } from '../core/contracts';
import type { Quality, Weather } from '../core/types';
import type { FxPart } from './system';

export type WeatherKind = 'rain' | 'snow';

interface Look {
  count: Record<Quality, number>;
  speed: number;      // the fall speed (m/s)
  wind: Vector3;      // the horizontal drift of the weather
  box: Vector3;       // the volume the weather fills around the camera (m)
  size: number;       // the width of a streak / the size of a flake (m)
  length: number;     // the length of a streak (m)
  color: string;
  opacity: number;
}

const TUNE: Record<WeatherKind, Look> = {
  rain: {
    count: { high: 4200, medium: 2600, low: 1400 },
    speed: 21, wind: new Vector3(4.5, 0, 1.6), box: new Vector3(48, 28, 48),
    size: 0.028, length: 0.9, color: '#d7e8f5', opacity: 0.6,
  },
  snow: {
    count: { high: 3200, medium: 1900, low: 1100 },
    speed: 1.3, wind: new Vector3(0.7, 0, 0.3), box: new Vector3(26, 18, 26),
    size: 0.12, length: 0.12, color: '#ffffff', opacity: 0.9,
  },
};

/** Reduced motion: fewer drops, slower fall. */
const REDUCED = { count: 0.5, speed: 0.6 } as const;

const WEATHER_VERT = /* glsl */ `
attribute vec3 aSeed;
attribute vec2 aRand;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uKind;
uniform float uSpeed;
uniform vec3 uWind;
uniform float uSize;
uniform float uLength;
varying vec2 vUv;
varying float vFade;

void main() {
  vec3 p = (aSeed - 0.5) * uBox;
  float sp = uSpeed * (0.75 + 0.5 * aRand.y);
  p.y -= uTime * sp;
  p += uWind * uTime * (0.6 + 0.8 * aRand.x);
  if (uKind > 0.5) {
    // Snow drifts sideways instead of falling straight.
    p.x += sin(uTime * (0.5 + aRand.x) + aRand.y * 6.28) * 0.9;
    p.z += cos(uTime * (0.4 + aRand.y) + aRand.x * 6.28) * 0.9;
  }
  // Wrap the drop into the box around the camera: it stays in the world, but never drifts away.
  vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 world = uCam + rel;
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vec2 corner = position.xy;
  if (uKind < 0.5) {
    // Rain: a streak along the fall direction, facing the lens.
    vec3 vel = vec3(uWind.x, -sp, uWind.z);
    vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz;
    float s = length(vv.xy);
    vec2 dir = s > 1e-4 ? vv.xy / s : vec2(0.0, 1.0);
    vec2 perp = vec2(-dir.y, dir.x);
    mv.xy += dir * corner.y * uLength * (0.7 + 0.6 * aRand.x) + perp * corner.x * uSize;
  } else {
    mv.xy += corner * uSize * (0.6 + 0.8 * aRand.x);
  }
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  float dist = max(-mv.z, 0.01);
  // No drops in the lens, and the far ones fade into the fog.
  vFade = smoothstep(0.8, 2.5, dist) * (1.0 - smoothstep(uBox.z * 0.3, uBox.z * 0.5, dist));
}
`;

const WEATHER_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uKind;
varying vec2 vUv;
varying float vFade;
void main() {
  float a;
  if (uKind < 0.5) {
    float x = abs(vUv.x - 0.5) * 2.0;
    float y = abs(vUv.y - 0.5) * 2.0;
    a = (1.0 - x * x) * (1.0 - y * y * y);
  } else {
    float d = length(vUv - 0.5);
    a = 1.0 - smoothstep(0.1, 0.5, d);
  }
  a *= uOpacity * vFade;
  if (a < 0.012) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export class WeatherLayer implements FxPart {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly geometry: InstancedBufferGeometry;
  private readonly camPos = new Vector3();
  private time = 0;
  private kind: WeatherKind | null = null;
  private reduced = false;

  constructor(private readonly app: AppContext) {
    const geo = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    geo.setIndex(quad.getIndex());
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    const max = Math.max(TUNE.rain.count.high, TUNE.snow.count.high);
    const rng = new Rng(0x5eed);
    const seeds = new Float32Array(max * 3);
    const rands = new Float32Array(max * 2);
    for (let i = 0; i < max; i++) {
      seeds[i * 3] = rng.next();
      seeds[i * 3 + 1] = rng.next();
      seeds[i * 3 + 2] = rng.next();
      rands[i * 2] = rng.next();
      rands[i * 2 + 1] = rng.next();
    }
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 3));
    geo.setAttribute('aRand', new InstancedBufferAttribute(rands, 2));
    geo.instanceCount = 0;
    this.geometry = geo;
    this.material = new ShaderMaterial({
      vertexShader: WEATHER_VERT,
      fragmentShader: WEATHER_FRAG,
      uniforms: {
        uTime: { value: 0 }, uCam: { value: new Vector3() }, uBox: { value: TUNE.rain.box.clone() },
        uKind: { value: 0 }, uSpeed: { value: TUNE.rain.speed }, uWind: { value: TUNE.rain.wind.clone() },
        uSize: { value: TUNE.rain.size }, uLength: { value: TUNE.rain.length },
        uColor: { value: new Color(TUNE.rain.color) }, uOpacity: { value: TUNE.rain.opacity },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    });
    this.material.name = 'fx.weather';
    this.mesh = new Mesh(geo, this.material);
    this.mesh.name = 'fx.weather.mesh';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    this.group.name = 'fx:weather';
    this.group.userData.kind = '';
    this.group.visible = false;
    this.group.add(this.mesh);
    app.scene.add(this.group);
  }

  /** The weather of the race (null outside a race): only rain and snow have particles. */
  attach(session: Session | null): void {
    const weather: Weather | undefined = session?.track.weather;
    if (weather === 'rain' || weather === 'snow') this.setKind(weather);
    else this.setKind(null);
  }

  update(dtSim: number): void {
    if (!this.group.visible) return;
    this.time += dtSim;
    const reduced = reducedMotion();
    if (reduced !== this.reduced) {
      this.reduced = reduced;
      this.applyCount();
      this.material.uniforms.uSpeed.value = this.speed();
    }
    this.material.uniforms.uTime.value = this.time;
    this.app.camera.getWorldPosition(this.camPos);
    (this.material.uniforms.uCam.value as Vector3).copy(this.camPos);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  /** Switch the layer to a weather (or hide it). */
  private setKind(kind: WeatherKind | null): void {
    this.kind = kind;
    this.group.userData.kind = kind ?? '';
    this.group.visible = kind !== null;
    if (!kind) {
      this.geometry.instanceCount = 0;
      return;
    }
    const look = TUNE[kind];
    this.material.uniforms.uKind.value = kind === 'rain' ? 0 : 1;
    this.material.uniforms.uSpeed.value = this.speed();
    (this.material.uniforms.uWind.value as Vector3).copy(look.wind);
    (this.material.uniforms.uBox.value as Vector3).copy(look.box);
    this.material.uniforms.uSize.value = look.size;
    this.material.uniforms.uLength.value = look.length;
    (this.material.uniforms.uColor.value as Color).set(look.color);
    this.material.uniforms.uOpacity.value = look.opacity;
    this.applyCount();
  }

  /** The fall speed (reduced motion slows the weather down). */
  private speed(): number {
    if (!this.kind) return 0;
    return TUNE[this.kind].speed * (this.reduced ? REDUCED.speed : 1);
  }

  /** The drop count: the quality's share, halved when the motion is reduced. */
  private applyCount(): void {
    if (!this.kind) {
      this.geometry.instanceCount = 0;
      return;
    }
    const look = TUNE[this.kind];
    const n = Math.round(look.count[this.app.quality] * (this.reduced ? REDUCED.count : 1));
    this.geometry.instanceCount = Math.max(0, Math.min(n, this.geometry.getAttribute('aSeed').count));
  }
}
