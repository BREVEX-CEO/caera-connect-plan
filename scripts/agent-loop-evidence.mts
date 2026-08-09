/**
 * Proof that the OCADE agent loop actually drives this computer.
 *
 * This runs the PRODUCTION modules — `agent/domains`, `agent/tool-registry`,
 * `agent/loop`, `agent/adapters.node`, `ocade-local` streaming — against the
 * real local engine, the real Python native host and the real machine. Nothing
 * is stubbed and nothing is special-cased per phrase: the tasks below are typed
 * in as a user would type them.
 *
 * It is deliberately NOT a unit test. A unit test proves the wiring is
 * consistent with itself; this proves a sentence becomes an action on a real
 * screen and that the result was checked afterwards.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runAgentTask, type AgentMessage, type ToolCall } from "../src/lib/agent/loop.ts";
import { OcadeAdapters } from "../src/lib/agent/adapters.node.ts";
import { streamLocalChat, type LocalChatMessage } from "../src/lib/ocade-local.ts";
import { schemasFor } from "../src/lib/agent/tool-registry.ts";
import {
  detectPlatform,
  resolveFixedModel,
  storagePreflight,
} from "../src/lib/local/fixed-model.ts";

/**
 * Find the project root by looking for it, not by counting `..` from this file.
 *
 * Counting broke the moment the script was bundled for speed: the bundle sits
 * in a temporary directory, so every sidecar path resolved next to the bundle
 * and all three tasks failed with "the computer-control host could not start".
 * Walking up for a marker works from source and from a bundle alike.
 */
function projectRoot(): string {
  let dir = process.env.OCADE_ROOT ?? process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, "native/python-host/ocade_host/__main__.py"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the OCADE project root from this working directory.");
}

const ROOT = projectRoot();
const BRIDGE = process.env.OCADE_BRIDGE_URL ?? "http://127.0.0.1:11434";

const platform = detectPlatform();
const spec = resolveFixedModel(platform);
const MODEL = spec.id;

const adapters = new OcadeAdapters({
  pythonExecutable: resolve(ROOT, "native/python-host/.venv/Scripts/python.exe"),
  pythonHostDir: resolve(ROOT, "native/python-host"),
  browserHostEntry: resolve(ROOT, "native/browser-host/index.mjs"),
});

/** One non-streaming completion, used by the domain classifier. */
async function complete(prompt: string, signal?: AbortSignal): Promise<string | null> {
  let text = "";
  const result = await streamLocalChat(
    BRIDGE,
    MODEL,
    [{ role: "user", content: prompt }],
    { onToken: (c) => (text += c), think: false, signal },
    fetch,
  );
  return result.ok ? text : null;
}

/** One model turn WITH tool schemas. This is the join that did not exist. */
async function turn(
  messages: AgentMessage[],
  tools: ReturnType<typeof schemasFor>,
  handlers: { onToken?: (c: string) => void; signal?: AbortSignal },
) {
  const calls: ToolCall[] = [];
  let text = "";
  const local: LocalChatMessage[] = messages.map((m) => ({
    // The runtime accepts a `tool` role for results; anything else is folded
    // into the user turn so a result is never silently dropped.
    role: m.role === "tool" ? "user" : m.role,
    content: m.role === "tool" ? `Tool ${m.toolName} returned:\n${m.content}` : m.content,
  }));
  const result = await streamLocalChat(
    BRIDGE,
    MODEL,
    local,
    {
      onToken: (c) => {
        text += c;
        handlers.onToken?.(c);
      },
      onToolCall: (c) => calls.push(c),
      tools,
      think: false,
      signal: handlers.signal,
    },
    fetch,
  );
  if (!result.ok) throw new Error(result.reason ?? "local engine failed");
  // Reasoning models leak a <think> block into content; it is not an answer.
  return { text: text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(), toolCalls: calls };
}

const TASKS = [
  "OCADE, what is on my screen?",
  "What applications are installed on this computer?",
  "How is my computer doing right now — is anything using too much memory?",
];

async function main() {
  const started = Date.now();
  console.log(`platform=${platform} fixedModel=${MODEL} (${spec.family} ${spec.parameters})`);
  console.log("storagePreflight:", JSON.stringify(storagePreflight(spec, 30_834_651_136)));

  for (const request of TASKS) {
    console.log(`\n=== "${request}" ===`);
    const taskStarted = Date.now();
    const result = await runAgentTask(
      {
        complete,
        turn,
        execute: (call, signal) => adapters.execute(call, signal),
        // Autonomous for this proof; the GUI supplies a real prompt. Read-only
        // tools never reach here at all.
        permit: async () => true,
        onEvent: (event) => {
          if (event.kind === "classified") {
            console.log(
              `  classified -> [${event.classification.domains.join(", ")}] via ${event.classification.basis}; ${event.tools.length} tools loaded`,
            );
          }
          if (event.kind === "tool_start")
            console.log(
              `  → ${event.call.name}(${JSON.stringify(event.call.arguments).slice(0, 120)})`,
            );
          if (event.kind === "tool_end") {
            console.log(
              `  ← ${event.call.name}: ${event.outcome.kind}${event.outcome.verified === undefined ? "" : ` verified=${event.outcome.verified}`} — ${event.outcome.detail.slice(0, 140)}`,
            );
          }
        },
      },
      { request },
    );
    console.log(
      `  stop=${result.reason} allVerified=${result.allVerified} steps=${result.steps.length} ms=${Date.now() - taskStarted}`,
    );
    console.log(`  ANSWER: ${result.text.slice(0, 700)}`);
  }

  adapters.dispose();
  console.log(`\ntotal ${Date.now() - started} ms`);
}

main().catch((error) => {
  adapters.dispose();
  console.error("FAILED:", error);
  process.exitCode = 1;
});
