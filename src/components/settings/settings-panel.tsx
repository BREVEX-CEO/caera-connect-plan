/**
 * SETTINGS IS A PANEL, NOT A SECTION OF THE SITE.
 *
 * It used to be nineteen routes under `/settings`, which meant nineteen
 * screens to keep in step, nineteen places to deep-link into, and a navigation
 * hierarchy competing with the product's own. `docs/DECISIONS.md` #3 settles
 * it: Settings opens from Account, as a compact centred panel on the desktop
 * and a full-height sheet on a phone.
 *
 * The categories are fixed by `docs/PRD.md`. They arrive as the phases that
 * own them land; a category is listed only once it has something that works.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Bell, CreditCard, Database, Monitor, Moon, ShieldCheck, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/lib/appearance";
import { useSession } from "@/lib/session";
import { AdvancedSection } from "./AdvancedSection";
import { SignInMethods } from "./SignInMethods";
import { DataControlsSection } from "./DataControlsSection";
import { NotificationsSection } from "./NotificationsSection";
import { UsageSection } from "./UsageSection";
import { Action } from "./rows";
import { DELETE_CONFIRMATION, deleteMyAccount } from "@/lib/account.functions";

export type SettingsCategory =
  "account" | "appearance" | "notifications" | "data" | "billing" | "advanced";

interface SettingsPanelValue {
  open: (category?: SettingsCategory) => void;
  close: () => void;
}

const SettingsPanelContext = createContext<SettingsPanelValue | null>(null);

/** Safe outside the provider: public pages have no account menu to open it. */
export function useSettingsPanel(): SettingsPanelValue {
  return useContext(SettingsPanelContext) ?? NO_PANEL;
}

const NO_PANEL: SettingsPanelValue = { open: () => {}, close: () => {} };

export function SettingsPanelProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<SettingsCategory | null>(null);

  const open = useCallback((next: SettingsCategory = "account") => setCategory(next), []);
  const close = useCallback(() => setCategory(null), []);
  const value = useMemo<SettingsPanelValue>(() => ({ open, close }), [open, close]);

  useEffect(() => {
    if (!category) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [category, close]);

  return (
    <SettingsPanelContext.Provider value={value}>
      {children}
      {category ? (
        <SettingsDialog category={category} onCategoryChange={setCategory} onClose={close} />
      ) : null}
    </SettingsPanelContext.Provider>
  );
}

const CATEGORIES: { id: SettingsCategory; label: string; group: string; icon: typeof User }[] = [
  { id: "account", label: "Account", group: "General", icon: User },
  { id: "appearance", label: "Appearance", group: "General", icon: Monitor },
  { id: "notifications", label: "Notifications", group: "General", icon: Bell },
  { id: "data", label: "Data Controls", group: "Data", icon: Database },
  { id: "billing", label: "Billing", group: "Account", icon: CreditCard },
  { id: "advanced", label: "Advanced", group: "Account", icon: ShieldCheck },
];

