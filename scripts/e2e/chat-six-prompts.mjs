/**
 * SEVEN PROMPTS THROUGH THE SHIPPED CHAT PIPELINE, WITH TIMINGS.
 *
 * `discoverLocalModels`, `planContextWindow` and `streamLocalChat` are the
 * functions the product calls. Each prompt has ground truth that exists BEFORE
 * the engine answers, so nothing passes because a reply looked reasonable.
 *
 * WHAT THE TIMINGS ARE. Pipeline latency: discovery, request assembly, NDJSON
 * parsing and delivery to the caller. They are NOT inference latency, because
 * there is no model here — the sandbox proxy refuses huggingface.co and
 * ollama.com with 403, so no weights can be fetched. Reading these as
 * inference figures would be exactly the unearned claim this audit removes.
 *
 * PROMPT 5 IS LOOPBACK, NOT THE INTERNET. There is no route to any public host
 * from this sandbox — every outbound request fails. So "current information"
 * is served by a local HTTP server whose contents are known in advance. What
 * that proves is the shape the product depends on: data is fetched over the
 * network, and the REASONING over it happens on the local engine. It does not
 * prove anything about a live search result.
 *
 * PROMPT 6 IS GENUINELY OFFLINE. Not simulated: nothing outside loopback is
 * reachable from here at all, so a local-engine answer in this environment is
 * an offline answer by construction.
 */
import { createServer } from "node:http";
import {
  discoverLocalModels,
  streamLocalChat,
  planContextWindow,
} from "../../src/lib/ocade-local.ts";
import { startStubLocalEngine } from "../fixtures/stub-local-engine.mjs";

const engine = await startStubLocalEngine({ tokenDelayMs: 6 });

/** A page of "current" information, on loopback, with known contents. */
const TODAY = new Date().toISOString().slice(0, 10);
const web = createServer((_q, s) => {
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  s.end(`<!doctype html><title>Status</title>
    <h1>OCADE service status</h1>
    <p>As of ${TODAY} the local engine bulletin number is 4718.</p>`);
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const WEB = `http://127.0.0.1:${web.address().port}`;

const rows = [];
const discovery = await discoverLocalModels(engine.url);
if (!discovery.reachable || !discovery.models?.length) {
  console.error("no local engine reachable; nothing was measured");
  process.exit(1);
}
const MODEL = discovery.models[0].id;

async function ask(label, messages, expect, note = "") {
  const startedAt = performance.now();
  let firstTokenMs = null;
  let text = "";
  const outcome = await streamLocalChat(engine.url, MODEL, messages, {
    onToken: (t) => {
      if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - startedAt);
      text += t;
    },
  });
  const totalMs = Math.round(performance.now() - startedAt);
  const answer = text.trim();
  const correct = outcome.ok && expect(answer);
  rows.push({ label, answer, correct, engine: MODEL, firstTokenMs, totalMs, note });
  return { answer, correct, firstTokenMs, totalMs };
}

/* 1. FACTUAL */
await ask(
  "1 factual — What is the capital of France?",
  [{ role: "user", content: "What is the capital of France?" }],
  (a) => /paris/i.test(a),
);

/* 2. REASONING — ground truth computed here, not read from the reply */
await ask(
  "2 reasoning — What is 137 + 486?",
  [{ role: "user", content: "What is 137 + 486?" }],
  (a) => a.includes(String(137 + 486)),
);

/* 3. MULTI-TURN — turn three must use turn one */
await ask(
  "3 multi-turn — recall a name given two turns earlier",
  [
    { role: "user", content: "My name is Ada." },
    { role: "assistant", content: "Nice to meet you, Ada." },
    { role: "user", content: "What did I just say my name was?" },
  ],
  (a) => /ada/i.test(a),
);

/* 4. LONG — the fixture echoes the length, so truncation would show */
const long = "Summarise this. " + "The quick brown fox jumps over the lazy dog. ".repeat(140);
await ask(
  `4 long — a ${long.length}-character prompt`,
  [{ role: "user", content: long }],
  (a) => a.includes(String(long.length)),
  `${long.length} characters sent`,
);

/* 5. CURRENT INFORMATION — fetched over the network, reasoned about locally */
const page = await fetch(`${WEB}/status`).then((r) => r.text());
const bulletin = /bulletin number is (\d+)/.exec(page)?.[1] ?? "";
await ask(
  "5 current information — fetched over HTTP, reasoned about on-device",
  [
    { role: "system", content: `Page fetched at ${TODAY}:\n${page}` },
    { role: "user", content: `What is 100 + ${bulletin}?` },
  ],
  (a) => a.includes(String(100 + Number(bulletin))),
  `loopback source, NOT the public internet; bulletin=${bulletin}`,
);

/* 6. OFFLINE — nothing outside loopback is reachable from here at all */
/*
 * "Did fetch throw?" is not the question. This sandbox routes through a proxy
 * that answers a blocked host with 403, and `fetch` resolves that perfectly
 * happily — so a first version of this check reported the internet as
 * REACHABLE while every request was in fact being refused. Reachability means
 * a successful response from the host itself.
 */
async function publicHostReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { reachable: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) {
    return {
      reachable: false,
      detail: error instanceof Error ? error.message.slice(0, 60) : "failed",
    };
  }
}
const probes = await Promise.all(
  ["https://example.com/", "https://cloudflare.com/"].map(publicHostReachable),
);
const internetReachable = probes.some((p) => p.reachable);
const probeDetail = probes.map((p) => p.detail).join(", ");
await ask(
  "6 offline — answered with no route to any public host",
  [{ role: "user", content: "What is the capital of France?" }],
  (a) => /paris/i.test(a),
  internetReachable
    ? `WARNING: a public host answered (${probeDetail}), so this is NOT an offline result`
    : `verified offline: no public host reachable (${probeDetail})`,
);

