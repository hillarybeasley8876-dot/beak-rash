// Registry of the seven bike definitions (one file each).
import type { BikeId } from '../../../core/types';
import type { BikeDef } from '../template';
import { erba } from './erba';
import { fixie } from './fixie';
import { kidbike } from './kidbike';
import { llm } from './llm';
import { mtb } from './mtb';
import { roadbike } from './roadbike';
import { shared } from './shared';
import { tandem } from './tandem';

// llm (大模型限定款, SPEC §21) is the Konami unlock: the roadbike as a language model drew it.
export const BIKE_DEFS: Record<BikeId, BikeDef> = { roadbike, erba, shared, fixie, mtb, tandem, kidbike, llm };
