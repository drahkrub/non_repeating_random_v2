import { pathToFileURL } from 'node:url';

import { NoMoreNumbersAvailableError, useNextNonRepeatingRandomNumber } from './index.js';
import { useNextUniformRandomNumber } from './uniformRandomNumber.js';

export interface BiasScenario {
  x: number;
  y: number;
  trials: number;
}

export interface BiasSimulationResult {
  x: number;
  y: number;
  trials: number;
  theoreticalCacheFirstValueSupport: number;
  observedCacheFirstValueSupport: number;
  observedUniformFirstValueSupport: number;
  cacheFirstValueCoverageRatio: number;
  uniformFirstValueCoverageRatio: number;
  cacheFirstValueEntropyBits: number;
  uniformFirstValueEntropyBits: number;
}

function assertPositiveInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${parameterName} must be a positive integer`);
  }
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function collectSequence(nextNumber: () => number): number[] {
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

function countNonZero(values: number[]): number {
  return values.filter((value) => value > 0).length;
}

function getEntropyBits(counts: number[], trials: number): number {
  if (trials === 0) {
    return 0;
  }

  return counts.reduce((entropy, count) => {
    if (count === 0) {
      return entropy;
    }

    const probability = count / trials;
    return entropy - probability * Math.log2(probability);
  }, 0);
}

export function runBiasSimulation(
  scenario: BiasScenario,
  randomFactory: (seed: number) => () => number = createSeededRandom,
  seed: number = 123456789,
): BiasSimulationResult {
  assertPositiveInteger(scenario.x, 'x');
  assertPositiveInteger(scenario.y, 'y');
  assertPositiveInteger(scenario.trials, 'trials');

  const cacheFirstValueCounts = Array.from({ length: scenario.x }, () => 0);
  const uniformFirstValueCounts = Array.from({ length: scenario.x }, () => 0);
  const cacheRandom = randomFactory(seed);
  const uniformRandom = randomFactory(seed ^ 0x9e3779b9);

  for (let trial = 0; trial < scenario.trials; trial += 1) {
    const cacheSequence = collectSequence(
      useNextNonRepeatingRandomNumber(scenario.x, scenario.y, cacheRandom),
    );
    const uniformSequence = collectSequence(useNextUniformRandomNumber(scenario.x, uniformRandom));

    cacheFirstValueCounts[cacheSequence[0]] += 1;
    uniformFirstValueCounts[uniformSequence[0]] += 1;
  }

  const observedCacheFirstValueSupport = countNonZero(cacheFirstValueCounts);
  const observedUniformFirstValueSupport = countNonZero(uniformFirstValueCounts);

  return {
    x: scenario.x,
    y: scenario.y,
    trials: scenario.trials,
    theoreticalCacheFirstValueSupport: Math.min(scenario.x, scenario.y),
    observedCacheFirstValueSupport,
    observedUniformFirstValueSupport,
    cacheFirstValueCoverageRatio: observedCacheFirstValueSupport / scenario.x,
    uniformFirstValueCoverageRatio: observedUniformFirstValueSupport / scenario.x,
    cacheFirstValueEntropyBits: getEntropyBits(cacheFirstValueCounts, scenario.trials),
    uniformFirstValueEntropyBits: getEntropyBits(uniformFirstValueCounts, scenario.trials),
  };
}

export function formatBiasSimulationRow(result: BiasSimulationResult): Record<string, number | string> {
  return {
    x: result.x,
    y: result.y,
    trials: result.trials,
    cacheFirstValues: `${result.observedCacheFirstValueSupport}/${result.x}`,
    uniformFirstValues: `${result.observedUniformFirstValueSupport}/${result.x}`,
    cacheCoverage: Number(result.cacheFirstValueCoverageRatio.toFixed(2)),
    uniformCoverage: Number(result.uniformFirstValueCoverageRatio.toFixed(2)),
    cacheEntropyBits: Number(result.cacheFirstValueEntropyBits.toFixed(2)),
    uniformEntropyBits: Number(result.uniformFirstValueEntropyBits.toFixed(2)),
  };
}

export function main(): void {
  const scenarios: BiasScenario[] = [
    { x: 10, y: 4, trials: 5000 },
    { x: 25, y: 4, trials: 5000 },
    { x: 100, y: 4, trials: 5000 },
  ];

  const results = scenarios.map((scenario, index) => runBiasSimulation(scenario, createSeededRandom, 123456789 + index));

  console.table(results.map(formatBiasSimulationRow));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}