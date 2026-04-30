# Analysis

## Opening Question

The statement

> The quality of the random numbers delivered by `useNextNonRepeatingRandomNumber(x, y)` decreases steadily as `y` stays fixed and `x` grows.

is essentially correct, but stated too coarsely.

A more precise formulation is:

- For `x <= y` the approach in [src/index.ts](src/index.ts) is even exactly uniform, because all values `0` through `x - 1` are immediately in the cache and are subsequently drawn at random without replacement.
- For fixed `y` and growing `x > y` the quality then falls off noticeably.
- The word "steadily" does not fit mathematically, because `x` only takes integer values and there is an initial plateau without any quality loss for `x <= y`.

## The Cache Approach in src/index.ts

The implementation in [src/index.ts](src/index.ts) works as follows:

1. On the first access the cache is filled with `min(x, y)` values.
2. As long as new values are still available, each draw outputs a random cache entry and immediately replaces it with the next unused value.
3. Once no new values are available, the cache is simply drained at random.

As long as `x > y`, draws are therefore not taken from all remaining numbers, but only from a sliding window of size `y`.

### Why This Causes Bias

Even the very first output reveals the problem:

- On the first access only values `0` through `min(x, y) - 1` are in the cache.
- For `x > y` the first number can therefore only be one of `y` values, even though `x` values would actually be possible.
- The proportion of possible first values is thus only

$$
\frac{y}{x}
$$

and this proportion tends to `0` as `y` stays fixed and `x` grows.

Later draws are also constrained. A number `n >= y` cannot appear arbitrarily early, because it can only enter the cache once sufficiently many earlier values have already been drawn. In 1-based position notation, `n` can appear no earlier than position

$$
\max(1, n - y + 2)
$$

As a result, many permutations are fundamentally unreachable.

### Number of Reachable Permutations

For `x > y` at most

$$
y^{x-y} \cdot y!
$$

distinct output orderings can be produced:

- In the first `x - y` steps there are at most `y` possible cache positions each.
- Afterwards `y` values remain in the cache and can still be output in any order.

A truly uniform permutation would have

$$
x!
$$

possible output sequences.

The ratio

$$
\frac{y^{x-y} \cdot y!}{x!}
$$

tends to `0` as `y` stays fixed and `x` grows. This is strong evidence that the global distribution quality deteriorates as `x / y` increases.

## The New Uniform Approach in uniformRandomNumber.ts

In [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) there is now a reference implementation that genuinely produces a uniform permutation.

The idea is simple:

1. An array of all numbers `0` through `x - 1` is built.
2. This array is shuffled with Fisher-Yates.
3. The values are then output one by one.

If the underlying random source is uniform, every one of the `x!` permutations is equally likely. This is precisely the property that the cache approach lacks for `x > y`.

### Advantages

- Statistically sound, uniform permutation.
- No restriction to a cache window.
- Every number can appear at every position.

### Costs

- Memory requirement `O(x)` instead of `O(y)`.
- The entire permutation is built and shuffled upfront.

Therefore [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) is the better choice when distribution quality matters more than a small memory budget.

## The Simulation in cacheBiasSimulation.ts

In [src/cacheBiasSimulation.ts](src/cacheBiasSimulation.ts) there is a small, reproducible simulation that directly compares the cache approach from [src/index.ts](src/index.ts) with the uniform variant from [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts).

The simulation uses:

- a seedable pseudo-random number generator for reproducible results,
- several scenarios with fixed `y = 4` and growing `x`,
- `5000` runs per scenario.

### What Is Measured

The simulation deliberately looks only at the first output value. This is not a complete characterisation of the full distribution, but it is already a very strong signal:

- If even the first position is noticeably biased, the overall permutation cannot be uniform.
- For the cache approach the theoretical upper bound on the number of possible first values is exactly `min(x, y)`.
- For the uniform variant, by contrast, all `x` values can appear in first position.

Additionally the entropy of the first position in bits is computed.

## Example Results from the Current Simulation

A run via `npm run simulate:bias` currently produces:

