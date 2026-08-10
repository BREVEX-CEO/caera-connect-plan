/**
 * Tool calling for an engine that only speaks text.
 *
 * WHY THIS IS NEEDED AT ALL
 * -------------------------
 * `model-turn.node.ts` gets structured tool calls from the local runtime,
 * because Ollama implements the function-calling wire format. The engine the
 * DEMO runs does not: `BrowserWebGpuAdapter` and `BrowserWasmAdapter` load
 * weights into the visitor's own tab and stream tokens, and there is no channel
 * in that for "the model wants to call a function".
 *
 * The demo is where PC control has to be provable without an account, so the
 * options were: give the demo a different, lesser brain, or teach the one brain
 * to express a tool call in the only medium it has. This is the second.
 *
 * A TEXT PROTOCOL IS PARSED DEFENSIVELY OR NOT AT ALL
 * ----------------------------------------------------
 * Small local models wrap JSON in prose, in code fences, in `<think>` blocks,
 * and sometimes emit two objects when they meant one. Every one of those is
 * normal output, not an error, and a parser that only accepts a bare object
 * fails constantly in a way that looks like the model being incapable.
 *
 * So: thinking is stripped, fences are ignored, the first BALANCED object is
 * extracted rather than the first `{...}` a regex can find (nested arguments
 * break the lazy match), unknown tool names are rejected here rather than
 * passed down, and anything unparseable is treated as an ordinary answer —
 * which is usually exactly what it was.
 */

import type { ToolDefinition } from "@/lib/agent/tool-registry";
import type { ToolCall } from "@/lib/agent/loop";

/**
 * The instruction block appended to the system prompt.
 *
 * Written as rules rather than as a schema dump: a 3B model follows "reply with
 * one JSON object and nothing else" far more reliably than it follows a JSON
 * Schema, and every extra token of schema is context the task itself needs.
 */
export function toolInstructions(tools: readonly ToolDefinition[]): string {
  if (tools.length === 0) return "";
  const lines = tools.map((tool) => {
    const parameters = Object.entries(tool.parameters.properties)
      .map(([name, spec]) => {
        const required = tool.parameters.required?.includes(name) ? "" : " (optional)";
        const choices = spec.enum ? ` [one of: ${spec.enum.join(", ")}]` : "";
        return `      ${name}${required}: ${spec.description}${choices}`;
      })
      .join("\n");
    return `  ${tool.name} — ${tool.description}\n${parameters || "      (no arguments)"}`;
  });

  return [
    "",
    "You can do things on this computer by calling one of these actions:",
    "",
    ...lines,
    "",
    "TO CALL AN ACTION, reply with one JSON object and nothing else:",
    '{"tool": "action_name", "arguments": {"name": "value"}}',
    "",
    "Rules:",
    "- One action per reply. Take a step, see what happened, then decide the next one.",
    "- Look before you change anything, and look again afterwards.",
    "- When you have finished, or when no action is needed, reply in plain words with no JSON.",
    "- Never ask for or type passwords, one-time codes or payment details.",
  ].join("\n");
}

/**
 * The first balanced JSON object in a string, ignoring braces inside strings.
 *
 * A regex cannot do this. `/\{[\s\S]*?\}/` stops at the first `}`, which is the
 * end of the nested `arguments` object rather than the end of the call, and the
 * greedy version swallows any prose that follows. This walks the text once.
 */
export function firstJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) return text.slice(start, index + 1);
      if (depth < 0) depth = 0;
    }
  }
  return null;
}

export interface ParsedTurn {
  /** Whatever the model said in words, with any tool call removed. */
  text: string;
  toolCalls: ToolCall[];
}

/**
 * Read one model reply.
 *
 * Never throws, and never invents a call. A reply with no recognisable action
 * is an answer — the loop treats that as the model having finished, which is
 * the correct reading of "OCADE said something and asked for nothing".
 */
export function parseModelReply(reply: string, known: readonly string[]): ParsedTurn {
  const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const candidate = firstJsonObject(withoutThinking);
  if (!candidate) return { text: withoutThinking.trim(), toolCalls: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { text: withoutThinking.trim(), toolCalls: [] };
  }

  const record = parsed as { tool?: unknown; name?: unknown; arguments?: unknown; args?: unknown };
  // `name` and `args` are accepted as aliases: models trained on the OpenAI
  // shape reach for them constantly, and refusing the synonym would make the
  // model look incapable of something it did correctly.
  const name = typeof record.tool === "string" ? record.tool : record.name;
  if (typeof name !== "string" || !known.includes(name)) {
    return { text: withoutThinking.trim(), toolCalls: [] };
  }

  const rawArguments = record.arguments ?? record.args;
  const args =
    rawArguments && typeof rawArguments === "object" && !Array.isArray(rawArguments)
      ? (rawArguments as Record<string, unknown>)
      : {};

  // The prose around the call is kept — models often say "Let me look at the
  // screen" before the JSON, and that sentence is the one worth showing.
  const text = withoutThinking
    .replace(candidate, "")
    .replace(/```(json)?/gi, "")
    .trim();
  return { text, toolCalls: [{ name, arguments: args }] };
}

/**
 * Did the model announce a next step instead of taking it?
 *
 * THIS IS A REAL FAILURE MODE, NOT A HYPOTHETICAL. Measured on a live run: asked
 * to open Notepad and type into it, a 1.5B model opened Notepad correctly and
 * then replied "I have opened Notepad. Now, I will type ..." with no JSON. The
 * loop reads "no tool call" as "the model has finished", so the task ended one
 * step early while sounding like it was about to continue — the worst possible
 * combination, because the transcript claims an intention the product never
 * carried out.
 *
 * A model that says it is ABOUT to act has not finished. Recognising that and
 * asking once for the action alone is a protocol repair rather than a
 * workaround: the model's decision is unchanged, only its formatting is.
 *
 * Deliberately narrow. "I have opened Notepad" alone does not match — that is a
 * completed report. It takes a forward-looking statement of intent.
 */
const ANNOUNCEMENT =
  // Verb STEMS, not whole words. The first version listed `type` and missed
  // "Next, I will try typing …" — the exact sentence that ended a live task one
  // step early. A stem list costs nothing and catches the gerund, which is the
  // form models reach for most often when narrating.
  /\b(?:i'?(?:m| am| will| shall|ll)|now i(?:'?ll| will)?|next(?:,| i)|let me|going to|i can now|i should)\b[^.!?]{0,90}\b(?:open|typ|click|press|writ|read|search|look|check|mov|switch|scroll|navigat|find|us|try|attempt|enter|fill)/i;

export function announcesAnotherStep(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Only the tail matters: a summary of what was done often uses the same
  // verbs, and an intention — when there is one — is the last thing said.
  return ANNOUNCEMENT.test(trimmed.slice(-240));
}

/** The one-line correction sent when the model narrated instead of acting. */
export const ACT_NOW_NUDGE =
  "You described the next step but did not take it. Reply with ONLY the JSON action object for that step and nothing else. If the task is genuinely finished, say so in one sentence without describing any further steps.";
