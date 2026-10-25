/**
 * `node:fs` for the browser. The vendored sandbox reads the filesystem only when a sandboxed
 * local process is configured, which OCADE never does: its Device Agent is the only executor.
 */
const unavailable = (): never => {
  throw new Error("There is no filesystem in the browser.");
};
export const realpathSync = unavailable;
export const accessSync = unavailable;
export const statSync = unavailable;
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };
