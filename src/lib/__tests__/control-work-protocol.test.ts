import { describe, expect, it } from "vitest";
import {
  ACT_NOW_NUDGE,
  announcesAnotherStep,
  firstJsonObject,
  parseModelReply,
  toolInstructions,
} from "@/lib/work/tool-protocol";
import { judgeLocalDemoAccess, isHostedDeployment } from "@/lib/agent/control-access.node";
import { approvalQuestion, describeTool } from "@/lib/work/use-mission";
import { findTool, toolsFor } from "@/lib/agent/tool-registry";

/**
 * The two things standing between a language model and somebody's computer.
 *
 * FIRST, THE PROTOCOL. The demo's engine has no function-calling channel, so a
 * tool call arrives as text and has to be read out of prose that a small model
 * wrote. Every case here is one that actually happened on a live run or is one
 * keystroke away from it: a fenced block, a nested argument object, an invented
 * tool name, a narrated step with no JSON at all.
 *
 * SECOND, THE DOOR. `judgeLocalDemoAccess` is the entire reason an
 * unauthenticated demo may drive a real machine. Every branch is asserted,
 * including the ones that only matter when somebody is attacking it.
 */

describe("reading a tool call out of a model's prose", () => {
  const known = ["screen_observe", "app_open", "workspace_write"];

  it("takes a bare object", () => {
    const parsed = parseModelReply('{"tool":"screen_observe","arguments":{}}', known);
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].name).toBe("screen_observe");
  });

  it("takes an object wrapped in prose and a code fence", () => {
    const reply = [
      "Let me look at the screen first.",
      "```json",
      '{"tool": "screen_observe", "arguments": {"includeText": "yes"}}',
      "```",
    ].join("\n");
    const parsed = parseModelReply(reply, known);
    expect(parsed.toolCalls[0].arguments).toEqual({ includeText: "yes" });
    // The sentence the user already saw is kept.
    expect(parsed.text).toContain("Let me look at the screen");
  });

  it("keeps nested arguments intact", () => {
    // The reason `firstJsonObject` walks the string instead of using a regex:
    // a lazy match stops at the inner brace and a greedy one swallows the prose.
    const reply = '{"tool":"workspace_write","arguments":{"name":"a.txt","content":"{x: 1}"}}';
    const parsed = parseModelReply(reply, known);
    expect(parsed.toolCalls[0].arguments).toEqual({ name: "a.txt", content: "{x: 1}" });
  });

  it("accepts the OpenAI-shaped synonyms", () => {
    const parsed = parseModelReply('{"name":"app_open","args":{"name":"Notepad"}}', known);
    expect(parsed.toolCalls[0].name).toBe("app_open");
    expect(parsed.toolCalls[0].arguments).toEqual({ name: "Notepad" });
  });

  it("strips a thinking block before looking", () => {
    const reply = '<think>{"tool":"app_open"}</think>All done, nothing needed.';
    expect(parseModelReply(reply, known).toolCalls).toHaveLength(0);
  });

  it("refuses a tool name that does not exist", () => {
    // An invented name is not passed down to be discovered later.
    const parsed = parseModelReply(
      '{"tool":"shell_execute","arguments":{"cmd":"rm -rf /"}}',
      known,
    );
    expect(parsed.toolCalls).toHaveLength(0);
  });

  it("treats unparseable output as an ordinary answer", () => {
    const parsed = parseModelReply("There are four windows open at the moment.", known);
    expect(parsed.toolCalls).toHaveLength(0);
    expect(parsed.text).toContain("four windows");
  });

  it("finds the first balanced object and ignores braces inside strings", () => {
    expect(firstJsonObject('prefix {"a":"}"} suffix')).toBe('{"a":"}"}');
    expect(firstJsonObject("no object here")).toBeNull();
  });
});

describe("noticing that the model narrated instead of acting", () => {
  it("catches the sentence that ended a live task one step early", () => {
    // Measured, not invented: this is verbatim from a real run in which
    // Notepad had been opened and the typing step never happened.
    expect(
      announcesAnotherStep(
        'I have opened Notepad and confirmed that it is now running. Now, I will type "Hello from OCADE" into Notepad.',
      ),
    ).toBe(true);
  });

  it("catches the gerund, which the first version missed", () => {
    expect(
      announcesAnotherStep("Next, I will try typing the text into the first editable control."),
    ).toBe(true);
  });

  it("leaves a finished report alone", () => {
    expect(announcesAnotherStep("I opened Notepad and typed the text. It is on screen now.")).toBe(
      false,
    );
    expect(announcesAnotherStep("The capital of Iceland is Reykjavík.")).toBe(false);
    expect(announcesAnotherStep("")).toBe(false);
  });

  it("has a correction that asks for the action and nothing else", () => {
    expect(ACT_NOW_NUDGE).toMatch(/only the json/i);
  });
});

