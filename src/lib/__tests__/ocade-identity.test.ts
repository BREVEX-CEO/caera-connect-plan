import { describe, it, expect } from "vitest";
import {
  OCADE_IDENTITY,
  ocadeIntro,
  ocadeHonestDisclosure,
  isIdentityProbe,
} from "../ocade-identity";

describe("OCADE identity contract", () => {
  it("names CAERA CADANE as the vendor", () => {
    expect(OCADE_IDENTITY.vendor).toBe("CAERA CADANE");
    expect(OCADE_IDENTITY.displayName).toBe("OCADE");
  });

  it("intro never leaks a provider and always brands OCADE", () => {
    const intro = ocadeIntro();
    expect(intro).toContain("OCADE by CAERA CADANE");
    expect(intro.toLowerCase()).not.toMatch(/openai|gpt|gemini|claude|llama|ollama/);
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
      expect(out).toContain("developed and created by CAERA CADANE");
      expect(out).toContain("gpt-4o-mini");
      expect(out).toContain("openai");
      expect(out).toContain("cloud");
      expect(out).toContain("Model Settings");
    });

    it("never fabricates a model when metadata is missing", () => {
      const out = ocadeHonestDisclosure({});
      expect(out).toContain("developed and created by CAERA CADANE");
      expect(out).toContain("Model Settings");
      expect(out.toLowerCase()).not.toMatch(/gpt-|gemini|llama|claude/);
    });
  });
});
