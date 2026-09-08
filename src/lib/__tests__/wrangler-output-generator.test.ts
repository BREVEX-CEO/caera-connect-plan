import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const scratchRoots: string[] = [];
const generator = resolve("scripts/generate-wrangler-output.mjs");

afterEach(() => {
  for (const path of scratchRoots.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture(source: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), "ocade-wrangler-output-"));
  scratchRoots.push(root);
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, ".output", "server"), { recursive: true });
  cpSync(generator, join(root, "scripts", "generate-wrangler-output.mjs"));
  writeFileSync(join(root, ".output", "server", "index.mjs"), "export default {};\n");
  writeFileSync(join(root, "wrangler.json"), JSON.stringify(source));
  return root;
}

function run(root: string) {
  return spawnSync(process.execPath, [join(root, "scripts", "generate-wrangler-output.mjs")], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
}

describe("generated Wrangler configuration", () => {
  it("preserves security controls and adds only build-owned paths", () => {
    const root = fixture({
      $schema: "ignored-editor-schema.json",
      name: "ocade-web",
      assets: { run_worker_first: true, html_handling: "none" },
    });

    const result = run(root);
    const output = JSON.parse(
      readFileSync(join(root, ".output", "server", "wrangler.json"), "utf8"),
    );

    expect(result.status).toBe(0);
    expect(output).toMatchObject({
      name: "ocade-web",
      main: "index.mjs",
      no_bundle: true,
      assets: {
        run_worker_first: true,
        html_handling: "none",
        binding: "ASSETS",
        directory: "../public",
      },
    });
    expect(output.$schema).toBeUndefined();
  });

  it("refuses source configuration that competes with build-owned paths", () => {
    const root = fixture({
      name: "ocade-web",
      assets: { run_worker_first: true, directory: "wrong" },
    });

    const result = run(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not hard-code generated asset binding or directory");
  });
});
