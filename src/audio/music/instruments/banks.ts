// Every pre-rendered instrument bank (keys, brass, pad), prepared together once per page at boot:
// sampled instruments use their live voices until their bank exists.
import { prepareBrassSamples } from './brass-sampler';
import { prepareKeySamples } from './keys-render';
import { preparePadSamples } from './pad-sampler';

export function prepareSampleBanks(sampleRate: number): Promise<void> {
  return Promise.all([prepareKeySamples(sampleRate), prepareBrassSamples(sampleRate), preparePadSamples(sampleRate)]).then(() => undefined);
}
