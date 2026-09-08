/**
 * WHAT AN ORGANIZATION ALLOWS ITS MEMBERS TO USE — PLAN.md §21 and §G.
 *
 * Pure rules, no Supabase and no React, for the same reason the rest of the
 * organization model is: what a workspace permits is a question a test should
 * be able to ask without a database.
 *
 * IT IS A CEILING, NOT A SWITCH. The policy can only take capability away. A
 * capability an organization allows is still subject to every check that
 * already governs it — the device probe, the permission prompt, the risk band,
 * the protected-input rule. Nothing here grants anything, which is what keeps
 * it from becoming a second authority over capabilities that already have one.
 *
 * THE VOCABULARIES ARE THE PRODUCT'S OWN, NOT NEW ONES. Capabilities are
 * `CapabilityId` — the same eleven the product already reports on, so an
 * administrator withholding "computerControl" is withholding exactly the thing
 * the person sees named that. Tools are `Domain` — the seven the agent router
 * already groups by, so withholding one removes a whole coherent area rather
 * than a list of individual tool names that would go stale the day one is
 * added.
 *
 * THE STRICTEST ORGANIZATION WINS. Somebody can belong to several, and there is
 * no "acting as" selector on the surfaces this governs — the capability badge
 * and the agent loop have no organization in hand. Taking the union of what
 * every organization withholds is the fail-closed answer, and it is also the
 * one an administrator would expect: a workspace that forbids machine control
 * does not stop forbidding it because its member also belongs to a workspace
 * that allows it.
 *
 * WHAT IT DOES NOT CLAIM. This is a product control, like the device policy
 * beside it, and OCADE says so on the screen. The agent runs on the person's
 * own machine; a policy delivered to that machine is enforced there. It is not
 * a promise that somebody who rewrites their own client cannot act — nothing
 * running on hardware they control could be. What it IS: the workspace's stated
 * rules, applied everywhere OCADE acts on their behalf, recorded when changed,
 * and readable by every member so nobody is quietly missing a feature.
 */
import { CAPABILITY_ORDER, type CapabilityId } from "@/lib/capabilities/types";
import { DOMAINS, type Domain } from "@/lib/agent/domains";

/** Capabilities an organization may withhold. */
export const POLICY_CAPABILITIES: readonly CapabilityId[] = CAPABILITY_ORDER;

/**
 * Tool areas an organization may withhold.
 *
 * `conversation` is deliberately absent. It is the domain that touches no
 * machine — talking, and what OCADE remembers between sessions — and an
 * organization that withheld it would leave its members with a product that
 * cannot answer them. A policy control whose only setting is "break it" is not
 * a control.
 */
export const POLICY_TOOL_DOMAINS: readonly Domain[] = DOMAINS.filter(
  (domain) => domain !== "conversation",
);

export interface OrganizationPolicy {
  organizationId: string;
  withheldCapabilities: readonly CapabilityId[];
  withheldToolDomains: readonly Domain[];
  updatedAt: string | null;
}

/** What one account may not use, across every organization it belongs to. */
export interface PolicyCeiling {
  capabilities: ReadonlySet<CapabilityId>;
  toolDomains: ReadonlySet<Domain>;
  /** Which organization withheld each thing, so a person can be told who. */
  withheldBy: ReadonlyMap<string, readonly string[]>;
}

export const NO_CEILING: PolicyCeiling = {
  capabilities: new Set(),
  toolDomains: new Set(),
  withheldBy: new Map(),
};

export function isPolicyCapability(value: unknown): value is CapabilityId {
  return typeof value === "string" && (POLICY_CAPABILITIES as readonly string[]).includes(value);
}

export function isPolicyToolDomain(value: unknown): value is Domain {
  return typeof value === "string" && (POLICY_TOOL_DOMAINS as readonly string[]).includes(value);
}

/**
 * Combine the policies of every organization an account belongs to.
 *
 * `names` maps organization id to the name a person would recognise. A missing
 * name is skipped rather than rendered as an id: "your organization has turned
 * this off" is a true sentence, and "8f3a…-c1 has turned this off" is a true
 * sentence nobody can act on.
 */
export function ceilingFrom(
  policies: readonly OrganizationPolicy[],
  names: ReadonlyMap<string, string> = new Map(),
): PolicyCeiling {
  const capabilities = new Set<CapabilityId>();
  const toolDomains = new Set<Domain>();
  const withheldBy = new Map<string, string[]>();

  const attribute = (key: string, organizationId: string) => {
    const name = names.get(organizationId);
    if (!name) return;
    const already = withheldBy.get(key) ?? [];
    if (!already.includes(name)) withheldBy.set(key, [...already, name]);
  };

  for (const policy of policies) {
    for (const capability of policy.withheldCapabilities) {
      capabilities.add(capability);
      attribute(capability, policy.organizationId);
    }
    for (const domain of policy.withheldToolDomains) {
      toolDomains.add(domain);
      attribute(domain, policy.organizationId);
    }
  }

  return { capabilities, toolDomains, withheldBy };
}

/**
 * The sentence a person reads where the capability used to be.
 *
 * Names the workspace when OCADE knows it, because "an organization you belong
 * to" sends somebody who belongs to three to ask three administrators.
 */
export function withheldExplanation(ceiling: PolicyCeiling, key: string): string {
  const owners = ceiling.withheldBy.get(key) ?? [];
  if (owners.length === 1) return `${owners[0]} has turned this off for its members.`;
  if (owners.length > 1) {
    return `${owners.slice(0, -1).join(", ")} and ${owners[owners.length - 1]} have turned this off for their members.`;
  }
  return "An organization you belong to has turned this off for its members.";
}

/** Remove the areas a policy withholds, keeping the caller's order. */
export function permittedDomains(
  domains: readonly Domain[],
  ceiling: PolicyCeiling,
): readonly Domain[] {
  return domains.filter((domain) => !ceiling.toolDomains.has(domain));
}
