/**
 * The organization ceiling, read on the SERVER with the caller's own client.
 *
 * WHY A SECOND READER AND NOT A SECOND AUTHORITY. `authority.ts` reads the same
 * two tables through the browser client, and both hand their rows to the same
 * `ceilingFrom` in `policy.ts` — the rule that combines them lives in exactly
 * one place. What differs is only which client asks, and that difference
 * matters: a server function must not trust a ceiling the browser calculated
 * and sent, or the policy would be advice a modified client could decline.
 *
 * The caller's client, not the admin one. Row-level security restricts the
 * policy table to organizations the caller belongs to, so asking as them
 * returns exactly their own — and asking as the service role would return every
 * workspace in the deployment, which is a far larger answer than the question.
 *
 * FAILS OPEN, for the reason set out in `authority.ts`: this is a workspace's
 * stated rules rather than an authorization boundary, and an unreadable policy
 * table must not lock somebody out of a product whose policy row, on almost
 * every account, does not exist.
 */
import { ceilingFrom, isPolicyCapability, isPolicyToolDomain, NO_CEILING } from "./policy";
import type { PolicyCeiling } from "./policy";

type PolicyReader = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
};

/** Bounds "how many workspaces one person may be in", not a list that grows. */
const MAX_ORGANIZATIONS = 200;

export async function policyCeilingFor(client: unknown): Promise<PolicyCeiling> {
  try {
    const reader = client as PolicyReader;
    const [policies, organizations] = await Promise.all([
      reader
        .from("ocade_organization_policies")
        .select("organization_id, withheld_capabilities, withheld_tool_domains, updated_at")
        .limit(MAX_ORGANIZATIONS),
      reader.from("ocade_organizations").select("id, name").limit(MAX_ORGANIZATIONS),
    ]);
    if (policies.error || !Array.isArray(policies.data)) return NO_CEILING;

    const names = new Map<string, string>();
    if (Array.isArray(organizations.data)) {
      for (const row of organizations.data as { id?: unknown; name?: unknown }[]) {
        if (typeof row.id === "string" && typeof row.name === "string") names.set(row.id, row.name);
      }
    }

    return ceilingFrom(
      (policies.data as Record<string, unknown>[]).map((row) => ({
        organizationId: String(row["organization_id"] ?? ""),
        withheldCapabilities: asArray(row["withheld_capabilities"]).filter(isPolicyCapability),
        withheldToolDomains: asArray(row["withheld_tool_domains"]).filter(isPolicyToolDomain),
        updatedAt: typeof row["updated_at"] === "string" ? row["updated_at"] : null,
      })),
      names,
    );
  } catch {
    return NO_CEILING;
  }
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