function SettingsDialog({
  category,
  onCategoryChange,
  onClose,
}: {
  category: SettingsCategory;
  onCategoryChange: (next: SettingsCategory) => void;
  onClose: () => void;
}) {
  const groups = [...new Set(CATEGORIES.map((entry) => entry.group))];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="glass-strong relative flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl sm:h-[min(40rem,88vh)] sm:flex-row sm:rounded-2xl">
        <nav
          className="ocade-scroll shrink-0 overflow-y-auto border-b border-border/60 p-3 sm:w-[12.5rem] sm:border-b-0 sm:border-r"
          aria-label="Settings categories"
        >
          {groups.map((group) => (
            <div key={group} className="mb-2">
              <p className="px-2.5 pb-1 pt-2 text-[13px] text-muted-foreground">{group}</p>
              {CATEGORIES.filter((entry) => entry.group === group).map(
                ({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCategoryChange(id)}
                    aria-current={category === id ? "true" : undefined}
                    className={cn(
                      "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition-colors",
                      category === id
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="ocade-scroll min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold text-foreground">
              {CATEGORIES.find((entry) => entry.id === category)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {category === "account" ? <AccountSettings /> : null}
          {category === "appearance" ? <AppearanceSettings /> : null}
          {category === "notifications" ? <NotificationsSection /> : null}
          {category === "data" ? <DataControlsSection /> : null}
          {category === "advanced" ? <AdvancedSection /> : null}
          {category === "billing" ? <UsageSection /> : null}
        </div>
      </div>
    </div>
  );
}

/** One row: a label, an optional line of explanation, and one control. */
function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/50 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 rounded-full border border-border/60 transition-colors",
        checked ? "bg-primary" : "bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background transition-[left]",
          checked ? "left-[1.15rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

function AccountSettings() {
  const { user } = useSession();
  const [phrase, setPhrase] = useState("");
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div>
      {/* Google and email OTP are the only identities; phone sign-in is removed. */}
      <Row label="Signed in as" description={user?.email ?? "Not signed in"} />
      <SignInMethods />
      <Row label="Sign out" description="Ends this session on this device only.">
        <button
          type="button"
          onClick={() =>
            void import("@/integrations/supabase/on-demand").then(({ loadSupabaseClient }) =>
              loadSupabaseClient().then((supabase) => supabase.auth.signOut()),
            )
          }
          className="h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
        >
          Sign out
        </button>
      </Row>

      {/*
        DELETING AN ACCOUNT IS TYPED, NOT CLICKED.
        The server requires the exact phrase AND a recent second factor, so this
        screen is a convenience rather than the protection: refusing the request
        is what changes what is possible, and the server does that.
      */}
      <Row
        label="Delete your account"
        description={
          receipt ??
          problem ??
          "Everything on this account goes, permanently. Offline Intelligence on your devices is left alone."
        }
      >
        {receipt ? null : asking ? (
          <div className="flex items-center gap-2">
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              aria-label="Type DELETE MY ACCOUNT to confirm"
              placeholder={DELETE_CONFIRMATION}
              className="h-8 w-44 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
            <Action
              label={deleting ? "Deleting…" : "Delete"}
              busy={deleting || phrase.trim().toUpperCase() !== DELETE_CONFIRMATION}
              destructive
              onClick={async () => {
                setDeleting(true);
                setProblem(null);
                try {
                  const result = await deleteMyAccount({ data: { confirmation: phrase } });
                  setReceipt(`Deleted. Your reference is ${result.receipt.reference}.`);
                } catch (error) {
                  setProblem(error instanceof Error ? error.message : "That could not be done.");
                } finally {
                  setDeleting(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                setPhrase("");
              }}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Keep
            </button>
          </div>
        ) : (
          <Action label="Delete" destructive onClick={() => setAsking(true)} />
        )}
      </Row>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, reducedMotion, highContrast, setAppearance, saveError } = useAppearance();

  return (
    <div>
      <Row label="Theme">
        <div className="flex rounded-md border border-border p-0.5">
          {(["dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAppearance({ theme: mode })}
              aria-pressed={theme === mode}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-3 text-sm capitalize transition-colors",
                theme === mode ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <Moon className={cn("h-3.5 w-3.5", mode === "light" && "hidden")} aria-hidden />
              {mode}
            </button>
          ))}
        </div>
      </Row>
      <Row
        label="Reduce motion"
        description="Removes transitions. Your system setting is followed automatically."
      >
        <Toggle
          checked={reducedMotion}
          onChange={(next) => setAppearance({ reducedMotion: next })}
          label="Reduce motion"
        />
      </Row>
      <Row label="High contrast" description="Stronger borders and brighter secondary text.">
        <Toggle
          checked={highContrast}
          onChange={(next) => setAppearance({ highContrast: next })}
          label="High contrast"
        />
      </Row>
      {saveError ? (
        <p className="pt-3 text-[13px] text-muted-foreground" role="status">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
