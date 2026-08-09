import { describe, expect, it, vi } from "vitest";
import { createDesktopLiveWorldRuntime } from "../agent/live-world-fabric";
import type {
  CompanionStatus,
  ExecuteResult,
  NativeCompanionAdapter,
} from "../native/companion-bridge";

function companion(): NativeCompanionAdapter {
  const status: NativeCompanionAdapter["status"] = vi.fn(async (): Promise<CompanionStatus> => ({
    available: true,
    permissions: [
      {
        id: "accessibility",
        label: "Accessibility",
        state: "granted",
        guidance: "Ready",
      },
    ],
  }));
  const execute: NativeCompanionAdapter["execute"] = vi.fn(
    async (action, options): Promise<ExecuteResult> => {
      if (action.kind === "window.list") {
        return {
          ok: true,
          runId: options.runId,
          detail: "windows",
          output: { kind: "windows", titles: ["Viewer"] },
        };
      }
      if (action.kind === "accessibility.read") {
        return {
          ok: true,
          runId: options.runId,
          detail: "a11y",
          output: {
            kind: "accessibility",
            nodes: [{ role: "Button", name: "Continue", enabled: true }],
          },
        };
      }
      return { ok: true, runId: options.runId, detail: "executed" };
    },
  );
  return {
    status,
    applications: vi.fn(async () => [
      { appId: "installed.editor", label: "Installed Editor", processId: 0, windowTitle: "" },
      { appId: "running.viewer", label: "Running Viewer", processId: 42, windowTitle: "Viewer" },
    ]),
    execute,
    cancel: vi.fn(async () => {}),
    emergencyStop: vi.fn(async () => {}),
  };
}

describe("desktop live-world fabric", () => {
  it("exposes the existing typed semantic hands without raw shell authority", async () => {
    const runtime = createDesktopLiveWorldRuntime({ companion: companion() });
    const names = runtime.tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "window.arrange",
        "text.type",
        "clipboard.read",
        "clipboard.write",
        "browser.screenshot",
        "browser.page.wait",
        "browser.form.fill",
        "browser.form.submit",
        "browser.download",
        "browser.upload",
        "browser.drop",
        "skills.library.list",
        "voice.state.read",
        "system.diagnostics.read",
      ]),
    );
    expect(names.some((name) => /shell|powershell|python|command\.exec/i.test(name))).toBe(false);

    const voice = runtime.tools.find((tool) => tool.name === "voice.state.read");
    const result = await voice!.execute(
      {},
      {
        missionId: "mission-voice",
        goal: "Read voice state",
        revision: 1,
        state: (await runtime.observe(new AbortController().signal)) as never,
        signal: new AbortController().signal,
      },
    );
    expect(result.status).toBe("unsupported");
  });

  it("builds current structural state without inventing a foreground window", async () => {
    const runtime = createDesktopLiveWorldRuntime({ companion: companion() });
    const state = await runtime.observe(new AbortController().signal);

    expect(state.active).toBeUndefined();
    expect(state.applications).toEqual([
      expect.objectContaining({ appId: "installed.editor", running: false }),
      expect.objectContaining({ appId: "running.viewer", running: true }),
    ]);
    expect(state.windows?.[0]).toMatchObject({ title: "Viewer", active: false });
    expect(state.screen?.graph?.visibleText).toContain("Continue");
    expect(state.voice).toEqual({
      listening: false,
      speaking: false,
      muted: false,
      recognizerAvailable: false,
    });
  });

  it("keeps confirmation-class native actions behind the GUI permission boundary", async () => {
    const adapter = companion();
    const runtime = createDesktopLiveWorldRuntime({ companion: adapter, confirmed: () => false });
    const open = runtime.tools.find((tool) => tool.name === "application.open");
    const result = await open!.execute(
      { appId: "running.viewer" },
      {
        missionId: "mission-1",
        goal: "Open the viewer",
        revision: 1,
        state: (await runtime.observe(new AbortController().signal)) as never,
        signal: new AbortController().signal,
      },
    );

    expect(result.status).toBe("permission_required");
    expect(result.evidence).toMatch(/confirmation/i);
    expect(adapter.execute).not.toHaveBeenCalledWith(
      { kind: "app.open", appId: "running.viewer" },
      expect.anything(),
    );
  });

  it("does not call an installed-but-stopped application opened", async () => {
    const runtime = createDesktopLiveWorldRuntime({
      companion: companion(),
      confirmed: () => true,
    });
    const open = runtime.tools.find((tool) => tool.name === "application.open");
    const result = await open!.execute(
      { appId: "installed.editor" },
      {
        missionId: "mission-2",
        goal: "Open the editor",
        revision: 1,
        state: (await runtime.observe(new AbortController().signal)) as never,
        signal: new AbortController().signal,
      },
    );

    expect(result.status).toBe("retryable_failure");
    expect(result.verified).toBe(false);
  });
});
