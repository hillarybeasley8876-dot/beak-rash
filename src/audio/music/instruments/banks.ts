// Every pre-rendered instrument bank (keys, pad, clav, bass), prepared together once per page at boot:
// sampled instruments use their live voices until their bank exists.
import { prepareBassSamples } from './bass-sampler';
import { prepareClavSamples } from './clav-sampler';
import { prepareKeySamples } from './keys-render';
import { preparePadSamples } from './pad-sampler';

export function prepareSampleBanks(sampleRate: number): Promise<void> {
  return Promise.all([
    prepareKeySamples(sampleRate), preparePadSamples(sampleRate), prepareClavSamples(sampleRate), prepareBassSamples(sampleRate),
  ])
    .then(() => undefined);
}
