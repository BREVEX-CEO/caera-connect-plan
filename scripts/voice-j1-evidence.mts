/**
 * J1 evidence: microphone permission, real capture, real speech-to-text, and a
 * live wake-phrase test against a triggering and a non-triggering utterance.
 *
 * WHAT IS REAL HERE, AND WHAT IS NOT
 * ---------------------------------
 * Real: the microphone permission gate, five seconds captured from a real
 * capture device, the Windows desktop recogniser, and a wake-phrase decision
 * made from audio by a constrained grammar rather than from a string.
 *
 * Not real: a human voice. Nobody is speaking. The utterances are synthesised
 * and rendered to a waveform, and the recogniser is handed nothing but that
 * waveform. That proves the recognition and wake-phrase path on genuine audio;
 * it does not prove the acoustic path from a person's mouth.
 *
 * THE AIR GAP IS MEASURED, NOT ASSUMED
 * ------------------------------------
 * The obvious way to close that gap is to play the utterance through the
 * speakers and record it on the microphone. That was tried, and this machine's
 * microphone array cancels it. The measurement is kept in the evidence because
 * it is the reason for the gap:
 *
 *   ambient room, no playback   RMS -33.8 dBFS
 *   same room, speech playing   RMS -35.9 dBFS
 *
 * Adding a sound source to a room cannot LOWER the recorded level. Active echo
 * cancellation in the Intel Smart Sound array is removing the speaker signal —
 * which is correct behaviour for a laptop and fatal for self-testing. The same
 * sentence transcribes exactly from the waveform and as "There" through the air.
 * Both figures are re-measured on every run rather than quoted from here.
 *
 * A SECOND FINDING, KEPT BECAUSE IT CHANGED THE DESIGN
 * ---------------------------------------------------
 * Dictation transcribed "Hey OCADE" as "Payer good": the name is an invented
 * proper noun outside the recogniser's lexicon. Teaching `matchesWakePhrase`
 * that "payer good" means OCADE would have turned this run green and made the
 * product worse. Wake detection uses a constrained grammar instead — which is
 * how wake words are really detected — with a confidence floor, because a
 * grammar will otherwise report its closest phrase for any audio at all.
 *
 * Usage: npx vite-node scripts/voice-j1-evidence.mts -- [--write]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { matchesWakePhrase, normalizeTranscript, DEFAULT_WAKE_PHRASES } from "../src/lib/ocade-voice.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_J1_MIC_STT_WAKE.json";
const HOST = "scripts/voice/voice-host.ps1";

const ps = (a: string[]): Record<string, unknown> => {
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", HOST, ...a], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse((out.trim().split("\n").filter(Boolean).pop() ?? "{}").replace(/^﻿/, ""));
};

/** Render an utterance to a waveform with TTS, then transcribe that waveform. */
function sayAndTranscribe(text: string, tag: string) {
  const wav = join(tmpdir(), `ocade-j1-${tag}.wav`);
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.Speech; ` +
      `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
      `$s.SetOutputToWaveFile('${wav}'); $s.Speak(${JSON.stringify(text)}); $s.Dispose()`,
  ]);
  const stt = ps(["-Mode", "stt", "-Path", wav]);
  return { wav, spoken: text, result: stt };
}

let failed = false;

// ---- 1. permission is requested and checked BEFORE the device is opened
const permission = ps(["-Mode", "permission"]);
const devices = ps(["-Mode", "devices"]);
if (permission.granted !== true) failed = true;

// ---- 2. five real seconds from a real capture device
const capturePath = join(tmpdir(), "ocade-j1-capture.wav");
const capture = ps(["-Mode", "capture", "-Path", capturePath, "-Seconds", "5"]);
const audio = capture.audio as { durationSec: number; rms: number; rmsDbfs: number; peak: number; channels: number; sampleRate: number };
// A capture that came back as digital silence would be a failure dressed as a
// success, so the signal itself has to be non-trivial.
const capturedRealAudio = audio.durationSec >= 4.5 && audio.rms > 20 && audio.peak > 200;
if (!capturedRealAudio) failed = true;

// ---- 3. a real sentence, transcribed by the real recogniser
const SENTENCE = "The quick brown fox jumps over the lazy dog";
const sentence = sayAndTranscribe(SENTENCE, "sentence");
const heard = String((sentence.result as { text: string }).text ?? "");
const transcribedCorrectly = normalizeTranscript(heard) === normalizeTranscript(SENTENCE);
if (!transcribedCorrectly) failed = true;

// ---- 4. wake phrase, live, both directions
const triggering = sayAndTranscribe("Hey OCADE, what time is it", "wake-yes");
const nonTriggering = sayAndTranscribe("What time is it", "wake-no");
const triggerText = String((triggering.result as { text: string }).text ?? "");
const nonTriggerText = String((nonTriggering.result as { text: string }).text ?? "");

/*
 * Wake detection runs on a CONSTRAINED GRAMMAR, and the dictation result is
 * kept alongside it to show why.
 *
 * Dictation cannot hear "OCADE" — it is an invented proper noun outside the
 * recogniser's lexicon, and it came back as "Payer good". The wrong fix would
 * have been to add "payer good" to the tolerated mishearings in
 * matchesWakePhrase; the right one is to stop asking a dictation model for a
 * word it has never been taught. Both numbers are retained so the decision is
 * visible rather than asserted.
 */
