import { pathToFileURL } from 'node:url';

import { NextNumber, NoMoreNumbersAvailableError, useNextSequentialNumber } from './index.js';
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

export function useNextRoundRobinTreeRandomNumber(
  n: number,
  x: number,
  random: () => number = Math.random,
): NextNumber {
  assertNonNegativeInteger(n, 'n');
  assertPositiveInteger(x, 'x');

  if (n === 0) {
    return createEmptyGenerator();
  }

  if (x === 1) {
    return useNextSequentialNumber(n);
  }

  if (n <= x) {
    return useNextUniformRandomNumber(n, random);
  }

  const portionCount = Math.ceil(n / x);
  const nextPortionIndex = useNextRoundRobinTreeRandomNumber(portionCount, x, random);
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

export function main(): void {
  const n = 10;
  const x = 3;
  const nextNumber = useNextRoundRobinTreeRandomNumber(n, x);

  for (let index = 0; index < n; index += 1) {
    console.log(nextNumber());
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}