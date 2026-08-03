/**
 * Bounded OCADE research pipeline.
 *
 * Acquisition remains injected, but orchestration is real: it checks more than
 * one independent source, carries explicit contradictions, retries only
 * transient failures, honours cancellation, and bounds every external attempt.
 */
import { decomposeQuery, ResearchCache, type Volatility } from "./research-cache";
import { planFallback } from "./source-fallback";
import { assessClaim, describeAssessment, type Confidence } from "./claim-check";
import { independentSources, type SourceRecord } from "./source-ranking";

const MAX_QUERY_CHARS = 2_000;
const MAX_SUBQUERIES = 8;
const MAX_CANDIDATE_SOURCES = 50;
const MAX_ATTEMPTS = 50;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPT_TIMEOUT_MS = 120_000;
const TARGET_INDEPENDENT_SUPPORT = 2;

export interface FetchResult {
  result: "ok" | "transient" | "hard";
  findings?: string;
  relation?: "supports" | "contradicts";
  publishedAt?: Date | null;
  error?: string;
}

export interface FetchContext {
  signal?: AbortSignal;
  attempt: number;
}

export type SourceFetcher = (
  subquery: string,
  source: SourceRecord,
  context: FetchContext,
) => Promise<FetchResult>;

export interface SubAnswer {
  subquery: string;
  status: "answered" | "cached" | "contested" | "unconfirmed";
  findings: string | null;
  confidence: Confidence | "cached" | "none";
  /** Independent support and any named dissent. */
  sources: string[];
  asOf: string | null;
  note: string;
}

export interface ResearchResult {
  query: string;
  subAnswers: SubAnswer[];
  complete: boolean;
}

export type ResearchOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface ResearchRunInput {
  query: string;
  topic: string;
  candidateSources: SourceRecord[];
  fetcher: SourceFetcher;
  volatility: Volatility;
  cache?: ResearchCache;
  maxAttemptsPerSubquery?: number;
  attemptTimeoutMs?: number;
  signal?: AbortSignal;
  now?: Date;
}

export async function runResearch(
  input: ResearchRunInput,
): Promise<ResearchOutcome<ResearchResult>> {
  if (input.query.length > MAX_QUERY_CHARS) {
    return { ok: false, reason: `Research queries are limited to ${MAX_QUERY_CHARS} characters.` };
  }
  if (input.candidateSources.length > MAX_CANDIDATE_SOURCES) {
    return {
      ok: false,
      reason: `A run may consider at most ${MAX_CANDIDATE_SOURCES} candidate sources.`,
    };
  }

  const maxAttempts = input.maxAttemptsPerSubquery ?? 12;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
    return {
      ok: false,
      reason: `The per-question attempt budget must be an integer from 1 to ${MAX_ATTEMPTS}.`,
    };
  }
  const attemptTimeoutMs = input.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  if (
    !Number.isFinite(attemptTimeoutMs) ||
    attemptTimeoutMs < 1 ||
    attemptTimeoutMs > MAX_ATTEMPT_TIMEOUT_MS
  ) {
    return {
      ok: false,
      reason: `Each source attempt needs a timeout from 1 to ${MAX_ATTEMPT_TIMEOUT_MS}ms.`,
    };
  }
  if (input.signal?.aborted) return { ok: false, reason: "Research was cancelled." };

  const decomposed = decomposeQuery(input.query);
  if (!decomposed.ok) return decomposed;
  if (decomposed.data.length > MAX_SUBQUERIES) {
    return { ok: false, reason: `A run may contain at most ${MAX_SUBQUERIES} sub-questions.` };
  }

  const cache = input.cache ?? new ResearchCache();
  const now = input.now ?? new Date();
  const subAnswers: SubAnswer[] = [];

  for (const subquery of decomposed.data) {
    if (input.signal?.aborted) return { ok: false, reason: "Research was cancelled." };
    const answer = await runSubquery(subquery, input, cache, now, maxAttempts, attemptTimeoutMs);
    if (answer.cancelled) return { ok: false, reason: "Research was cancelled." };
    subAnswers.push(answer.value);
  }

  const complete = subAnswers.every(
    (answer) => answer.status === "answered" || answer.status === "cached",
  );
  return {
    ok: true,
    data: { query: input.query, subAnswers, complete },
    evidence: complete
      ? `Answered all ${subAnswers.length} sub-question(s).`
      : `${subAnswers.filter((answer) => answer.status === "contested").length} contested and ${subAnswers.filter((answer) => answer.status === "unconfirmed").length} unconfirmed sub-question(s).`,
  };
}

type SubqueryResult = { cancelled: true } | { cancelled: false; value: SubAnswer };

