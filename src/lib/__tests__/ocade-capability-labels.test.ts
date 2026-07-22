import { describe, it, expect } from "vitest";
import {
  capabilityLabelFor,
  isLocalLabel,
  leaksRawModelIdentity,
  OCADE_CAPABILITY_LABELS,
} from "../ocade-capability-labels";
import { ocadeCreatorStatement, ocadeChatCapabilityDisclosure } from "../ocade-identity";

describe("OCADE capability labels", () => {
  it("maps engines to user-facing labels without raw model names", () => {
    expect(capabilityLabelFor({ locality: "cloud" })).toBe("OCADE Cloud");
    expect(capabilityLabelFor({ locality: "local" })).toBe("OCADE Local");
    expect(capabilityLabelFor({ locality: "local", profile: "fast" })).toBe("OCADE Local Fast");
    expect(capabilityLabelFor({ locality: "local", profile: "vision" })).toBe("OCADE Local Vision");
    expect(capabilityLabelFor({ locality: "local", profile: "code" })).toBe("OCADE Local Code");
    expect(capabilityLabelFor({ locality: "cloud", automatic: true })).toBe("OCADE Automatic");
  });

  it("no capability label contains a raw provider/model identity", () => {
    for (const label of OCADE_CAPABILITY_LABELS) {
      expect(leaksRawModelIdentity(label)).toBe(false);
    }
  });

  it("classifies local vs cloud labels", () => {
    expect(isLocalLabel("OCADE Local Vision")).toBe(true);
    expect(isLocalLabel("OCADE Cloud")).toBe(false);
  });

  describe("leaksRawModelIdentity guard", () => {
    it.each(["running on gpt-4o-mini", "powered by Gemini", "openai/gpt-5.5", "uses Llama 3"])(
      "flags leak: %s",
      (s) => expect(leaksRawModelIdentity(s)).toBe(true),
    );
    it.each(["I'm using OCADE Cloud", "This ran on OCADE Local Vision"])(
      "allows clean text: %s",
      (s) => expect(leaksRawModelIdentity(s)).toBe(false),
    );
  });
});

describe("chat identity disclosure", () => {
  it("uses the confirmed creator wording", () => {
    expect(ocadeCreatorStatement()).toBe("I am OCADE, developed and created by CAERA CADANE.");
  });

  it("discloses the capability tier in chat without leaking a raw model", () => {
    const line = ocadeChatCapabilityDisclosure("OCADE Cloud");
    expect(line).toContain("developed and created by CAERA CADANE");
    expect(line).toContain("OCADE Cloud");
    expect(line).toContain("advanced settings");
    expect(leaksRawModelIdentity(line)).toBe(false);
  });
});
