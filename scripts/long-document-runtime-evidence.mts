/** Real Ollama map/reduce, streaming, cancellation, and restart evidence. */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  runLongDocument,
  type LongDocumentCheckpoint,
  type LongDocumentGenerate,
  type LongDocumentProgress,
  type LongDocumentStore,
} from "../src/lib/local/long-document";
import { DEFAULT_LOCAL_BRIDGE_URL, streamLocalChat } from "../src/lib/ocade-local";

const root = resolve(import.meta.dirname, "..");
const outputPath = join(root, "release", "OCADE_LONG_DOCUMENT_RUNTIME_EVIDENCE.json");
const checkpointPath = join(root, "release", "artefacts", "long-document-checkpoint.json");
const write = process.argv.includes("--write");
const bridge = process.env.OCADE_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;
const plantedFact = "AURORA-7319";

class FileCheckpointStore implements LongDocumentStore {
  constructor(private readonly path: string) {}

  async load(jobId: string): Promise<LongDocumentCheckpoint | null> {
    try {
      const value = JSON.parse(await readFile(this.path, "utf8")) as LongDocumentCheckpoint;
      return value.jobId === jobId ? value : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async save(checkpoint: LongDocumentCheckpoint): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
    await rename(temporary, this.path);
  }

  async remove(jobId: string): Promise<void> {
    const current = await this.load(jobId);
    if (!current) return;
    try {
      await unlink(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function documentText(): string {
  const sections = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const ordinary =
      `Section ${number} records the quarterly equipment review. ` +
      "Each reviewer checked the inventory, compared serial labels, documented maintenance dates, " +
      "and recorded follow-up owners. No section may be omitted when answering an audit question. ";
    const fact =
      number === 8
        ? `The final approved recovery identifier is ${plantedFact}. It supersedes every draft identifier and must be returned exactly. `
        : `The draft marker for section ${number} is deliberately non-authoritative and must not be used as the final recovery identifier. `;
    return `${ordinary}${fact}${ordinary}`;
  });
  return sections.join("\n\n");
}

interface StreamSample {
  stage: "map" | "reduce";
  modelId: string;
  requestStartedMs: number;
  firstTransportMs: number | null;
  transportArrivalsMs: number[];
  tokenArrivalsMs: number[];
  outputChars: number;
  result: { ok: boolean; reason?: string };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const store = new FileCheckpointStore(checkpointPath);
  await store.remove("real-long-document");
  const samples: StreamSample[] = [];
  const makeGenerate = (): LongDocumentGenerate => async (request) => {
    const requestStartedMs = performance.now();
    const transportArrivalsMs: number[] = [];
    const tokenArrivalsMs: number[] = [];
    let outputChars = 0;
    const result = await streamLocalChat(
      bridge,
      request.modelId,
      [
        {
          role: "system",
          content:
            "Follow the extraction instruction exactly. Be concise. Never invent identifiers or omit an exact identifier present in evidence.",
        },
        { role: "user", content: request.prompt },
      ],
      {
        signal: request.signal,
        think: false,
        totalRamBytes: 16 * 1024 ** 3,
        onTransportChunk: ({ receivedAtMs }) => transportArrivalsMs.push(receivedAtMs),
        onToken: (token) => {
          tokenArrivalsMs.push(performance.now());
          outputChars += token.length;
          request.onToken(token);
        },
      },
    );
    samples.push({
      stage: request.stage,
      modelId: request.modelId,
      requestStartedMs,
      firstTransportMs:
        transportArrivalsMs.length > 0 ? transportArrivalsMs[0] - requestStartedMs : null,
      transportArrivalsMs: transportArrivalsMs.map((time) => time - requestStartedMs),
      tokenArrivalsMs: tokenArrivalsMs.map((time) => time - requestStartedMs),
      outputChars,
      result,
    });
    return result;
  };

  const firstProgress: LongDocumentProgress[] = [];
  const abort = new AbortController();
  const interrupted = await runLongDocument({
    jobId: "real-long-document",
    documentName: "quarterly-equipment-review.txt",
    text: documentText(),
    query: "What is the final approved recovery identifier? Return it exactly.",
    mapModelId: "qwen3:1.7b",
    reduceModelId: "qwen3:8b",
    generate: makeGenerate(),
    store,
    signal: abort.signal,
    concurrency: 1,
    chunkChars: 2_400,
    reduceChunkChars: 8_000,
    maxInputTokens: 8_000,
    onProgress: (progress) => {
      firstProgress.push(progress);
      if (progress.kind === "map_completed" && progress.completed === 1) abort.abort();
    },
  });
  const persisted = await store.load("real-long-document");

  const resumedProgress: LongDocumentProgress[] = [];
  const completed = await runLongDocument({
    jobId: "real-long-document",
    documentName: "quarterly-equipment-review.txt",
    text: documentText(),
    query: "What is the final approved recovery identifier? Return it exactly.",
    mapModelId: "qwen3:1.7b",
    reduceModelId: "qwen3:8b",
    generate: makeGenerate(),
    store,
    concurrency: 1,
    chunkChars: 2_400,
    reduceChunkChars: 8_000,
    maxInputTokens: 8_000,
    onProgress: (progress) => resumedProgress.push(progress),
  });

  const transportChunks = samples.reduce(
    (total, sample) => total + sample.transportArrivalsMs.length,
    0,
  );
  const tokenCallbacks = samples.reduce(
    (total, sample) => total + sample.tokenArrivalsMs.length,
    0,
  );
  const progressiveSamples = samples.filter((sample) => {
    const arrivals = sample.transportArrivalsMs;
    return arrivals.length > 2 && arrivals[arrivals.length - 1] - arrivals[0] >= 100;
  });
  const checkpointCleared = (await store.load("real-long-document")) === null;
  const checks = {
    immediateVisibleProgress: (firstProgress[0]?.elapsedMs ?? Infinity) <= 100,
    interruptionHonored:
      !interrupted.ok && interrupted.cancelled && interrupted.completedChunks === 1,
    checkpointPersisted: Object.keys(persisted?.partials ?? {}).length === 1,
    restartResumed: completed.ok && completed.resumedChunks === 1,
    mapReduceCompleted: completed.ok && completed.chunks >= 2,
    plantedFactRecovered: completed.ok && completed.answer.includes(plantedFact),
    rawTransportProgressive: progressiveSamples.length > 0,
    tokenDeliveryProgressive: tokenCallbacks > 2,
    checkpointCleared,
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    schemaVersion: 1,
    kind: "OCADE_LONG_DOCUMENT_REAL_RUNTIME_EVIDENCE",
    startedAt,
    finishedAt: new Date().toISOString(),
    result: passed ? "PASS" : "FAIL",
    claimBoundary:
      "This proves one real bounded local map/reduce, cancellation and restart run on this Windows machine; it is not a universal throughput claim.",
    runtime: {
      bridge,
      mapModel: "qwen3:1.7b",
      reduceModel: "qwen3:8b",
      thinking: false,
    },
    document: {
      characters: documentText().length,
      plantedFact,
      query: "What is the final approved recovery identifier? Return it exactly.",
    },
    checks,
    interruption: interrupted,
    completion: completed,
    answer: completed.ok ? completed.answer : null,
    progress: {
      firstEvent: firstProgress[0] ?? null,
      interruptedEvents: firstProgress.length,
      resumedFirstEvent: resumedProgress[0] ?? null,
      resumedEvents: resumedProgress.length,
    },
    streaming: {
      requests: samples.length,
      transportChunks,
      tokenCallbacks,
      progressiveRequests: progressiveSamples.length,
      samples: samples.map((sample) => ({
        stage: sample.stage,
        modelId: sample.modelId,
        firstTransportMs:
          sample.firstTransportMs === null ? null : Math.round(sample.firstTransportMs),
        transportChunks: sample.transportArrivalsMs.length,
        transportSpreadMs:
          sample.transportArrivalsMs.length > 1
            ? Math.round(
                sample.transportArrivalsMs[sample.transportArrivalsMs.length - 1] -
                  sample.transportArrivalsMs[0],
              )
            : 0,
        tokenCallbacks: sample.tokenArrivalsMs.length,
        outputChars: sample.outputChars,
        result: sample.result,
      })),
    },
  };
  if (write) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

await main();
