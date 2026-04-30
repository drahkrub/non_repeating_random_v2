import { pathToFileURL } from 'node:url';

import { NoMoreNumbersAvailableError } from './index.js';

function assertPositiveInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${parameterName} must be a positive integer`);
  }
}

function getRandomIndex(length: number, random: () => number): number {
  return Math.floor(random() * length);
}

export function useNextUniformRandomNumber(
  x: number,
  random: () => number = Math.random,
): () => number {
  assertPositiveInteger(x, 'x');

  const numbers = Array.from({ length: x }, (_, index) => index);

  for (let currentIndex = numbers.length - 1; currentIndex > 0; currentIndex -= 1) {
    const swapIndex = getRandomIndex(currentIndex + 1, random);
    [numbers[currentIndex], numbers[swapIndex]] = [numbers[swapIndex], numbers[currentIndex]];
  }

  let nextIndex = 0;

  return (): number => {
    if (nextIndex >= numbers.length) {
      throw new NoMoreNumbersAvailableError();
    }

    const currentNumber = numbers[nextIndex];
    nextIndex += 1;
    return currentNumber;
  };
}

export function main(): void {
  const x = 10;
  const f = useNextUniformRandomNumber(x);

  for (let index = 0; index < x; index += 1) {
    console.log(f());
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}