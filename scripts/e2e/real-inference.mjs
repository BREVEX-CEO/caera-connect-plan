/**
 * REAL LOCAL INFERENCE, WITH REAL TIMINGS.
 *
 * Every other local-AI check in this repo stops at the edge of the model: the
 * stub engine in scripts/fixtures/stub-local-engine.mjs speaks the Ollama
 * protocol faithfully, which proves the client, the streaming, the cancellation
 * and the failover — and proves nothing whatsoever about a model runtime.
 * This harness closes that gap. It loads a real GGUF into real llama.cpp,
 * builds a real graph, and reads real tokens off a real sampler.
 *
 * WHERE THE WEIGHTS COME FROM. Not from the network: no weight host is
 * reachable from this sandbox (huggingface.co and ollama.com both answer 403
 * through the proxy), and a test that needs a several-hundred-megabyte download
 * is a test that will be deleted the first time CI is slow. So the weights are
 * constructed — scripts/fixtures/make-tiny-gguf.py writes a correct GGUF v3
 * holding a one-layer llama with a byte-fallback vocabulary.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. The tensors are random. The tokens
 * that come out are therefore meaningless, and NOTHING here says anything about
 * answer quality — that needs trained weights and this file does not pretend
 * otherwise. What is real and measured rather than simulated: that the runtime
 * accepts our GGUF, that cold load, warm load and first-token latency have
 * actual numbers, and that tokens are genuinely produced instead of an empty
 * stream reported as success.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const workdir = mkdtempSync(join(tmpdir(), "ocade-inference-"));
const modelPath = join(workdir, "tiny-llama.gguf");

try {
  // ---- 1. The weights ------------------------------------------------------
  const python = process.env.PYTHON ?? "python3";
  const written = execFileSync(python, ["scripts/fixtures/make-tiny-gguf.py", modelPath], {
    encoding: "utf8",
  }).trim();
  console.log(`  ${written}`);
  const bytes = statSync(modelPath).size;
  check("the GGUF fixture is written and is not empty", bytes > 10_000, `${bytes} bytes`);

  // The generator prints the vocabulary it built. Parsing it here rather than
  // hardcoding a number means the token-range check below stays honest if the
  // fixture ever changes shape.
  const vocabSize = Number(/vocab (\d+)/.exec(written)?.[1]);
  check("the fixture reports the vocabulary it wrote", vocabSize > 0, `vocab ${vocabSize}`);

  // ---- 2. The runtime ------------------------------------------------------
  // A missing binary is a failure, not a skip. The whole point of this harness
  // is that it either runs a model or says loudly that it could not.
  const { getLlama } = await import("node-llama-cpp");
  const llama = await getLlama({ gpu: false });
  check("llama.cpp is present and initialised", typeof llama.loadModel === "function");

  // ---- 3. Cold load --------------------------------------------------------
  const coldStart = performance.now();
  const model = await llama.loadModel({ modelPath });
  const coldLoadMs = Math.round(performance.now() - coldStart);
  console.log(`  cold load: ${coldLoadMs} ms | trained context: ${model.trainContextSize}`);
  check(
    "a real GGUF loads into llama.cpp and reports its trained context",
    model.trainContextSize > 0,
    `trainContextSize=${model.trainContextSize}`,
  );

  // ---- 4. Real token generation -------------------------------------------
  const context = await model.createContext({ contextSize: model.trainContextSize });
  const sequence = context.getSequence();
  const promptTokens = model.tokenize("hello");
  check(
    "the model's own tokenizer turns text into tokens",
    promptTokens.length > 0,
    `${promptTokens.length} tokens`,
  );

  const WANTED = 8;
  const genStart = performance.now();
  let firstTokenMs = -1;
  const generated = [];
  for await (const token of sequence.evaluate(promptTokens, { temperature: 0 })) {
    if (firstTokenMs < 0) firstTokenMs = Math.round(performance.now() - genStart);
    generated.push(token);
    if (generated.length >= WANTED) break;
  }
  const totalMs = Math.round(performance.now() - genStart);
  console.log(
    `  generation: first token ${firstTokenMs} ms | ${generated.length} tokens in ${totalMs} ms`,
  );
  console.log(`  token ids: ${generated.join(",")}`);

  check(
    "the runtime actually emits tokens rather than an empty stream",
    generated.length === WANTED,
    `${generated.length}/${WANTED}`,
  );
  check(
    "every emitted token is a real id inside the model's vocabulary",
    generated.every((t) => Number.isInteger(t) && t >= 0 && t < vocabSize),
    `ids ${generated.join(",")} against vocab ${vocabSize}`,
  );
  check(
    "the sampler is not stuck emitting one token forever",
    new Set(generated).size > 1,
    `${new Set(generated).size} distinct ids`,
  );
  check(
    "first-token latency is a measured number, not a placeholder",
    firstTokenMs >= 0 && Number.isFinite(firstTokenMs),
    `${firstTokenMs} ms`,
  );
  check(
    "total generation time is at least the time to the first token",
    totalMs >= firstTokenMs,
    `${totalMs} ms >= ${firstTokenMs} ms`,
  );

  // ---- 5. Warm load --------------------------------------------------------
  // The second load reads the same file with the OS page cache already warm.
  // This is the number a returning user experiences, and it is the one the
  // product's cold-start copy is allowed to quote.
  const warmStart = performance.now();
  const warmModel = await llama.loadModel({ modelPath });
  const warmLoadMs = Math.round(performance.now() - warmStart);
  console.log(`  warm load: ${warmLoadMs} ms (cold was ${coldLoadMs} ms)`);
  // Deliberately a bound and not `warm <= cold`. Whether the first load is
  // genuinely cold depends on the OS page cache, which this harness does not
  // control — on a machine that has run this before, the two loads are within
  // noise of each other and a strict inequality would flip at random. What is
  // actually guaranteed is the direction: re-reading a file already on disk
  // must not become dramatically more expensive.
  check(
    "a warm load is measured and does not regress against the cold load",
    Number.isFinite(warmLoadMs) && warmLoadMs <= coldLoadMs * 2 + 100,
    `warm ${warmLoadMs} ms vs cold ${coldLoadMs} ms`,
  );

  await warmModel.dispose();
  await context.dispose();
  await model.dispose();

  console.log(
    "\n  NOTE: the weights are random, so token CONTENT is meaningless here." +
      "\n  Answer quality is not tested by this harness and cannot be, without" +
      "\n  trained weights. Timings and runtime behaviour above are real.",
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} real-inference checks passed`);
if (failed.length) process.exitCode = 1;
