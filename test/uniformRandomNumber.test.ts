import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoMoreNumbersAvailableError } from '../src/index.js';
import { main, useNextUniformRandomNumber } from '../src/uniformRandomNumber.js';

describe('useNextUniformRandomNumber', () => {
  it('returns a deterministic permutation for a deterministic random source', () => {
    const f = useNextUniformRandomNumber(4, () => 0);

    expect([f(), f(), f(), f()]).toEqual([1, 2, 3, 0]);
  });

  it('throws an error from the x + 1st call onward', () => {
    const f = useNextUniformRandomNumber(2, () => 0);

    expect(f()).toBe(1);
    expect(f()).toBe(0);
    expect(() => f()).toThrowError(NoMoreNumbersAvailableError);
  });

  it('rejects non-positive integers', () => {
    expect(() => useNextUniformRandomNumber(0)).toThrowError('x must be a positive integer');
  });
});

describe('uniform main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes ten values from a uniform permutation to the console', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    expect(logSpy.mock.calls).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [0],
    ]);
  });
});