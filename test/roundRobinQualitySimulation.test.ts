import { describe, expect, it } from 'vitest';

import {
  formatRoundRobinQualityRow,
  runRoundRobinQualitySimulation,
} from '../src/roundRobinQualitySimulation.js';
import { createSeededRandom } from '../src/cacheBiasSimulation.js';

describe('runRoundRobinQualitySimulation', () => {
  it("shows that caching lifts the by-levels first-position entropy to at least the uncached by-levels variant", () => {
    const result = runRoundRobinQualitySimulation(
      { n: 100, fixedX: 4, xValues: [4, 3, 2], cacheSize: 8, trials: 3000 },
      createSeededRandom,
      123456789,
    );

    expect(result.uniform.firstValueEntropyBits).toBeGreaterThan(
      result.fixed.firstValueEntropyBits,
    );
    expect(result.uniform.firstValueEntropyBits).toBeGreaterThan(
      result.levels.firstValueEntropyBits,
    );
    expect(result.cachedLevels.firstValueEntropyBits).toBeGreaterThanOrEqual(
      result.levels.firstValueEntropyBits,
    );
  });

  it("shows much stronger leaf clustering for the round-robin variants than for the uniform baseline", () => {
    const result = runRoundRobinQualitySimulation(
      { n: 100, fixedX: 4, xValues: [4, 3, 2], cacheSize: 8, trials: 3000 },
      createSeededRandom,
      987654321,
    );

    expect(result.fixedLeafAdjacency.algorithmRate).toBeGreaterThan(
      result.fixedLeafAdjacency.uniformRate,
    );
    expect(result.levelsLeafAdjacency.algorithmRate).toBeGreaterThan(
      result.levelsLeafAdjacency.uniformRate,
    );
    expect(result.cachedLevelsLeafAdjacency.algorithmRate).toBeGreaterThan(
      result.cachedLevelsLeafAdjacency.uniformRate,
    );
  });

  it("shows that the cached by-levels variant reduces leaf clustering versus the uncached by-levels variant", () => {
    const result = runRoundRobinQualitySimulation(
      { n: 100, fixedX: 4, xValues: [4, 3, 2], cacheSize: 8, trials: 3000 },
      createSeededRandom,
      192837465,
    );

    expect(result.cachedLevelsLeafAdjacency.algorithmRate).toBeLessThan(
      result.levelsLeafAdjacency.algorithmRate,
    );
  });

  it('reports inversion and prefix coverage metrics in valid ranges', () => {
    const result = runRoundRobinQualitySimulation(
      { n: 100, fixedX: 4, xValues: [4, 3, 2], cacheSize: 8, trials: 3000 },
      createSeededRandom,
      246813579,
    );

    expect(result.fixed.normalizedInversionRate).toBeGreaterThanOrEqual(0);
    expect(result.fixed.normalizedInversionRate).toBeLessThanOrEqual(1);
    expect(result.levels.normalizedInversionRate).toBeGreaterThanOrEqual(0);
    expect(result.levels.normalizedInversionRate).toBeLessThanOrEqual(1);
    expect(result.uniform.normalizedInversionRate).toBeGreaterThanOrEqual(0);
    expect(result.uniform.normalizedInversionRate).toBeLessThanOrEqual(1);
    expect(result.cachedLevels.normalizedInversionRate).toBeGreaterThanOrEqual(
      0,
    );
    expect(result.cachedLevels.normalizedInversionRate).toBeLessThanOrEqual(1);

    expect(result.fixed.prefixBucketCoverage).toBeGreaterThanOrEqual(0);
    expect(result.fixed.prefixBucketCoverage).toBeLessThanOrEqual(1);
    expect(result.levels.prefixBucketCoverage).toBeGreaterThanOrEqual(0);
    expect(result.levels.prefixBucketCoverage).toBeLessThanOrEqual(1);
    expect(result.uniform.prefixBucketCoverage).toBeGreaterThanOrEqual(0);
    expect(result.uniform.prefixBucketCoverage).toBeLessThanOrEqual(1);
    expect(result.cachedLevels.prefixBucketCoverage).toBeGreaterThanOrEqual(0);
    expect(result.cachedLevels.prefixBucketCoverage).toBeLessThanOrEqual(1);
  });

  it('shows that all algorithms stay very close to the expected inversion rate of 0.5', () => {
    const result = runRoundRobinQualitySimulation(
      { n: 100, fixedX: 4, xValues: [4, 3, 2], cacheSize: 8, trials: 3000 },
      createSeededRandom,
      135792468,
    );

    expect(result.fixed.inversionDeviationFromHalf).toBeLessThan(0.01);
    expect(result.levels.inversionDeviationFromHalf).toBeLessThan(0.01);
    expect(result.uniform.inversionDeviationFromHalf).toBeLessThan(0.01);
    expect(result.cachedLevels.inversionDeviationFromHalf).toBeLessThan(0.01);
  });

  it('rejects invalid scenarios', () => {
    expect(() =>
      runRoundRobinQualitySimulation({
        n: 0,
        fixedX: 3,
        xValues: [2, 3],
        cacheSize: 2,
        trials: 100,
      }),
    ).toThrowError("n must be a positive integer");
    expect(() =>
      runRoundRobinQualitySimulation({
        n: 10,
        fixedX: 3,
        xValues: [],
        cacheSize: 2,
        trials: 100,
      }),
    ).toThrowError("xValues must contain at least one positive integer");
    expect(() =>
      runRoundRobinQualitySimulation({
        n: 10,
        fixedX: 3,
        xValues: [2, 3],
        cacheSize: 0,
        trials: 100,
      }),
    ).toThrowError("cacheSize must be a positive integer");
  });
});

