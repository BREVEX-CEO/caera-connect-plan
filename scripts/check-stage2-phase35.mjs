/**
 * Stage 2 Phase 35 — Voice and multimodal connectors.
 *
 * WHY THIS FILE EXISTS LATE. `package.json` carried a `stage2:phase35-check`
 * script, `.codex/OCADE_RUN_STATE.md` recorded Phase 35 as VERIFIED COMPLETE,
 * and `release/OCADE_STAGE_2_PHASE_35.json` declared VERIFIED_COMPLETE — but
 * the script the entry pointed at had never been written. The phase was marked
 * verified by a gate that did not exist, and `npm run stage2:phase35-check`
 * failed with MODULE_NOT_FOUND.
 *
 * So this gate checks the two things the claim actually rests on:
 *   1. the multimodal contracts exist AND refuse malformed/duplicate entries;
 *   2. the voice path that genuinely ships is real and redacts before speaking.
 *
 * It deliberately does NOT assert that voice works. No microphone, speaker or
 * recorded-audio runtime has been exercised here, and a gate that implied
 * otherwise would repeat the mistake it was written to correct.
 */

import { readFileSync, existsSync } from "node:fs";

let passed = 0;
let total = 0;
const failures = [];

function assert(condition, message) {
  total += 1;
  if (condition) {
    passed += 1;
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
  } else {
    failures.push(message);
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
  }
}

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");

console.log("Verifying Stage 2 Phase 35 (Voice and multimodal connectors)...\n");

// ---------------------------------------------------------------- contracts
const registry = read("src/lib/providers/multimodal-registry.ts");
assert(registry.length > 0, "Multimodal registry source exists");
assert(
  /export type VoiceProviderType = "system" \| "local" \| "licensed"/.test(registry),
  "Voice providers cover the system, local and licensed cases",
);
for (const contract of [
  "VoiceProvider",
  "VisionConnector",
  "MediaConnector",
  "HeadlessConnector",
]) {
  assert(
    new RegExp(`export interface ${contract}\\b`).test(registry),
    `${contract} contract is declared`,
  );
}

// ------------------------------------------------------- registration safety
assert(
  /already registered/.test(registry),
  "A duplicate id is refused rather than silently replacing a provider",
);
assert(
  /needs a non-empty id/.test(registry) && /is missing \$\{String\(method\)\}/.test(registry),
  "Malformed registrations are refused at registration, not at point of use",
);
assert(
  !/:\s*any\b/.test(registry),
  "The registry avoids `any`, so provider options must be narrowed by callers",
);

// ------------------------------------------------------- the shipped voice path
const voice = read("src/lib/ocade-voice.ts");
const redaction = read("src/lib/voice/transcript-redaction.ts");
assert(voice.length > 0, "The shipped voice module exists");
assert(redaction.length > 0, "Spoken-secret redaction exists");
assert(
  /export function redactSpokenSecrets/.test(redaction) &&
    /export function redactForSpeech/.test(redaction),
  "Redaction covers both what is transcribed and what is spoken aloud",
);

const route = read("src/routes/_authenticated/ocade.index.tsx");
assert(
  /redactSpokenSecrets\(/.test(route),
  "Dictation is redacted before a transcript reaches the composer",
);
assert(
  /redactForSpeech\(/.test(route),
  "Read-aloud is redacted before anything is spoken to the room",
);

// ------------------------------------------------------------------ honesty
const claim = existsSync("release/OCADE_STAGE_2_PHASE_35.json")
  ? JSON.parse(read("release/OCADE_STAGE_2_PHASE_35.json"))
  : null;
assert(claim !== null, "Phase 35 release record exists");
if (claim) {
  const blob = JSON.stringify(claim.evidence ?? {}).toLowerCase();
  assert(
    !/microphone|speaker|recorded audio|device|hardware/.test(blob),
    "The Phase 35 record claims no microphone, speaker or device evidence",
  );
}

/*
 * The registry is WIRED: the route registers the platform speech engine through
 * it, so it must not be listed as a non-runtime orphan.
 *
 * This used to read `release/OCADE_INTEGRATION_AUDIT.json` unconditionally.
 * That file has never existed in this repository and no script produces it, so
 * `read` returned "" and the gate died on `JSON.parse` with an
 * "Unexpected end of JSON input" stack — no [FAIL] line, no indication of which
 * artefact was missing, and every check after this point never ran.
 *
 * The property itself is not lost: the two assertions immediately below check
 * it DIRECTLY against the route's source, which is stronger evidence than a
 * generated summary of the same thing. The audit is consulted when it is
 * present and cannot take the gate down when it is not.
 */
if (existsSync("release/OCADE_INTEGRATION_AUDIT.json")) {
  let audit = null;
  try {
    audit = JSON.parse(read("release/OCADE_INTEGRATION_AUDIT.json"));
  } catch (error) {
    assert(false, `release/OCADE_INTEGRATION_AUDIT.json is not valid JSON: ${error.message}`);
  }
  if (audit) {
    assert(
      !(audit.nonRuntimeModules ?? []).some(
        (m) => m.path === "src/lib/providers/multimodal-registry.ts",
      ),
      "The multimodal registry is wired, so it is no longer declared a non-runtime orphan",
    );
  }
}
assert(
  /registerSystemVoice\(/.test(route) && /globalMultimodalRegistry/.test(route),
  "The voice surface registers the platform speech provider into the registry",
);
assert(
  /speakAloud\?:/.test(registry) &&
    /synthesize\?:/.test(registry) &&
    /transcribe\?:/.test(registry),
  "Voice capabilities are optional, so a browser engine needs no stubbed methods",
);
assert(
  /declares no capability/.test(registry),
  "A provider offering no capability at all is still refused",
);
assert(
  !/synthesize: async \(\) => \{\s*throw/.test(voice),
  "The system voice provider stubs no method it cannot honestly implement",
);

console.log(`\nResult: ${passed}/${total} assertions passed.`);
console.log("STATUS: CONTRACTS AND REDACTION VERIFIED BY SOURCE. NO AUDIO RUNTIME WAS EXERCISED.");
if (passed !== total) {
  console.error(`\nStage 2 Phase 35 gate failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
