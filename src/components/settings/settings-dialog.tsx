/** The Settings panel's contents, loaded when it first opens (see settings-panel.tsx). */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CreditCard,
  KeyRound,
  MonitorSmartphone,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { JarvisAccess } from "@/jarvis/JarvisPanels";
import { cn } from "@/lib/utils";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useAppearance } from "@/lib/appearance";
import { useBubblePlacement, writePlacement } from "@/jarvis/bubble-state";
import {
  JARVIS_DEFAULTS,
  readPreferences,
  useJarvisPreferences,
  writePreferences,
} from "@/jarvis/preferences";
import { pickVoice } from "@/jarvis/use-voice";
import { useSession } from "@/lib/session";
import { useInstallation } from "@/lib/brain/use-installation";
import { AdvancedSection } from "./AdvancedSection";
import { SignInMethods } from "./SignInMethods";
import { TwoStep } from "./TwoStep";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { DataControlsSection } from "./DataControlsSection";
import { NotificationsSection } from "./NotificationsSection";
import { UsageSection } from "./UsageSection";
import { BillingSection } from "./BillingSection";
import { ByokSection } from "./ByokSection";
import { MemorySection } from "./MemorySection";
import { Action, Row, Toggle } from "./rows";
import { DELETE_CONFIRMATION, deleteMyAccount } from "@/lib/account.functions";
import type { SettingsCategory } from "./settings-panel";

/*
 * SIX CATEGORIES (owner, 21 Oct; BYOK added 15 Nov). Preferences holds appearance, voice, memory
 * and notifications; Devices holds the computers JARVIS works on and what each may do; data
 * controls and sessions are privacy and security; the allowance and the plan are billing; BYOK
 * holds the person's own model keys and which source serves Chat and JARVIS.
 */
const CATEGORIES: { id: SettingsCategory; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "devices", label: "Devices", icon: MonitorSmartphone },
  { id: "privacy", label: "Privacy & Security", icon: ShieldCheck },
  { id: "billing", label: "Billing & Usage", icon: CreditCard },
  { id: "byok", label: "BYOK", icon: KeyRound },
];

