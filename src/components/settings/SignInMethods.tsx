import { useEffect, useState } from "react";
import {
  canUnlink,
  describeIdentityError,
  listIdentities,
  requestEmailChange,
  unlinkProvider,
  type LinkedIdentity,
} from "@/lib/security/identity";
import { assuranceRefusalOf } from "@/lib/security/reauthentication";
import { useSession } from "@/lib/session";
import { Action, Row } from "./rows";

/**
 * HOW THIS ACCOUNT IS SIGNED IN TO, AND HOW THAT IS CHANGED.
 *
 * Every control here changes what can BECOME this account — an unlinked
 * provider is a door closed, a changed email is where a recovery link goes — so
 * two things are true of all of them: the server decides, and the screen never
 * claims more than happened.
 *
 * VERIFY BEFORE REPLACE. Changing an email sends a confirmation and does not
 * move the login until the link is followed, so the copy says "pending" rather
 * than "changed". Telling somebody their address is changed while it is pending
 * is how they delete the old mailbox and lock themselves out.
 *
 * THE LAST WAY IN IS NEVER REMOVED. `canUnlink` is the rule Supabase cannot
 * know: unlinking the only provider on an account with no password leaves
 * nobody able to sign in, and the button is refused with the reason rather than
 * failing at the server.
 */
export function SignInMethods() {
  const { user } = useSession();
  const [identities, setIdentities] = useState<LinkedIdentity[] | null>(null);
  /*
   * A password is a way in that is not an identity row, so it decides whether
   * unlinking the last provider would lock somebody out. Supabase records it in
   * the account's own provider list, which is the only place that knows.
   */
  const providers = (user?.app_metadata?.providers ?? []) as string[];
  const hasPassword = providers.includes("email");
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const linked = await listIdentities();
        if (cancelled) return;
        setIdentities(linked);
      } catch (error) {
        if (!cancelled) setProblem(describeIdentityError(error as { message?: string }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlink(identity: LinkedIdentity) {
    const verdict = canUnlink(identities ?? [], identity, hasPassword);
    if (!verdict.allowed) {
      setProblem(verdict.reason);
      return;
    }
    try {
      await unlinkProvider(identity.id);
      setIdentities((current) => (current ?? []).filter((entry) => entry.id !== identity.id));
      setNote(null);
      setProblem(null);
    } catch (error) {
      /*
       * A refusal about ASSURANCE is a different sentence from a refusal about
       * the request: one asks the person to prove who they are, the other says
       * the change cannot be made. Told apart here so the person is not sent to
       * re-authenticate over something re-authenticating would not fix.
       */
      const refusal = assuranceRefusalOf(error);
      setProblem(
        refusal === "factor_required"
          ? "Confirm your second factor, then try this again."
          : refusal === "reauthentication_required"
            ? "Sign in again, then try this again — this change needs recent proof of who you are."
            : describeIdentityError(error as { message?: string }),
      );
    }
  }

  return (
    <div>
      <Row
        label="Change your email"
        description={
          note ??
          "OCADE sends a confirmation to the new address. Your sign-in stays as it is until you follow that link."
        }
      >
        <div className="flex w-full items-center gap-2">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            aria-label="New email address"
            placeholder="you@example.com"
            className="h-8 w-full min-w-0 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring sm:w-48"
          />
          <Action
            label={changing ? "Sending…" : "Send"}
            busy={changing || email.trim().length === 0}
            onClick={async () => {
              setChanging(true);
              setProblem(null);
              try {
                await requestEmailChange(email.trim());
                setNote(`Confirm at ${email.trim()} — your sign-in has not changed yet.`);
                setEmail("");
              } catch (error) {
                setProblem(describeIdentityError(error as { message?: string }));
              } finally {
                setChanging(false);
              }
            }}
          />
        </div>
      </Row>

      {(identities ?? []).map((identity) => (
        <Row
          key={identity.id}
          label={label(identity.provider)}
          description={identity.label ?? "Linked to this account."}
        >
          <Action label="Unlink" onClick={() => unlink(identity)} />
        </Row>
      ))}

      {problem ? (
        <p className="pt-3 text-[13px] text-foreground" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A provider name a person recognises, never an internal id.
 *
 * Only the two OCADE offers are named. An identity from anything else is
 * capitalised as-is rather than hidden: an account that somehow carries one
 * should show it, and inventing a label for a provider nobody can sign in with
 * is how a list ends up describing a way in that does not exist.
 */
function label(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "email") return "Email";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
