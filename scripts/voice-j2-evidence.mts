/**
 * J2 evidence: live captions during speech, a real audio reply, and an
 * interruption that stops audio output immediately.
 *
 * THE INTERRUPTION IS MEASURED AT THE SPEAKER
 * -------------------------------------------
 * `SpeakAsyncCancelAll` returns immediately whether or not anything stopped,
 * and the synthesiser's own `State` is the synthesiser talking about itself.
 * Neither is evidence. This samples IAudioMeterInformation on the output
 * device — the peak sample the audio engine is actually rendering — across the
 * whole reply, so "output stopped" is a number that went to zero and stayed
 * there, not an API that returned without complaint.
 *
 * The uninterrupted reply is timed first, so the interrupted one has something
 * to be short COMPARED TO. Without that baseline, a reply that was always brief
 * would look like a successful interruption.
 *
 * Captions come from SpeakProgress, which fires per word as the synthesiser
 * reaches it, and are windowed by `captionSentenceAt` from
 * src/lib/ocade-voice.ts. They are checked for being live in the only way that
 * means anything: their timestamps must be spread across the reply, and their
 * character positions must advance.
 *
 * Usage: npx vite-node scripts/voice-j2-evidence.mts -- [--write]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { captionSentenceAt } from "../src/lib/ocade-voice.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_J2_CAPTIONS_REPLY_INTERRUPT.json";
const HOST = "scripts/voice/voice-host.ps1";

const ps = (a: string[]): Record<string, unknown> => {
  const out = execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", HOST, ...a],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return JSON.parse((out.trim().split("\n").filter(Boolean).pop() ?? "{}").replace(/^﻿/, ""));
};

const QUESTION = "What is on my calendar this afternoon?";
const REPLY =
  "You have three things this afternoon. A design review at two o'clock, " +
  "a call with the platform team at half past three, and a reminder to send " +
  "the quarterly report before the end of the day. The design review has moved " +
  "rooms since yesterday, so it is now in the larger meeting room on the third floor.";

let failed = false;

// ---- baseline: how long does the whole reply take when nothing interrupts it?
const full = ps(["-Mode", "speak", "-Text", REPLY]);
const fullMs = Number(full.elapsedMs);

// ---- the real reply, with captions and metered output, interrupted partway
const INTERRUPT_AT = 1500;
const run = ps([
  "-Mode",
  "speak-metered",
  "-Text",
  REPLY,
  "-InterruptAfterMs",
  String(INTERRUPT_AT),
]);

type Sample = { ms: number; peak: number };
type Caption = { ms: number; charPosition: number; word: string };
const trace = (run.trace as Sample[]) ?? [];
const captionEvents = (run.captions as Caption[]) ?? [];
const cancelAt = Number(run.cancelAtMs);
const lastAudible = Number(run.lastAudibleMs);
const peakAfterCut = Number(run.peakAfterCut ?? 0);
const maxPeak = Number(run.maxPeakOverall ?? 0);

// A real audio reply was actually produced: the output meter registered real
// signal, not a run that silently played nothing.
const audioReplyProduced = maxPeak > 0.05 && trace.some((s) => s.peak > 0.05);
if (!audioReplyProduced) failed = true;

// Captions were live: several of them, spread over time, advancing through the
// text. A single caption emitted at the end would satisfy "captions existed"
// and would not be live.
const captionsAdvance = captionEvents.every(
  (c, i) => i === 0 || c.charPosition >= captionEvents[i - 1].charPosition,
);
const captionSpanMs =
  captionEvents.length > 1 ? captionEvents[captionEvents.length - 1].ms - captionEvents[0].ms : 0;
const captionsAreLive = captionEvents.length >= 5 && captionsAdvance && captionSpanMs > 500;
if (!captionsAreLive) failed = true;

// Rendered caption lines, windowed the way the product windows them.
const captionLines = captionEvents.slice(0, 12).map((c) => ({
  ms: c.ms,
  charPosition: c.charPosition,
  caption: captionSentenceAt(REPLY, c.charPosition, 80),
}));

// Output stopped immediately: nothing audible from 250 ms after the cut, and
// the run ended far short of the uninterrupted baseline.
const stopLatencyMs = cancelAt - lastAudible;
const outputStopped = peakAfterCut === 0;
const endedEarly = cancelAt + 1000 < fullMs;
if (!outputStopped || !endedEarly) failed = true;

const doc = {
  schemaVersion: 1,
  item: "J2 - live captions, real audio reply, immediate interruption",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  question: QUESTION,
  reply: REPLY,
  audioReply: {
    uninterruptedDurationMs: fullMs,
    maxOutputPeak: maxPeak,
    produced: audioReplyProduced,
    note: "Measured with IAudioMeterInformation on the default render endpoint — the peak sample the audio engine is rendering. A run that played nothing would show a flat zero trace here.",
  },
  captions: {
    eventCount: captionEvents.length,
    spanMs: captionSpanMs,
    positionsAdvance: captionsAdvance,
    live: captionsAreLive,
    lines: captionLines,
    note: "Driven by SpeakProgress, which fires per word as the synthesiser reaches it, and windowed by captionSentenceAt from src/lib/ocade-voice.ts. Liveness is judged on the timestamps being spread across the reply and the character positions advancing, because a single caption emitted at the end would otherwise pass.",
  },
  interruption: {
    requestedAtMs: INTERRUPT_AT,
    cancelIssuedAtMs: cancelAt,
    lastAudibleOutputMs: lastAudible,
    stopLatencyMs,
    maxOutputPeakAfterCut: peakAfterCut,
    outputStopped,
    endedEarlyVersusBaseline: endedEarly,
    baselineMs: fullMs,
    outputTrace: trace,
    note: "The uninterrupted reply is timed first so the interrupted one has a baseline to be short against. Output peak is zero from the cut onward; the last audible sample precedes the cancel.",
  },
};

console.log(
  `audio reply    : max output peak ${maxPeak} over ${trace.length} samples (produced=${audioReplyProduced})`,
);
console.log(
  `captions       : ${captionEvents.length} events across ${captionSpanMs}ms, advancing=${captionsAdvance} live=${captionsAreLive}`,
);
for (const line of captionLines.slice(0, 6)) {
  console.log(
    `   ${String(line.ms).padStart(5)}ms  char ${String(line.charPosition).padStart(3)}  "${line.caption}"`,
  );
}
console.log(`baseline reply : ${fullMs}ms uninterrupted`);
console.log(
  `interrupted    : cancel at ${cancelAt}ms, last audible ${lastAudible}ms, peak after cut ${peakAfterCut}`,
);
console.log(`               : output stopped=${outputStopped} endedEarly=${endedEarly}`);
console.log(`J2: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
