/**
 * Guard against fixed customer journeys in the JARVIS production control plane.
 * This is a focused static check; genuine autonomy still requires real unprepared tasks.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const core = [
  "src/lib/jarvis/authority.server.ts",
  "src/lib/jarvis/supervisor.ts",
  "src/lib/jarvis/planner.server.ts",
];
const banned = [
  /\bsupportedOutcome\s*\(/,
  /\bJOURNEY_1_CHECKS\b/,
  /\bpickSides\s*\(/,
  /\bdecide\s*\(\s*\{\s*taskId/,
];
const forbiddenImports = /(?:from\s+["'][^"']*(?:\/tests\/|\/evidence\/)|\bimport\s*\(["'][^"']*(?:\/tests\/|\/evidence\/))/;
const failures = [];
for (const path of core) {
  const source = readFileSync(path, "utf8");
  for (const pattern of banned) if (pattern.test(source)) failures.push(path + ": prohibited fixed journey " + pattern);
}
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { scan(path); continue; }
    if (!/\.(?:ts|tsx|py)$/.test(path)) continue;
    if (forbiddenImports.test(readFileSync(path, "utf8"))) failures.push(path + ": production imports a test/evidence file");
  }
}
for (const dir of ["src/lib/jarvis", "device-agent/windows/ocade_agent"]) scan(dir);
if (failures.length) {
  console.error("JARVIS autonomy guard FAILED:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("JARVIS autonomy guard PASS (focused static criteria).");
}
