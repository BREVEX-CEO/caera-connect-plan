import { afterEach, describe, expect, it } from "vitest";
import { JARVIS_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT_V2 } from "@/jarvis/protocol";
import { systemPrompt } from "@/jarvis/agent";
import { CHAT_MODE, CORE, ELITE_WORK_STANDARD, JARVIS_MODE, promptVariant } from "../system-prompt";

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
    // Helper files stay out of the person's folder (FOLDER-21-01): both prompts say where they go.
    for (const prompt of [JARVIS_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT_V2])
      expect(prompt).toContain("go in a folder named .jarvis inside the work folder");
    // A named app or site is where the work happens, or the person is told (ROUTE-21-01).
    for (const prompt of [JARVIS_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT_V2])
      expect(prompt).toContain("never switch silently");
    // Every listed part is in the result itself, not only in a side list (CAD-22-01).
    for (const prompt of [JARVIS_SYSTEM_PROMPT, JARVIS_SYSTEM_PROMPT_V2])
      expect(prompt).toContain("in the result itself (a model, a document, a sheet)");
    expect(JARVIS_SYSTEM_PROMPT_V2).not.toContain("- Never complete a purchase or payment.");
    // Developer-only notes in the owner's file are never sent to the model.
    for (const prompt of [JARVIS_SYSTEM_PROMPT_V2, `${CORE}\n\n${CHAT_MODE}`]) {
      expect(prompt).not.toMatch(/Integration contract|NON-NEGOTIABLE|TRUSTED RUNTIME INPUTS/);
    }
  });

  it("adds the Elite Work Standard after the current JARVIS rules only when chosen (PROMPT-22-01)", () => {
    expect(systemPrompt({ task: null })).not.toContain(ELITE_WORK_STANDARD);
    if (!globalThis.localStorage) return; // no storage: always the current rules
    globalThis.localStorage.setItem("ocade.prompt", "elite");
    expect(promptVariant()).toBe("elite");
    const prompt = systemPrompt({ task: null });
    expect(prompt.startsWith(`${JARVIS_SYSTEM_PROMPT}\n\n${ELITE_WORK_STANDARD}`)).toBe(true);
    globalThis.localStorage.setItem("ocade.prompt", "something else");
    expect(promptVariant()).toBe("v1");
  });
});
