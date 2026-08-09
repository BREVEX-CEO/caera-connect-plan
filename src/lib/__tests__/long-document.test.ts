import { describe, expect, it } from "vitest";
import {
  InMemoryLongDocumentStore,
  runLongDocument,
  type LongDocumentGenerate,
  type LongDocumentProgress,
} from "../local/long-document";

const document = Array.from(
  { length: 80 },
  (_, index) => `Line ${index + 1}: inventory ${1000 + index}. ${"context ".repeat(12)}`,
).join("\n");

function generator(calls: string[]): LongDocumentGenerate {
  return async ({ stage, prompt, onToken, signal }) => {
    calls.push(`${stage}:${prompt.length}`);
    if (signal?.aborted) return { ok: false, reason: "cancelled" };
    const text = stage === "map" ? "Relevant fact with line range." : "Final grounded answer.";
    for (const token of text.split(" ")) onToken(`${token} `);
    return { ok: true };
  };
}

describe("bounded local long-document execution", () => {
  it("maps semantic chunks, persists partials, reduces and emits progress before inference", async () => {
    const calls: string[] = [];
    const progress: LongDocumentProgress[] = [];
    const result = await runLongDocument({
      jobId: "job-1",
      documentName: "inventory.txt",
      text: document,
      query: "What inventory facts matter?",
      mapModelId: "qwen3:1.7b",
      reduceModelId: "qwen3:8b",
      generate: generator(calls),
      store: new InMemoryLongDocumentStore(),
      chunkChars: 1_200,
      onProgress: (event) => progress.push(event),
    });
    expect(result).toMatchObject({ ok: true, answer: "Final grounded answer." });
    expect(calls.filter((call) => call.startsWith("map:")).length).toBeGreaterThan(1);
    expect(calls.at(-1)).toMatch(/^reduce:/);
    expect(progress[0].kind).toBe("planned");
    expect(progress.at(-1)?.kind).toBe("completed");
  });

  it("resumes fingerprint-matched partials and never repeats completed map mutations", async () => {
    const store = new InMemoryLongDocumentStore();
    const calls: string[] = [];
    let maps = 0;
    const stop = new AbortController();
    const interrupted: LongDocumentGenerate = async (request) => {
      if (request.stage === "map" && ++maps === 2) {
        stop.abort();
        return { ok: false, reason: "cancelled" };
      }
      request.onToken("partial one");
      return { ok: true };
    };
    const first = await runLongDocument({
      jobId: "resume-job",
      documentName: "inventory.txt",
      text: document,
      query: "Find the inventory.",
      mapModelId: "fast",
      reduceModelId: "primary",
      generate: interrupted,
      store,
      signal: stop.signal,
      chunkChars: 1_200,
    });
    expect(first).toMatchObject({ ok: false, cancelled: true, completedChunks: 1 });
    const resumed = await runLongDocument({
      jobId: "resume-job",
      documentName: "inventory.txt",
      text: document,
      query: "Find the inventory.",
      mapModelId: "fast",
      reduceModelId: "primary",
      generate: generator(calls),
      store,
      chunkChars: 1_200,
    });
    expect(resumed).toMatchObject({ ok: true, resumedChunks: 1 });
  });

  it("invalidates stale checkpoints when query or document fingerprint changes", async () => {
    const store = new InMemoryLongDocumentStore();
    const calls: string[] = [];
    await store.save({
      schemaVersion: 1,
      jobId: "stale",
      fingerprint: "0".repeat(64),
      documentName: "old.txt",
      query: "old",
      mapModelId: "fast",
      reduceModelId: "primary",
      chunks: [],
      partials: { "0": "stale secret" },
      updatedAt: "2026-08-09T00:00:00.000Z",
    });
    const result = await runLongDocument({
      jobId: "stale",
      documentName: "new.txt",
      text: document,
      query: "new question",
      mapModelId: "fast",
      reduceModelId: "primary",
      generate: generator(calls),
      store,
      chunkChars: 1_200,
    });
    expect(result).toMatchObject({ ok: true, resumedChunks: 0 });
    expect(calls.join(" ")).not.toContain("stale secret");
  });

  it("refuses an over-budget document before calling the model", async () => {
    const calls: string[] = [];
    const result = await runLongDocument({
      jobId: "budget",
      documentName: "large.txt",
      text: document,
      query: "question",
      mapModelId: "fast",
      reduceModelId: "primary",
      generate: generator(calls),
      store: new InMemoryLongDocumentStore(),
      maxInputTokens: 10,
    });
    expect(result).toMatchObject({ ok: false, cancelled: false });
    expect(calls).toEqual([]);
  });
});
