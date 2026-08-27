import { describe, expect, it, vi, beforeEach } from "vitest";
import { combineAbortSignals, raceAbort } from "@/primary-logic/query/abortSignals";

const runBrowserToolViaExtension = vi.fn();
const runControlActionFn = vi.fn();

vi.mock("@/lib/native/extension-adapter", () => ({
  runBrowserToolViaExtension: (...args: unknown[]) => runBrowserToolViaExtension(...args),
}));
vi.mock("@/lib/control-work.functions", () => ({
  runControlActionFn: (...args: unknown[]) => runControlActionFn(...args),
}));

const { executeToolCall } = await import("../execute");

const call = (name: string, args: Record<string, unknown> = {}) => ({ name, arguments: args });

beforeEach(() => {
  runBrowserToolViaExtension.mockReset();
  runControlActionFn.mockReset();
  runBrowserToolViaExtension.mockResolvedValue(null);
});

describe("one executor, two destinations", () => {
  it("lets the extension take a call it recognises, and never double-runs it", async () => {
    runBrowserToolViaExtension.mockResolvedValue({
      kind: "success",
      detail: "Clicked.",
      verified: true,
    });
    const outcome = await executeToolCall(call("browser_click", { selector: "#go" }), {
      missionId: "m1",
    });
    expect(outcome.kind).toBe("success");
    expect(outcome.verified).toBe(true);
    expect(runControlActionFn).not.toHaveBeenCalled();
  });

  it("sends everything else to the companion", async () => {
    runControlActionFn.mockResolvedValue({
      ok: true,
      kind: "success",
      detail: "Opened.",
      verified: true,
      observation: null,
      elapsedMs: 12,
    });
    const outcome = await executeToolCall(call("app_open", { name: "Notepad" }), {
      missionId: "m1",
    });
    expect(outcome.kind).toBe("success");
    expect(runControlActionFn).toHaveBeenCalledWith({
      data: expect.objectContaining({ missionId: "m1", tool: "app_open" }),
    });
  });

  it("refuses an invented tool name rather than sending it anywhere", async () => {
    const outcome = await executeToolCall(call("delete_everything"), { missionId: "m1" });
    expect(outcome.kind).toBe("unsupported");
    expect(runBrowserToolViaExtension).not.toHaveBeenCalled();
    expect(runControlActionFn).not.toHaveBeenCalled();
  });

  it("explains, rather than fails, when no companion is connected", async () => {
    const outcome = await executeToolCall(call("app_open", { name: "Notepad" }), {
      missionId: null,
    });
    expect(outcome.kind).toBe("blocked");
    expect(outcome.detail).toMatch(/Devices/);
    expect(runControlActionFn).not.toHaveBeenCalled();
  });

  it("carries the confirmation flag the companion requires for high-risk work", async () => {
    runControlActionFn.mockResolvedValue({ ok: true, kind: "success", detail: "Sent." });
    await executeToolCall(call("message_send", { name: "Sam" }), {
      missionId: "m1",
      confirmed: true,
    });
    expect(runControlActionFn).toHaveBeenCalledWith({
      data: expect.objectContaining({ confirmed: true }),
    });
  });

  it("does not claim a confirmation that was never given", async () => {
    runControlActionFn.mockResolvedValue({ ok: true, kind: "success", detail: "Sent." });
    await executeToolCall(call("message_send", { name: "Sam" }), { missionId: "m1" });
    expect(runControlActionFn).toHaveBeenCalledWith({
      data: expect.objectContaining({ confirmed: false }),
    });
  });

  it("drops a null observation instead of passing it on as data", async () => {
    runControlActionFn.mockResolvedValue({
      ok: true,
      kind: "success",
      detail: "Looked.",
      observation: null,
    });
    const outcome = await executeToolCall(call("screen_observe"), { missionId: "m1" });
    expect(outcome).not.toHaveProperty("observation");
  });
});

/**
 * Stop, during a call rather than between calls.
 *
 * The loop checked the signal before and after each tool call, so pressing Stop
 * while a long screen read was in flight did nothing until that read finished
 * on its own — a wait of up to a couple of minutes, with a button that looked
 * like it had been ignored.
 */
describe("stopping while a tool is running", () => {
  it("releases the person immediately and says what was left running", async () => {
    const controller = new AbortController();
    const never = new Promise<never>(() => {});

    const raced = raceAbort(never, controller.signal, () => "abandoned");
    controller.abort();

    expect(await raced).toBe("abandoned");
  });

  it("does not wait at all when it is already stopped", async () => {
    const controller = new AbortController();
    controller.abort();
    let started = false;
    const work = (async () => {
      started = true;
      return "finished";
    })();
    expect(await raceAbort(work, controller.signal, () => "abandoned")).toBe("abandoned");
    // The work was created by the caller either way; what matters is that the
    // answer did not wait for it.
    expect(started).toBe(true);
  });

  it("returns the real answer when nothing stopped it", async () => {
    const controller = new AbortController();
    expect(await raceAbort(Promise.resolve("finished"), controller.signal, () => "abandoned")).toBe(
      "finished",
    );
  });

  it("treats a failure as the abandoned case rather than throwing into the loop", async () => {
    const controller = new AbortController();
    const failing = Promise.reject(new Error("the companion went away"));
    expect(await raceAbort(failing, controller.signal, () => "abandoned")).toBe("abandoned");
  });

  it("combines two reasons to stop into one signal, and unhooks itself", () => {
    const user = new AbortController();
    const run = new AbortController();
    const combined = combineAbortSignals(user.signal, { other: run.signal });

    expect(combined.signal.aborted).toBe(false);
    run.abort();
    expect(combined.signal.aborted).toBe(true);
    // Cleanup after the fact must not throw; it is called in a finally.
    expect(() => combined.cleanup()).not.toThrow();
  });

  it("reports an already-stopped signal without arming a deadline", () => {
    const already = new AbortController();
    already.abort();
    const combined = combineAbortSignals(already.signal, { timeoutMs: 60_000 });
    expect(combined.signal.aborted).toBe(true);
  });
});
