/**
 * Writes the companion's copy of the JARVIS protocol from the one TypeScript
 * contract, or with `--check` fails when the checked-in copy has drifted.
 * Run: node --experimental-strip-types scripts/jarvis-protocol.ts [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { protocolSchema } from "../src/lib/jarvis/contracts.ts";

const target = "device-agent/windows/ocade_agent/protocol.json";
const text = `${JSON.stringify(protocolSchema(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== text) {
    console.error(`${target} is out of date. Run: npm run jarvis:protocol`);
    process.exit(1);
  }
  console.log(`${target} matches the contract.`);
} else {
  writeFileSync(target, text);
  console.log(`wrote ${target}`);
}
