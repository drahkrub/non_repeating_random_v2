import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoMoreNumbersAvailableError } from '../src/index.js';
import { main, useNextRoundRobinTreeRandomNumber } from '../src/roundRobinTreeRandomNumberByLevels.js';
import { useNextRoundRobinTreeRandomNumber as useFixedRoundRobinTreeRandomNumber } from '../src/roundRobinTreeRandomNumber.js';

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

describe('useNextRoundRobinTreeRandomNumber by levels', () => {
  it('uses x_0 for the lowest level and x_1 for the level above', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(10, [2, 3], () => 0);

    expect(collectSequence(nextNumber)).toEqual([8, 3, 6, 1, 7, 2, 9, 4, 5, 0]);
  });

  it('matches the fixed-x implementation when only one x is provided', () => {
    const byLevels = useNextRoundRobinTreeRandomNumber(10, [3], () => 0);
    const fixed = useFixedRoundRobinTreeRandomNumber(10, 3, () => 0);

    expect(collectSequence(byLevels)).toEqual(collectSequence(fixed));
  });

  it('ignores extra x values when fewer levels are needed', () => {
    const withExtra = useNextRoundRobinTreeRandomNumber(4, [10, 2, 3], () => 0);
    const minimal = useNextRoundRobinTreeRandomNumber(4, [10], () => 0);

    expect(collectSequence(withExtra)).toEqual(collectSequence(minimal));
  });

  it('reuses the last x value for all remaining levels', () => {
    const repeatedLast = useNextRoundRobinTreeRandomNumber(20, [3, 2], () => 0.123456789);
    const explicitLevels = useNextRoundRobinTreeRandomNumber(20, [3, 2, 2, 2], () => 0.123456789);

    expect(collectSequence(repeatedLast)).toEqual(collectSequence(explicitLevels));
  });

  it('returns an empty sequence for n = 0', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(0, [3], () => 0);

    expect(collectSequence(nextNumber)).toEqual([]);
  });

  it('falls back to the sequential order when the repeated final x is 1', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(4, [1, 1], () => 0);

    expect(collectSequence(nextNumber)).toEqual([0, 1, 2, 3]);
  });

  it('rejects invalid n and x values', () => {
    expect(() => useNextRoundRobinTreeRandomNumber(-1, [3])).toThrowError('n must be a non-negative integer');
    expect(() => useNextRoundRobinTreeRandomNumber(4, [])).toThrowError(
      'xValues must contain at least one positive integer',
    );
    expect(() => useNextRoundRobinTreeRandomNumber(4, [2, 0])).toThrowError(
      'xValues[1] must be a positive integer',
    );
  });

  it('returns each value from 0 to n - 1 exactly once', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(25, [4, 3, 2], () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, 25);
  });

  it('returns each value from 0 to n - 1 exactly once for a larger n', () => {
    const n = 50000;
    const nextNumber = useNextRoundRobinTreeRandomNumber(n, [4, 3, 2], () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, n);
  });
});

describe('round-robin tree by levels main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes ten values to the console', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    expect(logSpy.mock.calls).toEqual([
      [8],
      [3],
      [6],
      [1],
      [7],
      [2],
      [9],
      [4],
      [5],
      [0],
    ]);
  });
});