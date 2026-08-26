/**
 * Single-argument-keyed memoisation.
 *
 * The donor imported `lodash-es/memoize.js` for this. OCADE does not depend on
 * lodash, and adding it for one nine-line function is a dependency that has to
 * be audited, licensed and shipped forever. The cache is a Map, so keys are
 * compared by value for primitives and by identity for objects — the same
 * contract the call sites were written against.
 */
export function memoize<A extends unknown[], R>(
  fn: (...args: A) => R,
  resolver?: (...args: A) => string,
): ((...args: A) => R) & { cache: Map<string, R> } {
  const cache = new Map<string, R>();
  const memoized = (...args: A): R => {
    const key = resolver ? resolver(...args) : String(args[0]);
    if (cache.has(key)) return cache.get(key) as R;
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
  memoized.cache = cache;
  return memoized;
}

export default memoize;
