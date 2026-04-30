import { pathToFileURL } from 'node:url';

import { createSeededRandom } from './cacheBiasSimulation.js';
import {
  RoundRobinQualityResult,
  RoundRobinQualityScenario,
  runRoundRobinQualitySimulation,
} from './roundRobinQualitySimulation.js';

export interface RoundRobinCacheSweepScenario {
  n: number;
  fixedX: number;
  xValues: readonly number[];
  cacheSizes?: readonly number[];
  maxCacheSize?: number;
  trials: number;
}

export interface RoundRobinCacheSweepBaseline {
  uncachedLevelsEntropyBits: number;
  uniformEntropyBits: number;
  uncachedLevelsPrefixCoverage: number;
  uniformPrefixCoverage: number;
  uncachedLevelsLeafAdjacency: number;
  uniformLeafAdjacency: number;
}

export interface RoundRobinCacheSweepRow {
  cacheSize: number;
  cachedLevelsEntropyBits: number;
  entropyRecoveryRatio: number;
  cachedLevelsPrefixCoverage: number;
  prefixRetentionRatio: number;
  cachedLevelsLeafAdjacency: number;
  leafReductionRatio: number;
  compromiseScore: number;
}

export interface RoundRobinCacheSweepResult {
  n: number;
  fixedX: number;
  xValues: readonly number[];
  maxCacheSize: number;
  cacheSizes: readonly number[];
  trials: number;
  baseline: RoundRobinCacheSweepBaseline;
  rows: RoundRobinCacheSweepRow[];
  best: RoundRobinCacheSweepRow;
}