async function runSubquery(
  subquery: string,
  input: ResearchRunInput,
  cache: ResearchCache,
  now: Date,
  maxAttempts: number,
  attemptTimeoutMs: number,
): Promise<SubqueryResult> {
  const cached = cache.lookup(subquery, now);
  if (cached.ok && cached.data.status === "fresh" && cached.data.packet) {
    const packet = cached.data.packet;
    return {
      cancelled: false,
      value: {
        subquery,
        status: "cached",
        findings: packet.findings,
        confidence: "cached",
        sources: packet.sources,
        asOf: packet.fetchedAt,
        note: cached.evidence,
      },
    };
  }

  const plan = planFallback(input.candidateSources, input.topic);
  if (!plan.ok) return { cancelled: false, value: unconfirmed(subquery, plan.reason) };

  const supporting: SourceRecord[] = [];
  const contradicting: SourceRecord[] = [];
  let findings: string | null = null;
  let attempts = 0;
  let timedOut = 0;

  for (const source of plan.data.order) {
    if (attempts >= maxAttempts) break;
    let transientFailures = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const fetched = await fetchBounded(
        input.fetcher,
        subquery,
        source,
        attempts,
        attemptTimeoutMs,
        input.signal,
      );
      if (fetched.kind === "cancelled") return { cancelled: true };
      if (fetched.kind === "timeout") {
        timedOut++;
        transientFailures++;
        if (transientFailures <= plan.data.maxRetries) continue;
        break;
      }
      if (fetched.kind === "error") {
        transientFailures++;
        if (transientFailures <= plan.data.maxRetries) continue;
        break;
      }

      const result = fetched.value;
      if (result.result === "transient") {
        transientFailures++;
        if (transientFailures <= plan.data.maxRetries) continue;
        break;
      }
      if (result.result === "hard" || !result.findings?.trim()) break;

      const observed: SourceRecord = {
        ...source,
        publishedAt: result.publishedAt === undefined ? source.publishedAt : result.publishedAt,
        retrievedAt: now,
      };
      if (result.relation === "contradicts") {
        contradicting.push(observed);
      } else {
        supporting.push(observed);
        findings ??= result.findings.trim();
      }
      break;
    }

    if (
      independentSources(supporting).length >= TARGET_INDEPENDENT_SUPPORT ||
      (supporting.length > 0 && contradicting.length > 0)
    ) {
      break;
    }
  }

  if (!findings || supporting.length === 0) {
    const timeoutNote = timedOut > 0 ? ` ${timedOut} attempt(s) timed out.` : "";
    return {
      cancelled: false,
      value: unconfirmed(
        subquery,
        `Every source of adequate authority failed or returned no supporting evidence; OCADE couldn't confirm this and won't invent an answer.${timeoutNote}`,
      ),
    };
  }

  const assessment = assessClaim(
    { text: findings, topic: input.topic, supporting, contradicting },
    now,
  );
  const sources = independentSources([...supporting, ...contradicting]).map(
    (source) => source.publisher,
  );
  const contested = assessment.confidence === "contested";

  if (!contested) {
    cache.put({
      key: ResearchCache.keyFor(subquery),
      findings,
      sources,
      volatility: input.volatility,
      fetchedAt: now.toISOString(),
    });
  }

  return {
    cancelled: false,
    value: {
      subquery,
      status: contested ? "contested" : "answered",
      findings: contested ? assessment.statement : findings,
      confidence: assessment.confidence,
      sources,
      asOf: assessment.asOf,
      note: describeAssessment(assessment),
    },
  };
}

function unconfirmed(subquery: string, note: string): SubAnswer {
  return {
    subquery,
    status: "unconfirmed",
    findings: null,
    confidence: "none",
    sources: [],
    asOf: null,
    note,
  };
}

type BoundedFetch =
  | { kind: "result"; value: FetchResult }
  | { kind: "timeout" }
  | { kind: "cancelled" }
  | { kind: "error" };

async function fetchBounded(
  fetcher: SourceFetcher,
  subquery: string,
  source: SourceRecord,
  attempt: number,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<BoundedFetch> {
  if (parentSignal?.aborted) return { kind: "cancelled" };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let cancel: ((value: BoundedFetch) => void) | undefined;
  const cancelled = new Promise<BoundedFetch>((resolve) => {
    cancel = resolve;
  });
  const onParentAbort = () => {
    controller.abort();
    cancel?.({ kind: "cancelled" });
  };
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timeout = new Promise<BoundedFetch>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ kind: "timeout" });
    }, timeoutMs);
  });
  const attemptPromise: Promise<BoundedFetch> = Promise.resolve()
    .then(() => {
      if (controller.signal.aborted) {
        const error = new Error("Research was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      return fetcher(subquery, source, { signal: controller.signal, attempt });
    })
    .then((value) => ({ kind: "result", value }) as const)
    .catch((error: unknown) => {
      if (parentSignal?.aborted) return { kind: "cancelled" } as const;
      if (timedOut) return { kind: "timeout" } as const;
      if (error instanceof Error && error.name === "AbortError") {
        return { kind: "cancelled" } as const;
      }
      return { kind: "error" } as const;
    });

  try {
    return await Promise.race([attemptPromise, timeout, cancelled]);
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
