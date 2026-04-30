import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  main,
  NoMoreNumbersAvailableError,
  useNextNonRepeatingRandomNumber,
} from '../src/index.js';

describe('useNextNonRepeatingRandomNumber', () => {
  it('fills the cache with min(x, y) values and replaces delivered entries while the source still has numbers', () => {
    const f = useNextNonRepeatingRandomNumber(5, 2, () => 0);

    expect([f(), f(), f(), f(), f()]).toEqual([0, 2, 3, 4, 1]);
  });

  it('starts with x values when the cache is larger than the source', () => {
    const f = useNextNonRepeatingRandomNumber(3, 5, () => 0);

    expect([f(), f(), f()]).toEqual([0, 2, 1]);
  });

  it('throws only after the cache has been drained completely', () => {
    const f = useNextNonRepeatingRandomNumber(2, 5, () => 0);

    expect(f()).toBe(0);
    expect(f()).toBe(1);
    expect(() => f()).toThrowError(NoMoreNumbersAvailableError);
  });

  it('rejects non-positive integers for x and y', () => {
    expect(() => useNextNonRepeatingRandomNumber(0, 1)).toThrowError('x must be a positive integer');
    expect(() => useNextNonRepeatingRandomNumber(1, 0)).toThrowError('y must be a positive integer');
  });
});

describe('main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes ten values from the cache to the console', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    main();

    expect(logSpy.mock.calls).toEqual([
      [0],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [3],
      [2],
      [1],
    ]);
  });
});