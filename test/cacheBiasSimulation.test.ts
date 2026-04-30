import { describe, expect, it } from 'vitest';

import {
  collectSequence,
  createSeededRandom,
  formatBiasSimulationRow,
  runBiasSimulation,
} from '../src/cacheBiasSimulation.js';
import { useNextNonRepeatingRandomNumber } from '../src/index.js';

describe('createSeededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const first = createSeededRandom(123);
    const second = createSeededRandom(123);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe('collectSequence', () => {
  it('collects values until the generator is exhausted', () => {
    const sequence = collectSequence(useNextNonRepeatingRandomNumber(3, 2, () => 0));

    expect(sequence).toEqual([0, 2, 1]);
  });
});

describe('runBiasSimulation', () => {
  it('shows limited first-value support for the cache algorithm and full support for the uniform permutation', () => {
    const result = runBiasSimulation({ x: 6, y: 2, trials: 500 }, createSeededRandom, 123456789);

    expect(result.theoreticalCacheFirstValueSupport).toBe(2);
    expect(result.observedCacheFirstValueSupport).toBe(2);
    expect(result.observedUniformFirstValueSupport).toBe(6);
    expect(result.cacheFirstValueEntropyBits).toBeLessThan(result.uniformFirstValueEntropyBits);
  });
});

describe('formatBiasSimulationRow', () => {
  it('formats a table row for console output', () => {
    const row = formatBiasSimulationRow({
      x: 10,
      y: 4,
      trials: 100,
      theoreticalCacheFirstValueSupport: 4,
      observedCacheFirstValueSupport: 4,
      observedUniformFirstValueSupport: 10,
      cacheFirstValueCoverageRatio: 0.4,
      uniformFirstValueCoverageRatio: 1,
      cacheFirstValueEntropyBits: 2,
      uniformFirstValueEntropyBits: 3.32,
    });

    expect(row).toEqual({
      x: 10,
      y: 4,
      trials: 100,
      cacheFirstValues: '4/10',
      uniformFirstValues: '10/10',
      cacheCoverage: 0.4,
      uniformCoverage: 1,
      cacheEntropyBits: 2,
      uniformEntropyBits: 3.32,
    });
  });
});