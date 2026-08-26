/**
 * Learning something from a conversation without being told to.
 *
 * WHAT WAS MISSING
 * ----------------
 * OCADE remembered only what it was explicitly told to remember: the model had
 * to choose to call `memory_remember`, and a small model in the middle of a
 * task almost never does. So a user could spend an hour explaining how their
 * work is organised and OCADE would start the next session knowing none of it.
 *
 * The archive had the missing half — not an extractor, which is easy, but the
 * POLICY for when to run one, which is the part that is easy to get wrong. Its
 * thresholds are in `primary-logic/memory/sessionMemoryPolicy`. This file is
 * the adapter: it holds one policy state per conversation, asks the local
 * engine for facts when the policy says the moment has come, and writes what
 * survives a stricter-than-usual filter.
 *
 * WHY THE FILTER IS STRICTER HERE THAN FOR A TYPED MEMORY
 * ------------------------------------------------------
 * `addLocalMemory` never refuses what a person typed, and it is right not to —
 * overruling somebody about their own memory is not the interface's job. But
 * nobody asked for these. A memory OCADE decided to keep on its own has to
 * clear a higher bar than one a person chose, because the cost of a wrong one
 * is a recall the user never consented to and cannot easily explain.
 */

import {
  abandonExtraction,
  beginExtraction,
  completeExtraction,
  createSessionMemoryState,
  noteToolCalls,
  shouldExtract,
  type SessionMemoryConfig,
  type SessionMemoryState,
} from "@/primary-logic/memory/sessionMemoryPolicy";
import { assessMemory, WHAT_NOT_TO_REMEMBER } from "@/lib/memory/quality";

/** How many facts one extraction may keep. Past this it is note-taking. */
const MAX_PER_EXTRACTION = 3;
const MAX_FACT_LENGTH = 240;

const states = new Map<string, SessionMemoryState>();

function stateFor(key: string): SessionMemoryState {
  const existing = states.get(key);
  if (existing) return existing;
  const fresh = createSessionMemoryState();
  states.set(key, fresh);
  return fresh;
}

export function resetSessionMemory(key?: string) {
  if (key === undefined) states.clear();
  else states.delete(key);
}

/** Count work done, so the next threshold check can see it. */
export function noteWork(key: string, toolCalls: number) {
  states.set(key, noteToolCalls(stateFor(key), toolCalls));
}

export interface TranscriptLine {
  role: string;
  content: string;
}

/**
 * The prompt. Short on purpose: this runs on the same local engine that is
 * answering the user, and a long extraction prompt is latency the user feels.
 */
export function extractionPrompt(transcript: readonly TranscriptLine[]): string {
  const conversation = transcript
    .slice(-40)
    .map((line) => `${line.role === "user" ? "User" : "OCADE"}: ${line.content}`)
    .join("\n")
    .slice(-6_000);

  return [
    "Read this conversation and write down anything about the user that will",
    "still be true next week — how they work, what they prefer, what their",
    "projects and people are called.",
    "",
    "Rules:",
    ...WHAT_NOT_TO_REMEMBER.map((rule) => `- Do not record ${rule}`),
    "- One fact per line, starting with '- '.",
    `- At most ${MAX_PER_EXTRACTION} lines.`,
    "- Write 'NOTHING' on its own if there is nothing worth keeping. That is a",
    "  normal answer and most conversations deserve it.",
    "",
    "Conversation:",
    conversation,
  ].join("\n");
}

/**
 * Turn the model's reply into facts worth keeping.
 *
 * Everything here is a refusal to trust the model's formatting: it may answer
 * in prose, repeat itself, restate the instructions, or write ten lines when it
 * was asked for three.
 */
export function parseExtracted(reply: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map((item) => item.trim().toLowerCase()));
  const facts: string[] = [];

  for (const raw of reply.split("\n")) {
    const line = raw
      .trim()
      .replace(/^[-*•]\s*/, "")
      .trim();
    if (!line) continue;
    if (/^nothing\b/i.test(line)) return [];
    // A model restating the brief is not a fact about the user.
    if (/^(rules?|conversation|facts?|memor(y|ies))\s*:/i.test(line)) continue;
    if (line.length < 8 || line.length > MAX_FACT_LENGTH) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;

    // The higher bar: anything the quality check has a remark about is dropped
    // rather than saved with a note, because there is no person here to read
    // the note and decide.
    const note = assessMemory(line);
    if (!note.keep || note.reason !== null) continue;

    seen.add(key);
    facts.push(line);
    if (facts.length >= MAX_PER_EXTRACTION) break;
  }

  return facts;
}

export interface SessionMemoryDeps {
  /** Ask the local engine. Returns null when it could not answer. */
  complete: (prompt: string) => Promise<string | null>;
  /** Memories already held, so an extraction does not re-save them. */
  existing: () => readonly string[];
  /** Save one fact. Returning false means it was not saved. */
  save: (content: string) => boolean;
}

/**
 * Run an extraction if the policy says this is the moment.
 *
 * Returns what was saved — empty when the thresholds were not met, when the
 * engine had nothing, or when everything it offered failed the filter. All
 * three are ordinary.
 */
export async function considerSessionMemory(
  key: string,
  input: {
    tokenCount: number;
    transcript: readonly TranscriptLine[];
    deps: SessionMemoryDeps;
    config?: SessionMemoryConfig;
  },
): Promise<string[]> {
  const state = stateFor(key);
  if (!shouldExtract(state, input.tokenCount, input.config)) return [];

  states.set(key, beginExtraction(state));
  try {
    const reply = await input.deps.complete(extractionPrompt(input.transcript));
    if (reply === null) {
      states.set(key, abandonExtraction(stateFor(key)));
      return [];
    }
    const facts = parseExtracted(reply, input.deps.existing());
    const saved = facts.filter((fact) => input.deps.save(fact));
    states.set(key, completeExtraction(stateFor(key), input.tokenCount));
    return saved;
  } catch {
    /*
     * An extraction that threw must not poison the conversation it was
     * watching. The thresholds stay where they were, so the next turn tries
     * again rather than the session giving up on memory entirely.
     */
    states.set(key, abandonExtraction(stateFor(key)));
    return [];
  }
}