function assertPositiveInteger(value: number, parameterName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${parameterName} must be a positive integer`);
  }
}

function assertScenario(scenario: RoundRobinCacheSweepScenario): void {
  assertPositiveInteger(scenario.n, 'n');
  assertPositiveInteger(scenario.fixedX, 'fixedX');
  assertPositiveInteger(scenario.trials, 'trials');

  if (scenario.xValues.length === 0) {
    throw new Error('xValues must contain at least one positive integer');
  }

  scenario.xValues.forEach((value, index) => {
    assertPositiveInteger(value, `xValues[${index}]`);
  });

  if (scenario.maxCacheSize !== undefined) {
    assertPositiveInteger(scenario.maxCacheSize, 'maxCacheSize');
  }

  if (scenario.cacheSizes !== undefined) {
    if (scenario.cacheSizes.length === 0) {
      throw new Error('cacheSizes must contain at least one positive integer');
    }

    scenario.cacheSizes.forEach((value, index) => {
      assertPositiveInteger(value, `cacheSizes[${index}]`);
    });
  }
}

function getNextPowerOfTwo(value: number): number {
  let powerOfTwo = 1;

  while (powerOfTwo < value) {
    powerOfTwo *= 2;
  }

  return powerOfTwo;
}

export function getDefaultRoundRobinCacheSweepUpperBound(
  n: number,
  xValues: readonly number[],
): number {
  assertPositiveInteger(n, 'n');

  if (xValues.length === 0) {
    throw new Error('xValues must contain at least one positive integer');
  }

  xValues.forEach((value, index) => {
    assertPositiveInteger(value, `xValues[${index}]`);
  });

  const leafWidth = xValues[0];
  const heuristicUpperBound = Math.max(leafWidth, Math.ceil(Math.sqrt(n)));
  return Math.min(n, getNextPowerOfTwo(heuristicUpperBound));
}

export function createPowerOfTwoCacheSizes(maxCacheSize: number): number[] {
  assertPositiveInteger(maxCacheSize, 'maxCacheSize');

  const cacheSizes: number[] = [];

  for (let cacheSize = 1; cacheSize <= maxCacheSize; cacheSize *= 2) {
    cacheSizes.push(cacheSize);
  }

  return cacheSizes;
}

function resolveCacheSizes(scenario: RoundRobinCacheSweepScenario): {
  cacheSizes: number[];
  maxCacheSize: number;
} {
  if (scenario.cacheSizes !== undefined) {
    const cacheSizes = [...new Set(scenario.cacheSizes)].sort((left, right) => left - right);
    return {
      cacheSizes,
      maxCacheSize: cacheSizes[cacheSizes.length - 1],
    };
  }

  const maxCacheSize = scenario.maxCacheSize ?? getDefaultRoundRobinCacheSweepUpperBound(scenario.n, scenario.xValues);

  return {
    cacheSizes: createPowerOfTwoCacheSizes(maxCacheSize),
    maxCacheSize,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createQualityScenario(
  scenario: RoundRobinCacheSweepScenario,
  cacheSize: number,
): RoundRobinQualityScenario {
  return {
    n: scenario.n,
    fixedX: scenario.fixedX,
    xValues: scenario.xValues,
    cacheSize,
    trials: scenario.trials,
  };
}

function createBaseline(result: RoundRobinQualityResult): RoundRobinCacheSweepBaseline {
  return {
    uncachedLevelsEntropyBits: result.levels.firstValueEntropyBits,
    uniformEntropyBits: result.uniform.firstValueEntropyBits,
    uncachedLevelsPrefixCoverage: result.levels.prefixBucketCoverage,
    uniformPrefixCoverage: result.uniform.prefixBucketCoverage,
    uncachedLevelsLeafAdjacency: result.levelsLeafAdjacency.algorithmRate,
    uniformLeafAdjacency:
      (result.levelsLeafAdjacency.uniformRate + result.cachedLevelsLeafAdjacency.uniformRate) / 2,
  };
}

function getEntropyRecoveryRatio(
  baseline: RoundRobinCacheSweepBaseline,
  cachedEntropyBits: number,
): number {
  const initialGap = baseline.uniformEntropyBits - baseline.uncachedLevelsEntropyBits;

  if (initialGap <= 0) {
    return 1;
  }

  const remainingGap = baseline.uniformEntropyBits - cachedEntropyBits;
  return clamp01((initialGap - remainingGap) / initialGap);
}

function getPrefixRetentionRatio(
  baseline: RoundRobinCacheSweepBaseline,
  cachedPrefixCoverage: number,
): number {
  const initialAdvantage = baseline.uncachedLevelsPrefixCoverage - baseline.uniformPrefixCoverage;

  if (initialAdvantage <= 0) {
    return 1;
  }

  const cachedAdvantage = cachedPrefixCoverage - baseline.uniformPrefixCoverage;
  return clamp01(cachedAdvantage / initialAdvantage);
}

function getLeafReductionRatio(
  baseline: RoundRobinCacheSweepBaseline,
  cachedLeafAdjacency: number,
): number {
  const initialExcess = baseline.uncachedLevelsLeafAdjacency - baseline.uniformLeafAdjacency;

  if (initialExcess <= 0) {
    return 1;
  }

  const cachedExcess = cachedLeafAdjacency - baseline.uniformLeafAdjacency;
  return clamp01((initialExcess - cachedExcess) / initialExcess);
}

function createSweepRow(
  baseline: RoundRobinCacheSweepBaseline,
  result: RoundRobinQualityResult,
): RoundRobinCacheSweepRow {
  const entropyRecoveryRatio = getEntropyRecoveryRatio(
    baseline,
    result.cachedLevels.firstValueEntropyBits,
  );
  const prefixRetentionRatio = getPrefixRetentionRatio(
    baseline,
    result.cachedLevels.prefixBucketCoverage,
  );
  const leafReductionRatio = getLeafReductionRatio(
    baseline,
    result.cachedLevelsLeafAdjacency.algorithmRate,
  );

  return {
    cacheSize: result.cacheSize,
    cachedLevelsEntropyBits: result.cachedLevels.firstValueEntropyBits,
    entropyRecoveryRatio,
    cachedLevelsPrefixCoverage: result.cachedLevels.prefixBucketCoverage,
    prefixRetentionRatio,
    cachedLevelsLeafAdjacency: result.cachedLevelsLeafAdjacency.algorithmRate,
    leafReductionRatio,
    compromiseScore: (prefixRetentionRatio + leafReductionRatio) / 2,
  };
}

export function pickBestRoundRobinCacheSweepRow(
  rows: readonly RoundRobinCacheSweepRow[],
): RoundRobinCacheSweepRow {
  if (rows.length === 0) {
    throw new Error('rows must contain at least one entry');
  }

  return [...rows].sort((left, right) => {
    if (right.compromiseScore !== left.compromiseScore) {
      return right.compromiseScore - left.compromiseScore;
    }

    return left.cacheSize - right.cacheSize;
  })[0];
}

export function runRoundRobinCacheSweep(
  scenario: RoundRobinCacheSweepScenario,
  randomFactory: (seed: number) => () => number = createSeededRandom,
  seed: number = 123456789,
): RoundRobinCacheSweepResult {
  assertScenario(scenario);

  const { cacheSizes, maxCacheSize } = resolveCacheSizes(scenario);

  const firstResult = runRoundRobinQualitySimulation(
    createQualityScenario(scenario, cacheSizes[0]),
    randomFactory,
    seed,
  );
  const baseline = createBaseline(firstResult);
  const rows = [createSweepRow(baseline, firstResult)];

  for (let index = 1; index < cacheSizes.length; index += 1) {
    const cacheSize = cacheSizes[index];
    const result = runRoundRobinQualitySimulation(
      createQualityScenario(scenario, cacheSize),
      randomFactory,
      seed,
    );
    rows.push(createSweepRow(baseline, result));
  }

  return {
    n: scenario.n,
    fixedX: scenario.fixedX,
    xValues: scenario.xValues,
    maxCacheSize,
    cacheSizes,
    trials: scenario.trials,
    baseline,
    rows,
    best: pickBestRoundRobinCacheSweepRow(rows),
  };
}

export function formatRoundRobinCacheSweepRow(
  row: RoundRobinCacheSweepRow,
  bestCacheSize: number,
): Record<string, number | string> {
  return {
    cacheSize: row.cacheSize,
    entropyBits: Number(row.cachedLevelsEntropyBits.toFixed(2)),
    entropyRecovery: Number(row.entropyRecoveryRatio.toFixed(2)),
    prefixCoverage: Number(row.cachedLevelsPrefixCoverage.toFixed(2)),
    prefixRetention: Number(row.prefixRetentionRatio.toFixed(2)),
    leafAdjacency: Number(row.cachedLevelsLeafAdjacency.toFixed(2)),
    leafReduction: Number(row.leafReductionRatio.toFixed(2)),
    compromiseScore: Number(row.compromiseScore.toFixed(2)),
    recommended: row.cacheSize === bestCacheSize ? 'yes' : '',
  };
}

function formatBaseline(result: RoundRobinCacheSweepResult): Record<string, number | string> {
  return {
    n: result.n,
    fixedX: result.fixedX,
    xValues: result.xValues.join(', '),
    maxCacheSize: result.maxCacheSize,
    cacheSizes: result.cacheSizes.join(', '),
    trials: result.trials,
    uncachedLevelsEntropy: Number(result.baseline.uncachedLevelsEntropyBits.toFixed(2)),
    uniformEntropy: Number(result.baseline.uniformEntropyBits.toFixed(2)),
    uncachedLevelsPrefix: Number(result.baseline.uncachedLevelsPrefixCoverage.toFixed(2)),
    uniformPrefix: Number(result.baseline.uniformPrefixCoverage.toFixed(2)),
    uncachedLevelsLeafAdjacency: Number(result.baseline.uncachedLevelsLeafAdjacency.toFixed(2)),
    uniformLeafAdjacency: Number(result.baseline.uniformLeafAdjacency.toFixed(2)),
  };
}

export function main(): void {
  const scenarios: RoundRobinCacheSweepScenario[] = [
    {
      n: 100,
      fixedX: 4,
      xValues: [4, 3, 2],
      trials: 5000,
    },
    {
      n: 250,
      fixedX: 8,
      xValues: [8, 4, 2],
      trials: 5000,
    },
  ];

  scenarios.forEach((scenario, index) => {
    const result = runRoundRobinCacheSweep(scenario, createSeededRandom, 123456789 + index);

    console.log('Scenario');
    console.table([formatBaseline(result)]);
    console.table(result.rows.map((row) => formatRoundRobinCacheSweepRow(row, result.best.cacheSize)));
    console.log(
      `Best cacheSize: ${result.best.cacheSize} (compromiseScore=${result.best.compromiseScore.toFixed(2)})`,
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}