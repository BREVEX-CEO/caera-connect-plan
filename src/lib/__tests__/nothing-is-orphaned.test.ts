import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Capability that exists but cannot be reached is the most expensive kind.
 *
 * WHY THIS GATE EXISTS.
 * ----------------------
 * A hand audit of this repository found four finished subsystems wired to
 * nothing, and a scripted sweep then found eleven more engine commands with no
 * caller anywhere. Every one of them was written, reviewed, tested and then
 * quietly unreachable — "say stop" had a Whisper model and a stop-word list
 * behind it and could never fire, because the one function that starts the
 * listener had zero callers.
 *
 * None of that is visible in a passing test suite. Orphaned code passes its own
 * unit tests perfectly; what fails is the product, silently, in a way only a
 * person driving the app notices. So it is checked mechanically here.
 *
 * WHAT COUNTS AS REACHABLE, AND WHY THE PHONE MATTERS.
 * -----------------------------------------------------
 * The engine is reachable from two places, not one:
 *
 *   - Node, via `viaEngine("<command>")` in `adapters.node.ts`
 *   - the PHONE, via `core/remote.py`'s own allow-list, which dispatches
 *     straight into the bridge without passing through Node at all
 *
 * An earlier version of this check knew only about Node and reported the
 * phone's entire vocabulary as dead. That was wrong, and it is the reason the
 * allow-list is parsed here rather than assumed away.
 */

const ROOT = process.cwd();

const BRIDGE = readFileSync(join(ROOT, "native/ocade_control_engine/ocade_bridge.py"), "utf8");
const REMOTE = readFileSync(join(ROOT, "native/ocade_control_engine/core/remote.py"), "utf8");
const REGISTRY = readFileSync(join(ROOT, "src/lib/agent/tool-registry.ts"), "utf8");
const ADAPTERS = readFileSync(join(ROOT, "src/lib/agent/adapters.node.ts"), "utf8");

/** Every .ts/.tsx under src/, excluding tests. */
function sourceText(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__" && entry !== "node_modules") walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        parts.push(readFileSync(full, "utf8"));
      }
    }
  };
  walk(join(ROOT, "src"));
  return parts.join("\n");
}

const SRC = sourceText();

/** Command keys registered in the bridge's HANDLERS table. */
function bridgeCommands(): string[] {
  const table = BRIDGE.slice(BRIDGE.indexOf("HANDLERS"));
  return [...new Set([...table.matchAll(/"([a-z][\w]*\.[\w.]+)":\s*\w+,/g)].map((m) => m[1]))];
}

/** Commands the phone is allowed to dispatch, from REMOTE_COMMANDS. */
function phoneCommands(): Set<string> {
  const start = REMOTE.indexOf("REMOTE_COMMANDS");
  const block = REMOTE.slice(start, start + 2500);
  const allowed = new Set([...block.matchAll(/"([\w.]+)",/g)].map((m) => m[1]));
  // Dispatched explicitly rather than through the frozen set.
  allowed.add("remote.ask");
  return allowed;
}

/**
 * Commands reached only from inside the engine, by another handler.
 *
 * `message.to` composes `message.resolve` and `message.contacts` in Python so
 * the split happens where the screen is visible; exposing them separately would
 * invite a caller to do the resolution without eyes, which is the bug that path
 * exists to prevent.
 */
const INTERNAL_ONLY = new Set([
  "message.resolve",
  "message.contacts",
  /*
   * `input.mouse` is DELIBERATELY not offered to the model, and that is a
   * safety decision rather than an oversight.
   *
   * It takes a raw x and y. The whole perception ladder exists so that a click
   * has provenance — `screen_click` accepts only a target object that
   * `screen_find` produced, so every coordinate can be traced to the rung that
   * found it, and a target the accessibility tree can already operate is
   * refused outright. Exposing a bare coordinate tool would let a model skip
   * all of that and click at a number it guessed, which is precisely the
   * failure the ladder was built to prevent.
   *
   * It stays registered because the engine's own pointer path uses it and it
   * validates that the point falls inside the target window before acting.
   */
  "input.mouse",
]);

describe("every engine command can be reached", () => {
  it("has no orphaned bridge handlers", () => {
    const phone = phoneCommands();
    const orphans = bridgeCommands().filter(
      (key) => !SRC.includes(`"${key}"`) && !phone.has(key) && !INTERNAL_ONLY.has(key),
    );
    expect(
      orphans,
      `these engine commands are registered but nothing can call them — wire them ` +
        `into tool-registry.ts + adapters.node.ts, add them to REMOTE_COMMANDS, or delete them:\n  ` +
        orphans.join("\n  "),
    ).toEqual([]);
  });
});

describe("every tool the model can see actually runs", () => {
  it("has an adapter case for every registered tool", () => {
    const names = [...REGISTRY.matchAll(/name:\s*"(\w+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(50);
    const missing = names.filter((name) => !ADAPTERS.includes(`case "${name}":`));
    expect(missing, `offered to the model but not implemented: ${missing.join(", ")}`).toEqual([]);
  });

  it("registers every tool exactly once", () => {
    // A duplicate definition silently shadows one of the two, and which one
    // wins depends on iteration order. Caught while wiring file_read, which
    // was already present and got a second, subtly different definition.
    const names = [...REGISTRY.matchAll(/name:\s*"(\w+)"/g)].map((m) => m[1]);
    const seen = new Map<string, number>();
    for (const n of names) seen.set(n, (seen.get(n) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n);
    expect(dupes, `defined more than once: ${dupes.join(", ")}`).toEqual([]);
  });
});