describe('formatRoundRobinQualityRow', () => {
  it('formats a table row for console output', () => {
    const row = formatRoundRobinQualityRow({
      n: 25,
      fixedX: 4,
      xValues: [4, 3, 2],
      cacheSize: 8,
      trials: 1000,
      prefixLength: 10,
      prefixBucketCount: 10,
      fixed: {
        observedFirstValueSupport: 8,
        firstValueCoverageRatio: 0.32,
        firstValueEntropyBits: 2.5,
        normalizedInversionRate: 0.47,
        inversionDeviationFromHalf: 0.03,
        prefixBucketCoverage: 0.9,
      },
      levels: {
        observedFirstValueSupport: 9,
        firstValueCoverageRatio: 0.36,
        firstValueEntropyBits: 2.7,
        normalizedInversionRate: 0.46,
        inversionDeviationFromHalf: 0.04,
        prefixBucketCoverage: 0.95,
      },
      cachedLevels: {
        observedFirstValueSupport: 10,
        firstValueCoverageRatio: 0.4,
        firstValueEntropyBits: 3,
        normalizedInversionRate: 0.49,
        inversionDeviationFromHalf: 0.01,
        prefixBucketCoverage: 0.93,
      },
      uniform: {
        observedFirstValueSupport: 25,
        firstValueCoverageRatio: 1,
        firstValueEntropyBits: 4.64,
        normalizedInversionRate: 0.5,
        inversionDeviationFromHalf: 0,
        prefixBucketCoverage: 0.75,
      },
      fixedLeafAdjacency: {
        algorithmRate: 0.76,
        uniformRate: 0.12,
      },
      levelsLeafAdjacency: {
        algorithmRate: 0.79,
        uniformRate: 0.09,
      },
      cachedLevelsLeafAdjacency: {
        algorithmRate: 0.41,
        uniformRate: 0.09,
      },
    });

    expect(row).toEqual({
      n: 25,
      fixedX: 4,
      xValues: "4, 3, 2",
      cacheSize: 8,
      trials: 1000,
      prefixLength: 10,
      prefixBuckets: 10,
      fixedFirstValues: "8/25",
      levelsFirstValues: "9/25",
      cachedLevelsFirstValues: "10/25",
      uniformFirstValues: "25/25",
      fixedEntropyBits: 2.5,
      levelsEntropyBits: 2.7,
      cachedLevelsEntropyBits: 3,
      uniformEntropyBits: 4.64,
      fixedInversionDelta: 0.03,
      levelsInversionDelta: 0.04,
      cachedLevelsInversionDelta: 0.01,
      uniformInversionDelta: 0,
      fixedPrefixCoverage: 0.9,
      levelsPrefixCoverage: 0.95,
      cachedLevelsPrefixCoverage: 0.93,
      uniformPrefixCoverage: 0.75,
      fixedLeafAdjacency: 0.76,
      uniformFixedAdjacency: 0.12,
      levelsLeafAdjacency: 0.79,
      uniformLevelsAdjacency: 0.09,
      cachedLevelsLeafAdjacency: 0.41,
      uniformCachedLevelsAdjacency: 0.09,
    });
  });
});