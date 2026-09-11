import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  Loader2,
  Mail,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge, type Status } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import type { AssuranceRefusal } from "@/lib/security/assurance";
import { proveIdentityWithPassword } from "@/lib/security/reauthentication";
import { resolveChannels, deploymentChannelConfiguration } from "@/lib/notifications/channels";
import {
  createGroup,
  createOrganization,
  deleteGroup,
  deleteOrganization,
  inviteToOrganization,
  listOrganizations,
  loadOrganization,
  loadOrganizationPolicy,
  removeMember,
  renameOrganization,
  resendOrganizationInvite,
  revokeOrganizationInvite,
  setGroupMembership,
  setMemberRole,
  setMemberState,
  setOrganizationPolicy,
  transferOwnership,
  type Outcome,
} from "@/lib/organizations/authority";
import {
  blockedReason,
  canAdminister,
  inviteState,
  matchesSearch,
  slugProblem,
  suggestSlug,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationSnapshot,
} from "@/lib/organizations/model";
import { POLICY_CAPABILITIES, POLICY_TOOL_DOMAINS } from "@/lib/organizations/policy";
import { allCapabilityReports } from "@/lib/capabilities/registry";
import { DOMAIN_LABELS } from "@/lib/agent/domains";
import {
  createInviteToken,
  hashInviteToken,
  inviteExpiry,
  inviteLink,
} from "@/lib/organizations/invite-token";
import { useFormatters } from "@/lib/locale/use-formatters";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({
    meta: [{ title: "Organization — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: OrganizationPage,
});

/**
 * ORGANIZATION ADMINISTRATION — PLAN.md §F.
 *
 * WHAT THIS SCREEN IS NOT: the authorisation. Every control here is disabled or
 * hidden according to the role the SERVER reported, and every action it takes
 * is a SECURITY DEFINER function that re-resolves that role against the row it
 * is about. §F says "UI visibility is not authorization. Direct API and
 * forged-browser attempts must fail", and the schema's own suite proves the
 * second half under `SET ROLE authenticated`. Hiding a button here is a
 * courtesy, not a lock.
 *
 * WHY REFUSALS ARE SHOWN VERBATIM. Every refusal the schema raises is a
 * sentence written for a person — "This is the last owner. Transfer ownership
 * first." — and rewriting them here would mean two places to keep in step and
 * a generic "something went wrong" the first time they fell out of step.
 */
function OrganizationPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /*
   * A refusal the person can DO something about, kept apart from `problem`.
   *
   * It carries the action that was refused, so proving identity finishes the
   * thing they were doing instead of returning them to an empty form. Somebody
   * who has just typed an organization's name to confirm deleting it should not
   * have to type it again because their session was nine minutes older than the
   * rule allows.
   */
  const [refusal, setRefusal] = useState<{
    reason: AssuranceRefusal;
    message: string;
    retry: () => Promise<void>;
  } | null>(null);

  const organizations = useQuery({
    queryKey: ["organizations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: listOrganizations,
  });

  const list = organizations.data?.ok ? organizations.data.value : [];
  const activeId = selectedId ?? list[0]?.id ?? null;

  const snapshot = useQuery({
    queryKey: ["organization", activeId],
    enabled: Boolean(activeId),
    queryFn: () => loadOrganization(activeId as string),
  });

  /** One place to run an action, report its refusal, and refresh. */
  const run = useCallback(
    async <T,>(key: string, action: () => Promise<Outcome<T>>, success: string) => {
      const attempt = async (): Promise<T | null> => {
        setBusy(key);
        setProblem(null);
        setNotice(null);
        const result = await action();
        setBusy(null);
        if (!result.ok) {
          /*
           * Two kinds of no. "This is the last owner" is a fact about the
           * organization and there is nothing to press; "confirm it is you" is
           * a door, and showing it as a red sentence would leave somebody
           * stuck in front of an action they are entitled to take.
           */
          if (result.reason) {
            setRefusal({
              reason: result.reason,
              message: result.message,
              retry: async () => {
                await attempt();
              },
            });
          } else {
            setRefusal(null);
            setProblem(result.message);
          }
          return null;
        }
        setRefusal(null);
        setNotice(success);
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        await queryClient.invalidateQueries({ queryKey: ["organization"] });
        return result.value;
      };
      return attempt();
    },
    [queryClient],
  );

  if (organizations.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <PageHeader eyebrow="Team" title="Organization" />
        <GlassPanel className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your organizations…
        </GlassPanel>
      </div>
    );
  }

  if (organizations.data && !organizations.data.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <PageHeader eyebrow="Team" title="Organization" />
        <GlassPanel className="p-6">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {organizations.data.message}
          </p>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Team"
        title="Organization"
        description="People, roles, invitations and groups for the workspaces you belong to."
      />

      {refusal ? (
        <ConfirmIdentity
          reason={refusal.reason}
          message={refusal.message}
          email={user?.email ?? null}
          onProved={refusal.retry}
          onDismiss={() => setRefusal(null)}
        />
      ) : null}
      {problem ? (
        <GlassPanel className="mb-4 p-4" role="alert">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        </GlassPanel>
      ) : null}
      {notice ? (
        <GlassPanel className="mb-4 p-4" role="status">
          <p className="flex items-start gap-2 text-sm text-[color:var(--state-success)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        </GlassPanel>
      ) : null}

      {list.length === 0 ? (
        <CreateOrganization
          busy={busy === "create"}
          onCreate={(name, slug) =>
            run("create", () => createOrganization(name, slug), "Organization created.")
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {list.length > 1 ? (
            <GlassPanel className="p-4">
              <Label htmlFor="organization-picker">Organization</Label>
              <select
                id="organization-picker"
                className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={activeId ?? ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {list.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </GlassPanel>
          ) : null}

          {snapshot.isLoading ? (
            <GlassPanel className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading this organization…
            </GlassPanel>
          ) : null}

          {snapshot.data && !snapshot.data.ok ? (
            <GlassPanel className="p-6">
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {snapshot.data.message}
              </p>
            </GlassPanel>
          ) : null}

          {snapshot.data?.ok ? (
            <OrganizationDetail
              snapshot={snapshot.data.value}
              viewerId={user?.id ?? null}
              busy={busy}
              run={run}
            />
          ) : null}

          <CreateOrganization
            busy={busy === "create"}
            onCreate={(name, slug) =>
              run("create", () => createOrganization(name, slug), "Organization created.")
            }
          />
        </div>
      )}
    </div>
  );
}

type Run = <T>(
  key: string,
  action: () => Promise<Outcome<T>>,
  success: string,
) => Promise<T | null>;

/**
 * THE DOOR, NOT THE APOLOGY.
 *
 * The database refuses a high-risk organization action when the session is not
 * strongly and recently authenticated, and it says which of the two is missing.
 * They need different things from the person, and offering the wrong one is
 * worse than offering nothing: somebody who needs an authenticator code and is
 * shown a password box will type a password, be told it is not enough, and have
 * learned nothing about what to do next.
 *
 * WHY THE ACTION IS RETRIED RATHER THAN THE FORM RESET. Proving identity is not
 * what the person came to do. Finishing the thing they were doing is, and a
 * confirmation that has to be re-typed after a security prompt is how people
 * learn to keep their sessions permanently fresh instead.
 *
 * The password proof is `proveIdentityWithPassword`, the same mechanism the
 * security settings and sign-in-method screens use. It signs in against the
 * CURRENT password on the SAME session, so the page does not change underneath
 * anybody — and the refreshed token carries a new entry in its
 * authentication-methods list, which is exactly what the database was asking
 * for.
 */
function ConfirmIdentity({
  reason,
  message,
  email,
  onProved,
  onDismiss,
}: {
  reason: AssuranceRefusal;
  message: string;
  email: string | null;
  onProved: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function prove(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const outcome = await proveIdentityWithPassword(email, password);
    if (!outcome.proved) {
      setBusy(false);
      setProblem(
        outcome.reason === "no_email"
          ? "OCADE cannot confirm this account's email address, so it cannot check a password here. Sign in again to continue."
          : "That password did not match. If you have never set one — you sign in with Google, Apple or a one-time code — set a password in Settings › Security first.",
      );
      return;
    }
    setPassword("");
    await onProved();
    setBusy(false);
  }

  return (
    <GlassPanel className="mb-4 p-4" role="alert">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{message}</span>
      </p>

      {reason === "factor_required" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link to="/challenge" search={{ next: "/organization" }}>
              Enter the code from your authenticator
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
        </div>
      ) : (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={prove}>
          <div className="min-w-0 flex-1">
            <Label htmlFor="organization-reauth-password">Your password</Label>
            <Input
              id="organization-reauth-password"
              type="password"
              autoComplete="current-password"
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={problem ? "organization-reauth-problem" : undefined}
              aria-invalid={problem ? true : undefined}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy || password.length === 0}>
              {busy ? "Confirming…" : "Confirm and continue"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {problem ? (
        <p id="organization-reauth-problem" className="mt-2 text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </GlassPanel>
  );
}

function CreateOrganization({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (name: string, slug: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touchedSlug, setTouchedSlug] = useState(false);

  // The handle follows the name until somebody edits it, and then stops — a
  // field that keeps overwriting what you typed is worse than an empty one.
  const effectiveSlug = touchedSlug ? slug : suggestSlug(name);
  const problem = name.trim() ? slugProblem(effectiveSlug) : null;

  return (
    <GlassPanel className="p-5">
      <h2 className="text-base font-semibold">New organization</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You become its first owner. An organization always has at least one.
      </p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem || !name.trim() || !effectiveSlug) return;
          void onCreate(name.trim(), effectiveSlug).then(() => {
            setName("");
            setSlug("");
            setTouchedSlug(false);
          });
        }}
      >
        <div>
          <Label htmlFor="organization-name">Name</Label>
          <Input
            id="organization-name"
            className="mt-1.5"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Northwind Traders"
          />
        </div>
        <div>
          <Label htmlFor="organization-slug">Handle</Label>
          <Input
            id="organization-slug"
            className="mt-1.5"
            value={effectiveSlug}
            maxLength={40}
            aria-describedby={problem ? "organization-slug-problem" : undefined}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              setTouchedSlug(true);
              setSlug(event.target.value);
            }}
            placeholder="northwind-traders"
          />
          {problem ? (
            <p id="organization-slug-problem" className="mt-1.5 text-xs text-destructive">
              {problem}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || !name.trim() || Boolean(problem)}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Building2 aria-hidden="true" />
            )}
            Create organization
          </Button>
        </div>
      </form>
    </GlassPanel>
  );
}

function OrganizationDetail({
  snapshot,
  viewerId,
  busy,
  run,
}: {
  snapshot: OrganizationSnapshot;
  viewerId: string | null;
  busy: string | null;
  run: Run;
}) {
  const formatters = useFormatters();
  const { organization, role, members, invites, groups, events, truncated } = snapshot;
  const administers = canAdminister(role);
  const owner = role === "owner";
  const [search, setSearch] = useState("");

  const shown = useMemo(
    () => members.filter((member) => matchesSearch(member, search)),
    [members, search],
  );

  return (
    <>
      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{organization.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {organization.slug} · {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
          <StatusBadge status="active">
            You are {role === "admin" ? "an admin" : `the ${role}`}
          </StatusBadge>
        </div>
        {administers ? (
          <RenamePanel
            currentName={organization.name}
            busy={busy === "rename"}
            onRename={(name) =>
              run("rename", () => renameOrganization(organization.id, name), "Name updated.")
            }
          />
        ) : null}
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" aria-hidden="true" />
            People
          </h2>
          <div className="w-full sm:w-64">
            <Label htmlFor="member-search" className="sr-only">
              Search people
            </Label>
            <Input
              id="member-search"
              type="search"
              placeholder="Search by name, address or role"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {truncated.members ? (
          /*
           * Said out loud rather than shown silently. A member list that is
           * quietly missing people is worse than one that admits it — somebody
           * searching for a colleague who is not in the first page would
           * conclude they had left.
           */
          <p className="mt-3 text-xs text-[color:var(--state-warning)]">
            This organization has more members than one page shows. The list and the search below
            cover the first {members.length}.
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-border">
          {shown.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              members={members}
              isViewer={member.userId === viewerId}
              administers={administers}
              owner={owner}
              busy={busy}
              organizationId={organization.id}
              run={run}
            />
          ))}
          {shown.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">
              {search ? "Nobody here matches that." : "This organization has no members yet."}
            </li>
          ) : null}
        </ul>
      </GlassPanel>

      {administers ? (
        <InvitationsPanel
          organizationId={organization.id}
          invites={invites}
          canInviteOwner={owner}
          busy={busy}
          run={run}
        />
      ) : null}

      <PolicyPanel
        organizationId={organization.id}
        administers={administers}
        busy={busy}
        run={run}
      />

      {administers ? (
        <GroupsPanel
          organizationId={organization.id}
          groups={groups}
          members={members}
          busy={busy}
          run={run}
        />
      ) : null}

      {administers && events.length > 0 ? (
        <GlassPanel className="p-5">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every membership change, recorded by the database that made it.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {events.slice(0, 25).map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{event.event}</code>
                <span className="text-muted-foreground">
                  {formatters.dateTime(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}

      {owner ? (
        <DangerZone
          organizationId={organization.id}
          organizationName={organization.name}
          busy={busy === "delete"}
          run={run}
        />
      ) : null}
    </>
  );
}

/**
 * WHAT THIS WORKSPACE ALLOWS ITS MEMBERS TO USE — PLAN.md §21 and §G.
 *
 * SHOWN TO EVERY MEMBER, not only to administrators. Every other panel on this
 * screen is about administering other people and is correctly hidden; this one
 * is about what the person reading it can do. Somebody whose machine control
 * has quietly gone needs to be able to find out why without filing a bug, and
 * an organization's rules are not a secret from the people they govern.
 *
 * WITHHELD, NOT ALLOWED, and the checkboxes say so. A list of what is permitted
 * would have to be extended every time OCADE grows a capability, and the day
 * somebody forgot, existing workspaces would silently lose a feature they had
 * never decided anything about. Ticking a box takes something away; an empty
 * form is a workspace that has decided nothing, which is the honest default.
 *
 * THE WHOLE SET IS SENT ON SAVE. Two administrators editing this with
 * incremental add and remove operations produce a result neither of them chose.
 * The screen holds the whole set anyway.
 */
function PolicyPanel({
  organizationId,
  administers,
  busy,
  run,
}: {
  organizationId: string;
  administers: boolean;
  busy: string | null;
  run: Run;
}) {
  const formatters = useFormatters();
  const policy = useQuery({
    queryKey: ["organization-policy", organizationId],
    queryFn: () => loadOrganizationPolicy(organizationId),
  });

  const stored = policy.data?.ok ? policy.data.value : null;
  const [capabilities, setCapabilities] = useState<Set<string> | null>(null);
  const [domains, setDomains] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!stored) return;
    setCapabilities(new Set<string>(stored.withheldCapabilities));
    setDomains(new Set<string>(stored.withheldToolDomains));
  }, [stored]);

  const chosenCapabilities = capabilities ?? new Set<string>();
  const chosenDomains = domains ?? new Set<string>();

  const dirty =
    stored !== null &&
    (chosenCapabilities.size !== stored.withheldCapabilities.length ||
      chosenDomains.size !== stored.withheldToolDomains.length ||
      stored.withheldCapabilities.some((entry) => !chosenCapabilities.has(entry)) ||
      stored.withheldToolDomains.some((entry) => !chosenDomains.has(entry)));

  // Labels come from the registry itself rather than a second table: asking it
  // with no signals observed yields every capability with the name the product
  // already shows for it, so the two cannot drift apart.
  const labels = useMemo(() => {
    const byId = new Map<string, string>();
    for (const report of allCapabilityReports({})) byId.set(report.id, report.label);
    return byId;
  }, []);

  const toggle = (set: Set<string>, key: string, apply: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  };

  return (
    <GlassPanel className="p-5">
      <h2 className="text-base font-semibold">What this organization allows</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anything ticked here is withheld from every member, on every device they sign in on. It can
        only take capability away — nothing here turns anything on, and everything left alone still
        asks before it acts.
      </p>

      {policy.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Reading this organization&rsquo;s policy…
        </p>
      ) : policy.data && !policy.data.ok ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {policy.data.message}
        </p>
      ) : (
        <>
          <fieldset className="mt-4" disabled={!administers}>
            <legend className="text-sm font-medium text-foreground">Capabilities</legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {POLICY_CAPABILITIES.map((capability) => (
                <label
                  key={capability}
                  className="flex items-center gap-2 text-sm text-foreground"
                  htmlFor={`policy-capability-${capability}`}
                >
                  <input
                    id={`policy-capability-${capability}`}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={chosenCapabilities.has(capability)}
                    onChange={() =>
                      toggle(chosenCapabilities, capability, (next) => setCapabilities(next))
                    }
                  />
                  {labels.get(capability) ?? capability}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5" disabled={!administers}>
            <legend className="text-sm font-medium text-foreground">What OCADE may act on</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Withholding an area removes its tools before OCADE is offered them, so it never plans
              around something it cannot do. Talking, and what OCADE remembers between sessions, is
              not on this list: a workspace that withheld it would leave its members with a product
              that cannot answer them.
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {POLICY_TOOL_DOMAINS.map((domain) => (
                <label
                  key={domain}
                  className="flex items-center gap-2 text-sm text-foreground"
                  htmlFor={`policy-domain-${domain}`}
                >
                  <input
                    id={`policy-domain-${domain}`}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={chosenDomains.has(domain)}
                    onChange={() => toggle(chosenDomains, domain, (next) => setDomains(next))}
                  />
                  {DOMAIN_LABELS[domain]}
                </label>
              ))}
            </div>
          </fieldset>

          {administers ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={busy === "policy" || !dirty}
                onClick={() =>
                  void run(
                    "policy",
                    () =>
                      setOrganizationPolicy({
                        organizationId,
                        withheldCapabilities: [...chosenCapabilities],
                        withheldToolDomains: [...chosenDomains],
                      }),
                    "What this organization allows was updated.",
                  ).then((changed) => {
                    if (changed !== null) void policy.refetch();
                  })
                }
              >
                {busy === "policy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Save what is allowed
              </Button>
              {dirty ? (
                <span className="text-xs text-muted-foreground">Not saved yet.</span>
              ) : stored?.updatedAt ? (
                <span className="text-xs text-muted-foreground">
                  Last changed {formatters.dateTime(stored.updatedAt)}.
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              Only an owner or admin can change this. It is shown here so you can see what applies
              to you.
            </p>
          )}

          {/*
            SAID PLAINLY, BECAUSE OVERCLAIMING HERE WOULD BE WORSE THAN SAYING
            NOTHING. OCADE runs on the person's own machine, so this is a
            workspace's stated rules applied everywhere OCADE acts for them,
            recorded when changed and readable by everyone it governs. It is not
            a claim that somebody who rewrites their own client cannot act.
          */}
          <p className="mt-4 border-t border-border/40 pt-3 text-xs text-muted-foreground">
            OCADE applies these rules wherever it acts for a member, and records every change in the
            activity log. Because OCADE also runs on people&rsquo;s own machines, treat this as your
            organization&rsquo;s stated policy rather than a technical barrier against somebody
            determined to modify their own copy.
          </p>
        </>
      )}
    </GlassPanel>
  );
}

function RenamePanel({
  currentName,
  busy,
  onRename,
}: {
  currentName: string;
  busy: boolean;
  onRename: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(currentName);
  useEffect(() => setName(currentName), [currentName]);

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || name.trim() === currentName) return;
        void onRename(name.trim());
      }}
    >
      <div className="min-w-0 flex-1">
        <Label htmlFor="organization-rename">Organization name</Label>
        <Input
          id="organization-rename"
          className="mt-1.5"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={busy || !name.trim() || name.trim() === currentName}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Save name
      </Button>
    </form>
  );
}

function MemberRow({
  member,
  members,
  isViewer,
  administers,
  owner,
  busy,
  organizationId,
  run,
}: {
  member: OrganizationMember;
  members: readonly OrganizationMember[];
  isViewer: boolean;
  administers: boolean;
  owner: boolean;
  busy: string | null;
  organizationId: string;
  run: Run;
}) {
  const label = member.displayName ?? member.email ?? member.userId;
  const deactivated = member.state === "deactivated";
  const removeBlocked = blockedReason(members, member, "remove");
  const demoteBlocked = blockedReason(members, member, "demote");
  const deactivateBlocked = blockedReason(members, member, "deactivate");
  // An admin may not touch an owner at all; the server enforces it too.
  const mayChange = administers && (member.role !== "owner" || owner);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {label}
          {isViewer ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
        </p>
        {member.email && member.displayName ? (
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={(deactivated ? "paused" : "active") as Status}>
          {deactivated ? "Deactivated" : "Active"}
        </StatusBadge>

        {mayChange ? (
          <>
            <Label htmlFor={`role-${member.id}`} className="sr-only">
              Role for {label}
            </Label>
            <select
              id={`role-${member.id}`}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              value={member.role}
              disabled={busy === `role-${member.id}`}
              title={demoteBlocked ?? undefined}
              onChange={(event) =>
                void run(
                  `role-${member.id}`,
                  () => setMemberRole(member.id, event.target.value as OrganizationRole),
                  `${label} is now ${event.target.value === "admin" ? "an admin" : `a ${event.target.value}`}.`,
                )
              }
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {owner ? <option value="owner">Owner</option> : null}
            </select>

            <Button
              variant="outline"
              size="sm"
              disabled={busy === `state-${member.id}` || Boolean(!deactivated && deactivateBlocked)}
              title={!deactivated ? (deactivateBlocked ?? undefined) : undefined}
              onClick={() =>
                void run(
                  `state-${member.id}`,
                  () => setMemberState(member.id, deactivated ? "active" : "deactivated"),
                  deactivated ? `${label} can act again.` : `${label} is deactivated.`,
                )
              }
            >
              {deactivated ? "Reactivate" : "Deactivate"}
            </Button>

            {owner && member.role !== "owner" && member.state === "active" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy === `transfer-${member.id}`}
                onClick={() =>
                  void run(
                    `transfer-${member.id}`,
                    () => transferOwnership(organizationId, member.userId),
                    `${label} owns this organization now. You are an admin.`,
                  )
                }
              >
                Make owner
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={busy === `remove-${member.id}` || Boolean(removeBlocked)}
              title={removeBlocked ?? undefined}
              onClick={() =>
                void run(
                  `remove-${member.id}`,
                  () => removeMember(member.id),
                  `${label} is no longer in this organization.`,
                )
              }
            >
              <UserMinus aria-hidden="true" />
              <span className="sr-only">Remove {label}</span>
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Member"}
          </span>
        )}
      </div>
    </li>
  );
}

function InvitationsPanel({
  organizationId,
  invites,
  canInviteOwner,
  busy,
  run,
}: {
  organizationId: string;
  invites: OrganizationSnapshot["invites"];
  canInviteOwner: boolean;
  busy: string | null;
  run: Run;
}) {
  const formatters = useFormatters();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("member");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * EMAIL DELIVERY IS DERIVED, NOT ASSUMED. §D forbids claiming a channel works
   * because an abstraction exists, and an invitation is the case where that
   * lie is most expensive: somebody is told an invitation was sent, waits, and
   * it never was. When no verified sender is configured, this says so and hands
   * over the link instead — which is the thing that actually admits somebody.
   */
  const emailChannel = useMemo(
    () => resolveChannels(deploymentChannelConfiguration()).find((c) => c.id === "email"),
    [],
  );
  const emailWorks = Boolean(emailChannel?.available);

  const pending = invites.filter((invite) => inviteState(invite) === "pending");
  const settled = invites.filter((invite) => inviteState(invite) !== "pending");

  const send = async () => {
    const token = createInviteToken();
    const tokenHash = await hashInviteToken(token);
    const created = await run(
      "invite",
      () =>
        inviteToOrganization({
          organizationId,
          email: email.trim().toLowerCase(),
          role,
          tokenHash,
          expiresAt: inviteExpiry(),
        }),
      emailWorks ? "Invitation sent." : "Invitation created. Send the link below.",
    );
    if (created) {
      setLink(inviteLink(window.location.origin, token));
      setCopied(false);
      setEmail("");
    }
  };

  const reissue = async (inviteId: string) => {
    const token = createInviteToken();
    const tokenHash = await hashInviteToken(token);
    const done = await run(
      `resend-${inviteId}`,
      () => resendOrganizationInvite({ inviteId, tokenHash, expiresAt: inviteExpiry() }),
      "A new link was issued. The previous one no longer works.",
    );
    if (done) {
      setLink(inviteLink(window.location.origin, token));
      setCopied(false);
    }
  };

  return (
    <GlassPanel className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Mail className="h-4 w-4" aria-hidden="true" />
        Invitations
      </h2>
      {!emailWorks ? (
        <p className="mt-2 rounded-md bg-[color:var(--state-warning-wash)] p-3 text-sm text-[color:var(--state-warning)]">
          {emailChannel?.unavailableReason ?? "This deployment has no verified email sender."} OCADE
          will not say it sent an email it cannot send — create the invitation and send the link
          yourself.
        </p>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!email.includes("@")) return;
          void send();
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            className="mt-1.5"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="new.colleague@example.com"
          />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as OrganizationRole)}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            {canInviteOwner ? <option value="owner">Owner</option> : null}
          </select>
        </div>
        <Button type="submit" disabled={busy === "invite" || !email.includes("@")}>
          {busy === "invite" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Invite
        </Button>
      </form>

      {link ? (
        <div className="mt-4 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            This link is shown once. OCADE stores only a hash of it, so it cannot be recovered —
            only replaced by resending.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
              {link}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setCopied(true));
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold">Pending</h3>
      <ul className="mt-2 divide-y divide-border">
        {pending.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                {invite.role} · expires {formatters.date(invite.expiresAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy === `resend-${invite.id}`}
                onClick={() => void reissue(invite.id)}
              >
                <RotateCw aria-hidden="true" />
                Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy === `revoke-${invite.id}`}
                onClick={() =>
                  void run(
                    `revoke-${invite.id}`,
                    () => revokeOrganizationInvite(invite.id),
                    "Invitation withdrawn.",
                  )
                }
              >
                Withdraw
              </Button>
            </div>
          </li>
        ))}
        {pending.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No invitations are waiting.</li>
        ) : null}
      </ul>

      {settled.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">Settled</h3>
          <ul className="mt-2 divide-y divide-border">
            {settled.slice(0, 10).map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm text-muted-foreground">{invite.email}</span>
                <span className="text-xs text-muted-foreground">{inviteState(invite)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </GlassPanel>
  );
}

function GroupsPanel({
  organizationId,
  groups,
  members,
  busy,
  run,
}: {
  organizationId: string;
  groups: OrganizationSnapshot["groups"];
  members: readonly OrganizationMember[];
  busy: string | null;
  run: Run;
}) {
  const [name, setName] = useState("");

  return (
    <GlassPanel className="p-5">
      <h2 className="text-base font-semibold">Groups</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Named sets of people inside this organization. A group never spans organizations.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void run("group", () => createGroup(organizationId, name.trim()), "Group created.").then(
            (created) => {
              if (created) setName("");
            },
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            className="mt-1.5"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Engineering"
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy === "group" || !name.trim()}>
          Create group
        </Button>
      </form>

      <ul className="mt-4 space-y-4">
        {groups.map((group) => (
          <li key={group.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{group.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy === `group-delete-${group.id}`}
                onClick={() =>
                  void run(
                    `group-delete-${group.id}`,
                    () => deleteGroup(group.id),
                    `${group.name} was deleted.`,
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                <span className="sr-only">Delete {group.name}</span>
              </Button>
            </div>
            <fieldset className="mt-3">
              <legend className="text-xs text-muted-foreground">Members of {group.name}</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {members.map((member) => {
                  const present = group.memberIds.includes(member.id);
                  const inputId = `group-${group.id}-member-${member.id}`;
                  return (
                    <label
                      key={member.id}
                      htmlFor={inputId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={present}
                        disabled={busy === `group-member-${group.id}-${member.id}`}
                        onChange={() =>
                          void run(
                            `group-member-${group.id}-${member.id}`,
                            () => setGroupMembership(group.id, member.id, !present),
                            present ? "Removed from the group." : "Added to the group.",
                          )
                        }
                      />
                      {member.displayName ?? member.email ?? member.userId}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
        {groups.length === 0 ? (
          <li className="text-sm text-muted-foreground">No groups yet.</li>
        ) : null}
      </ul>
    </GlassPanel>
  );
}

function DangerZone({
  organizationId,
  organizationName,
  busy,
  run,
}: {
  organizationId: string;
  organizationName: string;
  busy: boolean;
  run: Run;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed === organizationName;

  return (
    <GlassPanel className="border-destructive/30 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        Danger zone
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deleting {organizationName} removes its members, invitations, groups and activity record. It
        cannot be undone. The name you type is checked by the server, not only here.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!matches) return;
          /*
           * Cleared only when the deletion actually happened. Clearing it on
           * every outcome wiped the confirmation the moment the server said no
           * — including when the "no" was "confirm it is you", which is a
           * refusal somebody is meant to answer and then continue from. Being
           * made to retype the name is how a security prompt turns into a
           * reason to keep sessions permanently unlocked.
           */
          void run(
            "delete",
            () => deleteOrganization(organizationId, typed),
            `${organizationName} was deleted.`,
          ).then((deleted) => {
            if (deleted !== null) setTyped("");
          });
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="delete-confirmation">
            Type <span className="font-semibold">{organizationName}</span> to confirm
          </Label>
          <Input
            id="delete-confirmation"
            className="mt-1.5"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="destructive" disabled={busy || !matches}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Delete organization
        </Button>
      </form>
    </GlassPanel>
  );
}
