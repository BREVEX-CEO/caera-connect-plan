/**
 * `?raw` imports carry the file's text, unchanged.
 *
 * The canonical OCADE system prompt lives in Markdown because a human has to
 * be able to read and amend it. It reaches the code as a string rather than as
 * a fetch so it cannot go missing at runtime, cannot be served stale by a
 * cache, and cannot differ between the browser bundle and the server bundle.
 */
declare module "*.md?raw" {
  const content: string;
  export default content;
}
