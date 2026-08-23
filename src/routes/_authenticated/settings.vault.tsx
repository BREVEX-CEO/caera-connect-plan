import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  Copy,
  RotateCw,
  Unlock,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { BrowserStoragePanel } from "@/components/settings/BrowserStoragePanel";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import { countBrowserVaultRecords } from "@/lib/storage/indexeddb-adapter";
import {
  isUnlocked,
  lock,
  loadVaultConfig,
  rotatePassphrase,
  setupWithPassphrase,
  setupWithWebAuthn,
  subscribe,
  unlockWithPassphrase,
  unlockWithRecoveryKit,
  unlockWithWebAuthn,
  updateLockTimeout,
} from "@/lib/storage/vault";
import { webauthnPrfSupported } from "@/lib/storage/vault-crypto";

export const Route = createFileRoute("/_authenticated/settings/vault")({
  head: () => ({
    meta: [{ title: "Browser Vault — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: VaultPage,
});

type Cfg = Awaited<ReturnType<typeof loadVaultConfig>>;

function VaultPage() {
  const { user } = useSession();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const [count, setCount] = useState<number | null>(null);
  const [recoveryKit, setRecoveryKit] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      /*
       * No account is a FINISHED state, not a pending one.
       *
       * This used to `return` with `loading` left true, so a signed-out
       * visitor sat on a spinner that could never resolve — the vault config
       * is keyed by user id, and there was no id coming. Settings is readable
       * without an account, so this page was reachable and permanently stuck.
       */
      setLoading(false);
      return;
    }
    setLoading(true);
    const c = await loadVaultConfig(user.id);
    setCfg(c);
    setCount(await countBrowserVaultRecords().catch(() => 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => subscribe(() => setUnlocked(isUnlocked())), []);

  const run = async (fn: () => Promise<void>, actionId?: string) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      if (actionId) await recordAction({ actionId });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  /*
   * Readable without an account, like every other settings section — and
   * describing the real thing rather than showing controls that cannot work.
   * A vault is keyed to an account, so there is nothing to unlock yet; saying
   * so is more useful than a spinner or a hidden page.
   */
  if (!user) {
    return (
      <>
        <PageHeader
          eyebrow="Privacy and data"
          title="Browser Vault"
          description="Conversations kept only on this device, encrypted with a key derived from your passphrase or passkey."
        />
        <GlassPanel className="flex items-start gap-3 p-5 text-sm">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Shield className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-foreground">
              A vault belongs to an account, so there is nothing to unlock here yet.
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Once you have one, Browser-Only conversations are encrypted with AES-GCM under a key
              that never leaves this device. OCADE cannot read them, and neither can anyone holding
              the database — which is also why a forgotten passphrase cannot be reset for you, only
              recovered with the recovery kit you save when you set it up.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                to="/auth"
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Create an account
              </Link>
              <Link
                to="/settings"
                className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background/40 px-3 text-xs text-foreground hover:bg-accent"
              >
                Back to Settings
              </Link>
            </div>
          </div>
        </GlassPanel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Vault"
        title="Browser Vault"
        description="Encrypts every Browser Only record on this device with AES-GCM. The data key never leaves memory and auto-locks after inactivity."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />

      {/*
        Engine storage sits alongside the vault because they answer the same
        question — "what is OCADE keeping on this device, and how do I remove
        it?" — and someone hunting for hundreds of megabytes of model weights
        should not have to know they are a different subsystem.
      */}
      <div className="mt-4">
        <BrowserStoragePanel />
      </div>

      <GlassPanel className="mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
          aria-hidden
        />
        <p>
          Browser Only data belongs to <strong>this browser on this device</strong>. Clearing site
          data, uninstalling the browser, or wiping the OS profile will delete it permanently.
          Losing every unlock method AND the recovery kit makes the encrypted data unrecoverable —
          CARCC CADANE cannot restore it.
        </p>
      </GlassPanel>

      {err ? (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      ) : null}

      {recoveryKit ? (
        <RecoveryKitPanel kit={recoveryKit} onClose={() => setRecoveryKit(null)} />
      ) : null}

      <GlassPanel className="mt-6 p-5">
        <div className="flex items-center gap-3">
          {unlocked ? (
            <ShieldCheck className="h-5 w-5 text-[color:var(--state-success)]" aria-hidden />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium">
              {cfg ? (unlocked ? "Vault unlocked" : "Vault locked") : "Vault not configured"}
            </div>
            <div className="text-xs text-muted-foreground">
              {cfg
                ? `${cfg.credential_kind === "webauthn_prf" ? "WebAuthn (hardware)" : "Passphrase"} · auto-lock ${cfg.lock_timeout_seconds}s`
                : "Set up encryption to enable Browser Only storage."}
              {count !== null
                ? ` · ${count} encrypted record${count === 1 ? "" : "s"} on this browser`
                : null}
            </div>
          </div>
          {cfg && unlocked ? (
            <button
              onClick={() =>
                run(async () => {
                  lock();
                }, "vault.lock")
              }
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Lock className="h-3.5 w-3.5" /> Lock now
            </button>
          ) : null}
        </div>
      </GlassPanel>

      {!cfg ? (
        <SetupPanel
          busy={busy}
          onPassphrase={(pw) =>
            run(async () => {
              const r = await setupWithPassphrase(user.id, pw);
              setRecoveryKit(r.recoveryKit);
            }, "vault.setup")
          }
          onWebAuthn={() =>
            run(async () => {
              const r = await setupWithWebAuthn(user.id, user.email ?? user.id);
              setRecoveryKit(r.recoveryKit);
            }, "vault.setup")
          }
        />
      ) : !unlocked ? (
        <UnlockPanel
          cfg={cfg}
          busy={busy}
          onPassphrase={(pw) => run(() => unlockWithPassphrase(user.id, pw), "vault.unlock")}
          onWebAuthn={() => run(() => unlockWithWebAuthn(user.id), "vault.unlock")}
          onRecovery={(kit) =>
            run(() => unlockWithRecoveryKit(user.id, kit), "vault.recovery_used")
          }
        />
      ) : (
        <UnlockedPanel
          cfg={cfg}
          busy={busy}
          onRotate={(pw) => run(() => rotatePassphrase(user.id, pw), "vault.rotate")}
          onTimeout={(s) => run(() => updateLockTimeout(user.id, s))}
        />
      )}
    </>
  );
}

function RecoveryKitPanel({ kit, onClose }: { kit: string; onClose: () => void }) {
  return (
    <GlassPanel className="mt-4 border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--state-warning)]">
        <KeyRound className="h-4 w-4" /> Recovery kit — save now, we cannot show it again
      </div>
      <p className="mt-2 text-xs text-[color:var(--state-warning)]/80">
        Store this in a password manager or print it. If you lose your passphrase or authenticator
        AND this recovery kit, all Browser Only data on this device becomes permanently unreadable.
      </p>
      <pre className="mt-3 select-all rounded-md bg-background/60 p-3 font-mono text-sm tracking-wider text-foreground">
        {kit}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(kit)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          I have saved it
        </button>
      </div>
    </GlassPanel>
  );
}

function SetupPanel({
  busy,
  onPassphrase,
  onWebAuthn,
}: {
  busy: boolean;
  onPassphrase: (p: string) => void;
  onWebAuthn: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const canPw = pw.length >= 12 && pw === pw2;
  return (
    <GlassPanel className="mt-4 p-5">
      <h3 className="text-sm font-semibold">Set up Browser Vault</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose one primary unlock method. A recovery kit is always generated as a fallback.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/40 bg-background/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4" /> WebAuthn (hardware)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Passkey or platform authenticator with the PRF extension. Recommended.
          </p>
          <button
            disabled={busy || !webauthnPrfSupported()}
            onClick={onWebAuthn}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {webauthnPrfSupported() ? "Register authenticator" : "Not supported in this browser"}
          </button>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Passphrase
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            PBKDF2-SHA256, 600k iterations. Minimum 12 characters.
          </p>
          <input
            aria-label="New vault passphrase"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Passphrase"
            className="mt-2 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          />
          <input
            aria-label="Repeat vault passphrase"
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Repeat passphrase"
            className="mt-2 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          />
          <button
            disabled={busy || !canPw}
            onClick={() => onPassphrase(pw)}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Create vault
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}

function UnlockPanel({
  cfg,
  busy,
  onPassphrase,
  onWebAuthn,
  onRecovery,
}: {
  cfg: NonNullable<Cfg>;
  busy: boolean;
  onPassphrase: (p: string) => void;
  onWebAuthn: () => void;
  onRecovery: (k: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [kit, setKit] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  return (
    <GlassPanel className="mt-4 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Unlock className="h-4 w-4" /> Unlock
      </div>
      {cfg.credential_kind === "webauthn_prf" ? (
        <button
          disabled={busy}
          onClick={onWebAuthn}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          <Fingerprint className="h-3.5 w-3.5" /> Unlock with authenticator
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Vault passphrase"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Passphrase"
            className="flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          />
          <button
            disabled={busy || !pw}
            onClick={() => onPassphrase(pw)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Unlock
          </button>
        </div>
      )}
      <button
        onClick={() => setShowRecovery((s) => !s)}
        className="mt-4 text-xs text-muted-foreground underline"
      >
        {showRecovery ? "Hide recovery kit" : "Use recovery kit instead"}
      </button>
      {showRecovery ? (
        <div className="mt-2 flex gap-2">
          <input
            aria-label="Recovery kit"
            value={kit}
            onChange={(e) => setKit(e.target.value)}
            placeholder="XXXXX-XXXXX-XXXXX-…"
            className="flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 font-mono text-xs"
          />
          <button
            disabled={busy || !kit}
            onClick={() => onRecovery(kit)}
            className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:bg-accent"
          >
            Recover
          </button>
        </div>
      ) : null}
    </GlassPanel>
  );
}

function UnlockedPanel({
  cfg,
  busy,
  onRotate,
  onTimeout,
}: {
  cfg: NonNullable<Cfg>;
  busy: boolean;
  onRotate: (p: string) => void;
  onTimeout: (s: number) => void;
}) {
  const [pw, setPw] = useState("");
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <GlassPanel className="p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <RotateCw className="h-4 w-4" /> Rotate passphrase
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Re-wraps the existing data key. Existing records stay readable.
        </p>
        <input
          aria-label="New vault passphrase"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New passphrase (min 12)"
          className="mt-3 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
        />
        <button
          disabled={busy || pw.length < 12}
          onClick={() => {
            onRotate(pw);
            setPw("");
          }}
          className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Rotate
        </button>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="text-sm font-semibold">Auto-lock timeout</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Vault locks after this many seconds of inactivity.
        </p>
        <select
          aria-label="Auto-lock timeout"
          defaultValue={cfg.lock_timeout_seconds}
          onChange={(e) => onTimeout(Number(e.target.value))}
          className="mt-3 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
        >
          <option value={60}>1 minute</option>
          <option value={300}>5 minutes</option>
          <option value={900}>15 minutes</option>
          <option value={3600}>1 hour</option>
          <option value={14400}>4 hours</option>
        </select>
      </GlassPanel>
    </div>
  );
}
