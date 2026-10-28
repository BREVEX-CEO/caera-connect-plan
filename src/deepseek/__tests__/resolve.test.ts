import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { deepseekUpstream, lowerVendored } from "../resolve";

const UPSTREAM = fileURLToPath(
  new URL("../../../external/deepseek-harness/upstream", import.meta.url),
);
const SHIMS = fileURLToPath(new URL("../shims", import.meta.url));
const SOURCE = `import fs from "node:fs";
import { createRequire } from "node:module";
using resource = { [Symbol.dispose]() {} };
export { fs, createRequire, resource };`;

async function transformed(plugin: Plugin, id: string) {
  const hook = plugin.transform;
  if (typeof hook !== "function") throw new Error("Expected a transform hook");
  return hook.call({} as never, SOURCE, id);
}

function code(result: Awaited<ReturnType<typeof transformed>>) {
  if (!result || typeof result !== "object") throw new Error("Expected transformed source");
  return result.code;
}

describe("the pinned upstream source boundary", () => {
  it("lowers Vite's normalized source IDs and keeps server built-ins", async () => {
    const id = normalizePath(resolve(UPSTREAM, "packages/core/example.ts"));
    const output = code(await transformed(deepseekUpstream(), id));
    expect(output).not.toContain("using resource =");
    expect(output).toContain("__using");
    expect(output).toContain('from "node:fs"');
    expect(output).toContain(JSON.stringify(normalizePath(resolve(SHIMS, "module.ts"))));
  });

  it.skipIf(process.platform !== "win32")("also accepts native Windows source IDs", async () => {
    const id = resolve(UPSTREAM, "packages/core/example.ts");
    expect(id).not.toBe(normalizePath(id));
    expect(code(await transformed(deepseekUpstream(), id))).toContain("__using");
  });

  it("leaves a same-prefix sibling and non-TypeScript files alone", async () => {
    const plugin = deepseekUpstream();
    for (const id of [
      `${normalizePath(UPSTREAM)}-other/packages/example.ts`,
      normalizePath(resolve(UPSTREAM, "../outside.ts")),
      normalizePath(resolve(UPSTREAM, "packages/example.js")),
    ]) {
      expect(await transformed(plugin, id), id).toBeNull();
    }
  });

  it("uses forward-slash shim imports for the browser", async () => {
    const id = normalizePath(resolve(UPSTREAM, "packages/core/example.ts"));
    const output = code(await transformed(deepseekUpstream({ browser: true }), id));
    for (const shim of ["fs.ts", "module.ts"]) {
      expect(output).toContain(JSON.stringify(normalizePath(resolve(SHIMS, shim))));
    }
    expect(output).not.toContain('from "node:fs"');
  });

  it("the native upstream comparison lowers syntax without applying OCADE shims", async () => {
    const output = await lowerVendored(SOURCE, "example.ts", "none");
    expect(output.code).toContain('from "node:fs"');
    expect(output.code).toContain('from "node:module"');
    expect(output.code).not.toContain("using resource =");
  });
});
