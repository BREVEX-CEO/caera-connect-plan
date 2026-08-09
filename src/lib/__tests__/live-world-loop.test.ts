import { describe, expect, it, vi } from "vitest";
import { LiveWorldAgent, type LiveWorldTool } from "../agent/live-world-loop";
import type { LocalToolTurnResult } from "../ocade-local";
import type { WorldState } from "../agent/world-state";

function world(revision: number, label: string): Partial<WorldState> {
  return {
    revision,
    active: {
      appId: "unfamiliar.editor",
      windowId: "window-9",
      title: "Untitled - Unfamiliar Editor",
    },
    applications: [{ appId: "unfamiliar.editor", label: "Unfamiliar Editor", running: true }],
    windows: [
      {
        windowId: "window-9",
        appId: "unfamiliar.editor",
        title: "Untitled - Unfamiliar Editor",
        active: true,
      },
    ],
    browser: { tabs: [] },
    screen: {
      monitors: [{ id: "primary", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scale: 1 }],
      changedRegions: [],
      graph: {
        fingerprint: `screen-${revision}`,
        visibleText: [label],
        elements: [
          {
            id: `button-${revision}`,
            role: "button",
            label,
            enabled: true,
            confidence: 0.99,
            sources: ["accessibility"],
            actions: ["activate"],
          },
        ],
      },
    },
    input: { heldKeys: [], heldButtons: [], controller: "shared" },
    media: [],
    network: { online: true },
    devices: [],
    task: { status: "running" },
    permissions: [{ scope: "desktop.control", state: "granted" }],
    recentActions: [],
  };
}

function turn(tool: string, arguments_: Record<string, unknown>): LocalToolTurnResult {
  const call = { function: { name: tool, arguments: arguments_ } };
  return {
    ok: true,
    content: "",
    toolCalls: [call],
    assistantMessage: { role: "assistant", content: "", tool_calls: [call] },
  };
}

describe("general live-world agent loop", () => {
  it("handles a previously unseen semantic goal with sequential tool calls and fresh state", async () => {
    let observation = 0;
    const executions: number[] = [];
    const tool: LiveWorldTool = {
      name: "ui.activate",
      description: "Activate a semantic control after reacquiring it in the current ScreenGraph.",
      parameters: {
        type: "object",
        properties: { label: { type: "string" } },
        required: ["label"],
      },
      permission: "desktop.control",
      mutating: true,
      execute: vi.fn(async (_arguments, context) => {
        executions.push(context.state.revision);
        return {
          status: "success" as const,
          verified: true,
          evidence: "The new panel appeared in an independent observation.",
        };
      }),
    };
    const transport = vi
      .fn()
      .mockResolvedValueOnce(turn("ui.activate", { label: "Recalculate layout" }))
      .mockResolvedValueOnce({
        ok: true,
        content: "The layout was recalculated and verified.",
        toolCalls: [],
        assistantMessage: {
          role: "assistant",
          content: "The layout was recalculated and verified.",
        },
      });
    const agent = new LiveWorldAgent({
      bridgeUrl: "http://127.0.0.1:11434",
      modelId: "qwen3:8b",
      tools: [tool],
      transport,
      observe: vi.fn(async () =>
        world(++observation, observation === 1 ? "Recalculate layout" : "Layout ready"),
      ),
      idFactory: () => "novel-mission",
    });
    const result = await agent.run(
      "In this unfamiliar editor, refresh the arrangement so the canvas is ready.",
    );
    expect(result.status).toBe("completed");
    expect(result.mission.completedFacts).toEqual([
      expect.stringMatching(/independent observation/i),
    ]);
    expect(executions).toEqual([1]);
    expect(observation).toBe(2);
    const secondMessages = transport.mock.calls[1][2] as Array<{ role: string; content: string }>;
    expect(secondMessages.at(-1)).toMatchObject({ role: "tool" });
    expect(secondMessages.at(-1)?.content).toMatch(/updatedWorldState|Layout ready|screen-2/);
  });

  it("replans after a planted stale-target failure instead of repeating the old coordinate", async () => {
    let observation = 0;
    const tool: LiveWorldTool = {
      name: "ui.activate",
      description: "Reacquire and activate a semantic control.",
      parameters: {
        type: "object",
        properties: { label: { type: "string" } },
        required: ["label"],
      },
      permission: "desktop.control",
      mutating: true,
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          status: "state_changed",
          evidence: "Fingerprint changed; old target was not clicked.",
          nextSafeRoute: "accessibility.reobserve",
        })
        .mockResolvedValueOnce({
          status: "success",
          verified: true,
          evidence: "Fresh Continue control activated and dialog closed.",
        }),
    };
    const transport = vi
      .fn()
      .mockResolvedValueOnce(turn("ui.activate", { label: "Continue" }))
      .mockResolvedValueOnce(turn("ui.activate", { label: "Continue" }))
      .mockResolvedValueOnce({
        ok: true,
        content: "The current Continue control was activated and verified.",
        toolCalls: [],
        assistantMessage: { role: "assistant", content: "done" },
      });
    const agent = new LiveWorldAgent({
      bridgeUrl: "http://127.0.0.1:11434",
      modelId: "qwen3:8b",
      tools: [tool],
      transport,
      observe: vi.fn(async () => world(++observation, observation < 3 ? "Continue" : "Completed")),
    });
    const result = await agent.run(
      "Advance the current dialog, even if it moves while you are working.",
    );
    expect(result.status).toBe("completed");
    expect(tool.execute).toHaveBeenCalledTimes(2);
    expect(result.world.screen.graph?.visibleText).toContain("Completed");
    const replanningInput = (transport.mock.calls[1][2] as Array<{ content: string }>).at(
      -1,
    )?.content;
    expect(replanningInput).toMatch(/state_changed|old target was not clicked|nextSafeRoute/);
  });

  it("blocks a successful mutation that lacks independent verification", async () => {
    const tool: LiveWorldTool = {
      name: "file.organize",
      description: "Organize files semantically.",
      parameters: { type: "object", properties: {} },
      permission: "files.write",
      mutating: true,
      execute: vi.fn(async () => ({
        status: "success" as const,
        evidence: "Move command returned.",
      })),
    };
    const transport = vi
      .fn()
      .mockResolvedValueOnce(turn("file.organize", {}))
      .mockResolvedValueOnce({
        ok: true,
        content: "Done.",
        toolCalls: [],
        assistantMessage: { role: "assistant", content: "Done." },
      });
    const agent = new LiveWorldAgent({
      bridgeUrl: "http://127.0.0.1:11434",
      modelId: "qwen3:8b",
      tools: [tool],
      transport,
      observe: vi.fn(async () => world(1, "Files")),
    });
    const result = await agent.run("Group the loose drafts by project.");
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/verified outcome/i);
    expect(result.mission.completedFacts).toHaveLength(0);
    expect((transport.mock.calls[1][2] as Array<{ content: string }>).at(-1)?.content).toMatch(
      /Independent verification is missing/,
    );
  });
});