export default function SettingsDialog({
  category,
  onCategoryChange,
  onClose,
}: {
  category: SettingsCategory;
  onCategoryChange: (next: SettingsCategory) => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const location = useLocation();
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
        {/* On a phone the categories are one scrollable row of chips above the settings. */}
        <nav
          className="ocade-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 p-2 sm:block sm:w-[12.5rem] sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3"
          aria-label="Settings categories"
        >
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onCategoryChange(id)}
              aria-current={category === id ? "true" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3 text-[0.9375rem] transition-colors duration-150 sm:mb-0.5 sm:w-full",
                category === id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
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

          {!user && category !== "preferences" ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Sign in to manage your account settings.</p>
              <Link
                to="/auth"
                search={{ next: location.pathname + location.searchStr }}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-foreground hover:bg-accent"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {category === "account" ? <AccountSettings /> : null}
              {category === "preferences" ? (
                <>
                  <AppearanceSettings />
                  <JarvisVoiceSetting />
                  {user ? <NotificationsSection /> : null}
                  <ResetJarvis />
                </>
              ) : null}
              {category === "devices" ? <JarvisAccess /> : null}
              {category === "privacy" ? (
                <>
                  <MemorySection />
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
              {category === "byok" ? <ByokSection /> : null}
            </>
          )}
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
  /* Unchecked by default: Offline Mode belongs to the browser, not the account. */
  const [removeOffline, setRemoveOffline] = useState(false);
  const offline = useInstallation();
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
            void import("@/integrations/supabase/on-demand")
              .then(({ loadSupabaseClient }) =>
                // This device only: signing out here must not end the person's other devices.
                loadSupabaseClient().then((supabase) => supabase.auth.signOut({ scope: "local" })),
              )
              .catch(() =>
                toast.error("OCADE could not sign you out. Check your connection and try again."),
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
          "Everything on this account goes, permanently. Offline Mode stays set up in this browser unless you choose to remove it."
        }
      >
        {receipt ? null : asking ? (
          <div className="flex w-full flex-col gap-2">
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
                    // The deleted account's unsent offline turns are erased from this browser.
                    if (user) {
                      await import("@/lib/chat/unsynced-turns")
                        .then((module) => module.forgetAllUnsyncedTurns(user.id))
                        .catch(() => undefined);
                    }
                    // Only after the account's own deletion is accepted, and only when asked.
                    const offlineRemoved = removeOffline
                      ? await offline.uninstall().then(
                          () => true,
                          () => false,
                        )
                      : null;
                    setReceipt(
                      `Deleted. Your reference is ${result.receipt.reference}.` +
                        (offlineRemoved === false
                          ? " Offline Mode could not be removed from this browser; remove it in Settings."
                          : offlineRemoved
                            ? " Offline Mode was removed from this browser."
                            : ""),
                    );
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
            <label className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
              <input
                type="checkbox"
                checked={removeOffline}
                onChange={(event) => setRemoveOffline(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also remove Offline Mode from this browser
                {removeOffline
                  ? ". Offline Chat stops working here for every account that uses this browser; other accounts' chats are not deleted."
                  : ""}
              </span>
            </label>
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

/**
 * The voice JARVIS answers in, from the voices this device has: browsers do not say which voice
 * is female or male, so each is listed by its own name (natural/online voices first) to hear
 * with Preview and choose.
 */
function JarvisVoiceSetting() {
  const { voice } = useJarvisPreferences();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const list = () =>
      setVoices(
        window.speechSynthesis
          .getVoices()
          .slice()
          .sort(
            (a, b) =>
              Number(/natural|online|neural/i.test(b.name)) -
                Number(/natural|online|neural/i.test(a.name)) || a.name.localeCompare(b.name),
          ),
      );
    list();
    window.speechSynthesis.addEventListener("voiceschanged", list);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", list);
  }, []);
  const choose = (next: string | null) => writePreferences({ ...readPreferences(), voice: next });
  const preview = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello, I'm JARVIS.");
    utterance.voice = pickVoice(voices, voice, navigator.language);
    window.speechSynthesis.speak(utterance);
  };
  if (!voices.length) {
    return (
      <Row label="JARVIS voice" description="This browser has no voices to read answers in." />
    );
  }
  return (
    <Row label="JARVIS voice">
      <div className="flex items-center gap-2">
        <select
          aria-label="JARVIS voice"
          value={voices.some((each) => each.voiceURI === voice) ? (voice ?? "") : ""}
          onChange={(event) => choose(event.target.value || null)}
          className="h-8 max-w-56 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">JARVIS (natural voice when this device has one)</option>
          {voices.map((each) => (
            <option key={each.voiceURI} value={each.voiceURI}>
              {each.name} ({each.lang})
            </option>
          ))}
        </select>
        <Action label="Preview" onClick={preview} />
      </div>
    </Row>
  );
}

/** Every JARVIS choice on this device back to how it started; nothing else is touched. */
function ResetJarvis() {
  return (
    <Row
      label="Reset JARVIS settings"
      description="Voice and layout go back to their defaults on this device."
    >
      <Action label="Reset" onClick={() => writePreferences(JARVIS_DEFAULTS)} />
    </Row>
  );
}

function AppearanceSettings() {
  const { theme, textSize, reducedMotion, highContrast, setAppearance, saveError } =
    useAppearance();

  return (
    <div>
      <Row label="Theme" description="System follows your device's light or dark setting.">
        <div className="flex rounded-md border border-border p-0.5">
          {(["dark", "light", "system"] as const).map((mode) => (
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
              <Moon className={cn("h-3.5 w-3.5", mode !== "dark" && "hidden")} aria-hidden />
              {mode}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Text size" description="Makes everything on OCADE larger on this device.">
        <div className="flex rounded-md border border-border p-0.5">
          {(
            [
              ["default", "Default"],
              ["large", "Large"],
              ["larger", "Larger"],
            ] as const
          ).map(([size, label]) => (
            <button
              key={size}
              type="button"
              onClick={() => setAppearance({ textSize: size })}
              aria-pressed={textSize === size}
              className={cn(
                "flex h-7 items-center rounded px-3 text-sm transition-colors",
                textSize === size ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
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
        <p className="pt-3 text-[0.8125rem] text-muted-foreground" role="status">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
