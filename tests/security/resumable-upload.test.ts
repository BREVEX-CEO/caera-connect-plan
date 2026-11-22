/**
 * Resumable Library uploads (14E.4): chunks of 6 MiB, progress from the offset the SERVER
 * accepted, a resumed upload continues from the server's own offset, a refused chunk is retried
 * then reported, and the resume record is removed once done.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHUNK, fingerprint, uploadResumable } from "../../src/lib/library/resumable-upload.ts";

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

function server(failFirstPatch = false) {
  let received = 0;
  let failed = !failFirstPatch;
  const calls: string[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${String(url).replace(/^https:\/\/x\.test/, "")}`);
    if (init.method === "POST")
      return new Response(null, {
        status: 201,
        headers: { location: "/storage/v1/upload/resumable/abc" },
      });
    if (init.method === "HEAD")
      return new Response(null, { status: 200, headers: { "upload-offset": String(received) } });
    if (!failed) {
      failed = true;
      return new Response("busy", { status: 503 });
    }
    assert.equal(Number((init.headers as Record<string, string>)["upload-offset"]), received);
    received += (init.body as Blob).size;
    return new Response(null, { status: 204, headers: { "upload-offset": String(received) } });
  };
  return { fetch, calls, received: () => received };
}

const file = new File([new Uint8Array(CHUNK * 2 + 10)], "video.mp4", { lastModified: 1 });

test("chunks, accepted-byte progress, retry, and the resume record removed when done", async () => {
  const s = server(true);
  globalThis.fetch = s.fetch as never;
  const store = memory();
  const seen: number[] = [];
  await uploadResumable({
    file,
    endpoint: "https://x.test/storage/v1/upload/resumable",
    apiKey: "k",
    accessToken: "t",
    objectName: "u/id1",
    id: "id1",
    storage: store,
    onProgress: (accepted) => seen.push(accepted),
  });
  assert.deepEqual(seen, [0, CHUNK, CHUNK * 2, CHUNK * 2 + 10]);
  assert.equal(s.received(), file.size);
  assert.equal(store.map.has(fingerprint(file)), false);
});

test("an interrupted upload resumes from the server's own offset", async () => {
  const s = server();
  globalThis.fetch = s.fetch as never;
  const store = memory();
  store.setItem(
    fingerprint(file),
    JSON.stringify({ url: "https://x.test/storage/v1/upload/resumable/abc", id: "id2" }),
  );
  // The server already holds one chunk.
  await s.fetch("https://x.test/x", {
    method: "PATCH",
    headers: { "upload-offset": "0" },
    body: file.slice(0, CHUNK),
  });
  s.calls.length = 0;
  await uploadResumable({
    file,
    endpoint: "https://x.test/storage/v1/upload/resumable",
    apiKey: "k",
    accessToken: "t",
    objectName: "u/id2",
    id: "id2",
    storage: store,
  });
  assert.equal(s.calls[0], "HEAD /storage/v1/upload/resumable/abc");
  assert.ok(!s.calls.some((call) => call.startsWith("POST")), "no new upload was created");
  assert.equal(s.calls.filter((call) => call.startsWith("PATCH")).length, 2);
});

test("a lost PATCH acknowledgment does not resend bytes already stored", async () => {
  const s = server();
  let firstPatch = true;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const response = await s.fetch(url, init);
    if (firstPatch && init.method === "PATCH") {
      firstPatch = false;
      throw new TypeError("connection interrupted after the bytes were stored");
    }
    return response;
  }) as never;
  const seen: number[] = [];
  await uploadResumable({
    file,
    endpoint: "https://x.test/storage/v1/upload/resumable",
    apiKey: "k",
    accessToken: "t",
    objectName: "u/id3",
    id: "id3",
    storage: memory(),
    onProgress: (accepted) => seen.push(accepted),
  });
  assert.deepEqual(seen, [0, CHUNK, CHUNK * 2, file.size]);
  assert.equal(s.received(), file.size);
  assert.equal(s.calls[2], "HEAD /storage/v1/upload/resumable/abc");
  assert.equal(s.calls.filter((call) => call.startsWith("PATCH")).length, 3);
});

test("invalid server progress cannot finish a partial upload", async () => {
  const s = server();
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const response = await s.fetch(url, init);
    return init.method === "PATCH"
      ? new Response(null, { status: 204, headers: { "upload-offset": String(file.size) } })
      : response;
  }) as never;
  const store = memory();
  await assert.rejects(
    uploadResumable({
      file,
      endpoint: "https://x.test/storage/v1/upload/resumable",
      apiKey: "k",
      accessToken: "t",
      objectName: "u/id4",
      id: "id4",
      storage: store,
    }),
    /invalid upload progress/,
  );
  assert.equal(s.received(), CHUNK);
  assert.ok(store.map.has(fingerprint(file)), "the partial upload is still resumable");
});

const endpoint = "https://x.test/storage/v1/upload/resumable";

test("upload creation and transfer credentials stay on the configured Storage route", async () => {
  const originals = { fetch: globalThis.fetch };
  const calls: { url: string; method?: string; redirect?: RequestRedirect }[] = [];
  const fixture = server();
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, redirect: init.redirect });
    return fixture.fetch(url, init);
  }) as never;
  const storage = memory();
  storage.setItem(
    fingerprint(file),
    JSON.stringify({ url: "https://other.example/storage/v1/upload/resumable/abc", id: "id5" }),
  );
  try {
    await uploadResumable({
      file,
      endpoint,
      apiKey: "fixture-key",
      accessToken: "fixture-token",
      objectName: "u/id5",
      id: "id5",
      storage,
    });
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["POST", "PATCH", "PATCH", "PATCH"],
    );
    assert.ok(calls.every(({ url, redirect }) => url.startsWith(endpoint) && redirect === "error"));
  } finally {
    globalThis.fetch = originals.fetch;
  }
});

test("an unexpected creation location is neither requested nor stored", async () => {
  const originalFetch = globalThis.fetch;
  for (const location of [
    "https://other.example/storage/v1/upload/resumable/abc",
    "https://x.test/auth/v1/user",
  ]) {
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return new Response(null, { status: 201, headers: { location } });
    }) as never;
    const storage = memory();
    try {
      await assert.rejects(
        uploadResumable({
          file,
          endpoint,
          apiKey: "fixture-key",
          accessToken: "fixture-token",
          objectName: "u/id6",
          id: "id6",
          storage,
        }),
        /unexpected upload location/,
      );
      assert.deepEqual(calls, [endpoint]);
      assert.equal(storage.getItem(fingerprint(file)), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});
