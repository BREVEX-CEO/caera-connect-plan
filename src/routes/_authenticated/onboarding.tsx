import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { OnboardingShell } from "@/components/shell/OnboardingShell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { isVaultConfigured } from "@/lib/storage/vault";
import { setModeFor } from "@/lib/storage/resolver";
import { DATA_CLASSES } from "@/lib/storage/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Onboarding — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingPage,
});

type AccountType = "solo" | "small_business" | "enterprise";
type PrivacyMode = "device_only" | "private_sync";

/**
 * What a new account can actually turn on.
 *
 * Offering FICIA, MADEE and CANIA here would ask someone to choose modules
 * that do not exist, and then store the answer as a preference nothing reads.
 * They are reserved names, not options.
 */
const modules = [{ id: "ocade", label: "OCADE — assistant" }] as const;

type ModuleId = (typeof modules)[number]["id"];

function OnboardingPage() {
  const { user } = useSession();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState(
    typeof navigator !== "undefined" ? (navigator.language ?? "en-US") : "en-US",
  );
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
  );
  const [accountType, setAccountType] = useState<AccountType>("solo");
  const [privacy, setPrivacy] = useState<PrivacyMode>("private_sync");
  const [enabled, setEnabled] = useState<ModuleId[]>(["ocade"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = 5;

  const canNext = useMemo(() => {
    if (step === 1) return displayName.trim().length >= 2;
    return true;
  }, [step, displayName]);

  function toggle(id: ModuleId) {
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function finish() {
    if (!user) return;
    setBusy(true);
    setError(null);

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        locale,
        timezone,
        onboarding_completed: true,
        onboarding_step: "done",
      })
      .eq("id", user.id);

    if (profileErr) {
      setError(profileErr.message);
      setBusy(false);
      return;
    }

    const { error: settingsErr } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        main_purpose: accountType,
        privacy_chats: privacy,
        privacy_files: privacy,
        privacy_images: privacy,
        privacy_copilot: privacy,
        privacy_recordings: privacy,
        privacy_resumes: privacy,
        privacy_company: privacy,
        privacy_timesheets: privacy,
        modules: enabled,
        // The FICIA family-planning slice was never built and its module option
        // is gone, so this can only ever be false. Written explicitly rather
        // than left out: the column is NOT NULL and an existing account that
        // once ticked the box must not keep an enabled flag for absent code.
        family_planning_enabled: false,
      },
      { onConflict: "user_id" },
    );
    if (settingsErr) {
      setError(settingsErr.message);
      setBusy(false);
      return;
    }

    /*
     * WRITE THE PRIVACY CHOICE WHERE THE PRODUCT ACTUALLY READS IT.
     *
     * The columns above are `user_settings.privacy_*`. Nothing routes storage
     * by them. `resolveAdapter` — the function that decides, for every chat,
     * file and image, whether it stays on this device or is uploaded — reads
     * `data_class_privacy`, and the only screen that had ever written that
     * table was Settings › Privacy.
     *
     * So this step asked people to choose, recorded the answer, and then
     * ignored it: whoever picked "Device only" at signup had their chats,
     * files and images routed by the built-in default instead, which is
     * Private Sync. A privacy setting that is stored and not honoured is worse
     * than one that was never offered.
     *
     * Written per data class because that is the grain the resolver reads at,
     * and settled together so a partial failure is visible rather than leaving
     * half the classes on the default.
     */
    const storageMode = privacy === "device_only" ? "browser_only" : "private_sync";
    const routed = await Promise.allSettled(
      DATA_CLASSES.map((dataClass) => setModeFor(user.id, dataClass, storageMode)),
    );
    const refused = routed.filter((outcome) => outcome.status === "rejected");
    if (refused.length) {
      setError(
        `Your privacy choice could not be saved for ${refused.length} of ${DATA_CLASSES.length} kinds of data. Set it in Settings › Privacy before adding anything you care about.`,
      );
      setBusy(false);
      return;
    }

    /*
     * SETUP IS NOT FINISHED UNTIL THERE IS SOMEWHERE TO PUT THINGS.
     *
     * Both privacy modes write to this device first — Private Sync included,
     * which uploads in the background but keeps the authoritative copy in the
     * browser vault. That vault is encrypted under a key nothing here creates,
     * and until it exists every surface backed by storage refuses to open.
     *
     * Onboarding used to send people straight to the workspace anyway. What
     * they met there was a Projects page that could not list, a Files panel
     * that could not read, and a Settings screen they had no reason to visit
     * holding the one control that would fix it. Choosing a privacy mode and
     * then not being given the means to use it is not a choice, it is a
     * dead end.
     *
     * A vault that is already configured — a second device, a returning
     * account — skips this and goes where it always did.
     */
    let vaultReady = true;
    try {
      vaultReady = await isVaultConfigured(user.id);
    } catch {
      /*
       * Could not tell. Do not trap somebody in setup over a failed read:
       * the workspace states the locked case honestly on its own.
       */
      vaultReady = true;
    }
    navigate({ to: vaultReady ? "/home" : "/settings/vault", replace: true });
  }

  return (
    <OnboardingShell step={step} total={total} title={titleFor(step)} subtitle={subtitleFor(step)}>
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <Field label="How should OCADE address you?" htmlFor="displayName">
            <input
              aria-label="How should OCADE address you?"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              placeholder="e.g. Alex Rivera"
              className="w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Language" htmlFor="locale">
              <input
                aria-label="Language"
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Timezone" htmlFor="tz">
              <input
                aria-label="Timezone"
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <RadioGroup
          value={accountType}
          onChange={(v) => setAccountType(v as AccountType)}
          options={[
            {
              value: "solo",
              title: "Solo",
              desc: "Just you. Personal projects, resumes, private assistant.",
            },
            {
              value: "small_business",
              title: "Small business",
              desc: "Up to a small team. Company profile, invoices, timesheets.",
            },
            {
              value: "enterprise",
              title: "Enterprise",
              desc: "Multi-tenant, roles, audit — ships after Foundation Alpha.",
            },
          ]}
        />
      ) : null}

      {step === 3 ? (
        <RadioGroup
          value={privacy}
          onChange={(v) => setPrivacy(v as PrivacyMode)}
          options={[
            {
              value: "private_sync",
              title: "Private Sync (recommended)",
              desc: "Encrypted account sync across your approved devices. RLS enforced on every read.",
            },
            {
              value: "device_only",
              title: "Device Only",
              desc: "Chats, files and project data stay on this device. No cloud sync.",
            },
          ]}
        />
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col gap-2">
          {modules.map((m) => {
            const active = enabled.includes(m.id);
            return (
              <button
                aria-pressed={active}
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  active
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{m.label}</span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <Row label="Display name" value={displayName} />
          <Row label="Language" value={locale} />
          <Row label="Timezone" value={timezone} />
          <Row label="Account type" value={labelFor(accountType)} />
          <Row label="Privacy" value={privacy === "device_only" ? "Device Only" : "Private Sync"} />
          <Row
            label="Modules"
            value={
              enabled.length
                ? enabled.map((id) => modules.find((m) => m.id === id)?.label).join(", ")
                : "None"
            }
          />
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          disabled={step === 1 || busy}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          Back
        </button>
        {step < total ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => Math.min(total, s + 1))}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enter workspace
          </button>
        )}
      </div>
    </OnboardingShell>
  );
}

function titleFor(step: number) {
  switch (step) {
    case 1:
      return "Tell us about you";
    case 2:
      return "How will you use CARCC CADANE?";
    case 3:
      return "Choose your privacy mode";
    case 4:
      return "Pick your starting modules";
    default:
      return "Review and continue";
  }
}
function subtitleFor(step: number) {
  switch (step) {
    case 1:
      return "Basic profile — you can change any of this later in Settings.";
    case 2:
      return "This sets sensible defaults. You can switch account type anytime.";
    case 3:
      return "You can change this per-project and per-module later.";
    case 4:
      return "Every module can be enabled or hidden later — no dead buttons.";
    default:
      return "Confirm your setup and enter your workspace.";
  }
}
function labelFor(t: AccountType) {
  return { solo: "Solo", small_business: "Small business", enterprise: "Enterprise" }[t];
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-none">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function RadioGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; title: string; desc: string }[];
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col rounded-lg border px-4 py-3 text-left transition-colors",
              active
                ? "border-primary/60 bg-primary/10"
                : "border-border/60 bg-background/40 hover:bg-accent/40",
            )}
          >
            <span className="text-sm font-medium text-foreground">{o.title}</span>
            <span className="text-xs text-muted-foreground">{o.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
