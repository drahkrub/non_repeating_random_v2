import { pathToFileURL } from 'node:url';

import {
  NextNumber,
  NoMoreNumbersAvailableError,
  useNextSequentialNumber,
  useNumberCache,
} from './index.js';
import { useNextUniformRandomNumber } from './uniformRandomNumber.js';

function assertNonNegativeInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${parameterName} must be a non-negative integer`);
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

function shuffleInPlace<T>(values: T[], random: () => number): void {
  for (let currentIndex = values.length - 1; currentIndex > 0; currentIndex -= 1) {
    const swapIndex = getRandomIndex(currentIndex + 1, random);
    [values[currentIndex], values[swapIndex]] = [values[swapIndex], values[currentIndex]];
  }
}

function createEmptyGenerator(): NextNumber {
  return (): number => {
    throw new NoMoreNumbersAvailableError();
  };
}

function createShuffledPortion(
  n: number,
  portionCount: number,
  portionIndex: number,
  random: () => number,
): number[] {
  const portion: number[] = [];

  for (let value = portionIndex; value < n; value += portionCount) {
    portion.push(value);
  }

  shuffleInPlace(portion, random);
  return portion;
}

function assertXValues(xValues: readonly number[]): void {
  if (xValues.length === 0) {
    throw new Error('xValues must contain at least one positive integer');
  }

  xValues.forEach((value, index) => {
    assertPositiveInteger(value, `xValues[${index}]`);
  });
}

function getXForLevel(xValues: readonly number[], level: number): number {
  return xValues[Math.min(level, xValues.length - 1)];
}

function createLevelSource(
  n: number,
  xValues: readonly number[],
  level: number,
  cacheSize: number,
  random: () => number,
): NextNumber {
  const currentX = getXForLevel(xValues, level);

  if (n === 0) {
    return createEmptyGenerator();
  }

  if (n <= currentX) {
    return useNextUniformRandomNumber(n, random);
  }

  if (currentX === 1 && level >= xValues.length - 1) {
    return useNextSequentialNumber(n);
  }

  const portionCount = Math.ceil(n / currentX);
  const nextPortionIndex = useNextRoundRobinTreeRandomNumberWithCacheForLevel(
    portionCount,
    xValues,
    cacheSize,
    level + 1,
    random,
  );
  let currentPortion: number[] = [];
  let currentPortionIndex = 0;

  return (): number => {
    if (currentPortionIndex >= currentPortion.length) {
      const portionIndex = nextPortionIndex();
      currentPortion = createShuffledPortion(n, portionCount, portionIndex, random);
      currentPortionIndex = 0;
    }

    const nextValue = currentPortion[currentPortionIndex];
    currentPortionIndex += 1;
    return nextValue;
  };
}

function useNextRoundRobinTreeRandomNumberWithCacheForLevel(
  n: number,
  xValues: readonly number[],
  cacheSize: number,
  level: number,
  random: () => number,
): NextNumber {
  if (n === 0) {
    return createEmptyGenerator();
  }

  const levelSource = createLevelSource(n, xValues, level, cacheSize, random);
  return useNumberCache(levelSource, cacheSize, random);
}

export function useNextRoundRobinTreeRandomNumberWithCache(
  n: number,
  xValues: readonly number[],
  cacheSize: number,
  random: () => number = Math.random,
): NextNumber {
  assertNonNegativeInteger(n, 'n');
  assertXValues(xValues);
  assertPositiveInteger(cacheSize, 'cacheSize');

  return useNextRoundRobinTreeRandomNumberWithCacheForLevel(n, xValues, cacheSize, 0, random);
}

export function main(): void {
  const n = 10;
  const xValues = [2, 3];
  const cacheSize = 3;
  const nextNumber = useNextRoundRobinTreeRandomNumberWithCache(n, xValues, cacheSize);

  for (let index = 0; index < n; index += 1) {
    console.log(nextNumber());
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}