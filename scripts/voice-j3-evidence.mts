/**
 * J3 evidence: background noise must not silently corrupt a transcript, and an
 * unavailable capture device must fail clearly rather than hang.
 *
 * THE DANGEROUS FAILURE IS NOT SILENCE — IT IS FLUENCY
 * ---------------------------------------------------
 * Under noise this recogniser does not go quiet or return an error. It returns
 * a different, perfectly well-formed sentence. Measured on one utterance:
 *
 *   clean   "The quick brown fox jumps over the lazy dog"   confidence 0.649
 *   noisy   "All five F"                                    confidence 0.173
 *
 * A caller that reads only `text` cannot tell those apart, which is precisely
 * how noise silently corrupts a transcript. So this proves the INDICATION: the
 * noisy result must carry an explicit low-confidence warning, and the clean one
 * must not — a host that warned on everything would be equally useless.
 *
 * The noise is real. Broadband noise is summed into the actual samples and the
 * resulting signal-to-noise ratio is computed from the two waveforms, rather
 * than a corruption flag being set somewhere.
 *
 * ON THE MICROPHONE-DISCONNECTION HALF, PLAINLY
 * ---------------------------------------------
 * No microphone was physically unplugged. What is exercised is the same code
 * path a disconnection lands in — the capture device cannot be opened — by
 * requesting a format this array genuinely refuses. That proves the failure is
 * immediate and carries a specific message rather than blocking forever, which
 * is the behaviour the requirement is about. It does not prove hot-unplug
 * handling mid-capture, and is not offered as proof of it.
 *
 * Usage: npx vite-node scripts/voice-j3-evidence.mts -- [--write]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalizeTranscript } from "../src/lib/ocade-voice.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_J3_NOISE_AND_DEVICE_LOSS.json";
const HOST = "scripts/voice/voice-host.ps1";

const ps = (a: string[]): Record<string, unknown> => {
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", HOST, ...a], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse((out.trim().split("\n").filter(Boolean).pop() ?? "{}").replace(/^﻿/, ""));
};

const SENTENCE = "The quick brown fox jumps over the lazy dog";
const cleanWav = join(tmpdir(), "ocade-j3-clean.wav");
let failed = false;

// Render the reference utterance.
execFileSync("powershell", [
  "-NoProfile",
  "-Command",
  `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `$s.SetOutputToWaveFile('${cleanWav}'); $s.Speak(${JSON.stringify(SENTENCE)}); $s.Dispose()`,
]);

// ---- 1. clean baseline
const clean = ps(["-Mode", "stt", "-Path", cleanWav]);
const cleanText = String(clean.text ?? "");
const cleanCorrect = normalizeTranscript(cleanText) === normalizeTranscript(SENTENCE);
const cleanWarned = clean.lowConfidence === true;
if (!cleanCorrect || cleanWarned) failed = true;

// ---- 2. the same utterance under real noise, at several levels
const levels = [-24, -18, -12];
const noisy = levels.map((db) => {
  const noisyWav = join(tmpdir(), `ocade-j3-noisy${Math.abs(db)}.wav`);
  const mix = ps(["-Mode", "mix-noise", "-Path", cleanWav, "-NoisePath", noisyWav, "-NoiseDb", String(db)]);
  const stt = ps(["-Mode", "stt", "-Path", noisyWav]);
  const text = String(stt.text ?? "");
  return {
    noiseDb: db,
    measuredSnrDb: mix.measuredSnrDb,
    transcript: text,
    minConfidence: stt.minConfidence,
    lowConfidenceWarning: stt.lowConfidence === true,
    warning: stt.warning,
    transcriptCorrect: normalizeTranscript(text) === normalizeTranscript(SENTENCE),
  };
});

/*
 * The test is not "noise breaks it" — noise breaking speech recognition is
 * expected. The test is that every case where the transcript came out WRONG
 * also carried a warning. A wrong transcript delivered silently is the defect.
 */
const corrupted = noisy.filter((n) => !n.transcriptCorrect);
const everyCorruptionAnnounced = corrupted.every((n) => n.lowConfidenceWarning);
const atLeastOneCorruption = corrupted.length > 0;
if (!everyCorruptionAnnounced || !atLeastOneCorruption) failed = true;

// ---- 3. capture device unavailable: clear error, no hang
const unavailable = ps(["-Mode", "capture-unavailable"]);
const failedFast = unavailable.failedFast === true && unavailable.surfacedClearError === true;
if (!failedFast) failed = true;

const doc = {
  schemaVersion: 1,
  item: "J3 - noise does not silently corrupt transcription; unavailable capture device fails clearly",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  clean: {
    spoken: SENTENCE,
    transcript: cleanText,
    minConfidence: clean.minConfidence,
    correct: cleanCorrect,
    warned: cleanWarned,
    note: "The clean case must NOT warn. A host that flagged every transcript would satisfy the noise requirement and be useless.",
  },
  noise: {
    levels: noisy,
    corruptedCount: corrupted.length,
    everyCorruptionCarriedAWarning: everyCorruptionAnnounced,
    note:
      "Broadband noise is summed into the real samples and the SNR is computed from the two waveforms. Noise degrading recognition is expected; the requirement is that a degraded transcript is never handed back as though it were what was said. Under noise this recogniser returns fluent, wrong sentences rather than errors, which is why the confidence floor is surfaced as an explicit warning.",
  },
  deviceUnavailable: {
    elapsedMs: unavailable.elapsedMs,
    surfacedClearError: unavailable.surfacedClearError,
    failedFast,
    error: unavailable.error,
    scopeNote:
      "No microphone was physically unplugged. This exercises the same failure path — the capture device cannot be opened — and shows it returns a specific message immediately instead of blocking. Hot-unplug mid-capture is NOT proven here and would need someone to pull the device during a run.",
  },
};

console.log(`clean : ${JSON.stringify(cleanText)} conf=${clean.minConfidence} correct=${cleanCorrect} warned=${cleanWarned}`);
for (const n of noisy) {
  console.log(
    `noise ${String(n.noiseDb).padStart(4)}dB (SNR ${n.measuredSnrDb}dB): ${JSON.stringify(n.transcript)} conf=${n.minConfidence} correct=${n.transcriptCorrect} WARNED=${n.lowConfidenceWarning}`,
  );
}
console.log(`every corrupted transcript announced itself: ${everyCorruptionAnnounced}`);
console.log(`device unavailable: ${unavailable.elapsedMs}ms, clear error=${unavailable.surfacedClearError}, no hang=${failedFast}`);
console.log(`J3: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
