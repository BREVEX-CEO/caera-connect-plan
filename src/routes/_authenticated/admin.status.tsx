import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, ShieldCheck, Siren } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { requireAdminRole } from "@/lib/admin/route-gate";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { STATUS_COMPONENTS } from "@/lib/status/catalogue";
import type { AssuranceRefusal } from "@/lib/security/assurance";
import { proveIdentityWithPassword } from "@/lib/security/reauthentication";
import {
  activeIncidents,
  IMPACT_LABEL,
  INCIDENT_IMPACTS,
  INCIDENT_STATES,
  loadPublishedIncidents,
  openIncident,
  pastIncidents,
  postIncidentUpdate,
  STATE_LABEL,
  upcomingMaintenance,
  type IncidentImpact,
  type IncidentOutcome,
  type IncidentKind,
  type IncidentState,
  type StatusIncident,
} from "@/lib/status/incidents";

/**
 * ADMINISTRATOR INCIDENT CONTROLS — PLAN.md §K, and §G's status management.
 *
 * §K asks for incident creation and updates, timestamped history, maintenance
 * scheduling and administrator controls. Everything this screen does is
 * published: there is no draft state and no preview, because a status page that
 * can be written to privately is a status page whose contents nobody outside
 * can rely on. What is typed here is what a signed-out visitor reads.
 *
 * THAT IS WHY IT ASKS WHO IS ASKING. Publishing to the status page is a public
 * statement in OCADE's name, and the database demands recent strong
 * authentication for it — the same rule that guards organization deletion. The
 * refusal comes back as a door rather than an apology, and answering it retries
 * what was being published rather than clearing the form.
 *
 * ONE UPDATE, ONE STATE CHANGE. There is no control that moves an incident
 * without saying something, because the database has no function for it: an
 * incident that went from investigating to resolved with nothing published
 * about why is the failure a status page exists to prevent.
 *
 * NOTHING HERE CAN EDIT HISTORY. Updates are append-only in the schema, so a
 * mistake is corrected by posting a correction — which is what a reader needs
 * to see anyway.
 */
export const Route = createFileRoute("/_authenticated/admin/status")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Status incidents — CARCC CADANE Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole("status and incident management"),
  component: AdminStatusPage,
});

const KINDS: readonly { value: IncidentKind; label: string; hint: string }[] = [
  {
    value: "incident",
    label: "Incident",
    hint: "Something is wrong now. Opens as Investigating.",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    hint: "Planned, announced before it starts. Opens as Scheduled.",
  },
];

function AdminStatusPage() {
  const { user } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{
    reason: AssuranceRefusal;
    message: string;
    retry: () => Promise<void>;
  } | null>(null);

  const incidents = useQuery({
    queryKey: ["admin", "status-incidents"],
    queryFn: async () => loadPublishedIncidents(await loadSupabaseClient()),
  });

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<IncidentOutcome<T>>, success: string) => {
      const attempt = async (): Promise<T | null> => {
        setBusy(key);
        setProblem(null);
        setNotice(null);
        const result = await action();
        setBusy(null);
        if (!result.ok) {
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
        await incidents.refetch();
        return result.value;
      };
      return attempt();
    },
    [incidents],
  );

  const all = incidents.data ?? [];
  const live = activeIncidents(all);
  const upcoming = upcomingMaintenance(all);
  const history = pastIncidents(all);

  return (
    <AppShell>
      <PageHeader
        eyebrow="CARCC CADANE"
        title="Status incidents"
        description="Everything published here is read by signed-out visitors the moment it is saved."
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
        <GlassPanel className="mt-4 p-4" role="alert">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        </GlassPanel>
      ) : null}
      {notice ? (
        <GlassPanel className="mt-4 p-4" role="status">
          <p className="flex items-start gap-2 text-sm text-[color:var(--state-success)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        </GlassPanel>
      ) : null}

      <OpenIncidentForm busy={busy === "open"} run={run} />

      {incidents.isLoading ? (
        <GlassPanel className="mt-4 flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Reading what is published…
        </GlassPanel>
      ) : (
        <>
          <IncidentList
            title="Affecting OCADE now"
            empty="Nothing is affecting OCADE. The public page says so."
            incidents={live}
            busy={busy}
            run={run}
          />
          <IncidentList
            title="Announced, not started"
            empty="No maintenance window is announced."
            incidents={upcoming}
            busy={busy}
            run={run}
          />
          <IncidentList
            title="Over"
            empty="Nothing has been published yet."
            incidents={history}
            busy={busy}
            run={run}
            readOnly
          />
        </>
      )}
    </AppShell>
  );
}

