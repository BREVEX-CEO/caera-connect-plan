/**
 * `Promise.withResolvers()` for a runtime whose type library predates it.
 *
 * Kept as a function rather than a global polyfill: OCADE runs inside the
 * user's page alongside whatever else that page loaded, and mutating
 * `Promise` from a library is how two libraries end up fighting over the
 * same global.
 */
export interface Resolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function withResolvers<T>(): Resolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
