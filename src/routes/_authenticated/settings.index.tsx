import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  LogOut,
  Loader2,
  Palette,
  MousePointer,
  User as UserIcon,
  Sun,
  Moon,
  Waves,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import { type ThemeMode, type CursorKind } from "@/lib/theme-provider";
import { useAppearance } from "@/lib/use-appearance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [{ title: "General — CAERA CADANE" }, { name: "robots", content: "noindex" }],
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

const LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "हिन्दी (भारत)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
  { value: "fr-FR", label: "Français (France)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "ja-JP", label: "日本語" },
];

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
    const cur = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (cur && !list.includes(cur)) list.unshift(cur);
  } catch {
    /* ignore */
  }
  return list;
}

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "real", label: "REAL", icon: Waves },
];

const CURSORS: { id: CursorKind; label: string }[] = [
  { id: "system", label: "System" },
  { id: "caera_black", label: "CAERA Black" },
  { id: "caera_white", label: "CAERA White" },
  { id: "auto_contrast", label: "Auto Contrast" },
];

function GeneralPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const appearance = useAppearance();

  const [row, setRow] = useState<ProfileRow | null>(null);
  const [dirty, setDirty] = useState<Partial<ProfileRow>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const tzList = guessTz();

  /**
   * The form must not pretend to be empty while the profile is still in
   * flight — typing into a field that is about to be overwritten loses the
   * edit. `loading` gates the form; `loadError` offers a retry instead of a
   * silently blank page.
   */
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
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
    setDirty((d) => ({ ...d, [key]: value }));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
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
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  return (
    <>
      <PageHeader
        eyebrow="Account · General"
        title="General"
        description="Your identity, personal OCADE instructions and quick appearance controls."
      />

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {/* Identity */}
      <GlassPanel className="p-5">
        <SectionHeading icon={UserIcon} title="Identity" />
        <div className="mt-4 flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-border/60 bg-secondary/60 text-sm font-semibold text-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1 grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input
                aria-label="Full name"
                type="text"
                value={view?.full_name ?? ""}
                onChange={(e) => update("full_name", e.target.value)}
                placeholder="e.g. Priya Sharma"
                className={inputCls}
              />
            </Field>
            <Field label="Preferred name">
              <input
                aria-label="Preferred name"
                type="text"
                value={view?.preferred_name ?? ""}
                onChange={(e) => update("preferred_name", e.target.value)}
                placeholder="OCADE will greet you with this"
                className={inputCls}
              />
            </Field>
            <Field label="Occupation or role" className="sm:col-span-2">
              <input
                aria-label="Occupation or role"
                type="text"
                value={view?.occupation ?? ""}
                onChange={(e) => update("occupation", e.target.value)}
                placeholder="e.g. Product designer, CA articled trainee"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </GlassPanel>

      {/* Personal OCADE instructions */}
      <GlassPanel className="mt-4 p-5">
        <SectionHeading title="Personal OCADE instructions" />
        <p className="mt-1 text-xs text-muted-foreground">
          A short note OCADE reads before every conversation. Kept in your account under RLS. Do not
          paste secrets or passwords.
        </p>
        <textarea
          aria-label="Custom instructions"
          value={view?.custom_instructions ?? ""}
          onChange={(e) => update("custom_instructions", e.target.value)}
          placeholder="Prefer concise replies. Use metric units. Explain financial terms in plain English."
          rows={4}
          maxLength={2000}
          className="mt-3 w-full rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {view?.custom_instructions?.length ?? 0} / 2000 characters
        </p>
      </GlassPanel>

      {/* Language & timezone */}
      <GlassPanel className="mt-4 p-5">
        <SectionHeading title="Language and region" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Language">
            <select
              aria-label="Language"
              value={view?.locale ?? "en-US"}
              onChange={(e) => update("locale", e.target.value)}
              className={inputCls}
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Time zone">
            <select
              aria-label="Time zone"
              value={view?.timezone ?? "UTC"}
              onChange={(e) => update("timezone", e.target.value)}
              className={inputCls}
            >
              {tzList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </GlassPanel>

      {/* Save bar */}
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
            onClick={save}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>

      {/* Quick appearance */}
      <GlassPanel className="mt-4 p-5">
        <SectionHeading icon={Palette} title="Quick appearance" />
        <p className="mt-1 text-xs text-muted-foreground">
          Full controls live in{" "}
          <Link to="/settings/appearance" className="underline underline-offset-4">
            Appearance
          </Link>
          .
        </p>

        <div className="mt-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Theme
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => {
              const active = appearance.theme === t.id;
              const Icon = t.icon;
              return (
                <button
                  aria-pressed={active}
                  key={t.id}
                  onClick={() => appearance.update({ theme: t.id })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Cursor
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CURSORS.map((c) => {
              const active = appearance.cursor === c.id;
              return (
                <button
                  aria-pressed={active}
                  key={c.id}
                  onClick={() => appearance.update({ cursor: c.id })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:bg-accent",
                  )}
                >
                  <MousePointer className="h-3.5 w-3.5" aria-hidden /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Reduce motion</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Disables nonessential animation across the app.
              {appearance.osReducedMotion ? " Your OS setting is on." : ""}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={appearance.reducedMotion || appearance.osReducedMotion}
            disabled={appearance.osReducedMotion}
            onClick={() => appearance.update({ reducedMotion: !appearance.reducedMotion })}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors",
              appearance.reducedMotion || appearance.osReducedMotion ? "bg-primary" : "bg-muted",
              appearance.osReducedMotion && "cursor-not-allowed opacity-70",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                appearance.reducedMotion || appearance.osReducedMotion
                  ? "translate-x-5"
                  : "translate-x-0.5",
              )}
            />
          </button>
        </label>
      </GlassPanel>

      {/* Sign out */}
      <GlassPanel className="mt-4 flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Sign out</div>
          <div className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{user?.email ?? user?.phone ?? "your account"}</span>.
            This ends the current session on this browser only.
          </div>
        </div>
        <button
          onClick={signOut}
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
  "h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40";

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