type Run = <T>(
  key: string,
  action: () => Promise<IncidentOutcome<T>>,
  success: string,
) => Promise<T | null>;

function OpenIncidentForm({ busy, run }: { busy: boolean; run: Run }) {
  const [kind, setKind] = useState<IncidentKind>("incident");
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<IncidentImpact>("degraded");
  const [components, setComponents] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");

  const ready = title.trim().length > 0 && body.trim().length > 0;

  return (
    <GlassPanel className="mt-6 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Siren className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Publish something
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The first update is published with the incident. An incident with no update is a headline
        with no information.
      </p>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          void run(
            "open",
            () =>
              openIncident({
                kind,
                title: title.trim(),
                // Maintenance is always maintenance-impact: labelling a planned
                // window as an outage would put a red state on the public page
                // for something that was expected.
                impact: kind === "maintenance" ? "maintenance" : impact,
                componentIds: [...components],
                body: body.trim(),
                startedAt: startedAt ? new Date(startedAt).toISOString() : null,
                scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
              }),
            "Published. Signed-out visitors can read it now.",
          ).then((created) => {
            if (created === null) return;
            setTitle("");
            setBody("");
            setComponents(new Set());
            setStartedAt("");
            setScheduledEnd("");
          });
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Kind</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {KINDS.map((entry) => (
              <label
                key={entry.value}
                className="flex items-start gap-2 text-sm"
                htmlFor={`incident-kind-${entry.value}`}
              >
                <input
                  id={`incident-kind-${entry.value}`}
                  type="radio"
                  name="incident-kind"
                  className="mt-1 h-4 w-4"
                  checked={kind === entry.value}
                  onChange={() => setKind(entry.value)}
                />
                <span>
                  <span className="block text-foreground">{entry.label}</span>
                  <span className="block text-xs text-muted-foreground">{entry.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="incident-title">Headline</Label>
          <Input
            id="incident-title"
            className="mt-1.5"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
        </div>

        {kind === "incident" ? (
          <div>
            <Label htmlFor="incident-impact">Impact</Label>
            <select
              id="incident-impact"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={impact}
              onChange={(event) => setImpact(event.target.value as IncidentImpact)}
            >
              {INCIDENT_IMPACTS.filter((entry) => entry !== "maintenance").map((entry) => (
                <option key={entry} value={entry}>
                  {IMPACT_LABEL[entry]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium text-foreground">What it affects</legend>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {STATUS_COMPONENTS.map((component) => (
              <label
                key={component.id}
                className="flex items-center gap-2 text-sm text-foreground"
                htmlFor={`incident-component-${component.id}`}
              >
                <input
                  id={`incident-component-${component.id}`}
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={components.has(component.id)}
                  onChange={() => {
                    const next = new Set(components);
                    if (next.has(component.id)) next.delete(component.id);
                    else next.add(component.id);
                    setComponents(next);
                  }}
                />
                {component.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="incident-started">
              {kind === "maintenance" ? "Starts" : "Started"}
            </Label>
            <Input
              id="incident-started"
              type="datetime-local"
              className="mt-1.5"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave empty for now. The server stamps it either way.
            </p>
          </div>
          {kind === "maintenance" ? (
            <div>
              <Label htmlFor="incident-ends">Ends</Label>
              <Input
                id="incident-ends"
                type="datetime-local"
                className="mt-1.5"
                value={scheduledEnd}
                onChange={(event) => setScheduledEnd(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                After this the page stops calling it current, whether or not it has been closed.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="incident-body">What to say</Label>
          <textarea
            id="incident-body"
            className="mt-1.5 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
          />
        </div>

        <div>
          <Button type="submit" disabled={busy || !ready}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Publish
          </Button>
        </div>
      </form>
    </GlassPanel>
  );
}

function IncidentList({
  title,
  empty,
  incidents,
  busy,
  run,
  readOnly = false,
}: {
  title: string;
  empty: string;
  incidents: readonly StatusIncident[];
  busy: string | null;
  run: Run;
  readOnly?: boolean;
}) {
  return (
    <GlassPanel className="mt-4 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {incidents.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40">
          {incidents.map((incident) => (
            <li key={incident.id} className="py-4">
              <h3 className="text-sm font-medium text-foreground">{incident.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {IMPACT_LABEL[incident.impact]} · {STATE_LABEL[incident.state]} ·{" "}
                {new Date(incident.startedAt).toLocaleString()} · {incident.updates.length} update
                {incident.updates.length === 1 ? "" : "s"}
              </p>
              {readOnly ? null : (
                <PostUpdate incident={incident} busy={busy === incident.id} run={run} />
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function PostUpdate({
  incident,
  busy,
  run,
}: {
  incident: StatusIncident;
  busy: boolean;
  run: Run;
}) {
  const [state, setState] = useState<IncidentState>(incident.state);
  const [body, setBody] = useState("");

  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim().length === 0) return;
        void run(
          incident.id,
          () => postIncidentUpdate({ incidentId: incident.id, state, body: body.trim() }),
          state === "resolved" ? "Resolved, and published." : "Update published.",
        ).then((posted) => {
          if (posted !== null) setBody("");
        });
      }}
    >
      <div className="min-w-0 flex-1">
        <Label htmlFor={`update-body-${incident.id}`} className="sr-only">
          What to say about {incident.title}
        </Label>
        <Input
          id={`update-body-${incident.id}`}
          className="mt-0"
          placeholder="What has changed"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
        />
      </div>
      <div>
        <Label htmlFor={`update-state-${incident.id}`} className="sr-only">
          New state for {incident.title}
        </Label>
        <select
          id={`update-state-${incident.id}`}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={state}
          onChange={(event) => setState(event.target.value as IncidentState)}
        >
          {INCIDENT_STATES.map((entry) => (
            <option key={entry} value={entry}>
              {STATE_LABEL[entry]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={busy || body.trim().length === 0}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        Post update
      </Button>
    </form>
  );
}

/**
 * The same two doors the organization screen offers, for the same reason.
 *
 * Publishing to the status page is a public statement in OCADE's name, so the
 * database asks for recent strong authentication, and the refusal says which of
 * the two things is missing. Answering it retries what was being published, so
 * nobody has to retype an incident report because their session was ten minutes
 * older than the rule allows.
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

  return (
    <GlassPanel className="mt-4 p-4" role="alert">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {reason === "factor_required" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm the code from your authenticator app — sign in again, or open Settings › Security
          — then come back to this.
        </p>
      ) : (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setProblem(null);
            const outcome = await proveIdentityWithPassword(email, password);
            if (!outcome.proved) {
              setBusy(false);
              setProblem(
                outcome.reason === "no_email"
                  ? "OCADE cannot confirm this account's email address. Sign in again to continue."
                  : "That password did not match.",
              );
              return;
            }
            setPassword("");
            await onProved();
            setBusy(false);
          }}
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="status-reauth-password">Your password</Label>
            <Input
              id="status-reauth-password"
              type="password"
              autoComplete="current-password"
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
      {problem ? <p className="mt-2 text-xs text-destructive">{problem}</p> : null}
    </GlassPanel>
  );
}
