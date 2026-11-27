/** RELIABILITY-02: a request body is read only up to its limit, whatever its Content-Length says. */
import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedRequestText } from "../../src/lib/read-bounded-request.ts";

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("https://example.test/x", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);

test("a body inside the limit is read whole", async () => {
  assert.equal(await readBoundedRequestText(post("hello"), 10), "hello");
});

test("a declared length over the limit is refused before any byte is read", async () => {
  const request = post("hi", { "content-length": "9999" });
  assert.equal(await readBoundedRequestText(request, 10), null);
});

test("a false or missing Content-Length cannot bypass the limit", async () => {
  assert.equal(
    await readBoundedRequestText(post("x".repeat(50), { "content-length": "1" }), 10),
    null,
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 5; i += 1) controller.enqueue(new TextEncoder().encode("xxxxxxxxxx"));
      controller.close();
    },
  });
  assert.equal(await readBoundedRequestText(post(stream), 20), null);
});

test("the limit is on bytes, not characters", async () => {
  assert.equal(await readBoundedRequestText(post("é".repeat(10)), 10), null);
  assert.equal(await readBoundedRequestText(post("é".repeat(5)), 10), "é".repeat(5));
});
