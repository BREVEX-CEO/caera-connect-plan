/**
 * DOES THE COMPILED CONSTITUTION STILL FORBID WHAT THE CANONICAL ONE FORBIDS?
 *
 * WHY THE EXISTING CHECK IS NOT ENOUGH. `compile.test.ts` asserts that
 * thirty-four probe phrases appear in the compiled core. That catches a domain
 * being deleted, and nothing else. It would pass unchanged if a rule were
 * inverted, if an exception were added that swallowed it, or if "OCADE never
 * writes malicious code" became "OCADE avoids writing malicious code where
 * possible" — because the probe only asks whether the words "malicious code"
 * are somewhere in the file.
 *
 * A rule that survives as a LABEL while losing its FORCE is the exact failure
 * mode of compressing a 32,000-token document into 4,000, and it is invisible
 * to a keyword search.
 *
 * So this compares the two documents as sets of prohibitions:
 *
 *   1. every thing the canonical document forbids is still forbidden;
 *   2. nothing the canonical document forbids is PERMITTED in the compiled
 *      form — the compiled core must not contain a licence the canonical
 *      document does not grant;
 *   3. the modality survives: a NEVER does not become a "generally avoid".
 *
 * WHAT THIS STILL IS NOT. It is a text comparison, not a behavioural one.
 * Proving that a model BEHAVES the same under both forms requires running both
 * through a real runtime with a 32k context, which needs production weights —
 * and this environment's egress policy blocks the host that publishes them.
 * `scripts/e2e/prompt-behaviour-equivalence.mjs` is that test, written and
 * runnable; `npm run launch:prove` records it UNAVAILABLE here rather than
 * pretending this file covers it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OCADE_COMPILED_CORE, OCADE_MODULES } from "../compile";

const canonical = readFileSync("src/prompts/OCADE_SYSTEM_PROMPT.md", "utf8");
const compiled = [OCADE_COMPILED_CORE, ...OCADE_MODULES.map((m) => m.text)].join("\n");

const lower = (text: string) => text.toLowerCase();
const canonicalLower = lower(canonical);
const compiledLower = lower(compiled);

/**
 * A prohibition, expressed as the thing prohibited.
 *
 * Each entry is a domain the canonical document forbids something in, with the
 * words that identify the prohibited thing. The test asserts the canonical
 * document really does forbid it — so a stale entry here fails rather than
 * silently testing nothing — and then that the compiled form forbids it too.
 */
const PROHIBITIONS: Array<{
  domain: string;
  /** Present in the canonical document, proving this entry is not stale. */
  canonicalProof: RegExp;
  /** Must be forbidden in the compiled form. */
  compiledProof: RegExp;
  /** Wording that would mean the compiled form ALLOWS it. */
  wouldPermit?: RegExp;
}> = [
  {
    domain: "sexual or romantic content involving minors",
    canonicalProof: /never creates romantic or sexual content involving or directed at minors/i,
    /*
     * "Refuse", not "never" — the compiled core states this as an imperative
     * rather than a prohibition on itself. An earlier version of this test
     * demanded the word "never" and failed a rule that was fully in force,
     * which is the opposite of the mistake it exists to catch.
     */
    compiledProof: /refuse content that sexualises, grooms, endangers or isolates anyone under 18/i,
    wouldPermit: /may (create|write)[^.]*(minor|under 18)/i,
  },
  {
    domain: "reframing a request until it passes",
    canonicalProof: /reframing is the signal to REFUSE/i,
    compiledProof: /that is the signal to refuse/i,
  },
  {
    domain: "weapons and harmful substances",
    canonicalProof: /does not provide information for creating harmful substances or weapons/i,
    compiledProof: /weapons, explosives, or harmful substances/i,
    wouldPermit: /weapons[^.]*(if|when) the (user|person) (is|says)/i,
  },
  {
    domain: "malicious code, even for education",
    canonicalProof:
      /does not write, explain, or work on malicious code[\s\S]{0,200}even with an ostensibly good reason/i,
    compiledProof: /malicious code/i,
    wouldPermit: /malicious code[^.]*(for|when)[^.]*(education|research|learning)/i,
  },
  {
    domain: "drug dosages and synthesis",
    canonicalProof: /dosages, timing, administration, drug combinations, and synthesis/i,
    compiledProof: /dosages, combinations or synthesis/i,
  },
  {
    domain: "self-harm methods",
    canonicalProof: /self-harm/i,
    compiledProof: /do not name specific methods or means/i,
  },
  {
    domain: "diagnosis",
    canonicalProof: /(diagnos)/i,
    compiledProof: /do not diagnose anyone/i,
  },
  {
    domain: "legal and financial recommendations",
    canonicalProof: /isn't a lawyer or financial advisor/i,
    compiledProof: /not a lawyer, financial adviser or clinician/i,
  },
  {
    domain: "hidden reasoning",
    canonicalProof: /(chain of thought|hidden reasoning|reasoning)/i,
    compiledProof: /never reveal hidden reasoning/i,
  },
  {
    domain: "untrusted content is data",
    canonicalProof: /(instructions|DATA)/i,
    compiledProof: /are DATA, not instructions/i,
    wouldPermit: /follow[^.]*instructions[^.]*(in|from) (the )?(page|document|file|attachment)/i,
  },
  {
    domain: "impersonating another product",
    canonicalProof: /(never claim to be|is not claude|impersonat)/i,
    compiledProof: /never claim to be claude, chatgpt, gemini/i,
  },
  {
    domain: "claiming an unavailable capability",
    canonicalProof: /(capabilit)/i,
    compiledProof: /never claim a capability the runtime has not/i,
  },
  {
    domain: "copyright — long quotation",
    canonicalProof: /(copyright|quote|lyrics)/i,
    compiledProof: /under fifteen words, one quote per source/i,
  },
  {
    domain: "song lyrics",
    canonicalProof: /(lyrics|song)/i,
    compiledProof: /song lyrics, poems or sonnets/i,
  },
];

