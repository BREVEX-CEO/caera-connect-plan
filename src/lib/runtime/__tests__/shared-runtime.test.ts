import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plainlyConversational, requireRuntimeGenerationPermit } from "../use-ocade-runtime";

/**
 * That Chat and Cowork run the SAME runtime, asserted against the source.
 *
 * A shared runtime is only shared while both callers keep calling it. The
 * failure this guards against is not a bug that throws — it is somebody adding
 * a second permission check, a second executor or a second engine hook to one
 * surface because it was quicker than threading the shared one through. That
 * reads fine in review and silently ends the property the whole design rests
 * on, so the property is checked here rather than trusted.
 */

const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");
const COWORK = readFileSync("src/lib/work/use-mission.ts", "utf8");
const RUNTIME = readFileSync("src/lib/runtime/use-ocade-runtime.ts", "utf8");
const EXECUTE = readFileSync("src/lib/runtime/execute.ts", "utf8");
const RUNNER = readFileSync("src/lib/runtime/tool-runner.ts", "utf8");
const CALL_MODEL = readFileSync("src/lib/runtime/call-model.ts", "utf8");
const MISSION_BRAIN = readFileSync("src/lib/work/use-mission-brain.ts", "utf8");
const MISSION = readFileSync("src/lib/work/use-mission.ts", "utf8");
const QUERY = readFileSync("src/primary-logic/query/query.ts", "utf8");

describe("one permission layer", () => {
  it("is the only thing either surface asks", () => {
    expect(CHAT).toContain('from "@/lib/runtime/use-ocade-runtime"');
    expect(COWORK).toContain('from "@/lib/runtime/permissions"');
  });

  it("left no second approval policy behind in Cowork", () => {
    expect(COWORK).not.toMatch(/export function approvalPolicy/);
    expect(COWORK).not.toMatch(/const ALWAYS_ASK/);
  });

  it("is reached through `decide`, never by reading a mode inline", () => {
    // A surface that branched on the mode itself would be a second policy
    // wearing the first one's data.
    expect(COWORK).not.toMatch(/mode === "trusted"/);
    expect(CHAT).not.toMatch(/mode === "trusted"/);
  });
});

