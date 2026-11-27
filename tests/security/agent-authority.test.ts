/** AGENTS-02: agents have no messaging authority of their own; every step is one of the closed set of task operations. */
import assert from "node:assert/strict";
import test from "node:test";
import { OPERATIONS } from "../../src/lib/jarvis/contracts.ts";

test("the capabilities an agent can hold are a closed set with no messaging or account capability", () => {
  const capabilities = [
    ...new Set(Object.values(OPERATIONS).map((spec) => spec.capability)),
  ].sort();
  assert.deepEqual(capabilities, ["apps", "browser", "computer_control", "files", "mcp", "screen"]);
});

test("no operation sends a message, email or chat on the person's behalf by name", () => {
  const names = Object.keys(OPERATIONS).filter((name) =>
    /mail|message|sms|chat|slack|whatsapp|telegram|dm\b/i.test(name),
  );
  assert.deepEqual(names, []);
});

test("anything that leaves the computer is an external effect the person must confirm", () => {
  const external = Object.entries(OPERATIONS)
    .filter(([, spec]) => spec.risk === "external_effect")
    .map(([name]) => name);
  for (const required of ["web.upload", "mcp.external", "shell.run", "system.install_dependency"]) {
    assert.ok(external.includes(required), `${required} is not an external effect`);
  }
});
