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

const ADAPTERS = fileURLToPath(new URL("../agent/adapters.node.ts", import.meta.url));

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
    const undispatched = allToolNames().filter((name) => !dispatched.has(name));

    expect(
      undispatched,
      "These are advertised to the model but fall through to 'not connected'. " +
        "Implement them or take them out of the registry — do not leave them advertised.",
    ).toEqual([]);
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
    expect(allToolNames().length).toBeGreaterThanOrEqual(36);
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