| x | y | trials | cacheFirstValues | uniformFirstValues | cacheCoverage | uniformCoverage | cacheEntropyBits | uniformEntropyBits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 4 | 5000 | 4/10 | 10/10 | 0.40 | 1.00 | 2.00 | 3.32 |
| 25 | 4 | 5000 | 4/25 | 25/25 | 0.16 | 1.00 | 2.00 | 4.64 |
| 100 | 4 | 5000 | 4/100 | 100/100 | 0.04 | 1.00 | 2.00 | 6.63 |

### Interpretation

- With the cache approach the number of possible first values stays constant at `4` for fixed `y = 4`, no matter how large `x` becomes.
- The first-position coverage therefore drops from `0.40` to `0.16` to `0.04`.
- The entropy of the first position stays at approximately

$$
\log_2(4) = 2
$$

bits for the cache approach, because there are effectively only four possible first values.
- The uniform variant, by contrast, reaches all `x` values in first position and achieves an entropy close to

$$
\log_2(x)
$$

i.e. `3.32`, `4.64`, and `6.63` bits for `x = 10`, `25`, and `100`.

The simulation thus confirms the qualitative analysis very clearly.

## Practical Conclusion

- If `x <= y`, the cache approach from [src/index.ts](src/index.ts) is already fully adequate and even uniform.
- If `x > y` and `y` remains fixed, the random quality degrades noticeably as `x` grows.
- If a truly uniform permutation is needed, [src/uniformRandomNumber.ts](src/uniformRandomNumber.ts) is the right approach.
- If only a small amount of memory may be used and a deliberately limited shuffling is acceptable, the cache approach can still be a reasonable choice.

## Round-Robin Variants Compared with the Uniform Reference

For the round-robin tree variants in [src/roundRobinTreeRandomNumber.ts](src/roundRobinTreeRandomNumber.ts), [src/roundRobinTreeRandomNumberByLevels.ts](src/roundRobinTreeRandomNumberByLevels.ts), and [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) there is a dedicated comparison simulation in [src/roundRobinQualitySimulation.ts](src/roundRobinQualitySimulation.ts).

The simulation examines four different signals:

- Entropy of the first position
- Deviation of the inversion rate from `0.5`
- Prefix coverage over buckets of the total range
- Leaf clustering, i.e. how often consecutive outputs come from the same leaf block

### Why Multiple Metrics Are Necessary

The round-robin variants cannot be meaningfully characterised with a single simple metric.

- The first position is nearly uniform.
- The global inversion rate is likewise almost identical to that of a uniform permutation.
- Yet there is very strong local structure, because complete leaf portions are output contiguously.
- At the same time the prefix coverage can even be better than for a uniform permutation, because a leaf can contain values from widely separated parts of the number space.
- The cached levels variant additionally shuffles exactly this local structure without replacing the tree itself.

### Example Results from `npm run simulate:round-robin-quality`

| n | fixedX | xValues | fixedEntropyBits | levelsEntropyBits | uniformEntropyBits | fixedInversionDelta | levelsInversionDelta | uniformInversionDelta | fixedPrefixCoverage | levelsPrefixCoverage | uniformPrefixCoverage | fixedLeafAdjacency | uniformFixedAdjacency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 4 | 4, 3, 2 | 4.61 | 4.45 | 4.64 | 0.000 | 0.000 | 0.000 | 0.83 | 0.81 | 0.73 | 0.75 | 0.11 |
| 100 | 4 | 4, 3, 2 | 6.61 | 6.46 | 6.63 | 0.000 | 0.000 | 0.001 | 0.80 | 0.87 | 0.67 | 0.76 | 0.03 |
| 250 | 8 | 8, 4, 2 | 7.93 | 7.93 | 7.93 | 0.000 | 0.000 | 0.000 | 1.00 | 1.00 | 0.94 | 0.88 | 0.03 |

### Interpretation of the New Metrics

- The first position is slightly less entropic for both round-robin variants than for the uniform reference, but the difference is small.
- The inversion rate is practically `0.5` for all three methods. This metric alone therefore barely detects the round-robin bias.
- The prefix coverage of the first `k` values is in the shown scenarios even better for the round-robin variants than for the uniform reference. This is because a leaf can contain values from widely separated parts of the number space.
- Leaf clustering separates the methods very clearly. At `n = 100` it is approximately `0.76` for both round-robin variants, but only about `0.03` for a uniform permutation.

### Cached Levels Variant

