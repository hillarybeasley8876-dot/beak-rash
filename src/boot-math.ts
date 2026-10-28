// Deterministic Math (SPEC §28): the first module main.ts imports, so every module after it — the sim, the units
// loaded later, three.js — computes sin / exp / pow … with the same bits on every engine (online lockstep).
import { installDetMath } from './net/detmath';

installDetMath();
