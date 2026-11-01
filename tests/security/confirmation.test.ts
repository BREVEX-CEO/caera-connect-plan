/** Confirmation must bind every argument, and opaque interactions fail closed on effects. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { intent, OPERATIONS } from "../../src/lib/jarvis/contracts.ts";
import { exactEffect } from "../../src/lib/jarvis/authority.server.ts";

const deadline = new Date(Date.now() + 60_000);
const nonce = crypto.randomUUID();
const window = { exe: nonce + ".exe", pid: 123, hwnd: 456, started: Date.now() };
const element = { name: nonce, controlType: "Button" };
const page = { id: nonce, site: nonce + ".example" };
const protocol = JSON.parse(
  readFileSync(
    new URL("../../device-agent/windows/ocade_agent/protocol.json", import.meta.url),
    "utf8",
  ),
);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

test("confirmation includes the complete validated effect, even beyond the old display limit", async (t) => {
  const command = "x".repeat(4000 - nonce.length - 2) + "\n#" + nonce;
  const actions = [
    intent("shell.run", "command", { command }, deadline),
    intent(
      "fs.replace_text",
      "rewrite",
      {
        path: nonce + ".txt",
        text: "x".repeat(50_000 - nonce.length) + nonce,
        expectSha256: "a".repeat(64),
      },
      deadline,
    ),
    intent(
      "fs.edit_text",
      "edit",
      {
        path: nonce + ".txt",
        expectSha256: "b".repeat(64),
        edits: [
          { find: "x".repeat(10_000), replace: "y".repeat(10_000) },
          { find: nonce, replace: "z".repeat(10_000 - nonce.length) + nonce },
        ],
      },
      deadline,
    ),
  ];
  for (const action of actions) {
    await t.test(action.operation, () => {
      const expected = action.operation + " " + JSON.stringify(action.arguments, null, 2);
      const shown = exactEffect(action);
      assert.equal(shown.length, expected.length, "the approval must show every character");
      assert.equal(
        sha(shown),
        sha(expected),
        "the approved effect must be byte-identical to the validated arguments",
      );
    });
  }
});

test("native and page interactions cannot declare their unknown effects reversible", async (t) => {
  const actions = [
    intent("apps.launch", "launch", { exe: window.exe }, deadline),
    intent("ui.invoke", "invoke", { window, element }, deadline),
    intent("ui.set_value", "value", { window, element, value: nonce }, deadline),
    intent("ui.send_keys", "keys", { window, element, keys: nonce }, deadline),
    intent("ui.click_point", "point", { window, x: 0.5, y: 0.5, expectTitle: nonce }, deadline),
    intent("web.fill", "fill", { page, selector: "#" + nonce, value: nonce }, deadline),
    intent("web.select", "select", { page, selector: "#" + nonce, option: nonce }, deadline),
    intent(
      "web.download",
      "download",
      { page, selector: "#" + nonce, output: "OCADE output/" + nonce + ".bin" },
      deadline,
    ),
  ];
  for (const action of actions) {
    await t.test(action.operation, () => {
      assert.equal(
        action.risk,
        "external_effect",
        "an opaque app/page handler can commit a real external change",
      );
      assert.equal(OPERATIONS[action.operation].risk, "external_effect");
      assert.equal(
        protocol.operations[action.operation].risk,
        "external_effect",
        "the actual bundled worker must enforce the same registry",
      );
    });
  }
  await t.test("observations and new output files retain their existing authority", () => {
    assert.equal(intent("fs.read_text", "read", { path: nonce + ".txt" }, deadline).risk, "read");
    assert.equal(intent("web.read", "webread", { page }, deadline).risk, "read");
    assert.equal(
      intent(
        "fs.write_text",
        "write",
        { path: "OCADE output/" + nonce + ".txt", text: nonce },
        deadline,
      ).risk,
      "reversible_write",
    );
  });
});
