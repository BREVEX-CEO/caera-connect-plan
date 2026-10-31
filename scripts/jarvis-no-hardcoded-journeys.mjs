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
const forbiddenImports =
  /(?:from\s+["'][^"']*(?:\/tests\/|\/evidence\/)|\bimport\s*\(["'][^"']*(?:\/tests\/|\/evidence\/))/;
const failures = [];
for (const path of core) {
  const source = readFileSync(path, "utf8");
  for (const pattern of banned)
    if (pattern.test(source)) failures.push(path + ": prohibited fixed journey " + pattern);
}
// Fixed assets or destinations: an absolute file path (other than an OS program-location
// default used to discover an engine) or a named third-party site or demo subject.
const fixedAsset = /["'](?:\/usr\/|\/opt\/|\/home\/|[A-Za-z]:\\\\Users)/;
const fixedSubject = /photopea|youtube\.com|supercar|car[ -]ad\b|nasa/i;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      scan(path);
      continue;
    }
    if (!/\.(?:ts|tsx|py)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    if (forbiddenImports.test(source))
      failures.push(path + ": production imports a test/evidence file");
    source.split("\n").forEach((line, index) => {
      const code = line.replace(/^\s*(?:#|\/\/|\*).*$/, "");
      if (fixedAsset.test(code) || fixedSubject.test(code))
        failures.push(`${path}:${index + 1}: fixed asset or subject`);
    });
  }
}
for (const dir of ["src/lib/jarvis", "device-agent/windows/ocade_agent"]) scan(dir);
if (failures.length) {
  console.error("JARVIS autonomy guard FAILED:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("JARVIS autonomy guard PASS (focused static criteria).");
}
