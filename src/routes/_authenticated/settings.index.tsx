import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, LogOut, Loader2, Palette, User as UserIcon, Users2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { DeviceAvatarEditor } from "@/components/settings/DeviceAvatarEditor";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import { isSupportedLocale, SUPPORTED_LOCALES } from "@/lib/locale/supported-locales";
import { writeStoredLocale } from "@/lib/locale/use-locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [{ title: "General — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: GeneralPage,
});

type ProfileRow = {
  full_name: string | null;
  preferred_name: string | null;
  occupation: string | null;
  custom_instructions: string | null;
  locale: string;
  timezone: string;
};

/*
 * The list lives in `lib/locale/supported-locales.ts` now.
 *
 * It was written out here as well, and the two were already a duplicate
 * authority in the making: this copy carried labels and nothing else, so it
 * could not say which locales OCADE's interface text is actually translated
 * into — and the screen would have kept offering eight languages as though they
 * were equivalent.
 */

function guessTz(): string[] {
  const list = [
    "UTC",
    "Asia/Kolkata",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Australia/Sydney",
  ];
  try {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (current && !list.includes(current)) list.unshift(current);
  } catch {
    // Keep the stable list when Intl timezone detection is unavailable.
  }
  return list;
}

function GeneralPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [dirty, setDirty] = useState<Partial<ProfileRow>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const tzList = guessTz();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, preferred_name, occupation, custom_instructions, locale, timezone")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      setRow(
        data ?? {
          full_name: null,
          preferred_name: null,
          occupation: null,
          custom_instructions: null,
          locale: "en-US",
          timezone: "UTC",
        },
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  function update<K extends keyof ProfileRow>(key: K, value: ProfileRow[K]) {
    setDirty((current) => ({ ...current, [key]: value }));
  }

  const view: ProfileRow | null = row
    ? {
        full_name: dirty.full_name ?? row.full_name,
        preferred_name: dirty.preferred_name ?? row.preferred_name,
        occupation: dirty.occupation ?? row.occupation,
        custom_instructions: dirty.custom_instructions ?? row.custom_instructions,
        locale: dirty.locale ?? row.locale,
        timezone: dirty.timezone ?? row.timezone,
      }
    : null;

  const hasChanges = Object.keys(dirty).length > 0;

  async function save() {
    const supabase = await loadSupabaseClient();
    if (!user || !view || !hasChanges) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: view.full_name,
          preferred_name: view.preferred_name,
          occupation: view.occupation,
          custom_instructions: view.custom_instructions,
          locale: view.locale,
          timezone: view.timezone,
        })
        .eq("id", user.id);
      if (error) throw error;
      setRow(view);
      setDirty({});
      setSavedAt(Date.now());
      await recordAction({
        actionId: "settings.profile.update",
        metadata: { fields: Object.keys(dirty) },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    const supabase = await loadSupabaseClient();
    setSigningOut(true);
    await recordAction({ actionId: "auth.sign_out" });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    (view?.preferred_name || view?.full_name || user?.email || "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="General"
        description="Your identity, preferences and the short instructions OCADE should remember."
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span>Could not load your profile.</span>
          <button
            onClick={() => setReloadKey((key) => key + 1)}
            /*
             * A REAL TOUCH TARGET — see the identical control in
             * `TwoFactorPanel`. Bare underlined text measured 30x16, below the
             * 24x24 minimum, on the one control a person needs after a failure.
             */
            className="inline-flex min-h-6 shrink-0 items-center px-1 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !loadError ? (
        <GlassPanel className="mb-4 flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your profile…
        </GlassPanel>
      ) : null}

      <GlassPanel className="p-5">
        <SectionHeading icon={UserIcon} title="You" />
        {/*
          THE FIELDS WRAP UNDER THE AVATAR RATHER THAN BEING CRUSHED BESIDE IT.

          `flex items-start gap-4` with no wrap gave the avatar editor its
          full 378px and left the field grid whatever remained — which, in the
          settings column at 1024, was nothing at all: the grid measured
          zero wide and its labels spilled 34px past the page, so the whole
          document scrolled sideways. `min-w-0` alone cannot save a flex item
          the row has no room for; it only lets it shrink to nothing more
          politely.

          `flex-wrap` with a 288px basis says what was actually meant: sit
          beside the avatar when there is room for both, and drop to your own
          full-width line when there is not.
        */}
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <DeviceAvatarEditor
            storageKey={`ocade:device-avatar:${user?.id ?? "anonymous"}`}
            initials={initials}
          />
          <div className="grid min-w-0 flex-1 basis-72 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input
                aria-label="Full name"
                type="text"
                value={view?.full_name ?? ""}
                onChange={(event) => update("full_name", event.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Preferred name">
              <input
                aria-label="Preferred name"
                type="text"
                value={view?.preferred_name ?? ""}
                onChange={(event) => update("preferred_name", event.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Occupation or role" className="sm:col-span-2">
              <input
                aria-label="Occupation or role"
                type="text"
                value={view?.occupation ?? ""}
                onChange={(event) => update("occupation", event.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <SectionHeading title="How OCADE should respond" />
        <textarea
          aria-label="Custom instructions"
          value={view?.custom_instructions ?? ""}
          onChange={(event) => update("custom_instructions", event.target.value)}
          placeholder="Prefer concise replies. Use metric units."
          rows={3}
          maxLength={2000}
          className="mt-3 w-full rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <SectionHeading title="Language & region" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Language">
            <select
              aria-label="Language"
              value={view?.locale ?? "en-US"}
              onChange={(event) => {
                const next = event.target.value;
                update("locale", next);
                /*
                 * Written locally as well as to the profile, and that is not a
                 * second authority — it is the same choice, cached where the
                 * rest of the product can read it synchronously and offline.
                 * Dates and numbers are formatted on every screen; waiting for
                 * a profile round trip to know how would mean formatting the
                 * first paint wrong and correcting it, on every visit.
                 */
                if (isSupportedLocale(next)) writeStoredLocale(next);
              }}
              className={inputCls}
            >
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale.tag} value={locale.tag}>
                  {locale.label} — {locale.nativeLabel}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time zone">
            <select
              aria-label="Time zone"
              value={view?.timezone ?? "UTC"}
              onChange={(event) => update("timezone", event.target.value)}
              className={inputCls}
            >
              {tzList.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {/*
         * SAID PLAINLY, BECAUSE OFFERING EIGHT LANGUAGES IMPLIES EIGHT
         * TRANSLATIONS.
         *
         * OCADE formats dates, times, numbers and amounts in every locale here
         * — which is not a consolation prize: a German reader shown 9/3/2026
         * reads September the third as March the ninth. Its interface TEXT is
         * English. Shipping machine translations for the rest would look like
         * support and read like nonsense, and the person affected is the one
         * least able to tell us it is wrong.
         */}
        <p className="mt-3 text-xs text-muted-foreground">
          Dates, times and numbers follow the language you choose. OCADE&rsquo;s own wording is in
          English for now — {SUPPORTED_LOCALES.filter((locale) => !locale.translated).length} of
          these languages are not translated yet, and OCADE says so rather than showing you a
          machine translation.
        </p>
      </GlassPanel>

      <GlassPanel className="mt-4 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <SectionHeading icon={Palette} title="Appearance" />
          <p className="mt-1 text-xs text-muted-foreground">
            Visual style and 3D motion are managed in one place.
          </p>
        </div>
        <Link
          to="/settings/appearance"
          className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent"
        >
          Open appearance
        </Link>
      </GlassPanel>

      {/*
        Organization is a top-level route rather than a settings page, and this
        is the link that makes it findable: somebody looking for "where do I add
        a colleague" opens Settings, and a route nothing points at is a route
        only its author knows about.
      */}
      <GlassPanel className="mt-4 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <SectionHeading icon={Users2} title="Organization" />
          <p className="mt-1 text-xs text-muted-foreground">
            People, roles, invitations and groups for the workspaces you belong to.
          </p>
        </div>
        <Link
          to="/organization"
          className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent"
        >
          Open organization
        </Link>
      </GlassPanel>

      <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : hasChanges ? (
            "Unsaved changes"
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" /> Saved
            </span>
          ) : (
            "All changes saved"
          )}
        </span>
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <button
              onClick={() => setDirty({})}
              disabled={saving}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Discard
            </button>
          ) : null}
          <button
            onClick={() => void save()}
            disabled={saving || !hasChanges}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <GlassPanel className="mt-4 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Sign out</div>
          <div className="text-xs text-muted-foreground">Ends this browser session only.</div>
        </div>
        <button
          onClick={() => void signOut()}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
        </button>
      </GlassPanel>
    </>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionHeading({ icon: Icon, title }: { icon?: typeof UserIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-primary" aria-hidden /> : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}
