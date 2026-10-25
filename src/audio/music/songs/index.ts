// Song registry: id → data. Race songs are 'race-<trackId>'.
import { CITY } from './city';
import { COAST } from './coast';
import { GOBI } from './gobi';
import { MENU } from './menu';
import { MOUNTAIN } from './mountain';
import { RESULTS } from './results';
import { TITLE } from './title';
import { WATERTOWN } from './watertown';
import type { Song } from '../types';

export const SONGS: Record<string, Song> = {
  title: TITLE,
  menu: MENU,
  'race-coast': COAST,
  'race-city': CITY,
  'race-mountain': MOUNTAIN,
  'race-watertown': WATERTOWN,
  'race-gobi': GOBI,
  results: RESULTS,
};
