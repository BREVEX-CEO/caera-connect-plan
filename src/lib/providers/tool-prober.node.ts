/**
 * Node/companion implementation of the application probe runner.
 *
 * Keep this in a `.node.ts` module. `tool-prober.ts` is imported by the web
 * application, and even a lazy `import("node:child_process")` in that module
 * makes Vite resolve a Node built-in while constructing the browser graph.
 */
import { execFile } from "node:child_process";

import type { ProbeRunner } from "./free-tool-adapters";

export function createNodeProbeRunner(): ProbeRunner {
  return (command, args) =>
    new Promise((resolve) => {
      execFile(command, [...args], { timeout: 5_000, windowsHide: true }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: stdout ?? "", stderr: stderr ?? "" });
      });
    });
}
