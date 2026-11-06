/** Read at most maxBytes from the wire; a missing or false Content-Length cannot bypass it. */
export async function readBoundedRequestText(
  request: Request | Response,
  maxBytes: number,
): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

  const signal = "signal" in request ? request.signal : undefined;
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  const abortRead = () => {
    void reader?.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener("abort", abortRead, { once: true });
  try {
    signal?.throwIfAborted();
    while (reader) {
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    signal?.removeEventListener("abort", abortRead);
    const cancelled = reader?.cancel().catch(() => undefined);
    // A cloned response tees the stream. Its cancellation waits for the original reader.
    if (signal) await cancelled;
    reader?.releaseLock();
  }
}
