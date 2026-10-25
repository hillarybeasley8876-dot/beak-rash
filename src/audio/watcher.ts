// Per-frame, session-driven audio: the player's bike loops, the police siren, rival / traffic
// pass-bys (whoosh when something crosses the player's position close by), tunnel reverb and the
// adaptive music intensity (top-3 → 1 after a 2 s hold, final stretch → 2, frozen once finished).
import { Vector3 } from 'three';
import { BikeLoops } from './sfx/loops';
import { Siren } from './sfx/siren';
import { place } from './sfx/spatial';
import { WeatherLoops, type WeatherLoop } from './sfx/weather';
import type { Session } from '../core/contracts';
import type { RiderState, TrackFeature } from '../core/types';
import type { Engine } from './engine';
import type { Host } from './host';

const VEHICLES = new Set(['car', 'van', 'truck', 'bus', 'police']);
/** s a new place must hold before the top-3 music layers follow it. */
const TOP3_HOLD = 2;

export class SessionWatcher {
  private session: Session | null = null;
  private loops: BikeLoops | null = null;
  private weather: WeatherLoops | null = null;
  private siren: Siren | null = null;
  private alertUntil = 0;
  private alertLevel = 0;
  private tunnels: TrackFeature[] = [];
  private prev = new Map<string, number>();
  private intensity = -1;
  private want = -1;
  private wantSince = 0;
  private space = -1;
  private v = new Vector3();
  /** The weather ambience right now (the debug state shows it). */
  private ambience: { loop: WeatherLoop; level: number } = { loop: 'none', level: 0 };

  constructor(private h: Host, private engine: Engine, private setIntensity: (level: number) => void) {}

  /** police:alert → keep the siren going for a while (outrun it to lose it). */
  alert(level: number, now: number): void {
    this.alertLevel = level;
    this.alertUntil = level > 0 ? now + 6 : now;
  }

  update(session: Session | null, timeScale: number, now: number): void {
    if (session !== this.session) this.swap(session);
    if (!session) return;
    const p = session.player;
    const screen = this.h.app.ui.screen;
    const onTrack = screen === 'race' || screen === 'intro' || screen === 'pause';
    const pedal = session.controls.get(p.id)?.throttle ?? 0;
    const charge = p.driftCharge;
    const level = !p.drifting ? 0 : charge >= 2 ? 4 : charge >= 1.2 ? 3 : charge >= 0.55 ? 2 : 1;
    this.loops ??= new BikeLoops(this.engine);
    this.loops.update({
      speed: p.speed, pedal, surface: p.surface, drift: level, boost: p.boostTime > 0, airborne: p.airborne,
      active: onTrack && (p.mode === 'racing' || p.mode === 'finished') && session.phase !== 'intro', timeScale,
    });
    this.updateSiren(session, p, onTrack ? timeScale : 0, now);
    if (timeScale > 0.05) this.passBys(session, p);
    const inTunnel = this.tunnels.some((f) => p.s >= f.s0 && p.s <= f.s1) ? 1 : 0;
    if (inTunnel !== this.space) {
      this.space = inTunnel;
      this.engine.setSfxSpace(inTunnel);
    }
    // The weather ambience: only while the race runs, and quieter under a tunnel's roof. The loops
    // are built on the first rainy / windy race (a clear race never pays for them).
    const weather = this.weatherFor(session);
    const running = onTrack && session.phase !== 'intro' && timeScale > 0.02;
    const weatherLevel = running ? weather.level : 0;
    this.ambience = { loop: weather.loop, level: weatherLevel };
    if (weather.loop !== 'none') {
      this.weather ??= new WeatherLoops(this.engine);
      this.weather.update(weather.loop, weatherLevel, inTunnel > 0);
    } else if (this.weather) {
      this.weather.update('none', 0, false);
    }
    // Once the player has finished, the music holds where it is until the results crossfade.
    if (session.phase !== 'finished' && p.mode !== 'finished') {
      this.steer(session.phase !== 'racing' ? 0 : p.progress >= 0.85 ? 2 : p.place <= 3 ? 1 : 0, now);
    }
  }

  /** The final stretch applies at once; a top-3 change needs the new place held for 2 s (pack battles). */
  private steer(target: number, now: number): void {
    if (target !== this.want) {
      this.want = target;
      this.wantSince = now;
    }
    const settled = target === 2 || this.intensity === 2 || this.intensity < 0 || now - this.wantSince >= TOP3_HOLD;
    if (target !== this.intensity && settled) {
      this.intensity = target;
      this.setIntensity(target);
    }
  }

