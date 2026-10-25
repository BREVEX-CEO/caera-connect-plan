/** `node:path` for the browser: the vendored DeepSeek source only asks whether a path is absolute. */
export const isAbsolute = (path: string): boolean =>
  path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