The new variant in [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) applies a `numberCache` at each level. This preserves the tree structure while strongly breaking up the direct chaining of complete leaf portions.

Example results from `npm run simulate:round-robin-quality`:

| n | xValues | cacheSize | levelsEntropyBits | cachedLevelsEntropyBits | uniformEntropyBits | levelsPrefixCoverage | cachedLevelsPrefixCoverage | uniformPrefixCoverage | levelsLeafAdjacency | cachedLevelsLeafAdjacency | uniformLevelsAdjacency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 4, 3, 2 | 8 | 4.45 | 4.64 | 4.64 | 0.81 | 0.74 | 0.73 | 0.75 | 0.19 | 0.11 |
| 100 | 4, 3, 2 | 8 | 6.46 | 6.62 | 6.63 | 0.87 | 0.72 | 0.67 | 0.76 | 0.18 | 0.03 |
| 250 | 8, 4, 2 | 16 | 7.93 | 7.93 | 7.93 | 1.00 | 0.98 | 0.94 | 0.88 | 0.20 | 0.03 |

Interpretation:

- Leaf clustering drops drastically. At `n = 100` it falls from `0.76` to `0.18`.
- The entropy of the first position rises to the level of the uniform reference, or very close to it.
- Prefix coverage stays high but decreases somewhat compared to the uncached levels variant. That is the expected price for the additional shuffling.
- The inversion rate remains close to `0.5`; even with a cache this is therefore not a discriminating metric.

### Sweep over Different Cache Sizes

To find a good compromise not just for a single value of `cacheSize` but systematically, there is now a dedicated sweep simulation in [src/roundRobinCacheSweepSimulation.ts](src/roundRobinCacheSweepSimulation.ts).

The idea is:

- For a fixed tree structure, several `cacheSize` values are tested.
- By default these values are now automatically generated as powers of two.
- For each value the same metrics as before are measured.
- In addition a compromise score is computed.

The automatic upper bound is a pragmatic heuristic:

$$
\min\left(n, 2^{\lceil \log_2(\max(x_0, \lceil \sqrt{n} \rceil)) \rceil}\right)
$$

Here `x_0` is the portion size of the lowest level. The reasoning:

- the sweep should be large enough to test beyond the leaf size,
- but not run unnecessarily far,
- and still produce only logarithmically many candidates.

For the examples currently shown this automatically gives:

- for `n = 100`, `xValues = [4, 3, 2]` the candidates `1, 2, 4, 8, 16`
- for `n = 250`, `xValues = [8, 4, 2]` the candidates `1, 2, 4, 8, 16`

The compromise score is based on exactly the two goals that compete with each other:

- retaining as much prefix-coverage advantage over uniform as possible
- reducing as much leaf clustering compared to the uncached levels variant as possible

Formally, the following are measured:

- `prefixRetention`: how much of the uncached levels variant's prefix-coverage advantage over uniform is preserved
- `leafReduction`: how much of the uncached levels variant's leaf-clustering excess over uniform is eliminated

Then:

$$
\text{compromiseScore} = \frac{\text{prefixRetention} + \text{leafReduction}}{2}
$$

A higher value therefore means a better compromise between early global spread and weak local clustering.

Current examples from `npm run simulate:round-robin-cache-sweep`:

| n | xValues | tested cacheSize values | recommended cacheSize |
| --- | --- | --- | --- |
| 100 | 4, 3, 2 | 1, 2, 4, 8, 16 | 4 |
| 250 | 8, 4, 2 | 1, 2, 4, 8, 16 | 16 |

Interpretation:

- Small caches retain more prefix coverage but reduce leaf clustering only slightly.
- Very large caches break up leaf clustering strongly but lose some of the prefix-coverage advantage.
- The best compromise therefore typically lies in a middle range rather than at the extremes.
- In the shown scenarios this compromise falls at `cacheSize = 4` for `n = 100` and at `cacheSize = 16` for `n = 250`.

This gives a clear picture:

- Globally the round-robin variants look relatively good at first glance.
- Locally they are strongly structured.
- Anyone who wants as little immediate neighbourhood structure as possible still needs the uniform variant.
- Anyone who values early spread across the number space and accepts the block structure gets an interesting middle model from the round-robin variants.
- The cached levels variant is a sensible compromise: considerably less local leaf clustering than the uncached levels variant, but still less memory usage than a fully uniform permutation.
- With the sweep this compromise can be fine-tuned for concrete values of `n`, `xValues`, and `trials`.

