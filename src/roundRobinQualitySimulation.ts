import { pathToFileURL } from 'node:url';

import { collectSequence, createSeededRandom } from './cacheBiasSimulation.js';
import { useNextRoundRobinTreeRandomNumber as useFixedRoundRobinTreeRandomNumber } from './roundRobinTreeRandomNumber.js';
import { useNextRoundRobinTreeRandomNumber as useLevelRoundRobinTreeRandomNumber } from './roundRobinTreeRandomNumberByLevels.js';
import { useNextUniformRandomNumber } from './uniformRandomNumber.js';

export interface RoundRobinQualityScenario {
  n: number;
  fixedX: number;
  xValues: readonly number[];
  trials: number;
}

export interface RoundRobinAlgorithmMetrics {
  observedFirstValueSupport: number;
  firstValueCoverageRatio: number;
  firstValueEntropyBits: number;
  normalizedInversionRate: number;
  inversionDeviationFromHalf: number;
  prefixBucketCoverage: number;
}

export interface LeafAdjacencyMetrics {
  algorithmRate: number;
  uniformRate: number;
}

export interface RoundRobinQualityResult {
  n: number;
  fixedX: number;
  xValues: readonly number[];
  trials: number;
  prefixLength: number;
  prefixBucketCount: number;
  fixed: RoundRobinAlgorithmMetrics;
  levels: RoundRobinAlgorithmMetrics;
  uniform: RoundRobinAlgorithmMetrics;
  fixedLeafAdjacency: LeafAdjacencyMetrics;
  levelsLeafAdjacency: LeafAdjacencyMetrics;
}

interface MetricsTracker {
  firstValueCounts: number[];
  leafAdjacentPairCount: number;
  inversionCountSum: number;
  prefixBucketCoverageSum: number;
}

type GeneratorFactory = (random: () => number) => () => number;

function assertPositiveInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${parameterName} must be a positive integer`);
  }
}

function assertScenario(scenario: RoundRobinQualityScenario): void {
  assertPositiveInteger(scenario.n, 'n');
  assertPositiveInteger(scenario.fixedX, 'fixedX');
  assertPositiveInteger(scenario.trials, 'trials');

  if (scenario.xValues.length === 0) {
    throw new Error('xValues must contain at least one positive integer');
  }

  scenario.xValues.forEach((value, index) => {
    assertPositiveInteger(value, `xValues[${index}]`);
  });
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

function createMetricsTracker(n: number): MetricsTracker {
  return {
    firstValueCounts: Array.from({ length: n }, () => 0),
    leafAdjacentPairCount: 0,
    inversionCountSum: 0,
    prefixBucketCoverageSum: 0,
  };
}

function recordSequence(
  tracker: MetricsTracker,
  sequence: number[],
  getLeafPortionId: (value: number) => number,
  prefixLength: number,
  prefixBucketCount: number,
): void {
  tracker.firstValueCounts[sequence[0]] += 1;

  for (let index = 0; index < sequence.length - 1; index += 1) {
    if (getLeafPortionId(sequence[index]) === getLeafPortionId(sequence[index + 1])) {
      tracker.leafAdjacentPairCount += 1;
    }
  }

  tracker.inversionCountSum += getNormalizedInversionRate(sequence);
  tracker.prefixBucketCoverageSum += getPrefixBucketCoverage(sequence, prefixLength, prefixBucketCount);
}

function createFenwickTree(size: number): number[] {
  return Array.from({ length: size + 1 }, () => 0);
}

function updateFenwickTree(tree: number[], index: number, delta: number): void {
  for (let currentIndex = index + 1; currentIndex < tree.length; currentIndex += currentIndex & -currentIndex) {
    tree[currentIndex] += delta;
  }
}

function queryFenwickTree(tree: number[], index: number): number {
  let sum = 0;

  for (let currentIndex = index + 1; currentIndex > 0; currentIndex -= currentIndex & -currentIndex) {
    sum += tree[currentIndex];
  }

  return sum;
}

function getNormalizedInversionRate(sequence: number[]): number {
  const pairCount = (sequence.length * (sequence.length - 1)) / 2;

  if (pairCount === 0) {
    return 0;
  }

  const tree = createFenwickTree(sequence.length);
  let inversionCount = 0;

  sequence.forEach((value, index) => {
    const seenCount = index;
    const lessOrEqualSeenCount = queryFenwickTree(tree, value);
    inversionCount += seenCount - lessOrEqualSeenCount;
    updateFenwickTree(tree, value, 1);
  });

  return inversionCount / pairCount;
}

function getBucketId(value: number, n: number, bucketCount: number): number {
  return Math.floor((value * bucketCount) / n);
}

function getPrefixBucketCoverage(sequence: number[], prefixLength: number, bucketCount: number): number {
  const coveredBuckets = new Set<number>();
  const actualPrefixLength = Math.min(prefixLength, sequence.length);

  for (let index = 0; index < actualPrefixLength; index += 1) {
    coveredBuckets.add(getBucketId(sequence[index], sequence.length, bucketCount));
  }

  return coveredBuckets.size / Math.min(bucketCount, actualPrefixLength);
}

function finalizeMetrics(
  tracker: MetricsTracker,
  n: number,
  trials: number,
): RoundRobinAlgorithmMetrics {
  const normalizedInversionRate = tracker.inversionCountSum / trials;

  return {
    observedFirstValueSupport: countNonZero(tracker.firstValueCounts),
    firstValueCoverageRatio: countNonZero(tracker.firstValueCounts) / n,
    firstValueEntropyBits: getEntropyBits(tracker.firstValueCounts, trials),
    normalizedInversionRate,
    inversionDeviationFromHalf: Math.abs(normalizedInversionRate - 0.5),
    prefixBucketCoverage: tracker.prefixBucketCoverageSum / trials,
  };
}

function getLeafAdjacencyRate(tracker: MetricsTracker, n: number, trials: number): number {
  const adjacentPairCountPerSequence = n - 1;
  return tracker.leafAdjacentPairCount / (trials * adjacentPairCountPerSequence);
}

function createLeafPortionIdGetter(n: number, leafWidth: number): (value: number) => number {
  const leafPortionCount = Math.ceil(n / leafWidth);
  return (value: number): number => value % leafPortionCount;
}

function simulateAlgorithm(
  n: number,
  trials: number,
  generatorFactory: GeneratorFactory,
  random: () => number,
  getLeafPortionId: (value: number) => number,
  prefixLength: number,
  prefixBucketCount: number,
): { metrics: RoundRobinAlgorithmMetrics; leafAdjacencyRate: number } {
  const tracker = createMetricsTracker(n);

  for (let trial = 0; trial < trials; trial += 1) {
    const sequence = collectSequence(generatorFactory(random));
    recordSequence(tracker, sequence, getLeafPortionId, prefixLength, prefixBucketCount);
  }

  return {
    metrics: finalizeMetrics(tracker, n, trials),
    leafAdjacencyRate: getLeafAdjacencyRate(tracker, n, trials),
  };
}

export function runRoundRobinQualitySimulation(
  scenario: RoundRobinQualityScenario,
  randomFactory: (seed: number) => () => number = createSeededRandom,
  seed: number = 123456789,
): RoundRobinQualityResult {
  assertScenario(scenario);

  const fixedRandom = randomFactory(seed);
  const levelsRandom = randomFactory(seed ^ 0x9e3779b9);
  const uniformRandom = randomFactory(seed ^ 0x85ebca6b);
  const uniformForFixedRandom = randomFactory(seed ^ 0xc2b2ae35);
  const uniformForLevelsRandom = randomFactory(seed ^ 0x27d4eb2f);
  const fixedLeafPortionId = createLeafPortionIdGetter(scenario.n, scenario.fixedX);
  const levelsLeafPortionId = createLeafPortionIdGetter(scenario.n, scenario.xValues[0]);
  const prefixBucketCount = Math.min(10, scenario.n);
  const prefixLength = Math.min(scenario.n, Math.max(10, Math.ceil(scenario.n / 10)));
  const fixed = simulateAlgorithm(
    scenario.n,
    scenario.trials,
    (random) => useFixedRoundRobinTreeRandomNumber(scenario.n, scenario.fixedX, random),
    fixedRandom,
    fixedLeafPortionId,
    prefixLength,
    prefixBucketCount,
  );
  const levels = simulateAlgorithm(
    scenario.n,
    scenario.trials,
    (random) => useLevelRoundRobinTreeRandomNumber(scenario.n, scenario.xValues, random),
    levelsRandom,
    levelsLeafPortionId,
    prefixLength,
    prefixBucketCount,
  );
  const uniform = simulateAlgorithm(
    scenario.n,
    scenario.trials,
    (random) => useNextUniformRandomNumber(scenario.n, random),
    uniformRandom,
    fixedLeafPortionId,
    prefixLength,
    prefixBucketCount,
  );
  const uniformForFixed = simulateAlgorithm(
    scenario.n,
    scenario.trials,
    (random) => useNextUniformRandomNumber(scenario.n, random),
    uniformForFixedRandom,
    fixedLeafPortionId,
    prefixLength,
    prefixBucketCount,
  );
  const uniformForLevels = simulateAlgorithm(
    scenario.n,
    scenario.trials,
    (random) => useNextUniformRandomNumber(scenario.n, random),
    uniformForLevelsRandom,
    levelsLeafPortionId,
    prefixLength,
    prefixBucketCount,
  );

  return {
    n: scenario.n,
    fixedX: scenario.fixedX,
    xValues: scenario.xValues,
    trials: scenario.trials,
    prefixLength,
    prefixBucketCount,
    fixed: fixed.metrics,
    levels: levels.metrics,
    uniform: uniform.metrics,
    fixedLeafAdjacency: {
      algorithmRate: fixed.leafAdjacencyRate,
      uniformRate: uniformForFixed.leafAdjacencyRate,
    },
    levelsLeafAdjacency: {
      algorithmRate: levels.leafAdjacencyRate,
      uniformRate: uniformForLevels.leafAdjacencyRate,
    },
  };
}

export function formatRoundRobinQualityRow(
  result: RoundRobinQualityResult,
): Record<string, number | string> {
  return {
    n: result.n,
    fixedX: result.fixedX,
    xValues: result.xValues.join(', '),
    trials: result.trials,
    prefixLength: result.prefixLength,
    prefixBuckets: result.prefixBucketCount,
    fixedFirstValues: `${result.fixed.observedFirstValueSupport}/${result.n}`,
    levelsFirstValues: `${result.levels.observedFirstValueSupport}/${result.n}`,
    uniformFirstValues: `${result.uniform.observedFirstValueSupport}/${result.n}`,
    fixedEntropyBits: Number(result.fixed.firstValueEntropyBits.toFixed(2)),
    levelsEntropyBits: Number(result.levels.firstValueEntropyBits.toFixed(2)),
    uniformEntropyBits: Number(result.uniform.firstValueEntropyBits.toFixed(2)),
    fixedInversionDelta: Number(result.fixed.inversionDeviationFromHalf.toFixed(3)),
    levelsInversionDelta: Number(result.levels.inversionDeviationFromHalf.toFixed(3)),
    uniformInversionDelta: Number(result.uniform.inversionDeviationFromHalf.toFixed(3)),
    fixedPrefixCoverage: Number(result.fixed.prefixBucketCoverage.toFixed(2)),
    levelsPrefixCoverage: Number(result.levels.prefixBucketCoverage.toFixed(2)),
    uniformPrefixCoverage: Number(result.uniform.prefixBucketCoverage.toFixed(2)),
    fixedLeafAdjacency: Number(result.fixedLeafAdjacency.algorithmRate.toFixed(2)),
    uniformFixedAdjacency: Number(result.fixedLeafAdjacency.uniformRate.toFixed(2)),
    levelsLeafAdjacency: Number(result.levelsLeafAdjacency.algorithmRate.toFixed(2)),
    uniformLevelsAdjacency: Number(result.levelsLeafAdjacency.uniformRate.toFixed(2)),
  };
}

export function main(): void {
  const scenarios: RoundRobinQualityScenario[] = [
    { n: 25, fixedX: 4, xValues: [4, 3, 2], trials: 5000 },
    { n: 100, fixedX: 4, xValues: [4, 3, 2], trials: 5000 },
    { n: 250, fixedX: 8, xValues: [8, 4, 2], trials: 5000 },
  ];

  const results = scenarios.map((scenario, index) =>
    runRoundRobinQualitySimulation(scenario, createSeededRandom, 123456789 + index),
  );

  console.table(results.map(formatRoundRobinQualityRow));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}