  /** The frame loop stopped (hidden tab / stall): fade the speed-linked loops and the siren until the next update. */
  halt(): void {
    this.loops?.update({ speed: 0, pedal: 0, surface: 'road', drift: 0, boost: false, airborne: false, active: false, timeScale: 0 });
    this.siren?.stop();
    this.siren = null;
    this.weather?.update('none', 0, false);
    this.ambience = { loop: 'none', level: 0 };
  }

  /** The weather ambience right now (the debug state shows it). */
  weatherState(): { loop: WeatherLoop; level: number } {
    return this.ambience;
  }

  private swap(session: Session | null): void {
    this.loops?.stop();
    this.loops = null;
    this.weather?.stop();
    this.weather = null;
    this.siren?.stop();
    this.siren = null;
    this.prev.clear();
    this.intensity = -1;
    this.want = -1;
    this.alertUntil = 0;
    this.session = session;
    // A race that ends mid-cinematic must not leave the mix muffled or the bass dropped.
    this.h.setCine(0);
    this.h.dropBass(0);
    this.tunnels = session ? session.track.features.filter((f) => f.kind === 'tunnel') : [];
    if (this.space !== 0) this.engine.setSfxSpace(0);
    this.space = 0;
  }

  /** The ambience this race gets: rain, a wind bed, or nothing (the desert always blows a little). */
  private weatherFor(session: Session): { loop: WeatherLoop; level: number } {
    const w = session.track.weather ?? session.config.weather;
    if (w === 'rain') return { loop: 'rain', level: 1 };
    if (w === 'snow' || w === 'fog') return { loop: 'wind', level: 1 };
    if (session.track.id === 'gobi') return { loop: 'wind', level: 0.45 };
    return { loop: 'none', level: 0 };
  }

  private updateSiren(session: Session, p: RiderState, timeScale: number, now: number): void {
    const cop = session.obstacles.find((o) => o.kind === 'police' && o.active);
    const chasing = timeScale > 0 && (cop !== undefined || now < this.alertUntil);
    if (!chasing) {
      if (this.siren) {
        this.siren.stop();
        this.siren = null;
      }
      return;
    }
    this.siren ??= new Siren(this.engine);
    const s = cop ? cop.s : p.s - 22;
    const x = cop ? cop.x : p.x;
    session.track.toWorld(s, x, 1.2, this.v);
    const level = cop ? Math.max(0.6, this.alertLevel) : Math.min(1, this.alertLevel + 0.3);
    this.siren.update(level, place(this.h.app.camera, this.v), 0.55 + 0.45 * Math.min(1, timeScale));
  }

  /** Whoosh when a rival or vehicle crosses the player's position within a few metres sideways. */
  private passBys(session: Session, p: RiderState): void {
    const check = (key: string, rel: number, dx: number, dv: number, id: string, pos: { s: number; x: number }): void => {
      const before = this.prev.get(key);
      this.prev.set(key, rel);
      if (before === undefined || Math.sign(before) === Math.sign(rel) || Math.abs(rel) > 6) return;
      if (Math.abs(dx) > (id === 'traffic.whoosh' ? 6 : 3.5) || Math.abs(dv) < 2 || !this.h.cooldown(`pass:${key}`, 1)) return;
      session.track.toWorld(pos.s, pos.x, 1, this.v);
      this.h.play(id, { x: this.v.x, y: this.v.y, z: this.v.z }, { pitch: Math.min(1.35, Math.max(0.8, 0.85 + Math.abs(dv) / 40)) });
    };
    for (const r of session.riders) {
      if (r === p || r.mode !== 'racing') continue;
      check(`r${r.id}`, r.s - p.s, r.x - p.x, r.speed - p.speed, 'bike.passby', r);
    }
    for (const o of session.obstacles) {
      if (!o.active || !o.solid || !VEHICLES.has(o.kind)) continue;
      check(`o${o.id}`, o.s - p.s, o.x - p.x, o.speed - p.speed, 'traffic.whoosh', o);
    }
    if (this.prev.size > 256) this.prev.clear(); // despawned traffic ids; one frame of history is cheap to lose
  }
}
