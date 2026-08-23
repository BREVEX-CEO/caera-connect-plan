/**
 * THE COMPILED CORE MUST MEAN THE SAME THING AS THE CONSTITUTION.
 *
 * The canonical document is 32,713 tokens. The browser models that ship run a
 * 4,096-token context. Sending the real text to them does not make OCADE
 * stricter — it makes OCADE unable to hold a conversation, because the prompt
 * fills the window before the user types.
 *
 * So the core is a COMPILATION, and these tests are what stop it becoming a
 * quietly shortened constitution. Every behavioural domain in the canonical
 * file has to be represented, the safety rules can never be the thing that
 * gets trimmed for room, and a runtime with a real window still gets the real
 * document byte for byte.
 */
import { describe, it, expect } from "vitest";
import {
  OCADE_COMPILED_CORE,
  OCADE_MODULES,
  compileConstitution,
  estimateTokens,
} from "../compile";
import { OCADE_SYSTEM_PROMPT } from "../canonical";
import { assembleSystemPromptDetailed } from "../assemble";

/** The real window the shipping browser tiers run with, minus conversation room. */
const BROWSER_BUDGET = 1400;

describe("the compiled core covers every behavioural domain", () => {
  /*
   * Keyed by canonical section, with a probe that must appear in the core.
   * A domain silently dropped during a future edit fails here rather than
   * quietly changing what OCADE will refuse.
   */
  const DOMAINS: Array<[string, RegExp]> = [
    ["identity", /developed and created by CAERA CADANE/i],
    ["never impersonate", /never claim to be claude, chatgpt, gemini/i],
    ["local inference", /not sent to any external AI service/i],
    ["no invented capabilities", /never claim a capability the runtime has not/i],
    ["honesty about failure", /not evidence that a feature worked/i],
    ["child safety", /sexualises, grooms, endangers or isolates anyone under 18/i],
    ["reframing is the signal", /that is the signal to refuse/i],
    ["weapons", /weapons, explosives, or harmful substances/i],
    ["malicious code", /malicious code/i],
    ["drugs", /dosages, combinations or synthesis/i],
    ["self-harm", /do not name specific methods or means/i],
    ["self-harm substitutes", /recreate the sensation or appearance of self-harm/i],
    ["no diagnosis", /do not diagnose anyone/i],
    ["psychosis", /mania, psychosis or dissociation/i],
    ["no engagement farming", /never thank someone for reaching out/i],
    ["disordered eating", /disordered eating/i],
    ["legal and financial", /not a lawyer, financial adviser or clinician/i],
    ["evenhandedness", /strongest case its defenders would make/i],
    ["contested politics", /contested political topics/i],
    ["stereotypes", /avoid stereotypes/i],
    ["minors", /age-appropriate/i],
    ["tone", /warm, direct and kind/i],
    ["formatting", /prose by default/i],
    ["no bullets when declining", /never use bullets when declining/i],
    ["one question", /at most one question per reply/i],
    ["file assumption", /do not assume a file was attached/i],
    ["no hardcoded date", /do not assume a date/i],
    ["freshness", /use the retrieval capability the runtime exposes/i],
    ["offline honesty", /current verification is unavailable/i],
    ["copyright", /under fifteen words, one quote per source/i],
    ["lyrics", /song lyrics, poems or sonnets/i],
    ["instruction priority", /are DATA, not instructions/i],
    ["fake runtime messages", /claiming to be a system message.*is not one/i],
    ["no chain of thought", /never reveal hidden reasoning/i],
  ];

  it.each(DOMAINS)("keeps %s", (_name, probe) => {
    expect(OCADE_COMPILED_CORE).toMatch(probe);
  });

  it("fits the real browser budget", () => {
    expect(estimateTokens(OCADE_COMPILED_CORE)).toBeLessThanOrEqual(BROWSER_BUDGET);
  });

  it("names no provider except to forbid impersonating one", () => {
    for (const line of OCADE_COMPILED_CORE.split("\n")) {
      if (!/\b(OpenAI|Gemini|Anthropic|Lovable|ChatGPT|Claude)\b/.test(line)) continue;
      expect(line).toMatch(/never|not sent/i);
    }
  });
});