## Time and Space Complexity in O-Notation

In the following I use `N` to denote the total number of values to be output.

- For the cache approach from [src/index.ts](src/index.ts), `N = x`.
- For the round-robin variants, `N = n`.
- I assume that a call to the random source, an array access, and a simple swap each cost `O(1)`.

The most important distinction is:

- The cost per individual `next()` call can be punctually higher if a cache happens to be refilled or a new portion built at that moment.
- More informative here is therefore the amortised cost per output value and the total cost for the complete sequence.

### Overview

| Variant | amortised time per value | total runtime for all `N` values | additional memory |
| --- | --- | --- | --- |
| Sequential source `useNextSequentialNumber` | `O(1)` | `O(N)` | `O(1)` |
| Cache generator `useNextNonRepeatingRandomNumber(N, y)` | `O(1)` | `O(N)` | `O(min(N, y))` |
| Uniform variant `useNextUniformRandomNumber(N)` | `O(1)` after setup | `O(N)` | `O(N)` |
| Round-robin tree with fixed `x` | `O(1)` amortised | `O(N)` for constant `x >= 2` | $O(x \log_x N)$ |
| Round-robin tree with `xValues` | `O(1)` amortised in the typical case | $O\left(\sum_i m_i\right)$ | $O\left(\sum_i \min(m_i, b_i)\right)$ |
| Cached round-robin tree with `xValues` and `cacheSize = c` | `O(1)` amortised in the typical case | $O\left(\sum_i m_i\right)$ | $O\left(\sum_i (\min(m_i, b_i) + \min(m_i, c))\right)$ |

For the last two rows:

- $m_0 = N$
- $b_i = \text{xValues}[\min(i, \text{xValues.length} - 1)]$
- $m_{i+1} = \lceil m_i / b_i \rceil$

$m_i$ is the problem size at level $i$, and $b_i$ is the portion width used there.

### 1. Sequential Source in `src/index.ts`

`useNextSequentialNumber(x)` maintains only a single counter `nextNumber`.

Each call does exactly the following:

- bounds check
- return the current value
- increment the counter

Each of these steps has constant cost. Therefore:

- `O(1)` per value
- `O(N)` for all `N` values together
- `O(1)` memory

This is the trivial baseline.

### 2. Cache Approach in `src/index.ts`

With `useNextNonRepeatingRandomNumber(N, y)` sequential values are fed into a cache of size `y` and drawn from it at random.

Why does the total runtime stay linear?

- Each value is produced by the sequential source exactly once.
- Each value is placed in the cache exactly once.
- Each value is taken from the cache exactly once.
- Taking a value only involves constant array operations: determine index, read, optionally replace or swap with the last element and `pop()`.

Each of the `N` values is therefore touched only a constant number of times. Hence:

- Total runtime `O(N)`
- Amortised `O(1)` per value

The memory usage follows directly from the cache size:

- the cache never holds more than `y` values
- but there are only `N` values in total

So the peak memory is

$$
O(\min(N, y))
$$

and for the usual case `y <= N` simply `O(y)`.

A single early `next()` call can cost `O(min(N, y))` because the cache is initially filled, but averaged over the complete sequence it remains `O(1)` per value.

### 3. Uniform Variant in `src/uniformRandomNumber.ts`

Here an array of all `N` numbers is built first and then shuffled with Fisher-Yates.

The derivation is direct:

- building the array costs `O(N)`
- Fisher-Yates traverses the array once backwards and performs only one constant-cost swap per position, so also `O(N)`
- subsequent output is simply sequential reading from the shuffled array, so `O(1)` per value

Total:

- Total runtime `O(N)`
- Memory `O(N)`

The uniform variant is therefore asymptotically no worse in time than the cache approach, but it pays for the better distribution quality with linear memory.

### 4. Round-Robin Tree with Fixed `x`

In [src/roundRobinTreeRandomNumber.ts](src/roundRobinTreeRandomNumber.ts) the problem is reduced recursively.

At a level with problem size `m` the following happens:

