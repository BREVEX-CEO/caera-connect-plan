/**
 * Bounded long-document map/reduce for CPU-only local engines.
 *
 * The caller receives progress before inference, every partial map result is
 * persisted, cancellation is checked between and during calls, and restart
 * resumes only when the document/query/model fingerprint is identical.
 */
import { sha256OfText } from "../provenance/digest";
import { splitIntoPassages } from "../retrieval/passages";

export type LongDocumentStage = "map" | "reduce";

export interface LongDocumentGenerateRequest {
  stage: LongDocumentStage;
  modelId: string;
  prompt: string;
  signal?: AbortSignal;
  onToken(chunk: string): void;
}

export type LongDocumentGenerate = (
  request: LongDocumentGenerateRequest,
) => Promise<{ ok: boolean; reason?: string }>;

export interface LongDocumentProgress {
  kind:
    | "planned"
    | "resumed"
    | "map_started"
    | "map_token"
    | "map_completed"
    | "reduce_started"
    | "reduce_token"
    | "completed";
  completed: number;
  total: number;
  detail: string;
  elapsedMs: number;
}

export interface LongDocumentCheckpoint {
  schemaVersion: 1;
  jobId: string;
  fingerprint: string;
  documentName: string;
  query: string;
  mapModelId: string;
  reduceModelId: string;
  chunks: Array<{ index: number; startLine: number; endLine: number; text: string }>;
  partials: Record<string, string>;
  updatedAt: string;
}

export interface LongDocumentStore {
  load(jobId: string): Promise<LongDocumentCheckpoint | null>;
  save(checkpoint: LongDocumentCheckpoint): Promise<void>;
  remove(jobId: string): Promise<void>;
}

export class InMemoryLongDocumentStore implements LongDocumentStore {
  private readonly records = new Map<string, LongDocumentCheckpoint>();

  async load(jobId: string): Promise<LongDocumentCheckpoint | null> {
    const value = this.records.get(jobId);
    return value ? structuredClone(value) : null;
  }

  async save(checkpoint: LongDocumentCheckpoint): Promise<void> {
    this.records.set(checkpoint.jobId, structuredClone(checkpoint));
  }

  async remove(jobId: string): Promise<void> {
    this.records.delete(jobId);
  }
}

export interface LongDocumentInput {
  jobId: string;
  documentName: string;
  text: string;
  query: string;
  mapModelId: string;
  reduceModelId: string;
  generate: LongDocumentGenerate;
  store: LongDocumentStore;
  signal?: AbortSignal;
  onProgress?(progress: LongDocumentProgress): void;
  now?: () => Date;
  concurrency?: number;
  chunkChars?: number;
  reduceChunkChars?: number;
  maxInputTokens?: number;
  maxOutputChars?: number;
}

export type LongDocumentOutcome =
  | {
      ok: true;
      answer: string;
      fingerprint: string;
      chunks: number;
      resumedChunks: number;
      elapsedMs: number;
    }
  | {
      ok: false;
      reason: string;
      cancelled: boolean;
      completedChunks: number;
      totalChunks: number;
      fingerprint: string | null;
    };

const SAFE_JOB_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const DEFAULT_CHUNK_CHARS = 2_400;
const DEFAULT_REDUCE_CHARS = 8_000;
const DEFAULT_MAX_INPUT_TOKENS = 20_000;
const DEFAULT_MAX_OUTPUT_CHARS = 24_000;

function abortReason(signal: AbortSignal | undefined): string | null {
  return signal?.aborted ? "The long-document job was cancelled." : null;
}

function emit(
  input: LongDocumentInput,
  started: number,
  progress: Omit<LongDocumentProgress, "elapsedMs">,
): void {
  input.onProgress?.({ ...progress, elapsedMs: Math.round(performance.now() - started) });
}

