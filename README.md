# non_repeating_random_v2

A small TypeScript repository for experiments with non-repeating number generators. The focus is not only on "delivers every number exactly once", but also on how well the different approaches shuffle the sequence.

## Contents

The repository contains several generator families for values `0..n-1` and `0..x-1` without repetition:

- `src/index.ts`: Building blocks. Includes a sequential source (`useNextSequentialNumber`), a generic cache (`useNumberCache`), and the combined cache variant `useNextNonRepeatingRandomNumber(x, y)`.
- `src/uniformRandomNumber.ts`: Uniform reference based on Fisher-Yates. This variant produces a truly uniform permutation, but requires `O(n)` memory.
- `src/roundRobinTreeRandomNumber.ts`: Recursive round-robin tree with a fixed `x` at every level.
- `src/roundRobinTreeRandomNumberByLevels.ts`: Generalised round-robin tree with individual `x` values per level.
- `src/roundRobinTreeRandomNumberByLevelsWithCache.ts`: Levels variant with an additional cache at each level to break up local clustering.

There are also several simulation and analysis programs:

- `src/cacheBiasSimulation.ts`: Compares the simple cache variant with the uniform reference.
- `src/roundRobinQualitySimulation.ts`: Compares the fixed round-robin, levels, cached-levels, and uniform variants.
- `src/roundRobinCacheSweepSimulation.ts`: Sweeps over different `cacheSize` values for the cached levels variant and recommends a compromise.

## Key Observations

- The simple cache approach is uniform for `x <= y`, but loses quality noticeably for a fixed `y` and growing `x`.
- The uniform reference is statistically sound but requires the most memory.
- The round-robin variants often show good global spread, but without additional measures they exhibit strong local leaf clustering.
- The cached levels variant reduces this local structure considerably and therefore represents a practical middle ground.

## Project Structure

- `src/`: Implementations and simulations
- `test/`: Vitest suite for all generators and simulations
- `Analysis.md`: In-depth technical evaluation of the approaches, metrics, and simulation results
- `Feedback.md`: Personal retrospective on the progress of the project

## Quick Start

Prerequisites:

- Node.js
- npm

Installation and standard checks:

```bash
npm install
npm test
```

## NPM Scripts

- `npm start`: Basic caching demo from `src/index.ts`
- `npm run start:uniform`: Uniform reference demo
- `npm run start:round-robin-tree`: Round-robin tree with fixed `x`
- `npm run start:round-robin-tree-levels`: Round-robin tree with `xValues`
- `npm run start:round-robin-tree-levels-cached`: Levels variant with cache at each level
- `npm run simulate:bias`: Bias comparison cache vs. uniform
- `npm run simulate:round-robin-quality`: Quality comparison of the round-robin family
- `npm run simulate:round-robin-cache-sweep`: Automatic search for a suitable `cacheSize`
- `npm test`: Complete test suite

## Tests

The tests verify in particular:

- Correctness of the generators and exhaustion without repetition
- Input validation and error cases
- Deterministic scenarios with a controlled random source
- Quality metrics and sweep logic of the simulations
- Large integrity cases for the round-robin generators

## Summary

This repository is not a generic utility package, but an exploratory working repository. It documents different ways to generate non-repeating number sequences and makes their qualitative differences visible through tests, demos, and simulations.