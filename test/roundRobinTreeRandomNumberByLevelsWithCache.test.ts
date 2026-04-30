import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSeededRandom } from '../src/cacheBiasSimulation.js';
import { NoMoreNumbersAvailableError } from '../src/index.js';
import { useNextRoundRobinTreeRandomNumber as useNextRoundRobinTreeRandomNumberByLevels } from '../src/roundRobinTreeRandomNumberByLevels.js';
import {
  main,
  useNextRoundRobinTreeRandomNumberWithCache,
} from '../src/roundRobinTreeRandomNumberByLevelsWithCache.js';

function collectSequence(nextNumber: () => number): number[] {
  const sequence: number[] = [];

  while (true) {
    try {
      sequence.push(nextNumber());
    } catch (error) {
      if (error instanceof NoMoreNumbersAvailableError) {
        return sequence;
      }

      throw error;
    }
  }
}

function expectFullRange(sequence: number[], n: number): void {
  expect(sequence).toHaveLength(n);
  expect(new Set(sequence)).toHaveProperty('size', n);
  expect([...sequence].sort((left, right) => left - right)).toEqual(
    Array.from({ length: n }, (_, index) => index),
  );
}

function getLeafAdjacencyRate(sequence: number[], leafWidth: number): number {
  const leafPortionCount = Math.ceil(sequence.length / leafWidth);
  let adjacentPairCount = 0;

  for (let index = 0; index < sequence.length - 1; index += 1) {
    if (sequence[index] % leafPortionCount === sequence[index + 1] % leafPortionCount) {
      adjacentPairCount += 1;
    }
  }

  return adjacentPairCount / (sequence.length - 1);
}

describe('useNextRoundRobinTreeRandomNumberWithCache', () => {
  it('matches the uncached by-levels implementation when cacheSize is 1', () => {
    const cached = useNextRoundRobinTreeRandomNumberWithCache(10, [2, 3], 1, () => 0);
    const uncached = useNextRoundRobinTreeRandomNumberByLevels(10, [2, 3], () => 0);

    expect(collectSequence(cached)).toEqual(collectSequence(uncached));
  });

  it('ignores extra x values when fewer levels are needed', () => {
    const withExtra = useNextRoundRobinTreeRandomNumberWithCache(4, [10, 2, 3], 3, () => 0);
    const minimal = useNextRoundRobinTreeRandomNumberWithCache(4, [10], 3, () => 0);

    expect(collectSequence(withExtra)).toEqual(collectSequence(minimal));
  });

  it('reuses the last x value for all remaining levels', () => {
    const repeatedLast = useNextRoundRobinTreeRandomNumberWithCache(20, [3, 2], 4, () => 0.123456789);
    const explicitLevels = useNextRoundRobinTreeRandomNumberWithCache(20, [3, 2, 2, 2], 4, () => 0.123456789);

    expect(collectSequence(repeatedLast)).toEqual(collectSequence(explicitLevels));
  });

  it('returns an empty sequence for n = 0', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumberWithCache(0, [3], 2, () => 0);

    expect(collectSequence(nextNumber)).toEqual([]);
  });

  it('rejects invalid n, xValues, and cacheSize values', () => {
    expect(() => useNextRoundRobinTreeRandomNumberWithCache(-1, [3], 2)).toThrowError(
      'n must be a non-negative integer',
    );
    expect(() => useNextRoundRobinTreeRandomNumberWithCache(4, [], 2)).toThrowError(
      'xValues must contain at least one positive integer',
    );
    expect(() => useNextRoundRobinTreeRandomNumberWithCache(4, [2, 0], 2)).toThrowError(
      'xValues[1] must be a positive integer',
    );
    expect(() => useNextRoundRobinTreeRandomNumberWithCache(4, [2], 0)).toThrowError(
      'cacheSize must be a positive integer',
    );
  });

  it('returns each value from 0 to n - 1 exactly once', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumberWithCache(25, [4, 3, 2], 4, () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, 25);
  });

  it('returns each value from 0 to n - 1 exactly once for a larger n', () => {
    const n = 50000;
    const nextNumber = useNextRoundRobinTreeRandomNumberWithCache(n, [4, 3, 2], 8, () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, n);
  });

  it('reduces average leaf clustering compared to the uncached by-levels implementation', () => {
    const n = 100;
    const xValues = [4, 3, 2];
    const cacheSize = 8;
    const trials = 300;
    let uncachedLeafAdjacencySum = 0;
    let cachedLeafAdjacencySum = 0;

    for (let trial = 0; trial < trials; trial += 1) {
      const seed = 123456789 + trial;
      const uncachedRandom = createSeededRandom(seed);
      const cachedRandom = createSeededRandom(seed);
      const uncachedSequence = collectSequence(
        useNextRoundRobinTreeRandomNumberByLevels(n, xValues, uncachedRandom),
      );
      const cachedSequence = collectSequence(
        useNextRoundRobinTreeRandomNumberWithCache(n, xValues, cacheSize, cachedRandom),
      );

      uncachedLeafAdjacencySum += getLeafAdjacencyRate(uncachedSequence, xValues[0]);
      cachedLeafAdjacencySum += getLeafAdjacencyRate(cachedSequence, xValues[0]);
    }

    expect(cachedLeafAdjacencySum / trials).toBeLessThan(uncachedLeafAdjacencySum / trials);
  });
});

describe('round-robin tree by levels with cache main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes ten unique values from 0 to 9 to the console', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    const values = logSpy.mock.calls.map(([value]) => value as number);
    expectFullRange(values, 10);
  });
});