/**
 * How many tokens a piece of text is worth, for the usage measurement.
 *
 * DELIBERATELY AN ESTIMATE, AND DELIBERATELY THE BROWSER'S. On-device answers
 * never reach a server that could count them, so something here has to. It is
 * a byte count divided by a constant rather than a real tokenizer: loading a
 * tokenizer to price a request would cost more than the request.
 *
 * It cannot be gamed into a smaller charge. The server clamps whatever arrives
 * and Free is billed one use per successful request regardless — see
 * `usage-policy.ts`. This only feeds the measurement a weighted tier reads.
 */

/** The average bytes per token across the text this product actually sees. */
const BYTES_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.codePointAt(i)!;
    if (c > 0xffff) i += 1;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}
