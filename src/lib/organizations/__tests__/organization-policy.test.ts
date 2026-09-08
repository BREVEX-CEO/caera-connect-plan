import { describe, expect, it } from "vitest";
import {
  ceilingFrom,
  isPolicyCapability,
  isPolicyToolDomain,
  permittedDomains,
  POLICY_CAPABILITIES,
  POLICY_TOOL_DOMAINS,
  withheldExplanation,
  type OrganizationPolicy,
} from "../policy";
import { CAPABILITY_ORDER } from "@/lib/capabilities/types";
import { DOMAINS, type Domain } from "@/lib/agent/domains";

/**
 * The rules an organization policy follows, without a database.
 *
 * The vocabularies are asserted against the product's OWN lists rather than
 * against a copy: a policy that could withhold a capability the product does
 * not have, or could not withhold one it does, is a policy an administrator is
 * relying on and OCADE is quietly ignoring.
 */

const policy = (over: Partial<OrganizationPolicy> & { organizationId: string }) => ({
  withheldCapabilities: [],
  withheldToolDomains: [],
  updatedAt: null,
  ...over,
});

describe("the vocabularies are the product's own", () => {
  it("can withhold exactly the capabilities the product reports on", () => {
    expect([...POLICY_CAPABILITIES]).toEqual([...CAPABILITY_ORDER]);
  });

  it("can withhold every tool area except the one that touches no machine", () => {
    expect([...POLICY_TOOL_DOMAINS]).toEqual(DOMAINS.filter((d) => d !== "conversation"));
    // Withholding it would leave members with a product that cannot answer them.
    expect(POLICY_TOOL_DOMAINS).not.toContain("conversation");
  });

  it("recognises its own members and nothing else", () => {
    expect(isPolicyCapability("computerControl")).toBe(true);
    expect(isPolicyCapability("conversation")).toBe(false);
    expect(isPolicyCapability("")).toBe(false);
    expect(isPolicyToolDomain("os_app")).toBe(true);
    expect(isPolicyToolDomain("conversation")).toBe(false);
    expect(isPolicyToolDomain(7)).toBe(false);
  });
});

describe("combining the organizations one person belongs to", () => {
  it("withholds anything ANY of them withholds", () => {
    const ceiling = ceilingFrom([
      policy({ organizationId: "a", withheldCapabilities: ["computerControl"] }),
      policy({ organizationId: "b", withheldToolDomains: ["web"] }),
    ]);
    expect(ceiling.capabilities.has("computerControl")).toBe(true);
    expect(ceiling.toolDomains.has("web")).toBe(true);
  });

  it("does not let a permissive workspace undo a strict one", () => {
    // The failure this prevents: belonging to a second workspace becomes a way
    // to opt out of the first one's rules.
    const ceiling = ceilingFrom([
      policy({ organizationId: "strict", withheldCapabilities: ["browser"] }),
      policy({ organizationId: "open" }),
    ]);
    expect(ceiling.capabilities.has("browser")).toBe(true);
  });

  it("names the workspace so a person knows who to ask", () => {
    const ceiling = ceilingFrom(
      [policy({ organizationId: "a", withheldCapabilities: ["voice"] })],
      new Map([["a", "Northwind Traders"]]),
    );
    expect(withheldExplanation(ceiling, "voice")).toEqual(
      "Northwind Traders has turned this off for its members.",
    );
  });

  it("names all of them when more than one did", () => {
    const ceiling = ceilingFrom(
      [
        policy({ organizationId: "a", withheldCapabilities: ["voice"] }),
        policy({ organizationId: "b", withheldCapabilities: ["voice"] }),
      ],
      new Map([
        ["a", "Northwind"],
        ["b", "Contoso"],
      ]),
    );
    expect(withheldExplanation(ceiling, "voice")).toEqual(
      "Northwind and Contoso have turned this off for their members.",
    );
  });

  it("says something true rather than an id when it has no name", () => {
    const ceiling = ceilingFrom([policy({ organizationId: "a", withheldCapabilities: ["voice"] })]);
    expect(withheldExplanation(ceiling, "voice")).toEqual(
      "An organization you belong to has turned this off for its members.",
    );
  });

  it("does not repeat a workspace that withheld two things", () => {
    const ceiling = ceilingFrom(
      [policy({ organizationId: "a", withheldCapabilities: ["voice", "vision"] })],
      new Map([["a", "Northwind"]]),
    );
    expect(withheldExplanation(ceiling, "voice")).toEqual(
      "Northwind has turned this off for its members.",
    );
    expect(withheldExplanation(ceiling, "vision")).toEqual(
      "Northwind has turned this off for its members.",
    );
  });
});

describe("narrowing what OCADE may act on", () => {
  it("removes withheld areas and keeps the caller's order", () => {
    const ceiling = ceilingFrom([policy({ organizationId: "a", withheldToolDomains: ["os_app"] })]);
    const asked: Domain[] = ["web", "os_app", "files"];
    expect(permittedDomains(asked, ceiling)).toEqual(["web", "files"]);
  });

  it("leaves everything alone when nothing is withheld", () => {
    const asked: Domain[] = ["web", "files"];
    expect(permittedDomains(asked, ceilingFrom([]))).toEqual(asked);
  });
});
