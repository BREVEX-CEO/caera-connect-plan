import assert from "node:assert/strict";
import { test } from "node:test";
import { appOnAnotherComputer } from "../../src/lib/jarvis/device-match.ts";

const pc = { id: "pc", name: "Office PC", installed_apps: [{ exe: "excel.exe" }] };
const mac = {
  id: "mac",
  name: "MacBook",
  installed_apps: [{ exe: "Final Cut Pro.app" }, { exe: "excel.exe" }],
};

test("a Mac-only app named while the Windows computer is chosen points to the Mac", () => {
  const mac2 = { id: "mac", name: "MacBook", installed_apps: [{ exe: "keynote.app" }] };
  assert.deepEqual(appOnAnotherComputer("Make slides in @Keynote.app.", pc, [pc, mac2]), {
    app: "keynote.app",
    computers: [{ id: "mac", name: "MacBook" }],
  });
});

test("an app the chosen computer has, or that no computer has, says nothing", () => {
  assert.equal(appOnAnotherComputer("Use @excel.exe", pc, [pc, mac]), null);
  assert.equal(appOnAnotherComputer("Use @nothing.exe", pc, [pc, mac]), null);
  assert.equal(appOnAnotherComputer("mail me@example.com", pc, [pc, mac]), null);
  assert.equal(appOnAnotherComputer("Use @excel.exe", null, [pc, mac]), null);
});
