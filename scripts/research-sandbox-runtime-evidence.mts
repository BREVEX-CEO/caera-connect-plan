/**
 * REAL-TARGET runtime evidence harness for P15 — research acquisition,
 * the generated-code sandbox, and code-workspace repository mapping.
 *
 * Like the Ollama harness, this is deliberately NOT part of `npm test`: it
 * makes real outbound HTTPS requests and spawns real child processes, neither
 * of which belongs in a unit suite. Its job is to drive OCADE's own production
 * modules against real runtime and write down exactly what happened.
 *
 * Every recorded field is something the runtime actually returned. A step that
 * could not run is recorded as `skipped` with a reason — never as a pass. The
 * network group degrades to `skipped` when the host is offline rather than
 * silently reporting success.
 *
 * Usage: npx vite-node scripts/research-sandbox-runtime-evidence.mts
 */
import { writeFileSync } from "node:fs";
import { platform, arch } from "node:os";
import { readFile } from "node:fs/promises";
import { validateResearchUrl, createHttpSourceFetcher } from "../src/lib/research/http-source.ts";
import { runResearch } from "../src/lib/research/research-run.ts";
import type { SourceRecord } from "../src/lib/research/source-ranking.ts";
import { createNodePermissionSandboxHost } from "../src/lib/code/generated-sandbox-node.ts";
import type { GeneratedSandboxRequest } from "../src/lib/code/generated-sandbox.ts";
import { buildRepoMap, findSymbol, importersOf } from "../src/lib/code/repo-map.ts";

type Status = "observed" | "skipped" | "failed";
type Step = { id: string; what: string; status: Status; detail: unknown };

const steps: Step[] = [];
function record(id: string, what: string, status: Status, detail: unknown) {
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "OK  " : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`  [${mark}] ${id}  ${what}`);
  if (status !== "observed") console.log(`         ${JSON.stringify(detail)}`);
}

/** IANA reserves example.com for documentation and testing. */
const PUBLIC_HOST = "example.com";
const PUBLIC_URL = `https://${PUBLIC_HOST}/`;

