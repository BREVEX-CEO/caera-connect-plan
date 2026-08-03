/**
 * P14 — voice and vision readiness, executed against THIS environment.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It does not drive fusePerceptionFrame or the Set-of-Mark planner with
 * hand-built frames and call the result runtime evidence. Those modules are
 * already unit tested, and feeding them constructed frames would prove exactly
 * what the unit tests prove while wearing a costume that says "runtime". A
 * synthetic frame is a digital twin, and a digital twin is not real capture.
 *
 * WHAT IT DOES INSTEAD
 * --------------------
 * Voice and vision cannot be truthfully verified here: there is no microphone,
 * no display capture path in the web app, and no signed companion. So the only
 * honest thing left to verify is the refusal — that OCADE, run against real
 * conditions, correctly declines to claim perception it does not have and names
 * precisely what is missing. A system that silently degrades to "ready" when its
 * providers are absent is far more dangerous than one that cannot see, so this
 * refusal is worth recording as evidence in its own right.
 *
 * Usage: npx vite-node scripts/voice-vision-readiness-evidence.mts
 */
import { writeFileSync } from "node:fs";
import { platform, arch } from "node:os";
import { perceptionRuntimeReadiness } from "../src/lib/control/perception.ts";
import { detectVoiceCapabilities } from "../src/lib/ocade-voice.ts";

type Status = "observed" | "skipped" | "failed";
type Step = { id: string; what: string; status: Status; detail: unknown };
const steps: Step[] = [];
function record(id: string, what: string, status: Status, detail: unknown) {
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "OK  " : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`  [${mark}] ${id}  ${what}`);
}

console.log("P14 voice/vision readiness, executed against this host\n");

// V01 — real conditions: no companion, no granted permissions, no providers.
const bare = perceptionRuntimeReadiness({ companionAvailable: false });
record(
  "V01",
  "perception refuses to report live readiness with no companion",
  bare.liveReady === false && bare.missing.length > 0 ? "observed" : "failed",
  { liveReady: bare.liveReady, missing: bare.missing, sourceReady: bare.sourceReady },
);

// V02 — source completeness must never be mistaken for runtime availability.
record(
  "V02",
  "sourceReady stays true while liveReady is false",
  bare.sourceReady === true && bare.liveReady === false ? "observed" : "failed",
  {
    note: "This separation is the whole point of the evidence ladder: the perception code exists and is complete, and it still cannot see anything on this machine.",
  },
);

// V03 — a partially-provisioned host is still refused, and says what is short.
const partial = perceptionRuntimeReadiness({
  companionAvailable: true,
  permissions: [{ id: "accessibility", state: "granted" }],
  providers: { ocr: true },
});
record(
  "V03",
  "a partially-provisioned host is refused and names what is missing",
  partial.liveReady === false && partial.missing.includes("screen-capture permission") ? "observed" : "failed",
  { liveReady: partial.liveReady, missing: partial.missing },
);

// V04 — voice capability detection against this actual runtime (Node: none).
const voice = detectVoiceCapabilities(globalThis as never);
record(
  "V04",
  "voice capability detection reports no speech engine on this runtime",
  voice.recognition === false && voice.synthesis === false && voice.wakePhrase === false
    ? "observed"
    : "failed",
  {
    synthesis: voice.synthesis,
    recognition: voice.recognition,
    wakePhrase: voice.wakePhrase,
    reason: voice.reason ?? null,
    wakeReason: voice.wakeReason ?? null,
    note: "Wake-phrase support additionally requires an engine advertising local processing, so it stays false even in browsers that do offer SpeechRecognition.",
  },
);

const observed = steps.filter((s) => s.status === "observed").length;
const failed = steps.filter((s) => s.status === "failed").length;

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase: "P14 - voice and vision",
  tier: "SOURCE COMPLETE + REFUSAL VERIFIED",
  explicitlyNotClaimed: [
    "Microphone capture. No audio input device is available and browser SpeechRecognition needs a real browser, a real microphone and a user permission gesture.",
    "Speech output. No audio output device was exercised.",
    "Screen capture. The web application contains no getDisplayMedia path at all; real capture is expected to arrive through the native companion, which has never been built or signed.",
    "Set-of-Mark over real pixels. The planner has only ever been driven with constructed frames, which is a digital twin and not evidence of seeing a real screen.",
  ],
  whatIsVerified:
    "That OCADE, executed against this host's real conditions, refuses to report live perception or listening capability and names exactly what is absent.",
  blockedBy: [
    { need: "signed native companion", blocker: "desktop-build-sign-update" },
    { need: "screen-capture and accessibility permissions on a real desktop session", blocker: "desktop-build-sign-update" },
    { need: "physical microphone and a real browser session for SpeechRecognition", blocker: "real-application-and-device-matrix" },
  ],
  host: { platform: platform(), arch: arch(), node: process.version },
  summary: { observed, failed, total: steps.length },
  steps,
};

writeFileSync("release/OCADE_P14_VOICE_VISION_READINESS_EVIDENCE.json", JSON.stringify(evidence, null, 2));
console.log(`\n${observed} observed, ${failed} failed of ${steps.length}.`);
console.log("Wrote release/OCADE_P14_VOICE_VISION_READINESS_EVIDENCE.json");
if (failed > 0) process.exitCode = 1;