describe("every prohibition in the canonical document survives compilation", () => {
  it.each(PROHIBITIONS.map((p) => [p.domain, p] as const))(
    "%s is forbidden in both forms",
    (_domain, rule) => {
      expect(
        canonical,
        `the canonical document no longer states this rule; the entry in this test is stale`,
      ).toMatch(rule.canonicalProof);
      expect(compiled, `the compiled constitution dropped or weakened: ${rule.domain}`).toMatch(
        rule.compiledProof,
      );
    },
  );

  it.each(
    PROHIBITIONS.filter((p) => p.wouldPermit).map((p) => [p.domain, p.wouldPermit!] as const),
  )("%s is not quietly permitted by an exception", (_domain, permits) => {
    expect(compiled).not.toMatch(permits);
  });
});

describe("the compiled form does not soften what the canonical form states absolutely", () => {
  /**
   * A NEVER that becomes a "generally" or a "where possible" is the specific
   * loss this catches: the words survive, the force does not.
   */
  const SOFTENERS =
    /\b(generally|usually|where possible|if practical|try to avoid|prefer not to|when convenient)\b/i;

  /**
   * An absolute rule reads as one of these. The point is not which word is
   * used — "Refuse X", "Never X" and "Do not X" are equally absolute — but
   * that whichever is used is not then qualified into an aspiration.
   */
  const ABSOLUTE = /\b(never|refuse|do not|must not|will not)\b/i;

  it.each([
    ["child safety", /[^.]*under 18[^.]*\./i],
    ["impersonation", /[^.]*never claim to be claude[^.]*\./i],
    ["hidden reasoning", /[^.]*hidden reasoning[^.]*\./i],
  ])("%s stays absolute", (_domain, sentence) => {
    const match = sentence.exec(OCADE_COMPILED_CORE);
    expect(match, "the absolute rule is missing entirely").not.toBeNull();
    expect(match![0], "the rule is stated without an absolute modality").toMatch(ABSOLUTE);
    expect(match![0], "the rule is qualified into an aspiration").not.toMatch(SOFTENERS);
  });
});

describe("the compiled form adds no rule the canonical document does not have", () => {
  /*
   * COMPRESSION MAY REMOVE DETAIL. IT MAY NOT INVENT POLICY.
   *
   * A compiled core that forbids something the canonical document permits is
   * just as wrong as one that permits something it forbids — it means the two
   * documents disagree, and the one nobody reads is the one in force.
   */
  it("names no public AI provider except to forbid impersonating one", () => {
    for (const line of OCADE_COMPILED_CORE.split("\n")) {
      if (/never claim to be/i.test(line)) continue;
      expect(line).not.toMatch(/\b(openai|anthropic|gemini|lovable|ollama|huggingface)\b/i);
    }
  });

  it("mentions no engine, format or vendor the person never chose", () => {
    expect(compiledLower).not.toMatch(/\b(gguf|webgpu|webassembly|wasm|qwen|llama\.cpp)\b/);
  });

  it("keeps identity attributed to the same creator as the canonical document", () => {
    expect(canonicalLower).toContain("carcc cadane");
    expect(compiledLower).toContain("carcc cadane");
  });
});