async function online(): Promise<boolean> {
  try {
    const response = await fetch(PUBLIC_URL, { signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- A. research

async function researchGroup(hasNetwork: boolean) {
  console.log("\nA. Research acquisition");

  // A01 — the SSRF guard, executed for real against genuinely hostile inputs.
  const hostile = [
    ["cloud metadata", "https://169.254.169.254/latest/meta-data/"],
    ["loopback", "https://localhost/secrets"],
    ["private range", "https://10.0.0.5/internal"],
    ["plain http", "http://example.com/"],
    ["credentialed", "https://user:pass@example.com/"],
    ["nonstandard port", "https://example.com:8443/"],
    ["malformed", "not-a-url"],
  ] as const;
  const refusals = hostile.map(([label, url]) => {
    const verdict = validateResearchUrl(url, [
      PUBLIC_HOST,
      "169.254.169.254",
      "localhost",
      "10.0.0.5",
    ]);
    return { label, url, refused: !verdict.ok, reason: verdict.ok ? null : verdict.reason };
  });
  const allRefused = refusals.every((r) => r.refused);
  record(
    "A01",
    "validateResearchUrl refuses hostile targets even when allowlisted",
    allRefused ? "observed" : "failed",
    refusals,
  );

  // A02 — an allowlisted public HTTPS source is accepted.
  const accepted = validateResearchUrl(PUBLIC_URL, [PUBLIC_HOST]);
  record(
    "A02",
    "an allowlisted HTTPS source passes validation",
    accepted.ok ? "observed" : "failed",
    {
      url: PUBLIC_URL,
      ok: accepted.ok,
    },
  );

  const source: SourceRecord = {
    id: "src-example",
    title: "Example Domain",
    url: PUBLIC_URL,
    publisher: "IANA",
    kind: "official",
    publishedAt: null,
  };

  if (!hasNetwork) {
    record("A03", "real HTTPS acquisition through the production fetcher", "skipped", {
      reason: "This host has no outbound network. Not recorded as a pass.",
    });
    record("A04", "runResearch end-to-end over real HTTPS", "skipped", {
      reason: "Depends on A03.",
    });
    return;
  }

  // A03 — the real fetcher, real global fetch, real socket, real public host.
  const fetcher = createHttpSourceFetcher({ allowedHosts: [PUBLIC_HOST] });
  const fetched = await fetcher("what is this domain for", source, { attempt: 1 });
  record(
    "A03",
    "real HTTPS acquisition through the production fetcher",
    fetched.result === "ok" ? "observed" : "failed",
    {
      result: fetched.result,
      error: fetched.error ?? null,
      findingsChars: fetched.findings?.length ?? 0,
    },
  );

  // A03b — a source outside the allowlist is refused before any socket opens.
  const offAllowlist = await fetcher(
    "off allowlist",
    { ...source, id: "src-npm", url: "https://registry.npmjs.org/" },
    { attempt: 1 },
  );
  record(
    "A03b",
    "a non-allowlisted host is refused before any request",
    offAllowlist.result === "hard" ? "observed" : "failed",
    { result: offAllowlist.result, error: offAllowlist.error ?? null },
  );

  // A04 — the whole pipeline: decomposition, ranking, acquisition, claim check.
  const run = await runResearch({
    query: "What is the example.com domain reserved for?",
    topic: "internet standards",
    candidateSources: [source],
    fetcher,
    volatility: "stable",
    maxAttemptsPerSubquery: 2,
    attemptTimeoutMs: 15_000,
  });
  record("A04", "runResearch end-to-end over real HTTPS", run.ok ? "observed" : "failed", {
    ok: run.ok,
    reason: run.ok ? null : run.reason,
    subAnswers: run.ok
      ? run.data.subAnswers.map((s) => ({
          subquery: s.subquery,
          status: s.status,
          confidence: s.confidence,
        }))
      : null,
    complete: run.ok ? run.data.complete : null,
    note: "One allowlisted source cannot reach the two-source independent-support bar, so an unconfirmed verdict here is the pipeline being honest, not a failure.",
  });
}

// ----------------------------------------------------------------- B. sandbox

function sandboxRequest(over: Partial<GeneratedSandboxRequest>): GeneratedSandboxRequest {
  return {
    taskId: "p15-evidence",
    language: "javascript",
    script: "console.log('hello');",
    inputs: [],
    outputs: [],
    allowedImports: [],
    network: "disabled",
    limits: {
      wallTimeMs: 10_000,
      cpuTimeMs: 10_000,
      memoryMb: 256,
      storageBytes: 1_000_000,
      outputBytes: 100_000,
    },
    ...over,
  };
}

async function sandboxGroup() {
  console.log("\nB. Generated-code sandbox (real child processes)");
  const host = createNodePermissionSandboxHost();

  /** The worker prints {ok, logs} on stdout. Read the logs the script emitted. */
  function logsOf(stdout: string): string[] {
    try {
      const parsed = JSON.parse(stdout) as { ok?: boolean; logs?: unknown };
      return Array.isArray(parsed.logs) ? parsed.logs.map(String) : [];
    } catch {
      return [];
    }
  }

  // B01 — real execution in a real spawned process, asserted on the value the
  // script actually produced rather than merely on exit code 0. An exit code
  // alone would pass for a script whose output was never captured at all.
  const ran = await host.run(
    sandboxRequest({ script: "sandbox.log(JSON.stringify({ sum: 2 + 3 }));" }),
  );
  const ranLogs = logsOf(ran.stdout);
  record(
    "B01",
    "a real child process executes and its output is captured",
    ran.exitCode === 0 && ranLogs.includes('{"sum":5}') ? "observed" : "failed",
    {
      hostId: ran.hostId,
      isolation: ran.isolation,
      exitCode: ran.exitCode,
      logs: ranLogs,
      timedOut: ran.timedOut,
    },
  );

  // B02 — network denial OBSERVED from inside the context, not read back from
  // the host's `networkDenied` field. That field is a hard-coded `true` in
  // generated-sandbox-node.ts, so asserting on it would prove only that a
  // literal is a literal. Probing the context proves egress is impossible
  // because no primitive capable of it is reachable.
  const probe = await host.run(
    sandboxRequest({
      script:
        "sandbox.log(JSON.stringify({ fetch: typeof fetch, require: typeof require, process: typeof process, XMLHttpRequest: typeof XMLHttpRequest, WebSocket: typeof WebSocket, import_: typeof importScripts }));",
    }),
  );
  const reachable = JSON.parse(logsOf(probe.stdout)[0] ?? "{}") as Record<string, string>;
  const noEgressPrimitive = Object.values(reachable).every((t) => t === "undefined");
  record(
    "B02",
    "no network primitive is reachable inside the sandbox context",
    noEgressPrimitive ? "observed" : "failed",
    {
      typeofInsideContext: reachable,
      hostField: probe.networkDenied,
      caveat:
        "The host's networkDenied/childProcessesDenied/readScopeEnforced fields are hard-coded true and are NOT observations. This step is the observation.",
    },
  );

  // B03 — a declared output is captured and hashed.
  const withOutput = await host.run(
    sandboxRequest({
      script: "await sandbox.writeText('report.txt', 'generated by the sandbox');",
      outputs: [{ path: "report.txt", mediaType: "text/plain", maxBytes: 10_000 }],
    }),
  );
  const produced = withOutput.outputs.find((o) => o.path === "report.txt");
  record(
    "B03",
    "a declared output file is captured with its digest",
    produced ? "observed" : "failed",
    {
      exitCode: withOutput.exitCode,
      stderr: withOutput.stderr.slice(0, 200),
      outputs: withOutput.outputs.map((o) => ({
        path: o.path,
        bytes: o.bytes,
        sha256: o.sha256.slice(0, 16) + "…",
      })),
    },
  );

  // B04 — an undeclared output is REFUSED at the point of writing. The earlier
  // version of this step asserted only that no undeclared file came back, which
  // a script that failed for an unrelated reason would also satisfy. Requiring
  // the specific refusal message makes the pass mean what it claims.
  const undeclared = await host.run(
    sandboxRequest({
      script: "await sandbox.writeText('secret.txt', 'undeclared');",
      outputs: [{ path: "report.txt", mediaType: "text/plain", maxBytes: 10_000 }],
    }),
  );
  const refusedUndeclared =
    undeclared.exitCode !== 0 &&
    /not declared/i.test(undeclared.stderr) &&
    !undeclared.outputs.some((o) => o.path === "secret.txt");
  record(
    "B04",
    "writing an undeclared output is refused",
    refusedUndeclared ? "observed" : "failed",
    {
      exitCode: undeclared.exitCode,
      stderr: undeclared.stderr.slice(0, 200),
      returnedPaths: undeclared.outputs.map((o) => o.path),
    },
  );

  // B05 — a declared output cannot be used to escape the output directory.
  const escape = await host.run(
    sandboxRequest({
      script: "await sandbox.writeText('../escaped.txt', 'out of scope');",
      outputs: [{ path: "../escaped.txt", mediaType: "text/plain", maxBytes: 10_000 }],
    }),
  );
  record(
    "B05",
    "a traversal path is refused even when declared",
    escape.exitCode !== 0 && /escapes its scope|not declared/i.test(escape.stderr)
      ? "observed"
      : "failed",
    { exitCode: escape.exitCode, stderr: escape.stderr.slice(0, 200) },
  );

  // B06 — the wall-time limit actually stops a runaway script.
  const runaway = await host.run(
    sandboxRequest({
      script: "while (true) {}",
      limits: {
        wallTimeMs: 1_500,
        cpuTimeMs: 1_500,
        memoryMb: 128,
        storageBytes: 100_000,
        outputBytes: 10_000,
      },
    }),
  );
  record(
    "B06",
    "an infinite loop is stopped by the wall-time limit",
    runaway.timedOut ? "observed" : "failed",
    {
      timedOut: runaway.timedOut,
      exitCode: runaway.exitCode,
      limitExceeded: runaway.limitExceeded ?? null,
      processTreeTerminated: runaway.processTreeTerminated,
    },
  );

  // B07 — the host refuses what it says it refuses.
  const refusals: Array<{ what: string; refused: boolean; message: string | null }> = [];
  for (const [what, request] of [
    ["non-JavaScript source", sandboxRequest({ language: "python" as never })],
    ["network:'approved'", sandboxRequest({ network: "approved", approvalId: "any" })],
  ] as const) {
    try {
      await host.run(request);
      refusals.push({ what, refused: false, message: null });
    } catch (error) {
      refusals.push({ what, refused: true, message: (error as Error).message });
    }
  }
  record(
    "B07",
    "the host refuses non-JS and refuses approved network",
    refusals.every((r) => r.refused) ? "observed" : "failed",
    refusals,
  );
}

// -------------------------------------------------------- C. code workspace

async function workspaceGroup() {
  console.log("\nC. Code workspace over real repository files");

  const paths = [
    "src/lib/research/research-run.ts",
    "src/lib/research/http-source.ts",
    "src/lib/research/source-ranking.ts",
    "src/lib/code/repo-map.ts",
    "src/lib/code/generated-sandbox-node.ts",
  ];
  const files = await Promise.all(
    paths.map(async (path) => ({ path, content: await readFile(path, "utf8") })),
  );

  const map = buildRepoMap(files);
  record("C01", "buildRepoMap over real repository sources", map.ok ? "observed" : "failed", {
    filesMapped: map.ok ? map.data.files.length : null,
    reason: map.ok ? null : map.reason,
    totalExports: map.ok ? map.data.files.reduce((n, f) => n + f.exports.length, 0) : null,
  });

  if (!map.ok) return;

  const hit = findSymbol(map.data, "runResearch");
  record(
    "C02",
    "findSymbol locates a real exported symbol",
    hit.ok && hit.data.length > 0 ? "observed" : "failed",
    {
      query: "runResearch",
      hits: hit.ok ? hit.data.map((h) => ({ path: h.path, kind: h.kind })) : null,
      reason: hit.ok ? null : hit.reason,
    },
  );

  const importers = importersOf(map.data, "./source-ranking");
  record("C03", "importersOf resolves real import edges", importers.ok ? "observed" : "failed", {
    specifier: "./source-ranking",
    importers: importers.ok ? importers.data : null,
    reason: importers.ok ? null : importers.reason,
  });
}

// ------------------------------------------------------------------- publish

const hasNetwork = await online();
console.log(`Host network: ${hasNetwork ? "ONLINE" : "OFFLINE"}`);

await researchGroup(hasNetwork);
await sandboxGroup();
await workspaceGroup();

const observed = steps.filter((s) => s.status === "observed").length;
const failed = steps.filter((s) => s.status === "failed").length;
const skipped = steps.filter((s) => s.status === "skipped").length;

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase: "P15 - research acquisition and code-workspace runtime",
  tier: failed === 0 && skipped === 0 ? "REAL TARGET RUNTIME VERIFIED" : "PARTIAL",
  caveat:
    "Observed on ONE host. Research acquisition used example.com, an IANA-reserved documentation domain: it proves the guarded fetcher performs real HTTPS over a real socket, NOT that OCADE can research the open web at scale. The sandbox spawned real Node child processes on this platform only; other platforms are unproven.",
  host: {
    platform: platform(),
    arch: arch(),
    node: process.version,
    network: hasNetwork ? "online" : "offline",
  },
  summary: { observed, failed, skipped, total: steps.length },
  steps,
};

writeFileSync(
  "release/OCADE_P15_RESEARCH_SANDBOX_RUNTIME_EVIDENCE.json",
  JSON.stringify(evidence, null, 2),
);

console.log(`\n${observed} observed, ${failed} failed, ${skipped} skipped of ${steps.length}.`);
console.log("Wrote release/OCADE_P15_RESEARCH_SANDBOX_RUNTIME_EVIDENCE.json");
if (failed > 0) process.exitCode = 1;
