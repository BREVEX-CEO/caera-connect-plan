import { describe, expect, it, vi } from "vitest";
import type { CompanionAction } from "../native/companion-bridge";
import {
  NATIVE_OBSERVATION_SOURCE,
  createNativeObservationVerifierRegistry,
  digestObservationValue,
  isNativeObservationAdapter,
  type NativeObservationAdapter,
  type NativeObservationRequest,
  type ObservableActionKind,
} from "../native/automation-observer";

const NOW = "2026-07-24T12:00:00.000Z";
const RUN_ID = "run-7";
const OPERATION_ID = "run-7:step:0";

function base(kind: ObservableActionKind): Record<string, unknown> {
  return {
    source: NATIVE_OBSERVATION_SOURCE,
    kind,
    runId: RUN_ID,
    operationId: OPERATION_ID,
    observedAt: NOW,
  };
}

function observerWith(response: unknown): NativeObservationAdapter {
  return { observe: vi.fn(async () => response) };
}

async function verify(action: CompanionAction, response: unknown) {
  const registry = createNativeObservationVerifierRegistry(observerWith(response), {
    now: () => new Date(NOW),
  });
  return registry.get(action.kind)!({
    action,
    executionDetail: "executor claimed success with secret-token=not-evidence",
    runId: RUN_ID,
    operationId: OPERATION_ID,
  });
}

describe("native automation observation verifiers", () => {
  it("registers only action kinds with deterministic structured observations", () => {
    const registry = createNativeObservationVerifierRegistry(observerWith({}));
    expect(registry.observationBackedKinds()).toEqual([
      "app.open",
      "clipboard.write",
      "file.open",
      "window.arrange",
      "window.focus",
    ]);
    for (const kind of [
      "screen.read",
      "window.list",
      "text.type",
      "clipboard.read",
      "selection.read",
      "selection.replace",
    ] as const) {
      expect(registry.get(kind)).toBeNull();
    }
  });

  it("verifies window focus from a fresh independent identity hash", async () => {
    const target = "  Notes  ";
    const activeTargetDigest = await digestObservationValue("Notes");
    const result = await verify(
      { kind: "window.focus", target },
      { ...base("window.focus"), activeTargetDigest },
    );
    expect(result).toEqual({
      verified: true,
      evidence: "Window focus verified through a fresh native OS observation.",
    });
    expect(result.evidence).not.toContain("not-evidence");
  });

  it("rejects a different focused window", async () => {
    const result = await verify(
      { kind: "window.focus", target: "Notes" },
      {
        ...base("window.focus"),
        activeTargetDigest: await digestObservationValue("Calculator"),
      },
    );
    expect(result.verified).toBe(false);
    expect(result.evidence).toMatch(/did not match/i);
  });

  it("verifies arrangement layout and optional target together", async () => {
    const result = await verify(
      { kind: "window.arrange", layout: "left", target: "Editor" },
      {
        ...base("window.arrange"),
        layout: "left",
        targetDigest: await digestObservationValue("Editor"),
      },
    );
    expect(result.verified).toBe(true);
  });

  it("rejects an unexpected arrangement layout", async () => {
    const result = await verify(
      { kind: "window.arrange", layout: "left" },
      { ...base("window.arrange"), layout: "right" },
    );
    expect(result.verified).toBe(false);
  });

  it("verifies application and file identities without returning plaintext evidence", async () => {
    const app = "com.example.notes";
    const file = "C:/work/private.txt";
    const appResult = await verify(
      { kind: "app.open", appId: app },
      { ...base("app.open"), runningAppDigest: await digestObservationValue(app) },
    );
    const fileResult = await verify(
      { kind: "file.open", path: file },
      { ...base("file.open"), activeFileDigest: await digestObservationValue(file) },
    );
    expect(appResult.verified).toBe(true);
    expect(fileResult.verified).toBe(true);
    expect(`${appResult.evidence} ${fileResult.evidence}`).not.toContain(app);
    expect(`${appResult.evidence} ${fileResult.evidence}`).not.toContain(file);
  });

  it("verifies a clipboard write by hash and never echoes its text", async () => {
    const text = "private draft content";
    const result = await verify(
      { kind: "clipboard.write", text },
      { ...base("clipboard.write"), clipboardDigest: await digestObservationValue(text) },
    );
    expect(result.verified).toBe(true);
    expect(result.evidence).not.toContain(text);
  });

  it("rejects stale and implausibly future observations", async () => {
    const digest = await digestObservationValue("Notes");
    const stale = await verify(
      { kind: "window.focus", target: "Notes" },
      {
        ...base("window.focus"),
        observedAt: "2026-07-24T11:59:49.999Z",
        activeTargetDigest: digest,
      },
    );
    const future = await verify(
      { kind: "window.focus", target: "Notes" },
      {
        ...base("window.focus"),
        observedAt: "2026-07-24T12:00:02.001Z",
        activeTargetDigest: digest,
      },
    );
    expect(stale.evidence).toMatch(/stale/i);
    expect(future.evidence).toMatch(/future/i);
  });

  it("rejects source, kind, run, and operation correlation mismatches", async () => {
    const digest = await digestObservationValue("Notes");
    for (const override of [
      { source: "executor-result" },
      { kind: "app.open" },
      { runId: "other-run" },
      { operationId: "other-operation" },
    ]) {
      const result = await verify(
        { kind: "window.focus", target: "Notes" },
        { ...base("window.focus"), activeTargetDigest: digest, ...override },
      );
      expect(result.verified).toBe(false);
    }
  });

  it("rejects noncanonical timestamps and malformed digests", async () => {
    const timestamp = await verify(
      { kind: "window.focus", target: "Notes" },
      {
        ...base("window.focus"),
        observedAt: "2026-07-24 12:00:00Z",
        activeTargetDigest: await digestObservationValue("Notes"),
      },
    );
    const digest = await verify(
      { kind: "window.focus", target: "Notes" },
      { ...base("window.focus"), activeTargetDigest: "Notes" },
    );
    expect(timestamp.evidence).toMatch(/timestamp/i);
    expect(digest.verified).toBe(false);
  });

  it("redacts credential-like values from observation transport errors", async () => {
    const registry = createNativeObservationVerifierRegistry(
      {
        async observe(_request: NativeObservationRequest) {
          throw new Error("authorization=super-secret-token");
        },
      },
      { now: () => new Date(NOW) },
    );
    const result = await registry.get("window.focus")!({
      action: { kind: "window.focus", target: "Notes" },
      executionDetail: "",
      runId: RUN_ID,
      operationId: OPERATION_ID,
    });
    expect(result.verified).toBe(false);
    expect(result.evidence).toContain("[REDACTED]");
    expect(result.evidence).not.toContain("super-secret-token");
  });

  it("detects the observation interface without treating arbitrary objects as adapters", () => {
    expect(isNativeObservationAdapter({ observe: async () => ({}) })).toBe(true);
    expect(isNativeObservationAdapter({ observe: true })).toBe(false);
    expect(isNativeObservationAdapter(null)).toBe(false);
  });
});
