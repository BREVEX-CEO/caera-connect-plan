/**
 * `ffprobe-static` ships no types.
 *
 * Declared here rather than pulled from DefinitelyTyped: the package exports
 * one property, and a dependency added for a type that small is a dependency
 * to keep patched for no benefit.
 */
declare module "ffprobe-static" {
  const ffprobe: { path: string };
  export default ffprobe;
}
