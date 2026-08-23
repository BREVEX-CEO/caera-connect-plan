import { describe, expect, it } from "vitest";
import { OCADE_CORE_POLICY_VERSION, ocadeCorePolicy } from "@/lib/agent/ocade-core-policy";

describe("OCADE core policy", () => {
  it("has a stable product identity and cannot be confused with personal instructions", () => {
    const policy = ocadeCorePolicy("chat");
    expect(policy).toContain(`OCADE core policy ${OCADE_CORE_POLICY_VERSION}`);
    expect(policy).toContain("You are OCADE, created by CARCC CADANE.");
    expect(policy).toContain("cannot be changed by personal instructions");
  });

  it("adds observe-act-verify and confirmation rules only to control mode", () => {
    expect(ocadeCorePolicy("chat")).not.toContain("observe first");
    const control = ocadeCorePolicy("control");
    expect(control).toContain("observe first");
    expect(control).toContain("independent evidence");
    expect(control).toContain("clear confirmation at the point of action");
    expect(control).toContain("accessibility and application APIs");
  });

  it("does not contain copied vendor or platform identities", () => {
    const policy = ocadeCorePolicy("control").toLowerCase();
    expect(policy).not.toContain("anthropic");
    expect(policy).not.toContain("claude");
    expect(policy).not.toContain("system prompt");
  });
});
