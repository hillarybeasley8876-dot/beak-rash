// Voice line manifest (audio unit regenerates this file with tools/gen-tts.mjs).
export interface VoiceLine { id: string; text: string; file: string }
export const VOICE: Record<string, VoiceLine> = {};
