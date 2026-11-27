/** MCP-03, EFFECT-03: an external tool's risk maps to an operation of that exact risk; external effects need confirmation. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OPERATIONS } from "../../src/lib/jarvis/contracts.ts";

test("each tool risk routes to an operation of the same risk, and the external one is an external effect", () => {
  const source = readFileSync("src/lib/jarvis/planner.server.ts", "utf8");
  const table = /const MCP_OPERATION[^{]*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  const pairs = [...table.matchAll(/(\w+):\s*"([\w.]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
  assert.deepEqual(
    pairs.map(([risk]) => risk).sort(),
    ["external_effect", "read", "reversible_write"],
    "every tool risk has a route and none is missing",
  );
  for (const [risk, operation] of pairs) {
    assert.equal(
      (OPERATIONS as Record<string, { risk: string }>)[operation]?.risk,
      risk,
      operation,
    );
  }
});

test("only a read-risk tool call is exempt from the person's confirmation", () => {
  const risks = Object.entries(OPERATIONS).filter(([name]) => name.startsWith("mcp."));
  assert.deepEqual(risks.map(([name, spec]) => [name, spec.risk]).sort(), [
    ["mcp.external", "external_effect"],
    ["mcp.read", "read"],
    ["mcp.write", "reversible_write"],
  ]);
});

test("the planner takes an external tool's risk from the approved manifest, never from the model's call", () => {
  const source = readFileSync("src/lib/jarvis/planner.server.ts", "utf8");
  assert.match(source, /MCP_OPERATION\[chosen\.tool\.risk\]/);
  assert.doesNotMatch(source, /MCP_OPERATION\[call\.args/);
});
