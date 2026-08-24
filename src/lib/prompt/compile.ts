/**
 * Fitting the constitution into the model that actually ships.
 *
 * THE MEASUREMENT THAT FORCED THIS. `scripts/measure-prompt-size.mjs` reads the
 * canonical file and reports 117,765 bytes — about 32,713 tokens. The browser
 * browser models OCADE ships are Qwen2.5-1.5B and 3B running with a 4,096-token
 * context. Reserving a sensible share for the conversation leaves roughly
 * 1,400 tokens for the system message. The full constitution is more than
 * twenty times that. Its `ocade_behavior` section ALONE is 6,244 tokens.
 *
 * So capability-gating whole sections, which is what the assembler did before,
 * could never be enough: the sections that survive gating are still an order
 * of magnitude too large. Sending the full text to a browser model does not
 * produce a stricter OCADE; it produces one that cannot hold a conversation,
 * because the prompt consumes the entire window before the user has typed.
 *
 * WHAT THIS IS NOT. It is not a shortened constitution with rules dropped to
 * save room. `src/prompts/core/OCADE_CORE.md` is a COMPILATION: every
 * behavioural domain in the canonical document — identity, honesty, child
 * safety, weapons and drugs, wellbeing and self-harm, legal and financial
 * caution, evenhandedness, tone and formatting, current information, copyright
 * limits, instruction priority — is present in compressed form. The modules
 * carry the tool-specific rules and are added when the runtime has that tool
 * AND the budget has room. A test asserts every canonical domain is covered
 * and fails if one is dropped.
 *
 * WHEN THE BUDGET IS LARGE, THE CANONICAL TEXT IS USED UNCHANGED. A desktop
 * runtime with a 32k window gets the real document, byte for byte. The
 * compilation is a concession to small hardware, not a replacement.
 */
import CORE from "@/prompts/core/OCADE_CORE.md?raw";
import MODULE_MEMORY from "@/prompts/core/OCADE_MODULE_memory.md?raw";
import MODULE_SEARCH from "@/prompts/core/OCADE_MODULE_search.md?raw";
import MODULE_BROWSER from "@/prompts/core/OCADE_MODULE_browser.md?raw";
import MODULE_FILES from "@/prompts/core/OCADE_MODULE_files.md?raw";

/** The compiled always-present core. Never gated, never trimmed further. */
export const OCADE_COMPILED_CORE: string = CORE.trim();

/**
 * Modules, each keyed by the capability that makes it relevant.
 *
 * Ordered by how badly its absence would hurt. When the budget runs out
 * part-way down this list, what is dropped is the least dangerous omission:
 * a model that has not been told the search rules simply searches less well,
 * whereas one that has not been told the credential rules could type a
 * password.
 */
export const OCADE_MODULES: ReadonlyArray<{ capability: string; text: string }> = [
  { capability: "browser_control", text: MODULE_BROWSER.trim() },
  { capability: "files", text: MODULE_FILES.trim() },
  { capability: "web_search", text: MODULE_SEARCH.trim() },
  { capability: "memory", text: MODULE_MEMORY.trim() },
];

/**
 * Estimate tokens from bytes.
 *
 * The browser tokenizers cannot be loaded here, and loading one to size a
 * prompt would mean initialising a model to decide what to send it. For
 * English prose through a Qwen BPE vocabulary the ratio sits between 3.6 and
 * 4.0 bytes per token; the low end is used deliberately so the estimate errs
 * towards "too big", which is the safe direction — over-estimating trims a
 * module, under-estimating overflows the window and truncates the rules.
 */
export const BYTES_PER_TOKEN = 3.6;

export function estimateTokens(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.codePointAt(i)!;
    if (c > 0xffff) i += 1;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

export interface CompiledConstitution {
  text: string;
  /** "canonical" when the real document went out unchanged. */
  form: "canonical" | "compiled";
  includedModules: string[];
  droppedModules: string[];
  estimatedTokens: number;
}

/**
 * Build the largest faithful constitution that fits.
 *
 * `budgetTokens` is the room the CALLER has for a system message, which it
 * gets from the model's real context window rather than from a guess here.
 * `null` means unbounded and always yields the canonical text.
 */
export function compileConstitution(input: {
  canonical: string;
  budgetTokens: number | null;
  capabilities: ReadonlySet<string>;
}): CompiledConstitution {
  const canonicalTokens = estimateTokens(input.canonical);
  if (input.budgetTokens === null || canonicalTokens <= input.budgetTokens) {
    return {
      text: input.canonical,
      form: "canonical",
      includedModules: [],
      droppedModules: [],
      estimatedTokens: canonicalTokens,
    };
  }

  const parts = [OCADE_COMPILED_CORE];
  let used = estimateTokens(OCADE_COMPILED_CORE);
  const included: string[] = [];
  const dropped: string[] = [];

  for (const mod of OCADE_MODULES) {
    if (!input.capabilities.has(mod.capability)) {
      dropped.push(mod.capability);
      continue;
    }
    const cost = estimateTokens(mod.text) + 2; // the blank line between blocks
    if (used + cost > input.budgetTokens) {
      dropped.push(mod.capability);
      continue;
    }
    parts.push(mod.text);
    used += cost;
    included.push(mod.capability);
  }

  /*
   * The core is never trimmed, even when it alone exceeds the budget.
   *
   * A device whose window cannot hold the core is a device that cannot run
   * OCADE safely, and silently cutting the safety rules to fit would be the
   * worst possible response. The over-budget total is reported instead so the
   * caller can refuse honestly.
   */
  return {
    text: parts.join("\n\n"),
    form: "compiled",
    includedModules: included,
    droppedModules: dropped,
    estimatedTokens: used,
  };
}
