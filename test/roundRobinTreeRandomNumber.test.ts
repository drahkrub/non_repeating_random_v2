import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoMoreNumbersAvailableError } from '../src/index.js';
import { main, useNextRoundRobinTreeRandomNumber } from '../src/roundRobinTreeRandomNumber.js';

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

describe('useNextRoundRobinTreeRandomNumber', () => {
  it('returns the recursive round-robin tree order for deterministic randomness', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(10, 3, () => 0);

    expect(collectSequence(nextNumber)).toEqual([7, 3, 5, 9, 1, 6, 2, 4, 8, 0]);
  });

  it('uses a single shuffled leaf when n is at most x', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(4, 5, () => 0);

    expect(collectSequence(nextNumber)).toEqual([1, 2, 3, 0]);
  });

  it('returns an empty sequence for n = 0', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(0, 3, () => 0);

    expect(collectSequence(nextNumber)).toEqual([]);
  });

  it('falls back to the sequential order when x = 1', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(4, 1, () => 0);

    expect(collectSequence(nextNumber)).toEqual([0, 1, 2, 3]);
  });

  it('rejects invalid n and x values', () => {
    expect(() => useNextRoundRobinTreeRandomNumber(-1, 3)).toThrowError('n must be a non-negative integer');
    expect(() => useNextRoundRobinTreeRandomNumber(4, 0)).toThrowError('x must be a positive integer');
  });

  it('returns each value from 0 to n - 1 exactly once', () => {
    const nextNumber = useNextRoundRobinTreeRandomNumber(25, 4, () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, 25);
  });

  it('returns each value from 0 to n - 1 exactly once for a larger n', () => {
    const n = 50000;
    const nextNumber = useNextRoundRobinTreeRandomNumber(n, 4, () => 0.123456789);
    const sequence = collectSequence(nextNumber);

    expectFullRange(sequence, n);
  });
});

describe('round-robin tree main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes ten values to the console', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    expect(logSpy.mock.calls).toEqual([
      [7],
      [3],
      [5],
      [9],
      [1],
      [6],
      [2],
      [4],
      [8],
      [0],
    ]);
  });
});