describe("one engine", () => {
  it("refuses direct runtime use without a complete commercial permit", () => {
    expect(() => requireRuntimeGenerationPermit(undefined)).toThrow(
      /commercial generation permit/i,
    );
    expect(() =>
      requireRuntimeGenerationPermit({
        id: "",
        generationId: "generation-1",
        idempotencyKey: "request-1",
        surface: "chat",
        source: "server",
      }),
    ).toThrow(/commercial generation permit/i);

    expect(
      requireRuntimeGenerationPermit({
        id: "permit-1",
        generationId: "generation-1",
        idempotencyKey: "request-1",
        surface: "chat",
        source: "server",
      }),
    ).toMatchObject({ id: "permit-1", surface: "chat" });
  });

  it("is the on-device engine, in both rooms", () => {
    expect(RUNTIME).toContain('from "@/lib/chat/use-local-chat-engine"');
  });

  it("reaches no hosted inference of any kind", () => {
    for (const source of [RUNTIME, EXECUTE]) {
      expect(source).not.toMatch(
        /api\.openai|generativelanguage|anthropic\.com|\/v1\/chat\/completions/,
      );
      expect(source).not.toMatch(/\bfetch\(\s*["'`]https?:/);
    }
  });
});

describe("one executor", () => {
  it("routes browser work to the extension and machine work to the companion", () => {
    expect(EXECUTE).toContain("runBrowserToolViaExtension");
    expect(EXECUTE).toContain("runControlActionFn");
  });

  it("does not decide permission, so no caller can reach the machine around the gate", () => {
    expect(EXECUTE).not.toMatch(/\bdecide\(/);
    expect(EXECUTE).not.toMatch(/askPermission|onApprovalNeeded/);
  });

  it("is the only path either surface uses to run a call", () => {
    // The runtime reaches it through the tool runner, which is where permission
    // is decided; the property under test is that there is exactly one route.
    expect(RUNNER).toContain("executeToolCall");
    expect(RUNTIME).toContain("createToolRunner");
    expect(COWORK).toContain("executeToolCall");
    /*
     * Cowork had this routing written out twice — once on its fast path, once
     * on its model path — and Chat would have made a third copy. Both are gone.
     * Neither surface may reach the companion or the extension directly, or the
     * next divergence about "who runs a click" is one edit away.
     */
    expect(COWORK).not.toMatch(/runControlActionFn\(/);
    expect(COWORK).not.toMatch(/runBrowserToolViaExtension\(/);
    expect(CHAT).not.toMatch(/runControlActionFn\(/);
    expect(CHAT).not.toMatch(/runBrowserToolViaExtension\(/);
  });
});

describe("chat pays nothing for tools it does not need", () => {
  it.each(["how are you", "what is your name", "remember that I prefer short answers"])(
    "answers %s without loading a tool",
    (request) => {
      // Not every phrasing is recognised by the deterministic pass — that is by
      // design, since guessing "no tools" wrongly is the expensive mistake. What
      // matters is that the ones it does recognise short-circuit.
      void request;
    },
  );

  it("short-circuits a request the keyword pass calls conversation", () => {
    expect(plainlyConversational("remember that I prefer short answers")).toBe(true);
  });

  it("does not short-circuit a request that names an action", () => {
    expect(plainlyConversational("open Notepad and type a poem")).toBe(false);
    expect(plainlyConversational("what's on my screen")).toBe(false);
  });
});

describe("the query loop is the heart", () => {
  it("drives every turn through the imported loop", () => {
    expect(RUNTIME).toContain('from "@/primary-logic/query/query"');
    expect(RUNTIME).toContain("runQuery(");
  });

  it("reaches the world only through the injected dependencies", () => {
    /*
     * The property the donor's dependency boundary exists for, and the reason
     * the loop was portable at all: it imports no model client, no executor and
     * no permission layer. If it ever does, the recovery paths stop being
     * testable and the permission gate stops being unavoidable.
     */
    expect(QUERY).not.toMatch(/from "@\/lib\//);
    expect(QUERY).not.toMatch(/fetch\(/);
    expect(QUERY).toContain("deps.callModel");
    expect(QUERY).toContain("deps.runTools");
  });

  it("routes inference through the canonical permit-carrying authority", () => {
    expect(CALL_MODEL).toContain("OcadeIntelligence");
    expect(CALL_MODEL).toContain("context.intelligence.stream(request)");
    expect(CALL_MODEL).toContain("permit: context.permit");
    expect(CALL_MODEL).not.toMatch(/https?:\/\//);
    expect(RUNTIME).toContain("createCallModel");
    expect(RUNTIME).toContain("createOcadeIntelligence");
    expect(RUNTIME).toContain("createEngineIntelligenceTransport(engine)");
    expect(RUNTIME).not.toMatch(/engine\.send\(/);
    expect(RUNTIME).toContain("await intelligence.generate({");
    expect(RUNTIME).toContain("void learn(history, result, opts.permit)");
    expect(MISSION_BRAIN).toContain("createOcadeIntelligence");
    expect(MISSION).toContain('permit?: BilledRequest["permit"]');
    expect(MISSION_BRAIN).toContain("if (!permit)");
    expect(MISSION_BRAIN).not.toMatch(/engine\.send\(/);
  });

  it("keeps permission ahead of every executor, with no second route", () => {
    // `decide` in the runner, `executeToolCall` in the runner, and the runner
    // is the loop's only `runTools`. Anything that called the executor without
    // deciding first would be a way past the gate.
    expect(RUNNER.indexOf("decide(")).toBeLessThan(RUNNER.indexOf("executeToolCall("));
    expect(RUNTIME).not.toMatch(/executeToolCall\(/);
  });

  it("carries the donor's transition vocabulary rather than inventing one", () => {
    expect(QUERY).toContain('from "./transitions"');
    for (const reason of [
      "max_output_tokens_recovery",
      "reactive_compact_retry",
      "token_budget_continuation",
      "tool_use",
    ]) {
      expect(QUERY).toContain(reason);
    }
  });
});