const wakeYes = ps(["-Mode", "wake", "-Path", triggering.wav]);
const wakeNo = ps(["-Mode", "wake", "-Path", nonTriggering.wav]);
const triggered = wakeYes.triggered === true;
const notTriggered = wakeNo.triggered === true;
// Both directions matter. A detector that always says yes would pass the first.
const wakePhraseCorrect = triggered && !notTriggered;
if (!wakePhraseCorrect) failed = true;

// What the pure matcher makes of the dictation transcripts, for the record.
const dictationMatchYes = matchesWakePhrase(triggerText);
const dictationMatchNo = matchesWakePhrase(nonTriggerText);

// ---- 5. the measured air gap, retained as the reason it is a gap
const ambient = ps(["-Mode", "capture", "-Path", join(tmpdir(), "ocade-j1-ambient-ctl.wav"), "-Seconds", "4"]);
const overAir = ps([
  "-Mode", "speak-and-capture",
  "-Text", SENTENCE,
  "-Path", join(tmpdir(), "ocade-j1-overair.wav"),
]);
const ambientRms = (ambient.audio as { rmsDbfs: number }).rmsDbfs;
const overAirRms = (overAir.audio as { rmsDbfs: number }).rmsDbfs;
const echoCancellationDetected = overAirRms <= ambientRms;

const doc = {
  schemaVersion: 1,
  item: "J1 - microphone permission, real capture, real STT, live wake phrase",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  scopeNote:
    "No human voice is involved. Utterances are synthesised and rendered to a waveform, and the recogniser receives only that waveform — so speech recognition and wake-phrase matching are proven on real audio, while the acoustic path from a person's mouth is not. See acousticPathLimitation.",
  permission: {
    requestedBeforeDeviceOpened: true,
    consentStoreValue: permission.globalValue,
    granted: permission.granted,
    note:
      "voice-host.ps1 reads the Windows CapabilityAccessManager ConsentStore and refuses to open the microphone unless it reads Allow. On a denied machine the recording would otherwise come back as digital silence, which looks exactly like a quiet room.",
  },
  devices,
  capture: {
    requestedSeconds: 5,
    path: capturePath,
    sha256: capture.sha256,
    bytes: capture.bytes,
    audio,
    realAudioNotSilence: capturedRealAudio,
    formatNote:
      "Recorded 2ch/44100 because this microphone array refuses every mono format at 16k, 44.1k and 48k alike; the host downmixes and resamples to the mono 16 kHz the recogniser requires.",
  },
  transcription: {
    spoken: SENTENCE,
    transcript: heard,
    segments: (sentence.result as { segments: unknown }).segments,
    exactMatch: transcribedCorrectly,
    wav: sentence.wav,
  },
  wakePhrase: {
    configuredPhrases: [...DEFAULT_WAKE_PHRASES],
    method: "constrained grammar with a confidence floor",
    triggering: {
      spoken: triggering.spoken,
      recognizedPhrase: wakeYes.recognizedPhrase,
      confidence: wakeYes.confidence,
      triggered,
    },
    nonTriggering: {
      spoken: nonTriggering.spoken,
      recognizedPhrase: wakeNo.recognizedPhrase,
      confidence: wakeNo.confidence,
      triggered: notTriggered,
    },
    threshold: wakeYes.threshold,
    correctInBothDirections: wakePhraseCorrect,
    dictationComparison: {
      triggeringTranscript: triggerText,
      nonTriggeringTranscript: nonTriggerText,
      matchesWakePhraseOnTriggering: dictationMatchYes,
      matchesWakePhraseOnNonTriggering: dictationMatchNo,
      finding:
        "Dictation transcribed 'Hey OCADE' as 'Payer good' — the name is an invented proper noun outside the recogniser's lexicon, so matchesWakePhrase correctly refused it. Adding 'payer good' to the tolerated mishearings would have made the test pass and the product worse. Wake detection therefore uses a constrained grammar, which is how wake words are actually detected, and the confidence floor is what stops a grammar from reporting its closest phrase for arbitrary audio.",
    },
  },
  acousticPathLimitation: {
    ambientRmsDbfs: ambientRms,
    speechPlayingRmsDbfs: overAirRms,
    transcriptOverAir: (overAir as { transcript: string }).transcript,
    transcriptFromWaveform: heard,
    echoCancellationDetected,
    explanation:
      "Playing the sentence through the speakers and recording it on the microphone produced a LOWER level than the silent room. Adding a sound source cannot reduce recorded level, so the array is actively cancelling the speaker signal — correct behaviour for a laptop, and fatal for self-testing. Closing this gap needs either a person speaking or a playback device outside the array's echo-cancellation path.",
  },
};

console.log(`permission     : ${permission.globalValue} (granted=${permission.granted})`);
console.log(`capture        : ${audio.durationSec}s ${audio.channels}ch ${audio.sampleRate}Hz rms=${audio.rmsDbfs}dBFS peak=${audio.peak} real=${capturedRealAudio}`);
console.log(`transcription  : ${JSON.stringify(heard)}`);
console.log(`                 exact match to spoken sentence = ${transcribedCorrectly}`);
console.log(`wake TRIGGER   : grammar heard ${JSON.stringify(wakeYes.recognizedPhrase)} conf=${wakeYes.confidence} -> triggered=${triggered}`);
console.log(`                 (dictation heard ${JSON.stringify(triggerText)})`);
console.log(`wake NON-TRIG  : grammar heard ${JSON.stringify(wakeNo.recognizedPhrase)} conf=${wakeNo.confidence} -> triggered=${notTriggered}`);
console.log(`air gap        : ambient ${ambientRms} dBFS vs speech-playing ${overAirRms} dBFS -> echo cancellation=${echoCancellationDetected}`);
console.log(`J1: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
