import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '../src/cacheBiasSimulation.js';
import {
  createPowerOfTwoCacheSizes,
  formatRoundRobinCacheSweepRow,
  getDefaultRoundRobinCacheSweepUpperBound,
  pickBestRoundRobinCacheSweepRow,
  runRoundRobinCacheSweep,
} from '../src/roundRobinCacheSweepSimulation.js';

describe('runRoundRobinCacheSweep', () => {
  it('auto-generates power-of-two cache sizes up to the default upper bound', () => {
    const result = runRoundRobinCacheSweep(
      {
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        trials: 1500,
      },
      createSeededRandom,
      123456789,
    );

    expect(result.maxCacheSize).toBe(16);
    expect(result.cacheSizes).toEqual([1, 2, 4, 8, 16]);
    expect(result.best.compromiseScore).toBe(Math.max(...result.rows.map((row) => row.compromiseScore)));
    expect(result.rows.map((row) => row.cacheSize)).toContain(result.best.cacheSize);

    result.rows.forEach((row) => {
      expect(row.entropyRecoveryRatio).toBeGreaterThanOrEqual(0);
      expect(row.entropyRecoveryRatio).toBeLessThanOrEqual(1);
      expect(row.prefixRetentionRatio).toBeGreaterThanOrEqual(0);
      expect(row.prefixRetentionRatio).toBeLessThanOrEqual(1);
      expect(row.leafReductionRatio).toBeGreaterThanOrEqual(0);
      expect(row.leafReductionRatio).toBeLessThanOrEqual(1);
      expect(row.compromiseScore).toBeGreaterThanOrEqual(0);
      expect(row.compromiseScore).toBeLessThanOrEqual(1);
    });
  });

  it('uses an explicit maxCacheSize to bound the generated power-of-two cache sizes', () => {
    const result = runRoundRobinCacheSweep(
      {
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        maxCacheSize: 8,
        trials: 500,
      },
      createSeededRandom,
      123456789,
    );

    expect(result.maxCacheSize).toBe(8);
    expect(result.cacheSizes).toEqual([1, 2, 4, 8]);
  });

  it('finds a cache size that reduces leaf adjacency versus the uncached baseline', () => {
    const result = runRoundRobinCacheSweep(
      {
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        trials: 1500,
      },
      createSeededRandom,
      987654321,
    );

    expect(
      result.rows.some(
        (row) => row.cachedLevelsLeafAdjacency < result.baseline.uncachedLevelsLeafAdjacency,
      ),
    ).toBe(true);
    expect(result.best.cacheSize).not.toBe(1);
  });

  it('rejects invalid scenarios', () => {
    expect(() =>
      runRoundRobinCacheSweep({
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        cacheSizes: [],
        trials: 100,
      }),
    ).toThrowError('cacheSizes must contain at least one positive integer');
    expect(() =>
      runRoundRobinCacheSweep({
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        cacheSizes: [1, 0],
        trials: 100,
      }),
    ).toThrowError('cacheSizes[1] must be a positive integer');
    expect(() =>
      runRoundRobinCacheSweep({
        n: 100,
        fixedX: 4,
        xValues: [4, 3, 2],
        maxCacheSize: 0,
        trials: 100,
      }),
    ).toThrowError('maxCacheSize must be a positive integer');
  });
});

describe('getDefaultRoundRobinCacheSweepUpperBound', () => {
  it('uses the next power of two above max(x_0, ceil(sqrt(n))) and caps it at n', () => {
    expect(getDefaultRoundRobinCacheSweepUpperBound(100, [4, 3, 2])).toBe(16);
    expect(getDefaultRoundRobinCacheSweepUpperBound(250, [8, 4, 2])).toBe(16);
    expect(getDefaultRoundRobinCacheSweepUpperBound(7, [8, 4, 2])).toBe(7);
  });
});

describe('createPowerOfTwoCacheSizes', () => {
  it('creates ascending powers of two up to the given upper bound', () => {
    expect(createPowerOfTwoCacheSizes(1)).toEqual([1]);
    expect(createPowerOfTwoCacheSizes(8)).toEqual([1, 2, 4, 8]);
    expect(createPowerOfTwoCacheSizes(20)).toEqual([1, 2, 4, 8, 16]);
  });
});

describe('pickBestRoundRobinCacheSweepRow', () => {
  it('breaks score ties in favor of the smaller cache size', () => {
    const best = pickBestRoundRobinCacheSweepRow([
      {
        cacheSize: 8,
        cachedLevelsEntropyBits: 6,
        entropyRecoveryRatio: 0.5,
        cachedLevelsPrefixCoverage: 0.7,
        prefixRetentionRatio: 0.8,
        cachedLevelsLeafAdjacency: 0.2,
        leafReductionRatio: 0.8,
        compromiseScore: 0.8,
      },
      {
        cacheSize: 4,
        cachedLevelsEntropyBits: 6,
        entropyRecoveryRatio: 0.5,
        cachedLevelsPrefixCoverage: 0.7,
        prefixRetentionRatio: 0.8,
        cachedLevelsLeafAdjacency: 0.2,
        leafReductionRatio: 0.8,
        compromiseScore: 0.8,
      },
    ]);

    expect(best.cacheSize).toBe(4);
  });
});

describe('formatRoundRobinCacheSweepRow', () => {
  it('formats a table row for console output', () => {
    const row = formatRoundRobinCacheSweepRow(
      {
        cacheSize: 8,
        cachedLevelsEntropyBits: 6.62,
        entropyRecoveryRatio: 0.97,
        cachedLevelsPrefixCoverage: 0.72,
        prefixRetentionRatio: 0.25,
        cachedLevelsLeafAdjacency: 0.18,
        leafReductionRatio: 0.79,
        compromiseScore: 0.52,
      },
      8,
    );

    expect(row).toEqual({
      cacheSize: 8,
      entropyBits: 6.62,
      entropyRecovery: 0.97,
      prefixCoverage: 0.72,
      prefixRetention: 0.25,
      leafAdjacency: 0.18,
      leafReduction: 0.79,
      compromiseScore: 0.52,
      recommended: 'yes',
    });
  });
});