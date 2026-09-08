import { describe, it, expect } from "vitest";
import {
  capabilityLabelFor,
  isLocalLabel,
  leaksRawModelIdentity,
  redactRawModelIdentity,
  OCADE_CAPABILITY_LABELS,
} from "../ocade-capability-labels";
import {
  ocadeCreatorStatement,
  ocadeChatCapabilityDisclosure,
  isIdentityProbe,
} from "../ocade-identity";

describe("OCADE capability labels", () => {
  it("maps engines to user-facing labels without raw model names", () => {
    expect(capabilityLabelFor({ locality: "local" })).toBe("OCADE Local");
    expect(capabilityLabelFor({ locality: "local", profile: "fast" })).toBe("OCADE Local Fast");
    expect(capabilityLabelFor({ locality: "local", profile: "vision" })).toBe("OCADE Local Vision");
    expect(capabilityLabelFor({ locality: "local", profile: "code" })).toBe("OCADE Local Code");
    expect(capabilityLabelFor({ locality: "local", automatic: true })).toBe("OCADE Automatic");
  });

  it("no capability label contains a raw provider/model identity", () => {
    for (const label of OCADE_CAPABILITY_LABELS) {
      expect(leaksRawModelIdentity(label)).toBe(false);
    }
  });

  it("classifies local labels", () => {
    expect(isLocalLabel("OCADE Local Vision")).toBe(true);
  });

  describe("leaksRawModelIdentity guard", () => {
    it.each(["running on gpt-4o-mini", "powered by Gemini", "openai/gpt-5.5", "uses Llama 3"])(
      "flags leak: %s",
      (s) => expect(leaksRawModelIdentity(s)).toBe(true),
    );
    it.each(["I'm using OCADE Local", "This ran on OCADE Local Vision"])(
      "allows clean text: %s",
      (s) => expect(leaksRawModelIdentity(s)).toBe(false),
    );
  });
});

describe("chat identity disclosure", () => {
  it("uses the confirmed creator wording", () => {
    expect(ocadeCreatorStatement()).toBe(
      "I am OCADE, an AI workspace built for Chat, Cowork and Code. I was created by the founder of CARCC CADANE.",
    );
  });

  it("discloses the capability tier in chat without leaking a raw model", () => {
    const line = ocadeChatCapabilityDisclosure("OCADE Local");
    expect(line).toContain("created by the founder of CARCC CADANE");
    expect(line).toContain("OCADE Local");
    expect(line).toContain("advanced settings");
    expect(leaksRawModelIdentity(line)).toBe(false);
  });
});

/**
 * The system prompt ASKS the model not to print raw vendor names; it cannot
 * guarantee it. A leak that reaches storage is re-fed as context on every later
 * turn, so it must be redacted before it is persisted.
 */
describe("redacting a leaked model identity before storage", () => {
  it.each([
    "I'm running on GPT-4o today.",
    "This was answered by Claude.",
    "Powered by Gemini Pro.",
    "Using llama3.1 via Ollama.",
    "Served through OpenAI.",
  ])("removes the raw name from %s", (text) => {
    const clean = redactRawModelIdentity(text);
    expect(leaksRawModelIdentity(clean)).toBe(false);
    expect(clean).toContain("the OCADE engine");
  });

  it("replaces EVERY occurrence, not just the first", () => {
    const clean = redactRawModelIdentity("GPT-4 and Claude and Gemini walk into a bar.");
    expect(leaksRawModelIdentity(clean)).toBe(false);
  });

  it("leaves an already-clean answer untouched", () => {
    const clean = "I'm using OCADE Local for this request.";
    expect(redactRawModelIdentity(clean)).toBe(clean);
  });

  /** Redacting must not discard the answer — it is usually still useful. */
  it("keeps the surrounding content intact", () => {
    const clean = redactRawModelIdentity("The capital of France is Paris. Answered by GPT-4.");
    expect(clean).toContain("The capital of France is Paris.");
  });

  it("handles empty input without throwing", () => {
    expect(redactRawModelIdentity("")).toBe("");
  });
});

describe("identity probes route to the capability disclosure", () => {
  it.each([
    "what model are you",
    "What model are you using?",
    "who made you",
    "are you chatgpt",
    "what are you built on",
  ])("recognises %s as an identity question", (q) => {
    expect(isIdentityProbe(q)).toBe(true);
  });

  it("does not fire on ordinary questions", () => {
    expect(isIdentityProbe("what is the capital of France")).toBe(false);
    expect(isIdentityProbe("model the data for me")).toBe(false);
  });

  /** The answer it routes to must itself be clean. */
  it("produces a disclosure that leaks nothing", () => {
    const answer = ocadeChatCapabilityDisclosure("OCADE Local");
    expect(leaksRawModelIdentity(answer)).toBe(false);
    expect(answer).toContain("OCADE Local");
    expect(answer).toContain("CARCC CADANE");
  });
});