function buildChunks(text: string, targetChars: number): LongDocumentCheckpoint["chunks"] {
  const passages = splitIntoPassages(text, {
    maxChars: Math.max(400, Math.min(targetChars, 4_000)),
    overlapLines: 1,
  });
  const chunks: LongDocumentCheckpoint["chunks"] = [];
  let current: (typeof passages)[number][] = [];
  let size = 0;
  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      index: chunks.length,
      startLine: current[0].startLine,
      endLine: current[current.length - 1].endLine,
      text: current.map((passage) => passage.text).join("\n"),
    });
    current = [];
    size = 0;
  };
  for (const passage of passages) {
    if (current.length > 0 && size + passage.text.length > targetChars) flush();
    current.push(passage);
    size += passage.text.length;
  }
  flush();
  return chunks;
}

async function fingerprintFor(input: LongDocumentInput): Promise<string> {
  return await sha256OfText(
    JSON.stringify({
      text: input.text,
      query: input.query,
      mapModelId: input.mapModelId,
      reduceModelId: input.reduceModelId,
    }),
  );
}

async function generateText(
  input: LongDocumentInput,
  stage: LongDocumentStage,
  modelId: string,
  prompt: string,
  maxOutputChars: number,
  onToken: (chunk: string) => void,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  let text = "";
  const result = await input.generate({
    stage,
    modelId,
    prompt,
    signal: input.signal,
    onToken: (chunk) => {
      if (text.length + chunk.length > maxOutputChars) {
        throw new Error("The local model exceeded the long-document output budget.");
      }
      text += chunk;
      onToken(chunk);
    },
  });
  if (!result.ok) return { ok: false, reason: result.reason ?? "Local generation failed." };
  if (!text.trim()) return { ok: false, reason: "The local model returned no usable text." };
  return { ok: true, text: text.trim() };
}

function groups(values: string[], maxChars: number): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const value of values) {
    if (current.length > 0 && size + value.length > maxChars) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(value);
    size += value.length;
  }
  if (current.length > 0) result.push(current);
  return result;
}

