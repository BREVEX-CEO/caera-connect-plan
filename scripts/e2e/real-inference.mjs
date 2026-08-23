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
 * TWO MODELS, TWO DIFFERENT QUESTIONS.
 *
 * The first has RANDOM weights, so its output is meaningless and it is used for
 * exactly the things that do not depend on output: cold load, warm load,
 * first-token latency, and that tokens are produced at all rather than an empty
 * stream reported as success.
 *
 * The second is TRAINED — scripts/fixtures/train-tiny-llama.py overfits three
 * capital-city facts and exports them, and the result is committed so nothing
 * here needs torch. Memorisation is the point: it gives an assertion with one
 * right answer, so the runtime can be checked for CORRECTNESS and not merely
 * for liveness. If llama.cpp's graph, the tensor layout, or the RoPE mode were
 * wrong, the model would still load and still emit tokens — and the completion
 * would not be "paris".
 *
 * WHAT NEITHER SHOWS: a production model's answer quality. A 2-layer, 64-wide
 * network that has memorised three lines is not a language model, and this file
 * never calls it one.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
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
  // Windows commonly installs `python.exe` while leaving `python3.exe` as the
  // Microsoft Store placeholder, which exits 9009 even when Python is present.
  const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
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

  // ---- 6. Correctness, against a model that was trained -------------------
  // Token ids are built by hand rather than through `model.tokenize`. The
  // vocabulary is three specials followed by all 256 bytes, so byte b is id
  // 3 + b, and going direct keeps SentencePiece's whitespace handling out of
  // an assertion that is about the RUNTIME, not about the tokenizer.
  const BYTE_OFFSET = 3;
  const encode = (text) => [...Buffer.from(text, "utf8")].map((b) => b + BYTE_OFFSET);
  const decode = (ids) => Buffer.from(ids.map((t) => t - BYTE_OFFSET)).toString("utf8");

  const trainedPath = "scripts/fixtures/tiny-llama-trained.gguf";
  check("the trained fixture is committed to the repo", existsSync(trainedPath), trainedPath);

  const trained = await llama.loadModel({ modelPath: trainedPath });
  const trainedContext = await trained.createContext({ contextSize: trained.trainContextSize });
  const trainedSequence = trainedContext.getSequence();

  for (const [prompt, expected] of [
    ["capital of france is ", "paris\n"],
    ["capital of japan is ", "tokyo\n"],
    ["capital of egypt is ", "cairo\n"],
  ]) {
    await trainedSequence.clearHistory();
    const produced = [];
    for await (const token of trainedSequence.evaluate(encode(prompt), { temperature: 0 })) {
      produced.push(token);
      if (produced.length >= expected.length) break;
    }
    const got = decode(produced);
    check(
      `the trained model completes ${JSON.stringify(prompt)} correctly`,
      got === expected,
      `got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }

  await trainedContext.dispose();
  await trained.dispose();

  console.log(
    "\n  NOTE: the first model's weights are random, so its token CONTENT is" +
      "\n  meaningless — it is here for timings and liveness only. The trained" +
      "\n  model has memorised three facts, which is enough to check the runtime" +
      "\n  returns the RIGHT tokens. Neither says anything about a production" +
      "\n  model's answer quality, and this harness does not claim otherwise.",
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} real-inference checks passed`);
if (failed.length) process.exitCode = 1;
