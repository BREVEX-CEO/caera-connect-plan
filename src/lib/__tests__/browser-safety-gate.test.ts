import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

const scratch = mkdtempSync(join(tmpdir(), "ocade-browser-safety-"));
const gate = resolve("scripts/check-browser-safety.mjs");

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function runGate(root: string) {
  return spawnSync(process.execPath, [gate, `--root=${root}`], {
    encoding: "utf8",
    shell: false,
  });
}

describe("browser-safety source gate", () => {
  it("rejects static and dynamic Node built-ins in browser modules", () => {
    const root = join(scratch, "unsafe");
    mkdirSync(root);
    writeFileSync(
      join(root, "browser.ts"),
      'import { execFile } from "node:child_process";\nimport { secret } from "./secret.server";\nexport const later = () => import("node:fs/promises");\nvoid execFile; void secret;\n',
    );

    const result = runGate(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Node import node:child_process");
    expect(result.stdout).toContain("Node import node:fs/promises");
    expect(result.stdout).toContain("Server-only import ./secret.server");
  });

  it("allows the explicit extracted server-function boundary", () => {
    const root = join(scratch, "server-boundary");
    mkdirSync(root);
    writeFileSync(
      join(root, "identity.functions.ts"),
      'import { createHash } from "node:crypto";\nexport const hash = createHash;\n',
    );

    const result = runGate(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No Node-only globals reachable from the browser.");
  });
});
