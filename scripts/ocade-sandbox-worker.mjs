import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import vm from "node:vm";

const request = JSON.parse(await readFile(process.argv[2], "utf8"));
const logs = [];

function scoped(root, relative) {
  if (typeof relative !== "string" || !relative.trim() || relative.includes("\0")) {
    throw new Error("Sandbox path is invalid.");
  }
  const normalized = normalize(relative.replaceAll("\\", "/"));
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || normalized.startsWith(sep)) {
    throw new Error("Sandbox path escapes its scope.");
  }
  const target = join(root, normalized);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Sandbox path escapes its scope.");
  }
  return target;
}

const allowedOutputs = new Set(request.outputPaths);
const sandbox = Object.freeze({
  async readText(path) {
    return readFile(scoped(request.inputsRoot, path), "utf8");
  },
  async writeText(path, content) {
    if (!allowedOutputs.has(path)) throw new Error(`Output ${path} was not declared.`);
    if (typeof content !== "string") throw new Error("Sandbox outputs must be text.");
    const target = scoped(request.outputsRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  },
  log(value) {
    logs.push(String(value).slice(0, 10_000));
  },
  sleep(milliseconds) {
    const bounded = Math.max(0, Math.min(Number(milliseconds) || 0, 120_000));
    return new Promise((resolve) => setTimeout(resolve, bounded));
  },
});

const context = vm.createContext(
  { sandbox },
  {
    name: "ocade-generated-code",
    codeGeneration: { strings: false, wasm: false },
  },
);

try {
  const compiled = new vm.Script(`(async () => {\n"use strict";\n${request.script}\n})()`, {
    filename: "generated.mjs",
  });
  await compiled.runInContext(context);
  process.stdout.write(JSON.stringify({ ok: true, logs }));
} catch (error) {
  /**
   * An Error thrown INSIDE the vm context comes from that context's own realm,
   * so it is not `instanceof` this module's Error. Testing only for `instanceof`
   * therefore discards the message of every failure the generated script itself
   * raises — which is most of them — and reports the useless generic text.
   * Read `.message` structurally so a real failure stays diagnosable.
   *
   * The host redacts declared sensitive values out of stderr before this reaches
   * a receipt, so surfacing the message here does not widen exposure.
   */
  const message =
    typeof error === "object" && error !== null && typeof error.message === "string"
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "Generated script failed.";
  process.stderr.write(message);
  process.exitCode = 1;
}
