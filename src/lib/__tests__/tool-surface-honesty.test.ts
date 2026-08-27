/**
 * Every tool OCADE advertises has to be a tool OCADE can run.
 *
 * FOUND LIVE: seven of the thirty-six registered tools — the six `file_*` ones
 * and `browser_type` — had no arm in `dispatch()` at all. They were described
 * to the model, chosen by it, and answered with "not connected on this device
 * yet" every single time.
 *
 * That is worse than a missing tool. A planner routes around a capability it
 * was never offered; it cannot route around one that claims to exist. It picks
 * the tool, fails, re-reads the same registry, picks it again, and spends the
 * step budget without touching a file. Nineteen per cent of the surface was
 * doing that.
 *
 * The registry is the contract. This test is the thing that keeps the contract
 * from drifting away from the implementation again, in the only direction that
 * is invisible until a real task hits it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { allToolNames, findTool, toolsFor } from "../agent/tool-registry";
import { TASK_TOOL_NAMES } from "../tasks/task-tools";

const ADAPTERS = fileURLToPath(new URL("../agent/adapters.node.ts", import.meta.url));
const EXECUTOR = fileURLToPath(new URL("../runtime/execute.ts", import.meta.url));

/**
 * Tools the executor answers locally, before it routes anywhere.
 *
 * These are OCADE's own task state, which lives in the tab rather than on the
 * companion — so the companion's dispatch switch is the wrong place to look for
 * them. They are excused from that check and held to this one instead: the
 * executor must genuinely route them, which is asserted below.
 */
const LOCALLY_EXECUTED = new Set<string>(TASK_TOOL_NAMES);

/** Every `case "x":` label in the adapter's dispatch switch. */
function dispatchedToolNames(): Set<string> {
  const source = readFileSync(ADAPTERS, "utf8");
  const start = source.indexOf("private async dispatch(");
  expect(start, "dispatch() should exist in adapters.node.ts").toBeGreaterThan(-1);

  // Stop at the fall-through arm; anything after it belongs to other methods.
  const end = source.indexOf("default:", start);
  expect(end, "dispatch() should have a default arm").toBeGreaterThan(start);

  const names = new Set<string>();
  for (const match of source.slice(start, end).matchAll(/case\s+"([a-z0-9_]+)":/g)) {
    names.add(match[1]);
  }
  return names;
}

describe("the advertised tool surface", () => {
  it("dispatches every tool it registers", () => {
    const dispatched = dispatchedToolNames();
    const undispatched = allToolNames().filter(
      (name) => !dispatched.has(name) && !LOCALLY_EXECUTED.has(name),
    );

    expect(
      undispatched,
      "These are advertised to the model but fall through to 'not connected'. " +
        "Implement them or take them out of the registry — do not leave them advertised.",
    ).toEqual([]);
  });

  it("routes the locally executed tools before anything else", () => {
    const source = readFileSync(EXECUTOR, "utf8");
    /*
     * The excuse above is only honest if the executor really does handle them.
     * The check is deliberately structural: the local branch must come BEFORE
     * the extension hand-off, because a task tool that reaches the extension is
     * a task tool that answers "not connected".
     */
    const local = source.indexOf("isTaskTool(");
    const extension = source.indexOf("runBrowserToolViaExtension(call)");
    expect(local, "execute.ts should route task tools locally").toBeGreaterThan(-1);
    expect(local).toBeLessThan(extension);
    for (const name of LOCALLY_EXECUTED) {
      expect(findTool(name), `${name} should be registered`).not.toBeNull();
    }
  });

  it("registers every tool it dispatches", () => {
    const registered = new Set(allToolNames());
    const orphans = [...dispatchedToolNames()].filter((name) => !registered.has(name));

    expect(orphans, "These have an implementation the model is never told about.").toEqual([]);
  });

  it("has not quietly shrunk the surface to make the first two pass", () => {
    // Deleting tools is a legitimate fix for a dead one, and also the easiest
    // way to make this file green while removing capability. The floor makes
    // that a deliberate act with a number attached rather than a side effect.
    //
    // Raised from 36 when the continuity layer, the rest of the system
    // controls, the vision tools and the code reviewer were connected. All of
    // those existed in the engine already and were reachable by nothing.
    expect(allToolNames().length).toBeGreaterThanOrEqual(80);
  });

  it("gives every tool a name in the registry exactly once", () => {
    const names = allToolNames();
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    // `toolsFor` de-duplicates when domains overlap, so a name registered twice
    // is invisible until the two copies disagree about risk — at which point
    // which one wins depends on domain ordering.
    expect(duplicates, "a tool is registered under two domains").toEqual([]);
  });
});

/*
 * THE OTHER HALF OF THE CONTRACT, AND THE HALF THAT WAS ACTUALLY BROKEN.
 *
 * The test above proves a registered tool reaches `dispatch`. It says nothing
 * about whether the ENGINE answers to the command that dispatch then sends —
 * and that is the join where the continuity layer was severed: eleven finished,
 * tested bridge handlers with no tool pointing at them, and no test that could
 * notice, because each side was internally consistent.
 */
