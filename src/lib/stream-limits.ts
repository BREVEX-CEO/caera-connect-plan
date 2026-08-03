/**
 * Bounds for streamed responses.
 *
 * Two streaming readers accumulated without any cap: the cloud chat reader in
 * the OCADE route (`acc += decode(value)`) and the local-engine reader in
 * `ocade-local` (`buffer += decode(value)`). Both stopped only when the server
 * chose to stop.
 *
 * Cancellation was handled at both — an abort signal reaches the fetch — but
 * cancellation is a USER action. Nothing bounded a server that simply keeps
 * sending: memory grows until the tab dies, and in the route each chunk also
 * triggers a re-render, so the page becomes unusable well before that.
 *
 * This is not only a remote-attacker concern. The local bridge URL is
 * user-configurable, so it can point at something other than a local model
 * server, and a wrong address that happens to stream is enough.
 *
 * Every other boundary in this codebase is bounded — the document decoders cap
 * expanded XML, the relay caps request bodies, research caps redirects. These
 * two were the exception.
 */

/** Total decoded characters a single streamed reply may accumulate. */
export const MAX_STREAM_CHARS = 2_000_000;

/**
 * Characters a single un-terminated line may reach in a line-delimited stream.
 *
 * NDJSON readers hold bytes until a newline arrives. A stream that never sends
 * one grows the buffer indefinitely, so the line itself needs a ceiling
 * independent of the total.
 */
export const MAX_STREAM_LINE_CHARS = 1_000_000;

export class StreamLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamLimitError";
  }
}

/**
 * Throws when a stream exceeds its budget.
 *
 * Fails loudly rather than silently truncating: a reply quietly cut in half
 * looks like a complete answer, which is worse than a visible failure.
 */
export function assertStreamWithinLimit(
  chars: number,
  limit: number = MAX_STREAM_CHARS,
  what = "reply",
): void {
  if (chars > limit) {
    throw new StreamLimitError(
      `The streamed ${what} exceeded ${limit.toLocaleString()} characters and was stopped. ` +
        `OCADE will not keep buffering a response that does not end.`,
    );
  }
}
