import { describe, expect, it } from "vitest";
import {
  alwaysAllowRule,
  createPermissionContext,
  decide,
  noteApproved,
  noteDenied,
  subjectOf,
  type PermissionContext,
} from "../permissions";
import { findTool, type ToolDefinition } from "@/lib/agent/tool-registry";

const readTool: ToolDefinition = {
  name: "screen_observe",
  domain: "os_app",
  description: "",
  parameters: { type: "object", properties: {} },
  mutating: false,
  risk: "read",
};

const editTool: ToolDefinition = {
  name: "file_write",
  domain: "files",
  description: "",
  parameters: { type: "object", properties: {} },
  mutating: true,
  risk: "medium",
};

const shellTool: ToolDefinition = {
  name: "Bash",
  domain: "os_app",
  description: "",
  parameters: { type: "object", properties: {} },
  mutating: true,
  risk: "medium",
};

const dangerTool: ToolDefinition = {
  name: "message_send",
  domain: "conversation",
  description: "",
  parameters: { type: "object", properties: {} },
  mutating: true,
  risk: "high",
};

const call = (name: string, args: Record<string, unknown> = {}) => ({ name, arguments: args });

describe("reading is free", () => {
  it("allows a non-mutating tool in the guarded default", () => {
    const decision = decide(call("screen_observe"), readTool, createPermissionContext());
    expect(decision.outcome).toBe("allow");
  });

  it("still allows reading while a plan is under review", () => {
    const decision = decide(call("screen_observe"), readTool, createPermissionContext("plan"));
    expect(decision.outcome).toBe("allow");
  });
});

describe("plan mode", () => {
  it("stops anything that would change the machine", () => {
    const decision = decide(
      call("file_write", { path: "/tmp/a" }),
      editTool,
      createPermissionContext("plan"),
    );
    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toMatch(/reviewing the plan/);
  });
});

describe("rules", () => {
  const ctx = (rules: PermissionContext["rules"], mode: PermissionContext["mode"] = "guarded") =>
    createPermissionContext(mode, rules);

  it("a deny rule beats trusted mode", () => {
    const decision = decide(
      call("Bash", { command: "git push --force" }),
      shellTool,
      ctx([{ rule: "Bash(git push --force)", behavior: "deny" }], "trusted"),
    );
    expect(decision.outcome).toBe("deny");
  });

  it("an allow rule matches a prefix pattern", () => {
    const decision = decide(
      call("Bash", { command: "npm run build" }),
      shellTool,
      ctx([{ rule: "Bash(npm run:*)", behavior: "allow" }]),
    );
    expect(decision.outcome).toBe("allow");
    expect(decision.matchedRule).toBe("Bash(npm run:*)");
  });

  it("a prefix rule does not match a different command that starts with the same letters", () => {
    const decision = decide(
      call("Bash", { command: "npm runaway" }),
      shellTool,
      ctx([{ rule: "Bash(npm run:*)", behavior: "allow" }]),
    );
    expect(decision.outcome).toBe("ask");
  });

  it("an allow rule matches a wildcard pattern", () => {
    const decision = decide(
      call("file_write", { path: "/home/u/Documents/notes.md" }),
      editTool,
      ctx([{ rule: "file_write(/home/u/Documents/*)", behavior: "allow" }]),
    );
    expect(decision.outcome).toBe("allow");
  });

  it("an ask rule overrides an automatic allow", () => {
    const decision = decide(
      call("file_write", { path: "/etc/hosts" }),
      editTool,
      ctx([{ rule: "file_write(/etc/*)", behavior: "ask" }], "trusted"),
    );
    expect(decision.outcome).toBe("ask");
  });

  it("a tool-wide rule matches a call with no readable subject", () => {
    const decision = decide(
      call("file_write", { contents: 1 }),
      editTool,
      ctx([{ rule: "file_write", behavior: "allow" }]),
    );
    expect(decision.outcome).toBe("allow");
  });

  it("a content rule never matches a call with no readable subject", () => {
    const decision = decide(
      call("file_write", { contents: 1 }),
      editTool,
      ctx([{ rule: "file_write(/tmp/*)", behavior: "allow" }]),
    );
    expect(decision.outcome).toBe("ask");
  });
});

describe("risk", () => {
  it("asks about an irreversible action even in trusted mode", () => {
    const decision = decide(
      call("message_send", { name: "Sam" }),
      dangerTool,
      createPermissionContext("trusted"),
    );
    expect(decision.outcome).toBe("ask");
  });

  it("asks about a destructive command and says what it would do", () => {
    const decision = decide(
      call("Bash", { command: "git reset --hard" }),
      shellTool,
      createPermissionContext("trusted"),
    );
    expect(decision.outcome).toBe("ask");
    expect(decision.warning).toMatch(/discard/i);
  });

  it("lets an ordinary command through in trusted mode", () => {
    const decision = decide(
      call("Bash", { command: "git status" }),
      shellTool,
      createPermissionContext("trusted"),
    );
    expect(decision.outcome).toBe("allow");
  });
});

describe("acceptEdits", () => {
  it("lets a document edit through", () => {
    const decision = decide(
      call("file_write", { path: "/tmp/a" }),
      editTool,
      createPermissionContext("acceptEdits"),
    );
    expect(decision.outcome).toBe("allow");
  });

  it("does not extend to controlling the machine", () => {
    const decision = decide(
      call("Bash", { command: "open -a Safari" }),
      shellTool,
      createPermissionContext("acceptEdits"),
    );
    expect(decision.outcome).toBe("ask");
  });
});

describe("denial tracking", () => {
  it("re-enables prompting in trusted mode after repeated refusals", () => {
    let ctx = createPermissionContext("trusted");
    expect(decide(call("Bash", { command: "ls" }), shellTool, ctx).outcome).toBe("allow");
    for (let i = 0; i < 10; i++) ctx = noteDenied(ctx);
    expect(decide(call("Bash", { command: "ls" }), shellTool, ctx).outcome).toBe("ask");
    ctx = noteApproved(ctx);
    expect(decide(call("Bash", { command: "ls" }), shellTool, ctx).outcome).toBe("allow");
  });
});

describe("unknown tools", () => {
  it("refuses a call to a tool that does not exist", () => {
    const decision = decide(call("delete_everything"), null, createPermissionContext("trusted"));
    expect(decision.outcome).toBe("deny");
  });
});

describe("always-allow scoping", () => {
  it("scopes to the subject, not the whole tool", () => {
    expect(alwaysAllowRule(call("Bash", { command: "git status" }))).toBe("Bash(git status)");
  });

  it("falls back to the tool when there is no subject", () => {
    expect(alwaysAllowRule(call("window_list"))).toBe("window_list");
  });

  it("escapes parentheses so the round trip survives", () => {
    expect(alwaysAllowRule(call("Bash", { command: 'python -c "print(1)"' }))).toBe(
      'Bash(python -c "print\\(1\\)")',
    );
  });
});

describe("against the real registry", () => {
  it("guards every mutating tool the registry declares", () => {
    const ctx = createPermissionContext("guarded");
    for (const name of ["file_delete", "type_text", "app_open"]) {
      const tool = findTool(name);
      if (!tool || !tool.mutating) continue;
      expect(decide(call(name, {}), tool, ctx).outcome).not.toBe("allow");
    }
  });

  it("reads the subject out of a real registry call shape", () => {
    expect(subjectOf(call("app_open", { name: "Notepad" }))).toBe("Notepad");
  });
});
