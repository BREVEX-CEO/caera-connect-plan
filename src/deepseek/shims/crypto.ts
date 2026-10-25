/** `node:crypto` for the browser: the vendored DeepSeek source only needs ids. */
export const randomUUID = (): string => globalThis.crypto.randomUUID();