export async function runLongDocument(input: LongDocumentInput): Promise<LongDocumentOutcome> {
  const started = performance.now();
  if (
    !SAFE_JOB_ID.test(input.jobId) ||
    !input.documentName.trim() ||
    !input.text.trim() ||
    !input.query.trim() ||
    !input.mapModelId.trim() ||
    !input.reduceModelId.trim()
  ) {
    return {
      ok: false,
      reason: "The long-document request is malformed.",
      cancelled: false,
      completedChunks: 0,
      totalChunks: 0,
      fingerprint: null,
    };
  }
  const estimatedTokens = Math.ceil((input.text.length + input.query.length) / 4);
  if (estimatedTokens > (input.maxInputTokens ?? DEFAULT_MAX_INPUT_TOKENS)) {
    return {
      ok: false,
      reason: `The document is about ${estimatedTokens} tokens, over the explicit input budget.`,
      cancelled: false,
      completedChunks: 0,
      totalChunks: 0,
      fingerprint: null,
    };
  }
  const fingerprint = await fingerprintFor(input);
  const chunks = buildChunks(input.text, input.chunkChars ?? DEFAULT_CHUNK_CHARS);
  if (chunks.length === 0) {
    return {
      ok: false,
      reason: "The document contains no readable passages.",
      cancelled: false,
      completedChunks: 0,
      totalChunks: 0,
      fingerprint,
    };
  }
  const now = input.now ?? (() => new Date());
  const previous = await input.store.load(input.jobId);
  const resumable = previous?.fingerprint === fingerprint;
  const checkpoint: LongDocumentCheckpoint = resumable
    ? previous
    : {
        schemaVersion: 1,
        jobId: input.jobId,
        fingerprint,
        documentName: input.documentName,
        query: input.query,
        mapModelId: input.mapModelId,
        reduceModelId: input.reduceModelId,
        chunks,
        partials: {},
        updatedAt: now().toISOString(),
      };
  const resumedChunks = Object.keys(checkpoint.partials).length;
  emit(input, started, {
    kind: resumable ? "resumed" : "planned",
    completed: resumedChunks,
    total: chunks.length,
    detail: resumable
      ? `Resuming ${resumedChunks}/${chunks.length} persisted map result(s).`
      : `Planned ${chunks.length} bounded semantic chunk(s).`,
  });
  const concurrency = Math.max(1, Math.min(input.concurrency ?? 1, 4, chunks.length));
  let cursor = 0;
  let failure: string | null = null;
  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= chunks.length || failure) return;
      const chunk = chunks[index];
      if (checkpoint.partials[String(index)] !== undefined) continue;
      if (abortReason(input.signal)) {
        failure = abortReason(input.signal);
        return;
      }
      emit(input, started, {
        kind: "map_started",
        completed: Object.keys(checkpoint.partials).length,
        total: chunks.length,
        detail: `Reading lines ${chunk.startLine}-${chunk.endLine}.`,
      });
      let result: Awaited<ReturnType<typeof generateText>>;
      try {
        result = await generateText(
          input,
          "map",
          input.mapModelId,
          [
            "Extract only facts relevant to the question. Preserve names, numbers and line ranges.",
            `Question: ${input.query}`,
            `Document: ${input.documentName}, lines ${chunk.startLine}-${chunk.endLine}`,
            chunk.text,
          ].join("\n\n"),
          input.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS,
          () =>
            emit(input, started, {
              kind: "map_token",
              completed: Object.keys(checkpoint.partials).length,
              total: chunks.length,
              detail: `Receiving map result for chunk ${index + 1}.`,
            }),
        );
      } catch (error) {
        failure = error instanceof Error ? error.message : "Map generation failed.";
        return;
      }
      if (!result.ok) {
        failure = result.reason;
        return;
      }
      checkpoint.partials[String(index)] = result.text;
      checkpoint.updatedAt = now().toISOString();
      await input.store.save(checkpoint);
      emit(input, started, {
        kind: "map_completed",
        completed: Object.keys(checkpoint.partials).length,
        total: chunks.length,
        detail: `Persisted map result ${index + 1}/${chunks.length}.`,
      });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (failure || abortReason(input.signal)) {
    return {
      ok: false,
      reason: failure ?? abortReason(input.signal)!,
      cancelled: Boolean(abortReason(input.signal)),
      completedChunks: Object.keys(checkpoint.partials).length,
      totalChunks: chunks.length,
      fingerprint,
    };
  }
  let layer = chunks.map((chunk) => checkpoint.partials[String(chunk.index)]);
  const reduceChars = Math.max(2_000, input.reduceChunkChars ?? DEFAULT_REDUCE_CHARS);
  let reduceRound = 0;
  while (layer.length > 1) {
    const grouped = groups(layer, reduceChars);
    const next: string[] = [];
    for (let index = 0; index < grouped.length; index += 1) {
      if (abortReason(input.signal)) {
        return {
          ok: false,
          reason: abortReason(input.signal)!,
          cancelled: true,
          completedChunks: chunks.length,
          totalChunks: chunks.length,
          fingerprint,
        };
      }
      emit(input, started, {
        kind: "reduce_started",
        completed: index,
        total: grouped.length,
        detail: `Reducing evidence layer ${reduceRound + 1}, group ${index + 1}/${grouped.length}.`,
      });
      const reduced = await generateText(
        input,
        "reduce",
        input.reduceModelId,
        [
          "Answer the question only from the extracted evidence. State uncertainty and conflicts.",
          `Question: ${input.query}`,
          "Evidence:",
          grouped[index].join("\n\n---\n\n"),
        ].join("\n\n"),
        input.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS,
        () =>
          emit(input, started, {
            kind: "reduce_token",
            completed: index,
            total: grouped.length,
            detail: "Receiving a hierarchical reduce result.",
          }),
      );
      if (!reduced.ok) {
        return {
          ok: false,
          reason: reduced.reason,
          cancelled: false,
          completedChunks: chunks.length,
          totalChunks: chunks.length,
          fingerprint,
        };
      }
      next.push(reduced.text);
    }
    layer = next;
    reduceRound += 1;
  }
  const answer = layer[0];
  await input.store.remove(input.jobId);
  emit(input, started, {
    kind: "completed",
    completed: chunks.length,
    total: chunks.length,
    detail: "Long-document answer completed and checkpoint cleared.",
  });
  return {
    ok: true,
    answer,
    fingerprint,
    chunks: chunks.length,
    resumedChunks,
    elapsedMs: Math.round(performance.now() - started),
  };
}
