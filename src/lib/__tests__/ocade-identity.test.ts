import { describe, it, expect } from "vitest";
import {
  OCADE_IDENTITY,
  ocadeIntro,
  ocadeHonestDisclosure,
  ocadeIdentityAnswer,
  isDirectOcadeIdentityQuestion,
  isIdentityProbe,
} from "../ocade-identity";

describe("OCADE identity contract", () => {
  it("names CARCC CADANE as the vendor", () => {
    expect(OCADE_IDENTITY.vendor).toBe("CARCC CADANE");
    expect(OCADE_IDENTITY.displayName).toBe("OCADE");
  });

  it("uses the exact canonical OCADE identity", () => {
    expect(OCADE_IDENTITY.statement).toBe(
      "I am OCADE, an AI workspace built for Chat, Cowork and Code. I was created by the founder of CARCC CADANE.",
    );
    expect(ocadeIntro()).toBe(OCADE_IDENTITY.statement);
  });

  it("intro never leaks a provider and always brands OCADE", () => {
    const intro = ocadeIntro();
    expect(intro).toContain("OCADE");
    expect(intro).toContain("CARCC CADANE");
    expect(intro.toLowerCase()).not.toMatch(/openai|gpt|gemini|claude|llama|ollama/);
  });

  describe("deterministic product identity", () => {
    it.each([
      "Who are you?",
      "What are you?",
      "Who created you?",
      "Who created OCADE?",
      "Who made OCADE?",
    ])("answers %s from OCADE identity, not backend identity", (question) => {
      expect(ocadeIdentityAnswer(question)).toBe(OCADE_IDENTITY.statement);
      expect(isDirectOcadeIdentityQuestion(question)).toBe(true);
    });

    it("explains OCADE and its operation without model branding", () => {
      const product = ocadeIdentityAnswer("What is OCADE?")!;
      const architecture = ocadeIdentityAnswer("How does OCADE work?")!;
      expect(product).toContain("Chat, Cowork and Code");
      expect(architecture).toMatch(/intelligence path|permissions|projects, tasks and artifacts/i);
      for (const answer of [product, architecture]) {
        expect(answer.toLowerCase()).not.toMatch(/gemini|qwen|llama|ollama|gguf|openai|claude/);
      }
    });

    it("does not intercept a technical implementation question", () => {
      expect(ocadeIdentityAnswer("What model are you using?")).toBeNull();
      expect(isDirectOcadeIdentityQuestion("What model are you using?")).toBe(false);
    });
  });

  describe("isIdentityProbe", () => {
    it.each([
      "What model are you?",
      "which model is this",
      "Are you ChatGPT?",
      "are you claude",
      "are you gemini",
      "who made you",
      "who built you",
      "what powers you",
    ])("detects identity probe: %s", (msg) => {
      expect(isIdentityProbe(msg)).toBe(true);
    });

    it.each(["Hello there", "Summarize this document", "What's the weather like?"])(
      "does not flag ordinary message: %s",
      (msg) => {
        expect(isIdentityProbe(msg)).toBe(false);
      },
    );
  });

  describe("ocadeHonestDisclosure", () => {
    it("truthfully names the active model + provider when known", () => {
      const out = ocadeHonestDisclosure({
        providerId: "openai",
        modelId: "gpt-4o-mini",
        locality: "cloud",
      });
      expect(out).toContain(OCADE_IDENTITY.statement);
      expect(out).toContain("gpt-4o-mini");
      expect(out).toContain("openai");
      expect(out).toContain("cloud");
      expect(out).toContain("Model Settings");
    });

    it("never fabricates a model when metadata is missing", () => {
      const out = ocadeHonestDisclosure({});
      expect(out).toContain(OCADE_IDENTITY.statement);
      expect(out).toContain("Model Settings");
      expect(out.toLowerCase()).not.toMatch(/gpt-|gemini|llama|claude/);
    });
  });
});
