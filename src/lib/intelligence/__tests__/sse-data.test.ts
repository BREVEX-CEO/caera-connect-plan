import { describe, expect, it } from "vitest";
import { sseData } from "../contract";

const body = (chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }),
  ).body!;
const read = async (chunks: string[], signal?: AbortSignal) => {
  const out: string[] = [];
  for await (const payload of sseData(body(chunks), "incomplete", signal)) out.push(payload);
  return out;
};

describe("one SSE reader for the browser client and the boundary", () => {
  const stream = 'data: {"a":1}\n\n: comment\n\ndata: {"b":2}\r\n\r\ndata: [DONE]\n\ndata:\n\n';

  it("reads the same payloads however the bytes are split", async () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const chunks: string[] = [];
      for (let at = 0, size = 0; at < stream.length; at += size) {
        size = ((seed * (chunks.length + 3)) % 7) + 1;
        chunks.push(stream.slice(at, at + size));
      }
      expect(chunks.join("")).toBe(stream);
      expect(await read(chunks)).toEqual(['{"a":1}', '{"b":2}']);
    }
  });

  it("refuses a stream cut off mid-event, and stops when aborted", async () => {
    await expect(read(['data: {"a":1}\n\ndata: {"b"'])).rejects.toThrow("incomplete");
    const stop = new AbortController();
    stop.abort(new Error("stopped"));
    await expect(read([stream], stop.signal)).rejects.toThrow("stopped");
  });
});
