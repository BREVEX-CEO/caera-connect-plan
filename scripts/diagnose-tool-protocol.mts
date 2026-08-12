/**
 * Replay the exact Control + Work turn the Demo builds, and show what comes back.
 *
 * WHY THIS EXISTS
 * ---------------
 * A multi-step instruction — "check how much memory this computer is using,
 * then save that number into a file" — made one tool call and stopped. Two
 * different models were blamed for it before the cause was found, because the
 * only way to watch it was through the browser, behind an 8-minute demo timer,
 * one 90-second attempt at a time.
 *
 * This runs the same prompt construction outside the browser: the real
 * SYSTEM_PROMPT, the real toolInstructions(), the real parseModelReply(), and
 * the real describe(). If the Demo stalls and this does not, the fault is in
 * the wiring; if both stall, it is in the protocol.
 *
 * Usage: npx vite-node scripts/diagnose-tool-protocol.mts
 */

import { SYSTEM_PROMPT, describe } from "../src/lib/agent/loop";
import { findTool, schemasFor, type ToolDefinition } from "../src/lib/agent/tool-registry";
import { ok } from "../src/lib/agent/outcomes";
import { ACT_NOW_NUDGE, parseModelReply, toolInstructions } from "../src/lib/work/tool-protocol";
import { OCADE_MODEL_ID } from "../src/lib/local/fixed-model";

const BRIDGE = process.env.OCADE_BRIDGE_URL ?? "http://127.0.0.1:11434";
const TASK =
  process.argv.slice(2).join(" ") ||
  "Check how much memory this computer is using, then save that number into a file called memory-check.txt";

/** The domains a control mission is classified into. */
const DOMAINS = ["os_app", "files"] as const;

const definitions = schemasFor([...DOMAINS])
  .map((schema) => findTool(schema.function.name))
  .filter((tool): tool is ToolDefinition => tool !== null);

const names = definitions.map((tool) => tool.name);
const instructions = toolInstructions(definitions);

console.log(`model   = ${OCADE_MODEL_ID}`);
console.log(`tools   = ${names.length}  (${DOMAINS.join(", ")})`);
console.log(`prompt  = ${(SYSTEM_PROMPT + instructions).length} characters of system message`);
console.log(`task    = ${TASK}\n`);

interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

async function ask(messages: Msg[]): Promise<{ text: string; ms: number }> {
  const started = Date.now();
  const response = await fetch(`${BRIDGE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OCADE_MODEL_ID,
      messages,
      stream: false,
      keep_alive: -1,
      options: { num_predict: 400, temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const json = (await response.json()) as { message?: { content?: string } };
  return { text: json.message?.content ?? "", ms: Date.now() - started };
}

function report(label: string, text: string, ms: number) {
  const parsed = parseModelReply(text, names);
  console.log(`── ${label}  (${ms} ms)`);
  console.log(`   raw   : ${JSON.stringify(text.slice(0, 240))}`);
  console.log(`   calls : ${JSON.stringify(parsed.toolCalls)}`);
  console.log(`   prose : ${JSON.stringify(parsed.text.slice(0, 120))}\n`);
  return parsed;
}

// ── turn 1 ──────────────────────────────────────────────────────────────────
const messages: Msg[] = [
  { role: "system", content: `${SYSTEM_PROMPT}\n${instructions}` },
  { role: "user", content: TASK },
];

const first = await ask(messages);
const parsedFirst = report("TURN 1", first.text, first.ms);

if (parsedFirst.toolCalls.length === 0) {
  const nudged = await ask([
    ...messages,
    { role: "assistant", content: first.text },
    { role: "user", content: ACT_NOW_NUDGE },
  ]);
  report("TURN 1 (after ACT_NOW_NUDGE)", nudged.text, nudged.ms);
  process.exit(0);
}

// ── turn 2: hand back a real tool result, rendered exactly as the loop does ──
const call = parsedFirst.toolCalls[0];
const outcome = ok(
  { cpu_percent: 19, ram_percent: 76.4, ram_used_gb: 11.9, ram_total_gb: 15.6 },
  "Read this computer's processor, memory, disk and battery state.",
);

const rendered = describe(outcome);
console.log(`── the tool result the model is handed\n${rendered}\n`);

messages.push({ role: "assistant", content: first.text });
messages.push({ role: "user", content: `Result of ${call.name}:\n${rendered}` });

const second = await ask(messages);
const parsedSecond = report("TURN 2", second.text, second.ms);

if (parsedSecond.toolCalls.length === 0) {
  const nudged = await ask([
    ...messages,
    { role: "assistant", content: second.text },
    { role: "user", content: ACT_NOW_NUDGE },
  ]);
  const retried = report("TURN 2 (after ACT_NOW_NUDGE)", nudged.text, nudged.ms);
  console.log(
    retried.toolCalls.length > 0
      ? "VERDICT: the nudge rescues it. The protocol works, but costs an extra turn every time."
      : "VERDICT: the model will not emit a second call in this protocol. THIS is the stall.",
  );
} else {
  console.log("VERDICT: two turns, two calls. The protocol is fine — the stall is elsewhere.");
}
