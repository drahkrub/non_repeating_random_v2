import { pathToFileURL } from 'node:url';

export class NoMoreNumbersAvailableError extends Error {
  constructor() {
    super('No more numbers available');
    this.name = 'NoMoreNumbersAvailableError';
  }
}

function assertPositiveInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${parameterName} must be a positive integer`);
  }
}

function getRandomIndex(length: number, random: () => number): number {
  return Math.floor(random() * length);
}

export type NextNumber = () => number;

export function useNextSequentialNumber(x: number): NextNumber {
  assertPositiveInteger(x, "x");

  let nextNumber = 0;

  return (): number => {
    if (nextNumber >= x) {
      throw new NoMoreNumbersAvailableError();
    }

    const currentNumber = nextNumber;
    nextNumber += 1;
    return currentNumber;
  };
}

export function useNumberCache(
  nextNumber: NextNumber,
  y: number,
  random: () => number = Math.random,
): NextNumber {
  assertPositiveInteger(y, "y");

  let sourceExhausted = false;
  const cache: number[] = [];

  const fillCache = (): void => {
    while (cache.length < y && !sourceExhausted) {
      try {
        cache.push(nextNumber());
      } catch (error) {
        if (!(error instanceof NoMoreNumbersAvailableError)) {
          throw error;
        }

        sourceExhausted = true;
      }
    }
  };

  return (): number => {
    if (cache.length === 0) {
      fillCache();

      if (cache.length === 0) {
        throw new NoMoreNumbersAvailableError();
      }
    }

    const selectedIndex = getRandomIndex(cache.length, random);
    const selectedValue = cache[selectedIndex];

    if (!sourceExhausted) {
      try {
        cache[selectedIndex] = nextNumber();
        return selectedValue;
      } catch (error) {
        if (!(error instanceof NoMoreNumbersAvailableError)) {
          throw error;
        }

        sourceExhausted = true;
      }
    }

    const lastIndex = cache.length - 1;
    cache[selectedIndex] = cache[lastIndex];
    cache.pop();

    return selectedValue;
  };
}

export function useNextNonRepeatingRandomNumber(
  x: number,
  y: number,
  random: () => number = Math.random,
): NextNumber {
  return useNumberCache(useNextSequentialNumber(x), y, random);
}

export function main(): void {
  const x = 10;
  const y = 4;
  const nextNumber = useNextSequentialNumber(x);
  const f = useNumberCache(nextNumber, y);

  for (let index = 0; index < 10; index += 1) {
    console.log(f());
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}