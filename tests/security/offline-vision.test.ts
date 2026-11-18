/**
 * Offline Chat pictures: an image reaches the on-device engine only when it can see, as an image
 * part before the words about it, and counted against the context; an engine that cannot see
 * refuses the question instead of answering as though it had looked. No cloud call is involved.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

type Wasm = typeof import("../../src/lib/brain/adapters/browser-wasm.ts");
type Transport = typeof import("../../src/lib/intelligence/offline-transport.ts");

let wasm: Wasm;
let transport: Transport;
let workDir: string;
const ROOT = path.resolve(import.meta.dirname, "../..");

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "ocade-vision-"));
  const outfile = path.join(workDir, "bundle.mjs");
  await build({
    stdin: {
      contents: [
        'export * as wasm from "@/lib/brain/adapters/browser-wasm";',
        'export * as transport from "@/lib/intelligence/offline-transport";',
      ].join("\n"),
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    tsconfig: path.join(ROOT, "tsconfig.json"),
    // The engine itself is never loaded here, nor the server runtime the
    // installer's lazily imported release lookup would reach.
    external: [
      "@wllama/wllama",
      "@wllama/wllama/*",
      "#tanstack-router-entry",
      "#tanstack-start-entry",
      "tanstack-start-manifest:v",
    ],
    loader: { ".json": "json" },
    logLevel: "silent",
  });
  const bundle = await import(pathToFileURL(outfile).href);
  wasm = bundle.wasm;
  transport = bundle.transport;
});

after(() => rmSync(workDir, { recursive: true, force: true }));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");

test("a picture becomes an image part before the words, and only on the person's turn", () => {
  const user = wasm.toEngineMessage({ role: "user", content: "What is this?", images: [PNG] });
  assert.ok(Array.isArray(user.content));
  const parts = user.content as { type: string; data?: ArrayBuffer; text?: string }[];
  assert.equal(parts[0]!.type, "image");
  assert.deepEqual([...new Uint8Array(parts[0]!.data!)], [0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  assert.deepEqual(parts[1], { type: "text", text: "What is this?" });
  assert.deepEqual(wasm.toEngineMessage({ role: "assistant", content: "x", images: [PNG] }), {
    role: "assistant",
    content: "x",
  });
});

test("each picture counts against the context, so a long transcript is trimmed for it", () => {
  const plain = wasm.messageTokens({ role: "user", content: "hello" });
  const withImage = wasm.messageTokens({ role: "user", content: "hello", images: [PNG] });
  assert.ok(withImage - plain >= 256);
  const transcript = [
    { role: "user" as const, content: "a".repeat(600) },
    { role: "assistant" as const, content: "b".repeat(600) },
    { role: "user" as const, content: "look", images: [PNG] },
  ];
  const fitted = wasm.fitTranscript(transcript, 300);
  assert.ok(fitted);
  assert.equal(fitted!.length, 1);
  assert.equal(fitted![0]!.images?.length, 1);
});

function fakeAdapter(vision: boolean) {
  const seen: { images?: string[]; content: string }[][] = [];
  return {
    seen,
    adapter: {
      async probe() {
        return {
          available: true as const,
          label: "Offline Mode",
          modelId: "ocr-test",
          capabilities: { text: true, vision, tools: false },
        };
      },
      async stream(
        messages: { images?: string[]; content: string }[],
        handlers: { onToken: (t: string) => void },
      ) {
        seen.push(messages);
        handlers.onToken("red and blue");
        return { ok: true as const, modelId: "ocr-test", firstTokenMs: 1 };
      },
    },
  };
}

async function collect(stream: AsyncIterable<{ type: string; reason?: string; text?: string }>) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

const request = {
  messages: [{ role: "user" as const, content: "What colours?" }],
  attachments: [{ name: "picture.png", image: PNG }],
} as never;

test("an engine that sees receives the picture on the last turn", async () => {
  const fake = fakeAdapter(true);
  const events = await collect(
    transport.createOfflineIntelligenceTransport(fake.adapter as never).stream(request),
  );
  assert.equal(events.at(-1)!.type, "final");
  assert.deepEqual(fake.seen[0]!.at(-1)!.images, [PNG]);
});

test("an engine that cannot see refuses, and the engine is never asked", async () => {
  const fake = fakeAdapter(false);
  const events = await collect(
    transport.createOfflineIntelligenceTransport(fake.adapter as never).stream(request),
  );
  const refusal = events.find((event) => event.type === "refusal");
  assert.ok(refusal);
  assert.match(refusal!.reason!, /cannot read images/);
  assert.equal(fake.seen.length, 0);
});
