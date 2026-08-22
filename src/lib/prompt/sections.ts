/**
 * The canonical prompt, split into its top-level sections.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A LOOPHOLE.
 *
 * The constitution is roughly 29,000 tokens. A 3B model running in a browser
 * tab has a context window between 4K and 32K, and on a machine without
 * graphics acceleration prefill is measured in minutes: this repository's own
 * chat screen warns the user when a prompt crosses 5,654 tokens because that
 * one took 458 seconds to read. Sending all 29,000 to every surface would not
 * produce a stricter OCADE. It would produce an OCADE that never answers.
 *
 * Two of the sections are 65% of the whole document — `memory_filesystem`
 * (~11,200 tokens) and `search_instructions` (~7,900 tokens) — and both
 * describe how to operate tools. The constitution's own instruction is that
 * "OCADE must inspect the current capability manifest and use only tools that
 * are actually available" and that schemas "should be injected dynamically by
 * the application rather than copied into this system prompt."
 *
 * So the rule here is capability-gated, not budget-gated: a section that
 * teaches a tool is included when the runtime exposes that tool and omitted
 * when it does not. Omitting instructions for a memory filesystem that does
 * not exist on this device is following the constitution, not trimming it.
 *
 * What can NEVER be dropped is the behaviour itself — identity, refusals,
 * wellbeing, evenhandedness, browser-control discipline, the local-inference
 * requirement and instruction priority. Those are in REQUIRED_SECTIONS and
 * there is no argument, budget or caller that removes them.
 */
import { OCADE_SYSTEM_PROMPT } from "./canonical";

export interface PromptSection {
  /** Heading text without the leading "# ". `""` for text before any heading. */
  name: string;
  /** The section including its own heading line, exactly as written. */
  text: string;
}

let cached: PromptSection[] | null = null;

/** Split on top-level `# heading` lines. Deterministic; computed once. */
export function promptSections(): PromptSection[] {
  if (cached) return cached;
  const lines = OCADE_SYSTEM_PROMPT.split("\n");
  const out: PromptSection[] = [];
  let name = "";
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) out.push({ name, text });
  };
  for (const line of lines) {
    const heading = /^# ([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(line);
    if (heading) {
      flush();
      name = heading[1];
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }
  flush();
  cached = out;
  return out;
}

/**
 * Sections that are present on every surface, in every runtime, always.
 *
 * If a section is here, no capability check and no context budget removes it.
 */
export const REQUIRED_SECTIONS: ReadonlySet<string> = new Set([
  "ocade_behavior",
  "conversation_termination_behavior",
  "persistent_storage_behavior",
  "request_evaluation_and_output",
  "runtime_tool_contract",
  "local_inference_and_application_contract",
  "available_capabilities",
  "network_configuration",
  "instruction_priority_and_integrity",
]);

/**
 * Sections that teach a specific tool, and the capability that makes them
 * relevant. Absent capability means the instructions describe something the
 * model cannot do, so including them invites it to try.
 */
export const CAPABILITY_GATED_SECTIONS: ReadonlyMap<string, string> = new Map([
  ["memory_filesystem", "memory"],
  ["search_instructions", "web_search"],
  ["connected_services_behavior", "connected_services"],
  ["past_chat_behavior", "past_chat_search"],
  ["preferences_info", "preferences"],
  ["computer_and_browser_use", "browser_control"],
]);
