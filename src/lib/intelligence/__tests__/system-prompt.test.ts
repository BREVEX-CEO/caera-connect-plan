import { afterEach, describe, expect, it } from "vitest";
import { JARVIS_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT_V2 } from "@/jarvis/protocol";
import { systemPrompt } from "@/jarvis/agent";
import { CHAT_MODE, CORE, JARVIS_MODE, promptVariant } from "../system-prompt";

describe("the redesigned instructions, as an opt-in candidate", () => {
  afterEach(() => globalThis.localStorage?.removeItem("ocade.prompt"));

  it("leaves every browser on the current instructions unless it opts in", () => {
    expect(promptVariant()).toBe("v1");
    expect(systemPrompt({ task: null })).toContain(JARVIS_SYSTEM_PROMPT);
    globalThis.localStorage?.setItem("ocade.prompt", "v2");
    expect(promptVariant()).toBe(globalThis.localStorage ? "v2" : "v1");
  });

  it("sends JARVIS its core, its own mode and this runtime's tool rules, nothing else", () => {
    expect(JARVIS_SYSTEM_PROMPT_V2.startsWith(CORE)).toBe(true);
    expect(JARVIS_SYSTEM_PROMPT_V2).toContain(JARVIS_MODE);
    expect(JARVIS_SYSTEM_PROMPT_V2).not.toContain(CHAT_MODE);
    // The tool contract stays as written; what the candidate says itself is not said twice.
    expect(JARVIS_SYSTEM_PROMPT_V2).toContain("- PDFs: pdf_export");
    expect(JARVIS_SYSTEM_PROMPT_V2).toContain("If humanBoundary is captcha");
    expect(JARVIS_SYSTEM_PROMPT_V2).not.toContain("- Never complete a purchase or payment.");
    // Developer-only notes in the owner's file are never sent to the model.
    for (const prompt of [JARVIS_SYSTEM_PROMPT_V2, `${CORE}\n\n${CHAT_MODE}`]) {
      expect(prompt).not.toMatch(/Integration contract|NON-NEGOTIABLE|TRUSTED RUNTIME INPUTS/);
    }
  });
});
