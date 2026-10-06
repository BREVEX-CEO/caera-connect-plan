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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell, CreditCard, Monitor, Moon, ShieldCheck, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useAppearance } from "@/lib/appearance";
import { useBubblePlacement, writePlacement } from "@/jarvis/bubble-state";
import { useSession } from "@/lib/session";
import { AdvancedSection } from "./AdvancedSection";
import { SignInMethods } from "./SignInMethods";
import { TwoStep } from "./TwoStep";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { DataControlsSection } from "./DataControlsSection";
import { NotificationsSection } from "./NotificationsSection";
import { UsageSection } from "./UsageSection";
import { BillingSection } from "./BillingSection";
import { Action, Row, Toggle } from "./rows";
import { DELETE_CONFIRMATION, deleteMyAccount } from "@/lib/account.functions";

const SETTINGS_CATEGORIES = [
  "account",
  "appearance",
  "notifications",
  "privacy",
  "billing",
] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

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

  /*
   * A LINK CAN OPEN SETTINGS: `?settings=privacy` on any page. Settings is a
   * panel, not a page, so a notification about sessions or two-step has no
   * address of its own to point at; this is that address. Taken once and
   * dropped from the bar, so a reload or Back does not open it again.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    const asked = url.searchParams.get("settings");
    if (!asked) return;
    if (SETTINGS_CATEGORIES.includes(asked as SettingsCategory))
      setCategory(asked as SettingsCategory);
    url.searchParams.delete("settings");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

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

/*
 * FIVE CATEGORIES (docs/JARVIS_DESIGN_SYSTEM.md, Settings). Data controls and
 * signed-in sessions are both privacy and security; the allowance and the plan
 * are both billing and usage. JARVIS's own permissions stay in JARVIS, where
 * they are used.
 */
const CATEGORIES: { id: SettingsCategory; label: string; group: string; icon: typeof User }[] = [
  { id: "account", label: "Account", group: "General", icon: User },
  { id: "appearance", label: "Appearance", group: "General", icon: Monitor },
  { id: "notifications", label: "Notifications", group: "General", icon: Bell },
  { id: "privacy", label: "Privacy & Security", group: "Your data", icon: ShieldCheck },
  { id: "billing", label: "Billing & Usage", group: "Your data", icon: CreditCard },
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
  const self = useRef<HTMLDivElement>(null);
  useModalFocus(self, true);

  return (
    <div
      ref={self}
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
        {/*
          ON A PHONE THE CATEGORIES ARE A STRIP, NOT A COLUMN.
          Seven stacked rows of categories with their group headings took most of
          the sheet's height and left the settings themselves in a band at the
          bottom. The same list becomes one scrollable row of chips below `sm` —
          the pattern a phone already uses for tabs — and the desktop sidebar is
          untouched. Group headings are a desktop affordance and are hidden
          rather than shortened.
        */}
        <nav
          className="ocade-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 p-2 sm:block sm:w-[12.5rem] sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3"
          aria-label="Settings categories"
        >
          {groups.map((group) => (
            <div key={group} className="flex gap-1 sm:mb-2 sm:block">
              <p className="hidden px-2.5 pb-1 pt-2 text-[13px] text-muted-foreground sm:block">
                {group}
              </p>
              {CATEGORIES.filter((entry) => entry.group === group).map(
                ({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCategoryChange(id)}
                    aria-current={category === id ? "true" : undefined}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-[15px] transition-colors sm:w-full",
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
          {category === "privacy" ? (
            <>
              <DataControlsSection />
              <AdvancedSection />
            </>
          ) : null}
          {category === "billing" ? (
            <>
              <UsageSection />
              <BillingSection />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { user } = useSession();
  const [phrase, setPhrase] = useState("");
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { withProof, dialog } = useConfirmIdentity();

  return (
    <div>
      {dialog}
      {/* Google and email OTP are the only identities; phone sign-in is removed. */}
      <Row label="Signed in as" description={user?.email ?? "Not signed in"} />
      {/* Keyed by the account: another account never sees the last one's methods. */}
      {/* Keyed by account so another account starts fresh, and by section so the
          two never share a key: siblings with one key were duplicated by React on
          every account update (an email change showed three copies of this form). */}
      {user ? <SignInMethods key={`sign-in-${user.id}`} /> : null}
      {user ? <TwoStep key={`two-step-${user.id}`} /> : null}
      <Row label="Sign out" description="Ends this session on this device only.">
        <button
          type="button"
          onClick={() =>
            void import("@/integrations/supabase/on-demand").then(({ loadSupabaseClient }) =>
              // This device only: signing out here must not end the person's other devices.
              loadSupabaseClient().then((supabase) => supabase.auth.signOut({ scope: "local" })),
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
          <div className="flex w-full items-center gap-2">
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              aria-label="Type DELETE MY ACCOUNT to confirm"
              placeholder={DELETE_CONFIRMATION}
              className="h-8 w-full min-w-0 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring sm:w-44"
            />
            <Action
              label={deleting ? "Deleting…" : "Delete"}
              busy={deleting || phrase.trim().toUpperCase() !== DELETE_CONFIRMATION}
              destructive
              onClick={async () => {
                setDeleting(true);
                setProblem(null);
                try {
                  const result = await withProof(() =>
                    deleteMyAccount({ data: { confirmation: phrase } }),
                  );
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

/** The floating JARVIS bubble on phones; kept on this device only. */
function BubbleSetting() {
  const { hidden } = useBubblePlacement();
  return (
    <Row
      label="JARVIS bubble"
      description="A small JARVIS button on phones, outside the JARVIS page."
    >
      <Toggle
        checked={!hidden}
        onChange={(next) => writePlacement({ hidden: !next })}
        label="JARVIS bubble"
      />
    </Row>
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
      <BubbleSetting />
      {saveError ? (
        <p className="pt-3 text-[13px] text-muted-foreground" role="status">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
