/**
 * Does preloading actually turn a cold first message into a warm one?
 *
 * The claim is narrow and falsifiable: with the weights evicted, calling
 * `preloadLocalModel` and waiting should leave the NEXT real message paying
 * warm latency rather than cold. Measured both ways against the live runtime,
 * through the same functions the chat screen calls.
 *
 * Usage: vite-node scripts/ocade-preload-evidence.mts -- [--write] [--tag qwen3:8b]
 */
import { writeFileSync } from "node:fs";
import { freemem, totalmem } from "node:os";
import {
  preloadLocalModel,
  streamLocalChat,
  DEFAULT_LOCAL_BRIDGE_URL,
} from "../src/lib/ocade-local";

const args = process.argv.slice(2).filter((a) => a !== "--");
const write = args.includes("--write");
const tagIndex = args.indexOf("--tag");
const MODEL = tagIndex >= 0 ? args[tagIndex + 1] : "qwen3:8b";
const BRIDGE = process.env.OCADE_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;
const OUT = "release/OCADE_PRELOAD_EVIDENCE.json";
const PROMPT = "Name the largest planet. One word.";

/** Evict the weights so the next measurement is genuinely a cold one. */
async function evict(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [], keep_alive: 0 }),
    });
    // Eviction is asynchronous in the runtime; give it a moment to release.
    await new Promise((r) => setTimeout(r, 3000));
    return res.ok;
  } catch {
    return false;
  }
}

async function timeFirstToken(): Promise<{ firstTokenMs: number | null; reply: string }> {
  const t0 = Date.now();
  let firstTokenMs: number | null = null;
  let reply = "";
  await streamLocalChat(BRIDGE, MODEL, [{ role: "user", content: PROMPT }], {
    onToken: (c) => {
      if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
      reply += c;
    },
  });
  return { firstTokenMs, reply: reply.trim() };
}

console.log(`model ${MODEL} · ${(freemem() / 1024 ** 3).toFixed(2)} GiB free\n`);

// A — evicted, NO preload. This is what a first message costs today.
await evict();
const withoutPreload = await timeFirstToken();
console.log(
  `no preload   first token ${withoutPreload.firstTokenMs} ms  "${withoutPreload.reply}"`,
);

// B — evicted, preload first, then the same message.
await evict();
const preloadStart = Date.now();
const preloaded = await preloadLocalModel(BRIDGE, MODEL);
const preloadMs = Date.now() - preloadStart;
const withPreload = await timeFirstToken();
console.log(
  `preloaded    load ${preloadMs} ms, then first token ${withPreload.firstTokenMs} ms  "${withPreload.reply}"`,
);

const improvedBy =
  withoutPreload.firstTokenMs !== null && withPreload.firstTokenMs !== null
    ? withoutPreload.firstTokenMs - withPreload.firstTokenMs
    : null;

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  tier: "REAL TARGET RUNTIME VERIFIED",
  caveat:
    "One machine, one engine build. The preload cost is paid while the user is still typing, so it is NOT free — it is moved off the critical path, not removed. On a machine where the user sends a message faster than the weights load, the saving is smaller than shown here.",
  model: MODEL,
  prompt: PROMPT,
  machine: {
    totalRamGib: +(totalmem() / 1024 ** 3).toFixed(2),
    freeRamGibAtStart: +(freemem() / 1024 ** 3).toFixed(2),
  },
  withoutPreload: {
    firstTokenMs: withoutPreload.firstTokenMs,
    reply: withoutPreload.reply.slice(0, 80),
  },
  withPreload: {
    preloadReturnedOk: preloaded,
    preloadMs,
    firstTokenMs: withPreload.firstTokenMs,
    reply: withPreload.reply.slice(0, 80),
  },
  firstTokenSavedMs: improvedBy,
};

console.log(`\nfirst token saved: ${improvedBy} ms`);
if (write) {
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${OUT}`);
}