/* 7. IMAGE UPLOAD → VISION, on the wire and not merely intended */
/*
 * The only vision behaviour previously executed anywhere was the REFUSAL: the
 * two browser engines correctly decline an image and say where one can be
 * read. That leaves the path that actually carries a user's picture — the one
 * that runs when a vision model IS installed — never exercised.
 *
 * So: a real PNG, routed by the product's own model selection, and then the
 * engine's recorded request body is inspected. The assertion is that the image
 * bytes ARRIVED, because "the code passes images along" is a claim about
 * source, and what the engine received is a fact about behaviour.
 */
const visionModel = discovery.models.find((m) => m.vision);
if (!visionModel) {
  console.error("no vision-capable model was discovered; the image path was not measured");
  process.exit(1);
}

// A 1x1 red PNG. Small on purpose: the test is about arrival, not content.
const RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const before = engine.chatRequests.length;
const startedAt = performance.now();
let visionFirstMs = null;
let visionText = "";
const visionOutcome = await streamLocalChat(
  engine.url,
  visionModel.id,
  [{ role: "user", content: "What is in this image?", images: [RED_PNG] }],
  {
    onToken: (t) => {
      if (visionFirstMs === null) visionFirstMs = Math.round(performance.now() - startedAt);
      visionText += t;
    },
  },
);
const visionTotalMs = Math.round(performance.now() - startedAt);

const sent = engine.chatRequests.slice(before).at(-1);
const sentImages = sent?.messages?.at(-1)?.images ?? [];
const arrived = sentImages.length === 1 && sentImages[0] === RED_PNG;

rows.push({
  label: "7 image — a real PNG uploaded to a vision model",
  answer: visionText.trim(),
  correct: visionOutcome.ok && arrived && /1 image/.test(visionText),
  engine: visionModel.id,
  firstTokenMs: visionFirstMs,
  totalMs: visionTotalMs,
  note: arrived
    ? `the engine received the image bytes intact (${RED_PNG.length} base64 chars)`
    : `IMAGE DID NOT ARRIVE: engine received ${sentImages.length} image(s)`,
});

await engine.close();
web.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(
  "\n" + pad("PROMPT", 62) + pad("CORRECT", 9) + pad("FIRST", 8) + pad("TOTAL", 8) + "ANSWER",
);
console.log("-".repeat(130));
for (const r of rows) {
  console.log(
    pad(r.label.slice(0, 60), 62) +
      pad(r.correct ? "yes" : "NO", 9) +
      pad(`${r.firstTokenMs ?? "-"}ms`, 8) +
      pad(`${r.totalMs}ms`, 8) +
      JSON.stringify(r.answer.slice(0, 46)),
  );
  if (r.note) console.log(pad("", 62) + `note: ${r.note}`);
}
// Every engine actually used, not just the first. Row 7 runs on the vision
// model, and a footer naming only the text model would misreport it.
const enginesUsed = [...new Set(rows.map((r) => r.engine))].join(", ");
console.log(`\nengines: ${enginesUsed} (fixture — no weights are reachable in this sandbox)`);
console.log("timings are PIPELINE latency, not inference latency");

const wrong = rows.filter((r) => !r.correct);
console.log(`\n${rows.length - wrong.length}/${rows.length} prompts answered correctly`);
if (wrong.length) {
  console.log("INCORRECT: " + wrong.map((r) => r.label).join("; "));
  process.exitCode = 1;
}
