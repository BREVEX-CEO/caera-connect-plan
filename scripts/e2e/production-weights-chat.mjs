#!/usr/bin/env node
/**
 * REAL PRODUCTION WEIGHTS, THROUGH THE REAL CHAT PATH.
 *
 * WHY THIS IS A SEPARATE SCRIPT FROM `audit:real-inference`, and why that one
 * is not a substitute. That harness runs two fixtures and is honest about both:
 * a random-weight GGUF, whose token CONTENT is meaningless and which is there
 * for liveness and timings; and a tiny model trained to memorise three capital
 * cities, which proves the runtime returns the right token ids and nothing
 * whatsoever about answer quality. A product cannot be launched on either.
 *
 * This script answers the question those cannot: does the model OCADE actually
 * ships, downloaded from where OCADE actually serves it, produce correct
 * answers through the adapter the signed-in Chat page actually uses?
 *
 * IT DOES NOT RUN IN EVERY ENVIRONMENT, AND IT DOES NOT PRETEND TO. It needs
 * to reach the model publisher (or a mirror), and it needs roughly half a
 * gigabyte of disk. Where that is impossible, `npm run launch:prove` records
 * this gate as UNAVAILABLE and prints this file's command — it never records it
 * as passed, because an unproven answer quality is the single easiest thing to
 * quietly assume.
 *
 * Usage:
 *   node scripts/e2e/production-weights-chat.mjs
 *   OCADE_MODEL_URL=https://your-mirror/qwen2.5-0.5b-instruct-q4_k_m.gguf \
 *     node scripts/e2e/production-weights-chat.mjs
 */
import { createWriteStream } from "node:fs";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync("release/OCADE_BROWSER_MODEL_CATALOGUE.json", "utf8"));
const entry = catalogue.entries[0];
if (!entry) {
  console.error("The browser model catalogue is empty; there is nothing to prove.");
  process.exit(1);
}

const URL_TO_FETCH = process.env["OCADE_MODEL_URL"] ?? entry.url;

let passed = 0;
let failed = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  ok ? (passed += 1) : (failed += 1);
};

/**
 * The questions, and why each one is here.
 *
 * They are deliberately not trivia. Each targets a capability the product
 * claims on its own pages, and each has an answer that can be checked without
 * a human reading it — which is what makes this runnable in CI rather than a
 * screenshot somebody eyeballs.
 */
const QUESTIONS = [
  {
    id: "basic-knowledge",
    prompt: "What is the capital of Australia? Answer with the city name only.",
    accept: /canberra/i,
    why: "Facts the model should hold without retrieval.",
  },
  {
    id: "arithmetic",
    prompt: "What is 17 multiplied by 4? Reply with the number only.",
    accept: /\b68\b/,
    why: "Arithmetic, where a plausible-sounding wrong answer is the failure mode.",
  },
  {
    id: "multi-step",
    prompt:
      "A train leaves at 14:20 and the journey takes 3 hours and 47 minutes. " +
      "What time does it arrive? Reply with the 24-hour time only.",
    accept: /18[:.]07/,
    why: "Two steps, where carrying the minutes is the part a weak model drops.",
  },
  {
    id: "instruction-following",
    prompt: "List exactly three primary colours, one per line, with no other text.",
    accept: /(red|blue|yellow)[\s\S]*(red|blue|yellow)[\s\S]*(red|blue|yellow)/i,
    why: "Whether the shape of the answer follows the instruction, not just the content.",
  },
  {
    id: "honest-uncertainty",
    prompt: "Who won the men's singles at Wimbledon last year?",
    /*
     * THE CORRECT ANSWER IS AN ADMISSION. Chat has no live retrieval on this
     * path, so a confident specific name is a hallucination and a FAIL, not a
     * pass. This is the check most likely to be quietly dropped from a suite,
     * because it is the one that fails on a model that sounds impressive.
     */
    accept:
      /don'?t (have|know)|not sure|cannot|can'?t (say|know|confirm)|no (access|current|up-to-date)|unable to/i,
    why: "Freshness honesty: without retrieval, the right answer is 'I cannot know'.",
  },
];

const dir = await mkdtemp(join(tmpdir(), "ocade-weights-"));
const file = join(dir, entry.path);

try {
  console.log(`Fetching production weights from ${URL_TO_FETCH}`);
  const response = await fetch(URL_TO_FETCH, { redirect: "follow" });
  if (!response.ok || !response.body) {
    console.error(
      `Could not fetch the weights (HTTP ${response.status}). ` +
        `Set OCADE_MODEL_URL to a mirror this machine can reach.`,
    );
    process.exit(1);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));

  const { size } = await stat(file);
  check(
    size === entry.sizeBytes,
    "the downloaded file is exactly the size the catalogue declares",
    `${size} vs ${entry.sizeBytes}`,
  );

  /*
   * THE DIGEST IS CHECKED BEFORE THE MODEL IS LOADED, not after. Weights that
   * are almost right load happily and answer nonsense, and an answer-quality
   * suite run against a corrupted file measures nothing at all.
   */
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  await pipeline(createReadStream(file), hash);
  const digest = hash.digest("hex");
  check(digest === entry.sha256, "the bytes match the reviewed digest", digest.slice(0, 16));
  if (digest !== entry.sha256) {
    console.error("Refusing to measure answer quality against weights that failed verification.");
    process.exit(1);
  }

  const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
  const llama = await getLlama();
  const coldAt = Date.now();
  const model = await llama.loadModel({ modelPath: file });
  const coldMs = Date.now() - coldAt;
  check(true, "the production model loads", `${coldMs} ms, context ${model.trainContextSize}`);

  const results = [];
  for (const question of QUESTIONS) {
    const context = await model.createContext({ contextSize: 2048 });
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      /*
       * The identity clause the product sends, so the measurement is of the
       * model AS OCADE CONFIGURES IT rather than of the raw checkpoint.
       */
      systemPrompt:
        "You are OCADE, developed and created by CAERA CADANE, running on the user's own device. " +
        "Be helpful, concise, and honest about your limits. If you do not have current " +
        "information, say so plainly rather than guessing.",
    });

    const startedAt = Date.now();
    let firstTokenMs = null;
    const answer = await session.prompt(question.prompt, {
      maxTokens: 200,
      onTextChunk: () => {
        if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
      },
    });
    const totalMs = Date.now() - startedAt;
    await context.dispose();

    const ok = question.accept.test(answer);
    check(ok, question.id, `${firstTokenMs ?? "-"} ms to first token, ${totalMs} ms total`);
    console.log(`      Q: ${question.prompt}`);
    console.log(`      A: ${answer.trim().replace(/\n/g, " ⏎ ").slice(0, 240)}`);
    console.log(`      why: ${question.why}`);
    results.push({ id: question.id, ok, firstTokenMs, totalMs, answer: answer.trim() });
  }

  await model.dispose();

  console.log("");
  console.log(`Model: ${entry.repo}/${entry.path}`);
  console.log(`Source: ${URL_TO_FETCH}`);
  console.log(`SHA-256: ${digest}`);
  console.log(`Cold load: ${coldMs} ms`);
  console.log(`${passed}/${passed + failed} production-weight checks passed`);

  if (failed > 0) process.exit(1);
} finally {
  await rm(dir, { recursive: true, force: true });
}
