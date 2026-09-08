import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { useSession } from "@/lib/session";
import { deleteLocalData } from "@/lib/storage/local-data";
import { executeAction, recordAction, ActionConfirmationError } from "@/lib/actions";
import { listDevicesForCurrentUser } from "@/lib/devices";
import { TwoFactorPanel } from "@/components/settings/TwoFactorPanel";
import { AccountSessionsPanel } from "@/components/settings/AccountSessionsPanel";
import { SignInMethodsPanel } from "@/components/settings/SignInMethodsPanel";
import { proveIdentityWithPassword } from "@/lib/security/reauthentication";

export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({
    meta: [{ title: "Security — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: SecurityPage,
});

/**
 * Security is the tab people open when something has gone wrong, so every row
 * here reads live account state rather than a rendered assumption: the identity
 * providers actually attached to the account, the devices actually approved,
 * and the security-relevant entries actually written to the logs. Nothing is
 * shown as done until the write returns.
 */

type SecurityEvent = {
  id: string;
  created_at: string;
  action: string;
  source: "operational" | "compliance";
};

const SECURITY_ACTIONS = [
  "auth.sign_in",
  "auth.sign_out",
  "security.password_change",
  "security.sign_out_all",
  "security.session_revoked",
  "security.sessions_revoked_others",
  "security.email_change_requested",
  "security.provider_unlinked",
  "security.mfa_enrolled",
  "security.mfa_removed",
  "security.recovery_codes_issued",
  "security.recovery_used",
  "security.recovery_locked_out",
  "devices.register",
  "devices.revoke",
  "devices.rename",
  "vault.setup",
  "vault.unlock",
  "vault.lock",
  "vault.rotate",
  "vault.recovery_used",
  "account.delete",
];

const inputCls =
  "w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60";

function SecurityPage() {
  const { user } = useSession();
  const navigate = useNavigate();

  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const identities = useQuery({
    queryKey: ["security", "identities", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const u = data.user;
      return {
        email: u?.email ?? null,
        phone: u?.phone ?? null,
        emailConfirmed: !!u?.email_confirmed_at,
        lastSignInAt: u?.last_sign_in_at ?? null,
        providers: (u?.identities ?? []).map((i) => i.provider),
      };
    },
  });

  const devices = useQuery({
    queryKey: ["security", "devices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const rows = await listDevicesForCurrentUser();
      return rows.filter((d) => !d.revoked_at);
    },
  });

  const events = useQuery<SecurityEvent[]>({
    queryKey: ["security", "events", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const [op, comp] = await Promise.all([
        supabase
          .from("activity_log")
          .select("id, created_at, action")
          .in("action", SECURITY_ACTIONS)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("compliance_audit_log")
          .select("id, created_at, action")
          .in("action", SECURITY_ACTIONS)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      if (op.error) throw op.error;
      if (comp.error) throw comp.error;
      const rows: SecurityEvent[] = [
        ...(op.data ?? []).map((r) => ({ ...r, source: "operational" as const })),
        ...(comp.data ?? []).map((r) => ({ ...r, source: "compliance" as const })),
      ];
      return rows
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 25) as SecurityEvent[];
    },
  });

  async function changePassword() {
    const supabase = await loadSupabaseClient();
    setPwMsg(null);
    if (pw.length < 10) {
      setPwMsg({ kind: "error", text: "Use at least 10 characters." });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ kind: "error", text: "The two passwords do not match." });
      return;
    }
    setPwBusy(true);
    try {
      /*
       * PROVE IT IS STILL YOU BEFORE REPLACING THE THING THAT PROVES IT IS YOU.
       *
       * This called `updateUser({ password })` on the session alone. A session
       * is what somebody who walked up to an unlocked laptop already has, so
       * the account's real owner could be locked out of their own workspace by
       * a passer-by with no secret at all — `/reset-password` had the same hole
       * from the other direction, and both are now closed.
       *
       * The mechanism is `proveIdentityWithPassword`, shared with the sign-in
       * methods panel and the organization screen: Supabase has no
       * "reauthenticate" call, so the check is a sign-in against the CURRENT
       * password on the SAME session. It succeeds only for somebody who knows
       * it, and nothing about the open page changes when it passes.
       */
      const proof = await proveIdentityWithPassword(identities.data?.email, currentPw);
      if (!proof.proved) {
        throw new Error(
          proof.reason === "no_email"
            ? "OCADE cannot confirm this account's email address, so it will not change the password from here. Use the emailed reset link instead."
            : "That current password did not match. If you have never set one — you sign in with Google, Apple or a one-time code — use “Email me a reset link” below instead.",
        );
      }

      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setCurrentPw("");
      setPw("");
      setPw2("");
      setPwMsg({ kind: "success", text: "Password updated on this account." });
      await recordAction({ actionId: "security.password_change" });
      void events.refetch();
    } catch (e) {
      setPwMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setPwBusy(false);
    }
  }

  async function sendReset() {
    const supabase = await loadSupabaseClient();
    const email = identities.data?.email;
    if (!email) return;
    setResetBusy(true);
    setResetMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetMsg({ kind: "success", text: `Reset link sent to ${email}.` });
    } catch (e) {
      setResetMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setResetBusy(false);
    }
  }

  async function signOutEverywhere() {
    const supabase = await loadSupabaseClient();
    setGlobalBusy(true);
    setGlobalError(null);
    try {
      await executeAction("security.sign_out_all", {
        confirmed: true,
        metadata: { active_devices: devices.data?.length ?? null },
        run: async () => {
          const supabase = await loadSupabaseClient();
          const { error } = await supabase.auth.signOut({ scope: "global" });
          if (error) throw error;
        },
      });
      /*
       * SCOPED, NOT `localStorage.clear()`.
       *
       * This used to wipe the whole origin. The model vault keeps its active
       * pointer and its verified-digest metadata there, so signing out of a lost
       * laptop also threw away the evidence that Offline Intelligence on THIS
       * machine had been verified — the weights stayed in OPFS, unusable, and
       * preparation started again from nothing. PLAN.md §A names that clear()
       * as a defect and requires the model to survive every sign-out.
       *
       * The canonical deletion authority deletes account data and the device's
       * own registration, and cannot touch a model-owned key even by accident.
       */
      deleteLocalData(["all_account_data", "device_lease"]);
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      if (e instanceof ActionConfirmationError) setGlobalError("Confirmation was not accepted.");
      else setGlobalError(e instanceof Error ? e.message : String(e));
      setGlobalBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Security"
        title="Security"
        description="Sign-in methods, password, active sessions and the security events recorded on this account."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />

      {/* Sign-in methods */}
      <GlassPanel className="mt-6 p-5">
        <Heading icon={ShieldCheck} title="Sign-in methods" />
        {identities.isPending ? (
          <Loading label="Reading account…" />
        ) : identities.isError ? (
          <ErrorRow
            message={
              identities.error instanceof Error ? identities.error.message : "Could not load."
            }
            onRetry={() => void identities.refetch()}
          />
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Email">
              {identities.data.email ?? "—"}
              {identities.data.email ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {identities.data.emailConfirmed ? "verified" : "not verified"}
                </span>
              ) : null}
            </Row>
            <Row label="Phone">{identities.data.phone || "—"}</Row>
            <Row label="Linked providers">
              {identities.data.providers.length ? identities.data.providers.join(", ") : "—"}
            </Row>
            <Row label="Last sign-in">
              {identities.data.lastSignInAt
                ? new Date(identities.data.lastSignInAt).toLocaleString()
                : "—"}
            </Row>
          </dl>
        )}
      </GlassPanel>

      {/*
        HOW YOU SIGN IN, right below the read-only summary that lists it.
        Changing the email or a provider changes what can BECOME this account,
        so both live here with the second factor rather than in a general
        account screen.
      */}
      <SignInMethodsPanel email={identities.data?.email ?? null} />

      {/*
        SECOND FACTOR ABOVE PASSWORD, deliberately. This is the change that
        actually protects the account, and burying it under the password form
        makes the weaker control the prominent one.
      */}
      <TwoFactorPanel />

      {/* Password */}
      <GlassPanel className="mt-4 p-5">
        <Heading icon={KeyRound} title="Password" />
        <p className="mt-1 text-xs text-muted-foreground">
          Setting a password does not remove Google or OTP sign-in — it adds another way in.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className={inputCls}
              aria-label="Current password"
            />
            <span className="text-[11px] text-muted-foreground">
              Asked for so that somebody who finds this browser signed in cannot take the account
              over. No password yet? Use the reset link below.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className={inputCls}
              aria-label="New password"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Repeat new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className={inputCls}
              aria-label="Repeat new password"
            />
          </label>
        </div>
        {pwMsg ? <Msg kind={pwMsg.kind} text={pwMsg.text} /> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void changePassword()}
            disabled={pwBusy || !pw || !pw2 || !currentPw}
            className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
          >
            {pwBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Update password
          </button>
          <button
            onClick={() => void sendReset()}
            disabled={resetBusy || !identities.data?.email}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
          >
            {resetBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            Email me a reset link
          </button>
        </div>
        {resetMsg ? <Msg kind={resetMsg.kind} text={resetMsg.text} /> : null}
      </GlassPanel>

      {/*
        REAL SESSIONS, not a device count.
        This panel used to say "N approved devices", which is a different fact:
        a device row survives a sign-out, so it answered a question nobody was
        asking. What can read this account right now is the session list.
      */}
      <AccountSessionsPanel />

      {/* Global sign-out */}
      <GlassPanel className="mt-4 p-5">
        <Heading icon={Smartphone} title="Sign out everywhere" />
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Ends every session, including this one, and signs this browser out. Use it when you do not
          know which sign-in to trust — the list above is for ending one you can identify.
        </p>
        {globalError ? <Msg kind="error" text={globalError} /> : null}
        {confirmGlobal ? (
          <div className="mt-4 rounded-md border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] p-3 text-xs text-foreground">
            This ends every session on every device, including this one. You will be signed out
            immediately.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void signOutEverywhere()}
                disabled={globalBusy}
                className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/25 disabled:opacity-60"
              >
                {globalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Yes, sign out everywhere
              </button>
              <button
                onClick={() => setConfirmGlobal(false)}
                disabled={globalBusy}
                className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmGlobal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out of all devices
          </button>
        )}
      </GlassPanel>

      {/* Recent security events */}
      <GlassPanel className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <Heading icon={ShieldCheck} title="Recent security events" />
          <button
            onClick={() => void events.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {events.isPending ? (
          <Loading label="Reading logs…" />
        ) : events.isError ? (
          <ErrorRow
            message={events.error instanceof Error ? events.error.message : "Could not load."}
            onRetry={() => void events.refetch()}
          />
        ) : events.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No security events recorded on this account yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40 text-sm">
            {events.data.map((e) => (
              <li key={`${e.source}-${e.id}`} className="flex items-center justify-between py-2">
                <span className="text-foreground">{e.action}</span>
                <span className="text-xs text-muted-foreground">
                  {e.source === "compliance" ? "compliance · " : ""}
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </>
  );
}

function Heading({ icon: Icon, title }: { icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {message}
      </span>
      <button onClick={onRetry} className="underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}

function Msg({ kind, text }: { kind: "success" | "error"; text: string }) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          : "mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
      }
    >
      {text}
    </div>
  );
}
