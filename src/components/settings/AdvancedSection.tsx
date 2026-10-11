import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAccountSessions,
  revokeAccountSession,
  revokeOtherAccountSessions,
} from "@/lib/security/sessions.functions";
import { needsFreshProof, useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { Action, Pending, Row, describeWhen } from "./rows";

/**
 * ADVANCED: WHERE THIS ACCOUNT IS SIGNED IN, AND NOTHING A CUSTOMER SHOULD NEED.
 *
 * `PLAN.md` Phase 9: "Advanced hides diagnostics, device/security details and
 * runtime information from normal customers." Hides is the operative word — the
 * information exists and matters, and it belongs one deliberate click away
 * rather than on the screen everybody opens to change the theme.
 *
 * SEEING SESSIONS NEEDS NOTHING; ENDING ONE NEEDS A SECOND FACTOR. Discovering
 * that somebody else is signed in is how a person finds out they have been
 * compromised, so it must not be behind a challenge — `sessions.functions.ts`
 * splits it exactly that way, and the refusal below is the server's own words.
 *
 * NO RUNTIME IDENTIFIERS. Not the engine, not the model, not the provider, not
 * the build. A person who needs those has a support case, and support has the
 * account id.
 */
export function AdvancedSection() {
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ["security", "sessions"],
    queryFn: () => listAccountSessions(),
    staleTime: 0,
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["security", "sessions"] });
  const { withProof, dialog } = useConfirmIdentity();
  // A refusal for an old proof comes back as an answer; turn it into the question.
  const proved = <T extends { ok: boolean; reason?: string }>(run: () => Promise<T>) =>
    withProof(async () => {
      const outcome = await run();
      if (!outcome.ok && needsFreshProof(outcome.reason)) throw new Error(outcome.reason);
      return outcome;
    });

  const revokeOne = useMutation({
    mutationFn: (id: string) => proved(() => revokeAccountSession({ data: { sessionId: id } })),
    onSuccess: () => void refresh(),
  });
  const revokeRest = useMutation({
    mutationFn: () => proved(() => revokeOtherAccountSessions()),
    onSuccess: () => void refresh(),
  });

  const outcome = revokeOne.data ?? revokeRest.data;
  // A cancelled identity check is the person's choice, not a failure to report.
  const failed = [revokeOne.error, revokeRest.error].some(
    (error) => error && !needsFreshProof(error.message),
  );
  const refused =
    outcome && !outcome.ok
      ? outcome.reason
      : failed
        ? "Signing out did not finish. Check your connection and try again."
        : null;
  const others = (sessions.data?.sessions ?? []).filter((session) => !session.current);

  return (
    <div>
      {dialog}
      <Row
        label="Where you are signed in"
        description={
          sessions.data?.unavailable ??
          "Every browser and device with an active session on this account."
        }
      >
        {others.length > 0 ? (
          <Action
            label={revokeRest.isPending ? "Signing out…" : "Sign out everywhere else"}
            busy={revokeRest.isPending}
            onClick={() => revokeRest.mutate()}
          />
        ) : null}
      </Row>

      <Pending
        query={sessions}
        loading="Reading your sessions…"
        problem="Your sessions could not be read just now."
      />

      {sessions.isSuccess && (sessions.data?.sessions ?? []).length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No other browser or device is signed in to this account.
        </p>
      ) : null}

      {(sessions.data?.sessions ?? []).map((session) => (
        <Row
          key={session.id}
          label={session.current ? `${session.device} — this device` : session.device}
          description={`Last used ${describeWhen(session.lastSeenAt)}.`}
        >
          {session.current ? (
            <span className="text-[13px] text-muted-foreground">Signed in</span>
          ) : (
            <Action
              label="Sign out"
              busy={revokeOne.isPending}
              onClick={() => revokeOne.mutate(session.id)}
            />
          )}
        </Row>
      ))}

      {refused ? (
        <p className="pt-3 text-[13px] text-foreground" role="alert">
          {refused}
        </p>
      ) : null}
    </div>
  );
}