describe("the continuity layer reaches the engine", () => {
  const BRIDGE = fileURLToPath(
    new URL("../../../native/ocade_control_engine/ocade_bridge.py", import.meta.url),
  );

  /** Every key in the bridge's HANDLERS table. */
  function bridgeCommands(): Set<string> {
    const source = readFileSync(BRIDGE, "utf8");
    const start = source.indexOf("HANDLERS: dict[str, Callable");
    expect(start, "HANDLERS should exist in ocade_bridge.py").toBeGreaterThan(-1);
    const end = source.indexOf("\n}", start);
    const names = new Set<string>();
    for (const match of source.slice(start, end).matchAll(/^\s+"([a-z0-9_.]+)":/gm)) {
      names.add(match[1]);
    }
    return names;
  }

  /** Every engine command string the adapters send. */
  function adapterCommands(): Set<string> {
    const source = readFileSync(ADAPTERS, "utf8");
    const names = new Set<string>();
    // `viaEngine("x", …)` and the `simple("x", …)` passthrough, plus the
    // continuity name map, all quote the command as a dotted literal.
    for (const match of source.matchAll(
      /(?:viaEngine(?:<[^>]*>)?|this\.simple)\(\s*"([a-z]+\.[a-z.]+)"/g,
    )) {
      names.add(match[1]);
    }
    for (const match of source.matchAll(/^\s+[a-z_]+:\s+"([a-z]+\.[a-z.]+)",$/gm)) {
      names.add(match[1]);
    }
    return names;
  }

  it("sends no engine command the bridge does not answer to", () => {
    const known = bridgeCommands();
    const unknown = [...adapterCommands()].filter((command) => !known.has(command));
    expect(
      unknown,
      "The adapters send these to the engine and it has no handler for them. " +
        "Every one would come back as 'Unknown command' after a full process round trip.",
    ).toEqual([]);
  });

  const CONTINUITY = [
    "memory_remember",
    "memory_recall",
    "memory_forget",
    "memory_project",
    "memory_identity",
    "memory_snapshot",
    "session_summarise",
    "morning_briefing",
    "proactive_check",
    "topic_watch",
    "topic_check",
    "language_note",
  ] as const;

  it.each(CONTINUITY)("%s is registered, dispatched, and in the conversation domain", (name) => {
    const tool = findTool(name);
    expect(tool, `${name} is missing from the registry`).not.toBeNull();
    expect(tool?.domain).toBe("conversation");
    expect(dispatchedToolNames().has(name), `${name} has no dispatch arm`).toBe(true);
  });

  it("keeps the conversation domain non-empty", () => {
    // It was empty, and an empty domain loads no schemas — so a request
    // classified as `conversation` reached a model with nothing to call and
    // answered "I'll remember that" without remembering anything.
    expect(toolsFor(["conversation"]).length).toBeGreaterThanOrEqual(12);
  });

  it("prices the irreversible and the outward-facing above the rest", () => {
    // Opening a port on the user's network and shutting their computer down are
    // the two things here a person has to agree to. Everything else in the new
    // surface affects only this machine and can be looked at afterwards.
    expect(findTool("phone_dashboard")?.risk).toBe("high");
    expect(findTool("system_power")?.risk).toBe("high");
    for (const name of CONTINUITY) {
      expect(findTool(name)?.risk, `${name} should not need a permission prompt`).not.toBe("high");
    }
  });
});

describe("the file tools", () => {
  const FILE_TOOLS = [
    "file_search",
    "file_read",
    "file_copy",
    "file_move",
    "file_trash",
    "file_restore",
  ] as const;

  it.each(FILE_TOOLS)("%s is registered and dispatched", (name) => {
    expect(findTool(name), `${name} is missing from the registry`).not.toBeNull();
    expect(dispatchedToolNames().has(name), `${name} has no dispatch arm`).toBe(true);
  });

  it.each(FILE_TOOLS.filter((name) => name !== "file_restore"))(
    "%s names the closed folder set rather than saying 'approved'",
    (name) => {
      // The engine takes a folder NAME out of six, never a path. A description
      // that says "an approved folder" invites the model to invent one and
      // spend a step being refused.
      const folder = findTool(name)?.parameters.properties.folder;
      expect(folder?.description ?? "").toMatch(/desktop, downloads, documents/);
    },
  );

  it("keeps trashing reversible and priced as the riskiest thing here", () => {
    expect(findTool("file_trash")?.risk).toBe("high");
    expect(findTool("file_restore")?.risk).toBe("low");
    // Restore takes the id trash handed back — not a folder. Asking for both
    // would let a caller restore into a folder the file never came from.
    expect(findTool("file_restore")?.parameters.required).toEqual(["id"]);
  });

  it("does not offer a tool that permanently deletes", () => {
    const destructive = toolsFor(["files"]).filter((tool) =>
      /delete|remove|erase|purge|shred/i.test(`${tool.name} ${tool.description}`),
    );
    const claimsPermanence = destructive.filter(
      (tool) => !/cannot permanently delete|reversible/i.test(tool.description),
    );
    expect(claimsPermanence.map((tool) => tool.name)).toEqual([]);
  });
});

describe("browser_type", () => {
  it("is registered and dispatched", () => {
    expect(findTool("browser_type")).not.toBeNull();
    expect(dispatchedToolNames().has("browser_type")).toBe(true);
  });

  it("is a mutation, and priced with the other page mutations", () => {
    const tool = findTool("browser_type");
    expect(tool?.mutating).toBe(true);
    expect(tool?.risk).toBe(findTool("browser_click")?.risk);
  });
});
