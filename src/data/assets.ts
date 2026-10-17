// Manifest of generated art that exists on disk (assets unit regenerates this file).
// Consumers must tolerate missing entries (fallback silhouettes / plain panels).
import type { CharacterId, TrackId } from '../core/types';

export interface PortraitSet { main?: string; smug?: string; hurt?: string; eyes?: string }

export const assetUrl = (rel: string): string => `${import.meta.env.BASE_URL}assets/${rel}`;

export const PORTRAITS: Partial<Record<CharacterId, PortraitSet>> = {};
export const ART: Partial<Record<'title' | 'menu' | 'loading' | 'results' | 'garage', string>> = {};
export const BILLBOARDS: Partial<Record<TrackId, string[]>> = {};
