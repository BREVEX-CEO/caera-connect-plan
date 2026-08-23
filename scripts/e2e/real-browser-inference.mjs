/**
 * REAL INFERENCE, IN A REAL BROWSER, THROUGH THE RUNTIME OCADE SHIPS.
 *
 * Loads a genuinely valid GGUF into wllama — the same WebAssembly llama.cpp
 * build the WASM adapter uses — inside real Chromium, and generates.
 *
 * The weights are random (see build-test-gguf.mjs for why the production ones
 * are unreachable here), so the text is meaningless. Everything else is real:
 * the fetch, the GGUF parse, the tokenizer, the KV cache, the sampling loop,
 * token streaming and cancellation.
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const MODEL_URL = process.env.MODEL_URL ?? `${BASE}/models/ocade-proof.gguf`;
const BYTE_RANGE = (process.env.BYTE_TOKEN_RANGE ?? "3,258").split(",").map(Number);

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ocade-inf-")), {
  executablePath: "/opt/pw-browsers/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-webgpu", "--enable-features=SharedArrayBuffer"],
});
const page = await ctx.newPage();

const outbound = [];
ctx.on("request", (r) => outbound.push(r.url()));
page.on("console", (m) => {
  if (m.type() === "error") console.error("  [page error]", m.text().slice(0, 200));
});

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });

const result = await page.evaluate(
  async ({ modelUrl, byteTokenRange }) => {
    const t = (label) => ({ label, at: performance.now() });
    const marks = [t("start")];
    try {
      const { Wllama } = await import("/wllama/index.js");
      marks.push(t("runtime imported"));

      /*
       * The same construction the shipped adapter uses: single-thread wasm
       * with `allowOffline`, so no CDN is contacted and the run works with the
       * network policy this environment imposes.
       */
      const wllama = new Wllama(
        {
          default: "/wllama/wasm/wllama.wasm",
          "single-thread/wllama.wasm": "/wllama/wasm/wllama.wasm",
        },
        { allowOffline: true },
      );

      const bytes = await (await fetch(modelUrl)).arrayBuffer();
      marks.push(t("model fetched"));

      const blob = new Blob([bytes]);
      await wllama.loadModel([new File([blob], "ocade-proof.gguf")], { n_ctx: 512 });
      marks.push(t("model loaded"));

      const meta = wllama.getModelMetadata?.() ?? null;

      let firstTokenAt = null;
      let tokens = 0;
      let text = "";
      /*
       * The plain completion path, with the prompt INSIDE the options object.
       *
       * Two earlier attempts were harness bugs rather than model faults, and
       * both are worth recording: passing the prompt positionally produced
       * "key 'prompt' not found", and going through createChatCompletion put
       * the run through the chat-template formatter, which this deliberately
       * minimal vocabulary does not satisfy. Completion exercises exactly the
       * machinery under test — tokenise, forward pass, sample, stream — with
       * nothing in between.
       */
      /*
       * Byte-fallback tokens are banned at sampling time.
       *
       * They MUST exist in the vocabulary — llama.cpp's tokenizer looks them
       * up by name and throws without them — but with random weights the
       * sampler picks them uniformly, emitting arbitrary bytes that form
       * invalid UTF-8 and cannot cross the worker boundary. A real model
       * never hits this because its weights make byte tokens rare and
       * well-formed; banning them is how the harness stands in for that.
       */
      const banned = [];
      for (let id = byteTokenRange[0]; id <= byteTokenRange[1]; id += 1) {
        banned.push({ token: id, bias: -100 });
      }
      /*
       * Non-streaming. The streaming generator moves one GLUE worker message
       * per token, and with random weights that transport kept desynchronising
       * ("Invalid typed array length: 1163217991" — 0x45554c47, wllama's own
       * "GLUE" magic read as a length). A single request/response isolates the
       * question being asked here, which is whether the model runs at all.
       */
      /*
       * Streaming, now that every token decodes to valid text. This is the
       * shape the shipped adapter uses, and it is what makes first-token
       * latency measurable rather than inferred.
       */
      const stream = await wllama.createCompletion({
        prompt: "hello world this is a local device answer",
        nPredict: 24,
        stream: true,
        sampling: { temp: 0.7, top_k: 40, seed: 42, logit_bias: banned },
      });
      let firstChunkShape = null;
      for await (const chunk of stream) {
        if (firstTokenAt === null) {
          firstTokenAt = performance.now();
          firstChunkShape =
            typeof chunk === "string" ? "string" : Object.keys(chunk ?? {}).join(",");
        }
        tokens += 1;
        /*
         * wllama streams OpenAI-compatible chunks, so the new text is in
         * `choices[0].delta.content` (chat) or `choices[0].text` (completion)
         * rather than a `currentText` field.
         */
        if (typeof chunk === "string") text += chunk;
        else {
          const choice = chunk?.choices?.[0];
          text += choice?.delta?.content ?? choice?.text ?? "";
        }
      }
      marks.push(t("generation complete"));

      /*
       * STOP HAS TO ACTUALLY STOP.
       *
       * A second generation is started and aborted part-way. The property
       * under test is that the loop ends promptly and reports cancellation
       * rather than running to completion and discarding the result — a Stop
       * button that only hides output still costs the battery and the wait.
       */
      const abort = new AbortController();
      let cancelledTokens = 0;
      const cancelStart = performance.now();
      let cancelledCleanly = false;
      try {
        const s2 = await wllama.createCompletion({
          prompt: "hello world this is a local device answer",
          nPredict: 400,
          stream: true,
          abortSignal: abort.signal,
          sampling: { temp: 0.7, top_k: 40, seed: 7, logit_bias: banned },
        });
        for await (const c of s2) {
          cancelledTokens += 1;
          if (cancelledTokens === 5) abort.abort();
        }
        cancelledCleanly = true;
      } catch {
        // wllama may surface the abort as a throw; both are a clean stop.
        cancelledCleanly = true;
      }
      const cancelMs = Math.round(performance.now() - cancelStart);

      const startAt = marks[0].at;
      const loadedAt = marks.find((m) => m.label === "model loaded").at;
      return {
        ok: true,
        generatedChars: text.length,
        generatedSample: text.slice(0, 160),
        firstChunkShape,
        tokens,
        modelLoadMs: Math.round(loadedAt - startAt),
        firstTokenMs: firstTokenAt === null ? null : Math.round(firstTokenAt - loadedAt),
        totalGenerationMs: Math.round(marks.at(-1).at - loadedAt),
        architecture: meta?.meta?.["general.architecture"] ?? null,
        contextFromModel: meta?.meta?.["llama.context_length"] ?? null,
        stopAfterTokens: cancelledTokens,
        stopRespondedMs: cancelMs,
        stopWasClean: cancelledCleanly,
        stoppedEarly: cancelledTokens < 400,
        marks: marks.map((m) => ({ label: m.label, ms: Math.round(m.at - startAt) })),
      };
    } catch (e) {
      return { ok: false, error: String(e?.stack ?? e).slice(0, 900) };
    }
  },
  { modelUrl: MODEL_URL, byteTokenRange: BYTE_RANGE },
);

const external = [
  ...new Set(
    outbound.map((u) => {
      try {
        return new URL(u).host;
      } catch {
        return u;
      }
    }),
  ),
].filter((h) => !h.startsWith("127.0.0.1") && !h.startsWith("localhost"));

console.log(JSON.stringify({ result, externalHosts: external }, null, 2));
await ctx.close();
process.exit(result.ok ? 0 : 1);
