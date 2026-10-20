/** Read at most maxBytes from the wire; a missing or false Content-Length cannot bypass it. */
export async function readBoundedRequestText(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  const abortRead = () => {
    void reader?.cancel(request.signal.reason).catch(() => undefined);
  };
  request.signal.addEventListener("abort", abortRead, { once: true });
  try {
    request.signal.throwIfAborted();
    while (reader) {
      const chunk = await reader.read();
      request.signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    request.signal.removeEventListener("abort", abortRead);
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}
