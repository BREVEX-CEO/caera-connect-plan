import { describe, expect, it, vi, beforeEach } from "vitest";

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
