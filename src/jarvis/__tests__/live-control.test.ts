import { describe, expect, it, vi } from "vitest";
import { runJarvisTurn, Stopped, type AgentDeps, type AgentHooks } from "../agent";
import type { JarvisTaskRow } from "../jarvis.functions";
import { LiveControl, statusReply, workIntent } from "../live-control";

const TASK: JarvisTaskRow = {
  id: "t1",
  conversation_id: "c1",
  device_id: "d1",
  title: "Format the report",
  plan: ["Open the file", "Apply headings", "Save"],
  current_step: 1,
  status: "running",
  blocker: null,
  result: null,
  browser_mode: "isolated",
  checkpoint: { step: 1, lastAction: "Opened report.docx", lastUrl: null, at: "" },
  created_at: "",
  updated_at: "",
};

describe("what the person says while JARVIS works", () => {
  it.each([
    ["stop", "stop"],
    ["OCADE stop", "stop"],
    ["Cancel the task.", "stop"],
    ["wait", "pause"],
    ["hold on", "pause"],
    ["Wait a second", "pause"],
    ["continue", "continue"],
    ["go ahead", "continue"],
    ["OCADE what are you doing?", "status"],
    ["What's happening", "status"],
    ["are you done yet", "status"],
    ["use the other file", "redirect"],
    ["stop using bold, use italics", "redirect"],
    ["wait, use the other file", "redirect"],
  ])("%s -> %s", (said, intent) => {
    expect(workIntent(said)).toBe(intent);
  });

  it("answers what it is doing from the task's real state", () => {
    const reply = statusReply(TASK, false, "Applied Heading 1");
    expect(reply).toContain("Format the report");
    expect(reply).toContain("step 2 of 3: Apply headings");
    expect(reply).toContain("Applied Heading 1");
    expect(statusReply(TASK, true)).toContain("paused");
    expect(statusReply(null, false)).toContain("Nothing is running");
  });
});

describe("the pause gate", () => {
  it("holds until continue, and a Stop releases it at once", async () => {
    const live = new LiveControl();
    live.pause();
    let released = false;
    const signal = new AbortController();
    const waiting = live.waitIfPaused(signal.signal).then(() => (released = true));
    await Promise.resolve();
    expect(released).toBe(false);
    live.resume();
    await waiting;
    expect(released).toBe(true);

    live.pause();
    const stopping = live.waitIfPaused(signal.signal);
    signal.abort();
    await stopping;
  });
});

function deps(
  steps: {
    text: string;
    toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[];
  }[],
) {
  const seen: string[][] = [];
  const d: AgentDeps = {
    model: vi.fn(async ({ messages }) => {
      seen.push(messages.map((m: { content: unknown }) => String(m.content)));
      return steps.shift() ?? { text: "done", toolCalls: [] };
    }),
    startTask: vi.fn(async () => ({
      ok: true as const,
      task: { ...TASK, current_step: 0 },
      device: { name: "PC", platform: "Windows", can: ["files"] },
    })),
    updateTask: vi.fn(async (input) => ({ ...TASK, status: input.status ?? "running" })),
    readTaskStatus: vi.fn(async () => "running" as const),
    queue: vi.fn(async () => ({ ok: true as const, id: "a1" })),
    readAction: vi.fn(async () => ({
      status: "done",
      summary: "ok",
      result: {},
      taskStatus: "running" as const,
    })),
    decide: vi.fn(async () => ({})),
    frame: vi.fn(async () => null),
    remember: vi.fn(async () => ({ ok: true })),
    sleep: async () => undefined,
  };
  return { d, seen };
}

const call = (name: string, args: Record<string, unknown> = {}) => ({
  id: name,
  name,
  arguments: args,
});

describe("a turn hears the person between steps", () => {
  it("feeds a redirect to the planner as the person's words, and keeps working", async () => {
    const live = new LiveControl();
    const { d, seen } = deps([
      { text: "", toolCalls: [call("start_task", { title: "Report", steps: ["open"] })] },
      { text: "", toolCalls: [call("computer", { action: "file_list", path: "." })] },
      { text: "Switching to the other file.", toolCalls: [] },
    ]);
    vi.mocked(d.queue).mockImplementationOnce(async () => {
      live.tell("use the other file");
      return { ok: true as const, id: "a1" };
    });
    const hooks: AgentHooks = {
      signal: new AbortController().signal,
      onText: vi.fn(),
      onTask: vi.fn(),
      onActivity: vi.fn(),
      confirm: vi.fn(async () => true),
      takeOver: vi.fn(async () => "resume" as const),
      live,
    };
    await runJarvisTurn(
      {
        conversationId: "c1",
        history: [],
        text: "format it",
        memories: [],
        memoryEnabled: false,
        task: null,
      },
      hooks,
      d,
    );
    const third = seen[2]!.join("\n");
    expect(third).toContain('While you were working, the person said: ["use the other file"]');
  });

  it("sends nothing to the computer while paused, then continues", async () => {
    const live = new LiveControl();
    live.pause();
    const { d } = deps([
      { text: "", toolCalls: [call("start_task", { title: "Report", steps: ["open"] })] },
      { text: "", toolCalls: [call("computer", { action: "file_list", path: "." })] },
    ]);
    const controller = new AbortController();
    const hooks: AgentHooks = {
      signal: controller.signal,
      onText: vi.fn(),
      onTask: vi.fn(),
      onActivity: vi.fn(),
      confirm: vi.fn(async () => true),
      takeOver: vi.fn(async () => "resume" as const),
      live,
    };
    const turn = runJarvisTurn(
      {
        conversationId: "c1",
        history: [],
        text: "go",
        memories: [],
        memoryEnabled: false,
        task: null,
      },
      hooks,
      d,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(d.model).not.toHaveBeenCalled();
    expect(d.queue).not.toHaveBeenCalled();
    live.resume();
    await turn;
    expect(d.queue).toHaveBeenCalledTimes(1);
  });

  it("a Stop while paused ends the turn", async () => {
    const live = new LiveControl();
    live.pause();
    const { d } = deps([]);
    const controller = new AbortController();
    const turn = runJarvisTurn(
      {
        conversationId: "c1",
        history: [],
        text: "go",
        memories: [],
        memoryEnabled: false,
        task: null,
      },
      {
        signal: controller.signal,
        onText: vi.fn(),
        onTask: vi.fn(),
        onActivity: vi.fn(),
        confirm: vi.fn(async () => true),
        takeOver: vi.fn(async () => "resume" as const),
        live,
      },
      d,
    );
    controller.abort();
    await expect(turn).rejects.toBeInstanceOf(Stopped);
  });
});