describe("the tool vocabulary given to a text-only engine", () => {
  it("lists every loaded tool with its arguments", () => {
    const tools = toolsFor(["os_app"]);
    const instructions = toolInstructions(tools);
    for (const tool of tools) expect(instructions).toContain(tool.name);
    expect(instructions).toMatch(/one JSON object/i);
    // The rule that matters most is present in the prompt, not only in the host.
    expect(instructions).toMatch(/passwords, one-time codes or payment details/i);
  });

  it("says nothing at all when no tools are loaded", () => {
    expect(toolInstructions([])).toBe("");
  });
});

describe("who may drive this computer without an account", () => {
  const headers = (values: Record<string, string>) => ({
    headers: { get: (name: string) => values[name.toLowerCase()] ?? null },
  });

  it("allows the person sitting at the machine", () => {
    const verdict = judgeLocalDemoAccess(headers({ host: "localhost:5173" }), {});
    expect(verdict.ok).toBe(true);
  });

  it("allows the whole loopback block, not just 127.0.0.1", () => {
    expect(judgeLocalDemoAccess(headers({ host: "127.9.9.9:5173" }), {}).ok).toBe(true);
    expect(judgeLocalDemoAccess(headers({ host: "[::1]:5173" }), {}).ok).toBe(true);
  });

  it("refuses a hostname that merely begins with localhost", () => {
    // `Host: localhost.evil.example` must not read as local.
    const verdict = judgeLocalDemoAccess(headers({ host: "localhost.evil.example" }), {});
    expect(verdict.ok).toBe(false);
  });

  it("refuses a request from another website to a loopback server", () => {
    // The attack this rule exists for: any page on the internet quietly
    // operating the visitor's computer.
    const verdict = judgeLocalDemoAccess(
      headers({ host: "127.0.0.1:5173", origin: "https://evil.example" }),
      {},
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/another website/i);
  });

  it("allows a loopback origin", () => {
    expect(
      judgeLocalDemoAccess(headers({ host: "localhost:5173", origin: "http://localhost:5173" }), {})
        .ok,
    ).toBe(true);
  });

  it("refuses on a hosted deployment whatever the headers claim", () => {
    // A reverse proxy can present `Host: localhost` all day.
    const verdict = judgeLocalDemoAccess(headers({ host: "localhost:5173" }), {
      OCADE_HOSTED: "1",
    });
    expect(verdict.ok).toBe(false);
    expect(isHostedDeployment({ OCADE_HOSTED: "1" })).toBe(true);
    expect(isHostedDeployment({})).toBe(false);
  });

  it("refuses a remote host", () => {
    expect(judgeLocalDemoAccess(headers({ host: "ocade.example.com" }), {}).ok).toBe(false);
  });

  it("refuses when there is no request to judge", () => {
    expect(judgeLocalDemoAccess(null, {}).ok).toBe(false);
  });
});

describe("what the user is actually asked", () => {
  it("asks about the thing, never about the tool", () => {
    const open = findTool("app_open");
    const type = findTool("type_text");
    const discard = findTool("workspace_discard");
    expect(open && type && discard).toBeTruthy();

    expect(approvalQuestion({ name: "app_open", arguments: { name: "Notepad" } }, open!)).toBe(
      "Open Notepad?",
    );
    expect(
      approvalQuestion({ name: "type_text", arguments: { text: "Hello from OCADE" } }, type!),
    ).toBe("Type “Hello from OCADE”?");
    expect(
      approvalQuestion({ name: "workspace_discard", arguments: { name: "notes.txt" } }, discard!),
    ).toBe("Move notes.txt to the recycle bin?");

    // No tool identifier ever reaches the sentence.
    for (const name of ["app_open", "type_text", "workspace_discard"]) {
      const tool = findTool(name)!;
      expect(approvalQuestion({ name, arguments: {} }, tool)).not.toContain("_");
    }
  });

  it("has a plain-English name for every tool that can run", () => {
    for (const tool of toolsFor(["os_app", "files", "web"])) {
      const spoken = describeTool(tool.name);
      expect(spoken).not.toContain("_");
      expect(spoken).not.toBe("Working");
    }
  });
});

describe("the risk bands that decide when a person is asked", () => {
  it("keeps observation free of prompts", () => {
    for (const name of ["screen_observe", "window_list", "browser_read", "browser_scroll"]) {
      expect(findTool(name)?.risk).toBe("read");
    }
  });

  it("puts anything that changes the machine above read", () => {
    for (const name of ["app_open", "type_text", "press_key", "control_set_text"]) {
      const tool = findTool(name);
      expect(tool?.mutating).toBe(true);
      expect(["low", "medium", "high"]).toContain(tool?.risk);
    }
  });

  it("keeps the one irreversible-ish action in the high band", () => {
    // The recycle bin is the undo, and it is still the only `high` file action.
    expect(findTool("workspace_discard")?.risk).toBe("high");
    expect(findTool("file_trash")?.risk).toBe("high");
  });
});