- $\lceil m / x \rceil$ portions are defined.
- Across all portions together each of the `m` elements is written into exactly one portion.
- Each portion is shuffled locally.
- The portions are then output one by one.

The total work of a level is therefore `O(m)`, not `O(m · x)`, because the portions do not overlap and together contain exactly `m` elements.

For `x >= 2` this gives the recurrence

$$
T(m) = T(\lceil m / x \rceil) + O(m)
$$

and therefore

$$
T(N) = O\left(N + \frac{N}{x} + \frac{N}{x^2} + \dots\right) = O(N)
$$

because the series decays geometrically.

On memory:

- each level holds at most one current portion
- this portion has size at most `x`
- the number of active levels is $O(\log_x N)$

So for `x >= 2`:

$$
O(x \log_x N)
$$

For constant `x` this becomes `O(log N)` additional memory.

Special case `x = 1`:

- the implementation falls back to the sequential source
- runtime therefore `O(N)`
- memory `O(1)`

### 5. Round-Robin Tree with `xValues`

In [src/roundRobinTreeRandomNumberByLevels.ts](src/roundRobinTreeRandomNumberByLevels.ts) each level can have a different portion width.

If $b_i$ is the portion width at level $i$ and $m_i$ the corresponding problem size, then level $i$ again costs `O(m_i)` for exactly the same reason as above: every element of that level is placed into exactly one portion, shuffled locally, and later output exactly once.

The total runtime is therefore

$$
O\left(\sum_i m_i\right)
$$

This is the cleanest general form.

In the typical case where the tree really does shrink — i.e. $b_i \geq 2$ holds from some point onwards — $m_i$ falls geometrically and consequently:

$$
O(N)
$$

Why write the sum form here at all? Because `xValues` may also contain `1`. If several early levels have $b_i = 1$, the problem does not yet shrink there, and each such level costs another `O(N)`. The sum form makes exactly that visible.

The memory usage is the sum of the simultaneously held portions:

$$
O\left(\sum_i \min(m_i, b_i)\right)
$$

At level $i$ the current portion is never larger than the local portion width $b_i$, but also never larger than the remaining problem $m_i$.

In the common case of fixed, small `xValues` with genuine shrinkage at every level, this amounts in practice to logarithmic memory usage in `N`.

### 6. Cached Round-Robin Tree

In [src/roundRobinTreeRandomNumberByLevelsWithCache.ts](src/roundRobinTreeRandomNumberByLevelsWithCache.ts) an additional `numberCache` of size `c` is added at each level.

In terms of time this changes asymptotic behaviour less than one might initially expect:

- The underlying level source still produces exactly $m_i$ values.
- Each of these values is additionally placed into the cache at level $i$ exactly once and taken out exactly once.
- These cache operations each cost `O(1)`.

The time per level therefore remains $O(m_i)$, just with a larger constant. Overall again:

$$
O\left(\sum_i m_i\right)
$$

and in the usual shrinking case again `O(N)`.

For memory, the cache per level adds to the current portion. Therefore:

$$
O\left(\sum_i (\min(m_i, b_i) + \min(m_i, c))\right)
$$

In the typical case of constant small `xValues` and constant `cacheSize` this still means only logarithmic memory in `N`, but with a larger constant factor than without a cache.

### Practical Assessment

The asymptotic differences are smaller than the qualitative differences in the distributions:

- in terms of time almost all generators are at `O(N)` for a complete sequence
- the essential difference lies above all in memory
- the uniform variant requires `O(N)` memory
- the simple cache approach requires only `O(y)`
- the round-robin variants lie in between, depending on tree depth, portion widths, and additional cache

For the choice of method this means in practice:

- If memory is tight, cache and round-robin methods are attractive.
- If a truly uniform permutation is required, the linear memory of the Fisher-Yates variant is the price for clean statistics.
- If you want to preserve tree structure but reduce local clustering, the cached levels variant is still asymptotically linear in time and usually well below `O(N)` in memory.

## Running the Code

- Demonstrate cache approach: `npm start`
- Demonstrate uniform variant: `npm run start:uniform`
- Run bias simulation: `npm run simulate:bias`
- Compare round-robin quality: `npm run simulate:round-robin-quality`
- Run cache-size sweep for round-robin: `npm run simulate:round-robin-cache-sweep`