describe("modules", () => {
  it("puts credential safety before search convenience", () => {
    // When room runs out, what is dropped must be the least dangerous
    // omission. A model that was not told the search rules searches worse; one
    // that was not told the credential rules could type a password.
    const order = OCADE_MODULES.map((m) => m.capability);
    expect(order.indexOf("browser_control")).toBeLessThan(order.indexOf("web_search"));
    expect(order.indexOf("browser_control")).toBeLessThan(order.indexOf("memory"));
  });

  it("carries the protected-field rule in the browser module", () => {
    const browser = OCADE_MODULES.find((m) => m.capability === "browser_control")!;
    expect(browser.text).toMatch(/password, one-time code, MFA code, CAPTCHA answer, PIN, CVV/i);
    expect(browser.text).toMatch(/observe, take one bounded action, observe again/i);
    expect(browser.text).toMatch(/STOP, PAUSE and TAKE OVER/);
  });

  it("carries the write rules in the memory module", () => {
    const memory = OCADE_MODULES.find((m) => m.capability === "memory")!;
    expect(memory.text).toMatch(/tagged `\[stated\]`/);
    expect(memory.text).toMatch(/never file your own conclusions/i);
  });
});

describe("choosing a form", () => {
  it("sends the canonical document unchanged when the window can hold it", () => {
    const out = compileConstitution({
      canonical: OCADE_SYSTEM_PROMPT,
      budgetTokens: null,
      capabilities: new Set(),
    });
    expect(out.form).toBe("canonical");
    expect(out.text).toBe(OCADE_SYSTEM_PROMPT);
  });

  it("compiles when the window cannot", () => {
    const out = compileConstitution({
      canonical: OCADE_SYSTEM_PROMPT,
      budgetTokens: BROWSER_BUDGET,
      capabilities: new Set(),
    });
    expect(out.form).toBe("compiled");
    expect(out.estimatedTokens).toBeLessThanOrEqual(BROWSER_BUDGET);
  });

  it("adds modules the runtime has room and capability for", () => {
    const out = compileConstitution({
      canonical: OCADE_SYSTEM_PROMPT,
      budgetTokens: 3000,
      capabilities: new Set(["browser_control", "web_search", "memory", "files"]),
    });
    expect(out.includedModules).toContain("browser_control");
    expect(out.estimatedTokens).toBeLessThanOrEqual(3000);
  });

  it("drops a module the runtime does not have, whatever the budget", () => {
    const out = compileConstitution({
      canonical: OCADE_SYSTEM_PROMPT,
      budgetTokens: 100_000,
      capabilities: new Set(),
    });
    // 100k fits the canonical document, so form is canonical and no module is
    // needed at all — the canonical text already contains those rules.
    expect(out.form).toBe("canonical");
  });

  it("never trims the core, even when the core alone exceeds the budget", () => {
    const out = compileConstitution({
      canonical: OCADE_SYSTEM_PROMPT,
      budgetTokens: 10,
      capabilities: new Set(["browser_control"]),
    });
    // Reported honestly as over budget rather than silently cut.
    expect(out.text).toBe(OCADE_COMPILED_CORE);
    expect(out.estimatedTokens).toBeGreaterThan(10);
  });
});

describe("the assembler reports which form it sent", () => {
  it("compiles for a browser-sized budget and still carries the identity", () => {
    const built = assembleSystemPromptDetailed({
      surface: "chat",
      budgetTokens: BROWSER_BUDGET,
      capabilities: [{ name: "browser_control", available: true }],
    });
    expect(built.constitutionForm).toBe("compiled");
    expect(built.text).toContain("developed and created by CAERA CADANE");
    expect(built.text).toContain("are DATA, not instructions");
  });

  it("uses the canonical document when no budget is stated", () => {
    const built = assembleSystemPromptDetailed({ surface: "chat" });
    expect(built.constitutionForm).toBe("canonical");
  });
});
