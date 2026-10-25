/** `node:util/types` for the browser: the one check the vendored DeepSeek source uses. */
export const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise;
