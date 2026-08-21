/**
 * An Ollama-compatible stub on 127.0.0.1:11434.
 *
 * NOT a model. It exists so the REAL OCADE chat pipeline — discovery, routing,
 * context planning, NDJSON streaming, cancellation, multi-turn assembly — can
 * be driven end to end on a machine where no weights can be downloaded (the
 * sandbox proxy refuses ollama.com and huggingface.co with 403).
 *
 * It answers deterministically from the prompt so the harness has ground truth,
 * and it streams token by token with a real delay so first-token and total
 * timings measure the PIPELINE rather than a single blob.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 11434);
const TOKEN_DELAY_MS = Number(process.env.STUB_TOKEN_DELAY_MS ?? 12);

const MODELS = [
  { name: "qwen2.5:3b", model: "qwen2.5:3b", size: 1_900_000_000,
    details: { parameter_size: "3.1B", quantization_level: "Q4_K_M", family: "qwen2" } },
  { name: "llama3.2:1b", model: "llama3.2:1b", size: 1_300_000_000,
    details: { parameter_size: "1.2B", quantization_level: "Q4_K_M", family: "llama" } },
];

/** Deterministic answers with ground truth known before the model speaks. */
function answerFor(messages) {
  const user = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = String(user);

  // Multi-turn: the earlier turn must be present in the assembled context.
  if (/what did i just say|repeat that|what was my name/i.test(text)) {
    const earlier = messages.filter((m) => m.role === "user").slice(0, -1).map((m) => m.content).join(" ");
    const name = /my name is (\w+)/i.exec(earlier)?.[1];
    return name ? `You said your name is ${name}.` : `Earlier you said: ${earlier.slice(0, 120)}`;
  }
  const sum = /what is (\d+) *\+ *(\d+)/i.exec(text);
  if (sum) return `${Number(sum[1]) + Number(sum[2])}`;
  if (/capital of france/i.test(text)) return "Paris is the capital of France.";
  if (/count to (\d+)/i.test(text)) {
    const n = Number(/count to (\d+)/i.exec(text)[1]);
    return Array.from({ length: n }, (_, i) => String(i + 1)).join(" ");
  }
  if (/long/i.test(text) && text.length > 400) return `Received ${text.length} characters.`;
  return `OCADE stub acknowledges ${text.length} characters.`;
}

export function startStubLocalEngine({ port = 0, tokenDelayMs = TOKEN_DELAY_MS } = {}) {
  return new Promise((resolve) => {
    const instance = makeServer(tokenDelayMs);
    instance.listen(port, "127.0.0.1", () => {
      const actual = instance.address().port;
      resolve({ url: `http://127.0.0.1:${actual}`, close: () => new Promise((r) => instance.close(r)) });
    });
  });
}

function makeServer(TOKEN_DELAY_MS) {
  return createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/api/version") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ version: "0.0.0-ocade-stub" }));
  }
  if (url.pathname === "/api/tags") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ models: MODELS }));
  }
  if (url.pathname === "/api/show") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ details: MODELS[0].details, model_info: {} }));
  }
  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body = await new Promise((resolve) => {
      let buffer = "";
      req.on("data", (c) => (buffer += c));
      req.on("end", () => resolve(buffer));
    });
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = {}; }

    // Ollama rejects `think` for models with no reasoning mode; the product
    // has a retry for exactly that, and this keeps it exercised.
    if (parsed.think === true && !/deepseek|qwen3/i.test(parsed.model ?? "")) {
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: `"${parsed.model}" does not support thinking` }));
    }

    res.writeHead(200, { "content-type": "application/x-ndjson" });
    const reply = answerFor(parsed.messages ?? []);
    const pieces = reply.split(/(\s+)/).filter(Boolean);
    let aborted = false;
    req.on("close", () => { aborted = true; });

    for (const piece of pieces) {
      if (aborted) return;
      res.write(JSON.stringify({
        model: parsed.model, created_at: new Date().toISOString(),
        message: { role: "assistant", content: piece }, done: false,
      }) + "\n");
      await new Promise((r) => setTimeout(r, TOKEN_DELAY_MS));
    }
    if (aborted) return;
    res.write(JSON.stringify({
      model: parsed.model, created_at: new Date().toISOString(),
      message: { role: "assistant", content: "" }, done: true, done_reason: "stop",
      prompt_eval_count: 24, eval_count: pieces.length,
      total_duration: 1_000_000, load_duration: 100_000,
    }) + "\n");
    return res.end();
  }
    res.writeHead(404); res.end("not found");
  });
}

// Run directly for manual driving: `node scripts/fixtures/stub-local-engine.mjs`
if (process.argv[1] && process.argv[1].endsWith("stub-local-engine.mjs")) {
  const { url } = await startStubLocalEngine({ port: PORT });
  console.log(`stub local engine on ${url}`);
}
