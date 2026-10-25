/** `node:module` for the vendored DeepSeek source: it reads only its own package version this way. */
export function createRequire() {
  return () => ({ version: "0.2.1-rc.2" });
}
