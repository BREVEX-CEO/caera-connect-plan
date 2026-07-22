import { describe, it, expect, vi } from "vitest";
import {
  AdapterRegistry,
  createDefaultRegistry,
  createCompanionBackedAdapter,
  BROWSER_CAPABILITIES,
} from "../native/adapter-sdk";
import type { CompanionAction, ExecuteResult } from "../native/companion-bridge";

const opts = { runId: "run-1", confirmed: true };

function fakeExecutor(available = true) {
  return {
    isAvailable: vi.fn(async () => available),
    execute: vi.fn(
      async (_a: CompanionAction, o: { runId: string }): Promise<ExecuteResult> => ({
        ok: true,
        runId: o.runId,
        detail: "done",
      }),
    ),
  };
}

describe("AdapterRegistry basics", () => {
  it("registers and lists adapters", () => {
    const reg = createDefaultRegistry();
    expect(reg.list().map((a) => a.id).sort()).toEqual(["browser", "files", "windows"]);
  });

  it("refuses duplicate adapter ids", () => {
    const reg = new AdapterRegistry();
    const a = createCompanionBackedAdapter({ id: "browser", label: "B", capabilities: BROWSER_CAPABILITIES });
    reg.register(a);
    expect(() => reg.register(a)).toThrow(/already registered/i);
  });

  it("reports the union of supported action kinds", () => {
    const reg = createDefaultRegistry();
    expect(reg.supports("window.focus")).toBe(true);
    expect(reg.supports("file.open")).toBe(true);
    expect(reg.supports("screen.read")).toBe(true);
  });

  it("routes an action to the adapter that declares it", () => {
    const reg = createDefaultRegistry();
    expect(reg.findFor("window.arrange")?.id).toBe("windows");
    expect(reg.findFor("file.open")?.id).toBe("files");
  });
});

describe("dispatch guards", () => {
  it("refuses protected input even when confirmed", async () => {
    const reg = createDefaultRegistry({ browser: fakeExecutor() });
    const out = await reg.dispatch({ kind: "text.type", text: "my password is hunter2" }, opts);
    expect(out.status).toBe("refused");
    if (out.status === "refused") {
      expect(out.risk).toBe("prohibited");
      expect(out.reason).toMatch(/protected information/i);
    }
  });

  it("refuses a confirm-tier action without confirmation", async () => {
    const reg = createDefaultRegistry({ windows: fakeExecutor() });
    const out = await reg.dispatch({ kind: "app.open", appId: "notepad" }, { runId: "r" });
    expect(out.status).toBe("refused");
  });

  it("reports unsupported actions honestly", async () => {
    const reg = new AdapterRegistry();
    const out = await reg.dispatch({ kind: "window.focus", target: "x" }, opts);
    expect(out.status).toBe("unsupported");
    if (out.status === "unsupported") expect(out.reason).toMatch(/no adapter/i);
  });

  it("reports unavailable rather than simulating success when no companion is connected", async () => {
    const reg = createDefaultRegistry(); // no executors
    const out = await reg.dispatch({ kind: "window.focus", target: "Editor" }, opts);
    expect(out.status).toBe("unavailable");
    if (out.status === "unavailable") {
      expect(out.adapterId).toBe("windows");
      expect(out.reason).toMatch(/Native Companion/i);
    }
  });
});

describe("dispatch execution", () => {
  it("executes through the adapter when guarded, supported and available", async () => {
    const exec = fakeExecutor();
    const reg = createDefaultRegistry({ windows: exec });
    const out = await reg.dispatch({ kind: "window.focus", target: "Editor" }, opts);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.result.runId).toBe("run-1");
    expect(exec.execute).toHaveBeenCalledTimes(1);
  });

  it("allows read-only actions without confirmation", async () => {
    const exec = fakeExecutor();
    const reg = createDefaultRegistry({ browser: exec });
    const out = await reg.dispatch({ kind: "screen.read" }, { runId: "r2" });
    expect(out.status).toBe("ok");
  });

  it("surfaces adapter failures with redacted detail", async () => {
    const exec = fakeExecutor();
    exec.execute = vi.fn(async () => {
      throw new Error("failed near otp 483920");
    });
    const reg = createDefaultRegistry({ windows: exec });
    const out = await reg.dispatch({ kind: "window.focus", target: "x" }, opts);
    expect(out.status).toBe("failed");
    if (out.status === "failed") {
      expect(out.reason).not.toContain("483920");
      expect(out.reason).toContain("[redacted]");
    }
  });
});
