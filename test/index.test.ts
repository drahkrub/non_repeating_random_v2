import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  main,
  NoMoreNumbersAvailableError,
  useNextNonRepeatingRandomNumber,
  useNextSequentialNumber,
  useNumberCache,
} from "../src/index.js";

function createArraySource(values: number[]): () => number {
  let nextIndex = 0;

  return (): number => {
    if (nextIndex >= values.length) {
      throw new NoMoreNumbersAvailableError();
    }

    const currentValue = values[nextIndex];
    nextIndex += 1;
    return currentValue;
  };
}

describe("useNextSequentialNumber", () => {
  it("returns consecutive numbers until the source is exhausted", () => {
    const nextNumber = useNextSequentialNumber(3);

    expect([nextNumber(), nextNumber(), nextNumber()]).toEqual([0, 1, 2]);
    expect(() => nextNumber()).toThrowError(NoMoreNumbersAvailableError);
  });

  it("rejects non-positive integers", () => {
    expect(() => useNextSequentialNumber(0)).toThrowError(
      "x must be a positive integer",
    );
  });
});

describe("useNumberCache", () => {
  it("can reuse the cache with a different source function", () => {
    const nextNumber = createArraySource([10, 11, 12, 13]);
    const f = useNumberCache(nextNumber, 2, () => 0);

    expect([f(), f(), f(), f()]).toEqual([10, 12, 13, 11]);
  });

  it("throws only after the cache has been drained completely", () => {
    const nextNumber = createArraySource([10, 11]);
    const f = useNumberCache(nextNumber, 5, () => 0);

    expect(f()).toBe(10);
    expect(f()).toBe(11);
    expect(() => f()).toThrowError(NoMoreNumbersAvailableError);
  });

  it("rejects non-positive cache sizes", () => {
    expect(() => useNumberCache(createArraySource([10]), 0)).toThrowError(
      "y must be a positive integer",
    );
  });
});

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

  it("composes the sequential source with the reusable cache", () => {
    const composed = useNextNonRepeatingRandomNumber(5, 2, () => 0);
    const manual = useNumberCache(useNextSequentialNumber(5), 2, () => 0);

    expect([
      composed(),
      composed(),
      composed(),
      composed(),
      composed(),
    ]).toEqual([manual(), manual(), manual(), manual(), manual()]);
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