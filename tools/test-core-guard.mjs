#!/usr/bin/env node
// Unit regression for src/core/guard.ts (Node ≥ 23 strips the TS types natively).
//   node tools/test-core-guard.mjs   (exit 1 on failure)
import assert from 'node:assert/strict';
import { guard, guardAsync } from '../src/core/guard.ts';

const quiet = console.error;
const logged = [];
console.error = (...a) => logged.push(a.map(String).join(' '));
try {
  const boom = () => { throw new Error('ctor failed'); };
  const stub = (x) => `stub:${x}`;
  const used = [];
  assert.throws(() => boom('a'), /ctor failed/, 'trigger: the raw factory throws');
  assert.equal(guard('audio', boom, stub, used)('a'), 'stub:a', 'throwing factory falls back to its stub');
  assert.deepEqual(used, ['audio'], 'fallback is reported once');
  guard('audio', boom, stub, used)('b');
  assert.deepEqual(used, ['audio'], 'no duplicate report');
  assert.ok(logged.some((l) => l.includes('[modules] unit "audio" threw')), 'fallback is logged as an error');
  const ok = (x) => `real:${x}`;
  assert.equal(guard('fx', ok, stub, used)('c'), 'real:c', 'healthy factory passes through');
  assert.equal(guard('ui', stub, stub, used), stub, 'stub-only unit is not wrapped');
  const reject = async () => { throw new Error('track build failed'); };
  const asyncStub = async (x) => `stub-track:${x}`;
  assert.equal(await guardAsync('world', reject, asyncStub, used)('coast'), 'stub-track:coast', 'async failure falls back');
  assert.equal(await guardAsync('world', async (x) => `track:${x}`, asyncStub, used)('city'), 'track:city', 'async success passes through');
  assert.deepEqual(used, ['audio', 'world'], 'both fallbacks reported');
} finally {
  console.error = quiet;
}
console.log('test-core-guard OK');
