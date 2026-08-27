import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fingerprint, Loader2, Unlock } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import {
  isUnlocked,
  loadVaultConfig,
  subscribe,
  unlockWithPassphrase,
  unlockWithRecoveryKit,
  unlockWithWebAuthn,
} from "@/lib/storage/vault";

type Cfg = Awaited<ReturnType<typeof loadVaultConfig>>;

/**
 * UNLOCK WHERE THE LOCK BITES, NOT TWO SCREENS AWAY.
 *
 * The vault key is held in memory and nowhere else — deliberately, and it is
 * the strongest privacy property this product has: nothing on disk can be
 * decrypted without a person present. The cost is that the key is gone on
 * every page load, and a page load is not an unusual event. A refresh, a link
 * opened in a new tab, closing the laptop lid, coming back tomorrow: each one
 * lands somebody in a workspace where Projects, files and saved outputs cannot
 * be read.
 *
 * What the product did with that was name a Settings page. The person is on
 * Projects, looking at a panel that says their work is locked, and the way
 * back to it is to leave, find Settings, find Vault inside it, type a
 * passphrase, and navigate back — and if they take the direct route and reload
 * the page they have just started over, because that reload dropped the key
 * again.
 *
 * So the unlock is here instead, on whatever surface needed it. Same three
 * credentials the Settings screen offers, same functions behind them; the only
 * difference is that using it does not cost the page you were on.
 */
export function VaultUnlockCard({
  /** What was being opened, so the reason reads as this screen's problem. */
  what = "Your work",
  onUnlocked,
}: {
  what?: string;
  onUnlocked?: () => void;
}) {
  const { user } = useSession();
  const [cfg, setCfg] = useState<Cfg>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [kit, setKit] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void loadVaultConfig(user.id)
      .then((row) => {
        if (live) setCfg(row);
      })
      .catch(() => {
        /* Reported by the surface that failed to read; not twice. */
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [user]);

  /*
   * Unlocking anywhere unlocks everywhere — the key is one module-level value —
   * so a second copy of this card on another panel must not keep asking.
   */
  useEffect(
    () =>
      subscribe(() => {
        if (isUnlocked()) onUnlocked?.();
      }),
    [onUnlocked],
  );

  async function run(action: () => Promise<void>, event: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      void recordAction({ actionId: event });
      setPassphrase("");
      setKit("");
      onUnlocked?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unlock the vault.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <GlassPanel className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking this browser's vault…
      </GlassPanel>
    );
  }

  /*
   * No vault at all is a different problem with a different answer: creating
   * one hands out a recovery kit that must be read and kept, which is not
   * something to do inside a panel somebody is trying to get past.
   */
  if (!cfg) {
    return (
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground">This browser has no vault yet</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This device encrypts {what.toLowerCase()} before anything else happens to it, and that
          needs a key. Setting one up hands you a recovery kit to keep.
        </p>
        <Link
          to="/settings/vault"
          className="mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
        >
          Set up the vault
        </Link>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Unlock className="h-4 w-4" aria-hidden /> Unlock this browser's vault
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        This device encrypts {what.toLowerCase()} before anything else happens to it. The key is
        never written down, so it is asked for again after every page load.
      </p>

      {cfg.credential_kind === "webauthn_prf" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => unlockWithWebAuthn(user.id), "vault.unlock")}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          <Fingerprint className="h-3.5 w-3.5" aria-hidden /> Unlock with authenticator
        </button>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (passphrase)
              void run(() => unlockWithPassphrase(user.id, passphrase), "vault.unlock");
          }}
        >
          <input
            aria-label="Vault passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase"
            className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={busy || !passphrase}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Unlock"}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setShowRecovery((current) => !current)}
        className="mt-3 text-xs text-muted-foreground underline"
      >
        {showRecovery ? "Hide recovery kit" : "Use recovery kit instead"}
      </button>
      {showRecovery ? (
        <div className="mt-2 flex gap-2">
          <input
            aria-label="Recovery kit"
            value={kit}
            onChange={(event) => setKit(event.target.value)}
            placeholder="XXXXX-XXXXX-XXXXX-…"
            className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={busy || !kit}
            onClick={() =>
              void run(() => unlockWithRecoveryKit(user.id, kit), "vault.recovery_used")
            }
            className="shrink-0 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
          >
            Unlock
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-[color:var(--state-danger)]">
          {error}
        </p>
      ) : null}
    </GlassPanel>
  );
}
