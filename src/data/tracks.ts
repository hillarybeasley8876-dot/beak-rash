// Track catalogue (names/blurbs for menus). Layout and scenery live in world/ (track unit).
import type { TrackId, Weather } from '../core/types';
import { INFO as GOBI } from './track-content/gobi';
import { INFO as WATERTOWN } from './track-content/watertown';

export interface TrackInfo {
  id: TrackId;
  name: string;
  nameEn: string;
  blurb: string;
  weather: string;       // P5 calendar-style line on the loading screen
  lengthKm: number;      // approximate, for menus
  difficulty: 1 | 2 | 3;
}

export const TRACKS: Record<TrackId, TrackInfo> = {
  coast: {
    id: 'coast', name: '鹈鹕湾海滨公路', nameEn: 'PELICAN BAY', blurb: '阳光、海风、偷薯条的海鸥。',
    weather: '晴 · 海风 3 级', lengthKm: 3.3, difficulty: 1,
  },
  city: {
    id: 'city', name: '霓虹夜城', nameEn: 'NEON NIGHT', blurb: '霓虹灯下，没有一只鸟是无辜的。',
    weather: '夜 · 微雨', lengthKm: 3.4, difficulty: 2,
  },
  mountain: {
    id: 'mountain', name: '落日山道', nameEn: 'SUNSET PASS', blurb: '十八弯，弯弯有大鹅。',
    weather: '黄昏 · 山风', lengthKm: 3.6, difficulty: 3,
  },
  watertown: WATERTOWN,
  gobi: GOBI,
};

export const TRACK_ORDER: TrackId[] = ['coast', 'city', 'mountain', 'watertown', 'gobi'];

/** Weather per track (SPEC §20): the track's own weather first (a race that asks for none gets it), then the
 *  variants a race may ask for. world/weather/table.ts builds them; menus offer exactly these. */
export const TRACK_WEATHER: Record<TrackId, readonly Weather[]> = {
  coast: ['clear', 'rain', 'dusk', 'fog'],
  city: ['clear', 'rain', 'fog'],
  mountain: ['clear', 'snow', 'fog', 'rain'],
  watertown: ['rain', 'fog', 'clear'],
  gobi: ['clear', 'dusk', 'fog'],
};
