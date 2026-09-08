import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, LogOut, MonitorSmartphone, RefreshCw, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  listAccountSessions,
  revokeAccountSession,
  revokeOtherAccountSessions,
  type AccountSession,
} from "@/lib/security/sessions.functions";

/**
 * WHERE THIS ACCOUNT IS SIGNED IN, RIGHT NOW.
 *
 * NOT the device list. `/settings/devices` shows devices this account has
 * approved, and a device row outlives a sign-out — useful, and not the question
 * somebody asks after losing a laptop. That question is "what can read my
 * account right now", and only a session answers it.
 *
 * THE CURRENT SESSION IS MARKED AND CANNOT BE ENDED FROM HERE. Ending it
 * server-side would leave this browser believing it was still signed in, which
 * is a worse state than either being signed in or being signed out. Sign out is
 * the control for that, and it clears local state too.
 *
 * WHAT IT PROMISES IS WHAT IT DOES. Revoking kills the refresh token, so the
 * session cannot renew; an access token already issued stays valid until it
 * expires. The panel says so rather than implying an instant cut-off, because
 * somebody acting on a compromise needs to know whether to change their
 * password as well.
 */
export function AccountSessionsPanel() {
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listAccountSessions();
      setSessions(result.sessions);
      setProblem(result.unavailable ?? null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not read your sessions.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function endOne(session: AccountSession) {
    setBusy(session.id);
    setProblem(null);
    try {
      const outcome = await revokeAccountSession({ data: { sessionId: session.id } });
      if (!outcome.ok) setProblem(outcome.reason);
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function endOthers() {
    setBusy("others");
    setProblem(null);
    try {
      const outcome = await revokeOtherAccountSessions();
      if (!outcome.ok) setProblem(outcome.reason);
      setConfirmOthers(false);
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const others = (sessions ?? []).filter((session) => !session.current);

  return (
    <GlassPanel className="mt-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Where you are signed in</h2>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" aria-hidden /> Refresh
        </button>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Every sign-in that can still reach this account. Ending one stops it renewing; it can finish
        the request it is already making, so change your password too if you think somebody else has
        been in.
      </p>

      {problem ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {problem}
        </p>
      ) : null}

      {sessions === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your sessions…
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No active sessions to show.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40 text-sm">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground">{session.device}</span>
                  {session.current ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      This device
                    </span>
                  ) : null}
                  {session.assurance === "aal2" ? (
                    <span
                      title="Confirmed with a second factor"
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden /> Two-step
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Last active {relative(session.lastSeenAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                </span>
              </span>
              {session.current ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">Sign out to end</span>
              ) : (
                <button
                  onClick={() => void endOne(session)}
                  disabled={busy !== null}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-60"
                >
                  {busy === session.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                  )}
                  End
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 ? (
        confirmOthers ? (
          <div className="mt-4 rounded-md border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] p-3 text-xs text-foreground">
            This ends {others.length} other session{others.length === 1 ? "" : "s"} and leaves you
            signed in here.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void endOthers()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
              >
                {busy === "others" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                End them
              </button>
              <button
                onClick={() => setConfirmOthers(false)}
                disabled={busy !== null}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmOthers(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out everywhere else
          </button>
        )
      ) : null}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Approved devices are a separate list.{" "}
        <Link to="/settings/devices" className="text-foreground underline underline-offset-2">
          Manage devices
        </Link>
      </p>
    </GlassPanel>
  );
}

/** "3 hours ago". A session's age is what matters, not its timestamp. */
function relative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "at an unknown time";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}
